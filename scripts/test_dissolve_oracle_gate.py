#!/usr/bin/env python3
"""Verify acceptance checks remain active under python -O; synthetic fixtures only."""
import io
import json
import unittest
import zipfile
from PIL import Image
from dissolve_pixel_oracle import decode_png, frames, compare_endpoints, developer, EFFECT

CROP = {'x': -3, 'y': 0, 'width': 2, 'height': 1}


def png(mode='RGBA', color=(200, 100, 50, 255), size=(2, 1)):
    out = io.BytesIO()
    Image.new(mode, size, color).save(out, format='PNG')
    return out.getvalue()


def archive(entries):
    out = io.BytesIO()
    with zipfile.ZipFile(out, 'w') as z:
        for name, data in entries.items():
            z.writestr(name, data)
    return out.getvalue()


def sequence():
    name = 'frames/frame_00000.png'
    return {name: png(), 'README.txt': 'fixture', 'sequence.json': json.dumps({
        'effectId': EFFECT, 'backend': 'webgl2', 'crop': CROP, 'count': 1,
        'fps': 60, 'alpha': 'straight-rgba8', 'width': 2, 'height': 1,
        'frames': [{'file': name, 'frame': 0, 'timeSeconds': 0}],
        'frameFormula': 'frameIndex/60'})}


def package():
    m = {'effectId': EFFECT, 'rendererPreference': 'webgl', 'crop': CROP,
         'frameCount': 1, 'sourceKind': 'spine', 'asset': {'version': '4.2.43',
         'skeleton': 'assets/skeleton.json', 'atlas': 'assets/skeleton.atlas',
         'images': [{'path': 'assets/page_000.png'}]}}
    entries = {n: 'fixture' for n in ('curve-core.js', 'spacing-core.js', 'color-core.js',
        'timeline-core.js', 'shockwave-spine.js', 'dissolve-core.js', 'dissolve-shader.js',
        'dissolve-surface.js', 'dissolve-runtime.js', 'dissolve-authoring.js', 'example.js',
        'LICENSES.txt', 'index.html', 'public/assets/skeleton.json',
        'public/assets/skeleton.atlas', 'public/assets/page_000.png')}
    entries.update({'preset.json': json.dumps(m), 'public/preset.json': json.dumps(m),
        'package.json': json.dumps({'dependencies': {'pixi.js': '8.22.0',
            '@esotericsoftware/spine-pixi-v8': '4.2.120'}, 'devDependencies': {'vite': '7.1.12'}}),
        'dissolve-demo.js': 'export async function startDissolveDemo(){}'})
    return entries


class OracleGateTests(unittest.TestCase):
    def test_valid_png_and_sequence(self):
        self.assertEqual(decode_png(png(), 2, 1).getpixel((0, 0)), (200, 100, 50, 255))
        self.assertEqual(len(frames(archive(sequence()), 'webgl2', CROP, 1)), 1)

    def test_hidden_rgb(self):
        with self.assertRaises(AssertionError):
            decode_png(png(color=(1, 2, 3, 0)), 2, 1)

    def test_wrong_dimensions_and_format(self):
        for data in (png(size=(1, 2)), png(mode='RGB', color=(1, 2, 3))):
            with self.subTest(data=data[:16]), self.assertRaises(AssertionError):
                decode_png(data, 2, 1)

    def test_wrong_sequence_manifest(self):
        with self.assertRaises(AssertionError):
            frames(archive(sequence()), 'webgpu', CROP, 1)

    def test_missing_readme_and_extra_member(self):
        e = sequence(); del e['README.txt']
        with self.assertRaises(AssertionError):
            frames(archive(e), 'webgl2', CROP, 1)
        e = sequence(); e['extra.txt'] = 'extra'
        with self.assertRaises(AssertionError):
            frames(archive(e), 'webgl2', CROP, 1)

    def test_wrong_endpoint_and_gray(self):
        src = Image.new('RGBA', (2, 1), (200, 100, 50, 255))
        empty = Image.new('RGBA', src.size)
        gray = Image.new('RGBA', src.size, (118, 118, 118, 255))
        self.assertEqual(compare_endpoints(src, src, empty, gray), 2)
        with self.assertRaises(AssertionError):
            compare_endpoints(src, src, src, gray)
        with self.assertRaises(AssertionError):
            compare_endpoints(src, src, empty, src)

    def test_valid_developer(self):
        developer(archive(package()), 'webgl', CROP, 1)

    def test_bad_developer_pin_and_duplicate_preset(self):
        for key, value in [('package.json', '{}'), ('public/preset.json', '{}')]:
            e = package()
            if key == 'package.json':
                p = json.loads(e[key]); p['dependencies']['pixi.js'] = '9.0.0'; value = json.dumps(p)
            e[key] = value
            with self.subTest(key=key), self.assertRaises(AssertionError):
                developer(archive(e), 'webgl', CROP, 1)


if __name__ == '__main__':
    unittest.main(verbosity=2)
