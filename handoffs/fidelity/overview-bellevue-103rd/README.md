# Bellevue 103rd Avenue overview investigation

Overview-only work starts from published master **e354a500e95a5f741564becf528af1f9445bd265**. No game runtime, district data, landmark model or source geometry is changed here. Root owns runtime correction/publication.

All four reported pictures are historical 4198996 evidence at the same panorama XY and source w6422057/layer 0. Their modeled road base is -3.87004866978 m and camera Y -1.37004866978 m. Both forward requests have the same pose, but their original pixels differ: both old images remain untouched.

Fresh exact **aabd17adfc8853c1ea23d3846782c5d1cc9be50f** capture reproduces the underground-looking geometry at that same source road and camera. Native edge 454/road 133 is ordinary residential, bridge=false/tunnel=false/layer 0. Node 11332315028 has modeled Y -4.65935206465; node 11332315026 has -4.05033420573. Camera surfaces are [-3.870048670,-3.810334206,-3.810334206], not an ambiguous deck choice. This is a current World profile/model problem. The runtime owner traced its negative envelope to the neighboring Avenue Square tunnel estimate; no camera lift or different-road substitution repairs it.

The original panorama XY, headings, pitches, FOV and 2.5 m modeled-road-relative height are retained. Cached Street View was inspected only for comparison; no reference pixels/attributes/altitude were published or extracted. The orange barrier marks a game-map cut, not a real closure; the full source way continues beyond the compiled boundary.

The aabd images are a **known-issue collection**, not corrected or passing pictures. Original 426 images/thumbs/dates/manifest remain unchanged. Four new requests yield 3 unique captured frames; identical forward requests share one frame with explicit duplicateOf and matching image hash/date/source. No old differing pixels are collapsed.

The viewer shows street/direction titles, estimated camera height, capture dates and specific issue/boundary explanations. Original scope/note/source/camera/reference records remain in details. Alias controls refuse mismatched pixels/date/source and unrelated repeated IDs.

Static component browser checks pass at 1280/390:3 new pictures decode;4 raw requests retained; historical pagination reaches 48; no overflow or page errors. No native World or reference API is loaded by that test. Both actualUI screenshots were inspected and contain game pixels only. This is not all-eight-gallery realism acceptance.

The exact source archive has 182 Git-verified files/15,471,702 bytes, with no overview/reference copies or source overrides. After-capture hashes are checked. First tool attempt called optional groundAt as required and failed before pixels; its tool/log are retained. Corrected native capture closed before the tourist browser started.

```sh
node handoffs/fidelity/overview-bellevue-103rd/check-aliases.mjs
NODE_PATH=/path/to/playwright node handoffs/fidelity/overview-bellevue-103rd/check-viewer.cjs "$PWD" /tmp/viewer-check
```

Runtime correction and fresh corrected captures remain pending. Retain this known-issue collection and all histories when publishing later source-pinned retakes.
