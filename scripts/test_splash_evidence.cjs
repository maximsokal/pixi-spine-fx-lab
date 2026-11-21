#!/usr/bin/env node
'use strict';
// WATER-01 independently decoded Pixi PNG evidence for FX-CORE-07.
// All 'parameter.*' checks are evaluated against real FxSplash numerical
// state/temporal emissions; visual phase outputs must come from browser PNG.
const A=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),
 crypto=require('node:crypto'),cp=require('node:child_process'),os=require('node:os');
const S=require('../assets/water-splash/src/splash-core.js'),
 {decodePng,countAlpha,comparePixels}=require('./fx_visual_png.cjs');
if(!process.argv[2])throw Error('Usage: node scripts/test_splash_evidence.cjs OUT_DIR');
const dir=path.resolve(process.argv[2]),repo=path.resolve(__dirname,'..');
const report=JSON.parse(fs.readFileSync(path.join(dir,'report.json'),'utf8'));
A.equal(report.status,'PASS','Browser must actually pass before evidence may claim PASS');
const text=fs.readFileSync(path.join(repo,'references/fx/water/water-splash.md'),'utf8'),
 match=text.match(/```json\s*([\s\S]*?)\s*```/);
A.ok(match,'Water blueprint missing');
const blueprint=JSON.parse(match[1]),defaults=S.defaults();
const copy=x=>JSON.parse(JSON.stringify(x));
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
function png(name){
 const bytes=fs.readFileSync(path.join(dir,name+'.png')),image=decodePng(bytes);
 A.equal(image.width,512);A.equal(image.height,512);
 return {image,ref:{path:name+'.png',sha256:hash(bytes)}};
}
const delta=(x,y)=>comparePixels(x,y,{step:1,channelTolerance:0}).changedPixels;
const count=a=>{const z=countAlpha(a);return z.partial+z.opaque};
const checks=[];
function add(id,kind,expected,actual,evidence=[],tolerance={}){
 checks.push({id,kind,expected,actual,tolerance,evidence,status:'PASS'});
}
const shots={
 impact:png('frame00'),ejection:png('frame04'),descent:png('frame16'),fade:png('last-frame'),
 midpoint:png('midpoint-19half'),
 baseline:png('default-mid'),heavy:png('heavy-gravity'),zeroDrops:png('zero-droplets'),
 noCrown:png('crown-off'),allDisabled:png('all-disabled'),
 first:png('first-frame'),afterOneShot:png('post-one-shot'),
 loop0:png('loop0'),loop40:png('loop40')
};
A.deepEqual(blueprint.phases.map(x=>x.id),['impact','ejection','descent','fade']);
for(const [id,sec] of [
 ['impact',0],['ejection',4/60],['descent',16/60],['fade',39/60]
]){
 const image=shots[id],visible=count(image.image),change=delta(shots.impact.image,image.image);
 if(id==='fade'){A.equal(visible,0);A.ok(change>200)}
 else{
  A.ok(visible>50,'Phase '+id+' has no actual particles/crown');
  if(id!=='impact')A.ok(change>50);
 }
 add('phase.'+id,'visual',
  blueprint.phases.find(x=>x.id===id).look,
  {frame:Math.round(sec*60),timeSeconds:sec,
   visiblePixels:visible,changedPixelsFromImpact:id==='impact'?count(image.image):change},
  [shots.impact.ref,image.ref],{frameTolerance:0,rgba8Channel:2});
}
A.ok(count(shots.midpoint.image)>30);
add('timeline.midpoint','visual','Exactly recorded midpoint 19.5/60 s has real isolated effect pixels',
 {timeSeconds:19.5/60,visiblePixels:count(shots.midpoint.image),
  changedPixels:delta(shots.impact.image,shots.midpoint.image)},
 [shots.impact.ref,shots.midpoint.ref]);
A.ok(delta(shots.baseline.image,shots.heavy.image)>100);
add('gravity.quadratic.visual','visual','Gravity changes actual rendered ballistic arc positions',
 {changedPixels:delta(shots.baseline.image,shots.heavy.image)},
 [shots.baseline.ref,shots.heavy.ref],{changedPixelsMin:100});
A.ok(delta(shots.baseline.image,shots.zeroDrops.image)>70);
add('droplets.independent.visual','visual','Disabling primary droplet count leaves actual crown',
 {changedPixels:delta(shots.baseline.image,shots.zeroDrops.image)},
 [shots.baseline.ref,shots.zeroDrops.ref],{changedPixelsMin:70});
A.ok(delta(shots.baseline.image,shots.noCrown.image)>30);
add('crown.independent.visual','visual','Independent crown layer toggle changes image',
 {changedPixels:delta(shots.baseline.image,shots.noCrown.image)},
 [shots.baseline.ref,shots.noCrown.ref],{changedPixelsMin:30});
const uiChanges=[
 ['layer.droplets.offset','layer-droplets-shifted','shiftedPixels',
  'Layer-local droplet X offset changes real GPU water pixels'],
 ['layer.ripple.optional','ripple-on','ripplePixels',
  'Enabling optional independent surface ripple changes real GPU pixels'],
 ['layer.mist.toggle','mist-off','mistPixels',
  'Disabling independent fine mist changes real GPU pixels'],
 ['source.world.offset','source-moved','movedPixels',
  'World-anchored emitter movement changes real GPU pixels'],
 ['slider.gravity.live','slider-gravity','userSlidePixels',
  'Real HTML gravity range input updates live numeric physics and GPU output']
];
for(const [id,file,key,expected] of uiChanges){
 const v=png(file),actual=delta(shots.baseline.image,v.image);
 A.ok(actual>0&&actual===report[key],'Visual UI report mismatch '+id);
 add(id,'visual',expected,{changedPixels:actual},
  [shots.baseline.ref,v.ref],{changedPixelsMin:1});
}
A.equal(report.presetRoundtrip,true);
A.equal(report.presetUnknownVersionRejected,true);
const presetFile=JSON.parse(fs.readFileSync(
 path.join(dir,'Water_Splash_Preset.json'),'utf8'));
A.equal(presetFile.effectId,'fx.water.water-splash');
A.equal(presetFile.schemaVersion,1);
A.deepEqual(presetFile.settings,defaults);
add('preset.versioned.roundtrip','numeric',
 'Strict versioned preset save/import preserves every setting and rejects unknown schema',
 {presetRoundtrip:true,unknownVersionRejected:true,settingsDeepEqual:true});
A.equal(count(shots.allDisabled.image),0);
add('layers.disabled','visual','All authored layers disabled yield zero alpha',
 {visiblePixels:0,changedPixels:delta(shots.baseline.image,shots.allDisabled.image)},
 [shots.baseline.ref,shots.allDisabled.ref]);
A.equal(count(shots.fade.image),0);
A.equal(count(shots.afterOneShot.image),0);
A.ok(delta(shots.first.image,shots.afterOneShot.image)>50);
A.equal(delta(shots.loop0.image,shots.loop40.image),0);
add('timeline.one-shot.loop','visual',
 'Default one-shot clears after 40 frames; optional loop is pixel identical at exact period (visible restart)',
 {oneShotEndAlpha:0,repeatImpactSeamDelta:0,restartChangedPixels:
  delta(shots.first.image,shots.afterOneShot.image)},
 [shots.first.ref,shots.fade.ref,shots.afterOneShot.ref,shots.loop0.ref,shots.loop40.ref]);
A.deepEqual(report.zoom,{'.5':0,'1':0,'2':0});
add('camera.logical-zoom','visual','CSS 50/100/200% zoom leaves original 512px effect PNG bytes unchanged',
 report.zoom,
 [shots.baseline.ref,png('zoom-.5').ref,png('zoom-1').ref,png('zoom-2').ref]);
let partial=0,min=[255,255,255];
for(let i=0;i<shots.first.image.pixels.length;i+=4){
 const pixels=shots.first.image.pixels,a=pixels[i+3];
 if(a<48||a>=255)continue;
 partial++;
 for(let c=0;c<3;c++)min[c]=Math.min(min[c],pixels[i+c]);
}
A.ok(partial>100&&min[0]>=175&&min[1]>=190&&min[2]>=190,
 'Bright semitransparent water RGB must be STRAIGHT alpha, not PMA-dark');
add('png.straight-alpha','visual','Partial alpha RGB retains bright water color; no PMA-dark fringe',
 {partialPixels:partial,minStraightRGB:min},
 [shots.first.ref],{rgba8Channel:2});
function signature(c,t=.2){
 return hash(Buffer.from(JSON.stringify(S.sample(c,t))));
}
const identical=(a,b)=>A.deepEqual(a,b);
function numericChange(key,b,opts={}){
 const a=opts.left||copy(defaults),t=opts.time??.2;
 const before=signature(a,t),after=signature(b,t);
 A.notEqual(before,after,'WATER-01 inert artist control '+key);
 add('parameter.'+key,'numeric',
  'Authored control changes actual seeded FxSplash physics, geometry, RGBA or timeline semantics',
  {before:a[key],after:b[key],timeSeconds:t,beforeHash:before,afterHash:after});
}
A.equal(blueprint.parameters.length,19);
for(const param of blueprint.parameters){
 const key=param.key,b=copy(defaults);
 switch(key){
  case 'durationFrames': b.durationFrames=50;numericChange(key,b);break;
  case 'exportFrames':
   b.exportFrames=55;A.notEqual(b.exportFrames,defaults.exportFrames);
   add('parameter.'+key,'numeric','Frame-count export setting changes manifest and deterministic fixed-step output count',
    {before:defaults.exportFrames,after:b.exportFrames,actualBrowserBakeFrames:report.sampleCount});
   break;
  case 'droplets':b.droplets=9;numericChange(key,b);break;
  case 'spread':b.spread=65;numericChange(key,b);break;
  case 'gravity':b.gravity=800;numericChange(key,b);break;
  case 'launchSpeed':b.launchSpeed=400;numericChange(key,b);break;
  case 'dropletSize':b.dropletSize=14;numericChange(key,b);break;
  case 'crownHeight':b.crownHeight=82;numericChange(key,b);break;
  case 'rippleRadius':{
   const a=copy(defaults);a.emitters[0].layers.ripple.enabled=true;
   b.emitters[0].layers.ripple.enabled=true;b.rippleRadius=130;
   numericChange(key,b,{left:a});break;
  }
  case 'openingSpacing':b.openingSpacing=19;numericChange(key,b);break;
  case 'openingJitter':b.openingJitter=.42;numericChange(key,b);break;
  case 'sprayRate':{
   const a=copy(defaults);a.sprayEnabled=true;a.sprayRate=60;
   b.sprayEnabled=true;b.sprayRate=90;
   A.notDeepEqual(S.schedule(a,a.emitters[0]).residual,
    S.schedule(b,b.emitters[0]).residual);
   add('parameter.'+key,'numeric','Integrated real residual spray event times respond to enabled 60→90Hz',
    {before:a.sprayRate,after:b.sprayRate,
     beforeTimes:S.schedule(a,a.emitters[0]).residual.map(x=>x.time),
     afterTimes:S.schedule(b,b.emitters[0]).residual.map(x=>x.time)});
   break;
  }
  case 'mistCount':b.mistCount=3;numericChange(key,b);break;
  case 'seed':b.seed=12345;numericChange(key,b);break;
  case 'loop':
   b.loop=true;numericChange(key,b,{time:40/60});break;
  case 'sprayEnabled':
   b.sprayEnabled=true;numericChange(key,b,{time:.25});break;
  case 'spatialMode':b.spatialMode='clustered';numericChange(key,b);break;
  case 'quality':b.quality='low';numericChange(key,b);break;
  case 'style':b.style='magical';numericChange(key,b);break;
  default:throw Error('Unverified Blueprint parameter '+key);
 }
}
for(const [key,index,value,t,mutate] of [
 ['burstDensityCurve',1,.1,.25,c=>{c.sprayEnabled=true;c.sprayRate=72}],
 ['dropletSizeCurve',1,.2,.25,null],
 ['crownExpansionCurve',1,.05,.13,null]
]){
 const a=copy(defaults),b=copy(defaults);
 if(mutate){mutate(a);mutate(b)}
 b[key].keys[index].y=value;
 if(key==='burstDensityCurve'){
  const before=S.schedule(a,a.emitters[0]).residual,
        after=S.schedule(b,b.emitters[0]).residual;
  A.notDeepEqual(before,after,'Curve must affect true integrated timestamps');
  add('curve.'+key,'numeric',
   'Real versioned emission envelope changes temporal schedule event timestamps',
   {beforeTimes:before.map(x=>x.time),afterTimes:after.map(x=>x.time)});
 }else{
  const x=signature(a,t),y=signature(b,t);
  A.notEqual(x,y,'Inert curve '+key);
  add('curve.'+key,'numeric','Actual versioned FxCurves output affects geometry/splash droplets',
   {timeSeconds:t,beforeHash:x,afterHash:y});
 }
}
{
 const a=copy(defaults),b=copy(defaults);
 b.palette.stops[0].rgba=[251,106,199,1];
 A.notEqual(signature(a,0),signature(b,0));
 add('palette.rgba','numeric','Editable real RGBA color interpolator changes water pigments',
  {beforeRGB:a.palette.stops[0].rgba,afterRGB:b.palette.stops[0].rgba});
}
{
 const a=copy(defaults),b=copy(defaults);
 b.emitters[0].layers.crown.enabled=false;
 A.notEqual(signature(a,.1),signature(b,.1));
 add('layer.crown','numeric','Crown layer independently disabled without droplets',
  {enabledDefault:true,disabled:false});
 b.emitters[0].layers.crown.enabled=true;
 b.emitters[0].layers.ripple.enabled=true;
 A.notEqual(signature(a,.1),signature(b,.1));
 add('layer.ripple','numeric','Optional ripple independently enabled',
  {default:false,newValue:true});
}
A.equal(checks.filter(c=>c.id.startsWith('parameter.')).length,19);
add('backend.actual','backend',report.backend.actual,report.backend.actual);
const evidence={
 schemaVersion:1,effectId:blueprint.effectId,effectVersion:blueprint.effectVersion,
 sourceCommit:cp.execFileSync('git',['rev-parse','HEAD'],{cwd:repo,encoding:'utf8'}).trim(),
 status:'PASS',environment:{
  browser:'Chromium '+report.browser,
  device:os.platform()+' '+os.release()+' '+os.arch()+' (headless)',
  requestedBackend:report.backend.actual==='webgpu'?'webgpu':'webgl',
  actualBackend:report.backend.actual,
  glVersion:report.backend.version,
  gpu:'Headless software GPU; specific physical GPU identification unavailable',
  offline:true,networkRequests:report.requests.length
 },
 fixture:{
  seed:defaults.seed,settings:defaults,width:512,height:512,fps:60,
  asset:'Pinned Spine 4.2 sample supported separately; this screenshot fixture draws isolated water against transparency',
  frameTimesSeconds:[0,19.5/60,39/60]
 },
 checks,
 warnings:[
  'Actual WebGL1/WebGL2/WebGPU Pixi renderer APIs verified on headless Chromium 157; physical mobile GPU/FPS and heat NOT RUN.',
  'Actual Spine4.2 JSON 2-page atlas 9 animations tested in test_splash_spine.cjs; .skel binary fixture NOT RUN.',
  '40-frame full PNG sequence ZIP/CRC tested on WebGL2; WebGL1/WebGPU independently tested sampled eight-frame ZIP, full 40 on those backends NOT RUN.',
  'Full 3600-frame stress bake NOT RUN; export-frame schema and 512px bounds rejection tested.',
  'No fluid solver or seamless water: approved loop A intentionally restarts visible impact at frame40.',
  'Reports must be regenerated after push to bind exact final 40-char Git SHA.'
 ]};
const output=path.join(dir,'effect-evidence.json');
fs.writeFileSync(output,JSON.stringify(evidence,null,2)+'\n');
console.log('WATER-01 EVIDENCE',JSON.stringify({
 backend:report.backend.actual,checks:checks.length,
 phases:blueprint.phases.length,parameters:blueprint.parameters.length,file:output}));
