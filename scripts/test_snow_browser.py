#!/usr/bin/env python3
"""AIR-02 candidate evidence; actual Chromium only, no synthetic GPU PASS."""
import argparse
import base64
import hashlib
import io
import json
import os
import platform
import re
import subprocess
import zipfile
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
EFFECT = 'fx.air.snowfall'


def check(ok, message):
    if not ok:
        raise ValueError(message)


def archive(data):
    z = zipfile.ZipFile(io.BytesIO(data))
    try:
        infos = z.infolist()
        names = [i.orig_filename for i in infos]
        check(len(names) == len(set(n.casefold() for n in names)), 'duplicate archive path')
        check(all(n == i.filename and '\\' not in n and '\x00' not in n and ':' not in n and all(p not in ('', '.', '..') for p in n.split('/')) for n, i in zip(names, infos)), 'unsafe archive path')
        check(sum(i.file_size for i in infos) <= 256 * 1024**2, 'archive budget')
        check(z.testzip() is None, 'archive CRC')
        return z
    except Exception:
        z.close()
        raise


def sequence(data, settings, backend, count):
    with archive(data) as z:
        names = [f'frames/{i:04d}.png' for i in range(count)]
        check(set(z.namelist()) == set(names + ['sequence.json']), 'sequence entries')
        m = json.loads(z.read('sequence.json'))
        check(m['schemaVersion'] == 1 and m['effectId'] == EFFECT and m['settings'] == settings, 'sequence settings')
        check(m['backend']['actual'] == backend and m['fps'] == 60 and m['alpha'] == 'straight-rgba8', 'sequence backend/alpha')
        check((m['width'], m['height'], m['frameCount']) == (512, 512, count), 'sequence dimensions/count')
        check(m['frames'] == [{'frame':i, 'file':n, 'timeSeconds':i/60} for i,n in enumerate(names)], 'sequence clock')
        frames = [z.read(n) for n in names]
        for data in frames:
            with Image.open(io.BytesIO(data)) as im:
                check(im.format == 'PNG' and im.mode == 'RGBA' and im.size == (512,512), 'PNG dimensions/format')
                im.load()
        return frames


def pixels(data):
    with Image.open(io.BytesIO(data)) as im:
        return im.convert('RGBA').tobytes()


def metrics(data):
    p = pixels(data)
    alpha = p[3::4]
    return {'visiblePixels':sum(a>0 for a in alpha), 'transparentPixels':alpha.count(0),
            'partialPixels':sum(0<a<255 for a in alpha),
            'lightPartialPixels':sum(32<=p[i+3]<255 and min(p[i:i+3])>=180 for i in range(0,len(p),4))}


def changed(a,b):
    a,b = pixels(a),pixels(b)
    return sum(a[i:i+4]!=b[i:i+4] for i in range(0,len(a),4))


def developer(data, settings, target, sample, sources):
    with archive(data) as z:
        m = json.loads(z.read('preset.json'))
        check(m == json.loads(z.read('public/preset.json')), 'preset copies differ')
        check(m['effectId'] == EFFECT and m['settings'] == settings and m['rendererPreference'] == target, 'developer settings')
        check(m['compatibility'] == {'pixi':'8.22.0','spine':'4.2.120','vite':'7.1.12'}, 'developer pins')
        pkg=json.loads(z.read('package.json'))
        check(pkg['dependencies']=={'pixi.js':'8.22.0','@esotericsoftware/spine-pixi-v8':'4.2.120'} and pkg['devDependencies']=={'vite':'7.1.12'}, 'package pins')
        for name, source in sources.items():
            check(source in z.read(name).decode('utf-8'), 'source parity '+name)
        for name in ('example.js','index.html','README.md','LICENSES.txt'):
            check(bool(z.read(name)), 'empty '+name)
        a=m['asset']
        check(json.loads(z.read('public/'+a['skeleton'])) == sample['skeleton'], 'skeleton parity')
        check(z.read('public/'+a['atlas']).decode() == sample['atlas'], 'atlas parity')
        for name, encoded in sample['images'].items():
            check(z.read('public/assets/'+name) == base64.b64decode(encoded,validate=True), 'texture parity '+name)
        return m


def run(output, backend, headed=False):
    from playwright.sync_api import sync_playwright
    from build_snow_editor import build
    check(not output.is_relative_to(ROOT), 'write evidence outside the repository')
    output.mkdir(parents=True, exist_ok=True)
    check(not any(output.iterdir()), 'evidence directory must be empty')
    # Build from the exact clean source revision, never accept arbitrary HTML.
    git=lambda *a: subprocess.check_output(['git','-C',str(ROOT),*a],text=True).strip()
    commit=git('rev-parse','HEAD');check(not git('status','--porcelain'), 'dirty source tree')
    doc=json.loads((ROOT/'references/fx/air/snowfall.md').read_text(encoding='utf-8').split('```json\n',1)[1].split('\n```',1)[0])
    html=output/'Snowfall_Lab.html';html.write_text(build(ROOT),encoding='utf-8')
    checks=[];errors=[];network=[]
    def add(id,kind,expected,actual,ok,evidence=()):
        checks.append(dict(id=id,kind=kind,expected=expected,actual=actual,status='PASS' if ok else 'FAIL',tolerance={},evidence=list(evidence)))
    def missing(id,kind,reason):
        checks.append(dict(id=id,kind=kind,expected=reason,actual=None,status='NOT RUN',tolerance={},evidence=[],reason=reason))
    def save(name,data):
        (output/name).write_bytes(data)
        return {'path':name,'sha256':hashlib.sha256(data).hexdigest()}
    def bake(page,n):
        return base64.b64decode(page.evaluate('async n=>{const b=(await SnowExports.bake({download:false,frames:n})).blob;return await new Promise((ok,no)=>{const r=new FileReader();r.onload=()=>ok(r.result.split(",")[1]);r.onerror=no;r.readAsDataURL(b);});}',n),validate=True)
    with sync_playwright() as p:
        flags=['--disable-dev-shm-usage']
        if backend.startswith('webgl'):
            flags+=['--enable-unsafe-swiftshader','--use-angle=swiftshader','--enable-webgl']
        browser=p.chromium.launch(headless=not headed,executable_path=os.getenv('BROWSER_EXECUTABLE'),args=flags)
        try:
            page=browser.new_page(viewport={'width':1440,'height':1000},service_workers='block')
            page.on('pageerror',lambda e:errors.append(str(e)))
            def block(route):
                network.append(route.request.url);route.abort()
            page.route(re.compile(r'^https?://'),block)
            page.goto(html.as_uri());page.wait_for_function('window.SnowEditor && SnowEditor.scene && !SnowEditor.busy')
            page.select_option('#backend',backend)
            page.wait_for_function('!SnowEditor.busy')
            env=page.evaluate('''()=>{const r=SnowEditor.scene.app.renderer,g=r.gl;return {actualBackend:SnowEditor.getActualBackend().actual,glVersion:g?g.getParameter(g.VERSION):null,gpu:g?(g.getParameter(g.RENDERER)||'unavailable'):(r.gpu?.device?.adapterInfo?.description||'unavailable'),pixi:PIXI.VERSION}}''')
            check(env['actualBackend']==backend and env['pixi']=='8.22.0','actual backend/pin mismatch')
            add('backend.actual','backend',backend,backend,True)
            defaults=page.evaluate('SnowEditor.getSettings()')
            page.add_script_tag(path=str(ROOT/'scripts/snow_evidence_core.cjs'))
            checks.extend(page.evaluate('doc=>FxSnowEvidence.audit(FxSnow,FxSnowExport,doc)',doc))
            raw=bake(page,60);save('sequence.zip',raw);frames=sequence(raw,defaults,backend,60)
            zoom_equal={}
            for zoom in ('.5','2'):
                page.select_option('#zoom',zoom)
                zoom_equal[zoom]=frames==sequence(bake(page,60),defaults,backend,60)
            page.select_option('#zoom','1')
            add('export.camera','export','Same-backend PNG bytes at 50/100/200% zoom',zoom_equal,all(zoom_equal.values()))
            seam_settings=page.evaluate('()=>{const c=JSON.parse(JSON.stringify(SnowEditor.getSettings()));c.exportFrames=61;if(!SnowEditor.setSettings(c))throw Error("preset rejected");return SnowEditor.getSettings()}')
            seam=sequence(bake(page,61),seam_settings,backend,61)[60]
            for phase,data in [('start',frames[0]),('middle',frames[30]),('seam',seam)]:
                m=metrics(data);m['diffFromStart']=changed(frames[0],data)
                ok=m['visiblePixels']>0 and m['transparentPixels']>0 and m['partialPixels']>0 and m['lightPartialPixels']>0 and (m['diffFromStart']>0 if phase=='middle' else m['diffFromStart']==0)
                add('phase.'+phase,'visual','Visible transparent light snow; motion at middle; exact seam',m,ok,[save('phase-'+phase+'.png',data)])
            off=page.evaluate('()=>{const c=JSON.parse(JSON.stringify(SnowEditor.getSettings()));for(const e of c.emitters)for(const l of Object.values(e.layers))l.enabled=false;if(!SnowEditor.setSettings(c))throw Error("preset rejected");return SnowEditor.getSettings()}')
            blank=sequence(bake(page,1),off,backend,1)[0];blank_metrics=metrics(blank)
            add('layer.all-disabled','visual','All layers off produces zero visible pixels',blank_metrics,blank_metrics['visiblePixels']==0,[save('all-disabled.png',blank)])
            one=page.evaluate('c=>{c.mode="oneShot";c.durationFrames=c.exportFrames=40;if(!SnowEditor.setSettings(c))throw Error("preset rejected");return SnowEditor.getSettings()}',defaults)
            end=sequence(bake(page,40),one,backend,40)[39];end_metrics=metrics(end)
            add('timeline.one-shot-end','visual','One shot frame 39 is transparent',end_metrics,end_metrics['visiblePixels']==0,[save('one-shot-end.png',end)])
            check(page.evaluate('c=>SnowEditor.setSettings(c)',defaults),'restore preset')
            for bg in ('checker','dark','light'):
                page.select_option('#background',bg);page.locator('#preview').screenshot(path=output/f'preview-{bg}.png')
            page.click('#sample');page.wait_for_function('!SnowEditor.busy && SnowEditor.asset!==null')
            sample=page.evaluate('JSON.parse(document.getElementById("sampleData").textContent)')
            sources=page.evaluate('()=>Object.fromEntries(Object.entries({"FxCurves.mjs":"fxCurveCore","FxColors.mjs":"fxColorCore","FxSpacing.mjs":"fxSpacingCore","FxTimeline.mjs":"fxTimelineCore","FxSnowPose.mjs":"fxSnowPose","FxSnow.mjs":"fxSnowCore","Snow.mjs":"fxSnowRuntime"}).map(([k,v])=>[k,document.getElementById(v).textContent]))')
            for target in ('webgl','webgpu'):
                raw=base64.b64decode(page.evaluate('async t=>{const b=(await SnowExports.buildPackage(t,false)).blob;return await new Promise((ok,no)=>{const r=new FileReader();r.onload=()=>ok(r.result.split(",")[1]);r.onerror=no;r.readAsDataURL(b);});}',target),validate=True)
                developer(raw,defaults,target,sample,sources);save('developer-'+target+'.zip',raw)
                add('export.archive-'+target,'export','Exact preset, source, dependency and sample bytes',{'bytes':len(raw)},True)
            add('lifecycle.offline','lifecycle','Zero HTTP requests and page errors',{'requests':network,'errors':errors},not network and not errors)
            missing('export.vite','export','Actual extracted Vite build and ESM runtime still require execution')
            missing('visual.review','visual','Human visual review of actual PNGs and light/dark/checker previews required')
            missing('architecture.gate','lifecycle','Run architecture and protected baseline checks separately')
            report={'schemaVersion':1,'effectId':EFFECT,'effectVersion':doc['effectVersion'],'sourceCommit':commit,'status':'FAIL' if any(c['status']=='FAIL' for c in checks) else 'NOT RUN' if any(c['status']=='NOT RUN' for c in checks) else 'PASS','environment':{'browser':browser.version,'device':platform.platform(),'requestedBackend':'webgpu' if backend=='webgpu' else 'webgl','actualBackend':backend,'glVersion':env['glVersion'],'gpu':env['gpu'],'offline':not network,'networkRequests':len(network)},'fixture':{'seed':defaults['seed'],'settings':defaults,'width':512,'height':512,'fps':60,'asset':'no Spine model for phase PNG; Doctor sample for developer archives','frameTimesSeconds':[0,.5,1]},'checks':checks,'warnings':['Candidate evidence only; validate with effect_validation.py --candidate, never --require-pass before promotion.','SwiftShader is not physical GPU performance evidence.']}
            (output/'candidate-report.json').write_text(json.dumps(report,indent=2,allow_nan=False),encoding='utf-8')
            return 0 if report['status']=='PASS' else 2
        finally:
            browser.close()


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output',required=True,type=Path)
    parser.add_argument('--backend',required=True,choices=['webgl1','webgl2','webgpu'])
    parser.add_argument('--headed',action='store_true')
    args=parser.parse_args()
    raise SystemExit(run(args.output.resolve(),args.backend,args.headed))
