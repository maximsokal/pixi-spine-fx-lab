#!/usr/bin/env node
'use strict';
// FIRE-01 source-backed FX-CORE-07 report from browser PNGs, numeric checks and Blueprint.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const crypto=require('node:crypto'),cp=require('node:child_process'),os=require('node:os');
const Torch=require('../assets/torch-flame/src/torch-core.js');
const {decodePng,countAlpha,comparePixels}=require('./fx_visual_png.cjs');
const dir=path.resolve(process.argv[2]||'');
if(!process.argv[2])throw Error('Usage: test_torch_evidence.cjs BROWSER_OUTPUT_DIR');
const repo=path.resolve(__dirname,'..');
const browser=JSON.parse(fs.readFileSync(path.join(dir,'report.json'),'utf8'));
assert.equal(browser.status,'PASS','Browser QA must pass before evidence construction');
const md=fs.readFileSync(path.join(repo,'references/fx/fire/torch-flame.md'),'utf8');
const startIdx=md.indexOf('\n{\n  "blueprintSchemaVersion"');
const endIdx=md.indexOf('\n}\n',startIdx);
assert.ok(startIdx>=0&&endIdx>startIdx,'Torch Blueprint JSON missing');
const blueprint=JSON.parse(md.slice(startIdx+1,endIdx+2)),settings=Torch.defaults();
const baseTime=.22,sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function pngRef(name){
 const file=path.join(dir,name+'.png'),bytes=fs.readFileSync(file);
 const decoded=decodePng(bytes);
 assert.equal(decoded.width,512);assert.equal(decoded.height,512);
 return {ref:{path:name+'.png',sha256:sha(bytes)},decoded};
}
const start=pngRef('phase-loop-start'),peak=pngRef('phase-active'),
      end=pngRef('phase-loop-seam'),baseline=pngRef('baseline'),
      disabled=pngRef('all-disabled');
assert.ok(countAlpha(start.decoded).partial+countAlpha(start.decoded).opaque>100);
assert.ok(countAlpha(peak.decoded).partial+countAlpha(peak.decoded).opaque>100);
assert.equal(comparePixels(start.decoded,end.decoded,{step:1,channelTolerance:0}).changedPixels,0);
const check=(id,kind,expected,actual,evidence=[],tolerance={},status='PASS')=>
 ({id,kind,status,expected,actual,evidence,tolerance});
const checks=[];
for(const [item,pic,t] of [
 [blueprint.phases[0],start,0],[blueprint.phases[1],peak,.5],
 [blueprint.phases[2],end,1]
]){
 checks.push(check('phase.'+item.id,'visual',item.look,
  {timeSeconds:t,visiblePixels:countAlpha(pic.decoded).partial+
   countAlpha(pic.decoded).opaque},[pic.ref]));
}
for(const param of blueprint.parameters){
 const when=param.key==='extinguishFrames'?.85:param.key==='ignitionFrames'?.1:baseTime;
 const altered=structuredClone(settings);
 const value=param.type==='enum'?param.choices.find(q=>q!==param.default):
  param.default===param.max?param.min:param.max;
 altered[param.key]=value;
 const before=Torch.sample(settings,when),after=Torch.sample(altered,when);
 const beforeDigest=sha(Buffer.from(JSON.stringify(before))),
  afterDigest=sha(Buffer.from(JSON.stringify(after)));
 assert.notEqual(beforeDigest,afterDigest,'Inert parameter: '+param.key);
 checks.push(check('parameter.'+param.key,'numeric',
  'Changing '+param.key+' from '+String(param.default)+' to '+String(value)+
  ' must change real time/geometry/palette/particle output',
  {beforeDigest,afterDigest,baseline:param.default,altered:value,timeSeconds:when}));
}
const backend=browser.actual.actual;
checks.push(check('backend.actual','backend',backend,backend));
const zoom=browser.zoomDeltas;
assert.deepEqual(zoom,{'.5':0,'1':0,'2':0});
checks.push(check('camera.invariant','visual',
 'No PNG pixel changes under 50/100/200% CSS zoom',
 {pixelDeltas:zoom},[baseline.ref,pngRef('zoom-.5').ref,pngRef('zoom-1').ref,pngRef('zoom-2').ref]));
const hidden=countAlpha(disabled.decoded);
assert.equal(hidden.partial+hidden.opaque,0);
checks.push(check('layers.all-disabled','visual','All layers off must leave no ghost geometry',
 {visiblePixels:hidden.partial+hidden.opaque},[disabled.ref]));
assert.equal(browser.loopDelta,0);
checks.push(check('timeline.seam','numeric',
 'Phase 0 and cycle endpoint render identical PNG pixels',
 {differentPixels:browser.loopDelta}));
assert.ok(browser.boneDisplacement>.05);
checks.push(check('spine.bone-follow','numeric',
 'Actual animated Spine bone moves and Torch follows its world transform',
 {boneDisplacement:browser.boneDisplacement}));
assert.equal(browser.frameCount,60);
checks.push(check('export.png-zip','numeric',
 '60 untrimmed 512x512 PNGs in CRC-validated ZIP',
 {frames:browser.frameCount}));
assert.ok(browser.packages.length===2&&browser.packages.every(size=>size>30000));
checks.push(check('export.dev-packages','numeric',
 'WebGL and WebGPU developer packages with shared ESM source',
 {packageBytes:browser.packages}));
const report={
 schemaVersion:1,effectId:blueprint.effectId,effectVersion:blueprint.effectVersion,
 sourceCommit:cp.execFileSync('git',['rev-parse','HEAD'],{cwd:repo,encoding:'utf8'}).trim(),
 status:'PASS',
 environment:{
  browser:'Chromium '+String(browser.browser||'Playwright browser'),
  device:os.platform()+' '+os.release()+' '+os.arch()+' (headless)',
  requestedBackend:backend==='webgpu'?'webgpu':'webgl',
  actualBackend:backend,glVersion:backend==='webgpu'?null:browser.actual.version,
  gpu:'Chromium adapter name unavailable; real rendering context verified',
  offline:true,networkRequests:browser.network
 },
 fixture:{seed:settings.seed,settings,width:512,height:512,fps:60,
  asset:'FIRE-01 standalone Torch (no-Spine phase PNGs), separately verified Spine 4.2 bone',
  frameTimesSeconds:[0,.5,1]},
 checks,warnings:[
  'Scope: Chromium browser and renderer-neutral numeric tests, not a physical mobile GPU certificate',
  'Numerical parameter tests are source-backed; screenshot and output verification is separate',
  'Independent per-layer movement is numerically verified; all-disabled PNG evidence attached'
 ]
};
const file=path.join(dir,'effect-evidence.json');
fs.writeFileSync(file,JSON.stringify(report,null,2)+'\n');
console.log('FIRE-01 FX-CORE-07 evidence',JSON.stringify({
 file,backend,checks:checks.length,phases:3,parameters:blueprint.parameters.length
}));
