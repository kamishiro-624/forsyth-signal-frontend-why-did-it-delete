import {
    initializeMap,
    addEventMarkers,
    addEventGeometry,
    selectEventGeometry,
    flyTo,
    isMapReady,
    setSelectedEvent
} from './map.js';

import {
    setEvents,
    getEvents,
    setState,
    setCategory,
    setSearch,
    selectEvent,
    renderEvents
} from './events.js';

import {
    initializeSearch
} from './search.js';

import {
    initializeAddressSearch,
    setAddressEvents
} from './address.js';

const eventsContainer = document.getElementById('events');
const detailsContainer = document.getElementById('details');
const eventCount = document.getElementById('event-count');
const searchInput = document.getElementById('search');
const categoryFilter = document.getElementById('category-filter');
const addressSearch = document.getElementById('address-search');
const addressSubmit = document.getElementById('address-submit');
const addressResults = document.getElementById('address-results');

let allEvents = [];
let addressSearchInitialized = false;
let mapEventsRendered = false;
const EVENTS_CACHE_NAME = 'forsyth-signal-events-v1';
const EVENTS_CACHE_URL = '/api/events';

function render() {
    renderEvents(eventsContainer, eventCount, showEvent);
}

function showEvent(event) {
    selectEvent(event.id);
    setSelectedEvent(event.id);
    detailsContainer.innerHTML = `
        <div class='details-category'>
            ${event.category}
        </div>

        <h2>
            ${escapeHtml(event.title)}
        </h2>

        <div class='details-status'>
            ${escapeHtml(event.status || event.state)}
        </div>

        ${
            event.summary
                ? `
                    <p>
                        <strong>
                            ${escapeHtml(event.summary)}
                        </strong>
                    </p>
                `
                : ''
        }

        <div class='why-matter'>
            <div class='why-matter-title'>
                Why does this matter?
            </div>

            <div class='why-matter-text'>
                ${escapeHtml(
                    getWhyItMatters(event)
                )}
            </div>
        </div>

        ${
            event.description
                ? `
                    <p>
                        ${escapeHtml(
                            event.description
                        )}
                    </p>
                `
                : ''
        }

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
            event.source_url
                ? `
                    <div class='details-section'>
                        <a href='${escapeAttribute(event.source_url)}' target='_blank' rel='noopener noreferrer'>
                            Official source →
                        </a>
                    </div>
                `
                : ''
        }
    `;

    if (isMapReady()) {
        if (event.geometry !== null && event.geometry !== undefined) {
            selectEventGeometry(event);
        } else if (event.latitude !== null && event.longitude !== null) {
            flyTo(event.latitude, event.longitude);
        }
    }

    render();
}

function getWhyItMatters(event) {
    if (event.why_it_matters) {
        return event.why_it_matters;
    }

    if (event.category === 'development') {
        if (event.state === 'upcoming') {
            return 'This development is an upcoming proposal or hearing that may affect how land is used in Forsyth County.';
        }

        if (event.state === 'active') {
            return 'This development is currently being reviewed or considered and may affect nearby property, traffic, or land use.';
        }

        return 'This development has already been decided, but the record can help residents understand changes occurring in their community.';
    }

    if (event.category === 'education') {
        return 'Board of Education decisions can affect students, families, schools, budgets, and education policy across Forsyth County.';
    }

    if (event.category === 'transportation') {
        return 'Transportation projects and decisions can affect traffic, travel times, road access, and future development.';
    }

    if (event.category === 'government') {
        return 'This is a public government proceeding where decisions affecting Forsyth County residents may be discussed or made.';
    }

    return 'This is a local government or community event that may provide information about decisions and changes in Forsyth County.';
}


function escapeHtml(value) {
    return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
}


function escapeAttribute(value) {
    return String(value ?? '').replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function syncMapEvents() {
    if (!isMapReady() || mapEventsRendered || allEvents.length === 0) {
        return;
    }

    mapEventsRendered = true;
    addEventGeometry(allEvents, showEvent);
    addEventMarkers(allEvents, showEvent);
}

function applyEvents(events) {
    allEvents = events;
    setEvents(allEvents);
    allEvents = getEvents();
    render();

    if (!addressSearchInitialized) {
        initializeAddressSearch({
            input: addressSearch,
            button: addressSubmit,
            results: addressResults,
            events: allEvents,
            onEventSelect: showEvent
        });
        addressSearchInitialized = true;
    } else {
        setAddressEvents(allEvents);
    }

    if (isMapReady()) {
        mapEventsRendered = false;
        syncMapEvents();
    }
}

async function loadEvents() {
    const eventsRequest = fetch(EVENTS_CACHE_URL, {cache: 'no-cache'}).then(
        response => ({response}),
        error => ({error})
    );

    try {
        if ('caches' in window) {
            const cache = await caches.open(EVENTS_CACHE_NAME);
            const cachedResponse = await cache.match(EVENTS_CACHE_URL);
            if (cachedResponse) {
                const events = await cachedResponse.json();
                if (!Array.isArray(events)) {
                    throw new Error('Cached event data is not an array');
                }
                applyEvents(events);
            }
        }
    } catch (error) {
        console.error('Failed to read cached events:', error);
    }

    try {
        const result = await eventsRequest;
        if (result.error) {
            throw result.error;
        }
        const response = result.response;

        if (!response.ok) {
            throw new Error(`API returned: ${response.status}`);
        }

        const responseForCache = response.clone();
        const events = await response.json();
        if (!Array.isArray(events)) {
            throw new Error('Events API returned an invalid response');
        }
        applyEvents(events);
        if ('caches' in window) {
            try {
                const cache = await caches.open(EVENTS_CACHE_NAME);
                await cache.put(EVENTS_CACHE_URL, responseForCache);
            } catch (error) {
                console.error('Failed to cache events:', error);
            }
        }
    } catch (error) {
        console.error('Failed to load events:', error);

        if (allEvents.length === 0) {
            eventsContainer.innerHTML = `
                <div class='error'>
                    Failed to load events.
                </div>
            `;
        }
    }
}

document.querySelectorAll('.event-tab').forEach(button => {
    button.addEventListener('click', () => {
        document.querySelectorAll('.event-tab').forEach(other => other.classList.remove('is-active'));
        button.classList.add('is-active');
        setState(button.dataset.state);
        render();
    });
});

categoryFilter.addEventListener('change', () => {
    setCategory(categoryFilter.value);
    render();
});

initializeSearch({
    eventSearch: searchInput,
    locationSearch: document.getElementById('location-search'),
    locationResults: document.getElementById('location-results'),
    onEventSearch: search => {setSearch(search); render();}
});

window.addEventListener('location-selected', event => {
    flyTo(event.detail.latitude, event.detail.longitude);
    const locationSearch = document.getElementById('location-search');
    locationSearch.value = event.detail.name;
    locationSearch.parentElement.querySelector('.search-clear').hidden = false;
});

window.onMapReady = syncMapEvents;

initializeMap(showEvent).catch(error => {
    console.error('Failed to initialize map:', error);
    const message = document.createElement('div');
    message.className = 'map-error';
    message.textContent = 'The map could not be loaded. Events are still available in the list.';
    document.getElementById('map-container').appendChild(message);
});
loadEvents();

const mapContainer = document.getElementById('map-container');
const mobilePanelButtons = document.querySelectorAll('#mobile-panel-controls [data-panel]');

function setMobilePanel(panelId) {
    const open = panelId && !document.getElementById(panelId).classList.contains('is-open');
    document.querySelectorAll('.mobile-panel').forEach(panel => panel.classList.remove('is-open'));
    mobilePanelButtons.forEach(button => {
        const isActive = open && button.dataset.panel === panelId;
        button.setAttribute('aria-expanded', String(Boolean(isActive)));
        button.classList.toggle('is-active', Boolean(isActive));
    });
    if (open) {
        document.getElementById(panelId).classList.add('is-open');
    }
    mapContainer.classList.toggle('has-open-panel', Boolean(open));
}

mobilePanelButtons.forEach(button => {
    button.addEventListener('click', () => setMobilePanel(button.dataset.panel));
});
document.querySelectorAll('.panel-close').forEach(button => {
    button.addEventListener('click', () => setMobilePanel(null));
});