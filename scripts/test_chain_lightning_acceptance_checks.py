#!/usr/bin/env python3
"""Independent ZIP/PNG acceptance checks; no browser/GPU claims."""
import base64
import io
import json
import unittest
import warnings
import zipfile
from PIL import Image
from test_chain_lightning_browser import archive, sequence, developer, demo_response, EFFECT, MODULES, VENDORS

CROP = {'x':-2,'y':3,'width':4,'height':3}
SAMPLE = {'skeletonName':'test.json','skeleton':{'skeleton':{'spine':'4.2.43'}},'atlas':'test page.png\n', 'images':{'test page.png':base64.b64encode(b'original page bytes').decode()}}

EXPECTED = {'schemaVersion':1,'authoredFrames':40,
            'settings':{'mode':'oneShot','durationFrames':40,'targets':[{'id':'target-1'},{'id':'target-2'}]},
            'targetOrder':['target-1','target-2'],
            'contactFrames':[{'id':'target-1','frame':2},{'id':'target-2','frame':7}]}


def pack(entries):
    buf=io.BytesIO()
    with zipfile.ZipFile(buf,'w') as z:
        for key, value in entries.items(): z.writestr(key,value)
    return buf.getvalue()


def png(mode='RGBA',size=(4,3)):
    buf=io.BytesIO();Image.new(mode,size).save(buf,format='PNG');return buf.getvalue()


def seq():
    names=['frames/frame_00000.png','frames/frame_00001.png']
    return {**{n:png() for n in names},'README.txt':'fixture','sequence.json':json.dumps({**EXPECTED,'effectId':EFFECT,'backend':'webgl2','crop':CROP,'count':2,'mode':'oneShot','authoredFrames':40,'fps':60,'alpha':'straight-rgba8','width':4,'height':3,'frames':[{'file':n,'frame':i,'timeSeconds':i/60,'sampleSeconds':i/60} for i,n in enumerate(names)]})}


def dev():
    entries={'public/'+n:'fixture' for n in MODULES+('LICENSES.txt','index.html','example.js','chain-lightning-demo.js')}
    entries.update({'public/vendor/'+n:'fixture' for n in VENDORS})
    entries.update({'bootstrap.html':'fixture','vite.config.js':'fixture','README.md':'fixture','package.json':json.dumps({'devDependencies':{'vite':'7.1.12'}}),'public/assets/skeleton.json':json.dumps(SAMPLE['skeleton']),'public/assets/skeleton.atlas':SAMPLE['atlas'],'public/assets/page_000.png':base64.b64decode(SAMPLE['images']['test page.png'])})
    entries['public/preset.json']=json.dumps({**EXPECTED,'effectId':EFFECT,'rendererPreference':'webgpu','crop':CROP,'frameCount':2,'compatibility':{'pixi':'8.22.0','spine':'4.2.120'},'asset':{'version':'4.2.43','sourceSkeletonName':'test.json','skeleton':'assets/skeleton.json','atlas':'assets/skeleton.atlas','images':[{'name':'test page.png','path':'assets/page_000.png'}]}})
    return entries


class AcceptanceChecks(unittest.TestCase):
    def test_demo_route_serves_only_exact_public_entries(self):
        with archive(pack({'public/index.html':'index','public/example.js':'export {}','README.md':'private'})) as z:
            self.assertEqual(demo_response(z,'https://chain-lightning.test/'),('text/html',b'index'))
            self.assertEqual(demo_response(z,'https://chain-lightning.test/example.js'),('text/javascript',b'export {}'))
            for url in ('http://chain-lightning.test/index.html','http://example.com/index.html','https://chain-lightning.test/../README.md','https://chain-lightning.test/%2e%2e/README.md','https://chain-lightning.test/missing.js'):
                self.assertIsNone(demo_response(z,url))

    def test_valid_sequence(self):
        m,frames=sequence(pack(seq()),'webgl2',CROP,2,EXPECTED)
        self.assertEqual(len(frames),2);self.assertEqual(m['fps'],60)
    def test_wrong_backend_or_crop_or_count(self):
        for backend,crop,count in [('webgpu',CROP,2),('webgl2',{**CROP,'x':0},2),('webgl2',CROP,3)]:
            with self.subTest(backend=backend,crop=crop,count=count), self.assertRaises(ValueError): sequence(pack(seq()),backend,crop,count,EXPECTED)
    def test_wrong_png_format_size_and_time(self):
        for image in [png('RGB'),png(size=(3,3))]:
            entries=seq();entries['frames/frame_00000.png']=image
            with self.assertRaises(ValueError): sequence(pack(entries),'webgl2',CROP,2,EXPECTED)
        entries=seq();m=json.loads(entries['sequence.json']);m['frames'][1]['timeSeconds']=1;entries['sequence.json']=json.dumps(m)
        with self.assertRaises(ValueError): sequence(pack(entries),'webgl2',CROP,2,EXPECTED)
    def test_valid_developer(self):
        self.assertEqual(developer(pack(dev()),'webgpu',CROP,2,SAMPLE,EXPECTED)['effectId'],EFFECT)
    def test_wrong_bytes_and_pin_and_missing_module(self):
        for key,value in [('public/assets/page_000.png',b'wrong'),('public/assets/skeleton.atlas','wrong'),('public/assets/skeleton.json','{}'),('public/chain-session.js',''),('package.json','{"devDependencies":{"vite":"8"}}')]:
            entries=dev();entries[key]=value
            with self.subTest(key=key),self.assertRaises(ValueError): developer(pack(entries),'webgpu',CROP,2,SAMPLE,EXPECTED)
    def test_handoff_mutations_rejected_by_both_exports(self):
        mutations = [('schemaVersion',2),('authoredFrames',41),('settings',{'mode':'oneShot'}),
                     ('targetOrder',['target-2','target-1']),
                     ('contactFrames',[{'id':'target-1','frame':2},{'id':'target-2','frame':8}]),
                     ('contactFrames',None)]
        for factory,key,verify in [(seq,'sequence.json',lambda b:sequence(b,'webgl2',CROP,2,EXPECTED)),
                                   (dev,'public/preset.json',lambda b:developer(b,'webgpu',CROP,2,SAMPLE,EXPECTED))]:
            for field,value in mutations:
                entries=factory();m=json.loads(entries[key]);m[field]=value;entries[key]=json.dumps(m)
                with self.subTest(archive=key,field=field,value=value),self.assertRaisesRegex(ValueError,'handoff mismatch: '+field):
                    verify(pack(entries))

    def test_unsafe_and_duplicate_zip_paths(self):
        for key in ['../x','/x','C:/x','a\\x','a//x']:
            with self.subTest(key=key),self.assertRaises(ValueError): archive(pack({key:'x'}))
        buf=io.BytesIO()
        with warnings.catch_warnings():
            warnings.simplefilter('ignore',UserWarning)
            with zipfile.ZipFile(buf,'w') as z:z.writestr('a','1');z.writestr('a','2')
        with self.assertRaises(ValueError): archive(buf.getvalue())

if __name__=='__main__':unittest.main()
