// Reproduce the old normal-only shader failure and compile the corrected native shaders.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const root=path.resolve(fileURLToPath(new URL('../',import.meta.url)));
const server=createServer(async(req,res)=>{if(req.url==='/fixture'){res.setHeader('content-type','text/html');res.end('<!doctype html><body></body>');return;}try{const p=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname);if(!p.startsWith(root+'/'))throw Error('path');res.setHeader('content-type','application/javascript');res.end(await readFile(p));}catch{res.statusCode=404;res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const {chromium}=createRequire(import.meta.url)('playwright'),browser=await chromium.launch({headless:true,args:['--mute-audio']});
try{
 const page=await browser.newPage();await page.goto(`http://127.0.0.1:${server.address().port}/fixture`);
 const result=await page.evaluate(async()=>{
  const T=await import('/game/vendor/three.module.min.js'),{installNormalGuard}=await import('/game/src/normal-guard.js');
  const original=T.ShaderChunk.normal_fragment_begin,normalVertex=T.ShaderLib.normal.vertexShader,normalFragment=T.ShaderLib.normal.fragmentShader;
  const run=after=>{
   const r=new T.WebGLRenderer({antialias:false});r.setSize(32,32);const scene=new T.Scene(),camera=new T.PerspectiveCamera(45,1,.1,10);camera.position.z=3;scene.background=new T.Color('#191919');scene.add(new T.HemisphereLight('#ffffff','#999999',2));
   const errors=[];r.debug.onShaderError=(gl,program,vs,fs)=>errors.push({vertex:gl.getShaderInfoLog(vs),fragment:gl.getShaderInfoLog(fs)});
   const geometry=new T.PlaneGeometry(2,2);geometry.attributes.normal.array.fill(0);geometry.attributes.normal.needsUpdate=true;
   const materials=after?[new T.MeshNormalMaterial(),new T.MeshNormalMaterial({flatShading:true}),new T.MeshLambertMaterial(),new T.MeshPhongMaterial(),new T.MeshStandardMaterial()]:[new T.MeshNormalMaterial()];
   const samples=[];
   for(const material of materials){const mesh=new T.Mesh(geometry,material);scene.add(mesh);r.render(scene,camera);const gl=r.getContext(),pixel=new Uint8Array(4);gl.readPixels(16,16,1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);samples.push({type:material.type,flat:material.flatShading||false,pixel:[...pixel],glError:gl.getError()});scene.remove(mesh);material.dispose();}
   geometry.dispose();r.dispose();r.forceContextLoss();return{errors,samples};
  };
  T.ShaderChunk.normal_fragment_begin=original.replace('vec3 normal = normalize( vNormal );','vec3 normal = dot(vNormal,vNormal)>1e-12 ? normalize(vNormal) : normalize(cross(dFdx(vViewPosition),dFdy(vViewPosition))+1e-9);');
  const before=run(false);T.ShaderChunk.normal_fragment_begin=original;T.ShaderLib.normal.vertexShader=normalVertex;T.ShaderLib.normal.fragmentShader=normalFragment;
  installNormalGuard(T);const shader=T.ShaderChunk.normal_fragment_begin;installNormalGuard(T);const idempotent=shader===T.ShaderChunk.normal_fragment_begin;
  const after=run(true);return{before,after,idempotent};
 });
 assert(result.before.errors.some(e=>e.fragment.includes('vViewPosition')),'Native old smooth normal pass reproduces the missing varying');
 assert.deepEqual(result.after.errors,[]);assert(result.idempotent);
 assert(result.after.samples.every(s=>s.glError===0&&s.pixel[3]===255&&s.pixel.slice(0,3).some(v=>v>40)),'All corrected normal/lit pixels render without GL errors or black NaN output');
 console.log(JSON.stringify({passed:true,scope:'Native 32px shader compile/pixel controls; actual Ultra scene/performance acceptance remains separate',...result}));
}finally{await browser.close();server.close();}
