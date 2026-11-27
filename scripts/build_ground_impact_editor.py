#!/usr/bin/env python3
"""Assemble EARTH-01 standalone offline editor with export candidates."""
import argparse
import json
import re
from pathlib import Path
from build_editor import local, text, sample_data


def build(root):
    template = root / 'assets/template'
    source = root / 'assets/ground-impact/src'
    manifest = json.loads(text(local(template, 'template.json')))
    vendors = ['vendor/pixi-8.22.0.min.js', 'vendor/spine-pixi-v8-4.2.120.min.js']
    if manifest['runtime'] != {'pixi': '8.22.0', 'spinePixiV8': '4.2.120', 'spineExport': '4.2.x'} or manifest['browserScripts'] != vendors:
        raise ValueError('Runtime pins changed; review EARTH-01')
    html = text(local(source, 'ui.html'))
    def safe(value):
        return re.sub(r'</script', r'<\\/script', value, flags=re.I)
    def tag(base, name):
        return '<script id="' + Path(name).name + '">' + safe(text(local(base, name))) + '</script>'
    notices = '\n'.join(text(local(template, 'licenses/' + name)) for name in ('pixi.txt', 'spine.txt'))
    vendor = '<script type="text/plain" id="runtimeLicenses">' + safe(notices) + '</script>\n' + '\n'.join(tag(template, name) for name in vendors)
    cores = [tag(template, 'src/' + name) for name in ('curve-core.js', 'spacing-core.js', 'path-core.js', 'color-core.js', 'curve-editor.js', 'color-ui.js')]
    shield = root / 'assets/magic-shield/src'
    cores.append(tag(shield, 'shield-export.js'))
    cores.extend(tag(source, 'ground-impact-' + name + '.js') for name in ('core', 'anchors', 'runtime', 'authoring', 'pose', 'session', 'loader', 'selection', 'asset-panel', 'export', 'bake', 'developer', 'export-panel'))
    # Separate JSON preserves original developer source text, not escaped inline script text.
    dev_sources = {name: text(local(template, 'src/' + name)) for name in ('curve-core.js', 'spacing-core.js', 'path-core.js', 'color-core.js')}
    dev_sources.update({'ground-impact-' + name + '.js': text(local(source, 'ground-impact-' + name + '.js')) for name in ('core', 'anchors', 'runtime', 'authoring', 'pose', 'session', 'loader', 'editor', 'export', 'bake')})
    dev_sources['shield-export.js'] = text(local(shield, 'shield-export.js'))
    developer = json.dumps({'sources': dev_sources, 'vendors': {Path(name).name: text(local(template, name)) for name in vendors}, 'licenses': notices}, separators=(',', ':')).replace('</', '<\\/')
    sample = json.dumps(sample_data(template, manifest), separators=(',', ':')).replace('</', '<\\/')
    replacements = {'<!-- VENDOR -->': vendor, '<!-- CORES -->': '\n'.join(cores), '__SAMPLE_DATA__': sample, '__DEVELOPER_DATA__': developer, '<!-- APP -->': tag(source, 'ground-impact-editor.js') + '\n<script>FxGroundImpactEditor.mount(globalThis);</script>'}
    for marker in replacements:
        if html.count(marker) != 1:
            raise ValueError('Expected exactly one assembly marker: ' + marker)
    return re.sub('|'.join(re.escape(k) for k in replacements), lambda m: replacements[m.group()], html)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', required=True, type=Path)
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    output = args.output.expanduser().resolve()
    if output.is_relative_to(root):
        parser.error('Write generated preview outside the source repository')
    try:
        result = build(root)
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_bytes(result.encode('utf-8'))
        print(json.dumps({'output': str(output), 'bytes': output.stat().st_size}))
    except (OSError, ValueError, KeyError) as error:
        parser.exit(1, 'Ground Impact preview build failed: ' + str(error) + '\n')


if __name__ == '__main__':
    main()
