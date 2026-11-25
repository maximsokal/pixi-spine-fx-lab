import hashlib
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

import agent_scope as S


class ScopeTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.repo = Path(self.tmp.name)
        self.git('init', '-q')
        self.git('config', 'user.name', 'Fixture')
        self.git('config', 'user.email', 'fixture@example.invalid')
        self.write('assets/template/vendor/pixi.js', b'pinned runtime')
        self.write('assets/template/template.json', json.dumps({'protectedFiles': {
            'vendor/pixi.js': hashlib.sha256(b'pinned runtime').hexdigest()}}).encode())
        self.write('assets/fire/src/core.js', b'old')
        self.write('assets/water/src/core.js', b'water')
        self.base = self.commit()

    def git(self, *args):
        return subprocess.check_output(['git', '-C', str(self.repo), *args]).decode().strip()

    def write(self, name, data):
        p = self.repo / name
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_bytes(data)

    def commit(self):
        self.git('add', '-A')
        self.git('commit', '-qm', 'fixture')
        return self.git('rev-parse', 'HEAD')

    def check(self, allow, candidate=None):
        return S.audit(self.repo, self.base, candidate or self.git('rev-parse', 'HEAD'), allow)

    def test_scoped_change(self):
        self.write('assets/fire/src/core.js', b'new')
        self.commit()
        result = self.check(['assets/fire/src/core.js'])
        self.assertEqual(result['status'], 'PASS')
        self.assertEqual(result['checks']['renderer'], 'NOT RUN')
        self.assertEqual([x['path'] for x in result['changes']], ['assets/fire/src/core.js'])
        self.assertEqual(result['protectedVerified'], 1)

    def test_unrelated_change_and_deletion_detected(self):
        self.write('assets/fire/src/core.js', b'new')
        (self.repo / 'assets/water/src/core.js').unlink()
        self.commit()
        r = self.check(['assets/fire/src/core.js'])
        self.assertEqual(r['status'], 'FAIL')
        self.assertIn('assets/water/src/core.js', r['outsideScope'])

    def test_rename_counts_both_paths(self):
        self.git('mv', 'assets/fire/src/core.js', 'assets/fire/src/renamed.js')
        self.commit()
        r = self.check(['assets/fire/src/renamed.js'])
        self.assertEqual(r['outsideScope'], ['assets/fire/src/core.js'])
        self.assertEqual(len(r['changes']), 2)

    def test_protected_file_not_overridable_by_allowlist(self):
        self.write('assets/template/vendor/pixi.js', b'changed')
        self.commit()
        r = self.check(['assets/template/vendor/pixi.js'])
        self.assertEqual(r['status'], 'FAIL')
        self.assertIn('assets/template/vendor/pixi.js', r['protectedChanges'])
        self.assertIn('assets/template/vendor/pixi.js', r['integrityFailures'])

    def test_manifest_cannot_redefine_protected_hash(self):
        self.write('assets/template/template.json', b'{"protectedFiles":{}}')
        self.commit()
        r = self.check(['assets/template/template.json'])
        self.assertEqual(r['status'], 'FAIL')
        self.assertIn('assets/template/template.json', r['protectedChanges'])
        self.assertEqual(r['protectedVerified'], 1)

    def test_symlink_rejected_even_when_approved(self):
        (self.repo / 'assets/fire/src/link.js').symlink_to('/tmp/outside')
        self.commit()
        r = self.check(['assets/fire/src/link.js'])
        self.assertEqual(r['status'], 'FAIL')
        self.assertEqual(r['unsafeModes'], ['assets/fire/src/link.js'])

    def test_invalid_scope_and_ref(self):
        for path in ['../x', '/absolute', 'assets/*/src', 'a\\b', 'a//b', 'a/./b', '']:
            with self.subTest(path=path), self.assertRaises(ValueError):
                self.check([path])
        with self.assertRaises(ValueError):
            self.check([], '--help')

    def test_dirty_worktree_is_not_claimed_checked(self):
        self.write('untracked.js', b'not in commit')
        r = self.check([])
        self.assertEqual(r['status'], 'PASS')
        self.assertEqual(r['checks']['worktree'], 'NOT RUN')

    def test_corrupt_baseline_fails_even_when_unchanged(self):
        self.write('assets/template/vendor/pixi.js', b'wrong')
        self.base = self.commit()
        r = self.check([])
        self.assertEqual(r['status'], 'FAIL')
        self.assertEqual(r['integrityFailures'], ['assets/template/vendor/pixi.js'])

    def test_candidate_replacement_cannot_hide_outside_scope(self):
        self.write('assets/water/src/core.js', b'changed')
        candidate = self.commit()
        self.git('replace', candidate, self.base)
        r = self.check([], candidate)
        self.assertEqual(r['status'], 'FAIL')
        self.assertEqual(r['candidate'], candidate)
        self.assertEqual(r['outsideScope'], ['assets/water/src/core.js'])
        self.assertEqual(self.git('replace', '-l'), candidate)

    def test_baseline_replacement_cannot_hide_outside_scope(self):
        self.write('assets/water/src/core.js', b'changed')
        candidate = self.commit()
        self.git('replace', self.base, candidate)
        r = self.check([], candidate)
        self.assertEqual(r['status'], 'FAIL')
        self.assertEqual(r['base'], self.base)
        self.assertEqual(r['outsideScope'], ['assets/water/src/core.js'])

    def test_tree_replacement_cannot_hide_outside_scope(self):
        original_tree = self.git('rev-parse', self.base + '^{tree}')
        self.write('assets/water/src/core.js', b'changed')
        candidate = self.commit()
        candidate_tree = self.git('rev-parse', candidate + '^{tree}')
        self.git('replace', candidate_tree, original_tree)
        r = self.check([], candidate)
        self.assertEqual(r['status'], 'FAIL')
        self.assertEqual(r['outsideScope'], ['assets/water/src/core.js'])

    def test_blob_replacement_cannot_mask_corrupt_protected_bytes(self):
        path = 'assets/template/vendor/pixi.js'
        good = self.git('rev-parse', self.base + ':' + path)
        self.write(path, b'corrupt runtime')
        self.base = self.commit()
        bad = self.git('rev-parse', self.base + ':' + path)
        self.git('replace', bad, good)
        r = self.check([], self.base)
        self.assertEqual(r['status'], 'FAIL')
        self.assertEqual(r['integrityFailures'], [path])
        self.assertEqual(r['protectedVerified'], 0)

    def test_cli_statuses_ignore_replacements_without_mutating_them(self):
        self.write('assets/fire/src/core.js', b'new')
        candidate = self.commit()
        self.git('replace', candidate, self.base)
        command = [sys.executable, S.__file__, '--repo', str(self.repo),
                   '--base', self.base, '--candidate', candidate]
        for args, code, status in [([], 1, 'FAIL'),
                                   (['--allow', 'assets/fire/src/core.js'], 0, 'PASS'),
                                   (['--allow', '../invalid'], 2, 'UNVERIFIED')]:
            with self.subTest(status=status):
                p = subprocess.run(command + args, capture_output=True, text=True)
                self.assertEqual(p.returncode, code, p.stdout + p.stderr)
                self.assertEqual(json.loads(p.stdout)['status'], status)
        self.assertEqual(self.git('replace', '-l'), candidate)


    def raw_object(self, kind, data):
        # Deliberately malformed tree objects exist only in this disposable repository.
        return subprocess.check_output(
            ['git', '-C', str(self.repo), 'hash-object', '-w', '-t', kind,
             '--stdin', '--literally'], input=data).decode().strip()

    def duplicate_root_entry(self, name, mode, oid):
        original = subprocess.check_output(
            ['git', '-C', str(self.repo), 'cat-file', 'tree', self.base + '^{tree}'])
        entry = mode.encode() + b' ' + name.encode() + b'\0' + bytes.fromhex(oid)
        tree = self.raw_object('tree', entry + original)
        return self.git('commit-tree', tree, '-p', self.base, '-m', 'malformed fixture')

    def test_duplicate_leaf_cannot_hide_unapproved_blob(self):
        self.write('README.md', b'approved')
        self.base = self.commit()
        bad = self.raw_object('blob', b'unapproved')
        candidate = self.duplicate_root_entry('README.md', '100644', bad)
        with self.assertRaisesRegex(ValueError, 'Duplicate Git tree path'):
            self.check([], candidate)

    def test_duplicate_directory_detected_even_without_overlapping_leaves(self):
        empty = self.raw_object('tree', b'')
        candidate = self.duplicate_root_entry('assets', '40000', empty)
        with self.assertRaisesRegex(ValueError, 'Duplicate Git tree path'):
            self.check([], candidate)

    def test_duplicate_baseline_is_unverified_in_cli(self):
        empty = self.raw_object('tree', b'')
        baseline = self.duplicate_root_entry('assets', '40000', empty)
        command = [sys.executable, S.__file__, '--repo', str(self.repo),
                   '--base', baseline, '--candidate', self.base]
        result = subprocess.run(command, capture_output=True, text=True)
        self.assertEqual(result.returncode, 2, result.stdout + result.stderr)
        self.assertEqual(json.loads(result.stdout)['status'], 'UNVERIFIED')


if __name__ == '__main__':
    unittest.main(verbosity=2)
