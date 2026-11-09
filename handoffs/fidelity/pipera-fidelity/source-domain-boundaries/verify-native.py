#!/usr/bin/env python3
"""Verify the portable native package and its exact committed source blobs."""
import gzip, hashlib, json, pathlib, subprocess

HERE = pathlib.Path(__file__).resolve().parent
REPO, ROOT = HERE.parents[3], HERE/'native-validation'
manifest = json.loads((ROOT/'integrity.json').read_text())
for name, row in manifest['files'].items():
    data = (ROOT/name).read_bytes()
    assert len(data) == row['bytes'] and hashlib.sha256(data).hexdigest() == row['sha256'], name
    if 'rawSha256' in row:
        raw = gzip.decompress(data)
        assert len(raw) == row['rawBytes'] and hashlib.sha256(raw).hexdigest() == row['rawSha256'], name
checked = {}
ledgers = []
for prefix in ['fd31352e','a119e372']:
    ledger = json.loads((ROOT/('source-manifest-'+prefix+'.json')).read_text())
    tree = subprocess.check_output(['git','rev-parse',ledger['commit']+'^{tree}'],cwd=REPO).decode().strip()
    assert tree == ledger['gitTree']
    entries = subprocess.check_output(['git','ls-tree','-r','-z',ledger['commit'],'--',*ledger['files']],cwd=REPO)
    blobs = {name.decode(): head.decode().split()[2] for head,name in
             (row.split(b'\t',1) for row in entries.split(b'\0') if row)}
    for name, row in ledger['files'].items():
        assert blobs[name] == row['gitBlobSha1'], name
        checked[row['gitBlobSha1']] = row['sha256']
    ledgers.append({'commit':ledger['commit'],'files':len(ledger['files'])})
proc = subprocess.Popen(['git','cat-file','--batch'],cwd=REPO,stdin=subprocess.PIPE,stdout=subprocess.PIPE)
for blob, expected in checked.items():
    proc.stdin.write((blob+'\n').encode());proc.stdin.flush()
    fields = proc.stdout.readline().split();assert fields[1] == b'blob'
    data = proc.stdout.read(int(fields[2]));assert proc.stdout.read(1) == b'\n'
    assert hashlib.sha256(data).hexdigest() == expected, blob
proc.stdin.close();assert proc.wait() == 0
print(json.dumps({'portableFiles':len(manifest['files']),'sourceLedgers':ledgers,
                  'uniqueGitSourceBlobs':len(checked),'passed':True},indent=2))
