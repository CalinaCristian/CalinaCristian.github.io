// Street/drone context is game-only evidence. It must never inherit the aerial
// viewer's north-up, equal-ground-square or matched-reference labels.
export async function mountPerspectiveViewer(element, { baseURL = new URL('./comparison-data/', import.meta.url), onLocation = () => {} } = {}) {
  const base = new URL(baseURL, document.baseURI), cache = new Map();
  let sequence = 0, selected = '', disposed = false;
  const node = (tag, text, className) => { const el = document.createElement(tag); if (text !== undefined) el.textContent = text; if (className) el.className = className; return el; };
  const json = async url => { const response = await fetch(url); if (!response.ok) throw new Error(`HTTP ${response.status}`); return response.json(); };
  const get = url => { const key = String(url); if (!cache.has(key)) cache.set(key, json(url).catch(error => { cache.delete(key); throw error; })); return cache.get(key); };
  const localAsset = (path, manifestURL) => {
    if (typeof path !== 'string' || !/^[a-zA-Z0-9_./-]+\.(?:png|jpe?g|webp)$/.test(path)) return null;
    const url = new URL(path, manifestURL), directory = new URL('./', manifestURL);
    return url.origin === directory.origin && url.pathname.startsWith(directory.pathname) ? url.href : null;
  };
  const root = node('div', undefined, 'perspective-viewer');
  const label = node('label', 'District'), select = document.createElement('select'), content = node('div');
  label.append(select); root.append(label, content); element.replaceChildren(root);
  const controller = { show, dispose() { disposed = true; sequence++; root.remove(); } };
  let catalog;
  try {
    catalog = await get(new URL('catalog.json', base));
    for (const place of catalog.locations) { const option = node('option', place.label); option.value = place.id; select.append(option); }
  } catch { content.append(node('p', 'Street and drone context collections are unavailable in this copy.', 'notice')); return controller; }
  select.addEventListener('change', () => { show(select.value); onLocation(select.value); });
  await show(new URL(location.href).searchParams.get('compareLocation') || catalog.locations[0]?.id);
  return controller;

  async function show(id) {
    if (disposed || id === selected) return;
    selected = id; const request = ++sequence, place = catalog?.locations.find(p => p.id === id);
    select.value = place?.id || ''; content.replaceChildren(node('p', 'Loading game context…', 'notice'));
    if (!place) { content.replaceChildren(node('p', 'No context collection is published for this district yet.', 'notice')); return; }
    try {
      const manifestURL = new URL(place.manifest, base), manifest = await get(manifestURL);
      if (disposed || request !== sequence) return;
      content.replaceChildren();
      const collections = (manifest.perspectiveCollections || []).filter(c => c.captureType === 'game-perspective-context' && c.comparisonCompatible === false && /^context\/[a-zA-Z0-9_/-]+\/manifest\.json$/.test(c.manifest || ''));
      if (!collections.length) content.append(node('p', 'Street-level, night and drone context has not been published for this district yet.', 'notice'));
      for (const collection of collections) {
        const details = document.createElement('details'), summary = node('summary', collection.label || 'Game context'), body = node('div', undefined, 'perspective-grid');
        details.append(summary, body); content.append(details);
        let loading = false, loaded = false;
        details.addEventListener('toggle', async () => {
          if (!details.open || loading || loaded) return;
          loading = true; body.replaceChildren(node('p', 'Loading captures…'));
          try {
            const url = new URL(collection.manifest, manifestURL), data = await get(url);
            if (disposed || request !== sequence) return;
            if (data.captureType !== 'game-perspective-context' || data.comparisonCompatible !== false) throw new Error('Incorrect context type');
            body.replaceChildren();
            for (const item of data.items || []) {
              const src = localAsset(item.image, url); if (!src) continue;
              const figure = document.createElement('figure'), image = document.createElement('img'), caption = document.createElement('figcaption');
              image.src = src; image.alt = item.label || item.id || 'Game context capture'; image.loading = 'lazy'; image.decoding = 'async';
              caption.append(node('b', item.label || item.id || 'Game context'));
              caption.append(node('p', 'GAME capture · perspective context · no matched aerial image'));
              const commit = item.gameSourceCommit || item.sourceCommit || data.gameSourceCommit || data.sourceCommit;
              if (/^[a-f0-9]{40}$/.test(commit || '')) { const link = node('a', commit.slice(0, 10)); link.href = `https://github.com/CalinaCristian/CalinaCristian.github.io/commit/${commit}`; caption.append(link); }
              const metadata = document.createElement('details'); metadata.append(node('summary', 'Camera, conditions and exercise coverage'), node('pre', JSON.stringify({ capturedAt: item.capturedAt || data.generatedAt, camera: item.camera || item.pose, conditions: item.condition || item.conditions || data.conditions, staticCamera: item.staticCamera, controllerExercised: item.controllerExercised }, null, 2)));
              caption.append(metadata); figure.append(image, caption); body.append(figure);
            }
            if (!body.children.length) body.append(node('p', 'No valid capture assets are present in this collection.'));
            loaded = true;
          } catch { body.replaceChildren(node('p', 'This collection could not load. Close and reopen it to retry.', 'notice')); }
          finally { loading = false; }
        });
      }
    } catch { if (!disposed && request === sequence) content.replaceChildren(node('p', 'Context metadata could not load. Select another district to retry.', 'notice')); }
  }
}
