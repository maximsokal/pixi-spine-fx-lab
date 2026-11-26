#!/usr/bin/env python3
"""Run native Node encoder, then inspect independent Python ZIP/PNG bytes."""
import io
import json
import subprocess
import unittest
import zipfile
from pathlib import Path
from PIL import Image
from dissolve_pixel_oracle import frames, decode_png, compare_endpoints

ROOT = Path(__file__).resolve().parents[1]
CROP = {'x': -3, 'y': 511, 'width': 2, 'height': 2}
NODE = r"""
const X=require('./assets/dissolve/src/dissolve-export.js');
const original=Uint8Array.of(200,100,50,255,64,32,16,128,0,0,0,0,0,0,0,0);
const gray=Uint8Array.of(118,118,118,255,38,38,38,128,0,0,0,0,0,0,0,0);
(async()=>{
 const p=await X.bakeSequence({settings:{durationFrames:40,mode:'oneShot'},compile:settings=>({settings}),backend:'webgl2',crop:{x:-3,y:511,width:2,height:2},
 createScene:async()=>({backend:'webgl2',maxTextureSize:4096,async readFrame(t){return {pixels:t===0?original:t===39/60?new Uint8Array(16):gray,width:2,height:2,alpha:'premultiplied'};},destroy(){}})});
 process.stdout.write(Buffer.from(p.zip));
})().catch(e=>{console.error(e);process.exitCode=1});
"""


class ArchiveOracleTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data = subprocess.run(['node', '-e', NODE], cwd=ROOT, capture_output=True, check=True).stdout

    def test_native_encoder_sequence_crc_and_endpoint(self):
        decoded = frames(self.data, 'webgl2', CROP, 40)
        self.assertEqual(decoded[0].getpixel((1, 0)), (128, 64, 32, 128))
        self.assertEqual(decoded[1].getpixel((1, 0)), (76, 76, 76, 128))
        self.assertEqual(compare_endpoints(decoded[0], decoded[0], decoded[-1], decoded[1]), 1)

    def test_wrong_manifest_or_frame_count_rejected(self):
        with self.assertRaises(AssertionError):
            frames(self.data, 'webgpu', CROP, 40)
        with self.assertRaises(AssertionError):
            frames(self.data, 'webgl2', CROP, 39)

    def test_oracle_rejects_nonzero_endpoint_and_hidden_rgb(self):
        decoded = frames(self.data, 'webgl2', CROP, 40)
        with self.assertRaises(AssertionError):
            compare_endpoints(decoded[0], decoded[0], decoded[0], decoded[1])
        img = Image.new('RGBA', (1, 1), (1, 0, 0, 0))
        stream = io.BytesIO()
        img.save(stream, format='PNG')
        with self.assertRaises(AssertionError):
            decode_png(stream.getvalue(), 1, 1)

    def test_png_crc_corruption_rejected(self):
        with zipfile.ZipFile(io.BytesIO(self.data)) as z:
            png = bytearray(z.read('frames/frame_00000.png'))
        i = png.index(b'IDAT')
        png[i + 5] ^= 1
        with self.assertRaises((SyntaxError, OSError)):
            decode_png(png, 2, 2)


if __name__ == '__main__':
    unittest.main(verbosity=2)
