#!/usr/bin/env python3
"""GAME-11 D05: independent PNG oracle and offline GPU diagnostic (not v1 acceptance)."""
import argparse
import hashlib
import json
import os
from pathlib import Path
from dissolve_pixel_oracle import frames, decode_png, compare_endpoints, developer

FULL = {'x': 0, 'y': 0, 'width': 512, 'height': 512}
END = 39 / 60


def run(html, backend, output):
    from playwright.sync_api import sync_playwright
    assert html.is_file()
    output.mkdir(parents=True, exist_ok=True)
    assert not any(output.iterdir()), 'Evidence directory must be empty'
    report = {'kind': 'diagnostic-only', 'backend': backend, 'status': 'FAIL', 'checks': [], 'network': [], 'pageErrors': []}
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True, executable_path=os.environ.get('BROWSER_EXECUTABLE'), args=json.loads(os.environ.get('DISSOLVE_BROWSER_ARGS', '["--enable-unsafe-webgpu"]')))
            try:
                page = browser.new_page(offline=True, accept_downloads=True, viewport={'width': 1440, 'height': 1000})
                page.on('pageerror', lambda e: report['pageErrors'].append(str(e)))
                page.on('request', lambda req: report['network'].append(req.url) if req.url.startswith(('http:', 'https:')) else None)
                page.goto(html.resolve().as_uri())
                page.wait_for_function("!document.getElementById('backend').disabled")
                page.locator('#backend').select_option(backend)
                page.wait_for_function("b=>document.body.dataset.ready==='true' && document.getElementById('actual').textContent===b.toUpperCase() && !document.getElementById('backend').disabled", arg=backend, timeout=180000)
                assert page.evaluate('PIXI.VERSION') == '8.22.0'
                report['checks'].append('actual editor backend and runtime pin')
                base = page.evaluate('FxDissolve.defaults()')
                clone = lambda v: json.loads(json.dumps(v))
                def capture(name, cfg, times, crop=FULL, kind='demo'):
                    result = page.evaluate('''async ({cfg,times,crop,backend,kind})=>{
                      const s=await FxDissolveBake.sceneFactory({sourceKind:kind})({settings:cfg,backend,crop});
                      try{const out=[];for(const t of times)out.push(Array.from(await FxDissolveExport.encodePng(await s.readFrame(t))));return out;}finally{s.destroy();}
                    }''', {'cfg': cfg, 'times': times, 'crop': crop, 'backend': backend, 'kind': kind})
                    out = []
                    for i, value in enumerate(result):
                        data = bytes(value)
                        (output / f'{name}-{i}.png').write_bytes(data)
                        out.append(decode_png(data, crop['width'], crop['height']))
                    return out
                off = clone(base)
                for layer in off['emitters'][0]['layers'].values():
                    layer['enabled'] = False
                original = capture('source', off, [0])[0]
                start, mid, end, repeated = capture('disappear', base, [0, .325, END, .325])
                assert mid.tobytes() == repeated.tobytes() and mid.tobytes() != start.tobytes()
                assert mid.getchannel('A').getbbox() and original.getpixel((256, 256))[3] == 0
                gray = clone(base)
                gray['endpoint'] = 'grayscale'
                gray_end = capture('gray-end', gray, [END])[0]
                report['checks'].append({'endpointChangedOpaquePixels': compare_endpoints(original, start, end, gray_end)})
                mask = clone(off)
                mask['emitters'][0]['layers']['mask']['enabled'] = True
                edge = clone(off)
                edge['emitters'][0]['layers']['edge']['enabled'] = True
                for name, cfg in [('mask', mask), ('edge', edge)]:
                    im = capture(name, cfg, [.325])[0]
                    assert im.tobytes() != original.tobytes()
                    assert all(a <= b for a, b in zip(im.getchannel('A').getdata(), original.getchannel('A').getdata()))
                partial = clone(mask)
                partial['emitters'][0]['layers']['mask']['alpha'] = .5
                half = capture('partial-end', partial, [END])[0]
                assert all(abs(a - b / 2) <= 1 for a, b in zip(half.getchannel('A').getdata(), original.getchannel('A').getdata()))
                assert not any(capture('none', base, [.325], kind='none')[0].tobytes())
                cross = {'x': -3, 'y': 110, 'width': 520, 'height': 300}
                tile = capture('cross-tile', base, [.325], crop=cross)[0]
                assert tile.tobytes() == mid.crop((-3, 110, 517, 410)).tobytes()
                report['checks'].append('source-bound alpha, partial endpoint, empty source, cross-tile and reverse parity')
                page.locator('details').evaluate_all('(els)=>els.forEach(e=>e.open=true)')
                page.locator('#preset').fill(json.dumps(base))
                page.locator('#apply').click()
                def idle():
                    page.wait_for_function("!document.getElementById('backend').disabled", timeout=180000)
                    assert page.locator('#status').get_attribute('data-error') == 'false', page.locator('#status').inner_text()
                idle()
                crop = {'x': 96, 'y': 96, 'width': 320, 'height': 320}
                for key, value in {'cropX': 0, 'cropY': 0, 'cropWidth': 320, 'cropHeight': 320, 'exportFrames': 40}.items():
                    page.locator('#' + key).fill(str(value))
                def download(button, name):
                    with page.expect_download(timeout=180000) as event:
                        page.locator('#' + button).click()
                    dest = output / name
                    event.value.save_as(dest)
                    idle()
                    return dest.read_bytes()
                before = page.locator('#frameLabel').inner_text()
                first = frames(download('exportPng', 'sequence.zip'), backend, crop, 40)
                assert first[0].tobytes() == original.crop((96, 96, 416, 416)).tobytes()
                assert not any(first[-1].tobytes())
                page.locator('#zoom').evaluate("e=>{e.value='150';e.dispatchEvent(new Event('input'));}")
                page.locator('#background').select_option('light')
                second = frames(download('exportPng', 'sequence-camera.zip'), backend, crop, 40)
                assert all(a.tobytes() == b.tobytes() for a, b in zip(first, second))
                assert before == page.locator('#frameLabel').inner_text()
                report['checks'].append('40 decoded frames, camera independence and preview preservation')
                page.locator('#sample').click()
                idle()
                assert page.locator('#sourceKind').input_value() == 'spine'
                page.locator('#frame').evaluate("e=>{e.value='15';e.dispatchEvent(new Event('input'));}")
                idle()
                for bg in ('dark', 'light', 'checker'):
                    page.locator('#background').select_option(bg)
                    page.locator('#viewport').screenshot(path=output / ('preview-' + bg + '.png'))
                for target, button in [('webgl', 'exportWebgl'), ('webgpu', 'exportWebgpu')]:
                    developer(download(button, 'developer-' + target + '.zip'), target, crop, 40)
                report['checks'].append('actual sample editor and developer archives; Vite execution not tested')
                assert not report['network'] and not report['pageErrors']
                report['status'] = 'PASS'
            finally:
                browser.close()
    except Exception as e:
        report['error'] = str(e)
        raise
    finally:
        report['sha256'] = {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in output.iterdir() if p.is_file()}
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
