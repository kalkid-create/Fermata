document.addEventListener('DOMContentLoaded', async () => {
  const loginPanel = document.getElementById('loginPanel');
  const dashboard = document.getElementById('adminDashboard');
  const loginForm = document.getElementById('adminLoginForm');
  const loginMessage = document.getElementById('loginMessage');
  const stationForm = document.getElementById('stationForm');
  const routeForm = document.getElementById('routeForm');
  const stationTypeList = document.getElementById('stationTypeList');
  const routeList = document.getElementById('routeList');
  const stationsTable = document.getElementById('stationsTable');
  const routesTable = document.getElementById('routesTable');
  const apiBaseUrl = window.APP_CONFIG && window.APP_CONFIG.apiBaseUrl ? window.APP_CONFIG.apiBaseUrl : 'http://localhost:5000/api';

  const state = {
    token: localStorage.getItem('adminToken') || '',
    stations: [],
    routes: [],
    transportTypes: [],
  };

  function authHeaders() {
    return {
      'Content-Type': 'application/json',
      Authorization: state.token ? `Bearer ${state.token}` : '',
    };
  }

  async function fetchJson(url, options = {}) {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...(options.headers || {}),
      },
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.message || 'Request failed');
    }

    return data;
  }

  function updateLoginState() {
    if (state.token) {
      loginPanel.classList.add('hidden');
      dashboard.classList.remove('hidden');
    } else {
      loginPanel.classList.remove('hidden');
      dashboard.classList.add('hidden');
    }
  }

  function showMessage(element, message, isError = false) {
    element.textContent = message;
    element.style.color = isError ? '#dc2626' : '#0f766e';
  }

  function renderTypeCheckboxes() {
    stationTypeList.innerHTML = state.transportTypes.map((type) => `
      <label class="checkbox-item">
        <input type="checkbox" name="transport_type_ids" value="${type.id}" />
        <span>${type.name}</span>
      </label>
    `).join('');
  }

  function renderRouteCheckboxes() {
    routeList.innerHTML = state.routes.map((route) => `
      <label class="checkbox-item">
        <input type="checkbox" name="route_ids" value="${route.id}" />
        <span>${route.name}</span>
      </label>
    `).join('');
  }

  function renderStationsTable() {
    if (!state.stations.length) {
      stationsTable.innerHTML = '<div class="empty-state">No stations available.</div>';
      return;
    }

    stationsTable.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Address</th>
            <th>Types</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${state.stations.map((station) => `
            <tr>
              <td>${station.name}</td>
              <td>${station.address}</td>
              <td>${(station.transport_type_ids || []).join(', ') || '—'}</td>
              <td class="actions">
                <button class="secondary-btn" data-action="edit-station" data-id="${station.id}">Edit</button>
                <button class="delete-btn" data-action="delete-station" data-id="${station.id}">Delete</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    stationsTable.querySelectorAll('[data-action="edit-station"]').forEach((button) => {
      button.addEventListener('click', () => loadStationIntoForm(Number(button.dataset.id)));
    });

    stationsTable.querySelectorAll('[data-action="delete-station"]').forEach((button) => {
      button.addEventListener('click', () => deleteStation(Number(button.dataset.id)));
    });
  }

  function renderRoutesTable() {
    if (!state.routes.length) {
      routesTable.innerHTML = '<div class="empty-state">No routes available.</div>';
      return;
    }

    routesTable.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Origin</th>
            <th>Destination</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${state.routes.map((route) => `
            <tr>
              <td>${route.name}</td>
              <td>${route.origin}</td>
              <td>${route.destination}</td>
              <td class="actions">
                <button class="secondary-btn" data-action="edit-route" data-id="${route.id}">Edit</button>
                <button class="delete-btn" data-action="delete-route" data-id="${route.id}">Delete</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    routesTable.querySelectorAll('[data-action="edit-route"]').forEach((button) => {
      button.addEventListener('click', () => loadRouteIntoForm(Number(button.dataset.id)));
    });

    routesTable.querySelectorAll('[data-action="delete-route"]').forEach((button) => {
      button.addEventListener('click', () => deleteRoute(Number(button.dataset.id)));
    });
  }

  function resetStationForm() {
    stationForm.reset();
    stationForm.querySelector('[name="stationId"]').value = '';
    stationForm.querySelectorAll('input[name="transport_type_ids"]').forEach((box) => { box.checked = false; });
    stationForm.querySelectorAll('input[name="route_ids"]').forEach((box) => { box.checked = false; });
  }

  function resetRouteForm() {
    routeForm.reset();
    routeForm.querySelector('[name="routeId"]').value = '';
  }

  function loadStationIntoForm(stationId) {
    const station = state.stations.find((item) => item.id === stationId);
    if (!station) return;

    stationForm.querySelector('[name="stationId"]').value = station.id;
    stationForm.querySelector('[name="name"]').value = station.name;
    stationForm.querySelector('[name="address"]').value = station.address;
    stationForm.querySelector('[name="latitude"]').value = station.latitude;
    stationForm.querySelector('[name="longitude"]').value = station.longitude;
    stationForm.querySelector('[name="description"]').value = station.description || '';
    stationForm.querySelector('[name="operating_hours"]').value = station.operating_hours || '';

    stationForm.querySelectorAll('input[name="transport_type_ids"]').forEach((box) => {
      box.checked = (station.transport_type_ids || []).includes(Number(box.value));
    });

    stationForm.querySelectorAll('input[name="route_ids"]').forEach((box) => {
      box.checked = (station.route_ids || []).includes(Number(box.value));
    });

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function loadRouteIntoForm(routeId) {
    const route = state.routes.find((item) => item.id === routeId);
    if (!route) return;

    routeForm.querySelector('[name="routeId"]').value = route.id;
    routeForm.querySelector('[name="name"]').value = route.name;
    routeForm.querySelector('[name="origin"]').value = route.origin;
    routeForm.querySelector('[name="destination"]').value = route.destination;
    routeForm.querySelector('[name="description"]').value = route.description || '';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function loadAdminData() {
    if (!state.token) return;

    try {
      const [stationsResponse, routesResponse, typesResponse] = await Promise.all([
        fetchJson(`${apiBaseUrl}/admin/stations`, { headers: authHeaders() }),
        fetchJson(`${apiBaseUrl}/admin/routes`, { headers: authHeaders() }),
        fetchJson(`${apiBaseUrl}/admin/transport-types`, { headers: authHeaders() }),
      ]);

      state.stations = stationsResponse.data || [];
      state.routes = routesResponse.data || [];
      state.transportTypes = typesResponse.data || [];

      renderTypeCheckboxes();
      renderRouteCheckboxes();
      renderStationsTable();
      renderRoutesTable();
    } catch (error) {
      showMessage(loginMessage, error.message, true);
    }
  }

  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(loginForm);
    const username = formData.get('username');
    const password = formData.get('password');

    try {
      const response = await fetch(`${apiBaseUrl}/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Login failed');
      }

      state.token = data.token;
      localStorage.setItem('adminToken', state.token);
      updateLoginState();
      await loadAdminData();
      showMessage(loginMessage, 'Admin login successful.');
    } catch (error) {
      showMessage(loginMessage, error.message, true);
    }
  });

  stationForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const data = new FormData(stationForm);
    const stationId = data.get('stationId');
    const payload = {
      name: data.get('name'),
      address: data.get('address'),
      latitude: Number(data.get('latitude')),
      longitude: Number(data.get('longitude')),
      description: data.get('description') || '',
      operating_hours: data.get('operating_hours') || '',
      transport_type_ids: Array.from(stationForm.querySelectorAll('input[name="transport_type_ids"]:checked')).map((input) => Number(input.value)),
      route_ids: Array.from(stationForm.querySelectorAll('input[name="route_ids"]:checked')).map((input) => Number(input.value)),
      destinations: [data.get('address')],
    };

    try {
      const url = stationId ? `${apiBaseUrl}/admin/stations/${stationId}` : `${apiBaseUrl}/admin/stations`;
      const method = stationId ? 'PUT' : 'POST';
      await fetchJson(url, {
        method,
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });

      await loadAdminData();
      resetStationForm();
      showMessage(loginMessage, stationId ? 'Station updated.' : 'Station created.');
    } catch (error) {
      showMessage(loginMessage, error.message, true);
    }
  });

  routeForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const data = new FormData(routeForm);
    const routeId = data.get('routeId');
    const payload = {
      name: data.get('name'),
      origin: data.get('origin'),
      destination: data.get('destination'),
      description: data.get('description') || '',
    };

    try {
      const url = routeId ? `${apiBaseUrl}/admin/routes/${routeId}` : `${apiBaseUrl}/admin/routes`;
      const method = routeId ? 'PUT' : 'POST';
      await fetchJson(url, {
        method,
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });

      await loadAdminData();
      resetRouteForm();
      showMessage(loginMessage, routeId ? 'Route updated.' : 'Route created.');
    } catch (error) {
      showMessage(loginMessage, error.message, true);
    }
  });

  async function deleteStation(stationId) {
    if (!window.confirm('Delete this station?')) return;
    try {
      await fetchJson(`${apiBaseUrl}/admin/stations/${stationId}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      await loadAdminData();
      showMessage(loginMessage, 'Station deleted.');
    } catch (error) {
      showMessage(loginMessage, error.message, true);
    }
  }

  async function deleteRoute(routeId) {
    if (!window.confirm('Delete this route?')) return;
    try {
      await fetchJson(`${apiBaseUrl}/admin/routes/${routeId}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      await loadAdminData();
      showMessage(loginMessage, 'Route deleted.');
    } catch (error) {
      showMessage(loginMessage, error.message, true);
    }
  }

  document.getElementById('resetStationForm').addEventListener('click', resetStationForm);
  document.getElementById('resetRouteForm').addEventListener('click', resetRouteForm);

  updateLoginState();

  if (state.token) {
    loadAdminData();
  }
});
