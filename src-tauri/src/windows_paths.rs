use std::borrow::Cow;

/// Win32 shell APIs do not consistently accept Rust's canonical verbatim prefix.
/// Preserve UNC shares and leave URLs and ordinary paths unchanged.
pub fn shell_path(value: &str) -> Cow<'_, str> {
    if let Some(rest) = value.strip_prefix(r"\\?\UNC\") {
        Cow::Owned(format!(r"\\{rest}"))
    } else if let Some(rest) = value.strip_prefix(r"\\?\") {
        Cow::Borrowed(rest)
    } else {
        Cow::Borrowed(value)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn shell_paths_preserve_shares_unicode_and_urls() {
        assert_eq!(
            shell_path(r"\\?\C:\Meus projetos\Aplicação.exe"),
            r"C:\Meus projetos\Aplicação.exe"
        );
        assert_eq!(
            shell_path(r"\\?\UNC\server\share\app.exe"),
            r"\\server\share\app.exe"
        );
        assert_eq!(shell_path(r"\\server\share\pasta"), r"\\server\share\pasta");
        assert_eq!(shell_path("https://example.com/"), "https://example.com/");
        assert_eq!(shell_path("ms-settings:"), "ms-settings:");
    }
}
