#!/usr/bin/env python3
"""Synthetic offline assembly tests, not GPU certification."""
import json
from pathlib import Path
import tempfile
import unittest
from build_blizzard_editor import build, MARKERS, VENDORS, CORES, EFFECT, PINS


class BlizzardBuilderTests(unittest.TestCase):
    def setUp(self):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        self.root = Path(temp.name)
        self.template = self.root / 'assets/template'
        self.effect = self.root / 'assets/blizzard/src'
        self.manifest = {'runtime': dict(PINS), 'sample': {'label': 'sample', 'skeleton': 'sample/s.json', 'atlas': 'sample/s.atlas', 'images': ['sample/p.png']}}
        self.write(self.template / 'template.json', json.dumps(self.manifest))
        self.write(self.template / 'sample/s.json', '{"skeleton":{"spine":"4.2.43"},"note":"</script>"}')
        self.write(self.template / 'sample/s.atlas', 'p.png\n')
        self.write(self.template / 'sample/p.png', 'fake bytes')
        for name in [*VENDORS, *(name for name, _ in CORES), 'licenses/spine.txt', 'licenses/pixi.txt']:
            self.write(self.template / name, '// ' + name)
        for name in [*(name for name, _ in EFFECT), 'blizzard-editor.js', 'blizzard-export.js']:
            self.write(self.effect / name, '// ' + name + '\nconst example = "</script>";')
        self.write(self.effect / 'ui.html', '\n'.join(MARKERS))

    @staticmethod
    def write(path, content):
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding='utf8')

    def test_assembly_order_escape_and_sample(self):
        html = build(self.root)
        order = [*VENDORS, *(identifier for _, identifier in CORES), *(identifier for _, identifier in EFFECT), 'runtimeLicenses', 'fxBlizzardEditor', 'fxBlizzardExport']
        offsets = [html.index(v) for v in order]
        self.assertEqual(offsets, sorted(offsets))
        for marker in MARKERS:
            self.assertNotIn(marker, html)
        self.assertIn('<\\/script>', html)
        self.assertIn('ZmFrZSBieXRlcw==', html)
        self.assertNotIn('<script src=', html)
        self.assertIn('licenses/spine.txt', html)
        self.assertIn('licenses/pixi.txt', html)

    def test_marker_inside_inserted_source_not_replaced(self):
        self.write(self.template / VENDORS[0], 'const example = "<!-- APP -->";')
        self.assertIn('const example = "<!-- APP -->";', build(self.root))

    def test_missing_or_duplicate_markers(self):
        for markers in [MARKERS[:-1], (*MARKERS, MARKERS[0])]:
            self.write(self.effect / 'ui.html', '\n'.join(markers))
            with self.assertRaisesRegex(ValueError, 'exactly one marker'):
                build(self.root)

    def test_wrong_pins_rejected(self):
        self.manifest['runtime']['pixi'] = '8.0.0'
        self.write(self.template / 'template.json', json.dumps(self.manifest))
        with self.assertRaisesRegex(ValueError, 'Runtime pins changed'):
            build(self.root)

    def test_missing_sample_page_and_script_rejected(self):
        self.write(self.template / 'sample/s.atlas', 'other.png\n')
        with self.assertRaisesRegex(ValueError, 'Sample atlas pages'):
            build(self.root)
        self.write(self.template / 'sample/s.atlas', 'p.png\n')
        (self.effect / 'blizzard-runtime.js').unlink()
        with self.assertRaisesRegex(ValueError, 'Missing or unsafe project path'):
            build(self.root)


if __name__ == '__main__':
    unittest.main(verbosity=2)
