import fs from 'node:fs';
import { pointInPolygon } from './geom.mjs';
import assert from 'node:assert/strict';
import { passageSolids, clipPassageWall, passageInterior } from '../../game/src/building-passages.js';
import { collideBuildings } from '../../game/src/world.js';
import { ringArea } from '../../game/src/building-parts.js';
import { sourcePassages } from './source-passages.mjs';
const ring=[[0,-6],[20,-6],[20,6],[0,6]],holes=[[[7,3],[11,3],[11,5],[7,5]]],snapshot=JSON.stringify({ring,holes});
const passage={key:'w7/0',ring:[[-5,-2],[25,-2],[25,2],[-5,2]],ceilingM:3.34};
const bands=passageSolids(ring,holes,0,10,[passage]);
const body={x:10,z:0,r:20,poly:ring,holes,minH:0,h:10,passageSolids:bands};
let checks=0;
for(let x=-2;x<=22;x+=.25){assert.equal(collideBuildings([body],x,0,.8,.24),null,'whole vehicle clears every point of the mapped through-opening, including its mouths');checks++;}
assert(collideBuildings([body],0,1.85,.3,.24),'finite body still hits a sidepost');checks++;
assert(collideBuildings([body],4,4,.4,.24),'wall beside the opening remains solid');checks++;
assert(collideBuildings([body],10,0,.4,4,.3),'source upper storeys still collide');checks++;
assert.equal(collideBuildings([body],10,0,.4,10.5,.3),null,'above the complete source body is clear');checks++;
for(const y of [.24,4,9]){assert.equal(collideBuildings([body],9,4,.3,y),null,'source courtyard remains open in every vertical band');checks++;}
assert(collideBuildings([body],7.1,4,.3,.24),'finite body still hits the courtyard side wall');checks++;
const low={...body,passageSolids:passageSolids(ring,holes,0,10,[{...passage,ceilingM:1.8}])};
assert(collideBuildings([low],10,0,.4,.24,2),'a low clearance does not disappear for a tall body');checks++;
assert.equal(collideBuildings([low],10,0,.3,.24,1.4),null,'a shorter body can use the same explicitly low opening');checks++;
const faces=clipPassageWall([0,-6],[0,6],[{t0:0,t1:1,y0:.18,y1:10}],[passage]);
assert(Math.abs(faces.filter(f=>f.y0<1).reduce((s,f)=>s+(f.t1-f.t0)*12,0)-8)<1e-8,'only the mapped4m opening is removed from the ground wall');checks++;
assert(Math.abs(faces.reduce((s,f)=>s+(f.t1-f.t0)*12,0)-12)<1e-8,'all upper wall width is retained');checks++;
assert.equal(JSON.stringify({ring,holes}),snapshot,'source outline and hole coordinates are unchanged');checks++;
const interior=passageInterior([passage],[{i:0,ring,holes,minH:0,h:10,passages:[passage]},{i:1,ring,holes,minH:0,h:10,passages:[passage]}]);
assert(Math.abs(interior.ceilings.reduce((s,r)=>s+Math.abs(ringArea(r.ring)),0)-80)<1e-7,'overlapping source records emit the same80m² ceiling once');checks++;
assert(Math.abs(interior.walls.reduce((s,w)=>s+Math.hypot(w.b[0]-w.a[0],w.b[1]-w.a[1]),0)-40)<1e-7,'overlapping source records emit side walls once');checks++;
const a={...passage,key:'w7/0',ring:[[-5,-2],[12,-2],[12,2],[-5,2]]},b={...passage,key:'w7/1',ring:[[8,-2],[25,-2],[25,2],[8,2]]};
const joined=passageInterior([a,b],[{i:0,ring,holes,minH:0,h:10,passages:[a,b]}]);
assert(Math.abs(joined.ceilings.reduce((s,r)=>s+Math.abs(ringArea(r.ring)),0)-80)<1e-7,'overlapping source segments have no doubled ceiling');checks++;
assert(Math.abs(joined.walls.reduce((s,w)=>s+Math.hypot(w.b[0]-w.a[0],w.b[1]-w.a[1]),0)-40)<1e-7,'overlapping source segments have neither duplicate walls nor interior blockers');checks++;
const nodes=new Map([[1,[0,-5]],[2,[0,25]]]),ways=new Map([[7,{nodes:[1,2],tags:{highway:'service',tunnel:'building_passage',width:'4 m','maxheight:physical':'3 m'}}],[8,{nodes:[1,2],tags:{highway:'service'}}]]);
const src=sourcePassages([{ring,holes,minH:0,h:10,t:{__id:'w99'}}],ways,nodes,(lat,lon)=>[lon,lat],[]);
assert.equal(src.records[0].length,1,'an untagged service line never creates a guessed passage');checks++;
assert.equal(src.records[0][0].widthM,4);assert.equal(src.records[0][0].clearanceM,3);checks+=2;
assert.equal(src.records[0][0].sourceRoadId,'w7');assert.equal(src.issues.length,0);checks+=2;
const qRing=[[1.2346,-6],[21.2346,-6],[21.2346,6],[1.2346,6]],qNodes=new Map([[11,[0,1.234567]],[12,[0,21.234567]]]);
const qWays=new Map([[8,{nodes:[11,12],tags:{highway:'service',width:'4 m'}}],[99,{nodes:[21,11,22,23,12,24,21],tags:{building:'apartments'}}]]);
const review={buildingId:'w99',sourceRoadId:'w8',sharedWallNodeIds:[11,12],classificationSource:'reviewed source shared-wall-node topology',clearanceM:3.1,clearanceSource:'estimate:3.1m',evidence:['https://www.openstreetmap.org/way/8']};
const qBuildings=[{ring:qRing,holes:[],minH:0,h:10,t:{__id:'w99'}},{ring:qRing,holes:[],minH:0,h:10,t:{__id:'w100'}}];
const q=sourcePassages(qBuildings,qWays,qNodes,(lat,lon)=>[lon,lat],[],[review]);
assert.equal(q.issues.length,0);assert.equal(q.records[0].length,1);assert.equal(q.records[1],undefined,'a reviewed opening cannot cut an unrelated neighbour');checks+=3;
assert.equal(q.records[0][0].tags.tunnel,undefined,'review never invents an OSM tunnel tag');checks++;
assert.equal(q.records[0][0].classificationSource,review.classificationSource);checks++;
const voids=q.records[0].map(p=>({...p,ceilingM:p.clearanceM+.24}));
const qb={x:11.2346,z:0,r:30,poly:qRing,h:10,passageSolids:passageSolids(qRing,[],0,10,voids)};
for(let x=.734567;x<=21.734567;x+=.1){assert.equal(collideBuildings([qb],x,0,.8,.24),null,'a finite vehicle passes both quantized source mouths');checks++;}
assert(collideBuildings([qb],2,1.9,.3,.24),'review preserves side posts');checks++;
assert(collideBuildings([qb],2,0,.3,4),'review preserves source body above its estimated ceiling');checks++;
assert.equal(collideBuildings([qb],2,0,.3,11),null,'space above source total height remains clear');checks++;
const bad=sourcePassages(qBuildings,qWays,qNodes,(lat,lon)=>[lon,lat],[],[{...review,sharedWallNodeIds:[11,777]}]);
assert.equal(Object.keys(bad.records).length,0);assert.equal(bad.issues[0].reason,'invalid-reviewed-source-opening');checks+=2;
// Real source walls are oblique and stepped. Their way endpoints are on the walls,
// unlike a synthetic rectangle with a road already extending5m beyond each mouth.
const fixture=JSON.parse(fs.readFileSync(new URL('./fixtures/pipera-passages.json',import.meta.url)));
const immutableSource=JSON.stringify({nodes:fixture.nodes,bodies:fixture.bodies,ways:fixture.ways});
const actual=sourcePassages(fixture.bodies,new Map(fixture.ways),new Map(fixture.nodes),(z,x)=>[x,z],fixture.roads,fixture.reviews);
assert.deepEqual(actual.issues,[]);checks++;
let actualSourcePositions=0,sourcePosts=0,sourceUpper=0;
for(const [i,openings]of Object.entries(actual.records)){
    const s=fixture.bodies[i],ps=openings.map(p=>({...p,ceilingM:.24+p.clearanceM}));
    const c={...s,x:0,z:0,r:1e7,poly:s.ring,passageSolids:passageSolids(s.ring,s.holes,s.minH,s.h,ps)};
    const solid=p=>pointInPolygon(...p,s.ring)&&!s.holes.some(h=>pointInPolygon(...p,h));
    for(const p of ps){
        const[a,b]=p.sourceCentreline,dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz),nx=-dz/len,nz=dx/len;
        for(let t=-.8/len;t<1+.8/len;t+=.1/len){const q=[a[0]+dx*t,a[1]+dz*t];assert.equal(collideBuildings([c],...q,.8,.24),null,'finite vehicle clears real source mouth '+s.t.__id);actualSourcePositions++;checks++;}
        for(const t of[.25,.5,.75]){
            const q=[a[0]+dx*t,a[1]+dz*t];
            if(solid(q)&&s.h>p.ceilingM+.3){assert(collideBuildings([c],...q,.15,p.ceilingM+.05,.2),'actual source upper body stays solid '+s.t.__id);sourceUpper++;checks++;}
            for(const sign of[-1,1]){const post=[q[0]+nx*(p.widthM/2+.1)*sign,q[1]+nz*(p.widthM/2+.1)*sign];if(solid(post)&&!ps.some(p=>pointInPolygon(...post,p.ring))){assert(collideBuildings([c],...post,.2,.24),'actual source side post remains solid '+s.t.__id);sourcePosts++;checks++;}}
        }
        assert.equal(collideBuildings([c],a[0],a[1],.2,s.h+.1),null,'above the source total is clear');checks++;
    }
}
assert(actualSourcePositions>2000&&sourceUpper>10&&sourcePosts>10,'actual source fixtures exercise finite bodies, posts and upper floors');checks++;
assert.equal(JSON.stringify({nodes:fixture.nodes,bodies:fixture.bodies,ways:fixture.ways}),immutableSource,'no source coordinates, source dimensions or tags changed');checks++;
const nearby={ring:[[25.5,-1],[30,-1],[30,1],[25.5,1]],holes:[],minH:0,h:10,t:{__id:'w1000'}};
const near=sourcePassages([{ring,holes,minH:0,h:10,t:{__id:'w99'}},nearby],ways,nodes,(lat,lon)=>[lon,lat],[]);
assert.equal(near.records[1],undefined,'a round mouth touching nearby frontage never invents a passage through that neighbour');checks++;
console.log(JSON.stringify({passed:true,checks,actualSourcePositions,sourcePosts,sourceUpper,ceilingAreaM2:80,interiorWallMetres:40},null,2));
