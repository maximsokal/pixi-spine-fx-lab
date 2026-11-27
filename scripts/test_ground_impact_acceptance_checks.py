#!/usr/bin/env python3
"""Independent synthetic archives for the G05 oracle; no GPU claims."""
import base64
import io
import json
import unittest
import warnings
import zipfile
from PIL import Image
import test_ground_impact_browser as B


def png(pixel, size=(1,1), mode='RGBA'):
    buf=io.BytesIO();Image.new(mode,size,pixel).save(buf,format='PNG');return buf.getvalue()


def pack(entries):
    buf=io.BytesIO()
    with zipfile.ZipFile(buf,'w') as z:
        for name,data in entries.items():z.writestr(name,data)
    return buf.getvalue()


class AcceptanceChecks(unittest.TestCase):
    def setUp(self):
        self.cfg={'schemaVersion':1,'seed':7311};self.crop={'x':0,'y':0,'width':1,'height':1}
        self.names=['frames/frame_00000.png','frames/frame_00001.png']
        self.m={'schemaVersion':1,'effectId':B.EFFECT,'backend':'webgl2','settings':self.cfg,'crop':self.crop,'count':2,'fps':60,'alpha':'straight-rgba8','width':1,'height':1,'authoredFrames':40,'durationSeconds':2/60,'terminalSeconds':39/60,'mode':'oneShot','layerIds':list(B.LAYERS),'frameFormula':'frameIndex/60','frames':[{'file':n,'frame':i,'timeSeconds':i/60} for i,n in enumerate(self.names)]}
        self.sample={'skeletonName':'rig.json','atlasName':'rig.atlas','skeleton':{'skeleton':{'spine':'4.2.43'}},'atlas':'a.png\nb.png','images':{'a.png':base64.b64encode(b'a').decode(),'b.png':base64.b64encode(b'b').decode()}}
        self.options={'animation':'idle','skin':'','speed':1.5,'visible':True}
        self.sources={'sources':{n:'source '+n for n in B.MODULES},'vendors':{n:'vendor '+n for n in B.VENDORS},'licenses':'notices'}

    def seq(self, **change):
        return {self.names[0]:png((10,20,30,128)),self.names[1]:png((0,0,0,0)),'sequence.json':json.dumps({**self.m,**change}),'README.txt':'fixture'}

    def validate(self, entries):return B.sequence(pack(entries),'webgl2',self.cfg,self.crop,2)

    def test_valid_sequence(self):
        m,frames=self.validate(self.seq());self.assertEqual(m,self.m);self.assertEqual([v for _,v in frames],[True,False]);self.assertNotEqual(frames[0][0],frames[1][0])

    def test_wrong_backend_timing_settings_crop_or_count_rejected(self):
        for change in ({'backend':'webgpu'},{'terminalSeconds':40/60},{'durationSeconds':1},{'settings':{}},{'crop':{}},{'count':3},{'frames':[]},{'layerIds':['ring']}):
            with self.subTest(change=change),self.assertRaises(ValueError):self.validate(self.seq(**change))

    def test_pixel_and_entry_checks(self):
        for raw in (png((1,0,0,0)),png((0,0,0,0),(2,1)),png((0,0,0),(1,1),'RGB')):
            e=self.seq();e[self.names[1]]=raw
            with self.assertRaises(ValueError):self.validate(e)
        e=self.seq();del e[self.names[1]]
        with self.assertRaises(ValueError):self.validate(e)

    def test_archive_rejects_unsafe_duplicate_and_crc(self):
        for name in ('../bad','a\\b','a//b','C:bad'):
            with self.assertRaises(ValueError):B.archive(pack({name:b'x'}))
        buf=io.BytesIO()
        with warnings.catch_warnings(),zipfile.ZipFile(buf,'w') as z:
            warnings.simplefilter('ignore',UserWarning);z.writestr('a','x');z.writestr('a','y')
        with self.assertRaises(ValueError):B.archive(buf.getvalue())
        data=bytearray(pack({'a':b'UNIQUE PAYLOAD'}));data[data.index(b'UNIQUE PAYLOAD')]=0
        with self.assertRaises(ValueError):B.archive(data)

    def dev(self):
        m={'schemaVersion':1,'effectId':B.EFFECT,'rendererPreference':'webgl','settings':self.cfg,'crop':self.crop,'frameCount':2,'previewSeconds':.2,'authoredFrames':40,'fps':60,'compatibility':{'pixi':'8.22.0','spine':'4.2.120'},'asset':{'sourceSkeletonName':'rig.json','sourceAtlasName':'rig.atlas','version':'4.2.43','options':self.options,'skeleton':'assets/skeleton.json','atlas':'assets/skeleton.atlas','images':[{'name':'a.png','path':'assets/page_000.bin','type':''},{'name':'b.png','path':'assets/page_001.bin','type':''}]}}
        return {'public/preset.json':json.dumps(m),'package.json':json.dumps({'dependencies':{'pixi.js':'8.22.0','@esotericsoftware/spine-pixi-v8':'4.2.120'}}),'public/assets/skeleton.json':json.dumps(self.sample['skeleton']),'public/assets/skeleton.atlas':self.sample['atlas'],'public/assets/page_000.bin':b'a','public/assets/page_001.bin':b'b','public/LICENSES.txt':'notices',**{'public/'+n:v for n,v in self.sources['sources'].items()},**{'public/vendor/'+n:v for n,v in self.sources['vendors'].items()},**{n:'fixture' for n in ('public/index.html','public/example.js','public/ground-demo.js','README.md')}}

    def check_dev(self,e):return B.developer(pack(e),'webgl',self.cfg,self.crop,2,.2,self.sample,self.options,self.sources)

    def test_developer_exact_bytes_and_metadata(self):
        self.assertEqual(self.check_dev(self.dev())['asset']['options'],self.options)
        for name in ('public/assets/page_001.bin','public/assets/skeleton.atlas','public/ground-impact-core.js','public/vendor/'+B.VENDORS[0],'public/LICENSES.txt'):
            e=self.dev();e[name]='changed'
            with self.subTest(name=name),self.assertRaises(ValueError):self.check_dev(e)
        e=self.dev();m=json.loads(e['public/preset.json']);m['asset']['options']['speed']=1;e['public/preset.json']=json.dumps(m)
        with self.assertRaises(ValueError):self.check_dev(e)

    def test_demo_response_only_archive_origin_and_paths(self):
        with B.archive(pack(self.dev())) as z:
            self.assertEqual(B.demo_response(z,'https://ground-impact.test/'),('text/html',b'fixture'))
            self.assertEqual(B.demo_response(z,'https://ground-impact.test/assets/page_001.bin'),('application/octet-stream',b'b'))
            for url in ('http://ground-impact.test/','https://example.com/index.html','https://ground-impact.test/%2e%2e/package.json','https://ground-impact.test/absent.js'):
                self.assertIsNone(B.demo_response(z,url))


if __name__=='__main__':unittest.main(verbosity=2)
