"""Reclaim ONLY this worker's verified checkout duplicates; keep Git and originals."""
import pathlib,subprocess,hashlib,json,gzip,datetime,os,stat
ROOT=pathlib.Path('/workspace/fidelity-workers/old-town-nightlife');OUT=ROOT/'handoffs/fidelity/old-town-worker-disk-relief-20261109'
SOURCE='31ed79e0d89ef131a701b1c7ec04c0155f64f18b';REF='refs/fidelity/retained-worker-source/old-town-before-sparse-31ed79e0';TARGETS=['game/data','game/overview/comparison-data']
def git(*args,input=None):return subprocess.check_output(['git',*args],cwd=ROOT,input=input)
def sha_file(p):
 h=hashlib.sha256()
 with p.open('rb') as f:
  for b in iter(lambda:f.read(1024*1024),b''):h.update(b)
 return h.hexdigest()
def stamp():return datetime.datetime.now(datetime.timezone.utc).isoformat()
def scan():
 own=set();pid=os.getpid()
 while pid and pid not in own:
  own.add(pid)
  try:pid=int(next(l.split()[1] for l in pathlib.Path(f'/proc/{pid}/status').read_text().splitlines() if l.startswith('PPid:')))
  except (FileNotFoundError,PermissionError,StopIteration):break
 matches=[]
 for p in pathlib.Path('/proc').iterdir():
  if not p.name.isdigit() or int(p.name) in own:continue
  try:
   cwd=os.readlink(p/'cwd');argv=(p/'cmdline').read_bytes().replace(b'\0',b' ').decode(errors='replace');fds=[]
   for fd in (p/'fd').iterdir():
    try:
     dest=os.readlink(fd)
     if any(dest.startswith(str(ROOT/t)+'/') for t in TARGETS):fds.append(dest)
    except (FileNotFoundError,PermissionError):pass
   if cwd.startswith(str(ROOT)) or str(ROOT) in argv or fds:matches.append({'pid':int(p.name),'cwd':cwd,'argv':argv,'targetFileDescriptors':fds})
  except (FileNotFoundError,PermissionError,ProcessLookupError):pass
 return {'atUTC':stamp(),'nonAuditReaders':matches,'excludedOwnAuditAncestorIds':sorted(own)}
def target_du():return {p:int(subprocess.check_output(['du','-B1','-s',str(ROOT/p)]).split()[0]) for p in TARGETS}
def free_bytes():s=os.statvfs(ROOT);return s.f_bavail*s.f_frsize
verification=json.loads((OUT/'verification.json').read_text());manifest=OUT/verification['manifest'];assert sha_file(manifest)==verification['manifestSHA256']
assert git('rev-parse','HEAD').decode().strip()==SOURCE and git('rev-parse',REF).decode().strip()==SOURCE
assert git('status','--porcelain','--untracked-files=no').strip()==b''
remote=git('ls-remote','--heads','origin','fidelity/backgammon-result-confirmation-20261109').decode().strip();assert remote.split()[0]==SOURCE
before=scan();assert not before['nonAuditReaders'],before
rows=[];preserved=[]
with gzip.open(manifest,'rt') as f:
 for line in f:
  row=json.loads(line);relative=pathlib.PurePosixPath(row['path']);assert not relative.is_absolute() and '..' not in relative.parts and any(row['path'].startswith(t+'/') for t in TARGETS)
  p=ROOT/row['path'];canonical=pathlib.Path(row['canonicalOriginal'])
  assert p.resolve().is_relative_to(ROOT.resolve())
  if not p.is_file() or p.is_symlink() or not canonical.is_file():preserved.append({'path':row['path'],'reason':'No longer regular local/canonical'});continue
  s=p.stat();c=canonical.stat()
  if s.st_nlink!=1 or (s.st_size,s.st_mtime_ns)!=(row['bytes'],row['localMtimeNs']) or (c.st_size,c.st_mtime_ns)!=(row['canonicalSize'],row['canonicalMtimeNs']) or sha_file(p)!=row['sha256']:preserved.append({'path':row['path'],'reason':'Changed or linked since verification'});continue
  rows.append(row)
second=scan();assert not second['nonAuditReaders'],second
beforeDu=target_du();beforeFree=free_bytes()
# Skip-worktree bits belong only to this linked worktree's index. No common
# sparse-checkout/config is changed, and no deletion is staged in Git.
names=b'\0'.join(r['path'].encode() for r in rows)+b'\0';git('update-index','-z','--skip-worktree','--stdin',input=names)
removed=0;logical=allocated=0;latePreserved=[]
with (OUT/'removed-files.jsonl.gz').open('wb') as raw,gzip.GzipFile(filename='',mode='wb',fileobj=raw,mtime=0) as out:
 for row in rows:
  p=ROOT/row['path'];s=p.stat();c=pathlib.Path(row['canonicalOriginal']).stat()
  if (s.st_size,s.st_mtime_ns)!=(row['bytes'],row['localMtimeNs']) or (c.st_size,c.st_mtime_ns)!=(row['canonicalSize'],row['canonicalMtimeNs']):
   latePreserved.append(row['path']);continue
  p.unlink();removed+=1;logical+=row['bytes'];allocated+=row['allocatedBytes'];out.write((json.dumps({'path':row['path'],'bytes':row['bytes'],'allocatedBytes':row['allocatedBytes']},separators=(',',':'))+'\n').encode())
if latePreserved:git('update-index','-z','--no-skip-worktree','--stdin',input=b'\0'.join(p.encode() for p in latePreserved)+b'\0')
afterDu=target_du();afterFree=free_bytes();after=scan();status=git('status','--porcelain','--untracked-files=no').decode();assert not status,status
receipt={'schema':1,'completedUTC':stamp(),'sourceCommit':SOURCE,'retainedSourceRef':REF,'pushedBranchVerificationBeforeRemoval':remote,'method':'Per-file verified unlink + own linked-worktree index skip-worktree bits; no shared sparse config, branch/worktree deletion or staged source deletion','verifiedManifestSHA256':verification['manifestSHA256'],'removedManifestSHA256':sha_file(OUT/'removed-files.jsonl.gz'),'removedFiles':removed,'reclaimedFileLogicalBytes':logical,'reclaimedFileAllocatedBytes':allocated,'targetAllocatedBefore':beforeDu,'targetAllocatedAfter':afterDu,'actualTargetDuReductionBytes':sum(beforeDu.values())-sum(afterDu.values()),'globalFreeBytesBefore':beforeFree,'globalFreeBytesAfter':afterFree,'globalFreeDeltaBytesWithConcurrentLanes':afterFree-beforeFree,'preservedCanonicalOrGitMismatches':verification['mismatches'],'preservedChangedFiles':preserved,'latePreservedFiles':latePreserved,'processBefore':before,'processImmediatelyBeforeRemoval':second,'processAfter':after,'trackedStatusAfter':status,'allHandoffRawProofDirectoriesPreserved':True,'canonicalRootFilesUnchangedByReclamation':True,'untrackedOriginalsRemoved':0,'gitObjectsOrRefsRemoved':0}
(OUT/'receipt.json').write_text(json.dumps(receipt,indent=2)+'\n');assert not after['nonAuditReaders'],after
print(json.dumps({k:receipt[k] for k in ['removedFiles','reclaimedFileAllocatedBytes','actualTargetDuReductionBytes','globalFreeBytesAfter','globalFreeDeltaBytesWithConcurrentLanes','preservedCanonicalOrGitMismatches']}))
