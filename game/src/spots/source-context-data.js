// Decode compact literal source context. No scene changes or invented topology.
import { parseMeasure } from '../building-roofs.js';
const positive=t=>t!=null&&!['no','false','0',''].includes(String(t).toLowerCase());
const number=t=>t!=null&&String(t).trim()!==''&&Number.isFinite(Number(t))?Number(t):undefined;
export function sourceTerrainField(terrain,origin,projection){
    if(!(terrain.nx>=2&&terrain.nz>=2&&terrain.lonStep>0&&terrain.latStep>0))throw Error('Invalid source terrain grid');
    const bytes=Uint8Array.from(atob(terrain.heights),c=>c.charCodeAt(0)),view=new DataView(bytes.buffer);
    if(terrain.format!=='float32-le-base64'||bytes.length!==terrain.nx*terrain.nz*4)throw Error('Invalid source terrain encoding');
    const h=new Float32Array(terrain.nx*terrain.nz);for(let i=0;i<h.length;i++){h[i]=view.getFloat32(i*4,true);if(!Number.isFinite(h[i]))throw Error('Unknown source terrain sample');}
    const atLL=(lat,lon)=>{
        const east=terrain.westPixelCentre+(terrain.nx-1)*terrain.lonStep,south=terrain.northPixelCentre-(terrain.nz-1)*terrain.latStep;
        if(lon<terrain.westPixelCentre||lon>east||lat>terrain.northPixelCentre||lat<south)return null;
        const fx=Math.max(0,Math.min(terrain.nx-1,(lon-terrain.westPixelCentre)/terrain.lonStep)),fz=Math.max(0,Math.min(terrain.nz-1,(terrain.northPixelCentre-lat)/terrain.latStep));
        const i=Math.min(terrain.nx-2,Math.floor(fx)),j=Math.min(terrain.nz-2,Math.floor(fz)),u=fx-i,v=fz-j,k=j*terrain.nx+i;
        return(h[k]*(1-u)+h[k+1]*u)*(1-v)+(h[k+terrain.nx]*(1-u)+h[k+terrain.nx+1]*u)*v;
    };
    const heightAt=(x,z)=>{const h=atLL(origin.lat-z/projection.mLat,origin.lon+x/projection.mLon);return h==null?null:h-origin.elev;};
    return{heightAt,atLL,samples:h,source:terrain.sourceSHA256,basis:terrain.verticalDatum};
}
export function decodeSourceContext(data,{origin,projection}){
    if(data.schemaVersion!==1||data.nodes.length%3)throw Error('Unknown source context schema');
    const xy=new Float64Array(data.nodes.length/3*2);
    for(let i=0;i<data.nodes.length;i+=3){xy[i/3*2]=(data.nodes[i+2]/1e7-origin.lon)*projection.mLon;xy[i/3*2+1]=-(data.nodes[i+1]/1e7-origin.lat)*projection.mLat;}
    const ring=ids=>{const n=ids.length>1&&ids[0]===ids.at(-1)?ids.slice(0,-1):ids;return n.map(i=>[xy[i*2],xy[i*2+1]]);};
    const buildings=data.buildings.map(r=>{
        const t=data.tags[r.t],b={id:r.id,poly:ring(r.n),holes:(r.holes||[]).map(ring),k:positive(t.building)?t.building:positive(t['building:part'])?'part':'yes',part:positive(t['building:part']),rawTags:t};
        for(const[key,value]of Object.entries({h:parseMeasure(t.height),lv:number(t['building:levels']),minH:parseMeasure(t.min_height),minLv:number(t['building:min_level']),roof:t['roof:shape'],roofH:parseMeasure(t['roof:height']),rc:t['roof:colour'],c:t['building:colour'],mat:t['building:material'],name:t.name,amenity:t.amenity,shop:t.shop,tourism:t.tourism,layer:number(t.layer)}))if(value!=null&&value!==''&&!(typeof value==='number'&&!Number.isFinite(value)))b[key]=value;
        const roofTags=Object.fromEntries(Object.entries(t).filter(([k])=>k.startsWith('roof:')));if(Object.keys(roofTags).length)b.roofTags=roofTags;
        return b;
    });
    const common=(r,isArea=false)=>{
        const t=data.tags[r.t],o={id:r.id,rawTags:t,...(isArea?{poly:ring(r.n),holes:(r.holes||[]).map(ring)}:{pts:r.n.map(i=>[xy[i*2],xy[i*2+1]]),k:t.highway})};
        for(const k of['name','surface','area','indoor','bridge','tunnel','level','sidewalk','lanes','highway','natural','water','waterway','landuse','leisure','place'])if(t[k]!=null&&!(k==='tunnel'&&t[k]==='no'))o[k]=t[k];
        if(t['area:highway'])o.area_highway=t['area:highway'];if(t.layer!=null)o.layer=number(t.layer);const width=parseMeasure(t.width);if(width>0)o.width=width;
        return o;
    };
    return{id:data.id,origin,projection,terrainSource:data.terrain,buildings,ways:data.ways.map(r=>common(r)),areas:data.areas.map(r=>common(r,true)),coastlines:data.coastlines.map(r=>common(r)),
        trees:data.trees.map(r=>({id:r.id,x:xy[r.n*2],z:xy[r.n*2+1],tags:data.tags[r.t]})),source:data};
}
