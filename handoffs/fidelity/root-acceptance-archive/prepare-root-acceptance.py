#!/usr/bin/env python3
"""Prepare/verify an exact minimal root foot,a + current game Node-test archive.

No shipped module, test, HTTP server or browser is executed by this tool.
"""
from pathlib import Path
from datetime import datetime, timezone
import argparse
import fnmatch
import hashlib
import importlib.util
import json
import re
import subprocess
import tarfile

HERE = Path(__file__).resolve().parent
SPEC = importlib.util.spec_from_file_location('soak_prepare', HERE.parent / 'final-physical-soak/prepare-freeze.py')
P = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(P)
REPO = HERE.parents[2]
TEST_GLOBS = ['game/dev/*.test.mjs', 'game/dev/harness/*.test.mjs',
              'game/dev/harness/*.test.cjs', 'game/dev/harness/visual/*.test.mjs']
RUN = 'game/dev/harness/run.js'
REPORT = 'game/dev/harness/report.js'
ROOT_DECLARATION = "const ROOT = path.resolve(__dirname, '../../..');"
VISUAL_BRANCH = "if (process.argv.includes('--visual')) { require('./visual/run.js'); return; }"
# Full-file hashes pin the reviewed optional baseline/strict-source/entry-source
# branches. Default commands provide none of those flags. Any change needs review.
OPTIONAL_BASELINE = {
    'harness-current-body': '3ba6fb4e1f8541b3f695d751dddbb093064f21f258565b408d97377103e6bd1b',
    'normal-guard-tolerance': '724ca386d996bdb7754a51d4ce23710c02b9cf52215680ed5ee00a9947077e8e',
    'pedestrian-admission': 'c1a3916be321839821c5d05c81ffd5c30eeb334d9c36353e73dae2d4c559d074',
    'pedestrian-motion': '7568b8ec67af9743c996dc75ba322697befbaf56aed141708f5720444629743e',
    'pedestrian-side-yield': '20665544c8aebfa233eeb471ddad538e104bc89d73499ff65b5f419c04c31cb6',
    'pedestrian-source-sides': 'c906d3d20b2e742bf1b40f0e558df8752898e620810eb54ba1f34873b580a541',
    'solid-vehicle-sensing': '4edf586daa225edc922572902413533d1ee779a33d46fd22b64cc4cd54f45da1',
    'vehicle-cell-boundary': 'ea5778e3fddcce902fa072212f3a6e25db4be0f76756efc6848e9b74263236af',
    'vehicle-separation': '3ede9845b53abee994c031ef5e6ed3c7f744ab8c2296f2e2096e4b377cc0421f',
}
OPTIONAL_BASELINE = {'game/dev/' + p + '.test.mjs': h for p, h in OPTIONAL_BASELINE.items()}
NODE_AUDIT = r"""
const fs=require('node:fs'),vm=require('node:vm'),Module=require('node:module');
const out=[];for(const item of JSON.parse(fs.readFileSync(0,'utf8'))){try{
 let imports=[],kind='module';
 if(item.cjs){new vm.Script(Module.wrap(item.source.replace(/^#![^\n]*\n/,'')),{filename:item.file});kind='commonjs';}
 else imports=new vm.SourceTextModule(item.source,{identifier:item.file}).dependencySpecifiers;
 out.push({file:item.file,imports,kind});
}catch(e){process.stderr.write(item.file+': '+e.message+'\n');process.exit(2);}}
process.stdout.write(JSON.stringify({files:out,builtins:Module.builtinModules}));
"""
REQUIRE_TOKENS = re.compile(r'''//[^\n]*|/\*.*?\*/|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|(?P<call>\brequire\s*\(\s*)''', re.S)


def test_files(tree):
    # pathlib-style single-directory globs, matching the historical c4 recipe.
    return sorted(p for p in tree if any(str(Path(p).parent) == str(Path(g).parent) and fnmatch.fnmatch(Path(p).name, Path(g).name) for g in TEST_GLOBS))


def select(repo, revision):
    tree = P.catalogue(repo, revision)
    required = P.PROTOCOL_INPUTS + [RUN, REPORT, 'game/dev/harness/README.md']
    missing = [p for p in required if p not in tree]
    tests = test_files(tree)
    if missing or not tests:
        raise P.PreparationError(f'Missing acceptance entry/test inputs: {missing}; tests={len(tests)}')
    read = lambda p: P.git(repo, 'show', revision + ':' + p).decode('utf8')
    if ROOT_DECLARATION not in read(RUN):
        raise P.PreparationError('Native run.js ROOT contract changed; review before preparation.')
    initial = {p for p in tree if any(P.under(p, prefix) for prefix in P.CORE_PATHS + [P.PAGE_PATH])}
    selected, runtime_audit = P.dependency_audit(repo, revision, tree, initial)
    selected.update(tests + [RUN, REPORT, 'game/dev/harness/README.md'])
    seen = set(runtime_audit['syntaxCheckedFiles'])
    edges, syntax, optional, external = [], [], [], []
    def add(owner, spec, module=False):
        if spec in {'playwright'} or spec.startswith('node:') or spec in builtins:
            external.append({'file': owner, 'specifier': spec}); return
        if module and not spec.startswith(('.', '/', 'http:', 'https:', 'data:')):
            raise P.PreparationError(f'Unresolved bare acceptance dependency: {owner} -> {spec}')
        target = P.local_target(owner, spec)
        if target is None:
            external.append({'file': owner, 'specifier': spec}); return
        if target not in tree:
            raise P.PreparationError(f'Missing committed acceptance dependency: {owner} -> {target}')
        selected.add(target); edges.append({'file': owner, 'target': target})
    while True:
        batch = sorted(p for p in selected - seen if p.endswith(('.js', '.mjs', '.cjs')))
        if not batch:
            break
        sources = {p: read(p) for p in batch}
        inputs = [{'file': p, 'source': s, 'cjs': p.endswith('.cjs') or p in {RUN, REPORT}} for p, s in sources.items()]
        parsed = subprocess.run(['node', '--no-warnings', '--experimental-vm-modules', '-e', NODE_AUDIT], input=json.dumps(inputs), text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        if parsed.returncode:
            raise P.PreparationError('Acceptance syntax audit failed: ' + parsed.stderr.strip())
        parsed = json.loads(parsed.stdout); builtins = set(parsed['builtins'])
        for row in parsed['files']:
            p = row['file']; source = sources[p]; syntax.append({'file': p, 'kind': row['kind']})
            for spec in row['imports']:
                add(p, spec, module=True)
            refs, unknown = P.lexical_refs(source)
            if unknown:
                digest = hashlib.sha256(source.encode()).hexdigest()
                if OPTIONAL_BASELINE.get(p) != digest:
                    raise P.PreparationError(f'Unreviewed dynamic acceptance import: {p}: {unknown}')
                optional.append({'file': p, 'sourceSha256': digest, 'expressions': unknown, 'scope': 'Reviewed optional old-source comparison; no baseline/strict-source/entry-source flags in recorded default command.'})
            for spec in refs:
                add(p, spec)
            for token in REQUIRE_TOKENS.finditer(source):
                if not token.group('call'):
                    continue
                literal = P.LITERAL.match(source, token.end())
                if not literal:
                    raise P.PreparationError('Unreviewed nonliteral require: ' + p)
                spec = literal.group('value')
                if p == RUN and spec == './visual/run.js' and VISUAL_BRANCH in source:
                    optional.append({'file': p, 'specifier': spec, 'scope': 'Exact --visual delegation branch omitted; only native --scenario=foot,a is in this archive contract.'}); continue
                add(p, spec, module=True)
            # Native CJS readFileSync(path.join/resolve(__dirname, literal)).
            for match in re.finditer(r'''readFile(?:Sync)?\(\s*(?:path\.)?(?:join|resolve)\(\s*__dirname\s*,\s*(['"])([^'"]+)\1''', source):
                add(p, match.group(2))
        seen.update(batch)
    audit = {'method': 'V8 module/CommonJS syntax parsing without evaluation, exact static import/require and literal new-URL closure; runtime dependency audit retained separately.', 'runtime': runtime_audit, 'additionalSyntaxChecked': syntax, 'additionalDependencyEdges': edges, 'conditionalImportsOutsideDefaultCommands': optional, 'externalSpecifiers': external, 'testGlobs': TEST_GLOBS, 'testFiles': tests, 'dependencyAddedFiles': sorted(selected - initial - set(tests) - {RUN, REPORT, 'game/dev/harness/README.md'})}
    return tree, selected, audit


def verify(base, revision):
    base = Path(base).resolve(); out = base / 'raw'
    manifest = json.loads((out / 'source-manifest.json').read_text())
    if manifest['sourceCommit'] != revision or not re.fullmatch('[a-f0-9]{40}', revision):
        raise P.PreparationError('Verification requires the actual matching full source SHA.')
    entries = {p: {'mode': v['mode'], 'blob': v['gitBlobSha1']} for p, v in manifest['files'].items()}
    hashes, _ = P.verify_archive(base / 'source', entries)
    if hashes != {p: v['sha256'] for p, v in manifest['files'].items()}:
        raise P.PreparationError('Source SHA256 inventory differs.')
    return {'sourceCommit': revision, 'checkedUtc': datetime.now(timezone.utc).isoformat(), 'exactSourceFiles': len(hashes), 'allGitBlobsAndSha256Match': True, 'completeServableFileSetMatches': True}


def prepare(revision, base, repo=REPO):
    base = Path(base).resolve()
    if not re.fullmatch('[a-f0-9]{40}', revision) or P.git(repo, 'rev-parse', revision + '^{commit}').decode().strip() != revision:
        raise P.PreparationError('Supply the exact full40-character source commit.')
    if base.exists():
        raise P.PreparationError('Preserve existing acceptance evidence; destination already exists: ' + str(base))
    tree, selected, audit = select(repo, revision)
    base.mkdir(parents=True); source = base / 'source'; out = base / 'raw'; source.mkdir(); out.mkdir()
    archive = base / 'source.tar'
    with archive.open('wb') as dest:
        subprocess.run(['git', 'archive', '--format=tar', revision, *sorted(selected)], cwd=repo, stdout=dest, check=True)
    with tarfile.open(archive) as tar:
        tar.extractall(source, filter='data')
    archive.unlink()
    hashes, blobs = P.verify_archive(source, {p: tree[p] for p in selected})
    files = {p: {'mode': tree[p]['mode'], 'bytes': tree[p]['bytes'], 'sha256': hashes[p], 'gitBlobSha1': blobs[p]} for p in sorted(selected)}
    manifest = {'sourceCommit': revision, 'sourceTree': P.git(repo, 'rev-parse', revision + '^{tree}').decode().strip(), 'archiveMode': 'root-acceptance-runtime-and-game-node-tests', 'partialArchive': True, 'files': files, 'includedPaths': sorted(selected), 'includedBytes': sum(v['bytes'] for v in files.values()), 'omittedNonruntimePrefixes': [{'prefix': prefix, 'omittedFiles': sum(p.startswith(prefix) and p not in selected for p in tree), 'omittedBytes': sum(v['bytes'] for p, v in tree.items() if p.startswith(prefix) and p not in selected), 'retainedExactDependencies': sorted(p for p in selected if p.startswith(prefix))} for prefix in ['game/overview/', 'game/research/', 'game/dev/', 'handoffs/']], 'scope': 'Partial exact source for native foot,a and current game Node test recipe; only specifically referenced fixtures/research/helpers. No gallery/raw proof/reference image archive and no shipped source overrides.'}
    (out / 'source-manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    (out / 'dependency-audit.json').write_text(json.dumps(audit, indent=2) + '\n')
    command = ['node', '--test', '--test-concurrency=4', *audit['testFiles']]
    foot = ['node', str(source / RUN), '--scenario=foot,a', '--city=bucharest', '--port=0', '--out=' + str(out / 'foot-a')]
    environment = {'NODE_PATH': '/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules', 'NODE_OPTIONS': '--require=/workspace/.environment/drive-my-cv/use-system-chromium.cjs', 'TMPDIR': str(out / 'node-temp')}
    (out / 'node-temp').mkdir()
    plan = {'status': 'prepared-not-launched', 'preparedUtc': datetime.now(timezone.utc).isoformat(), 'sourceCommit': revision, 'preparationToolCommit': P.git(REPO, 'rev-parse', 'HEAD').decode().strip(), 'sourceRoot': str(source), 'out': str(out), 'cwd': str(source), 'environment': environment, 'nodeTestsCommand': command, 'footACommand': foot, 'testFiles': len(audit['testFiles']), 'harnessRootContract': ROOT_DECLARATION, 'preparationScriptSha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest(), 'sharedPreparationSha256': hashlib.sha256(Path(P.__file__).read_bytes()).hexdigest(), 'verificationCommand': ['python', str(Path(__file__).resolve()), 'verify', revision, str(base)], 'browserLaunched': False, 'scope': 'Preparation only. Both commands may launch Chromium; wait for actual root FINAL authorization. Native run.js must stay at its committed archive path because ROOT derives from __dirname. --port=0 avoids attaching to an unrelated server. No old-source comparison flags, no --visual and no --root override. Run verification immediately before and after each command; retain each output with distinct filename.'}
    (out / 'prepared.json').write_text(json.dumps(plan, indent=2) + '\n')
    checked = verify(base, revision); (out / 'source-precheck.json').write_text(json.dumps(checked, indent=2) + '\n')
    return {'status': plan['status'], 'sourceCommit': revision, 'sourceRoot': str(source), 'out': str(out), 'includedFiles': len(files), 'includedBytes': manifest['includedBytes'], 'testFiles': plan['testFiles'], 'browserLaunched': False}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=['prepare', 'verify']); parser.add_argument('revision'); parser.add_argument('base', type=Path)
    args = parser.parse_args()
    try:
        print(json.dumps(prepare(args.revision, args.base) if args.action == 'prepare' else verify(args.base, args.revision), indent=2))
    except P.PreparationError as error:
        parser.exit(2, str(error) + '\n')
