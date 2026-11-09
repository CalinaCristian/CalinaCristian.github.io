"""Plan logical index-only curation and verify Git tree hashes in memory.

No commits, refs, indexes, objects, worktrees or remote state are written.
"""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys

repo, base_arg, accepted_arg, output = sys.argv[1:]
output = Path(output)
if output.exists():
    raise SystemExit('Output must be new')
env = {**os.environ, 'GIT_OPTIONAL_LOCKS': '0'}


def git(*args):
    return subprocess.check_output(['git', *args], cwd=repo, env=env)


def snapshot(ref):
    commit = git('rev-parse', ref + '^{commit}').decode().strip()
    tree = git('rev-parse', commit + '^{tree}').decode().strip()
    files = {}
    for row in git('ls-tree', '-rz', commit).split(b'\0'):
        if row:
            meta, name = row.split(b'\t')
            mode, kind, oid = meta.split()
            files[os.fsdecode(name)] = (mode.decode(), oid.decode())
    return commit, tree, files


def tree_hash(files):
    root = {}
    for name, entry in files.items():
        node = root
        parts = name.split('/')
        for part in parts[:-1]:
            node = node.setdefault(part, {})
        node[parts[-1]] = entry

    def encode(node):
        result = bytearray()
        order = sorted(node.items(), key=lambda v: os.fsencode(v[0] + ('/' if isinstance(v[1], dict) else '')))
        for name, entry in order:
            mode, oid = ('40000', encode(entry)) if isinstance(entry, dict) else entry
            result.extend(mode.encode() + b' ' + os.fsencode(name) + b'\0' + bytes.fromhex(oid))
        return hashlib.sha1(b'tree ' + str(len(result)).encode() + b'\0' + result).hexdigest()

    return encode(root)


def group(name):
    if name == 'game/release.json':
        return '04-stamp-placeholder'
    if name.startswith('handoffs/'):
        return '03-proofs'
    if name.startswith(('game/overview/', 'specs/')) or name.endswith('.md') or name in {'_config.yml', 'CNAME'}:
        return '02-overview-docs'
    return '01-runtime-tests'


base, base_tree, before = snapshot(base_arg)
accepted, accepted_tree, target = snapshot(accepted_arg)
assert tree_hash(before) == base_tree
assert tree_hash(target) == accepted_tree
changed = sorted(name for name in set(before) | set(target) if before.get(name) != target.get(name))
groups = {name: [] for name in ['01-runtime-tests', '02-overview-docs', '03-proofs', '04-stamp-placeholder']}
for name in changed:
    groups[group(name)].append(name)
state = dict(before)
output.mkdir(parents=True)
records = []
for name, paths in groups.items():
    index_info = bytearray()
    for path in paths:
        if path in target:
            mode, oid = target[path]
            state[path] = target[path]
        else:
            mode, oid = '0', '0' * 40
            state.pop(path, None)
        index_info.extend(mode.encode() + b' ' + oid.encode() + b'\t' + os.fsencode(path) + b'\0')
    (output / (name + '.index-info')).write_bytes(index_info)
    (output / (name + '.paths.nul')).write_bytes(b'\0'.join(os.fsencode(p) for p in paths) + (b'\0' if paths else b''))
    (output / (name + '.paths.txt')).write_text('\n'.join(paths) + ('\n' if paths else ''))
    records.append({'group': name, 'paths': len(paths), 'treeAfterGroup': tree_hash(state),
                    'indexInfo': name + '.index-info', 'skipEmptyGroup': not bool(paths)})
assert state == target
assert tree_hash(state) == accepted_tree
report = {'scope': 'Preparation only; source66a is not FINAL acceptance. Rerun with freshly fetched origin/master and the actual final accepted root. All Git trees hashed in memory; no Git mutations.',
          'baseCommit': base, 'baseTree': base_tree, 'acceptedPreparationCommit': accepted,
          'acceptedTree': accepted_tree, 'changedPaths': len(changed), 'groups': records,
          'finalVirtualTreeEqualsAccepted': True,
          'finalStampScope': 'After curation, the existing stamp tool changes only index.html, game/index.html and game/release.json. Compare canonical runtime fingerprint to accepted code, retain exact pre-stamp tree equality, and do not claim literal post-stamp equality to an unstamped root. If needed, mirror only the three stamp blobs into an accepted-stamp checkpoint before final full-tree equality.',
          'noRefsCommitsObjectsIndexesOrWorktreesWritten': True}
(output / 'plan.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps(report, indent=2))
