"""Regression tests for import-safe, strict browser ZIP validator entry points."""
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest
import zipfile

SCRIPTS = Path(__file__).resolve().parent
VALIDATORS = (
    ('test_steam_packages', 'steam-qa', 'steam-baked.zip',
     'Missing actual browser ZIP', 'Unsafe ZIP member'),
    ('test_wind_packages', 'wind-qa', 'wind-burst.zip',
     'Missing actual browser archive', 'ZIP contains path traversal'),
)


class PackageCliDiscoveryTests(unittest.TestCase):
    def run_python(self, cwd, *args, env=None):
        return subprocess.run(
            [sys.executable, '-B', *args], cwd=cwd, env=env,
            capture_output=True, text=True, timeout=30,
        )

    def assert_failed(self, result, diagnostic):
        self.assertNotEqual(result.returncode, 0, result.stdout)
        self.assertIn(diagnostic, result.stderr)
        self.assertNotIn('PASS', result.stdout)

    def test_import_is_side_effect_free(self):
        for module, *_ in VALIDATORS:
            with self.subTest(module=module), tempfile.TemporaryDirectory() as cwd:
                code = (
                    'import sys, importlib\n'
                    'def audit(event, args):\n'
                    '    if event in ("subprocess.Popen", "os.system", "os.mkdir"):\n'
                    '        raise AssertionError("unexpected side effect: " + event)\n'
                    'sys.addaudithook(audit)\n'
                    f'sys.path.insert(0, {str(SCRIPTS)!r})\n'
                    'sys.argv = ["unittest", "unrelated-argument"]\n'
                    f'importlib.import_module({module!r})\n'
                )
                result = self.run_python(cwd, '-c', code)
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertEqual(result.stdout, '')
                self.assertEqual(result.stderr, '')
                self.assertEqual(list(Path(cwd).iterdir()), [])

    def test_focused_discovery_without_archives(self):
        with tempfile.TemporaryDirectory() as cwd:
            test_dir = Path(cwd) / 'scripts'
            test_dir.mkdir()
            for module, *_ in VALIDATORS:
                shutil.copyfile(SCRIPTS / (module + '.py'), test_dir / (module + '.py'))
            (test_dir / 'test_sentinel.py').write_text(
                'import unittest\nclass Sentinel(unittest.TestCase):\n'
                '    def test_discovered(self): pass\n', encoding='utf-8',
            )
            result = self.run_python(cwd, '-m', 'unittest', 'discover',
                                     '-s', str(test_dir), '-p', 'test_*.py')
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertIn('Ran 1 test', result.stderr)
            self.assertEqual(list(Path(cwd).iterdir()), [test_dir])

    def test_direct_cli_rejects_missing_archives_explicit_and_default(self):
        for module, default, archive, missing, _ in VALIDATORS:
            for explicit in (True, False):
                with self.subTest(module=module, explicit=explicit), tempfile.TemporaryDirectory() as cwd:
                    env = dict(os.environ, TMPDIR=cwd, TEMP=cwd, TMP=cwd)
                    base = Path(cwd) / ('explicit' if explicit else default)
                    args = [str(base)] if explicit else []
                    result = self.run_python(cwd, str(SCRIPTS / (module + '.py')), *args, env=env)
                    self.assert_failed(result, missing + ' ' + str(base / archive))

    def test_direct_cli_rejects_invalid_zip(self):
        for module, _, archive, *_ in VALIDATORS:
            with self.subTest(module=module), tempfile.TemporaryDirectory() as cwd:
                (Path(cwd) / archive).write_bytes(b'not a ZIP archive')
                result = self.run_python(cwd, str(SCRIPTS / (module + '.py')), cwd)
                self.assert_failed(result, 'BadZipFile')

    def test_direct_cli_rejects_traversal(self):
        for module, _, archive, _, unsafe in VALIDATORS:
            with self.subTest(module=module), tempfile.TemporaryDirectory() as cwd:
                with zipfile.ZipFile(Path(cwd) / archive, 'w') as z:
                    z.writestr('../escape.txt', 'synthetic negative fixture')
                result = self.run_python(cwd, str(SCRIPTS / (module + '.py')), cwd)
                self.assert_failed(result, unsafe)
                self.assertFalse((Path(cwd) / 'extracted' / 'escape.txt').exists())


if __name__ == '__main__':
    unittest.main()
