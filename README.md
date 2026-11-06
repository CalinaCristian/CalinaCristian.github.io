# About
This is my Resume (CV) website.

I wanted to create something responsive & animated, and to challenge myself with some CSS.

It is done in vanilla JS, HTML & CSS.

I used media queries to make it fully responsive (alongside with flexbox)

# Live Demo

You can find the live version [here](https://cristiancalina.com)

# 🎮 Drive My CV — the interactive résumé game

The landing page has an opt-in **Play my CV** button that opens `game/`: a first-person 3D driving game
(Three.js, vanilla ES modules, no build step) in which you drive through **Bucharest** to the offices where I
worked, fly from Otopeni to Seattle, and drive from SeaTac to the UiPath office in **Bellevue**. Each office is a
walkable interior whose screens unlock a chapter of my CV.

- **Real maps**: streets, lanes, one-ways, speed limits, traffic signals, building footprints and floor counts,
  businesses (gas stations, fast food, shops, metro entrances…), parks and water come from OpenStreetMap
  (`tools/osm/` builds `game/data/*.json`; see `tools/osm/README.md`). Bucharest is scaled 0.7 and the Seattle
  corridor 0.5 to keep trips short; 44 landmarks are modelled by hand (`game/src/landmarks.js`).
- **Traffic**: trams, buses, taxis, double-parked cars, pedestrians, honking and chat bubbles (Bucharest edition).
- **Systems**: speed cameras and fines, fuel and refuelling at real stations, A* navigation with turn-by-turn on the
  dashboard screen, fast travel, real-time day/night from the city's local time with street lights and headlights.
- **Controls**: `W/S` drive · `A/D` steer · `Space` brake · `H` horn · `E` enter / refuel · `M` map & navigation ·
  `F` fast travel · `R` reset to road · `L` headlights · `C` look back · `N` mini-map.

Map data © OpenStreetMap contributors (ODbL).
