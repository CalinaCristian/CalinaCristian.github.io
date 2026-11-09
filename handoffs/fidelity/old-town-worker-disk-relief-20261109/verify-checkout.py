"""Verify own tracked duplicate checkout; verification only, never removes files."""
import pathlib,subprocess,hashlib,json,gzip,datetime,os,stat
ROOT=pathlib.Path('/workspace/fidelity-workers/old-town-nightlife');CANON=pathlib.Path('/workspace/CalinaCristian.github.io');OUT=ROOT/'handoffs/fidelity/old-town-worker-disk-relief-20261109'
SOURCE='31ed79e0d89ef131a701b1c7ec04c0155f64f18b';BRANCH='fidelity/backgammon-result-confirmation-20261109';REF='refs/fidelity/retained-worker-source/old-town-before-sparse-31ed79e0'
TARGETS=['game/data','game/overview/comparison-data']
def git(*args):return subprocess.check_output(['git',*args],cwd=ROOT)
def stamp():return datetime.datetime.now(datetime.timezone.utc).isoformat()
def digest_file(path):
 h=hashlib.sha256()
 with path.open('rb') as f:
  for b in iter(lambda:f.read(1024*1024),b''):h.update(b)
 return h.hexdigest()
def process_scan():
 own=set();pid=os.getpid()
 while pid and pid not in own:
  own.add(pid)
  try:pid=int(next(line.split()[1] for line in pathlib.Path(f'/proc/{pid}/status').read_text().splitlines() if line.startswith('PPid:')))
  except (FileNotFoundError,PermissionError,StopIteration):break
 readers=[];auditors=[]
 for p in pathlib.Path('/proc').iterdir():
  if not p.name.isdigit():continue
  try:
   cwd=os.readlink(p/'cwd');argv=(p/'cmdline').read_bytes().replace(b'\0',b' ').decode(errors='replace');fds=[]
   for fd in (p/'fd').iterdir():
    try:
     target=os.readlink(fd)
     if any(target.startswith(str(ROOT/t)+'/') for t in TARGETS):fds.append(target)
    except (PermissionError,FileNotFoundError):pass
   if cwd.startswith(str(ROOT)) or str(ROOT) in argv or fds:
    entry={'pid':int(p.name),'cwd':cwd,'argv':argv,'targetFileDescriptors':fds}
    (auditors if int(p.name) in own else readers).append(entry)
  except (FileNotFoundError,PermissionError,ProcessLookupError):pass
 return {'atUTC':stamp(),'nonAuditReaders':readers,'ownAuditProcessIds':sorted(own),'auditMatches':auditors}
assert git('status','--porcelain','--untracked-files=no').strip()==b''
assert git('rev-parse','HEAD').decode().strip()==SOURCE
remote=git('ls-remote','--heads','origin',BRANCH).decode().strip();assert remote.split()[0]==SOURCE
# Pin immutable objects before making the checkout sparse.
git('update-ref',REF,SOURCE);assert git('rev-parse',REF).decode().strip()==SOURCE
first=process_scan();assert not first['nonAuditReaders'],first['nonAuditReaders']
raw=git('ls-tree','-r','-z',SOURCE,'--',*TARGETS);entries=[]
for record in raw.split(b'\0'):
 if not record:continue
 meta,path=record.split(b'\t',1);mode,kind,blob=meta.decode().split();assert kind=='blob' and mode=='100644',(mode,path)
 entries.append((path.decode(),mode,blob))
tracked={p for p,_,_ in entries};extras=[]
for target in TARGETS:
 for p in (ROOT/target).rglob('*'):
  if p.is_file() or p.is_symlink():
   if str(p.relative_to(ROOT)) not in tracked:extras.append(str(p.relative_to(ROOT)))
assert not extras,extras # Never exclude a target directory containing an original/untracked file.
manifest=OUT/'verified-files.jsonl.gz';rows=0;logical=allocated=0;mismatches=[]
cat=subprocess.Popen(['git','cat-file','--batch'],cwd=ROOT,stdin=subprocess.PIPE,stdout=subprocess.PIPE)
with manifest.open('wb') as rawout,gzip.GzipFile(filename='',mode='wb',fileobj=rawout,mtime=0) as out:
 for name,mode,blob in entries:
  local=ROOT/name;canonical=CANON/name
  if not local.is_file() or local.is_symlink() or not canonical.is_file() or canonical.is_symlink():mismatches.append({'path':name,'reason':'Missing regular canonical/local file'});continue
  before=local.stat();canonicalBefore=canonical.stat();size=before.st_size
  localSHA256=digest_file(local);canonicalSHA256=digest_file(canonical)
  h1=hashlib.sha1();h1.update(f'blob {size}\0'.encode())
  with local.open('rb') as f:
   for b in iter(lambda:f.read(1024*1024),b''):h1.update(b)
  cat.stdin.write((blob+'\n').encode());cat.stdin.flush();header=cat.stdout.readline().decode().strip().split();assert header==[blob,'blob',str(size)],(name,header,size)
  objectHash=hashlib.sha256();remaining=size
  while remaining:
   b=cat.stdout.read(min(1024*1024,remaining));assert b;objectHash.update(b);remaining-=len(b)
  assert cat.stdout.read(1)==b'\n'
  after=local.stat();canonicalAfter=canonical.stat()
  valid=h1.hexdigest()==blob and localSHA256==canonicalSHA256==objectHash.hexdigest() and (before.st_size,before.st_mtime_ns)==(after.st_size,after.st_mtime_ns) and (canonicalBefore.st_size,canonicalBefore.st_mtime_ns)==(canonicalAfter.st_size,canonicalAfter.st_mtime_ns)
  if not valid:mismatches.append({'path':name,'reason':'Git/local/canonical SHA or stat mismatch'});continue
  row={'path':name,'mode':mode,'gitBlob':blob,'bytes':size,'allocatedBytes':before.st_blocks*512,'links':before.st_nlink,'sha256':localSHA256,'gitObjectSHA256':objectHash.hexdigest(),'canonicalOriginal':str(canonical),'canonicalSHA256':canonicalSHA256,'canonicalSize':canonicalBefore.st_size,'canonicalMtimeNs':canonicalBefore.st_mtime_ns,'localMtimeNs':before.st_mtime_ns}
  out.write((json.dumps(row,separators=(',',':'))+'\n').encode());rows+=1;logical+=size;allocated+=before.st_blocks*512
cat.stdin.close();assert cat.wait()==0
second=process_scan()
summary={'schema':1,'verifiedUTC':stamp(),'status':'VERIFIED ONLY; no files removed yet','worktree':str(ROOT),'canonicalOriginalRoot':str(CANON),'sourceCommit':SOURCE,'retainedSourceRef':REF,'pushedBranch':BRANCH,'remoteVerification':remote,'targets':TARGETS,'trackedCandidates':len(entries),'verifiedFiles':rows,'logicalBytes':logical,'allocatedBytes':allocated,'untrackedInsideTargets':extras,'mismatches':mismatches,'manifest':manifest.name,'manifestSHA256':digest_file(manifest),'processBefore':first,'processAfter':second,'allHandoffRawProofDirectoriesPreserved':True,'allUntrackedFilesOutsideTargetsPreserved':True}
(OUT/'verification.json').write_text(json.dumps(summary,indent=2)+'\n')
assert rows==len(entries) and not mismatches and not second['nonAuditReaders'],(len(entries),rows,mismatches,second['nonAuditReaders'])
print(json.dumps({k:summary[k] for k in ['status','trackedCandidates','verifiedFiles','logicalBytes','allocatedBytes','mismatches','manifestSHA256']}))
