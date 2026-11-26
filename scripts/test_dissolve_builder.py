"""Focused offline assembly contract with synthetic vendor/sample fixtures."""
import json
import tempfile
import unittest
from pathlib import Path
from build_dissolve_editor import build


class BuilderTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.template = 'assets/template/'
        self.src = 'assets/dissolve/src/'
        self.manifest = {'runtime': {'pixi': '8.22.0', 'spinePixiV8': '4.2.120', 'spineExport': '4.2.x'},
                         'browserScripts': ['vendor/pixi.js', 'vendor/spine.js'],
                         'sample': {'label': 'fixture', 'skeleton': 'sample/a.json', 'atlas': 'sample/a.atlas',
                                    'images': ['sample/p.png', 'sample/q.png']}}
        self.write(self.template + 'template.json', json.dumps(self.manifest))
        self.write(self.src + 'ui.html', '<script type="application/json">__SAMPLE_DATA__</script><!-- VENDOR --><!-- CORES --><!-- APP -->')
        for name in ['curve-core', 'spacing-core', 'color-core', 'timeline-core', 'curve-editor', 'color-ui']:
            self.write(self.template + 'src/' + name + '.js', '// ' + name)
        for name in ['dissolve-core', 'dissolve-shader', 'dissolve-surface', 'dissolve-runtime', 'dissolve-authoring', 'dissolve-export', 'dissolve-bake', 'dissolve-export-ui', 'dissolve-developer', 'dissolve-editor']:
            self.write(self.src + name + '.js', '// ' + name)
        self.write('assets/shockwave/src/shockwave-spine.js', '// spine loader')
        for p in ['vendor/pixi.js', 'vendor/spine.js', 'licenses/pixi.txt', 'licenses/spine.txt']:
            self.write(self.template + p, 'fixture </script>')
        self.write(self.template + 'sample/a.json', '{"skeleton":{"spine":"4.2.1"}}')
        self.write(self.template + 'sample/a.atlas', 'p.png\nsize: 1,1\nq.png\nsize: 1,1\n')
        for p in ['p.png', 'q.png']:
            self.write(self.template + 'sample/' + p, 'binary fixture')

    def write(self, name, value):
        p = self.root / name
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(value, encoding='utf-8')

    def test_order_and_embedded_pages(self):
        result = build(self.root)
        names = ['pixi.js', 'spine.js', 'curve-core.js', 'spacing-core.js', 'color-core.js', 'timeline-core.js',
                 'curve-editor.js', 'color-ui.js', 'shockwave-spine.js', 'dissolve-core.js', 'dissolve-shader.js', 'dissolve-surface.js', 'dissolve-runtime.js',
                 'dissolve-authoring.js', 'dissolve-export.js', 'dissolve-bake.js', 'dissolve-export-ui.js', 'dissolve-developer.js', 'dissolve-editor.js']
        offsets = [result.index('id="' + name + '"') for name in names]
        self.assertEqual(offsets, sorted(offsets))
        self.assertIn('"p.png":"YmluYXJ5IGZpeHR1cmU="', result)
        self.assertIn('"q.png":"YmluYXJ5IGZpeHR1cmU="', result)
        self.assertIn(r'<\/script>', result)
        self.assertNotIn('__SAMPLE_DATA__', result)
        self.assertNotIn('<!-- CORES -->', result)

    def test_runtime_pin_and_missing_page_rejected(self):
        (self.root / (self.template + 'sample/q.png')).unlink()
        with self.assertRaises(ValueError):
            build(self.root)
        self.manifest['runtime']['pixi'] = '9.0.0'
        self.write(self.template + 'template.json', json.dumps(self.manifest))
        with self.assertRaisesRegex(ValueError, 'Runtime pins changed'):
            build(self.root)


if __name__ == '__main__':
    unittest.main(verbosity=2)
