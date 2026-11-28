#!/usr/bin/env python3
"""Assemble the independent AIR-03 offline authoring editor."""
import argparse
import json
import re
from pathlib import Path
from build_editor import sample_data, text, local

PINS = {"pixi": "8.22.0", "spinePixiV8": "4.2.120", "spineExport": "4.2.x"}
VENDORS = ("vendor/pixi-8.22.0.min.js", "vendor/spine-pixi-v8-4.2.120.min.js")
CORES = (("src/curve-core.js", "fxCurveCore"),
         ("src/spacing-core.js", "fxSpacingCore"),
         ("src/color-core.js", "fxColorCore"),
         ("src/curve-editor.js", "fxCurveEditor"),
         ("src/color-ui.js", "fxColorUi"))
EFFECT = (("blizzard-core.js", "fxBlizzardCore"),
          ("blizzard-runtime.js", "fxBlizzardRuntime"),
          ("blizzard-pose.js", "fxBlizzardPose"),
          ("blizzard-png.js", "fxBlizzardPng"),
          ("zip-core.js", "fxBlizzardZip"))
MARKERS = ("<!-- VENDOR -->", "<!-- CORES -->", "<!-- APP -->", "<!-- EXPORT -->", "__SAMPLE_DATA__")


def escape_script(source):
    return re.sub(r"</script", r"<\/script", source, flags=re.I)


def script(source, identifier=None, mime=None):
    attrs = (f' id="{identifier}"' if identifier else '') + (f' type="{mime}"' if mime else '')
    return f'<script{attrs}>{escape_script(source)}</script>'


def build(root):
    template = (root / 'assets/template').resolve()
    effect = (root / 'assets/blizzard/src').resolve()
    manifest = json.loads(text(local(template, 'template.json')))
    if manifest['runtime'] != PINS:
        raise ValueError('Runtime pins changed; audit before generating Blizzard')
    html = text(local(effect, 'ui.html'))
    for marker in MARKERS:
        if html.count(marker) != 1:
            raise ValueError('Expected exactly one marker: ' + marker)
    core = [script(text(local(template, name)), identifier) for name, identifier in CORES]
    core += [script(text(local(effect, name)), identifier) for name, identifier in EFFECT]
    notices = text(local(template, 'licenses/spine.txt')) + '\n' + text(local(template, 'licenses/pixi.txt'))
    core.append(script(notices, 'runtimeLicenses', 'text/plain'))
    sample = json.dumps(sample_data(template, manifest), separators=(',', ':'), ensure_ascii=False).replace('</', '<\\/')
    replacements = dict(zip(MARKERS, ('\n'.join(script(text(local(template, name)), identifier) for name, identifier in zip(VENDORS, ('blizzardPixiVendor', 'blizzardSpineVendor'))),
                                      '\n'.join(core), script(text(local(effect, 'blizzard-editor.js')), 'fxBlizzardEditor'), script(text(local(effect, 'blizzard-export.js')), 'fxBlizzardExport'), sample)))
    return re.sub('|'.join(map(re.escape, MARKERS)), lambda match: replacements[match.group()], html)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    output = args.output.expanduser().resolve()
    if output.suffix.lower() != '.html' or output.is_relative_to(root / 'assets'):
        parser.error('Choose an HTML output outside protected assets')
    try:
        html = build(root)
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_bytes(html.encode('utf8'))
    except (OSError, ValueError, KeyError) as exc:
        parser.exit(1, 'Blizzard build failed: ' + str(exc) + '\n')
    print(json.dumps({'output': str(output), 'bytes': output.stat().st_size}))


if __name__ == '__main__':
    main()
