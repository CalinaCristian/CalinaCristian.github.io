// Report writer: report/latest.json + report/latest.md + a stdout summary.
'use strict';
const fs = require('fs');
const path = require('path');

const SEV = { high: 0, medium: 1, low: 2 };
const isAudit = (i) => /^audit/.test(i.scenario || '');

function loc(i) {
    if (i.x === undefined) return '';
    const ll = i.lat !== undefined ? ` · ${i.lat}, ${i.lon}` : '';
    return `(${i.x}, ${i.z})${ll}`;
}
function group(list) {
    const m = new Map();
    for (const i of list) { const k = i.type; if (!m.has(k)) m.set(k, { type: k, severity: i.severity, n: 0, occurrences: 0, items: [] }); const g = m.get(k); g.n++; g.occurrences += i.count || 1; g.items.push(i); if (SEV[i.severity] < SEV[g.severity]) g.severity = i.severity; }
    return [...m.values()].sort((a, b) => SEV[a.severity] - SEV[b.severity] || b.n - a.n);
}
const esc = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');

function writeReport({ outDir, args, issues, nodeIssues, audits, scenarioResults, perf, durationSec, harnessLog }) {
    const dyn = issues.filter(i => !isAudit(i)).concat(nodeIssues);
    const aud = issues.filter(isAudit);
    const count = (list, sev) => list.filter(i => i.severity === sev).length;
    const summary = {
        dynamic: { high: count(dyn, 'high'), medium: count(dyn, 'medium'), low: count(dyn, 'low'), byType: Object.fromEntries(group(dyn).map(g => [g.type, g.n])) },
        audit: Object.fromEntries(Object.keys(audits).map(c => [c, { high: count(aud.filter(i => i.city === c), 'high'), medium: count(aud.filter(i => i.city === c), 'medium'), low: count(aud.filter(i => i.city === c), 'low'), byType: audits[c].counts }])),
    };
    const json = {
        generated: new Date().toISOString(), durationSec: Math.round(durationSec), args, perf, summary,
        scenarios: scenarioResults,
        issues: dyn.sort((a, b) => SEV[a.severity] - SEV[b.severity]),
        audit: Object.fromEntries(Object.keys(audits).map(c => [c, { stats: audits[c], issues: aud.filter(i => i.city === c) }])),
        logTail: (harnessLog || []).slice(-300),
    };
    fs.writeFileSync(path.join(outDir, 'latest.json'), JSON.stringify(json, null, 1));
    fs.writeFileSync(path.join(outDir, 'latest.log'), (harnessLog || []).join('\n') + '\n');

    // ---------------------------------------------------------------- markdown
    const L = [];
    L.push(`# Play-test harness report`, '');
    L.push(`Generated ${json.generated} · ${Math.round(durationSec)} s wall · viewport ${args.width}×${args.height} · quality low (software GL) · traffic ${args.traffic} · physics ${Math.round(1 / args.dt)} Hz`, '');
    L.push(`**Driving scenarios:** ${summary.dynamic.high} high · ${summary.dynamic.medium} medium · ${summary.dynamic.low} low (distinct issues; "×n" = occurrences)`, '');
    for (const [c, s] of Object.entries(summary.audit)) L.push(`**Static audit ${c}:** ${s.high} high · ${s.medium} medium · ${s.low} low`, '');
    if (scenarioResults.length) {
        L.push('## Scenarios', '', '| id | city | result | sim s | wall s | new issues | notes |', '|---|---|---|---:|---:|---:|---|');
        for (const r of scenarioResults) {
            const res = r.result || {};
            let ok = r.error ? 'ERROR' : (res.ok === false ? 'FAIL' : (res.drive && res.drive.ok === false) ? 'FAIL' : 'ran');
            if (r.id.startsWith('b:') && res.ok) ok = 'ok';
            if (r.id === 'c' && (res.stops || []).some(x => !x.ok)) ok = 'FAIL';
            if (r.id === 'f' && (res.finale === false || (res.legs || []).some(l => l.ok === false))) ok = 'FAIL';
            const notes = r.error ? esc(r.error.split('\n')[0]) : scenarioNote(r.id, res);
            L.push(`| ${r.id} | ${r.city} | ${ok} | ${r.simSec ?? ''} | ${((r.wallMs || 0) / 1000).toFixed(1)} | ${r.newIssues ?? ''} | ${notes} |`);
        }
        L.push('');
    }
    if (dyn.length) {
        L.push('## Issues found while driving (grouped by type)', '', '| type | severity | distinct | occurrences |', '|---|---|---:|---:|');
        const gs = group(dyn);
        for (const g of gs) L.push(`| ${g.type} | ${g.severity} | ${g.n} | ${g.occurrences} |`);
        L.push('');
        for (const g of gs) {
            L.push(`### ${g.type} (${g.severity}, ${g.n})`, '');
            if (g.type === 'vehicle-overlap') {
                const n = g.items.length, pc = (f) => Math.round(g.items.filter(f).length / n * 100) + '%';
                L.push(`Breakdown: ${pc(i => i.data?.nearJunction)} near a junction, ${pc(i => i.data?.parked?.some(Boolean))} involve a parked car, ${pc(i => i.data?.sameEdge)} on the same edge, ${pc(i => i.data?.speeds && Math.max(...i.data.speeds) < 0.5)} both stationary, ${pc(i => /tram/.test(i.msg))} involve a tram.`, '');
            }
            for (const i of g.items.sort((a, b) => SEV[a.severity] - SEV[b.severity] || (b.count || 1) - (a.count || 1)).slice(0, 8)) {
                L.push(`- **${esc(i.severity)}** [${esc(i.scenario)} · ${esc(i.city)}] ${esc(i.msg)} — ${esc(i.street || '')} ${loc(i)}${(i.count || 1) > 1 ? ` ×${i.count}` : ''}${i.shot ? ` — ![shot](${i.shot})` : ''}`);
            }
            if (g.items.length > 8) L.push(`- … ${g.items.length - 8} more in latest.json`);
            L.push('');
        }
    }
    for (const c of Object.keys(audits)) {
        const a = audits[c]; const list = aud.filter(i => i.city === c);
        L.push(`## Static world audit — ${c}`, '');
        L.push(`${a.edges} drivable edges, ${a.nodes} nodes, ${a.colliders} colliders, ${a.lamps} lamps, ${a.elevatedEdges} elevated edges, ${a.vehicles} vehicles / ${a.peds} pedestrians spawned (around the spawn) · ${a.ms} ms`, '');
        for (const [k, v] of Object.entries(a.selfCheck || {})) L.push(`${k}(): ${v.counts ? Object.entries(v.counts).map(([a, b]) => `${a} ${b}`).join(', ') : `blocked ${v.blocked}, dead ends ${v.deadEnds}`} (the world's own self-check; samples listed below as \`${k}:*\`)`, '');
        const gs = group(list);
        if (!gs.length) { L.push('Clean.', ''); continue; }
        L.push('| type | severity | count |', '|---|---|---:|');
        for (const g of gs) L.push(`| ${g.type} | ${g.severity} | ${a.counts[g.type] ?? g.n} |`);
        L.push('');
        for (const g of gs) {
            L.push(`### ${c}: ${g.type} (${a.counts[g.type] ?? g.n})`, '');
            const items = g.items.sort((x, y) => SEV[x.severity] - SEV[y.severity] || (y.data?.depth ?? y.data?.worst ?? y.data?.samples ?? 0) - (x.data?.depth ?? x.data?.worst ?? x.data?.samples ?? 0));
            for (const i of items.slice(0, 15)) L.push(`- **${i.severity}** ${esc(i.msg)} — ${esc(i.street || '')} ${loc(i)}`);
            if (items.length > 15) L.push(`- … ${items.length - 15} more in latest.json (\`audit.${c}.issues\`)`);
            L.push('');
        }
    }
    L.push('## Caveats', '',
        '- Software GL (SwiftShader): the simulation is stepped at a fixed dt with rendering only for screenshots, so fps numbers are not meaningful; the fps issue is informational (low).',
        '- Traffic, pedestrians and the spawn-overlap audit only cover the ~650 m simulation bubble around the player.',
        '- Collider kinds (tree / lamp / post…) are inferred from radius; world.js does not tag them.',
        '- "invisible-collision" fires when the car is pushed for 2 s at < 0.5 m/s with no vehicle, collider, pedestrian or map edge within ~4 m ahead.', '');
    fs.writeFileSync(path.join(outDir, 'latest.md'), L.join('\n'));

    // ---------------------------------------------------------------- stdout
    const S = [];
    S.push(`=== harness: ${scenarioResults.length} scenario runs in ${Math.round(durationSec)} s ===`);
    S.push(`driving issues: ${summary.dynamic.high} high, ${summary.dynamic.medium} medium, ${summary.dynamic.low} low`);
    for (const g of group(dyn)) S.push(`  ${g.severity.padEnd(6)} ${g.type.padEnd(26)} ${String(g.n).padStart(4)}  e.g. ${g.items[0].msg.slice(0, 110)}${g.items[0].street ? ' @ ' + g.items[0].street : ''}`);
    for (const [c, s] of Object.entries(summary.audit)) {
        S.push(`static audit ${c}: ${s.high} high, ${s.medium} medium, ${s.low} low`);
        for (const [t, n] of Object.entries(s.byType)) S.push(`  ${t.padEnd(26)} ${n}`);
    }
    S.push(`report: ${path.relative(process.cwd(), path.join(outDir, 'latest.md'))} (+ latest.json, shots/)`);
    const high = summary.dynamic.high + Object.values(summary.audit).reduce((a, s) => a + s.high, 0);
    return { high, summaryText: S.join('\n') };
}
function scenarioNote(id, r) {
    try {
        if (id.startsWith('b:')) return esc(r.street ? `${r.street}: ${r.ok ? 'reached' : r.reason} ${r.dist ?? ''} m in ${r.t ?? ''} s${r.resets ? `, ${r.resets} resets` : ''}; via ${(r.via || []).join(', ')}` : (r.reason || ''));
        if (id === 'a') return esc(`spawn ${r.spawn?.street} ${r.problems?.length ? '— ' + r.problems.join('; ') : 'ok'}; nav "${r.navline || '—'}"; first 150 m ${r.drive ? (r.drive.ok ? 'ok' : r.drive.reason) : 'not driven'}${r.noObjective ? ' (no objective: drove ahead)' : ''}`);
        if (id === 'c') return esc((r.stops || []).map(s => `${s.stop}:${s.ok ? 'ok' : 'FAIL'}`).join(' '));
        if (id === 'd') return esc(`${r.station} ${r.ok ? 'refuelled' : 'FAILED'} (${r.dist} m, fuel ${r.fuel})`);
        if (id === 'e') return esc((r.targets || []).map(t => `${t.id}:${t.ok ? (t.drive?.ok ? 'ok' : 'landed') : 'FAIL'}`).join(' '));
        if (id === 'f') return esc((r.legs || []).map(l => `${l.name}:${l.ok ? 'ok' : l.reason || 'fail'}`).join(' · ') + ` · finale ${r.finale ? 'ok' : 'MISSING'}`);
        if (id === 'g') return esc(`night lights ${r.nightLights}, headlights ${r.headlightsOn}, lamp swaps/s ${r.lampSwapsPerSec}; drive ${r.drive?.ok ? 'ok' : r.drive?.reason}`);
        if (id === 'h') return esc(`wall touched ${r.wall?.touched} at ${r.wall?.impactSpeed} m/s; reset ${r.reset?.problems?.length ? 'BAD' : 'ok'}; after reset ${r.afterReset?.ok ? 'ok' : r.afterReset?.reason}; prop ${r.prop ? (r.prop.passedThrough ? 'PASSED THROUGH' : 'blocked') : 'n/a'}`);
        if (id === 'i') return esc(`${r.approached} came up behind, ${r.passed} got past, max queue ${r.maxQueue}, longest wait ${r.longestStillBehind} s`);
    } catch { /* ignore */ }
    return '';
}
module.exports = { writeReport };
