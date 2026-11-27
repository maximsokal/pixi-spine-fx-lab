"""Synthetic assembly fixture: offline source preservation and marker checks."""
from pathlib import Path
from tempfile import TemporaryDirectory
from types import ModuleType
import json
import re
import sys

helper=ModuleType('build_editor')
helper.local=lambda root,name: root/name
helper.text=lambda path: path.read_text(encoding='utf-8')
helper.sample_data=lambda root,manifest: {'skeletonName':'rig.json','atlasName':'rig.atlas','skeleton':{'test':'</script> __DEVELOPER_DATA__'},'atlas':'a.png','images':{'a.png':'AA=='}}
sys.modules['build_editor']=helper
from build_ground_impact_editor import build

with TemporaryDirectory() as tmp:
    root=Path(tmp)
    t=root/'assets/template';s=root/'assets/ground-impact/src';m=root/'assets/magic-shield/src'
    vendors=['vendor/pixi-8.22.0.min.js','vendor/spine-pixi-v8-4.2.120.min.js']
    manifest={'runtime':{'pixi':'8.22.0','spinePixiV8':'4.2.120','spineExport':'4.2.x'},'browserScripts':vendors}
    def put(base,name,data):
        p=base/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(data,encoding='utf-8')
    put(t,'template.json',json.dumps(manifest))
    original='const s="</ScRiPt> __SAMPLE_DATA__";'
    for name in vendors+['licenses/pixi.txt','licenses/spine.txt']+['src/'+n+'.js' for n in ('curve-core','spacing-core','path-core','color-core','curve-editor','color-ui')]:put(t,name,original)
    for n in ('core','anchors','runtime','authoring','pose','session','loader','selection','asset-panel','export','bake','developer','export-panel','editor'):put(s,'ground-impact-'+n+'.js',original)
    put(m,'shield-export.js',original)
    html='<!-- VENDOR --><!-- CORES --><script id="sampleData" type="application/json">__SAMPLE_DATA__</script><script id="developerData" type="application/json">__DEVELOPER_DATA__</script><!-- APP -->'
    put(s,'ui.html',html)
    out=build(root)
    dev=json.loads(re.search(r'<script id="developerData" type="application/json">(.*?)</script>',out).group(1))
    assert len(dev['sources'])==15 and len(dev['vendors'])==2
    assert all(value==original for value in dev['sources'].values())
    assert all(value==original for value in dev['vendors'].values())
    assert dev['licenses']==original+'\n'+original
    assert out.index('id="shield-export.js"')<out.index('id="ground-impact-export-panel.js"')<out.index('id="ground-impact-editor.js"')
    assert json.loads(re.search(r'<script id="sampleData" type="application/json">(.*?)</script>',out).group(1))['skeleton']['test']=='</script> __DEVELOPER_DATA__'
    assert out.count('<!-- VENDOR -->')==0
    put(s,'ui.html',html+'__DEVELOPER_DATA__')
    try:build(root)
    except ValueError as e:assert '__DEVELOPER_DATA__' in str(e)
    else:raise AssertionError('duplicate marker accepted')
print('PASS: Ground Impact synthetic builder, raw developer sources, escape and order')
