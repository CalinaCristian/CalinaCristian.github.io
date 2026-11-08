from pathlib import Path
from PIL import Image,ImageDraw,ImageStat
import json,sys,math,hashlib,collections
out=Path(sys.argv[1]);rows=json.loads((out/(sys.argv[2]if len(sys.argv)>2 else'camera-poses.json')).read_text());sheets=out/('review-sheets-progress'if len(sys.argv)>2 else'review-sheets');sheets.mkdir(exist_ok=True);fail=[];pairs=18
for st in range(0,len(rows),pairs):
 subset=rows[st:st+pairs];sheet=Image.new('RGB',(1920,math.ceil(len(subset)/3)*245),'#16191d');dr=ImageDraw.Draw(sheet)
 for k,row in enumerate(subset):
  x=k%3*640;y=k//3*245
  for col,key in enumerate(['game','sv']):
   f=out/row[key] if row.get(key) else None
   if not f or not f.exists():fail.append({'id':row['id'],'missing':key});continue
   im=Image.open(f).convert('RGB');im.load()
   if max(ImageStat.Stat(im).stddev)<2:fail.append({'id':row['id'],'blank':key})
   im.thumbnail((320,200),Image.Resampling.LANCZOS);sheet.paste(im,(x+col*320,y+45))
  text=row['id'][:58]+(' ALTITUDE?'if row.get('cameraLevelAmbiguity')else'')
  dr.text((x+4,y+3),text,fill='#ffa55f'if row.get('cameraLevelAmbiguity')else'white');dr.text((x+4,y+16),str(row.get('date'))+' '+row.get('comparisonSeason','')+' src '+row.get('sourceRoadId','')+' layer '+str(row.get('sourceLayer')),fill='#b4cbd7');dr.text((x+4,y+30),'GAME                                                GOOGLE COMPARISON ONLY',fill='#9ab29b')
 sheet.save(sheets/f'walk-{st//pairs+1:03d}.jpg',quality=91)
report={'viewPairs':len(rows),'sheets':math.ceil(len(rows)/pairs),'uniquePanoramas':len({r['pano']for r in rows}),'cameraLevelAmbiguities':sum(bool(r.get('cameraLevelAmbiguity'))for r in rows),'seasonCounts':dict(collections.Counter(r.get('captureSettings',{}).get('appliedSeason')for r in rows)),'dateCounts':dict(collections.Counter(r.get('date')for r in rows)),'failures':fail,'reviewStatus':'Generated contact sheets only; human visual inspection is separate.'};(out/'image-integrity.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))
