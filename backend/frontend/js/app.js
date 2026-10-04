document.addEventListener('DOMContentLoaded', async () => {
  const routeForm = document.getElementById('routeSearchForm');
  const fromInput = document.getElementById('fromInput');
  const toInput = document.getElementById('toInput');
  const fromSuggestions = document.getElementById('fromSuggestions');
  const toSuggestions = document.getElementById('toSuggestions');
  const routeStatus = document.getElementById('routeStatus');
  const routeResult = document.getElementById('routeResult');
  const resultsBox = document.getElementById('stationResults');
  const popularStationsBox = document.getElementById('popularStations');
  const useLocationBtn = document.getElementById('useLocationBtn');
  const swapLocationsBtn = document.getElementById('swapLocationsBtn');
  const journeySection = document.getElementById('journeySection');
  const searchHint = document.getElementById('searchHint');
  const routeMapPanel = document.getElementById('routeMapPanel');
  const navToggle = document.querySelector('.nav-toggle');
  const mainNav = document.getElementById('mainNav');

  const state = {
    allStations: [],
    currentMap: null,
    currentMarkers: [],
    routePaths: [],
    searchId: 0,
    lastResult: null,
  };

  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);

  const hasCoordinates = (place) =>
    place?.latitude !== null && place?.latitude !== undefined &&
    place?.longitude !== null && place?.longitude !== undefined &&
    Number.isFinite(Number(place.latitude)) && Number.isFinite(Number(place.longitude));

  function setStatus(message, type = 'info') {
    if (!routeStatus) return;
    routeStatus.textContent = message || '';
    routeStatus.className = `route-status ${type}`;
  }

  function buildSuggestions(query) {
    const normalized = String(query || '').trim().toLowerCase();
    if (!normalized) return [];

    const directMatches = state.allStations.filter((station) =>
      [station.name, station.address].filter(Boolean).join(' ').toLowerCase().includes(normalized)
    );
    const matches = directMatches.length ? directMatches : state.allStations.filter((station) => {
      const searchText = [
        station.name,
        station.address,
        ...(station.destinations || []),
        ...(station.routes || []).flatMap((route) => [route.name, route.origin, route.destination]),
      ].filter(Boolean).join(' ').toLowerCase();
      return searchText.includes(normalized);
    });

    return [...new Map(matches.map((station) => [station.name, {
      name: station.name,
      detail: station.address || (station.transport_types || []).join(' · ') || 'Transport station',
    }])).values()].slice(0, 6);
  }

  function closeSuggestions(input, suggestions) {
    if (!input || !suggestions) return;
    suggestions.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
  }

  function renderSuggestions(input, suggestions) {
    if (!input || !suggestions) return;
    const options = buildSuggestions(input.value);
    suggestions.innerHTML = options.map((option, index) => `
      <button class="suggestion-option" type="button" role="option" id="${input.id}-option-${index}" data-value="${escapeHtml(option.name)}" aria-selected="false">
        <span class="suggestion-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></svg></span>
        <span class="suggestion-copy"><span class="suggestion-name">${escapeHtml(option.name)}</span><span class="suggestion-meta">${escapeHtml(option.detail)}</span></span>
      </button>
    `).join('');
    suggestions.hidden = options.length === 0;
    input.setAttribute('aria-expanded', String(options.length > 0));
    input.removeAttribute('aria-activedescendant');
  }

  function selectSuggestion(input, suggestions, option) {
    if (!option) return;
    input.value = option.dataset.value;
    closeSuggestions(input, suggestions);
    input.focus();
  }

  function moveSuggestionSelection(input, suggestions, direction) {
    const options = [...suggestions.querySelectorAll('[role="option"]')];
    if (!options.length) return;
    const selectedIndex = options.findIndex((option) => option.getAttribute('aria-selected') === 'true');
    const nextIndex = selectedIndex < 0
      ? (direction > 0 ? 0 : options.length - 1)
      : (selectedIndex + direction + options.length) % options.length;
    options.forEach((option, index) => option.setAttribute('aria-selected', String(index === nextIndex)));
    input.setAttribute('aria-activedescendant', options[nextIndex].id);
  }

  function connectAutocomplete(input, suggestions) {
    if (!input || !suggestions) return;
    input.addEventListener('input', () => renderSuggestions(input, suggestions));
    input.addEventListener('focus', () => renderSuggestions(input, suggestions));
    input.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        if (suggestions.hidden) renderSuggestions(input, suggestions);
        moveSuggestionSelection(input, suggestions, event.key === 'ArrowDown' ? 1 : -1);
      } else if (event.key === 'Enter' && !suggestions.hidden) {
        const activeOption = suggestions.querySelector('[aria-selected="true"]');
        if (activeOption) {
          event.preventDefault();
          selectSuggestion(input, suggestions, activeOption);
        }
      } else if (event.key === 'Escape') {
        closeSuggestions(input, suggestions);
      }
    });
    input.addEventListener('blur', () => window.setTimeout(() => closeSuggestions(input, suggestions), 120));
    suggestions.addEventListener('pointerdown', (event) => event.preventDefault());
    suggestions.addEventListener('click', (event) => {
      const option = event.target.closest('[role="option"]');
      if (option) selectSuggestion(input, suggestions, option);
    });
  }

  function renderPopularStations(stations) {
    if (!popularStationsBox) return;

    const top = stations.slice(0, 6);
    popularStationsBox.innerHTML = top.map((station) => `
      <article class="popular-card">
        <h3>${escapeHtml(station.name)}</h3>
        <div class="station-info">${escapeHtml(station.address || 'Addis Ababa')}</div>
        <div class="chip-row">
          ${(station.transport_types || []).slice(0, 3).map((type) => `<span class="chip">${escapeHtml(type)}</span>`).join('')}
          ${(station.routes || []).slice(0, 2).map((route) => `<span class="chip">${escapeHtml(route.name)}</span>`).join('')}
        </div>
        <div class="result-footer">
          <a href="/station.html?id=${encodeURIComponent(station.id)}">View details</a>
          ${hasCoordinates(station) ? `<a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${station.latitude},${station.longitude}`)}" target="_blank" rel="noreferrer">Directions</a>` : ''}
        </div>
      </article>
    `).join('');
  }

  function renderRouteResult(data) {
    if (!routeResult) return;

    if (!data || !data.routes || !data.routes.length) {
      routeResult.innerHTML = `
        <div class="route-empty">
          <div class="empty-route-illustration" aria-hidden="true">
            <svg viewBox="0 0 64 64"><circle cx="28" cy="28" r="17"/><path d="m41 41 12 12M21 28h14m-7-7v14"/></svg>
          </div>
          <h3>No route found</h3>
          <p>We couldn’t find a transport route between <strong>${escapeHtml(fromInput.value || data?.from?.label || 'these locations')}</strong> and <strong>${escapeHtml(toInput.value || data?.to?.label || 'your destination')}</strong>. Try another station or destination.</p>
        </div>
      `;
      return;
    }

    routeResult.innerHTML = `
      <div class="journey-summary">
        <h2>Your journey</h2>
        <div class="journey-endpoints">
          <div class="journey-step">
            <span class="step-dot start"></span>
            <div>
              <strong>Starting point</strong>
              <p>${escapeHtml(data.from?.label || 'Starting location')}</p>
            </div>
          </div>
          <div class="journey-step">
            <span class="step-dot destination"></span>
            <div>
              <strong>Destination</strong>
              <p>${escapeHtml(data.to?.label || 'Destination')}</p>
            </div>
          </div>
        </div>
      </div>

      <div class="route-options">
        ${data.routes.map((option, index) => {
          const stations = Array.isArray(option.stations) ? option.stations : [];
          return `
          <article class="route-option">
            <div class="route-option-header">
              <span class="route-badge">Route option ${index + 1}</span>
              <span class="route-criteria">${escapeHtml(option.criteria || 'Recommended')}</span>
            </div>
            <h3>${escapeHtml(option.routeName || `Route ${index + 1}`)}</h3>
            <div class="route-meta">
              <span><svg class="transport-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 17V6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5V17M5 10h14M7 20v-3m10 3v-3M7.5 17h9"/><circle cx="8" cy="14" r="1"/><circle cx="16" cy="14" r="1"/></svg>${escapeHtml(option.transportType || 'Transport type unavailable')}</span>
              <span>${stations.length} ${stations.length === 1 ? 'station' : 'stations'}</span>
            </div>
            ${option.summary ? `<p class="route-summary-text">${escapeHtml(option.summary)}</p>` : ''}
            ${option.description ? `<p class="route-description">${escapeHtml(option.description)}</p>` : ''}
            <h4 class="stops-heading">Stations along this route</h4>
            ${stations.length ? `
              <ol class="route-stops">
                ${stations.map((station) => `
                  <li>
                    <span class="stop-name">${escapeHtml(station.name || 'Unnamed station')}</span>
                    ${station.address ? `<span class="stop-address">${escapeHtml(station.address)}</span>` : ''}
                  </li>
                `).join('')}
              </ol>
            ` : '<p class="route-description">Station details are not available for this route yet.</p>'}
            <button class="view-route-button" type="button" data-route-index="${index}">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></svg>
              View route on map
            </button>
          </article>
        `;
        }).join('')}
      </div>
    `;
  }

  function renderStationResults(data) {
    if (!resultsBox) return;

    const matchingStations = (data.routes || []).flatMap((route) =>
      (route.stations || []).map((station) => ({
        ...station,
        routeName: route.routeName,
        transportType: route.transportType,
      }))
    );

    if (!matchingStations.length) {
      resultsBox.innerHTML = '<div class="result-card empty">No relevant stations available for this route yet.</div>';
      return;
    }

    const uniqueStations = [...new Map(matchingStations.map((station) => [
      `${station.id ?? ''}:${station.name}:${station.latitude ?? ''}:${station.longitude ?? ''}`,
      station,
    ])).values()];

    resultsBox.innerHTML = uniqueStations.map((station) => `
      <article class="result-card">
        <h3>${escapeHtml(station.name || 'Unnamed station')}</h3>
        ${station.address ? `<div class="result-meta">${escapeHtml(station.address)}</div>` : ''}
        <div class="result-meta">${escapeHtml(station.routeName || 'Route')} · ${escapeHtml(station.transportType || 'Transport type unavailable')}</div>
        <div class="result-footer">
          ${station.id != null ? `<a href="/station.html?id=${encodeURIComponent(station.id)}">View details</a>` : ''}
          ${hasCoordinates(station) ? `<a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${station.latitude},${station.longitude}`)}" target="_blank" rel="noreferrer">Directions</a>` : ''}
        </div>
      </article>
    `).join('');
  }

  function clearMapLayers() {
    if (!state.currentMap) return;

    state.currentMarkers.forEach((marker) => state.currentMap.removeLayer(marker));
    state.currentMarkers = [];

    state.routePaths.forEach((path) => state.currentMap.removeLayer(path));
    state.routePaths = [];
  }

  function renderRouteMap(data) {
    if (!state.currentMap) return;

    clearMapLayers();
    routeMapPanel.hidden = !data?.routes?.length;
    if (routeMapPanel.hidden) return;

    const pathPoints = [];

    if (hasCoordinates(data.from)) {
      const startMarker = L.circleMarker([data.from.latitude, data.from.longitude], {
        radius: 9,
        color: '#22c55e',
        fillColor: '#22c55e',
        fillOpacity: 0.95,
      }).addTo(state.currentMap);
      startMarker.bindPopup(`<div><strong>Starting point</strong><br/>${escapeHtml(data.from.label)}</div>`);
      state.currentMarkers.push(startMarker);
      pathPoints.push([data.from.latitude, data.from.longitude]);
    }

    const routeColors = ['#176b4b', '#4b8d62', '#78a77d', '#32775a'];
    const plottedStations = new Set();
    const originKey = hasCoordinates(data.from) ? `${Number(data.from.latitude)},${Number(data.from.longitude)}` : null;
    const destinationKey = hasCoordinates(data.to) ? `${Number(data.to.latitude)},${Number(data.to.longitude)}` : null;
    (data.routes || []).forEach((route, index) => {
      const routeStations = (route.stations || []).filter(hasCoordinates);
      const linePoints = [];

      if (hasCoordinates(data.from)) linePoints.push([Number(data.from.latitude), Number(data.from.longitude)]);
      routeStations.forEach((station) => {
        const coordinates = [Number(station.latitude), Number(station.longitude)];
        linePoints.push(coordinates);
        pathPoints.push(coordinates);
        const key = `${station.id ?? ''}:${coordinates.join(',')}`;
        const isEndpoint = coordinates.join(',') === originKey || coordinates.join(',') === destinationKey;
        if (!isEndpoint && !plottedStations.has(key)) {
          plottedStations.add(key);
          const marker = window.transportMap.addStationMarker(state.currentMap, station, {
            color: routeColors[index % routeColors.length],
            popupTitle: station.name,
          });
          state.currentMarkers.push(marker);
        }
      });
      if (hasCoordinates(data.to)) linePoints.push([Number(data.to.latitude), Number(data.to.longitude)]);
      if (linePoints.length > 1) {
        const routePath = window.transportMap.addRoutePath(
          state.currentMap,
          linePoints,
          routeColors[index % routeColors.length]
        );
        if (routePath) state.routePaths.push(routePath);
      }
    });

    if (hasCoordinates(data.to)) {
      const destinationMarker = L.circleMarker([data.to.latitude, data.to.longitude], {
        radius: 9,
        color: '#ef4444',
        fillColor: '#ef4444',
        fillOpacity: 0.9,
      }).addTo(state.currentMap);
      destinationMarker.bindPopup(`<div><strong>Destination</strong><br/>${escapeHtml(data.to.label)}</div>`);
      state.currentMarkers.push(destinationMarker);
      pathPoints.push([data.to.latitude, data.to.longitude]);
    }

    window.requestAnimationFrame(() => {
      state.currentMap.invalidateSize({ pan: false });
      if (pathPoints.length > 1) {
        const bounds = L.latLngBounds(pathPoints);
        state.currentMap.fitBounds(bounds, { padding: [34, 34] });
      }
    });
  }

  function focusRouteOnMap(routeIndex) {
    const route = state.lastResult?.routes?.[routeIndex];
    if (!route || !state.currentMap || !routeMapPanel || routeMapPanel.hidden) return;

    const points = [];
    const addPoint = (place) => {
      if (hasCoordinates(place)) points.push([Number(place.latitude), Number(place.longitude)]);
    };
    addPoint(state.lastResult.from);
    (route.stations || []).forEach(addPoint);
    addPoint(state.lastResult.to);
    if (points.length) {
      state.currentMap.invalidateSize({ pan: false });
      state.currentMap.fitBounds(L.latLngBounds(points), { padding: [42, 42], maxZoom: 15 });
      routeMapPanel.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  async function handleRouteSearch(event) {
    event.preventDefault();

    const from = fromInput.value.trim();
    const to = toInput.value.trim();

    if (!from || !to) {
      setStatus('Please add both a starting point and a destination.', 'error');
      (from ? toInput : fromInput).focus();
      return;
    }

    const searchId = ++state.searchId;
    const submitButton = routeForm.querySelector('[type="submit"]');
    const submitLabel = submitButton?.querySelector('span');
    if (submitButton) {
      submitButton.disabled = true;
      submitLabel.textContent = 'Finding route...';
    }
    journeySection.hidden = false;
    searchHint.hidden = true;
    routeMapPanel.hidden = true;
    routeResult.innerHTML = '<div class="route-loading" role="status"><span class="loading-mark-wrap" aria-hidden="true"><img src="assets/fermata-mark.svg" alt="" /></span><span>Finding your route…</span></div>';
    if (resultsBox) resultsBox.innerHTML = '';
    clearMapLayers();

    try {
      setStatus('Searching available routes…', 'info');
      const result = await window.transportApi.searchRoute(from, to);
      if (searchId !== state.searchId) return;
      state.lastResult = result;
      renderRouteResult(result);
      renderStationResults(result);
      renderRouteMap(result);

      if (result && result.routes && result.routes.length) {
        setStatus(`${result.routes.length} ${result.routes.length === 1 ? 'route option' : 'route options'} found.`, 'success');
      } else {
        setStatus('No routes found. Try another station or destination.', 'info');
      }
      journeySection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (error) {
      if (searchId !== state.searchId) return;
      state.lastResult = null;
      routeResult.innerHTML = `
        <div class="route-empty route-error" role="alert">
          <div class="empty-route-illustration" aria-hidden="true">
            <svg viewBox="0 0 64 64"><circle cx="28" cy="28" r="17"/><path d="m41 41 12 12M21 28h14m-7-7v14"/></svg>
          </div>
          <h3>Route search is temporarily unavailable</h3>
          <p>Please check your connection and try again in a moment.</p>
        </div>
      `;
      routeMapPanel.hidden = true;
      setStatus('Unable to find a route right now. Please try again.', 'error');
      console.error(error);
      journeySection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } finally {
      if (searchId === state.searchId && submitButton) {
        submitButton.disabled = false;
        submitLabel.textContent = 'Find Route';
      }
    }
  }

  async function initializeHomePage() {
    if (!document.getElementById('map')) return;

    state.currentMap = window.transportMap.buildMap('map');
    connectAutocomplete(fromInput, fromSuggestions);
    connectAutocomplete(toInput, toSuggestions);

    try {
      const result = await window.transportApi.getStations();
      state.allStations = result.data || [];
      renderPopularStations(state.allStations);

    } catch (error) {
      setStatus('Station suggestions could not be loaded. You can still search by entering both locations.', 'info');
      console.error(error);
    }
  }

  async function useUserLocation() {
    if (!navigator.geolocation) {
      setStatus('Your browser does not support location access.', 'error');
      return;
    }

    const locationLabel = useLocationBtn.querySelector('span');
    useLocationBtn.disabled = true;
    locationLabel.textContent = 'Locating...';

    navigator.geolocation.getCurrentPosition(async (position) => {
      const { latitude, longitude } = position.coords;
      useLocationBtn.disabled = false;
      locationLabel.textContent = 'Use my location';

      try {
        const nearest = await window.transportApi.getNearbyStations(latitude, longitude);
        const firstNearby = nearest.data && nearest.data[0];

        fromInput.value = firstNearby ? firstNearby.name : 'Current location';

        if (state.currentMap) {
          const userMarker = L.circleMarker([latitude, longitude], {
            radius: 8,
            color: '#16a34a',
            fillColor: '#16a34a',
            fillOpacity: 0.9,
          }).addTo(state.currentMap);
          userMarker.bindPopup('<div><strong>Your current location</strong></div>');
          state.currentMarkers.push(userMarker);
          state.currentMap.setView([latitude, longitude], 13);
        }

        closeSuggestions(fromInput, fromSuggestions);
        setStatus('Location found. Add a destination and find a route.', 'success');
      } catch (error) {
        setStatus('Your location was found, but nearby stations could not be loaded.', 'error');
        console.error(error);
      }
    }, (error) => {
      useLocationBtn.disabled = false;
      locationLabel.textContent = 'Use my location';
      setStatus(error.code === error.PERMISSION_DENIED ? 'Location permission was not granted.' : 'Could not determine your location. Please try again.', 'error');
    }, {
      enableHighAccuracy: true,
      timeout: 10000,
    });
  }

  if (routeForm) {
    routeForm.addEventListener('submit', handleRouteSearch);
  }

  if (useLocationBtn) {
    useLocationBtn.addEventListener('click', useUserLocation);
  }

  if (swapLocationsBtn) {
    swapLocationsBtn.addEventListener('click', () => {
      const from = fromInput.value;
      fromInput.value = toInput.value;
      toInput.value = from;
      closeSuggestions(fromInput, fromSuggestions);
      closeSuggestions(toInput, toSuggestions);
      fromInput.focus();
    });
  }

  if (routeResult) {
    routeResult.addEventListener('click', (event) => {
      const routeButton = event.target.closest('[data-route-index]');
      if (routeButton) focusRouteOnMap(Number(routeButton.dataset.routeIndex));
    });
  }

  if (navToggle && mainNav) {
    navToggle.addEventListener('click', () => {
      const isOpen = mainNav.classList.toggle('open');
      navToggle.setAttribute('aria-expanded', String(isOpen));
      navToggle.setAttribute('aria-label', isOpen ? 'Close navigation' : 'Open navigation');
    });
  }

  initializeHomePage();
});
