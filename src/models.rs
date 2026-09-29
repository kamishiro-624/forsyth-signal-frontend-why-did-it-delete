use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Event {
    #[serde(default)]
    pub id: String,
    pub title: String,
    pub category: String,
    pub description: String,
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
    pub location: String,
    pub status: String,
    #[serde(default)]
    pub date: String,
    #[serde(default)]
    pub source_name: Option<String>,
    #[serde(default)]
    pub source_url: Option<String>,
    #[serde(default)]
    pub geometry: Option<Value>,
}
