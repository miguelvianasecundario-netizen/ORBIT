use std::sync::{
    atomic::{AtomicBool, AtomicU8, Ordering},
    mpsc, Arc,
};
use std::thread::JoinHandle;
use tauri::AppHandle;
use windows_sys::Win32::{
    Foundation::{LPARAM, LRESULT, WPARAM},
    System::{LibraryLoader::GetModuleHandleW, Threading::GetCurrentThreadId},
    UI::{
        Input::KeyboardAndMouse::{
            GetAsyncKeyState, RegisterHotKey, UnregisterHotKey, MOD_ALT, MOD_CONTROL, MOD_NOREPEAT,
            VK_MENU, VK_SPACE,
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
pub struct Listener {
    thread: Option<JoinHandle<()>>,
    thread_id: u32,
    trigger: Arc<AtomicU8>,
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
    pub fn start(app: AppHandle, trigger: &str) -> Result<Self, String> {
        let trigger = Arc::new(AtomicU8::new(trigger_number(trigger)));
        let mode = trigger.clone();
        let (tx, rx) = mpsc::sync_channel(1);
        let thread = std::thread::spawn(move || unsafe {
            let mut msg: MSG = std::mem::zeroed();
            PeekMessageW(&mut msg, std::ptr::null_mut(), 0, 0, PM_NOREMOVE);
            CONTEXT.with(|c| {
                *c.borrow_mut() = Some(Context {
                    app: app.clone(),
                    trigger: mode,
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
            if RegisterHotKey(
                std::ptr::null_mut(),
                1,
                MOD_CONTROL | MOD_ALT | MOD_NOREPEAT,
                VK_SPACE as u32,
            ) == 0
            {
                UnhookWindowsHookEx(mouse);
                let _=tx.send(Err("Ctrl+Alt+Espaço está em uso por outro aplicativo. Feche-o e inicie o Orbit novamente.".into()));
                return;
            }
            let _ = tx.send(Ok(GetCurrentThreadId()));
            while GetMessageW(&mut msg, std::ptr::null_mut(), 0, 0) > 0 {
                if msg.message == WM_HOTKEY && msg.wParam == 1 {
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
            UnregisterHotKey(std::ptr::null_mut(), 1);
            UnhookWindowsHookEx(mouse);
            CONTEXT.with(|c| *c.borrow_mut() = None);
        });
        match rx.recv().map_err(|e| e.to_string())? {
            Ok(thread_id) => Ok(Self {
                thread: Some(thread),
                thread_id,
                trigger,
            }),
            Err(e) => {
                let _ = thread.join();
                Err(e)
            }
        }
    }
    pub fn set_trigger(&self, value: &str) {
        self.trigger.store(trigger_number(value), Ordering::Relaxed);
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
