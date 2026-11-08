---
name: play-game
description: Let the owner play Drive My CV from a cloud session. Use whenever the owner asks to run, open, play or "give me a link to" the game. Ports in the cloud container are NOT reachable by the owner; the latest game is live at https://cristiancalina.com/game/ (GitHub Pages from master).
---

# Play Drive My CV from a cloud session

## The way to play: https://cristiancalina.com/game/
GitHub Pages ("pages build and deployment") serves `master`. The owner wants it always on the latest version:
after finishing work, push it to `master`, watch the Pages run (`mcp__github__actions_list` → `list_workflow_runs`)
and check `curl -s -o /dev/null -w "%{http_code}" https://cristiancalina.com/game/index.html` returns 200.
`_config.yml` keeps `game/dev`, `game/research`, `specs` and `tools` out of the Pages build — with them the
deploy timed out in "syncing_files" (340 files); keep new dev-only folders in that list.
Commits: author Cristian Calina <cristycalina@gmail.com>, no Claude / Co-Authored-By lines in messages.

## What does NOT work
- Starting `python3 -m http.server` / `report_preview_port`: the owner cannot open ports of the cloud container.
- The artifact below can't be kept current: publishing requires reading every file in full (the game is ~18 MB).

## Old private artifact (outdated, round-4 build)
The game is published as a private artifact (owner only):

**https://claude.ai/artifact/R1zhqsKq8vRpqQQ3KLX19L** ("Drive My CV — Cristian-Florin Călina")

1. Open it with `Artifact` `action: "open"` and give the owner the link.
2. Say which version it holds (see "Published version" below). If the owner wants the current branch, update it (next section).

## Update the artifact to the current code
The page is `game/index.html`. Published paths are relative to `game/`, except the site files the game loads with
`../public/…`, which are published at `public/…`.

- `index.html` ← `game/index.html` (`file_path`)
- `style.css`, `src/**`, `data/**` (district / city / spot JSON, `data/places.json`, `data/geo/*`), `vendor/**`, `assets/**` ← same path under `game/`
- `public/cv.pdf`, `public/favicon.ico`, `public/telemetry.js`, `public/fonts/Raleway-ExtraLight.ttf` ← repo `public/`
- Never publish `game/dev/**` or `game/research/**` (QA tools and research dossiers, ~380 MB).

Steps:
1. `Artifact` `action: "read"` on the URL (or `scope: "files"` listing) to see what is there.
2. List the files that changed since the published version (new files, and changed ones by size / git log).
3. Read each changed file before publishing it (artifact rule: only publish what you have read).
4. Publish to the same `url` with `root: "game"`, `file_path: "game/index.html"` and `files` = only the changed or new paths
   (files left out are kept; `null` removes one). Up to 255 files / 64 MB per publish.
5. Open the artifact and tell the owner what changed.

## Run it locally (owner's own machine)
```
git clone -b <branch> https://github.com/CalinaCristian/CalinaCristian.github.io.git
cd CalinaCristian.github.io && python3 -m http.server 8000
```
then http://localhost:8000/game/index.html

## Published version
- 2026-11-07: a round-4 build (113 files). It does not have the round-5 work: Explore mode / world map / drone,
  IndexedDB save, globe flight map, chapter transition, finale page, building archetypes, water, the smaller
  districts. It also does not have the round-6 road fix (commit 3cf5137). Update this line after every publish.
