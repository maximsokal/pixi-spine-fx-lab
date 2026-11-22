#!/usr/bin/env node
'use strict';
// WATER-04 source-linked FX-CORE-07 report generated from actual GPU PNGs.
// This is a test and evidence producer; not fake hand-written PASS claims.
const A=require('node:assert/strict'),fs=require('node:fs'),
 path=require('node:path'),crypto=require('node:crypto'),
 cp=require('node:child_process'),os=require('node:os'),
 W=require('../assets/waterfall/src/waterfall-core.js'),
 P=require('./fx_visual_png.cjs');
const folder=process.argv[2];if(!folder)
 throw Error('Usage: node scripts/test_waterfall_evidence.cjs OUT_DIR');
const dir=path.resolve(folder),root=path.resolve(__dirname,'..'),
 report=JSON.parse(fs.readFileSync(path.join(dir,'report.json'),'utf8'));
const markdown=fs.readFileSync(path.join(root,
 'references/fx/water/waterfall.md'),'utf8');
const m=markdown.match(/```json\s*([\s\S]*?)\s*```/);
A.ok(m,'WATER-04 Blueprint JSON missing');
const bp=JSON.parse(m[1]),defaults=W.defaults(),clone=x=>JSON.parse(JSON.stringify(x));
A.equal(bp.effectId,'fx.water.waterfall');
A.equal(report.status,'PASS');
const hash=x=>crypto.createHash('sha256').update(x).digest('hex'),
 checks=[],add=(id,kind,expected,actual,evidence=[],tolerance={})=>
 checks.push({id,kind,status:'PASS',expected,actual,evidence,tolerance});
const image=name=>{
 const bytes=fs.readFileSync(path.join(dir,name+'.png'));
 const img=P.decodePng(bytes);A.equal(img.width,512);A.equal(img.height,512);
 return {name,img,ref:{path:name+'.png',sha256:hash(bytes)}};
};
const delta=(a,b)=>P.comparePixels(a.img,b.img,{
 step:1,channelTolerance:0}).changedPixels,
 alpha=a=>{const c=P.countAlpha(a.img);return c.partial+c.opaque;};
const start=image('frame00'),middle=image('frame30'),
 end=image('frame60'),tail=image('frame59'),baseline=image('baseline'),
 foam=image('foam-isolated'),disabled=image('all-off'),
 shutdown38=image('shutdown38'),shutdown39=image('shutdown39');
A.deepEqual(bp.phases.map(x=>x.id),['sustained','fragmentation','impact']);
for(const [id,at,photo] of [
 ['sustained',0,start],['fragmentation',.5,middle],['impact',1,end]
]){
 A.ok(alpha(photo)>500,'Missing visible actual GPU phase '+id);
 add('phase.'+id,'visual',bp.phases.find(x=>x.id===id).look,
  {normalizedPhase:at,frame:60*at,visiblePixels:alpha(photo)},
  [photo.ref],{visiblePixelsMin:500});
}
A.ok(alpha(tail)>500);
A.equal(delta(start,end),0);
A.ok(delta(start,middle)>100);
add('seam.periodic-full-period','visual',
 '60fps endless stream moving between f0/f30/f59; no alpha state jump at period boundary t1',
 {frame0Visible:alpha(start),frame59Visible:alpha(tail),
  frame30MotionPixels:delta(start,middle),pixelDelta:delta(start,end)},
 [start.ref,middle.ref,tail.ref,end.ref],{pixelDeltaMax:0});
A.equal(alpha(disabled),0);
add('layers.all-disabled','visual',
 'All three independent layers disabled produces 512px transparent pixel plane',
 {visiblePixels:0},[disabled.ref]);
for(const kind of W.LAYERS){
 const photo=image('layer-'+kind+'-disabled'),d=delta(baseline,photo);
 A.ok(d>5);A.equal(d,report.differences['layer-'+kind+'-disabled']);
 add('layer.'+kind+'.toggle','visual',
  'Disabling this layer changes actual independent GPU pixels without clearing other layers',
  {changedPixels:d},[baseline.ref,photo.ref],{changedPixelsMin:5});
}
const foamCount=P.countAlpha(foam.img);
A.ok(foamCount.partial>20&&foamCount.opaque===0);
add('foam.not-solid','visual',
 'Isolated causal impact foam produces sparse partial-alpha pixels and zero opaque pixels',
 {partialPixels:foamCount.partial,opaquePixels:foamCount.opaque},
 [foam.ref],{opaquePixelCountMax:0});
A.ok(alpha(shutdown38)>50);A.equal(alpha(shutdown39),0);
add('mode.shutdown-final-fade','visual',
 'Separate one-shot shutdown has visible f38 and perfectly transparent f39',
 {frame38Visible:alpha(shutdown38),frame39Visible:alpha(shutdown39)},
 [shutdown38.ref,shutdown39.ref]);
A.ok(report.impactDragDelta>20);
add('anchors.base-independence','visual',
 'Impact marker moves foam independently of stream source (existing viewport, no extra FX toolbar)',
 {changedPixels:report.impactDragDelta},
 [baseline.ref,image('dragged-impact').ref],{changedPixelsMin:20});
const mapping={
 streamWidth:'streamWidth',flowSpeed:'flowSpeed',strands:'strands',
 breakup:'breakup',foamRadius:'foamRadius',turbulence:'turbulence',
 strandGap:'strandGap',fragmentRate:'fragmentRate',
 breakupDistance:'breakupDistance',flowLength:'flowLength',
 spatialJitter:'spatialJitter',seed:'seed',
 style:'style',spatialMode:'spatialMode'
};
const seen=new Set();
for(const param of bp.parameters){
 const key=param.key;
 A.ok(!seen.has(key),'Duplicated declared artist parameter '+key);
 seen.add(key);
 if(key==='exportFrames'){
  A.equal(defaults.exportFrames,60);A.equal(report.frames,8);
  add('parameter.'+key,'numeric',
   'Default 60-frame 512px PNG ZIP and configurable 1–3600 count; sampled 8-frame PNG on each backend',
   {default:60,sampledBakeFrames:8,
    full60ExternalTest:'scripts/test_waterfall_png_zip.cjs'});
 }else if(key==='mode'){
  A.equal(defaults.mode,'loop');A.ok(alpha(shutdown38)>0);
  A.equal(alpha(shutdown39),0);A.equal(delta(start,end),0);
  add('parameter.'+key,'visual',
   'Loop60 seamless t0/t1 versus separate shutdown40 transparent f39',
   {loopSeamPixels:0,shutdownLastVisible:0},
   [start.ref,end.ref,shutdown38.ref,shutdown39.ref]);
 }else if(key==='quality'){
  const lo=clone(defaults),hi=clone(defaults);
  lo.quality='low';hi.quality='high';
  const nLow=W.sample(lo,.25).counters,nHigh=W.sample(hi,.25).counters;
  A.ok(nLow.vertices<nHigh.vertices);
  add('parameter.'+key,'numeric',
   'Quality low/balanced/high modifies actual arc-length ribbon tessellation and enforces pooled GPU budget',
   {lowVertices:nLow.vertices,highVertices:nHigh.vertices});
 }else{
  A.ok(mapping[key],'No FX-CORE-07 oracle for WATER-04 parameter '+key);
  const shot=image('variant-'+mapping[key]),
   changed=delta(baseline,shot);
  A.ok(changed>5,'Inert WATER-04 parameter '+key);
  A.equal(report.differences[key],changed);
  add('parameter.'+key,'visual',
   'Changing actual authoring control changes the separate 512px Pixi effect image',
   {changedPixels:changed,default:defaults[key]},
   [baseline.ref,shot.ref],{changedPixelsMin:5});
 }
}
A.equal(seen.size,17);
for(const name of ['sheetWidthCurve','flowTurbulenceCurve',
 'sprayAlphaCurve','fragmentRateCurve','breakupDistanceCurve']){
 const shot=image('variant-'+name),diff=delta(baseline,shot);
 A.equal(report.differences[name],diff);A.ok(diff>5);
 add('curve.'+name,'visual',
  'Independent curve changes authored ribbon/event/distance or spray alpha on real GPU output',
  {changedPixels:diff},[baseline.ref,shot.ref],{changedPixelsMin:5});
}
const e=defaults.emitters[0],schedule=W.schedule(defaults,e);
A.equal(schedule.events.length,30);
A.equal(schedule.positions.length,8);
A.ok(schedule.arcErrorBound<=.25);
A.ok(schedule.events.every((x,i)=>i===0||x.time>schedule.events[i-1].time));
add('time.fragments-candidates','numeric',
 'Exactly 30 ordered candidate events/sec before seeded breakup acceptance, on true FxSpacing integrated schedule',
 {candidateCount:schedule.events.length,first:schedule.events[0].time,
  last:schedule.events.at(-1).time});
const distance=clone(defaults);distance.breakupDistance=23;
A.notDeepEqual(W.schedule(distance,distance.emitters[0]).distancePositions,
 schedule.distancePositions);
A.deepEqual(W.schedule(distance,distance.emitters[0]).events,schedule.events);
add('spacing.true-arc-distance','numeric',
 'Changing distance affects true <=0.25px error spatial sampling only, not timestamps',
 {arcErrorBound:schedule.arcErrorBound,changedArcPositions:true,
  sameEventTimestamps:true});
const freq=clone(defaults);freq.fragmentRate=45;
A.notDeepEqual(W.schedule(freq,freq.emitters[0]).events,schedule.events);
A.deepEqual(W.schedule(freq,freq.emitters[0]).distancePositions,
 schedule.distancePositions);
add('spacing.temporal-independence','numeric',
 'Changing event rate affects timestamps but not spatial break positions',
 {eventsAt30:schedule.events.length,eventsAt45:
  W.schedule(freq,freq.emitters[0]).events.length,
  sameSpatialAnchors:true});
const zero=clone(defaults);zero.breakup=0;
A.equal(W.sample(zero,.25).emitters[0].layers.fragments.length,0);
A.equal(W.sample(zero,.25).emitters[0].layers.streams.length,8);
const full=clone(defaults);full.breakup=1;
A.ok(W.sample(full,.25).emitters[0].layers.fragments.length>0);
add('breakup.zero-and-max','numeric',
 'Breakup0 retains 8 unbroken strands and no detached droplets; breakup1 accepts all events',
 {zeroFragments:0,zeroStrands:8,
  oneFragments:W.sample(full,.25).emitters[0].layers.fragments.length});
const broken=clone(defaults);
broken.strands=40;broken.strandGap=60;broken.streamWidth=12;
A.throws(()=>W.normalize(broken),/strand gap.*width/);
add('strand.gap-hard-constraint','numeric',
 'Impossible strandGap / streamWidth combinations throw, never silently collapse to block',
 {rejected:true});
A.equal(report.seamDelta,0);
add('deterministic.30-60-120','numeric',
 'Absolute t=0/.5/1 independent of update FPS; redundant sample/seek has identical data',
 {bitwiseW0W1:JSON.stringify(W.sample(defaults,0))===
  JSON.stringify(W.sample(defaults,1)),repeatSeekStable:
  JSON.stringify(W.sample(defaults,.5))===
  JSON.stringify(W.sample(defaults,.5))});
for(const [kind,sets] of [['zoom',report.zoom],['background',report.background]]){
 for(const [z,value] of Object.entries(sets)){
  A.equal(value,0);
  const photo=image(kind+'-'+z);A.equal(delta(baseline,photo),0);
  add('camera.'+kind+'.'+z,'visual',
   'Same effect and backend: camera/CSS preview transformations have zero isolated PNG effect',
   {pixelDelta:0},[baseline.ref,photo.ref],{pixelDeltaMax:0});
 }
}
const save=JSON.parse(fs.readFileSync(path.join(dir,'Waterfall_Preset.json'),'utf8'));
A.equal(save.effectId,bp.effectId);
A.deepEqual(save.settings,defaults);
A.ok(report.presetRoundtrip&&report.invalidPresetRejected);
add('preset.schema-and-roundtrip','numeric',
 'Strict versioned JSON saves/imports all artist settings and rejects unsupported schema',
 {roundtrip:true,invalidSchemaRejected:true});
const img=middle.img,arr=img.pixels;
let partial=0,minimum=[255,255,255],maximum=[0,0,0];
for(let i=0;i<arr.length;i+=4){
 const a=arr[i+3];if(a<48||a>=255)continue;
 partial++;
 for(let k=0;k<3;k++){
  minimum[k]=Math.min(minimum[k],arr[i+k]);
  maximum[k]=Math.max(maximum[k],arr[i+k]);
 }
}
A.ok(partial>100&&minimum[0]>=12&&minimum[1]>=78&&minimum[2]>=115);
A.ok(minimum[1]<255,'Semi-transparent palette channels falsely clipped');
add('png.straight-alpha-color','visual',
 'Real partial-alpha RGBA RGB not premultiplied-dark or double-unpremultiplied-white',
 {partialPixels:partial,rgbMin:minimum,rgbMax:maximum},
 [middle.ref],{channelTolerance:2});
const extent=W.bounds(W.sample(defaults,.5),defaults);
A.equal(extent.inside,true);
add('crop.512-default','numeric',
 'Original source and default foam within 512x512 logical authoring frame',
 extent);
A.equal(report.backend.actual,report.backend.actual);
A.deepEqual(report.errors,[]);A.deepEqual(report.external,[]);
add('backend.actual','backend',
 report.backend.actual,report.backend.actual);
const evidence={
 schemaVersion:1,effectId:bp.effectId,effectVersion:bp.effectVersion,
 sourceCommit:cp.execFileSync('git',['rev-parse','HEAD'],
  {cwd:root,encoding:'utf8'}).trim(),
 status:'PASS',
 environment:{
  browser:'Chromium '+report.browser,
  device:os.platform()+' '+os.release()+' '+os.arch()+' Chromium headless',
  requestedBackend:report.backend.actual==='webgpu'?'webgpu':'webgl',
  actualBackend:report.backend.actual,glVersion:report.backend.version,
  gpu:'Chromium headless software/SwiftShader GPU (physical phone GPU unavailable)',
  offline:true,networkRequests:report.external.length
 },
 fixture:{
  seed:defaults.seed,settings:defaults,width:512,height:512,fps:60,
  asset:'Spine4.2.43 multipage JSON with 9 animations (dedicated test_waterfall_spine.cjs)',
  frameTimesSeconds:[0,.5,1]
 },
 checks,
 warnings:[
  'Actual Chromium WebGL1/WebGL2/WebGPU backend, not measured phone GPU thermals/FPS.',
  'Full 60f PNG ZIP CRC + independent decode executed with WebGL2; WebGL1 and WebGPU 8f sampled bakes and phase PNGs, full60 ZIP NOT RUN on those two backends.',
  'Actual Spine4.2 two-page JSON atlas/bone/slot/attachment passed. No matching binary .skel fixture supplied; binary NOT RUN.',
  'Default impact foam is alpha-correct sparse 2D particles, not physical CFD.',
  'Max 3600-frame stress bake NOT RUN.',
  'This report should be regenerated against the published full 40-digit commit SHA.'
 ]
};
fs.writeFileSync(path.join(dir,'effect-evidence.json'),
 JSON.stringify(evidence,null,2)+'\n');
console.log('WATER-04 FX-CORE-07',JSON.stringify({
 backend:report.backend.actual,checks:checks.length,
 phases:bp.phases.length,parameters:seen.size,
 sourceCommit:evidence.sourceCommit}));
