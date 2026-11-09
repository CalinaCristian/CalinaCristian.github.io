from pathlib import Path
import xml.etree.ElementTree as ET
import json,math,heapq,hashlib
base=Path('/workspace/reality-pass/grozavesti/tiles');nodes={};ways={};restrictions={};files=[];fuelways={}
for file in sorted(base.glob('*.xml')):
 files.append({'path':str(file),'sha256':hashlib.sha256(file.read_bytes()).hexdigest()})
 for _,e in ET.iterparse(file,events=['end']):
  if e.tag=='node':
   nodes[int(e.attrib['id'])]=(float(e.attrib['lat']),float(e.attrib['lon']),{t.attrib['k']:t.attrib['v']for t in e.findall('tag')});e.clear()
  elif e.tag=='way':
   tags={t.attrib['k']:t.attrib['v']for t in e.findall('tag')}
   if tags.get('amenity')=='fuel':fuelways[int(e.attrib['id'])]={'id':int(e.attrib['id']),'nodes':[int(n.attrib['ref'])for n in e.findall('nd')],'tags':tags}
   if 'highway'in tags:ways[int(e.attrib['id'])]={'id':int(e.attrib['id']),'nodes':[int(n.attrib['ref'])for n in e.findall('nd')],'tags':tags}
   e.clear()
  elif e.tag=='relation':
   t={p.attrib['k']:p.attrib['v']for p in e.findall('tag')}
   if t.get('type')=='restriction':restrictions[int(e.attrib['id'])]={'id':int(e.attrib['id']),'tags':t,'members':[dict(m.attrib)for m in e.findall('member')]}
   e.clear()
classes={'motorway','motorway_link','trunk','trunk_link','primary','primary_link','secondary','secondary_link','tertiary','tertiary_link','unclassified','residential','living_street','service'}
allow={'yes','designated','permissive','discouraged','destination','customers'};adj={};rejected=[]
def legal(t):
 mode=next((k for k in ['motorcar','motor_vehicle','vehicle','access']if t.get(k,'').strip()),None);v=t[mode].strip().lower()if mode else None
 if v is not None and v not in allow:return False
 if v in {'destination','customers'}or t.get('service')in{'parking_aisle','drive-through'}:return False
 if any(k in t for k in ['motorcar:conditional','motor_vehicle:conditional','vehicle:conditional','access:conditional']):return False
 if t.get('oneway')=='reversible'or t.get('hov')=='designated':return False
 if t.get('service')=='emergency_access'and mode not in ['motorcar','motor_vehicle']:return False
 return True
for w in ways.values():
 t=w['tags']
 if t['highway']not in classes or not legal(t):continue
 ids=w['nodes'];ow=t.get('oneway')in{'yes','true','1','-1'}or(t.get('junction')in{'roundabout','circular'}and t.get('oneway')!='no')or(t['highway']in{'motorway','motorway_link'}and t.get('oneway')!='no')
 if t.get('oneway')=='-1':ids=ids[::-1]
 for a,b in zip(ids,ids[1:]):
  if a not in nodes or b not in nodes:continue
  pa,pb=nodes[a],nodes[b];distance=math.hypot((pa[0]-pb[0])*111132,(pa[1]-pb[1])*79479.07183661079)
  adj.setdefault(a,[]).append((b,w['id'],distance))
  if not ow:adj.setdefault(b,[]).append((a,w['id'],distance))
via={};unsupported=[]
for r in restrictions.values():
 t=r['tags'];rt=t.get('restriction:motorcar')or t.get('restriction:motor_vehicle')or t.get('restriction')
 if not rt:continue
 if any(v.strip()in{'motorcar','motor_vehicle','vehicle'}for v in t.get('except','').split(';')):continue
 f=[m for m in r['members']if m['role']=='from'and m['type']=='way'];v=[m for m in r['members']if m['role']=='via'];to=[m for m in r['members']if m['role']=='to'and m['type']=='way']
 if len(f)==len(v)==len(to)==1 and v[0]['type']=='node':via.setdefault(int(v[0]['ref']),[]).append((int(f[0]['ref']),int(to[0]['ref']),rt,r['id']))
 else:unsupported.append(r)
def route(start,goal,startway,nonservice=False):
 initial=(start,startway,-1);dist={initial:0};heap=[(0,initial)];prev={};final=None
 while heap:
  d,s=heapq.heappop(heap)
  if d!=dist[s]:continue
  node,inway,prevnode=s
  if node==goal:final=s;break
  for nxt,way,L in adj.get(node,[]):
   if nxt==prevnode:continue # no invented immediate U-turn
   if nonservice and ways[way]['tags']['highway']=='service':continue
   denied=False
   for fr,to,kind,rid in via.get(node,[]):
    if fr==inway and((kind.startswith('no_')and kind!='no_u_turn'and way==to)or(kind.startswith('only_')and way!=to)):denied=True
   if denied:continue
   ns=(nxt,way,node);nd=d+L
   if nd<dist.get(ns,math.inf):dist[ns]=nd;prev[ns]=(s,L);heapq.heappush(heap,(nd,ns))
 if final is None:return{'reachable':False,'visitedStates':len(dist)}
 path=[];s=final
 while s!=initial:
  p,L=prev[s];path.append({'from':p[0],'to':s[0],'way':'w'+str(s[1]),'length':L,'fromLL':nodes[p[0]][:2],'toLL':nodes[s[0]][:2],'tags':ways[s[1]]['tags']});s=p
 path.reverse();used={int(p['way'][1:])for p in path};unsupported_touch=[r for r in unsupported if any(m['type']=='way'and int(m['ref'])in used for m in r['members'])];return{'reachable':True,'metres':dist[final],'legs':path,'visitedStates':len(dist),'unsupportedRestrictionsTouchingRoute':unsupported_touch}

# Exact original source-node endpoints of native Doina Cornea edges66/164 and target479.
routes=[{'label':'northbound-Doina-e164','start':6570499865,'goal':3001224269,'initialWay':277315765},{'label':'southbound-Doina-e66','start':6809278847,'goal':3001224269,'initialWay':80013062}]
for r in routes:
 r['route']=route(r['start'],r['goal'],r['initialWay']);r['nonserviceRoute']=route(r['start'],r['goal'],r['initialWay'],True)
fuel=[{'id':'n'+str(i),'lat':p[0],'lon':p[1],'tags':p[2]}for i,p in nodes.items()if p[2].get('amenity')=='fuel'and 'lukoil'in str(p[2]).lower()]
fuel += [{'id':'w'+str(i),'nodes':w['nodes'],'tags':w['tags'],'nodeLL':[nodes[n][:2]for n in w['nodes']if n in nodes]}for i,w in fuelways.items()if 'lukoil'in str(w['tags']).lower()]
report={'scope':'Cached raw OSM directed public motor-road connectivity; exact node joins only, conservative access, no immediate U-turn, via-node restrictions applied. Not a full source turn/grade/collision certificate; unsupported via-way restrictions are retained for explicit review. No production/source/graph edits.','files':files,'nodes':len(nodes),'ways':len(ways),'viaNodeRestrictions':sum(map(len,via.values())),'unsupportedRestrictions':unsupported,'Lukoil':fuel,'routes':routes}
Path('/workspace/reality-pass/groz-lukoil-nav/raw-osm-routes.json').write_text(json.dumps(report,indent=2)+'\n')
for r in routes:
 x=r['route'];print(json.dumps({'label':r['label'],'reachable':x['reachable'],'metres':x.get('metres'),'ways':list(dict.fromkeys(p['way']for p in x.get('legs',[])))}))
print('Lukoil',fuel)
