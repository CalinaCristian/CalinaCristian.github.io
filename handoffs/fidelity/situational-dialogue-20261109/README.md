# Situational dialogue library/governor · 9 November 2026

**CPU-only candidate; zero wired/native-proved events.** Root owns Main/Traffic/HUD/data.js integration. This package adds only `situational-dialogue-library.js`, `situational-dialogue.js` and this unique handoff/tests. It does not replace the current PHRASES/dialogue.json presentation path or claim that a current game event displays these lines.

315 original lines: Bucharest 119 (Romanian plus natural English gloss), Seattle 96, Bellevue 100. They cover actual player/NPC horn reactions, source-driver remarks, vehicle-contact participants/witnesses, concern-only pedestrian-contact reactions, static contact, verified queues/signals, greetings and ambient conversation. Place conditions cover compact Old Town/Lipscani, Carusel, Freddo, Arc, Cișmigiu, Pipera/Hermes/BOB, Romană, Pike Place, Seattle Center/waterfront, Downtown Park, Meydenbauer Bay, Lincoln Square and Bellevue Way. Time/weather/temperature/calendar conditions are explicit positive filters. No slurs, cursing, hostile regional/nationality assumptions, inferred fault, predicted medical outcome, invented business opening/event or inferred green/walk signal is included.

“Ce-ai făcut, Bobiță?” / “What have you done, Bobiță?” is gated by **confirmed vehicle contact AND explicit proven `playerCausedContact:true`**. Unknown fault excludes it. Pedestrian contact can select only concern/help/space lines, never jokes or “they’re fine”/“got up” assertions.

## Root API

```js
import {createSituationalDialogue} from './situational-dialogue.js';
const dialogue = createSituationalDialogue({seed:'dialogue-only:scene-id'});
const offer = dialogue.offer({
  nowMs: performance.now(), // monotonic, same origin as event.atMs
  event: {
    id: 'scene-id:actual-horn:1', // unique actual event, independent counter
    kind: 'player-honk', // player-honk|npc-honk|collision|ambient|greeting|waiting
    confirmed: true,
    atMs: actualEventMonotonicMs,
    sourceId: 'player',
    targetId: null, // leave unknown recipient null
    facts: {},
  },
  speaker: {id:'scene-id:driver:7', role:'driver', relation:'witness', eligible:true},
  context: {
    city:'bucharest', district:'unirii',
    placeIds:['old-town'], // source-validated actual speaker locality; [] if unknown
    localHour:23, // actual game-local hour; omit if unknown
    // weatherObserved:true, weatherKind:'rain', temperatureC:8,
    // calendar:{month:3,day:1}, // actual game-local date, not season guess
  },
});
if (offer) {
  const accepted = traffic.say(actualSpeaker, offer.line, offer.cls, offer.priority) === true;
  dialogue.settle(offer.token, accepted, performance.now());
}
// Before scene replacement: optionally export only bounded line variety.
const recent = dialogue.exportRecent(performance.now());
dialogue.dispose();
// A fresh scene governor can importRecent(recent, performance.now()).
```

Speaker roles: `driver|pedestrian|staff`; relations: `source|recipient|witness|participant|conversant`. Source relation must match source actor identity. Recipient must match a known target ID. Participant is collision-only and must match source or target. A physical-event witness must be a different actor. `conversant` is greeting-only, for actual player interaction.

`eligible:true` is a **caller assertion from actual spatial/actor state**: valid active speaker, correct role, nearby event, actual compatible elevation/layer, alive/not-down, and actual context locality. The helper receives no actors/positions/renderers and cannot establish spatial eligibility or line of sight itself. Root uses its existing bounded grid/near queries and actual surfaces/layers; no per-frame full-crowd scan. HUD/Traffic.say retains camera visibility/layout/distance/elevation authority. The existing say method passes a presentable anchor before returning true; this CPU fixture does not prove rendered pixels or reading time.

`facts.contact:true` plus `collisionType:vehicle|pedestrian|static` is mandatory for collision. Queue lines require `queued:true`. `speakerSignal:green|red` refers to the **speaker’s own actual signal**, not the player’s signal or a city-wide phase. `speakerWalkSignal:walk` is explicit actual pedestrian right-of-way. No green command guarantees a clear path or urges a launch. The horn alone proves neither a red-light violation nor a recipient.

`weatherKind:rain|snow|clear|cloud|fog` and temperature are considered only when **`weatherObserved:true`**. Root canonicalizes its actual weather state; the helper does not turn seasons/months into weather. Heat needs actual temperature ≥28°C; cold ≤2°C. Hours are explicit 0≤hour<24; midnight is valid, missing time is unknown. Calendar is a supplied valid local month/day; Mărțișor on 1 March, Romanian National Day on 1 December, US 4 July greetings imply no parade/fireworks/venue event. Bellevue is selected by `city:'seattle',district:'bellevue'`; unknown city is rejected, never replaced by Bucharest.

## Exact existing hooks / traps

`integration-source.json` records the inspected root source head/file/method hashes and line numbers. All ten inspected methods were byte-identical in this worker’s actual-method test source despite unrelated root work in progress. The existing method is named **Traffic.bubble**, not bark.

1. **Real player horn:** emit one dialogue event in `Main.playerHonk()` **after its actual `audio.horn` submission**. Root may pass that identity into the already bounded driver/pedestrian candidate work. Do not blindly turn every `Traffic.playerHonk(...)` call into a horn: `Main.onCollide` pedestrian handling and the red-light logic also call it as a convenience reaction without a real player horn. Those calls are not horn evidence.
2. **Real NPC horn / NPC-to-NPC response:** `Traffic.honk(v,reason)` calls `onHonk`; `Main.vehicleHonk(v)` currently applies distance/rate gates before `audio.horn`. Confirm an event only at actual horn submission, with `sourceId` for `v`. `reason:'stuck'|'reply'|'honkedAt'|'lanechange'` alone does not prove a player/NPC recipient, fault or signal. Use source-driver or eligible witness lines when target identity is unknown. A known target needs a real source/recipient relationship from the actual calling authority; do not infer it from the nearest car.
3. **Actual player contact:** `Player.hit(...)` feeds `Main.onCollide(strength,what,v)` after the existing collision cooldown. This is the current actual contact authority. Emit one collision event there; preserve `what` and actual involved IDs. `Traffic.bump(v)` is a vehicle reaction hook reached from this authority, not an independent proof of fault. Its possible horn is a separate actual NPC horn if emitted. Pedestrian contact is concern-only. Static contact includes confirmed edge/solid hits, never a guessed crash from nearby geometry.
4. **NPC-to-NPC crashes:** currently **no confirmed impact event is exposed**. `Traffic.overlapGuard`, `overlapsAny`, car-following and nudge SAT/proximity checks prevent or correct contacts. They must never fabricate an accident. Library participant/witness coverage stays unwired until root identifies a genuine physical resolution authority.
5. **Bystanders:** root selects at most the few actual eligible near/same-level observers from existing bounded native queries. Do not scan every crowd member each frame, attach identities to real people, or synthesize an audience. Pass the same confirmed event ID to all reactions; default cap is two accepted speakers per event.
6. **Other covered contexts:** actual E conversation may emit `greeting`; an existing ambient-chatter tick may emit `ambient`; an actual measured queue may emit `waiting`. These are library capabilities, not automatic hooks. Place tags come from source-validated actual locality, never from loose text matching or model-anchor proximity across floors.

A governor rejection means **silence**, not fallback to a legacy PHRASES line. The old library contains unconditional green/walk/weather/fault/medical lines; falling through would undo context guarantees. Root should replace only presentation selection, preserve existing driving/annoyance/speed/reply chance behavior and RNG draw order, and avoid duplicate old/new bubbles. `offer/settle` results must not change vehicle movement, route choice, candidate admission or existing Traffic.rng calls. Existing NPC-reply setTimeout lifecycle belongs to Traffic and is not repaired or inherited by this new helper; this helper schedules no timer.

## Bounded ownership / selection

Independent UTF-16 event/speaker/line hash with final avalanche; no `Traffic.rng`, `Math.random`, wall-clock sampling or random speaker choice. Selection is stable for the same seed/confirmed event/speaker/recent state. Context-specific lines receive a deterministic weight, with cooldown variety across the entire current locale/event pool. Stable IDs use group plus row; append future rows rather than reorder published ones.

Defaults / hard caps: recent lines 64/128, events 96/256, pairs 128/256, speakers 96/256, pending reservations 4/8, accepted responses per event 2/3. Default line cooldown 45s, pair 12s, speaker 6.5s, pending expiry 1.2s, actual-event age 2.5s. Event retention 30s exceeds event age+pending expiry; line retention 120s exceeds its cooldown. Overrides are validated numeric known keys with finite upper limits. No retained event queue (**capacity zero**) or timer; lazy prune happens only on event/API calls. Old/future events and reversed monotonic clocks reject. A saturated eligible line pool stays silent until a line becomes available.

Only accepted synchronous presentation commits cooldowns. Root should settle false in a finally path if presentation throws. Greetings default to priority 3, contact 2, other speech 1; HUD retains the final layout decision. Rejected/cancelled/expired offers retain no event credit. Pending state contains primitive event/actor IDs, signature, line ID, pair key and expiry only, never caller objects/callbacks. Snapshot export stores bounded `{id,ageMs}` line variety only; imports validate known IDs/version/ages and inspect at most the final configured 64 (default) entries. No actor/location/event/route state is saved. Idempotent dispose clears every instance map and seed; late calls are harmless.

## Evidence and remaining gates

Run `node --expose-gc handoffs/fidelity/situational-dialogue-20261109/controls.mjs`.

19 meaningful CPU controls: complete immutable library/RO glosses, confirmation/identity/contact truth, NPC source/recipient roles, pedestrian concern/Bobiță causality, city/place/time/weather/temperature/calendar/signal cross-filters, deterministic sequence and actual `makeRng` stream parity with zero global random/timer calls, rejected-HUD noncommit, event/speaker/pair/line cooldowns, stale/pending limits, 5,000-event bounded storm, bounded import/export, actual `Traffic.prototype.say` distance/elevation/layout/accepted-gloss behavior, disposal and actual Node WeakRefs. Positive strong-reference control stays alive while transient actor/context references collect even with an outstanding primitive offer. Source hashes in the report identify exact tested bytes.

Not proved: any real Main/Traffic hook, audible event, native screen/HUD bubbles or timing, live same-level/locality eligibility, actual pedestrian/collision animations, scene-return integration/disposal, or FPS/full-world budget. Native proof requires root wiring then a coordinated immutable run. Global docs/overview and current library replacement remain root-owned. No browser or source copy was created.
