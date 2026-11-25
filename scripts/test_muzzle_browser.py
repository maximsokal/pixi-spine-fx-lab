#!/usr/bin/env python3
"""GAME-01 real browser acceptance. No simulated renderer or GPU PASS."""
import argparse
import base64
import io
import json
import os
from pathlib import Path
import zipfile
from PIL import Image

EFFECT = 'fx.game.muzzle-flash'
MODULES = ('curve-core.js', 'spacing-core.js', 'color-core.js', 'timeline-core.js',
           'shockwave-spine.js', 'muzzle-geometry.js', 'muzzle-core.js',
           'muzzle-anchors.js', 'muzzle-smoke.js', 'muzzle-runtime.js',
           'muzzle-authoring.js', 'muzzle-pose.js', 'shield-export.js',
           'muzzle-export.js', 'muzzle-bake.js')
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
        required = ['public/' + n for n in MODULES + ('LICENSES.txt', 'index.html', 'example.js', 'muzzle-demo.js')]
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


def run(html, backend, output):
    from playwright.sync_api import sync_playwright
    check(html.is_file(), 'build the standalone HTML first')
    output.mkdir(parents=True, exist_ok=True)
    check(not any(output.iterdir()), 'evidence directory must be empty')
    report = {'status':'FAIL', 'requestedBackend':backend, 'actualBackend':None, 'checks':[], 'network':[], 'pageErrors':[]}
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True, executable_path=os.environ.get('BROWSER_EXECUTABLE'),
                                        args=json.loads(os.environ.get('MUZZLE_BROWSER_ARGS', '[]')))
            try:
                report['browser'] = browser.version
                page = browser.new_page(offline=True, accept_downloads=True, viewport={'width':1440,'height':1000})
                page.on('pageerror', lambda e: report['pageErrors'].append(str(e)))
                page.on('request', lambda r: report['network'].append(r.url) if r.url.startswith(('http:', 'https:')) else None)
                page.goto(html.resolve().as_uri())
                page.wait_for_function("!document.getElementById('backend').disabled")
                if page.locator('#backend').input_value() != backend:
                    page.locator('#backend').select_option(backend)
                page.wait_for_function("b=>document.body.dataset.ready==='true' && document.getElementById('actual').textContent===b.toUpperCase() && !document.getElementById('backend').disabled", arg=backend)
                report['actualBackend'] = backend
                check(page.evaluate('PIXI.VERSION') == '8.22.0', 'actual Pixi pin')
                base = json.loads(page.locator('#preset').input_value())
                full = {'x':0,'y':0,'width':512,'height':512}
                crop = {'x':220,'y':220,'width':160,'height':100}
                def capture(name, cfg, t, region=full):
                    raw = bytes(page.evaluate('''async ({cfg,t,region,backend})=>{
                      const s=await FxMuzzleBake.sceneFactory()({settings:cfg,backend,crop:region});
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
                for kind in ('core','tongues','sparks','smoke','none'):
                    cfg=json.loads(json.dumps(base))
                    for k, layer in cfg['effect']['layers'].items(): layer['enabled']=k==kind
                    cfg['smoke']['enabled']=kind=='smoke'
                    check(visible(capture('only-'+kind,cfg,9/60 if kind=='smoke' else 2/60)) == (kind!='none'), 'layer '+kind)
                check(capture('crop',base,2/60,crop).tobytes() == peak.crop((220,220,380,320)).tobytes(), 'crop parity')
                report['checks'].append('actual backend, phases, independent layers and crop')
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
                    developer(download(button,'developer-'+target+'.zip'),target,crop,40,sample)
                report['checks'].append('sample import and both developer archive identities')
                check(not report['network'] and not report['pageErrors'], 'offline/page error')
                report['checks'].append('offline, no page errors')
                report['status']='PASS'
                report['limitations']=['Developer example execution and Vite build are separate checks; screenshots require visual review.']
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
    run(args.html,args.backend,args.output)
