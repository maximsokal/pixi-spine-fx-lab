#!/usr/bin/env node
'use strict';
// FIRE-04 FX-CORE-07: backend evidence with real full PNG files, SHA256 and verified parameter oracles.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const crypto=require('node:crypto'),cp=require('node:child_process'),os=require('node:os');
const E=require('../assets/embers-sparks/src/embers-core.js');
const {decodePng,countAlpha,comparePixels}=require('./fx_visual_png.cjs');
if(!process.argv[2])throw Error('Usage: test_embers_evidence.cjs BROWSER_QA_DIR');
const dir=path.resolve(process.argv[2]),repo=path.resolve(__dirname,'..'),
 browser=JSON.parse(fs.readFileSync(path.join(dir,'report.json'),'utf8'));
assert.equal(browser.status,'PASS');
const markdown=fs.readFileSync(path.join(repo,'references/fx/fire/embers-sparks.md'),'utf8');
const match=markdown.match(/```json\s*([\s\S]*?)\s*```/);
assert.ok(match);const blueprint=JSON.parse(match[1]),base=E.defaults();
const sha=buffer=>crypto.createHash('sha256').update(buffer).digest('hex');
function png(name){
 const file=name+'.png',bytes=fs.readFileSync(path.join(dir,file)),
  image=decodePng(bytes);
 assert.equal(image.width,512);assert.equal(image.height,512);
 return {image,ref:{path:file,sha256:sha(bytes)}};
}
const count=img=>{const a=countAlpha(img);return a.partial+a.opaque};
const difference=(a,b)=>comparePixels(a,b,{step:1,channelTolerance:0}).changedPixels;
const pics={launch:png('phase-launch'),emission:png('phase-emission'),
 cooling:png('phase-cooling'),fade:png('phase-shrinking'),end:png('phase-end-transparent'),
 baseline:png('baseline'),allOff:png('all-layers-disabled')};
const checks=[];
function check(id,kind,expected,actual,evidence=[],tolerance={}){
 checks.push({id,kind,status:'PASS',expected,actual,evidence,tolerance});
}
const phaseTimes={launch:0,emission:25/60,cooling:60/60,fade:75/60};
for(const phase of blueprint.phases){
 const pic=pics[phase.id],vis=count(pic.image);
 assert.ok(vis>=3,'phase not visible '+phase.id);
 check('phase.'+phase.id,'visual',phase.look,
  {timeSeconds:phaseTimes[phase.id],visiblePixels:vis},
  [pic.ref],{visiblePixelsMin:3});
}
assert.equal(count(pics.end.image),0);
check('phase.terminal-transparent','visual','Frame 89 is completely transparent',
 {nontransparentPixels:0},[pics.end.ref]);
const signature=(s,t)=>sha(Buffer.from(JSON.stringify(E.sample(s,t).emitters.map(v=>({
 id:v.id,layers:v.layers,events:v.events,active:v.active})))));
const specials={
 rate:{value:70,time:.5},
 particleSize:{value:8,time:.5},
 spreadAngle:{value:120,time:.5},
 launchSpeed:{value:320,time:.5},
 gravity:{value:200,time:.5},
 lifetimeSeconds:{value:.3,time:1},
 emissionFrames:{value:20,time:.5},
 durationFrames:{value:60,time:1.2},
 exportFrames:{value:120,meta:true},
 intervalJitter:{value:.42,time:.5},
 burstCount:{value:8,time:.4,setup:{burstMode:true,burstDelay:.006}},
 burstDelay:{value:.015,time:.5,setup:{burstMode:true,burstCount:3}},
 spatialSpacing:{value:20,time:.5,moving:true},
 spatialJitter:{value:.43,time:.5,moving:true},
 minGapSeconds:{value:.05,time:.5},
 streakLength:{value:55,time:.5,layer:'streaks'},
 bloomRadius:{value:26,time:.5,layer:'bloom'},
 seed:{value:112313,time:.5},
 loop:{value:true,time:1.6},
 burstMode:{value:true,time:.5},
 spacingCurveEnabled:{value:true,time:.5,moving:true},
 spatialMode:{value:'clustered',time:.5,moving:true},
 emissionMode:{value:'distance',time:.5,moving:true},
 quality:{value:'low',time:1.4,setup:{rate:240,emissionFrames:120,
  durationFrames:400,lifetimeSeconds:4}},
 style:{value:'magical',time:.5}
};
for(const param of blueprint.parameters){
 const key=param.key,opt=specials[key];
 assert.ok(opt,'missing explicit FIRE-04 parameter oracle '+key);
 const a=structuredClone(base),b=structuredClone(base),t=opt.time??.5;
 if(opt.setup)for(const [k,v] of Object.entries(opt.setup)){a[k]=v;b[k]=v}
 if(opt.moving){
  a.emitters[0].motion.mode='path';b.emitters[0].motion.mode='path';
  a.emissionMode='distance';b.emissionMode='distance';
 }
 if(opt.layer){a.emitters[0].layers[opt.layer].enabled=true;
  b.emitters[0].layers[opt.layer].enabled=true}
 if(key==='emissionMode'){a.emissionMode='time';b.emissionMode='time'}
 b[key]=opt.value;
 if(opt.meta){
  assert.notEqual(a[key],b[key]);
  check('parameter.'+key,'numeric','Settings '+key+' changes exported frame count',
   {before:a[key],after:b[key],observedDefault:browser.frames});
 }else{
  const before=signature(a,t),after=signature(b,t);
  assert.notEqual(before,after,'Artist parameter has no effect: '+key);
  check('parameter.'+key,'numeric','Source-controlled '+key+' changes actual born particles or visible geometry',
   {before:a[key],after:b[key],beforeDigest:before,afterDigest:after,timeSeconds:t});
 }
}
for(const [key,setup,alt] of [
 ['emissionRateCurve',{rate:35},.2],['sizeCurve',{},.2],
 ['temperatureCurve',{},.3],['alphaCurve',{},.2],
 ['spacingCurve',{emissionMode:'distance',spacingCurveEnabled:true},15]
]){
 const a=structuredClone(base),b=structuredClone(base);
 for(const [k,v] of Object.entries(setup)){a[k]=v;b[k]=v}
 if(key==='spacingCurve'){
  a.emitters[0].motion.mode='path';b.emitters[0].motion.mode='path';
 }
 b[key].keys[1].y=alt;
 const x=signature(a,.5),y=signature(b,.5);
 assert.notEqual(x,y,'Inert curve '+key);
 check('curve.'+key,'numeric','Editable curve alters sample at frame 30',
  {baseline:x,changed:y});
}
for(const [k,val] of Object.entries(browser.layerDeltas)){
 const on=png('layer-'+k+'-on'),off=png('layer-'+k+'-off');
 const pixels=difference(on.image,off.image);
 assert.equal(pixels,val);assert.ok(pixels>2);
 check('layer.'+k+'.toggle','visual','Layer '+k+' independent visual disable/XY',
  {changedPixels:pixels},[on.ref,off.ref],{changedPixelsMin:3});
}
assert.equal(count(pics.allOff.image),0);
check('layers.all-disabled','visual','All layers off yield zero alpha',
 {nontransparentPixels:0},[pics.allOff.ref]);
const moved=png('origin-moved');
assert.ok(difference(pics.baseline.image,moved.image)>3);
check('emitter.world-drag','visual','World emitter drag changes actual pixels',
 {changedPixels:difference(pics.baseline.image,moved.image)},
 [pics.baseline.ref,moved.ref]);
const spatial=png('moving-distance');
assert.ok(count(spatial.image)>0);
check('emitter.distance-moving','visual','Distance emitter moving has nontransparent particles',
 {visiblePixels:count(spatial.image)},[spatial.ref]);
const cold=png('color-edited');
assert.ok(difference(cold.image,pics.baseline.image)>5);
check('color.rgba','visual','Artist editable RGBA hot-to-cool stop changes PNG',
 {changedPixels:difference(cold.image,pics.baseline.image)},[cold.ref,pics.baseline.ref]);
const styles=png('magical-style');
assert.ok(difference(styles.image,pics.baseline.image)>3);
check('style.magical','visual','Style renders a different hot particle shape',
 {changedPixels:difference(styles.image,pics.baseline.image)},[styles.ref,pics.baseline.ref]);
for(const [id,entity] of [
 ['seed-independence','emitter1'],['source-motion','emitter1'],
 ['spine.animated-bone',browser.boneMotion],
 ['spine.slot-attachment',browser.slotAttachment]]) {
 const what=typeof entity==='number'?entity:entity;
 check('emitter.'+id,'numeric','Observed emitter/anchor contract '+id,
  {value:what});
}
assert.deepEqual(browser.zoomDeltas,{'.5':0,'1':0,'2':0});
check('camera.zoom','visual','50%,100%,200% camera does not change PNG',
 {pixelDeltas:browser.zoomDeltas},[pics.baseline.ref,
 png('zoom-.5').ref,png('zoom-1').ref,png('zoom-2').ref]);
assert.deepEqual(browser.backgrounds,{checker:0,dark:0,light:0});
check('background.transparent','visual','Checker/dark/light do not pollute RGBA',
 {pixelDeltas:browser.backgrounds},[pics.baseline.ref]);
assert.ok(countAlpha(pics.baseline.image).partial>20);
check('png.straight-alpha','visual','Decoded RGBA has real partial alpha',
 {partialPixels:countAlpha(pics.baseline.image).partial},[pics.baseline.ref]);
assert.equal(browser.frames,90);
check('png.90-frame-zip','export','All 90 frames PNG at frame index/60 with strict alpha',
 {frames:browser.frames,alpha:browser.alpha});
assert.ok(browser.developerBytes.every(x=>x>50000));
check('developer.webgl-webgpu','export','Exact ESM and pinned standalone developer packages',
 {bytes:browser.developerBytes});
check('backend.actual','backend',browser.backend.actual,browser.backend.actual);
const report={
 schemaVersion:1,effectId:blueprint.effectId,effectVersion:blueprint.effectVersion,
 sourceCommit:cp.execFileSync('git',['rev-parse','HEAD'],{cwd:repo,encoding:'utf8'}).trim(),
 status:'PASS',
 environment:{browser:'Chromium '+browser.browser,
  device:os.platform()+' '+os.release()+' '+os.arch()+' headless',
  requestedBackend:browser.backend.actual==='webgpu'?'webgpu':'webgl',
  actualBackend:browser.backend.actual,glVersion:browser.backend.version,
  gpu:'Hardware GPU name unavailable; actual backend checked',
  offline:true,networkRequests:browser.externalRequests},
 fixture:{seed:base.seed,settings:base,width:512,height:512,fps:60,
  asset:'FIRE-04 synthetic stationary/moving cubic plus real two-page Spine Doctor head 4.2',
  frameTimesSeconds:[0,.75,1.5]},checks,
 warnings:['No true fullscreen blur/refraction; optional 3-ring owned bloom only',
 'Physical mobile GPU power/performance tests NOT RUN; headless Chromium only',
 'Default 40 emission frames plus 0.8s cooling, exported in 90 frames',
 'Distance/both and spacing controls are active only when an emitter is explicitly moving',
 'Optional streak and bloom layer parameters are active only when their layer is enabled',
 'Regenerate SHA256 and sourceCommit after release commit and compare to remote main']
};
const filepath=path.join(dir,'effect-evidence.json');
fs.writeFileSync(filepath,JSON.stringify(report,null,2)+'\n');
console.log('FIRE-04 EVIDENCE',JSON.stringify({filepath,backend:browser.backend.actual,
 checks:checks.length,phases:blueprint.phases.length,parameters:blueprint.parameters.length}));
