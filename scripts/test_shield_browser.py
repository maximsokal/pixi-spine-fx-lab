#!/usr/bin/env python3
"""GAME-08 offline browser acceptance. Requires Playwright, Pillow and real pinned lab HTML."""
import argparse
import hashlib
import io
import json
import os
from pathlib import Path
import zipfile

from PIL import Image

EFFECT = 'fx.game.magic-shield'
MODULES = ('curve-core.js', 'spacing-core.js', 'color-core.js', 'timeline-core.js',
           'shockwave-spine.js', 'shield-clock.js', 'shield-geometry.js', 'shield-core.js',
           'shield-runtime.js', 'shield-authoring.js', 'shield-physics.js', 'shield-demo.js', 'example.js')


def png_pixels(data, width, height):
    with Image.open(io.BytesIO(data)) as image:
        assert image.format == 'PNG' and image.mode == 'RGBA', 'Expected straight RGBA PNG'
        assert image.size == (width, height), 'Unexpected PNG dimensions'
        image.verify()
    with Image.open(io.BytesIO(data)) as image:
        image.load()
        return image.copy()


def checked_zip(data):
    z = zipfile.ZipFile(io.BytesIO(data))
    try:
        names = z.namelist()
        assert len(names) == len(set(names)), 'Duplicate ZIP names'
        assert all(n and not n.startswith('/') and '\\' not in n and all(p not in ('', '.', '..') for p in n.split('/')) for n in names), 'Unsafe ZIP path'
        assert z.testzip() is None, 'ZIP CRC mismatch'
        return z
    except BaseException:
        z.close()
        raise


def sequence_frames(data, backend, crop, count):
    with checked_zip(data) as z:
        names = [f'frames/frame_{i:05}.png' for i in range(count)]
        assert set(z.namelist()) == set(names + ['sequence.json', 'README.txt']), 'Unexpected frame files'
        m = json.loads(z.read('sequence.json'))
        assert (m['effectId'], m['backend'], m['crop'], m['count'], m['fps'], m['alpha']) == (EFFECT, backend, crop, count, 60, 'straight-rgba8'), 'Sequence metadata mismatch'
        assert (m['width'], m['height']) == (crop['width'], crop['height']), 'Manifest dimensions mismatch'
        assert m['frames'] == [{'file': n, 'frame': i, 'timeSeconds': i / 60} for i, n in enumerate(names)], 'Frame times or ordering mismatch'
        frames = [z.read(n) for n in names]
        for frame in frames:
            png_pixels(frame, crop['width'], crop['height'])
        return frames


def developer_preset(data, target, crop, count):
    with checked_zip(data) as z:
        required = set(MODULES) | {'preset.json', 'public/preset.json', 'package.json', 'README.md', 'LICENSES.txt', 'index.html'}
        assert required <= set(z.namelist()), 'Developer package missing source or metadata'
        m = json.loads(z.read('preset.json'))
        assert json.loads(z.read('public/preset.json')) == m, 'Preset copies differ'
        assert (m['effectId'], m['rendererPreference'], m['crop'], m['frameCount']) == (EFFECT, target, crop, count), 'Developer metadata mismatch'
        package = json.loads(z.read('package.json'))
        assert package['dependencies'] == {'pixi.js': '8.22.0', '@esotericsoftware/spine-pixi-v8': '4.2.120'}, 'Runtime pins changed'
        assert b'export async function startShieldDemo' in z.read('shield-demo.js'), 'Controller missing'
        if m.get('asset'):
            asset = m['asset']
            assert asset['images'], 'Missing texture pages'
            for name in [asset['skeleton'], asset['atlas'], *(p['path'] for p in asset['images'])]:
                assert z.read('public/' + name), 'Empty asset: ' + name
        return m


def run(html, backend, output):
    from playwright.sync_api import sync_playwright

    assert html.is_file(), 'Build MagicShield.html first with scripts/build_shield_editor.py'
    output.mkdir(parents=True, exist_ok=True)
    assert not any(output.iterdir()), 'Evidence directory must be empty'
    report = {'effectId': EFFECT, 'requestedBackend': backend, 'status': 'FAIL', 'checks': [], 'network': [], 'pageErrors': []}
    def passed(name):
        report['checks'].append(name)
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True, executable_path=os.environ.get('BROWSER_EXECUTABLE'),
                                        args=json.loads(os.environ.get('SHIELD_BROWSER_ARGS', '["--enable-unsafe-webgpu"]')))
            try:
                report['browser'] = browser.version
                page = browser.new_page(offline=True, accept_downloads=True, viewport={'width': 1400, 'height': 1000})
                page.on('pageerror', lambda error: report['pageErrors'].append(str(error)))
                page.on('request', lambda request: report['network'].append(request.url) if request.url.startswith(('http:', 'https:')) else None)
                page.goto(html.resolve().as_uri())
                page.wait_for_function("!document.getElementById('backend').disabled")
                page.locator('#backend').select_option(backend)
                page.wait_for_function("b=>document.body.dataset.ready==='true' && document.getElementById('actual').textContent===b.toUpperCase() && !document.getElementById('backend').disabled", arg=backend)
                assert page.evaluate('PIXI.VERSION') == '8.22.0', 'Wrong Pixi runtime'
                passed('actual-backend-and-pixi-pin')
                full = {'x': 0, 'y': 0, 'width': 512, 'height': 512}
                base = page.evaluate('FxShield.defaults()')
                base['emitters'][0]['impacts'] = [{'id': 'hit1', 'frame': 8}]
                def capture(name, settings, seconds, crop=full):
                    raw = page.evaluate('''async ({settings,seconds,crop,backend})=>{
                      const s=await FxShieldBake.sceneFactory()({settings,backend,crop});
                      try{return Array.from(await FxShieldExport.encodePng(await s.readFrame(seconds)));}
                      finally{s.destroy();}
                    }''', {'settings': settings, 'seconds': seconds, 'crop': crop, 'backend': backend})
                    data = bytes(raw)
                    (output / (name + '.png')).write_bytes(data)
                    return png_pixels(data, crop['width'], crop['height'])
                def clone(value):
                    return json.loads(json.dumps(value))
                loop_a = capture('loop-start', base, 0)
                loop_b = capture('loop-end', base, 1)
                assert loop_a.tobytes() == loop_b.tobytes(), 'Loop seam differs'
                assert loop_a.getchannel('A').getbbox(), 'Empty default loop'
                passed('loop-seam')
                shot = clone(base)
                shot.update(mode='oneShot', durationFrames=40)
                start = capture('shot-start', shot, 0)
                peak = capture('shot-peak', shot, 15/60)
                end = capture('shot-end', shot, 39/60)
                assert start.getchannel('A').getbbox() is None and end.getchannel('A').getbbox() is None, 'Opaque one-shot endpoint'
                assert peak.getchannel('A').getbbox() and peak.getpixel((256, 256))[3] < 255, 'Empty or opaque shield center'
                passed('one-shot-phases-transparent-center')
                for key in ('shell', 'halo', 'impact', 'none'):
                    isolated = clone(base)
                    for layer, cfg in isolated['emitters'][0]['layers'].items():
                        cfg['enabled'] = layer == key
                    image = capture('only-' + key, isolated, 15/60)
                    assert bool(image.getchannel('A').getbbox()) == (key != 'none'), 'Layer isolation: ' + key
                passed('layer-isolation')
                crop = {'x': 140, 'y': 140, 'width': 64, 'height': 64}
                region = capture('crop', base, 15/60, crop)
                large = capture('full', base, 15/60)
                assert region.tobytes() == large.crop((140, 140, 204, 204)).tobytes(), 'Crop changed world pixels'
                passed('crop-pixel-parity')
                page.locator('#preset').fill(json.dumps(shot))
                page.locator('#apply').click()
                assert page.locator('#status').get_attribute('data-error') == 'false'
                for key, value in zip(('cropX', 'cropY', 'cropWidth', 'cropHeight'), crop.values()):
                    page.locator('#' + key).fill(str(value))
                page.locator('#exportFrames').fill('40')
                def download(button, filename):
                    with page.expect_download(timeout=180000) as event:
                        page.locator('#' + button).click()
                    dest = output / filename
                    event.value.save_as(dest)
                    page.wait_for_function("!document.getElementById('exportPng').disabled")
                    assert page.locator('#status').get_attribute('data-error') == 'false'
                    return dest.read_bytes()
                frames = sequence_frames(download('exportPng', 'sequence.zip'), backend, crop, 40)
                page.locator('#zoom').evaluate("e=>{e.value='150';e.dispatchEvent(new Event('input'));}")
                page.locator('#background').select_option('light')
                page.locator('#showCrop').uncheck()
                frames2 = sequence_frames(download('exportPng', 'sequence-camera.zip'), backend, crop, 40)
                assert frames == frames2, 'Camera or overlay changed PNG bytes'
                passed('40-frame-ui-export-camera-invariance')
                page.locator('#sample').click()
                page.wait_for_function("!document.getElementById('sample').disabled")
                assert page.locator('#status').get_attribute('data-error') == 'false'
                assert page.locator('#assetLabel').inner_text() != 'No Spine asset'
                passed('embedded-spine-load')
                page.locator('#frame').evaluate("e=>{e.value='15';e.dispatchEvent(new Event('input'));}")
                for background in ('dark', 'light', 'checker'):
                    page.locator('#background').select_option(background)
                    page.locator('#surface').screenshot(path=output / ('preview-' + background + '.png'))
                passed('preview-background-captures')
                for target, button in [('webgl', 'exportWebgl'), ('webgpu', 'exportWebgpu')]:
                    preset = developer_preset(download(button, 'developer-' + target + '.zip'), target, crop, 40)
                    assert preset['asset'] and preset['asset']['version'].startswith('4.2.')
                passed('developer-archives-with-spine-assets')
                assert not report['network'] and not report['pageErrors'], 'Unexpected network or page errors'
                passed('offline-no-page-errors')
                report['status'] = 'PASS'
            finally:
                browser.close()
    except Exception as error:
        report['error'] = str(error)
        raise
    finally:
        report['evidence'] = {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(output.iterdir()) if p.is_file()}
        (output / 'report.json').write_text(json.dumps(report, indent=2), encoding='utf-8')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('html', type=Path)
    parser.add_argument('--backend', required=True, choices=('webgl1', 'webgl2', 'webgpu'))
    parser.add_argument('--output', required=True, type=Path)
    args = parser.parse_args()
    run(args.html, args.backend, args.output)


if __name__ == '__main__':
    main()
