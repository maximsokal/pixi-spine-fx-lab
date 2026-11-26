"""GAME-11 independent pixel and archive checks, no renderer dependencies."""
import io
import json
import zipfile
from PIL import Image

EFFECT = 'fx.game.dissolve'


def decode_png(data, width, height):
    with Image.open(io.BytesIO(data)) as im:
        assert im.format == 'PNG' and im.mode == 'RGBA' and im.size == (width, height)
        im.verify()
    with Image.open(io.BytesIO(data)) as im:
        im.load()
        out = im.copy()
    assert all(a or (r == g == b == 0) for r, g, b, a in out.getdata())
    return out


def frames(data, backend, crop, count):
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        names = [f'frames/frame_{i:05}.png' for i in range(count)]
        assert len(z.namelist()) == count + 2 and set(z.namelist()) == set(names + ['sequence.json', 'README.txt'])
        assert z.testzip() is None
        m = json.loads(z.read('sequence.json'))
        assert (m['effectId'], m['backend'], m['crop'], m['count'], m['fps'], m['alpha']) == (EFFECT, backend, crop, count, 60, 'straight-rgba8')
        assert (m['width'], m['height']) == (crop['width'], crop['height'])
        assert m['frames'] == [{'file': n, 'frame': i, 'timeSeconds': i / 60} for i, n in enumerate(names)]
        assert m['frameFormula'] == 'frameIndex/60'
        return [decode_png(z.read(n), crop['width'], crop['height']) for n in names]


def compare_endpoints(source, start, end, gray):
    assert source.getchannel('A').getbbox() and source.tobytes() == start.tobytes()
    assert not any(end.tobytes()), 'Full-strength disappear endpoint must be RGBA zero'
    assert gray.getchannel('A').tobytes() == source.getchannel('A').tobytes()
    changed = 0
    for (r, g, b, a), (rr, gg, bb, aa) in zip(source.getdata(), gray.getdata()):
        if not a:
            continue
        expected = .2126 * r + .7152 * g + .0722 * b
        # Straight 8-bit RGB quantization is amplified at small alpha.
        tolerance = 1 + 255 / a
        assert max(abs(v - expected) for v in (rr, gg, bb)) <= tolerance
        if a == 255 and max(r, g, b) - min(r, g, b) > 10:
            changed += (r, g, b) != (rr, gg, bb)
    assert changed > 0, 'Grayscale must actually affect colored source pixels'
    return changed


def developer(data, target, crop, count):
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        names = z.namelist()
        assert len(names) == len(set(names)) and z.testzip() is None
        assert all(n and not n.startswith('/') and '\\' not in n and all(p not in ('', '.', '..') for p in n.split('/')) for n in names)
        m = json.loads(z.read('preset.json'))
        assert json.loads(z.read('public/preset.json')) == m
        assert (m['effectId'], m['rendererPreference'], m['crop'], m['frameCount'], m['sourceKind']) == (EFFECT, target, crop, count, 'spine')
        pkg = json.loads(z.read('package.json'))
        assert pkg['dependencies'] == {'pixi.js': '8.22.0', '@esotericsoftware/spine-pixi-v8': '4.2.120'}
        assert pkg['devDependencies']['vite'] == '7.1.12'
        assert b'export async function startDissolveDemo' in z.read('dissolve-demo.js')
        for n in ('curve-core.js', 'spacing-core.js', 'color-core.js', 'timeline-core.js', 'shockwave-spine.js', 'dissolve-core.js', 'dissolve-shader.js', 'dissolve-surface.js', 'dissolve-runtime.js', 'dissolve-authoring.js', 'example.js', 'LICENSES.txt', 'index.html'):
            assert z.read(n)
        a = m['asset']
        assert a and a['version'].startswith('4.2.') and a['images']
        for name in [a['skeleton'], a['atlas'], *(p['path'] for p in a['images'])]:
            assert z.read('public/' + name)


