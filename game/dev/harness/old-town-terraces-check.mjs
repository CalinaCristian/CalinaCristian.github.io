// Exact generated canopy geometry versus its walker OBB, including the sourced Dristor front.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { oldTownTerraces } from '../../src/spots/buc.js';
import { collide } from '../../src/spots/walker.js';
const data = JSON.parse(await readFile(new URL('../../data/spots/buc-old-town.json', import.meta.url)));
const footprints = () => JSON.stringify(data.buildings.map(b=>[b.id,b.poly]));
const before = footprints(), boxes = [];
const ctx = { data, ground: { heightAt: () => 0 }, box: (x,z,hw,hd,angle,extra) => boxes.push({x,z,hw,hd,angle,r:Math.hypot(hw,hd),y:0,...extra}) };
const terraces = oldTownTerraces(ctx, { seed: 3 });
const fabric = terraces.group.getObjectByName('terraces:fabric').geometry.attributes.position;
const points = Array.from({length:fabric.count}, (_,i)=>[fabric.getX(i),fabric.getY(i),fabric.getZ(i)]);
assert.equal(boxes.length, terraces.terraces.length);
let checked = 0;
for (const [i, t] of terraces.terraces.entries()) {
    const b = boxes[i], f = t.f;
    // Upper canopy edge is on the actual batched mesh, close to the mapped facade.
    const near = points.filter(p=>Math.abs(p[1]-3.05)<1e-5 && Math.hypot(p[0]-f.x,p[2]-f.z)<t.W/2+.2);
    let longest = null;
    for (const a of near) for (const c of near) {
        const length = Math.hypot(c[0]-a[0],c[2]-a[2]);
        const mx = (a[0]+c[0])/2, mz=(a[2]+c[2])/2;
        if(Math.abs(length-t.W)<1e-4 && Math.hypot(mx-f.x,mz-f.z)<.2) longest=[a,c,length];
    }
    assert.ok(longest, `${t.name}: actual canopy edge`);
    const [a,c,length]=longest, gx=(c[0]-a[0])/length, gz=(c[2]-a[2])/length;
    const dot=gx*Math.cos(b.angle)-gz*Math.sin(b.angle);
    assert.ok(Math.abs(dot)>.999999, `${t.name}: long OBB axis must follow canopy edge`);
    // The street directly beyond the terrace remains walkable, while a table remains solid.
    assert.equal(collide([b], f.x+f.nx*(t.depth+.8), f.z+f.nz*(t.depth+.8), .3, .3), null, `${t.name}: street clearance`);
    assert.ok(collide([b],t.x,t.z,.3,.3), `${t.name}: furniture collision`);
    checked++;
}
assert.equal(footprints(),before,'source footprints remain identical');
assert.ok(terraces.terraces.some(t=>t.name==='Dristor Kebap'));
console.log(`${checked}/${checked} generated terrace OBBs match their actual canopy geometry; street clearance and furniture collision pass; source footprints unchanged`);
