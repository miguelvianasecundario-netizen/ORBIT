use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Usage {
    pub count: u64,
    pub last_used: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct Settings {
    pub trigger: String,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            trigger: "alt-middle".into(),
        }
    }
}

impl Settings {
    pub fn validate(&self) -> Result<(), String> {
        match self.trigger.as_str() {
            "middle" | "alt-middle" | "keyboard" => Ok(()),
            _ => Err("Acionamento inválido.".into()),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(tag = "type", rename_all = "lowercase", deny_unknown_fields)]
pub enum Action {
    Url { value: String },
    Folder { value: String },
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
