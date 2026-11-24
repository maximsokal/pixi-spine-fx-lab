import hashlib
import json
import subprocess
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


if __name__ == '__main__':
    unittest.main(verbosity=2)
