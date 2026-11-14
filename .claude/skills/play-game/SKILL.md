---
name: play-game
description: Let the owner play Drive My CV from a cloud session. Use whenever the owner asks to run, open, play or "give me a link to" the game. Ports in the cloud container are NOT reachable by the owner; the latest game is live at https://cristiancalina.com/game/ (GitHub Pages from master).
---

# Play Drive My CV from a cloud session

## The way to play: https://cristiancalina.com/game/
GitHub Pages ("pages build and deployment") serves `master`. The owner wants it always on the latest version:
after finishing work, push it to `master` (see `AGENTS.md` → Publishing), watch the Pages run
(`mcp__github__actions_list` → `list_workflow_runs`) and check that
`curl -s -o /dev/null -w "%{http_code}" https://cristiancalina.com/game/index.html` returns 200.
`_config.yml` keeps `game/dev`, `game/research`, `specs`, `tools` and the large evidence folders out of the Pages
build, which otherwise times out in "syncing_files"; add new dev-only folders to that list.
Commits: author and committer Cristian Calina <cristycalina@gmail.com>, no session lines in messages. Keep history
clean: one scoped commit per area of change (squash fixups locally before pushing), and push to `master` once per
finished batch of work, not after every small step. Work on `master` directly (no side branches left on the remote).

## What does NOT work
- Starting `python3 -m http.server` / `report_preview_port`: the owner cannot open ports of the cloud container.
- A claude.ai artifact copy of the game: publishing requires reading every file in full (the game is ~18 MB), so it
  cannot be kept current. Give the owner the live link above instead.

## Run it locally (owner's own machine)
```
git clone https://github.com/CalinaCristian/CalinaCristian.github.io.git
cd CalinaCristian.github.io && python3 -m http.server 8000
```
then http://localhost:8000/game/index.html
