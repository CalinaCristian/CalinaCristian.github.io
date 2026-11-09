# Menu proposal after the integrated gates

Keep the historical `READY` set of 12 visual-review records unchanged. Do not turn the 24 loaded IDs into 24 visually accepted scenes. The integrated evidence is in `proof/final-24-integrated/`; the main source is immutable `93b0d86`, followed by the separately proven fish-cancellation-only source `f056a5e`.

Use this separate, ordered availability list for 21 destinations. Twenty selected approaches physically reach on the integrated freeze, with passing cache, budget and native phone-condition controls. Meydenbauer joins after its separate actual-entry 192.589 m pier traversal on `472aadf`, documented in `proof/market-shore-final/`:

```js
export const MENU_PRIORITY = [
    'fremont-troll', 'peoples-salvation-cathedral', 'old-town-lipscani',
    'kerry-park', 'space-needle', 'pike-place', 'waterfront',
    'pioneer-square', 'chihuly', 'mopop', 'bel-lincoln-square',
    'stavropoleos-cec', 'athenaeum-revolution', 'arcul-de-triumf',
    'spring-palace', 'palace-parliament', 'gas-works', 'cismigiu',
    'bel-meydenbauer', 'bel-downtown-park', 'bel-botanical-garden',
];
const menuOrder = new Map(MENU_PRIORITY.map((id, i) => [id, i]));
for (const s of SPOTS_ALL) {
    s.ready = READY.has(s.id);
    s.menuAvailable = menuOrder.has(s.id);
}
export const SPOTS = SPOTS_ALL.filter(s => s.menuAvailable || showAll)
    .sort((a, b) => (menuOrder.get(a.id) ?? 100) - (menuOrder.get(b.id) ?? 100));
```

This replaces the current `for (const s...)` and `SPOTS` declarations, retaining `spotById` and direct development access. The comment above READY/SPOTS must distinguish historical visual review from current menu access. The full game menu can put the first three in a Recommended group before the city groups; skip those IDs in the later groups to avoid duplicates. Sorting SPOTS alone sorts within the existing city groups and in the pause list, but cannot put Troll/cathedral/Old Town together across cities. Keep all menu touch targets at least 44 px; the current title-menu inline minimum is 36 px.

Ballard, Herăstrău and Village Museum pass scene loading/cache/phone controls, but their selected activity entry routes remain unverified. Keep them directly loadable. Preserving an older park's historical menu visibility is a separate exploration choice and must not accept its unverified lock, marina or passport route. Meydenbauer's generic planner still does not prove a tour route; its separate physical traversal proves manual access to the terminal disc.

Two current labels should match the actual source-backed behavior:

- Village Museum `Step into a farmhouse` → `Collect a virtual household passport`.
- Palace `Pace the esplanade` → `Walk the public Palace sidewalk` (the actual course follows sidewalk `w1364200823`, 176.606 m; no permanent game posts).

All menu changes and shared README/spec/progression copy are owned by root. This document does not change the application or mark a scene visually complete.
