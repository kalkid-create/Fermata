(function () {
  const apiBaseUrl = window.APP_CONFIG && window.APP_CONFIG.apiBaseUrl ? window.APP_CONFIG.apiBaseUrl : 'http://localhost:5000/api';

  async function fetchJson(url) {
    const response = await fetch(url, { headers: { Accept: 'application/json' } });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.message || 'Request failed');
    }

    return response.json();
  }

  async function getStations() {
    return fetchJson(`${apiBaseUrl}/stations`);
  }

  async function getStationById(id) {
    return fetchJson(`${apiBaseUrl}/stations/${id}`);
  }

  async function searchStations(query, filters = []) {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (filters.length) params.set('filters', filters.join(','));
    return fetchJson(`${apiBaseUrl}/stations/search?${params.toString()}`);
  }

  async function searchRoute(from, to) {
    const params = new URLSearchParams({ from, to });
    return fetchJson(`${apiBaseUrl}/search-route?${params.toString()}`);
  }

  async function getNearbyStations(lat, lng) {
    const params = new URLSearchParams({ lat: String(lat), lng: String(lng) });
    return fetchJson(`${apiBaseUrl}/stations/nearby?${params.toString()}`);
  }

  async function getTransportTypes() {
    return fetchJson(`${apiBaseUrl}/transport-types`);
  }

  async function getRoutes() {
    return fetchJson(`${apiBaseUrl}/routes`);
  }

  function formatDistance(distanceKm) {
    if (!Number.isFinite(distanceKm)) {
      return 'Unknown';
    }
    return `${distanceKm.toFixed(2)} km away`;
  }

  window.transportApi = {
    getStations,
    getStationById,
    searchStations,
    searchRoute,
    getNearbyStations,
    getTransportTypes,
    getRoutes,
    formatDistance,
  };
})();
