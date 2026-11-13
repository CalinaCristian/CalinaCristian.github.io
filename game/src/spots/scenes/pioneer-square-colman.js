// ============================================================================
//  Pioneer Square west end — Colman Dock dressing (r3-sea-spots-b-3), from the live OSM database (API 0.6 map call,
//  2026-11-13, bbox −122.3398, 47.6000, −122.3350, 47.6040; scene metres, rounded to 0.1 m) and the dossier's notes:
//  - Water Taxi / Fast Ferries Terminal (w226321140: building=transportation, 1 level, layer 1) — "a low grey shed"
//    (panorama 96BnTtZETD_9PxJd3_oy9w); drawn as that shed with a glazed waiting room, a flat roof overhanging as a canopy
//    and its name; the 2-level terminal block at the end of its pier (w736858270, layer 2) and the two flights up to it
//    (steps w736858271, w736858273).
//  - The WSF terminal's roof canopy (w1251064470: amenity=shelter, building=roof, layer 3, material=metal) over the slip
//    approach, on posts; its stairs (w1194539050, lit concrete; w1436091947, layer 1).
//  - The ferry slips (man_made=pier, mooring=ferry: w389138743, w448857944, w448857945, w1241786940; the Water Taxi pier
//    w51817331 is part of the coastline's land): steel aprons at dock level on piles, a pair of white transfer-span towers
//    at each slip's outer end where the mapped outline widens into the wing walls.
//  - Waterfront Trail benches (n14145559226 … 39) and lamps (n14005374592, n14005381663, n14005403057, n14005408300,
//    n14145559225) mapped since the extract: added to the spot's furniture so the shared builder draws them.
//  Heights (shed 4.6 m, canopy 10.5 m, the 2-level block 7.2 m, flight rises, apron thickness, tower height 9 m, post
//  spacing) and colours are estimates.
// ============================================================================
import { GeoBatch, inPoly, polyBox, obb } from '../kit.js';
import { signBoard } from '../props.js';
import { gableFrame, gableRoof } from '../gable-plan.js';

export const COLMAN = {
    taxi: [[-266.8, 25.3], [-276.6, 25.2], [-308.9, 25], [-312.5, 19.5], [-316.2, 13.6], [-316.5, 13.1], [-220.7, 13.3], [-217.1, 11.8], [-214.9, 10.9], [-215, 17.7], [-267, 17.9]],
    taxiEnd: [[-340.7, 12.9], [-333.7, 12.9], [-333.7, 16.4], [-340.7, 16.4]],
    taxiSteps: [[[-327.6, 13.3], [-331.2, 12.7]], [[-319.2, 13.5], [-324.2, 13.5]]],
    canopy: [[-343.2, -99], [-338.5, -105.3], [-334.4, -109.9], [-329.9, -114], [-324.1, -118.8], [-318.8, -122.4], [-312.3, -126.3], [-306.3, -128.9], [-299.6, -131.7], [-295.1, -133.2], [-290.7, -134.1], [-292.4, -136.8], [-294.2, -139.7], [-304, -134.6], [-305.7, -134.1], [-307.7, -133.4], [-312.5, -132.2], [-343.1, -132.5], [-343.1, -130.4], [-343.1, -105.4]],
    wsfSteps: [[-274.8, -138.3], [-288, -132.8]],
    wsfStairArea: [[-298.2, -163.7], [-300.9, -167.9], [-302.9, -166.8], [-300.2, -162.4]],
    slips: [
        [[-425.7, -44.1], [-419.1, -45], [-419.6, -48.5], [-416.1, -49], [-415.6, -45.5], [-391.8, -48.9], [-390.8, -41.5], [-414.5, -38.1], [-414, -34.4], [-417.5, -33.9], [-418, -37.6], [-424.7, -36.7], [-425.1, -40.4]],
        [[-414.1, -100.7], [-414.1, -104.5], [-418.3, -104.5], [-418.2, -100.7], [-423.4, -100.7], [-423.4, -96.7], [-423.3, -92.7], [-418.2, -92.7], [-418.2, -89.4], [-414.1, -89.4], [-414.1, -92.7], [-390.6, -92.8], [-390.6, -100.8]],
        [[-418, -145.3], [-413.7, -145.3], [-413.7, -140.9], [-390.4, -141], [-390.4, -133.6], [-413.7, -133.5], [-413.6, -129.3], [-417.9, -129.3], [-418, -133.5], [-423.4, -133.5], [-423.4, -137.3], [-423.4, -140.9], [-418, -140.9]],
        [[-386.5, -109], [-391.8, -108.8], [-397.2, -110.4], [-421.9, -110.3], [-421.9, -112.9], [-423.2, -112.9], [-423.7, -113.5], [-423.7, -116.4], [-426.8, -116.4], [-426.8, -113.7], [-427.4, -113], [-428.6, -113], [-428.7, -110.9], [-433.6, -110.9], [-433.6, -107.3], [-431.2, -106.3], [-428.5, -105.3], [-428.4, -106.9], [-426.6, -106.9], [-426.6, -106.1], [-423.7, -106.1], [-423.7, -107], [-396.9, -106.6], [-392.4, -105], [-386.3, -105.5]],
    ],
    benches: [[-241.1, -102.6], [-233.1, -90], [-234, -91.8], [-250.7, -118.3], [-258.6, -130.9], [-260.3, -133.7], [-249, -115.8], [-239.6, -100.3]],
    lamps: [[-76.8, -160.1], [-64.3, -166.3], [-90.9, -150.8], [-101.7, -144.2], [-312.6, -221.3]],
};

/** before ctx.osmBackdrop(): the trail's mapped benches and lamps join the spot's furniture */
export function colmanFurniture(ctx) {
    const f = ctx.data.furniture; (f.bench ||= []).push(...COLMAN.benches.map((p) => [...p])); (f.street_lamp ||= []).push(...COLMAN.lamps.map((p) => [...p]));
    return { benches: COLMAN.benches.length, lamps: COLMAN.lamps.length };
}

const outward = (P, i) => { const n = P.length, [ax, az] = P[i], [bx, bz] = P[(i + 1) % n], L = Math.hypot(bx - ax, bz - az) || 1; let nx = (bz - az) / L, nz = -(bx - ax) / L; if (inPoly((ax + bx) / 2 + nx * 0.3, (az + bz) / 2 + nz * 0.3, P)) { nx = -nx; nz = -nz; } return { ax, az, bx, bz, L, nx, nz, dx: (bx - ax) / L, dz: (bz - az) / L }; };
function flight(b, ctx, [[ax, az], [bx, bz]], y0, rise, W = 2.2) { // a stair flight from a (foot) to b (head) with handrails and a blocking box
    const L = Math.hypot(bx - ax, bz - az), dx = (bx - ax) / L, dz = (bz - az) / L, n = Math.max(3, Math.round(rise / 0.17)), yaw = Math.atan2(dx, dz);
    for (let k = 0; k < n; k++) { const t = (k + 0.5) / n; b.box(ax + dx * L * t, y0, az + dz * L * t, W, rise * (k + 1) / n, L / n + 0.01, '#b9b5ac', 'concrete', yaw); }
    for (const s of [-1, 1]) { const ox = -dz * s * (W / 2), oz = dx * s * (W / 2); b.rod([ax + ox, y0 + 1.0, az + oz], [bx + ox, y0 + rise + 1.0, bz + oz], 0.03, '#5d6266', 'metal', 5); }
    ctx.box((ax + bx) / 2, (az + bz) / 2, L / 2, W / 2, -yaw, { h: rise + 1.1 });
}

/** after ctx.osmBackdrop(), replacing the plain Water Taxi prism; returns stats */
export function colmanDock(ctx) {
    const g = ctx.ground, b = new GeoBatch(), out = {};
    // the Water Taxi shed: grey metal walls, a glazed band on its long faces, a flat roof overhanging 1.2 m, its name
    { const P = COLMAN.taxi, y = Math.min(...P.map(([x, z]) => g.heightAt(x, z))), H = 4.6, grey = '#8d9294';
      b.prism(P, y - 0.5, y + H, grey, 'metal', { noTop: true });
      for (let i = 0; i < P.length; i++) { const e = outward(P, i); if (e.L < 6) continue; const n = Math.max(1, Math.round(e.L / 3)), yaw = Math.atan2(e.nx, e.nz);
          for (let k = 0; k < n; k++) { const t = (k + 0.5) / n * e.L; b.box(e.ax + e.dx * t + e.nx * 0.05, y + 0.9, e.az + e.dz * t + e.nz * 0.05, e.L / n - 0.25, 2.5, 0.08, '#24323b', 'darkglass', yaw); } }
      const o = obb(P), R = []; { let ux = o.ux, uz = o.uz, hl = o.len / 2, hw = o.wid / 2; if (o.wid > o.len) { [ux, uz] = [-uz, ux]; hl = o.wid / 2; hw = o.len / 2; } const vx = -uz, vz = ux; for (const [u, v] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) R.push([o.cx + ux * u * (hl + 1.2) + vx * v * (hw + 1.2), o.cz + uz * u * (hl + 1.2) + vz * v * (hw + 1.2)]);
        b.prism(R, y + H, y + H + 0.35, '#d9d8d2', 'paint', { bottom: true });
        for (const s of [-1, 1]) { const sg = signBoard('WATER TAXI · FAST FERRIES', 5.2, 0.7, { bg: '#1d4f7a', fg: '#ffffff', font: (q) => `800 ${q}px Arial, sans-serif`, depth: 0.08 }); sg.position.set(o.cx + ux * s * (hl + 0.08), y + H - 0.55, o.cz + uz * s * (hl + 0.08)); sg.rotation.y = Math.atan2(ux * s, uz * s); ctx.add(sg); } }
      ctx.poly(P); out.taxi = { y: +y.toFixed(2), H }; }
    // the 2-level block at the end of the pier and the two flights up to it
    { const P = COLMAN.taxiEnd, y = Math.min(...P.map(([x, z]) => g.heightAt(x, z)));
      b.prism(P, y - 0.5, y + 3.4, '#8d9294', 'metal', { noTop: true }); b.prism(P, y + 3.4, y + 7.2, '#24323b', 'darkglass', { noTop: true }); b.prism(P, y + 7.2, y + 7.6, '#d9d8d2', 'paint');
      ctx.poly(P); for (const s of COLMAN.taxiSteps) flight(b, ctx, s, g.heightAt(...s[0]), 2.4); }
    // the WSF slip-approach canopy (layer 3) on posts every ≈ 8 m round its outline
    { const P = COLMAN.canopy, yG = Math.min(...P.map(([x, z]) => g.heightAt(x, z))), y = yG + 10.5; let run = 0, posts = 0;
      { const F0 = gableFrame(P, { eave: 0, ridge: 0 }); gableRoof(b, P, { ...F0, top: () => y + 0.35 }, { color: '#7d8286', key: 'metal', thick: 0.35, fascia: '#9a9fa3' }); } // (a flat two-sided sheet: the irregular ring defeats the prism cap)
      for (let i = 0; i < P.length; i++) { const e = outward(P, i); for (let t = (8 - run % 8) % 8; t < e.L; t += 8) { const x = e.ax + e.dx * t - e.nx * 0.4, z = e.az + e.dz * t - e.nz * 0.4, gy = g.heightAt(x, z); b.cyl(x, gy, z, 0.18, y - gy, '#5d6266', 'metal', 8); ctx.circle(x, z, 0.2, y - gy); posts++; } run += e.L; }
      out.canopy = { y: +y.toFixed(2), posts }; }
    // the WSF terminal's stairs: a flight up to the timber storey (4.2 m) and the small stair block (layer 1)
    flight(b, ctx, COLMAN.wsfSteps, g.heightAt(...COLMAN.wsfSteps[0]), 4.2, 2.6);
    { const P = COLMAN.wsfStairArea, y = Math.min(...P.map(([x, z]) => g.heightAt(x, z))); b.prism(P, y - 0.3, y + 2.4, '#b9b5ac', 'concrete'); ctx.poly(P, { y0: y - 1, y1: y + 2.4 }); }
    // the ferry slips: aprons at dock level on piles, two white towers where the outline widens at the outer end
    { const hs = COLMAN.slips.flatMap((P) => P.map(([x, z]) => g.heightAt(x, z))).filter((h) => h > -9), y = Math.min(hs.length ? Math.max(...hs) : -3.5, -3.3); let towers = 0; // (dock level where the apron meets the dock)
      for (const P of COLMAN.slips) { b.prism(P, y - 0.8, y + 0.05, '#55595c', 'metal', { bottom: true }); g.addPoly(P, y + 0.05, y - 2, { kind: 'ferry-slip' });
          const bb = polyBox(P); for (let x = bb.x0 + 2; x < bb.x1; x += 5) for (let z = bb.z0 + 1.5; z < bb.z1; z += 4) if (inPoly(x, z, P)) b.cyl(x, y - 6, z, 0.25, 5.2, '#3d3a35', 'wood', 6);
          // the outer end: the wing walls (vertices west of the apron's straight run) — a tower on each side
          const xs = P.map((p) => p[0]), xo = Math.min(...xs), wing = P.filter(([x]) => x < xo + 12), zs = wing.map((p) => p[1]), z0 = Math.min(...zs), z1 = Math.max(...zs), xm = (Math.min(...wing.map((p) => p[0])) + Math.max(...wing.map((p) => p[0]))) / 2;
          for (const zz of [z0 + 1.2, z1 - 1.2]) { b.box(xm, y, zz, 1.4, 9, 1.4, '#e8e6df', 'paint'); b.box(xm, y + 9, zz, 2.0, 0.6, 2.0, '#e8e6df', 'paint'); ctx.box(xm, zz, 0.7, 0.7, 0, { h: 9.6 }); towers++; } }
      out.slips = { n: COLMAN.slips.length, deck: +y.toFixed(2), towers }; }
    ctx.add(b.build('colman-dock'));
    return out;
}
