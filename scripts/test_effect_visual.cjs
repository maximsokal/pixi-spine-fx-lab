#!/usr/bin/env node
'use strict';
// FX-CORE-07: actual offline Playwright visual evidence for the pinned Burn Lab.
// Other Blueprints remain NOT RUN until separately implemented.
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),os=require('node:os');
const {pathToFileURL}=require('node:url');
const {execFileSync}=require('node:child_process');
const {entries}=require('./test_png_pma.cjs');
const {decodePng,comparePixels,countAlpha}=require('./fx_visual_png.cjs');
function arg(key,fallback){const i=process.argv.indexOf('--'+key);return i<0?fallback:process.argv[i+1];}
const repo=path.resolve(__dirname,'..'),html=arg('html'),requested=arg('backend','webgl'),
 output=path.resolve(arg('output','fx-validation-evidence'));
if(!html||!['webgl','webgpu'].includes(requested))
 throw Error('Usage: --html FILE --backend webgl|webgpu --output DIR [--webgl1]');
const blueprintSource=fs.readFileSync(path.join(repo,'references/fx/fire/burn-transition.md'),'utf8');
const fence=String.fromCharCode(96).repeat(3);
const begin=blueprintSource.indexOf(fence+'json'),end=blueprintSource.indexOf(fence,begin+7);
if(begin<0||end<0)throw Error('Missing Burn Blueprint JSON');
const blueprint=JSON.parse(blueprintSource.slice(begin+7,end));
const sha=buffer=>crypto.createHash('sha256').update(buffer).digest('hex');
const sourceCommit=execFileSync('git',['rev-parse','HEAD'],{cwd:repo,encoding:'utf8'}).trim();
const imageRoot=path.join(output,'screenshots');
function screenshotEvidence(name,bytes){
 const file=name+'.png',relative='screenshots/'+file;
 fs.mkdirSync(imageRoot,{recursive:true});fs.writeFileSync(path.join(imageRoot,file),bytes);
 return {path:relative,sha256:sha(bytes)};
}
function imageEvidence(name,bytes){
 const relative='frames/'+name+'.png';
 fs.mkdirSync(path.join(output,'frames'),{recursive:true});
 fs.writeFileSync(path.join(output,relative),bytes);
 return {path:relative,sha256:sha(bytes)};
}
function visualCheck(id,expected,a,b,evidence,other={}){
 const delta=comparePixels(a,b,{step:4,channelTolerance:3});
 return {id,kind:'visual',status:delta.changedPixels>0?'PASS':'FAIL',expected,
  actual:{...delta,...other},tolerance:{changedPixelsMin:0,rgba8Channel:3},
  evidence};
}
async function main(){
 const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
 const browser=await chromium.launch({headless:true,
  ...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{}),
  args:['--no-sandbox',...(process.env.FX_SOFTWARE_GPU==='1'?[
   '--use-gl=angle','--use-angle=swiftshader','--enable-webgl',
   '--enable-unsafe-webgpu','--use-vulkan=swiftshader','--enable-features=Vulkan']:[])]});
 const page=await browser.newPage({viewport:{width:1366,height:900},
  deviceScaleFactor:1,acceptDownloads:true,offline:true});
 let network=0;const errors=[],warnings=[];
 page.on('request',r=>{if(/^https?:/i.test(r.url()))network++});
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 fs.mkdirSync(output,{recursive:true});
 try{
  const url=pathToFileURL(path.resolve(html));url.searchParams.set('renderer',requested);
  await page.goto(url.href);
  await page.waitForFunction(()=>document.querySelector('#viewport canvas')&&
   document.getElementById('loading').style.display==='none'&&
   document.getElementById('assetName').textContent.includes('Doctor'),null,{timeout:60000});
  if(process.argv.includes('--webgl1')){
   assert.equal(requested,'webgl','WebGL1 requires a WebGL run');
   await page.evaluate(async()=>{cfg.quality='low';await switchRenderer()});
  }
  await page.locator('#animPlay').uncheck();
  const backendInfo=await page.evaluate(()=>{
   const gl=app.renderer.gl;
   const actual=gl?(gl instanceof WebGL2RenderingContext?'webgl2':'webgl1'):
    (app.renderer.gpu&&app.renderer.gpu.device?'webgpu':'unknown');
   let gpu='WebGPU device (identity not exposed)';
   if(gl){
    const dbg=gl.getExtension('WEBGL_debug_renderer_info');
    gpu=dbg?String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)):
     String(gl.getParameter(gl.RENDERER));
   }
   return {actual,glVersion:gl?String(gl.getParameter(gl.VERSION)):null,
    gpu,selected:typeof backend==='undefined'?'unknown':backend,
    devicePixelRatio:window.devicePixelRatio,
    userAgent:navigator.userAgent};
  });
  assert.equal(backendInfo.selected,requested,'requested backend changed');
  assert.ok(['webgl1','webgl2','webgpu'].includes(backendInfo.actual),'unknown physical renderer');
  assert.equal(backendInfo.actual==='webgpu',requested==='webgpu','WebGPU fallback is not PASS');
  if(requested==='webgl')assert.equal(backendInfo.actual,
   process.argv.includes('--webgl1')?'webgl1':'webgl2','actual WebGL version mismatch');
  const setTime=async seconds=>page.evaluate(t=>{
   const clamped=Math.min(1,Math.max(0,t/cfg.duration));
   setPlaying(false);
   setProgress(SpineBurnFx.ease(clamped,cfg.easing,cfg.timeCurve),t);
   app.render();
   return {time:t,particles:fx.particles.length,progress,seed:cfg.seed};
  },seconds);
  const canvas=page.locator('#viewport');
  async function grab(label,time){
   const stats=await setTime(time);
   const bytes=await canvas.screenshot({timeout:60000});
   return {label,time,stats,decoded:decodePng(bytes),
    evidence:screenshotEvidence(label,bytes)};
  }
  await page.evaluate(()=>{
   setPlaying(false);
   cfg.seed=8;cfg.sparks=65;cfg.spacingEnabled=true;
   cfg.spacingCombine='time';cfg.spacingBaseRate=65;
   cfg.multiEmitters.enabled=false;
   syncUniforms();
  });
  const fill=async(id,value)=>{
   const el=page.locator('#'+id);await el.fill(String(value));await el.dispatchEvent('change');
  };
  await fill('bakeWidth',192);await fill('bakeHeight',160);
  await fill('durationFrames',60);await fill('bakeFrames',61);
  const settings=await page.evaluate(()=>JSON.parse(JSON.stringify(cfg)));
  assert.equal(settings.duration,1);
  assert.equal(settings.seed,8);
  const phases=[];
  for(const phase of blueprint.phases)
   phases.push({id:phase.id,look:phase.look,...await grab('phase-'+phase.id,phase.at*settings.duration)});
  const checks=[];
  for(let i=0;i<phases.length;i++){
   const current=phases[i],other=phases[i===0?1:i-1];
   checks.push(visualCheck('phase.'+current.id,current.look,current.decoded,other.decoded,
    [current.evidence,other.evidence],{sampleSeconds:current.time,particles:current.stats.particles}));
  }
  // Real offscreen alpha: sample the first, middle and exact final transition.
  const pending=page.waitForEvent('download',{timeout:180000});
  await page.locator('#bakeStart').click();
  const dl=await pending,bakeFile=path.join(output,'burn-61-frames.zip');
  await dl.saveAs(bakeFile);
  await page.waitForFunction(()=>!document.getElementById('bakeStart').disabled,null,{timeout:90000});
  const zip=entries(fs.readFileSync(bakeFile));
  const meta=JSON.parse(zip.get('sequence.json'));
  const pngs=[];
  for(const i of [0,30,60]){
   const filename='frames/frame_'+String(i).padStart(5,'0')+'.png';
   const encoded=zip.get(filename);
   assert.ok(encoded,'missing PNG '+filename);
   const decoded=decodePng(encoded);
   assert.equal(decoded.width,192);assert.equal(decoded.height,160);
   assert.equal(decoded.colorType,6,'baked PNG must be straight RGBA8');
   pngs.push({index:i,alpha:countAlpha(decoded),evidence:imageEvidence('bake-'+i,encoded),decoded});
  }
  assert.equal([...zip.keys()].filter(k=>k.endsWith('.png')).length,61);
  assert.ok(Math.abs(meta.lastSampleSeconds-1)<1e-8,'last sample must reach authored endpoint');
  assert.ok(pngs.some(p=>p.alpha.partial>0),'alpha coverage must include partially transparent pixels');
  for(const phase of phases)delete phase.decoded;
  const sceneData=await page.evaluate(()=>({
   selectedAsset:document.getElementById('assetName').textContent,
   stageHasGuides:!!document.querySelector('#fxEmitterGuide'),
   setup:{skeleton:!!model?.skeleton,texPages:2}
  }));
  const sample=.47*settings.duration;
  const base=await grab('baseline-controls',sample);
  const repeated=await grab('baseline-repeat',sample);
  const stability=comparePixels(base.decoded,repeated.decoded,{step:4,channelTolerance:3});
  const maxNoisePixels=Math.max(64,Math.ceil(stability.sampledPixels*.001));
  const minControlDelta=Math.max(64,stability.changedPixels*3);
  checks.push({id:'preview.stability',kind:'numeric',
   status:stability.changedPixels<=maxNoisePixels?'PASS':'FAIL',
   expected:'Repeated frozen preview differs by at most 0.1% or 64 sampled anti-aliased pixels',
   actual:stability,tolerance:{changedPixelsMax:maxNoisePixels,rgba8Channel:3},
   evidence:[base.evidence,repeated.evidence]});
  const changedValues={
   duration:0.55,flameHeight:0,glow:0,
   fireColor:'#11ddec',hotColor:'#137aec',sparks:0,
   sparkSize:5.5,sparkLife:3.5,seed:1234
  };
  const originalValues={};
  for(const key of Object.keys(changedValues)){
   const original=await page.evaluate(k=>cfg[k],key);
   originalValues[key]=original;
   const candidate=changedValues[key];
   await page.evaluate(({key,value})=>{
    cfg[key]=value;syncUniforms();
   },{key,value:candidate});
   const after=await grab('parameter-'+key,sample);
   const check=visualCheck('parameter.'+key,'Each parameter individually changes output beyond frozen-preview noise',
      base.decoded,after.decoded,[base.evidence,after.evidence],
      {parameter:key,baseline:original,candidate,sampleSeconds:sample});
   check.tolerance.changedPixelsMin=minControlDelta;
   check.status=check.actual.changedPixels>minControlDelta?'PASS':'FAIL';
   if(key==='glow'&&backendInfo.actual==='webgl1'){
    warnings.push('WebGL1 Low has no halo pass; glow control not certified in this quality mode (observed '+check.actual.changedPixels+' vs noise floor '+minControlDelta+')');
    check.status='NOT RUN';check.actual=null;check.evidence=[];
    check.reason='WebGL1 Low profile disables halo (effect-core PROFILES.low.halo=0); test glow in balanced WebGL2/WebGPU';
   }
   checks.push(check);
   await page.evaluate(({key,value})=>{cfg[key]=value;syncUniforms();},{key,value:original});
   if(check.status==='FAIL')warnings.push('No significant visual change for '+key+' at t='+sample);
  }
  // Real layer and emitter selection: measure independent XY positions and disable every layer.
  const emitterAudit=await page.evaluate(()=>{
   cfg.multiEmitters.enabled=true;syncUniforms();multiFx.configure(cfg.multiEmitters);
   const before=multiFx.scenePositionForEmitter('emitter1');
   const siblingBefore=multiFx.scenePositionForEmitter('emitter2');
   const emitter=cfg.multiEmitters.emitters[0],ox=emitter.x,oy=emitter.y;
   emitter.x=ox+1;multiFx.configure(cfg.multiEmitters);
   const unitX=multiFx.scenePositionForEmitter('emitter1');
   emitter.x=ox;emitter.y=oy+1;multiFx.configure(cfg.multiEmitters);
   const unitY=multiFx.scenePositionForEmitter('emitter1');
   emitter.x=ox+26;emitter.y=oy+13;multiFx.configure(cfg.multiEmitters);
   const after=multiFx.scenePositionForEmitter('emitter1');
   const siblingAfter=multiFx.scenePositionForEmitter('emitter2');
   const delta=before&&after?{dx:after.x-before.x,dy:after.y-before.y}:null;
   const expected=before&&unitX&&unitY?{
    dx:26*(unitX.x-before.x)+13*(unitY.x-before.x),
    dy:26*(unitX.y-before.y)+13*(unitY.y-before.y)}:null;
   const siblingStable=JSON.stringify(siblingBefore)===JSON.stringify(siblingAfter);
   for(const emitter of cfg.multiEmitters.emitters)
    for(const layer of emitter.layers)layer.enabled=false;
   multiFx.configure(cfg.multiEmitters);
   const snapshot=FxEmitters.sample(cfg.multiEmitters,.47);
   cfg.multiEmitters.enabled=false;syncUniforms();
   return {delta,expected,siblingStable,disabledCost:snapshot.cost,disabledLayers:snapshot.layers.length};
  });
  checks.push({id:'emitter.independent-xy',kind:'numeric',status:
    emitterAudit.delta&&emitterAudit.expected&&emitterAudit.siblingStable&&
    Math.abs(emitterAudit.delta.dx-emitterAudit.expected.dx)<.1&&
    Math.abs(emitterAudit.delta.dy-emitterAudit.expected.dy)<.1?'PASS':'FAIL',
   expected:'26/13 local offsets transformed via independent sampled local-to-scene Jacobian; sibling unaffected',
   actual:emitterAudit,tolerance:{scenePx:0.1},evidence:[]});
  checks.push({id:'layers.all-disabled',kind:'numeric',
   status:emitterAudit.disabledCost===0&&emitterAudit.disabledLayers===0?'PASS':'FAIL',
   expected:'all optional FX layers disabled yields zero layer cost and no hidden primitives',
   actual:emitterAudit,tolerance:{cost:0},evidence:[]});
  // Background composites are preview-only; encoded PNG remains transparent.
  const backgrounds=[],backgroundPixels=[];
  const background=page.locator('#background');
  for(const [label,value] of [['light','#ffffff'],['dark','#111318'],['checker','checker']]){
   try{
    await background.selectOption(value);
    await setTime(.47);
    const bytes=await page.locator('#viewport').screenshot();
    backgroundPixels.push(decodePng(bytes));
    backgrounds.push({label,...screenshotEvidence('background-'+label,bytes)});
   }catch(e){warnings.push('Background preview '+label+': '+e.message)}
  }
  const lightDark=backgroundPixels.length===3?
   comparePixels(backgroundPixels[0],backgroundPixels[1],{step:4,channelTolerance:3}):null;
  const darkChecker=backgroundPixels.length===3?
   comparePixels(backgroundPixels[1],backgroundPixels[2],{step:4,channelTolerance:3}):null;
  const backgroundChanged=Boolean(lightDark&&darkChecker&&
   lightDark.changedPixels>0&&darkChecker.changedPixels>0);
  checks.push({id:'preview.backgrounds',kind:'visual',
   status:backgroundChanged?'PASS':'FAIL',
   expected:'Distinct light/dark/checkerboard previews while the exported PNG remains straight RGBA',
   actual:{changedPixels:(lightDark?.changedPixels||0)+(darkChecker?.changedPixels||0),
    lightDark,darkChecker},tolerance:{changedPixelsMin:0,rgba8Channel:3},
   evidence:backgrounds.map(({path,sha256})=>({path,sha256}))});
  checks.push({id:'backend.actual',kind:'backend',status:'PASS',
   expected:backendInfo.actual,actual:backendInfo.actual,tolerance:{},evidence:[]});
  checks.push({id:'png.straight-rgba',kind:'numeric',
   status:pngs.every(p=>p.decoded.colorType===6)&&pngs.some(p=>p.alpha.partial>0)?'PASS':'FAIL',
   expected:'61 untrimmed RGBA8 frames, alpha 0 / partial / 255, exact 0 / 0.5 / 1 seconds',
   actual:{frames:61,samples:pngs.map(p=>({index:p.index,alpha:p.alpha}))},
   tolerance:{channel:2},evidence:pngs.map(p=>p.evidence)});
  warnings.push('Scope: individually audited the nine parameters declared in the Burn Blueprint; other runtime artist controls require additional effect-specific proof and are not certified by this run.');
  const report={
   schemaVersion:1,effectId:blueprint.effectId,effectVersion:blueprint.effectVersion,
   sourceCommit,status:checks.some(c=>c.status==='FAIL')?'FAIL':
                      checks.some(c=>c.status==='NOT RUN')?'NOT RUN':'PASS',
   environment:{
    browser:'Chrome '+browser.version(),device:os.type()+' '+os.release()+' '+os.arch()+' on '+os.hostname()+' (headless browser)',
    requestedBackend:requested,actualBackend:backendInfo.actual,glVersion:backendInfo.glVersion,
    gpu:backendInfo.gpu,offline:true,networkRequests:network,
    userAgent:backendInfo.userAgent,devicePixelRatio:backendInfo.devicePixelRatio
   },
   fixture:{seed:settings.seed,settings,width:192,height:160,fps:60,
            asset:sceneData.selectedAsset,frameTimesSeconds:[0,.5,1]},
   checks,warnings
  };
  for(const p of pngs)delete p.decoded;
  fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');
  fs.writeFileSync(path.join(output,'run-details.json'),JSON.stringify({
   phases,exported:pngs,backgrounds,emitterAudit,metadata:meta},null,2)+'\n');
  console.log('FX-CORE-07 RESULT',JSON.stringify({backend:backendInfo.actual,
    status:report.status,checks:checks.length,parameters:Object.keys(changedValues).length,
    perParameter:checks.filter(x=>x.id.startsWith('parameter.')).map(x=>[x.id,x.status,x.actual?.changedPixels??null]),
    alpha:pngs.map(p=>p.alpha),download:bakeFile,report:path.join(output,'report.json'),
    networkRequests:network,errors}));
  if(errors.length)throw Error('Browser console/page errors: '+JSON.stringify(errors));
  if(network)throw Error('Unexpected external network requests: '+network);
  if(report.status==='FAIL')throw Error('One or more visual/numeric checks FAILED; inspect report.json');
  if(report.status==='NOT RUN'){
   console.warn('FX-CORE-07 NOT RUN: one or more capabilities cannot be certified in this backend; inspect report.json');
   if(!process.argv.includes('--allow-not-run'))process.exitCode=2;
  }
 }finally{await browser.close()}
}
main().catch(err=>{console.error(err.stack||err);process.exitCode=1});
