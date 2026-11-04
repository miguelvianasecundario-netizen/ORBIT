use crate::{
    models::Action,
    persistence::{validate_action, Database},
};

pub fn execute(id: &str, db: &Database) -> Result<(), String> {
    let url = match id {
        "browser-youtube" => Some("https://www.youtube.com/"),
        "browser-chatgpt" => Some("https://chatgpt.com/"),
        "browser-github" => Some("https://github.com/"),
        "streaming-prime" => Some("https://www.primevideo.com/"),
        "streaming-disney" => Some("https://www.disneyplus.com/pt-br"),
        "streaming-netflix" => Some("https://www.netflix.com/br/"),
        "streaming-hbo" => Some("https://www.hbomax.com/br/pt"),
        "streaming-apple" => Some("https://tv.apple.com/br"),
        "streaming-globo" => Some("https://globoplay.globo.com/"),
        _ => None,
    };
    if let Some(url) = url {
        return launch_target(url);
    }
    match id {
        "browser-brave" => brave(),
        "apps-explorer" => system_program("explorer.exe", false),
        "apps-notepad" => system_program("notepad.exe", true),
        "apps-vscode" => vscode(),
        "actions-settings" => launch_target("ms-settings:"),
        "actions-taskmanager" => system_program("Taskmgr.exe", true),
        "actions-downloads" => downloads(),
        _ => {
            let shortcut = db.find_shortcut(id)?.ok_or("Atalho desconhecido.")?;
            match validate_action(shortcut.action)? {
                Action::Url { value } | Action::Folder { value } => launch_target(&value),
                Action::Executable { value } => {
                    if !matches!(
                        shortcut.category.as_str(),
                        "apps" | "games" | "orbit-main" | "orbit-rest"
                    ) {
                        return Err("Categoria inválida para executável.".into());
                    }
                    executable(&value)
                }
            }
        }
    }
}

#[cfg(windows)]
fn wide(value: &str) -> Vec<u16> {
    value.encode_utf16().chain(Some(0)).collect()
}

#[cfg(windows)]
fn launch_target(value: &str) -> Result<(), String> {
    use windows_sys::Win32::UI::{Shell::ShellExecuteW, WindowsAndMessaging::SW_SHOWNORMAL};
    if value.contains('\0') {
        return Err("Destino inválido.".into());
    }
    let target = wide(value);
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
        Err(format!(
            "O Windows não conseguiu abrir o destino (código {}).",
            result as isize
        ))
    } else {
        Ok(())
    }
}

#[cfg(windows)]
fn system_program(name: &str, system32: bool) -> Result<(), String> {
    use windows_sys::Win32::System::SystemInformation::{
        GetSystemDirectoryW, GetWindowsDirectoryW,
    };
    let mut buffer = vec![0u16; 32768];
    let len = unsafe {
        if system32 {
            GetSystemDirectoryW(buffer.as_mut_ptr(), buffer.len() as u32)
        } else {
            GetWindowsDirectoryW(buffer.as_mut_ptr(), buffer.len() as u32)
        }
    } as usize;
    if len == 0 || len >= buffer.len() {
        return Err("Pasta do Windows indisponível.".into());
    }
    let path = std::path::PathBuf::from(String::from_utf16_lossy(&buffer[..len])).join(name);
    if !path.is_file() {
        return Err(format!("{name} não está instalado."));
    }
    std::process::Command::new(path)
        .spawn()
        .map(|_| ())
        .map_err(|e| format!("Falha ao abrir {name}: {e}"))
}

#[cfg(windows)]
fn known_folder(id: &windows_sys::core::GUID) -> Result<String, String> {
    use windows_sys::Win32::{System::Com::CoTaskMemFree, UI::Shell::SHGetKnownFolderPath};
    let mut path = std::ptr::null_mut();
    let result = unsafe { SHGetKnownFolderPath(id, 0, std::ptr::null_mut(), &mut path) };
    if result < 0 || path.is_null() {
        return Err("Pasta do Windows indisponível.".into());
    }
    let value = unsafe {
        let mut len = 0;
        while *path.add(len) != 0 {
            len += 1;
        }
        let value = String::from_utf16_lossy(std::slice::from_raw_parts(path, len));
        CoTaskMemFree(path.cast());
        value
    };
    Ok(value)
}
#[cfg(windows)]
fn downloads() -> Result<(), String> {
    launch_target(&known_folder(
        &windows_sys::Win32::UI::Shell::FOLDERID_Downloads,
    )?)
}
#[cfg(windows)]
fn vscode() -> Result<(), String> {
    use windows_sys::Win32::UI::Shell::{FOLDERID_LocalAppData, FOLDERID_ProgramFiles};
    for (folder, suffix) in [
        (
            FOLDERID_LocalAppData,
            "Programs\\Microsoft VS Code\\Code.exe",
        ),
        (FOLDERID_ProgramFiles, "Microsoft VS Code\\Code.exe"),
    ] {
        if let Ok(base) = known_folder(&folder) {
            let path = std::path::PathBuf::from(base).join(suffix);
            if path.is_file() {
                return std::process::Command::new(path)
                    .spawn()
                    .map(|_| ())
                    .map_err(|e| e.to_string());
            }
        }
    }
    Err("VS Code não foi encontrado nas pastas padrão de instalação.".into())
}
#[cfg(windows)]
fn brave() -> Result<(), String> {
    use windows_sys::Win32::UI::Shell::{
        FOLDERID_LocalAppData, FOLDERID_ProgramFiles, FOLDERID_ProgramFilesX86,
    };
    // Resolve only the official install locations. Never search PATH or the
    // working directory, and never treat a saved URL as a Brave command line.
    for folder in [
        FOLDERID_ProgramFiles,
        FOLDERID_LocalAppData,
        FOLDERID_ProgramFilesX86,
    ] {
        if let Ok(base) = known_folder(&folder) {
            let path = std::path::PathBuf::from(base)
                .join("BraveSoftware\\Brave-Browser\\Application\\brave.exe");
            if path.is_file() {
                return std::process::Command::new(path)
                    .arg("brave://newtab/")
                    .stdin(std::process::Stdio::null())
                    .stdout(std::process::Stdio::null())
                    .stderr(std::process::Stdio::null())
                    .spawn()
                    .map(|_| ())
                    .map_err(|e| format!("Não foi possível abrir a guia inicial do Brave: {e}"));
            }
        }
    }
    Err("Brave não encontrado nas pastas padrão. Instale o Brave para abrir a guia inicial.".into())
}

#[cfg(windows)]
fn executable(path: &str) -> Result<(), String> {
    // The path was canonicalized and validated immediately before this call.
    // No shell, concatenated command line, or configurable arguments are used.
    let directory = std::path::Path::new(path)
        .parent()
        .ok_or("Não foi possível localizar a pasta deste aplicativo.")?;
    std::process::Command::new(path)
        // Portable apps commonly resolve their assets relative to their cwd.
        .current_dir(directory)
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .spawn()
        .map(|_| ())
        .map_err(|e| format!("Não foi possível abrir este aplicativo: {e}"))
}
#[cfg(not(windows))]
fn launch_target(_: &str) -> Result<(), String> {
    Err("As ações nativas exigem Windows.".into())
}
#[cfg(not(windows))]
fn system_program(_: &str, _: bool) -> Result<(), String> {
    launch_target("")
}
#[cfg(not(windows))]
fn vscode() -> Result<(), String> {
    launch_target("")
}
#[cfg(not(windows))]
fn downloads() -> Result<(), String> {
    launch_target("")
}
#[cfg(not(windows))]
fn brave() -> Result<(), String> {
    launch_target("")
}
#[cfg(not(windows))]
fn executable(_: &str) -> Result<(), String> {
    launch_target("")
}

#[cfg(test)]
mod tests {
    #[test]
    fn unknown_id_never_becomes_a_command() {
        let db = crate::persistence::Database::open(std::path::Path::new(":memory:")).unwrap();
        assert!(super::execute("cmd.exe /c echo nope", &db).is_err());
        assert!(db.snapshot().unwrap().usage.is_empty());
    }
}
