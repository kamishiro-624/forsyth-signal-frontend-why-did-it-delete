import {
    initializeMap,
    addEventMarkers,
    addEventGeometry,
    selectEventGeometry,
    flyTo
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
    initializeAddressSearch
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

function render() {
    renderEvents(eventsContainer, eventCount, showEvent);
}

function showEvent(event) {
    selectEvent(event.id);
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

    if (event.geometry !== null && event.geometry !== undefined) {
        selectEventGeometry(event);
    } else if (event.latitude !== null && event.longitude !== null) {
        flyTo(event.latitude, event.longitude);
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

async function loadEvents() {
    try {
        const response = await fetch('/api/events');

        if (!response.ok) {
            throw new Error(`API returned: ${response.status}`);
        }

        allEvents = await response.json();

        setEvents(allEvents);

        allEvents = getEvents();

        addEventMarkers(allEvents, showEvent);

        addEventGeometry(allEvents, id => {
            const event =
                allEvents.find(
                    item =>
                        item.id === id
                );

            if (event) {

                showEvent(event);

            }
        });

        render();

        initializeAddressSearch({
            input: addressSearch,
            button: addressSubmit,
            results: addressResults,
            events: allEvents,
            onEventSelect: showEvent
        });
    } catch (error) {
        console.error('Failed to load events:', error);

        eventsContainer.innerHTML = `
            <div class='error'>
                Failed to load events.
            </div>
        `;
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
});

window.onMapReady = loadEvents;

initializeMap(showEvent);