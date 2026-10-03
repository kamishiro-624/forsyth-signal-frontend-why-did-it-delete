let maplibregl;
let map;
let selectedZoningId = null;
let mapReady = false;
let eventMarkers = [];
let geometryEvents = [];
const LAST_USER_POSITION_KEY = 'forsyth-signal-last-user-position';

function getLastUserPosition() {
    try {
        const saved = localStorage.getItem(LAST_USER_POSITION_KEY);
        if (!saved) {
            return null;
        }

        const position = JSON.parse(saved);
        if (position &&
            typeof position === 'object' &&
            Number.isFinite(position.latitude) &&
            Number.isFinite(position.longitude) &&
            Math.abs(position.latitude) <= 90 &&
            Math.abs(position.longitude) <= 180) {
            return position;
        }

        console.error('Saved user position is invalid.');
        localStorage.removeItem(LAST_USER_POSITION_KEY);
    } catch (error) {
        console.error('Failed to read saved user position:', error);
    }

    return null;
}

export async function initializeMap(onEventSelect) {
    maplibregl = await import('https://unpkg.com/maplibre-gl@6.11.2/dist/maplibre-gl.mjs');
    const lastPosition = getLastUserPosition();
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
        center: lastPosition
            ? [lastPosition.longitude, lastPosition.latitude]
            : [-84.14, 34.21],
        zoom: lastPosition ? 14 : 10
    });

    map.addControl(new maplibregl.NavigationControl(), 'top-right');

    const geolocateControl = new maplibregl.GeolocateControl({
        positionOptions: {
            enableHighAccuracy: true
        },
        trackUserLocation: false,
        showUserLocation: true,
        showAccuracyCircle: true
    });
    geolocateControl.on('geolocate', event => {
        const position = {
            latitude: event.coords.latitude,
            longitude: event.coords.longitude
        };

        try {
            localStorage.setItem(LAST_USER_POSITION_KEY, JSON.stringify(position));
        } catch (error) {
            console.error('Failed to save user position:', error);
        }
    });
    map.addControl(geolocateControl, 'top-right');

    if (lastPosition) {
        new maplibregl.Marker({color: '#344F1F'})
            .setLngLat([lastPosition.longitude, lastPosition.latitude])
            .addTo(map);
    }

    map.on('load', () => {
        mapReady = true;
        if (window.onMapReady) {
            window.onMapReady();
        }
    });
}

export function getMap() {
    return map;
}

export function isMapReady() {
    return mapReady;
}

export function addEventMarkers(events, onEventSelect) {
    for (const {marker} of eventMarkers) {
        marker.remove();
    }
    eventMarkers = [];

    for (const event of events) {
        if (event.latitude === null || event.longitude === null) {
            continue;
        }

        const marker = new maplibregl.Marker()
            .setLngLat([event.longitude, event.latitude])
            .addTo(map);
        marker.getElement().classList.toggle('is-selected', String(event.id) === String(selectedZoningId));
        marker.getElement().addEventListener('click', clickEvent => {
            clickEvent.stopPropagation();
            onEventSelect(event);
        });
        eventMarkers.push({event, marker});
    }
}

export function addEventGeometry(events, onEventSelect) {
    geometryEvents = events;
    const features = events.filter(event => event.geometry !== null && event.geometry !== undefined)
        .map(event => ({
            type: 'Feature',
            geometry: event.geometry,
            properties: {
                id: event.id
            }
        }));

    const data = {
        type: 'FeatureCollection',
        features
    };

    const existing = map.getSource('event-geometry');

    if (existing) {
        existing.setData(data);
        return;
    }

    map.addSource('event-geometry', {type: 'geojson', data});

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
            'line-color': '#F4991A',
            'line-width': 2
        }
    });

    map.on('click', 'event-geometry-fill', event => {
        if (!event.features || event.features.length === 0) {
            return;
        }

        const id = event.features[0].properties.id;

        const selectedEvent = geometryEvents.find(item => String(item.id) === String(id));

        if (!selectedEvent) {
            return;
        }

        onEventSelect(selectedEvent);
    });

    map.on('mouseenter', 'event-geometry-fill', () => {
        map.getCanvas().style.cursor = 'pointer';
    });

    map.on('mouseleave', 'event-geometry-fill', () => {
        map.getCanvas().style.cursor = '';
    });
}

export function selectEventGeometry(event) {
    if (!event.geometry) {
        return;
    }

    setSelectedEvent(event.id);

    const data = {
        type: 'FeatureCollection',
        features: [
            {
                type: 'Feature',
                properties: {
                    id: event.id
                },
                geometry: event.geometry
            }
        ]
    };

    const source = map.getSource('selected-zoning');

    if (source) {
        source.setData(data);
    } else {
        map.addSource('selected-zoning', {
            type: 'geojson',
            data
        });

        map.addLayer({
            id: 'selected-zoning-fill',
            type: 'fill',
            source: 'selected-zoning',
            paint: {
                'fill-color': '#344F1F',
                'fill-opacity': 0.35
            }
        });

        map.addLayer({
            id: 'selected-zoning-outline',
            type: 'line',
            source: 'selected-zoning',
            paint: {
                'line-color': '#344F1F',
                'line-width': 3
            }
        });
    }

    zoomToGeometry(event.geometry);
}

export function setSelectedEvent(id) {
    clearSelectedZoning();
    selectedZoningId = id;
    for (const {event, marker} of eventMarkers) {
        marker.getElement().classList.toggle('is-selected', String(event.id) === String(id));
    }
}

function clearSelectedZoning() {
    selectedZoningId = null;
    const source = map.getSource('selected-zoning');
    if (source) {
        source.setData({
            type: 'FeatureCollection',
            features: []
        });
    }
}

function zoomToGeometry(geometry) {
    const bounds = new maplibregl.LngLatBounds();

    addGeometryToBounds(geometry, bounds);

    if (!bounds.isEmpty()) {
        map.fitBounds(bounds, {padding: 80, maxZoom: 15});
    }
}

function addGeometryToBounds(geometry, bounds) {
    if (!geometry) {
        return;
    }

    if (geometry.type === 'Point') {
        bounds.extend(geometry.coordinates);
        return;
    }

    if (geometry.type === 'MultiPoint') {
        for (const coordinate of geometry.coordinates) {
            bounds.extend(coordinate);

        }

        return;
    }

    if (geometry.type === 'LineString' || geometry.type === 'MultiLineString' || geometry.type === 'Polygon' || geometry.type === 'MultiPolygon') {
        addCoordinatesToBounds(geometry.coordinates, bounds);
    }
}

function addCoordinatesToBounds(coordinates, bounds) {
    if (!Array.isArray(coordinates)) {
        return;
    }

    if (coordinates.length >= 2 && typeof coordinates[0] === 'number' && typeof coordinates[1] === 'number') {
        bounds.extend(coordinates);
        return;
    }

    for (const coordinate of coordinates) {
        addCoordinatesToBounds(coordinate, bounds);
    }
}

export function flyTo(latitude, longitude, zoom=14) {
    map.flyTo({center: [longitude, latitude], zoom});
}

export function addAddressMarker(latitude, longitude) {
    const marker = new maplibregl.Marker({color: '#344F1F'}).setLngLat([longitude, latitude]).addTo(map);

    return marker;
}