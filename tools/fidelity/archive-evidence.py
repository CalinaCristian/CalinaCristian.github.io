#!/usr/bin/env python3
"""Plan capture provenance; --write-tag creates one immutable annotated archive."""
import argparse, json, re, subprocess
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
def git(*args, input=None):
    return subprocess.check_output(['git', *args], cwd=ROOT, text=True, input=input).strip()
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--source', default='HEAD')
parser.add_argument('--out', type=Path)
parser.add_argument('--write-tag')
args = parser.parse_args()
source = git('rev-parse', '--verify', args.source + '^{commit}')
records = {}
def inspect(value, path, key=''):
    if isinstance(value, dict):
        for name, child in value.items():
            if 'source' in key.lower() and re.fullmatch('[a-f0-9]{40}', name): records.setdefault(name, set()).add(path)
            inspect(child, path, name if not re.fullmatch('[a-f0-9]{40}', name) else key)
    elif isinstance(value, list):
        for child in value: inspect(child, path, key)
    elif isinstance(value, str) and re.fullmatch('[a-f0-9]{40}', value):
        if re.search('commit|revision|baseline', key, re.I) and re.search('source|capture|runtime|review|baseline', key, re.I): records.setdefault(value, set()).add(path)
for path in git('ls-tree', '-r', '--name-only', source, '--', 'game/overview/evidence', 'game/overview/comparison-data').splitlines():
    if path.endswith('.json'): inspect(json.loads(git('show', source + ':' + path)), path)
missing = [rev for rev in records if subprocess.run(['git','cat-file','-e',rev+'^{commit}'], cwd=ROOT, capture_output=True).returncode]
heads = list(dict.fromkeys([source, *git('for-each-ref', '--format=%(objectname)', 'refs/heads/fidelity/', 'refs/heads/fix/dinamo-and-ambasador').splitlines()]))
for rev in sorted(records):
    if rev not in missing and not any(subprocess.run(['git','merge-base','--is-ancestor',rev,head], cwd=ROOT).returncode == 0 for head in heads): heads.append(rev)
plan = {'schemaVersion':1, 'sourceCommit':source, 'tree':git('rev-parse',source+'^{tree}'), 'captureSources':{k:sorted(v) for k,v in sorted(records.items())}, 'archiveParents':heads, 'missingCommitObjects':missing, 'purpose':'Retain historical capture objects outside curated master history before deleting task branches. No branch, source record or capture date is rewritten.'}
if missing: raise SystemExit('Missing capture commit objects: '+', '.join(missing))
if args.write_tag:
    git('check-ref-format','refs/tags/'+args.write_tag)
    if subprocess.run(['git','show-ref','--verify','--quiet','refs/tags/'+args.write_tag], cwd=ROOT).returncode == 0: raise SystemExit('Refusing to replace existing archive tag')
    archive = git('commit-tree', plan['tree'], *[p for head in heads for p in ['-p',head]], input='Archive immutable fidelity capture sources\n\n'+json.dumps(plan,indent=2)+'\n')
    git('tag','-a',args.write_tag,archive,'-m','Historical fidelity development and capture sources; release history remains on master.')
    plan.update(archiveCommit=archive, tag=args.write_tag)
if args.out:
    args.out.parent.mkdir(parents=True,exist_ok=True); args.out.write_text(json.dumps(plan,indent=2)+'\n')
print(json.dumps({'sourceCommit':source,'captureSources':len(records),'archiveParents':len(heads),'missing':missing,'tag':plan.get('tag')}))
