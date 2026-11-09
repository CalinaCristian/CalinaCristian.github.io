import * as THREE from '../vendor/three.module.min.js';

function vector(value,name){const p=value?.isVector3?value.clone():Array.isArray(value)&&value.length===3?new THREE.Vector3(...value):null;if(!p||![p.x,p.y,p.z].every(Number.isFinite))throw new TypeError(name+' must be a finite world-space Vector3 or [x,y,z]');return p;}
/**
 * Configure a dedicated, unparented capture camera from WORLD-space source
 * facade corners, ordered as seen from the interior eye. No geographic/floor
 * selection, geometry hiding, world creation or simulation occurs here.
 * The near plane sits just OUTSIDE that actual outer facade plane. A caller
 * must supply the genuine outer plane, not an arbitrary plane beyond a wall.
 */
export function configureOffAxisWindow(camera,{eye,lowerLeft,lowerRight,upperLeft,far,clipOutsideFacadeM=.02}){
 if(!camera?.isPerspectiveCamera||camera.parent)throw new TypeError('Use a dedicated unparented PerspectiveCamera');
 if(!Number.isFinite(clipOutsideFacadeM)||clipOutsideFacadeM<0||clipOutsideFacadeM>.1)throw new RangeError('Facade clip offset must be between 0 and 0.1 source metres');
 const pe=vector(eye,'eye'),pa=vector(lowerLeft,'lowerLeft'),pb=vector(lowerRight,'lowerRight'),pc=vector(upperLeft,'upperLeft');
 const right=pb.clone().sub(pa),up=pc.clone().sub(pa),width=right.length(),height=up.length();
 if(width<1e-5||height<1e-5)throw new RangeError('Source window has a degenerate edge');right.divideScalar(width);up.divideScalar(height);
 if(Math.abs(right.dot(up))>1e-6)throw new RangeError('Source corners must describe an orthogonal rectangular window');
 const normal=right.clone().cross(up).normalize(),va=pa.clone().sub(pe),vb=pb.clone().sub(pe),vc=pc.clone().sub(pe),distance=-va.dot(normal);
 if(!Number.isFinite(distance)||distance<=.001)throw new RangeError('Eye must remain on the interior side of the oriented source facade');
 const near=distance+clipOutsideFacadeM;
 if(!Number.isFinite(far)||far<=near+.01)throw new RangeError('Source-world far plane must exceed the facade clipping plane');
 const left=right.dot(va)*near/distance,r=right.dot(vb)*near/distance,bottom=up.dot(va)*near/distance,top=up.dot(vc)*near/distance;
 camera.position.copy(pe);camera.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(right,up,normal));camera.scale.set(1,1,1);camera.near=near;camera.far=far;
 camera.aspect=width/height;camera.fov=(Math.atan(top/near)-Math.atan(bottom/near))*180/Math.PI;
 camera.updateMatrixWorld(true);camera.projectionMatrix.makePerspective(left,r,top,bottom,near,far,THREE.WebGLCoordinateSystem);camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
 return{width,height,planeDistance:distance,near,far,frustum:{left,right:r,bottom,top},normalTowardEye:normal.toArray(),clipOutsideFacadeM};
}
