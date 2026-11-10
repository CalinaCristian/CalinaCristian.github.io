import {mountConditionGallery} from './condition-gallery.js';
// Street/drone context is game-only evidence. It must never inherit the aerial
// viewer's north-up, equal-ground-square or matched-reference labels.
export function perspectiveTitle(item) {
  if (item.street) {
    const headings = ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'];
    const direction = Number.isFinite(item.heading) ? headings[Math.round(((item.heading % 360) + 360) % 360 / 45) % 8] : null;
    return `${item.street}${direction ? ' · looking ' + direction : ''}`;
  }
  return item.label || 'District view';
}

// A duplicate request is collapsed only when its recorded pixels, date and
// source are identical. Different images from the same pose remain visible.
export function perspectiveItems(items) {
  const byId = new Map(items.map(item => [item.id, item])), output = [], groups = new Map();
  for (const item of items) {
    const original = byId.get(item.duplicateOf), same = original && /^[a-f0-9]{64}$/.test(item.imageSha256 || '') && /^[a-f0-9]{40}$/.test(item.gameSourceCommit || '') && Number.isFinite(Date.parse(item.capturedAt)) && item.imageSha256 === original.imageSha256 && item.capturedAt === original.capturedAt && item.gameSourceCommit === original.gameSourceCommit;
    const key = same ? original : item;
    let group = groups.get(key);
    if (!group) { group = { item: same ? original : item, requests: [] }; groups.set(key, group); output.push(group); }
    group.requests.push(item);
  }
  return output;
}

function readableScope(streetWalk) {
  return streetWalk
    ? 'Street views sampled along public driving roads. Service roads, motorways, highway ramps and tunnels are excluded. Private roads, interiors and the wider surroundings are not fully covered.'
    : 'Game views from the listed locations and conditions. Camera and route notes describe what each capture covers; these are not matched aerial comparisons.';
}

export async function mountPerspectiveViewer(element, { baseURL = new URL('./comparison-data/', import.meta.url), onLocation = () => {} } = {}) {
  const base = new URL(baseURL, document.baseURI), cache = new Map();
  let sequence = 0, selected = '', disposed = false, conditionGallery;
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
  const controller = { show, dispose() { disposed = true; sequence++; conditionGallery?.dispose(); root.remove(); } };
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
    conditionGallery?.dispose();conditionGallery=null; selected = id; const request = ++sequence, place = catalog?.locations.find(p => p.id === id);
    select.value = place?.id || ''; content.replaceChildren(node('p', 'Loading game context…', 'notice'));
    if (!place) { content.replaceChildren(node('p', 'No context collection is published for this district yet.', 'notice')); return; }
    try {
      const manifestURL = new URL(place.manifest, base), manifest = await get(manifestURL);
      if (disposed || request !== sequence) return;
      content.replaceChildren();
      if(manifest.groundConditions && /^context\/[a-zA-Z0-9_/-]+\/manifest\.json$/.test(manifest.groundConditions.manifest||'')){
        const url=new URL(manifest.groundConditions.manifest,manifestURL),gallery=await get(url);
        if(disposed||request!==sequence)return;
        conditionGallery=mountConditionGallery(content,gallery,{resolveImage:path=>localAsset(path,url),manifestURL:url.href});return;
      }
      const collections = (manifest.perspectiveCollections || []).filter(c => c.captureType === 'game-perspective-context' && c.comparisonCompatible === false && /^context\/[a-zA-Z0-9_/-]+\/manifest\.json$/.test(c.manifest || ''));
      if (manifest.streetWalk?.manifest === 'street-walk/manifest.json') {
        const revision = manifest.streetWalk.gameSourceCommit;
        const historical = manifest.streetWalk.retakes?.length || (revision && manifest.gameSourceCommit && revision !== manifest.gameSourceCommit);
        collections.unshift({ manifest: manifest.streetWalk.manifest, label: historical ? 'Earlier street views' : 'Street views', note: manifest.collectionNotes?.streetWalk, captureIssues: manifest.streetWalk.captureIssues, streetWalk: true });
        for (const retake of [...(manifest.streetWalk.retakes || [])].reverse()) {
          if (/^street-walk\/retakes\/[a-zA-Z0-9_-]+\/manifest\.json$/.test(retake.manifest || '')) collections.unshift({ ...retake, streetWalk: true });
        }
      }
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
            if (collection.streetWalk ? !Array.isArray(data.items) || data.referenceImageryTracked !== false : data.captureType !== 'game-perspective-context' || data.comparisonCompatible !== false) throw new Error('Incorrect context type');
            body.replaceChildren();
            const rawItems = data.items || [], items = perspectiveItems(rawItems);
            const count = node('p', `${items.length} game pictures${items.length !== rawItems.length ? ' from ' + rawItems.length + ' recorded camera requests' : ''}. Original dates and source revisions are retained.`, 'notice');
            count.className = '';
            const collectionNote = node('div', undefined, 'notice');
            collectionNote.append(count, node('p', readableScope(collection.streetWalk)));
            if (data.presentationNote) collectionNote.append(node('p', data.presentationNote));
            body.append(collectionNote);
            let next = 0;
            const more = node('button', 'Show next 24 captures'); more.type = 'button';
            const appendPage = () => {
              more.remove();
              const end = Math.min(next + 24, items.length);
              for (; next < end; next++) {
              const { item, requests } = items[next];
              const src = localAsset(item.image, url); if (!src) continue;
              const figure = document.createElement('figure'), image = document.createElement('img'), caption = document.createElement('figcaption');
              image.src = src; image.alt = perspectiveTitle(item); image.loading = 'lazy'; image.decoding = 'async';
              caption.append(node('b', perspectiveTitle(item)));
              const height = Number.isFinite(item.h) ? ` · estimated height ${item.h} m above the modeled road` : '';
              caption.append(node('p', collection.streetWalk ? 'Game screenshot · fixed street camera' + height : 'Game screenshot · recorded perspective'));
              if (collection.streetWalk && item.cameraLevelAmbiguity) caption.append(node('p', 'The road level at this camera position needs checking.', 'notice'));
              const issues = (collection.captureIssues || data.captureIssues || []).filter(issue => requests.some(request => issue.poseIds?.includes(request.id)));
              for (const issue of issues) if (issue.description) caption.append(node('p', issue.description, 'notice'));
              if (requests.length > 1) caption.append(node('p', 'The same picture serves both identical camera requests.'));
              const date = item.capturedAt || data.generatedAt;
              if (date && Number.isFinite(Date.parse(date))) caption.append(node('p', 'Captured ' + new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })));
              if (collection.streetWalk && /^https:\/\/www\.google\.com\/maps\//.test(item.reference?.url || '')) {
                const reference = node('a', `Open reference panorama${item.reference.date ? ' · '+item.reference.date : ''}`);
                reference.href = item.reference.url; reference.target = '_blank'; reference.rel = 'noopener'; caption.append(reference);
              }
              const commit = item.gameSourceCommit || item.sourceCommit || data.gameSourceCommit || data.sourceCommit;
              let sourceLink;
              if (/^[a-f0-9]{40}$/.test(commit || '')) { sourceLink = node('a', 'Game source revision'); sourceLink.href = `https://github.com/CalinaCristian/CalinaCristian.github.io/commit/${commit}`; }
              const metadata = document.createElement('details'); metadata.append(node('summary', 'Camera and capture details'), node('pre', JSON.stringify({ captureId:item.id, recordedRequests:requests.map(request => request.id), capturedAt: date, sourceCommit:commit, originalScope:data.scope, originalCollectionNote:collection.note, reference:item.reference, camera: item.camera || item.pose || { x:item.x, z:item.z, y:item.cameraY, heightAboveModeledRoad:item.h, heading:item.heading, pitch:item.pitch, fov:item.fov, sourceEdge:item.cameraSourceEdge, levelAmbiguity:item.cameraLevelAmbiguity }, conditions: item.condition || item.conditions || data.conditions || item.captureSettings, staticCamera: item.staticCamera ?? Boolean(collection.streetWalk), controllerExercised: item.controllerExercised ?? (collection.streetWalk ? false : undefined), renderer:item.renderer, perf:item.perf, exercise:item.exercise, limitations:item.limitations }, null, 2)));
              if (sourceLink) { const sourceParagraph = node('p'); sourceParagraph.append(sourceLink); metadata.append(sourceParagraph); }
              caption.append(metadata); figure.append(image, caption); body.append(figure);
              }
              count.textContent = `${next} of ${items.length} game pictures shown${items.length !== rawItems.length ? ' · ' + rawItems.length + ' recorded requests retained' : ''}. Original dates and source revisions are retained.`;
              if (next < items.length) body.append(more);
            };
            more.addEventListener('click', appendPage); appendPage();
            if (!items.length) body.append(node('p', 'No valid capture assets are present in this collection.'));
            loaded = true;
          } catch { body.replaceChildren(node('p', 'This collection could not load. Close and reopen it to retry.', 'notice')); }
          finally { loading = false; }
        });
      }
    } catch { if (!disposed && request === sequence) content.replaceChildren(node('p', 'Context metadata could not load. Select another district to retry.', 'notice')); }
  }
}
