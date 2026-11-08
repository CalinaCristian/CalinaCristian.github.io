# Conditions access and Live time

Implementation: `c5c2831` on `fidelity/conditions-access`, based on `14f6b8d`.

## Player behavior

- Main menu **Settings → Time, weather & season** opens the same panel used by **Esc → Settings**, **K**, and the existing conditions entry. It works before any district loads.
- The time section now includes **Live** (`data-tod="now"`). It clears both the clock offset and fixed lighting preset. The selected Live button reflects that choice, and live time follows the destination's current local time after travel.
- Title choices apply to New story and world-map starts. Continue restores the saved session's conditions; the title panel explains this. Weather selection sends no live request before a place loads.
- Title quick time/weather selectors stay synchronized with the shared panel, including a custom local-hour option. The panel includes Day and Drizzle so those existing title options have matching active buttons.
- Season highlights still come from `travelConditions()` / the renderer's effective season. Winter remains selected in the title, story and free-roam contexts; Auto is selected only for automatic season.
- Both driving and walking footer hints include **K time, weather & season**. A dark background keeps the hints readable over the cockpit and bright streets. L remains driving headlights only.
- Title dialogs preserve focus, disable the underlying menu while open, and close through Settings back to the main menu. Touch portrait and landscape use the shared scrolling panel and explicit close buttons.

## Integration scope

Only conditions/title Settings/boot-selection/footer hunks in `game/src/main.js`, exact title markup in `game/index.html`, two title-only conditions CSS rules plus footer readability styling, and the focused conditions harness/documentation changed. No world, explore, save, tour, map/navigation/F, car, drone, or mirror code changed.

The root owns README and global spec updates. Suggested documentation contract: “Main menu Settings → Time, weather & season, Esc → Settings, or K while driving/on foot opens the shared panel. Live time restores the real local clock. Title picks apply to new starts; Continue uses saved conditions. The active time/weather/season choices are highlighted.”

## Validation

Initial access run: **65 passed, 0 failed, 0 browser page errors**.

Final full run uses the committed snapshot `/tmp/conditions-access-final`:

```sh
NODE_OPTIONS=--require=/workspace/.environment/drive-my-cv/use-system-chromium.cjs \
  node game/dev/harness/conditions-check.cjs --controls \
  --out=/workspace/reality-pass/conditions-access/final
```

The full run passed **124/124 with 0 browser page errors**. It retains all original conditions/travel/Continue and mirror/light checks, plus the new access fixtures. Reviewed screenshots include title Night/Snow/Winter, driving/walking K footer hints, story Winter, Live Continue and touch portrait/landscape. The final footer readability style receives a separate access rerun.

Browser audio is muted; weather calls are deterministically mocked; only the main game RAF is manually stepped after real key events. This verifies functional UI and saved-state behavior, not performance or the full weather transition animation.

Evidence remains outside git under `/workspace/reality-pass/conditions-access/`. No external key, source imagery, screenshot, or generated report is committed. No master merge or push was performed.
