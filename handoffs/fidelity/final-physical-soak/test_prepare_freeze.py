"""Disposable Git fixtures: archive integrity and dependency failures, no browser."""
from pathlib import Path
import importlib.util
import json
import subprocess
import tempfile
import unittest

HERE = Path(__file__).resolve().parent
SPEC = importlib.util.spec_from_file_location('soak_prepare', HERE / 'prepare-freeze.py')
PREP = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(PREP)

class PrepareTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='soak-prepare-fixture-')
        self.base = Path(self.temp.name)
        self.repo = self.base / 'repo'; self.repo.mkdir()
        self.run_git('init', '-q')
        self.fixture = {
            'game/index.html': '<link rel="stylesheet" href="./style.css"><script type="module" src="./src/main.js"></script>',
            'game/style.css': '@font-face{src:url(../public/font.woff2)}',
            'game/src/main.js': "import './part.js'; import(`./scenes/${name}.js`);",
            'game/src/part.js': 'export const part=1;',
            'game/src/scenes/one.js': 'export const scene=1;',
            'game/data/bucharest-romana.json': '{"buildings":[]}',
            'game/vendor/library.js': 'export const library=1;',
            'game/assets/picture.svg': '<svg/>',
            'game/dev/harness/page/index.js': "import './util.js';import '../shared.js';",
            'game/dev/harness/page/util.js': 'export const sleep=()=>{};',
            'game/dev/harness/shared.js': "export const fixture=new URL('./fixtures/physical.json',import.meta.url);",
            'game/dev/harness/fixtures/physical.json': '{"required":true}',
            'game/dev/galleries/unused.webp': 'unused dev gallery',
            'game/overview/unused.webp': 'unused overview gallery',
            'game/research/unused.json': '{"reference":"unused"}',
            'public/font.woff2': 'font bytes',
            'package.json': '{"private":true}',
            'index.html': '<script src="./index.js"></script><link rel="stylesheet" href="./index.css">',
            'index.js': 'const rootPage=1;',
            'index.css': 'body{color:#fff}',
            'canvas.js': 'const canvasSupport=1;',
            'tools/telemetry/stamp-release.mjs': "import fs from 'node:fs';export const stamp=1;",
            'game/release.json': '{\n "sourceCommit": "original", "fingerprint": "untouched"\n}\n',
            'game/meta/release.json': '{"legacy":"also preserved"}\n',
        }
        for name in ['render.js', 'progressive-pmrem.js', 'world.js', 'traffic.js', 'vehicles.js']:
            self.fixture['game/src/' + name] = 'export const fixture=true;'
        for name, content in self.fixture.items():
            self.write(name, content)
        self.commit()
    def tearDown(self):
        self.temp.cleanup()
    def run_git(self, *args):
        return subprocess.check_output(['git', *args], cwd=self.repo, stderr=subprocess.PIPE).decode().strip()
    def write(self, name, content):
        target = self.repo / name; target.parent.mkdir(parents=True, exist_ok=True); target.write_text(content)
    def commit(self):
        self.run_git('add', '-A')
        self.run_git('-c', 'user.name=CalinaCristian', '-c', 'user.email=cristycalina@gmail.com', 'commit', '-qm', 'Disposable preparation fixture')
        self.revision = self.run_git('rev-parse', 'HEAD')
    def prepare(self, name='bundle', minimal=True):
        return PREP.prepare(self.revision, self.base / name, minimal, repo=self.repo)
    def test_actual_imported_harness_files_included_galleries_omitted(self):
        result = self.prepare(); root = Path(result['sourceRoot']); raw = Path(result['out'])
        manifest = json.loads((raw / 'source-manifest.json').read_text())
        self.assertFalse(result['browserLaunched']); self.assertEqual(manifest['archiveMode'], 'runtime-only')
        for name in ['game/dev/harness/page/index.js', 'game/dev/harness/page/util.js', 'game/dev/harness/shared.js', 'game/dev/harness/fixtures/physical.json']:
            self.assertTrue((root / name).is_file(), name)
        for name in ['game/dev/galleries/unused.webp', 'game/overview/unused.webp', 'game/research/unused.json']:
            self.assertFalse((root / name).exists(), name)
        self.assertEqual(set(manifest['files']), set(manifest['gitBlobs']))
        self.assertEqual(set(manifest['files']), {str(f.relative_to(root)) for f in root.rglob('*') if f.is_file()})
        self.assertIn('game/dev/harness/shared.js', manifest['dependencyAddedFiles'])
    def test_missing_transitive_module_fails_before_archive(self):
        (self.repo / 'game/dev/harness/page/util.js').unlink(); self.commit()
        with self.assertRaisesRegex(PREP.PreparationError, 'Missing committed dependency.*util.js'):
            self.prepare()
        self.assertFalse((self.base / 'bundle').exists())
    def test_missing_actual_browser_harness_entry_rejected(self):
        (self.repo / 'game/dev/harness/page/index.js').unlink(); self.commit()
        with self.assertRaisesRegex(PREP.PreparationError, 'protocol input.*page/index.js'):
            self.prepare()
    def test_missing_literal_harness_asset_fails(self):
        (self.repo / 'game/dev/harness/fixtures/physical.json').unlink(); self.commit()
        with self.assertRaisesRegex(PREP.PreparationError, 'Missing committed dependency.*physical.json'):
            self.prepare()
    def test_syntax_failure_never_marks_bundle_prepared(self):
        self.write('game/src/part.js', 'export const broken=;'); self.commit()
        with self.assertRaisesRegex(PREP.PreparationError, 'syntax audit failed'):
            self.prepare()
        self.assertFalse((self.base / 'bundle/raw/prepared.json').exists())
    def test_nonliteral_dynamic_import_requires_review(self):
        self.write('game/src/part.js', 'import(moduleURL);'); self.commit()
        with self.assertRaisesRegex(PREP.PreparationError, 'Nonliteral dynamic module import'):
            self.prepare()
    def test_static_parser_does_not_execute_shipped_code_or_comment_examples(self):
        self.write('game/src/part.js', "// import('./missing.js')\nconst example=\"import('./also-missing.js')\";throw new Error('must never execute');")
        self.commit(); self.assertFalse(self.prepare()['browserLaunched'])
    def test_actual_and_legacy_release_bytes_preserved(self):
        result = self.prepare(); root = Path(result['sourceRoot']); raw = Path(result['out'])
        self.assertEqual((raw / 'original-release.json').read_bytes(), self.fixture['game/release.json'].encode())
        self.assertEqual((raw / 'original-release-legacy-meta.json').read_bytes(), self.fixture['game/meta/release.json'].encode())
        self.assertEqual((root / 'game/release.json').read_bytes(), self.fixture['game/release.json'].encode())
    def test_existing_out_refused_without_replacing_evidence(self):
        result = self.prepare(); marker = Path(result['out']) / 'keep.txt'; marker.write_text('retained')
        with self.assertRaisesRegex(PREP.PreparationError, 'already exists'):
            self.prepare()
        self.assertEqual(marker.read_text(), 'retained')
    def test_tamper_or_extra_servable_override_rejected(self):
        result = self.prepare(); root = Path(result['sourceRoot']); manifest = json.loads((Path(result['out']) / 'source-manifest.json').read_text()); tree = PREP.catalogue(self.repo, self.revision); entries = {name: tree[name] for name in manifest['includedFiles']}
        target = root / 'game/index.html'; original = target.read_bytes(); target.write_bytes(original + b'<meta name="game-source" content="override">')
        with self.assertRaisesRegex(PREP.PreparationError, 'Archive bytes differ'):
            PREP.verify_archive(root, entries)
        target.write_bytes(original); (root / 'unchecked-override.js').write_text('override')
        with self.assertRaisesRegex(PREP.PreparationError, 'extra='):
            PREP.verify_archive(root, entries)
    def test_legacy_bulk_dev_mode_is_explicitly_labelled(self):
        result = self.prepare(minimal=False)
        self.assertEqual(result['archiveMode'], 'legacy-bulk-dev')
        self.assertTrue((Path(result['sourceRoot']) / 'game/dev/galleries/unused.webp').is_file())
    def test_external_modules_not_fetched_but_local_escape_rejected(self):
        self.write('game/src/part.js', "import 'https://example.test/external.js';"); self.commit()
        self.assertFalse(self.prepare()['browserLaunched'])
        self.write('index.js', "import '../outside.js';"); self.commit()
        with self.assertRaisesRegex(PREP.PreparationError, 'escapes the archived repository'):
            self.prepare(name='second')

if __name__ == '__main__':
    unittest.main(verbosity=2)
