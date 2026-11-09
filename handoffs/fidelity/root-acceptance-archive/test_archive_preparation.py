"""Bounded disposable-Git controls; never execute a shipped test or browser."""
from pathlib import Path
import importlib.util
import json
import unittest

HERE = Path(__file__).resolve().parent


def module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    result = importlib.util.module_from_spec(spec); spec.loader.exec_module(result)
    return result


P = module('root_prepare', HERE / 'prepare-root-acceptance.py')
FIXTURE = module('fixture_prepare', HERE.parent / 'final-physical-soak/test_prepare_freeze.py')


class RootAcceptanceTests(unittest.TestCase):
    def setUp(self):
        self.fixture = FIXTURE.PrepareTests()
        self.fixture.setUp()
        self.repo = self.fixture.repo; self.base = self.fixture.base
        for name, source in {
            P.RUN: "const fs=require('fs'),path=require('path');\n" + P.VISUAL_BRANCH + '\n' + P.ROOT_DECLARATION + "\nrequire('./report.js');",
            P.REPORT: "module.exports={writeReport:()=>{}};",
            'game/dev/harness/README.md': 'Fixture harness help',
            'game/dev/acceptance.test.mjs': "import './acceptance-helper.js'; export const fixture=new URL('../research/needed.json',import.meta.url);",
            'game/dev/acceptance-helper.js': 'export const helper=true;',
            'game/research/needed.json': '{"required":true}',
            'game/dev/harness/privacy.test.cjs': "const fs=require('node:fs');const {resolve}=require('node:path');fs.readFileSync(resolve(__dirname,'../../../public/telemetry.js'));",
            'public/telemetry.js': 'const fixture=true;',
        }.items():
            self.fixture.write(name, source)
        self.fixture.commit(); self.revision = self.fixture.revision
    def tearDown(self):
        self.fixture.tearDown()
    def prepare(self):
        return P.prepare(self.revision, self.base / 'acceptance', repo=self.repo)
    def test_exact_transitive_selection_and_native_root_command(self):
        result = self.prepare(); raw = Path(result['out']); root = Path(result['sourceRoot'])
        manifest = json.loads((raw / 'source-manifest.json').read_text()); plan = json.loads((raw / 'prepared.json').read_text())
        self.assertEqual(result['testFiles'], 2); self.assertFalse(result['browserLaunched'])
        for name in ['game/research/needed.json', 'game/dev/acceptance-helper.js', P.RUN, P.REPORT]:
            self.assertIn(name, manifest['files'])
        for name in ['game/overview/unused.webp', 'game/research/unused.json', 'game/dev/galleries/unused.webp']:
            self.assertNotIn(name, manifest['files'])
        self.assertEqual(plan['cwd'], str(root)); self.assertEqual(plan['footACommand'][1], str(root / P.RUN))
        self.assertIn('--port=0', plan['footACommand']); self.assertIn('--out=' + str(raw / 'foot-a'), plan['footACommand'])
        self.assertTrue(P.verify(self.base / 'acceptance', self.revision)['allGitBlobsAndSha256Match'])
    def test_missing_transitive_fixture_fails_before_archive(self):
        (self.repo / 'game/research/needed.json').unlink(); self.fixture.commit()
        with self.assertRaisesRegex(P.P.PreparationError, 'Missing committed acceptance dependency'):
            P.prepare(self.fixture.revision, self.base / 'acceptance', repo=self.repo)
        self.assertFalse((self.base / 'acceptance').exists())
    def test_new_unreviewed_dynamic_test_import_rejected(self):
        self.fixture.write('game/dev/acceptance.test.mjs', 'await import(unreviewedPath);'); self.fixture.commit()
        with self.assertRaisesRegex(P.P.PreparationError, 'Unreviewed dynamic acceptance import'):
            P.prepare(self.fixture.revision, self.base / 'acceptance', repo=self.repo)
    def test_test_syntax_and_repository_escape_rejected(self):
        self.fixture.write('game/dev/acceptance.test.mjs', 'export const broken=;'); self.fixture.commit()
        with self.assertRaisesRegex(P.P.PreparationError, 'syntax audit failed'):
            P.prepare(self.fixture.revision, self.base / 'acceptance', repo=self.repo)
        self.fixture.write('game/dev/acceptance.test.mjs', "import '../../../outside.js';"); self.fixture.commit()
        with self.assertRaisesRegex(P.P.PreparationError, 'escapes the archived repository'):
            P.prepare(self.fixture.revision, self.base / 'acceptance', repo=self.repo)
    def test_root_contract_change_rejected(self):
        self.fixture.write(P.RUN, 'const ROOT="live-worktree";'); self.fixture.commit()
        with self.assertRaisesRegex(P.P.PreparationError, 'ROOT contract changed'):
            P.prepare(self.fixture.revision, self.base / 'acceptance', repo=self.repo)
    def test_out_reuse_and_postrun_tamper_rejected(self):
        result = self.prepare()
        with self.assertRaisesRegex(P.P.PreparationError, 'destination already exists'):
            self.prepare()
        (Path(result['sourceRoot']) / P.RUN).write_text('changed runtime')
        with self.assertRaisesRegex(P.P.PreparationError, 'Archive bytes differ'):
            P.verify(self.base / 'acceptance', self.revision)


if __name__ == '__main__':
    unittest.main(verbosity=2)
