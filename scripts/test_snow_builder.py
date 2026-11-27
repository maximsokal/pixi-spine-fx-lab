#!/usr/bin/env python3
"""Test assembly with synthetic assets; deliberately not a GPU test."""
import json
from pathlib import Path
import tempfile
import unittest
from build_snow_editor import build


class SnowBuilderTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.template = self.root / 'assets/template'
        self.snow = self.root / 'assets/snowfall/src'
        self.manifest = {'runtime': {'pixi': '8.22.0', 'spinePixiV8': '4.2.120', 'spineExport': '4.2.x'},
                         'sample': {'label': 'sample', 'skeleton': 'sample/s.json', 'atlas': 'sample/s.atlas', 'images': ['sample/p.png']}}
        self.write(self.template / 'template.json', json.dumps(self.manifest))
        self.write(self.template / 'sample/s.json', '{"skeleton":{"spine":"4.2.1"}}')
        self.write(self.template / 'sample/s.atlas', 'p.png\n')
        self.write(self.template / 'sample/p.png', 'fake bytes')
        for name in ['vendor/pixi-8.22.0.min.js', 'vendor/spine-pixi-v8-4.2.120.min.js',
                     'src/curve-core.js', 'src/spacing-core.js', 'src/color-core.js', 'src/timeline-core.js',
                     'src/curve-editor.js', 'src/color-ui.js', 'licenses/spine.txt', 'licenses/pixi.txt']:
            self.write(self.template / name, '// ' + name)
        for name in ['snow-core.js', 'snow-runtime.js', 'snow-pose.js', 'zip-core.js', 'snow-editor.js', 'snow-export.js']:
            self.write(self.snow / name, '// ' + name + '\nconst sample = "</script>";')
        self.markers = ['<!-- VENDOR -->', '<!-- CORES -->', '<!-- APP -->', '<!-- EXPORT -->', '__SAMPLE_DATA__']
        self.write(self.snow / 'ui.html', '\n'.join(self.markers))

    @staticmethod
    def write(path, content):
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding='utf8')

    def test_assembly_order_escaping_and_embedded_assets(self):
        result = build(self.root)
        for marker in self.markers:
            self.assertNotIn(marker, result)
        order = ['vendor/pixi-', 'vendor/spine-', 'fxCurveCore', 'fxSpacingCore', 'fxColorCore',
                 'fxSnowCore', 'fxSnowRuntime', 'fxSnowPose', 'fxSnowZip', 'snow-editor.js', 'snow-export.js']
        self.assertEqual(sorted(result.index(s) for s in order), [result.index(s) for s in order])
        self.assertIn('<\\/script>', result)
        self.assertIn('ZmFrZSBieXRlcw==', result)
        self.assertNotIn('<script src=', result)

    def test_missing_or_duplicate_marker_rejected(self):
        self.write(self.snow / 'ui.html', '\n'.join(self.markers + [self.markers[0]]))
        with self.assertRaisesRegex(ValueError, 'exactly one marker'):
            build(self.root)

    def test_wrong_runtime_pins_rejected(self):
        self.manifest['runtime']['pixi'] = '8.0.0'
        self.write(self.template / 'template.json', json.dumps(self.manifest))
        with self.assertRaisesRegex(AssertionError, 'Runtime pins changed'):
            build(self.root)


if __name__ == '__main__':
    unittest.main(verbosity=2)
