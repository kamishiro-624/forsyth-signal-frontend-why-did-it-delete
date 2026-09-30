import * as maplibregl from "https://unpkg.com/maplibre-gl@6.11.2/dist/maplibre-gl.mjs";

const eventsContainer = document.getElementById("events");
const detailsContainer = document.getElementById("details");
const searchInput = document.getElementById("search");
const locationSearch = document.getElementById("location-search");
const locationResults = document.getElementById("location-results");

let map;
let allEvents = [];
let eventMarkers = [];

function initializeMap() {

    map = new maplibregl.Map({

        container: "map",

        style: {
            version: 8,

            sources: {

                osm: {
                    type: "raster",

                    tiles: [
                        "https://tile.openstreetmap.org/{z}/{x}/{y}.png"
                    ],

                    tileSize: 256,

                    attribution: "© OpenStreetMap contributors"
                }

            },

            layers: [

                {
                    id: "osm",

                    type: "raster",

                    source: "osm"
                }

            ]
        },

        center: [-84.14, 34.21],

        zoom: 10

    });

    map.addControl(
        new maplibregl.NavigationControl(),
        "top-right"
    );

    map.addControl(
        new maplibregl.GeolocateControl({

            positionOptions: {
                enableHighAccuracy: true
            },

            trackUserLocation: false,

            showUserLocation: true,

            showAccuracyCircle: true

        }),
        "top-right"
    );

    map.on("load", () => {

        loadEvents();

    });

}

async function loadEvents() {

    try {

        const response = await fetch("/api/events");

        if (!response.ok) {

            throw new Error(
                `API returned: ${response.status}`
            );

        }

        allEvents = await response.json();

        renderEvents(allEvents);

        addEventMarkers(allEvents);

        addEventGeometry(allEvents);

    } catch (error) {

        console.error(
            "Failed to load events:",
            error
        );

        eventsContainer.innerHTML = `
            <div class="error">
                Failed to load events.
            </div>
        `;

    }

}

function renderEvents(events) {

    eventsContainer.innerHTML = "";

    if (events.length === 0) {

        eventsContainer.innerHTML = `
            <div class="empty">
                No events found.
            </div>
        `;

        return;

    }

    for (const event of events) {

        const element =
            document.createElement("article");

        element.className = "event";

        element.innerHTML = `

            <div class="event-category">
                ${event.category}
            </div>

            <div class="event-title">
                ${event.title}
            </div>

            <div class="event-location">
                ${event.location}
            </div>

            <div class="event-date">
                ${event.date}
            </div>

        `;

        element.addEventListener("click", () => {

            showDetails(event);

        });

        eventsContainer.appendChild(element);

    }

}

function showDetails(event) {

    detailsContainer.innerHTML = `

        <div class="details-category">
            ${event.category}
        </div>

        <h2>
            ${event.title}
        </h2>

        <div class="details-status">
            ${event.status}
        </div>

        <p>
            ${event.description}
        </p>

        <div class="details-section">

            <div class="details-label">
                LOCATION
            </div>

            <div>
                ${event.location}
            </div>

        </div>

        ${
            event.date
                ? `

                    <div class="details-section">

                        <div class="details-label">
                            DATE
                        </div>

                        <div>
                            ${event.date}
                        </div>

                    </div>

                `
                : ""
        }

        ${
            event.latitude !== null &&
            event.longitude !== null
                ? `

                    <div class="details-section">

                        <div class="details-label">
                            COORDINATES
                        </div>

                        <div>
                            ${event.latitude.toFixed(5)},
                            ${event.longitude.toFixed(5)}
                        </div>

                    </div>

                `
                : ""
        }

        ${
            event.source_name
                ? `

                    <div class="details-section">

                        <div class="details-label">
                            SOURCE
                        </div>

                        <div>
                            ${event.source_name}
                        </div>

                    </div>

                `
                : ""
        }

        ${
            event.source_url
                ? `

                    <div class="details-section">

                        <a
                            href="${event.source_url}"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            Official source →
                        </a>

                    </div>

                `
                : ""
        }

    `;

    if (
        event.latitude !== null &&
        event.longitude !== null
    ) {

        map.flyTo({

            center: [
                event.longitude,
                event.latitude
            ],

            zoom: 14

        });

    }

}

function addEventMarkers(events) {

    for (const marker of eventMarkers) {

        marker.remove();

    }

    eventMarkers = [];

    for (const event of events) {

        if (
            event.latitude === null ||
            event.longitude === null
        ) {

            continue;

        }

        const marker =
            new maplibregl.Marker()
                .setLngLat([
                    event.longitude,
                    event.latitude
                ])
                .addTo(map);

        marker
            .getElement()
            .addEventListener("click", () => {

                showDetails(event);

            });

        eventMarkers.push(marker);

    }

}

function addEventGeometry(events) {

    const features = events

        .filter(event =>
            event.geometry !== null &&
            event.geometry !== undefined
        )

        .map(event => ({

            type: "Feature",

            geometry: event.geometry,

            properties: {

                id: event.id

            }

        }));

    const data = {

        type: "FeatureCollection",

        features: features

    };

    if (map.getSource("event-geometry")) {

        map
            .getSource("event-geometry")
            .setData(data);

        return;

    }

    map.addSource("event-geometry", {

        type: "geojson",

        data: data

    });

    map.addLayer({

        id: "event-geometry-fill",

        type: "fill",

        source: "event-geometry",

        paint: {

            "fill-color": "#F4991A",

            "fill-opacity": 0.2

        }

    });

    map.addLayer({

        id: "event-geometry-outline",

        type: "line",

        source: "event-geometry",

        paint: {

            "line-color": "#F4991A",

            "line-width": 2

        }

    });

    map.on(
        "click",
        "event-geometry-fill",
        event => {

            if (
                !event.features ||
                event.features.length === 0
            ) {

                return;

            }

            const id =
                event.features[0]
                    .properties
                    .id;

            const selected =
                allEvents.find(
                    item => item.id === id
                );

            if (selected) {

                showDetails(selected);

            }

        }
    );

    map.on(
        "mouseenter",
        "event-geometry-fill",
        () => {

            map.getCanvas().style.cursor =
                "pointer";

        }
    );

    map.on(
        "mouseleave",
        "event-geometry-fill",
        () => {

            map.getCanvas().style.cursor =
                "";

        }
    );

}

searchInput.addEventListener(
    "input",
    () => {

        const query =
            searchInput.value
                .toLowerCase()
                .trim();

        const filteredEvents =
            allEvents.filter(event =>

                event.title
                    .toLowerCase()
                    .includes(query)

                ||

                event.category
                    .toLowerCase()
                    .includes(query)

                ||

                event.location
                    .toLowerCase()
                    .includes(query)

                ||

                event.description
                    .toLowerCase()
                    .includes(query)

        );

        renderEvents(filteredEvents);

    }
);

let searchTimeout;

locationSearch.addEventListener(
    "input",
    () => {

        clearTimeout(searchTimeout);

        const query =
            locationSearch.value.trim();

        if (query.length < 3) {

            locationResults.innerHTML = "";

            return;

        }

        searchTimeout = setTimeout(() => {

            searchLocation(query);

        }, 400);

    }
);

async function searchLocation(query) {

    try {

        const url =
            "https://nominatim.openstreetmap.org/search" +
            "?format=jsonv2" +
            "&limit=5" +
            "&countrycodes=us" +
            "&q=" +
            encodeURIComponent(query);

        const response =
            await fetch(url);

        if (!response.ok) {

            throw new Error(
                `Location search failed: ${response.status}`
            );

        }

        const results =
            await response.json();

        renderLocationResults(results);

    } catch (error) {

        console.error(
            "Location search failed:",
            error
        );

    }

}

function renderLocationResults(results) {

    locationResults.innerHTML = "";

    for (const result of results) {

        const element =
            document.createElement("div");

        element.className =
            "location-result";

        element.textContent =
            result.display_name;

        element.addEventListener(
            "click",
            () => {

                map.flyTo({

                    center: [
                        Number(result.lon),
                        Number(result.lat)
                    ],

                    zoom: 15

                });

                locationSearch.value =
                    result.display_name;

                locationResults.innerHTML =
                    "";

            }
        );

        locationResults.appendChild(
            element
        );

    }

}

initializeMap();