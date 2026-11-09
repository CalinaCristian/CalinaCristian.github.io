import json,sys
src,out,name=sys.argv[1:];D=json.load(open(src+'/game/data/bucharest-grozavesti.json'));RR=json.load(open(out+'/'+name+'.json'));R=RR.get('route',{}).get('legs',[]) if RR.get('route') else RR.get('legs',[]);hits=[];bad=[];unknown=[]
for i,(a,b) in enumerate(zip(R,R[1:])):
 n=a['b'] if a['dir']==1 else a['a'];n2=b['a'] if b['dir']==1 else b['b']
 if n!=n2:unknown.append({'kind':'source-node-discontinuity','index':i,'a':a,'b':b});continue
 if a['source']==b['source'] and a['dir']!=b['dir']:unknown.append({'kind':'immediate-source-way-reversal','index':i,'via':n,'source':a['source']})
 for q in D['roadRestrictions']:
  m=q['members'];fr=['w'+str(v['ref']) for v in m if v['type']=='way' and v['role']=='from'];to=['w'+str(v['ref']) for v in m if v['type']=='way' and v['role']=='to'];via=[v['ref'] for v in m if v['type']=='node' and v['role']=='via'];t=q['tags'];typ=t.get('restriction:motorcar',t.get('restriction:motor_vehicle',t.get('restriction')))
  if a['source'] not in fr or n not in via or not typ:continue
  if any(x in t.get('except','').split(';') for x in ['motorcar','motor_vehicle','vehicle']):continue
  x={'sourceId':q['sourceId'],'restriction':typ,'via':n,'from':a['source'],'to':b['source'],'allowedTo':to};hits.append(x)
  if any('conditional' in k for k in t):unknown.append(x)
  elif (typ.startswith('no_') and b['source'] in to) or (typ.startswith('only_') and b['source'] not in to):bad.append(x)
report={'scope':'Literal via-node motorcar restrictions for exact proposed source approach; other globalGPS paths are separate gates','routeMetres':RR.get('route',{}).get('total'),'applicable':hits,'violations':bad,'unknown':unknown};json.dump(report,open(out+'/'+name+'-restriction-audit.json','w'),indent=2);print(report)
