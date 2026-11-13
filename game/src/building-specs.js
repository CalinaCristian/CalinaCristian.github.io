// ============================================================================
//  BUILDING_SPECS — the per-building research specs of the non-residential buildings in each chapter district
//  (game/research/buildings-<city>-<district>.json, research lane 2026-11-07, 615 buildings), baked into a compact
//  table for archetypes.js (the game does not fetch game/research at runtime). A district JSON may carry the same
//  rows as data.buildingSpec (world-data Request in spec 12), which then takes precedence.
//  Row: [lat, lon, footprint m², archetype, storeys (0 = ?), ground-floor height m, facade hex, flags, material,
//        era/style, roof, shop units, name, street it fronts, year built, building-name sign "text|e" (entrance) / "|t" (roof)]
//  archetype: sr shopfront row · mx shops under housing · ob office block · cw curtain-wall office · cv civic · ho hotel ·
//        un university · sc school · ch church · in industrial shed · su supermarket · ml mall · pk parking · bk bank ·
//        dt drive-thru · fu fuel station · cvs CV-stop building
//  flags: 1 on a chapter route · 2 storeys from OSM / research (not an estimate) · 4 facade photo-researched / OSM ·
//        8 rooftop plant · 16 entrance canopy · 32 landmark / CV stop (hand-modelled elsewhere)
//  material: pl plaster · cw curtain wall · st stone · sp sandwich panels · mc metal cladding · us US brick/panel storefront ·
//        cf concrete frame · cc exposed concrete · pn panels · rb brick · fu canopy
//  era/style: v villa · m modern office · c communist-era · a annex · p post-1990 · i interwar · e pre-1919 eclectic
//  roof: f flat · p pitched / unknown · h hipped · g gabled · y pyramid · m mansard · d dome (landmark)
// ============================================================================
import bucharestFloreasca from './building-specs/bucharest-floreasca.js';
import bucharestGrozavesti from './building-specs/bucharest-grozavesti.js';
import bucharestUnirii from './building-specs/bucharest-unirii.js';
import bucharestPipera from './building-specs/bucharest-pipera.js';
import bucharestRomana from './building-specs/bucharest-romana.js';
import bucharestOtopeni from './building-specs/bucharest-otopeni.js';
import seattleBellevue from './building-specs/seattle-bellevue.js';
import seattleSeatac from './building-specs/seattle-seatac.js';

export const BUILDING_SPECS = {
    'bucharest-floreasca': bucharestFloreasca,
    'bucharest-grozavesti': bucharestGrozavesti,
    'bucharest-unirii': bucharestUnirii,
    'bucharest-pipera': bucharestPipera,
    'bucharest-romana': bucharestRomana,
    'bucharest-otopeni': bucharestOtopeni,
    'seattle-bellevue': seattleBellevue,
    'seattle-seatac': seattleSeatac,
};
