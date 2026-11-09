// Installed only in a root-authorized fresh browser. Exact native source methods stay authoritative.
module.exports = async function installRailObserver() {
    const { Traffic } = await import('./src/traffic.js');
    const producer = await import('./src/tram-body-support.js');
    const admission = await import('./src/initial-traffic-admission.js');
    if (typeof producer.validateTramSupportCertificate !== 'function' || typeof admission.initialTrafficStaticClearance !== 'function') throw Error('Combined source lacks required diagnostic interfaces');
    const g = game, oldSpawn = Traffic.prototype.spawnAll, oldBind = Traffic.prototype.bindSourceTrams, oldAttach = g.attachWorldRender;
    if (typeof oldBind !== 'function') throw Error('Combined source has no native bindSourceTrams interface');
    let K, snapshots, errors, lastTraffic, controllers, controllerSerial;
    const scalar = o => Object.fromEntries(Object.entries(o || {}).filter(([, v]) => v === null || ['string', 'number', 'boolean'].includes(typeof v)).map(([k, v]) => [k, typeof v === 'number' && !Number.isFinite(v) ? { $number: String(v) } : v]));
    const controller = o => { if (!o) return null; if (!controllers.has(o)) controllers.set(o, 'native-controller-' + (++controllerSerial));
        return { identity: controllers.get(o), ...scalar(o), nodeIds: Array.from(o.nodes || []).map(n => n.id), sourceNodeIds: Array.from(o.nodes || []).map(n => n.sourceId ?? null) }; };
    const nodeRef = n => n ? { ...scalar(n), tags: K.safe(n.tags), edgeIds: (n.allEdges || n.edges || []).map(e => e.id), motorNodeId: n.motorNode?.id ?? null,
        sourceSignal: n.sourceSignal ? { ...scalar(n.sourceSignal), nodeId: n.sourceSignal.node?.id ?? null, edgeId: n.sourceSignal.edge?.id ?? null, controller: controller(n.sourceSignal.controller),
            railEdgeIds: (n.sourceSignal.railEdges || []).map(e => e.id), approachEdgeIds: (n.sourceSignal.approaches || []).map(e => e.edge?.id ?? e.id ?? null),
            raw: K.safe(Object.fromEntries(Object.entries(n.sourceSignal).filter(([k]) => !['node', 'controller', 'approaches', 'edge', 'railEdges'].includes(k)))) } : null,
        lightCluster: controller(n.lightCluster) } : null;
    const edgeRef = e => e ? (!e.a || !e.b ? { unknownEdgeReference: K.safe(e) } : { ...scalar(e), a: nodeRef(e.a), b: nodeRef(e.b), sourceNodeIds: e.sourceNodeIds || [e.a.sourceId ?? null, e.b.sourceId ?? null],
        railDirections: K.safe(e.railDirections), grade: K.safe(e.grade), gradeNativeSamples: typeof e.grade?.heightAt === 'function' ? [0, .137, .389, .613, .877, 1].map(t => { try { return { t, displacementY: K.safe(e.grade.heightAt(t)) }; } catch (error) { return { t, error: String(error) }; } }) : null,
        access: K.safe(e.access) }) : null;
    function renderBindings(v) {
        const found = [], model = v.mesh.userData._model;
        if (!model) return found;
        g.scene?.traverse(o => {
            if (!o.isInstancedMesh || !o.userData.fleet) return;
            const mode = o.geometry.attributes.position === model.geo?.attributes.position ? 'primary' : o.geometry.attributes.position === model.far?.attributes.position ? 'far' : null;
            if (!mode) return;
            for (let i = 0; i < o.count; i++) if (v.mesh.matrixWorld.elements.every((value, j) => Math.fround(value) === o.instanceMatrix.array[i * 16 + j])) found.push({ meshUuid: o.uuid, instance: i, mode, geometryId: K.geometry(o.geometry), exactFloat32MatrixMatch: true });
        });
        return found;
    }
    function actor(v) {
        const tram = !!v.tram || /tram/i.test(v.kind || ''), mesh = v.mesh;
        const row = { ...scalar(v), tramDetected: tram, edge: edgeRef(v.edge), route: (v.route || []).map(r => ({ ...scalar(r), edge: edgeRef(r.e || r.edge) })),
            hist: (v.hist || []).map(r => ({ ...scalar(r), edge: edgeRef(r.e || r.edge) })), leaderId: v.leader?.id ?? null, railSupport: K.safe(v.railSupport),
            meshPose: { position: mesh.position.toArray(), rotation: mesh.rotation.toArray(), quaternion: mesh.quaternion.toArray(), scale: mesh.scale.toArray() } };
        if (!tram) return row;
        mesh.updateWorldMatrix(true, false);
        const m = mesh.userData._model;
        row.mesh = K.mesh(mesh); row.meshHierarchy = []; mesh.traverse(o => row.meshHierarchy.push(o.isMesh ? K.mesh(o) : K.frame(o)));
        row.parentChain = K.parents(mesh); row.model = m ? { ...scalar(m), primaryGeometryId: K.geometry(m.geo), farGeometryId: K.geometry(m.far), parkedGeometryId: K.geometry(m.parked),
            primaryWorldBounds: K.bounds(m.geo, mesh.matrixWorld.elements), userDataDimensions: { length: mesh.userData.length, width: mesh.userData.width, height: mesh.userData.height } } : { unknown: 'native model record missing' };
        row.nativeRenderBindings = renderBindings(v);
        if (v.edge?.rail) {
            try { row.producerDiagnostics = { certificate: K.safe(producer.validateTramSupportCertificate(v, g.world?.tramDeckSupportAt)), staticClearance: K.safe(admission.initialTrafficStaticClearance(g.world, v)),
                scope: 'Production diagnostics only; independent observer must reread exact emitted geometry, full native poses, fresh support pieces and other solids.' }; }
            catch (e) { row.producerDiagnostics = { error: String(e.stack || e), unknown: true }; }
        }
        return row;
    }
    function capture(T, phase) {
        K.nextEpoch(); lastTraffic = new WeakRef(T);
        const railSignalStates = (T.tramNetwork?.nodes || []).flatMap(n => (n.edges || []).map(e => {
            const signal = n.sourceSignal, motorNode = signal?.node || n.motorNode, motorEdge = signal?.edge,
                approach = motorNode && motorEdge ? T.world.nodeLight?.[motorNode.id]?.approaches.find(a => a.edge === motorEdge) : null;
            const row = { railSourceNodeId: n.sourceId, railNodeId: n.id, railEdgeId: e.id, motorNodeId: motorNode?.id ?? null, motorEdgeId: motorEdge?.id ?? null,
                trafficTime: T.time, cycle: T.cycle, phase: signal?.phase ?? null, controllerIdentity: controller(T.boxController?.(n) || n.lightCluster || n)?.identity,
                railDirections: K.safe(e.railDirections), atRailEnd: e.a === n ? 'a' : 'b', publicTram: e.publicTram, throughTram: e.throughTram,
                actualRendererApproachState: approach?.state ?? null, actualRendererApproachPhase: approach?.phase ?? null,
                scope: 'Direct native query at observed undriven time; renderer approach state is separately retained and may lag. No red-stop/green-resume challenge is implied.' };
            try { row.railState = T.lightState(n, e); row.motorState = motorNode && motorEdge ? T.lightState(motorNode, motorEdge) : null; }
            catch (error) { row.queryError = String(error.stack || error); }
            return row;
        }));
        const claims = [...T.boxes || []].map(([n, entries]) => ({ node: nodeRef(n), keyIdentity: controller(n), entries: entries.map(c => ({ ...scalar(c), vehicleId: c.v?.id ?? c.vehicle?.id ?? null,
            inEdge: edgeRef(c.inE), outEdge: edgeRef(c.outE), segments: (c.segments || []).map(s => ({ ...scalar(s), inEdgeId: s.inE?.id ?? null, outEdgeId: s.outE?.id ?? null })),
            internalEdgeIds: [...c.internalEdges || []].map(e => e.id), clearEdgeIds: [...c.clearEdges || []].map(e => e.id) })) }));
        const phases = [...T._lightPhase || []].map(([n, map]) => ({ node: nodeRef(n), phaseCount: map.phaseCount, offset: map.offset, approaches: [...map].map(([e, phase]) => ({ edge: edgeRef(e), phase })) }));
        snapshots.push({ phase, nativeTime: T.time, nativeFrame: T._frame ?? null, performanceMs: performance.now(), district: T.world.district.id, maxVehicles: T.maxVehicles, large: T.large,
            profile: K.safe(T.profile), base: K.safe(T.base), counts: K.safe(T.counts), target: K.safe(T.target), initialTramBinding: K.safe(T.initialTramBinding), initialAdmission: K.safe(T.initialAdmission),
            active: T.vehicles.map(actor), pool: T.pool.map(actor), pedestrians: T.peds ? T.peds.list.map(p => ({ ...scalar(p), line: p.line ? { ...scalar(p.line), edgeId: p.line.edge?.id ?? p.line.e?.id ?? null } : null })) : null,
            claims, phaseControllers: phases, railSignalStates, tramMotorCrossings: [...T.tramMotorCrossings || []].map(n => n.id), tramMotorCrossingNodes: [...T.tramMotorCrossings || []].map(nodeRef),
            tramNetwork: T.tramNetwork ? { report: K.safe(T.tramNetwork.report), nodes: T.tramNetwork.nodes.map(nodeRef), edges: T.tramNetwork.edges.map(edgeRef) } : null });
    }
    function observe(T, phase) { try { capture(T, phase); } catch (e) { errors.push({ phase, error: String(e.stack || e) }); } }
    Traffic.prototype.spawnAll = function (...args) { const r = oldSpawn.apply(this, args); observe(this, 'after-original-spawnAll-before-binding'); return r; };
    Traffic.prototype.bindSourceTrams = function (...args) { observe(this, 'before-original-source-binding'); const r = oldBind.apply(this, args); observe(this, 'after-original-source-binding-before-initial-admission'); return r; };
    g.attachWorldRender = function (...args) { observe(this.traffic, 'before-original-attachWorldRender-after-normal-profile-player-admission'); return oldAttach.apply(this, args); };
    const sampleU = [0, .137, .389, .613, .877, 1];
    function samples(piece) {
        if (!piece.a || !piece.b || typeof piece.band !== 'function') return { unknown: 'native piece a/b/band unavailable', values: [] };
        return { method: 'Direct actual native piece.band calls; not topProfile reconstruction', values: sampleU.flatMap(u => [0, 1.2].map(radius => {
            const x = piece.a[0] + (piece.b[0] - piece.a[0]) * u, z = piece.a[1] + (piece.b[1] - piece.a[1]) * u;
            try { return { u, x, z, radius, band: K.safe(piece.band.call(piece, x, z, radius)),
                supportAt: K.safe(g.world.tramDeckSupportAt(x, z, { modelId: piece.modelId })), surfacesAt: g.world.surfacesAt(x, z), walkTop: g.world.walkTop(x, z) }; }
            catch (e) { return { u, x, z, radius, error: String(e) }; }
        })) };
    }
    function collider(c, i) {
        const row = { colliderIndex: i, ...Object.fromEntries(Object.entries(c).map(([k, v]) => [k, k === 'edge' ? edgeRef(v) : k === 'node' ? nodeRef(v) : K.safe(v)])) };
        if (c.poly?.length && (c.roofHeightAt || c.minHeightAt)) row.directBandSamples = [c.poly, ...(c.holes || [])].flatMap((poly, ring) => poly.flatMap((a, n) => [0, .137, .389, .613, .877, 1].map(t => {
            const b = poly[(n + 1) % poly.length], x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t;
            const call = fn => { try { return fn ? K.safe(fn.call(c, x, z, 0)) : null; } catch (e) { return { error: String(e) }; } };
            return { ring, edge: n, t, x, z, radius: 0, top: call(c.roofHeightAt), bottom: call(c.minHeightAt) };
        })));
        return row;
    }
    window.__railObserver = {
        reset() { K = window.__railKernelFactory(); snapshots = []; errors = []; lastTraffic = null; controllers = new WeakMap(); controllerSerial = 0; },
        snapshot(phase) { const T = g.traffic || lastTraffic?.deref(); if (T) observe(T, phase); },
        facts({ includeGeometryCatalog = false } = {}) { return { snapshots, observerErrors: errors, ...(includeGeometryCatalog ? { geometryCatalog: K.geometries } : {}), scope: 'Exact native observer records, including raw producer diagnostics; not self-certified physical acceptance.' }; },
        world() {
            const w = g.world, T = g.traffic || lastTraffic?.deref(); if (!w) return { unknown: 'native world unavailable after failed load' };
            const ids = new Set([...(w.tramDecks || []).map(c => c.modelId), ...(T?.tramNetwork?.edges || []).map(e => e.grade?.modelId)].filter(Boolean)), pieces = [], seen = new Set();
            const extents = (w.tramDecks || []).flatMap(c => c.poly || []), box = { x0: w.bounds.minX, z0: w.bounds.minZ, x1: w.bounds.maxX, z1: w.bounds.maxZ };
            for (const p of extents) { box.x0 = Math.min(box.x0, p[0]); box.z0 = Math.min(box.z0, p[1]); box.x1 = Math.max(box.x1, p[0]); box.z1 = Math.max(box.z1, p[1]); }
            for (const modelId of ids) {
                if (typeof w.tramDeckSupportAt?.inBox !== 'function') { errors.push({ phase: 'world-export', error: 'missing native support inBox interface for ' + modelId }); continue; }
                for (const p of w.tramDeckSupportAt.inBox(box.x0, box.z0, box.x1, box.z1, { modelId })) if (!seen.has(p)) { seen.add(p); pieces.push({ ...K.safe(p), nativeBandSamples: samples(p) }); }
            }
            const graphNodes = Object.values(w.graph.nodes), lights = (w.lights || []).map(l => ({ ...scalar(l), node: nodeRef(l.node), controller: controller(l.node.lightCluster),
                approaches: l.approaches.map(a => ({ ...scalar(a), nodeId: a.node?.id ?? null, edge: edgeRef(a.edge), lamps: K.safe(a.lamps),
                    nativeControllerStateAtCurrentTime: w.lightState ? w.lightState(l.node.id, a.edge, T?.time || 0, T?.cycle) : null })) }));
            return { data: w.data, district: K.safe(w.district), bounds: K.safe(w.bounds), nativeStats: K.safe(w.stats), allEdges: w.allEdges.map(edgeRef), graphNodes: graphNodes.map(nodeRef), graphEdgeIds: w.graph.edges.map(e => e.id),
                ribbons: w.ribbons.map((r, i) => ({ i, ...scalar(r), poly: r.poly, holes: r.holes || [], hs: r.hs || null, edge: edgeRef(r.e), node: nodeRef(r.node) })),
                colliders: w.buildings.map(collider), tramDeckColliderIndices: (w.tramDecks || []).map(c => w.buildings.indexOf(c)), supportPieces: pieces,
                supportQueryBounds: { bounds: box, modelIds: [...ids] }, supportFunctions: { at: String(w.tramDeckSupportAt), inBox: String(w.tramDeckSupportAt?.inBox) },
                waterAreas: w.areas.filter(a => a.kind === 'water'), lights, nativeTime: T?.time ?? null,
                gradeFunctions: { tramGrade: String(w.tramGrade), scope: 'Native closure text is diagnostic; actual edge grades/samples and emitted geometry remain authoritative for independent checks.' } };
        },
        scene() {
            K.nextEpoch(); g.scene.updateMatrixWorld(true); const objects = [], triangleBatches = [];
            g.scene.traverse(o => {
                if (!o.isMesh || !o.geometry?.attributes?.position) return;
                const record = K.mesh(o); record.userData = K.safe(o.userData); objects.push(record);
                if (/^(solid|road|marks)( |$)/.test(o.name) || record.materials.some(m => ['road', 'markings'].includes(m.name))) triangleBatches.push({ meshUuid: o.uuid, geometryId: record.geometryId,
                    source: 'Every current actual native triangle from lossless position/index buffers, groups, actual drawRange and full native transform; no expected-profile generation or old export filtering.',
                    matrixWorld: record.matrixWorld, instanceMatrix: record.instanceMatrix, count: record.count, isInstancedMesh: record.isInstancedMesh, name: record.name });
            });
            return { objects, geometries: K.geometries, triangleBatches, root: K.frame(g.scene),
                representation: 'Lossless exact native typed-buffer bytes and complete topology/transforms. Companion decode-geometry.cjs reconstructs every world triangle, including instances. All scene mesh geometry is retained regardless of current culling; drawRange/groups/visibility distinguish actual draw scope.' };
        },
        restore() { Traffic.prototype.spawnAll = oldSpawn; Traffic.prototype.bindSourceTrams = oldBind; g.attachWorldRender = oldAttach; },
    };
    window.__railObserver.reset();
};
