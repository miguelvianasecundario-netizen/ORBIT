use crate::{
    hotkey::{self, Hotkey, Registration},
    models::Settings,
    persistence::Database,
};
use std::sync::{
    atomic::{AtomicBool, AtomicU8, Ordering},
    mpsc, Arc,
};
use std::thread::JoinHandle;
use tauri::AppHandle;
use tauri::Manager;
use windows_sys::Win32::{
    Foundation::{LPARAM, LRESULT, WPARAM},
    System::{LibraryLoader::GetModuleHandleW, Threading::GetCurrentThreadId},
    UI::{
        Input::KeyboardAndMouse::{
            GetAsyncKeyState, RegisterHotKey, UnregisterHotKey, MOD_NOREPEAT, VK_MENU,
        },
        WindowsAndMessaging::*,
    },
};
thread_local! { static CONTEXT: std::cell::RefCell<Option<Context>> = const { std::cell::RefCell::new(None) }; }
struct Context {
    app: AppHandle,
    trigger: Arc<AtomicU8>,
    swallowed: bool,
    pending: Arc<AtomicBool>,
}
const CONFIGURE: u32 = WM_APP + 1;
struct Update {
    settings: Settings,
    reply: mpsc::SyncSender<Result<(), String>>,
}
struct WindowsRegistrar;
impl Registration for WindowsRegistrar {
    fn register(&mut self, id: i32, key: Hotkey) -> Result<(), String> {
        if unsafe {
            RegisterHotKey(
                std::ptr::null_mut(),
                id,
                key.modifiers | MOD_NOREPEAT,
                key.key,
            )
        } == 0
        {
            Err("Esse atalho está em uso ou é reservado pelo Windows. Escolha outro; o anterior continua ativo.".into())
        } else {
            Ok(())
        }
    }
    fn unregister(&mut self, id: i32) {
        unsafe {
            UnregisterHotKey(std::ptr::null_mut(), id);
        }
    }
}
pub struct Listener {
    thread: Option<JoinHandle<()>>,
    thread_id: u32,
    updates: mpsc::Sender<Update>,
}
fn trigger_number(value: &str) -> u8 {
    match value {
        "middle" => 1,
        "alt-middle" => 2,
        _ => 0,
    }
}
unsafe extern "system" fn hook(code: i32, wparam: WPARAM, lparam: LPARAM) -> LRESULT {
    if code == HC_ACTION as i32 {
        let consume = CONTEXT.with(|ctx| {
            let mut ctx = ctx.borrow_mut();
            let Some(ctx) = ctx.as_mut() else {
                return false;
            };
            if wparam as u32 == WM_MBUTTONUP && ctx.swallowed {
                ctx.swallowed = false;
                return true;
            }
            if wparam as u32 != WM_MBUTTONDOWN {
                return false;
            }
            let data = &*(lparam as *const MSLLHOOKSTRUCT);
            if data.flags & LLMHF_INJECTED != 0 {
                return false;
            }
            let mode = ctx.trigger.load(Ordering::Relaxed);
            let eligible = mode == 1 || (mode == 2 && GetAsyncKeyState(VK_MENU as i32) < 0);
            if eligible {
                ctx.swallowed = true;
                if !ctx.pending.swap(true, Ordering::AcqRel) {
                    let app = ctx.app.clone();
                    let pending = ctx.pending.clone();
                    let handle = app.clone();
                    if app
                        .run_on_main_thread(move || {
                            if let Err(e) = crate::window::activate(&handle) {
                                eprintln!("ORBIT: {e}");
                            }
                            pending.store(false, Ordering::Release);
                        })
                        .is_err()
                    {
                        ctx.pending.store(false, Ordering::Release);
                    }
                }
            }
            eligible
        });
        if consume {
            return 1;
        }
    }
    CallNextHookEx(std::ptr::null_mut(), code, wparam, lparam)
}
impl Listener {
    pub fn start(app: AppHandle, settings: &Settings) -> Result<Self, String> {
        settings.validate()?;
        let initial_hotkey = hotkey::parse(&settings.hotkey)?;
        let trigger = Arc::new(AtomicU8::new(trigger_number(&settings.trigger)));
        let (updates, requests) = mpsc::channel::<Update>();
        let mode = trigger.clone();
        let (tx, rx) = mpsc::sync_channel(1);
        let thread = std::thread::spawn(move || unsafe {
            let mut msg: MSG = std::mem::zeroed();
            PeekMessageW(&mut msg, std::ptr::null_mut(), 0, 0, PM_NOREMOVE);
            CONTEXT.with(|c| {
                *c.borrow_mut() = Some(Context {
                    app: app.clone(),
                    trigger: mode.clone(),
                    swallowed: false,
                    pending: Arc::new(AtomicBool::new(false)),
                })
            });
            let mouse = SetWindowsHookExW(
                WH_MOUSE_LL,
                Some(hook),
                GetModuleHandleW(std::ptr::null()),
                0,
            );
            if mouse.is_null() {
                let _ = tx.send(Err("O Windows recusou a captura global do mouse.".into()));
                return;
            }
            let mut registrar = WindowsRegistrar;
            if let Err(error) = registrar.register(1, initial_hotkey) {
                UnhookWindowsHookEx(mouse);
                let _ = tx.send(Err(error));
                return;
            }
            let mut current = (1, initial_hotkey);
            let _ = tx.send(Ok(GetCurrentThreadId()));
            while GetMessageW(&mut msg, std::ptr::null_mut(), 0, 0) > 0 {
                if msg.message == CONFIGURE {
                    while let Ok(update) = requests.try_recv() {
                        let result = hotkey::parse(&update.settings.hotkey).and_then(|next| {
                            hotkey::replace(&mut registrar, &mut current, next, || {
                                app.state::<Database>()
                                    .save_settings(update.settings.clone())
                            })
                        });
                        if result.is_ok() {
                            mode.store(trigger_number(&update.settings.trigger), Ordering::Relaxed);
                        }
                        let _ = update.reply.send(result);
                    }
                }
                if msg.message == WM_HOTKEY && msg.wParam == current.0 as usize {
                    let handle = app.clone();
                    let _ = app.run_on_main_thread(move || {
                        if let Err(e) = crate::window::activate(&handle) {
                            eprintln!("ORBIT: {e}");
                        }
                    });
                }
                TranslateMessage(&msg);
                DispatchMessageW(&msg);
            }
            registrar.unregister(current.0);
            UnhookWindowsHookEx(mouse);
            CONTEXT.with(|c| *c.borrow_mut() = None);
        });
        match rx.recv().map_err(|e| e.to_string())? {
            Ok(thread_id) => Ok(Self {
                thread: Some(thread),
                thread_id,
                updates,
            }),
            Err(e) => {
                let _ = thread.join();
                Err(e)
            }
        }
    }
    pub fn configure(&self, settings: Settings) -> Result<(), String> {
        settings.validate()?;
        let (reply, rx) = mpsc::sync_channel(1);
        self.updates
            .send(Update { settings, reply })
            .map_err(|_| "O listener foi encerrado.")?;
        if unsafe { PostThreadMessageW(self.thread_id, CONFIGURE, 0, 0) } == 0 {
            return Err("Não foi possível atualizar o atalho.".into());
        }
        rx.recv()
            .map_err(|_| "O listener foi encerrado.".to_string())?
    }
    pub fn stop(&mut self) {
        if let Some(thread) = self.thread.take() {
            unsafe {
                PostThreadMessageW(self.thread_id, WM_QUIT, 0, 0);
            };
            let _ = thread.join();
        }
    }
}
impl Drop for Listener {
    fn drop(&mut self) {
        self.stop();
    }
}
