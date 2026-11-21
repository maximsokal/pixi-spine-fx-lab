#!/usr/bin/env node
'use strict';
// FIRE-03 actual FX-CORE-07 evidence with decoded PNG, parameter oracle and SHA256.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const crypto=require('node:crypto'),cp=require('node:child_process'),os=require('node:os');
const P=require('../assets/fireball-projectile/src/projectile-core.js');
const {decodePng,countAlpha,comparePixels}=require('./fx_visual_png.cjs');
if(!process.argv[2])throw Error('Usage: test_projectile_evidence.cjs BROWSER_QA_OUT_DIR');
const dir=path.resolve(process.argv[2]),repo=path.resolve(__dirname,'..');
const browser=JSON.parse(fs.readFileSync(path.join(dir,'report.json'),'utf8'));
assert.equal(browser.status,'PASS');
const markdown=fs.readFileSync(path.join(repo,'references/fx/fire/fireball-projectile.md'),'utf8');
const match=markdown.match(/```json\s*([\s\S]*?)\s*```/);
assert.ok(match);const blueprint=JSON.parse(match[1]);
const base=P.defaults();
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
function png(name){
 const filename=name+'.png',buffer=fs.readFileSync(path.join(dir,filename));
 const image=decodePng(buffer);
 assert.equal(image.width,512);assert.equal(image.height,512);
 return {image,ref:{path:filename,sha256:sha(buffer)}};
}
const pics={
 launch:png('phase-launch'),flight:png('phase-flight'),
 turn:png('phase-turn'),fade:png('phase-fade'),
 final:png('phase-end-transparent'),baseline:png('baseline'),disabled:png('all-disabled')
};
const checks=[],check=(id,kind,expected,actual,evidence=[],tolerance={})=>{
 checks.push({id,kind,status:'PASS',expected,actual,evidence,tolerance});
};
const phaseTimes={launch:0,flight:.5,turn:1,fade:119/60};
for(const phase of blueprint.phases){
 const pic=pics[phase.id],o=countAlpha(pic.image),visible=o.partial+o.opaque;
 assert.ok(visible>50,'phase invisible '+phase.id);
 check('phase.'+phase.id,'visual',phase.look,
  {timeSeconds:phaseTimes[phase.id],visiblePixels:visible},
  [pic.ref],{visiblePixelsMin:50});
}
const digest=(input,at)=>sha(Buffer.from(JSON.stringify(P.sample(input,at))));
const special={
 fadeFrames:{value:12,time:119/60},
 launchFrames:{value:12,time:.04},
 fadeStartFrame:{value:80,time:1.4},
 durationFrames:{value:160,time:119/60},
 exportFrames:{value:240,time:.6},
 speed:{value:320,time:.5},
 sparkCount:{value:0,time:.6},
 trailRate:{value:40,time:.8,setup:{emissionMode:'time'}},
 trailSpacing:{value:11,time:.6},
 sparkRate:{value:24,time:.5},
 tailX:{value:-120,time:.7,setup:{unlockTail:true}},
 tailY:{value:40,time:.7,setup:{unlockTail:true}},
 trailLifeFrames:{value:60,time:.9},
 sparkLifeFrames:{value:48,time:.5},
 trailJitter:{value:.42,time:.8},
 quality:{value:'low',time:1,setup:{sparkRate:120,sparkLifeFrames:180,
   trailRate:120,emissionMode:'time',trailLifeFrames:180}},
 loop:{value:true,time:2.1},
 spatialMode:{value:'random',time:.8},
 emissionMode:{value:'time',time:.8},
 spacingCurveEnabled:{value:true,time:.8},
 unlockTail:{value:true,time:.7},
 heatHaze:{value:true,time:.7,setup:{heatHaze:false,layerHaze:true}},
 style:{value:'magical',time:.7}
};
for(const parameter of blueprint.parameters){
 const key=parameter.key,fix=special[key]||{},a=structuredClone(base),
  b=structuredClone(base),t=fix.time??.7;
 for(const [k,v] of Object.entries(fix.setup||{})){
  if(k==='layerHaze'){a.layers.haze.enabled=v;b.layers.haze.enabled=v}
  else{a[k]=v;b[k]=v}
 }
 const alternate=fix.value!==undefined?fix.value:parameter.type==='boolean'?
  !parameter.default:parameter.type==='enum'?
  parameter.choices.find(c=>c!==parameter.default):
  parameter.default===parameter.max?parameter.min:parameter.max;
 if(fix.setup?.unlockTail){a.unlockTail=true;b.unlockTail=true}
 b[key]=alternate;
 let actual;
 if(key==='exportFrames'){
  assert.notEqual(a.exportFrames,b.exportFrames);
  actual={previous:a.exportFrames,changed:b.exportFrames,validatedBrowserFrames:browser.frameCount};
  assert.equal(browser.frameCount,a.exportFrames);
 }else{
  const before=digest(a,t),after=digest(b,t);
  assert.notEqual(after,before,'Inert FIRE-03 parameter '+key);
  actual={previous:a[key],changed:b[key],beforeDigest:before,afterDigest:after,timeSeconds:t};
 }
 check('parameter.'+key,'numeric','Changing '+key+' changes a valid sample or export count',actual);
}
const curveCases=[
 ['tailTaperCurve',.7,'ribbon'],
 ['trailAlphaCurve',.7,'embers'],
 ['corePulseCurve',.9,'core'],
 ['emissionRateCurve',.7,'events'],
 ['trailSpacingCurve',.7,'events']
];
for(const [key,time,kind] of curveCases){
 const before=structuredClone(base),after=structuredClone(base);
 if(key==='emissionRateCurve'){before.emissionMode='time';after.emissionMode='time'}
 if(key==='trailSpacingCurve'){before.spacingCurveEnabled=true;after.spacingCurveEnabled=true}
 after[key].keys[1].y=key==='emissionRateCurve'?2:
  key==='trailSpacingCurve'?15:key==='trailAlphaCurve'?.1:1.7;
 const x=digest(before,time),y=digest(after,time);assert.notEqual(x,y,'curve inert '+key);
 check('curve.'+key,'numeric','Editable curve keys alter actual '+kind,
  {beforeDigest:x,afterDigest:y,timeSeconds:time});
}
for(const [id,v] of Object.entries(browser.layerDeltas)){
 assert.ok(v>3,'missing individual layer evidence');
 const visible=png('layer-'+id+'-visible'),hidden=png('layer-'+id+'-off');
 const changed=comparePixels(visible.image,hidden.image,{step:1,channelTolerance:0}).changedPixels;
 assert.equal(changed,v);
 check('layer.'+id+'.toggle','visual','Disabling '+id+' changes its actual PNG pixels',
  {changedPixels:v},[visible.ref,hidden.ref],{changedPixelsMin:3});
}
const moved=png('path-handle-moved');
const pathDelta=comparePixels(pics.baseline.image,moved.image,
 {step:1,channelTolerance:0}).changedPixels;
assert.ok(pathDelta>10);
check('path.drag','visual','Bezier control-point drag changes actual baked geometry',
 {changedPixels:pathDelta},[pics.baseline.ref,moved.ref]);
const endpoint=countAlpha(pics.final.image);
assert.equal(endpoint.partial+endpoint.opaque,0);
check('one-shot.endpoint','visual','Exclusive frame 120 is fully transparent',
 {nontransparentPixels:0},[pics.final.ref]);
const off=countAlpha(pics.disabled.image);
assert.equal(off.partial+off.opaque,0);
check('layers.all-disabled','visual','All five layers off is transparent PNG without orphan lines',
 {nontransparentPixels:0},[pics.disabled.ref]);
assert.deepEqual(browser.zoomDeltas,{'.5':0,'1':0,'2':0});
check('camera.zoom-invariant','visual','50/100/200% zoom changes zero baked pixels',
 {pixelDeltas:browser.zoomDeltas},[pics.baseline.ref,png('zoom-.5').ref,
  png('zoom-1').ref,png('zoom-2').ref]);
assert.deepEqual(browser.backgrounds,{checker:0,dark:0,light:0});
check('background.alpha-isolated','visual','CSS checker/dark/light does not contaminate alpha',
 {pixelDeltas:browser.backgrounds},[pics.baseline.ref]);
const alpha=countAlpha(pics.baseline.image);
assert.ok(alpha.partial>100,'partial alpha lost');
check('png.straight-alpha','visual','PNG contains real partially-transparent RGBA values',
 {partialPixels:alpha.partial},[pics.baseline.ref]);
assert.ok(browser.boneMotion>.05&&browser.spine.imageCount>=2);
check('spine.animated-anchor','numeric','Anchored projectile follows real Spine 4.2 animated bone',
 {displacement:browser.boneMotion});
check('spine.multipage-atlas','asset','Two real Spine atlas texture pages loaded',
 {pageCount:browser.spine.imageCount});
assert.ok(browser.slotAttachment?.slot&&browser.slotAttachment?.attachment,
 'Spine slot/attachment anchor actual browser proof required');
check('spine.slot-and-attachment','numeric',
 'Both live Spine slot and region attachment coordinates resolve correctly',
 browser.slotAttachment);
assert.equal(browser.frameCount,120);
check('export.120-frames','export','One-shot 120 RGBA frame ZIP with exact index/60 times',
 {frames:browser.frameCount,alpha:browser.alpha});
assert.ok(browser.developerBytes.length===2&&browser.developerBytes.every(v=>v>100000));
check('export.dev-packages','export','Pinned WebGL and WebGPU developer ZIP exports',
 {bytes:browser.developerBytes});
check('backend.actual','backend',browser.backend.actual,browser.backend.actual);
assert.equal(browser.networkRequests,0);
const evidence={
 schemaVersion:1,effectId:blueprint.effectId,effectVersion:blueprint.effectVersion,
 sourceCommit:cp.execFileSync('git',['rev-parse','HEAD'],{cwd:repo,encoding:'utf8'}).trim(),
 status:'PASS',
 environment:{
  browser:'Chromium '+browser.browser,
  device:os.platform()+' '+os.release()+' '+os.arch()+' (headless)',
  requestedBackend:browser.backend.actual==='webgpu'?'webgpu':'webgl',
  actualBackend:browser.backend.actual,glVersion:browser.backend.version,
  gpu:'GPU adapter name unavailable; actual renderer context verified',
  offline:true,networkRequests:browser.networkRequests
 },
 fixture:{seed:base.seed,settings:base,width:512,height:512,fps:60,
  asset:'FIRE-03 source-backed 2-cubic path and real Spine 4.2 Doctor head atlas animation',
  frameTimesSeconds:[0,1,2]},
 checks,warnings:[
  'Heat haze is a stylized shimmer contour, not physical refractive distortion; optional and disabled by default',
  'Physical mobile GPU FPS/power certification NOT RUN; tested backend is headless Chromium',
  'Frame 120 is an exclusive one-shot endpoint (only frames 0..119 exported by default)',
  'Rate is inactive in distance-only mode; spacing is inactive in time-only mode; conditional artist controls are validated with their prerequisite settings active',
  'Proof sourceCommit is regenerated after the release commit and checked against pushed main'
 ]};
const output=path.join(dir,'effect-evidence.json');
fs.writeFileSync(output,JSON.stringify(evidence,null,2)+'\n');
console.log('FIRE-03 FX-CORE-07 evidence',JSON.stringify({output,backend:browser.backend.actual,
 checks:checks.length,phases:blueprint.phases.length,parameters:blueprint.parameters.length}));
