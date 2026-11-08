import assert from 'node:assert/strict';
import { LANDMARKS, buildLandmark } from '../../game/src/landmarks.js';
import { collideBuildings } from '../../game/src/world.js';
import { translatedLandmarkCollider } from '../../game/src/spots/landmark-colliders.js';
const anchor = {x:173.5,z:-291.25}, base = 13.4;
const inside = (x,z,p) => { let yes=false; for(let i=0,j=p.length-1;i<p.length;j=i++) if((p[i][1]>z)!==(p[j][1]>z)&&x<(p[j][0]-p[i][0])*(z-p[i][1])/(p[j][1]-p[i][1])+p[i][0])yes=!yes; return yes; };
let solids=0, holes=0, elevated=0, subSquareMetreRings=0;
for (const id of ['ateneu','regal','palat','cec','arc','ase','politehnica','lincoln-square']) {
    const lm=LANDMARKS.find(l=>l.id===id); if(!lm)continue;
    for(const source of buildLandmark(lm,{realScale:true}).collision) {
        const c=translatedLandmarkCollider(source,anchor,base,60,id);solids++;
        assert.equal(c.y0,base+(source.y0??-1));assert.equal(c.y1,base+(source.y1??source.h??60));
        assert.equal(c.angle,source.angle);assert.ok(Number.isFinite(c.r)&&c.r>0);
        if(id==='ateneu')assert.ok(collideBuildings([c],c.x,c.z,.1,(c.y0+c.y1)/2),'Real Athenaeum body remains solid');
        if(source.poly)assert.deepEqual(c.poly,source.poly.map(([x,z])=>[x+anchor.x,z+anchor.z]));
        if(source.y0>2) {assert.equal(collideBuildings([c],c.x,c.z,.01,c.y0-3),null,'Actual raised volume leaves its underside open');elevated++;}
        for(const hole of c.holes||[]) {
            const original=source.holes[(c.holes||[]).indexOf(hole)];assert.deepEqual(hole,original.map(([x,z])=>[x+anchor.x,z+anchor.z]));
            const area=Math.abs(hole.reduce((sum,p,i)=>{const q=hole[(i+1)%hole.length];return sum+p[0]*q[1]-q[0]*p[1]},0))/2;
            if(area<1){subSquareMetreRings++;continue;}
            const xs=hole.map(p=>p[0]),zs=hole.map(p=>p[1]);let sample;
            for(let ix=1;ix<20&&!sample;ix++)for(let iz=1;iz<20&&!sample;iz++){const x=Math.min(...xs)+(Math.max(...xs)-Math.min(...xs))*ix/20,z=Math.min(...zs)+(Math.max(...zs)-Math.min(...zs))*iz/20;if(inside(x,z,hole)&&inside(x,z,c.poly)&&!collideBuildings([c],x,z,.01,(c.y0+c.y1)/2))sample=[x,z];}
            assert.ok(sample,`${id}: a native courtyard remains physically open after translation`);holes++;
        }
    }
}
assert.ok(holes>=3&&solids>=10,'Exercise real courtyard and solid landmark volumes');
console.log(JSON.stringify({passed:true,solids,holes,elevated,subSquareMetreRings,description:'Actual rotated native landmark colliders retain all exact holes/bands; walkable openings are probed physically, sub-square-metre clipping rings are retained and compared exactly'},null,2));
