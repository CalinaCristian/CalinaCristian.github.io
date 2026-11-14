# 18 — Time of day, weather, seasons, lighting

Owner role: **render** (render.js, weather.js).

## Requirements
R18.1 Real solar position from local time + lat/lon; dawn/day/sunset/dusk/night; stars + moon.
R18.2 Street lamps at real positions; night light pool without flicker; headlights `L` + auto.
R18.3 Live weather (Open-Meteo, cached 15 min) with climate-normal fallback; rain/snow/fog/storm; wet roads; snow dusting.
R18.4 Seasons by date/latitude: blossom, summer, autumn per tree, bare winter crowns, dormant grass; conifers green.
R18.5 Works per district and per tourist spot scene (lat/lon + time zone of the scene; 1991–2020 climate normals when Open-Meteo is unavailable).
R18.6 Performance: zero daytime cost for night systems; 60 fps at auto.
R18.7 Lighting realism: AgX tone mapping + display grade, SH ambient probe (sky + sunlit-wall + ground bounce), wet roads with puddles and lamp reflections, urban night sky glow, night-lit material hook, dimmed daytime headlights.

## Acceptance
- Visual QA night run per district: no flicker (0 lamp pops), no dark cabin issues.
- Tourist spots respect time/weather/season.
