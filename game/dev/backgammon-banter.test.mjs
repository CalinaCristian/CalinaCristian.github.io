// Doru's table talk: every line is complete Romanian + English, the dice are called the Romanian way, and the right
// kind of line answers each situation.
import assert from 'node:assert/strict';
import { LINES, TALK, callRoll, analyse, standing, createBanter } from '../src/spots/backgammon-banter.js';
import { createGame, rollDice, applyMove, legalMoves } from '../src/spots/backgammon-engine.js';

for (const [key, list] of Object.entries(LINES)) { assert.ok(list.length > 0, key); for (const l of list) { assert.equal(l.length, 2, key); assert.ok(l[0].trim() && l[1].trim(), key); assert.deepEqual((l[0].match(/\{\w+\}/g) || []).map((v) => v.replace(/En\}$/, '}').toLowerCase()).sort(), (l[1].match(/\{\w+\}/g) || []).map((v) => v.replace(/En\}$/, '}').toLowerCase()).sort(), key + ': the same variables in both languages'); } }
for (const o of TALK) assert.ok(o.id === 'hint' || LINES[o.answer], o.id);
assert.deepEqual(callRoll(5, 6), { ro: 'șase-cinci', en: 'six-five', double: false, hi: 6, lo: 5 });
assert.equal(callRoll(4, 4).ro, 'dublă de patru'); assert.equal(callRoll(6, 6).ro, 'șase-șase'); assert.equal(callRoll(6, 6).en, 'double sixes'); assert.equal(callRoll(1, 1).en, 'double ones');

let seed = 7; const rng = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
const B = createBanter({ rng }), filled = (l) => { assert.ok(l && !/[{}]/.test(l.ro + l.en), JSON.stringify(l)); return l; };
assert.equal(filled(B.opening([3, 3], 0)).key, 'openTie'); assert.equal(filled(B.opening([5, 2], 1)).key, 'openYou'); assert.equal(filled(B.opening([1, 6], 2)).key, 'openDoru');
assert.equal(filled(B.roll({ who: -1, dice: [6, 6], pct: 0.99, canMove: true }, 10)).key, 'd66');
assert.equal(filled(B.roll({ who: 1, dice: [6, 6], pct: 0.99, canMove: true }, 20)).key, 'p66');
assert.equal(filled(B.roll({ who: -1, dice: [3, 1], pct: 0.5, canMove: false, onBar: true }, 30)).key, 'dDance');
assert.equal(filled(B.roll({ who: 1, dice: [3, 1], pct: 0.5, canMove: false, onBar: true }, 40)).key, 'pDance');
assert.equal(filled(B.roll({ who: 1, dice: [4, 2], pct: 0.5, canMove: false, onBar: false }, 50)).key, 'pBlocked');
{ const keys = new Set(); for (let i = 0; i < 60; i++) { const l = B.roll({ who: -1, dice: [5, 3], pct: 0.95, canMove: true }, 100 + i * 30); if (l) keys.add(filled(l).key); } assert.ok(keys.has('dLucky')); assert.ok([...keys].every((k) => ['dLucky', 'dPlain'].includes(k))); }
{ const keys = new Set(); for (let i = 0; i < 60; i++) { const l = B.roll({ who: 1, dice: [2, 1], pct: 0.03, canMove: true }, 3000 + i * 30); if (l) keys.add(filled(l).key); } assert.deepEqual([...keys], ['pUnlucky']); }
assert.equal(B.roll({ who: 1, dice: [4, 2], pct: 0.5, canMove: true }, 9000), null); // an ordinary roll of the player: he keeps quiet
// a hit is always answered; analyse() sees it
{
    let s = rollDice(rollDice(createGame(), 6, 1), 6, 4); // the player won the opening and throws 6-4
    const blot = { ...s, points: s.points.map((n, i) => (i === 17 ? -1 : i === 16 ? -2 : n)) }; Object.freeze(blot.points); // a bare black checker on point 18
    const m = legalMoves(blot).find((q) => q.from === 23 && q.to === 17); assert.ok(m?.hit);
    const after = applyMove(blot, m), tags = analyse(blot, after, 1); assert.equal(tags.hits, 1);
    assert.equal(filled(B.turn({ who: 1, tags }, 9100)).key, 'pHit'); assert.equal(filled(B.turn({ who: -1, tags }, 9101)).key, 'dHit');
}
assert.equal(standing(createGame()), null);
{ const s = createGame(), far = { ...s, points: s.points.map((n) => (n < 0 ? 0 : n)), off: [0, 15] }; assert.equal(standing({ ...far, off: [0, 9], points: far.points.map((n, i) => (i === 23 ? n - 6 : n)) }), 'martThreat'); }
{ const out = B.end({ winner: -1, points: 2, kind: 'gammon', name: 'marț' }, { you: 0, doru: 2 }, 9200); assert.deepEqual(out.map((l) => filled(l).key), ['dWinMart', 'kDoruWins', 'rematch']); assert.ok(out[2].ro.includes('0–2')); assert.equal(out[1].who, 'kibitz'); }
{ const out = B.end({ winner: 1, points: 1, kind: 'single', name: 'linie' }, { you: 3, doru: 1 }, 9300); assert.deepEqual(out.map((l) => l.key), ['pWinLinie', 'kYouWin', 'matchYou']); }
assert.deepEqual(B.talk('hint', { phase: 'roll' }, 9400).map((l) => l.key), ['you', 'aHintRoll']);
assert.deepEqual(B.talk('hint', { phase: 'move', move: { from: 'bar', to: 20 } }, 9401).map((l) => l.key), ['you', 'aHintEnter']);
assert.deepEqual(B.talk('tease', null, 9402).map((l) => l.who), ['you', 'doru']);
// no line repeats until its bank has been used up
{ const seen = []; for (let i = 0; i < 3; i++) seen.push(B.say('greet', {}, 9500 + i, true).ro); assert.equal(new Set(seen).size, 3); }
console.log(`table banter: ${Object.values(LINES).reduce((n, l) => n + l.length, 0)} lines in ${Object.keys(LINES).length} situations, roll calls, reactions, results and talk answers passed.`);
