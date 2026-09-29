use crate::models::Event;

const BOE_SOURCE: &str = "https://www.forsyth.k12.ga.us/inside-fcs/board-of-education/meeting-schedule";
const COUNTY_SOURCE: &str = "https://www.forsythco.com/Meetings";
const PLANNING_SOURCE: &str = "https://www.forsythco.com/Portals/0/Documents/CommunityDevelopment/Zoning/Public%20Hearing/Public%20Hearings%20and%20Meetings/2026%20Schedule%20Calendars.pdf";

const BOARD_ADDRESS: &str = "1120 Dahlonega Highway, Cumming, GA 30040";
const BOARD_LAT: f64 = 34.2079;
const BOARD_LON: f64 = -84.1428;

const COUNTY_ADDRESS: &str = "110 East Main Street, Suite 220, Cumming, GA 30040";
const COUNTY_LAT: f64 = 34.2073;
const COUNTY_LON: f64 = -84.1402;

pub fn load_meetings() -> Vec<Event> {
    let mut events = Vec::new();
    let boe_regular = [
        "2026-01-20", "2026-02-17", "2026-03-17", "2026-04-21",
        "2026-05-12", "2026-06-16", "2026-07-21", "2026-08-18",
        "2026-09-15", "2026-10-20", "2026-11-17", "2026-12-08",
    ];

    let boe_work = [
        "2026-02-10", "2026-03-10", "2026-04-14", "2026-05-05",
        "2026-08-11", "2026-09-08", "2026-10-13", "2026-11-10",
    ];

    for date in boe_regular {
        events.push(meeting(
            &format!("boe-regular-{date}"),
            "Forsyth County Board of Education Meeting",
            "schools",
            date,
            "Regular Board of Education meeting. Public portion begins at 6 PM.",
            BOARD_ADDRESS,
            BOARD_LAT,
            BOARD_LON,
            BOE_SOURCE,
        ));
    }

    for date in boe_work {
        events.push(meeting(
            &format!("boe-work-{date}"),
            "Forsyth County Board of Education Work Session",
            "schools",
            date,
            "Board of Education work session.",
            BOARD_ADDRESS,
            BOARD_LAT,
            BOARD_LON,
            BOE_SOURCE,
        ));
    }

    let boc_regular = [
        "2026-01-08", "2026-02-05", "2026-03-05", "2026-04-02",
        "2026-04-16", "2026-05-07", "2026-06-04", "2026-07-09",
        "2026-08-06", "2026-09-03", "2026-10-01", "2026-10-15",
        "2026-11-05", "2026-12-03",
    ];

    let boc_work = [
        "2026-01-13", "2026-01-27", "2026-02-10", "2026-02-24",
        "2026-03-10", "2026-03-24", "2026-04-28", "2026-05-12",
        "2026-05-26", "2026-06-09", "2026-06-23", "2026-07-14",
        "2026-07-28", "2026-08-11", "2026-08-25", "2026-09-08",
        "2026-09-22", "2026-10-06", "2026-10-20", "2026-11-10",
        "2026-11-24", "2026-12-08",
    ];

    for date in boc_regular {
        events.push(meeting(
            &format!("boc-regular-{date}"),
            "Forsyth County Board of Commissioners Meeting",
            "government",
            date,
            "Board of Commissioners regular meeting / public hearing.",
            COUNTY_ADDRESS,
            COUNTY_LAT,
            COUNTY_LON,
            COUNTY_SOURCE,
        ));
    }

    for date in boc_work {
        events.push(meeting(
            &format!("boc-work-{date}"),
            "Forsyth County Board of Commissioners Work Session",
            "government",
            date,
            "Board of Commissioners work session.",
            COUNTY_ADDRESS,
            COUNTY_LAT,
            COUNTY_LON,
            COUNTY_SOURCE,
        ));
    }

    let planning_work = [
        "2026-01-20", "2026-02-17", "2026-03-17", "2026-04-21",
        "2026-05-12", "2026-06-16", "2026-07-21", "2026-08-18",
        "2026-09-15", "2026-10-20", "2026-11-16",
    ];

    let planning_hearings = [
        "2026-01-27", "2026-02-24", "2026-03-24", "2026-04-28",
        "2026-05-19", "2026-06-23", "2026-07-28", "2026-08-25",
        "2026-09-22", "2026-10-27", "2026-11-17",
    ];

    for date in planning_work {
        events.push(meeting(
            &format!("planning-work-{date}"),
            "Forsyth County Planning Commission Work Session",
            "government",
            date,
            "Planning Commission work session for zoning and conditional-use applications.",
            COUNTY_ADDRESS,
            COUNTY_LAT,
            COUNTY_LON,
            PLANNING_SOURCE,
        ));
    }

    for date in planning_hearings {
        events.push(meeting(
            &format!("planning-hearing-{date}"),
            "Forsyth County Planning Commission Public Hearing",
            "government",
            date,
            "Planning Commission public hearing for zoning and conditional-use applications.",
            COUNTY_ADDRESS,
            COUNTY_LAT,
            COUNTY_LON,
            PLANNING_SOURCE,
        ));
    }

    events
}

fn meeting(id: &str, title: &str, category: &str, date: &str, description: &str, location: &str, latitude: f64, longitude: f64, source_url: &str,) -> Event {
    Event {
        id: id.to_string(),
        title: title.to_string(),
        category: category.to_string(),
        description: description.to_string(),
        latitude: Some(latitude),
        longitude: Some(longitude),
        location: location.to_string(),
        status: "scheduled".to_string(),
        date: date.to_string(),
        source_name: Some(
            if category == "schools" {
                "Forsyth County Schools"
            } else {
                "Forsyth County Government"
            }
            .to_string()
        ),
        source_url: Some(source_url.to_string()),
        geometry: None,
    }
}
