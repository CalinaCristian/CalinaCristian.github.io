// Snapshot only resources owned by this room at construction time. A later live
// window adapter can attach externally owned materials/targets without this
// snapshot adopting them. Shared primitive/crowd/helper resources stay separate.
export function captureOfficeResources(scene,{sharedGeometries=new Set(),helperMaterials=new Set(),helperTextures=new Set()}={}){
 const geometries=new Set(),materials=new Set(),textures=new Set(),shadows=new Set();
 const external=o=>o?.userData?.shared||o?.userData?.external||o?.userData?.officeExternal;
 const visit=(node,shared=false)=>{
  shared=shared||!!node.userData?.shared;
  if(!shared){
   if(node.geometry&&!sharedGeometries.has(node.geometry)&&!external(node.geometry))geometries.add(node.geometry);
   for(const m of node.material?(Array.isArray(node.material)?node.material:[node.material]):[]){
    if(external(m)||helperMaterials.has(m))continue;materials.add(m);
    for(const value of Object.values(m))if(value?.isTexture&&!external(value)&&!helperTextures.has(value))textures.add(value);
   }
   if(node.isLight&&node.shadow)shadows.add(node.shadow);
  }
  for(const child of node.children||[])visit(child,shared);
 };
 visit(scene);const counts={geometries:geometries.size,materials:materials.size,textures:textures.size,shadows:shadows.size};let disposed=false;
 return{counts,get remaining(){return{geometries:geometries.size,materials:materials.size,textures:textures.size,shadows:shadows.size};},get disposed(){return disposed;},dispose(){
  if(disposed)return;disposed=true;
  for(const s of shadows)s.dispose?.();for(const g of geometries)g.dispose();for(const m of materials)m.dispose();for(const t of textures)t.dispose();
  shadows.clear();geometries.clear();materials.clear();textures.clear();
 }};
}
