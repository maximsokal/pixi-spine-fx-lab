#!/usr/bin/env python3
"""Offline assembly tests with synthetic assets, not a GPU test."""
import json
from pathlib import Path
import tempfile
import unittest
from build_leaves_editor import build


class LeavesBuilderTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.template = self.root / 'assets/template'
        self.fx = self.root / 'assets/falling-leaves/src'
        self.vendors = ['vendor/pixi-8.22.0.min.js', 'vendor/spine-pixi-v8-4.2.120.min.js']
        self.manifest = {'runtime': {'pixi': '8.22.0', 'spinePixiV8': '4.2.120', 'spineExport': '4.2.x'},
                         'browserScripts': self.vendors,
                         'sample': {'label': 'sample', 'skeleton': 'sample/s.json', 'atlas': 'sample/s.atlas',
                                    'images': ['sample/p.png', 'sample/q.png']}}
        self.write(self.template / 'template.json', json.dumps(self.manifest))
        self.write(self.template / 'sample/s.json', '{"skeleton":{"spine":"4.2.1"}}')
        self.write(self.template / 'sample/s.atlas', 'p.png\nq.png\n')
        self.write(self.template / 'sample/p.png', 'fake bytes')
        self.write(self.template / 'sample/q.png', 'second page')
        for name in self.vendors + ['src/curve-core.js', 'src/spacing-core.js', 'src/color-core.js',
                                    'src/timeline-core.js', 'src/curve-editor.js', 'src/color-ui.js',
                                    'licenses/spine.txt', 'licenses/pixi.txt']:
            self.write(self.template / name, '// ' + name)
        for name in ['leaves-core.js', 'leaves-runtime.js', 'leaves-spine.js', 'leaves-export.js', 'leaves-editor.js']:
            self.write(self.fx / name, '// ' + name + '\nconst example = "</script> <!-- APP -->";')
        self.write(self.root / 'assets/magic-shield/src/shield-export.js', '// shield-export.js')
        self.markers = ['<!-- VENDOR -->', '<!-- CORES -->', '__SAMPLE_DATA__', '<!-- APP -->']
        self.write(self.fx / 'ui.html', '\n'.join(self.markers))

    @staticmethod
    def write(path, content):
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding='utf8')

    def test_assembly_order_two_pages_and_single_pass(self):
        result = build(self.root)
        order = ['pixi-8.22.0.min.js', 'spine-pixi-v8-4.2.120.min.js', 'curve-core.js',
                 'spacing-core.js', 'color-core.js', 'timeline-core.js', 'curve-editor.js',
                 'color-ui.js', 'leaves-core.js', 'leaves-runtime.js', 'leaves-spine.js', 'shield-export.js', 'leaves-export.js', 'leaves-editor.js']
        self.assertEqual(sorted(result.index(s) for s in order), [result.index(s) for s in order])
        self.assertIn('<\\/script> <!-- APP -->', result)
        self.assertEqual(result.count('<!-- APP -->'), 5)
        self.assertIn('ZmFrZSBieXRlcw==', result)
        self.assertIn('c2Vjb25kIHBhZ2U=', result)
        self.assertNotIn('<script src=', result)

    def test_duplicate_marker_rejected(self):
        self.write(self.fx / 'ui.html', '\n'.join(self.markers + [self.markers[0]]))
        with self.assertRaisesRegex(ValueError, 'exactly one assembly marker'):
            build(self.root)

    def test_wrong_runtime_or_vendor_pins_rejected(self):
        self.manifest['runtime']['pixi'] = '8.0.0'
        self.write(self.template / 'template.json', json.dumps(self.manifest))
        with self.assertRaisesRegex(ValueError, 'Runtime pins changed'):
            build(self.root)
        self.manifest['runtime']['pixi'] = '8.22.0'
        self.manifest['browserScripts'] = []
        self.write(self.template / 'template.json', json.dumps(self.manifest))
        with self.assertRaisesRegex(ValueError, 'Unexpected browser scripts'):
            build(self.root)

    def test_missing_second_atlas_page_rejected(self):
        self.manifest['sample']['images'].pop()
        self.write(self.template / 'template.json', json.dumps(self.manifest))
        with self.assertRaisesRegex(ValueError, 'Sample atlas pages'):
            build(self.root)


if __name__ == '__main__':
    unittest.main(verbosity=2)
