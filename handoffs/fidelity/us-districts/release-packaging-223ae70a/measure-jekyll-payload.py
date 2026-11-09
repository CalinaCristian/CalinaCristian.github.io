import subprocess,collections,json,fnmatch,posixpath,argparse,shutil,re
from pathlib import Path
parser=argparse.ArgumentParser(description='Read-only tracked payload estimate under GitHub Pages Jekyll3.10 entry rules; not a rendered build.')
parser.add_argument('--root',type=Path,default=Path.cwd());parser.add_argument('--source',default='HEAD');parser.add_argument('--out',type=Path,required=True);args=parser.parse_args();root=args.root.resolve();args.out.mkdir(parents=True,exist_ok=True)
sha=subprocess.check_output(['git','-C',str(root),'rev-parse',args.source+'^{commit}'],text=True).strip(); rows=[]
for line in subprocess.check_output(['git','-C',str(root),'ls-tree','-rlz',sha]).split(b'\0'):
 if not line:continue
 meta,p=line.split(b'\t');mode,kind,obj,n=meta.split();rows.append({'path':p.decode(),'bytes':int(n),'object':obj.decode(),'mode':mode.decode()})
# Jekyll3.10's config arrays replace defaults. No Gemfile/node_modules/vendor defaults are present in this tree either way.
config=subprocess.check_output(['git','-C',str(root),'show',sha+':_config.yml'],text=True)
# Current audited config uses plain YAML sequence values. Reject unsupported include/custom generator settings rather than silently assuming them.
def seq(name):
 result=[];active=False
 for line in config.splitlines():
  if re.match(r'^'+re.escape(name)+r':\s*(?:#.*)?$',line):active=True;continue
  if active and line and not line[0].isspace() and not line.startswith('#'):break
  if active:
   m=re.match(r'\s+-\s+([^#]+)',line)
   if m:result.append(m.group(1).strip().strip('\"\''))
 return result
assert not seq('include'), 'Custom include list requires review of the include-before-exclude ordering'
explicit=seq('exclude'); default=['Gemfile','Gemfile.lock','node_modules','vendor/bundle/','vendor/cache/','vendor/gems/','vendor/ruby/']
def reason(path):
 for component in path.split('/'):
  if component!='.htaccess' and component[0] in '._#~':return 'special-leading-character'
  if component.endswith('~'):return 'backup-file'
 for p in (explicit if 'exclude:' in config else default):
  if path.startswith(p):return 'explicit:'+p
 return None
published=[]; omitted=[]
for r in rows:
 r['excludedReason']=reason(r['path']);(omitted if r['excludedReason'] else published).append(r)
def dirs(data,depth):
 out=collections.defaultdict(lambda:{'files':0,'bytes':0})
 for row in data:
  p='/'.join(row['path'].split('/')[:depth]);out[p]['files']+=1;out[p]['bytes']+=row['bytes']
 return [{'path':p,**v,'MiB':round(v['bytes']/2**20,3)}for p,v in sorted(out.items(),key=lambda v:-v[1]['bytes'])]
report={'sourceCommit':sha,'method':'Git tracked blob sizes and Jekyll3.10 EntryFilter/configuration rules; source payload prediction, not a rendered Jekyll build. No Jekyll/Ruby installed.','allFiles':len(rows),'allBytes':sum(r['bytes']for r in rows),'publishedFiles':len(published),'publishedBytes':sum(r['bytes']for r in published),'excludedFiles':len(omitted),'excludedBytes':sum(r['bytes']for r in omitted),'largestPublishedDirectories':{str(n):dirs(published,n)[:15]for n in [1,2,3,4]},'exclusions':[],'publishedMarkdownFiles':[r for r in published if r['path'].lower().endswith(('.md','.markdown','.mkd','.mkdown','.mkdn'))],'over100MiB':[r for r in rows if r['bytes']>100*2**20],'largestFiles':sorted(published,key=lambda r:-r['bytes'])[:15]}
for key in sorted(set(r['excludedReason']for r in omitted)):
 data=[r for r in omitted if r['excludedReason']==key];report['exclusions'].append({'reason':key,'files':len(data),'bytes':sum(r['bytes']for r in data)})
(args.out/'measurement.json').write_text(json.dumps(report,indent=2)+'\n');(args.out/'published-paths.json').write_text(json.dumps([r['path']for r in published]));
for k in ['allFiles','allBytes','publishedFiles','publishedBytes','excludedFiles','excludedBytes']:print(k,report[k])
print('publishedMiB',report['publishedBytes']/2**20,'margin1GiB',2**30-report['publishedBytes'],'overdecimalGB',report['publishedBytes']-10**9)
print('exclusions',report['exclusions']);print('largest directory tables recorded in measurement.json');print('md',len(report['publishedMarkdownFiles']),sum(r['bytes']for r in report['publishedMarkdownFiles']))
