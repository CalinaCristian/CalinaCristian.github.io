# 18 — Time of day, weather, seasons, lighting

Owner role: **render** (render.js, weather.js). Status: largely shipped (round 2) — keep working, extend to districts and tourist spots.

## Requirements (shipped unless noted)
R18.1 Real solar position from local time + lat/lon; dawn/day/sunset/dusk/night; stars + moon. ✅
R18.2 Street lamps at real positions; night light pool without flicker; headlights `L` + auto. ✅
R18.3 Live weather (Open-Meteo, cached 15 min) with climate-normal fallback; rain/snow/fog/storm; wet roads; snow dusting. ✅
R18.4 Seasons by date/latitude: blossom, summer, autumn per tree, bare winter crowns, dormant grass; conifers green. ✅
R18.5 Works per district and per tourist spot scene (lat/lon + time zone of the scene; 1991–2020 climate normals when Open-Meteo is unavailable) — **review** (render side done; district centre in `main.js` requested from gameplay, spec 10 Requests).
R18.7 Lighting realism (round 3): AgX tone mapping + display grade, SH ambient probe (sky + sunlit-wall + ground bounce), wet roads with puddles and lamp reflections, urban night sky glow, night-lit material hook, dimmed daytime headlights — **review**.
R18.6 Performance: zero daytime cost for night systems; 60 fps at auto. ✅ (owner: ultra 60 fps)

## Acceptance
- [ ] Visual QA night run per district: no flicker (0 lamp pops), no dark cabin issues.
- [ ] Tourist spots respect time/weather/season.

## Requests
- (world-visual → render, 2026-11-07) Shade is strongly sky-blue: with the asphalt albedo raised to ≈ 0.12 (world.js), a road in a building's shadow renders ≈ sRGB (38, 45, 63) at day / clear (SeaTac Departures Drive, Magheru, Lascăr Catargiu). It no longer reads black, but the visual QA `road-not-asphalt` detector now flags it (32 samples in unirii + romana, 11 at SeaTac) and it looks bluish next to the sunlit part. A more neutral shade term (ground bounce / lower hemisphere saturation, or AO-style env lighting) would make shaded asphalt read grey. World keeps the asphalt slightly warm (`#6c6b69` RO, `#5d5c5a` US, concrete `#878581`) to compensate.

- (vehicles/cockpit-ui → render, 2026-11-07) Daytime fog (romana, 13:00, 3 °C fog): with the player's headlights on, a white vehicle 10–15 m ahead (box truck / delivery van rear, white SUV) blows out to a white bloom blob (`scratchpad/vehicles/game_after3_day_lookleft60.png` vs the same frame with `setHeadlights(false)`: `game_after3_day_fwd_nohl.png`). Not material-specific (same with the classic per-colour vehicle materials); please cap the headlight spot intensity in daylight / fog, or its contribution to bloom.
## Progress log
