// Individual evidence instances. Only the selected record and its game captures are loaded.
import { aerialURL, createAerialCache } from './comparison-viewer.js';
import { evidenceAsset, evidenceReport } from './evidence-paths.js';
import {mountEvidencePicker} from './evidence-picker.js';
import {landmarkRangeSummary,landmarkRangeContexts} from './landmark-ranges.js';
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const https = value => { try { const u = new URL(value); return u.protocol === 'https:' ? u.href : null; } catch { return null; } };
const commit = sha => /^[a-f0-9]{40}$/.test(sha || '') ? `<a href="https://github.com/CalinaCristian/CalinaCristian.github.io/commit/${sha}">${sha.slice(0, 7)}</a>` : 'Source revision unavailable';
const list = values => `<ul>${(values || []).map(value => `<li>${esc(value)}</li>`).join('')}</ul>`;
const captureDate = value => {const date=new Date(value);return Number.isFinite(date.getTime())?new Intl.DateTimeFormat('en-GB',{timeZone:'America/Los_Angeles',day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}).format(date)+' Pacific':String(value||'');};
const cityName = city => ({bucharest: 'Bucharest', seattle: 'Seattle', bellevue: 'Bellevue'}[city] || city);
const validationPurpose = capture => ({arrival: 'Native entry position', 'activity-approach': 'Native access-check endpoint', phone: 'Condition-control validation · canvas only, without phone HUD', activity: 'Native activity validation'}[capture.kind] || capture.label || 'Native validation frame');
function visitGallery(record, id, name) {
    const gallery = record.visitorGallery;
    if (!gallery) return '';
    const views = (gallery.captures || []).filter(capture => evidenceAsset(capture.image, {kind: 'spot', id}));
    const retained = (gallery.retainedIllustrations || []).filter(capture => evidenceAsset(capture.image, {kind: 'spot', id}));
    const figure = capture => `<figure class="${capture.fullPageHUD ? 'visit-phone' : 'visit-scene'}"><a href="${esc(capture.image)}" target="_blank" rel="noopener"><img src="${esc(capture.image)}" alt="${esc(capture.label || name + ' game scene')}" loading="lazy" decoding="async" width="${capture.viewport.width}" height="${capture.viewport.height}"></a><figcaption><b>${esc(capture.label)}</b><br>${esc(capture.purpose)}<br>${esc(capture.viewport.width)} × ${esc(capture.viewport.height)} · ${esc(captureDate(capture.capturedAt))} · ${commit(capture.sourceCommit)}</figcaption></figure>`;
    return `<section class="visit-preview" aria-label="Visit preview"><p class="notice"><b>Staging game preview.</b> ${esc(gallery.notice)} Source ${commit(gallery.sourceCommit)}. These are game illustrations; independent visual comparison remains open.</p><div class="visit-gallery visit-primary">${views.map(figure).join('')}</div><details><summary>Viewpoint and capture details</summary><p>${esc(gallery.setup)} No reference imagery is embedded. Open any image for its original dimensions.</p>${gallery.limitations?.length ? list(gallery.limitations) : ''}<ul>${[...(gallery.reports || []), ...(gallery.report ? [{report: gallery.report, label: 'Visitor capture manifest'}] : [])].filter(proof => evidenceReport(proof.report)).map(proof => `<li><a href="${esc(proof.report)}" target="_blank" rel="noopener">${esc(proof.label)}</a></li>`).join('')}</ul></details>${retained.length ? `<details class="visit-retained"><summary>Earlier preview framing · ${retained.length} retained images</summary><p>Original attempts from this staging capture session, with their actual source and time. The final views above have their own capture records.</p><div class="visit-gallery">${retained.map(figure).join('')}</div></details>` : ''}</section>`;
}

export const mountLandmarkEvidence = (root, inventory) => mountEvidence(root, inventory.landmarks, 'landmark');
export const mountSpotEvidence = (root, inventory) => mountEvidence(root, inventory.spots.filter(entry=>entry.menuAvailable), 'spot');
function mountEvidence(root, entries, kind) {
    const noun = kind === 'spot' ? 'Tourist destination' : 'Landmark', anchor = `${kind}-evidence`;
    const cache = createAerialCache();
    root.innerHTML = '<div class="evidence-picker-host"></div><div class="lm-evidence" aria-live="polite"></div>';
    const body = root.querySelector('.lm-evidence'), picker=mountEvidencePicker(root.querySelector('.evidence-picker-host'),{entries,kind,onSelect:id=>show(id)});
    let request = 0;
    async function show(id, { navigate = true } = {}) {
        const lm = entries.find(value => value.id === id); if (!lm) return;
        const ticket = ++request; picker.setValue(id);
        if (navigate) { const url = new URL(location.href); url.searchParams.set(kind, id); url.hash = anchor; history.pushState(null, '', url); }
        body.innerHTML = `<h4>${esc(lm.name)}</h4><p role="status">Loading dedicated evidence…</p>`;
        let record;
        try {
            if (!lm.evidence) throw new Error('No reviewed evidence record has been published for this entry.');
            const response = await fetch(lm.evidence); if (!response.ok) throw new Error(`Evidence HTTP ${response.status}`);
            record = await response.json();
            if (record.schemaVersion !== 1 || record.id !== id || record.city !== lm.city) throw new Error(`Evidence identity does not match this ${kind}.`);
        } catch (error) {
            if (ticket !== request) return;
            body.innerHTML = `<h4>${esc(lm.name)}</h4><p class="notice">${esc(error.message)} Catalogue membership is not fidelity acceptance.</p>`; return;
        }
        if (ticket !== request) return;
        const sources = (record.sources || []).map(source => { const url = https(source.url); return url ? `<li><a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(source.label || source.url)}</a>${source.type ? ` · ${esc(source.type)}` : ''}</li>` : ''; }).join('');
        const gaps = record.remainingGaps || [];
        const captures = (kind === 'spot' && record.visitorGallery ? [] : record.captures || []).filter(capture => evidenceAsset(capture.image, {kind, id}));
        const nativeProofs = (record.nativeProofs || []).filter(proof => evidenceReport(proof.report));
        const ranges=kind==='landmark'?landmarkRangeContexts(lm):[];
        body.innerHTML = `<article data-evidence-id="${esc(id)}"><div class="lm-heading"><div><p class="eyebrow">${kind === 'spot' ? `Tourist visit · ${esc(cityName(record.city))}` : `${esc(record.id)} · ${esc(record.city)}`}</p><h4>${esc(lm.name)}</h4></div><span class="tag ${gaps.length ? 'pending' : 'sourced'}">${esc(kind === 'spot' ? (record.status || 'Reviewed evidence').replaceAll('_', ' ') : record.status || 'Reviewed evidence')}</span></div>
          ${kind === 'spot' ? visitGallery(record, id, lm.name) : ''}
          ${kind==='landmark'?`<p class="eyebrow range-label">Viewing range by district</p><div class="landmark-ranges" aria-label="Landmark viewing ranges">${ranges.length?ranges.map(c=>`<span class="range-chip range-${esc(c.range)}" title="${esc([c.distance,c.modelScope].filter(Boolean).join(' · '))}">${esc(c.label)} <small>· ${esc(c.name)}${c.distance?' · '+esc(c.distance):''}</small></span>`).join(''):'<span class="range-chip">Outside currently covered views</span>'}</div><p class="lm-caption">Staging viewing ranges: close range, nearby scenery or distant backdrop. Camera direction, weather and occlusion determine what is actually in view. Model quality gaps remain listed below; tourist scenes may use a separate model.</p>`:''}
          <p>${kind === 'spot' && record.name !== lm.name ? 'Original record: '+esc(record.name)+'. ' : ''}${kind === 'spot' ? 'Original validation record source' : 'Game source'}: ${commit(record.sourceCommit)}. ${esc(record.updatedAt || '')} Review coverage describes the evidence available; it does not establish exact visual parity.</p>
          ${record.implementationNotesUpdatedAt ? `<p class="lm-caption">Implementation notes updated ${esc(record.implementationNotesUpdatedAt)}. Study images retain their original capture dates and source revisions.</p>` : ''}
          ${record.improvements?.length ? `<h5>Source-led changes</h5>${list(record.improvements)}` : ''}
          ${gaps.length ? `<h5>Remaining gaps and estimates</h5>${list(gaps)}` : ''}
          <div class="lm-captures">${captures.map((capture, i) => `<figure><a href="${esc(capture.image)}" target="_blank" rel="noopener"><img src="${esc(capture.image)}" alt="${esc(kind === 'spot' ? validationPurpose(capture) : capture.label || lm.name + ' game capture')}" loading="lazy" decoding="async"></a><figcaption>${esc(kind === 'spot' ? validationPurpose(capture) : capture.label || capture.kind)} · game capture · ${commit(capture.sourceCommit || record.sourceCommit)}${capture.capturedAt ? `<br>${esc(captureDate(capture.capturedAt))}` : ''}${capture.conditions ? `<br>${esc(typeof capture.conditions === 'string' ? capture.conditions : JSON.stringify(capture.conditions))}` : ''}</figcaption>${kind === 'spot' && capture.label ? `<p class="lm-caption">Original label: ${esc(capture.label)}</p>` : ''}${capture.limitations?.length ? list(capture.limitations) : ''}${capture.kind === 'top' && capture.comparison?.orientation === 'north-up' && [capture.comparison.lat, capture.comparison.lon, capture.comparison.size].every(Number.isFinite) ? `<div class="lm-aerial" data-aerial="${i}"><p role="status">Loading live aerial for this ground square…</p></div>` : `<p class="lm-caption">${kind === 'spot' ? 'Validation view' : 'Model/view'} study. Reference links below; this is not a matched Street View photograph.</p>`}</figure>`).join('')}</div>

          ${nativeProofs.length ? `<details><summary>Native activity and access evidence</summary><ul>${nativeProofs.map(proof => `<li><a href="${esc(proof.report)}" target="_blank" rel="noopener">${esc(proof.label)}</a> · ${commit(proof.sourceCommit)} · ${proof.passed === true ? 'Passed within stated scope' : 'Open / retained finding'}<p>${esc(proof.scope || '')}</p>${proof.cases?.length ? list(proof.cases) : ''}</li>`).join('')}</ul></details>` : ''}
          ${record.perf ? `<p class="notice">${Number.isFinite(record.perf.triangles) ? `${record.perf.triangles.toLocaleString()} triangles. ` : ''}${Number.isFinite(record.perf.drawCalls) ? `${record.perf.drawCalls} draw calls. ` : ''}${esc(record.perf.note || 'Focused capture; not a full district traffic budget.')}</p>` : ''}
          ${record.checks?.length ? `<details><summary>Verification checks</summary><ul>${record.checks.map(check => `<li>${check.passed === true ? 'Passed' : check.passed === false ? 'Open' : 'Recorded'}: ${esc(check.label)}${check.details ? ` · ${esc(typeof check.details === 'string' ? check.details : JSON.stringify(check.details))}` : ''}</li>`).join('')}</ul></details>` : ''}
          <details open><summary>Sources and independent references</summary><ul>${sources || '<li>No independently linked reference published yet.</li>'}</ul><p>Street View is comparison-only. Reference imagery is not copied into the game or this site. Live aerial images stay in the browser for 15 minutes, including reloads where storage is available; acquisition dates may differ.</p></details></article>`;
        for (const target of body.querySelectorAll('[data-aerial]')) {
            const capture = captures[Number(target.dataset.aerial)], url = aerialURL(capture.comparison);
            cache.get(url).then(image => {
                if (ticket !== request || !target.isConnected) return;
                target.innerHTML = `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer"><img src="${esc(image)}" alt="Live north-up aerial at the same coordinates and ground-square size" loading="lazy"></a><p class="lm-caption">Live Esri World Imagery · ${esc(capture.comparison.size)}m north-up ground square · Esri, Maxar, Earthstar Geographics and the GIS User Community</p>`;
            }).catch(() => { if (ticket === request) target.innerHTML = `<p class="notice">Live aerial is unavailable. <a href="${esc(url)}" target="_blank" rel="noopener noreferrer">Open official aerial</a></p>`; });
        }
    }
    const fromLocation = () => { const id = new URL(location.href).searchParams.get(kind) || entries.find(entry => entry.evidence)?.id || entries[0]?.id; if (id) show(id, { navigate: false }); };
    addEventListener('popstate', fromLocation);
    const initial = new URL(location.href).searchParams.get(kind) || entries.find(lm => lm.evidence)?.id || entries[0]?.id;
    if (initial) show(initial, { navigate: false });
    return { show, dispose() { request++; picker.dispose();cache.dispose(); removeEventListener('popstate', fromLocation); root.replaceChildren(); } };
}
