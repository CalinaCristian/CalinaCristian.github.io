// District replacement only. Tourist visits retain their street scene for the return trip.
// A scene contains both district-owned resources and module-cached vehicle/tree/landmark templates.
import { disposeWater } from './water.js';
export function disposeDistrictScene(scene, { retained = [], landmarks = [] } = {}) {
    if (!scene) return;
    const geometries = new Set(), materials = new Set(), textures = new Set(), instances = new Set();
    const keepGeometry = new Set(), keepMaterial = new Set(), keepTexture = new Set();
    const mats = o => !o.material ? [] : Array.isArray(o.material) ? o.material : [o.material];
    const keep = o => {
        if (o.geometry) keepGeometry.add(o.geometry);
        for (const m of mats(o)) keepMaterial.add(m);
    };
    for (const root of retained) if (root) { root.traverse(keep); root.removeFromParent(); }
    for (const lm of landmarks) lm.mesh?.traverse(o => { for (const m of mats(o)) keepMaterial.add(m); });
    scene.traverse(o => {
        // Tree geometry and materials on shared vehicle/crowd objects belong to their module caches.
        if (/^tree(?:Crowns|Trunks)/.test(o.name || '')) keepGeometry.add(o.geometry);
        const wrapper = o.userData.fleet || o.userData.parkedFleet || /^crowd-(?:near|far)$/.test(o.name || '');
        if (o.userData.shared && !wrapper) keep(o);
        if (wrapper) {
            for (const m of mats(o)) keepMaterial.add(m);
            // The wrapper owns aPaint/aLB; position/normal/index are cached model attributes.
            // Leave owned attributes attached so BufferGeometry.dispose actually frees their GL buffers.
            for (const [name, attr] of Object.entries(o.geometry.attributes)) if (!attr.isInstancedBufferAttribute) o.geometry.deleteAttribute(name);
            o.geometry.setIndex(null);
        }
        if (o.geometry) geometries.add(o.geometry);
        for (const m of mats(o)) materials.add(m);
        if (o.isInstancedMesh) instances.add(o);
    });
    for (const m of keepMaterial) for (const t of Object.values(m)) if (t?.isTexture) keepTexture.add(t);
    // Environment and mirror targets are renderer/player owned, never material-owned textures.
    for (const m of materials) if (!keepMaterial.has(m)) {
        for (const [key, t] of Object.entries(m)) if (t?.isTexture && key !== 'envMap' && !t.isRenderTargetTexture) textures.add(t);
        for (const t of m.userData.ownedTextures || []) if (t?.isTexture && !t.isRenderTargetTexture) textures.add(t);
        if (m.userData.waterU) disposeWater(m); else m.dispose();
    }
    for (const t of textures) if (!keepTexture.has(t)) t.dispose();
    for (const g of geometries) if (!keepGeometry.has(g)) g.dispose();
    for (const mesh of instances) mesh.dispose(); // instanceMatrix/instanceColor are not geometry attributes
    // Break parent/child and onBeforeRender closures after releasing GL resources.
    scene.clear(); scene.environment = null;
}
