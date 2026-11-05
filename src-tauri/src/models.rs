use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Usage {
    pub count: u64,
    pub last_used: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    pub trigger: String,
    #[serde(default = "crate::hotkey::default_hotkey")]
    pub hotkey: String,
    #[serde(default = "default_theme")]
    pub theme: String,
    #[serde(default = "default_mode")]
    pub mode: String,
    #[serde(default)]
    pub menu_transparency: u8,
    #[serde(default)]
    pub selection_transparency: u8,
    #[serde(default = "default_panel_transparency")]
    pub panel_transparency: u8,
    #[serde(default)]
    pub app_transparency: u8,
    #[serde(default)]
    pub icons_only: bool,
}

fn default_panel_transparency() -> u8 {
    4
}

fn default_theme() -> String {
    "ocean".into()
}
fn default_mode() -> String {
    "main".into()
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            trigger: "alt-middle".into(),
            hotkey: crate::hotkey::default_hotkey(),
            theme: default_theme(),
            mode: default_mode(),
            menu_transparency: 0,
            selection_transparency: 0,
            panel_transparency: default_panel_transparency(),
            app_transparency: 0,
            icons_only: false,
        }
    }
}

impl Settings {
    pub fn validate(&self) -> Result<(), String> {
        if [
            self.menu_transparency,
            self.selection_transparency,
            self.panel_transparency,
            self.app_transparency,
        ]
        .iter()
        .any(|value| *value > 100)
        {
            return Err("A transparência deve estar entre 0% e 100%.".into());
        }
        if !matches!(
            self.theme.as_str(),
            "ocean" | "amethyst" | "graphite" | "paper"
        ) {
            return Err("Tema inválido.".into());
        }
        if !matches!(self.mode.as_str(), "main" | "rest" | "work") {
            return Err("Modo inválido.".into());
        }
        match self.trigger.as_str() {
            "middle" | "alt-middle" | "keyboard" => crate::hotkey::parse(&self.hotkey).map(|_| ()),
            _ => Err("Acionamento inválido.".into()),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(tag = "type", rename_all = "lowercase", deny_unknown_fields)]
pub enum Action {
    Url { value: String },
    Folder { value: String },
    Executable { value: String },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct Shortcut {
    pub id: String,
    pub title: String,
    pub icon: String,
    pub category: String,
    pub action: Action,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StateSnapshot {
    pub usage: HashMap<String, Usage>,
    pub settings: Settings,
    pub shortcuts: Vec<Shortcut>,
}
