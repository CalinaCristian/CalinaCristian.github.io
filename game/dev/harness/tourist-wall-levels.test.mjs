import test from 'node:test';
import assert from 'node:assert/strict';
import { collide, colliderIndex } from '../../src/spots/walker.js';
import { collideBuildings } from '../../src/world.js';
import { findWalkPath, walkSegment } from '../../src/spots/tour.js';

const wall = {wall:true,ax:0,az:-4,bx:0,bz:4,x:0,z:0,r:4.5,nx:1,nz:0,y0a:4,y0b:6,y1a:5.1,y1b:7.1};
test('tourist wall queries agree with native collision across an interpolated vertical band',()=>{
    for(const z of [-3,0,3])for(const y of [0,.3,3.8,4.9,5.6,6.8,8]){
        const local=collide([wall],.1,z,.34,y),native=collideBuildings([wall],.1,z,.34,y);
        assert.equal(!!local,!!native,`z=${z} y=${y}`);
        if(local){assert.equal(local.px,native.px);assert.equal(local.pz,native.pz);}
    }
});
test('an elevated gallery rail leaves the ground route open and still blocks its own floor',()=>{
    const walls=colliderIndex([wall]),ground={heightAt:()=>0,groundAt:()=>0};
    assert(walkSegment(ground,walls,[-2,0],[2,0]));
    assert(findWalkPath(ground,walls,-2,0,2,0));
    const gallery={heightAt:()=>5.2,groundAt:()=>5.2};
    assert(!walkSegment(gallery,walls,[-2,0],[2,0]));
});
test('legacy walls without bands retain their collision instead of creating new passages',()=>{
    const {y0a,y0b,y1a,y1b,...legacy}=wall;
    assert(collide([legacy],.1,0,.34,.3));
    assert(collide([legacy],.1,0,.34,10));
});
