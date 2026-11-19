#!/usr/bin/env python3
"""Build a standalone offline HTML from the copied editor project (stdlib only)."""
import argparse
import base64
import json
import re
from pathlib import Path

def local(root, relative):
    path = (root / relative).resolve()
    if not path.is_relative_to(root) or not path.is_file():
        raise ValueError('Missing or unsafe project path: ' + str(relative))
    return path

def text(path):
    # Explicit UTF-8: the platform default (for example cp1252 on Windows) must not change the build.
    return path.read_text(encoding='utf-8')

ATLAS_PAGE = re.compile(r'^[^\s:][^:]*\.(?:png|jpe?g|webp)$', re.I)

def atlas_pages(atlas):
    """Texture page names declared in an atlas: a non-indented line ending in an image extension."""
    return [line.strip() for line in atlas.splitlines() if not line[:1].isspace() and ATLAS_PAGE.match(line.strip())]

def sample_data(root, manifest):
    """Embed the sample declared in template.json: skeleton, atlas and every atlas page image."""
    spec = manifest['sample']
    atlas = text(local(root, spec['atlas']))
    images = {Path(name).name: local(root, name) for name in spec['images']}
    missing = [page for page in atlas_pages(atlas) if page.replace(chr(92), '/').split('/')[-1] not in images]
    if missing:
        raise ValueError('Sample atlas pages are not listed in template.json sample.images: ' + ', '.join(missing))
    return {'label': spec['label'], 'skeletonName': Path(spec['skeleton']).name, 'atlasName': Path(spec['atlas']).name,
        'skeleton': json.loads(text(local(root, spec['skeleton']))), 'atlas': atlas,
        'images': {name: base64.b64encode(path.read_bytes()).decode() for name, path in images.items()}}

def build(root):
    manifest = json.loads(text(local(root, 'template.json')))
    html = text(local(root, 'src/ui.html'))
    for marker in ['<!-- OFFLINE_LIBRARIES -->', '<!-- CURVE_ENGINE -->', '<!-- CURVE_EDITOR -->', '<!-- SPACING_ENGINE -->', '<!-- SPACING_UI -->', '<!-- COLOR_ENGINE -->', '<!-- COLOR_UI -->', '<!-- EMITTER_ENGINE -->', '<!-- EMITTER_RUNTIME -->', '<!-- EMITTER_UI -->', '<!-- SHARED_EFFECT_CORE -->', '<!-- EXPORT_SCRIPT -->', '__SAMPLE_DATA__']:
        if html.count(marker) != 1:
            raise ValueError('Expected exactly one assembly marker: ' + marker)
    pixi_notice = text(local(root, 'licenses/pixi.txt'))
    spine_notice = text(local(root, 'licenses/spine.txt'))
    notices = '<!--\n' + spine_notice + '\n' + pixi_notice + '\n-->\n'
    vendors = manifest.get('browserScripts', ['vendor/pixi-8.22.0.min.js', 'vendor/spine-pixi-v8-4.2.120.min.js'])
    libraries = notices + '\n'.join('<script>' + re.sub(r'</script', r'<\\/script', text(local(root, name)), flags=re.I) + '</script>' for name in vendors)
    sample = json.dumps(sample_data(root, manifest), separators=(',', ':')).replace('</', '<\\/')
    curve_engine = '<script id="fxCurveCore">' + text(local(root, 'src/curve-core.js')).replace('</', '<\\/') + '</script>'
    curve_editor = '<script id="fxCurveEditor">' + text(local(root, 'src/curve-editor.js')).replace('</', '<\\/') + '</script>'
    spacing_engine = '<script id="fxSpacingCore">' + text(local(root, 'src/spacing-core.js')).replace('</', '<\\/') + '</script>'
    spacing_ui = '<script id="fxSpacingUi">' + text(local(root, 'src/spacing-ui.js')).replace('</', '<\\/') + '</script>'
    color_engine = '<script id="fxColorCore">' + text(local(root, 'src/color-core.js')).replace('</', '<\\/') + '</script>'
    color_ui = '<script id="fxColorUi">' + text(local(root, 'src/color-ui.js')).replace('</', '<\\/') + '</script>'
    emitter_engine = '<script id="fxEmitterCore">' + text(local(root, 'src/emitter-core.js')).replace('</', '<\\/') + '</script>'
    emitter_runtime = '<script id="fxEmitterRuntime">' + text(local(root, 'src/emitter-runtime.js')).replace('</', '<\\/') + '</script>'
    emitter_ui = '<script id="fxEmitterUi">' + text(local(root, 'src/emitter-ui.js')).replace('</', '<\\/') + '</script>'
    shared = '<script id="sharedCore">' + text(local(root, 'src/effect-core.js')).replace('</', '<\\/') + '</script>'
    shared += '<script id="runtimeLicenses" type="text/plain">' + spine_notice + '\n' + pixi_notice + '</script>'
    exporter = '<script>' + text(local(root, 'src/export-ui.js')).replace('</', '<\\/') + '</script>'
    return html.replace('<!-- OFFLINE_LIBRARIES -->', libraries).replace('<!-- CURVE_ENGINE -->', curve_engine).replace('<!-- CURVE_EDITOR -->', curve_editor).replace('<!-- SPACING_ENGINE -->', spacing_engine).replace('<!-- SPACING_UI -->', spacing_ui).replace('<!-- COLOR_ENGINE -->', color_engine).replace('<!-- COLOR_UI -->', color_ui).replace('<!-- EMITTER_ENGINE -->', emitter_engine).replace('<!-- EMITTER_RUNTIME -->', emitter_runtime).replace('<!-- EMITTER_UI -->', emitter_ui).replace('<!-- SHARED_EFFECT_CORE -->', shared).replace('<!-- EXPORT_SCRIPT -->', exporter).replace('__SAMPLE_DATA__', sample)

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('project', type=Path)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    root, output = args.project.expanduser().resolve(), args.output.expanduser().resolve()
    skill = Path(__file__).resolve().parents[1]
    if output.is_relative_to(skill):
        parser.error('Write the generated HTML outside the installed skill.')
    try:
        html = build(root)
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_bytes(html.encode('utf-8'))  # LF endings and UTF-8 on every platform
        print(str(output) + ' (' + str(output.stat().st_size) + ' bytes)')
    except (OSError, ValueError, KeyError) as error:
        parser.exit(1, 'Build failed: ' + str(error) + '\n')

if __name__ == '__main__':
    main()
