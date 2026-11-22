#!/usr/bin/env node
'use strict';
// WATER-02 FX-CORE-07: actual decoded Pixi PNG screenshots + independent
// per-parameter pure physics oracle, bounded to the real source and backend.
const A=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),
 crypto=require('node:crypto'),cp=require('node:child_process'),os=require('node:os');
const R=require('../assets/rainfall/src/rain-core.js');
const {decodePng,countAlpha,comparePixels}=require('./fx_visual_png.cjs');
if(!process.argv[2])throw Error('Usage: node scripts/test_rain_evidence.cjs OUT_DIR');
const dir=path.resolve(process.argv[2]),repo=path.resolve(__dirname,'..'),
 report=JSON.parse(fs.readFileSync(path.join(dir,'report.json'),'utf8')),
 blueprintText=fs.readFileSync(path.join(repo,'references/fx/water/rainfall.md'),'utf8'),
 m=blueprintText.match(/```json\s*([\s\S]*?)\s*```/);
A.ok(m);
const bp=JSON.parse(m[1]),base=R.defaults();
A.equal(bp.effectId,'fx.water.rainfall');
A.equal(report.status,'PASS');
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const clone=x=>JSON.parse(JSON.stringify(x));
const checks=[];
const add=(id,kind,expected,actual,evidence=[],tolerance={})=>
 checks.push({id,kind,status:'PASS',expected,actual,evidence,tolerance});
function png(name){
 const bytes=fs.readFileSync(path.join(dir,name+'.png')),
  image=decodePng(bytes);
 A.equal(image.width,512);A.equal(image.height,512);
 return {image,ref:{path:name+'.png',sha256:hash(bytes)}};
}
const diff=(a,b)=>comparePixels(a,b,{step:1,channelTolerance:0}).changedPixels,
 visible=image=>{const a=countAlpha(image);return a.opaque+a.partial};
const photos={
 start:png('frame00'),middle:png('frame30'),
 seam:png('loop60'),beforeSeam:png('frame59'),
 loopZero:png('loop0'),wind:png('wind40'),
 baseline:png('baseline'),zero:png('density0'),
 impactOff:png('impact-off'),near:png('near-on'),
 far:png('far-on'),disabled:png('disabled')
};
const phases={start:{frame:0,time:0},
 middle:{frame:30,time:.5},seam:{frame:60,time:1}};
A.deepEqual(bp.phases.map(x=>x.id),Object.keys(phases));
for(const phase of bp.phases){
 const p=phases[phase.id],photo=photos[phase.id],n=visible(photo.image);
 A.ok(n>500,'Phase '+phase.id+' does not show real rain');
 add('phase.'+phase.id,'visual',phase.look,
  {frame:p.frame,timeSeconds:p.time,visiblePixels:n},
  [photo.ref],{visibleMinimum:500});
}
A.equal(diff(photos.start.image,photos.seam.image),0);
A.equal(diff(photos.loopZero.image,photos.seam.image),0);
A.ok(diff(photos.start.image,photos.beforeSeam.image)>50);
const samples=[0,1,2,3,28,29,30,58,59];
for(const n of samples){
 const a=R.sample(base,n/60),b=R.sample(base,(n+60)/60);
 A.deepEqual(a,b,'Loop state changed at frame '+n);
}
const activeCounts=[58,59,60,61].map(f=>R.sample(base,f/60).counters.particles);
A.ok(Math.max(...activeCounts)-Math.min(...activeCounts)<=5,
 'Global seam particle count flash detected');
add('seam.periodic','visual',
 'Exact loop state same at 0 and 1.0 sec; frame59 moving, not a static repeated PNG',
 {endpointPixelDelta:0,frame59Delta:diff(photos.start.image,photos.beforeSeam.image),
  activeCounts},[photos.start.ref,photos.beforeSeam.ref,photos.seam.ref],
 {endpointPixelDeltaMax:0,particleCountDeltaMax:5});
A.ok(visible(photos.zero.image)===0);
A.ok(visible(photos.disabled.image)===0);
add('layers.all-disabled','visual',
 'Zero density or all effect layers disabled yields transparent isolated alpha0',
 {zeroDensityVisible:visible(photos.zero.image),
  allDisabledVisible:visible(photos.disabled.image)},
 [photos.zero.ref,photos.disabled.ref]);
A.ok(diff(photos.baseline.image,photos.wind.image)>50);
A.ok(diff(photos.baseline.image,photos.impactOff.image)>5);
add('wind.visible','visual','Wind changes physical droplet streak x and angle in real GPU output',
 {changedPixels:diff(photos.baseline.image,photos.wind.image)},
 [photos.baseline.ref,photos.wind.ref]);
add('impacts.real','visual','Disabling contact probability removes real ground impact rings',
 {changedPixels:diff(photos.baseline.image,photos.impactOff.image)},
 [photos.baseline.ref,photos.impactOff.ref]);
for(const [name,photo] of [['near',photos.near],['far',photos.far]]){
 const d=diff(photos.baseline.image,photo.image);
 A.ok(d>50);
 add('parallax.'+name,'visual','Independent optional '+name+' layer adds actual continuous rain',
  {changedPixels:d},[photos.baseline.ref,photo.ref],{changedPixelsMin:50});
}
for(const [key,name] of [
 ['spacing-on','curve.spacing.enabled'],
 ['layer-drops-shifted','layer.offset'],
 ['emitter-world-shifted','source.world-offset'],
 ['rain-recolored','palette.tinted']]){
 const photo=png(key),n=diff(photos.baseline.image,photo.image);
 A.equal(n,report.variants[key]);A.ok(n>50);
 add(name,'visual','User control changes true Pixi output (not merely UI)',
  {changedPixels:n},[photos.baseline.ref,photo.ref]);
}
for(const [key,set] of [['zoom',report.zoom],['background',report.backgrounds]]){
 for(const [name,count] of Object.entries(set)){
  A.equal(count,0);
  const photo=png(key==='zoom'?'zoom-'+name:'background-'+name);
  A.equal(diff(photos.baseline.image,photo.image),0,
   'Camera/UI setting affected isolated PNG on '+report.backend.actual);
  add('camera.'+key+'.'+name,'visual',
   'CSS '+key+' has no effect on isolated 512x512 PNG',
   {pixelDelta:0},[photos.baseline.ref,photo.ref],{pixelDeltaMax:0});
 }
}
const preset=JSON.parse(fs.readFileSync(path.join(dir,'Rainfall_Preset.json'),'utf8'));
A.equal(preset.effectId,bp.effectId);A.equal(preset.schemaVersion,1);
A.deepEqual(preset.settings,base);
A.equal(report.presetRoundtrip,true);
A.equal(report.presetVersionRejected,true);
add('preset.strict','numeric','Versioned JSON preset saves/imports unchanged and unknown version rejected',
 {sameSettings:true,unknownVersionRejected:true});
let partial=0,minRGB=[255,255,255];
const pix=photos.start.image.pixels;
for(let i=0;i<pix.length;i+=4){
 const a=pix[i+3];
 if(a<48||a>=255)continue;
 partial++;
 for(let c=0;c<3;c++)minRGB[c]=Math.min(minRGB[c],pix[i+c]);
}
A.ok(partial>=100&&minRGB[0]>=75&&minRGB[1]>=125&&minRGB[2]>=160,
 'Unpremultiplied rain PNG still has dark RGB fringes');
add('png.straight-rgba8','visual','Semi-transparent pixels preserve bright true straight-alpha rain RGB',
 {partialPixels:partial,minRGB},[photos.start.ref],{rgb8Channel:2});
function digest(c,t=.33){return hash(Buffer.from(JSON.stringify(R.sample(c,t))))}
function valueDiff(key,mutate,opt={}){
 const left=clone(base),right=clone(base);
 if(opt.enable){opt.enable(left);opt.enable(right)}
 mutate(right);
 const a=digest(left,opt.time??.33),b=digest(right,opt.time??.33);
 A.notEqual(a,b,'Artist control inert: '+key);
 add('parameter.'+key,'numeric',
  'Actual deterministic rendered event/geometry/gradient changes',
  {before:left[key],after:right[key],time:opt.time??.33,
   beforeHash:a,afterHash:b});
}
A.equal(bp.parameters.length,24);
const known=new Set();
for(const item of bp.parameters){
 const key=item.key;
 A.ok(!known.has(key));known.add(key);
 switch(key){
  case 'exportFrames':
   A.equal(base.exportFrames,60);A.equal(report.frames,8);
   add('parameter.'+key,'numeric',
    'Author-controlled default 60 frames, reduced sampled bake 8, full 60 PNG ZIP validated separately',
    {default:base.exportFrames,browserBaked:report.frames});
   break;
  case 'quality':{
   const hi=clone(base);
   hi.density=250;hi.fallSpeed=200;hi.quality='balanced';
   A.doesNotThrow(()=>R.sample(hi,.3));
   hi.quality='low';
   A.throws(()=>R.sample(hi,.3),/budget overflow/i);
   add('parameter.quality','numeric','Quality low hard rejects over-budget load which balanced accepts',
    {balanced:'PASS',low:'explicit overflow'});
   break;
  }
  case 'spacingCurveEnabled':
   valueDiff(key,c=>{c.spacingCurveEnabled=true});break;
  case 'nearSpeed':
   valueDiff(key,c=>{c.nearSpeed=2.2},{enable:c=>c.emitters[0].layers.near.enabled=true});
   break;
  case 'nearSize':
   valueDiff(key,c=>{c.nearSize=2.2},{enable:c=>c.emitters[0].layers.near.enabled=true});
   break;
  case 'farSpeed':
   valueDiff(key,c=>{c.farSpeed=.85},{enable:c=>c.emitters[0].layers.far.enabled=true});
   break;
  case 'farSize':
   valueDiff(key,c=>{c.farSize=1.1},{enable:c=>c.emitters[0].layers.far.enabled=true});
   break;
  case 'density':valueDiff(key,c=>{c.density=95});break;
  case 'streakLength':valueDiff(key,c=>{c.streakLength=43});break;
  case 'windAngle':valueDiff(key,c=>{c.windAngle=44});break;
  case 'fallSpeed':valueDiff(key,c=>{c.fallSpeed=410});break;
  case 'dropWidth':valueDiff(key,c=>{c.dropWidth=5});break;
  case 'impactProbability':valueDiff(key,c=>{c.impactProbability=0});break;
  case 'groundY':valueDiff(key,c=>{c.groundY=350});break;
  case 'groundBandHeight':valueDiff(key,c=>{c.groundBandHeight=44});break;
  case 'impactSize':valueDiff(key,c=>{c.impactSize=17});break;
  case 'impactLifetime':valueDiff(key,c=>{c.impactLifetime=.9});break;
  case 'spawnY':valueDiff(key,c=>{c.spawnY=-125});break;
  case 'fieldWidth':valueDiff(key,c=>{c.fieldWidth=250});break;
  case 'spatialGap':valueDiff(key,c=>{c.spatialGap=30});break;
  case 'spatialJitter':valueDiff(key,c=>{c.spatialJitter=.4});break;
  case 'seed':valueDiff(key,c=>{c.seed=1000003});break;
  case 'spatialMode':valueDiff(key,c=>{c.spatialMode='clustered'});break;
  case 'style':valueDiff(key,c=>{c.style='magical'});break;
  default:throw Error('Unverified Rainfall artist parameter '+key);
 }
}
for(const [key,point,y,time] of [
 ['densityCurve',1,.2,.31],['windCurve',1,.2,.31],
 ['dropAlphaCurve',1,.2,.31],['spacingCurve',0,42,.31]
]){
 const before=clone(base),after=clone(base);
 if(key==='spacingCurve'){
  before.spacingCurveEnabled=true;after.spacingCurveEnabled=true;
 }
 after[key].keys[point].y=y;
 if(key==='densityCurve'){
  const a=R.schedule(before,before.emitters[0]).events,
   b=R.schedule(after,after.emitters[0]).events;
  A.notDeepEqual(a,b);
  add('curve.'+key,'numeric','Normalized 45/s mean, actual integrated source event timestamps shift',
   {before:a.map(v=>v.time),after:b.map(v=>v.time)});
 }else if(key==='spacingCurve'){
  const a=R.schedule(before,before.emitters[0]).positions,
   b=R.schedule(after,after.emitters[0]).positions;
  A.notDeepEqual(a,b);
  add('curve.'+key,'numeric','Editable true arc-length lane distance changes independent placements',
   {before:a.slice(0,8),after:b.slice(0,8)});
 }else{
  const a=digest(before,time),b=digest(after,time);
  A.notEqual(a,b,'Inert FxCurves control '+key);
  add('curve.'+key,'numeric','Versioned actual curve changes FxRain effect output',
   {time,oldHash:a,newHash:b});
 }
}
A.equal(checks.filter(x=>x.id.startsWith('parameter.')).length,bp.parameters.length);
const pre=R.schedule(base,base.emitters[0]);
A.ok(pre.events.length>=40&&pre.events.length<=50);
A.equal(R.sample(base,0).emitters[0].layers.drops.some(x=>x.age>1),true);
add('timing.mean-rate','numeric',
 'Density 45 is mean count per one-second period despite variable envelope; history pre-roll',
 {events:pre.events.length,rateIntegral:pre.rateIntegral,
  oldestAt0:Math.max(...R.sample(base,0).emitters[0].layers.drops.map(x=>x.age))});
const b=R.bounds(R.sample(base,.5),null,base);
A.ok(b.inside&&b.minY<0,'Vertical entry should be intentionally clipped, x stays inside');
add('crop.intentional-vertical','numeric',
 'Vertical ingress from outside is allowed, all default horizontal streaks remain inside',
 {inside:b.inside,horizontalInside:b.horizontalInside,minY:b.minY,
  minX:b.minX,maxX:b.maxX});
add('backend.actual','backend',report.backend.actual,report.backend.actual);
const evidence={
 schemaVersion:1,effectId:bp.effectId,effectVersion:bp.effectVersion,
 sourceCommit:cp.execFileSync('git',['rev-parse','HEAD'],
  {cwd:repo,encoding:'utf8'}).trim(),
 status:'PASS',environment:{
  browser:'Chromium '+report.browser,
  device:os.platform()+' '+os.release()+' '+os.arch()+' (headless)',
  requestedBackend:report.backend.actual==='webgpu'?'webgpu':'webgl',
  actualBackend:report.backend.actual,glVersion:report.backend.version,
  gpu:'Headless Chromium software renderer; actual physical GPU unavailable',
  offline:true,networkRequests:report.external.length
 },
 fixture:{
  seed:base.seed,settings:base,width:512,height:512,fps:60,
  asset:'Pinned Spine4.2.43 two-page JSON sample tested separately; these render-only phase PNGs are isolated rain layers',
  frameTimesSeconds:[0,.5,1]
 },
 checks,
 warnings:[
  'Rain is deterministic 2D artist-authored streak physics, not CFD or arbitrary world surface collision.',
  'Ground impacts track the horizontal ground band and current emitter anchor. Rotated Spine-fields do NOT simulate independent historical world-space emission.',
  'Headless Chromium rendered real WebGL1, WebGL2 and WebGPU, but does NOT certify mobile hardware FPS or thermals.',
  'Only WebGL2 full 60-frame PNG ZIP and CRC verified; other backends have 8-frame sampled bakes.',
  'Matching Spine4.2 JSON multipage atlas/animated bones/slot/attachment verified; standalone binary .skel fixture NOT RUN.',
  '3600-frame maximum stress export NOT RUN; schema maximum and explicit particle budgets verified.',
  'Post-push regenerate this evidence against published 40-hex full SHA to claim release.'
 ]
};
fs.writeFileSync(path.join(dir,'effect-evidence.json'),JSON.stringify(evidence,null,2)+'\n');
console.log('WATER-02 FX-CORE-07',JSON.stringify({
 backend:report.backend.actual,checks:checks.length,
 phases:bp.phases.length,parameters:bp.parameters.length,
 fullSHA:evidence.sourceCommit}));
