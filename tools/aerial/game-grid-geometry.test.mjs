import assert from 'node:assert/strict';
import fs from 'node:fs';
import { projectDistrictGeometry, geometryBounds, rectangleMargin } from './game-grid-geometry.mjs';
import { readDistrictData } from '../osm/district-data.mjs';

const box={pieces:[],circles:[],polys:[[[0,0],[1000,0],[1000,2000],[0,2000]]]};
assert.equal(rectangleMargin([400,900,650,1150],box),0,'interior capture cells intersect an enclosing polygon');
assert.equal(rectangleMargin([-700,0,-600,250],box),600,'the exact 600m ring keeps its boundary cell');
assert.equal(rectangleMargin([-701,0,-601,250],box),601,'cells beyond the exact ring remain outside');
assert.equal(rectangleMargin([-700,-700,-600,-600],box),Math.hypot(600,600),'corner distance is Euclidean, not expanded bbox');
assert.equal(rectangleMargin([-50,900,50,1100],box),0,'crossing polygon edges keep partial boundary cells');
assert.equal(rectangleMargin([-100,-100,1100,2100],box),0,'a polygon entirely inside a capture cell intersects');
assert.deepEqual(geometryBounds(box),[0,0,1000,2000]);
assert.equal(rectangleMargin([-1,-1,1,1],{pieces:[{r:2,pts:[[-20,0],[20,0]]}]}),-2,'crossing bands share the builder distance');
assert.equal(rectangleMargin([4,4,6,6],{circles:[{x:5,z:5,r:1}]}),-1,'a contained circle is covered');
assert.throws(()=>projectDistrictGeometry({route:[{}]}, {},()=>[]),/generated district.geometry/,'never guess a routed district from its bbox');

const cityBytes=fs.readFileSync(new URL('../../game/src/cities.js',import.meta.url));
const {CITIES}=await import('data:text/javascript;base64,'+cityBytes.toString('base64'));
const totals={};
for(const [city,C] of Object.entries(CITIES))for(const [id,cfg]of Object.entries(C.districts)){
  const data=readDistrictData(new URL(`../../game/data/${city}-${id}.bin.gz`,import.meta.url));
  const p=data.proj, project=(lat,lon)=>[(lon-p.lon0)*p.mPerLon,-(lat-p.lat0)*p.mPerLat];
  const geometry=projectDistrictGeometry(cfg,data,project),bounds=geometryBounds(geometry),step=250;
  let core=0,ring=0;
  for(let x=Math.floor((bounds[0]-600)/step)*step;x<bounds[2]+600;x+=step)for(let z=Math.floor((bounds[1]-600)/step)*step;z<bounds[3]+600;z+=step){
    const d=rectangleMargin([x,z,x+step,z+step],geometry);
    assert.ok(Number.isFinite(d),`${id} square distance is finite`);
    if(d<=0)core++;else if(d<=600)ring++;
  }
  assert.ok(core>0&&ring>0,`${id} keeps full interior and surrounding cells`);
  if(!cfg.bands&&!cfg.route&&!cfg.poly){
    const [s,w,n,e]=cfg.bbox,mid=project((s+n)/2,(w+e)/2);
    assert.ok(rectangleMargin([mid[0]-1,mid[1]-1,mid[0]+1,mid[1]+1],geometry)<=0,`${id} bbox centre is inside source polygon`);
  }
  totals[id]={core,ring};
}
console.log(JSON.stringify({checks:'exact polygon/band/circle boundaries and all-eight district interior/ring coverage',totals},null,2));
