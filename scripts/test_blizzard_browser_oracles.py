import io, json, zipfile, unittest
from PIL import Image
from test_blizzard_browser import sequence, archive, developer, demo_response, MODULES
from base64 import b64encode

def zipped(items):
    f=io.BytesIO()
    with zipfile.ZipFile(f,'w',zipfile.ZIP_STORED) as z:
        for k,v in items.items(): z.writestr(k,v)
    return f.getvalue()

def frame(x=None, bad=False):
    im=Image.new('RGBA',(512,512))
    if x is not None: im.putpixel((x,5),(255,255,255,128))
    if bad: im.putpixel((0,0),(255,0,0,0))
    f=io.BytesIO();im.save(f,format='PNG');return f.getvalue()

def fixture(mode='oneShot', change=True, terminal=False, bad=False):
    count=40 if mode=='oneShot' else 60
    cfg={'mode':mode,'durationFrames':count}
    names=[f'frames/{i:04}.png' for i in range(count)]
    m=dict(schemaVersion=1,effectId='fx.air.blizzard',backend={'actual':'webgl2'},settings=cfg,frameCount=count,fps=60,alpha='straight-rgba8',width=512,height=512,crop={'x':0,'y':0,'width':512,'height':512},authoredFrames=count,terminalSeconds=39/60 if mode=='oneShot' else None,frameFormula='frameIndex/60',frames=[dict(frame=i,file=n,timeSeconds=i/60) for i,n in enumerate(names)])
    a,b,c=frame(1),frame(2),frame(); items={n:c for n in names};items[names[1]]=a;items[names[2]]=b if change else a
    if terminal:items[names[-1]]=a
    if bad:items[names[3]]=frame(bad=True)
    items['sequence.json']=json.dumps(m)
    return zipped(items),cfg,count

class Tests(unittest.TestCase):
    def test_motion_and_terminal(self):
        for mode in ('loop','oneShot'):
            data,cfg,n=fixture(mode);_,h,a=sequence(data,'webgl2',cfg,n,motion=True);self.assertEqual(len(h),n);self.assertEqual(sum(a),2)
        for kwargs,err in [({'change':False},'motion'),({'terminal':True},'terminal'),({'bad':True},'RGB at zero')]:
            data,cfg,n=fixture(**kwargs)
            with self.assertRaisesRegex(ValueError,err): sequence(data,'webgl2',cfg,n,motion=True)
    def test_archive_conflicts(self):
        for items in [{'../a':'x'},{'a':'x','a/b':'y'},{'A':'x','a':'y'}]:
            with self.assertRaises(ValueError): archive(zipped(items))
    def test_developer_parity(self):
        src={v:'// '+v for v in MODULES.values()};src['runtimeLicenses']='license'
        sample={'skeletonName':'rig.json','atlasName':'rig.atlas','skeleton':{'skeleton':{'spine':'4.2.43'}},'atlas':'a.png','images':{'a.png':b64encode(b'A').decode()}}
        cfg={'mode':'loop'};asset={'sourceSkeletonName':'rig.json','sourceAtlasName':'rig.atlas','skin':'','animation':'idle','skeleton':'assets/rig.json','atlas':'assets/rig.atlas','pages':[{'name':'a.png','path':'assets/a.png'}]}
        for target in ('webgl','webgpu'):
            p=dict(schemaVersion=1,effectId='fx.air.blizzard',settings=cfg,rendererPreference=target,compatibility={'pixi':'8.22.0','spine':'4.2.120','vite':'7.1.12'},asset=asset)
            entries={f'public/offline/{n}.js':src[k] for n,k in MODULES.items()};entries.update({'preset.json':json.dumps(p),'public/preset.json':json.dumps(p),'package.json':json.dumps({'dependencies':{'pixi.js':'8.22.0','@esotericsoftware/spine-pixi-v8':'4.2.120'}}),'LICENSES.txt':'license','FxBlizzard.mjs':src['fxBlizzardCore'],'Blizzard.mjs':src['fxBlizzardRuntime'],'FxBlizzardPose.mjs':src['fxBlizzardPose'],'public/assets/rig.json':json.dumps(sample['skeleton']),'public/assets/rig.atlas':'a.png','public/assets/a.png':b'A','public/offline.html':'<html>','public/offline/demo.js':'demo','example.js':'demo','index.html':'html','README.md':'readme'})
            data=zipped(entries);self.assertEqual(developer(data,target,cfg,src,sample,'','idle'),p)
            with archive(data) as z:
                self.assertEqual(demo_response(z,'https://blizzard.test/assets/a.png'),('image/png',b'A'));self.assertIsNone(demo_response(z,'https://other.test/assets/a.png'));self.assertIsNone(demo_response(z,'https://blizzard.test/%2e%2e/a'))
            entries['public/offline/runtime.js']='tampered'
            with self.assertRaisesRegex(ValueError,'module parity'): developer(zipped(entries),target,cfg,src,sample,'','idle')
if __name__=='__main__':unittest.main(verbosity=2)
