from pathlib import Path
import subprocess,json,re,posixpath,urllib.parse,collections,argparse
parser=argparse.ArgumentParser(description='Read-only active runtime/overview/evidence local target audit against a pinned source tree. Run measure-jekyll-payload.py first.')
parser.add_argument('--root',type=Path,default=Path.cwd());parser.add_argument('--source',default='HEAD');parser.add_argument('--out',type=Path,required=True);args=parser.parse_args();root=args.root.resolve();sha=subprocess.check_output(['git','-C',str(root),'rev-parse',args.source+'^{commit}'],text=True).strip();report=json.load(open(args.out/'measurement.json'));assert report['sourceCommit']==sha;published=set(json.load(open(args.out/'published-paths.json')))
objects={}
for line in subprocess.check_output(['git','-C',str(root),'ls-tree','-rlz',sha]).split(b'\0'):
 if line:
  m,p=line.split(b'\t'); mode,kind,obj,n=m.split();objects[p.decode()]=(obj.decode(),int(n))
proc=subprocess.Popen(['git','-C',str(root),'cat-file','--batch'],stdin=subprocess.PIPE,stdout=subprocess.PIPE);cache={}
def read(p):
 if p not in cache:
  obj,n=objects[p];proc.stdin.write((obj+'\n').encode());proc.stdin.flush();head=proc.stdout.readline();raw=proc.stdout.read(n);proc.stdout.read(1);cache[p]=raw.decode('utf-8','replace')
 return cache[p]
def data(p):return json.loads(read(p))
def target(base,value):
 if not isinstance(value,str) or not value or value.startswith(('#','mailto:','tel:','data:','blob:')):return None
 u=urllib.parse.urlparse(value)
 if u.scheme or u.netloc:return None
 path=urllib.parse.unquote(u.path)
 if not path:return None
 p=posixpath.normpath(path.lstrip('/') if path.startswith('/') else posixpath.join(posixpath.dirname(base),path))
 if p=='.':p=''
 if p not in objects and (p+'/index.html').lstrip('/') in objects:p=(p+'/index.html').lstrip('/')
 return p
refs=[]
def add(base,value,kind):
 p=target(base,value)
 if p:refs.append({'from':base,'to':p,'kind':kind,'exists':p in objects or any(q.startswith(p+'/')for q in objects),'published':p in published or any(q.startswith(p+'/')for q in published)})
# Static local module imports/exports and literal URLs. Dynamic district/spot/globe data enumerated below.
codefiles=[p for p in published if p.endswith('.js') and (p.startswith('game/src/')or p.startswith('game/overview/') and '/comparison-data/' not in p or p in ['index.js','canvas.js','public/telemetry.js'])]
for p in codefiles:
 s=re.sub(r'(?m)^\s*//.*$', '', read(p))
 for pat in [r'\b(?:import|export)\s+(?:[^;]*?\s+from\s*)?[\'\"](\.[^\'\"]+)[\'\"]',r'\bimport\s*\(\s*[\'\"](\.[^\'\"]+)[\'\"]',r'\bnew\s+URL\(\s*[\'\"]([^\'\"]+)[\'\"]\s*,\s*import\.meta\.url']:
  for v in re.findall(pat,s):add(p,v,'module-or-literal-url')
for p in ['index.html','game/index.html','game/overview/index.html']:
 for v in re.findall(r'\b(?:src|href)=[\'\"]([^\'\"]+)[\'\"]',read(p)):add(p,v,'html-url')
for p in ['index.css','game/style.css','game/overview/style.css']:
 if p in objects:
  for v in re.findall(r'url\([\'\"]?([^\)\'\"]+)',read(p)):add(p,v,'css-url')
# Every data asset for parameterised world/spot/globe loaders must remain published.
dynamic=[p for p in objects if p.startswith('game/data/')]; assert all(p in published for p in dynamic)
# Actual comparison viewer graph: current/history manifests and images; perspective/street manifests and images.
cat='game/overview/comparison-data/catalog.json'; inv='game/overview/inventory.json';manifestseen=set(); counts=collections.Counter()
def manifest(p,kind):
 if p in manifestseen:return
 manifestseen.add(p);counts[kind+'Manifests']+=1;d=data(p)
 for i in d.get('items',[]):
  for key in ['image','thumbnail']:
   if i.get(key):add(p,i[key],kind+'-'+key);counts[kind+'-'+key]+=1
 for coll in d.get('historicalCollections',[]) if kind=='current' else []:
  if coll.get('manifest'):
   add(p,coll['manifest'],'historical-manifest');manifest(target(p,coll['manifest']),'historical')
 for coll in d.get('perspectiveCollections',[]) if kind=='current' else []:
  if coll.get('manifest'):
   add(p,coll['manifest'],'perspective-manifest');manifest(target(p,coll['manifest']),'perspective')
 if kind=='current' and d.get('streetWalk',{}).get('manifest'):
  add(p,d['streetWalk']['manifest'],'street-walk-manifest');manifest(target(p,d['streetWalk']['manifest']),'street-walk')
for place in data(cat)['locations']:add(cat,place['manifest'],'current-manifest');manifest(target(cat,place['manifest']),'current')
# Evidence image/report paths resolve from overview document, not JSON-record subdirectory.
base='game/overview/index.html'; evidencefiles=[];nativeproofs=[]
for category in ['landmarks','spots']:
 for item in data(inv)[category]:
  if item.get('evidence'):
   add(base,item['evidence'],'evidence-record');p=target(base,item['evidence']);evidencefiles.append(p);d=data(p)
   for c in d.get('captures',[]):add(base,c['image'],'evidence-current-image')
   for h in d.get('historicalCollections',[]):
    for c in h.get('captures',[]):add(base,c['image'],'evidence-history-image')
   for proof in d.get('nativeProofs',[]):
    if proof.get('report'):add(base,proof['report'],'evidence-native-report');nativeproofs.append(target(base,proof['report']))
candidates=['handoffs/fidelity/pipera-fidelity','handoffs/fidelity/original-districts-refresh','handoffs/fidelity/integration-final-acceptance','handoffs/fidelity/us-districts']; sums=[]
for path in candidates:
 matches=[p for p in published if p==path or p.startswith(path+'/')]; consumers=[r for r in refs if r['to']==path or r['to'].startswith(path+'/')]; sums.append({'path':path,'files':len(matches),'bytes':sum(objects[p][1]for p in matches),'actualConsumerReferences':consumers})
nonpublished=[r for r in refs if not r['published']]; bad=[r for r in nonpublished if r['to'] in objects];missing=[r for r in nonpublished if r['to'] not in objects]
# Literal root-relative source-path strings inside manifests are ledger provenance, not runtime fetch/href values.
strings=[]
def walk(v,keys=()):
 if isinstance(v,dict):
  for k,q in v.items():yield from walk(q,keys+(k,))
 elif isinstance(v,list):
  for i,q in enumerate(v):yield from walk(q,keys+(str(i),))
 elif isinstance(v,str):yield keys,v
for p in evidencefiles+list(manifestseen):
 for keys,v in walk(data(p)):
  if not v.startswith('https://') and any(v.startswith(c+'/')for c in candidates):strings.append({'file':p,'field':'.'.join(keys),'value':v})
md=[]
for r in report['publishedMarkdownFiles']:
 p=r['path'];s=read(p);hasfm=bool(re.match(r'^(?:\ufeff)?---\s*\n',s));b=posixpath.basename(p).rsplit('.',1)[0].upper();black=b in ['README','LICENSE','LICENCE','COPYING','CODE_OF_CONDUCT','CONTRIBUTING','ISSUE_TEMPLATE','PULL_REQUEST_TEMPLATE'];md.append({'path':p,'bytes':r['bytes'],'frontMatter':hasfm,'blacklist':black})
removed=sum(s['bytes']for s in sums); files=sum(s['files']for s in sums)
result={'sourceCommit':sha,'scope':'Read-only static source/metadata dependency audit; no browser/network reference pixels. Source-archive payload totals exclude generated Markdown/theme output.','checkedCodeFiles':len(codefiles),'dynamicDataFilesRetained':len(dynamic),'checkedLocalReferences':len(refs),'uniqueLocalTargets':len(set(r['to']for r in refs)),'excludedActualTargets':bad,'unresolvedLiteralTargets':missing,'comparisonCounts':counts,'evidenceRecords':len(evidencefiles),'nativeProofReportTargets':nativeproofs,'candidates':sums,'candidateRawProvenanceOnlyStrings':strings,'removedBytes':removed,'removedFiles':files,'remainingSourcePayloadBytes':report['publishedBytes']-removed,'remainingSourcePayloadFiles':report['publishedFiles']-files,'remainingSourcePayloadMiB':(report['publishedBytes']-removed)/2**20,'markdownInputFiles':md,'threeDirectoryExclusions':{'removedBytes':sum(v['bytes'] for v in sums[:3]),'removedFiles':sum(v['files']for v in sums[:3]),'remainingSourcePayloadBytes':report['publishedBytes']-sum(v['bytes'] for v in sums[:3])}}
(args.out/'dependency-audit.json').write_text(json.dumps(result,indent=2)+'\n');proc.terminate()
print(json.dumps({k:v for k,v in result.items()if k not in ['markdownInputFiles','nativeProofReportTargets','candidateRawProvenanceOnlyStrings']},indent=2));print('native proof count',len(nativeproofs));print('raw provenance strings',strings);print('markdown',len(md),'frontmatter',sum(d['frontMatter']for d in md),'blacklisted',sum(d['blacklist']for d in md))
