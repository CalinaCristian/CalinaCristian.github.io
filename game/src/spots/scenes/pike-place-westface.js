// ============================================================================
//  Pike Place Market — the market's west walls over Western Ave (round 3, r2-sea-spots-b-3 / r3-sea-spots-3).
//  Official panorama iFZRr4o9WP2yFdlbuLUkeQ (Western Ave, 47.60878,-122.34155, viewed 2026-11-13, nothing stored)
//  looking 60°: white-painted walls with rows of wide red-framed industrial windows (multi-pane steel sash), several
//  storeys down the bluff; looking 300°: the same white wall and windows north to the SkyBridge. They were drawn with the
//  generic apartment tile. The tile keeps the apartment tile's bay / floor so the existing wall UVs line up; window
//  proportions, pane counts and the red are judged from that panorama.
// ============================================================================
import * as THREE from '../../../vendor/three.module.min.js';
import { rng, canvas, canvasTexture } from '../kit.js';
import { facadeStyle } from '../osm.js';

let MAT = null;
export function marketWestMaterial() {
    if (MAT) return MAT;
    const T = 256, C = T / 4, c = canvas(T, T), g = c.getContext('2d'), e = canvas(T, T), ge = e.getContext('2d'), r = rng(1907);
    g.fillStyle = '#f2efe6'; g.fillRect(0, 0, T, T); ge.fillStyle = '#000'; ge.fillRect(0, 0, T, T);
    for (let fy = 0; fy < 4; fy++) {
        const y0 = (3 - fy) * C; g.fillStyle = 'rgba(0,0,0,0.07)'; g.fillRect(0, y0 + C - 3, T, 3); // floor line
        for (let fx = 0; fx < 4; fx++) {
            const x0 = fx * C, wx = x0 + C * 0.07, ww = C * 0.86, wy = y0 + C * 0.2, wh = C * 0.62;
            g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(wx - 1, wy - 1, ww + 3, wh + 3);
            g.fillStyle = '#2a3036'; g.fillRect(wx, wy, ww, wh);
            g.fillStyle = 'rgba(190,205,215,0.18)'; g.fillRect(wx + 2, wy + 2, ww * 0.4, wh * 0.45);
            g.fillStyle = '#a8382d'; g.lineWidth = 1; // red steel sash: frame + 5 × 3 panes
            g.fillRect(wx, wy, ww, 2.5); g.fillRect(wx, wy + wh - 2.5, ww, 2.5); g.fillRect(wx, wy, 2.5, wh); g.fillRect(wx + ww - 2.5, wy, 2.5, wh);
            for (let k = 1; k < 5; k++) g.fillRect(wx + ww * k / 5 - 0.75, wy, 1.5, wh);
            for (let k = 1; k < 3; k++) g.fillRect(wx, wy + wh * k / 3 - 0.75, ww, 1.5);
            g.fillStyle = 'rgba(255,255,255,0.6)'; g.fillRect(wx - 2, wy + wh + 1, ww + 4, 2); // sill
            if (r() < 0.4) { ge.fillStyle = `rgb(255,${200 + r() * 35},${135 + r() * 40})`; ge.fillRect(wx + 3, wy + 3, ww - 6, wh - 6); }
        }
    }
    const S = facadeStyle('apartment');
    const m = new THREE.MeshStandardMaterial({ map: canvasTexture(c, { repeat: true }), emissiveMap: canvasTexture(e, { repeat: true }), emissive: new THREE.Color('#ffffff'), emissiveIntensity: 0, vertexColors: true, roughness: 0.85, side: THREE.DoubleSide });
    m.name = 'pike-market-west'; m.userData.shared = true; m.userData.nightWindows = true; m.userData.style = S;
    MAT = m; return m;
}
/** the wall colour that goes with the tile (vertex colour: near white, the tile carries the cream) */
export const MARKET_WEST_TINT = '#ffffff';
