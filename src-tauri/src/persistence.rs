use crate::models::{Action, Settings, Shortcut, StateSnapshot, Usage};
use rusqlite::{params, Connection, OptionalExtension};
use std::{
    collections::HashMap,
    path::Path,
    sync::{Mutex, MutexGuard},
    time::{Duration, SystemTime, UNIX_EPOCH},
};
use uuid::Uuid;

pub struct Database {
    connection: Mutex<Connection>,
}

fn db_error(error: impl std::fmt::Display) -> String {
    format!("Não foi possível acessar os dados locais: {error}")
}

/// Validate and normalize the two user-configurable action types. This validation
/// must run again before launching: a previously saved directory may disappear.
pub fn validate_action(action: Action) -> Result<Action, String> {
    match action {
        Action::Url { value } => {
            let url = url::Url::parse(value.trim())
                .map_err(|_| "Informe uma URL HTTPS válida.".to_string())?;
            if url.scheme() != "https"
                || url.host_str().is_none()
                || !url.username().is_empty()
                || url.password().is_some()
            {
                return Err("Use uma URL HTTPS sem usuário ou senha.".into());
            }
            Ok(Action::Url { value: url.into() })
        }
        Action::Folder { value } => {
            if value.is_empty() || value.contains('\0') {
                return Err("Selecione uma pasta existente.".into());
            }
            let requested = Path::new(&value);
            if !requested.is_absolute() {
                return Err("A pasta precisa ter um caminho absoluto.".into());
            }
            let canonical = requested
                .canonicalize()
                .map_err(|_| "A pasta não existe ou não está acessível.".to_string())?;
            if !canonical.is_dir() {
                return Err("O caminho selecionado não é uma pasta.".into());
            }
            let value = canonical
                .to_str()
                .ok_or_else(|| {
                    "O caminho da pasta não pode ser representado em UTF-8.".to_string()
                })?
                .to_string();
            Ok(Action::Folder { value })
        }
    }
}

impl Database {
    pub fn open(path: &Path) -> Result<Self, String> {
        let connection = Connection::open(path).map_err(db_error)?;
        connection
            .busy_timeout(Duration::from_secs(3))
            .map_err(db_error)?;
        connection
            .execute_batch(
                "PRAGMA journal_mode=WAL;
             CREATE TABLE IF NOT EXISTS preferences (
               key TEXT PRIMARY KEY, value TEXT NOT NULL
             );
             CREATE TABLE IF NOT EXISTS usage (
               item_id TEXT PRIMARY KEY,
               use_count INTEGER NOT NULL CHECK(use_count >= 0),
               last_used INTEGER NOT NULL
             );
             CREATE TABLE IF NOT EXISTS usage_events (
               id INTEGER PRIMARY KEY,
               item_id TEXT NOT NULL,
               used_at INTEGER NOT NULL
             );
             CREATE INDEX IF NOT EXISTS usage_events_item ON usage_events(item_id);
             CREATE TABLE IF NOT EXISTS shortcuts (
               id TEXT PRIMARY KEY,
               title TEXT NOT NULL,
               icon TEXT NOT NULL,
               category TEXT NOT NULL,
               action TEXT NOT NULL
             );",
            )
            .map_err(db_error)?;
        Ok(Self {
            connection: Mutex::new(connection),
        })
    }

    fn lock(&self) -> Result<MutexGuard<'_, Connection>, String> {
        self.connection
            .lock()
            .map_err(|_| "O banco de dados local está indisponível.".into())
    }

    pub fn snapshot(&self) -> Result<StateSnapshot, String> {
        let connection = self.lock()?;
        let mut usage = HashMap::new();
        let mut statement = connection
            .prepare("SELECT item_id, use_count, last_used FROM usage")
            .map_err(db_error)?;
        let rows = statement
            .query_map([], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    Usage {
                        count: row.get(1)?,
                        last_used: row.get(2)?,
                    },
                ))
            })
            .map_err(db_error)?;
        for row in rows {
            let (id, entry) = row.map_err(db_error)?;
            usage.insert(id, entry);
        }
        let raw_settings: Option<String> = connection
            .query_row(
                "SELECT value FROM preferences WHERE key = 'settings'",
                [],
                |row| row.get(0),
            )
            .optional()
            .map_err(db_error)?;
        let settings: Settings = match raw_settings {
            Some(raw) => serde_json::from_str(&raw).map_err(db_error)?,
            None => Settings::default(),
        };
        settings.validate()?;
        let mut statement = connection
            .prepare("SELECT id,title,icon,category,action FROM shortcuts ORDER BY rowid")
            .map_err(db_error)?;
        let rows = statement
            .query_map([], shortcut_from_row)
            .map_err(db_error)?;
        let shortcuts = rows.collect::<Result<Vec<_>, _>>().map_err(db_error)?;
        Ok(StateSnapshot {
            usage,
            settings,
            shortcuts,
        })
    }

    /// Call only after an explicitly selected action was successfully launched.
    pub fn record_use(&self, id: &str) -> Result<(), String> {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map_err(|_| "O relógio do sistema está incorreto.".to_string())?
            .as_millis()
            .min(i64::MAX as u128) as i64;
        let mut connection = self.lock()?;
        let transaction = connection.transaction().map_err(db_error)?;
        transaction
            .execute(
                "INSERT INTO usage(item_id,use_count,last_used) VALUES(?1,1,?2)
             ON CONFLICT(item_id) DO UPDATE SET use_count=use_count+1,last_used=excluded.last_used",
                params![id, now],
            )
            .map_err(db_error)?;
        transaction
            .execute(
                "INSERT INTO usage_events(item_id,used_at) VALUES(?1,?2)",
                params![id, now],
            )
            .map_err(db_error)?;
        // Keep detailed timestamps bounded while retaining lifetime frequency totals.
        transaction.execute(
            "DELETE FROM usage_events WHERE id NOT IN (SELECT id FROM usage_events ORDER BY id DESC LIMIT 10000)", []
        ).map_err(db_error)?;
        transaction.commit().map_err(db_error)
    }

    pub fn clear_history(&self) -> Result<(), String> {
        let mut connection = self.lock()?;
        let transaction = connection.transaction().map_err(db_error)?;
        transaction
            .execute("DELETE FROM usage", [])
            .map_err(db_error)?;
        transaction
            .execute("DELETE FROM usage_events", [])
            .map_err(db_error)?;
        transaction.commit().map_err(db_error)
    }

    pub fn save_settings(&self, settings: Settings) -> Result<(), String> {
        settings.validate()?;
        let raw = serde_json::to_string(&settings).map_err(db_error)?;
        self.lock()?
            .execute(
                "INSERT INTO preferences(key,value) VALUES('settings',?1)
             ON CONFLICT(key) DO UPDATE SET value=excluded.value",
                [raw],
            )
            .map_err(db_error)?;
        Ok(())
    }

    pub fn add_shortcut(
        &self,
        title: String,
        category: String,
        action: Action,
    ) -> Result<Shortcut, String> {
        let title = title.trim().to_string();
        if title.is_empty() || title.chars().count() > 80 || title.chars().any(char::is_control) {
            return Err(
                "O nome deve ter entre 1 e 80 caracteres, sem caracteres de controle.".into(),
            );
        }
        if !matches!(
            category.as_str(),
            "browser" | "apps" | "projects" | "actions"
        ) {
            return Err("Categoria inválida.".into());
        }
        let action = validate_action(action)?;
        let icon = match &action {
            Action::Url { .. } => "globe",
            Action::Folder { .. } => "folder",
        }
        .to_string();
        let shortcut = Shortcut {
            id: format!("custom-{}", Uuid::new_v4()),
            title,
            icon,
            category,
            action,
        };
        let raw_action = serde_json::to_string(&shortcut.action).map_err(db_error)?;
        self.lock()?
            .execute(
                "INSERT INTO shortcuts(id,title,icon,category,action) VALUES(?1,?2,?3,?4,?5)",
                params![
                    shortcut.id,
                    shortcut.title,
                    shortcut.icon,
                    shortcut.category,
                    raw_action
                ],
            )
            .map_err(db_error)?;
        Ok(shortcut)
    }

    pub fn remove_shortcut(&self, id: &str) -> Result<(), String> {
        let mut connection = self.lock()?;
        let transaction = connection.transaction().map_err(db_error)?;
        if transaction
            .execute("DELETE FROM shortcuts WHERE id=?1", [id])
            .map_err(db_error)?
            == 0
        {
            return Err("Atalho não encontrado.".into());
        }
        transaction
            .execute("DELETE FROM usage WHERE item_id=?1", [id])
            .map_err(db_error)?;
        transaction
            .execute("DELETE FROM usage_events WHERE item_id=?1", [id])
            .map_err(db_error)?;
        transaction.commit().map_err(db_error)
    }

    pub fn find_shortcut(&self, id: &str) -> Result<Option<Shortcut>, String> {
        self.lock()?
            .query_row(
                "SELECT id,title,icon,category,action FROM shortcuts WHERE id=?1",
                [id],
                shortcut_from_row,
            )
            .optional()
            .map_err(db_error)
    }
}

fn shortcut_from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<Shortcut> {
    let raw: String = row.get(4)?;
    let action = serde_json::from_str(&raw).map_err(|err| {
        rusqlite::Error::FromSqlConversionFailure(4, rusqlite::types::Type::Text, Box::new(err))
    })?;
    Ok(Shortcut {
        id: row.get(0)?,
        title: row.get(1)?,
        icon: row.get(2)?,
        category: row.get(3)?,
        action,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn memory_db() -> Database {
        Database::open(Path::new(":memory:")).unwrap()
    }

    #[test]
    fn usage_counts_and_history_reset_preserve_preferences_and_shortcuts() {
        let db = memory_db();
        db.save_settings(Settings {
            trigger: "keyboard".into(),
            ..Settings::default()
        })
        .unwrap();
        let shortcut = db
            .add_shortcut(
                "Docs".into(),
                "browser".into(),
                Action::Url {
                    value: "https://docs.rs".into(),
                },
            )
            .unwrap();
        db.record_use(&shortcut.id).unwrap();
        db.record_use(&shortcut.id).unwrap();
        let before = db.snapshot().unwrap();
        assert_eq!(before.usage[&shortcut.id].count, 2);
        assert!(before.usage[&shortcut.id].last_used > 0);
        db.clear_history().unwrap();
        let after = db.snapshot().unwrap();
        assert!(after.usage.is_empty());
        assert_eq!(after.settings.trigger, "keyboard");
        assert_eq!(after.shortcuts.len(), 1);
        let events: i64 = db
            .lock()
            .unwrap()
            .query_row("SELECT COUNT(*) FROM usage_events", [], |row| row.get(0))
            .unwrap();
        assert_eq!(events, 0);
    }

    #[test]
    fn refuses_unsafe_urls_and_invalid_configuration() {
        for value in [
            "javascript:alert(1)",
            "file:///C:/Windows",
            "http://example.com",
            "https://user:secret@example.com",
            "https://",
        ] {
            assert!(
                validate_action(Action::Url {
                    value: value.into()
                })
                .is_err(),
                "{value}"
            );
        }
        let db = memory_db();
        assert!(db
            .save_settings(Settings {
                trigger: "unknown".into(),
                ..Settings::default()
            })
            .is_err());
        assert!(db
            .add_shortcut(
                "".into(),
                "browser".into(),
                Action::Url {
                    value: "https://example.com".into()
                }
            )
            .is_err());
        assert!(db
            .add_shortcut(
                "Name".into(),
                "missing".into(),
                Action::Url {
                    value: "https://example.com".into()
                }
            )
            .is_err());
        assert_eq!(db.snapshot().unwrap().settings, Settings::default());
    }

    #[test]
    fn removing_shortcuts_also_removes_usage_and_handles_sql_in_titles() {
        let db = memory_db();
        let item = db
            .add_shortcut(
                "'); DROP TABLE shortcuts; --".into(),
                "browser".into(),
                Action::Url {
                    value: "https://example.com".into(),
                },
            )
            .unwrap();
        assert_eq!(db.find_shortcut(&item.id).unwrap(), Some(item.clone()));
        db.record_use(&item.id).unwrap();
        db.remove_shortcut(&item.id).unwrap();
        assert!(db.snapshot().unwrap().shortcuts.is_empty());
        assert!(db.snapshot().unwrap().usage.is_empty());
        assert!(db.find_shortcut(&item.id).unwrap().is_none());
        assert!(db.remove_shortcut("browser-youtube").is_err());
    }

    #[test]
    fn folders_must_be_existing_absolute_directories() {
        assert!(validate_action(Action::Folder { value: ".".into() }).is_err());
        let directory = std::env::temp_dir().join(format!("orbit-persistence-{}", Uuid::new_v4()));
        std::fs::create_dir(&directory).unwrap();
        let file = directory.join("file.txt");
        std::fs::write(&file, "test").unwrap();
        assert!(validate_action(Action::Folder {
            value: directory.to_string_lossy().into()
        })
        .is_ok());
        assert!(validate_action(Action::Folder {
            value: file.to_string_lossy().into()
        })
        .is_err());
        std::fs::remove_dir_all(directory).unwrap();
    }

    #[test]
    fn old_preferences_keep_working_and_gain_default_hotkey() {
        let db = memory_db();
        db.lock()
            .unwrap()
            .execute(
                "INSERT INTO preferences(key,value) VALUES('settings',?1)",
                [r#"{"trigger":"middle"}"#],
            )
            .unwrap();
        let state = db.snapshot().unwrap();
        assert_eq!(state.settings.trigger, "middle");
        assert_eq!(state.settings.hotkey, "Ctrl+Alt+Space");
    }

    #[test]
    fn reopening_database_retains_settings_and_counts() {
        let directory = std::env::temp_dir().join(format!("orbit-reopen-{}", Uuid::new_v4()));
        std::fs::create_dir(&directory).unwrap();
        let path = directory.join("orbit.db");
        {
            let db = Database::open(&path).unwrap();
            db.save_settings(Settings {
                trigger: "middle".into(),
                hotkey: "F8".into(),
            })
            .unwrap();
            db.record_use("browser-youtube").unwrap();
        }
        {
            let db = Database::open(&path).unwrap();
            let snapshot = db.snapshot().unwrap();
            assert_eq!(snapshot.settings.trigger, "middle");
            assert_eq!(snapshot.settings.hotkey, "F8");
            assert_eq!(snapshot.usage["browser-youtube"].count, 1);
        }
        std::fs::remove_dir_all(directory).unwrap();
    }
}
