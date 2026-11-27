"""Independent archive/PNG oracle regression fixtures; not GPU evidence."""
import io
import json
import unittest
import zipfile
from PIL import Image
from test_snow_browser import archive, sequence, developer, changed, metrics


def pack(entries):
    data=io.BytesIO()
    with zipfile.ZipFile(data,'w',zipfile.ZIP_STORED) as z:
        for name,value in entries.items():
            z.writestr(name,value)
    return data.getvalue()


def png(pixel=(220,240,255,128),size=(512,512)):
    im=Image.new('RGBA',size,(0,0,0,0));im.putpixel((0,0),pixel)
    data=io.BytesIO();im.save(data,format='PNG');return data.getvalue()


def seq():
    settings={'seed':7321,'exportFrames':2}
    m={'schemaVersion':1,'effectId':'fx.air.snowfall','settings':settings,'backend':{'actual':'webgl2'},'width':512,'height':512,'fps':60,'frameCount':2,'alpha':'straight-rgba8','frames':[{'frame':i,'file':f'frames/{i:04d}.png','timeSeconds':i/60} for i in range(2)]}
    return settings,m,{'frames/0000.png':png(),'frames/0001.png':png((255,255,255,100))}


class OracleTests(unittest.TestCase):
    def test_valid_sequence_and_pixel_metrics(self):
        settings,m,entries=seq();frames=sequence(pack({**entries,'sequence.json':json.dumps(m)}),settings,'webgl2',2)
        self.assertEqual(changed(*frames),1);self.assertEqual(changed(frames[0],frames[0]),0)
        self.assertEqual(metrics(frames[0]),{'visiblePixels':1,'transparentPixels':512**2-1,'partialPixels':1,'lightPartialPixels':1})

    def test_manifest_mutations_rejected(self):
        for field,value in [('settings',{'seed':99}),('backend',{'actual':'webgpu'}),('alpha','premultiplied'),('frameCount',1),('frames',[])]:
            with self.subTest(field=field):
                settings,m,entries=seq();m[field]=value
                with self.assertRaises(ValueError):sequence(pack({**entries,'sequence.json':json.dumps(m)}),settings,'webgl2',2)

    def test_bad_png_or_extra_file_rejected(self):
        for file,raw in [('frames/0001.png',png(size=(1,1))),('extra.txt',b'x')]:
            settings,m,entries=seq();entries[file]=raw
            with self.assertRaises(ValueError):sequence(pack({**entries,'sequence.json':json.dumps(m)}),settings,'webgl2',2)

    def test_unsafe_names_rejected(self):
        for entries in [{'A':b'a','a':b'b'},{'../bad':b'a'},{'a/b':b'a','a/./b':b'b'},{'C:bad':b'a'}]:
            with self.assertRaises(ValueError):archive(pack(entries))
        # Inject a raw central/local name independently of OS zip normalization.
        for invalid in [b'x\\y',b'x\x00y']:
            with self.assertRaises(ValueError):archive(pack({'x/y':b'x'}).replace(b'x/y',invalid))

    def test_developer_settings_assets_sources_and_pins(self):
        settings={'seed':7321};sample={'skeleton':{'skeleton':{'spine':'4.2.43'}},'atlas':'a.png\n','images':{'a.png':'eA=='}}
        p={'effectId':'fx.air.snowfall','settings':settings,'rendererPreference':'webgl','compatibility':{'pixi':'8.22.0','spine':'4.2.120','vite':'7.1.12'},'asset':{'skeleton':'assets/a.json','atlas':'assets/a.atlas'}}
        entries={'preset.json':json.dumps(p),'public/preset.json':json.dumps(p),'package.json':json.dumps({'dependencies':{'pixi.js':'8.22.0','@esotericsoftware/spine-pixi-v8':'4.2.120'},'devDependencies':{'vite':'7.1.12'}}),'public/assets/a.json':json.dumps(sample['skeleton']),'public/assets/a.atlas':sample['atlas'],'public/assets/a.png':b'x','Snow.mjs':'// source\nexport {};',**{k:'content' for k in ('example.js','index.html','README.md','LICENSES.txt')}}
        self.assertEqual(developer(pack(entries),settings,'webgl',sample,{'Snow.mjs':'// source'}),p)
        for name,value in [('public/preset.json','{}'),('Snow.mjs','// other'),('public/assets/a.png',b'y'),('package.json','{}')]:
            with self.subTest(name=name),self.assertRaises((ValueError,KeyError)):
                developer(pack({**entries,name:value}),settings,'webgl',sample,{'Snow.mjs':'// source'})


if __name__=='__main__':unittest.main()
