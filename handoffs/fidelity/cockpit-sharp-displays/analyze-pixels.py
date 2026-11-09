#!/usr/bin/env python3
"""Offline same-frame byte checks; never generates/relabels native captures."""
import json, pathlib, sys
import numpy as np
from PIL import Image
base=pathlib.Path(sys.argv[1]); report=json.loads((base/sys.argv[2]).read_text())
rows=report.get('rows') or [report[k] for k in ['native','occluder'] if k in report]
results=[]
for row in rows:
 before=np.array(Image.open(base/(row['label']+'-before.png')).convert('RGBA'))
 after=np.array(Image.open(base/(row['label']+'-after.png')).convert('RGBA'))
 assert before.shape==after.shape
 changed=np.any(before!=after,axis=2)
 p=row['nativeOccludedPixels']; mask=np.zeros((p['height'],p['width']),bool)
 mask.flat[p['indices']]=True
 # Exclude the two world-pixel boundary where coarse depth/MSAA coverage is ambiguous.
 interior=mask.copy()
 for dy in range(-2,3):
  for dx in range(-2,3):
   shifted=np.zeros_like(mask)
   y0=max(0,dy);y1=min(mask.shape[0],mask.shape[0]+dy)
   x0=max(0,dx);x1=min(mask.shape[1],mask.shape[1]+dx)
   shifted[y0:y1,x0:x1]=mask[y0-dy:y1-dy,x0-dx:x1-dx]
   interior &= shifted
 yy=np.minimum((np.arange(before.shape[0])*p['height']/before.shape[0]).astype(int),p['height']-1)
 xx=np.minimum((np.arange(before.shape[1])*p['width']/before.shape[1]).astype(int),p['width']-1)
 high=interior[yy[:,None],xx[None,:]]
 result={'label':row['label'],'outputWidth':before.shape[1],'outputHeight':before.shape[0],'changedPixels':int(changed.sum()),'coarseProtectedPixels':int(mask.sum()),'interiorProtectedOutputPixels':int(high.sum()),'changedInteriorProtectedPixels':int((changed&high).sum()),'worldPixelBoundaryInset':2}
 results.append(result)
 assert result['interiorProtectedOutputPixels']>0
 assert result['changedInteriorProtectedPixels']==0
print(json.dumps({'sourceReport':sys.argv[2],'scope':'Offline original same-frame RGBA comparison on native depth-protected interiors, two coarse world-pixel boundary inset. No browser rerun.','rows':results},indent=2))
