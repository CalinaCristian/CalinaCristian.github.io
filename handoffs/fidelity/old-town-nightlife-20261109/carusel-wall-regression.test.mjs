import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
import {collide,colliderIndex} from '../../../game/src/spots/walker.js';
import {collideBuildings} from '../../../game/src/world.js';
import {findWalkPath} from '../../../game/src/spots/tour.js';
const f=JSON.parse(readFileSync(new URL('./carusel-upper-wall-fixture.json',import.meta.url)));

test('actual Carusel first false ground hit clears below its rail and remains solid on the gallery',()=>{
    const p=f.firstFalseGroundHit,list=colliderIndex([p.wall]);
    assert.equal(f.beforeActualFullNavigationPath,null);
    assert.equal(collide(list,p.x,p.z,.34,p.y+.3),null);
    assert.equal(collideBuildings(list,p.x,p.z,.34,p.y+.3),null);
    assert.ok(collide(list,p.x,p.z,.34,4.2));
    assert.ok(collideBuildings(list,p.x,p.z,.34,4.2));
});

test('all244 actual upper-wall projections leave a lower-floor route open in the isolated height control',()=>{
    assert.equal(f.upperWallRecords.length,244);
    const floor=f.firstFalseGroundHit.y,ground={heightAt:()=>floor,groundAt:()=>floor};
    const path=findWalkPath(ground,colliderIndex(f.upperWallRecords),f.start.x,f.start.z,f.target.x,f.target.z,{radius:1.15,maxLength:100});
    assert.ok(path);
    assert.deepEqual(path[0],[f.start.x,f.start.z]);
    assert.deepEqual(path.at(-1),[f.target.x,f.target.z]);
});
