# 13 — Traffic, congestion, pedestrians, transit

Owner role: **gameplay** (traffic.js). Data: **world** (`congestion` in cities.js, `trafficProfile`). APIs: spec 01.

## Requirements
R13.1 Keep: lanes/one-ways, lights, junction claims, overlap guard, honking, chat bubbles, facts ticker (owner
favourites), traffic by hour, weather slow-down.
R13.2 **Standstill traffic in real hotspots**: per district `congestion [{lat,lon,radius,hours,level}]` → at those local
hours dense spawning, queues spilling back from junctions, crawling/stopped cars, honk storms and bubbles; cleared
smoothly off-peak; the player can still get through slowly.
R13.3 Transit with real liveries/routes from research: STB trams (articulated), trolleybuses (poles under wires), buses;
King County Metro buses, Sound Transit Link where visible.
R13.4 Pedestrians: never inside cars, never on the carriageway except at crossings; density by area/hour; placed on the
source sidewalk sides; crossings need real roadside endpoints on both sides.
R13.5 Zero visible NPC–NPC and NPC–player overlaps (harness ≤ 5 minor). No permanent standstill from the traffic rules
themselves: a car held at a lane-drop line merges on the move once it has waited there and the lane beside it is free; a
knot's follower may back over the node it has just passed (its body still stands on that pad), two noses meeting
head-on keep one yielder, a follower touching only the other's side may drive away, and a body with a follower's nose in
its rear may swing its rear corner into it by at most 0.25 m while it moves off; only a car clearing a signal box on its own holds the other phases red (one queued behind
another vehicle or stalled there keeps just its path reservation), and a claimant stalled in a queue does not hold later
cars with the part of its path it has not reached; a car leaving one junction pad claims the next junction before its
line. A car claims the first junction box ahead whose pad its front has not entered, also when the link before it is
shorter than that pad (it claims from the edge before), and enters a box only with room for its whole body beyond the
exit pad in its exit lane (keep the box clear); a turning long body's claim is widened by its off-tracking, and a car
waiting for it stops that much short of its line. A lane-drop hold at a node beyond the next one is released the same
way as at the next node. A closed ring of vehicles each waiting for the next (all stopped ≥ 15 s) is undone by the
member with the most room behind it backing up along its lane at walking pace (≤ 4 m), then letting the car that waited
for it go. A walker standing on the carriageway without headway for 8 s counts as pinned (turns back or leaves the
road). A vehicle whose only road on runs to a district-edge closure takes it and leaves at the edge.
R13.6 District boundaries: vehicles despawn/respawn out of view at the edges.
R13.7 A side/rear pedestrian yield releases only when the vehicle body is already clear and its next motion increases
clearance (including what the pedestrian carries); front crossing yields stay.
R13.8 Before the first frame, bounded initial placement resolves held conflicts first, then longer blocking bodies, within
fixed work limits and full source/static/shared-lane validation. Generated parking is admitted only with legal,
supported, clear placement; a refused car keeps driving on its original lane with its identity and random sequence.
R13.9 Compile tram source identity, way/node references, original tags, route relations and tagged nodes independently of
the motor graph, without changing existing render runs or data fields; unknowns stay explicit.
R13.10 Trams bind before the first frame to source-legal rail poses with whole-body checks, keeping identities, fleet,
meshes and random sequence; motion, stopping, recovery and recycling use the same rail path; they stop at mapped stop
nodes (estimated 5 s dwell). A binding failure fails initial admission.
R13.11 Respect mapped turn-lane roles at the source-way terminal (not at internal shape nodes or clipped ends); keep
approach lanes on turns and their lateral history through node hand-off; plan straight lane drops early. A role with no
legal road for it at that node (the turn is one node further on) carries its lane straight on, or, with no road straight
on either, allows the turns that exist; a lane whose roles reach only closed roads (district-edge closure, restriction,
clearance) takes a road that exists. No lane ends without a continuation.
R13.12 Rail-mode eligibility is separate from motor access: no car on a rail edge, no tram against the rail direction or
unbound; relocation and respawn obey the same gate. Rail grades use the same model as the rendered track and support.
R13.13 Rail spawn spans and terminal stops keep the crossing-pad radius plus 1.5 m beyond the whole vehicle body.
R13.14 Compiled flag 8 (mapped controlled pedestrian crossing) gets its own signal controller at that node, never a nearby
junction's; literal crossing-footway context may associate parallel rail approaches with it.
R13.15 Select the closest source-legal track before grade admission; an underground track without a grade model stays
unresolved and never reassigns its tram to a farther surface track.
R13.16 The Victoria tram tunnel keeps the literal source paths, underground stops and ground joins; depth, floor, ramps and
roof extent are explicit estimates validated against the actual emitted train and overlapping roads.
R13.17 District builds emit literal crossing context before clipping; existing packs can get it appended from cached
source XML. Neither invents source incidence.
R13.18 Fit rigid tram meshes from their actual wheel support against the rendered support pieces, keeping source XY,
heading and profiles; only the tram's own identified slab is exempt from the static disc check.
R13.19 Whole-body crossing-pad margins apply in both directions at verified source-signal associations, including
unresolved controlled nodes.
R13.20 A signalized `railway=tram_crossing` without mapped tram heads is pedestrian control, not a tram red phase; never
infer vehicle priority, timings or signal-head positions.
R13.21 GPS and NPC routes respect mapped height/width limits against the actual vehicle model (mirrors, taxi signs,
trolley poles); unknown limits are never a pass.
R13.22 A bus lane mapped against a one-way (`busway=opposite_lane`, `oneway:bus=no` with a lane) is a lane of the road
topology, from the runtime source tags: buses (spawn, route choice, stops on its side, its own signal approach) use it;
cars, GPS routes, private-car connectivity and the chapter start treat the way as one-way. The no-entry sign where the
bus lane enters the one-way carries the supplementary plate exempting buses.
R13.23 A signal controller over several nodes (a split junction, a square) runs one stage per road axis entering it
from outside; a link between two of its own nodes has no stage of its own and shows the stage of the entry axis it
lines up with best. A controller over three or more nodes (a square) stretches each stage up to twice the base slot,
keeping its whole cycle within 60 s. A car inside the box holds the other stages red only while it clears the box on
its own and makes headway (≥ 1 m in 8 s).
R13.24 With a GPS destination set, the R reset puts the car on the nearest free lane pose from which a route to that
destination exists (a nearer pose with no route is skipped).

## Acceptance
- Harness: vehicle-overlap ≤ 5, ped-in-vehicle 0, vehicle-overlaps-player 0, scenario `i` passes.
- Rush hour in `romana` at 08:00: average speed in the Piața Victoriei hotspot < 2 m/s, outside > 6 m/s; the player
  crosses it in < 4 min.
- Night run: light traffic.
- `node game/dev/harness/tram-sweep-audit.cjs` and `tram-progress-check.cjs`: nothing generated in a tram's swept path,
  no tram held > 10 s.
