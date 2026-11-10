import * as THREE from '../vendor/three.module.min.js';

/** Compact existing far instances before WebGL's object upload. Source records
 * retain their canonical matrices/colours; no geometry, tree or buffer is added
 * or removed. These batches are main-view-only and never cast shadows. */
export function treeViewSelection(batches) {
    const projection=new THREE.Matrix4(),inverse=new THREE.Matrix4(),view=new THREE.Matrix4(),frustum=new THREE.Frustum(),matrix=new THREE.Matrix4(),sphere=new THREE.Sphere();
    let ready=false,dirty=true;
    for(const b of batches){
        const m=b.mesh,g=m.geometry;if(!g.boundingSphere)g.computeBoundingSphere();
        b.bounds=new Float64Array(b.records.length*4);b.selected=new Uint32Array(b.records.length);b.count=-1;
        b.world=new THREE.Matrix4();b.world.elements.fill(NaN);
        b.debug=m.userData.treeView={sourceInstances:b.records.length,visibleInstances:b.records.length,updates:0};
    }
    const invalidate=()=>{dirty=true;};
    const update=camera=>{
        if(!camera?.isCamera)return;
        camera.updateWorldMatrix(true,false);
        const changed=!ready||!projection.equals(camera.projectionMatrix)||!inverse.equals(camera.matrixWorldInverse);
        if(!changed&&!dirty&&batches.every(b=>b.world.equals(b.mesh.matrixWorld)))return;
        projection.copy(camera.projectionMatrix);inverse.copy(camera.matrixWorldInverse);
        frustum.setFromProjectionMatrix(view.multiplyMatrices(projection,inverse),camera.coordinateSystem);ready=true;
        for(const b of batches){
            const m=b.mesh,worldChanged=!b.world.equals(m.matrixWorld);
            if(worldChanged){
                for(let i=0;i<b.records.length;i++){
                    sphere.copy(m.geometry.boundingSphere).applyMatrix4(matrix.multiplyMatrices(m.matrixWorld,b.records[i][b.mode]));
                    const k=i*4;b.bounds[k]=sphere.center.x;b.bounds[k+1]=sphere.center.y;b.bounds[k+2]=sphere.center.z;b.bounds[k+3]=sphere.radius+.01;
                }
                b.world.copy(m.matrixWorld);
            }
            // The original whole-batch sphere remains conservative after the
            // draw buffer is compacted; do not recompute it from a view subset.
            const batchVisible=!m.boundingSphere||frustum.intersectsSphere(sphere.copy(m.boundingSphere).applyMatrix4(m.matrixWorld));
            let count=0,selectionChanged=dirty||b.count<0;
            if(batchVisible)for(let i=0;i<b.records.length;i++){
                const r=b.records[i];if(r.near)continue;
                const k=i*4;sphere.center.set(b.bounds[k],b.bounds[k+1],b.bounds[k+2]);sphere.radius=b.bounds[k+3];
                if(!frustum.intersectsSphere(sphere))continue;
                if(b.selected[count]!==i)selectionChanged=true;b.selected[count++]=i;
            }
            if(count!==b.count)selectionChanged=true;
            if(selectionChanged){
                for(let i=0;i<count;i++){const r=b.records[b.selected[i]];m.setMatrixAt(i,r[b.mode]);if(m.instanceColor)m.setColorAt(i,r.c);}
                if(count){m.instanceMatrix.needsUpdate=true;if(m.instanceColor)m.instanceColor.needsUpdate=true;}
                b.count=count;m.count=count;b.debug.visibleInstances=count;b.debug.updates++;
            }
        }
        dirty=false;
    };
    return {update,invalidate};
}
