// this is now deprecated

// lowk should we split this up?

import * as maplibregl from 'https://unpkg.com/maplibre-gl@6.11.2/dist/maplibre-gl.mjs';

const eventsContainer = document.getElementById('events');
const eventCount = document.getElementById('event-count');
const detailsContainer = document.getElementById('details');
const searchInput = document.getElementById('search');
const locationSearch = document.getElementById('location-search');
const locationResults = document.getElementById('location-results');

const EVENTS_URL = 'http://localhost:3000/api/events'; // change this in prod  // frick no!!!!!!
const EVENTS_CACHE_NAME = 'forsyth-events-v1';

let map;
let mapLoaded = false;
let allEvents = [];
let selectedEvent = null;
let eventSearchFields = [];
let currentEvents = [];
let renderedEventCount = 0;
let eventMarkers = [];

let searchTimeout;
let eventSearchTimeout;

const EVENT_BATCH_SIZE = 100;

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
                    attribution: '© OpenStreetMap contributors'
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

    map.addControl(new maplibregl.GeolocateControl({positionOptions: {enableHighAccuracy: true}, trackUserLocation: false, showUserLocation: true, showAccuracyCircle: true}),'top-right');

    map.on('load', () => {
        mapLoaded = true;
        renderMapEvents();
    });

    loadEvents();
}

function renderMapEvents() {
    if (!mapLoaded) {
        return;
    }

    addEventMarkers(allEvents);
    addEventGeometry(allEvents);
}

async function loadEvents() {
    let cache;
    let cachedEvents;

    try {
        if ('caches' in window) {
            cache = await caches.open(EVENTS_CACHE_NAME);
            const cachedResponse = await cache.match(EVENTS_URL);

            if (cachedResponse) {
                cachedEvents = await cachedResponse.json();
                displayEvents(cachedEvents);
            }
        }
    } catch (error) {
        console.error('Failed to read cached events:', error);
    }

    try {
        const response = await fetch(EVENTS_URL, {cache: 'no-store'});

        if (!response.ok) {
            throw new Error(`API returned: ${response.status}`);
        }

        const events = await response.json();
        displayEvents(events);

        if (cache) {
            try {
                await cache.put(EVENTS_URL, new Response(JSON.stringify(events), {
                    headers: {'Content-Type': 'application/json'}
                }));
            } catch (error) {
                console.error('Failed to cache events:', error);
            }
        }
    } catch (error) {
        console.error('Failed to refresh events:', error);

        if (!cachedEvents) {
            eventsContainer.innerHTML = `
                <div class='error'>
                    Failed to load events.
                </div>
            `;
        }
    }
}

function displayEvents(events) {
    const selectedEventId = selectedEvent?.id;
    allEvents = events;
    selectedEvent = selectedEventId
        ? allEvents.find(event => event.id === selectedEventId) ?? null
        : null;
    eventSearchFields = allEvents.map(event => [
        event.title,
        event.category,
        event.location,
        event.description
    ].map(value => String(value ?? '').toLowerCase()));
    renderEvents(allEvents);
    renderMapEvents();
}

function renderEvents(events) {
    currentEvents = events;
    renderedEventCount = 0;
    eventsContainer.replaceChildren();
    eventsContainer.scrollTop = 0;

    if (currentEvents.length === 0) {
        eventCount.textContent = 'No events found.';
        eventsContainer.innerHTML = `
            <div class='empty'>
                No events found :(
            </div>
        `;
        return;
    }

    appendEventBatch();
}

function appendEventBatch() {
    const end = Math.min(renderedEventCount + EVENT_BATCH_SIZE, currentEvents.length);
    const fragment = document.createDocumentFragment();

    for (let index = renderedEventCount; index < end; index++) {
        const event = currentEvents[index];
        const element = document.createElement('article');
        element.className = event === selectedEvent ? 'event is-selected' : 'event';
        element.dataset.eventIndex = String(index);
        element.setAttribute('role', 'button');
        element.setAttribute('aria-pressed', String(event === selectedEvent));
        element.tabIndex = 0;
        element.innerHTML = `
            <div class='event-category'>
                ${event.category}
            </div>

            <div class='event-title'>
                ${event.title}
            </div>

            <div class='event-location'>
                ${event.location}
            </div>

            <div class='event-date'>
                ${event.date}
            </div>
        `;

        fragment.appendChild(element);
    }

    eventsContainer.appendChild(fragment);
    renderedEventCount = end;

    const hasMore = renderedEventCount < currentEvents.length;
    eventCount.textContent = hasMore
        ? `Showing ${renderedEventCount} of ${currentEvents.length} events. Scroll to load more.`
        : `Showing ${renderedEventCount} of ${currentEvents.length} events.`;
}

eventsContainer.addEventListener('scroll', () => {
    if (renderedEventCount < currentEvents.length &&
        eventsContainer.scrollTop + eventsContainer.clientHeight >= eventsContainer.scrollHeight - 100) {
        appendEventBatch();
    }
});

eventsContainer.addEventListener('click', event => {
    const eventElement = event.target.closest('.event');
    if (!eventElement) {
        return;
    }

    const selectedEvent = currentEvents[Number(eventElement.dataset.eventIndex)];
    if (selectedEvent) {
        showDetails(selectedEvent);
    }
});

eventsContainer.addEventListener('keydown', event => {
    if (event.key !== 'Enter' && event.key !== ' ') {
        return;
    }

    const eventElement = event.target.closest('.event');
    if (!eventElement) {
        return;
    }

    event.preventDefault();
    const selected = currentEvents[Number(eventElement.dataset.eventIndex)];
    if (selected) {
        showDetails(selected);
    }
});

function showDetails(event) {
    selectedEvent = event;
    updateSelectedEvent();

    detailsContainer.innerHTML = `
        <div class='details-category'>
            ${event.category}
        </div>

        <h2>
            ${event.title}
        </h2>

        <div class='details-status'>
            ${event.status}
        </div>

        <p>
            ${event.description}
        </p>

        <div class='details-section'>

            <div class='details-label'>
                LOCATION
            </div>

            <div>
                ${event.location}
            </div>

        </div>

        ${
            event.date
                ? `

                    <div class='details-section'>

                        <div class='details-label'>
                            DATE
                        </div>

                        <div>
                            ${event.date}
                        </div>

                    </div>

                `
                : ''
        }

        ${
            event.latitude !== null &&
            event.longitude !== null
                ? `

                    <div class='details-section'>

                        <div class='details-label'>
                            COORDINATES
                        </div>

                        <div>
                            ${event.latitude.toFixed(5)},
                            ${event.longitude.toFixed(5)}
                        </div>

                    </div>

                `
                : ''
        }

        ${
            event.source_name
                ? `

                    <div class='details-section'>

                        <div class='details-label'>
                            SOURCE
                        </div>

                        <div>
                            ${event.source_name}
                        </div>

                    </div>

                `
                : ''
        }

        ${
            event.source_url
                ? `

                    <div class='details-section'>

                        <a
                            href='${event.source_url}'
                            target='_blank'
                            rel='noopener noreferrer'
                        >
                            Official source →
                        </a>

                    </div>

                `
                : ''
        }

    `;

    if (mapLoaded && event.geometry?.type !== 'Point' && event.geometry?.coordinates) {
        const bounds = new maplibregl.LngLatBounds();
        extendBounds(event.geometry.coordinates, bounds);

        if (!bounds.isEmpty()) {
            map.fitBounds(bounds, {
                padding: 72,
                maxZoom: 15,
                duration: 700
            });
        }
    } else if (mapLoaded && event.latitude !== null && event.longitude !== null) {
        map.flyTo({
            center: [
                event.longitude,
                event.latitude
            ],
            zoom: 15,
            duration: 700
        });
    }
}

function extendBounds(coordinates, bounds) {
    if (!Array.isArray(coordinates)) {
        return;
    }

    if (coordinates.length >= 2 &&
        typeof coordinates[0] === 'number' &&
        typeof coordinates[1] === 'number') {
        bounds.extend([coordinates[0], coordinates[1]]);
        return;
    }

    for (const coordinate of coordinates) {
        extendBounds(coordinate, bounds);
    }
}

function updateSelectedEvent() {
    for (const element of eventsContainer.querySelectorAll('.event')) {
        const event = currentEvents[Number(element.dataset.eventIndex)];
        const isSelected = event === selectedEvent;
        element.classList.toggle('is-selected', isSelected);
        element.setAttribute('aria-pressed', String(isSelected));
    }

    for (const {event, marker} of eventMarkers) {
        marker.getElement().classList.toggle('is-selected', event === selectedEvent);
    }

    if (!mapLoaded) {
        return;
    }

    const selectedIndex = allEvents.indexOf(selectedEvent);
    const filter = ['==', ['get', 'event-index'], selectedIndex];
    for (const layerId of ['event-geometry-selected-fill', 'event-geometry-selected-outline']) {
        if (map.getLayer(layerId)) {
            map.setFilter(layerId, selectedIndex < 0 ? ['==', ['get', 'event-index'], -1] : filter);
        }
    }
}

function addEventMarkers(events) {
    for (const {marker} of eventMarkers) {
        marker.remove();
    }

    eventMarkers = [];

    for (const event of events) {
        if (event.latitude === null || event.longitude === null) {
            continue;
        }

        const marker = new maplibregl.Marker().setLngLat([event.longitude, event.latitude]).addTo(map);
        marker.getElement().classList.toggle('is-selected', event === selectedEvent);

        marker.getElement().addEventListener('click', clickEvent => {
            clickEvent.stopPropagation();
            showDetails(event);
        });

        eventMarkers.push({event, marker});
    }
}

function addEventGeometry(events) {
    const features = events.flatMap((event, index) =>
        event.geometry === null || event.geometry === undefined
            ? []
            : [{type: 'Feature', geometry: event.geometry, properties: {'event-index': index}}]
    );

    const data = {
        type: 'FeatureCollection',
        features: features
    };

    if (map.getSource('event-geometry')) {
        map.getSource('event-geometry').setData(data);
        updateSelectedEvent();
        return;
    }

    map.addSource('event-geometry', {
        type: 'geojson',
        data: data
    });

    map.addLayer({
        id: 'event-geometry-fill',
        type: 'fill',
        source: 'event-geometry',
        paint: {
            'fill-color': '#F4991A',
            'fill-opacity': 0.2
        }
    });

    map.addLayer({
        id: 'event-geometry-outline',
        type: 'line',
        source: 'event-geometry',
        paint: {
            'line-color': '#F4991A',
            'line-width': 2
        }
    });

    map.addLayer({
        id: 'event-geometry-selected-fill',
        type: 'fill',
        source: 'event-geometry',
        filter: ['==', ['get', 'event-index'], -1],
        paint: {
            'fill-color': '#263a16',
            'fill-opacity': 0.42
        }
    });

    map.addLayer({
        id: 'event-geometry-selected-outline',
        type: 'line',
        source: 'event-geometry',
        filter: ['==', ['get', 'event-index'], -1],
        paint: {
            'line-color': '#263a16',
            'line-width': 4
        }
    });

    map.on('click', 'event-geometry-fill', event => {
        if (!event.features || event.features.length === 0) {
            return;
        }

        const selected = allEvents[Number(event.features[0].properties['event-index'])];
        if (selected) {
            showDetails(selected);
        }
    });

    map.on('mouseenter', 'event-geometry-fill',() => {
        map.getCanvas().style.cursor = 'pointer';  
    });

    map.on('mouseleave', 'event-geometry-fill', () => {
        map.getCanvas().style.cursor = ''; 
    });

    updateSelectedEvent();
}

async function searchLocation(query) {
    try {
        const url = 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=us&q=' + encodeURIComponent(query);
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`Location search failed: ${response.status}`);
        }

        const results = await response.json();
        renderLocationResults(results);
    } catch (error) {
        console.error('Location search failed:', error);
    }
}

function renderLocationResults(results) {
    locationResults.innerHTML = '';

    for (const result of results) {
        const element = document.createElement('div');

        element.className = 'location-result';
        element.textContent = result.display_name;
        element.addEventListener('click', () => {
            map.flyTo({
                center: [
                    Number(result.lon),
                    Number(result.lat)
                ],
                zoom: 15
            });

            locationSearch.value = result.display_name;

            locationResults.innerHTML = '';  
        });

        locationResults.appendChild(element);
    }
}

searchInput.addEventListener('input', () => {
    clearTimeout(eventSearchTimeout);

    eventSearchTimeout = setTimeout(() => {
        const query = searchInput.value.toLowerCase().trim();
        const filteredEvents = allEvents.filter((event, index) =>
            eventSearchFields[index].some(field => field.includes(query))
        );

        renderEvents(filteredEvents);
    }, 100);
});

locationSearch.addEventListener('input', () => {
    clearTimeout(searchTimeout);

    const query = locationSearch.value.trim();

    if (query.length < 3) {
        locationResults.innerHTML = '';
        return;
    }

    searchTimeout = setTimeout(() => {searchLocation(query);}, 400);
});

initializeMap();