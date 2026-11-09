// Individual evidence instances. Only the selected record and its game captures are loaded.
import { aerialURL, createAerialCache } from './comparison-viewer.js';
import { evidenceAsset, evidenceReport } from './evidence-paths.js';
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const https = value => { try { const u = new URL(value); return u.protocol === 'https:' ? u.href : null; } catch { return null; } };
const commit = sha => /^[a-f0-9]{40}$/.test(sha || '') ? `<a href="https://github.com/CalinaCristian/CalinaCristian.github.io/commit/${sha}">${sha.slice(0, 7)}</a>` : 'Source revision unavailable';
const list = values => `<ul>${(values || []).map(value => `<li>${esc(value)}</li>`).join('')}</ul>`;

export const mountLandmarkEvidence = (root, inventory) => mountEvidence(root, inventory.landmarks, 'landmark');
export const mountSpotEvidence = (root, inventory) => mountEvidence(root, inventory.spots, 'spot');
function mountEvidence(root, entries, kind) {
    const noun = kind === 'spot' ? 'Tourist destination' : 'Landmark', anchor = `${kind}-evidence`;
    const cache = createAerialCache();
    root.innerHTML = `<label>${noun}<select aria-label="${noun} evidence">${entries.map(lm => `<option value="${esc(lm.id)}">${esc(lm.name)} · ${lm.city === 'bucharest' ? 'Bucharest' : 'Washington'}</option>`).join('')}</select></label><div class="lm-evidence" aria-live="polite"></div>`;
    const select = root.querySelector('select'), body = root.querySelector('.lm-evidence');
    let request = 0;
    async function show(id, { navigate = true } = {}) {
        const lm = entries.find(value => value.id === id); if (!lm) return;
        const ticket = ++request; select.value = id;
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
        const captures = (record.captures || []).filter(capture => evidenceAsset(capture.image, {kind, id}));
        const historical = (record.historicalCollections || []).map(collection => {
            const images = (collection.captures || []).filter(capture => evidenceAsset(capture.image, {kind, id}));
            return `<details><summary>${esc(collection.label || collection.id)} · ${images.length} historical views</summary><p>Original source ${commit(collection.sourceCommit)} · ${esc(collection.updatedAt || '')}. Retained evidence from that revision.</p><div class="lm-captures">${images.map(capture => `<figure><a href="${esc(capture.image)}" target="_blank" rel="noopener"><img src="${esc(capture.image)}" alt="${esc(capture.label || lm.name + ' historical capture')}" loading="lazy" decoding="async"></a><figcaption>${esc(capture.label || capture.kind)} · historical game capture · ${commit(capture.sourceCommit || collection.sourceCommit)}${capture.capturedAt ? `<br>${esc(capture.capturedAt)}` : ''}</figcaption></figure>`).join('')}</div>${collection.remainingGaps?.length ? list(collection.remainingGaps) : ''}</details>`;
        }).join('');
        const nativeProofs = (record.nativeProofs || []).filter(proof => evidenceReport(proof.report));
        body.innerHTML = `<article><div class="lm-heading"><div><p class="eyebrow">${esc(record.id)} · ${esc(record.city)}</p><h4>${esc(record.name || lm.name)}</h4></div><span class="tag ${gaps.length ? 'pending' : 'sourced'}">${esc(record.status || 'Reviewed evidence')}</span></div>
          <p>Game source: ${commit(record.sourceCommit)}. ${esc(record.updatedAt || '')} Review coverage describes the evidence available; it does not establish exact visual parity.</p>
          ${record.implementationNotesUpdatedAt ? `<p class="lm-caption">Implementation notes updated ${esc(record.implementationNotesUpdatedAt)}. Study images retain their original capture dates and source revisions.</p>` : ''}
          ${record.improvements?.length ? `<h5>Source-led changes</h5>${list(record.improvements)}` : ''}
          ${gaps.length ? `<h5>Remaining gaps and estimates</h5>${list(gaps)}` : ''}
          <div class="lm-captures">${captures.map((capture, i) => `<figure><a href="${esc(capture.image)}" target="_blank" rel="noopener"><img src="${esc(capture.image)}" alt="${esc(capture.label || lm.name + ' game capture')}" loading="lazy" decoding="async"></a><figcaption>${esc(capture.label || capture.kind)} · game capture · ${commit(capture.sourceCommit || record.sourceCommit)}${capture.capturedAt ? `<br>${esc(capture.capturedAt)}` : ''}${capture.conditions ? `<br>${esc(typeof capture.conditions === 'string' ? capture.conditions : JSON.stringify(capture.conditions))}` : ''}</figcaption>${capture.limitations?.length ? list(capture.limitations) : ''}${capture.kind === 'top' && capture.comparison?.orientation === 'north-up' && [capture.comparison.lat, capture.comparison.lon, capture.comparison.size].every(Number.isFinite) ? `<div class="lm-aerial" data-aerial="${i}"><p role="status">Loading live aerial for this ground square…</p></div>` : `<p class="lm-caption">${kind === 'spot' ? 'Scene/view' : 'Model/view'} study. Reference links below; this is not a matched Street View photograph.</p>`}</figure>`).join('')}</div>
          ${nativeProofs.length ? `<details><summary>Native activity and access evidence</summary><ul>${nativeProofs.map(proof => `<li><a href="${esc(proof.report)}" target="_blank" rel="noopener">${esc(proof.label)}</a> · ${commit(proof.sourceCommit)} · ${proof.passed === true ? 'Passed within stated scope' : 'Open / retained finding'}<p>${esc(proof.scope || '')}</p>${proof.cases?.length ? list(proof.cases) : ''}</li>`).join('')}</ul></details>` : ''}
          ${historical ? `<h5>Earlier evidence</h5>${historical}` : ''}
          ${record.historicalImplementationNotes?.length ? `<details><summary>Earlier implementation notes (${record.historicalImplementationNotes.length})</summary><ul>${record.historicalImplementationNotes.map(note => `<li><b>${esc(note.field)}</b><p>${esc(typeof note.priorValue === 'string' ? note.priorValue : note.priorValue?.details || JSON.stringify(note.priorValue))}</p><small>Superseded ${esc(note.supersededAt)} · original record ${commit(note.priorRecordSnapshotCommit)}</small></li>`).join('')}</ul></details>` : ''}
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
    select.addEventListener('change', () => show(select.value));
    const fromLocation = () => { const id = new URL(location.href).searchParams.get(kind) || entries.find(entry => entry.evidence)?.id || entries[0]?.id; if (id) show(id, { navigate: false }); };
    addEventListener('popstate', fromLocation);
    const initial = new URL(location.href).searchParams.get(kind) || entries.find(lm => lm.evidence)?.id || entries[0]?.id;
    if (initial) show(initial, { navigate: false });
    return { show, dispose() { request++; cache.dispose(); removeEventListener('popstate', fromLocation); root.replaceChildren(); } };
}
