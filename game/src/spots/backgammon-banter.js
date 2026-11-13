// What Doru (the fictional Cișmigiu regular) says over a game of table, and when. Pure data + selection: no DOM, no
// three.js. Sources and which lines are attested (heard in Cișmigiu, in Romanian dictionaries or press) against which
// are written in the same style: game/research/bucharest-spots.md, "Table (Romanian backgammon)". Romanian players call the dice in plain Romanian
// ("șase-cinci", "dublă de patru"); only a few old Turkish names survive: "dușeș" (6-6), "șeș-beș" (6-5), "epiec" (1-1),
// and "gherlă" for a useless roll. Each line is [Romanian, English]; {…} are filled from the event.
const side = (p) => (p === 1 ? 0 : 1);
export const NUMBERS = { ro: ['', 'unu', 'doi', 'trei', 'patru', 'cinci', 'șase'], en: ['', 'one', 'two', 'three', 'four', 'five', 'six'] };
const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);

/** the roll as a player would call it: higher die first; doubles as "dublă de …" */
export function callRoll(a, b) {
    const hi = Math.max(a, b), lo = Math.min(a, b), R = NUMBERS.ro, E = NUMBERS.en;
    if (hi === lo) return { ro: hi === 6 ? 'șase-șase' : `dublă de ${R[hi]}`, en: `double ${E[hi]}${hi === 6 ? 'es' : 's'}`, double: true, hi, lo };
    return { ro: `${R[hi]}-${R[lo]}`, en: `${E[hi]}-${E[lo]}`, double: false, hi, lo };
}

export const LINES = {
    greet: [['Ia loc, tinere. Facem o tablă?', 'Sit down, young man. Shall we play a game of table?'], ['Ești gata de joc? Eu sunt aici de la nouă.', "Ready to play? I've been here since nine."], ['Hai, că n-am venit să mă uit la alții cum joacă.', "Come on, I didn't come here to watch others play."]],
    rules: [['Jucăm la trei linii. Marțul face două.', 'We play to three lines. A marț counts as two.']],
    resume: [['Te-ai întors? Tabla e cum ai lăsat-o.', "You're back? The board is as you left it."]],
    openTie: [['Egal. Mai dăm o dată.', 'A tie. We throw again.']],
    openDoru: [['{hi} la {lo}. Eu dau primul.', '{hiEn} to {loEn}. I roll first.'], ['Am dat mai mare. Zarul e la mine.', 'Mine is higher. The dice come to me.']],
    openYou: [['Ai dat mai mare. Ești la mutare!', "Yours is higher. It's your move!"], ['{hi} la {lo} pentru mata. Dă cu zarul.', '{hiEn} to {loEn} for you. Roll the dice.']],
    // --- Doru's own roll
    d66: [['Dușeș! Șase-șase, poartă-n casă!', 'Double six! Six-six, a gate at home!'], ['Dușeș! Așa se dă cu zarul, tinere.', "Double six! That's how you throw dice, young man."]],
    d11: [["Epiec. Mic, da' al meu.", 'Double ones. Small, but mine.'], ['Epiec… Patru pași mărunți.', 'Double ones… Four little steps.']],
    d65: [['Șeș-beș! Zar de fugă.', 'Six-five! A running roll.']],
    dDouble: [['{Roll}! Zarul contează, tinere.', '{RollEn}! The dice matter, young man.'], ['{Roll}! Am dat o dublă.', '{RollEn}! I rolled a double.']],
    dLucky: [['{Roll}. Exact zarul care-mi trebuia.', '{RollEn}. Exactly the roll I needed.'], ['{Roll}! Azi zarul ține cu mine.', '{RollEn}! Today the dice are on my side.'], ['{Roll}. Asta-i mână, nu noroc.', "{RollEn}. That's a good hand, not luck."]],
    dUnlucky: [['{Roll}… Gherlă.', '{RollEn}… A dud.'], ['{Roll}. Ce zar e ăsta? Trebuie fierte zarurile cu busuioc.', '{RollEn}. What kind of roll is that? These dice need boiling with basil.'], ['Gherlă. Nu-i nimic, vine și zarul meu.', 'A dud. Never mind, my roll will come.']],
    dDance: [['{Roll}. N-am intrare. Stau pe bară și mă uit.', '{RollEn}. No way in. I sit on the bar and watch.'], ['Nu intru. Ai făcut porți peste tot.', "I can't come in. You've made gates everywhere."]],
    dBlocked: [['{Roll}. Nu pot muta nimic. Dă mata.', "{RollEn}. I can't move anything. You roll."]],
    dPlain: [['{Roll}.', '{RollEn}.'], ['{Roll}. Să vedem…', "{RollEn}. Let's see…"], ['{Roll}. Hm.', '{RollEn}. Hm.']],
    // --- the player's roll
    p66: [['Dușeș?! Noroc porcesc!', "Double six?! Pig's luck!"], ['Șase-șase… Și eu care credeam că ești începător.', 'Six-six… And I thought you were a beginner.']],
    p11: [['Epiec. Mărunt, mărunt…', 'Double ones. Small change…'], ['Epiec. Nici nu se simte.', "Double ones. You'll hardly feel it."]],
    pDouble: [["Dublă? Joci ca la Dîlga, da' ai zar!", "A double? You play like they do in Dîlga, but you've got the dice!"], ['{Roll}. Zar ai, nu zic nu.', "{RollEn}. You do have the dice, I'll give you that."]],
    pLucky: [['{Roll}? Cu zarul ăsta ar câștiga și nepotu-meu.', '{RollEn}? My grandson would win with dice like that.'], ['Ai zar, tinere. Joc, mai vedem.', "You've got the dice, young man. The play, we'll see."], ['Noroc porcesc!', "Pig's luck!"]],
    pUnlucky: [['Gherlă! Mai fierbe zarurile alea cu busuioc.', 'A dud! Go boil those dice with basil.'], ['{Roll}. Zarul nu ține cu mata azi.', "{RollEn}. The dice aren't with you today."]],
    pDance: [['Nu intri. Poartă lângă poartă, tinere.', "You can't come in. Gate next to gate, young man."], ['Stai pe bară. Se vede frumos de-acolo.', 'Stay on the bar. Nice view from there.']],
    pBlocked: [['Nu ai mutare. Zarul vine la mine.', 'You have no move. The dice come to me.']],
    // --- Doru's moves
    dHit: [['Te-am lovit. Pe bară cu el!', 'I hit you. Onto the bar with it!'], ['Pul descoperit? Mulțumesc frumos.', 'A bare checker? Thank you kindly.'], ['Dau tare, să vezi și să auzi bine ce joc.', 'I slam it down so you see and hear what I play.']],
    dPoint: [['Am făcut poartă.', "I've made a gate."], ['Încă o poartă. Încet, încet…', 'Another gate. Slowly, slowly…']],
    dHomePoint: [['Poartă-n casă. De-aici nu mai intri ușor.', "A gate at home. You won't get in easily now."], ['Mai pun o poartă-n casă. Să fie.', 'One more gate at home. Just in case.']],
    dClosed: [['Am închis tabla. Bate la altă poartă.', "I've closed the board. Knock on another gate."]],
    dBlot: [['Joc la risc. Așa-i frumos, să vadă lumea.', "I play at risk. That's the beauty of it, let people watch."]],
    dEnter: [['Am intrat. Mergem mai departe.', "I'm in. On we go."]],
    dFirstOff: [['Toate-s în casă. Încep să scot.', 'All home. I start taking them off.']],
    // --- the player's moves
    pHit: [['Aoleu, m-ai lovit!', 'Ouch, you hit me!'], ['M-ai prins descoperit. Bravo.', 'You caught me bare. Well done.'], ['Lasă, că intru eu înapoi.', "Never mind, I'll get back in."]],
    pPoint: [['Poartă… Văd că știi ceva.', 'A gate… I see you know a thing or two.'], ['Faci porți, faci porți… Bine.', 'Making gates, making gates… Fine.']],
    pHomePoint: [['Poartă-n casă? Ia te uită.', 'A gate at home? Well, look at that.'], ['Îți întărești casa. Așa se joacă.', "Strengthening your home. That's how it's played."], ['Încă o poartă-n casă. Mă închizi afară, tinere?', 'Another gate at home. Shutting me out, young man?']],
    pClosed: [['Ai închis tabla? Frumos, n-am ce zice.', "You closed the board? Nice, I can't complain."]],
    pBlot: [['Lași pulul descoperit? Curajos.', 'Leaving a checker bare? Brave.'], ['Pul descoperit… Să nu zici că nu ți-am spus.', "A bare checker… Don't say I didn't warn you."]],
    pFirstOff: [['Ai început să scoți. Acum e cursă.', "You've started bearing off. Now it's a race."]],
    pUndo: [['Mută-l înapoi, nu-i bai. La noi nu-i „piesă atinsă”.', "Put it back, no harm. We don't play touch-move here."]],
    idleRoll: [['Hai, dă cu zarul, că se răcește tabla.', 'Come on, roll, the board is getting cold.'], ['Hai, că-ți trece timpul.', 'Come on, your time is running out.']],
    idleMove: [['Ești la mutare!', "It's your move!"], ['Hai, că-ți trece timpul.', 'Come on, your time is running out.']],
    // --- how the game stands
    dAhead: [['Sunt bine în față. Un zar de fugă mi-ar mai trebui.', "I'm well ahead. One more running roll would do."]],
    dBehind: [['M-ai luat din zar, nu din joc.', "You're beating me with the dice, not with the play."]],
    close: [['Cursă strânsă. Acum zarul contează.', 'A tight race. Now the dice matter.']],
    martThreat: [['Scoate și mata un pul, că rămâi marț.', "Bear one off yourself, or you'll be left marț."], ['Miroase a marț.', 'I smell a marț.']],
    martRisk: [['Stai așa, că nu mă faci marț pe mine.', "Hold on, you won't make a marț of me."]],
    // --- the end
    dWinLinie: [['Te-am făcut, frate! O linie la mine.', 'Got you, brother! One line to me.'], ['Linie. Să fii sănătos.', 'A line. Stay healthy.']],
    dWinMart: [['Marț! Te-am făcut marț, tinere. Două linii.', "Marț! I've made a marț of you, young man. Two lines."]],
    dWinTehnic: [['Marț tehnic! Trei linii. Asta se trece în caiet.', 'A technical marț! Three lines. This one goes in the notebook.']],
    pWinLinie: [['Ai câștigat. O linie la mata. Zar ai avut…', 'You won. One line to you. You did have the dice…'], ['Bravo. M-ai bătut cinstit.', 'Well done. You beat me fair and square.']],
    pWinMart: [['M-ai făcut marț… Să nu afle băieții.', "You made a marț of me… Don't let the boys find out."]],
    pWinTehnic: [['Marț tehnic?! De patruzeci de ani n-am pățit asta.', "A technical marț?! That hasn't happened to me in forty years."]],
    rematch: [['Mai facem una? E {you}–{doru} la trei linii.', "Another one? It's {you}–{doru}, first to three lines."]],
    matchDoru: [['Trei linii. Partida e a mea. Un ban, cum se joacă la noi.', 'Three lines. The match is mine. One ban, as we play it here.']],
    matchYou: [['Trei linii la mata. Bravo! Te trec în caietul tablelor.', 'Three lines to you. Well done! You go in the table notebook.']],
    leave: [['Pleci? Las tabla așa. Te aștept.', "Leaving? I'll leave the board as it is. I'll wait for you."]],
    // --- the onlooker by the table (chibiț)
    kHitChance: [['Atacă-l acum, la baionetă!', 'Go at him now, bayonets fixed!']],
    kTease: [['Lasă-l, nea Doru, nu-l mai tachina, că-i tânăr.', "Leave him be, Doru, stop teasing, he's young."]],
    kDouble: [['Ăsta zar!', "Now that's a roll!"]],
    kDoruWins: [['Să trăiești, nea Doru!', 'Long life to you, Doru!']],
    kYouWin: [['Bravo, tinere! L-ai bătut pe nea Doru.', 'Well done, young man! You beat old Doru.']],
    // --- answers to what the player says
    aDice: [["Contează, da' și capul.", 'They do, but so does the head.'], ['Zarul îl dă Dumnezeu, mutarea o faci mata.', 'God gives the roll, you make the move.']],
    aPraise: [['Mulțumesc. Patruzeci de ani de Cișmigiu.', 'Thank you. Forty years of Cișmigiu.'], ['Am învățat de la ăi bătrâni, aici, pe băncile astea.', 'I learned from the old ones, right here on these benches.']],
    aTease: [['Noroc are cine știe să-l joace.', 'Luck belongs to those who know how to play it.'], ['Zi mersi că nu jucăm pe bani mulți.', "Be glad we're not playing for big money."]],
    aHintMove: [['Eu aș muta pulul ăsta. Uite aici.', "I'd move this checker. Look here."], ['Pe ăsta l-aș muta eu. Dar mata hotărăști.', "This is the one I'd move. But it's your call."]],
    aHintEnter: [['Eu aș intra aici.', "I'd come in here."]],
    aHintOff: [['Eu aș scoate pulul ăsta.', "I'd bear this checker off."]],
    aHintRoll: [['Întâi dă cu zarul, pe urmă vorbim.', 'Roll the dice first, then we talk.']],
    aHintNone: [['N-ai ce muta. Se mai întâmplă.', "There's nothing you can move. It happens."]],
};
/** what the player can say (the Talk menu): label, the line, the bank Doru answers from */
export const TALK = [
    { id: 'hint', label: 'Ask for advice', ro: 'Ce-ai muta mata, nea Doru?', en: 'What would you play, Doru?' },
    { id: 'dice', label: 'Blame the dice', ro: 'Zarul contează, nea Doru!', en: 'The dice matter, Doru!', answer: 'aDice' },
    { id: 'praise', label: 'Praise him', ro: 'Bine jucat, nea Doru.', en: 'Well played, Doru.', answer: 'aPraise' },
    { id: 'tease', label: 'Tease him', ro: 'Ai noroc porcesc!', en: "You have pig's luck!", answer: 'aTease' },
];
const KIBITZ = new Set(['kHitChance', 'kTease', 'kDouble', 'kDoruWins', 'kYouWin']);
// [chance, seconds since the last line] a line needs; anything not listed is always said
const GATE = { dPlain: [0.55, 3], d65: [0.8, 2], d11: [0.8, 2], p11: [0.6, 4], dLucky: [0.85, 2], dUnlucky: [0.85, 2], pLucky: [0.8, 3], pUnlucky: [0.7, 3], pDouble: [0.85, 2],
    dPoint: [0.45, 5], dHomePoint: [0.7, 4], dBlot: [0.3, 8], dEnter: [0.5, 5], pPoint: [0.4, 6], pHomePoint: [0.6, 5], pBlot: [0.35, 8], pFirstOff: [0.8, 3], dFirstOff: [0.9, 2],
    dAhead: [0.3, 12], dBehind: [0.3, 12], close: [0.3, 14], martThreat: [0.6, 8], martRisk: [0.6, 8], pUndo: [0.5, 12], kHitChance: [0.3, 10], kTease: [0.35, 10], kDouble: [0.3, 8], idleRoll: [1, 6], idleMove: [1, 6] };

const pointMade = (s, i, p) => s.points[i] * p >= 2;
const inHome = (i, p) => (p === 1 ? i <= 5 : i >= 18);
/** blots of `p` an opposing checker can reach with one die or a simple two-dice sum (a rough count, for comments only) */
function exposed(s, p) {
    let n = 0;
    for (let j = 0; j < 24; j++) {
        if (s.points[j] * p !== 1) continue;
        const from = []; if (s.bar[side(-p)]) from.push(p === 1 ? -1 : 24); for (let k = 0; k < 24; k++) if (s.points[k] * p < 0) from.push(k);
        if (from.some((k) => { const d = (j - k) * p; return d > 0 && d <= 11; })) n++;
    }
    return n;
}
/** what changed over one or more moves by `p`: hits, new gates, a closed board, bare checkers left, entering, first checker off */
export function analyse(before, after, p) {
    const me = side(p), them = side(-p), home = p === 1 ? [0, 1, 2, 3, 4, 5] : [18, 19, 20, 21, 22, 23];
    const made = []; for (let i = 0; i < 24; i++) if (!pointMade(before, i, p) && pointMade(after, i, p)) made.push(i);
    const closed = (s) => home.every((i) => pointMade(s, i, p));
    return { hits: Math.max(0, after.bar[them] - before.bar[them]), points: made.length, homePoints: made.filter((i) => inHome(i, p)).length,
        closed: closed(after) && !closed(before), blots: Math.max(0, exposed(after, p) - exposed(before, p)), entered: before.bar[me] > after.bar[me],
        firstOff: before.off[me] === 0 && after.off[me] > 0, off: after.off[me] - before.off[me] };
}
const pips = (s, p) => s.bar[side(p)] * 25 + s.points.reduce((sum, n, i) => sum + Math.max(0, n * p) * (p === 1 ? i + 1 : 24 - i), 0);
/** the standing seen from Doru (−1): a marț in the air, a clear lead, a tight race */
export function standing(s) {
    const mine = pips(s, -1), yours = pips(s, 1), contact = (() => { let lastYou = -1, firstMe = 24; for (let i = 0; i < 24; i++) { if (s.points[i] > 0) lastYou = i; if (s.points[i] < 0 && firstMe === 24) firstMe = i; } return s.bar[0] + s.bar[1] > 0 || firstMe < lastYou; })();
    if (s.off[1] >= 8 && s.off[0] === 0) return 'martThreat';
    if (s.off[0] >= 8 && s.off[1] === 0) return 'martRisk';
    if (yours - mine > 28) return 'dAhead';
    if (mine - yours > 28) return 'dBehind';
    if (!contact && Math.abs(mine - yours) <= 8) return 'close';
    return null;
}

/**
 * The voice: createBanter({ rng }) → { say(key, vars, t), roll(ev, t), turn(ev, t), … }. Every call returns
 * { key, who: 'doru' | 'kibitz', ro, en } or null (nothing worth saying now). `t` is the game clock in seconds.
 */
export function createBanter({ rng = Math.random } = {}) {
    const bags = new Map(); let last = -1e9, lastKey = null;
    const fill = (text, vars) => text.replace(/\{(\w+)\}/g, (m, k) => (vars[k] ?? m));
    const draw = (key) => { let bag = bags.get(key); if (!bag?.length) { bag = LINES[key].map((_, i) => i); for (let i = bag.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [bag[i], bag[j]] = [bag[j], bag[i]]; } bags.set(key, bag); } return LINES[key][bag.pop()]; };
    const say = (key, vars = {}, t = 0, force = false) => {
        if (!LINES[key]) return null;
        const gate = GATE[key];
        if (!force && gate && (t - last < gate[1] || rng() > gate[0])) return null;
        if (!force && key === lastKey && LINES[key].length === 1 && t - last < 20) return null;
        const [ro, en] = draw(key); last = t; lastKey = key;
        return { key, who: KIBITZ.has(key) ? 'kibitz' : 'doru', ro: fill(ro, vars), en: fill(en, vars) };
    };
    const rollVars = (dice) => { const c = callRoll(...dice); return { roll: c.ro, rollEn: c.en, Roll: cap(c.ro), RollEn: cap(c.en), hi: cap(NUMBERS.ro[c.hi]), lo: NUMBERS.ro[c.lo], hiEn: cap(NUMBERS.en[c.hi]), loEn: NUMBERS.en[c.lo] }; };
    return {
        say, rollVars,
        opening(dice, t) { const v = rollVars(dice); return say(dice[0] === dice[1] ? 'openTie' : dice[0] > dice[1] ? 'openYou' : 'openDoru', v, t, true); },
        /** ev: { who: 1 | −1 (the roller), dice, pct (0…1 from rollLuck, or null), canMove, onBar, hitChance } */
        roll(ev, t) {
            const v = rollVars(ev.dice), c = callRoll(...ev.dice), d = ev.who === -1, pct = ev.pct ?? 0.5;
            if (!ev.canMove) return say(ev.onBar ? (d ? 'dDance' : 'pDance') : (d ? 'dBlocked' : 'pBlocked'), v, t, true);
            if (c.double && c.hi === 6) return say(d ? 'd66' : 'p66', v, t, true);
            if (c.double && c.hi === 1) return say(d ? 'd11' : 'p11', v, t, d);
            if (c.double) return say(d ? 'dDouble' : 'pDouble', v, t) || (!d ? say('kDouble', v, t) : say('dPlain', v, t, true));
            if (d && c.hi === 6 && c.lo === 5 && pct >= 0.45) return say('d65', v, t) || say('dPlain', v, t, true);
            if (pct >= 0.84) return say(d ? 'dLucky' : 'pLucky', v, t) || (d ? say('dPlain', v, t) : null);
            if (pct <= 0.14) return say(d ? 'dUnlucky' : 'pUnlucky', v, t) || (d ? say('dPlain', v, t) : null);
            if (!d && ev.hitChance) return say('kHitChance', v, t);
            return d ? say('dPlain', v, t) : null;
        },
        /** after a finished turn (or a single hit): tags from analyse(); who 1 | −1 */
        turn(ev, t) {
            const g = ev.tags, d = ev.who === -1, k = (a, b) => (d ? a : b);
            if (g.closed) return say(k('dClosed', 'pClosed'), {}, t, true);
            if (g.hits) return say(k('dHit', 'pHit'), {}, t, true);
            if (g.firstOff) return say(k('dFirstOff', 'pFirstOff'), {}, t);
            if (g.homePoints) return say(k('dHomePoint', 'pHomePoint'), {}, t);
            if (g.entered) { const r = d ? say('dEnter', {}, t) : null; if (r) return r; }
            if (g.points) return say(k('dPoint', 'pPoint'), {}, t);
            if (g.blots) return say(k('dBlot', 'pBlot'), {}, t);
            return null;
        },
        standing(s, t) { const key = standing(s); return key ? say(key, {}, t) : null; },
        /** result: gameResult(); score: { you, doru } lines after this game; over: someone reached three lines */
        end(result, score, t) {
            const d = result.winner === -1, key = (d ? 'dWin' : 'pWin') + (result.points === 3 ? 'Tehnic' : result.points === 2 ? 'Mart' : 'Linie');
            const out = [say(key, {}, t, true)];
            out.push(say(d ? 'kDoruWins' : 'kYouWin', {}, t, true));
            out.push(score.you >= 3 || score.doru >= 3 ? say(score.doru >= 3 ? 'matchDoru' : 'matchYou', {}, t, true) : say('rematch', { you: score.you, doru: score.doru }, t, true));
            return out.filter(Boolean);
        },
        /** the player speaks (TALK id); hint: { phase, move } from the game → [the player's line, Doru's answer] */
        talk(id, hint, t) {
            const o = TALK.find((x) => x.id === id); if (!o) return [];
            const you = { key: 'you', who: 'you', ro: o.ro, en: o.en };
            if (id !== 'hint') return [you, say(o.answer, {}, t, true)];
            const m = hint?.move; // (the game shows the move on the board: the points carry no numbers)
            if (hint?.phase !== 'move') return [you, say('aHintRoll', {}, t, true)];
            if (!m) return [you, say('aHintNone', {}, t, true)];
            return [you, say(m.from === 'bar' ? 'aHintEnter' : m.to === 'off' ? 'aHintOff' : 'aHintMove', {}, t, true)];
        },
    };
}
