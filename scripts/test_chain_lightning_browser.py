#!/usr/bin/env python3
"""ELEC-02 real browser acceptance. No simulated renderer or GPU PASS."""
import argparse
import base64
import io
import json
import os
from pathlib import Path
import zipfile
from PIL import Image

EFFECT = 'fx.ice.chain-lightning'
MODULES = ('curve-core.js', 'spacing-core.js', 'path-core.js', 'color-core.js', 
           'shockwave-spine.js', 'chain-core.js', 'chain-anchors.js',
           'chain-runtime.js', 'chain-authoring.js',
           'chain-session.js', 'shield-export.js', 'chain-export.js',
           'chain-bake.js')
VENDORS = ('pixi-8.22.0.min.js', 'spine-pixi-v8-4.2.120.min.js')


def check(condition, message):
    if not condition:
        raise ValueError(message)


def archive(data):
    z = zipfile.ZipFile(io.BytesIO(data))
    try:
        names = z.namelist()
        check(len(names) == len(set(names)), 'duplicate ZIP entry')
        check(all(n and '\\' not in n and ':' not in n and
                  all(p not in ('', '.', '..') for p in n.split('/')) for n in names), 'unsafe ZIP path')
        check(sum(i.file_size for i in z.infolist()) <= 256 * 1024**2, 'ZIP budget')
        check(z.testzip() is None, 'ZIP CRC')
        return z
    except Exception:
        z.close()
        raise


def check_handoff(manifest, expected):
    for key in ('schemaVersion', 'authoredFrames', 'settings', 'targetOrder', 'contactFrames'):
        check(key in manifest and key in expected and manifest[key] == expected[key],
              'handoff mismatch: ' + key)


def sequence(data, backend, crop, count, expected):
    with archive(data) as z:
        names = [f'frames/frame_{i:05}.png' for i in range(count)]
        check(set(z.namelist()) == set(names + ['sequence.json', 'README.txt']), 'sequence entries')
        m = json.loads(z.read('sequence.json'))
        check_handoff(m, expected)
        check((m['effectId'], m['backend'], m['crop'], m['count'], m['fps'], m['alpha']) ==
              (EFFECT, backend, crop, count, 60, 'straight-rgba8'), 'sequence manifest')
        check((m['width'], m['height']) == (crop['width'], crop['height']), 'manifest dimensions')
        check(m['mode'] == 'oneShot' and type(m['authoredFrames']) is int and 6 <= m['authoredFrames'] <= 3600, 'authored cycle')
        check(m['frames'] == [{'file': n, 'frame': i, 'timeSeconds': i/60, 'sampleSeconds': i/60} for i, n in enumerate(names)], 'frame times')
        frames = []
        for n in names:
            with Image.open(io.BytesIO(z.read(n))) as im:
                check(im.format == 'PNG' and im.mode == 'RGBA' and im.size == (crop['width'], crop['height']), 'PNG dimensions/format')
                frames.append(im.copy())
        return m, frames


def developer(data, target, crop, count, sample, expected):
    with archive(data) as z:
        m = json.loads(z.read('public/preset.json'))
        check_handoff(m, expected)
        check((m['effectId'], m['rendererPreference'], m['crop'], m['frameCount']) == (EFFECT, target, crop, count), 'developer manifest')
        check(m['compatibility'] == {'pixi':'8.22.0','spine':'4.2.120'}, 'runtime pins')
        check(json.loads(z.read('package.json'))['devDependencies'] == {'vite':'7.1.12'}, 'Vite pin')
        required = ['public/' + n for n in MODULES + ('LICENSES.txt', 'index.html', 'example.js', 'chain-lightning-demo.js')]
        required += ['public/vendor/' + n for n in VENDORS] + ['bootstrap.html', 'vite.config.js', 'README.md']
        for name in required:
            check(bool(z.read(name)), 'missing/empty ' + name)
        a = m['asset']
        check(a['version'].startswith('4.2.') and a['sourceSkeletonName'] == sample['skeletonName'], 'asset identity')
        check(json.loads(z.read('public/' + a['skeleton'])) == sample['skeleton'], 'skeleton content')
        check(z.read('public/' + a['atlas']).decode() == sample['atlas'], 'atlas bytes')
        check(len(a['images']) == len(sample['images']) and {p['name'] for p in a['images']} == set(sample['images']), 'page identities')
        paths = [a['skeleton'], a['atlas']] + [p['path'] for p in a['images']]
        check(len(paths) == len(set(paths)), 'asset alias conflict')
        for p in a['images']:
            check(z.read('public/' + p['path']) == base64.b64decode(sample['images'][p['name']], validate=True), 'image bytes')
        return m



def demo_response(z, url):
    """Serve only public archive entries, never access the filesystem or network."""
    from urllib.parse import urlsplit, unquote
    from mimetypes import guess_type
    p = urlsplit(url)
    if p.scheme != 'https' or p.netloc != 'chain-lightning.test':
        return None
    path = unquote(p.path).lstrip('/') or 'index.html'
    if any(part in ('', '.', '..') for part in path.split('/')) or '\\' in path:
        return None
    name = 'public/' + path
    if name not in z.namelist():
        return None
    mime = 'text/javascript' if path.endswith('.js') else guess_type(path)[0] or 'application/octet-stream'
    return mime, z.read(name)


def run_developer(browser, data, target, tested_backend, output):
    """Execute original local HTML and ESM from ZIP with every HTTP request intercepted."""
    errors, blocked = [], []
    with archive(data) as z:
        page = browser.new_page(viewport={'width':800,'height':800}, service_workers='block')
        try:
            page.on('pageerror', lambda e: errors.append(str(e)))
            def serve(route):
                response = demo_response(z, route.request.url)
                if response is None:
                    blocked.append(route.request.url)
                    route.abort()
                else:
                    mime, body = response
                    route.fulfill(status=200, content_type=mime, body=body)
            page.route('**/*', serve)
            page.goto('https://chain-lightning.test/index.html')
            page.wait_for_function("document.getElementById('backend').textContent!=='Loading'")
            actual = page.locator('#backend').inner_text()
            check(actual in ('webgl1','webgl2','webgpu'), 'Developer demo failed: ' + actual)
            check(target != 'webgl' or actual.startswith('webgl'), 'WebGL demo selected wrong backend')
            check(target != 'webgpu' or tested_backend != 'webgpu' or actual == 'webgpu', 'WebGPU demo unexpectedly fell back')
            check(page.locator('#preview canvas').count() == 1, 'missing developer canvas')
            page.locator('#reset').click()
            page.locator('#play').click()
            page.locator('#pause').click()
            page.locator('#preview').screenshot(path=output/('developer-'+target+'-preview.png'))
            page.locator('#destroy').click()
            check(page.locator('#destroy').is_disabled(), 'developer teardown control')
            check(not errors and not blocked, 'developer page/network error: ' + str(errors+blocked))
            return actual
        finally:
            page.close()


def run(html, backend, output):
    from playwright.sync_api import sync_playwright
    check(html.is_file(), 'build the standalone HTML first')
    output.mkdir(parents=True, exist_ok=True)
    check(not any(output.iterdir()), 'evidence directory must be empty')
    report = {'status':'FAIL', 'requestedBackend':backend, 'actualBackend':None, 'checks':[], 'network':[], 'pageErrors':[]}
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True, executable_path=os.environ.get('BROWSER_EXECUTABLE'),
                                        args=json.loads(os.environ.get('CHAIN_BROWSER_ARGS', '[]')))
            try:
                report['browser'] = browser.version
                page = browser.new_page(offline=True, accept_downloads=True, viewport={'width':1440,'height':1000})
                page.on('pageerror', lambda e: report['pageErrors'].append(str(e)))
                page.on('request', lambda r: report['network'].append(r.url) if r.url.startswith(('http:', 'https:')) else None)
                page.goto(html.resolve().as_uri())
                page.wait_for_function("!document.getElementById('backend').disabled")
                if page.locator('#backend').input_value() != backend:
                    page.locator('#backend').select_option(backend)
                page.wait_for_function("!document.getElementById('backend').disabled")
                if page.locator('#actual').inner_text() != backend:
                    check(not report['pageErrors'] and not report['network'], 'startup page/network error')
                    reason = page.locator('#status').inner_text()
                    unavailable = page.evaluate("""async b=>{
                        if(b==='webgpu'){
                            try{return !navigator.gpu || !await navigator.gpu.requestAdapter();}
                            catch{return true;}
                        }
                        return !document.createElement('canvas').getContext(b==='webgl2'?'webgl2':'webgl');
                    }""", backend)
                    check(unavailable, 'Backend exists but editor initialization failed: ' + reason)
                    report['status'] = 'NOT_RUN'
                    report['error'] = 'Requested backend unavailable: ' + reason
                    return report
                check(page.locator('#status').get_attribute('data-error')=='false', 'preview not ready')
                report['actualBackend'] = backend
                check(page.evaluate('PIXI.VERSION') == '8.22.0', 'actual Pixi pin')
                base = json.loads(page.locator('#preset').input_value())
                full = {'x':0,'y':0,'width':512,'height':512}
                crop = {'x':0,'y':0,'width':512,'height':512}
                def capture(name, cfg, t, region=full):
                    raw = bytes(page.evaluate('''async ({cfg,t,region,backend})=>{
                      const s=await FxChainBake.sceneFactory()({settings:cfg,backend,crop:region});
                      try{return Array.from(await FxShieldExport.encodePng(await s.readFrame(t)));}finally{s.destroy();}
                    }''', {'cfg':cfg,'t':t,'region':region,'backend':backend}))
                    (output/(name+'.png')).write_bytes(raw)
                    with Image.open(io.BytesIO(raw)) as im:
                        check(im.mode=='RGBA' and im.size==(region['width'],region['height']), 'capture format')
                        return im.copy()
                def visible(im): return im.getchannel('A').getbbox() is not None
                once=json.loads(json.dumps(base))
                check(base['mode']=='oneShot' and base['durationFrames']==40, 'default timeline')
                check(not visible(capture('charge',once,0)), 'start must be transparent')
                peak = capture('peak',base,17/60)
                check(visible(peak), 'peak invisible')
                check(not visible(capture('tail',once,39/60)), 'tail not transparent')
                check(capture('repeat',base,17/60).tobytes()==peak.tobytes(), 'deterministic bake')
                for kind in ('arcs','branches','glow','none'):
                    cfg=json.loads(json.dumps(base))
                    for target in cfg['targets']:
                        for k, layer in target['layers'].items(): layer['enabled']=k==kind
                    check(visible(capture('only-'+kind,cfg,17/60)) == (kind!='none'), 'layer '+kind)
                signed = {'x':-3,'y':-2,'width':515,'height':514}
                check(capture('signed-crop',base,17/60,signed).crop((3,2,515,514)).tobytes() == peak.tobytes(), 'signed crop parity')
                # Transparent RGB must be zero; at least one partially covered pixel at peak.
                check(any(0 < a < 255 for _,_,_,a in peak.getdata()), 'missing fractional alpha')
                check(all(a or (r,g,b)==(0,0,0) for r,g,b,a in peak.getdata()), 'nonzero RGB at zero alpha')
                report['checks'].append('actual backend, phases, independent layers, crop and transparent alpha')
                page.locator('details').evaluate_all('(els)=>els.forEach(e=>e.open=true)')
                def read(): return json.loads(page.locator('#preset').input_value())
                def apply(cfg):
                    page.locator('#preset').fill(json.dumps(cfg))
                    page.locator('#apply').click()
                    check(page.locator('#status').get_attribute('data-error')=='false', 'preset restore')
                    check(read()==cfg, 'preset roundtrip')
                edited=json.loads(json.dumps(base))
                edited['arcWidth']=8
                edited['curves']['width']['keys'][1]['y']=0.5
                apply(edited)
                check(capture('changed-width',edited,17/60).tobytes()!=peak.tobytes(), 'parameter/curve pixels unchanged')
                page.locator('#target').select_option('target-1')
                page.locator('#layer').select_option('arcs')
                page.locator('#dragScope').select_option('layer')
                page.locator('#frame').evaluate("e=>{e.value='17';e.dispatchEvent(new Event('input'));}")
                handle=page.locator('#handle')
                before_origin=handle.get_attribute('style')
                page.locator('#frame').evaluate("e=>{e.value='20';e.dispatchEvent(new Event('input'));}")
                check(handle.get_attribute('style')==before_origin, 'origin changes with seek')
                handle.focus();handle.press('ArrowRight')
                moved=read()
                check(moved['targets'][0]['layers']['arcs']['x']==edited['targets'][0]['layers']['arcs']['x']+1, 'layer nudge')
                check(moved['targets'][0]['layers']['glow']==edited['targets'][0]['layers']['glow'], 'independent layer')
                reordered=json.loads(json.dumps(base));reordered['targets'].reverse()
                check(capture('reordered',reordered,17/60).tobytes()!=peak.tobytes(), 'ordered routing pixels unchanged')
                check(page.evaluate("""c=>{
                    const p=FxChainLightning.compile(c);
                    const expected=[2,109/12,14.5,17];
                    return p.meta.plans.length===expected.length && p.meta.plans.every((x,i)=>Math.abs(x.contactFrame-expected[i])<1e-8);
                }""",base), 'default contact schedule')
                apply(once)
                report['checks'].append('preset, pixel changes, independent marker, ordered routing and contact schedule')
                page.locator('details').evaluate_all('(els)=>els.forEach(e=>e.open=true)')
                for k,v in {**crop,'frames':40}.items(): page.locator('#export-'+k).fill(str(v))
                def expected_handoff():
                    # Read the authored preset before export, never from the archive being checked.
                    return page.evaluate("""c=>{
                        const p=FxChainLightning.compile(c);
                        return {schemaVersion:1,authoredFrames:p.meta.frames,settings:p.settings,
                                targetOrder:p.settings.targets.map(t=>t.id),
                                contactFrames:p.meta.plans.map(q=>({id:q.id,frame:q.contactFrame}))};
                    }""",read())
                expected = expected_handoff()
                def download(button,name):
                    with page.expect_download(timeout=180000) as event: page.locator('#'+button).click()
                    dest=output/name;event.value.save_as(dest)
                    page.wait_for_function("!document.getElementById('exportFields').disabled")
                    check(page.locator('#status').get_attribute('data-error')=='false', 'export failed')
                    return dest.read_bytes()
                m, first=sequence(download('exportPng','sequence.zip'),backend,crop,40,expected)
                check(not visible(first[0]) and visible(first[17]) and not visible(first[-1]), 'sequence phases')
                page.locator('#zoom').evaluate("e=>{e.value='150';e.dispatchEvent(new Event('input'));}")
                page.locator('#background').select_option('light')
                n, second=sequence(download('exportPng','sequence-camera.zip'),backend,crop,40,expected)
                check(m==n and all(a.tobytes()==b.tobytes() for a,b in zip(first,second)), 'camera parity')
                report['checks'].append('40-frame UI export, camera invariance')
                page.locator('#sample').click()
                page.wait_for_function("!document.getElementById('assets').disabled")
                check(page.locator('#status').get_attribute('data-error')=='false' and page.locator('#assetName').inner_text()!='No Spine asset', 'sample import')
                page.locator('#frame').evaluate("e=>{e.value='20';e.dispatchEvent(new Event('input'));}")
                for bg in ('dark','light','checker'):
                    page.locator('#background').select_option(bg)
                    page.locator('#surface').screenshot(path=output/('preview-'+bg+'.png'))
                sample=page.evaluate("JSON.parse(document.getElementById('sampleData').textContent)")
                animations=page.locator('#animation option').evaluate_all('(els)=>els.map(e=>e.value).filter(Boolean)')
                check(bool(animations), 'sample animation missing')
                page.locator('#animation').select_option(animations[0])
                anchored=json.loads(json.dumps(once))
                anchored['targets'][0]['anchor'].update(type='bone',space='local',name=page.evaluate("JSON.parse(document.getElementById('sampleData').textContent).skeleton.bones[0].name"),x=0,y=0)
                apply(anchored)
                check(not page.locator('#missing').inner_text(), 'real sample bone anchor missing')
                for f in (12,24,12):
                    page.locator('#frame').evaluate("(e,f)=>{e.value=String(f);e.dispatchEvent(new Event('input'));}",f)
                    if f==12:
                        now=page.locator('#surface canvas').screenshot()
                        if 'anchored_first' in locals(): check(now==anchored_first, 'anchored reverse seek mismatch')
                        else: anchored_first=now
                report['checks'].append('real sample animation and anchored backward-seek parity')
                expected = expected_handoff()
                for target, button in [('webgl','exportWebgl'),('webgpu','exportWebgpu')]:
                    data = download(button,'developer-'+target+'.zip')
                    developer(data,target,crop,40,sample,expected)
                    report.setdefault('developerBackends', {})[target] = run_developer(browser,data,target,backend,output)
                report['checks'].append('sample import, both developer archive identities and local ESM execution')
                check(not report['network'] and not report['pageErrors'], 'offline/page error')
                report['checks'].append('offline, no page errors')
                report['status']='PASS'
                report['limitations']=['Developer ESM executed from intercepted local archive bytes; Vite build remains separate; screenshots require visual review.']
            finally:
                browser.close()
    except Exception as exc:
        report['error']=str(exc)
        raise
    finally:
        (output/'report.json').write_text(json.dumps(report,indent=2),encoding='utf-8')


if __name__=='__main__':
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('html',type=Path)
    ap.add_argument('--backend',choices=['webgl1','webgl2','webgpu'],required=True)
    ap.add_argument('--output',type=Path,required=True)
    args=ap.parse_args()
    result = run(args.html,args.backend,args.output)
    if result and result['status']=='NOT_RUN':
        raise SystemExit(2)
