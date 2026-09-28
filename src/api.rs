use axum::Json;
use serde_json::Value;

use crate::models::Event;

const ZONING_URL: &str = "https://geo.forsythco.com/gisworkflow/rest/services/Public/Zoning_Applications/FeatureServer/0/query";

pub async fn get_events() -> Json<Vec<Event>> {
    let file = std::fs::read_to_string("data/events.json").expect("Failed to read events.json");

    let events: Vec<Event> = serde_json::from_str(&file).expect("Failed to parse events.json");

    Json(events)
}

pub async fn get_zoning() -> Result<Json<Value>, (axum::http::StatusCode, String)> {
    let client = reqwest::Client::new();

    let response = client.get(ZONING_URL).query(&[("where", "1=1"), ("outFields", "*"), ("returnGeometry", "true"), ("outSR", "4326"), ("f", "geojson"),]).send().await.map_err(|error| {(axum::http::StatusCode::BAD_GATEWAY, format!("Failed to contact Forsyth County GIS: {error}"),)})?;

    if !response.status().is_success() {
        return Err((axum::http::StatusCode::BAD_GATEWAY, format!("Forsyth County GIS returned status {}", response.status()),));
    }

    let data: Value = response.json().await.map_err(|error| {(axum::http::StatusCode::BAD_GATEWAY, format!("Invalid GeoJSON from Forsyth County GIS: {error}"),)})?;

    Ok(Json(data))
}