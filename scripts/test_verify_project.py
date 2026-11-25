"""Offline shell checks must follow browser attribute and link semantics."""
import hashlib
import json
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch

import verify_project as V


class OfflineSurfaceTests(unittest.TestCase):
    def setUp(self):
        tmp = TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.root = Path(tmp.name) / 'assets/template'
        (self.root / 'src').mkdir(parents=True)
        pinned = b'fixture runtime'
        (self.root / 'runtime.js').write_bytes(pinned)
        (self.root / 'template.json').write_text(json.dumps({
            'runtime': {'pixi': '8.22.0', 'spine': '4.2.120'},
            'protectedFiles': {'runtime.js': hashlib.sha256(pinned).hexdigest()},
            'browserScripts': ['runtime.js'],
        }), encoding='utf8')
        self.controls = ('viewport cameraPlane settings skeletonFile atlasFile textureFiles '
                         'loadPreview animation skin background play reset finish progress '
                         'duration durationFrames bakeWidth bakeHeight bakeX bakeY bakeOverlay '
                         'bakeAreaHandle bakeStart bakeCancel cameraZoomIn cameraZoomOut '
                         'cameraFit cameraActual exportWebGL exportWebGPU').split()
        self.html = ''.join(f'<div id="{name}"></div>' for name in self.controls)
        self.addCleanup(patch.stopall)
        patch.object(V, '__file__', str(Path(tmp.name) / 'scripts/verify_project.py')).start()

    def verify(self, html):
        output = self.root / 'src/ui.html'
        output.write_text(html, encoding='utf8')
        return V.verify(self.root, output)

    def test_valid_offline_markup(self):
        result = self.verify(self.html + '<script>void 0</script>'
                             '<link rel="stylesheet" href="data:text/css,body{}">')
        self.assertEqual(result, {'protectedFiles': 1, 'preservedControls': 30, 'htmlChecked': True})

    def test_rel_case_insensitive(self):
        with self.assertRaisesRegex(ValueError, 'External script/style'):
            self.verify(self.html + '<link rel="StyleSheet" href="https://example.invalid/a.css">')

    def test_rel_is_ascii_whitespace_separated_tokens(self):
        with self.assertRaisesRegex(ValueError, 'External script/style'):
            self.verify(self.html + '<link rel="alternate\tstylesheet" title="theme" href="a.css">')

    def test_first_script_src_cannot_be_hidden(self):
        with self.assertRaisesRegex(ValueError, 'External script/style'):
            self.verify(self.html + '<script src="https://example.invalid/a.js" src=""></script>')

    def test_first_stylesheet_href_cannot_be_hidden(self):
        with self.assertRaisesRegex(ValueError, 'External script/style'):
            self.verify(self.html + '<link rel="stylesheet" href="a.css" href="data:text/css,body{}">')

    def test_first_rel_cannot_be_hidden(self):
        with self.assertRaisesRegex(ValueError, 'External script/style'):
            self.verify(self.html + '<link rel="stylesheet" rel="next" href="a.css">')

    def test_second_id_is_not_a_preserved_control(self):
        with self.assertRaisesRegex(ValueError, 'Expected one preserved control ID: viewport'):
            self.verify(self.html.replace('id="viewport"', 'id="other" id="viewport"', 1))

    def test_first_id_is_the_browser_id(self):
        result = self.verify(self.html.replace('id="viewport"', 'id="viewport" id="other"', 1))
        self.assertEqual(result['preservedControls'], 30)

    def test_embedded_stylesheet_with_case_and_spaces(self):
        result = self.verify(self.html + '<link rel="stylesheet" href=" DATA:text/css,body{} ">')
        self.assertEqual(result['preservedControls'], 30)

    def test_valueless_stylesheet_href_has_controlled_failure(self):
        with self.assertRaisesRegex(ValueError, 'External script/style'):
            self.verify(self.html + '<link rel="stylesheet" href>')

    def test_non_stylesheet_rel_not_treated_as_stylesheet(self):
        result = self.verify(self.html + '<link rel="notstylesheet" href="a.css">')
        self.assertEqual(result['preservedControls'], 30)


if __name__ == '__main__':
    unittest.main()
