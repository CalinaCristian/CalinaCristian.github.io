import test from 'node:test';
import assert from 'node:assert/strict';
import {Player} from '../src/player.js';

const closure={x:619.3564846,z:-853.9476298,y:.24,top:.24+1.36};
const player=({x,z,surfY})=>Object.assign(Object.create(Player.prototype),{x,z,surfY,softZones:[closure]});
test('the source-clipped ground closure cannot soften an unrelated11m deck collision',()=>{
    const p=player({x:628.5195711552,z:-865.4835827794,surfY:11.24});
    assert.ok(Math.abs(p.x-closure.x)<25&&Math.abs(p.z-closure.z)<25,'historical native frame triggered the old XZ-only zone');
    assert.equal(p.atLevel(closure),false);assert.equal(p.nearClosure(),false);
    p.surfY=.24;assert.equal(p.atLevel(closure),true);assert.equal(p.nearClosure(),true,'the actual ground-level closure remains active');
});
test('the original early bridge-warning witness is on a different physical level',()=>{
    const p=player({x:582.7240088,z:-840.8101076,surfY:11.24}),heading=-1.0709374;
    const dx=closure.x-p.x,dz=closure.z-p.z,d=Math.hypot(dx,dz),fx=-Math.sin(heading),fz=-Math.cos(heading);
    assert.ok(d<40&&(dx*fx+dz*fz)/d>.6,'exact unchanged Main XZ/ahead predicate is satisfied');
    assert.equal(p.atLevel(closure),false,'Main now rejects the unrelated ground barrier band');
});
test('raised and sunken closures retain their actual vertical bands and horizontal bounds',()=>{
    const p=player({x:closure.x,z:closure.z,surfY:11.24});
    p.softZones=[{...closure,y:11.24,top:12.6}];assert.equal(p.nearClosure(),true);
    p.surfY=.24;assert.equal(p.nearClosure(),false);
    p.softZones=[{...closure,y:-4.96,top:-3.6}];p.surfY=-4.96;assert.equal(p.nearClosure(),true);
    p.surfY=.24;assert.equal(p.nearClosure(),false);p.surfY=-4.96;p.x+=25;assert.equal(p.nearClosure(),false,'existing strict25m reach stays unchanged');
});
