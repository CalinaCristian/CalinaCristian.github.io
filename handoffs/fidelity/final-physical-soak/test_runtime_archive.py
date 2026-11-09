"""Compare a disposable exact-source minimal archive with a prior QA manifest.

This static control never imports shipped JavaScript or starts Chromium/HTTP.
Usage: python test_runtime_archive.py FULL_SHA PRIOR_QA_MANIFEST NEW_REPORT_DIR
"""
from pathlib import Path
from datetime import datetime, timezone
import argparse
import hashlib
import importlib.util
import json
import shutil
import subprocess
import tempfile

HERE = Path(__file__).resolve().parent
SPEC = importlib.util.spec_from_file_location('soak_prepare', HERE / 'prepare-freeze.py')
PREP = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(PREP)


def validate(revision, baseline_path, reports):
    baseline_bytes = baseline_path.read_bytes()
    baseline = json.loads(baseline_bytes)
    if baseline['commit'] != revision:
        raise ValueError('Baseline manifest belongs to a different source commit.')
    if reports.exists():
        raise ValueError('Preserve prior controls; report destination already exists.')
    reports.mkdir(parents=True)
    with tempfile.TemporaryDirectory(prefix='static-minimal-soak-') as temporary:
        result = PREP.prepare(revision, Path(temporary) / 'bundle', runtime_only=True)
        root, raw = Path(result['sourceRoot']), Path(result['out'])
        manifest = json.loads((raw / 'source-manifest.json').read_text())
        audit = json.loads((raw / 'dependency-audit.json').read_text())
        plan = json.loads((raw / 'prepared.json').read_text())
        for name, prior in baseline['files'].items():
            if manifest['files'].get(name) != prior['sha256'] or manifest['gitBlobs'].get(name) != prior['gitBlobSha1']:
                raise ValueError('Prior native-QA source bytes differ: ' + name)
        if any(p.startswith(('game/overview/', 'game/research/')) for p in manifest['files']):
            raise ValueError('Unused research/overview entered the runtime archive.')
        permitted_dev = set(audit['dependencyAddedFiles'])
        if any(p.startswith('game/dev/') and not p.startswith(PREP.PAGE_PATH + '/') and p not in permitted_dev for p in manifest['files']):
            raise ValueError('Unneeded developer files entered the runtime archive.')
        tool_syntax = []
        for tool in PREP.TOOLS:
            subprocess.run(['node', '--check', str(raw / tool)], check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            tool_syntax.append(tool)
        tree = PREP.catalogue(PREP.REPO, revision)
        entries = {p: tree[p] for p in manifest['includedFiles']}
        verified, blobs = PREP.verify_archive(root, entries)
        if verified != manifest['files'] or blobs != manifest['gitBlobs']:
            raise ValueError('Post-control source verification differs.')
        if (raw / 'launch.json').exists() or (raw / 'profile.json').exists() or result['browserLaunched']:
            raise ValueError('Static control unexpectedly has browser-run artifacts.')
        for filename in ['source-manifest.json', 'dependency-audit.json', 'prepared.json']:
            shutil.copyfile(raw / filename, reports / filename)
        summary = {
            'status': 'static-preparation-controls-pass',
            'checkedUtc': datetime.now(timezone.utc).isoformat(),
            'sourceCommit': revision,
            'toolCommit': plan['toolCommit'],
            'preparationScriptSha256': plan['preparationScriptSha256'],
            'controlScriptSha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
            'priorQaManifest': str(baseline_path),
            'priorQaManifestSha256': hashlib.sha256(baseline_bytes).hexdigest(),
            'priorQaFilesCompared': len(baseline['files']),
            'allPriorQaFilesMatchExactSha256AndGitBlob': True,
            'archiveMode': manifest['archiveMode'],
            'partialArchive': manifest['partialArchive'],
            'includedFiles': len(manifest['files']),
            'includedBytes': manifest['includedBytes'],
            'additionalFilesBeyondPriorQa': sorted(set(manifest['files']) - set(baseline['files'])),
            'moduleSyntaxCheckedFiles': len(audit['moduleSyntaxCheckedFiles']),
            'resourceParsedFiles': len(audit['resourceParsedFiles']),
            'localDependencyEdges': len(audit['localDependencies']),
            'frozenToolSyntaxChecked': tool_syntax,
            'frozenToolSha256': plan['toolSha256'],
            'postControlExactFileSetAndGitBlobAndSha256': True,
            'originalRelease': plan['originalRelease'],
            'browserLaunched': False,
            'scope': 'Static disposable archive/dependency/integrity control only; no HTTP server, browser, physical simulation or final-source acceptance. The temporary source and raw OUT paths in prepared.json are historical control paths, removed after this test; they must never be reused for the final run.',
        }
    summary['temporarySourceAndOutRemoved'] = not root.exists() and not raw.exists()
    if not summary['temporarySourceAndOutRemoved']:
        raise ValueError('Disposable source archive was not removed.')
    (reports / 'summary.json').write_text(json.dumps(summary, indent=2) + '\n')
    return summary


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('revision')
    parser.add_argument('prior_qa_manifest', type=Path)
    parser.add_argument('new_report_dir', type=Path)
    args = parser.parse_args()
    result = validate(args.revision, args.prior_qa_manifest, args.new_report_dir)
    print(json.dumps({key: result[key] for key in ['status', 'sourceCommit', 'includedFiles', 'includedBytes', 'priorQaFilesCompared', 'moduleSyntaxCheckedFiles', 'resourceParsedFiles', 'localDependencyEdges', 'browserLaunched', 'temporarySourceAndOutRemoved']}, indent=2))
