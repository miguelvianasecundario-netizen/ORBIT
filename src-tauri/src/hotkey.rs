/// Win32 modifier and virtual-key values; kept platform-independent for tests.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Hotkey {
    pub modifiers: u32,
    pub key: u32,
}
pub fn default_hotkey() -> String {
    "Ctrl+Alt+Space".into()
}
pub fn parse(value: &str) -> Result<Hotkey, String> {
    let mut parts: Vec<_> = value.split('+').collect();
    let key = parts.pop().ok_or("Atalho vazio.")?;
    let mut modifiers = 0;
    for part in parts {
        let bit = match part {
            "Ctrl" => 2,
            "Alt" => 1,
            "Shift" => 4,
            _ => return Err("Modificador inválido. Use Ctrl, Alt ou Shift.".into()),
        };
        if modifiers & bit != 0 {
            return Err("Modificador repetido.".into());
        }
        modifiers |= bit;
    }
    let virtual_key = if key == "Space" {
        0x20
    } else if key.len() == 1
        && key
            .bytes()
            .all(|c| c.is_ascii_uppercase() || c.is_ascii_digit())
    {
        key.as_bytes()[0] as u32
    } else if let Some(number) = key.strip_prefix('F').and_then(|s| s.parse::<u32>().ok()) {
        if !(1..=24).contains(&number) || number == 12 || key != format!("F{number}") {
            return Err("Use F1–F24, exceto F12 (reservada pelo Windows).".into());
        }
        0x70 + number - 1
    } else {
        return Err("Tecla inválida. Use letras, números, Espaço ou teclas F.".into());
    };
    if virtual_key < 0x70 && modifiers & 3 == 0 {
        return Err("Combine letras, números ou Espaço com Ctrl ou Alt.".into());
    }
    Ok(Hotkey {
        modifiers,
        key: virtual_key,
    })
}

/// Reserve the replacement before touching the old shortcut. A conflict or a
/// persistence failure must leave the previous shortcut working.
pub trait Registration {
    fn register(&mut self, id: i32, key: Hotkey) -> Result<(), String>;
    fn unregister(&mut self, id: i32);
}
pub fn replace<R: Registration>(
    registrar: &mut R,
    current: &mut (i32, Hotkey),
    next: Hotkey,
    persist: impl FnOnce() -> Result<(), String>,
) -> Result<(), String> {
    if current.1 == next {
        return persist();
    }
    let next_id = if current.0 == 1 { 2 } else { 1 };
    registrar.register(next_id, next)?;
    if let Err(e) = persist() {
        registrar.unregister(next_id);
        return Err(e);
    }
    registrar.unregister(current.0);
    *current = (next_id, next);
    Ok(())
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn accepts_function_keys_and_combinations() {
        assert_eq!(
            parse("Ctrl+Alt+Space").unwrap(),
            Hotkey {
                modifiers: 3,
                key: 32
            }
        );
        assert_eq!(parse("F8").unwrap().key, 0x77);
        assert_eq!(parse("Ctrl+Shift+O").unwrap().modifiers, 6);
        assert!(parse("Alt+9").is_ok());
    }
    #[test]
    fn rejects_unsafe_or_reserved_shortcuts() {
        for key in [
            "",
            "A",
            "Shift+A",
            "Escape",
            "Ctrl+F12",
            "Ctrl+Ctrl+O",
            "Win+O",
            "F25",
            "F01",
            "Ctrl+Space+O",
        ] {
            assert!(parse(key).is_err(), "{key}");
        }
    }
    #[derive(Default)]
    struct Fake {
        ids: Vec<i32>,
        conflict: bool,
    }
    impl Registration for Fake {
        fn register(&mut self, id: i32, _: Hotkey) -> Result<(), String> {
            if self.conflict {
                return Err("conflict".into());
            }
            self.ids.push(id);
            Ok(())
        }
        fn unregister(&mut self, id: i32) {
            self.ids.retain(|n| *n != id);
        }
    }
    #[test]
    fn conflict_and_failed_persistence_keep_old_registration() {
        let old = parse("Ctrl+Alt+Space").unwrap();
        let mut state = (1, old);
        let mut fake = Fake {
            ids: vec![1],
            conflict: true,
        };
        assert!(replace(&mut fake, &mut state, parse("F8").unwrap(), || Ok(())).is_err());
        assert_eq!(fake.ids, vec![1]);
        fake.conflict = false;
        assert!(replace(&mut fake, &mut state, parse("F8").unwrap(), || Err(
            "disk full".into()
        ))
        .is_err());
        assert_eq!(fake.ids, vec![1]);
        assert_eq!(state, (1, old));
    }
    #[test]
    fn successful_change_releases_old_and_same_key_is_noop() {
        let mut state = (1, parse("F8").unwrap());
        let mut fake = Fake {
            ids: vec![1],
            conflict: false,
        };
        replace(&mut fake, &mut state, parse("Ctrl+O").unwrap(), || Ok(())).unwrap();
        assert_eq!(fake.ids, vec![2]);
        fake.conflict = true;
        let same = state.1;
        replace(&mut fake, &mut state, same, || Ok(())).unwrap();
    }
}
