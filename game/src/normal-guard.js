// Degenerate generated normals must remain finite in lit and normal-only passes.
// MeshNormalMaterial does not declare vViewPosition in its smooth, untextured variant.
export function installNormalGuard(THREE) {
    const C=THREE.ShaderChunk,N=THREE.ShaderLib.normal;
    if(C.normal_fragment_begin.includes('vNormalGuardViewPosition'))return;
    N.vertexShader='varying vec3 vNormalGuardViewPosition;\n'+N.vertexShader.replace('#include <project_vertex>','#include <project_vertex>\nvNormalGuardViewPosition = -mvPosition.xyz;');
    N.fragmentShader='varying vec3 vNormalGuardViewPosition;\n'+N.fragmentShader;
    C.normal_fragment_begin=C.normal_fragment_begin.replace('vec3 normal = normalize( vNormal );',`
        #ifdef NORMAL
            vec3 normal = dot(vNormal,vNormal)>1e-12 ? normalize(vNormal) : normalize(cross(dFdx(vNormalGuardViewPosition),dFdy(vNormalGuardViewPosition))+1e-9);
        #else
            vec3 normal = dot(vNormal,vNormal)>1e-12 ? normalize(vNormal) : normalize(cross(dFdx(vViewPosition),dFdy(vViewPosition))+1e-9);
        #endif
    `);
}
