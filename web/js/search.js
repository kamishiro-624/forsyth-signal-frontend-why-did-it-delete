export function initializeSearch({eventSearch, locationSearch, locationResults, onEventSearch}) {
    eventSearch.addEventListener('input', () => {
            onEventSearch(eventSearch.value);
    });

    let timeout;

    locationSearch.addEventListener('input', () => {
        clearTimeout(timeout);
        
        const query = locationSearch.value.trim();

        if (query.length < 3) {
            locationResults.innerHTML = '';

            return;
        }

        timeout = setTimeout(() => {searchLocation(query, locationResults);}, 400);
    });
}

async function searchLocation(query, container) {
    try {
        const url = 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=us&q=' + encodeURIComponent(query);
        const response = await fetch(url);

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
        console.error('Location search failed:', error);
    }
}