use crate::browser_bridge::{read_packet, write_packet};
use crate::browser_identity::{EXTENSION_ORIGIN, HOST_NAME};
use serde_json::json;
use std::{
    io,
    net::{Shutdown, TcpStream},
    path::{Path, PathBuf},
    time::Duration,
};

pub fn native_invocation() -> bool {
    std::env::args()
        .skip(1)
        .any(|a| a.starts_with("chrome-extension://"))
}
pub fn run() -> Result<(), String> {
    if !std::env::args().skip(1).any(|a| a == EXTENSION_ORIGIN) {
        return Err("Extensão desconhecida.".into());
    }
    let folder = std::env::var_os("LOCALAPPDATA").ok_or("Pasta local indisponível.")?;
    let path = PathBuf::from(folder).join("app.orbit.launcher/browser-connection.json");
    let mut connection = None;
    for _ in 0..20 {
        if let Ok(raw) = std::fs::read(&path) {
            if let Ok(config) = serde_json::from_slice::<serde_json::Value>(&raw) {
                if let (Some(address), Some(token)) =
                    (config["address"].as_str(), config["token"].as_str())
                {
                    if let Ok(address) = address.parse::<std::net::SocketAddr>() {
                        if address.ip().is_loopback() {
                            if let Ok(mut stream) =
                                TcpStream::connect_timeout(&address, Duration::from_secs(1))
                            {
                                stream
                                    .set_read_timeout(Some(Duration::from_secs(3)))
                                    .map_err(|e| e.to_string())?;
                                let hello =
                                    json!({"token":token,"origin":EXTENSION_ORIGIN}).to_string();
                                write_packet(&mut stream, hello.as_bytes())?;
                                let ready = read_packet(&mut stream)?;
                                write_packet(&mut io::stdout().lock(), &ready)?;
                                if serde_json::from_slice::<serde_json::Value>(&ready)
                                    .map_err(|e| e.to_string())?["type"]
                                    != "ready"
                                {
                                    return Ok(());
                                }
                                stream.set_read_timeout(None).map_err(|e| e.to_string())?;
                                connection = Some(stream);
                                break;
                            }
                        }
                    }
                }
            }
        }
        std::thread::sleep(Duration::from_millis(500));
    }
    let mut incoming = connection.ok_or("Abra o Orbit para conectar a extensão.")?;
    let mut outgoing = incoming.try_clone().map_err(|e| e.to_string())?;
    std::thread::spawn(move || {
        let mut input = io::stdin().lock();
        while let Ok(packet) = read_packet(&mut input) {
            if write_packet(&mut outgoing, &packet).is_err() {
                break;
            }
        }
        let _ = outgoing.shutdown(Shutdown::Both);
    });
    let mut output = io::stdout().lock();
    while let Ok(packet) = read_packet(&mut incoming) {
        write_packet(&mut output, &packet)?;
    }
    Ok(())
}

pub fn prepare(directory: &Path) -> Result<PathBuf, String> {
    let extension = directory.join("browser-extension");
    std::fs::create_dir_all(&extension).map_err(|e| e.to_string())?;
    for (name, data) in [
        (
            "manifest.json",
            include_str!("../../browser-extension/manifest.json"),
        ),
        (
            "background.js",
            include_str!("../../browser-extension/background.js"),
        ),
        ("tabs.js", include_str!("../../browser-extension/tabs.js")),
        (
            "popup.html",
            include_str!("../../browser-extension/popup.html"),
        ),
        ("popup.js", include_str!("../../browser-extension/popup.js")),
    ] {
        std::fs::write(extension.join(name), data).map_err(|e| e.to_string())?;
    }
    let executable = std::env::current_exe().map_err(|e| e.to_string())?;
    let manifest = directory.join("browser-host.json");
    std::fs::write(&manifest,json!({"name":HOST_NAME,"description":"Orbit Work — conexão local com o Brave","path":executable,"type":"stdio","allowed_origins":[EXTENSION_ORIGIN]}).to_string()).map_err(|e|e.to_string())?;
    register(&manifest)?;
    Ok(extension)
}
#[cfg(windows)]
fn register(manifest: &Path) -> Result<(), String> {
    use windows_sys::Win32::Foundation::ERROR_SUCCESS;
    use windows_sys::Win32::System::Registry::*;
    let key: Vec<u16> =
        format!("Software\\BraveSoftware\\Brave-Browser\\NativeMessagingHosts\\{HOST_NAME}")
            .encode_utf16()
            .chain(Some(0))
            .collect();
    let value: Vec<u16> = manifest
        .to_string_lossy()
        .encode_utf16()
        .chain(Some(0))
        .collect();
    let mut handle = std::ptr::null_mut();
    let status = unsafe {
        RegCreateKeyExW(
            HKEY_CURRENT_USER,
            key.as_ptr(),
            0,
            std::ptr::null(),
            REG_OPTION_NON_VOLATILE,
            KEY_SET_VALUE,
            std::ptr::null(),
            &mut handle,
            std::ptr::null_mut(),
        )
    };
    if status != ERROR_SUCCESS {
        return Err(format!(
            "Não foi possível registrar a integração do Brave ({status})."
        ));
    }
    let status = unsafe {
        RegSetValueExW(
            handle,
            std::ptr::null(),
            0,
            REG_SZ,
            value.as_ptr().cast(),
            (value.len() * 2) as u32,
        )
    };
    unsafe {
        RegCloseKey(handle);
    }
    if status != ERROR_SUCCESS {
        return Err(format!(
            "Não foi possível salvar a integração do Brave ({status})."
        ));
    }
    Ok(())
}
#[cfg(not(windows))]
fn register(_: &Path) -> Result<(), String> {
    Err("A integração nativa requer Windows.".into())
}
