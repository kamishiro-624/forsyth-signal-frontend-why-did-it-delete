export function initializeSearch({eventSearch, locationSearch, locationResults, onEventSearch}) {
    const eventClear = eventSearch.parentElement.querySelector('.search-clear');
    const locationClear = locationSearch.parentElement.querySelector('.search-clear');
    let eventTimeout;

    eventSearch.addEventListener('input', () => {
        eventClear.hidden = !eventSearch.value;
        clearTimeout(eventTimeout);
        eventTimeout = setTimeout(() => onEventSearch(eventSearch.value), 100);
    });

    eventClear.addEventListener('click', () => {
        eventSearch.value = '';
        eventClear.hidden = true;
        clearTimeout(eventTimeout);
        onEventSearch('');
        eventSearch.focus();
    });

    let timeout;
    let activeController;
    locationSearch.addEventListener('input', () => {
        clearTimeout(timeout);
        if (activeController) {
            activeController.abort();
            activeController = null;
        }

        const query = locationSearch.value.trim();
        locationClear.hidden = !locationSearch.value;

        if (query.length < 3) {
            locationResults.innerHTML = '';
            return;
        }

        timeout = setTimeout(() => {
            activeController = new AbortController();
            searchLocation(query, locationResults, activeController.signal);
        }, 350);
    });

    locationClear.addEventListener('click', () => {
        locationSearch.value = '';
        locationClear.hidden = true;
        locationResults.innerHTML = '';
        clearTimeout(timeout);
        if (activeController) {
            activeController.abort();
            activeController = null;
        }
        locationSearch.focus();
    });
}

async function searchLocation(query, container, signal) {
    try {
        const url = 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=us&q=' + encodeURIComponent(query);
        const response = await fetch(url, {signal});

        if (!response.ok) {
            throw new Error(`Location search failed: ${response.status}`);
        }

        const results = await response.json();

        container.innerHTML = '';

        for (const result of results) {
            const element = document.createElement('div');

            element.className = 'location-result';
            element.textContent = result.display_name;

            element.addEventListener('click', () => {
                window.dispatchEvent(new CustomEvent('location-selected',
                    {
                        detail: {
                            latitude: Number(result.lat),
                            longitude: Number(result.lon),
                            name: result.display_name
                        }

                    }));

                container.innerHTML = '';
            });

            container.appendChild(element);
        }
    } catch (error) {
        if (error.name !== 'AbortError') {
            console.error('Location search failed:', error);
        }
    }
}