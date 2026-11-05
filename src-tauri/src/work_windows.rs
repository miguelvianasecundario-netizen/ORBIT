use crate::{models::Action, work::Outcome};
use std::{
    collections::HashSet,
    path::{Path, PathBuf},
    time::{Duration, Instant},
};
use windows_sys::Win32::{
    Foundation::*,
    System::{Com::*, Diagnostics::ToolHelp::*, Threading::*},
    UI::{Shell::*, WindowsAndMessaging::*},
};
fn wide(value: &str) -> Vec<u16> {
    value.encode_utf16().chain(Some(0)).collect()
}
fn normalize(path: &str) -> String {
    crate::windows_paths::shell_path(path).to_lowercase()
}
struct ComApartment(bool);
impl ComApartment {
    fn new() -> Self {
        Self(unsafe { CoInitializeEx(std::ptr::null(), COINIT_APARTMENTTHREADED as u32) } >= 0)
    }
}
impl Drop for ComApartment {
    fn drop(&mut self) {
        if self.0 {
            unsafe {
                CoUninitialize();
            }
        }
    }
}
fn process_path(pid: u32) -> Option<String> {
    unsafe {
        let process = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid);
        if process.is_null() {
            return None;
        }
        let mut buffer = vec![0u16; 32768];
        let mut len = buffer.len() as u32;
        let ok = QueryFullProcessImageNameW(process, 0, buffer.as_mut_ptr(), &mut len);
        CloseHandle(process);
        (ok != 0).then(|| normalize(&String::from_utf16_lossy(&buffer[..len as usize])))
    }
}
fn running(path: &str) -> bool {
    unsafe {
        let snapshot = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
        if snapshot == INVALID_HANDLE_VALUE {
            return false;
        }
        let mut entry: PROCESSENTRY32W = std::mem::zeroed();
        entry.dwSize = std::mem::size_of::<PROCESSENTRY32W>() as u32;
        let mut ok = Process32FirstW(snapshot, &mut entry);
        let mut found = false;
        while ok != 0 {
            if process_path(entry.th32ProcessID).as_deref() == Some(path) {
                found = true;
                break;
            }
            ok = Process32NextW(snapshot, &mut entry);
        }
        CloseHandle(snapshot);
        found
    }
}
unsafe extern "system" fn collect(hwnd: HWND, data: LPARAM) -> BOOL {
    if IsWindowVisible(hwnd) != 0 {
        (*(data as *mut Vec<HWND>)).push(hwnd);
    }
    1
}
fn visible_windows() -> Vec<HWND> {
    let mut windows = Vec::new();
    unsafe {
        EnumWindows(Some(collect), &mut windows as *mut _ as LPARAM);
    }
    windows
}
fn open_minimized(path: &str, folder: bool) -> Result<(), String> {
    let _com = ComApartment::new();
    let path = crate::windows_paths::shell_path(path);
    let target = wide(&path);
    let verb = wide("open");
    let directory = Path::new(path.as_ref())
        .parent()
        .map(|p| wide(&p.to_string_lossy()));
    let mut info: SHELLEXECUTEINFOW = unsafe { std::mem::zeroed() };
    info.cbSize = std::mem::size_of::<SHELLEXECUTEINFOW>() as u32;
    info.fMask = SEE_MASK_NOCLOSEPROCESS | SEE_MASK_FLAG_NO_UI | SEE_MASK_NOASYNC;
    info.lpVerb = verb.as_ptr();
    info.lpFile = target.as_ptr();
    info.lpDirectory = if folder {
        std::ptr::null()
    } else {
        directory.as_ref().map_or(std::ptr::null(), |d| d.as_ptr())
    };
    info.nShow = SW_SHOWMINNOACTIVE;
    if unsafe { ShellExecuteExW(&mut info) } == 0 {
        return Err(format!(
            "O Windows não conseguiu abrir este destino ({}).",
            unsafe { GetLastError() }
        ));
    }
    if !info.hProcess.is_null() {
        unsafe {
            CloseHandle(info.hProcess);
        }
    }
    Ok(())
}
pub struct ForegroundGuard(bool);
impl ForegroundGuard {
    pub fn new() -> Self {
        let mut pid = 0;
        unsafe {
            GetWindowThreadProcessId(GetForegroundWindow(), &mut pid);
        }
        Self(
            pid == unsafe { GetCurrentProcessId() }
                && unsafe { LockSetForegroundWindow(LSFW_LOCK) } != 0,
        )
    }
}
impl Drop for ForegroundGuard {
    fn drop(&mut self) {
        if self.0 {
            unsafe {
                LockSetForegroundWindow(LSFW_UNLOCK);
            }
        }
    }
}
pub struct LaunchTracker {
    previous: HashSet<isize>,
    paths: HashSet<String>,
}
impl LaunchTracker {
    pub fn new() -> Self {
        Self {
            previous: visible_windows().into_iter().map(|h| h as isize).collect(),
            paths: HashSet::new(),
        }
    }
    pub fn launch(&mut self, action: &Action) -> Result<Outcome, String> {
        match action {
            Action::Executable { value } => {
                let path = normalize(value);
                if running(&path) {
                    return Ok(Outcome::AlreadyOpen);
                }
                open_minimized(value, false)?;
                self.paths.insert(path);
                Ok(Outcome::Opened)
            }
            Action::Folder { value } => {
                open_minimized(value, true)?;
                Ok(Outcome::Opened)
            }
            Action::Url { .. } => Err("Sites do Work precisam da extensão do Brave.".into()),
        }
    }
    pub fn finish(&self) {
        if self.paths.is_empty() {
            return;
        }
        let end = Instant::now() + Duration::from_secs(4);
        let mut minimized = HashSet::new();
        while Instant::now() < end {
            for hwnd in visible_windows() {
                let key = hwnd as isize;
                if self.previous.contains(&key) || minimized.contains(&key) {
                    continue;
                }
                let mut pid = 0;
                unsafe {
                    GetWindowThreadProcessId(hwnd, &mut pid);
                }
                if let Some(path) = process_path(pid) {
                    // Only touch windows that appeared during this launch and belong
                    // to the requested executable. Existing windows remain untouched.
                    if self.paths.contains(&path) {
                        unsafe {
                            ShowWindowAsync(hwnd, SW_SHOWMINNOACTIVE);
                        }
                        minimized.insert(key);
                    }
                }
            }
            std::thread::sleep(Duration::from_millis(100));
        }
    }
}
pub fn start_brave() -> Result<(), String> {
    for base in ["LOCALAPPDATA", "ProgramFiles", "ProgramFiles(x86)"] {
        if let Some(root) = std::env::var_os(base) {
            let file =
                PathBuf::from(root).join(r"BraveSoftware\Brave-Browser\Application\brave.exe");
            if file.is_file() {
                let path = file.to_string_lossy();
                if !running(&normalize(&path)) {
                    open_minimized(&path, false)?;
                }
                return Ok(());
            }
        }
    }
    Err("Brave não encontrado nas pastas padrão.".into())
}
pub fn open_extension_folder(path: &Path) -> Result<(), String> {
    let _com = ComApartment::new();
    let target = wide(&path.to_string_lossy());
    let verb = wide("open");
    let result = unsafe {
        ShellExecuteW(
            std::ptr::null_mut(),
            verb.as_ptr(),
            target.as_ptr(),
            std::ptr::null(),
            std::ptr::null(),
            SW_SHOWNORMAL,
        )
    };
    if result as isize <= 32 {
        return Err("Não foi possível mostrar a pasta da extensão.".into());
    }
    Ok(())
}
