import {
    escapeHtml,
    getEventState,
    getCategoryName
} from './utils.js';

let allEvents = [];
let currentState = 'upcoming';
let currentCategory = 'all';
let currentSearch = '';
let selectedEventId = null;

export function setEvents(events) {
    allEvents = events.map(event => ({...event, state: getEventState(event)}));
}

export function getEvents() {
    return allEvents;
}

export function getSelectedEvent() {
    return allEvents.find(event => event.id === selectedEventId);
}

export function selectEvent(id) {
    selectedEventId = id;
}

export function filterEvents() {
    return allEvents.filter(event => {
        const stateMatches = event.state === currentState;
        const categoryMatches = currentCategory === 'all' || event.category === currentCategory;

        const search = currentSearch.toLowerCase();
        const searchMatches = !search || event.title?.toLowerCase().includes(search) || event.category?.toLowerCase().includes(search) || event.location?.toLowerCase().includes(search) || event.description?.toLowerCase().includes(search) || event.summary?.toLowerCase().includes(search);

        return (stateMatches && categoryMatches && searchMatches);
    });
}

export function setState(state) {
    currentState = state;
}

export function setCategory(category) {
    currentCategory = category;
}

export function setSearch(search) {
    currentSearch = search;
}

export function renderEvents(container, countContainer, onSelect) {
    const events = filterEvents();

    countContainer.textContent = `${events.length} event${events.length === 1 ? '' : 's'}`;

    container.innerHTML = '';

    if (events.length === 0) {
        container.innerHTML = `
            <div class='empty'>
                No ${currentState} events found :(
            </div>
        `;
        return;
    }

    for (const event of events) {
        const element = document.createElement('article');
        element.className = 'event';

        if (event.id === selectedEventId) {
            element.classList.add('is-selected');
        }

        element.tabIndex = 0;

        element.innerHTML = `
            <div class='event-category'>
                ${escapeHtml(
                    getCategoryName(event.category)
                )}
            </div>

            <div class='event-title'>
                ${escapeHtml(event.title)}
            </div>

            ${
                event.summary
                    ? `
                        <div class='event-summary'>
                            ${escapeHtml(event.summary)}
                        </div>
                    `
                    : ''
            }

            <div class='event-location'>
                ${escapeHtml(event.location)}
            </div>

            ${
                event.date
                    ? `
                        <div class='event-date'>
                            ${escapeHtml(event.date)}
                        </div>
                    `
                    : ''
            }

            <div class='event-state ${event.state}'>
                ${event.state}
            </div>

        `;

        element.addEventListener('click', () => onSelect(event));

        element.addEventListener('keydown', eventKey => {
            if (
                eventKey.key === 'Enter' ||
                eventKey.key === ' '
            ) {

                eventKey.preventDefault();

                onSelect(event);

            }

        });

        container.appendChild(element);
    }
}