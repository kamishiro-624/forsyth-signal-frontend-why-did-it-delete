use axum::Json;
use reqwest::Client;
use serde_json::Value;

use crate::models::Event;
use crate::sources::{arcgis,meetings,};

const ZONING_URL: &str = "https://geo.forsythco.com/gisworkflow/rest/services/Public/Zoning_Applications/FeatureServer/0/query";
const INSIGHT_URL: &str = "https://geo.forsythco.com/gis3/rest/services/Public/Insight2Forsyth/FeatureServer";
const SCHOOLS_URL: &str = "https://services2.arcgis.com/StQaZGYzUARPnrpL/ArcGIS/rest/services/Public_School/FeatureServer/0/query";
const PARKS_URL: &str = "https://services2.arcgis.com/StQaZGYzUARPnrpL/ArcGIS/rest/services/Park_Facility/FeatureServer/0/query";
const ZONING_DISTRICTS_URL: &str = "https://geo.forsythco.com/gisworkflow/rest/services/Public/Zoning_Districts/FeatureServer/0/query";

pub async fn get_events() -> Result<Json<Vec<Event>>, (axum::http::StatusCode, String)> {
    let client = Client::new();
    let mut events = load_local_events()?;

    add_source(&mut events, arcgis::load_events(&client, ZONING_URL, "development", "ZANUMBER", &["COMMENTS", "PROCESS"], &["ZASTATUS"], &[], &["LOCATION", "ADDRESS"], "Forsyth County GIS", "Zoning Application",).await,)?;
    add_source(&mut events, arcgis::load_events(&client, &format!("{INSIGHT_URL}/0/query"), "development", "ProjectName", &["PlanType", "PlanWorkClass"], &["PlanStatus", "SubmittalStatus"], &["CompletionDate", "ApplicationDate", "LastChangedDate"], &["Address", "LOCATION", "ProjectName"], "Forsyth County Planning & Community Development", "Planning Hearing",).await,)?;
    add_source(&mut events, arcgis::load_events(&client, &format!("{INSIGHT_URL}/1/query"), "development", "ProjectName", &["PlanType", "PlanWorkClass"], &["PlanStatus", "SubmittalStatus"], &["ApplicationDate", "LastChangedDate", "CompletionDate"], &["Address", "LOCATION", "ProjectName"], "Forsyth County Planning & Community Development", "New Permit",).await,)?;
    add_source(&mut events, arcgis::load_events(&client, &format!("{INSIGHT_URL}/2/query"), "development", "ProjectName", &["PlanType", "PlanWorkClass", "COMMENTS"], &["PlanStatus", "SubmittalStatus"], &["ApplicationDate", "LastChangedDate", "CompletionDate"], &["Address", "LOCATION", "ProjectName"], "Forsyth County Planning & Community Development", "Zoning Application",).await,)?;
    add_source(&mut events, arcgis::load_events(&client, &format!("{INSIGHT_URL}/3/query"), "public-notice", "ProjectName", &["PlanType", "PlanWorkClass"], &["PlanStatus", "SubmittalStatus"], &["ApplicationDate", "LastChangedDate"], &["Address", "LOCATION", "ProjectName"], "Forsyth County Planning & Community Development", "Public Participation Sign",).await,)?;
    add_source(&mut events, arcgis::load_events(&client, &format!("{INSIGHT_URL}/4/query"), "public-notice", "ProjectName", &["PlanType", "PlanWorkClass"], &["PlanStatus", "SubmittalStatus"], &["ApplicationDate", "LastChangedDate"], &["Address", "LOCATION", "ProjectName"], "Forsyth County Planning & Community Development", "Hearing Sign",).await,)?;

    events.extend(meetings::load_meetings());

    add_source(&mut events, arcgis::load_events(&client, SCHOOLS_URL, "schools", "SCH_NAME", &["TYPE", "GRDRANGE"], &["STATE"], &["YEAR_OPEN"], &["ADDRESS", "CITY", "ZIP"], "Forsyth County Schools GIS", "School",).await,)?;

    Ok(Json(events))
}

pub async fn get_layers() -> Result<Json<Value>, (axum::http::StatusCode, String)> {
    let client = Client::new();

    let schools = arcgis::load_geojson(&client, SCHOOLS_URL, "Forsyth County Schools GIS",).await.map_err(bad_gateway)?;
    let parks = arcgis::load_geojson(&client, PARKS_URL, "Forsyth County Parks & Recreation GIS",).await.map_err(bad_gateway)?;

    let zoning = arcgis::load_geojson(&client, ZONING_DISTRICTS_URL, "Forsyth County GIS",).await.map_err(bad_gateway)?;

    Ok(Json(serde_json::json!({"schools": schools, "parks": parks, "zoning": zoning})))
}

fn load_local_events() -> Result<Vec<Event>, (axum::http::StatusCode, String)> {
    let file = std::fs::read_to_string("data/events.json").map_err(|error| (axum::http::StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to read data/events.json: {error}"),))?;

    serde_json::from_str(&file).map_err(|error| (axum::http::StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to parse data/events.json: {error}"),))
}

fn add_source(events: &mut Vec<Event>, result: Result<Vec<Event>, String>,) -> Result<(), (axum::http::StatusCode, String)> {
    match result {
        Ok(mut source_events) => {
            events.append(&mut source_events);
            Ok(())
        }

        Err(error) => Err(bad_gateway(error)),
    }
}

fn bad_gateway(error: String) -> (axum::http::StatusCode, String) {
    (
        axum::http::StatusCode::BAD_GATEWAY,
        error,
    )
}
