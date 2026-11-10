// office-talk-all (cockpit-ui, round 5 note 37; gameplay's `office-talk` covers one stop): at every CV stop walk up to the NPC, E opens the conversation, continue the full story with the keyboard (Enter / Space alternating, real keydown events), check the answer count, the `cv-answer` events,
// that the dialogue fits the viewport, "Thanks, bye" (click) closes it, then leave by the exit. Registered by index.js.
import { SCENARIOS } from './scenarios.js';

SCENARIOS.push({
    id: 'office-talk-all', group: 'office', city: 'bucharest',
    title: 'Office conversation at every CV stop: E at the NPC, linear story via Enter / Space, complete cv-answer sections and finish exit',
    async run(H) {
        const g = H.g; const { STOPS } = await import('../../../src/data.js');
        const res = { stops: [] }; const events = []; const on = (e) => events.push(e.detail); addEventListener('cv-answer', on);
        const key = (code) => dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true }));
        try {
            for (const stop of STOPS) {
                const r = { stop: stop.id };
                g.enterOffice(stop); await H.run(0.3, () => g.state === 'office');
                const o = g.office; if (g.state !== 'office' || !o) { H.issue('office-talk-enter', 'high', `${stop.id}: office did not open`, {}, { key: 'otenter:' + stop.id }); continue; }
                if (!o.npc) { H.issue('office-talk-npc', 'high', `${stop.id}: no NPC in the office`, {}, { key: 'otnpc:' + stop.id }); }
                else {
                    // stand 2.5 m from the NPC, facing them, press E (an edge action, consumed by the office update)
                    const d = Math.hypot(o.x - o.npc.x, o.z - o.npc.z) || 1; o.x = o.npc.x + (o.x - o.npc.x) / d * 2.5; o.z = o.npc.z + (o.z - o.npc.z) / d * 2.5;
                    await H.run(0.1); H.press('KeyE'); await H.run(0.4, () => g.hud.panelOpen);
                    r.open = g.hud.panelOpen; r.first = o.read.size;
                    if (!r.open) H.issue('office-talk-open', 'high', `${stop.id}: E next to the ${o.npc.title} did not open the conversation`, {}, { shot: true, key: 'otopen:' + stop.id });
                    let guard = 0;
                    while (r.open && o.talking && guard++ < 32) { key(guard % 2 ? 'Enter' : 'Space'); await H.run(0.05); }
                    r.read = o.read.size; r.topics = o.stations.length;
                    if (r.read < r.topics) H.issue('office-talk-incomplete', 'high', `${stop.id}: only ${r.read}/${r.topics} story sections reachable with Continue`, {}, { key: 'otinc:' + stop.id });
                    const box = document.querySelector('#panel .dlg')?.getBoundingClientRect();
                    if (box && (box.left < -1 || box.right > innerWidth + 1 || box.top < -1 || box.bottom > innerHeight + 1)) H.issue('office-talk-offscreen', 'medium', `${stop.id}: dialogue box off-screen (${Math.round(box.left)},${Math.round(box.top)}–${Math.round(box.right)},${Math.round(box.bottom)})`, {}, { key: 'otoff:' + stop.id });
                    if (!H._otShot) { H._otShot = true; r.shot = await H.shot(`office-talk-${stop.id}`); }
                    await H.run(0.2);
                    r.closed = !g.hud.panelOpen && !o.talking;
                    if (!r.closed) { H.issue('office-talk-bye', 'high', `${stop.id}: Final Continue did not finish the conversation`, {}, { key: 'otbye:' + stop.id }); g.hud.closePanel(); await H.run(0.2); }
                }
                if (g.state !== 'office') {r.left=true;res.stops.push(r);continue;}
                if (!stop.poiRef) { // this stop's building is not in the loaded district (leaveOffice needs its door): close directly
                    o.dispose(); g.office = null; document.querySelector('#hud')?.classList.remove('in-office'); g.state = 'drive'; r.left = 'direct'; res.stops.push(r); continue;
                }
                o.x = 0; o.z = o.exitZ; await H.run(0.1); H.press('KeyE'); await H.run(0.6, () => g.state !== 'office');
                if (g.state === 'office') { H.issue('office-talk-leave', 'high', `${stop.id}: could not leave by the exit`, {}, { key: 'otleave:' + stop.id }); o.done = true; await H.run(0.3); }
                if (g.state === 'card') { const chm = await import('../../../src/chapters.js'); chm.closeChapterCard('free'); await H.run(0.2); }
                res.stops.push(r);
            }
        } finally { removeEventListener('cv-answer', on); }
        res.events = events.length;
        const expected = res.stops.reduce((a, r) => a + (r.topics || 0), 0);
        if (events.length < expected) H.issue('office-talk-events', 'medium', `cv-answer events ${events.length} < topics ${expected}`, {}, { key: 'otev' });
        return res;
    },
});
