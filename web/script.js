import * as maplibregl from 'https://unpkg.com/maplibre-gl@6.11.2/dist/maplibre-gl.mjs';

const eventsContainer = document.getElementById('upcoming');
const detailsContainer = document.getElementById('details');
const timelineContainer = document.getElementById('timeline');
const searchInput = document.getElementById('search');
const eventCount = document.getElementById('event-count');
const locationSearch = document.getElementById('location-search');
const locationResults = document.getElementById('location-results');

let allEvents = [];
let map;
let geolocate;

const categoryFilters = [...document.querySelectorAll('#category-filters input')];
const layerFilters = [...document.querySelectorAll('#layer-filters input')];
let searchTimeout;

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

    geolocate = new maplibregl.GeolocateControl({
        positionOptions: {
            enableHighAccuracy: true
        },
        trackUserLocation: false,
        showUserLocation: true,
        showAccuracyCircle: true
    });

    map.addControl(geolocate, 'top-right');

    map.on('load', async () => {
        await loadEvents();
        await loadMapLayers();
    });
}

async function loadEvents() {
    try {
        const response = await fetch('/api/events');
        if (!response.ok) {
            throw new Error(`API returned ${response.status}`);
        }
        allEvents = await response.json();
    } catch (error) {
        console.error('Failed to load events:', error);

        detailsContainer.innerHTML = `
            <div class='empty-state'>
                Failed to load Forsyth Signal data.
                Check the Rust server terminal.
            </div>
        `;

        return;
    }

    renderEvents();
    addEventMarkers();
    addEventGeometry();
    renderUpcoming();

}

async function loadMapLayers() {
    try {
        const response = await fetch('/api/layers');

        if (!response.ok) {
            throw new Error(`Layer API returned ${response.status}`);
        }

        const layers = await response.json();

        addGeoJsonLayer('schools-layer', layers.schools, 'circle',
            {
                'circle-radius': 5,
                'circle-color': '#b56cff',
                'circle-stroke-color': '#ffffff',
                'circle-stroke-width': 1
            }
        );

        addGeoJsonLayer('parks-layer', layers.parks, 'fill',
            {
                'fill-color': '#4f8f58',
                'fill-opacity': 0.12,
                'fill-outline-color': '#4f8f58'
            }
        );

        addGeoJsonLayer('zoning-layer', layers.zoning, 'fill',
            {
                'fill-color': '#6b7280',
                'fill-opacity': 0.05,
                'fill-outline-color': '#6b7280'
            }
        );

        map.setLayoutProperty('zoning-layer', 'visibility', 'none');

        addLayerInteractions();

    } catch (error) {
        console.error('Failed to load map layers:', error);
    }
}

function addGeoJsonLayer(id, data, type, paint) {
    if (!data) return;

    if (map.getSource(id)) {
        map.getSource(id).setData(data);
        return;
    }

    map.addSource(id, {type: 'geojson', data});

    if (type === 'circle') {
        map.addLayer({id, type, source: id, paint});
    } else {
        map.addLayer({id, type, source: id, paint});
    }
}

function addLayerInteractions() {
    if (map.getLayer('schools-layer')) {

        map.on('click', 'schools-layer', event => {

            if (!event.features || event.features.length === 0) {
                return;
            }

            const properties = event.features[0].properties;

            showFeatureDetails({
                title: properties.SCH_NAME || 'School',
                category: 'schools',
                description: properties.TYPE || 'Forsyth County school.',
                location: [
                    properties.ADDRESS,
                    properties.CITY,
                    properties.ZIP
                ].filter(Boolean).join(', '),
                source_name: 'Forsyth County Schools GIS',
                source_url: properties.WEBSITE || null
            });

        });

        map.on('mouseenter', 'schools-layer', () => {
            map.getCanvas().style.cursor = 'pointer';
        });

        map.on('mouseleave', 'schools-layer', () => {
            map.getCanvas().style.cursor = '';
        });
    }

    if (map.getLayer('parks-layer')) {

        map.on('click', 'parks-layer', event => {

            if (!event.features || event.features.length === 0) {
                return;
            }

            const properties = event.features[0].properties;

            showFeatureDetails({
                title: properties.Name || 'Park',
                category: 'community',
                description: properties.FullAddr || 'Forsyth County park.',
                location: properties.FullAddr || 'Forsyth County, Georgia',
                source_name: 'Forsyth County Parks & Recreation GIS',
                source_url: properties.ParkURL || null
            });

        });

        map.on('mouseenter', 'parks-layer', () => {
            map.getCanvas().style.cursor = 'pointer';
        });

        map.on('mouseleave', 'parks-layer', () => {
            map.getCanvas().style.cursor = '';
        });
    }
}

function addEventMarkers() {

    for (const event of allEvents) {

        if (
            event.latitude === null ||
            event.longitude === null
        ) {
            continue;
        }

        const element = document.createElement('div');

        element.className =
            `event-marker ${markerClass(event.category)}`;

        const marker =
            new maplibregl.Marker({
                element
            })
                .setLngLat([
                    event.longitude,
                    event.latitude
                ])
                .addTo(map);

        element.addEventListener('click', () => {

            showDetails(event);

            map.flyTo({
                center: [
                    event.longitude,
                    event.latitude
                ],

                zoom: 14
            });

        });

        marker._forsythEvent = event;
    }
}

function addEventGeometry() {

    const features = allEvents
        .filter(event => event.geometry !== null)
        .map(event => ({
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

    const geojson = {
        type: 'FeatureCollection',
        features
    };

    if (map.getSource('event-geometry')) {

        map.getSource('event-geometry').setData(geojson);

        return;
    }

    map.addSource('event-geometry', {
        type: 'geojson',
        data: geojson
    });

    map.addLayer({
        id: 'event-geometry-fill',
        type: 'fill',
        source: 'event-geometry',

        paint: {
            'fill-color': [
                'match',
                ['get', 'category'],
                'public-notice', '#f4991a',
                'development', '#ef6b73',
                '#3ba7c9'
            ],

            'fill-opacity': 0.20
        }
    });

    map.addLayer({
        id: 'event-geometry-outline',
        type: 'line',
        source: 'event-geometry',

        paint: {
            'line-color': [
                'match',
                ['get', 'category'],
                'public-notice', '#f4991a',
                'development', '#ef6b73',
                '#3ba7c9'
            ],

            'line-width': 2
        }
    });

    map.on(
        'click',
        'event-geometry-fill',
        event => {

            if (!event.features || event.features.length === 0) {
                return;
            }

            const properties =
                event.features[0].properties;

            const matchingEvent =
                allEvents.find(
                    item => item.id === properties.id
                );

            if (matchingEvent) {
                showDetails(matchingEvent);
            }

        }
    );

    map.on(
        'mouseenter',
        'event-geometry-fill',
        () => {
            map.getCanvas().style.cursor = 'pointer';
        }
    );

    map.on(
        'mouseleave',
        'event-geometry-fill',
        () => {
            map.getCanvas().style.cursor = '';
        }
    );
}

function renderEvents() {

    const query =
        searchInput.value.toLowerCase().trim();

    const categories =
        categoryFilters
            .filter(input => input.checked)
            .map(input => input.value);

    const filtered =
        allEvents.filter(event => {

            if (!categories.includes(event.category)) {
                return false;
            }

            if (!query) {
                return true;
            }

            const searchable = [
                event.title,
                event.description,
                event.location,
                event.status,
                event.category,
                event.source_name
            ]
                .filter(Boolean)
                .join(' ')
                .toLowerCase();

            return searchable.includes(query);

        });

    eventCount.textContent =
        `${filtered.length} EVENTS`;

    eventsContainer.innerHTML = '';

    const sorted =
        [...filtered]
            .sort(sortEvents)
            .slice(0, 50);

    for (const event of sorted) {

        const item =
            document.createElement('div');

        item.className = 'upcoming-item';

        item.innerHTML = `
            <div class='upcoming-title'>
                ${escapeHtml(event.title)}
            </div>

            <div class='upcoming-date'>
                ${escapeHtml(event.date || event.category)}
            </div>
        `;

        item.addEventListener('click', () => {

            showDetails(event);

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

        });

        eventsContainer.appendChild(item);
    }
}

function renderUpcoming() {

    const upcoming =
        allEvents
            .filter(event => event.date)
            .sort(sortEvents)
            .slice(0, 12);

    eventsContainer.innerHTML = '';

    for (const event of upcoming) {

        const item =
            document.createElement('div');

        item.className = 'upcoming-item';

        item.innerHTML = `
            <div class='upcoming-title'>
                ${escapeHtml(event.title)}
            </div>

            <div class='upcoming-date'>
                ${escapeHtml(event.date)}
            </div>
        `;

        item.addEventListener('click', () => {

            showDetails(event);

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

        });

        eventsContainer.appendChild(item);
    }
}

function showDetails(event) {

    detailsContainer.innerHTML = `

        <div class='details-category'>
            ${escapeHtml(event.category.toUpperCase())}
        </div>

        <h2>
            ${escapeHtml(event.title)}
        </h2>

        <div class='details-status'>
            ${escapeHtml(event.status)}
        </div>

        <p>
            ${escapeHtml(event.description)}
        </p>

        <div class='details-section'>

            <div class='details-label'>
                LOCATION
            </div>

            <div>
                ${escapeHtml(event.location)}
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
                            ${escapeHtml(event.date)}
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
                            ${escapeHtml(event.source_name)}
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
                            href='${escapeAttribute(event.source_url)}'
                            target='_blank'
                            rel='noopener noreferrer'
                        >
                            View official source →
                        </a>

                    </div>
                `
                : ''
        }

    `;

    renderTimeline(event);
}

function showFeatureDetails(feature) {

    detailsContainer.innerHTML = `

        <div class='details-category'>
            ${escapeHtml(feature.category.toUpperCase())}
        </div>

        <h2>
            ${escapeHtml(feature.title)}
        </h2>

        <p>
            ${escapeHtml(feature.description)}
        </p>

        <div class='details-section'>

            <div class='details-label'>
                LOCATION
            </div>

            <div>
                ${escapeHtml(feature.location)}
            </div>

        </div>

        ${
            feature.source_name
                ? `
                    <div class='details-section'>

                        <div class='details-label'>
                            SOURCE
                        </div>

                        <div>
                            ${escapeHtml(feature.source_name)}
                        </div>

                    </div>
                `
                : ''
        }

        ${
            feature.source_url
                ? `
                    <div class='details-section'>

                        <a
                            href='${escapeAttribute(feature.source_url)}'
                            target='_blank'
                            rel='noopener noreferrer'
                        >
                            View official source →
                        </a>

                    </div>
                `
                : ''
        }

    `;

    timelineContainer.innerHTML = `
        <div class='empty-state'>
            Timeline is currently available for event locations.
        </div>
    `;
}

function renderTimeline(event) {

    if (
        event.category !== 'development' &&
        event.category !== 'public-notice'
    ) {

        timelineContainer.innerHTML = `
            <div class='empty-state'>
                Location timeline is focused on development and
                public-notice activity.
            </div>
        `;

        return;
    }

    const query =
        normalizeLocation(event.location);

    const related =
        allEvents
            .filter(item => {

                if (item.id === event.id) {
                    return true;
                }

                if (!query || query.length < 4) {
                    return false;
                }

                return normalizeLocation(item.location)
                    .includes(query);
            })
            .sort(sortEvents)
            .slice(0, 10);

    if (related.length <= 1) {

        timelineContainer.innerHTML = `
            <div class='empty-state'>
                No other related public activity was found.
            </div>
        `;

        return;
    }

    timelineContainer.innerHTML = '';

    for (const item of related) {

        const element =
            document.createElement('div');

        element.className = 'timeline-item';

        element.innerHTML = `

            <div class='timeline-dot'></div>

            <div class='timeline-date'>
                ${escapeHtml(item.date || 'Undated')}
            </div>

            <div class='timeline-title-text'>
                ${escapeHtml(item.title)}
            </div>

        `;

        element.addEventListener('click', () => {
            showDetails(item);
        });

        timelineContainer.appendChild(element);
    }
}

function markerClass(category) {

    if (category === 'schools') {
        return 'school-marker';
    }

    if (category === 'government') {
        return 'meeting-marker';
    }

    if (category === 'public-notice') {
        return 'notice-marker';
    }

    return 'development-marker';
}

function sortEvents(a, b) {

    if (!a.date && !b.date) {
        return 0;
    }

    if (!a.date) {
        return 1;
    }

    if (!b.date) {
        return -1;
    }

    return a.date.localeCompare(b.date);
}

function normalizeLocation(value) {

    return (value || '')
        .toLowerCase()
        .replace(/[^a-z0-9 ]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function escapeHtml(value) {

    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll("'", '&quot;')
        .replaceAll("'", '&#039;');
}

function escapeAttribute(value) {
    return escapeHtml(value);
}

searchInput.addEventListener('input', () => {
    renderEvents();
});

for (const filter of categoryFilters) {

    filter.addEventListener('change', () => {
        renderEvents();
    });

}

for (const filter of layerFilters) {

    filter.addEventListener('change', () => {

        const layer = filter.dataset.layer;

        const visibility =
            filter.checked
                ? 'visible'
                : 'none';

        const layerId =
            `${layer}-layer`;

        if (map.getLayer(layerId)) {

            map.setLayoutProperty(
                layerId,
                'visibility',
                visibility
            );

        }

    });

}

locationSearch.addEventListener('input', () => {

    clearTimeout(searchTimeout);

    const query =
        locationSearch.value.trim();

    if (query.length < 3) {

        locationResults.innerHTML = '';

        return;
    }

    searchTimeout = setTimeout(() => {
        searchLocation(query);
    }, 400);

});

async function searchLocation(query) {

    try {

        const url =
            'https://nominatim.openstreetmap.org/search' +
            '?format=jsonv2' +
            '&limit=5' +
            '&countrycodes=us' +
            '&q=' +
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
            'Location search failed:',
            error
        );

        locationResults.innerHTML = `
            <div class='location-result'>
                Search failed.
            </div>
        `;
    }
}

function renderLocationResults(results) {

    locationResults.innerHTML = '';

    if (results.length === 0) {

        locationResults.innerHTML = `
            <div class='location-result'>
                No locations found.
            </div>
        `;

        return;
    }

    for (const result of results) {

        const element =
            document.createElement('div');

        element.className = 'location-result';

        element.innerHTML = `

            <div class='location-result-name'>
                ${escapeHtml(result.display_name)}
            </div>

            <div class='location-result-type'>
                ${escapeHtml(result.type || 'location')}
            </div>

        `;

        element.addEventListener('click', () => {

            const longitude =
                Number(result.lon);

            const latitude =
                Number(result.lat);

            map.flyTo({
                center: [
                    longitude,
                    latitude
                ],

                zoom: 15
            });

            locationSearch.value =
                result.display_name;

            locationResults.innerHTML = '';

        });

        locationResults.appendChild(element);
    }
}

initializeMap();
