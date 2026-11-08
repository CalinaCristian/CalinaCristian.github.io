#!/usr/bin/env python3
"""Private aerial calibration crops. Never copy reference output into git/public assets."""
import argparse, json, math, pathlib, random, sys
from PIL import Image, ImageDraw
p=argparse.ArgumentParser();p.add_argument('--scratch',required=True);p.add_argument('--district',required=True);p.add_argument('--repo',default='.');a=p.parse_args()
s=pathlib.Path(a.scratch)/a.district;sys.path.insert(0,str(pathlib.Path(a.repo)/'tools/aerial'))
from roofs import load_osm
meta=json.loads((s/'m18.json').read_text());measure=json.loads((s/'roofs-full.json').read_text())['roofs'];audit=json.loads((s/'baseline-audit.json').read_text());qual={r['osm'][1:]:r for r in audit if r['osm'].startswith('w')};nodes,ways=load_osm([str(s/'tiles')]);keys=sorted(set(measure)&set(qual),key=int)
rng=random.Random(20261108)
# 48 random plus explicit strata; every sample remains identified and its selection reason recorded.
selected=[]
def pick(pool,n,why):
 pool=[k for k in pool if k not in {k for k,_ in selected}];rng.shuffle(pool);selected.extend((k,why) for k in pool[:n])
pick(keys,48,'seeded random from complete source core/ring')
pick([k for k in keys if measure[k]['shape']=='unknown'],8,'uncertain/occluded')
pick([k for k in keys if measure[k]['shape'] in ['hipped','gabled']],8,'pitched prediction')
pick([k for k in keys if measure[k]['shape']=='flat'],8,'flat prediction')
pick([k for k in keys if qual[k].get('roofOSM')],4,'tagged roof control')
pick(sorted(keys,key=lambda k:-measure[k]['areaM2'])[:50],4,'large footprint control')
pick(keys,80-len(selected),'fill to 80 unique')
n=2**meta['z']*256
px=lambda la,lo:((lo+180)/360*n-meta['px0'],(1-math.asinh(math.tan(math.radians(la)))/math.pi)/2*n-meta['py0'])
im=Image.open(s/'m18.jpg').convert('RGB');out=s/'calibration';out.mkdir(exist_ok=True);records=[];sheets=[]
for start in range(0,len(selected),16):
 sheet=Image.new('RGB',(1280,1440),'#191919');draw=ImageDraw.Draw(sheet)
 for j,(key,why) in enumerate(selected[start:start+16]):
  refs,tags=ways[key];pts=[px(*nodes[r]) for r in refs if r in nodes];r=measure[key];cx=sum(x for x,y in pts)/len(pts);cy=sum(y for x,y in pts)/len(pts);span=max(72/meta['mPerPx'],max(x for x,y in pts)-min(x for x,y in pts)+20/meta['mPerPx'],max(y for x,y in pts)-min(y for x,y in pts)+20/meta['mPerPx']);b=(cx-span/2,cy-span/2,cx+span/2,cy+span/2);crop=im.crop(tuple(map(round,b))).resize((320,320));d=ImageDraw.Draw(crop);sc=320/span
  path=[((x-b[0])*sc,(y-b[1])*sc) for x,y in pts];d.line(path,fill='#ff3030',width=2)
  dx,dy=r['shift'][0]/meta['mPerPx'],-r['shift'][1]/meta['mPerPx'];d.line([((x+dx-b[0])*sc,(y+dy-b[1])*sc) for x,y in pts],fill='#ffff20',width=1)
  x,y=(j%4)*320,(j//4)*360;sheet.paste(crop,(x,y));draw.text((x+4,y+322),f'w{key} {qual[key]["zone"]} {r["areaM2"]}m2',fill='white');draw.text((x+4,y+336),f'{r["shape"]} c{r["conf"]} {r["colour"]} OSM:{tags.get("roof:shape","?")}',fill='white')
  records.append({'osm':'w'+key,'selection':why,'zone':qual[key]['zone'],'sheet':f'roof-sheet-{start//16+1:02}.jpg','cell':j,'measurement':r,'osmRoofTags':{k:v for k,v in tags.items() if k.startswith('roof:')},'review':'pending'})
 fn=f'roof-sheet-{start//16+1:02}.jpg';sheet.save(out/fn,quality=92);sheets.append(fn)
(out/'sample.json').write_text(json.dumps({'district':a.district,'seed':20261108,'count':len(records),'source':'Esri World Imagery; OSM tags win; red source/yellow measurement registration','referencePublication':'private comparison/calibration only','sheets':sheets,'records':records},indent=2)+'\n')
print(a.district,len(records),'calibration crops',out)
