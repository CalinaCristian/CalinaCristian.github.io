/** Select existing lamp pools around the ground visible from a high camera.
 * Ground driving keeps its150m selection. No new lights, slots or intensities.
 * The finite horizon cap also handles an upward-looking inspection camera. */
export function lampViewCoverage(eye,direction,referenceY=0){
 const height=Math.max(0,eye.y-referenceY),t=Math.max(0,Math.min(1,(height-12)/33)),k=t*t*(3-2*t);
 const horizontal=Math.hypot(direction.x,direction.z),ahead=horizontal>1e-8?Math.min(450,height*horizontal/Math.max(.15,-direction.y))*k:0;
 return {x:eye.x+(horizontal?direction.x/horizontal*ahead:0),z:eye.z+(horizontal?direction.z/horizontal*ahead:0),range:150+Math.min(450,height*2)*k,aerial:k>0};
}
