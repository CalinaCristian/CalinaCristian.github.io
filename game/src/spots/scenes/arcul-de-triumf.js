// Arcul de Triumf: literal source roads/paved walks and the low public passage.
// Races, blue course markers and the baguette are explicitly authored game play.
import { photoHunt } from '../photo-hunt.js';
import { GeoBatch, offsetPolyline, inPoly } from '../kit.js';
import { bucBackdrop, placeLandmark } from '../buc.js';
import { roadWidth } from '../osm.js';
import { addTraffic } from '../cars.js';
import { ARC_SOURCE_PARTS } from '../../landmark-arcul-source.js';
import { collideBuildings } from '../../world.js';
import { arcRaceCourse, arcRoundabout, arcActiveCarriageway, arcPlaquePlacements } from './arcul-layout.js';
import { createArcActivities } from './arcul-activities.js';
import { parkWoods, dropMedianTrees, businessSigns, thinTrees } from './buc-green.js';

const INSCRIPTIONS = [
    { face: 'south', ro: 'FERDINAND I · DOMN ȘI REGE AL ROMÂNILOR', en: 'Ferdinand I, Prince and King of the Romanians — the 1918 union completed under his reign.' },
    { face: 'north', ro: 'SE ÎNDEPLINI DREPTATEA ȘI PENTRU POPORUL ROMÂN', en: 'Justice was done for the Romanian people too.' },
    { face: 'east', ro: 'GLORIE CELOR CE PRIN VITEJIA ȘI PRIN JERTFA LOR AU ÎNTREGIT UNITATEA NAȚIONALĂ', en: 'Glory to those who, by their bravery and sacrifice, completed the national unity.' },
    { face: 'west', ro: 'GLORIE CELOR CE PRIN VITEJIA ȘI PRIN JERTFA LOR AU ÎNTREGIT UNITATEA NAȚIONALĂ', en: 'Glory to those who, by their bravery and sacrifice, completed the national unity.' },
];

export default {
    env: { fogFar: 3000, ambientCity: .25, groundAlbedo: .12 },
    async build(ctx) {
        const g=ctx.ground,d=ctx.data,sp=ctx.spot('arcul-de-triumf'),course=arcRaceCourse(d),roundabout=arcRoundabout(d);
        const arch=d.buildings.find(b=>b.id==='w217851530');
        if(!arch)throw Error('Missing literal Arc footprint');
        ctx.skipBuildings.add(arch.id);for(const q of ARC_SOURCE_PARTS)ctx.skipBuildings.add(q.id);
        const firstRoad=d.ways.find(w=>w.id===roundabout.sourceWays[0]);
        // Share the native road painter's width estimate, without moving any
        // literal source vertex or width tag. Grade only the real public island.
        const island=offsetPolyline(roundabout.points,-roadWidth(firstRoad)/2),mid=arch.poly.reduce((a,p)=>[a[0]+p[0]/arch.poly.length,a[1]+p[1]/arch.poly.length],[0,0]);
        const floor=g.heightAt(...mid);g.flatten(island,floor,3);
        const AR=placeLandmark(ctx,'arcul',{y:floor,colliderH:30});
        if(!AR)throw Error('Missing Arc model');
        // These walks already have exact paved area polygons; a second default
        // 2.2m-wide line would widen them and paint across the gravel petals.
        for(const id of ['w1479986588','w1479986589','w1479986590'])ctx.skipWays.add(id);
        ctx.terrainOpts={bg:'#707c54',bgMask:'grass',innerPx:2048,innerStep:3,outerStep:16,outerPad:700};
        // No generated ground-floor shopfronts here: the square is villas, embassies,
        // sports grounds and the park (Street View 2026-11-12); mapped businesses get name boards below.
        bucBackdrop(ctx,{urban:false,species:{plane:.55,linden:.3,chestnut:.15},doubleCentre:true,lampStyle:'cobra',lampColor:'#2b2e31',lampH:10,lampPad:30,
            treeLod:{cap:3200,max:420},lampOpts:{spacing:34,kinds:['primary','secondary']},streetTreeOpts:{spacing:8.5,prob:.92,kinds:['primary','secondary','tertiary']}});
        for(const id of ['w1191615184','w1191615185','w1191624784','w1191624785']){const a=d.areas.find(a=>a.id===id);if(a)ctx.painter.poly(a.poly,'#b6b5ad','dirt');}
        for(const id of ['w1191615188','w1458987299']){const a=d.areas.find(a=>a.id===id);if(a)ctx.painter.poly(a.poly,'#b9b7ad','slab');}
        ctx.painter.poly(arch.poly,'#b9b5aa','slab');
        // The mapped park / garden / forest polygons are a closed mature wood on
        // both sides of Kiseleff (Street View); OSM maps the polygons, not the
        // trees, so their count and positions are an estimate kept clear of
        // every mapped way, building, pitch and playground.
        {const green=d.areas.filter(a=>a.leisure==='park'||a.leisure==='garden'||a.landuse==='forest'||a.natural==='wood').map(a=>a.poly),T=d.terrain;
            const woods=parkWoods(ctx,green,{seed:61,bounds:{x0:T.x0,z0:T.z0,x1:T.x0+(T.nx-1)*T.d,z1:T.z0+(T.nz-1)*T.d},density:(x,z)=>Math.hypot(x-AR.x,z-AR.z)<420?1/62:1/170});
            // Outside the park the villa gardens and the green wedge between Kiseleff and Bd. Prezan are just as
            // planted (Street View): a lighter estimated scatter between the mapped buildings, never on a pitch or stadium.
            const yard=[[AR.x-400,AR.z-400],[AR.x+400,AR.z-400],[AR.x+400,AR.z+400],[AR.x-400,AR.z+400]];
            const gardens=parkWoods(ctx,[yard],{seed:67,min:6.5,conifer:.14,scale:[1,1.6],density:()=>1/170,inside:(x,z)=>!green.some(p=>inPoly(x,z,p))});
            ctx.trees.push(...woods,...gardens);ctx.extras.arcParkWoods={trees:woods.length,gardenTrees:gardens.length,sourcePolygons:green.length,estimatedPositions:true};}
        // Preserve every literal tree; remove only generated trees on actual
        // roads/the public island. There is no invented far tower filler here.
        const sourceTrees=new Set(d.trees.map(t=>Math.round(t[0]*10)+','+Math.round(t[1]*10))),onRoad=arcActiveCarriageway(d);
        ctx.trees=ctx.trees.filter(t=>sourceTrees.has(Math.round(t.x*10)+','+Math.round(t.z*10))||(!onRoad(t.x,t.z,.2)&&Math.hypot(t.x-AR.x,t.z-AR.z)>27));
        // Generated street trees between the two carriageways of the approaches and on
        // the mapped splitter islands hid the arch from Kiseleff; those are open in reality.
        ctx.extras.arcMedianTreesRemoved=dropMedianTrees(ctx,{keep:t=>sourceTrees.has(Math.round(t.x*10)+','+Math.round(t.z*10))});
        // One even tree budget: the loader cap alone keeps the nearest trees and leaves a hard-edged wood.
        ctx.extras.arcTreeBudget=thinTrees(ctx,{budget:3050,far:.6,keep:t=>sourceTrees.has(Math.round(t.x*10)+','+Math.round(t.z*10)),core:(x,z)=>Math.hypot(x-AR.x,z-AR.z)<300});
        const edge=new GeoBatch();for(let i=1;i<island.length;i++)edge.rod([island[i-1][0],floor+.07,island[i-1][1]],[island[i][0],floor+.07,island[i][1]],.08,'#bbb7ad','stone',4);
        ctx.add(edge.build('source-roundabout-inner-kerb'));
        // The mapped mast belongs to the monument roof: literal source node
        //11056553808 has min_height27/height31. The hero owns that same record;
        // no second14m pole or collider is invented on the public ground.
        const way=id=>d.ways.find(w=>w.id===id)?.pts||[];
        // Same28 ambient cars, source-legal directions. The old reverse copy
        // of one-way Kiseleff is replaced by another lane on the actual way.
        ctx.extras.arcAmbientTraffic=addTraffic(ctx,{lanes:[{pts:roundabout.points,n:7,speed:8},{pts:offsetPolyline(roundabout.points,-3.1),n:5,speed:7},
            {pts:way('w281701377'),n:6,speed:12},{pts:offsetPolyline(way('w281701377'),3.2),n:6,speed:12},
            {pts:offsetPolyline(way('w229373804'),4.8),n:4,speed:12}]});
        const credits=[null,null,'Architect Petre Antonescu; sculptors Ion Jalea, Constantin Baraschi, Mac Constantinescu, Dimitrie Paciurea (1935–36).','Medallions of King Ferdinand and Queen Maria restored after 1989.',null];
        // Game interpretation plaques sit beside the mapped walks, outside the
        // actual race centreline and carriageway; they claim no surveyed signs.
        const plaqueSites=arcPlaquePlacements(course,AR,sp.plaques.length,{inside:(x,z)=>inPoly(x,z,island),activeRoad:onRoad,
            blocked:(x,z,r)=>!!collideBuildings(ctx.colliders,x,z,r,floor+.2)});
        sp.plaques.forEach((pl,i)=>{const p=plaqueSites[i];ctx.plaque(pl,p.x,p.z,p.yaw,{style:'bronze',credit:credits[i],y:floor});});
        const c=Math.cos(AR.lm.rotation),sn=Math.sin(AR.lm.rotation),local=(u,v)=>({x:AR.x+u*c+v*sn,z:AR.z-u*sn+v*c});
        const faces={south:local(0,-6.2),north:local(0,6.2),east:local(15.8,0),west:local(-15.8,0)},read=new Set();
        for(const ins of INSCRIPTIONS){const p=faces[ins.face];ctx.interactables.push({...p,y:floor,r:2.3,label:`Read the inscription (${ins.face} face)`,use:s=>{read.add(ins.face);s.ui.toast(ins.ro,`${ins.en} (${read.size}/4 faces read)`);}});}
        const photoAt=local(0,17.5),left=local(-9,-4.8),right=local(9,-4.8);
        photoHunt(ctx,{...photoAt,title:'Frame the Arc memorial',unavailable:'Current museum and roof admission are not verified; interior access is unavailable.',targets:[
            {label:'The central arch opening',x:AR.x,y:AR.y+10,z:AR.z,radius:2},{label:'The western sculpted pier',...left,y:AR.y+15,radius:1.8},{label:'The eastern sculpted pier',...right,y:AR.y+15,radius:1.8}],
            onDone:s=>s.ui.toast('The Arc memorial','You framed the opening and both sculpted piers. The race and baguette catch are separate activities.')});
        createArcActivities(ctx,course,{floor,arch:AR});
        ctx.extras.arcBusinessSigns=businessSigns(ctx,{name:'arc-business-signs'});
        // Actual north-apron path arrival. Both activities are reachable without
        // crossing the roundabout. The optional pitch is a normal entry pose.
        const start=course.at(course.length-1.2),dx=AR.x-start.x,dz=AR.z-start.z;
        ctx.spawns['arcul-de-triumf']={x:start.x,z:start.z,heading:Math.atan2(-dx,-dz),pitch:.5};
        const photo=way('w1571030032')[0];
        if(photo){const bearing=(Math.atan2(AR.x-photo[0],photo[1]-AR.z)*180/Math.PI+360)%360;ctx.challenge('arcul-de-triumf',{view:[AR.x,AR.z],x:photo[0],z:photo[1],heading:bearing,pitch:11,r:8,tol:20});}
        ctx.crowdCfg={personas:{local_young:3,local_elder:1.5,tourist_de:1.5,tourist_it:1.5,kid:.6,local_parent:1},walkers:26,paths:ctx.footLines(),groups:[
            {x:29,z:-99,r:2,n:5,act:'photo',look:[AR.x,AR.z],personas:['tourist_de','tourist_it','local_young']},
            {x:-45,z:-121,r:1,n:3,act:'photo',look:[AR.x,AR.z],personas:['tourist_it','tourist_de']},
            {x:AR.x+6,z:AR.z-8,r:.2,n:1,act:'watch',look:[AR.x,AR.z],personas:['guard']}]};
        ctx.extras.arcSource={courseSources:course.sourceWays,courseLengthM:course.length,publicApronConnectors:course.publicApronConnectors,
            circularSourceWays:roundabout.sourceWays,sourceParts:ARC_SOURCE_PARTS.map(p=>p.id),sourceTrees:d.trees.length,plaqueSites,
            sourcePathNote:'Short transverse game-course connectors cross clear public apron; no new OSM way or paving footprint is added.'};
        ctx.sound('traffic',AR.x,AR.z,120,1.2);ctx.sound('wind',AR.x,AR.z,60,.4);ctx.sound('birds',60,-160,90,.5);
    },
};
