#!/usr/bin/env python3
"""GAME-02 real browser acceptance. No simulated renderer or GPU PASS."""
import argparse
import base64
import io
import json
import os
from pathlib import Path
import zipfile
from PIL import Image

EFFECT = 'fx.game.hit-sparks'
MODULES = ('curve-core.js', 'spacing-core.js', 'color-core.js', 'timeline-core.js',
           'shockwave-spine.js', 'hit-sparks-core.js',
           'hit-sparks-anchors.js', 'hit-sparks-runtime.js',
           'hit-sparks-authoring.js', 'hit-sparks-pose.js', 'shield-export.js',
           'hit-sparks-export.js', 'hit-sparks-bake.js')
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


def sequence(data, backend, crop, count):
    with archive(data) as z:
        names = [f'frames/frame_{i:05}.png' for i in range(count)]
        check(set(z.namelist()) == set(names + ['sequence.json', 'README.txt']), 'sequence entries')
        m = json.loads(z.read('sequence.json'))
        check((m['effectId'], m['backend'], m['crop'], m['count'], m['fps'], m['alpha']) ==
              (EFFECT, backend, crop, count, 60, 'straight-rgba8'), 'sequence manifest')
        check((m['width'], m['height']) == (crop['width'], crop['height']), 'manifest dimensions')
        check(m['frames'] == [{'file': n, 'frame': i, 'timeSeconds': i/60} for i, n in enumerate(names)], 'frame times')
        frames = []
        for n in names:
            with Image.open(io.BytesIO(z.read(n))) as im:
                check(im.format == 'PNG' and im.mode == 'RGBA' and im.size == (crop['width'], crop['height']), 'PNG dimensions/format')
                frames.append(im.copy())
        return m, frames


def developer(data, target, crop, count, sample):
    with archive(data) as z:
        m = json.loads(z.read('public/preset.json'))
        check((m['effectId'], m['rendererPreference'], m['crop'], m['frameCount']) == (EFFECT, target, crop, count), 'developer manifest')
        check(m['compatibility'] == {'pixi':'8.22.0','spine':'4.2.120'}, 'runtime pins')
        check(json.loads(z.read('package.json'))['devDependencies'] == {'vite':'7.1.12'}, 'Vite pin')
        required = ['public/' + n for n in MODULES + ('LICENSES.txt', 'index.html', 'example.js', 'hit-sparks-demo.js')]
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
    if p.scheme != 'https' or p.netloc != 'hit-sparks.test':
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
            page.goto('https://hit-sparks.test/index.html')
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
                                        args=json.loads(os.environ.get('HIT_SPARKS_BROWSER_ARGS', '[]')))
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
                if page.locator('#actual').inner_text() != backend.upper():
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
                check(page.evaluate("document.body.dataset.ready==='true'"), 'preview not ready')
                report['actualBackend'] = backend
                check(page.evaluate('PIXI.VERSION') == '8.22.0', 'actual Pixi pin')
                base = json.loads(page.locator('#preset').input_value())
                full = {'x':0,'y':0,'width':512,'height':512}
                crop = {'x':220,'y':220,'width':160,'height':100}
                def capture(name, cfg, t, region=full):
                    raw = bytes(page.evaluate('''async ({cfg,t,region,backend})=>{
                      const s=await FxHitSparksBake.sceneFactory()({settings:cfg,backend,crop:region});
                      try{return Array.from(await FxShieldExport.encodePng(await s.readFrame(t)));}finally{s.destroy();}
                    }''', {'cfg':cfg,'t':t,'region':region,'backend':backend}))
                    (output/(name+'.png')).write_bytes(raw)
                    with Image.open(io.BytesIO(raw)) as im:
                        check(im.mode=='RGBA' and im.size==(region['width'],region['height']), 'capture format')
                        return im.copy()
                def visible(im): return im.getchannel('A').getbbox() is not None
                check(visible(capture('ignition',base,0)), 'ignition invisible')
                peak = capture('peak',base,2/60)
                check(visible(peak), 'peak invisible')
                check(not visible(capture('tail',base,39/60)), 'tail not transparent')
                for kind in ('flash','primary','dust','none'):
                    cfg=json.loads(json.dumps(base))
                    for k, layer in cfg['effect']['layers'].items(): layer['enabled']=k==kind
                    check(visible(capture('only-'+kind,cfg,5/60 if kind=='dust' else 2/60)) == (kind!='none'), 'layer '+kind)
                check(capture('crop',base,2/60,crop).tobytes() == peak.crop((220,220,380,320)).tobytes(), 'crop parity')
                report['checks'].append('actual backend, phases, independent layers and crop')
                # Exercise authoring UI instead of only calling the renderer.
                page.locator('details').evaluate_all('(els)=>els.forEach(e=>e.open=true)')
                def apply(cfg):
                    page.locator('#preset').fill(json.dumps(cfg))
                    page.locator('#apply').click()
                    check(page.locator('#status').get_attribute('data-error')=='false', 'preset restore')
                    check(json.loads(page.locator('#preset').input_value()) == cfg, 'preset roundtrip')
                edited=json.loads(json.dumps(base))
                edited['effect']['burstCount']=5
                edited['effect']['collisionNormal']=45
                edited['effect']['curves']['widthTaper']['keys'][0]['y']=0.5
                apply(edited)
                check('primary 5' in page.locator('#timingInfo').inner_text(), 'count control')
                page.locator('#layer').select_option('primary')
                handle=page.locator('#handle')
                handle.focus()
                handle.press('ArrowRight')
                moved=json.loads(page.locator('#preset').input_value())
                check(moved['effect']['layers']['primary']['x']==edited['effect']['layers']['primary']['x']+1, 'emitter nudge')
                check(moved['effect']['layers']['flash']==edited['effect']['layers']['flash'], 'independent emitter')
                apply(base)
                report['checks'].append('preset, count, curve and independent emitter controls')
                page.locator('details').evaluate_all('(els)=>els.forEach(e=>e.open=true)')
                for k,v in {**crop,'frames':40}.items(): page.locator('#export-'+k).fill(str(v))
                def download(button,name):
                    with page.expect_download(timeout=180000) as event: page.locator('#'+button).click()
                    dest=output/name;event.value.save_as(dest)
                    page.wait_for_function("!document.getElementById('exportFields').disabled")
                    check(page.locator('#status').get_attribute('data-error')=='false', 'export failed')
                    return dest.read_bytes()
                m, first=sequence(download('exportPng','sequence.zip'),backend,crop,40)
                check(visible(first[0]) and visible(first[2]) and not visible(first[-1]), 'sequence phases')
                page.locator('#zoom').evaluate("e=>{e.value='150';e.dispatchEvent(new Event('input'));}")
                page.locator('#background').select_option('light')
                n, second=sequence(download('exportPng','sequence-camera.zip'),backend,crop,40)
                check(m==n and all(a.tobytes()==b.tobytes() for a,b in zip(first,second)), 'camera parity')
                report['checks'].append('40-frame UI export, camera invariance')
                page.locator('#sample').click()
                page.wait_for_function("!document.getElementById('assets').disabled")
                check(page.locator('#status').get_attribute('data-error')=='false' and page.locator('#assetName').inner_text()!='No Spine asset', 'sample import')
                page.locator('#frame').evaluate("e=>{e.value='2';e.dispatchEvent(new Event('input'));}")
                for bg in ('dark','light','checker'):
                    page.locator('#background').select_option(bg)
                    page.locator('#surface').screenshot(path=output/('preview-'+bg+'.png'))
                sample=page.evaluate("JSON.parse(document.getElementById('sampleData').textContent)")
                for target, button in [('webgl','exportWebgl'),('webgpu','exportWebgpu')]:
                    data = download(button,'developer-'+target+'.zip')
                    developer(data,target,crop,40,sample)
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
