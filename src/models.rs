use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Event {
    pub id: String,
    pub title: String,
    pub category: String,
    pub description: String,
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
    pub location: String,
    pub status: String,
    pub date: String,
    pub source_name: Option<String>,
    pub source_url: Option<String>,
    pub geometry: Option<Value>,
}

