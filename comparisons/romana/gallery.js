const $ = (selector) => document.querySelector(selector);
const scopeNames = { 'core-touches': 'Core', 'ring-touches': 'Scenery ring', 'outside-ring': 'Outside ring', 'published-capture': 'Published baseline' };
const scopeColors = { 'core-touches': 'core', 'ring-touches': 'ring', 'outside-ring': 'outside', 'published-capture': 'core' };
const sourceRoot = 'https://github.com/calinacristian/calinacristian.github.io/commit/';
let manifest, state, current, visible = [], zoomScale = 1, zoomWidth = 640;
const normal = (value) => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

// A 250 m ground square in Web Mercator needs the local latitude scale factor.
export function aerialURL(item) {
  const radians = item.lat * Math.PI / 180;
  const radius = 6378137;
  const x = radius * item.lon * Math.PI / 180;
  const y = radius * Math.log(Math.tan(Math.PI / 4 + radians / 2));
  const half = item.size / (2 * Math.cos(radians));
  const params = new URLSearchParams({ bbox: [x - half, y - half, x + half, y + half].map(n => n.toFixed(5)).join(','), bboxSR: '3857', imageSR: '3857', size: '640,640', format: 'jpg', f: 'image' });
  return `${manifest.aerial.endpoint}?${params}`;
}

function readState() {
  const params = new URLSearchParams(location.hash.slice(1));
  const dataset = params.get('set') === 'published' ? 'published' : 'atlas';
  return { dataset, tile: params.get('tile') || (dataset === 'atlas' ? manifest.defaultTile : 'romana-spawn'), scope: ['core-touches', 'ring-touches', 'outside-ring'].includes(params.get('scope')) ? params.get('scope') : 'all', row: /^(?:[1-9]|1[0-5])$/.test(params.get('row')) ? params.get('row') : 'all', query: (params.get('q') || '').slice(0, 160) };
}

function writeState(push = false) {
  const params = new URLSearchParams({ set: state.dataset, tile: state.tile });
  if (state.scope !== 'all' && state.dataset === 'atlas') params.set('scope', state.scope);
  if (state.row !== 'all' && state.dataset === 'atlas') params.set('row', state.row);
  if (state.query) params.set('q', state.query);
  history[push ? 'pushState' : 'replaceState'](null, '', `#${params}`);
}

function matchingItems() {
  const query = normal(state.query.trim());
  return manifest.items.filter(item => {
    if (item.dataset !== state.dataset) return false;
    if (state.dataset === 'atlas' && state.scope !== 'all' && item.scope !== state.scope) return false;
    if (state.dataset === 'atlas' && state.row !== 'all' && item.row !== Number(state.row)) return false;
    if (!query) return true;
    const text = normal(`${item.id} ${item.label} ${scopeNames[item.scope]} ${item.lat.toFixed(8)} ${item.lon.toFixed(8)} row ${item.row || ''} r${String(item.row || '').padStart(2, '0')} column ${item.column || ''}`);
    return query.split(/[\s,]+/).every(term => text.includes(term));
  });
}

function selectTile(id, push = true) {
  if (id === current?.id) return;
  state.tile = id;
  renderSelection();
  writeState(push);
}

function renderIndex() {
  const root = $('#spatial-index');
  root.replaceChildren();
  const atlas = state.dataset === 'atlas';
  root.classList.toggle('published-index', !atlas);
  $('#index-title').textContent = atlas ? 'District index' : 'Four published views';
  $('#index-description').textContent = atlas ? '15 rows × 13 columns. Select any square.' : 'Three Romană locations and Stadionul Dinamo.';
  $('#legend').hidden = !atlas;
  $('.coverage-note').hidden = !atlas;
  const matching = new Set(visible.map(item => item.id));
  for (const item of manifest.items.filter(item => item.dataset === state.dataset)) {
    const button = document.createElement('button');
    button.type = 'button'; button.dataset.id = item.id; button.dataset.scope = item.scope;
    button.setAttribute('aria-label', atlas ? `${item.label}, ${scopeNames[item.scope]}` : item.label);
    button.title = `${item.id} · ${scopeNames[item.scope]}`;
    button.classList.toggle('filtered-out', !matching.has(item.id));
    button.disabled = !matching.has(item.id);
    if (!atlas) button.textContent = item.label;
    button.addEventListener('click', () => selectTile(item.id));
    root.append(button);
  }
}

function renderThumbnails() {
  const root = $('#thumbnails');
  root.replaceChildren();
  $('#gallery-title').textContent = `${visible.length === (state.dataset === 'atlas' ? 195 : 4) ? 'All ' : ''}${visible.length} ${state.dataset === 'atlas' ? 'survey locations' : 'published views'}`;
  const fragment = document.createDocumentFragment();
  for (const item of visible) {
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'thumbnail'; button.dataset.id = item.id;
    button.setAttribute('aria-label', `Compare ${item.label}, ${scopeNames[item.scope]}`);
    const img = document.createElement('img');
    img.src = item.thumbnail; img.alt = ''; img.loading = 'lazy'; img.decoding = 'async'; img.width = 160; img.height = 160;
    const label = document.createElement('span');
    label.append(document.createTextNode(item.dataset === 'atlas' ? `R${String(item.row).padStart(2, '0')} · C${String(item.column).padStart(2, '0')}` : item.label));
    const dot = document.createElement('i'); dot.className = scopeColors[item.scope]; label.append(dot);
    const detail = document.createElement('small'); detail.textContent = item.dataset === 'atlas' ? scopeNames[item.scope] : item.gameSourceCommit.slice(0, 7);
    button.append(img, label, detail);
    button.addEventListener('click', () => { selectTile(item.id); $('.viewer').scrollIntoView({ behavior: 'smooth', block: 'start' }); });
    fragment.append(button);
  }
  root.append(fragment);
}

function renderSelection() {
  current = visible.find(item => item.id === state.tile) || visible[0];
  $('#empty').hidden = Boolean(current);
  $('#comparison-content').hidden = !current;
  if (!current) {
    $('#tile-id').textContent = 'NO MATCHES'; $('#tile-title').textContent = 'No locations found'; $('#scope-badge').hidden = true;
    $('#game-image').removeAttribute('src'); $('#aerial-image').removeAttribute('src');
  } else {
    state.tile = current.id;
    $('#scope-badge').hidden = false;
    $('#tile-id').textContent = current.id;
    $('#tile-title').textContent = current.label;
    $('#scope-badge').textContent = scopeNames[current.scope]; $('#scope-badge').dataset.scope = current.scope;
    const game = $('#game-image');
    game.src = current.image; game.alt = `Game capture: ${current.label}, north up, 250 m square`;
    const url = aerialURL(current);
    const aerial = $('#aerial-image');
    $('#aerial-status').hidden = false; $('#aerial-status').textContent = 'Loading live imagery…';
    aerial.onload = () => { $('#aerial-status').hidden = true; };
    aerial.onerror = () => { $('#aerial-status').hidden = false; $('#aerial-status').textContent = 'Live aerial could not load. Use “Open aerial” to retry at Esri.'; };
    aerial.alt = `Live Esri aerial: ${current.label}, north up, 250 m square`; aerial.src = url;
    $('#aerial-link').href = url;
    $('#source-link').textContent = current.gameSourceCommit.slice(0, 7); $('#source-link').href = sourceRoot + current.gameSourceCommit;
    $('#coordinates').textContent = `${current.lat.toFixed(8)}° N, ${current.lon.toFixed(8)}° E`;
    $('#maps-link').href = `https://www.google.com/maps/search/?api=1&query=${current.lat},${current.lon}`;
    $('#streetview-link').href = `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${current.lat},${current.lon}`;
    const index = visible.indexOf(current);
    $('#position').textContent = `${index + 1} / ${visible.length}`;
    $('#previous').disabled = visible.length < 2; $('#next').disabled = visible.length < 2;
  }
  document.querySelectorAll('[data-id]').forEach(button => button.setAttribute('aria-current', String(button.dataset.id === current?.id)));
}

function render() {
  visible = matchingItems();
  $('#search').value = state.query; $('#scope').value = state.scope; $('#row').value = state.row;
  const atlas = state.dataset === 'atlas';
  $('#scope').disabled = !atlas; $('#row').disabled = !atlas;
  document.querySelectorAll('[data-dataset]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.dataset === state.dataset)));
  $('#collection-note').innerHTML = atlas ? '<strong>Historical survey.</strong> 195 captures from b10d8d3, with 3 targeted ce54c6b overrides. These captures predate later game fixes.' : '<strong>Published baseline · 58129ab.</strong> Four captures from 8 November 2026, separate from the 195-location historical survey. Later fixes are not shown.';
  renderIndex(); renderThumbnails(); renderSelection(); writeState();
}

function move(delta) {
  if (visible.length < 2) return;
  const index = visible.findIndex(item => item.id === current?.id);
  selectTile(visible[(index + delta + visible.length) % visible.length].id);
}

function openZoom(kind) {
  if (!current) return;
  const image = kind === 'game' ? $('#game-image') : $('#aerial-image');
  $('#zoom-image').src = image.src; $('#zoom-image').alt = image.alt;
  $('#zoom-title').textContent = `${current.label} · ${kind === 'game' ? 'Game capture' : 'Live Esri aerial'}`;
  $('#zoom-caption').textContent = kind === 'game' ? `Original ${current.width} × ${current.height} image · source ${current.gameSourceCommit} · 250 m square, north up` : `${manifest.aerial.attribution} · acquisition date unknown · 250 m square, north up`;
  zoomScale = 1;
  zoomWidth = kind === 'game' ? current.width : 640;
  $('#zoom-image').style.width = `${zoomWidth}px`;
  $('#zoom-image').style.height = 'auto';
  $('#zoom-dialog').showModal();
  $('#zoom-scroll').scrollTop = 0; $('#zoom-scroll').scrollLeft = 0;
}

try {
  const response = await fetch('manifest.json');
  if (!response.ok) throw new Error('Manifest request failed');
  manifest = await response.json();
  for (let row = 1; row <= 15; row++) {
    const option = document.createElement('option'); option.value = row; option.textContent = `Row ${String(row).padStart(2, '0')}`; $('#row').append(option);
  }
  state = readState(); render();
  $('#filters').addEventListener('submit', event => event.preventDefault());
  $('#search').addEventListener('input', event => { state.query = event.target.value; render(); });
  for (const field of ['scope', 'row']) $(`#${field}`).addEventListener('change', event => { state[field] = event.target.value; render(); });
  $('#reset').addEventListener('click', () => { state.scope = 'all'; state.row = 'all'; state.query = ''; render(); });
  document.querySelectorAll('[data-dataset]').forEach(button => button.addEventListener('click', () => {
    if (button.dataset.dataset === state.dataset) return;
    state = { dataset: button.dataset.dataset, tile: button.dataset.dataset === 'atlas' ? manifest.defaultTile : 'romana-spawn', scope: 'all', row: 'all', query: '' }; render();
  }));
  $('#previous').addEventListener('click', () => move(-1)); $('#next').addEventListener('click', () => move(1));
  window.addEventListener('popstate', () => { state = readState(); render(); });
  window.addEventListener('hashchange', () => { state = readState(); render(); });
  window.addEventListener('keydown', event => {
    if ($('#zoom-dialog').open || event.ctrlKey || event.metaKey || event.altKey || /^(INPUT|SELECT|TEXTAREA)$/.test(event.target.tagName)) return;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); move(event.key === 'ArrowLeft' ? -1 : 1); }
  });
  document.querySelectorAll('[data-zoom]').forEach(button => button.addEventListener('click', () => openZoom(button.dataset.zoom)));
  $('#zoom-close').addEventListener('click', () => $('#zoom-dialog').close());
  $('#zoom-dialog').addEventListener('close', () => $('#zoom-image').removeAttribute('src'));
  for (const [id, delta] of [['zoom-in', .25], ['zoom-out', -.25]]) $(`#${id}`).addEventListener('click', () => { zoomScale = Math.max(.5, Math.min(3, zoomScale + delta)); $('#zoom-image').style.width = `${zoomWidth * zoomScale}px`; });
} catch (error) {
  $('#load-error').hidden = false;
  $('#tile-title').textContent = 'Comparison gallery unavailable';
  console.error(error);
}
