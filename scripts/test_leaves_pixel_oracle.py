#!/usr/bin/env python3
"""Independent oracle negative controls; native encoder integration requires full checkout."""
import io
import json
import subprocess
import unittest
import zipfile
from pathlib import Path
from PIL import Image
from leaves_pixel_oracle import decode_png, sequence, EFFECT

ROOT = Path(__file__).resolve().parents[1]


def png(pixel):
    im = Image.new('RGBA', (512, 512))
    im.putpixel((0, 0), pixel)
    out = io.BytesIO()
    im.save(out, format='PNG')
    return out.getvalue()


def fixture(backend='webgl2', missing=False):
    out = io.BytesIO()
    frames = [{'file': f'frames/frame_{i:04}.png', 'frame': i, 'timeSeconds': i / 60} for i in range(120)]
    m = {'effectId': EFFECT, 'backend': backend, 'width': 512, 'height': 512, 'fps': 60,
         'frameCount': 120, 'alpha': 'straight-rgba8', 'crop': {'x': 0, 'y': 0, 'width': 512, 'height': 512},
         'includesSpine': False, 'loopPolicy': 'periodic-half-open', 'frameFormula': 'frameIndex/60', 'frames': frames}
    raw = png((100, 50, 20, 128))
    with zipfile.ZipFile(out, 'w') as z:
        for f in frames[:119 if missing else 120]:
            z.writestr(f['file'], raw)
        z.writestr('sequence.json', json.dumps(m))
    return out.getvalue()


class SyntheticTests(unittest.TestCase):
    def test_valid_and_wrong_backend(self):
        raw = fixture()
        self.assertEqual(sequence(raw, 'webgl2')['nonemptyFrames'], 120)
        with self.assertRaisesRegex(ValueError, 'manifest identity'):
            sequence(raw, 'webgpu')

    def test_missing_frame(self):
        with self.assertRaisesRegex(ValueError, 'frame files'):
            sequence(fixture(missing=True), 'webgl2')

    def test_hidden_rgb_and_corrupt_png(self):
        with self.assertRaisesRegex(ValueError, 'zero alpha'):
            decode_png(png((1, 0, 0, 0)))
        raw = bytearray(png((100, 50, 20, 128)))
        raw[raw.index(b'IDAT') + 6] ^= 1
        with self.assertRaises((SyntaxError, OSError)):
            decode_png(raw)


class NativeEncoderTests(unittest.TestCase):
    def test_real_codec_and_manifest(self):
        node = r"""
const X=require('./assets/falling-leaves/src/leaves-export.js');
const L=require('./assets/falling-leaves/src/leaves-core.js');
const C=require('./assets/magic-shield/src/shield-export.js');
const p=new Uint8Array(512*512*4);p.set([50,25,10,128,99,88,77,0]);
X.bakeSequence({codec:C,settings:L.defaults(),backend:'webgl2',createScene:async()=>({backend:'webgl2',
 async readFrame(){return {pixels:p,width:512,height:512,alpha:'premultiplied'}},destroy(){}})})
 .then(r=>process.stdout.write(Buffer.from(r.zip))).catch(e=>{console.error(e);process.exitCode=1});
"""
        raw = subprocess.run(['node', '-e', node], cwd=ROOT, capture_output=True, check=True).stdout
        self.assertEqual(sequence(raw, 'webgl2')['nonemptyFrames'], 120)
        with zipfile.ZipFile(io.BytesIO(raw)) as z:
            im = decode_png(z.read('frames/frame_0000.png'))
            self.assertEqual(im.getpixel((0, 0)), (100, 50, 20, 128))
            self.assertEqual(im.getpixel((1, 0)), (0, 0, 0, 0))


if __name__ == '__main__':
    unittest.main(verbosity=2)
