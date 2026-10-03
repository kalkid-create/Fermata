(function () {
  const defaultCenter = [9.0227, 38.7468];
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);

  function buildMap(targetId = 'map') {
    const map = L.map(targetId, {
      zoomControl: true,
      scrollWheelZoom: true,
    }).setView(defaultCenter, 12);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    return map;
  }

  function addStationMarker(map, station, options = {}) {
    const { color = '#1f8d56', popupTitle = station.name } = options;
    const marker = L.circleMarker([station.latitude, station.longitude], {
      radius: 8,
      color,
      fillColor: color,
      fillOpacity: 0.9,
    }).addTo(map);

    const routeNames = escapeHtml((station.routes || []).map((route) => route.name).join(', ') || 'No route list');
    const types = escapeHtml((station.transport_types || []).join(', ') || 'Unknown');

    marker.bindPopup(`
      <div>
        <h3>${escapeHtml(popupTitle || station.name)}</h3>
        <p><strong>Transport:</strong> ${types}</p>
        <p><strong>Routes:</strong> ${routeNames}</p>
        <p>${escapeHtml(station.address || '')}</p>
        <div>
          ${station.id != null ? `<a href="/station.html?id=${encodeURIComponent(station.id)}" class="popup-link">View Details</a>` : ''}
          <a href="https://www.google.com/maps/search/?api=1&query=${station.latitude},${station.longitude}" target="_blank" rel="noreferrer" class="popup-link">Get Directions</a>
        </div>
      </div>
    `);

    return marker;
  }

  function addRoutePath(map, points, color = '#22c55e') {
    if (!points || points.length < 2) return null;
    return L.polyline(points, {
      color,
      weight: 5,
      opacity: 0.8,
      lineCap: 'round',
      lineJoin: 'round',
    }).addTo(map);
  }

  window.transportMap = {
    buildMap,
    addStationMarker,
    addRoutePath,
    defaultCenter,
  };
})();
