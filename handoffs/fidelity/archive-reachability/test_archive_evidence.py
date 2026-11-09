#!/usr/bin/env python3
"""Bounded archive retention controls; every mutation stays in temporary repos."""
import hashlib
import json
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

TOOL = Path(__file__).resolve().parents[3] / 'tools/fidelity/archive-evidence.py'
REPO_URL = 'https://github.com/CalinaCristian/CalinaCristian.github.io'


class ArchiveEvidenceTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='archive-evidence-control-')
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.repo = self.root / 'repo'
        self.repo.mkdir()
        self.git('init', '--initial-branch=master')
        for key, value in {
            'user.name': 'Archive Fixture', 'user.email': 'archive@example.invalid',
            'commit.gpgSign': 'false', 'tag.gpgSign': 'false', 'gc.auto': '0',
            'core.hooksPath': '/dev/null',
        }.items():
            self.git('config', key, value)
        tool = self.repo / 'tools/fidelity/archive-evidence.py'
        tool.parent.mkdir(parents=True)
        shutil.copyfile(TOOL, tool)
        (self.repo / 'README.md').write_text('Preserved source tree.\n')
        self.git('add', '.')
        self.git('commit', '-m', 'Fixture source')
        self.base = self.git('rev-parse', 'HEAD')
        tree = self.git('rev-parse', 'HEAD^{tree}')

        def commit(label, parent=True):
            return self.git('commit-tree', tree,
                            *(['-p', self.base] if parent else []), input=label + '\n')

        self.local = commit('Unrelated local task')
        self.remote = commit('Fetched remote task')
        self.detached_commit = commit('Detached native source')
        self.capture = commit('Capture orphan', False)
        self.implementation = commit('Implementation orphan', False)
        self.prior = commit('Prior record orphan', False)
        self.keyed = commit('Source dictionary key orphan', False)
        self.foreign = commit('Unrelated foreign repository link', False)
        self.git('update-ref', 'refs/heads/task/unrelated', self.local)
        self.git('update-ref', 'refs/remotes/upstream/live-task', self.remote)
        self.git('symbolic-ref', 'refs/remotes/upstream/HEAD',
                 'refs/remotes/upstream/live-task')
        self.detached = self.root / 'detached source é\nsnapshot'
        self.git('worktree', 'add', '--detach', '--no-checkout',
                 str(self.detached), self.detached_commit)
        self.record_path = 'game/overview/evidence/fixture.json'
        self.record = {
            'captureCommit': self.capture, 'baselineRevision': self.base,
            'capturedAt': '2026-01-02T03:04:05Z',
            'implementation': f'{REPO_URL}/blob/{self.implementation}/game/src/world.js',
            'priorRecord': f'{REPO_URL}/tree/{self.prior}/game/overview#source',
            'sourceRecords': {self.keyed: {'sourceCommit': self.capture}},
            'foreign': f'https://github.com/elsewhere/project/commit/{self.foreign}',
        }
        self.commit_record()

    def git(self, *args, input=None):
        return subprocess.check_output(['git', *args], cwd=self.repo,
                                       text=True, input=input, stderr=subprocess.PIPE).strip()

    def commit_record(self):
        target = self.repo / self.record_path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(json.dumps(self.record) + '\n')
        self.git('add', self.record_path)
        self.git('commit', '-m', 'Evidence records')
        self.source = self.git('rev-parse', 'HEAD')

    def run_tool(self, *args):
        return subprocess.run([sys.executable, 'tools/fidelity/archive-evidence.py', *args],
                              cwd=self.repo, text=True, capture_output=True, timeout=30)

    @staticmethod
    def snapshot(path):
        return {str(file.relative_to(path)): hashlib.sha256(file.read_bytes()).hexdigest()
                for file in path.rglob('*') if file.is_file()}

    def test_dry_run_is_read_only_and_reports_all_origins(self):
        before = self.snapshot(self.repo)
        detached_before = self.snapshot(self.detached)
        result = self.run_tool()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(before, self.snapshot(self.repo))
        self.assertEqual(detached_before, self.snapshot(self.detached))
        summary = json.loads(result.stdout)
        self.assertIsNone(summary['tag'])
        plan_path = self.root / 'plan.json'
        result = self.run_tool('--out', str(plan_path))
        self.assertEqual(result.returncode, 0, result.stderr)
        plan = json.loads(plan_path.read_text())
        for revision, kind in ((self.local, 'local-ref'), (self.remote, 'remote-ref'),
                               (self.detached_commit, 'worktree'),
                               (self.capture, 'source-record')):
            item = plan['commitProvenance'][revision]
            self.assertEqual(item['archiveParent'], revision)
            self.assertTrue(any(origin['kind'] == kind for origin in item['origins']))
        detached = next(item for item in plan['worktrees']
                        if item['path'] == str(self.detached))
        self.assertTrue(detached['detached'])
        self.assertEqual(detached['head'], self.detached_commit)
        self.assertEqual(plan['excludedSymbolicRefs'][0]['ref'], 'refs/remotes/upstream/HEAD')
        self.assertEqual(plan['commitProvenance'][self.base]['archiveParent'], self.source)
        self.assertNotIn(self.base, plan['archiveParents'])
        self.assertNotIn(self.foreign, plan['commitProvenance'])
        self.assertEqual(before, self.snapshot(self.repo))

    def test_archive_retains_objects_after_temporary_refs_and_worktree_are_removed(self):
        # Tags/cleanup below exist only inside this disposable fixture repository.
        plan_path = self.root / 'written.json'
        tree_before = self.git('rev-parse', 'HEAD^{tree}')
        record_before = self.git('show', 'HEAD:' + self.record_path)
        result = self.run_tool('--write-tag', 'fixture-archive', '--out', str(plan_path))
        self.assertEqual(result.returncode, 0, result.stderr)
        plan = json.loads(plan_path.read_text())
        archive = self.git('rev-parse', 'fixture-archive^{commit}')
        self.assertEqual(self.git('cat-file', '-t', 'fixture-archive'), 'tag')
        self.assertEqual(self.git('rev-parse', archive + '^{tree}'), tree_before)
        self.assertEqual(self.git('show', archive + ':' + self.record_path), record_before)
        parents = self.git('show', '-s', '--format=%P', archive).split()
        self.assertEqual(parents, plan['archiveParents'])
        self.git('update-ref', '-d', 'refs/heads/task/unrelated')
        self.git('update-ref', '-d', 'refs/remotes/upstream/live-task')
        self.git('symbolic-ref', '--delete', 'refs/remotes/upstream/HEAD')
        self.git('worktree', 'remove', '--force', str(self.detached))
        self.git('reflog', 'expire', '--expire=now', '--all')
        self.git('gc', '--prune=now')
        for revision in (self.local, self.remote, self.detached_commit, self.capture,
                         self.implementation, self.prior, self.keyed):
            self.git('cat-file', '-e', revision + '^{commit}')
            self.git('merge-base', '--is-ancestor', revision, archive)
        self.assertEqual(self.git('rev-parse', 'HEAD'), self.source)
        self.assertEqual(self.git('status', '--porcelain'), '')

    def test_missing_capture_object_emits_provenance_and_blocks_writes(self):
        missing = '9' * 40
        self.record['captureCommit'] = missing
        self.commit_record()
        before = self.snapshot(self.repo)
        plan_path = self.root / 'missing.json'
        result = self.run_tool('--write-tag', 'must-not-exist', '--out', str(plan_path))
        self.assertNotEqual(result.returncode, 0)
        plan = json.loads(plan_path.read_text())
        self.assertEqual(plan['missingCommitObjects'], [missing])
        provenance = plan['commitProvenance'][missing]
        self.assertEqual(provenance['objectStatus'], 'missing')
        self.assertIsNone(provenance['archiveParent'])
        self.assertEqual(provenance['origins'], [{'kind': 'source-record', 'path': self.record_path}])
        self.assertEqual(before, self.snapshot(self.repo))

    def test_missing_detached_head_is_never_silently_dropped(self):
        missing = '8' * 40
        gitdir = (self.detached / '.git').read_text().removeprefix('gitdir: ').strip()
        (Path(gitdir) / 'HEAD').write_text(missing + '\n')
        plan_path = self.root / 'missing-detached.json'
        result = self.run_tool('--out', str(plan_path))
        self.assertNotEqual(result.returncode, 0)
        plan = json.loads(plan_path.read_text())
        self.assertIn(missing, plan['missingCommitObjects'])
        origins = plan['commitProvenance'][missing]['origins']
        self.assertTrue(any(item['kind'] == 'worktree' and item['detached']
                            and item['path'] == str(self.detached) for item in origins))

    def test_noncommit_remote_tip_is_reported_and_blocks_writes(self):
        blob = self.git('hash-object', '-w', '--stdin', input='Invalid remote head\n')
        self.git('update-ref', 'refs/remotes/upstream/invalid-task', blob)
        before = self.snapshot(self.repo)
        plan_path = self.root / 'invalid.json'
        result = self.run_tool('--write-tag', 'must-not-exist', '--out', str(plan_path))
        self.assertNotEqual(result.returncode, 0)
        plan = json.loads(plan_path.read_text())
        self.assertEqual(plan['invalidCommitObjects'], {blob: 'blob'})
        self.assertEqual(plan['commitProvenance'][blob]['origins'], [
            {'kind': 'remote-ref', 'ref': 'refs/remotes/upstream/invalid-task'}])
        self.assertEqual(before, self.snapshot(self.repo))

    def test_existing_tag_is_not_replaced_or_given_another_archive_commit(self):
        self.git('tag', '-a', 'fixture-existing', '-m', 'Original fixture tag')
        before = self.snapshot(self.repo)
        result = self.run_tool('--write-tag', 'fixture-existing')
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(before, self.snapshot(self.repo))


if __name__ == '__main__':
    unittest.main(verbosity=2)
