import * as maplibregl from 'https://unpkg.com/maplibre-gl@6.11.2/dist/maplibre-gl.mjs';

let map;
let markers = [];
let selectedZoningId = null;

export function initializeMap(onEventSelect) {
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
        if (window.onMapReady) {
            window.onMapReady();
        }
    });
}

export function getMap() {
    return map;
}

export function addEventMarkers(events, onEventSelect) {
    for (const marker of markers) {
        marker.remove();
    }

    markers = [];

    for (const event of events) {
        if (event.latitude === null || event.longitude === null) {
            continue;
        }

        const marker = new maplibregl.Marker().setLngLat([event.longitude, event.latitude]).addTo(map);

        marker.getElement().addEventListener('click', () => {
            onEventSelect(event);
        });

        markers.push(marker);
    }
}

export function addEventGeometry(events, onEventSelect) {
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

    map.addSource(
        'event-geometry',
        {
            type: 'geojson',
            data
        }
    );

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

        const selectedEvent = events.find(item => item.id === id);

        if (selectedEvent) {
            selectZoningGeometry(selectedEvent);
            onEventSelect(selectedEvent);
        }
    });

    map.on('mouseenter', 'event-geometry-fill', () => {
        map.getCanvas().style.cursor = 'pointer';
    });

    map.on('mouseleave', 'event-geometry-fill', () => {
        map.getCanvas().style.cursor = '';
    });
}

export function selectEventGeometry(event) {
    if (!event || !event.geometry) {
        return;
    }
    selectZoningGeometry(event);
}

function selectZoningGeometry(event) {
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

    const existing = map.getSource('selected-zoning');

    if (existing) {
        existing.setData(data);
    } else {
        map.addSource(
            'selected-zoning',
            {
                type: 'geojson',
                data
            }
        );

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

function zoomToGeometry(geometry) {
    const bounds = new maplibregl.LngLatBounds();

    addGeometryToBounds(geometry, bounds);

    if (!bounds.isEmpty()) {
        map.fitBounds(
            bounds,
            {
                padding: 80,
                maxZoom: 15
            }
        );
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

    if (geometry.type === 'LineString') {
        for (const coordinate of geometry.coordinates) {
            bounds.extend(coordinate);
        }

        return;
    }

    if (geometry.type === 'MultiLineString') {
        for (const line of geometry.coordinates) {
            for (const coordinate of line) {
                bounds.extend(coordinate);
            }
        }

        return;
    }

    if (geometry.type === 'Polygon') {
        for (const ring of geometry.coordinates) {
            for (const coordinate of ring) {
                bounds.extend(coordinate);
            }
        }

        return;
    }

    if (geometry.type === 'MultiPolygon') {
        for (const polygon of geometry.coordinates) {
            for (const ring of polygon) {
                for (const coordinate of ring) {
                    bounds.extend(coordinate);
                }
            }
        }

        return;
    }
}

export function flyTo(latitude, longitude, zoom=14) {
    map.flyTo({center: [longitude, latitude], zoom});
}

export function addAddressMarker(latitude, longitude) {
    const marker = new maplibregl.Marker({color: '#344F1F'}).setLngLat([longitude, latitude]).addTo(map);

    flyTo(latitude, longitude, 14);

    return marker;
}