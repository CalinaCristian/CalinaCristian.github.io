#!/usr/bin/env python3
"""Prepare exact committed source and reviewed external soak tools; never launch.

Final use: prepare-freeze.py FULL_FINAL_SHA NEW_BASE --runtime-only
Without the flag, retain the older bulk-dev archive for explicit legacy use.
"""
from pathlib import Path, PurePosixPath
from datetime import datetime, timezone
from html.parser import HTMLParser
from urllib.parse import urlsplit, unquote
import argparse
import hashlib
import json
import posixpath
import re
import shutil
import subprocess
import tarfile

REPO = Path(__file__).resolve().parents[3]
CORE_PATHS = ['game/src', 'game/data', 'game/vendor', 'game/assets',
              'game/index.html', 'game/style.css', 'game/meta', 'game/release.json',
              'game/package.json', 'public', 'package.json', 'index.html',
              'index.css', 'index.js', 'canvas.js', 'tools/telemetry/stamp-release.mjs']
PAGE_PATH = 'game/dev/harness/page'
TOOLS = {'runner.cjs': 'game/dev/harness/integration-district-final-soak.cjs',
         'integration-browser-bounds.cjs': 'game/dev/harness/integration-browser-bounds.cjs',
         'verify-district-soak.cjs': 'handoffs/fidelity/integration-final-acceptance/verify-district-soak.cjs'}
OMITTED_PREFIXES = ['game/overview/', 'game/research/', 'game/dev/']
OPTIONAL_ABSENT = {'game/release.json'}
PROTOCOL_INPUTS = ['game/index.html', 'game/style.css', 'game/dev/harness/page/index.js',
                   'game/src/render.js', 'game/src/progressive-pmrem.js', 'game/src/main.js',
                   'game/src/world.js', 'game/src/traffic.js', 'game/src/vehicles.js',
                   'game/data/bucharest-romana.json']

class PreparationError(ValueError):
    pass

def git(repo, *args):
    return subprocess.check_output(['git', *args], cwd=repo)

def catalogue(repo, revision):
    result = {}
    for row in git(repo, 'ls-tree', '-r', '-l', '-z', revision).split(b'\0'):
        if row:
            header, name = row.split(b'\t', 1)
            mode, kind, oid, size = header.decode().split()
            if kind == 'blob':
                result[name.decode()] = {'mode': mode, 'blob': oid, 'bytes': int(size)}
    return result

def under(name, prefix):
    return name == prefix or name.startswith(prefix.rstrip('/') + '/')

class ResourceHTML(HTMLParser):
    def __init__(self):
        super().__init__(); self.refs = []
    def handle_starttag(self, tag, attrs):
        values = dict(attrs)
        if tag in ['script', 'img', 'source', 'video', 'audio'] and values.get('src'):
            self.refs.append(values['src'])
        if tag == 'link' and set(values.get('rel', '').split()) & {'stylesheet', 'icon', 'preload', 'modulepreload', 'manifest'} and values.get('href'):
            self.refs.append(values['href'])

MODULE_AUDIT = r"""
const fs=require('node:fs'),vm=require('node:vm'),input=JSON.parse(fs.readFileSync(0,'utf8'));
const out=[];for(const item of input){try{const m=new vm.SourceTextModule(item.source,{identifier:item.file});out.push({file:item.file,imports:m.dependencySpecifiers});}catch(e){process.stderr.write(item.file+': '+e.message+'\n');process.exit(2);}}
process.stdout.write(JSON.stringify(out));
"""
LITERAL = re.compile(r'''(?P<q>["'`])(?P<value>(?:\\.|(?!\1).)*?)(?P=q)''', re.S)
TOKENS = re.compile(r'''//[^\n]*|/\*.*?\*/|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|(?P<call>\bimport\s*\(\s*|\bnew\s+URL\s*\(\s*)''', re.S)

def lexical_refs(source):
    refs, unresolved_imports = [], []
    for token in TOKENS.finditer(source):
        if not token.group('call'):
            continue
        literal = LITERAL.match(source, token.end())
        if literal:
            refs.append(literal.group('value'))
        elif token.group('call').lstrip().startswith('import'):
            unresolved_imports.append(source[token.start():token.end() + 80].splitlines()[0])
    return refs, unresolved_imports

def local_target(owner, spec):
    if spec.startswith(('data:', 'blob:', 'node:', '#', 'http:', 'https:', '//', 'mailto:')):
        return None
    value = unquote(urlsplit(spec).path)
    if not value:
        return None
    target = posixpath.normpath(value.lstrip('/') if value.startswith('/') else posixpath.join(str(PurePosixPath(owner).parent), value))
    if target == '..' or target.startswith('../'):
        raise PreparationError(f'Dependency escapes the archived repository: {owner} -> {spec}')
    return target

def dependency_audit(repo, revision, tree, selected):
    selected = set(selected); initial = set(selected); seen = set(); edges = []; dynamic = []; optional = []; external = []; source_cache = {}
    def text(name):
        if name not in source_cache:
            source_cache[name] = git(repo, 'show', revision + ':' + name).decode('utf8')
        return source_cache[name]
    def add(owner, spec, module=False):
        if module and not spec.startswith(('.', '/', 'http:', 'https:', 'node:')):
            raise PreparationError(f'Unresolved bare module import: {owner} -> {spec}')
        target = local_target(owner, spec)
        if target is None:
            external.append({'file': owner, 'specifier': spec}); return
        if '${' in spec:
            before = spec.split('${', 1)[0]; suffix = spec.rsplit('}', 1)[-1]
            prefix = local_target(owner, before)
            matches = [name for name in tree if name.startswith(prefix.rstrip('/') + '/') and (not suffix or name.endswith(suffix))]
            if not matches:
                raise PreparationError(f'No committed candidates for dynamic dependency: {owner} -> {spec}')
            selected.update(matches); dynamic.append({'file': owner, 'specifier': spec, 'prefix': prefix, 'candidates': len(matches)}); return
        if target not in tree:
            if target in OPTIONAL_ABSENT:
                optional.append({'file': owner, 'target': target, 'reason': 'Not present in this committed pre-stamp source; no placeholder/override supplied.'}); return
            raise PreparationError(f'Missing committed dependency: {owner} -> {target}')
        selected.add(target); edges.append({'file': owner, 'target': target})
    while True:
        batch = sorted(name for name in selected - seen if name.endswith(('.js', '.mjs', '.html', '.css')))
        if not batch:
            break
        js = [name for name in batch if name.endswith(('.js', '.mjs'))]
        if js:
            result = subprocess.run(['node', '--no-warnings', '--experimental-vm-modules', '-e', MODULE_AUDIT], input=json.dumps([{'file': name, 'source': text(name)} for name in js]), text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            if result.returncode:
                raise PreparationError('JavaScript syntax audit failed: ' + result.stderr.strip())
            for row in json.loads(result.stdout):
                for spec in row['imports']:
                    add(row['file'], spec, module=True)
        for name in batch:
            source = text(name)
            if name.endswith(('.js', '.mjs')):
                refs, unknown = lexical_refs(source)
                if unknown:
                    raise PreparationError(f'Nonliteral dynamic module import needs explicit dependency review: {name}: {unknown}')
                for spec in refs:
                    add(name, spec)
            elif name.endswith('.html'):
                html = ResourceHTML(); html.feed(source)
                for spec in html.refs:
                    add(name, spec)
            else:
                for match in re.finditer(r'''url\(\s*["']?([^\s"')]+)''', source):
                    add(name, match.group(1))
        seen.update(batch)
    return selected, {'method': 'V8 static module parsing without evaluation; literal dynamic imports/new URL, HTML subresources and CSS URLs. Template prefixes conservatively expand committed candidates.', 'browserEntryPoints': ['game/index.html', 'game/dev/harness/page/index.js'], 'syntaxCheckedFiles': sorted(seen), 'moduleSyntaxCheckedFiles': sorted(p for p in seen if p.endswith(('.js', '.mjs'))), 'resourceParsedFiles': sorted(p for p in seen if p.endswith(('.html', '.css'))), 'localDependencies': edges, 'dynamicPatterns': dynamic, 'externalSpecifiers': external, 'optionalAbsentResources': optional, 'dependencyAddedFiles': sorted(selected - initial), 'unresolvedDynamicModuleImports': []}

def verify_archive(runtime, entries):
    actual_files = {str(p.relative_to(runtime)) for p in runtime.rglob('*') if p.is_file() or p.is_symlink()}
    if actual_files != set(entries):
        raise PreparationError(f'Copied/served file set differs from the exact manifest: missing={sorted(set(entries)-actual_files)}, extra={sorted(actual_files-set(entries))}')
    hashes, blobs = {}, {}
    for name, entry in entries.items():
        if entry['mode'] not in ['100644', '100755'] or (runtime / name).is_symlink():
            raise PreparationError(f'Non-regular runtime source requires explicit review: {name}')
        data = (runtime / name).read_bytes()
        oid = hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest()
        if oid != entry['blob']:
            raise PreparationError(f'Archive bytes differ from the exact source commit: {name}')
        hashes[name] = hashlib.sha256(data).hexdigest(); blobs[name] = oid
    return hashes, blobs

def prepare(revision, base, runtime_only=False, repo=REPO, tool_repo=REPO):
    if not re.fullmatch(r'[a-f0-9]{40}', revision):
        raise PreparationError('Supply the actual full40-character source SHA.')
    base = Path(base).resolve()
    if base.exists():
        raise PreparationError(f'Preserve existing evidence; destination already exists: {base}')
    if git(repo, 'rev-parse', revision + '^{commit}').decode().strip() != revision:
        raise PreparationError('Requested source did not resolve to its exact commit.')
    tree = catalogue(repo, revision)
    missing_protocol = [p for p in PROTOCOL_INPUTS if p not in tree]
    if missing_protocol:
        raise PreparationError(f'Missing committed900 protocol input: {missing_protocol}')
    prefixes = CORE_PATHS + [PAGE_PATH if runtime_only else 'game/dev']
    prefixes = [p for p in prefixes if any(under(name, p) for name in tree)]
    initial = {name for name in tree if any(under(name, p) for p in prefixes)}
    audit_initial = {name for name in initial if not name.startswith('game/dev/') or under(name, PAGE_PATH)}
    required, audit = dependency_audit(repo, revision, tree, audit_initial)
    selected = initial | required
    tool_commit = git(tool_repo, 'rev-parse', 'HEAD').decode().strip(); tool_bytes = {}
    for output, source in TOOLS.items():
        data = (tool_repo / source).read_bytes()
        if data != git(tool_repo, 'show', tool_commit + ':' + source):
            raise PreparationError(f'Uncommitted tool bytes cannot be silently frozen: {source}')
        tool_bytes[output] = data
    base.mkdir(parents=True); runtime, out = base / 'source', base / 'raw'; runtime.mkdir(); out.mkdir()
    archive = base / 'source.tar'
    with archive.open('wb') as output:
        subprocess.run(['git', 'archive', '--format=tar', revision, *sorted(selected)], cwd=repo, stdout=output, check=True)
    with tarfile.open(archive) as source:
        source.extractall(runtime, filter='data')
    archive.unlink()
    entries = {name: tree[name] for name in sorted(selected)}
    hashes, blobs = verify_archive(runtime, entries)
    omitted = [{'prefix': prefix, 'omittedFiles': len([p for p in tree if p.startswith(prefix) and p not in selected]), 'omittedBytes': sum(v['bytes'] for p, v in tree.items() if p.startswith(prefix) and p not in selected), 'retainedDependencyFiles': sorted(p for p in selected if p.startswith(prefix))} for prefix in OMITTED_PREFIXES]
    manifest = {'commit': revision, 'tree': git(repo, 'rev-parse', revision + '^{tree}').decode().strip(), 'files': hashes, 'gitBlobs': blobs, 'runtimePaths': prefixes, 'includedFiles': sorted(selected), 'includedBytes': sum(v['bytes'] for v in entries.values()), 'archiveMode': 'runtime-only' if runtime_only else 'legacy-bulk-dev', 'partialArchive': True, 'omittedNonruntimePrefixes': omitted, 'dependencyAddedFiles': audit['dependencyAddedFiles'], 'scope': 'Partial exact repository archive for game runtime and the900 browser harness; unused overview/research/dev galleries omitted in runtime-only mode. Every copied/servable file matches its committed Git blob and SHA256; no shipped source overrides.'}
    (out / 'source-manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    (out / 'dependency-audit.json').write_text(json.dumps(audit, indent=2) + '\n')
    tool_hashes = {}
    for output, data in tool_bytes.items():
        (out / output).write_bytes(data); tool_hashes[output] = hashlib.sha256(data).hexdigest()
    releases = {}
    for name in ['game/release.json', 'game/meta/release.json']:
        if (runtime / name).exists():
            output = 'original-release.json' if not releases else 'original-release-legacy-meta.json'
            shutil.copyfile(runtime / name, out / output)
            releases[name] = {'copy': output, 'sha256': hashes[name]}
    command = ['node', str(out / 'runner.cjs'), str(runtime), str(out), '15']
    plan = {'status': 'prepared-not-launched', 'preparedUtc': datetime.now(timezone.utc).isoformat(), 'sourceCommit': revision, 'toolCommit': tool_commit, 'sourceRoot': str(runtime), 'out': str(out), 'command': command, 'runnerSha256': tool_hashes['runner.cjs'], 'toolSha256': tool_hashes, 'preparationScriptSha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest(), 'archiveMode': manifest['archiveMode'], 'partialArchive': True, 'includedFiles': len(hashes), 'includedBytes': manifest['includedBytes'], 'originalRelease': {'present': bool(releases), 'files': releases}, 'environment': {'NODE_PATH': '/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules', 'NODE_OPTIONS': '--require=/workspace/.environment/drive-my-cv/use-system-chromium.cjs', 'SOAK_WALLCLOCK': '1'}, 'scope': 'New combined-source native560/631 physical900 high/full true-mirror and evolved night/rain. Preparation never starts a browser; final source must be supplied by root.'}
    (out / 'prepared.json').write_text(json.dumps(plan, indent=2) + '\n')
    return {'sourceCommit': revision, 'sourceRoot': str(runtime), 'out': str(out), 'archiveMode': manifest['archiveMode'], 'verifiedRuntimeFiles': len(hashes), 'verifiedRuntimeBytes': manifest['includedBytes'], 'moduleSyntaxCheckedFiles': len(audit['moduleSyntaxCheckedFiles']), 'resourceParsedFiles': len(audit['resourceParsedFiles']), 'command': command, 'browserLaunched': False}

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('revision'); parser.add_argument('new_evidence_base', type=Path)
    parser.add_argument('--runtime-only', action='store_true', help='Required for final900: omit unused overview/research/dev galleries, retain actual browser harness dependencies.')
    args = parser.parse_args()
    try:
        print(json.dumps(prepare(args.revision, args.new_evidence_base, args.runtime_only), indent=2))
    except PreparationError as error:
        parser.exit(2, str(error) + '\n')
