use axum::Json;
use serde_json::Value;

use crate::models::Event;

const ZONING_URL: &str = "https://geo.forsythco.com/gisworkflow/rest/services/Public/Zoning_Applications/FeatureServer/0/query";

pub async fn get_events() -> Result<Json<Vec<Event>>, (axum::http::StatusCode, String)> {
    let mut events = load_local_events()?;
    let zoning_events = load_zoning_events().await?;
    events.extend(zoning_events);
    Ok(Json(events))
}

fn load_local_events() -> Result<Vec<Event>, (axum::http::StatusCode, String)> {
    let file = std::fs::read_to_string("data/events.json").map_err(|error| {(axum::http::StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to read events.json: {error}"),)})?;

    serde_json::from_str(&file).map_err(|error| {(axum::http::StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to parse events.json: {error}"),)})
}

async fn load_zoning_events() -> Result<Vec<Event>, (axum::http::StatusCode, String)> {
    let client = reqwest::Client::new();

    let response = client.get(ZONING_URL).query(&[("where", "1=1"), ("outFields", "*"), ("returnGeometry", "true"), ("outSR", "4326"), ("f", "geojson"),]).send().await.map_err(|error| {(axum::http::StatusCode::BAD_GATEWAY, format!("Failed to contact Forsyth County GIS: {error}"),)})?;

    if !response.status().is_success() {
        return Err((axum::http::StatusCode::BAD_GATEWAY, format!("Forsyth County GIS returned status {}", response.status()),));
    }

    let data: Value = response.json().await.map_err(|error| {(axum::http::StatusCode::BAD_GATEWAY, format!("Invalid GeoJSON from Forsyth County GIS: {error}"),)})?;

    let features = data.get("features").and_then(Value::as_array).ok_or_else(|| {(axum::http::StatusCode::BAD_GATEWAY, "Forsyth County GIS returned no features".to_string(),)})?;

    let mut events = Vec::new();

    for (index, feature) in features.iter().enumerate() {
        let properties = feature.get("properties").and_then(Value::as_object);

        let geometry = feature.get("geometry").cloned();

        let properties = match properties {
            Some(properties) => properties,
            None => continue,
        };

        let number = properties.get("ZANUMBER").and_then(Value::as_str).unwrap_or("Unknown Application");
        let status = properties.get("ZASTATUS").and_then(Value::as_str).unwrap_or("Unknown");
        let process = properties.get("PROCESS").and_then(Value::as_str).unwrap_or("");
        let comments = properties.get("COMMENTS").and_then(Value::as_str).unwrap_or("");
        let link = properties.get("LINK").and_then(Value::as_str).map(String::from);

        let description = if !comments.is_empty() {
            comments.to_string()
        } else if !process.is_empty() {
            process.to_string()
        } else {
            "Forsyth County zoning application.".to_string()
        };

        events.push(Event {
            id: format!("zoning-{index}"),
            title: format!("Zoning Application {number}"),
            category: "development".to_string(),
            description,
            latitude: None,
            longitude: None,
            location: "Forsyth County, Georgia".to_string(),
            status: status.to_string(),
            date: String::new(),
            source_name: Some("Forsyth County GIS".to_string()),
            source_url: link,
            geometry,
        });
    }

    Ok(events)
}
