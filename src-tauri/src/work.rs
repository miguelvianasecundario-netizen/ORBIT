use crate::{
    browser_bridge::{BrowserBridge, BrowserEntry},
    models::{Action, Shortcut},
    persistence::{validate_action, Database},
};
use serde::Serialize;
use std::collections::HashMap;
#[derive(Clone, Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum Outcome {
    Opened,
    AlreadyOpen,
    Error,
}
#[derive(Clone, Debug, Serialize)]
pub struct WorkResult {
    pub id: String,
    pub title: String,
    pub status: Outcome,
    pub detail: Option<String>,
}
#[derive(Debug, Serialize)]
pub struct WorkReport {
    pub results: Vec<WorkResult>,
}
pub fn is_work_category(category: &str) -> bool {
    matches!(
        category,
        "work-apps" | "work-browser" | "work-projects" | "orbit-work"
    )
}
fn result(item: &Shortcut, status: Outcome, detail: Option<String>) -> WorkResult {
    WorkResult {
        id: item.id.clone(),
        title: item.title.clone(),
        status,
        detail,
    }
}

pub fn launch_all(db: &Database, bridge: &BrowserBridge) -> Result<WorkReport, String> {
    launch(db, bridge, None)
}
pub fn launch_one(db: &Database, bridge: &BrowserBridge, id: &str) -> Result<WorkReport, String> {
    launch(db, bridge, Some(id))
}
fn launch(db: &Database, bridge: &BrowserBridge, id: Option<&str>) -> Result<WorkReport, String> {
    let items: Vec<_> = db
        .snapshot()?
        .shortcuts
        .into_iter()
        .filter(|s| is_work_category(&s.category) && id.is_none_or(|id| s.id == id))
        .collect();
    if id.is_some() && items.is_empty() {
        return Err("Atalho não pertence ao Work.".into());
    }
    let mut results = HashMap::new();
    let mut urls = Vec::new();
    let mut local = Vec::new();
    for item in &items {
        match validate_action(item.action.clone()) {
            Ok(Action::Url { value }) => urls.push(BrowserEntry {
                id: item.id.clone(),
                url: value,
            }),
            Ok(action) => local.push((item, action)),
            Err(error) => {
                results.insert(item.id.clone(), result(item, Outcome::Error, Some(error)));
            }
        }
    }
    #[cfg(windows)]
    let _foreground = crate::work_windows::ForegroundGuard::new();
    if !urls.is_empty() {
        #[cfg(windows)]
        if !bridge.connected() && bridge.prepared() && crate::work_windows::start_brave().is_ok() {
            for _ in 0..80 {
                if bridge.connected() {
                    break;
                }
                std::thread::sleep(std::time::Duration::from_millis(100));
            }
        }
        match bridge.open_urls(urls) {
            Ok(replies) => {
                for reply in replies {
                    if let Some(item) = items.iter().find(|item| item.id == reply.id) {
                        let status = match reply.status.as_str() {
                            "opened" => Outcome::Opened,
                            "alreadyOpen" => Outcome::AlreadyOpen,
                            _ => Outcome::Error,
                        };
                        results.insert(item.id.clone(), result(item, status, reply.detail));
                    }
                }
            }
            Err(error) => {
                for item in &items {
                    if matches!(item.action, Action::Url { .. }) && !results.contains_key(&item.id)
                    {
                        results.insert(
                            item.id.clone(),
                            result(item, Outcome::Error, Some(error.clone())),
                        );
                    }
                }
            }
        }
    }
    let mut seen: HashMap<String, Result<Outcome, String>> = HashMap::new();
    #[cfg(windows)]
    let mut windows = crate::work_windows::LaunchTracker::new();
    for (item, action) in local {
        let key = match &action {
            Action::Folder { value } | Action::Executable { value } => value.to_lowercase(),
            Action::Url { .. } => unreachable!(),
        };
        let outcome = if let Some(previous) = seen.get(&key) {
            previous.clone().map(|_| Outcome::AlreadyOpen)
        } else {
            #[cfg(windows)]
            let value = windows.launch(&action);
            #[cfg(not(windows))]
            let value: Result<Outcome, String> =
                Err("Abrir aplicativos minimizados requer Windows.".into());
            seen.insert(key, value.clone());
            value
        };
        let entry = match outcome {
            Ok(status) => result(item, status, None),
            Err(error) => result(item, Outcome::Error, Some(error)),
        };
        results.insert(item.id.clone(), entry);
    }
    #[cfg(windows)]
    windows.finish();
    let ordered = items
        .iter()
        .filter_map(|item| results.remove(&item.id))
        .collect::<Vec<_>>();
    for item in &ordered {
        if item.status == Outcome::Opened {
            let _ = db.record_use(&item.id);
        }
    }
    Ok(WorkReport { results: ordered })
}
#[cfg(test)]
mod tests {
    use super::*;
    use crate::browser_bridge::test_support::{reply, Fixture};
    use crate::models::Settings;
    #[test]
    fn batch_is_scoped_records_only_new_launches_and_handles_missing_files() {
        let fixture = Fixture::new();
        let path = fixture.bridge.directory().join("work.sqlite3");
        let add = |db: &Database, title: &str, category: &str| {
            db.add_shortcut(
                title.into(),
                category.into(),
                Action::Url {
                    value: format!("https://example.com/{title}"),
                },
            )
            .unwrap()
        };
        let (first, second, personal, deleted);
        {
            let db = Database::open(&path).unwrap();
            db.save_settings(Settings {
                mode: "work".into(),
                ..Settings::default()
            })
            .unwrap();
            first = add(&db, "A", "work-browser");
            second = add(&db, "B", "orbit-work");
            personal = add(&db, "Pessoal", "orbit-main");
            add(&db, "Descanso", "orbit-rest");
            let executable = fixture.bridge.directory().join("removed.exe");
            std::fs::write(&executable, b"fixture").unwrap();
            deleted = db
                .add_shortcut(
                    "C".into(),
                    "work-apps".into(),
                    Action::Executable {
                        value: executable.to_string_lossy().to_string(),
                    },
                )
                .unwrap();
            std::fs::remove_file(executable).unwrap();
        }
        let db = Database::open(&path).unwrap();
        assert_eq!(db.snapshot().unwrap().settings.mode, "work");
        let mut peer = fixture.peer();
        let worker = std::thread::spawn(move || {
            let batch = reply(&mut peer, &["opened", "alreadyOpen"], false);
            let single = reply(&mut peer, &["alreadyOpen"], false);
            (batch, single)
        });
        let report = launch_all(&db, &fixture.bridge).unwrap();
        assert_eq!(report.results.len(), 3);
        assert_eq!(
            report
                .results
                .iter()
                .find(|r| r.id == first.id)
                .unwrap()
                .status,
            Outcome::Opened
        );
        assert_eq!(
            report
                .results
                .iter()
                .find(|r| r.id == second.id)
                .unwrap()
                .status,
            Outcome::AlreadyOpen
        );
        assert_eq!(
            report
                .results
                .iter()
                .find(|r| r.id == deleted.id)
                .unwrap()
                .status,
            Outcome::Error
        );
        let report = launch_one(&db, &fixture.bridge, &second.id).unwrap();
        assert_eq!(report.results.len(), 1);
        assert!(launch_one(&db, &fixture.bridge, &personal.id).is_err());
        let (batch, single) = worker.join().unwrap();
        assert_eq!(batch, vec![first.id.clone(), second.id.clone()]);
        assert_eq!(single, vec![second.id]);
        let usage = db.snapshot().unwrap().usage;
        assert_eq!(usage.len(), 1);
        assert_eq!(usage[&first.id].count, 1);
    }
    #[test]
    fn work_membership_never_includes_other_modes() {
        for value in ["work-apps", "work-browser", "work-projects", "orbit-work"] {
            assert!(is_work_category(value));
        }
        for value in [
            "apps",
            "browser",
            "orbit-main",
            "orbit-rest",
            "games",
            "work-all",
            "work-unknown",
        ] {
            assert!(!is_work_category(value));
        }
    }
}
