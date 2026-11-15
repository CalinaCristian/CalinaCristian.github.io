// A bike stand near the arrival point of every large spot (owner, 2026-11-15: "i should have bikes in every tourist spot
// that is large (so all except arcul de triumf and seattle needle maybe)"). Cișmigiu and Herăstrău keep their own placed
// stands; elsewhere the stand goes on the nearest flat, dry, free stretch of the walk 5–35 m from the spawn, facing it,
// off the carriageways, inside the spot's walk boundary. The station layout is a game estimate, not a mapped dock.
import { addBikeRental } from './bike.js';
import { collide } from './walker.js';

/** the large spots that get a stand: not the Arc's island, the Seattle Center / Space Needle visit, Kerry Park's
 *  terrace or the Fremont Troll's underpass */
export const BIKE_SPOTS = new Set(['old-town-lipscani', 'stavropoleos-cec', 'palace-parliament', 'peoples-salvation-cathedral', 'athenaeum-revolution',
    'spring-palace', 'village-museum', 'herastrau-park', 'cismigiu', 'pike-place', 'waterfront', 'pioneer-square', 'ballard-locks', 'gas-works',
    'bel-lincoln-square', 'bel-downtown-park', 'bel-botanical-garden', 'bel-meydenbauer']);

export function addSpotBikes(ctx, spotId, city) {
    if (!BIKE_SPOTS.has(spotId) || ctx.extras.bikeRental) return null;
    const g = ctx.ground, sp = ctx.spawns[spotId] || ctx.data.spots?.[spotId]?.spawn; if (!sp) return null;
    const boundary = ctx.extras.walkBoundary, box = ctx.extras.terrainBox, n = 5;
    const taken = ctx.interactables.filter((it) => Number.isFinite(it.x) && Math.abs(it.x) < 4000);
    const free = (x, z, y0) => {
        const y = g.groundAt(x, z, y0 + 1); if (!Number.isFinite(y) || Math.abs(y - y0) > .22) return false;
        if (g.waterY != null && y < g.waterY - .2) return false;
        if (ctx.onRoad?.(x, z, .8) || (boundary && !boundary.inside(x, z)) || (box && (x < box.x0 + 10 || x > box.x1 - 10 || z < box.z0 + 10 || z > box.z1 - 10))) return false;
        return !collide(ctx.colliders, x, z, .45, y + .3);
    };
    for (let r = 5; r <= 35; r += 1.5) for (let k = 0; k < 24; k++) {
        const a = k / 24 * Math.PI * 2 + r * .37, x = sp.x + Math.cos(a) * r, z = sp.z + Math.sin(a) * r, y0 = g.heightAt(x, z);
        if (!Number.isFinite(y0) || taken.some((it) => Math.hypot(it.x - x, it.z - z) < 4)) continue;
        const heading = Math.atan2(-(sp.x - x), -(sp.z - z)), fx = -Math.sin(heading), fz = -Math.cos(heading), rx = Math.cos(heading), rz = -Math.sin(heading);
        let ok = true; // the whole stand (the bikes, the terminal) and the pick-up place in front of it
        for (let u = -(n * .4 + .3); u <= n * .4 + 1.2 && ok; u += .6) for (const v of [-1, 0, 1, 1.6]) if (!free(x + rx * u + fx * v, z + rz * u + fz * v, y0)) { ok = false; break; }
        if (!ok) continue;
        const bucharest = city === 'bucharest';
        const rental = addBikeRental(ctx, { x, z, heading, n, name: bucharest ? 'I\'Velo bikes' : 'Bike share', colour: bucharest ? '#d7262e' : '#2f9e44' });
        ctx.extras.bikeRental = rental; ctx.extras.bikeRentalSource = { sourced: false, estimatedLayout: true, x: +x.toFixed(1), z: +z.toFixed(1), fromSpawn: +r.toFixed(1), displayedBikes: n };
        return rental;
    }
    ctx.extras.bikeRentalSource = { placed: false, reason: 'no flat free stretch within 35 m of the spawn' };
    return null;
}
