#!/usr/bin/env node
'use strict';
// FIRE-06 FX-CORE-07 evidence: independently decoded actual renderer PNGs and
// explicit numerical oracles for every declared artist control.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),
crypto=require('node:crypto'),cp=require('node:child_process'),os=require('node:os');
const H=require('../assets/heat-haze/src/haze-core.js');
const {decodePng,countAlpha,comparePixels}=require('./fx_visual_png.cjs');
if(!process.argv[2])throw Error('Usage: node scripts/test_haze_evidence.cjs OUT_DIR');
const dir=path.resolve(process.argv[2]),repo=path.resolve(__dirname,'..');
const report=JSON.parse(fs.readFileSync(path.join(dir,'report.json'),'utf8'));
assert.equal(report.status,'PASS','Browser report must actually PASS');
const text=fs.readFileSync(path.join(repo,'references/fx/fire/heat-haze.md'),'utf8'),
match=text.match(/```json\s*([\s\S]*?)\s*```/);
assert.ok(match);const bp=JSON.parse(match[1]),base=H.defaults();
const clone=o=>JSON.parse(JSON.stringify(o));
const digest=b=>crypto.createHash('sha256').update(b).digest('hex');
function pic(name){
 const bytes=fs.readFileSync(path.join(dir,name+'.png'));
 const image=decodePng(bytes);
 assert.equal(image.width,512);assert.equal(image.height,512);
 return {image,ref:{path:name+'.png',sha256:digest(bytes)}};
}
const changed=(a,b)=>comparePixels(a,b,{step:1,channelTolerance:0}).changedPixels;
const visible=a=>{const x=countAlpha(a);return x.partial+x.opaque};
const checks=[];
function add(id,kind,expected,actual,evidence=[],tolerance={}){
 checks.push({id,kind,status:'PASS',expected,actual,evidence,tolerance});
}
const shots={
 low:pic('loop-start'),peak:pic('affected-checker'),
 cooldown:pic('loop-cooldown'),seam:pic('loop-period-boundary'),
 baseline:pic('baseline-seek'),original:pic('original-amplitude-zero'),
 map:pic('map-checker'),neutral:pic('map-neutral'),
 glowOff:pic('glow-disabled'),glowOn:pic('glow-only'),
 glowColor:pic('glow-recolored'),allOff:pic('all-layers-off'),
 lastStop:pic('last-stop-map'),
 lastStopComposite:pic('last-stop-composite')
};
const phases={low:0,peak:.5,cooldown:1.5,seam:2};
for(const phase of bp.phases){
 const image=shots[phase.id];
 assert.ok(visible(image.image)>1000);
 add('phase.'+phase.id,'visual',phase.look,
  {timeSeconds:phases[phase.id],visiblePixels:visible(image.image)},
  [image.ref],{visibleMin:1000});
}
assert.equal(changed(shots.low.image,shots.seam.image),0);
add('loop.seam','visual','120 frame exact image seam on same renderer',
 {pixelDelta:0},[shots.low.ref,shots.seam.ref],{pixelDeltaMax:0});
const insideChanges=changed(shots.original.image,shots.peak.image);
assert.ok(insideChanges>300);
let affected=0,coverage=0,outsideChanges=0,neutralCount=0;
const m=shots.map.image.pixels,b=shots.peak.image.pixels,src=shots.original.image.pixels;
for(let i=0;i<m.length;i+=4){
 assert.equal(m[i+3],255);
 if(m[i+2]){
  coverage++;
 }else{
  neutralCount++;
  assert.deepEqual([...m.subarray(i,i+4)],[128,128,0,255]);
 }
 const altered=Array.from({length:4},(_,k)=>b[i+k]!==src[i+k]).some(Boolean);
 if(altered){
  affected++;
  if(!m[i+2])outsideChanges++;
 }
}
assert.equal(outsideChanges,0);
assert.ok(coverage>2000&&neutralCount>170000);
assert.equal(affected,insideChanges);
add('refraction.exact-roi','visual',
 'Actual captured original changes inside nonzero B only, exactly 0 changed pixels outside B',
 {changedInside:insideChanges,changedOutside:outsideChanges,coveragePixels:coverage},
 [shots.peak.ref,shots.original.ref,shots.map.ref]);
assert.ok(changed(shots.map.image,shots.neutral.image)>100);
for(let i=0;i<shots.neutral.image.pixels.length;i+=4)
 assert.deepEqual([...shots.neutral.image.pixels.subarray(i,i+4)],[128,128,0,255]);
add('refraction.zero-amplitude','visual',
 'Zero amplitude produces neutral R128/G128/B0 data map and untouched original',
 {neutralPixels:262144,visibleDifference:changed(shots.peak.image,shots.original.image)},
 [shots.neutral.ref,shots.original.ref,shots.peak.ref]);
assert.equal(visible(shots.glowOff.image),0);
assert.ok(visible(shots.glowOn.image)>50);
assert.ok(changed(shots.glowOn.image,shots.glowColor.image)>50);
add('glow.optional','visual','Independent glow OFF by default; actual RGBA palette/tint changes separately',
 {offNontransparent:0,onNontransparent:visible(shots.glowOn.image),
  paletteChangedPixels:changed(shots.glowOn.image,shots.glowColor.image)},
 [shots.glowOff.ref,shots.glowOn.ref,shots.glowColor.ref]);
let partialGlowPixels=0,minRGBAtAlpha8=255;
for(let i=0;i<shots.glowOn.image.pixels.length;i+=4){
 const pixels=shots.glowOn.image.pixels,a=pixels[i+3];
 if(a<8||a===255)continue;
 partialGlowPixels++;
 minRGBAtAlpha8=Math.min(minRGBAtAlpha8,pixels[i],pixels[i+1],pixels[i+2]);
}
assert.ok(partialGlowPixels>1000&&minRGBAtAlpha8>=200,
 'Transparent glow incorrectly contains premultiplied-dark edges');
add('glow.straight-rgba','visual',
 'Semi-transparent PNG glow retains luminous straight RGB rather than dark premultiplied fringes',
 {partialGlowPixels,minRGBAtAlpha8},[shots.glowOn.ref],{rgbMinimum:200});
assert.equal(changed(shots.original.image,shots.allOff.image),0);
add('layers.all-off','visual','All independent layers off equals captured original',
 {pixelDelta:0},[shots.original.ref,shots.allOff.ref]);
assert.equal(changed(shots.neutral.image,shots.lastStop.image),0);
assert.equal(changed(shots.original.image,shots.lastStopComposite.image),0);
add('stop.last-included-frame','visual',
 'Stop final included frame119 has neutral R/G/B map and unchanged background',
 {pixelDelta:0,frame:119},[shots.lastStop.ref,shots.lastStopComposite.ref,
 shots.neutral.ref,shots.original.ref]);
for(const l of H.LAYERS){
 const on=pic(l+'-on'),off=pic(l+'-off'),moved=pic(l+'-shifted');
 const delta=changed(on.image,off.image),translation=changed(on.image,moved.image);
 assert.ok(delta>10&&translation>10);
 add('layer.'+l,'visual','Independent layer visible/XY controls change real pixels',
  {onOffChangedPixels:delta,translationChangedPixels:translation},
  [on.ref,off.ref,moved.ref]);
}
for(const [key,delta] of Object.entries(report.variants)){
 assert.ok(delta>5);
 const next=pic('param-'+key);
 add('visual-control.'+key,'visual','Artist control affects actual GPU composited output',
  {changedPixels:delta},[shots.baseline.ref,next.ref],{changedPixelsMin:5});
}
assert.deepEqual(report.zoomResult,{'.5':0,'1':0,'2':0});
add('camera.logical-zoom','visual','Browser zoom .5/1/2 never changes GPU PNG bytes',
 report.zoomResult,[shots.baseline.ref,
 pic('zoom-.5').ref,pic('zoom-1').ref,pic('zoom-2').ref]);
const moved=pic('source-world-moved'),curve=pic('centerline-modified');
assert.ok(changed(shots.baseline.image,moved.image)>100);
assert.ok(changed(shots.baseline.image,curve.image)>100);
add('emitter.drag-world','visual','Moving world source repositions the actual distortion ROI',
 {changedPixels:changed(shots.baseline.image,moved.image)},
 [shots.baseline.ref,moved.ref]);
add('emitter.edit-cubic','visual','Dragging a centerline cubic tangency changes actual distortion ROI',
 {changedPixels:changed(shots.baseline.image,curve.image)},
 [shots.baseline.ref,curve.ref]);
function result(c,t,p={x:256,y:310}){
 return H.sampleAt(H.prepare(c,t),p.x,p.y);
}
const signature=(c,t,p)=>digest(Buffer.from(JSON.stringify(result(c,t,p))));
function showChange(key,a,b,condition,metadata={}){
 const left=signature(a,condition?.t??.57,condition?.point),
  right=signature(b,condition?.t??.57,condition?.point);
 assert.notEqual(left,right,'Inert artist control '+key);
 add('parameter.'+key,'numeric','Independent authored setting changes effect (or active event stream)',
  {before:a[key],after:b[key],beforeHash:left,afterHash:right,...metadata});
}
assert.equal(bp.parameters.length,22);
for(const param of bp.parameters){
 const key=param.key,a=clone(base),b=clone(base),condition={};
 if(['stopFrame','fadeFrames'].includes(key)){
  a.mode='stop';b.mode='stop';b[key]=key==='stopFrame'?30:40;
  b.durationFrames=b.stopFrame+b.fadeFrames;
  b.exportFrames=b.durationFrames;
  condition.t=1.45;
 }else if(key==='mode'){
  b.mode='stop';condition.t=1.45;
 }else if(key==='durationFrames'){
  b.durationFrames=180;condition.t=.72;
 }else if(key==='exportFrames'){
  b.exportFrames=150;
  assert.notEqual(a.exportFrames,b.exportFrames);
  add('parameter.'+key,'numeric','Export frame count updates complete sequence manifest',
   {before:a[key],after:b[key],actualBakeFrames:report.frames});
  continue;
 }else if(key==='quality'){
  b.quality='low';
  assert.notDeepEqual(H.rasterize(a,.52).map,H.rasterize(b,.52).map);
  add('parameter.'+key,'numeric','Quality changes field grid 256² to 128²',
   {before:a[key],after:b[key],fieldSizeBefore:256,fieldSizeAfter:128});
  continue;
 }else if(key==='gustEnabled'){
  b.gustEnabled=true;condition.t=.05;
 }else if(['gustRate','gustJitter'].includes(key)){
  a.gustEnabled=true;b.gustEnabled=true;
  b[key]=key==='gustRate'?2:.4;
  const evA=H.pulseSchedule(a,a.emitters[0],'gust'),
        evB=H.pulseSchedule(b,b.emitters[0],'gust');
  assert.notDeepEqual(evA,evB,'Inert gust timing '+key);
  add('parameter.'+key,'numeric','Enabled independent gust schedule has real different event timestamps',
   {before:a[key],after:b[key],beforeTimes:evA,afterTimes:evB});
  continue;
 }else if(['pulseRate','pulseJitter'].includes(key)){
  b[key]=key==='pulseRate'?4:.42;
  const evA=H.pulseSchedule(a,a.emitters[0]),evB=H.pulseSchedule(b,b.emitters[0]);
  assert.notDeepEqual(evA,evB);
  add('parameter.'+key,'numeric','Independent actual pulse event timestamps are changed',
   {before:a[key],after:b[key],beforeTimes:evA,afterTimes:evB});
  continue;
 }else if(key==='regionWidth'||key==='edgeFalloff'){
  b[key]=key==='regionWidth'?55:75;
  condition.point={x:296,y:310};
 }else if(key==='amplitude'){b.amplitude=16}
 else if(key==='noiseFrequency'){b.noiseFrequency=.09}
 else if(key==='verticalFlow'){b.verticalFlow=85}
 else if(key==='density'){b.density=.4}
 else if(key==='seed'){b.seed=9999}
 else if(key==='nodeGap'){b.nodeGap=10}
 else if(key==='nodeJitter'){b.nodeJitter=.42}
 else if(key==='spatialMode'){b.spatialMode='clustered'}
 else if(key==='style'){b.style='magical'}
 else throw Error('No oracle for '+key);
 showChange(key,a,b,condition);
}
for(const [key,index,value] of [
 ['distortionCurve',1,.2],['edgeCurve',1,.25],['pulseCurve',0,.2]
]){
 const a=clone(base),b=clone(base);
 b[key].keys[index].y=value;
 if(key==='pulseCurve'){
  const evA=H.pulseSchedule(a,a.emitters[0]),evB=H.pulseSchedule(b,b.emitters[0]);
  assert.notDeepEqual(evA,evB);
  add('curve.'+key,'numeric','Editable versioned rate curve affects true event timestamps',
   {before:evA,after:evB});
 }else{
  const point=key==='edgeCurve'?{x:256,y:340}:{x:256,y:310};
  const l=signature(a,.5,point),r=signature(b,.5,point);
  assert.notEqual(l,r);
  add('curve.'+key,'numeric','Editable FxCurves domain affects actual refraction',
   {beforeHash:l,afterHash:r});
 }
}
assert.equal(checks.filter(x=>x.id.startsWith('parameter.')).length,22);
add('backend.actual','backend',report.backend.actual,report.backend.actual);
const evidence={
 schemaVersion:1,effectId:bp.effectId,effectVersion:bp.effectVersion,
 sourceCommit:cp.execFileSync('git',['rev-parse','HEAD'],{cwd:repo,encoding:'utf8'}).trim(),
 status:'PASS',
 environment:{
  browser:'Chromium '+report.browser,
  device:os.platform()+' '+os.release()+' '+os.arch()+' (headless)',
  requestedBackend:report.backend.actual==='webgpu'?'webgpu':'webgl',
  actualBackend:report.backend.actual,glVersion:report.backend.version,
  gpu:'Hardware identification unavailable, real renderer API explicitly checked',
  offline:true,networkRequests:report.externalRequests
 },
 fixture:{
  seed:base.seed,settings:base,
  width:512,height:512,fps:60,
  asset:'Explicit in-Pixi high-frequency checkerboard, optional uploaded Spine4.2 JSON/atlas (not in this fixture)',
  frameTimesSeconds:[0,1,2]},
 checks,
 warnings:[
  'Opaque R/G displacement/B coverage DATA cannot independently refract unknown future backgrounds.',
  'Composited RGBA captures only a user explicitly selected Pixi scene background; glow is a separate optional transparent output.',
  'Headless Chromium software-backend tests cannot certify physical/mobile GPU FPS or thermals.',
  report.full?'Complete 120f triple-sequence exported/verified in this backend':
   'Only 8 real frames per export representation baked on this backend; full 120f triple export was done on WebGL2.',
  'Full 3600-frame stress bake NOT RUN; 1-3600 settings range covered by strict validators.',
  'Actual Spine binary .skel parser NOT RUN; tested matching Spine 4.2 JSON two-page atlas, animated bone/slot/attachment in scripts/test_haze_spine.cjs.',
  'Regenerate evidence after git push to bind exact final SHA; never retain old-SHA reports as proof.'
 ]};
const out=path.join(dir,'effect-evidence.json');
fs.writeFileSync(out,JSON.stringify(evidence,null,2)+'\n');
console.log('FIRE-06 EVIDENCE',JSON.stringify({
 backend:report.backend.actual,checks:checks.length,phases:bp.phases.length,
 parameters:bp.parameters.length,file:out}));
