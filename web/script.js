import * as maplibregl from "https://unpkg.com/maplibre-gl@6.11.2/dist/maplibre-gl.mjs";

const eventsContainer = document.getElementById('events');
const detailsContainer = document.getElementById('details');
const searchInput = document.getElementById('search');

let allEvents = [];
let map;

function initializeMap() {
    map = new maplibregl.Map({
        container: 'map',
        style: {
            version: 8,
            sources: {
                osm: {
                    type: 'raster',
                    tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
                    tileSize: 256,
                    attribution: "© OpenStreetMap contributors"
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
    map.on('load', () => {
        loadZoningApplications();
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

function addMarkers(events) {
    for (const event of events) {
        const marker = new maplibregl.Marker().setLngLat([event.longitude, event.latitude]).addTo(map);

        marker.getElement().addEventListener('click', () => {
            showDetails(event);
        });
    }
}

async function loadEvents() {
    const response = await fetch('/api/events');

    if (!response.ok) {
        throw new Error(`Failed to load events: ${response.status}`);
    }

    allEvents = await response.json();

    renderEvents(allEvents);
    addMarkers(allEvents);
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

        <div class="details-status">
            ${event.status}
        </div>

        <p>
            ${event.description}
        </p>

        <div class="details-section">
            <div class="details-label">LOCATION</div>
            <div>${event.location}</div>
        </div>

        <div class="details-section">
            <div class="details-label">DATE</div>
            <div>${event.date}</div>
        </div>

        <div class="details-section">
            <div class="details-label">COORDINATES</div>
            <div>
                ${event.latitude.toFixed(5)},
                ${event.longitude.toFixed(5)}
            </div>
        </div>
    `
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