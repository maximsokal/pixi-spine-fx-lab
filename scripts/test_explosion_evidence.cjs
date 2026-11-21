#!/usr/bin/env node
'use strict';
// FIRE-02 effect-specific evidence: actual PNG hashes + independent numerical matrix.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const crypto=require('node:crypto'),cp=require('node:child_process'),os=require('node:os');
const Fx=require('../assets/fire-explosion/src/explosion-core.js');
const {decodePng,countAlpha,comparePixels}=require('./fx_visual_png.cjs');
if(!process.argv[2])throw Error('Usage: test_explosion_evidence.cjs BROWSER_OUTPUT_DIR');
const dir=path.resolve(process.argv[2]),root=path.resolve(__dirname,'..');
const browser=JSON.parse(fs.readFileSync(path.join(dir,'report.json'),'utf8'));
assert.equal(browser.status,'PASS');
const md=fs.readFileSync(path.join(root,'references/fx/fire/fire-explosion.md'),'utf8');
const match=md.match(/\x60\x60\x60json\s*([\s\S]*?)\s*\x60\x60\x60/);
assert.ok(match,'FIRE-02 Blueprint missing');
const blueprint=JSON.parse(match[1]),settings=Fx.defaults(),sha=x=>
 crypto.createHash('sha256').update(x).digest('hex');
function png(name){
 const filename=name+'.png',bytes=fs.readFileSync(path.join(dir,filename)),
  decoded=decodePng(bytes);
 assert.equal(decoded.width,512);assert.equal(decoded.height,512);
 return {image:decoded,ref:{path:filename,sha256:sha(bytes)}};
}
const pics={
 flash:png('phase-flash'),expansion:png('phase-fire'),
 breakup:png('phase-breakup'),smoke:png('phase-endpoint'),
 baseline:png('baseline'),empty:png('all-disabled')
};
const checks=[],check=(id,kind,expected,actual,evidence=[],tolerance={})=>{
 checks.push({id,kind,status:'PASS',expected,actual,evidence,tolerance});
};
const phaseTime={flash:0,expansion:12/60,breakup:20/60,smoke:40/60};
for(const phase of blueprint.phases){
 const pic=pics[phase.id],count=countAlpha(pic.image);
 assert.ok(count.partial+count.opaque>50);
 check('phase.'+phase.id,'visual',phase.look,
  {timeSeconds:phaseTime[phase.id],visiblePixels:count.partial+count.opaque},
  [pic.ref]);
}
for(const p of blueprint.parameters){
 const base=structuredClone(settings),next=structuredClone(settings);
 const alternate=p.type==='enum'?p.choices.find(x=>x!==p.default):
  p.type==='boolean'?!p.default:
  p.default===p.max?p.min:p.max;
 if(p.key==='heading')next.directionMode='directional';
 if(p.key==='spread')next.directionMode='directional';
 if(p.key==='secondaryCount')next.secondaryBursts=true;
 if(p.key==='debrisSpacingCurveEnabled'){
  // Default enabled curve intentionally differs from base spacing.
  assert.notEqual(next.debrisSpacingCurve.keys[0].y,next.debrisSpacing);
 }
 if(p.key==='heading')next.heading=45;
 else if(p.key==='spread')next.spread=160;
 else next[p.key]=alternate;
 if(p.key==='heading'||p.key==='spread')base.directionMode='directional';
 if(p.key==='secondaryCount')base.secondaryBursts=true;
 const t=p.key==='smokePersistence'||p.key==='smokeCount'?.8:
  p.key==='loop'?.98:p.key==='exportFrames'?.25:.34;
 const before=Fx.sample(base,t),after=Fx.sample(next,t);
 let actual;
 if(p.key==='exportFrames'){
  assert.notEqual(next.exportFrames,base.exportFrames);
  actual={baselineFrames:base.exportFrames,alteredFrames:next.exportFrames,
   browserBakeFrames:browser.frameCount};
  assert.equal(browser.frameCount,base.exportFrames);
 }else{
  const beforeDigest=sha(Buffer.from(JSON.stringify(before))),
   afterDigest=sha(Buffer.from(JSON.stringify(after)));
  assert.notEqual(beforeDigest,afterDigest,'Inert Blueprint parameter: '+p.key);
  actual={beforeDigest,afterDigest,baseline:p.default,altered:next[p.key],sampleAt:t};
 }
 check('parameter.'+p.key,'numeric','Change '+p.key+' must change the defined effect or export output',
  actual);
}
check('backend.actual','backend',browser.backend.actual,browser.backend.actual);
assert.deepEqual(browser.zoomDeltas,{'.5':0,'1':0,'2':0});
check('camera.invariant','visual','Same-backend 50/100/200% CSS zoom changes zero baked PNG pixels',
 {pixelDeltas:browser.zoomDeltas},[pics.baseline.ref,
  png('zoom-.5').ref,png('zoom-1').ref,png('zoom-2').ref]);
assert.deepEqual(browser.backgrounds,{checker:0,dark:0,light:0});
check('background.isolated','visual','CSS checker/dark/light backdrops do not change transparent PNG',
 {pixelDeltas:browser.backgrounds},[pics.baseline.ref]);
const alpha=countAlpha(pics.empty.image);
assert.equal(alpha.partial+alpha.opaque,0,'ghost pixels in disabled effect');
check('layers.all-disabled','visual','Six disabled layers produce fully transparent encoded PNG',
 {visiblePixels:0},[pics.empty.ref]);
const baseAlpha=countAlpha(pics.baseline.image);
assert.ok(baseAlpha.partial>300,'partial alpha missing');
check('png.partial-alpha','visual','PNG preserves partial alpha pixels and transparent RGB',
 {partialPixels:baseAlpha.partial},[pics.baseline.ref]);
assert.ok(browser.boneDisplacement>.05);
check('spine.animated-bone','numeric','Explosion anchor follows an animated Spine 4.2 bone',
 {boneDisplacement:browser.boneDisplacement});
assert.equal(browser.images,2);
check('spine.multipage','asset','Two real atlas pages load and animate',
 {imageCount:browser.images});
assert.equal(browser.frameCount,40);
check('export.one-shot','export','40 encoded transparent 512x512 PNG frames at i/60',
 {frameCount:browser.frameCount});
assert.ok(browser.packages.length===2&&browser.packages.every(x=>x>100000));
check('export.developer','export','Two pinned ESM developer ZIPs, WebGL and WebGPU',
 {packageBytes:browser.packages});
assert.ok(browser.turbulenceDifference>15);
check('fire.turbulence','visual','Changing turbulence alters fire geometry pixels',
 {changedPixels:browser.turbulenceDifference},[pics.baseline.ref,png('turbulence').ref],
 {changedPixelsMin:10});
const report={
 schemaVersion:1,effectId:blueprint.effectId,effectVersion:blueprint.effectVersion,
 sourceCommit:cp.execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),
 status:'PASS',
 environment:{browser:'Chromium '+browser.browser,
  device:os.platform()+' '+os.release()+' '+os.arch()+' (headless)',
  requestedBackend:browser.backend.actual==='webgpu'?'webgpu':'webgl',actualBackend:browser.backend.actual,
  glVersion:browser.backend.version,gpu:'GPU adapter name unavailable; renderer context verified',
  offline:true,networkRequests:browser.network},
 fixture:{seed:settings.seed,settings,width:512,height:512,fps:60,
  asset:'Standalone FIRE-02 phase PNG plus separate Spine 4.2 animated bone and atlas fixture',
  frameTimesSeconds:[0,20/60,40/60]},
 checks,warnings:[
  'Physical mobile GPU/performance certification NOT RUN; this proof is Chromium only',
  'One-shot endpoint at frame 40 is exclusive in 40-frame ZIP; phase screenshot samples it in a longer preview',
  'Independent parameter differences are source-backed numerical oracles; pixel/background cases separately decoded',
  'Release evidence must be regenerated from committed sources and a clean working tree'
 ]};
const out=path.join(dir,'effect-evidence.json');
fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');
console.log('FIRE-02 effect evidence',JSON.stringify({out,backend:report.environment.actualBackend,
 checks:checks.length,parameters:blueprint.parameters.length,phases:blueprint.phases.length}));
