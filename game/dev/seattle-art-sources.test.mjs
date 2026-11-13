// Seattle tourist-scene artworks built from their OSM tags (round 3, lane sea-spots): the literal numbers must hold.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.min.js';
import { ILIAD, iliadPile } from '../src/spots/scenes/seattle-center-heroes.js';
import { SALMON_WAVES, waveGeometry } from '../src/spots/scenes/ballard-locks-art.js';
import { FOUNTAIN_RING_LL, FOUNTAIN } from '../src/spots/scenes/seattle-center-fountain.js';

test('Olympic Iliad (n3211770187): 41 tubes of 48-64 in, inside the 60 x 30 x 45 ft envelope', () => {
    const pile = iliadPile();
    assert.equal(pile.length, 41);
    for (const [x, y, z, , tilt, len, d] of pile) {
        assert.ok(d >= ILIAD.dMin - 1e-9 && d <= ILIAD.dMax + 1e-9);
        const halfUp = Math.abs(Math.sin(tilt)) * len / 2 + Math.abs(Math.cos(tilt)) * d / 2, halfAlong = Math.abs(Math.cos(tilt)) * len / 2;
        assert.ok(y + halfUp <= ILIAD.H + 0.05 && y - halfUp >= -0.05, 'within the height');
        assert.ok(Math.abs(x) <= ILIAD.W / 2 + halfAlong && Math.abs(z) <= ILIAD.D / 2 + len / 2, 'near the footprint');
    }
});

test('Salmon Waves (n3211770269): seven waves, 6-9 ft high', () => {
    assert.equal(SALMON_WAVES.n, 7);
    for (const H of [SALMON_WAVES.hMin, SALMON_WAVES.hMax]) {
        const g = waveGeometry(H); g.computeBoundingBox();
        assert.ok(Math.abs(g.boundingBox.max.y - H) < 0.12, `top ${g.boundingBox.max.y.toFixed(2)} vs ${H.toFixed(2)}`);
        assert.ok(g.boundingBox.min.y > -0.1);
    }
});

test('International Fountain (w35352476): the rim is the closed OSM ring, 56-57 m across', () => {
    const k = Math.cos(47.6225 * Math.PI / 180) * 111320, lat = FOUNTAIN_RING_LL.map((p) => p[0]), lon = FOUNTAIN_RING_LL.map((p) => p[1]);
    const ns = (Math.max(...lat) - Math.min(...lat)) * 111132, ew = (Math.max(...lon) - Math.min(...lon)) * k;
    assert.equal(FOUNTAIN_RING_LL.length, 33); // the 34-node way without its repeated closing node
    assert.ok(ns > 55 && ns < 58 && ew > 55 && ew < 58, `${ns.toFixed(1)} x ${ew.toFixed(1)}`);
    assert.equal(FOUNTAIN.superMaxH, 37); // OSM height=37 (120 ft super shooters)
    void THREE;
});
