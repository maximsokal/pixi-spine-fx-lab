import io,json,unittest,zipfile
from PIL import Image,PngImagePlugin
import test_ground_impact_browser as B

def png(pixel, metadata=None):
    buf=io.BytesIO(); info=PngImagePlugin.PngInfo()
    if metadata is not None:info.add_text('frame',str(metadata))
    Image.new('RGBA',(1,1),pixel).save(buf,format='PNG',pnginfo=info)
    return buf.getvalue()

def archive(pixels):
    cfg={'schemaVersion':1,'seed':7311};crop={'x':0,'y':0,'width':1,'height':1};count=len(pixels)
    names=[f'frames/frame_{i:05}.png' for i in range(count)]
    m={'schemaVersion':1,'effectId':B.EFFECT,'backend':'webgl2','settings':cfg,'crop':crop,'count':count,'fps':60,'alpha':'straight-rgba8','width':1,'height':1,'authoredFrames':40,'durationSeconds':count/60,'terminalSeconds':39/60,'mode':'oneShot','layerIds':list(B.LAYERS),'frameFormula':'frameIndex/60','frames':[{'file':n,'frame':i,'timeSeconds':i/60} for i,n in enumerate(names)]}
    buf=io.BytesIO()
    with zipfile.ZipFile(buf,'w') as z:
        for i,(name,pixel) in enumerate(zip(names,pixels)):z.writestr(name,png(pixel,i))
        z.writestr('sequence.json',json.dumps(m));z.writestr('README.txt','fixture')
    return buf.getvalue(), 'webgl2',cfg,crop,count

A=(10,20,30,128);C=(11,20,30,128);Z=(0,0,0,0)
class MotionChecks(unittest.TestCase):
    def test_metadata_only_rejected(self):
        args=archive([A]*39+[Z]*3)
        _,frames=B.sequence(*args)
        self.assertEqual(len(set(h for h,v in frames[:39])),39)
        with self.assertRaisesRegex(ValueError,'distinct visible decoded frames'):B.sequence(*args,require_motion=True)
    def test_real_change_accepted(self):
        args=archive([A,C]+[A]*37+[Z]*3)
        self.assertEqual(len(B.sequence(*args,require_motion=True)[1]),42)
    def test_visibility_only_and_terminal_changes_rejected(self):
        for pixels in ([A]+[Z]*41,[A]*39+[C]*3,[Z]*42):
            with self.subTest(pixels=pixels[:2]),self.assertRaisesRegex(ValueError,'distinct visible decoded frames'):B.sequence(*archive(pixels),require_motion=True)
    def test_disabled_mode_preserves_static_and_all_off(self):
        for pixel in (A,Z):self.assertEqual(len(B.sequence(*archive([pixel]*42))[1]),42)
if __name__=='__main__':unittest.main(verbosity=2)
