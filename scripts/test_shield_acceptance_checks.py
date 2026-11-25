"""Native tests of the independent acceptance oracle, not renderer evidence."""
import io
import json
import unittest
import zipfile
from PIL import Image
from test_shield_browser import png_pixels, sequence_frames, developer_preset, MODULES

CROP = {'x': -2, 'y': 5, 'width': 2, 'height': 1}


def png(mode='RGBA', size=(2, 1)):
    stream = io.BytesIO()
    Image.new(mode, size, (20, 40, 60, 128) if mode == 'RGBA' else (20, 40, 60)).save(stream, format='PNG')
    return stream.getvalue()


def archive(entries):
    stream = io.BytesIO()
    with zipfile.ZipFile(stream, 'w') as z:
        for name, data in entries:
            z.writestr(name, data)
    return stream.getvalue()


def sequence(change=None, image=None):
    manifest = {'effectId': 'fx.game.magic-shield', 'backend': 'webgl2', 'crop': CROP,
                'width': 2, 'height': 1, 'count': 2, 'fps': 60, 'alpha': 'straight-rgba8',
                'frames': [{'file': f'frames/frame_{i:05}.png', 'frame': i, 'timeSeconds': i / 60} for i in range(2)]}
    if change:
        change(manifest)
    return archive([('sequence.json', json.dumps(manifest)), ('README.txt', 'instructions'),
                    ('frames/frame_00000.png', png()), ('frames/frame_00001.png', image or png())])


class OracleTests(unittest.TestCase):
    def test_valid_exact_frames(self):
        result = sequence_frames(sequence(), 'webgl2', CROP, 2)
        self.assertEqual(result, [png(), png()])

    def test_wrong_count_time_backend_crop_and_color_rejected(self):
        for change in [lambda m: m.update(count=3), lambda m: m['frames'][1].update(timeSeconds=2/60),
                       lambda m: m.update(backend='webgpu'), lambda m: m.update(crop={}),
                       lambda m: m.update(alpha='premultiplied')]:
            with self.subTest(change=change), self.assertRaises(AssertionError):
                sequence_frames(sequence(change), 'webgl2', CROP, 2)
        for image in [png('RGB'), png(size=(3, 1))]:
            with self.assertRaises(AssertionError):
                sequence_frames(sequence(image=image), 'webgl2', CROP, 2)

    def test_png_decoder_rejects_rgb(self):
        with self.assertRaises(AssertionError):
            png_pixels(png('RGB'), 2, 1)

    def test_developer_archive_valid_and_missing_texture_rejected(self):
        preset = {'effectId': 'fx.game.magic-shield', 'rendererPreference': 'webgpu', 'crop': CROP, 'frameCount': 2,
                  'asset': {'skeleton': 'assets/skeleton.json', 'atlas': 'assets/skeleton.atlas', 'images': [{'path': 'assets/page_000.png'}]}}
        entries = [(name, 'export async function startShieldDemo(){}') for name in MODULES]
        entries += [('preset.json', json.dumps(preset)), ('public/preset.json', json.dumps(preset)),
                    ('package.json', json.dumps({'dependencies': {'pixi.js': '8.22.0', '@esotericsoftware/spine-pixi-v8': '4.2.120'}})),
                    ('README.md', 'readme'), ('LICENSES.txt', 'notices'), ('index.html', '<html>'),
                    ('public/assets/skeleton.json', '{}'), ('public/assets/skeleton.atlas', 'atlas'), ('public/assets/page_000.png', png())]
        self.assertEqual(developer_preset(archive(entries), 'webgpu', CROP, 2), preset)
        with self.assertRaises(KeyError):
            developer_preset(archive(entries[:-1]), 'webgpu', CROP, 2)

    def test_developer_archive_missing_entry_rejected(self):
        with self.assertRaises(AssertionError):
            developer_preset(archive([('preset.json', '{}')]), 'webgpu', CROP, 2)


if __name__ == '__main__':
    unittest.main(verbosity=2)
