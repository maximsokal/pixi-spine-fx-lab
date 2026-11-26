"""EARTH-04 independent archive and straight-alpha oracle (Pillow + stdlib)."""
import base64
import hashlib
import io
import json
import zipfile
from PIL import Image, ImageChops

EFFECT = 'fx.earth.falling-leaves'
SIZE = (512, 512)
COUNT = 120


def check(condition, message):
    if not condition:
        raise ValueError(message)


def decode_png(data):
    with Image.open(io.BytesIO(data)) as im:
        check(im.format == 'PNG' and im.mode == 'RGBA' and im.size == SIZE, 'PNG dimensions/format')
        im.verify()
    with Image.open(io.BytesIO(data)) as im:
        im.load()
        out = im.copy()
    alpha = out.getchannel('A')
    zero = alpha.point([255] + [0] * 255)
    check(all(not ImageChops.multiply(out.getchannel(c), zero).getbbox() for c in 'RGB'), 'RGB under zero alpha')
    return out


def safe_names(z):
    names = z.namelist()
    check(len(names) == len({n.casefold() for n in names}), 'duplicate names')
    check(all(n and '\\' not in n and ':' not in n and all(p not in ('', '.', '..') for p in n.split('/')) for n in names), 'unsafe names')
    check(z.testzip() is None, 'ZIP CRC')
    return set(names)


def sequence(data, backend, settings=None):
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        names = [f'frames/frame_{i:04}.png' for i in range(COUNT)]
        check(safe_names(z) == set(names + ['sequence.json']), 'frame files')
        m = json.loads(z.read('sequence.json'))
        check((m['effectId'], m['backend'], m['width'], m['height'], m['fps'], m['frameCount'], m['alpha']) ==
              (EFFECT, backend, *SIZE, 60, COUNT, 'straight-rgba8'), 'manifest identity')
        check(m['crop'] == {'x': 0, 'y': 0, 'width': 512, 'height': 512} and m['includesSpine'] is False and
              m['loopPolicy'] == 'periodic-half-open' and m['frameFormula'] == 'frameIndex/60', 'manifest policy')
        check(m['frames'] == [{'file': n, 'frame': i, 'timeSeconds': i / 60} for i, n in enumerate(names)], 'frame times')
        if settings is not None:
            check(m['settings'] == settings, 'settings mismatch')
        hashes, nonempty = [], 0
        for n in names:
            im = decode_png(z.read(n))
            hashes.append(hashlib.sha256(im.tobytes()).hexdigest())
            nonempty += bool(im.getchannel('A').getbbox())
        return {'manifest': m, 'pixelHashes': hashes, 'nonemptyFrames': nonempty}


def developer(data, target, sources=None):
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        names = safe_names(z)
        m = json.loads(z.read('preset.json'))
        check((m['effectId'], m['rendererPreference'], m['compatibility']) ==
              (EFFECT, target, {'pixi': '8.22.0', 'spine': '4.2.120'}), 'developer identity/pins')
        required = {'index.html', 'example.js', 'Leaves.mjs', 'README.md', 'LICENSES.txt',
                    'vendor/pixi-8.22.0.min.js', 'vendor/spine-pixi-v8-4.2.120.min.js',
                    *('src/' + n for n in ('curve-core.js', 'spacing-core.js', 'color-core.js', 'timeline-core.js',
                                           'leaves-core.js', 'leaves-runtime.js', 'leaves-spine.js'))}
        check(required <= names and all(z.read(n) for n in required), 'missing developer files')
        html = z.read('index.html').decode('utf-8')
        for n in required - {'index.html', 'Leaves.mjs', 'README.md', 'LICENSES.txt'}:
            check(f'src="{n}"' in html, 'unlinked local script ' + n)
        check('src="http:' not in html and 'src="https:' not in html, 'external script')
        if sources:
            for name, expected in sources.items():
                check(z.read(name) == expected, 'source differs: ' + name)
        if m['asset']:
            start = '<script id="asset" type="application/json">'
            asset = json.loads(html.split(start, 1)[1].split('</script>', 1)[0])
            check(asset['skeletonName'] == m['asset']['skeletonName'] and asset['atlasName'] == m['asset']['atlasName'], 'asset identity')
            for name, raw in [(asset['skeletonName'], asset['skeleton']), (asset['atlasName'], asset['atlas']), *asset['images'].items()]:
                check(z.read('assets/' + name) == base64.b64decode(raw, validate=True), 'embedded asset differs: ' + name)
        return m
