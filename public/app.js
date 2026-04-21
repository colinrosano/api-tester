// Osano API Tester — multi-API version. Renders an API switcher at the top
// of the sidebar, per-API settings, and per-API endpoint categories.

const STORAGE_CURRENT_API  = 'osano-current-api';
const STORAGE_LAST_EP      = (apiId) => `osano-last-endpoint-${apiId}`;
const STORAGE_BASE_URL     = (apiId) => `osano-api-${apiId}-base-url`;
const STORAGE_AUTH_KEY     = (apiId, authId) => `osano-api-${apiId}-auth-${authId}`;
const STORAGE_GEO_COUNTRY  = 'osano-uc-country-override';
const STORAGE_GEO_REGION   = 'osano-uc-region-override';

const els = {
  nav:          document.getElementById('nav'),
  main:         document.getElementById('main'),
  welcome:      document.getElementById('welcome'),
  welcomeBadges:document.getElementById('welcome-badges'),
  apiTabs:      document.getElementById('api-tabs'),
  settingsBlk:  document.getElementById('settings-block'),
  brandSub:     document.getElementById('brand-sub'),
  search:       document.getElementById('endpoint-search'),
  toast:        document.getElementById('toast'),
};

let currentApiId = localStorage.getItem(STORAGE_CURRENT_API) || 'customer';
if (!window.APIS.find(a => a.id === currentApiId)) currentApiId = window.APIS[0].id;

let currentEndpointId = null;
let requestState = {}; // `${apiId}::${endpointId}` -> { pathParams, queryParams, body, response, activeTab, geo }

// -------- API helpers --------
function getApi(apiId = currentApiId) {
  return window.APIS.find(a => a.id === apiId);
}
function findEndpoint(apiId, endpointId) {
  const api = getApi(apiId);
  if (!api) return null;
  for (const cat of api.categories) {
    const ep = cat.endpoints.find(e => e.id === endpointId);
    if (ep) return { api, cat, ep };
  }
  return null;
}
function stateKey(apiId, epId) { return `${apiId}::${epId}`; }

function getAuthKey(api, authId) {
  if (!authId || authId === 'none') return null;
  return api.authKeys.find(k => k.id === authId) || null;
}
function endpointAuthKey(api, ep) {
  const authId = ep.auth || api.defaultAuth;
  return authId === 'none' ? null : getAuthKey(api, authId);
}

// -------- Toast --------
let toastTimer = null;
function toast(msg, kind = '') {
  els.toast.className = 'toast show ' + kind;
  els.toast.textContent = msg;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { els.toast.className = 'toast ' + kind; }, 2400);
}

// -------- API tabs --------
function renderApiTabs() {
  els.apiTabs.innerHTML = '';
  for (const api of window.APIS) {
    const epCount = api.categories.reduce((n, c) => n + c.endpoints.length, 0);
    const tab = document.createElement('button');
    tab.className = 'api-tab' + (api.id === currentApiId ? ' active' : '');
    tab.innerHTML = `
      <span class="api-tab-name">${escapeHtml(api.shortName || api.name)}</span>
      <span class="api-tab-count">${epCount}</span>
    `;
    tab.addEventListener('click', () => switchApi(api.id));
    els.apiTabs.appendChild(tab);
  }
}

function switchApi(apiId) {
  if (apiId === currentApiId) return;
  currentApiId = apiId;
  currentEndpointId = null;
  localStorage.setItem(STORAGE_CURRENT_API, apiId);
  renderApiTabs();
  renderSettings();
  renderNav();
  renderWelcome();

  const lastId = localStorage.getItem(STORAGE_LAST_EP(apiId));
  if (lastId && findEndpoint(apiId, lastId)) {
    selectEndpoint(lastId);
  } else {
    els.main.innerHTML = '';
    els.main.appendChild(els.welcome);
    els.welcome.style.display = '';
  }
  els.search.value = '';
}

// -------- Settings --------
function renderSettings() {
  const api = getApi();
  els.brandSub.textContent = api.description || api.name;

  const rows = [];
  const baseVal = localStorage.getItem(STORAGE_BASE_URL(api.id)) || api.baseUrl;
  rows.push(`
    <div class="settings-row">
      <label>Base URL</label>
      <input type="text" data-setting="baseUrl" value="${escapeHtml(baseVal)}" />
    </div>
  `);
  for (const k of api.authKeys) {
    const storedVal = localStorage.getItem(STORAGE_AUTH_KEY(api.id, k.id)) || '';
    rows.push(`
      <div class="settings-row">
        <label>${escapeHtml(k.label)}</label>
        <input type="${k.type || 'password'}" data-setting="auth" data-auth-id="${escapeHtml(k.id)}"
               value="${escapeHtml(storedVal)}" placeholder="Paste key…" autocomplete="off" />
        ${k.hint ? `<div class="settings-hint">${escapeHtml(k.hint)}</div>` : ''}
      </div>
    `);
  }
  rows.push(`<div class="settings-hint" style="margin-top:4px;">Stored in localStorage on this browser.</div>`);

  els.settingsBlk.innerHTML = rows.join('');

  els.settingsBlk.querySelectorAll('input').forEach(input => {
    input.addEventListener('input', e => {
      const t = e.target;
      if (t.dataset.setting === 'baseUrl') {
        localStorage.setItem(STORAGE_BASE_URL(api.id), t.value);
      } else if (t.dataset.setting === 'auth') {
        localStorage.setItem(STORAGE_AUTH_KEY(api.id, t.dataset.authId), t.value);
      }
    });
  });
}

function readSetting_baseUrl(api) {
  return (localStorage.getItem(STORAGE_BASE_URL(api.id)) || api.baseUrl).trim();
}
function readSetting_authKey(api, authId) {
  return (localStorage.getItem(STORAGE_AUTH_KEY(api.id, authId)) || '').trim();
}

// -------- Nav --------
function renderNav() {
  const api = getApi();
  els.nav.innerHTML = '';
  for (const cat of api.categories) {
    const catEl = document.createElement('div');
    catEl.className = 'nav-category';
    catEl.dataset.catId = cat.id;

    const header = document.createElement('div');
    header.className = 'nav-category-header';
    header.textContent = `${cat.name} (${cat.endpoints.length})`;
    catEl.appendChild(header);

    for (const ep of cat.endpoints) {
      const item = document.createElement('div');
      item.className = 'nav-endpoint';
      item.dataset.endpointId = ep.id;
      item.dataset.searchText = `${ep.method} ${ep.path} ${ep.title} ${cat.name}`.toLowerCase();

      const badge = document.createElement('span');
      badge.className = `method-badge method-${ep.method}`;
      badge.textContent = ep.method;

      const title = document.createElement('span');
      title.className = 'nav-endpoint-title';
      title.textContent = ep.title;

      item.appendChild(badge);
      item.appendChild(title);
      item.addEventListener('click', () => selectEndpoint(ep.id));
      catEl.appendChild(item);
    }

    els.nav.appendChild(catEl);
  }
  updateNavActive();
}

function updateNavActive() {
  document.querySelectorAll('.nav-endpoint').forEach(el => {
    el.classList.toggle('active', el.dataset.endpointId === currentEndpointId);
  });
}

els.search.addEventListener('input', e => {
  const q = e.target.value.trim().toLowerCase();
  document.querySelectorAll('.nav-endpoint').forEach(el => {
    const match = !q || el.dataset.searchText.includes(q);
    el.classList.toggle('hidden', !match);
  });
  document.querySelectorAll('.nav-category').forEach(cat => {
    const anyVisible = cat.querySelectorAll('.nav-endpoint:not(.hidden)').length > 0;
    cat.style.display = anyVisible ? '' : 'none';
  });
});

// -------- Welcome --------
function renderWelcome() {
  const api = getApi();
  els.welcomeBadges.innerHTML = api.categories
    .map(c => `<div class="welcome-badge">${escapeHtml(c.name)}</div>`)
    .join('');
}

// -------- Select + render endpoint --------
function selectEndpoint(id) {
  const found = findEndpoint(currentApiId, id);
  if (!found) return;
  currentEndpointId = id;
  localStorage.setItem(STORAGE_LAST_EP(currentApiId), id);
  updateNavActive();
  renderEndpoint(found);
}

function renderEndpoint({ api, cat, ep }) {
  const key = stateKey(api.id, ep.id);
  if (!requestState[key]) {
    requestState[key] = {
      pathParams: {},
      queryParams: Object.fromEntries((ep.queryParams || []).map(q => [q.name, q.default || ''])),
      body: ep.bodyTemplate ? JSON.stringify(ep.bodyTemplate, null, 2) : '',
      geo: {
        country: localStorage.getItem(STORAGE_GEO_COUNTRY) || '',
        region:  localStorage.getItem(STORAGE_GEO_REGION)  || '',
      },
      response: null,
      activeTab: 'body',
    };
  }
  const state = requestState[key];
  const hasBody = !!ep.bodyTemplate || ['POST', 'PATCH', 'PUT'].includes(ep.method);
  const authKey = endpointAuthKey(api, ep);
  const authLabel = ep.auth === 'none'
    ? 'Public · no auth'
    : (authKey ? `Uses ${authKey.headerName}` : `Uses ${api.authKeys[0].headerName}`);

  const container = document.createElement('div');
  container.className = 'endpoint';
  container.innerHTML = `
    <div class="endpoint-header">
      <h1 class="endpoint-title">${escapeHtml(ep.title)}</h1>
      <div class="endpoint-route">
        <span class="method-badge method-${ep.method}">${ep.method}</span>
        <span id="route-path">${escapeHtml(ep.path)}</span>
      </div>
      <div class="endpoint-meta">
        <span>${escapeHtml(cat.name)}</span>
        <span class="auth-badge auth-${ep.auth === 'none' ? 'none' : 'key'}">${escapeHtml(authLabel)}</span>
      </div>
    </div>

    ${(ep.pathParams && ep.pathParams.length) ? `
      <div class="section">
        <div class="section-header">Path parameters <span class="hint">required</span></div>
        <div class="section-body"><div class="field-grid" id="path-params"></div></div>
      </div>` : ''}

    ${(ep.queryParams && ep.queryParams.length) ? `
      <div class="section">
        <div class="section-header">Query parameters <span class="hint">leave blank to skip</span></div>
        <div class="section-body"><div class="field-grid" id="query-params"></div></div>
      </div>` : ''}

    ${ep.geoHeaders ? `
      <div class="section">
        <div class="section-header">Geo override headers <span class="hint">optional</span></div>
        <div class="section-body"><div class="field-grid" id="geo-headers"></div></div>
      </div>` : ''}

    ${hasBody ? `
      <div class="section">
        <div class="section-header">
          Request body
          <span>
            <button class="small-btn" id="body-format">Format</button>
            <button class="small-btn" id="body-reset">Reset template</button>
          </span>
        </div>
        <div class="section-body">
          <textarea class="textarea" id="body-input" spellcheck="false" placeholder="JSON body…"></textarea>
        </div>
      </div>` : ''}

    <div class="button-row">
      <button class="btn btn-primary" id="send-btn">Send request</button>
      <button class="btn btn-secondary" id="copy-curl-btn">Copy as cURL</button>
    </div>

    <div id="response-container"></div>
  `;

  els.welcome.style.display = 'none';
  els.main.innerHTML = '';
  els.main.appendChild(container);

  if (ep.pathParams && ep.pathParams.length) {
    const grid = container.querySelector('#path-params');
    for (const name of ep.pathParams) {
      const field = document.createElement('div');
      field.className = 'field';
      field.innerHTML = `
        <div class="field-label">${escapeHtml(name)}<span class="required">*</span></div>
        <div><input class="input" type="text" data-path-param="${escapeHtml(name)}"
                    value="${escapeHtml(state.pathParams[name] || '')}" /></div>
      `;
      grid.appendChild(field);
    }
    grid.addEventListener('input', e => {
      const n = e.target.dataset.pathParam;
      if (n !== undefined) {
        state.pathParams[n] = e.target.value;
        updateRoutePreview(api, ep);
      }
    });
  }

  if (ep.queryParams && ep.queryParams.length) {
    const grid = container.querySelector('#query-params');
    for (const q of ep.queryParams) {
      const field = document.createElement('div');
      field.className = 'field';
      field.innerHTML = `
        <div class="field-label">
          ${escapeHtml(q.name)}
          <div class="field-desc">${escapeHtml(q.desc || '')}</div>
        </div>
        <div>
          <input class="input" type="text" data-query-param="${escapeHtml(q.name)}"
                 value="${escapeHtml(state.queryParams[q.name] || '')}"
                 placeholder="${escapeHtml(q.default || '')}" />
        </div>
      `;
      grid.appendChild(field);
    }
    grid.addEventListener('input', e => {
      const n = e.target.dataset.queryParam;
      if (n !== undefined) {
        state.queryParams[n] = e.target.value;
        updateRoutePreview(api, ep);
      }
    });
  }

  if (ep.geoHeaders) {
    const grid = container.querySelector('#geo-headers');
    grid.innerHTML = `
      <div class="field">
        <div class="field-label">
          x-country-code-override
          <div class="field-desc">ISO 3166-1 (e.g. US)</div>
        </div>
        <div><input class="input" type="text" id="geo-country" value="${escapeHtml(state.geo.country)}" placeholder="US" /></div>
      </div>
      <div class="field">
        <div class="field-label">
          x-region-code-override
          <div class="field-desc">ISO 3166-2 (e.g. US-NH)</div>
        </div>
        <div><input class="input" type="text" id="geo-region" value="${escapeHtml(state.geo.region)}" placeholder="US-NH" /></div>
      </div>
    `;
    container.querySelector('#geo-country').addEventListener('input', e => {
      state.geo.country = e.target.value;
      localStorage.setItem(STORAGE_GEO_COUNTRY, e.target.value);
    });
    container.querySelector('#geo-region').addEventListener('input', e => {
      state.geo.region = e.target.value;
      localStorage.setItem(STORAGE_GEO_REGION, e.target.value);
    });
  }

  if (hasBody) {
    const ta = container.querySelector('#body-input');
    ta.value = state.body;
    ta.addEventListener('input', () => { state.body = ta.value; });

    container.querySelector('#body-format').addEventListener('click', () => {
      try {
        const parsed = JSON.parse(ta.value || 'null');
        ta.value = JSON.stringify(parsed, null, 2);
        state.body = ta.value;
        toast('Formatted', 'success');
      } catch (e) {
        toast('Not valid JSON: ' + e.message, 'error');
      }
    });
    container.querySelector('#body-reset').addEventListener('click', () => {
      ta.value = ep.bodyTemplate ? JSON.stringify(ep.bodyTemplate, null, 2) : '';
      state.body = ta.value;
    });
  }

  container.querySelector('#send-btn').addEventListener('click', () => sendRequest(api, ep));
  container.querySelector('#copy-curl-btn').addEventListener('click', () => copyCurl(api, ep));

  updateRoutePreview(api, ep);
  renderResponse(api, ep);
}

function updateRoutePreview(api, ep) {
  const routeEl = document.getElementById('route-path');
  if (!routeEl) return;
  routeEl.textContent = buildPath(api, ep).fullPath;
}

function buildPath(api, ep) {
  const state = requestState[stateKey(api.id, ep.id)];
  let p = ep.path;
  for (const n of (ep.pathParams || [])) {
    const v = (state.pathParams[n] || '').trim();
    p = p.replace(`{${n}}`, v ? encodeURIComponent(v) : `{${n}}`);
  }
  const qs = [];
  for (const q of (ep.queryParams || [])) {
    const v = (state.queryParams[q.name] || '').trim();
    if (v) qs.push(`${encodeURIComponent(q.name)}=${encodeURIComponent(v)}`);
  }
  return { fullPath: p + (qs.length ? '?' + qs.join('&') : '') };
}

// -------- Send --------
async function sendRequest(api, ep) {
  const state = requestState[stateKey(api.id, ep.id)];
  const baseUrl = readSetting_baseUrl(api);
  const headers = {};

  // Auth
  const authKey = endpointAuthKey(api, ep);
  if (authKey) {
    const val = readSetting_authKey(api, authKey.id);
    if (!val) {
      toast(`${authKey.headerName} is required — add it in the sidebar`, 'error');
      return;
    }
    headers[authKey.headerName] = val;
  }

  // Geo overrides
  if (ep.geoHeaders) {
    if (state.geo.country.trim()) headers['x-country-code-override'] = state.geo.country.trim();
    if (state.geo.region.trim())  headers['x-region-code-override']  = state.geo.region.trim();
  }

  for (const n of (ep.pathParams || [])) {
    if (!(state.pathParams[n] || '').trim()) {
      toast(`Path parameter "${n}" is required`, 'error');
      return;
    }
  }

  const hasBody = !!state.body && state.body.trim().length > 0;
  let bodyToSend = null;
  if (hasBody) {
    try { JSON.parse(state.body); bodyToSend = state.body; }
    catch (e) { toast('Body is not valid JSON: ' + e.message, 'error'); return; }
  }

  const { fullPath } = buildPath(api, ep);
  const btn = document.getElementById('send-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span>Sending…';

  try {
    const res = await fetch('/api/proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        method:  ep.method,
        baseUrl,
        apiPath: fullPath,
        body:    bodyToSend,
        headers,
      }),
    });
    const data = await res.json();
    state.response = data;
    state.activeTab = 'body';
    renderResponse(api, ep);
    if (data.ok) {
      toast(`HTTP ${data.status} · ${data.durationMs} ms`,
        data.status >= 200 && data.status < 300 ? 'success' : 'error');
    } else {
      toast('Network error: ' + (data.error || 'unknown'), 'error');
    }
  } catch (e) {
    state.response = { ok: false, error: e.message };
    renderResponse(api, ep);
    toast('Request failed: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Send request';
  }
}

function renderResponse(api, ep) {
  const state = requestState[stateKey(api.id, ep.id)];
  const container = document.getElementById('response-container');
  if (!container) return;
  if (!state.response) { container.innerHTML = ''; return; }

  const r = state.response;
  if (!r.ok) {
    container.innerHTML = `
      <div class="section response">
        <div class="section-header">Response</div>
        <div class="section-body">
          <div class="status-code status-err">ERROR</div>
          <pre class="code" style="margin-top:10px;">${escapeHtml(r.error || 'Unknown error')}</pre>
        </div>
      </div>
    `;
    return;
  }

  const statusClass = r.status >= 500 ? 'status-5'
                    : r.status >= 400 ? 'status-4'
                    : r.status >= 300 ? 'status-3' : 'status-2';
  const bodyStr = r.responseIsJson
    ? JSON.stringify(r.responseBody, null, 2)
    : (typeof r.responseBody === 'string' ? r.responseBody : JSON.stringify(r.responseBody, null, 2));
  const headersRows = Object.entries(r.responseHeaders || {})
    .map(([k, v]) => `<tr><td class="key">${escapeHtml(k)}</td><td class="val">${escapeHtml(Array.isArray(v) ? v.join(', ') : String(v))}</td></tr>`)
    .join('');
  const activeTab = state.activeTab || 'body';

  container.innerHTML = `
    <div class="section response">
      <div class="status-bar">
        <span class="status-code ${statusClass}">${r.status || '—'}</span>
        <span class="status-meta">${escapeHtml(r.statusText || '')}</span>
        <span class="status-meta">· ${r.durationMs} ms</span>
        <span class="status-meta" style="margin-left:auto; font-size:11px;">${escapeHtml(r.url)}</span>
      </div>
      <div class="tabs">
        <button class="tab ${activeTab === 'body' ? 'active' : ''}" data-tab="body">Response body</button>
        <button class="tab ${activeTab === 'headers' ? 'active' : ''}" data-tab="headers">Headers</button>
        <button class="tab ${activeTab === 'request' ? 'active' : ''}" data-tab="request">Request</button>
      </div>
      <div class="tab-panel ${activeTab === 'body' ? '' : 'hidden'}" data-panel="body">
        ${bodyStr ? `<pre class="code">${r.responseIsJson ? highlightJson(bodyStr) : escapeHtml(bodyStr)}</pre>`
                  : `<div class="empty-state">Empty response body</div>`}
      </div>
      <div class="tab-panel ${activeTab === 'headers' ? '' : 'hidden'}" data-panel="headers">
        <table class="headers-table">${headersRows}</table>
      </div>
      <div class="tab-panel ${activeTab === 'request' ? '' : 'hidden'}" data-panel="request">
        <div style="font-family:var(--mono); font-size:13px; margin-bottom:10px;">
          <span class="method-badge method-${r.requestMethod}">${r.requestMethod}</span>
          ${escapeHtml(r.url)}
        </div>
        ${renderRequestHeadersBlock(r.requestHeaders)}
        ${r.requestBody
          ? `<pre class="code">${highlightJson(r.requestBody)}</pre>`
          : `<div class="empty-state">No request body</div>`}
      </div>
    </div>
  `;

  container.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      state.activeTab = tab.dataset.tab;
      container.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t === tab));
      container.querySelectorAll('.tab-panel').forEach(p => {
        p.classList.toggle('hidden', p.dataset.panel !== state.activeTab);
      });
    });
  });
}

function renderRequestHeadersBlock(headers) {
  if (!headers || Object.keys(headers).length === 0) return '';
  const rows = Object.entries(headers)
    .map(([k, v]) => `<tr><td class="key">${escapeHtml(k)}</td><td class="val">${escapeHtml(String(v))}</td></tr>`)
    .join('');
  return `<div style="margin-bottom:12px;"><table class="headers-table">${rows}</table></div>`;
}

// -------- cURL --------
function copyCurl(api, ep) {
  const state = requestState[stateKey(api.id, ep.id)];
  const baseUrl = readSetting_baseUrl(api);
  const { fullPath } = buildPath(api, ep);
  const parts = [
    `curl -X ${ep.method}`,
    `  "${baseUrl}${fullPath}"`,
    `  -H "Accept: application/json"`,
  ];
  const authKey = endpointAuthKey(api, ep);
  if (authKey) {
    parts.push(`  -H "${authKey.headerName}: \${${authKey.headerName.toUpperCase().replace(/-/g, '_')}}"`);
  }
  if (ep.geoHeaders) {
    if (state.geo.country.trim()) parts.push(`  -H "x-country-code-override: ${state.geo.country.trim()}"`);
    if (state.geo.region.trim())  parts.push(`  -H "x-region-code-override: ${state.geo.region.trim()}"`);
  }
  if (state.body && state.body.trim()) {
    parts.push(`  -H "Content-Type: application/json"`);
    parts.push(`  --data-binary '${state.body.replace(/'/g, `'\\''`)}'`);
  }
  const cmd = parts.join(' \\\n');
  navigator.clipboard.writeText(cmd).then(
    () => toast('cURL command copied', 'success'),
    () => toast('Copy failed', 'error')
  );
}

// -------- Helpers --------
function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function highlightJson(str) {
  const escaped = escapeHtml(str);
  return escaped.replace(
    /(&quot;[^&]*?&quot;)(\s*:)?|(\b(?:true|false)\b)|(\bnull\b)|(-?\d+\.?\d*(?:[eE][+-]?\d+)?)/g,
    (match, strMatch, colon, bool, nullMatch, num) => {
      if (strMatch) {
        return colon
          ? `<span class="j-key">${strMatch}</span>${colon}`
          : `<span class="j-string">${strMatch}</span>`;
      }
      if (bool)      return `<span class="j-bool">${bool}</span>`;
      if (nullMatch) return `<span class="j-null">${nullMatch}</span>`;
      if (num)       return `<span class="j-number">${num}</span>`;
      return match;
    }
  );
}

// -------- Init --------
renderApiTabs();
renderSettings();
renderNav();
renderWelcome();

const lastId = localStorage.getItem(STORAGE_LAST_EP(currentApiId));
if (lastId && findEndpoint(currentApiId, lastId)) {
  selectEndpoint(lastId);
}
