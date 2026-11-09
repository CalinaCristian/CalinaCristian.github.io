// Source/readiness evidence only: no scene or registry mutation.
// Run a static server at the repo root, then: node --require=/workspace/.environment/drive-my-cv/use-system-chromium.cjs handoffs/fidelity/tourist-us-portfolio/observe.cjs
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const out = __dirname;
const ids = ['pike-place', 'space-needle', 'fremont-troll', 'kerry-park', 'waterfront', 'pioneer-square', 'ballard-locks', 'gas-works', 'bel-lincoln-square', 'bel-downtown-park', 'bel-botanical-garden', 'bel-meydenbauer'];
const shots = new Set(['pike-place', 'space-needle', 'fremont-troll', 'kerry-park', 'waterfront', 'gas-works', 'bel-botanical-garden', 'bel-meydenbauer']);
(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--mute-audio', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'] });
  const results = [];
  try {
    for (const id of ids) {
      const context = await browser.newContext({ viewport: { width: 960, height: 540 } });
      const page = await context.newPage(); const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      try {
        await page.goto(`http://127.0.0.1:8147/game/dev/spots.html?id=${id}&manual=1&audit=0&q=low&ov=day&weather=clear&season=summer&date=2026-07-15T19:00:00Z&ui=0`);
        await page.waitForFunction(() => window.spotDev?.ready, { timeout: 90000 });
        const result = await page.evaluate(() => {
          const d = spotDev, s = d.session, p = s.spot;
          d.step(1, 1/30);
          const members = p.data.members.map(id => ({ id, spawn: p.spawns[id], activities: p.interactables.filter(a => !['plaque', 'guide'].includes(a.kind)).map(a => ({ kind:a.kind, x:a.x, y:a.y, z:a.z, r:a.r, label: typeof a.label === 'function' ? a.label(s) : a.label, enabled: !a.cond || a.cond(s), straightLineM: Math.round(Math.hypot(a.x-p.spawns[id].x,a.z-p.spawns[id].z)) })) }));
          return { id:p.entry.id, scene:p.data.id, loadMs:d.loadMs, timing:p.timing, sceneTriangles:p.tris, drawn:d.r3d.stats.triangles, drawCalls:d.r3d.stats.drawCalls, members, challenges:p.challenges, audit:d.audit().counts };
        });
        if (shots.has(id)) {
          await page.evaluate(id => { const d=spotDev, c=d.session.spot.challenges.find(c=>c.id===id); if(c) d.walkTo(c.x,c.z,c.bearing,c.pitch); d.step(2,1/30); }, id);
          await page.screenshot({ path:path.join(out,`${id}.jpg`), type:'jpeg', quality:78 });
        }
        result.errors = errors; results.push(result);
        fs.writeFileSync(path.join(out,'observed.json'),JSON.stringify({ date:'2026-11-08', sourceCommit:'a786ba6bb18c031432f0464c06e6a2fa93ad5dfe', browser:browser.version(), renderer:'system Chromium / SwiftShader', quality:'low', manual:true, note:'Load observations are local software-renderer observations, not target-GPU FPS or universal load guarantees. Activity distances are straight-line lower bounds, not traversed paths.', results },null,2)+'\n');
        console.log(JSON.stringify({id,loadMs:result.loadMs,tris:result.sceneTriangles,audit:result.audit,errors}));
      } catch (e) { results.push({id,error:e.message,errors}); console.log(JSON.stringify({id,error:e.message,errors})); }
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode=1; });
