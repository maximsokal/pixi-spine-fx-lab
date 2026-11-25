#!/usr/bin/env python3
"""Verify pinned assets, assembly markers and essential shell controls."""
import argparse
import sys
sys.dont_write_bytecode = True
import hashlib
import json
import re
from html.parser import HTMLParser
from pathlib import Path
from build_editor import local, text

class Surface(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids = []
        self.external = []
    def handle_starttag(self, tag, attributes):
        # HTML tokenization retains the first occurrence of duplicate attributes.
        attrs = {}
        for name, value in attributes:
            attrs.setdefault(name, value)
        if 'id' in attrs:
            self.ids.append(attrs['id'])
        if tag == 'script' and attrs.get('src'):
            self.external.append(attrs['src'])
        if tag == 'link':
            # Link relation keywords are ASCII case-insensitive, space-separated tokens.
            relations = re.split(r'[\t\n\f\r ]+', (attrs.get('rel') or '').lower())
            href = (attrs.get('href') or '').strip(' \t\n\f\r')
            if 'stylesheet' in relations and not href.lower().startswith('data:'):
                self.external.append(attrs.get('href'))

def verify(root, output=None):
    manifest = json.loads(text(local(root, 'template.json')))
    baseline = json.loads(text(Path(__file__).resolve().parents[1] / 'assets/template/template.json'))
    if manifest['runtime'] != baseline['runtime']:
        raise ValueError('Runtime pins changed; review and validate an explicit upgrade separately.')
    for name, expected in baseline['protectedFiles'].items():
        actual = hashlib.sha256(local(root, name).read_bytes()).hexdigest()
        if actual != expected:
            raise ValueError('Protected baseline file changed: ' + name)
    for name in manifest.get('browserScripts', []):
        local(root, name)
    html = text(local(root, 'src/ui.html')) if output is None else text(output)
    parsed = Surface()
    parsed.feed(html)
    essential = ['viewport', 'cameraPlane', 'settings', 'skeletonFile', 'atlasFile', 'textureFiles', 'loadPreview',
        'animation', 'skin', 'background', 'play', 'reset', 'finish', 'progress', 'duration', 'durationFrames',
        'bakeWidth', 'bakeHeight', 'bakeX', 'bakeY', 'bakeOverlay', 'bakeAreaHandle', 'bakeStart', 'bakeCancel',
        'cameraZoomIn', 'cameraZoomOut', 'cameraFit', 'cameraActual', 'exportWebGL', 'exportWebGPU']
    for name in essential:
        if parsed.ids.count(name) != 1:
            raise ValueError('Expected one preserved control ID: ' + name)
    if parsed.external:
        raise ValueError('External script/style in offline editor: ' + str(parsed.external))
    if output:
        for marker in ['<!-- OFFLINE_LIBRARIES -->', '<!-- CURVE_ENGINE -->', '<!-- CURVE_EDITOR -->', '<!-- SPACING_ENGINE -->', '<!-- SPACING_UI -->', '<!-- COLOR_ENGINE -->', '<!-- COLOR_UI -->', '<!-- TIMELINE_ENGINE -->', '<!-- EMITTER_ENGINE -->', '<!-- EMITTER_RUNTIME -->', '<!-- EMITTER_UI -->', '<!-- SHARED_EFFECT_CORE -->', '<!-- EXPORT_SCRIPT -->', '__SAMPLE_DATA__']:
            if marker in html:
                raise ValueError('Unresolved build marker: ' + marker)
    return {'protectedFiles': len(baseline['protectedFiles']), 'preservedControls': len(essential), 'htmlChecked': bool(output)}

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('project', type=Path)
    parser.add_argument('--html', type=Path)
    args = parser.parse_args()
    try:
        print(json.dumps(verify(args.project.resolve(), args.html.resolve() if args.html else None)))
    except (OSError, ValueError, KeyError) as error:
        parser.exit(1, 'Validation failed: ' + str(error) + '\n')

if __name__ == '__main__':
    main()
