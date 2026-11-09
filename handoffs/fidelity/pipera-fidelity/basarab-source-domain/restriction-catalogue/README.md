# Literal motor restriction catalogues and size limits

The metadata-only compiler/append implementation is `99987e15af9417503855019751fafcc5d07f119e`.
All eight source datasets are appended in `0024fdd3e5722ad72bcf6acdb614022cd323a981`.
The preceding Basarab source-domain geometry remains the separately scoped7330candidate.

The current catalogues retain196raw OSM relations: Grozăvești33, Romană30, Floreasca19, Unirii26, Otopeni0,
Pipera29, SeaTac21 and Bellevue38. This is actual bounded cached-source coverage for each recorded core-source set,
not a claim that every real-world turn restriction is mapped. All retained core way IDs, original node order/tags and
positive prepared node IDs were verified against their recorded source caches. Each dataset has its own tile ledger,
source-set hash, counts and explicit interpretation exceptions.

`roadRestrictions` is exactly `[{sourceId,tags,members}]`; no incoming member, rule or permission is invented.
Raw mode-only, `except`, conditional, via-way and malformed records survive. `roadRestrictionCoverage` makes its
actual coverage and exceptions inspectable. The current matched records all use generic `restriction`; the one
observed `except` is Floreasca r1107971=`bicycle`. Twenty records have explicit structural interpretation warnings.
Groz r21068490 remains missing its incoming member; its separately documented reviewed-path compliance is not a
runtime reconstruction of that member.

The append tool preserves every existing nonmetadata JSON value. For the seven previously absent catalogues it also
preserves the exact original byte prefix up to the final root brace. Grozăvești's existing metadata was already equal,
so its entire file stays byte-identical. A full Groz compiler run produces exactly the same JSON as the standalone
append, with only `roadRestrictions` and `roadRestrictionCoverage` added relative to7330. No other district's geometry
was rebuilt. Eight focused pure controls cover raw preservation, node-only matches, conditions/modes/exceptions,
missing/multiple members, immutable snapshots, wrong source/direction/topology and deterministic ordering.

**GPS/NPC interpretation and size/admission handling are owned by separate runtime work. No browser, native fleet,
driven-route, physical-clearance or render-budget acceptance is claimed here.** The actual r21387141 Navigator
negative remains in the parent proof. New native/overview gates remain open for the earlier source-domain geometry.

## Literal size-limit inventory

`literal-road-limits.json` records79retained core source ways with one or more height/width-related tags and their exact
raw strings, source node/way IDs, road indices, complete source tags and dataset hashes. It does not parse values or
invent limits from geometry. The actual primary keys found are `maxheight`; no `maxheight:physical` or `maxwidth`
values occur in this bounded core inventory. Related `maxheight:signed=no`, `default`, `none` and explicit imperial
strings remain raw and are not numerical clearances. Node-mounted signs are outside this inventory.

Unirii's actual mapped3.5m limits are on w241368617,w241368618,w226274205,w1383050305. The4.25m values occur on
w79870041,w826403112,w1478497247. These values were sent to QA/RO for the separate source-mode routing/admission
work; an oversize trolley must not gain permission from physical headroom or the old access DTO omitting the tag.

## Reproduction

All checks are browser-free. Use a new output path; the append tool refuses existing outputs and refuses an unreviewed
change to an already-present catalogue. Use `--prefix sea_seatac_` or `--prefix sea_bel_` with the shared US tile folder.

```sh
node tools/osm/road-restrictions-check.mjs
node tools/osm/append-road-restrictions.mjs --in /path/to/current-prepared.json --out /tmp/prepared-with-restrictions.json --tiles /path/to/exact-cache
node handoffs/fidelity/pipera-fidelity/basarab-source-domain/restriction-catalogue/cache-availability.mjs /path/to/repo /tmp/cache-availability.json
node handoffs/fidelity/pipera-fidelity/basarab-source-domain/restriction-catalogue/literal-limits.mjs /path/to/repo /tmp/literal-limits.json
```

`all8-append-receipt.json` includes per-file before/after hashes and both deep/prefix equality assertions.
`all8-catalogues.json` is a small exact literal-source fixture for the runtime reader, with each current dataset hash.
The source caches and original outputs remain held at their recorded external paths. If root has newer district
geometry, append to that current prepared file after source verification; do not replace it with an older full JSON.
