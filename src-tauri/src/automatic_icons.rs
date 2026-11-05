use url::Url;
/// Discover only HTTPS image links. HTML is parsed as data and is never executed.
pub fn icon_candidates(page: &str, html: &str) -> Vec<String> {
    let Ok(base) = Url::parse(page) else {
        return Vec::new();
    };
    if base.scheme() != "https" || !base.username().is_empty() || base.password().is_some() {
        return Vec::new();
    }
    let links = regex::Regex::new(r"(?is)<link\b[^>]{0,4096}>").unwrap();
    let attrs =
        regex::Regex::new(r#"(?is)([a-z][a-z0-9_-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))"#)
            .unwrap();
    let mut candidates = Vec::new();
    for link in links.find_iter(html) {
        let mut rel = String::new();
        let mut href = String::new();
        for attr in attrs.captures_iter(link.as_str()) {
            let value = (2..=4)
                .find_map(|n| attr.get(n))
                .map(|v| v.as_str())
                .unwrap_or("");
            match attr[1].to_ascii_lowercase().as_str() {
                "rel" => rel = value.to_ascii_lowercase(),
                "href" => href = value.replace("&amp;", "&"),
                _ => {}
            }
        }
        if !rel
            .split_whitespace()
            .any(|r| ["icon", "apple-touch-icon"].contains(&r))
        {
            continue;
        }
        if let Ok(url) = base.join(&href) {
            if url.scheme() == "https"
                && url.username().is_empty()
                && url.password().is_none()
                && url.as_str().len() <= 8192
                && !candidates.contains(&url.to_string())
            {
                candidates.push(url.to_string());
            }
        }
        if candidates.len() >= 3 {
            break;
        }
    }
    if let Ok(default) = base.join("/favicon.ico") {
        if !candidates.contains(&default.to_string()) {
            candidates.push(default.to_string());
        }
    }
    candidates
}
#[cfg(windows)]
mod platform {
    use super::*;
    use base64::Engine;
    use std::{
        hash::{Hash, Hasher},
        path::{Path, PathBuf},
        time::Duration,
    };
    use windows_sys::Win32::{
        Graphics::Gdi::*,
        Networking::WinHttp::*,
        System::Com::*,
        UI::{Shell::*, WindowsAndMessaging::*},
    };
    const MAX_IMAGE: usize = 128 * 1024;
    fn wide(v: &str) -> Vec<u16> {
        v.encode_utf16().chain(Some(0)).collect()
    }
    struct Internet(*mut std::ffi::c_void);
    impl Drop for Internet {
        fn drop(&mut self) {
            unsafe {
                WinHttpCloseHandle(self.0);
            }
        }
    }
    fn header(request: &Internet, key: u32) -> String {
        let mut data = vec![0u16; 2048];
        let mut len = (data.len() * 2) as u32;
        if unsafe {
            WinHttpQueryHeaders(
                request.0,
                key,
                std::ptr::null(),
                data.as_mut_ptr().cast(),
                &mut len,
                std::ptr::null_mut(),
            )
        } == 0
        {
            return String::new();
        }
        String::from_utf16_lossy(&data[..len as usize / 2])
            .trim_end_matches('\0')
            .to_string()
    }
    fn fetch(input: &str, limit: usize) -> Result<(Vec<u8>, String, String), String> {
        let mut address = input.to_string();
        for _ in 0..4 {
            let url = Url::parse(&address).map_err(|e| e.to_string())?;
            if url.scheme() != "https" || !url.username().is_empty() || url.password().is_some() {
                return Err("Destino de ícone inválido.".into());
            }
            let host = wide(url.host_str().ok_or("Site inválido.")?);
            let agent = wide("Orbit/0.1.7 (site icon)");
            let session = Internet(unsafe {
                WinHttpOpen(
                    agent.as_ptr(),
                    WINHTTP_ACCESS_TYPE_AUTOMATIC_PROXY,
                    std::ptr::null(),
                    std::ptr::null(),
                    0,
                )
            });
            if session.0.is_null() {
                return Err("Rede indisponível.".into());
            }
            unsafe {
                WinHttpSetTimeouts(session.0, 2500, 2500, 2500, 2500);
            }
            let connection = Internet(unsafe {
                WinHttpConnect(
                    session.0,
                    host.as_ptr(),
                    url.port_or_known_default().unwrap_or(443),
                    0,
                )
            });
            if connection.0.is_null() {
                return Err("Site indisponível.".into());
            }
            let mut resource = url.path().to_string();
            if let Some(q) = url.query() {
                resource.push('?');
                resource.push_str(q);
            }
            let resource = wide(&resource);
            let verb = wide("GET");
            let request = Internet(unsafe {
                WinHttpOpenRequest(
                    connection.0,
                    verb.as_ptr(),
                    resource.as_ptr(),
                    std::ptr::null(),
                    std::ptr::null(),
                    std::ptr::null(),
                    WINHTTP_FLAG_SECURE,
                )
            });
            if request.0.is_null() {
                return Err("Requisição indisponível.".into());
            }
            let redirects = WINHTTP_OPTION_REDIRECT_POLICY_NEVER;
            let disabled = WINHTTP_DISABLE_COOKIES | WINHTTP_DISABLE_AUTHENTICATION;
            unsafe {
                WinHttpSetOption(
                    request.0,
                    WINHTTP_OPTION_REDIRECT_POLICY,
                    (&redirects as *const u32).cast(),
                    4,
                );
                WinHttpSetOption(
                    request.0,
                    WINHTTP_OPTION_DISABLE_FEATURE,
                    (&disabled as *const u32).cast(),
                    4,
                );
            }
            if unsafe {
                WinHttpSendRequest(request.0, std::ptr::null(), 0, std::ptr::null(), 0, 0, 0)
            } == 0
                || unsafe { WinHttpReceiveResponse(request.0, std::ptr::null_mut()) } == 0
            {
                return Err("O site não respondeu.".into());
            }
            let status = header(&request, WINHTTP_QUERY_STATUS_CODE);
            if ["301", "302", "303", "307", "308"].contains(&status.as_str()) {
                address = url
                    .join(&header(&request, WINHTTP_QUERY_LOCATION))
                    .map_err(|e| e.to_string())?
                    .to_string();
                continue;
            }
            if status != "200" {
                return Err("Ícone indisponível.".into());
            }
            let mime = header(&request, WINHTTP_QUERY_CONTENT_TYPE)
                .split(';')
                .next()
                .unwrap_or("")
                .trim()
                .to_ascii_lowercase();
            let mut bytes = Vec::new();
            let mut chunk = [0u8; 8192];
            loop {
                let mut read = 0;
                if unsafe {
                    WinHttpReadData(
                        request.0,
                        chunk.as_mut_ptr().cast(),
                        chunk.len() as u32,
                        &mut read,
                    )
                } == 0
                {
                    return Err("Falha no download do ícone.".into());
                }
                if read == 0 {
                    break;
                }
                if bytes.len() + read as usize > limit {
                    return Err("Ícone muito grande.".into());
                }
                bytes.extend_from_slice(&chunk[..read as usize]);
            }
            return Ok((bytes, mime, address));
        }
        Err("Redirecionamento de ícone excedido.".into())
    }
    fn site_icon(value: &str) -> Option<String> {
        let url = Url::parse(value).ok()?;
        let root = url.join("/").ok()?;
        let candidates = match fetch(root.as_str(), 256 * 1024) {
            Ok((html, _, final_url)) => {
                icon_candidates(&final_url, &String::from_utf8_lossy(&html))
            }
            Err(_) => icon_candidates(root.as_str(), ""),
        };
        for candidate in candidates {
            if let Ok((data, mime, _)) = fetch(&candidate, MAX_IMAGE) {
                let kind = if data.starts_with(b"\x89PNG\r\n\x1a\n") {
                    Some("image/png")
                } else if data.starts_with(b"\0\0\x01\0") {
                    Some("image/x-icon")
                } else if data.starts_with(b"\xff\xd8\xff") {
                    Some("image/jpeg")
                } else if data.starts_with(b"GIF8") {
                    Some("image/gif")
                } else if data.starts_with(b"RIFF") && data.get(8..12) == Some(b"WEBP") {
                    Some("image/webp")
                } else if mime == "image/svg+xml" && String::from_utf8_lossy(&data).contains("<svg")
                {
                    Some("image/svg+xml")
                } else {
                    None
                };
                if let Some(kind) = kind {
                    return Some(format!(
                        "data:{kind};base64,{}",
                        base64::engine::general_purpose::STANDARD.encode(data)
                    ));
                }
            }
        }
        None
    }
    unsafe fn render_icon(icon: HICON, background: u8) -> Option<Vec<u8>> {
        let dc = CreateCompatibleDC(std::ptr::null_mut());
        if dc.is_null() {
            return None;
        }
        let mut info: BITMAPINFO = std::mem::zeroed();
        info.bmiHeader.biSize = std::mem::size_of::<BITMAPINFOHEADER>() as u32;
        info.bmiHeader.biWidth = 64;
        info.bmiHeader.biHeight = -64;
        info.bmiHeader.biPlanes = 1;
        info.bmiHeader.biBitCount = 32;
        info.bmiHeader.biCompression = BI_RGB;
        let mut bits = std::ptr::null_mut();
        let bitmap = CreateDIBSection(
            dc,
            &info,
            DIB_RGB_COLORS,
            &mut bits,
            std::ptr::null_mut(),
            0,
        );
        if bitmap.is_null() || bits.is_null() {
            if !bitmap.is_null() {
                DeleteObject(bitmap);
            }
            DeleteDC(dc);
            return None;
        }
        let old = SelectObject(dc, bitmap);
        let pixels = std::slice::from_raw_parts_mut(bits as *mut u8, 64 * 64 * 4);
        pixels.fill(background);
        let ok = DrawIconEx(dc, 0, 0, icon, 64, 64, 0, std::ptr::null_mut(), DI_NORMAL);
        GdiFlush();
        let result = if ok != 0 { Some(pixels.to_vec()) } else { None };
        SelectObject(dc, old);
        DeleteObject(bitmap);
        DeleteDC(dc);
        result
    }
    fn file_icon(value: &str) -> Option<String> {
        let initialized =
            unsafe { CoInitializeEx(std::ptr::null(), COINIT_APARTMENTTHREADED as u32) } >= 0;
        let mut info: SHFILEINFOW = unsafe { std::mem::zeroed() };
        let path = wide(&crate::windows_paths::shell_path(value));
        let ok = unsafe {
            SHGetFileInfoW(
                path.as_ptr(),
                0,
                &mut info,
                std::mem::size_of::<SHFILEINFOW>() as u32,
                SHGFI_ICON | SHGFI_LARGEICON,
            )
        };
        let pair = if ok != 0 && !info.hIcon.is_null() {
            unsafe {
                let pair = render_icon(info.hIcon, 0).zip(render_icon(info.hIcon, 255));
                DestroyIcon(info.hIcon);
                pair
            }
        } else {
            None
        };
        if initialized {
            unsafe {
                CoUninitialize();
            }
        }
        let (black, white) = pair?;
        let mut rgba = Vec::with_capacity(black.len());
        for (b, w) in black.chunks_exact(4).zip(white.chunks_exact(4)) {
            let alpha = 255
                - (0..3)
                    .map(|i| w[i].saturating_sub(b[i]))
                    .max()
                    .unwrap_or(255);
            for index in [2, 1, 0] {
                rgba.push(if alpha == 0 {
                    0
                } else {
                    ((b[index] as u32 * 255) / alpha as u32).min(255) as u8
                });
            }
            rgba.push(alpha);
        }
        let mut bytes = Vec::new();
        {
            let mut encoder = png::Encoder::new(&mut bytes, 64, 64);
            encoder.set_color(png::ColorType::Rgba);
            encoder.set_depth(png::BitDepth::Eight);
            encoder.write_header().ok()?.write_image_data(&rgba).ok()?;
        }
        Some(format!(
            "data:image/png;base64,{}",
            base64::engine::general_purpose::STANDARD.encode(bytes)
        ))
    }
    fn builtin_path(id: &str) -> Option<PathBuf> {
        use windows_sys::Win32::System::SystemInformation::{
            GetSystemDirectoryW, GetWindowsDirectoryW,
        };
        match id {
            "apps-notepad" | "apps-explorer" => {
                let mut buffer = vec![0u16; 32768];
                let len = unsafe {
                    if id == "apps-notepad" {
                        GetSystemDirectoryW(buffer.as_mut_ptr(), buffer.len() as u32)
                    } else {
                        GetWindowsDirectoryW(buffer.as_mut_ptr(), buffer.len() as u32)
                    }
                } as usize;
                if len == 0 || len >= buffer.len() {
                    return None;
                }
                Some(
                    PathBuf::from(String::from_utf16_lossy(&buffer[..len])).join(
                        if id == "apps-notepad" {
                            "notepad.exe"
                        } else {
                            "explorer.exe"
                        },
                    ),
                )
            }
            "apps-vscode" | "browser-brave" => {
                for name in ["LOCALAPPDATA", "ProgramFiles", "ProgramFiles(x86)"] {
                    if let Some(root) = std::env::var_os(name) {
                        let file = PathBuf::from(root).join(if id == "browser-brave" {
                            r"BraveSoftware\Brave-Browser\Application\brave.exe"
                        } else if name == "LOCALAPPDATA" {
                            r"Programs\Microsoft VS Code\Code.exe"
                        } else {
                            r"Microsoft VS Code\Code.exe"
                        });
                        if file.is_file() {
                            return Some(file);
                        }
                    }
                }
                None
            }
            _ => None,
        }
    }
    pub fn resolve(
        id: &str,
        db: &crate::persistence::Database,
        directory: &Path,
    ) -> Option<String> {
        use crate::models::Action;
        let target = if let Some(url) = crate::actions::builtin_url(id) {
            Action::Url { value: url.into() }
        } else if let Some(path) = builtin_path(id) {
            Action::Executable {
                value: path.to_string_lossy().into(),
            }
        } else {
            db.find_shortcut(id).ok()??.action
        };
        let target = crate::persistence::validate_action(target).ok()?;
        let (key, local) = match &target {
            Action::Url { value } => (
                Url::parse(value).ok()?.origin().ascii_serialization(),
                false,
            ),
            Action::Executable { value } | Action::Folder { value } => (value.clone(), true),
        };
        let mut hash = std::collections::hash_map::DefaultHasher::new();
        key.hash(&mut hash);
        if local {
            if let Ok(meta) = std::fs::metadata(&key) {
                meta.modified().ok().hash(&mut hash);
            }
        }
        let cache = directory.join("icon-cache");
        let path = cache.join(format!("{:016x}.txt", hash.finish()));
        if let Ok(meta) = std::fs::metadata(&path) {
            if meta.modified().ok()?.elapsed().ok()? < Duration::from_secs(86400) {
                if let Ok(data) = std::fs::read_to_string(&path) {
                    if data.starts_with("data:image/") && data.len() < MAX_IMAGE * 2 {
                        return Some(data);
                    }
                }
            }
        }
        let data = if local {
            file_icon(&key)
        } else {
            site_icon(&key)
        }?;
        let _ = std::fs::create_dir_all(&cache);
        let _ = std::fs::write(path, &data);
        Some(data)
    }
}
#[cfg(windows)]
pub use platform::resolve;
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn recognizes_icon_attributes_and_resolves_relative_links() {
        let result = icon_candidates(
            "https://example.com/app/",
            r#"<link HREF='../brand.png?v=1&amp;size=32' rel='shortcut icon'><link rel=apple-touch-icon href=/touch.png>"#,
        );
        assert_eq!(
            result,
            vec![
                "https://example.com/brand.png?v=1&size=32",
                "https://example.com/touch.png",
                "https://example.com/favicon.ico"
            ]
        );
    }
    #[test]
    fn does_not_accept_script_cleartext_or_credential_icon_targets() {
        assert_eq!(
            icon_candidates(
                "https://example.com",
                r#"<link rel=icon href='javascript:alert(1)'><link rel=icon href='http://example.com/a.png'><link rel=icon href='https://user:pass@example.com/a.png'>"#
            ),
            vec!["https://example.com/favicon.ico"]
        );
        assert!(icon_candidates("file:///etc/passwd", "").is_empty());
    }
}
