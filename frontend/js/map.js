(function () {
  const defaultCenter = [9.0227, 38.7468];

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

    const routeNames = (station.routes || []).map((route) => route.name).join(', ') || 'No route list';
    const types = (station.transport_types || []).join(', ') || 'Unknown';

    marker.bindPopup(`
      <div>
        <h3>${popupTitle || station.name}</h3>
        <p><strong>Transport:</strong> ${types}</p>
        <p><strong>Routes:</strong> ${routeNames}</p>
        <p>${station.address}</p>
        <div>
          <a href="/station.html?id=${station.id}" class="popup-link">View Details</a>
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
