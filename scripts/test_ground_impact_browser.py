#!/usr/bin/env python3
"""EARTH-01 G05 candidate browser acceptance; not a release certificate."""
import argparse
import base64
import hashlib
import io
import json
import os
from pathlib import Path
from urllib.parse import unquote, urlsplit
import zipfile
from PIL import Image

EFFECT = 'fx.earth.ground-impact'
LAYERS = ('ring', 'debris', 'dust')
MODULES = ('curve-core.js', 'spacing-core.js', 'path-core.js', 'color-core.js',
           *('ground-impact-'+k+'.js' for k in ('core','anchors','runtime','authoring','pose','session','loader','editor','export','bake')),
           'shield-export.js')
VENDORS = ('pixi-8.22.0.min.js', 'spine-pixi-v8-4.2.120.min.js')
CROP = {'x':128,'y':192,'width':256,'height':256}


def check(ok, message):
    if not ok:
        raise ValueError(message)


def archive(data):
    z = zipfile.ZipFile(io.BytesIO(data))
    try:
        names = z.namelist()
        check(len(names)==len(set(names)), 'duplicate ZIP entry')
        check(all(n and '\\' not in n and ':' not in n and all(p not in ('','.','..') for p in n.split('/')) for n in names), 'unsafe ZIP path')
        check(sum(i.file_size for i in z.infolist())<=256*1024**2, 'ZIP budget')
        check(z.testzip() is None, 'ZIP CRC')
        return z
    except Exception:
        z.close()
        raise


def sequence(data, backend, settings, crop, count, *, require_motion=False):
    with archive(data) as z:
        names = [f'frames/frame_{i:05}.png' for i in range(count)]
        check(set(z.namelist())==set(names+['sequence.json','README.txt']), 'sequence entries')
        m = json.loads(z.read('sequence.json'))
        check((m['schemaVersion'],m['effectId'],m['backend'],m['settings'],m['crop'],m['count'],m['fps'],m['alpha'])==(1,EFFECT,backend,settings,crop,count,60,'straight-rgba8'), 'sequence manifest')
        check((m['width'],m['height'],m['authoredFrames'],m['durationSeconds'],m['terminalSeconds'],m['mode'],m['layerIds'],m['frameFormula'])==(crop['width'],crop['height'],40,count/60,39/60,'oneShot',list(LAYERS),'frameIndex/60'), 'sequence timing/dimensions')
        check(m['frames']==[{'file':n,'frame':i,'timeSeconds':i/60} for i,n in enumerate(names)], 'frame times')
        frames=[]
        visible_pixel_hashes=set()
        for i,n in enumerate(names):
            raw=z.read(n)
            with Image.open(io.BytesIO(raw)) as im:
                check(im.format=='PNG' and im.mode=='RGBA' and im.size==(crop['width'],crop['height']), 'PNG format/dimensions')
                pixels=im.tobytes()
                check(all(pixels[i+3] or pixels[i:i+3]==b'\0\0\0' for i in range(0,len(pixels),4)), 'RGB at zero alpha')
                visible=im.getchannel('A').getbbox() is not None
                frames.append((hashlib.sha256(raw).hexdigest(),visible))
                if require_motion and i<39 and visible:
                    visible_pixel_hashes.add(hashlib.sha256(pixels).digest())
        if require_motion:
            check(len(visible_pixel_hashes)>=2, 'expected at least two distinct visible decoded frames before terminal')
        return m,frames


def developer(data, target, settings, crop, count, seconds, sample, options, sources):
    with archive(data) as z:
        m=json.loads(z.read('public/preset.json'))
        check((m['schemaVersion'],m['effectId'],m['rendererPreference'],m['settings'],m['crop'],m['frameCount'],m['previewSeconds'],m['authoredFrames'],m['fps'])==(1,EFFECT,target,settings,crop,count,seconds,40,60), 'developer manifest')
        check(m['compatibility']=={'pixi':'8.22.0','spine':'4.2.120'}, 'runtime pins')
        check(json.loads(z.read('package.json'))['dependencies']=={'pixi.js':'8.22.0','@esotericsoftware/spine-pixi-v8':'4.2.120'}, 'package pins')
        for n in MODULES:
            check(z.read('public/'+n)==sources['sources'][n].encode(), 'source parity: '+n)
        for n in VENDORS:
            check(z.read('public/vendor/'+n)==sources['vendors'][n].encode(), 'vendor parity: '+n)
        check(z.read('public/LICENSES.txt')==sources['licenses'].encode(), 'license parity')
        for n in ('public/index.html','public/example.js','public/ground-demo.js','README.md'):
            check(bool(z.read(n)), 'missing/empty '+n)
        a=m['asset']
        check((a['sourceSkeletonName'],a['sourceAtlasName'],a['version'],a['options'])==(sample['skeletonName'],sample['atlasName'],sample['skeleton']['skeleton']['spine'],options), 'asset identity/options')
        check(json.loads(z.read('public/'+a['skeleton']))==sample['skeleton'], 'skeleton content')
        check(z.read('public/'+a['atlas'])==sample['atlas'].encode(), 'atlas bytes')
        check(len(a['images'])==len(sample['images']) and {p['name'] for p in a['images']}==set(sample['images']), 'page identities')
        paths=[a['skeleton'],a['atlas']]+[p['path'] for p in a['images']]
        check(len(paths)==len(set(paths)), 'asset alias conflict')
        for p in a['images']:
            check(z.read('public/'+p['path'])==base64.b64decode(sample['images'][p['name']],validate=True), 'page bytes')
        return m


def probe(page, backend):
    return page.evaluate('''async b=>{if(b==='webgpu'){try{return !!(navigator.gpu && await navigator.gpu.requestAdapter());}catch{return false;}}return !!document.createElement('canvas').getContext(b==='webgl2'?'webgl2':'webgl');}''',backend)


def demo_response(z,url):
    p=urlsplit(url)
    if p.scheme!='https' or p.netloc!='ground-impact.test':return None
    path=unquote(p.path).lstrip('/') or 'index.html'
    if '\\' in path or any(k in ('','.','..') for k in path.split('/')):return None
    name='public/'+path
    if name not in z.namelist():return None
    mime={'js':'text/javascript','html':'text/html','json':'application/json'}.get(path.rsplit('.',1)[-1],'application/octet-stream')
    return mime,z.read(name)


def run_demo(browser,data,target,backend):
    errors=[];blocked=[]
    with archive(data) as z:
        page=browser.new_page(service_workers='block')
        try:
            page.on('pageerror',lambda e:errors.append(str(e)))
            def serve(route):
                response=demo_response(z,route.request.url)
                if response is None:blocked.append(route.request.url);route.abort()
                else:route.fulfill(status=200,content_type=response[0],body=response[1])
            page.route('**/*',serve)
            page.goto('https://ground-impact.test/index.html')
            page.wait_for_function("document.getElementById('backend').textContent!=='Loading'")
            actual=page.locator('#backend').inner_text().split(' ')[0]
            check(actual in ('webgl1','webgl2','webgpu'), 'developer startup failed')
            check(target!='webgl' or actual.startswith('webgl'), 'WebGL ZIP selected wrong backend')
            check(target!='webgpu' or not probe(page,'webgpu') or actual=='webgpu', 'WebGPU adapter available but demo fell back')
            check(target!='webgpu' or backend!='webgpu' or actual=='webgpu', 'unexpected WebGPU fallback')
            check(page.locator('#preview canvas').count()==1, 'developer canvas')
            for k in ('reset','play','pause','destroy'):page.locator('#'+k).click()
            check(page.locator('#destroy').is_disabled() and page.locator('#preview canvas').count()==0, 'developer teardown')
            check(not errors and not blocked, 'developer page/network error: '+str(errors+blocked))
            return actual
        finally:page.close()


def run(html, backend, output):
    from playwright.sync_api import sync_playwright
    check(html.is_file(), 'build standalone HTML first')
    output.mkdir(parents=True,exist_ok=True)
    check(not any(output.iterdir()), 'evidence directory must be empty')
    report={'status':'FAIL','requestedBackend':backend,'actualBackend':None,'htmlSha256':hashlib.sha256(html.read_bytes()).hexdigest(),'checks':[],'pageErrors':[],'network':[],'remaining':['visual review','all individual parameter witnesses','architecture','physical-device performance']}
    try:
        with sync_playwright() as p:
            browser=p.chromium.launch(headless=os.environ.get('GROUND_HEADED')!='1',executable_path=os.environ.get('BROWSER_EXECUTABLE'),args=json.loads(os.environ.get('GROUND_BROWSER_ARGS','[]')))
            try:
                report['browser']=browser.version
                page=browser.new_page(offline=True,accept_downloads=True,viewport={'width':1440,'height':1000},service_workers='block')
                page.on('pageerror',lambda e:report['pageErrors'].append(str(e)))
                page.on('request',lambda r:report['network'].append(r.url) if r.url.startswith(('http:','https:')) else None)
                page.goto(html.resolve().as_uri())
                page.wait_for_function("!document.getElementById('backend').disabled")
                if page.locator('#actual').inner_text().split(' ')[0]!=backend:
                    page.locator('#backend').select_option(backend)
                    page.wait_for_function("!document.getElementById('backend').disabled")
                check(not report['pageErrors'] and not report['network'],'startup page/network error')
                if page.locator('#actual').inner_text().split(' ')[0]!=backend:
                    check(not probe(page,backend),'backend available but editor failed: '+page.locator('#status').inner_text())
                    report.update(status='NOT RUN',error='Requested backend unavailable');return report
                check(page.locator('#status').get_attribute('data-error')=='false','preview not ready')
                report['actualBackend']=backend
                check(page.evaluate('PIXI.VERSION')=='8.22.0','Pixi runtime pin')
                page.locator('details').evaluate_all('(els)=>els.forEach(e=>e.open=true)')
                def read():return json.loads(page.locator('#preset').input_value())
                def apply(cfg):
                    page.locator('#preset').fill(json.dumps(cfg));page.locator('#apply').click()
                    check(read()==cfg and page.locator('#status').get_attribute('data-error')=='false','preset restore')
                def download(button,name):
                    with page.expect_download(timeout=180000) as event:page.locator('#'+button).click()
                    event.value.save_as(output/name)
                    page.wait_for_function("!document.getElementById('backend').disabled")
                    check(page.locator('#status').get_attribute('data-error')=='false','export failed')
                    return (output/name).read_bytes()
                base=read()
                for k,v in [('exportWidth',256),('exportHeight',256),('exportX',0),('exportY',64),('exportFrames',42)]:page.locator('#'+k).fill(str(v))
                m,frames=sequence(download('exportPng','default.zip'),backend,base,CROP,42,require_motion=True)
                check(m['asset'] is None and frames[12][1] and not any(v for _,v in frames[39:]),'impact peak/terminal')
                page.locator('#zoomIn').click();page.locator('#zoomIn').click();page.locator('#exportGuide').uncheck()
                page.locator('#frame').evaluate("e=>{e.value=20;e.dispatchEvent(new Event('input',{bubbles:true}));}")
                check(page.locator('#frame').input_value()=='20','preview seek failed')
                _,again=sequence(download('exportPng','zoomed.zip'),backend,base,CROP,42,require_motion=True)
                check(frames==again,'camera/guide/preview time changed PNG bytes')
                for kind in (*LAYERS,'none'):
                    cfg=json.loads(json.dumps(base))
                    for k in LAYERS:cfg['layers'][k]['enabled']=k==kind
                    apply(cfg)
                    _,layer=sequence(download('exportPng','only-'+kind+'.zip'),backend,cfg,CROP,42)
                    check(any(v for _,v in layer[:39])==(kind!='none') and not any(v for _,v in layer[39:]),'independent layer: '+kind)
                apply(base);report['checks'].append('actual backend, 42 frames, distinct visible decoded frames, peak/terminal, independent layers, camera/guide/preview time byte parity')
                page.get_by_role('button',name='Load sample',exact=True).click()
                page.wait_for_function("!document.getElementById('backend').disabled")
                check(page.locator('#status').inner_text()=='Source accepted','sample load failed')
                sample=page.evaluate("JSON.parse(document.getElementById('sampleData').textContent)")
                sources=page.evaluate("JSON.parse(document.getElementById('developerData').textContent)")
                animation=page.locator('#animation option').nth(1).get_attribute('value')
                check(bool(animation),'sample animation missing');page.locator('#animation').select_option(animation)
                page.locator('#speed').fill('1.5');page.locator('#speed').dispatch_event('change')
                page.locator('#frame').evaluate("e=>{e.value=12;e.dispatchEvent(new Event('input',{bubbles:true}));}")
                options={'animation':animation,'skin':page.locator('#skin').input_value(),'speed':1.5,'visible':True}
                m,asset_frames=sequence(download('exportPng','sample.zip'),backend,base,CROP,42)
                check(m['asset']['name']==sample['skeletonName'] and m['asset']['atlasName']==sample['atlasName'] and m['asset']['options']==options and set(m['asset']['images'])==set(sample['images']),'PNG sample metadata')
                check(any(v for _,v in asset_frames[39:]),'Spine must remain visible after FX terminal')
                report['developerBackends']={}
                for target,button in [('webgl','exportWebGL'),('webgpu','exportWebGPU')]:
                    data=download(button,'developer-'+target+'.zip')
                    developer(data,target,base,CROP,42,12/60,sample,options,sources)
                    report['developerBackends'][target]=run_demo(browser,data,target,backend)
                check(not report['network'] and not report['pageErrors'],'editor page/network error')
                report['checks'].append('sample, extended Spine bake, exact developer sources/assets, offline demo startup and teardown')
                report['status']='PASS'
            finally:browser.close()
    except Exception as e:report['error']=str(e)
    finally:(output/'candidate-browser.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
    return report


if __name__=='__main__':
    ap=argparse.ArgumentParser(description=__doc__);ap.add_argument('--html',type=Path,required=True);ap.add_argument('--backend',choices=('webgl1','webgl2','webgpu'),required=True);ap.add_argument('--output',type=Path,required=True)
    args=ap.parse_args();result=run(args.html,args.backend,args.output);print(json.dumps(result));raise SystemExit(0 if result['status']=='PASS' else 2 if result['status']=='NOT RUN' else 1)
