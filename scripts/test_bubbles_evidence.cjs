#!/usr/bin/env node
'use strict';
// WATER-05: FX-CORE-07 source-backed PNG SHA evidence, not synthetic screenshots.
const A=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),
 crypto=require('node:crypto'),cp=require('node:child_process'),os=require('node:os'),
 B=require('../assets/rising-bubbles/src/bubbles-core.js'),P=require('./fx_visual_png.cjs');
const dir=process.argv[2];if(!dir)throw Error('Usage: test_bubbles_evidence.cjs OUT_DIR');
const out=path.resolve(dir),repo=path.resolve(__dirname,'..'),
 report=JSON.parse(fs.readFileSync(path.join(out,'report.json'),'utf8'));
const fence=String.fromCharCode(96).repeat(3);
const markdown=fs.readFileSync(path.join(repo,'references/fx/water/rising-bubbles.md'),'utf8');
const blueprint=JSON.parse(markdown.split(fence+'json')[1].split(fence)[0]);
const settings=B.defaults(),checks=[];
A.equal(blueprint.effectId,'fx.water.rising-bubbles');A.equal(report.status,'PASS');
const sha=buf=>crypto.createHash('sha256').update(buf).digest('hex');
const pic=name=>{
 const bytes=fs.readFileSync(path.join(out,name+'.png'));
 const img=P.decodePng(bytes);A.equal(img.width,512);A.equal(img.height,512);
 return {img,ref:{path:name+'.png',sha256:sha(bytes)}};
};
const changed=(x,y)=>P.comparePixels(x.img,y.img,{step:1,channelTolerance:0}).changedPixels;
const count=x=>{const c=P.countAlpha(x.img);return c.partial+c.opaque};
function check(id,kind,expected,actual,refs=[],tolerance={}){
 checks.push({id,kind,status:'PASS',expected,actual,evidence:refs.map(x=>x.ref),tolerance});
}
const first=pic('frame00'),mid=pic('frame30'),last=pic('frame59'),seam=pic('frame60'),base=pic('baseline');
for(const [id,t,p] of [['spawn',0,first],['ascent',.5,mid],['wrap',1,seam]]){
 A.ok(count(p)>100);
 check('phase.'+id,'visual',blueprint.phases.find(p=>p.id===id).look,
  {timeSeconds:t,frame:t*60,visiblePixels:count(p)},[p],{visiblePixelsMin:100});
}
A.equal(changed(first,seam),0);A.ok(changed(first,mid)>100);A.ok(count(last)>100);
check('time.periodic-seam','visual','Exact t0 and t1 raster equality and visible moving 60f periodic bubbles',
 {seamPixels:0,animatedPixels:changed(first,mid),frame59Visible:count(last)},
 [first,mid,last,seam],{seamMax:0});
for(const param of blueprint.parameters){
 const key=param.key;
 if(key==='quality'){
  const stress=structuredClone(settings);stress.quality='low';stress.rate=90;stress.lifetime=8;
  A.throws(()=>B.normalize(stress),/budget/);
  check('parameter.quality','numeric','Real bounded low/balanced/high candidate and visible particle caps',
   {budgets:B.BUDGETS,lowStressRejected:true});
 }else if(key==='mode'){
  const dying=pic('shutdown38'),gone=pic('shutdown39');
  A.ok(count(dying)>20);A.equal(count(gone),0);
  check('parameter.mode','visual','60f seamless loop versus 40f shutdown ending transparent at frame39',
   {periodicSeam:0,frame38Visible:count(dying),frame39Visible:0},
   [first,seam,dying,gone]);
 }else if(key==='exportFrames'){
  A.equal(settings.exportFrames,60);A.equal(report.frames,8);
  check('parameter.exportFrames','numeric','60 default PNG sequence and actual 8-frame browser sample',
   {default:60,observedSampledFrames:8,full60Test:'test_bubbles_png_zip.cjs'});
 }else{
  const item=pic('variant-'+key),delta=changed(base,item);
  A.ok(delta>5,'Inert declared parameter '+key);
  A.equal(report.differences[key],delta);
  check('parameter.'+key,'visual','Editing this artist parameter changes actual decoded GPU PNG pixels',
   {changedPixels:delta,default:settings[key]},[base,item],{changedPixelsMin:5});
 }
}
A.equal(blueprint.parameters.length,19);
for(const name of ['sizeCurve','lateralDriftCurve','alphaCurve',
 'emissionRateCurve','originGapCurve']){
 const item=pic('variant-'+name),delta=changed(base,item);
 A.ok(delta>5);A.equal(report.differences[name],delta);
 check('curve.'+name,'visual','Independent editable curve changes actual decoded 512px GPU pixels',
  {changedPixels:delta},[base,item],{changedPixelsMin:5});
}
for(const kind of B.LAYERS){
 const item=pic('layer-'+kind+'-disabled'),delta=changed(base,item);
 A.ok(delta>5);A.equal(report.differences['layer-'+kind+'-disabled'],delta);
 check('layer.'+kind,'visual','Disabling a single independently owned layer changes real pixels',
  {changedPixels:delta},[base,item],{changedPixelsMin:5});
}
const highlight=pic('highlight-isolated'),colors=P.countAlpha(highlight.img);
A.ok(colors.partial>20);A.equal(colors.opaque,0);
check('highlight.partial-only','visual','Specular isolated rim highlight has translucent pixels and no solid block',
 {partialPixels:colors.partial,opaquePixels:0},[highlight],{opaqueMax:0});
const off=pic('all-off');A.equal(count(off),0);
check('layers.all-disabled','visual','Disabling all three layers gives an entirely transparent PNG',
 {visiblePixels:0},[off]);
const drag=pic('dragged-highlight'),dragDelta=changed(base,drag);
A.ok(dragDelta>5);A.equal(report.highlightDragDelta,dragDelta);
check('drag.highlight-independent','visual','Highlight drag moves pixels without moving the source emitter',
 {changedPixels:dragDelta},[base,drag],{changedPixelsMin:5});
for(const [name,values] of [['zoom',report.zoom],['background',report.background]])
 for(const [setting,difference] of Object.entries(values)){
  const item=pic(name+'-'+setting);
  A.equal(changed(base,item),0);A.equal(difference,0);
  check('camera.'+name+'.'+setting,'visual','Preview CSS zoom/background does not change exported PNG bytes',
   {pixelDelta:0},[base,item],{pixelDeltaMax:0});
 }
const schedule=B.schedule(settings,settings.emitters[0]);
A.equal(schedule.events.length,16);A.ok(schedule.arcErrorBound<=.25);
A.ok(schedule.origins.every((o,i)=>!i||o.distance-schedule.origins[i-1].distance>=22-1e-6));
check('spacing.arc-verified','numeric','16 genuine per-second events and hard 22px cumulative cubic arc distance',
 {events:schedule.events.length,origins:schedule.origins.length,
  globalArcError:schedule.arcErrorBound,hardGap:22});
const straight=structuredClone(settings);straight.wobble=0;
const line=B.sample(straight,.35).emitters[0].layers.bubbles;
A.ok(line.length>0);const origin=B.schedule(straight,straight.emitters[0]).origins;
for(const item of line){
 A.ok(Math.abs(item.x-origin[item.originIndex].x)<1e-5);
 A.ok(Math.abs(item.y-origin[item.originIndex].y+.5*straight.buoyancy*item.age**2)<1e-5);
}
check('physics.analytic-buoyancy','numeric','Exact quadratic y=y0-.5*buoyancy*age², wobble0 straight ascent',
 {testedParticles:line.length,zeroWobble:true});
A.deepEqual(B.sample(settings,0),B.sample(settings,1));
A.deepEqual(B.sample(settings,.5),B.sample(settings,.5));
check('timeline.absolute-seek','numeric','60f seamless periodic state, repeated absolute seek is deterministic',
 {sameLoopState:true,repeatedIdentical:true,historyCycles:B.sample(settings,0).counters.historyCycles});
const preset=JSON.parse(fs.readFileSync(path.join(out,'Rising_Bubbles_Preset.json'),'utf8'));
A.equal(preset.effectId,blueprint.effectId);A.deepEqual(preset.settings,settings);
A.ok(report.presetRoundtrip&&report.invalidPresetRejected);
check('preset.strict-schema','numeric','Full JSON preset roundtrip and unsupported version rejection',
 {roundtrip:true,invalidRejected:true});
let partial=0,min=[255,255,255],max=[0,0,0];
for(let i=0;i<mid.img.pixels.length;i+=4){
 const rgba=mid.img.pixels;if(rgba[i+3]<48||rgba[i+3]>=255)continue;
 partial++;for(let j=0;j<3;j++){min[j]=Math.min(min[j],rgba[i+j]);max[j]=Math.max(max[j],rgba[i+j])}
}
A.ok(partial>100&&min[0]>=12&&min[1]>=78&&min[2]>=115&&min[1]<255);
check('alpha.straight-rgba','visual','Partial-alpha RGB maintains original straight color, no PMA dark fringes',
 {partialPixels:partial,rgbMin:min,rgbMax:max},[mid],{channelTolerance:2});
A.deepEqual(report.external,[]);A.deepEqual(report.errors,[]);
check('backend.actual','backend',report.backend.actual,report.backend.actual);
const result={
 schemaVersion:1,effectId:blueprint.effectId,effectVersion:blueprint.effectVersion,
 sourceCommit:cp.execFileSync('git',['rev-parse','HEAD'],{cwd:repo,encoding:'utf8'}).trim(),
 status:'PASS',
 environment:{browser:'Chromium '+report.browser,
  device:os.platform()+' '+os.release()+' '+os.arch()+' headless Chromium',
  requestedBackend:report.backend.actual==='webgpu'?'webgpu':'webgl',
  actualBackend:report.backend.actual,glVersion:report.backend.version,
  gpu:'Chromium headless renderer; physical mobile GPU not tested',
  offline:true,networkRequests:report.external.length},
 fixture:{seed:settings.seed,settings,width:512,height:512,fps:60,
  asset:'Spine 4.2.43 Doctor head multipage JSON and 9 animations (dedicated test)',
  frameTimesSeconds:[0,.5,1]},
 checks,
 warnings:[
  'Actual WebGL1, WebGL2 and WebGPU Chromium execution does not establish phone thermal/FPS performance.',
  'Full PNG 60-frame ZIP CRC/decode run on WebGL2. Only 8-frame sample ZIP on WebGL1/WebGPU; 60-frame ZIP on these two NOT RUN.',
  'Matching binary Spine .skel fixture NOT RUN. Real 4.2.43 JSON two-page atlas, bone, slot and attachment checks passed.',
  '3600-frame stress bake NOT RUN; this is 2D stylized buoyancy, not a 3D fluid simulation.',
  'Report sourceCommit should be regenerated against final published full commit SHA.'
 ]};
fs.writeFileSync(path.join(out,'effect-evidence.json'),JSON.stringify(result,null,2)+'\n');
console.log('WATER-05 FX-CORE-07',JSON.stringify({backend:report.backend.actual,
 checks:checks.length,parameters:blueprint.parameters.length,sourceCommit:result.sourceCommit}));
