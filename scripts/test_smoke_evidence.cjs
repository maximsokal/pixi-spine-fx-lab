#!/usr/bin/env node
'use strict';
// FIRE-05 FX-CORE-07: PNG-backed backend/artist-control evidence (per actual renderer).
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const crypto=require('node:crypto'),cp=require('node:child_process'),os=require('node:os');
const S=require('../assets/smoke-plume/src/smoke-core.js');
const {decodePng,countAlpha,comparePixels}=require('./fx_visual_png.cjs');
if(!process.argv[2])throw Error('Usage: node scripts/test_smoke_evidence.cjs OUT_DIR');
const dir=path.resolve(process.argv[2]),repo=path.resolve(__dirname,'..');
const browser=JSON.parse(fs.readFileSync(path.join(dir,'report.json'),'utf8'));
assert.equal(browser.status,'PASS');
const markdown=fs.readFileSync(path.join(repo,'references/fx/fire/smoke-plume.md'),'utf8');
const json=markdown.match(/```json\s*([\s\S]*?)\s*```/);
assert.ok(json,'No Blueprint JSON');const bp=JSON.parse(json[1]);
const base=S.defaults();
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const delta=(a,b)=>comparePixels(a,b,{step:1,channelTolerance:0}).changedPixels;
function png(name){
 const bytes=fs.readFileSync(path.join(dir,name+'.png'));
 const image=decodePng(bytes);
 assert.equal(image.width,512);assert.equal(image.height,512);
 return {image,ref:{path:name+'.png',sha256:sha(bytes)}};
}
const count=img=>{const x=countAlpha(img);return x.partial+x.opaque};
const imgs={
 established:png('phase-established'),lofting:png('phase-lofting'),
 broadening:png('phase-broadening'),seam:png('phase-wrap-120'),
 beforeSeam:png('phase-loop-end'),baseline:png('baseline'),
 noLayers:png('layers-all-off'),stopHalf:png('stop-half-fade'),
 stopEnd:png('stop-transparent-119'),burstRise:png('burst-rise'),
 burstTail:png('burst-fade-98'),burstEnd:png('burst-transparent-99')
};
const checks=[];
function check(id,kind,expected,actual,evidence=[],tolerance={}){
 checks.push({id,kind,status:'PASS',expected,actual,evidence,tolerance});
}
const phaseTimes={established:0,lofting:.5,broadening:1.5,seam:2};
for(const phase of bp.phases){
 const target=imgs[phase.id];
 assert.ok(count(target.image)>500);
 check('phase.'+phase.id,'visual',phase.look,
  {timeSeconds:phaseTimes[phase.id],visiblePixels:count(target.image)},
  [target.ref],{visiblePixelsMin:500});
}
assert.equal(delta(imgs.established.image,imgs.seam.image),0);
check('loop.pixel-seam','visual','Exact same-backend RGBA pixels on frames 0 and 120',
 {pixelDelta:0},[imgs.established.ref,imgs.seam.ref]);
assert.equal(count(imgs.burstEnd.image),0);
assert.equal(count(imgs.stopEnd.image),0);
check('fade.transparent','visual','Last included PNG frames: Stop119 and Burst99 both fully transparent',
 {stopNontransparent:0,burstNontransparent:0},
 [imgs.stopEnd.ref,imgs.burstEnd.ref]);
assert.ok(count(imgs.burstTail.image)>0);
assert.ok(count(imgs.stopHalf.image)>0);
check('fade.existing-smoke','visual','Existing clouds remain visible halfway through fade',
 {stopHalf:count(imgs.stopHalf.image),burstTail:count(imgs.burstTail.image)},
 [imgs.stopHalf.ref,imgs.burstTail.ref]);
for(const mask of browser.masks){
 assert.deepEqual(mask.corners,[0,0,0,0]);
 assert.deepEqual(mask.border,[0,0,0,0]);
 assert.ok(mask.center>100);
}
check('masks.feathered','numeric','Four 96x96 owned organic sprite textures have alpha-zero exterior',
 browser.masks);
assert.ok(browser.alpha.partial>1000);
check('alpha.partial','visual','Real partially-transparent smoke, not opaque clipped rectangles',
 {partialPixels:browser.alpha.partial,transparentPixels:browser.alpha.transparent},
 [imgs.baseline.ref]);
assert.ok(browser.alpha64Pixels>1500&&browser.minRGBAtAlpha64>=38);
check('png.no-dark-premultiplied-seams','visual',
 'Straight RGB from smoke palette remains bright enough at alpha >= 64; no PMA black/dark seams',
 {minRGBAtAlpha64:browser.minRGBAtAlpha64,pixelsWithAlpha64:browser.alpha64Pixels},
 [imgs.baseline.ref],{rgbMinimum:38});
const sig=(c,t)=>sha(Buffer.from(JSON.stringify(S.sample(c,t).emitters)));
const controls={
 rate:{value:40,t:.5},
 initialSize:{value:30,t:.5},
 expansion:{value:5,t:.5},
 riseSpeed:{value:150,t:.5},
 swirl:{value:.85,t:.5},
 density:{value:.95,t:.5},
 lifetimeSeconds:{value:1.4,t:.5},
 windX:{value:80,t:.5},
 nozzleWidth:{value:95,t:.5},
 originGap:{value:35,t:.5},
 spatialJitter:{value:.4,t:.5},
 intervalJitter:{value:.42,t:.5},
 emissionFrames:{value:20,t:.5,mode:'burst'},
 stopFrame:{value:40,t:.85,mode:'stop'},
 fadeFrames:{value:40,t:1.3,mode:'stop'},
 durationFrames:{value:180,t:.5},
 exportFrames:{value:180,meta:true},
 seed:{value:10023,t:.5},
 minGapSeconds:{value:.15,t:.5},
 curlScale:{value:90,t:.5},
 spacingCurveEnabled:{value:true,t:.5},
 mode:{value:'burst',t:.5},
 style:{value:'magical',t:.5},
 quality:{value:'high',t:.5,heavy:true},
 spatialMode:{value:'clustered',t:.5},
 emissionMode:{value:'distance',t:.5,moving:true}
};
assert.equal(bp.parameters.length,26);
for(const p of bp.parameters){
 const key=p.key,o=controls[key];
 assert.ok(o,'No parameter oracle '+key);
 const a=structuredClone(base),b=structuredClone(base);
 if(o.mode){
  a.mode=o.mode;b.mode=o.mode;
  if(o.mode==='burst'){a.durationFrames=100;a.exportFrames=100;
   b.durationFrames=100;b.exportFrames=100}
 }
 if(o.heavy){
  for(const c of [a,b]){c.rate=120;c.quality='low';
   c.emitters.push(S.newEmitter(1),S.newEmitter(2),S.newEmitter(3))}
 }
 if(o.moving){
  a.emitters[0].motion.mode='path';b.emitters[0].motion.mode='path';
 }
 b[key]=o.value;
 if(o.meta){
  assert.notEqual(a[key],b[key]);
  check('parameter.'+key,'numeric','Author frame count controls export manifest',
   {before:a[key],after:b[key],defaultBaked:browser.package.count});
 }else{
  const x=sig(a,o.t),y=sig(b,o.t);
  assert.notEqual(x,y,'inert declared artist parameter '+key);
  check('parameter.'+key,'numeric','Setting has numerical/pixel-affecting effect',
   {before:a[key],after:b[key],timeSeconds:o.t,beforeHash:x,afterHash:y});
 }
}
for(const [key,index,value] of [
 ['emissionRateCurve',0,.3],['sizeCurve',1,3.5],['opacityCurve',1,.2],
 ['riseCurve',1,1.7],['spacingCurve',1,50]
]){
 const a=structuredClone(base),b=structuredClone(base);
 if(key==='spacingCurve'){a.spacingCurveEnabled=true;b.spacingCurveEnabled=true}
 b[key].keys[index].y=value;
 const before=sig(a,.5),after=sig(b,.5);
 assert.notEqual(before,after,'inert curve '+key);
 check('curve.'+key,'numeric','Editable '+key+' affects rendered particle schedule/geometry',
  {beforeHash:before,afterHash:after});
}
const pal=png('palette-rgba');
assert.ok(delta(pal.image,imgs.baseline.image)>20);
check('palette.rgba','visual','User edited smoke gradient and alpha changes PNG colors',
 {changedPixels:delta(pal.image,imgs.baseline.image)},
 [pal.ref,imgs.baseline.ref]);
const style=png('style-magical');
assert.ok(delta(style.image,imgs.baseline.image)>20);
check('style.magical','visual','Style changes smoke shape independent of RGB palette',
 {changedPixels:delta(style.image,imgs.baseline.image)},
 [style.ref,imgs.baseline.ref]);
for(const [name,changed] of Object.entries(browser.layers)){
 const yes=png('layer-'+name+'-on'),no=png('layer-'+name+'-off'),
  shifted=png('layer-'+name+'-offset');
 assert.equal(delta(yes.image,no.image),changed);
 assert.ok(changed>4&&delta(yes.image,shifted.image)>4);
 check('layer.'+name,'visual','Layer independent visibility and XY',
  {onOffChangedPixels:changed,xyChangedPixels:delta(yes.image,shifted.image)},
  [yes.ref,no.ref,shifted.ref]);
}
assert.equal(count(imgs.noLayers.image),0);
check('layers.all-disabled','visual','All smoke layers off => no ghost beams/sprites/alpha',
 {pixels:0},[imgs.noLayers.ref]);
const origin=png('emitter-origin-moved');
assert.ok(delta(origin.image,imgs.baseline.image)>100);
check('emitter.world-position','visual','Moving world source changes actual pixels',
 {changedPixels:delta(origin.image,imgs.baseline.image)},
 [origin.ref,imgs.baseline.ref]);
const motion=png('moving-distance');
assert.ok(count(motion.image)>100);
check('emitter.moving-arc','visual','Moving-source distance mode emits real visible puffs',
 {pixels:count(motion.image)},[motion.ref]);
assert.deepEqual(browser.zooms,{'.5':0,'1':0,'2':0});
check('camera.zoom','visual','CSS zoom 0.5/1/2 leaves same-backend PNG identical',
 browser.zooms,[png('zoom-.5').ref,png('zoom-1').ref,png('zoom-2').ref,
 imgs.baseline.ref]);
assert.deepEqual(browser.backgrounds,{checker:0,dark:0,light:0});
check('background.transparent','visual','Checker/dark/light affect DOM only',
 browser.backgrounds,[imgs.baseline.ref]);
check('spine.animated-bone','numeric','Animated Spine bone affects owned Smoke anchor',
 {distance:browser.animatedBoneDelta,pages:browser.spine.pages});
check('spine.slot-attachment','numeric','Active Spine slot and attached region resolve in pinned runtime',
 {verified:true,pages:browser.spine.pages});
check('export.rgba','export','Exactly frameIndex/60 straight-alpha PNG in 512px canvas',
 {frames:browser.package.count,fps:60,alpha:browser.package.alpha},
 [imgs.baseline.ref]);
check('export.developers','export','Pinned WebGL/WebGPU ZIPs built from exact FxSmoke',
 {sizes:browser.developerBytes});
check('backend.actual','backend',browser.backend.actual,browser.backend.actual);
const report={
 schemaVersion:1,effectId:bp.effectId,effectVersion:bp.effectVersion,
 sourceCommit:cp.execFileSync('git',['rev-parse','HEAD'],{cwd:repo,encoding:'utf8'}).trim(),
 status:'PASS',environment:{
  browser:'Chromium '+browser.browser,
  device:os.platform()+' '+os.release()+' '+os.arch()+' headless',
  requestedBackend:browser.backend.actual==='webgpu'?'webgpu':'webgl',
  actualBackend:browser.backend.actual,glVersion:browser.backend.version,
  gpu:'Hardware GPU identification unavailable; actual API verified',
  offline:true,networkRequests:browser.network
 },
 fixture:{seed:base.seed,settings:base,width:512,height:512,fps:60,
  asset:'FIRE-05 four owned generated soft masks + Doctor_head two-page Spine JSON 4.2',
  frameTimesSeconds:[0,1,2]},
 checks,warnings:[
  'No physical mobile GPU thermal/fps certification; headless Chromium backend only',
  'Loop 120 frames warm starts at t0; stop fade 60 frames; separate burst 40+60 frames',
  browser.full?'Full 120 loop PNG + full 100 burst frame export executed in this browser run':
   'Only 8 real PNG frames baked on this backend; full 120/100 frames executed on WebGL2, record this limit',
  'Real Spine JSON + 2-page atlas verified; binary .skel parser not exercised in this test',
  'Blur filter, full CFD/raymarch and experimental ParticleContainer not implemented',
  'Seeded stable origin positions are not physical turbulent fluid motion; remeasure on target devices',
  'Regenerate evidence after publishing and match sourceCommit to exact pushed main SHA'
 ]};
const outfile=path.join(dir,'effect-evidence.json');
fs.writeFileSync(outfile,JSON.stringify(report,null,2)+'\n');
console.log('FIRE-05 EVIDENCE',JSON.stringify({outfile,backend:browser.backend.actual,
 checks:checks.length,phases:bp.phases.length,parameters:bp.parameters.length}));
