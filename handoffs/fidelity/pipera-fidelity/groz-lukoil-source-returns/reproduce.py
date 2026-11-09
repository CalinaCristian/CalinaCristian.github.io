#!/usr/bin/env python3
"""Replay the read-only CPU diagnostics with explicit input/output paths.

Runs the preserved scripts with safely quoted path-literal substitutions in a
new output directory. It never starts a browser, edits source or rebuilds data.
The historical pre-preservation crown-filter report is retained, not relabelled
as a fresh result against the already-preserved final candidate.
"""
import argparse,gzip,hashlib,json,re,subprocess
from pathlib import Path

ap=argparse.ArgumentParser()
ap.add_argument('--repo',type=Path,required=True,help='isolated candidate checkout')
ap.add_argument('--native-source',type=Path,required=True,help='exact ff6 source archive')
ap.add_argument('--native-world',type=Path,required=True,help='exact ff6 grozavesti-world.json.gz')
ap.add_argument('--osm',type=Path,required=True,help='retained16tile source directory')
ap.add_argument('--out',type=Path,required=True,help='new/empty output directory')
a=ap.parse_args();here=Path(__file__).resolve().parent
assert not a.out.exists() or not list(a.out.iterdir()), 'output directory must be new/empty'
a.out.mkdir(parents=True,exist_ok=True)
sha=lambda b:hashlib.sha256(b).hexdigest()
world=gzip.decompress(a.native_world.read_bytes())
assert sha(world)=='df9d2deec0eeec4e508a3b8164ad3120f26307ae17fae5fdf35cadc52c18a2ea','wrong native World source'
manifest=json.loads((here/'manifest.json').read_text())
for relative,expected in manifest['nativeSourceHashes'].items():
 assert sha((a.native_source/relative).read_bytes())==expected, 'wrong native source '+relative
for name in ['original-406a-grozavesti.json','rebuild-baseline-grozavesti.json']:
 (a.out/name).write_bytes(gzip.decompress((here/(name+'.gz')).read_bytes()))
replacements={
 '/workspace/integration-qa-evidence/preview-ff6b2bff-native/grozavesti-world.json.gz':str(a.native_world.resolve()),
 '/workspace/integration-qa-evidence/preview-ff6b2bff-source':str(a.native_source.resolve()),
 '/workspace/reality-pass/grozavesti/tiles':str(a.osm.resolve()),
 '/workspace/reality-pass/groz-lukoil-nav':str(a.out.resolve()),
 '/workspace/fidelity-workers/ordinary-source-span':str(a.repo.resolve()),
}
def rewrite(match):
 value=match.group(2)
 for prefix,replacement in replacements.items():
  if value==prefix or value.startswith(prefix+'/'):return json.dumps(replacement+value[len(prefix):])
 return match.group(0)
scripts=['raw-osm-route.py','certify-gaps.py','measure-return-corridors.py','compare-source-preservation.py',
         'check-compiled-return-routes.mjs','inspect-ff6.mjs','connectivity-ff6.mjs']
for name in scripts:
 text=(here/name).read_text()
 text=re.sub(r"(['\"])(/workspace/[^'\"\n]+)\1",rewrite,text)
 script=a.out/('replay-'+name);script.write_text(text)
 with (a.out/(name+'.stdout')).open('wb')as stdout,(a.out/(name+'.stderr')).open('wb')as stderr:
  subprocess.run(['node'if name.endswith('.mjs')else'python',str(script)],cwd=a.repo,stdout=stdout,stderr=stderr,check=True)
print('Completed read-only source/mask/route replay in',a.out)
