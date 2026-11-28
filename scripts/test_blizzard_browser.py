#!/usr/bin/env python3
"""AIR-03 B06 candidate browser acceptance. Never certifies an unavailable backend."""
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

EFFECT = 'fx.air.blizzard'
LAYERS = ('streaks', 'foreground', 'whiteout')
BACKENDS = ('webgl1', 'webgl2', 'webgpu')
MODULES = {'curves': 'fxCurveCore', 'spacing': 'fxSpacingCore', 'colors': 'fxColorCore',
           'core': 'fxBlizzardCore', 'runtime': 'fxBlizzardRuntime', 'pose': 'fxBlizzardPose',
           'pixi': 'blizzardPixiVendor', 'spine': 'blizzardSpineVendor'}


def check(ok, message):
    if not ok:
        raise ValueError(message)


def archive(data):
    check(len(data) <= 256 * 1024**2, 'ZIP size budget')
    z = zipfile.ZipFile(io.BytesIO(data))
    try:
        names = z.namelist()
        keys = {n.lower() for n in names}
        check(len(keys) == len(names), 'duplicate ZIP entry')
        for n in names:
            parts = n.split('/')
            check(n and '\\' not in n and ':' not in n and all(p not in ('', '.', '..') for p in parts), 'unsafe ZIP path')
            check(not any('/'.join(parts[:i]).lower() in keys for i in range(1, len(parts))), 'ZIP file/directory conflict')
        check(sum(i.file_size for i in z.infolist()) <= 256 * 1024**2, 'ZIP expanded budget')
        check(z.testzip() is None, 'ZIP CRC')
        return z
    except Exception:
        z.close()
        raise


def sequence(data, backend, settings, count, *, visible=True, motion=False):
    with archive(data) as z:
        names = [f'frames/{i:04}.png' for i in range(count)]
        check(set(z.namelist()) == set(names + ['sequence.json']), 'sequence entries')
        m = json.loads(z.read('sequence.json'))
        check((m['schemaVersion'], m['effectId'], m['backend']['actual'], m['settings'], m['frameCount'], m['fps'], m['alpha']) == (1, EFFECT, backend, settings, count, 60, 'straight-rgba8'), 'sequence manifest')
        terminal = 39/60 if settings['mode'] == 'oneShot' else None
        check((m['width'], m['height'], m['crop'], m['authoredFrames'], m['terminalSeconds'], m['frameFormula']) == (512, 512, {'x': 0, 'y': 0, 'width': 512, 'height': 512}, settings['durationFrames'], terminal, 'frameIndex/60'), 'sequence crop/timing')
        check(m['frames'] == [{'frame': i, 'file': n, 'timeSeconds': i/60} for i, n in enumerate(names)], 'frame times')
        hashes, distinct, active = [], set(), []
        for i, n in enumerate(names):
            raw = z.read(n)
            with Image.open(io.BytesIO(raw)) as im:
                check(im.format == 'PNG' and im.mode == 'RGBA' and im.size == (512, 512), 'PNG format/dimensions')
                rgba = im.tobytes()
                check(all(a or rgba[j:j+3] == b'\0\0\0' for j, a in zip(range(0, len(rgba), 4), rgba[3::4])), 'RGB at zero alpha')
                on = im.getchannel('A').getbbox() is not None
                active.append(on)
                if on:
                    distinct.add(hashlib.sha256(rgba).digest())
                hashes.append(hashlib.sha256(raw).hexdigest())
                if terminal is not None and i >= 39:
                    check(not on, 'nonempty terminal frame')
        check(any(active) == visible, 'unexpected visibility')
        if motion:
            check(len(distinct) >= 2, 'no distinct visible motion')
        return m, hashes, active


def developer(data, target, settings, sources, sample, skin, animation):
    with archive(data) as z:
        p = json.loads(z.read('preset.json'))
        check(p == json.loads(z.read('public/preset.json')), 'preset copies differ')
        check((p['schemaVersion'], p['effectId'], p['settings'], p['rendererPreference']) == (1, EFFECT, settings, target), 'developer preset')
        check(p['compatibility'] == {'pixi': '8.22.0', 'spine': '4.2.120', 'vite': '7.1.12'}, 'runtime pins')
        check(json.loads(z.read('package.json'))['dependencies'] == {'pixi.js': '8.22.0', '@esotericsoftware/spine-pixi-v8': '4.2.120'}, 'package pins')
        for n, key in MODULES.items():
            check(z.read(f'public/offline/{n}.js') == sources[key].encode(), 'offline module parity: ' + n)
        check(z.read('LICENSES.txt') == sources['runtimeLicenses'].encode(), 'license parity')
        for n, key in [('FxBlizzard.mjs','fxBlizzardCore'), ('Blizzard.mjs','fxBlizzardRuntime'), ('FxBlizzardPose.mjs','fxBlizzardPose')]:
            check(sources[key].encode() in z.read(n), 'ESM source parity: ' + n)
        a = p['asset']
        check((a['sourceSkeletonName'], a['sourceAtlasName'], a['skin'], a['animation']) == (sample['skeletonName'], sample['atlasName'], skin, animation), 'asset identity/options')
        check(json.loads(z.read('public/'+a['skeleton'])) == sample['skeleton'], 'skeleton content')
        check(z.read('public/'+a['atlas']) == sample['atlas'].encode(), 'atlas bytes')
        check(len(a['pages']) == len(sample['images']) and {v['name'] for v in a['pages']} == set(sample['images']), 'atlas pages')
        for v in a['pages']:
            check(z.read('public/'+v['path']) == base64.b64decode(sample['images'][v['name']], validate=True), 'texture bytes')
        for n in ('public/offline.html','public/offline/demo.js','example.js','index.html','README.md'):
            check(bool(z.read(n)), 'missing developer entry: ' + n)
        return p


def demo_response(z, url):
    p = urlsplit(url)
    if p.scheme != 'https' or p.netloc != 'blizzard.test':
        return None
    path = unquote(p.path).lstrip('/') or 'offline.html'
    if '\\' in path or any(k in ('', '.', '..') for k in path.split('/')):
        return None
    name = 'public/' + path
    if name not in z.namelist():
        return None
    mime = {'js': 'text/javascript', 'html': 'text/html', 'json': 'application/json', 'png': 'image/png', 'atlas': 'text/plain'}.get(path.rsplit('.', 1)[-1], 'application/octet-stream')
    return mime, z.read(name)


def probe(page, backend):
    return page.evaluate("""async b=>{try{return b==='webgpu'?!!(navigator.gpu&&await navigator.gpu.requestAdapter()):!!document.createElement('canvas').getContext(b==='webgl2'?'webgl2':'webgl');}catch{return false;}}""", backend)


def run_demo(browser, data, target):
    errors, blocked = [], []
    with archive(data) as z:
        page = browser.new_page(service_workers='block')
        try:
            page.on('pageerror', lambda e: errors.append(str(e)))
            def serve(route):
                response = demo_response(z, route.request.url)
                if response is None:
                    blocked.append(route.request.url)
                    route.abort()
                else:
                    route.fulfill(status=200, content_type=response[0], body=response[1])
            page.route('**/*', serve)
            page.goto('https://blizzard.test/offline.html')
            if target == 'webgpu' and not probe(page, 'webgpu'):
                check(not errors and not blocked, 'developer page/network errors: '+str(errors+blocked))
                return {'status': 'NOT RUN', 'reason': 'No WebGPU adapter'}
            page.wait_for_function("['ready','error'].includes(document.getElementById('backend')?.dataset.state)")
            check(page.locator('#backend').get_attribute('data-state') == 'ready' and page.locator('canvas').count() == 1, 'developer startup failed')
            actual = page.locator('#backend').inner_text()
            check(actual in BACKENDS and (actual == 'webgpu') == (target == 'webgpu'), 'developer backend')
            check(not errors and not blocked, 'developer page/network errors: '+str(errors+blocked))
            return {'status': 'PASS', 'actual': actual}
        finally:
            page.close()


def run(html, backend, output):
    from playwright.sync_api import sync_playwright
    check(html.is_file(), 'build standalone HTML first')
    output.mkdir(parents=True, exist_ok=True)
    check(not any(output.iterdir()), 'evidence directory must be empty')
    report = {'status': 'FAIL', 'requestedBackend': backend, 'actualBackend': None, 'htmlSha256': hashlib.sha256(html.read_bytes()).hexdigest(), 'checks': [], 'pageErrors': [], 'network': [], 'remaining': ['visual review', 'individual curve/parameter witnesses', 'Vite build', 'architecture', 'physical-device performance']}
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=os.environ.get('BLIZZARD_HEADED') != '1', executable_path=os.environ.get('BROWSER_EXECUTABLE'), args=json.loads(os.environ.get('BLIZZARD_BROWSER_ARGS', '[]')))
            try:
                report['browser'] = browser.version
                page = browser.new_page(offline=True, accept_downloads=True, viewport={'width': 1440, 'height': 1000}, service_workers='block')
                page.on('pageerror', lambda e: report['pageErrors'].append(str(e)))
                page.on('request', lambda r: report['network'].append(r.url) if r.url.startswith(('http:', 'https:')) else None)
                page.goto(html.resolve().as_uri())
                page.wait_for_function('typeof BlizzardEditor!=="undefined" && !BlizzardEditor.busy')
                if page.evaluate('BlizzardEditor.getActualBackend().actual') != backend:
                    page.locator('#backend').select_option(backend)
                    page.wait_for_function('!BlizzardEditor.busy')
                check(not report['pageErrors'] and not report['network'], 'startup page/network error')
                if page.evaluate('BlizzardEditor.getActualBackend().actual') != backend:
                    check(not probe(page, backend), 'available backend failed: '+page.locator('#status').inner_text())
                    report.update(status='NOT RUN', error='Requested backend unavailable')
                    return report
                report['actualBackend'] = backend
                check(page.evaluate('PIXI.VERSION') == '8.22.0', 'Pixi pin')
                page.locator('details').evaluate_all('(els)=>els.forEach(e=>e.open=true)')
                def apply(cfg):
                    check(page.evaluate('(c)=>BlizzardEditor.setSettings(c)', cfg), 'settings rejected')
                    check(page.evaluate('BlizzardEditor.getSettings()') == cfg, 'settings mismatch')
                def download(button, name):
                    with page.expect_download(timeout=180000) as event:
                        page.locator('#'+button).click()
                    event.value.save_as(output/name)
                    page.wait_for_function('!BlizzardEditor.busy')
                    check('error' not in (page.locator('#status').get_attribute('class') or '').split(), 'export failed')
                    return (output/name).read_bytes()
                base = page.evaluate('BlizzardEditor.getSettings()')
                m, hashes, active = sequence(download('bake','loop.zip'), backend, base, 60, motion=True)
                check(m['asset'] is None and active[18], 'loop peak')
                for zoom, bg in [('0.5','light'), ('2','checker')]:
                    page.locator('#zoom').select_option('.5' if zoom == '0.5' else zoom)
                    page.locator('#background').select_option(bg)
                    check(page.evaluate('BlizzardEditor.seek(19/60)'), 'preview seek')
                    _, again, _ = sequence(download('bake',f'loop-{zoom}.zip'), backend, base, 60, motion=True)
                    check(hashes == again, 'camera/background/time changed PNG bytes')
                burst = json.loads(json.dumps(base)); burst.update(mode='oneShot', durationFrames=40, exportFrames=40)
                for kind in (*LAYERS, 'none', 'all'):
                    cfg = json.loads(json.dumps(burst))
                    for layer in LAYERS:
                        cfg['emitters'][0]['layers'][layer]['enabled'] = kind in (layer, 'all')
                    apply(cfg)
                    _, _, active = sequence(download('bake',f'burst-{kind}.zip'), backend, cfg, 40, visible=kind!='none', motion=kind!='none')
                    check(not active[-1], 'burst terminal')
                report['checks'].append('loop 60, burst 40, independent layers, distinct motion, crop, transparent terminal, camera/background byte parity')
                apply(base)
                page.locator('#sample').click(); page.wait_for_function('!BlizzardEditor.busy')
                check(page.evaluate('!!BlizzardEditor.asset && !!BlizzardEditor.scene.model'), 'sample load failed')
                sample = page.evaluate("JSON.parse(document.getElementById('sampleData').textContent)")
                sources = page.evaluate('(ids)=>Object.fromEntries(ids.map(id=>[id,document.getElementById(id).textContent]))', [*MODULES.values(), 'runtimeLicenses'])
                animation = page.locator('#animation option').nth(1).get_attribute('value')
                check(bool(animation), 'sample animation missing')
                page.locator('#animation').select_option(animation)
                skin = page.locator('#skin').input_value()
                m, same, _ = sequence(download('bake','sample.zip'), backend, base, 60, motion=True)
                check(m['asset']['skeletonName'] == sample['skeletonName'] and m['asset']['animation'] == animation, 'sample manifest')
                check(hashes == same, 'Spine pixels leaked into unanchored bake')
                report['developerBackends'] = {}
                for target, button in [('webgl','webglZip'), ('webgpu','webgpuZip')]:
                    data = download(button, 'developer-'+target+'.zip')
                    developer(data, target, base, sources, sample, skin, animation)
                    report['developerBackends'][target] = run_demo(browser, data, target)
                check(not report['pageErrors'] and not report['network'], 'editor page/network error')
                report['checks'].append('real sample, excluded Spine pixels, exact developer modules/assets and offline demos')
                report['status'] = 'PASS' if all(v['status']=='PASS' for v in report['developerBackends'].values()) else 'NOT RUN'
            finally:
                browser.close()
    except Exception as e:
        report['error'] = str(e)
    finally:
        (output/'candidate-browser.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    return report


if __name__ == '__main__':
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--html', type=Path, required=True)
    ap.add_argument('--backend', choices=BACKENDS, required=True)
    ap.add_argument('--output', type=Path, required=True)
    args = ap.parse_args()
    result = run(args.html, args.backend, args.output)
    print(json.dumps(result))
    raise SystemExit(0 if result['status']=='PASS' else 2 if result['status']=='NOT RUN' else 1)
