import * as maplibregl from 'https://unpkg.com/maplibre-gl@6.11.2/dist/maplibre-gl.mjs';

const eventsContainer = document.getElementById('events');
const detailsContainer = document.getElementById('details');
const searchInput = document.getElementById('search');

let allEvents = [];
let map;
let geolocate;

function initializeMap() {

    map = new maplibregl.Map({
        container: 'map',

        style: {
            version: 8,
            sources: {
                osm: {
                    type: 'raster',
                    tiles: [
                        'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
                    ],
                    tileSize: 256,
                    attribution:
                        '© OpenStreetMap contributors'
                }
            },
            layers: [
                {
                    id: 'osm',
                    type: 'raster',
                    source: 'osm'
                }
            ]
        },
        center: [-84.14, 34.21],
        zoom: 10
    });

    map.addControl(new maplibregl.NavigationControl(), 'top-right');
    geolocate = new maplibregl.GeolocateControl({
        positionOptions: {
            enableHighAccuracy: true
        },
        trackUserLocation: true,
        showUserLocation: true,
        showAccuracyCircle: true
    });
    map.addControl(geolocate, "top-right");

    map.on("load", () => {
        loadEvents();
    });
}

async function loadZoningApplications() {
    try {
        const response = await fetch('/api/zoning');

        if (!response.ok) {
            throw new Error(`Zoning request failed: ${response.status}`);
        }

        const data = await response.json();

        map.addSource('zoning-applications', {type: 'geojson', data: data});

        map.addLayer({
            id: 'zoning-applications-fill',
            type: 'fill',
            source: 'zoning-applications', 
            paint: {
                'fill-color': '#F4991A',
                'fill-opacity': 0.20
            }
        });
        map.addLayer({
            id: 'zoning-applications-outline',
            type: 'line',
            source: 'zoning-applications',
            paint: {
                'line-color': '#F4991A',
                'line-width': 2
            }
        });

        map.on('click', 'zoning-applications-fill', (event) => {
            const properties = event.features[0].properties;
            showZoningDetails(properties);
        });
        map.on('mouseenter', 'zoning-applications-fill', () => {
            map.getCanvas().style.cursor = 'pointer';
        });
        map.on('mouseleave', 'zoning-applications-fill', () => {
            map.getCanvas().style.cursor = '';
        });
    } catch (error) {
        console.error('Failed to load zoning data: ', error);
    }
}

function showZoningDetails(properties) {

    detailsContainer.innerHTML = `
        <div class="details-category">
            ZONING APPLICATION
        </div>

        <h2>
            ${properties.ZANUMBER || "Unknown Application"}
        </h2>

        <div class="details-status">
            ${properties.ZASTATUS || "Unknown Status"}
        </div>

        <div class="details-section">

            <div class="details-label">
                APPLICATION
            </div>

            <div>
                ${properties.ZANUMBER || "—"}
            </div>

        </div>

        <div class="details-section">

            <div class="details-label">
                STATUS
            </div>

            <div>
                ${properties.ZASTATUS || "—"}
            </div>

        </div>

        <div class="details-section">

            <div class="details-label">
                PROCESS
            </div>

            <div>
                ${properties.PROCESS || "—"}
            </div>

        </div>

        <div class="details-section">

            <div class="details-label">
                COMMENTS
            </div>

            <div>
                ${properties.COMMENTS || "No comments available."}
            </div>

        </div>

        ${
            properties.LINK
                ? `
                    <div class="details-section">

                        <div class="details-label">
                            OFFICIAL SOURCE
                        </div>

                        <a
                            href="${properties.LINK}"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            View in Forsyth County eStatus →
                        </a>

                    </div>
                `
                : ""
        }

    `;
}

function addEventMarkers(events) {
    for (const event of events) {
        if (event.latitude === null || event.longitude === null) {
            continue;
        }

        const marker = new maplibregl.Marker().setLngLat([event.longitude, event.latitude]).addTo(map);

        marker.getElement().addEventListener("click", () => {
            showDetails(event);

            map.flyTo({center: [event.longitude, event.latitude], zoom: 14});
        });
    }
}

function addEventGeometry(events) {
    const features = events.filter(event => event.geometry !== null).map(event => ({
        type: 'Feature',
        geometry: event.geometry,
        properties: {
            id: event.id,
            title: event.title,
            category: event.category,
            description: event.description,
            status: event.status,
            location: event.location,
            sourceName: event.source_name,
            sourceUrl: event.source_url
        }
    }));

    if (features.length === 0) {
        return;
    }

    map.addSource('event-geometry', {
        type: 'geojson',
        data: {
            type: 'FeatureCollection',
            features
        }
    });

    map.addLayer({
        id: 'event-geometry-fill',
        type: 'fill',
        source: 'event-geometry',
        paint: {
            'fill-color': '#F4991A',

            'fill-opacity': 0.20
        }
    });

    map.addLayer({
        id: 'event-geometry-outline',
        type: 'line',
        source: 'event-geometry',
        paint: {
            "line-color": '#F4991A',
            "line-width": 2
        }
    });

    map.on('click', 'event-geometry-fill', event => {
        const properties = event.features[0].properties;
        const matchingEvent = allEvents.find(item => item.id === properties.id);

        if (matchingEvent) {
            showDetails(matchingEvent);
        }
    });

    map.on('mouseenter', 'event-geometry-fill', () => {
        map.getCanvas().style.cursor =
            "pointer";

    });

    map.on('mouseleave', 'event-geometry-fill', () => {
        map.getCanvas().style.cursor =
            "";
    });
}

async function loadEvents() {
    try {
        const response = await fetch('/api/events');

        if (!response.ok) {
            throw new Error(
                `Failed to load events: ${response.status}`
            );
        }

        allEvents = await response.json();

        renderEvents(allEvents);
        addEventMarkers(allEvents);
        addEventGeometry(allEvents);

    } catch (error) {
        console.error('Failed to load events: ', error);
    }
}

function renderEvents(events) {
    eventsContainer.innerHTML = '';

    if (events.length === 0) {
        eventsContainer.innerHTML = `
            <div class="empty">
                No events found.
            </div>
        `;

        return;
    }

    for (const event of events) {
        const element = document.createElement('div');
        element.className = 'event';

        element.innerHTML = `
            <div class="event-category">
                ${event.category.toUpperCase()}
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

        element.addEventListener('click', () => {
            showDetails(event);

            map.flyTo({center: [event.longitude, event.latitude], zoom: 14});
        });

        eventsContainer.appendChild(element);
    }
}
function showDetails(event) {
    detailsContainer.innerHTML = `
        <div class="details-category">
            ${event.category.toUpperCase()}
        </div>

        <h2>${event.title}</h2>

        <div class="details-status">${event.status}</div>

        <p>${event.description}</p>

        <div class="details-section">
            <div class="details-label">LOCATION</div>

            <div>${event.location}</div>
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
                            View official source →
                        </a>

                    </div>
                `
                : ""
        }

    `;
}

searchInput.addEventListener('input', () => {
    const query = searchInput.value.toLowerCase().trim();

    const filteredEvents = allEvents.filter(event =>
        event.title.toLowerCase().includes(query) ||
        event.category.toLowerCase().includes(query) ||
        event.location.toLowerCase().includes(query) ||
        event.description.toLowerCase().includes(query)
    );

    renderEvents(filteredEvents);
});

initializeMap();
loadEvents();