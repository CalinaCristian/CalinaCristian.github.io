// Rules of "table" (Romanian backgammon): opening, compulsory dice, bar, bearing off, scoring, routes, roll luck.
import assert from 'node:assert/strict';
import { createGame, rollDice, legalMoves, legalTurns, applyMove, confirmTurn, chooseTurn, pipCount, gameResult, checkerRoutes, rollLuck, validatePosition } from '../src/spots/backgammon-engine.js';

const position = (o) => { // a hand-made position on move
    const points = Array(24).fill(0); for (const [i, n] of o.points || []) points[i] = n;
    const s = { points, bar: o.bar || [0, 0], off: o.off || [0, 0], turn: o.turn ?? 1, phase: 'roll', dice: [], remaining: [], openingDice: [], winner: 0, turnNumber: 1, opening: 'reroll' };
    for (const p of [1, -1]) { const i = p === 1 ? 0 : 1, have = points.reduce((n, v) => n + Math.max(0, v * p), 0) + s.bar[i] + s.off[i]; s.off[i] += 15 - have; }
    validatePosition(s); return o.dice ? rollDice(s, ...o.dice) : s;
};
const moves = (s) => legalMoves(s).map((m) => `${m.from}>${m.to}:${m.die}${m.hit ? 'x' : ''}`).sort();

// --- start and opening (Romanian: the winner of the one-die throw rolls both dice again)
{
    const g = createGame();
    assert.equal(pipCount(g, 1), 167); assert.equal(pipCount(g, -1), 167); assert.equal(g.phase, 'opening');
    const tie = rollDice(g, 4, 4); assert.equal(tie.phase, 'opening'); assert.deepEqual(tie.openingDice, [4, 4]);
    const mine = rollDice(tie, 5, 2); assert.equal(mine.phase, 'roll'); assert.equal(mine.turn, 1); assert.deepEqual(mine.dice, []); assert.deepEqual(mine.openingDice, [5, 2]);
    const his = rollDice(g, 1, 6); assert.equal(his.turn, -1); assert.equal(his.phase, 'roll');
    const first = rollDice(mine, 3, 1); assert.equal(first.phase, 'move'); assert.deepEqual(first.remaining, [3, 1]); assert.deepEqual(first.openingDice, []);
    const intl = rollDice(createGame({ opening: 'use' }), 6, 2); assert.equal(intl.phase, 'move'); assert.deepEqual(intl.remaining, [6, 2]); assert.equal(intl.turn, 1);
    assert.throws(() => rollDice(first, 1, 2)); assert.throws(() => rollDice(g, 0, 7));
}
// --- doubles give four moves; a full turn must be played before handing over
{
    let s = position({ points: [[23, 2], [12, 5], [7, 3], [5, 5], [0, -2], [11, -5], [16, -3], [18, -5]], dice: [3, 3] });
    assert.deepEqual(s.remaining, [3, 3, 3, 3]); assert.throws(() => confirmTurn(s));
    for (let k = 0; k < 4; k++) s = applyMove(s, legalMoves(s)[0]);
    assert.equal(legalMoves(s).length, 0); const next = confirmTurn(s); assert.equal(next.turn, -1); assert.equal(next.phase, 'roll'); assert.equal(next.turnNumber, 2);
}
// --- a checker on the bar enters first; a closed point is no entry; a blot is hit
{
    const s = position({ points: [[5, 2], [23, -2], [22, -2], [20, -1], [18, -2]], bar: [1, 0], dice: [4, 2] });
    assert.deepEqual(moves(s), ['bar>20:4x']); // 24−2 = point 23 (index 22) is closed; the 4 enters on a blot
    const hit = applyMove(s, { from: 'bar', to: 20, die: 4 }); assert.equal(hit.bar[1], 1); assert.equal(hit.points[20], 1);
    const shut = position({ points: [[5, 2], [23, -2], [22, -2], [21, -2], [20, -2], [19, -2], [18, -2]], bar: [1, 0], dice: [6, 3] });
    assert.deepEqual(moves(shut), []); assert.equal(confirmTurn(shut).turn, -1); // closed board: the turn is lost
}
// --- both dice must be played when a sequence exists; when only one can be, it is the higher
{
    // white: one checker on point 8 (index 7), black blocks index 1 (7−6) … only 5 then 1 or 1 then 5? make 6 impossible, 5 and 1 each playable but not both
    const s = position({ points: [[7, 1], [1, -2], [6, -2], [2, 1]], off: [13, 0], dice: [5, 1] });
    // 7→2 (5) then 2→1 blocked, 2(index)… every legal first move must leave the other die playable if any sequence uses both
    for (const t of legalTurns(s)) assert.equal(t.length, Math.max(...legalTurns(s).map((q) => q.length)));
    const one = position({ points: [[10, 1], [4, -2], [5, -2], [9, -2], [0, -2]], off: [14, 0], dice: [6, 5] }); // 10→4 and 10→5 both blocked
    assert.deepEqual(moves(one), []);
    const high = position({ points: [[12, 1], [1, -2], [0, -2], [7, -2]], off: [14, 0], dice: [6, 5] }); // 6: 12→6 then 5 → 1 blocked; 5: 12→7 blocked … only the 6
    assert.deepEqual(moves(high), ['12>6:6']);
    const either = position({ points: [[12, 1], [1, -2], [2, -2]], off: [14, 0], dice: [6, 5] }); // 6 then 5 → index 1 blocked; 5 then 6 → index 1 blocked: one die only → the 6
    assert.deepEqual(moves(either), ['12>6:6']);
}
// --- bearing off: only with every checker home; exact die, or a higher die from the highest point
{
    const notHome = position({ points: [[6, 1], [3, 2], [18, -2]], off: [12, 0], dice: [4, 1] });
    assert.ok(!moves(notHome).some((m) => m.includes('off')));
    const home = position({ points: [[4, 2], [2, 1], [18, -2]], off: [12, 0], dice: [6, 3] });
    assert.deepEqual(moves(home), ['2>off:3', '4>1:3', '4>off:6']); // 6 bears off from the highest point (5); 3 is exact from point 3 or moves inside
    const blocked = position({ points: [[5, 1], [2, 1], [18, -2]], off: [13, 0], dice: [4, 4] });
    assert.ok(!moves(blocked).includes('2>off:4')); // a checker sits higher (point 6): the 4 must move it first
    let win = position({ points: [[0, 1], [23, -3]], off: [14, 12], dice: [2, 1] });
    win = applyMove(win, legalMoves(win)[0]); assert.equal(win.phase, 'finished'); assert.equal(win.winner, 1);
    assert.deepEqual(gameResult(win), { winner: 1, points: 1, kind: 'single', name: 'linie' });
}
// --- scoring: linie 1, marț 2 (loser bore off nothing), marț tehnic 3 (… and is still on the bar or in the winner's home)
{
    const end = (pts, bar = [0, 0]) => { let s = position({ points: [[0, 1], ...pts], bar, dice: [1, 2] }); s = applyMove(s, legalMoves(s).find((m) => m.to === 'off')); return gameResult(s); };
    assert.equal(end([[20, -15]]).name, 'marț'); assert.equal(end([[20, -15]]).points, 2);
    assert.equal(end([[3, -1], [20, -14]]).name, 'marț tehnic'); assert.equal(end([[20, -14]], [0, 1]).points, 3);
    assert.equal(end([[20, -10]]).name, 'linie');
}
// --- routes for one checker: single dice and both dice with the same checker; a route that hits nothing on the way is preferred
{
    const s = position({ points: [[12, 2], [9, -1], [6, 3], [18, -2]], off: [10, 12], dice: [3, 2] });
    const r = Object.fromEntries(checkerRoutes(s, 12).map((q) => [q.to, q]));
    assert.deepEqual(Object.keys(r).map(Number).sort((a, b) => a - b), [7, 9, 10]);
    assert.equal(r[9].hit, true); assert.equal(r[10].moves.length, 1);
    assert.deepEqual(r[7].moves.map((m) => m.to), [10, 7]); // by the 2 first: the route through 9 would hit
    let t = s; for (const m of r[7].moves) t = applyMove(t, m); assert.equal(t.points[7], 1); assert.equal(t.bar[1], 0);
    assert.deepEqual(checkerRoutes(s, 5), []);
    const d = position({ points: [[12, 2], [18, -2]], off: [13, 13], dice: [2, 2] });
    assert.deepEqual(checkerRoutes(d, 12).map((q) => q.to).sort((a, b) => a - b), [4, 6, 8, 10]);
}
// --- roll luck: a double six in a pure race is a top roll, 2-1 a poor one
{
    const race = (dice) => rollLuck(position({ points: [[10, 5], [8, 5], [5, 5], [14, -5], [16, -5], [19, -5]], dice }));
    assert.ok(race([6, 6]).pct > 0.9); assert.ok(race([2, 1]).pct < 0.1); assert.ok(race([6, 6]).value > race([2, 1]).value);
    assert.equal(rollLuck(createGame()), null);
}
// --- complete games between two heuristic players stay legal and always end
{
    let seed = 20261111; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; }, die = () => 1 + Math.floor(rnd() * 6);
    const kinds = {};
    for (let g = 0; g < 40; g++) {
        let s = createGame(), guard = 0;
        while (s.phase !== 'finished') {
            assert.ok(++guard < 2000);
            if (s.phase === 'opening' || s.phase === 'roll') { s = rollDice(s, die(), die()); continue; }
            for (const m of chooseTurn(s)) s = applyMove(s, m);
            if (s.phase !== 'finished') s = confirmTurn(s);
        }
        validatePosition(s); const r = gameResult(s); kinds[r.name] = (kinds[r.name] || 0) + 1; assert.equal(s.off[r.winner === 1 ? 0 : 1], 15);
    }
    assert.ok(kinds.linie > 0);
}
console.log('table engine: opening re-roll, compulsory dice, bar entry, bearing off, linie / marț / marț tehnic, checker routes, roll luck and 40 full games passed.');
