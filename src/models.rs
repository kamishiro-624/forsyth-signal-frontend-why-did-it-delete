use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Event {
    pub id: String,
    pub title: String,
    pub category: String,
    pub description: String,

    pub latitude: f64,
    pub longitude: f64,

    pub location: String,
    pub status: String,
    pub date: String,
}