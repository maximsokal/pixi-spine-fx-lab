#!/usr/bin/env python3
"""GAME-09: actual offline browser acceptance; no renderer doubles."""
import argparse
import io
import json
import os
from pathlib import Path
import zipfile
from PIL import Image

EFFECT = 'fx.game.healing-aura'


def frames(data, backend, crop, count):
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        names = [f'frames/frame_{i:05}.png' for i in range(count)]
        assert len(z.namelist()) == count + 2 and set(z.namelist()) == set(names + ['sequence.json', 'README.txt'])
        assert z.testzip() is None
        m = json.loads(z.read('sequence.json'))
        assert (m['effectId'], m['backend'], m['crop'], m['count'], m['fps'], m['alpha']) == (EFFECT, backend, crop, count, 60, 'straight-rgba8')
        assert (m['width'], m['height']) == (crop['width'], crop['height'])
        assert m['frames'] == [{'file': n, 'frame': i, 'timeSeconds': i / 60} for i, n in enumerate(names)]
        out = []
        for name in names:
            with Image.open(io.BytesIO(z.read(name))) as im:
                assert im.format == 'PNG' and im.mode == 'RGBA' and im.size == (crop['width'], crop['height'])
                out.append(im.copy())
        return out


def developer(data, target, crop, count):
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        names = z.namelist()
        assert len(names) == len(set(names)) and z.testzip() is None
        assert all(n and not n.startswith('/') and '\\' not in n and all(p not in ('', '.', '..') for p in n.split('/')) for n in names)
        m = json.loads(z.read('preset.json'))
        assert json.loads(z.read('public/preset.json')) == m
        assert (m['effectId'], m['rendererPreference'], m['crop'], m['frameCount']) == (EFFECT, target, crop, count)
        assert json.loads(z.read('package.json'))['dependencies'] == {'pixi.js': '8.22.0', '@esotericsoftware/spine-pixi-v8': '4.2.120'}
        assert b'export async function startHealingDemo' in z.read('healing-demo.js')
        for path in ('curve-core.js', 'spacing-core.js', 'color-core.js', 'timeline-core.js', 'shockwave-spine.js', 'healing-core.js', 'healing-runtime.js', 'healing-authoring.js', 'example.js', 'LICENSES.txt', 'index.html'):
            assert z.read(path)
        a = m['asset']
        assert a and a['version'].startswith('4.2.') and a['images']
        for path in [a['skeleton'], a['atlas'], *(p['path'] for p in a['images'])]:
            assert z.read('public/' + path)


def run(html, backend, output):
    from playwright.sync_api import sync_playwright
    assert html.is_file()
    output.mkdir(parents=True, exist_ok=True)
    assert not any(output.iterdir()), 'Evidence directory must be empty'
    report = {'backend': backend, 'status': 'FAIL', 'checks': [], 'network': [], 'pageErrors': []}
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True, executable_path=os.environ.get('BROWSER_EXECUTABLE'), args=json.loads(os.environ.get('HEALING_BROWSER_ARGS', '["--enable-unsafe-webgpu"]')))
            try:
                page = browser.new_page(offline=True, accept_downloads=True, viewport={'width': 1440, 'height': 1000})
                page.on('pageerror', lambda e: report['pageErrors'].append(str(e)))
                page.on('request', lambda req: report['network'].append(req.url) if req.url.startswith(('http:', 'https:')) else None)
                page.goto(html.resolve().as_uri())
                page.wait_for_function("!document.getElementById('backend').disabled")
                page.locator('#backend').select_option(backend)
                page.wait_for_function("b=>document.body.dataset.ready==='true' && document.getElementById('actual').textContent===b.toUpperCase() && !document.getElementById('backend').disabled", arg=backend)
                assert page.evaluate('PIXI.VERSION') == '8.22.0'
                report['checks'].append('actual backend and pin')
                base = page.evaluate('FxHealing.defaults()')
                base['emitters'][0]['layers']['pulse']['enabled'] = True
                full = {'x': 0, 'y': 0, 'width': 512, 'height': 512}
                crop = {'x': 140, 'y': 140, 'width': 232, 'height': 232}
                def capture(name, cfg, t, region=full):
                    data = bytes(page.evaluate('''async ({cfg,t,region,backend})=>{
                      const s=await FxHealingBake.sceneFactory()({settings:cfg,backend,crop:region});
                      try{return Array.from(await FxHealingExport.encodePng(await s.readFrame(t)));}finally{s.destroy();}
                    }''', {'cfg': cfg, 't': t, 'region': region, 'backend': backend}))
                    (output / (name + '.png')).write_bytes(data)
                    with Image.open(io.BytesIO(data)) as im:
                        assert im.mode == 'RGBA' and im.size == (region['width'], region['height'])
                        return im.copy()
                clone = lambda v: json.loads(json.dumps(v))
                a, b = capture('loop-start', base, 0), capture('loop-end', base, 1)
                assert a.getchannel('A').getbbox() and a.tobytes() == b.tobytes()
                shot = clone(base)
                shot.update(mode='oneShot', durationFrames=40)
                assert capture('shot-start', shot, 0).getchannel('A').getbbox() is None
                assert capture('shot-peak', shot, .25).getchannel('A').getbbox()
                assert capture('shot-end', shot, 39/60).getchannel('A').getbbox() is None
                for key in ('glow', 'motes', 'pulse', 'lines', 'none'):
                    cfg = clone(base)
                    for k, layer in cfg['emitters'][0]['layers'].items():
                        layer['enabled'] = k == key
                    assert bool(capture('only-' + key, cfg, .25).getchannel('A').getbbox()) == (key != 'none')
                assert capture('crop', base, .25, crop).tobytes() == capture('full', base, .25).crop((140, 140, 372, 372)).tobytes()
                report['checks'].append('loop, phases, layer isolation and crop parity')
                page.locator('details').evaluate_all('(els)=>els.forEach(e=>e.open=true)')
                page.locator('#preset').fill(json.dumps(shot))
                page.locator('#apply').click()
                assert page.locator('#status').get_attribute('data-error') == 'false'
                for key, v in {'cropX': 0, 'cropY': 0, 'cropWidth': 232, 'cropHeight': 232, 'exportFrames': 40}.items():
                    page.locator('#' + key).fill(str(v))
                def download(button, name):
                    with page.expect_download(timeout=180000) as event:
                        page.locator('#' + button).click()
                    dest = output / name
                    event.value.save_as(dest)
                    page.wait_for_function("!document.getElementById('exportPng').disabled")
                    assert page.locator('#status').get_attribute('data-error') == 'false'
                    return dest.read_bytes()
                first = frames(download('exportPng', 'sequence.zip'), backend, crop, 40)
                assert first[0].getchannel('A').getbbox() is None and first[-1].getchannel('A').getbbox() is None
                assert first[15].getchannel('A').getbbox()
                page.locator('#zoom').evaluate("e=>{e.value='150';e.dispatchEvent(new Event('input'));}")
                page.locator('#background').select_option('light')
                second = frames(download('exportPng', 'sequence-camera.zip'), backend, crop, 40)
                assert all(a.tobytes() == b.tobytes() for a, b in zip(first, second))
                report['checks'].append('40-frame export and camera parity')
                page.locator('#sample').click()
                page.wait_for_function("!document.getElementById('sample').disabled")
                assert page.locator('#status').get_attribute('data-error') == 'false'
                assert page.locator('#assetLabel').inner_text() != 'No Spine asset'
                page.locator('#frame').evaluate("e=>{e.value='15';e.dispatchEvent(new Event('input'));}")
                for bg in ('dark', 'light', 'checker'):
                    page.locator('#background').select_option(bg)
                    page.locator('#viewport').screenshot(path=output / ('preview-' + bg + '.png'))
                for target, button in [('webgl', 'exportWebgl'), ('webgpu', 'exportWebgpu')]:
                    developer(download(button, 'developer-' + target + '.zip'), target, crop, 40)
                report['checks'].append('sample and developer archives')
                assert not report['network'] and not report['pageErrors']
                report['checks'].append('offline and no page errors')
                report['status'] = 'PASS'
            finally:
                browser.close()
    except Exception as e:
        report['error'] = str(e)
        raise
    finally:
        (output / 'report.json').write_text(json.dumps(report, indent=2), encoding='utf-8')


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('html', type=Path)
    p.add_argument('--backend', required=True, choices=('webgl1', 'webgl2', 'webgpu'))
    p.add_argument('--output', required=True, type=Path)
    a = p.parse_args()
    run(a.html, a.backend, a.output)


if __name__ == '__main__':
    main()
