let maplibregl;
let map;
let selectedZoningId = null;
let mapReady = false;
let eventFeatures = [];
let geometryEvents = [];

export async function initializeMap(onEventSelect) {
    maplibregl = await import('https://unpkg.com/maplibre-gl@6.11.2/dist/maplibre-gl.mjs');
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

    map.addControl(
        new maplibregl.GeolocateControl({
            positionOptions: {
                enableHighAccuracy: true
            },
            trackUserLocation: false,
            showUserLocation: true,
            showAccuracyCircle: true
        }),
        'top-right'
    );

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
    eventFeatures = events.filter(event => event.latitude !== null && event.longitude !== null);
    const data = {
        type: 'FeatureCollection',
        features: eventFeatures.map(event => ({
            type: 'Feature',
            geometry: {type: 'Point', coordinates: [event.longitude, event.latitude]},
            properties: {id: event.id}
        }))
    };

    if (map.getSource('event-points')) {
        map.getSource('event-points').setData(data);
        return;
    }

    map.addSource('event-points', {type: 'geojson', data});
    map.addLayer({
        id: 'event-points',
        type: 'circle',
        source: 'event-points',
        filter: ['!=', ['get', 'id'], selectedZoningId ?? ''],
        paint: {
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 7, 4, 13, 7],
            'circle-color': '#344F1F',
            'circle-stroke-color': '#F4991A',
            'circle-stroke-width': 1.5
        }
    });
    map.addLayer({
        id: 'event-points-selected',
        type: 'circle',
        source: 'event-points',
        filter: ['==', ['get', 'id'], selectedZoningId ?? ''],
        paint: {
            'circle-radius': 9,
            'circle-color': '#F4991A',
            'circle-stroke-color': '#263a16',
            'circle-stroke-width': 2
        }
    });

    map.on('click', 'event-points', event => {
        if (!event.features || event.features.length === 0) {
            return;
        }

        const id = event.features[0].properties.id;
        const selected = eventFeatures.find(item => String(item.id) === String(id));
        if (selected) {
            clearSelectedZoning();
            onEventSelect(selected);
        }
    });

    map.on('mouseenter', 'event-points', () => {
        map.getCanvas().style.cursor = 'pointer';
    });
    map.on('mouseleave', 'event-points', () => {
        map.getCanvas().style.cursor = '';
    });
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

    selectedZoningId = event.id;

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
    selectedZoningId = id;
    if (mapReady && map.getLayer('event-points')) {
        map.setFilter('event-points', ['!=', ['get', 'id'], id]);
        map.setFilter('event-points-selected', ['==', ['get', 'id'], id]);
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