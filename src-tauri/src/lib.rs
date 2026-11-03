pub mod actions;
pub mod models;
#[cfg(windows)]
mod native;
pub mod persistence;
#[cfg(windows)]
mod window;
#[cfg(windows)]
mod desktop {
    use crate::{models::*, native::Listener, persistence::Database};
    use std::sync::{
        atomic::{AtomicBool, Ordering},
        Mutex,
    };
    static DIALOG_ACTIVE: AtomicBool = AtomicBool::new(false);
    #[tauri::command]
    fn set_dialog_active(active: bool, window: tauri::WebviewWindow) -> Result<(), String> {
        DIALOG_ACTIVE.store(active, Ordering::Relaxed);
        if !active {
            window.show().map_err(|e| e.to_string())?;
            window.set_focus().map_err(|e| e.to_string())?;
        }
        Ok(())
    }
    use tauri::{
        menu::{Menu, MenuItem},
        tray::TrayIconBuilder,
        Manager, State,
    };
    struct NativeState(Mutex<Option<Listener>>);
    #[tauri::command]
    fn get_state(db: State<Database>) -> Result<StateSnapshot, String> {
        db.snapshot()
    }
    #[tauri::command]
    fn execute_action(id: String, db: State<Database>) -> Result<(), String> {
        crate::actions::execute(&id, &db)?;
        db.record_use(&id)
    }
    #[tauri::command]
    fn hide_launcher(window: tauri::WebviewWindow) -> Result<(), String> {
        window.hide().map_err(|e| e.to_string())
    }
    #[tauri::command]
    fn save_settings(
        settings: Settings,
        db: State<Database>,
        native: State<NativeState>,
    ) -> Result<(), String> {
        settings.validate()?;
        let guard = native.0.lock().map_err(|e| e.to_string())?;
        let listener = guard.as_ref().ok_or("Captura global indisponível.")?;
        db.save_settings(settings.clone())?;
        listener.set_trigger(&settings.trigger);
        Ok(())
    }
    #[tauri::command]
    fn add_shortcut(
        title: String,
        category: String,
        action: Action,
        db: State<Database>,
    ) -> Result<Shortcut, String> {
        db.add_shortcut(title, category, action)
    }
    #[tauri::command]
    fn remove_shortcut(id: String, db: State<Database>) -> Result<(), String> {
        db.remove_shortcut(&id)
    }
    #[tauri::command]
    fn clear_history(db: State<Database>) -> Result<(), String> {
        db.clear_history()
    }
    pub fn run() {
        let app = tauri::Builder::default()
            .plugin(tauri_plugin_dialog::init())
            .invoke_handler(tauri::generate_handler![
                get_state,
                execute_action,
                hide_launcher,
                save_settings,
                add_shortcut,
                remove_shortcut,
                clear_history,
                set_dialog_active
            ])
            .setup(|app| {
                let directory = app.path().app_local_data_dir()?;
                std::fs::create_dir_all(&directory)?;
                let db = Database::open(&directory.join("orbit.sqlite3"))
                    .map_err(std::io::Error::other)?;
                let settings = db.snapshot().map_err(std::io::Error::other)?.settings;
                let listener = Listener::start(app.handle().clone(), &settings.trigger)
                    .map_err(std::io::Error::other)?;
                app.manage(db);
                app.manage(NativeState(Mutex::new(Some(listener))));
                let open = MenuItem::with_id(app, "open", "Abrir Orbit", true, None::<&str>)?;
                let quit = MenuItem::with_id(app, "quit", "Encerrar Orbit", true, None::<&str>)?;
                let menu = Menu::with_items(app, &[&open, &quit])?;
                let mut tray = TrayIconBuilder::new()
                    .tooltip("Orbit — Alt + clique central")
                    .menu(&menu)
                    .on_menu_event(|app, event| match event.id.as_ref() {
                        "open" => {
                            if let Err(e) = crate::window::activate(app) {
                                eprintln!("ORBIT: {e}");
                            }
                        }
                        "quit" => app.exit(0),
                        _ => (),
                    });
                if let Some(icon) = app.default_window_icon() {
                    tray = tray.icon(icon.clone());
                }
                tray.build(app)?;
                Ok(())
            })
            .on_window_event(|window, event| match event {
                tauri::WindowEvent::Focused(false) => {
                    if !DIALOG_ACTIVE.load(Ordering::Relaxed) {
                        let _ = window.hide();
                    }
                }
                tauri::WindowEvent::CloseRequested { api, .. } => {
                    api.prevent_close();
                    let _ = window.hide();
                }
                _ => (),
            })
            .build(tauri::generate_context!());
        let app = match app {
            Ok(app) => app,
            Err(error) => {
                let message: Vec<u16> = format!("Não foi possível iniciar o Orbit: {error}")
                    .encode_utf16()
                    .chain(Some(0))
                    .collect();
                let title: Vec<u16> = "ORBIT".encode_utf16().chain(Some(0)).collect();
                unsafe {
                    windows_sys::Win32::UI::WindowsAndMessaging::MessageBoxW(
                        std::ptr::null_mut(),
                        message.as_ptr(),
                        title.as_ptr(),
                        windows_sys::Win32::UI::WindowsAndMessaging::MB_OK
                            | windows_sys::Win32::UI::WindowsAndMessaging::MB_ICONERROR,
                    );
                }
                return;
            }
        };
        app.run(|handle, event| {
            if matches!(event, tauri::RunEvent::Exit) {
                if let Some(state) = handle.try_state::<NativeState>() {
                    if let Ok(mut guard) = state.0.lock() {
                        guard.take();
                    }
                }
            }
        });
    }
}
#[cfg(windows)]
pub use desktop::run;
#[cfg(not(windows))]
pub fn run() {
    eprintln!("ORBIT desktop requer Windows 11. Use npm run dev para a interface web.");
}
