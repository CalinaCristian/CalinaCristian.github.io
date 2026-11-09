"""Verify this read-only proof without opening a browser or writing source files."""
from pathlib import Path
import hashlib,json,gzip,sys,ast,subprocess
base=Path(__file__).resolve().parent
manifest=json.loads((base/'proof-manifest.json').read_bytes())
def digest(p):
    h=hashlib.sha256()
    with p.open('rb')as f:
        for b in iter(lambda:f.read(1024*1024),b''):h.update(b)
    return h.hexdigest()
for name,row in manifest['files'].items():
    p=base/name
    assert p.stat().st_size==row['bytes'],name
    assert digest(p)==row['sha256'],name
for name,row in manifest['losslessArchives'].items():
    h=hashlib.sha256();size=0
    with gzip.open(base/name,'rb')as f:
        for b in iter(lambda:f.read(1024*1024),b''):size+=len(b);h.update(b)
    assert size==row['uncompressedBytes'],name
    assert h.hexdigest()==row['uncompressedSha256'],name
header=json.loads((base/'native-header.json').read_bytes())
assert digest(base/'observe-contact.cjs')==header['toolSha256']
assert header['complete'] and header['browserClosed'] and header['sourceFilesVerifiedAfterRun']
assert not header['errors'] and not header['consoleErrors'] and not header['httpErrors']
sourceCount=0
if len(sys.argv)>1:
    source=Path(sys.argv[1]);bindings={**header['inputs'],**header['servedFiles']}
    for name,row in bindings.items():assert digest(source/name)==row['sha256'],name
    sourceCount=len(bindings)
for p in base.glob('*.py'):ast.parse(p.read_text(),filename=str(p))
for ext in ('*.mjs','*.cjs'):
    for p in base.glob(ext):subprocess.run(['node','--check',str(p)],check=True,capture_output=True,text=True)
print(json.dumps({'passed':True,'sourceCommit':header['sourceCommit'],'filesVerified':len(manifest['files']),'losslessArchivesVerified':len(manifest['losslessArchives']),'sourceBindingsVerified':sourceCount,'browserOpened':False,'productionFilesWritten':False},indent=2))
