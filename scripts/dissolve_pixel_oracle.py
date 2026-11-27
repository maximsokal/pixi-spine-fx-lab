"""GAME-11 independent pixel and archive checks, no renderer dependencies."""
import io
import json
import zipfile
from PIL import Image

EFFECT = 'fx.game.dissolve'


def require(condition, message):
    if not condition:
        raise AssertionError(message)


def decode_png(data, width, height):
    with Image.open(io.BytesIO(data)) as im:
        require(im.format == 'PNG' and im.mode == 'RGBA' and im.size == (width, height), 'PNG format/dimensions')
        im.verify()
    with Image.open(io.BytesIO(data)) as im:
        im.load()
        out = im.copy()
    require(all(a or (r == g == b == 0) for r, g, b, a in out.getdata()), 'transparent PNG has hidden RGB')
    return out


def frames(data, backend, crop, count):
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        names = [f'frames/frame_{i:05}.png' for i in range(count)]
        require(len(z.namelist()) == count + 2 and set(z.namelist()) == set(names + ['sequence.json', 'README.txt']), 'sequence ZIP entries')
        require(z.testzip() is None, 'sequence ZIP CRC')
        m = json.loads(z.read('sequence.json'))
        require((m['effectId'], m['backend'], m['crop'], m['count'], m['fps'], m['alpha']) == (EFFECT, backend, crop, count, 60, 'straight-rgba8'), 'sequence manifest')
        require((m['width'], m['height']) == (crop['width'], crop['height']), 'manifest dimensions')
        require(m['frames'] == [{'file': n, 'frame': i, 'timeSeconds': i / 60} for i, n in enumerate(names)], 'frame timestamps')
        require(m['frameFormula'] == 'frameIndex/60', 'frame formula')
        return [decode_png(z.read(n), crop['width'], crop['height']) for n in names]


def compare_endpoints(source, start, end, gray):
    require(source.getchannel('A').getbbox() and source.tobytes() == start.tobytes(), 'start must match visible source')
    require(not any(end.tobytes()), 'Full-strength disappear endpoint must be RGBA zero')
    require(gray.getchannel('A').tobytes() == source.getchannel('A').tobytes(), 'grayscale alpha differs from source')
    changed = 0
    for (r, g, b, a), (rr, gg, bb, aa) in zip(source.getdata(), gray.getdata()):
        if not a:
            continue
        expected = .2126 * r + .7152 * g + .0722 * b
        # Straight 8-bit RGB quantization is amplified at small alpha.
        tolerance = 1 + 255 / a
        require(max(abs(v - expected) for v in (rr, gg, bb)) <= tolerance, 'grayscale luminance mismatch')
        if a == 255 and max(r, g, b) - min(r, g, b) > 10:
            changed += (r, g, b) != (rr, gg, bb)
    require(changed > 0, 'Grayscale must actually affect colored source pixels')
    return changed


def developer(data, target, crop, count):
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        names = z.namelist()
        require(len(names) == len(set(names)) and z.testzip() is None, 'developer ZIP duplicate entry or CRC')
        require(all(n and not n.startswith('/') and '\\' not in n and all(p not in ('', '.', '..') for p in n.split('/')) for n in names), 'unsafe ZIP path')
        m = json.loads(z.read('preset.json'))
        require(json.loads(z.read('public/preset.json')) == m, 'developer presets differ')
        require((m['effectId'], m['rendererPreference'], m['crop'], m['frameCount'], m['sourceKind']) == (EFFECT, target, crop, count, 'spine'), 'developer manifest')
        pkg = json.loads(z.read('package.json'))
        require(pkg['dependencies'] == {'pixi.js': '8.22.0', '@esotericsoftware/spine-pixi-v8': '4.2.120'}, 'runtime pins')
        require(pkg['devDependencies']['vite'] == '7.1.12', 'Vite pin')
        require(b'export async function startDissolveDemo' in z.read('dissolve-demo.js'), 'missing demo controller')
        for n in ('curve-core.js', 'spacing-core.js', 'color-core.js', 'timeline-core.js', 'shockwave-spine.js', 'dissolve-core.js', 'dissolve-shader.js', 'dissolve-surface.js', 'dissolve-runtime.js', 'dissolve-authoring.js', 'example.js', 'LICENSES.txt', 'index.html'):
            require(z.read(n), 'missing/empty source module')
        a = m['asset']
        require(a and a['version'].startswith('4.2.') and a['images'], 'Spine asset identity')
        for name in [a['skeleton'], a['atlas'], *(p['path'] for p in a['images'])]:
            require(z.read('public/' + name), 'missing/empty asset')


