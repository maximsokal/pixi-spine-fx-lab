"""Synthetic offline assembly checks; not a browser/GPU acceptance test."""
import json
import tempfile
import unittest
from pathlib import Path
from html.parser import HTMLParser
from build_chain_lightning_editor import build


class Scripts(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids = []
        self.external = []

    def handle_starttag(self, tag, attrs):
        if tag == 'script':
            attrs = dict(attrs)
            self.ids.append(attrs.get('id'))
            if 'src' in attrs:
                self.external.append(attrs['src'])


class ChainBuilderTests(unittest.TestCase):
    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.root = Path(tmp.name)
        self.template = self.root / 'assets/template'
        self.source = self.root / 'assets/chain-lightning/src'
        self.vendors = ['vendor/pixi-8.22.0.min.js', 'vendor/spine-pixi-v8-4.2.120.min.js']
        self.shared = ['curve-core.js', 'spacing-core.js', 'path-core.js', 'color-core.js', 'curve-editor.js', 'color-ui.js']
        self.fx = ['chain-' + n + '.js' for n in ('core', 'anchors', 'runtime', 'authoring', 'session', 'editor')]
        self.manifest = {'runtime': {'pixi': '8.22.0', 'spinePixiV8': '4.2.120', 'spineExport': '4.2.x'}, 'browserScripts': self.vendors,
                         'sample': {'label': 'Synthetic', 'skeleton': 'sample/test.json', 'atlas': 'sample/test.atlas', 'images': ['sample/page.png']}}
        self.write(self.template / 'template.json', json.dumps(self.manifest))
        for name in self.vendors + ['licenses/pixi.txt', 'licenses/spine.txt'] + ['src/' + n for n in self.shared]:
            self.write(self.template / name, '/* ' + name + ' */')
        self.write(self.root / 'assets/shockwave/src/shockwave-spine.js', '/* Spine loader */')
        for name in self.fx:
            self.write(self.source / name, '/* ' + name + ' */')
        self.shell = '<!-- VENDOR --><!-- CORES --><script id="sampleData" type="application/json">__SAMPLE_DATA__</script><!-- APP -->'
        self.write(self.source / 'ui.html', self.shell)
        self.write(self.template / 'sample/test.json', '{"skeleton":{"spine":"4.2.43"}}')
        self.write(self.template / 'sample/test.atlas', 'page.png\nsize: 1,1\n')
        self.write(self.template / 'sample/page.png', 'fixture')

    @staticmethod
    def write(path, value):
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(value, encoding='utf-8')

    def test_offline_dependency_order(self):
        result = build(self.root)
        parser = Scripts()
        parser.feed(result)
        self.assertEqual(parser.ids, ['runtimeLicenses', *[Path(v).name for v in self.vendors], *self.shared, 'shockwave-spine.js', *self.fx[:-1], 'sampleData', self.fx[-1]])
        self.assertEqual(parser.external, [])
        self.assertIn('Zml4dHVyZQ==', result)
        self.assertNotIn('__SAMPLE_DATA__', result)

    def test_pin_and_missing_dependency_fail(self):
        self.manifest['runtime']['pixi'] = '9.0.0'
        self.write(self.template / 'template.json', json.dumps(self.manifest))
        with self.assertRaisesRegex(ValueError, 'Runtime pins'):
            build(self.root)
        self.manifest['runtime']['pixi'] = '8.22.0'
        self.write(self.template / 'template.json', json.dumps(self.manifest))
        (self.source / self.fx[3]).unlink()
        with self.assertRaisesRegex(ValueError, 'Missing or unsafe'):
            build(self.root)

    def test_missing_sample_page_fails(self):
        self.write(self.template / 'sample/test.atlas', 'other.png\nsize: 1,1\n')
        with self.assertRaisesRegex(ValueError, 'Sample atlas pages'):
            build(self.root)

    def test_marker_and_script_escaping(self):
        self.write(self.source / 'ui.html', self.shell + '<!-- APP -->')
        with self.assertRaisesRegex(ValueError, 'exactly one assembly marker'):
            build(self.root)
        self.write(self.source / 'ui.html', self.shell)
        self.write(self.source / self.fx[0], '/* <!-- APP --> </ScRiPt */')
        result = build(self.root)
        self.assertIn(r'/* <!-- APP --> <\/script */', result)
        self.assertEqual(result.count('id="chain-editor.js"'), 1)


if __name__ == '__main__':
    unittest.main()
