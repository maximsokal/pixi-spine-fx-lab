#!/usr/bin/env python3
"""Assemble the GAME-10 offline preview with the pinned shared runtime."""
import argparse
import json
import re
from pathlib import Path
from build_editor import local, text, sample_data


def build(root):
    template = root / 'assets/template'
    source = root / 'assets/poison-cloud/src'
    manifest = json.loads(text(local(template, 'template.json')))
    if manifest['runtime'] != {'pixi': '8.22.0', 'spinePixiV8': '4.2.120', 'spineExport': '4.2.x'}:
        raise ValueError('Runtime pins changed; review GAME-10')
    html = text(local(source, 'ui.html'))
    def tag(base, name):
        return '<script id="' + Path(name).name + '">' + re.sub(r'</script', r'<\\/script', text(local(base, name)), flags=re.I) + '</script>'
    notices = '\n'.join(text(local(template, 'licenses/' + name)) for name in ('pixi.txt', 'spine.txt'))
    vendor = '<script type="text/plain" id="runtimeLicenses">' + re.sub(r'</script', r'<\\/script', notices, flags=re.I) + '</script>\n' + '\n'.join(tag(template, name) for name in manifest['browserScripts'])
    sample = json.dumps(sample_data(template, manifest), separators=(',', ':')).replace('</', '<\\/')
    cores = [tag(template, 'src/' + name) for name in ('curve-core.js', 'spacing-core.js', 'color-core.js', 'timeline-core.js', 'curve-editor.js', 'color-ui.js')]
    cores.append(tag(root / 'assets/shockwave/src', 'shockwave-spine.js'))
    cores.extend(tag(source, name) for name in ('poison-core.js', 'poison-runtime.js', 'poison-authoring.js', 'poison-export.js', 'poison-bake.js', 'poison-export-ui.js', 'poison-developer.js'))
    for marker, value in (('<!-- VENDOR -->', vendor), ('<!-- CORES -->', '\n'.join(cores)), ('__SAMPLE_DATA__', sample), ('<!-- APP -->', tag(source, 'poison-editor.js'))):
        if html.count(marker) != 1:
            raise ValueError('Expected exactly one assembly marker: ' + marker)
        html = html.replace(marker, value)
    return html


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
        parser.exit(1, 'Poison preview build failed: ' + str(error) + '\n')


if __name__ == '__main__':
    main()
