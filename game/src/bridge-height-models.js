// Height models of the source-graded bridge decks (Basarab shared fork, source descents, junction pads) as plain data.
// shared-bridge-profile.js and source-bridge-descents.js build their deck height functions with these factories, and
// record a spec (numbers and source points only); the build workers rebuild the same functions from that spec (frames
// and ramps are pure functions of those numbers), so a deck shaped in a worker is the deck shaped on the main thread.
import { sourceFrames, distance } from './bridge-profile-geometry.js';
import { smoothTramRamp } from './tram-grade.js';
import { SHARED_BRIDGE_MODELS } from './shared-bridge-models.js';
import { SOURCE_BRIDGE_DESCENTS } from './source-bridge-descent-models.js';
import { padFieldFunctions } from './bridge-pad-profile.js';

// A fork can carry nonzero longitudinal grade through its original source
// node. Ease only the actual ground/flat boundaries, not every graph vertex.
export function asymmetricRamp(length, height, leftEase, rightEase, maxGrade) {
    const peakGrade=height/(length-(leftEase+rightEase)/2);
    if(!(length>0)||height<0||leftEase<0||rightEase<0||leftEase+rightEase>length||peakGrade>maxGrade+1e-10)return null;
    const at=s=>s<=0?0:s>=length?height:leftEase&&s<leftEase?peakGrade*s*s/(2*leftEase):rightEase&&s>length-rightEase?height-peakGrade*(length-s)**2/(2*rightEase):peakGrade*(s-leftEase/2);
    return {at,length,height,peakGrade,easeM:[leftEase,rightEase],breaks:[0,leftEase,length-rightEase,length]};
}

/** the shared fork's main-road height at reference station s (null outside the south…north anchors) */
export const sharedCommonAt = ({ southS, northS, zoneLo, zoneHi, H, stationHeightM, dipSouth, dipNorth }) =>
    s => s < southS || s > northS ? null : s < zoneLo ? stationHeightM - dipSouth.at(s - southS) : s <= zoneHi ? H : H + dipNorth.at(s - zoneHi);
/** the approaches' height: the homologous section field of approachIn */
export const sharedApproachAt = (approachMaster, approachIn, lift, masterLength, flatStart) =>
    p => { const q = approachMaster.locate(p); return q ? lift - approachIn.at(masterLength - q.s - flatStart) : 0; };

/** one shared-fork edge: its legacy profile, its raw model height and that height eased into the pads at its ends.
 *  ctx: the model's functions and numbers (sharedContextFromSpec); es: the edge's numbers; padFieldOf(nodeId). */
export function sharedEdgeHeight(ctx, es, padFieldOf) {
    const { main, role, ax, az, dirx, dirz, len, oldYa, oldYb, s0, s1, aId, bId } = es;
    const legacy = p => { const t = Math.max(0, Math.min(1, ((p[0] - ax) * dirx + (p[1] - az) * dirz) / len)); return oldYa + (oldYb - oldYa) * t; };
    const rawAtWorld = p => {
        if (main) return ctx.commonPoint(p) ?? legacy(p);
        const t = Math.max(0, Math.min(1, ((p[0] - ax) * dirx + (p[1] - az) * dirz) / len)), s = ctx.roleFrames[role].locate(p)?.s ?? s0 + (s1 - s0) * t;
        // Keep the original endpoint heights in the same mitered source
        // cross-section coordinates as the MODEL. A tangent projection
        // gives a different lateral station at a curved anchor and would
        // introduce a height jump at the MODEL/legacy section boundary.
        const sectionLegacy = oldYa + (oldYb - oldYa) * Math.max(0, Math.min(1, (s - s0) / ((s1 - s0) || 1)));
        if (role === 'trunk') return ctx.lift + ctx.trunk.at(s - ctx.trunk0);
        if (role === 'approachIn' || role === 'approachOut') return ctx.approachAt(p);
        if (role === 'branchA' || role === 'branchB') return ctx.internalHeight + ctx.branches[role].at(distance(p, ctx.centre));
        if (role === 'loop') return s <= ctx.loopAnchorS ? ctx.H - ctx.loop.at(s - ctx.mergeLoop) : sectionLegacy;
        if (role === 'exit') return s <= ctx.exitAnchorS ? ctx.H + ctx.exitRamp.at(s - ctx.mergeExit) : sectionLegacy;
        return s >= ctx.auxAnchorS ? ctx.stationHeightM - ctx.auxiliaryRamp.at(s - ctx.auxAnchorS) : sectionLegacy;
    };
    const atWorld = p => { let y = rawAtWorld(p); for (const id of [aId, bId]) { const field = padFieldOf(id); if (field) y = field.blendHeight(...p, y); } return y; };
    return { legacy, rawAtWorld, atWorld };
}

/** the shared fork's context from its spec (see shared-bridge-profile.js workerSpec) */
export function sharedContextFromSpec(spec) {
    const model = SHARED_BRIDGE_MODELS.find(m => m.id === spec.modelId);
    if (!model) throw new Error('shared bridge spec: unknown model ' + spec.modelId);
    const frames = sourceFrames(spec.referencePoints, model.associationHalfWidthM);
    const roleFrames = Object.fromEntries(Object.entries(spec.rolePoints).map(([id, p]) => [id, sourceFrames(p, 8)]));
    const approachMaster = sourceFrames(spec.rolePoints.approachIn, model.associationHalfWidthM);
    const ramp = ([length, height]) => smoothTramRamp(length, height, model), asym = args => asymmetricRamp(...args);
    const commonAt = sharedCommonAt({ southS: spec.southS, northS: spec.northS, zoneLo: spec.zoneLo, zoneHi: spec.zoneHi, H: spec.H, stationHeightM: model.stationHeightM, dipSouth: ramp(spec.dipSouth), dipNorth: ramp(spec.dipNorth) });
    const commonPoint = p => { const q = frames.locate(p); return q ? commonAt(q.s) : null; };
    return {
        commonPoint, roleFrames, lift: spec.lift, trunk: asym(spec.trunk), trunk0: spec.trunk0,
        approachAt: sharedApproachAt(approachMaster, ramp(spec.approachIn), spec.lift, spec.masterLength, spec.flatStart),
        internalHeight: spec.internalHeight, branches: { branchA: asym(spec.branchA), branchB: asym(spec.branchB) }, centre: spec.centre, H: spec.H,
        loop: ramp(spec.loop), loopAnchorS: spec.loopAnchorS, mergeLoop: spec.mergeLoop, exitRamp: ramp(spec.exit), exitAnchorS: spec.exitAnchorS, mergeExit: spec.mergeExit,
        auxiliaryRamp: ramp(spec.auxiliary), auxAnchorS: spec.auxAnchorS, stationHeightM: model.stationHeightM,
    };
}

/** one source descent model: station of a point on its source chain and the height there */
export function descentHeight({ frames, points, length, crownHeightM, ramp, holdM, modelId }) {
    const atStation = s => crownHeightM - ramp.at(s - holdM);
    const station = p => { const q = frames.locate(p); if (q) return q.s; for (const [start, at] of [[true, 0], [false, length]]) { const i = start ? 0 : points.length - 1, a = points[i], b = points[start ? 1 : i - 1], dx = a[0] - b[0], dz = a[1] - b[1]; if ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz >= 0) return at; } throw Error('Source descent height query outside certified source-section bounds: ' + modelId); };
    return { atStation, station, atWorld: (x, z) => atStation(station([x, z])) };
}
/** a source descent from its spec (see source-bridge-descents.js workerSpecs) */
export function descentFromSpec(spec) {
    const model = SOURCE_BRIDGE_DESCENTS.find(m => m.id === spec.modelId);
    if (!model) throw new Error('source descent spec: unknown model ' + spec.modelId);
    return descentHeight({ frames: sourceFrames(spec.points, model.associationHalfWidthM), points: spec.points, length: spec.length, crownHeightM: model.crownHeightM,
        ramp: smoothTramRamp(spec.rampLength, spec.rampRise, { maxGrade: model.maxGrade, easeM: model.preferredEaseM }), holdM: spec.holdM, modelId: model.id });
}
/** a junction pad's queries from its spec ({ P, triangles, baseM }) */
export const padFromSpec = spec => padFieldFunctions(spec.P, spec.triangles, spec.baseM);
