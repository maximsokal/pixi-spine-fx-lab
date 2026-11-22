#!/usr/bin/env node
'use strict';
// WATER-03 FX-CORE-07 source-linked real GPU PNG + independent per-control oracle.
const A=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),
 crypto=require('node:crypto'),cp=require('node:child_process'),os=require('node:os');
const R=require('../assets/water-ripples/src/ripples-core.js');
const {decodePng,countAlpha,comparePixels}=require('./fx_visual_png.cjs');
if(!process.argv[2])throw Error('Usage: node scripts/test_ripples_evidence.cjs OUT_DIR');
const dir=path.resolve(process.argv[2]),repo=path.resolve(__dirname,'..'),
 report=JSON.parse(fs.readFileSync(path.join(dir,'report.json'),'utf8'));
const doc=fs.readFileSync(path.join(repo,'references/fx/water/water-ripples.md'),'utf8'),
 match=doc.match(/```json\s*([\s\S]*?)\s*```/);
A.ok(match,'WATER-03 versioned blueprint missing');
const bp=JSON.parse(match[1]),defaults=R.defaults();
A.equal(bp.effectId,'fx.water.water-ripples');
A.equal(report.status,'PASS');
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
const clone=x=>JSON.parse(JSON.stringify(x));
const checks=[];
const add=(id,kind,expected,actual,evidence=[],tolerance={})=>
 checks.push({id,kind,status:'PASS',expected,actual,evidence,tolerance});
const image=name=>{
 const bytes=fs.readFileSync(path.join(dir,name+'.png'));
 const im=decodePng(bytes);A.equal(im.width,512);A.equal(im.height,512);
 return {image:im,ref:{path:name+'.png',sha256:hash(bytes)}};
};
const changed=(a,b)=>comparePixels(a.image,b.image,{step:1,channelTolerance:0}).changedPixels;
const visible=x=>{const n=countAlpha(x.image);return n.partial+n.opaque};
const start=image('frame00'),middle=image('frame19half'),end=image('frame39'),
 fade=image('frame38'),baseline=image('baseline'),disabled=image('disabled'),
 cycle0=image('cycle0'),cycle40=image('cycle40');
A.deepEqual(bp.phases.map(x=>x.id),['start','expansion','transparent']);
for(const [id,at,photo] of [
 ['start',0,start],['expansion',.5,middle],['transparent',1,end]]){
 const p=bp.phases.find(x=>x.id===id);
 const n=visible(photo);
 if(id==='transparent')A.equal(n,0);
 else A.ok(n>40,'Real ring pixels missing at phase '+id);
 add('phase.'+id,'visual',p.look,
  {normalizedPhase:at,frame:id==='transparent'?39:at*39,
   visiblePixels:n},[photo.ref],{pixelCountMin:0});
}
A.ok(visible(fade)>50);
add('one-shot.last-two','visual','Frame38 fading nonzero; frame39 exactly transparent',
 {frame38Visible:visible(fade),frame39Visible:visible(end)},
 [fade.ref,end.ref]);
A.equal(changed(start,image('return0')),0);
A.equal(changed(cycle0,cycle40),0);
A.ok(changed(start,cycle0)>10);
add('periodic-carry','visual',
 'Cyclic period40 preserves previous emitted ring groups with exact 0↔40/60 raster state',
 {loopEndpointPixelDelta:0,oneShotVersusLoopDelta:changed(start,cycle0)},
 [start.ref,cycle0.ref,cycle40.ref]);
A.equal(visible(disabled),0);
add('layers.all-disabled','visual','All three independent layers off yields fully transparent scene',
 {visiblePixels:0},[disabled.ref]);
for(const [kind,label] of [
 ['highlight-enable','highlights.enable'],
 ['layer-primary-x','layer.primary.x'],
 ['world-anchor-x','emitter.world.x'],
 ['layer-own-anchor','layer.primary.independent-world-anchor']]){
 const test=image('variant-'+kind),delta=changed(baseline,test);
 A.equal(delta,report.variants[kind]);A.ok(delta>8);
 add(label,'visual','User operation produces different real Pixi PNG pixels',
  {changedPixels:delta},[baseline.ref,test.ref],{changedPixelsMin:8});
}
const mapping={
 rings:'rings',startRadius:'startRadius',finalRadius:'finalRadius',
 ringDelayFrames:'ringDelayFrames',radialGapPx:'radialGapPx',
 thickness:'thickness',ellipticity:'ellipticity',
 highlightArcGapPx:'highlightArcGapPx',highlightJitter:'highlightJitter',
 highlightDistribution:'highlightDistribution',
 seed:'seed',style:'style'};
const covered=new Set();
for(const param of bp.parameters){
 const key=param.key;
 A.ok(!covered.has(key),'Duplicate parameter '+key);covered.add(key);
 if(key==='exportFrames'){
  A.equal(defaults.exportFrames,40);A.equal(report.frames,8);
  add('parameter.'+key,'numeric',
   'Default40, user editable full export count; sampled browser ZIP8, full40 independently decoded',
   {default:40,actualSampledBake:8,full40VerifiedBy:'test_ripples_png_zip.cjs'});
 }else if(key==='quality'){
  const normal=clone(defaults);
  normal.rings=12;normal.ringDelayFrames=0;
  normal.emitters.push(R.newEmitter(1),R.newEmitter(2));
  normal.quality='balanced';A.doesNotThrow(()=>R.sample(normal,.2));
  normal.quality='low';A.throws(()=>R.sample(normal,.2),/budget/i);
  add('parameter.quality','numeric',
   'Low rejects real 36-ring 3-emitter vertex overload while Balanced accepts',
   {balanced:'PASS',low:'explicit budget rejection'});
 }else if(key==='loop'){
  const a=R.sample(defaults,0),settings=clone(defaults);
  settings.loop=true;
  const b=R.sample(settings,0);
  A.notDeepEqual(a,b);
  A.deepEqual(b,R.sample(settings,40/60));
  add('parameter.loop','visual','One-shot vs cyclic prior-period ring carry differ',
   {changedPixels:changed(start,cycle0),periodicNumeric:true},
   [start.ref,cycle0.ref],{changedPixelsMin:8});
 }else{
  A.ok(mapping[key],'No evidence oracle for WATER-03 parameter '+key);
  const caseFile=image('variant-'+mapping[key]);
  const comparison=key==='highlightArcGapPx'||key==='highlightJitter'||
   key==='highlightDistribution'||key==='seed'?
    image('highlights-on'):baseline;
  const delta=changed(comparison,caseFile);
  A.equal(delta,report.variants[key]);A.ok(delta>8);
  add('parameter.'+key,'visual',
   'Actual shared numerical source+mesh raster changes after artist control',
   {value:defaults[key],changedPixels:delta},
   [comparison.ref,caseFile.ref],{changedPixelsMin:8});
 }
}
A.equal(covered.size,bp.parameters.length);
A.equal(covered.size,15);
for(const key of ['radiusCurve','thicknessCurve','ringAlphaCurve','ringDelayCurve']){
 const photo=image('variant-'+key),delta=changed(baseline,photo);
 A.ok(delta>8);
 const before=R.schedule(defaults,defaults.emitters[0]);
 const settings=clone(defaults);
 settings[key].keys[1].y=key==='radiusCurve'?.4:
  key==='thicknessCurve'?.75:key==='ringAlphaCurve'?.15:.5;
 const after=R.schedule(settings,settings.emitters[0]);
 if(key==='ringDelayCurve')A.notDeepEqual(before,after,
  'Delay curve must alter actual event timestamps');
 else A.deepEqual(before,after,
  'Radius/thickness/alpha must not corrupt original event timing');
 add('curve.'+key,'visual',
  'Independent editor curve changes GPU geometry or color while obeying scheduling contract',
  {changedPixels:delta,birthScheduleChanged:key==='ringDelayCurve'},
  [baseline.ref,photo.ref]);
}
for(const [type,settings] of [['zoom',report.zoom],['background',report.backgrounds]]){
 for(const [key,delta] of Object.entries(settings)){
  A.equal(delta,0);
  const photo=image(type+'-'+key);
  A.equal(changed(baseline,photo),0);
  add('camera.'+type+'.'+key,'visual',
   'Camera zoom and CSS background do not enter 512px transparent PNG',
   {pixelDelta:0},[baseline.ref,photo.ref],{pixelDeltaMax:0});
 }
}
const preset=JSON.parse(fs.readFileSync(path.join(dir,'Water_Ripples_Preset.json'),'utf8'));
A.equal(preset.effectId,bp.effectId);A.deepEqual(preset.settings,defaults);
A.ok(report.presetRoundtrip&&report.invalidPresetRejected);
add('preset.strict','numeric','Canonical JSON roundtrip and unknown-version rejection',
 {roundtrip:true,unknownVersionRejected:true});
const gradient=middle.image.pixels;
let partial=0,minimum=[255,255,255],maximum=[0,0,0];
for(let i=0;i<gradient.length;i+=4){
 const alpha=gradient[i+3];
 if(alpha<48||alpha>=255)continue;
 partial++;
 for(let c=0;c<3;c++){
  minimum[c]=Math.min(minimum[c],gradient[i+c]);
  maximum[c]=Math.max(maximum[c],gradient[i+c]);
 }
}
A.ok(partial>=100&&minimum[0]>=100&&minimum[1]>=165&&minimum[2]>=180);
A.ok(minimum[0]<255&&minimum[1]<255,'WebGPU RGB converted incorrectly to white');
add('png.straight-alpha','visual',
 'Actual semitransparent water palette survives WebGL and WebGPU readback without double-unpremultiplication',
 {partialPixels:partial,minimum,maximum},
 [middle.ref],{rgb8:2});
const scheduled=R.schedule(defaults,defaults.emitters[0]);
A.deepEqual(scheduled.map(x=>x.index),[0,1,2]);
for(const [i,frame] of [0,7,14].entries())
 A.ok(Math.abs(scheduled[i].time-frame/60)<1e-6);
add('timing.births','numeric','First three ripple births exactly 0,7/60,14/60 seconds',
 {births:scheduled.map(x=>x.time)});
const split=clone(defaults);split.radialGapPx=33;
A.deepEqual(R.schedule(split,split.emitters[0]),scheduled);
split.radialGapPx=20;split.ringDelayFrames=10;
A.notDeepEqual(R.schedule(split,split.emitters[0]),scheduled);
add('spacing.independent','numeric',
 'Radial ring gap changes radii only; ring delay changes birth timestamps only',
 {gapAffectsSchedule:false,delayAffectsSchedule:true});
const bounds=R.bounds(R.sample(defaults,20/60),defaults);
A.ok(bounds.inside);
add('crop.default','numeric','Default 3 rings fit inside logical 512x512',
 bounds);
A.deepEqual(report.errors,[]);A.deepEqual(report.external,[]);
add('backend.actual','backend',report.backend.actual,report.backend.actual);
const evidence={schemaVersion:1,effectId:bp.effectId,effectVersion:bp.effectVersion,
 sourceCommit:cp.execFileSync('git',['rev-parse','HEAD'],
  {cwd:repo,encoding:'utf8'}).trim(),
 status:'PASS',
 environment:{browser:'Chromium '+report.browser,
  device:os.platform()+' '+os.release()+' '+os.arch()+' (headless)',
  requestedBackend:report.backend.actual==='webgpu'?'webgpu':'webgl',
  actualBackend:report.backend.actual,
  glVersion:report.backend.version,
  gpu:'Software/headless Chrome GPU adapter; physical mobile GPU unavailable',
  offline:true,networkRequests:report.external.length},
 fixture:{seed:defaults.seed,settings:defaults,width:512,height:512,fps:60,
  asset:'Spine 4.2.43 two-page JSON atlas & animated attachments tested separately',
  frameTimesSeconds:[0,19.5/60,39/60]},
 checks,warnings:[
  'Actual rendered WebGL1/2/WebGPU are Chromium headless, NOT physical phone GPU/thermal/FPS certification.',
  'Full 40-frame CRC PNG ZIP performed only on WebGL2; each backend separately has sampled PNG and real 3-phase raster proof.',
  'Real Spine4.2.43 JSON multipage/animation/bone/slot/attachment tested. Matching binary .skel fixture NOT RUN.',
  'Max export length3600 is schema permitted but long stress ZIP NOT RUN.',
  'Stylized 2D surface ripples: no CFD, arbitrary mesh collision or world-history detach from moving Spine anchors.',
  'Publish full 40-digit commit SHA, then regenerate evidence from the published commit before closing #19.'
 ]};
fs.writeFileSync(path.join(dir,'effect-evidence.json'),JSON.stringify(evidence,null,2)+'\n');
console.log('WATER-03 FX-CORE-07',JSON.stringify({backend:report.backend.actual,
 checks:checks.length,phases:bp.phases.length,parameters:covered.size,
 sourceCommit:evidence.sourceCommit}));
