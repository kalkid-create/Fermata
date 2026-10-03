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

  const state = {
    allStations: [],
    currentMap: null,
    currentMarkers: [],
    routePath: null,
  };

  function setStatus(message, type = 'info') {
    if (!routeStatus) return;
    routeStatus.textContent = message || '';
    routeStatus.className = `route-status ${type}`;
  }

  function buildSuggestions(query) {
    const normalized = String(query || '').trim().toLowerCase();
    if (!normalized) return [];

    const values = new Set();
    state.allStations.forEach((station) => {
      const entries = [
        station.name,
        station.address,
        station.address.split(',')[0],
        ...(station.destinations || []),
        ...(station.routes || []).flatMap((route) => [route.name, route.origin, route.destination]),
      ];

      entries.forEach((entry) => {
        if (entry && entry.toLowerCase().includes(normalized)) {
          values.add(entry.trim());
        }
      });
    });

    return [...values].slice(0, 8);
  }

  function syncSuggestions() {
    if (!fromSuggestions || !toSuggestions) return;

    const fromOptions = buildSuggestions(fromInput.value);
    const toOptions = buildSuggestions(toInput.value);

    fromSuggestions.innerHTML = fromOptions.map((value) => `<option value="${value}"></option>`).join('');
    toSuggestions.innerHTML = toOptions.map((value) => `<option value="${value}"></option>`).join('');
  }

  function renderPopularStations(stations) {
    if (!popularStationsBox) return;

    const top = stations.slice(0, 6);
    popularStationsBox.innerHTML = top.map((station) => `
      <article class="popular-card">
        <h3>${station.name}</h3>
        <div class="station-info">${station.address}</div>
        <div class="chip-row">
          ${(station.transport_types || []).slice(0, 3).map((type) => `<span class="chip">${type}</span>`).join('')}
          ${(station.routes || []).slice(0, 2).map((route) => `<span class="chip">${route.name}</span>`).join('')}
        </div>
        <div class="result-footer">
          <a href="/station.html?id=${station.id}">View details</a>
          <a href="https://www.google.com/maps/search/?api=1&query=${station.latitude},${station.longitude}" target="_blank" rel="noreferrer">Directions</a>
        </div>
      </article>
    `).join('');
  }

  function renderRouteResult(data) {
    if (!routeResult) return;

    if (!data || !data.routes || !data.routes.length) {
      routeResult.innerHTML = `
        <div class="route-empty">
          <h3>We don't have enough route information for this journey yet.</h3>
          <p>FERMATA can only recommend routes that match the station and route data available in the app.</p>
        </div>
      `;
      return;
    }

    const firstRoute = data.routes[0];
    routeResult.innerHTML = `
      <div class="journey-summary">
        <h2>Route from ${data.from.label} to ${data.to.label}</h2>
        <div class="journey-steps">
          <div class="journey-step">
            <span class="step-dot start"></span>
            <div>
              <strong>Starting point</strong>
              <p>${data.from.label}</p>
            </div>
          </div>

          <div class="journey-step">
            <span class="step-dot station"></span>
            <div>
              <strong>Recommended station</strong>
              <p>${firstRoute.stations[0]?.name || 'Nearby station'}</p>
            </div>
          </div>

          <div class="journey-step">
            <span class="step-dot route"></span>
            <div>
              <strong>Transport</strong>
              <p>${firstRoute.transportType}</p>
            </div>
          </div>

          <div class="journey-step">
            <span class="step-dot destination"></span>
            <div>
              <strong>Destination station</strong>
              <p>${firstRoute.stations[firstRoute.stations.length - 1]?.name || data.to.label}</p>
            </div>
          </div>
        </div>
      </div>

      <div class="route-options">
        ${data.routes.map((option, index) => `
          <article class="route-option">
            <div class="route-option-header">
              <span class="route-badge">Route option ${index + 1}</span>
              <span class="route-criteria">${option.criteria}</span>
            </div>
            <h3>${option.routeName}</h3>
            <div class="route-meta">
              <span>🚌 ${option.transportType}</span>
              <span>${option.stations.length} stations</span>
            </div>
            <p>${option.summary}</p>
          </article>
        `).join('')}
      </div>
    `;
  }

  function renderStationResults(data) {
    if (!resultsBox) return;

    const matchingStations = (data.routes || []).flatMap((route) =>
      route.stations.map((station) => ({
        ...station,
        routeName: route.routeName,
      }))
    );

    if (!matchingStations.length) {
      resultsBox.innerHTML = '<div class="result-card empty">No relevant stations available for this route yet.</div>';
      return;
    }

    resultsBox.innerHTML = matchingStations.map((station) => `
      <article class="result-card">
        <h3>${station.name}</h3>
        <div class="result-meta">${station.address}</div>
        <div class="result-meta">${station.routeName}</div>
        <div class="result-footer">
          <a href="/station.html?id=${station.id}">View details</a>
          <a href="https://www.google.com/maps/search/?api=1&query=${station.latitude},${station.longitude}" target="_blank" rel="noreferrer">Directions</a>
        </div>
      </article>
    `).join('');
  }

  function clearMapLayers() {
    if (!state.currentMap) return;

    state.currentMarkers.forEach((marker) => state.currentMap.removeLayer(marker));
    state.currentMarkers = [];

    if (state.routePath) {
      state.currentMap.removeLayer(state.routePath);
      state.routePath = null;
    }
  }

  function renderRouteMap(data) {
    if (!state.currentMap) return;

    clearMapLayers();

    const pathPoints = [];

    if (data.from.latitude && data.from.longitude) {
      const startMarker = L.circleMarker([data.from.latitude, data.from.longitude], {
        radius: 9,
        color: '#22c55e',
        fillColor: '#22c55e',
        fillOpacity: 0.95,
      }).addTo(state.currentMap);
      startMarker.bindPopup(`<div><strong>Starting point</strong><br/>${data.from.label}</div>`);
      state.currentMarkers.push(startMarker);
      pathPoints.push([data.from.latitude, data.from.longitude]);
    }

    const routeStations = data.routes?.[0]?.stations || [];
    routeStations.forEach((station) => {
      const marker = window.transportMap.addStationMarker(state.currentMap, station, {
        color: '#2563eb',
        popupTitle: station.name,
      });
      state.currentMarkers.push(marker);
      pathPoints.push([station.latitude, station.longitude]);
    });

    if (data.to.latitude && data.to.longitude) {
      const destinationMarker = L.circleMarker([data.to.latitude, data.to.longitude], {
        radius: 9,
        color: '#ef4444',
        fillColor: '#ef4444',
        fillOpacity: 0.9,
      }).addTo(state.currentMap);
      destinationMarker.bindPopup(`<div><strong>Destination</strong><br/>${data.to.label}</div>`);
      state.currentMarkers.push(destinationMarker);
      pathPoints.push([data.to.latitude, data.to.longitude]);
    }

    if (routeStations.length > 1) {
      state.routePath = window.transportMap.addRoutePath(
        state.currentMap,
        routeStations.map((station) => [station.latitude, station.longitude]),
        '#22c55e'
      );
    }

    if (pathPoints.length > 1) {
      const bounds = L.latLngBounds(pathPoints);
      state.currentMap.fitBounds(bounds, { padding: [40, 40] });
    }
  }

  async function handleRouteSearch(event) {
    event.preventDefault();

    const from = fromInput.value.trim();
    const to = toInput.value.trim();

    if (!from || !to) {
      setStatus('Please add both a starting point and a destination.', 'error');
      return;
    }

    try {
      setStatus('Finding the most relevant route...', 'info');
      const result = await window.transportApi.searchRoute(from, to);
      renderRouteResult(result);
      renderStationResults(result);
      renderRouteMap(result);

      if (result && result.routes && result.routes.length) {
        setStatus('Route options ready.', 'success');
      } else {
        setStatus(result?.message || "We don't have enough route information for this journey yet.", 'error');
      }
    } catch (error) {
      setStatus('Unable to find a route right now. Please try again.', 'error');
      console.error(error);
    }
  }

  async function initializeHomePage() {
    if (!document.getElementById('map')) return;

    state.currentMap = window.transportMap.buildMap('map');

    try {
      const result = await window.transportApi.getStations();
      state.allStations = result.data || [];
      renderPopularStations(state.allStations);

      fromInput.value = 'Bole';
      toInput.value = 'Piazza';
      syncSuggestions();
      handleRouteSearch({ preventDefault() {} });

      fromInput.addEventListener('input', syncSuggestions);
      toInput.addEventListener('input', syncSuggestions);
    } catch (error) {
      setStatus('Could not load the route data.', 'error');
      console.error(error);
    }
  }

  async function useUserLocation() {
    if (!navigator.geolocation) {
      setStatus('Your browser does not support location access.', 'error');
      return;
    }

    useLocationBtn.disabled = true;
    useLocationBtn.textContent = 'Locating...';

    navigator.geolocation.getCurrentPosition(async (position) => {
      const { latitude, longitude } = position.coords;
      useLocationBtn.disabled = false;
      useLocationBtn.textContent = 'Use my location';

      const nearest = await window.transportApi.getNearbyStations(latitude, longitude);
      const firstNearby = nearest.data && nearest.data[0];

      if (firstNearby) {
        fromInput.value = firstNearby.name;
      } else {
        fromInput.value = 'Current location';
      }

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

      syncSuggestions();
      setStatus('Location found. Searching for nearby route options.', 'success');
    }, () => {
      useLocationBtn.disabled = false;
      useLocationBtn.textContent = 'Use my location';
      setStatus('Location permission was not granted.', 'error');
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

  initializeHomePage();
});
