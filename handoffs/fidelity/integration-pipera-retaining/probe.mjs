// Exact production core grade / pavement, native source fixture and actual blocksLane function.
// No renderer/world mesh construction; this is geometry evidence, not a controller replay.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { pathToFileURL, fileURLToPath } from 'node:url';
const root = path.resolve(process.argv[2] || '.'), out = path.resolve(process.argv[3] || '/tmp/pipera-mouth-proof.json');
const native = JSON.parse(fs.readFileSync(new URL('./proof/native-before.json', import.meta.url)));
const current = fs.readFileSync(path.join(root, 'game/src/world.js'), 'utf8');
const beforeSource = JSON.parse(fs.readFileSync(new URL('./proof/source-before.json', import.meta.url)));
const before = fs.readFileSync(new URL('./proof/blocksLane-before.txt', import.meta.url), 'utf8');
const sha = s => crypto.createHash('sha256').update(s).digest('hex');
const fn = s => s.slice(s.indexOf('        blocksLane = '), s.includes('        const cutWalls = ') ? s.indexOf('        const cutWalls = ') : s.length);
assert.equal(sha(before), beforeSource.blocksLaneSha256);
let prefix = current.slice(0, current.indexOf('    // ---- traffic lights:'));
const helpers = current.slice(current.indexOf('    function isPadNode(n)'), current.indexOf('    const widthAsphalt'));
const polyDist = current.slice(current.indexOf('    const polyDist = '), current.indexOf('    // ---- pass 1:'));
prefix += helpers + current.slice(current.indexOf('    const widthAsphalt'), current.indexOf('    const padCorners')) + polyDist;
prefix += `
    const ribbons=[], pads=new Map(), ribGrid=new BoxGrid(24);
    for(const e of edges){if(e.virtual)continue;const poly=asphaltCorners(e,widthAsphalt);ribbons.push({e,poly});for(const [n,p,q] of [[e.a,poly[0],poly[3]],[e.b,poly[1],poly[2]]])if(n.pad){if(!pads.has(n))pads.set(n,[]);pads.get(n).push(p,q)}}
    for(const [node,points]of pads)ribbons.push({node,poly:convexHull(points)});
    for(const r of ribbons){r.x0=Math.min(...r.poly.map(p=>p[0]));r.x1=Math.max(...r.poly.map(p=>p[0]));r.z0=Math.min(...r.poly.map(p=>p[1]));r.z1=Math.max(...r.poly.map(p=>p[1]));ribGrid.insert(r.x0,r.z0,r.x1,r.z1,r)}
    const surfacesAt=(x,z,cb)=>{for(const r of ribbons)if(pointInPolygon(x,z,r.poly))cb(Y.road+(r.e?yAlong(r.e,x,z):padHeightAt(r.node,x,z)))};
    const compile=body=>new Function('ribGrid','pointInPolygon','polyDist','Y','retract','yAlong','padHeightAt','surfacesAt','distId','let blocksLane;'+body+'return blocksLane;')(ribGrid,pointInPolygon,polyDist,Y,retract,yAlong,padHeightAt,surfacesAt,distId);
    return {data,edges,nodeArr,ribbons,compile,polyDist,pointInPolygon,retract,padHeightAt};
}\n`;
prefix = prefix.replace(/from '(\.[^']+)'/g, (_, p) => `from '${new URL(p, pathToFileURL(path.join(root, 'game/src/world.js'))).href}'`);
prefix = prefix.replace(/^    const url = new URL.*$/m, '    const url = ' + JSON.stringify(pathToFileURL(path.join(root, 'game/data/bucharest-pipera.json')).href) + ';');
const { CITIES } = await import(pathToFileURL(path.join(root, 'game/src/cities.js')));
const realFetch = globalThis.fetch;
globalThis.fetch = async p => ({ json: async () => JSON.parse(fs.readFileSync(fileURLToPath(p))) });
const { buildWorld } = await import('data:text/javascript;base64,' + Buffer.from(prefix).toString('base64'));
const world = await buildWorld({ ...CITIES.bucharest }, null, { district: 'pipera' }); globalThis.fetch = realFetch;
const driv = world.edges.filter(e => e.drivable), rest = world.edges.filter(e => !e.drivable);
driv.forEach((e, i) => e.id = i); rest.forEach((e, i) => e.id = driv.length + i);
for (const n of world.nodeArr) if (n.edges.length) n.allEdges = n.edges;
const oldRule = world.compile(fn(before)), newRule = world.compile(fn(current));
const { collideBuildings } = await import(pathToFileURL(path.join(root, 'game/src/world.js')));
const checked = native.edges.map(e => {
 const actual = world.edges.find(f => f.id === e.id); assert.ok(actual, 'native edge exists');
 for (const [key, value] of Object.entries({ road: e.road, ya: e.ya, yb: e.yb, wL: e.wL, wR: e.wR })) assert.equal(actual[key], value, 'native ' + e.id + '.' + key);
 for (const end of ['a', 'b']) for (const key of ['x', 'z', 'y']) assert.equal(actual[end][key], e[end][key], 'native endpoint ' + e.id + '.' + end + '.' + key);
 return e.id;
});
const walls = native.walls.map(w => ({ ...w, edge: world.edges.find(e => e.id === w.edgeId) }));
const cases=[];
for(const test of native.tests){
 const wall=walls.find(w=>w.edge.id===test.wallEdge&&w.kind===(test.wallEdge===188?'trench':'barrier'));
 const samples=[0,.25,.5,.75,1].map(t=>{const x=wall.ax+(wall.bx-wall.ax)*t,z=wall.az+(wall.bz-wall.az)*t;return {t,x,z,before:oldRule(wall,x,z,t),after:newRule(wall,x,z,t)}});
 assert.ok(samples.some(s=>!s.before&&s.after),'real native mouth changes from retained wall to open');
 const y=test.samples[Math.floor(test.samples.length/2)].routeY;
 assert.ok(collideBuildings([wall],wall.x,wall.z,.2,y),'native wall really intersects driving body');
 cases.push({name:test.id,samples,actualRawWallBlocksBody:true});
}
// Every remaining exact native wall sample is retained in the differential ledger.
// A changed point must be on a source-connected, retracted mouth, never an unrelated wall.
const changes=[],unchanged=[];
for(const wall of walls)for(const t of [0,.25,.5,.75,1]){
 const x=wall.ax+(wall.bx-wall.ax)*t,z=wall.az+(wall.bz-wall.az)*t,a=oldRule(wall,x,z,t),b=newRule(wall,x,z,t);
 const row={sourceId:wall.sourceId,edge:wall.edge.id,kind:wall.kind,t,x,z,before:a,after:b};
 if(a!==b){assert.equal(a,false);assert.equal(b,true);changes.push(row)}else unchanged.push(row);
}
// Remove the original source identity: the old narrow-band/fringe exclusions must remain unchanged.
const identityControls=[];
for(const c of cases){const wall=walls.find(w=>w.edge.id===(c.name==='Calea-Floreasca'?188:394)&&w.kind===(c.name==='Calea-Floreasca'?'trench':'barrier'));const saved=[wall.edge.a.sourceId,wall.edge.b.sourceId];wall.edge.a.sourceId=0;wall.edge.b.sourceId=0;const p=c.samples.find(p=>!p.before&&p.after);const a=oldRule(wall,p.x,p.z,p.t),b=newRule(wall,p.x,p.z,p.t);assert.equal(a,b);identityControls.push({name:c.name,before:a,after:b});[wall.edge.a.sourceId,wall.edge.b.sourceId]=saved;}
// Exact XY/source identity alone cannot open a physically separated endpoint.
const gradeControls=[];
for(const c of cases){const wall=walls.find(w=>w.edge.id===(c.name==='Calea-Floreasca'?188:394)&&w.kind===(c.name==='Calea-Floreasca'?'trench':'barrier'));const saved=[wall.edge.ya,wall.edge.yb];wall.edge.ya+=5;wall.edge.yb+=5;const p=c.samples.find(p=>!p.before&&p.after);const a=oldRule(wall,p.x,p.z,p.t),b=newRule(wall,p.x,p.z,p.t);assert.equal(a,b);gradeControls.push({name:c.name,endpointSeparationM:5,before:a,after:b});[wall.edge.ya,wall.edge.yb]=saved;}
// The first continuous replay cleared the original trench but found this next
// barrier at the same junction's real 6.157 m approach/outlet. Test that contact
// explicitly, including the short link's source identity, grade and length gates.
const outletWall=walls.find(w=>w.edge.id===188&&w.kind==='barrier'&&w.ax>-920),link=world.edges.find(e=>e.id===564),q=link.b;
const outletSample=()=>({before:oldRule(outletWall,outletWall.ax,outletWall.az,0),after:newRule(outletWall,outletWall.ax,outletWall.az,0)});
const outlet=outletSample();assert.equal(outlet.before,false);assert.equal(outlet.after,true);
const outletControls=[];
for(const [gate,object,field,value]of[['source-node',q,'sourceId',0],['endpoint-grade',link,'yb',link.yb+5],['short-link-length',link,'len',link.len+100]]){
 const saved=object[field];object[field]=value;const row=outletSample();assert.equal(row.before,row.after,gate);outletControls.push({gate,...row});object[field]=saved;
}
const retainedPhysicalWalls=[];
for(const wall of walls){const x=wall.x,z=wall.z;if(oldRule(wall,x,z,.5)||newRule(wall,x,z,.5))continue;const y=(wall.y0a+wall.y0b+wall.y1a+wall.y1b)/4;assert.ok(collideBuildings([wall],x,z,.2,y),'retained true wall still blocks a finite body');retainedPhysicalWalls.push({edge:wall.edge.id,sourceId:wall.sourceId,kind:wall.kind,x,z,y,blocksBody:true});}
assert.ok(retainedPhysicalWalls.length>=4,'outside-mouth native wall pieces retained');
const report={sourceRoot:root,worldBeforeSha256:beforeSource.worldSha256,worldAfterSha256:sha(current),dataSha256:sha(fs.readFileSync(path.join(root,'game/data/bucharest-pipera.json'))),scope:'Production core grade, actual asphalt/pad footprints and actual blocksLane function; 84 native edges hash/coordinate equivalent. Fixture contacts and differential lane-mouth rule only, not a Player controller or final world rendering proof. Surface fallback uses exact asphalt/pads without raised sidewalks/scenery; all changed positives take the explicit source-junction path before that fallback.',nativeEdgesChecked:checked,cases,identityControls,gradeControls,outlet:{...outlet,linkEdge:link.id,linkLength:link.len,sourceNode:q.sourceId,controls:outletControls},changes,unchanged,retainedPhysicalWalls};
fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(report,null,2));console.log(JSON.stringify({nativeEdges:checked.length,positiveCases:cases.length,changedPoints:changes.length,unchangedPoints:unchanged.length,sourceIdentityNegatives:identityControls.length,separatedGradeNegatives:gradeControls.length,retainedTrueWalls:retainedPhysicalWalls.length}));
