// A composable, dependency-free comparison viewer. Its CSS and event handlers stay in its mount.
const sourceRoot = 'https://github.com/calinacristian/calinacristian.github.io/commit/';
const scopes = {core: 'Playable area', nearby: 'Nearby scenery · 600 m', distant: 'Distant background', all: 'All survey tiles'};
const itemScope = item => ({'core-touches':'core','ring-touches':'nearby','outside-ring':'distant','published-capture':'baseline'}[item.scope] || item.scope);
const normalize = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const paramNames = ['compareLocation','compareTile','compareScope','compareRow','compareQuery','compareBaseline','compareLat','compareLon','compareLabel','compareArchive'];

/** Official live imagery, matched to a north-up ground square. Browser-only caching is handled by the viewer. */
export function aerialURL(item, aerial = {}) {
  const radians = item.lat * Math.PI / 180, radius = 6378137;
  const x = radius * item.lon * Math.PI / 180;
  const y = radius * Math.log(Math.tan(Math.PI / 4 + radians / 2));
  const half = item.size / (2 * Math.cos(radians));
  const params = new URLSearchParams({bbox:[x-half,y-half,x+half,y+half].map(n=>n.toFixed(5)).join(','),bboxSR:'3857',imageSR:'3857',size:'640,640',format:'jpg',f:'image'});
  return `${aerial.endpoint || 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export'}?${params}`;
}

// Official imagery stays on the visitor's device: persistent 15-minute records,
// plus a bounded memory front. Reloads keep the original timestamp, not a new TTL.
export function createAerialCache({ttl = 15 * 60 * 1000, limit = 96} = {}) {
  const entries = new Map(), cacheName='dmcv-comparison-aerial-v1', timestampHeader='x-cv-fetched-at';
  let closed=false, storagePromise;
  const validTimestamp=response=>{
    const value=Number(response?.headers.get(timestampHeader));
    return Number.isFinite(value)&&value>0&&value<=Date.now()&&Date.now()-value<ttl ? value : null;
  };
  const safeURL=url=>{
    const value=new URL(url);
    return value.protocol==='https:'&&value.hostname==='server.arcgisonline.com'&&value.pathname==='/ArcGIS/rest/services/World_Imagery/MapServer/export'&&!value.username&&!value.password&&[...value.searchParams.keys()].every(key=>['bbox','bboxSR','imageSR','size','format','f'].includes(key));
  };
  async function pruneExpired(cache) {
    const requests=await cache.keys();
    await Promise.all(requests.map(async request=>{const response=await cache.match(request);if(!validTimestamp(response))await cache.delete(request);}));
  }
  async function storage() {
    if(!storagePromise)storagePromise=(async()=>{
      try {if(!globalThis.caches)return null;const cache=await caches.open(cacheName);await pruneExpired(cache);return cache;}catch{return null;}
    })();
    return storagePromise;
  }
  function release(key,entry) {
    entries.delete(key);entry.controller.abort();
    if(entry.objectURL)URL.revokeObjectURL(entry.objectURL);
  }
  return {
    get(url) {
      if(closed)return Promise.reject(new Error('Comparison viewer disposed'));
      let entry=entries.get(url);
      if(entry&&(entry.pending||entry.expiresAt>Date.now())) {entries.delete(url);entries.set(url,entry);return entry.promise;}
      if(entry)release(url,entry);
      entry={controller:new AbortController(),pending:true,objectURL:null,expiresAt:0};entries.set(url,entry);
      entry.promise=(async()=>{
        try {
          const cache=safeURL(url)?await storage():null;
          let blob,fetchedAt;
          if(cache)try {
            const saved=await cache.match(url);fetchedAt=validTimestamp(saved);
            if(saved&&fetchedAt)blob=await saved.blob();
            else if(saved)await cache.delete(url);
          }catch{/* Storage restrictions must not stop live imagery. */}
          if(!blob) {
            const response=await fetch(url,{mode:'cors',credentials:'omit',cache:'no-store',signal:entry.controller.signal});
            if(!response.ok||!/^image\//i.test(response.headers.get('content-type')||''))throw new Error('Live aerial request failed');
            blob=await response.blob();if(!blob.size)throw new Error('Live aerial response was empty');fetchedAt=Date.now();
            if(cache) {
              const record=()=>new Response(blob,{status:200,headers:{'content-type':blob.type||'image/jpeg',[timestampHeader]:String(fetchedAt)}});
              try {await cache.put(url,record());}catch{
                try {await pruneExpired(cache);await cache.put(url,record());}catch{/* Quota or denied storage: retain the memory result. */}
              }
            }
          }
          if(closed||entry.controller.signal.aborted)throw new Error('Live aerial request ended');
          entry.objectURL=URL.createObjectURL(blob);entry.pending=false;entry.expiresAt=fetchedAt+ttl;
          return entry.objectURL;
        }catch(error){if(entries.get(url)===entry)release(url,entry);throw error;}
      })();
      while(entries.size>limit){const[key,oldest]=entries.entries().next().value;release(key,oldest);}
      return entry.promise;
    },
    dispose(){closed=true;for(const[key,entry]of entries)release(key,entry);}
  };
}

/** Mount within an overview section. Resolves to {dispose(), setLocation(id, options), setState(options)}. */
export async function mountComparisonViewer(element, {baseURL = new URL('./comparison-data/', import.meta.url), onLocation = () => {}} = {}) {
  const root = document.createElement('div');
  root.className = 'cv-viewer'; root.tabIndex = -1;
  root.innerHTML = '<p class="cv-message" role="status">Loading comparison locations…</p>';
  element.replaceChildren(root);
  const abort = new AbortController(), listenerOptions = {signal:abort.signal};
  const aerialCache=createAerialCache();
  let aerialRequest=0;
  let disposed = false, current, visible = [], state, manifest, collectionItems = [], zoomScale = 1, zoomWidth = 640;
  const manifests = new Map(), archives = new Map();
  const archiveKey = (id, ref) => `${id}::${ref}`;
  const $ = selector => root.querySelector(`[data-cv="${selector}"]`);
  const listen = (target, event, handler) => target.addEventListener(event,handler,listenerOptions);
  const base = new URL(baseURL, document.baseURI);
  let catalog, setLocationHandler = async () => {};
  const controller = {dispose() {disposed = true; aerialCache.dispose();abort.abort(); $('dialog')?.close(); root.remove();}, setLocation(id, options = {}) {return setLocationHandler({location:id,...options});}, setState(options) {return setLocationHandler(options);}};
  try {
    const getJSON = async url => {const response = await fetch(url,{signal:abort.signal}); if(!response.ok) throw new Error(`Comparison data: HTTP ${response.status}`); return response.json();};
    catalog = await getJSON(new URL('catalog.json',base));
    // Only small source ledgers are loaded here. Original imagery is loaded on selection.
    await Promise.all(catalog.locations.map(async place => {
      const prepare = (data, url) => {for(const item of data.items) {item.image = new URL(item.image,url).href; item.thumbnail = new URL(item.thumbnail,url).href;}return data;};
      const url = new URL(place.manifest,base), data = prepare(await getJSON(url),url);
      manifests.set(place.id,data);
      await Promise.all((data.historicalCollections || []).map(async history => {
        if(!/^historical\/[a-zA-Z0-9_/-]+\/manifest\.json$/.test(history.manifest || '')) return;
        const archiveURL = new URL(history.manifest,url), key = archiveKey(place.id,history.manifest);
        try {archives.set(key,{...history,data:prepare(await getJSON(archiveURL),archiveURL)});}
        catch {archives.set(key,{...history,unavailable:true});}
      }));
    }));
    if (disposed) return controller;
    if (!catalog.locations.length) throw new Error('No comparison locations are available');
    root.innerHTML = `
      <div class="cv-toolbar">
        <label class="cv-place">Location<select data-cv="location" aria-label="Comparison location"></select></label>
        <label class="cv-collection">Capture collection<select data-cv="collection" aria-label="Capture collection"></select></label>
        <p class="cv-overview-note">Game captures beside live aerial imagery.<br>North up · matching 250 m ground squares.</p>
      </div>
      <p class="cv-unavailable-message" data-cv="unavailable" role="status" hidden></p>
      <p class="cv-collection-note" data-cv="collection-note"></p>
      <div class="cv-scopes" data-cv="scopes" role="group" aria-label="Comparison area"></div>
      <p class="cv-target-note" data-cv="target-note" hidden></p>
      <p class="cv-scope-note" data-cv="scope-note"></p>
      <form class="cv-filters" data-cv="filters" role="search" aria-label="Find comparison tiles">
        <label class="cv-search">Find a location<input data-cv="query" type="search" placeholder="Tile, place or coordinates" maxlength="160" aria-label="Search comparison tiles"></label>
        <label class="cv-row">Grid row<select data-cv="row" aria-label="Grid row"></select></label>
        <button class="cv-button cv-reset" type="button" data-cv="reset">Clear filters</button>
      </form>
      <div class="cv-workspace">
        <aside class="cv-index-panel">
          <details data-cv="index-details" open><summary>Spatial index <span data-cv="grid-count"></span></summary>
            <p class="cv-small" data-cv="index-description"></p>
            <div class="cv-index" data-cv="index" aria-label="Spatial tile index"></div>
            <div class="cv-context-index" data-cv="context-index" aria-label="Separate source-anchor context views"></div>
            <div class="cv-legend"><span><i class="cv-core"></i>Playable</span><span><i class="cv-nearby"></i>Nearby</span><span><i class="cv-distant"></i>Distant</span></div>
            <p class="cv-small" data-cv="coverage-note"></p>
          </details>
        </aside>
        <div class="cv-selection" data-cv="selection">
          <div class="cv-heading"><div><p class="cv-id" data-cv="tile-id"></p><h3 data-cv="tile-title"></h3></div><span class="cv-badge" data-cv="badge"></span></div>
          <p class="cv-empty" data-cv="empty" hidden>No locations match these filters. Clear filters to return to this collection.</p>
          <div data-cv="content">
            <div class="cv-pair">
              <figure class="cv-image-card"><figcaption>Game capture <button type="button" data-zoom="game" aria-label="Enlarge game capture">+</button></figcaption>
                <button class="cv-image-button" type="button" data-zoom="game" aria-label="Open original game capture"><img data-cv="game-image" alt="" width="640" height="640"><span class="cv-image-hint">Open original</span></button>
                <p class="cv-credit">Source <a data-cv="source-link" target="_blank" rel="noopener noreferrer"></a> · <span data-cv="capture-type"></span></p>
              </figure>
              <figure class="cv-image-card"><figcaption>Live aerial <span>Esri</span><button type="button" data-zoom="aerial" aria-label="Enlarge live aerial">+</button></figcaption>
                <button class="cv-image-button" type="button" data-zoom="aerial" aria-label="Open full live aerial"><img data-cv="aerial-image" alt="" width="640" height="640"><span class="cv-image-hint">Open full image</span><span class="cv-image-status" data-cv="aerial-status" role="status">Loading live imagery…</span></button>
                <p class="cv-credit"><span data-cv="attribution"></span> · acquisition date unknown</p>
              </figure>
            </div>
            <div class="cv-pose"><span data-cv="coordinates"></span><span data-cv="pose"></span></div>
            <div class="cv-actions"><nav class="cv-links" aria-label="Selected comparison sources"><a data-cv="aerial-link" target="_blank" rel="noopener noreferrer">Open aerial</a><a data-cv="maps-link" target="_blank" rel="noopener noreferrer">Map</a><a data-cv="streetview-link" target="_blank" rel="noopener noreferrer">Street View</a></nav>
              <div class="cv-pager"><button class="cv-button" type="button" data-cv="previous" aria-label="Previous comparison">←</button><span data-cv="position" role="status"></span><button class="cv-button" type="button" data-cv="next" aria-label="Next comparison">→</button></div>
            </div>
          </div>
        </div>
      </div>
      <div class="cv-gallery-heading"><h3 data-cv="gallery-title"></h3><p>Choose a tile · use ← → while the viewer is focused</p></div>
      <div class="cv-thumbnails" data-cv="thumbnails"></div>
      <p class="cv-footnote" data-cv="review-note"></p>
      <dialog class="cv-dialog" data-cv="dialog" aria-label="Full comparison image">
        <div class="cv-zoom-bar"><strong data-cv="zoom-title"></strong><div><button type="button" class="cv-button" data-cv="zoom-out" aria-label="Zoom out">−</button><button type="button" class="cv-button" data-cv="zoom-in" aria-label="Zoom in">+</button><button type="button" class="cv-button" data-cv="zoom-close">Close</button></div></div>
        <p class="cv-zoom-caption" data-cv="zoom-caption"></p><div class="cv-zoom-scroll" data-cv="zoom-scroll"><img data-cv="zoom-image" alt=""></div>
      </dialog>`;
    const unavailableOption=document.createElement('option');unavailableOption.value='';unavailableOption.textContent='No published captures';unavailableOption.disabled=true;unavailableOption.hidden=true;$('location').append(unavailableOption);
    $('index-details').open = window.matchMedia('(min-width: 801px)').matches;
    for(const place of catalog.locations) {const option = document.createElement('option'); option.value = place.id; option.textContent = place.label; $('location').append(option);}
    function defaultState() { return {location:catalog.locations[0].id,tile:'',scope:'core',row:'all',query:'',baseline:false,archive:'',lat:null,lon:null,label:''}; }
    function readState() {
      const params = new URL(location.href).searchParams, result = defaultState();
      const id = params.get('compareLocation'); if(id && /^[a-z0-9-]+$/.test(id)) result.location = id;
      const scope = params.get('compareScope'); if(Object.hasOwn(scopes,scope)) result.scope = scope;
      result.tile = params.get('compareTile') || ''; result.query = (params.get('compareQuery') || '').slice(0,160);
      result.row = /^-?\d{1,3}$/.test(params.get('compareRow')) ? params.get('compareRow') : 'all';
      result.archive = params.get('compareArchive') || '';result.baseline = params.get('compareBaseline') === '1';result.label=(params.get('compareLabel') || '').slice(0,120);
      for(const [key,limit] of [['lat',90],['lon',180]]) {const raw=params.get('compare'+key[0].toUpperCase()+key.slice(1));const n=Number(raw);if(raw && Number.isFinite(n) && Math.abs(n)<=limit)result[key]=n;}
      return resolveTarget(result);
    }
    function writeState(push = false, anchor = true) {
      const url = new URL(location.href); for(const name of paramNames) url.searchParams.delete(name);
      url.searchParams.set('compareLocation',state.location); if(state.tile) url.searchParams.set('compareTile',state.tile);
      if(state.scope !== 'core' && !state.baseline) url.searchParams.set('compareScope',state.scope);
      if(state.row !== 'all') url.searchParams.set('compareRow',state.row);
      if(state.archive) url.searchParams.set('compareArchive',state.archive);
      if(state.query) url.searchParams.set('compareQuery',state.query); if(state.baseline) url.searchParams.set('compareBaseline','1');
      if(Number.isFinite(state.lat)&&Number.isFinite(state.lon)) {url.searchParams.set('compareLat',state.lat);url.searchParams.set('compareLon',state.lon);}
      if(state.label)url.searchParams.set('compareLabel',state.label);
      if(anchor) url.hash = 'comparisons';
      history[push?'pushState':'replaceState'](null,'',url);
    }
    function clearTarget() {state.lat=null;state.lon=null;state.label='';$('target-note').hidden=true;}
    function resolveTarget(next) {
      if(next.archive)return next;
      const data=manifests.get(next.location);
      if(data && Number.isFinite(next.lat) && Number.isFinite(next.lon)) {
        const c=Math.cos(next.lat*Math.PI/180),d=item=>((item.lon-next.lon)*c)**2+(item.lat-next.lat)**2;
        const tile=data.items.filter(item=>item.dataset!=='published').reduce((best,item)=>!best || d(item)<d(best)?item:best,null);
        if(tile)Object.assign(next,{tile:tile.id,scope:itemScope(tile),baseline:false,row:'all',query:''});
      }
      return next;
    }
    function selectTile(id, push = true) {clearTarget();state.tile = id; renderSelection(); writeState(push);}
    function matchingItems() {
      const query = normalize(state.query.trim());
      return collectionItems.filter(item => {
        if(!state.baseline && state.scope !== 'all' && itemScope(item) !== state.scope) return false;
        if(!state.baseline && state.row !== 'all' && item.row !== Number(state.row)) return false;
        const text = normalize(`${item.id} ${item.label} ${(item.places || []).join(' ')} ${scopes[itemScope(item)] || 'published baseline'} ${item.lat.toFixed(8)} ${item.lon.toFixed(8)} row ${item.row || ''} r${String(item.row || '').padStart(2,'0')} column ${item.column || ''}`);
        return !query || query.split(/[\s,]+/).every(term=>text.includes(term));
      });
    }
    function renderIndex() {
      const index = $('index'), contextIndex=$('context-index'),matching = new Set(visible.map(x=>x.id)); index.replaceChildren();contextIndex.replaceChildren();
      const gridRows=[...new Set(collectionItems.map(x=>x.row).filter(Number.isInteger))].sort((a,b)=>a-b), gridColumns=[...new Set(collectionItems.map(x=>x.column).filter(Number.isInteger))].sort((a,b)=>a-b);
      const firstRow=gridRows[0] ?? 1,firstColumn=gridColumns[0] ?? 1;
      const rows=gridRows.length?gridRows.at(-1)-firstRow+1:1,columns=gridColumns.length?gridColumns.at(-1)-firstColumn+1:1;
      index.style.setProperty('--cv-columns',state.baseline?2:columns); index.classList.toggle('cv-baseline-index',state.baseline);
      $('grid-count').textContent = `${collectionItems.length} tiles`;
      $('index-description').textContent = state.baseline ? 'Separate published baseline views.' : `${rows} rows × ${columns} columns · north at the top. Dimmed tiles are outside the current filters.`;
      for(const item of collectionItems) {
        const button = document.createElement('button'); button.type = 'button'; button.dataset.id = item.id; button.dataset.area = itemScope(item);
        button.title = `${item.id} · ${scopes[itemScope(item)] || 'Published baseline'}`; button.setAttribute('aria-label',`${item.label}, ${scopes[itemScope(item)] || 'Published baseline'}`);
        button.disabled = !matching.has(item.id);
        if(state.baseline) button.textContent = item.label;
        else if(Number.isInteger(item.row)&&Number.isInteger(item.column)) {button.style.gridRow = item.row-firstRow+1; button.style.gridColumn = item.column-firstColumn+1;}
        else button.textContent=item.label;
        button.addEventListener('click',()=>selectTile(item.id));
        if(!state.baseline&&(!Number.isInteger(item.row)||!Number.isInteger(item.column)))contextIndex.append(button);else index.append(button);
      }
    }
    function renderThumbnails() {
      $('gallery-title').textContent = `${visible.length} of ${collectionItems.length} ${state.baseline?'baseline views':'survey tiles'}`;
      const fragment = document.createDocumentFragment();
      for(const item of visible) {
        const button = document.createElement('button'); button.type = 'button'; button.className = 'cv-thumbnail'; button.dataset.id = item.id;
        button.setAttribute('aria-label',`Compare ${item.label}, ${scopes[itemScope(item)] || 'Published baseline'}`);
        const img = document.createElement('img'); img.src = item.thumbnail; img.alt = ''; img.loading = 'lazy'; img.decoding = 'async'; img.width = 160; img.height = 160;
        const label = document.createElement('span'); label.textContent = Number.isInteger(item.row) ? `R${String(item.row).padStart(2,'0')} · C${String(item.column).padStart(2,'0')}` : item.label;
        const detail = document.createElement('small'); detail.textContent = scopes[itemScope(item)] || 'Published baseline';
        button.append(img,label,detail); button.addEventListener('click',()=>{selectTile(item.id);$('selection').scrollIntoView({behavior:'smooth',block:'start'});}); fragment.append(button);
      }
      $('thumbnails').replaceChildren(fragment);
    }
    function renderSelection() {
      current = visible.find(item=>item.id===state.tile) || visible.find(item=>item.id===manifest.defaultTile) || visible[0];
      $('empty').hidden = Boolean(current); $('content').hidden = !current; $('badge').hidden = !current;
      if(!current) {aerialRequest++;state.tile='';$('tile-id').textContent = 'NO MATCHES';$('tile-title').textContent = 'No locations found';$('game-image').removeAttribute('src');$('aerial-image').removeAttribute('src');}
      else {
        state.tile = current.id;
        $('tile-id').textContent = current.id; $('tile-title').textContent = current.label;
        $('badge').textContent = scopes[itemScope(current)] || 'Published baseline'; $('badge').dataset.area = itemScope(current);
        const game = $('game-image'); game.src = current.image; game.alt = `Game capture: ${current.label}, north up, ${current.size} m square`;
        const url = aerialURL(current,manifest.aerial), aerial = $('aerial-image');
        $('aerial-status').hidden = false; $('aerial-status').textContent = 'Loading live imagery…';
        const request=++aerialRequest;
        aerial.onload=null;aerial.onerror=null;aerial.removeAttribute('src');
        aerial.alt = `Live Esri aerial: ${current.label}, north up, ${current.size} m square`;
        const failed=()=>{if(!disposed && request===aerialRequest){$('aerial-status').hidden=false;$('aerial-status').textContent='Live aerial could not load. Select this tile again to retry, or open aerial at Esri.';}};
        aerialCache.get(url).then(objectURL=>{
          if(disposed || request!==aerialRequest)return;
          aerial.onload=()=>{if(request===aerialRequest)$('aerial-status').hidden=true;};aerial.onerror=failed;aerial.src=objectURL;
          if(aerial.complete && aerial.naturalWidth)$('aerial-status').hidden=true;
        }).catch(failed);
        $('aerial-link').href = url;
        $('source-link').textContent = current.gameSourceCommit.slice(0,7); $('source-link').href = sourceRoot + current.gameSourceCommit;
        $('capture-type').textContent = current.captureType === 'historical-survey' ? 'historical survey' : current.captureType === 'published-baseline' ? 'published baseline' : 'source capture';
        $('attribution').textContent = manifest.aerial?.attribution || 'Esri, Maxar, Earthstar Geographics, and the GIS User Community';
        $('coordinates').textContent = `${current.lat.toFixed(8)}° N, ${current.lon.toFixed(8)}° E`;
        $('pose').textContent = `${current.size} m square · north up${current.capturedAt?' · '+current.capturedAt.slice(0,10):''}`;
        $('maps-link').href = `https://www.google.com/maps/search/?api=1&query=${current.lat},${current.lon}`;
        $('streetview-link').href = `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${current.lat},${current.lon}`;
        $('position').textContent = `${visible.indexOf(current)+1} / ${visible.length}`; $('previous').disabled = visible.length<2; $('next').disabled = visible.length<2;
      }
      root.querySelectorAll('[data-id]').forEach(button=>button.setAttribute('aria-current',String(button.dataset.id===current?.id)));
    }
    function render(updateURL = false) {
      const latest = manifests.get(state.location), archive = state.archive && archives.get(archiveKey(state.location,state.archive));
      const unavailableArchive = Boolean(state.archive && !archive?.data);
      if(unavailableArchive) state.archive = '';
      manifest = archive?.data || latest;
      root.classList.toggle('cv-unavailable',!manifest);$('unavailable').hidden=Boolean(manifest);
      if(!manifest) {$('location').value='';$('unavailable').textContent='No comparison captures are published for this location yet. Choose an available location above.';if(updateURL)writeState();return;}
      const baselineCount = latest.items.filter(x=>x.dataset==='published').length, hasBaseline = baselineCount > 0; if(!hasBaseline || state.archive) state.baseline = false;
      collectionItems = state.archive ? manifest.items : manifest.items.filter(x=>state.baseline?x.dataset==='published':x.dataset!=='published');
      $('location').value = state.location;
      onLocation(state.location);
      const collection = $('collection'); collection.replaceChildren();
      const choices = [['survey',`District survey · ${latest.items.length-baselineCount} views`],...(hasBaseline?[['baseline',`${baselineCount} published baseline views`]]:[])];
      for(const history of latest.historicalCollections || []) {
        const saved = archives.get(archiveKey(state.location,history.manifest));
        if(saved) choices.push([`archive:${history.manifest}`,`Historical collection · ${history.frames ?? saved.data?.items.length ?? '?'} views${history.generatedAt?' · '+history.generatedAt.slice(0,10):''}`,saved.unavailable]);
      }
      for(const [value,text,disabled] of choices) {const option = document.createElement('option');option.value=value;option.textContent=text+(disabled?' · unavailable':'');option.disabled=!!disabled;collection.append(option);}
      collection.value = state.archive ? `archive:${state.archive}` : state.baseline?'baseline':'survey';
      $('collection-note').textContent = (unavailableArchive?'The requested historical collection is unavailable; showing the current survey. ':'')+(state.archive?'Historical evidence; it predates the current rebuild. Per-frame source revisions and capture dates are retained. ':'')+(manifest.collectionNotes?.[state.baseline?'published':'atlas'] || manifest.description || '');
      const scopeRoot = $('scopes'); scopeRoot.replaceChildren(); scopeRoot.hidden = state.baseline;
      if(!state.baseline) for(const [value,label] of Object.entries(scopes)) {
        const count = value==='all'?collectionItems.length:collectionItems.filter(x=>itemScope(x)===value).length;
        const button=document.createElement('button');button.type='button';button.dataset.scope=value;button.setAttribute('aria-pressed',String(state.scope===value));
        button.textContent = `${label} · ${count}`; button.addEventListener('click',()=>{clearTarget();state.scope=value;state.row='all';render(true);});scopeRoot.append(button);
      }
      $('target-note').hidden=!state.label;$('target-note').textContent=state.label?`District evidence for ${state.label}; no dedicated landmark pair.${Number.isFinite(state.lat)&&Number.isFinite(state.lon)?' Showing the nearest district survey tile.':''}`:'';
      $('scope-note').textContent = state.baseline ? 'Baseline views are selected locations, not a full district survey.' : state.scope==='core' ? 'Tiles intersect the playable area. Driving follows the loaded street network, with road closures at district edges; a tile is not entirely driveable.' : state.scope==='nearby' ? 'Nearby scenery surrounds the playable area by approximately 600 m. Its roads are scenery, not a continuous driving network.' : state.scope==='distant' ? 'Distant background beyond the detailed scenery ring. Visibility depends on camera height, position and weather. These images also expose remaining quality gaps.' : 'The complete survey includes playable streets, nearby scenery and distant background. These areas have different detail and driving coverage.';
      $('coverage-note').textContent = manifest.coverageNote || 'Scopes describe tile intersections with the playable area and its scenery ring.';
      $('review-note').textContent = `${manifest.reviewNote || 'The survey records visual evidence, not a claim of exact visual parity.'} Game cameras use perspective, so elevated roofs project larger than their ground footprints. Reference imagery is requested live from the official Esri service; acquisition date, season and registration can differ. Live aerials are cached in your browser for 15 minutes, including reloads when browser storage is available. If storage is unavailable, reuse lasts while this page remains open. No aerial or Street View images are stored in the repository.`;
      const rows = [...new Set(collectionItems.map(x=>x.row).filter(Number.isInteger))].sort((a,b)=>a-b);
      if(!rows.includes(Number(state.row))) state.row='all';
      const row = $('row'); row.replaceChildren();
      for(const value of ['all',...rows]) {const option=document.createElement('option');option.value=value;option.textContent=value==='all'?'All rows':`Row ${String(value).padStart(2,'0')}`;row.append(option);}
      row.value=state.row;row.disabled=state.baseline || !rows.length; $('query').value=state.query;
      visible=matchingItems();renderIndex();renderThumbnails();renderSelection();if(updateURL) writeState();
    }
    function move(delta) {if(visible.length>1) selectTile(visible[(visible.indexOf(current)+delta+visible.length)%visible.length].id);}
    function openZoom(kind) {
      if(!current || (kind==='aerial' && !$('aerial-status').hidden)) return;
      const img=kind==='game'?$('game-image'):$('aerial-image'); $('zoom-image').src=img.src;$('zoom-image').alt=img.alt;
      $('zoom-title').textContent=`${current.label} · ${kind==='game'?'Game capture':'Live Esri aerial'}`;
      $('zoom-caption').textContent=kind==='game'?`Original ${current.width} × ${current.height} · source ${current.gameSourceCommit} · ${current.size} m square, north up`:`${manifest.aerial?.attribution || 'Esri World Imagery'} · acquisition date unknown · ${current.size} m square, north up`;
      zoomScale=1;zoomWidth=kind==='game'?current.width:640;$('zoom-image').style.width=`${zoomWidth}px`;
      $('dialog').showModal();$('zoom-scroll').scrollTop=0;$('zoom-scroll').scrollLeft=0;
    }
    setLocationHandler = async options => {state={...defaultState(),location:state?.location || catalog.locations[0].id,...options};if(!Object.hasOwn(scopes,state.scope))state.scope='core';state.query=String(state.query || '').slice(0,160);state.label=String(state.label || '').slice(0,120);state=resolveTarget(state);render(true);return manifests.has(state.location);};
    state=readState();render();
    listen($('filters'),'submit',event=>event.preventDefault());
    listen($('query'),'input',event=>{clearTarget();state.query=event.target.value;render(true);});
    listen($('row'),'change',event=>{clearTarget();state.row=event.target.value;render(true);});
    listen($('reset'),'click',()=>{clearTarget();state.scope='core';state.row='all';state.query='';render(true);});
    listen($('location'),'change',event=>controller.setLocation(event.target.value));
    listen($('collection'),'change',event=>{clearTarget();const value=event.target.value;state.archive=value.startsWith('archive:')?value.slice(8):'';state.baseline=value==='baseline';state.scope=state.archive?'all':'core';state.row='all';state.query='';state.tile='';render(true);});
    listen($('previous'),'click',()=>move(-1));listen($('next'),'click',()=>move(1));
    const restore=()=>{state=readState();render();};listen(window,'popstate',restore);
    listen(root,'keydown',event=>{if($('dialog').open || event.ctrlKey || event.metaKey || event.altKey || /^(INPUT|SELECT|TEXTAREA)$/.test(event.target.tagName)) return;if(event.key==='ArrowLeft' || event.key==='ArrowRight') {event.preventDefault();move(event.key==='ArrowLeft'?-1:1);}});
    root.querySelectorAll('[data-zoom]').forEach(button=>listen(button,'click',()=>openZoom(button.dataset.zoom)));
    listen($('zoom-close'),'click',()=>$('dialog').close());
    listen($('dialog'),'close',()=>$('zoom-image').removeAttribute('src'));
    for(const [id,delta] of [['zoom-in',.25],['zoom-out',-.25]]) listen($(id),'click',()=>{zoomScale=Math.max(.5,Math.min(3,zoomScale+delta));$('zoom-image').style.width=`${zoomWidth*zoomScale}px`;});
    return controller;
  } catch(error) {
    if(!disposed) {root.replaceChildren(); const message=document.createElement('p');message.className='cv-message';message.setAttribute('role','status');message.textContent='Comparison data could not load. Refresh the page to retry.';root.append(message);console.error(error);}
    return controller;
  }
}
