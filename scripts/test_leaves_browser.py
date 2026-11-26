#!/usr/bin/env python3
"""EARTH-04 real browser diagnostic. Does not alone certify all acceptance criteria."""
import argparse
import io
import json
import os
import zipfile
from pathlib import Path
from leaves_pixel_oracle import sequence, developer


def run(html, backend, output):
    from playwright.sync_api import sync_playwright
    output.mkdir(parents=True, exist_ok=True)
    if any(output.iterdir()):
        raise ValueError('Evidence directory must be empty')
    report = {'backend': backend, 'status': 'FAIL', 'checks': [], 'network': [], 'pageErrors': []}
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True, executable_path=os.environ.get('BROWSER_EXECUTABLE'),
                                        args=json.loads(os.environ.get('LEAVES_BROWSER_ARGS', '["--enable-unsafe-webgpu"]')))
            try:
                context = browser.new_context(offline=True, accept_downloads=True, viewport={'width': 1440, 'height': 1000})

                def observe(page):
                    page.on('pageerror', lambda e: report['pageErrors'].append(str(e)))
                    page.on('request', lambda req: report['network'].append(req.url) if req.url.startswith(('http:', 'https:')) else None)
                    return page

                page = observe(context.new_page())
                page.goto(html.resolve().as_uri())
                page.wait_for_function("!document.getElementById('backend').disabled")
                page.locator('#backend').select_option(backend)
                page.wait_for_function("!document.getElementById('backend').disabled", timeout=180000)
                actual = page.locator('#backendActual').inner_text()
                report['actual'] = actual
                if not actual.startswith(backend.upper() + ' '):
                    report['status'] = 'NOT RUN'
                    report['reason'] = 'Requested backend was not obtained'
                    return report
                assert page.evaluate('PIXI.VERSION') == '8.22.0'
                report['checks'].append('Actual backend and Pixi pin')
                page.locator('details').evaluate_all('(els)=>els.forEach(e=>e.open=true)')

                def download(button, filename):
                    with page.expect_download(timeout=180000) as event:
                        page.locator('#' + button).click()
                    dest = output / filename
                    event.value.save_as(dest)
                    page.wait_for_function("!document.getElementById('backend').disabled", timeout=180000)
                    return dest.read_bytes()

                page.locator('#frame').evaluate("e=>{e.value='37';e.dispatchEvent(new Event('input'));}")
                before = page.locator('#frameLabel').inner_text()
                first = sequence(download('bake', 'sequence.zip'), backend)
                assert first['nonemptyFrames'] > 0 and len(set(first['pixelHashes'])) > 1
                for bg in ('dark', 'light', 'checker'):
                    page.locator('#background').select_option(bg)
                    page.locator('#preview').screenshot(path=output / ('preview-' + bg + '.png'))
                page.locator('#zoom').select_option('2')
                second = sequence(download('bake', 'sequence-camera.zip'), backend, first['manifest']['settings'])
                assert first['pixelHashes'] == second['pixelHashes']
                assert before == page.locator('#frameLabel').inner_text()
                report['checks'].append('120 decoded frames, motion, camera-independent output, preserved preview time')
                off = first['manifest']['settings']
                for e in off['emitters']:
                    for layer in e['layers'].values():
                        layer['enabled'] = False
                preset = {'schemaVersion': 1, 'effectId': 'fx.earth.falling-leaves', 'settings': off}
                page.locator('#presetFile').set_input_files({'name': 'off.json', 'mimeType': 'application/json',
                                                           'buffer': json.dumps(preset).encode()})
                page.wait_for_function("document.getElementById('metrics').textContent.startsWith('0 active')")
                assert sequence(download('bake', 'all-off.zip'), backend)['nonemptyFrames'] == 0
                report['checks'].append('All layers disabled: every exported frame transparent')
                page.locator('#defaults').click()
                page.locator('#sample').click()
                page.wait_for_function("!document.getElementById('backend').disabled && document.getElementById('assetLabel').textContent!=='No Spine model'", timeout=180000)
                for target in ('webgl', 'webgpu'):
                    raw = download(target + 'Zip', 'developer-' + target + '.zip')
                    assert developer(raw, target)['asset']
                    dest = output / ('developer-' + target)
                    with zipfile.ZipFile(io.BytesIO(raw)) as z:
                        z.extractall(dest)
                    demo = observe(context.new_page())
                    demo.goto((dest / 'index.html').resolve().as_uri())
                    demo.wait_for_function("document.getElementById('status').textContent.startsWith('Requested ')", timeout=180000)
                    assert demo.locator('canvas').count() == 1
                    report['checks'].append({'developerTarget': target, 'actual': demo.locator('#status').inner_text()})
                    demo.close()
                assert not report['network'] and not report['pageErrors']
                report['status'] = 'PASS'
            finally:
                browser.close()
    except Exception as exc:
        report['error'] = str(exc)
        raise
    finally:
        (output / 'report.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    return report


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('html', type=Path)
    parser.add_argument('--backend', required=True, choices=['webgl1', 'webgl2', 'webgpu'])
    parser.add_argument('--output', required=True, type=Path)
    args = parser.parse_args()
    raise SystemExit(0 if run(args.html, args.backend, args.output)['status'] == 'PASS' else 2)
