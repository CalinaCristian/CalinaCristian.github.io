import { compileRaceCourse } from '../race-course.js';
import { carriagewayTest } from '../osm.js';
import { distPolyline } from '../kit.js';

// Actual native bronze plaque: .62x.42x.03m plate, tilted-.4rad. The complete
// projected plate, rather than only its .08m post collider, must clear racers.
const ARC_PLAQUE_RADIUS=Math.hypot(.62/2,.42/2*Math.sin(.4)+.03/2*Math.cos(.4));
export function arcPlaquePlacements(course,center,count,{inside,activeRoad,blocked}) {
    const out=[],deltas=[0,Math.PI/6,-Math.PI/6,Math.PI/3,-Math.PI/3,Math.PI/2,-Math.PI/2,2*Math.PI/3,-2*Math.PI/3,Math.PI];
    for(let i=0;i<count;i++){
        const anchor=course.at(22+i*28),angle=Math.atan2(anchor.z-center.z,anchor.x-center.x);let best=null;
        search:for(const radius of [1.2,1.6,2,2.4,3])for(const delta of deltas){
            const x=anchor.x+Math.cos(angle+delta)*radius,z=anchor.z+Math.sin(angle+delta)*radius,
                clearance=distPolyline(x,z,course.points).d,yaw=Math.atan2(anchor.x-x,anchor.z-z),reader={x:x+Math.sin(yaw)*.8,z:z+Math.cos(yaw)*.8};
            if(clearance<ARC_PLAQUE_RADIUS+.3+.1||!inside(x,z)||activeRoad(x,z,ARC_PLAQUE_RADIUS)||activeRoad(reader.x,reader.z,.3)||blocked(x,z,ARC_PLAQUE_RADIUS+.05))continue;
            if(out.some(p=>Math.hypot(p.x-x,p.z-z)<ARC_PLAQUE_RADIUS*2+.2))continue;
            best={x,z,yaw,reader,courseClearanceM:clearance,plateRadiusM:ARC_PLAQUE_RADIUS,offsetM:radius};out.push(best);break search;
        }
        if(!best)throw Error('No physically clear game information plaque placement '+i);
    }
    return out;
}

// A public walking apron can be mapped as a service way with access=no plus
// an explicit foot=yes exception and motor_vehicle=no. Keep those literal
// rights; neither a missing tag nor general private access grants this case.
export function arcActiveCarriageway(data) {
    return carriagewayTest({...data,ways:data.ways.filter(w=>!(w.foot==='yes'&&w.motor_vehicle==='no'))});
}

// All mapped vertices remain literal. The two short transverse finish/start
// connectors are game walking on the clear public monument apron, not new OSM
// ways, paving footprints, road connections or motor travel rights.
export function arcRaceCourse(data) {
    const east=data.ways.find(w=>w.id==='w1479986588'),west=data.ways.find(w=>w.id==='w1479986589');
    if(!east||!west)throw Error('Missing mapped Arc pedestrian walks');
    for(const id of ['w1191723271','w1191738377','w1191738378']){
        const way=data.ways.find(w=>w.id===id);
        if(!way||way.foot!=='yes'||way.motor_vehicle!=='no')throw Error('Unverified public pedestrian apron '+id);
    }
    const ring=[...east.pts.map(p=>[...p]),...west.pts.slice().reverse().map(p=>[...p])];
    // Rotate the closed game course to a mapped north-apron start, where the
    // complete arch is visible and the grid is clear of its pier corners.
    const points=[...ring.slice(8),...ring.slice(0,8),[...ring[8]]];
    return {...compileRaceCourse(points),sourceWays:[east.id,west.id],publicApronConnectors:[
        [east.pts.at(-1),west.pts.at(-1)],[west.pts[0],east.pts[0]],
    ]};
}

export function arcRoundabout(data) {
    const ids=['w227396567','w1110051052','w1110051056','w1110051053','w1558883517','w1110051057','w1110051055','w1110051054'];
    const points=[];
    for(const id of ids){
        const way=data.ways.find(w=>w.id===id);if(!way||way.oneway!=='yes'||way.junction!=='circular')throw Error('Unknown mapped circular direction '+id);
        if(points.length&&Math.hypot(points.at(-1)[0]-way.pts[0][0],points.at(-1)[1]-way.pts[0][1])>1e-8)throw Error('Disconnected mapped circular source '+id);
        points.push(...way.pts.slice(points.length?1:0).map(p=>[...p]));
    }
    if(Math.hypot(points[0][0]-points.at(-1)[0],points[0][1]-points.at(-1)[1])>1e-8)throw Error('Unclosed source circular way chain');
    return {points,sourceWays:ids};
}
