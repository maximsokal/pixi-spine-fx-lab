'use strict';
// GAME-05: real offline renderer evidence + explicit numerical witnesses.
const A=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process'),os=require('node:os'),{pathToFileURL}=require('node:url');
const L=require('../assets/shockwave/src/shockwave-core.js'),P=require('./fx_visual_png.cjs');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),html=path.resolve(process.argv[2]),backend=process.argv[3],dir=path.resolve(process.argv[4]);
const doc=JSON.parse(fs.readFileSync(path.join(root,'references/fx/game/shockwave.md'),'utf8').split(String.fromCharCode(96).repeat(3)+'json')[1].split(String.fromCharCode(96).repeat(3))[0]);
const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),base=L.defaults(),flat=(c,v)=>{c.defaultValue=v;for(const k of c.keys)k.y=v};
const times=Array.from({length:80},(_,i)=>i/120);
const project=p=>times.map(t=>p.sample(t).emitters.map(e=>e.layers));
const layers=['primary','secondary','particles'];
const secondary=c=>{c.ringCount=3};
const particles=c=>{c.emitters[0].layers.particles.enabled=true};
const random=c=>{particles(c);c.distribution='random';c.spatialJitter=.3};
const jitter=c=>{secondary(c);c.timeJitter=.3};
const cases={
 startRadius:[c=>{},c=>{c.startRadius=20}],finalRadius:[c=>{},c=>{c.finalRadius=180}],
 ringWidth:[c=>{},c=>{c.ringWidth=24}],edgeSoftness:[c=>{},c=>{c.edgeSoftness=.1}],
 ringCount:[c=>{},c=>{c.ringCount=3}],ringDelayFrames:[secondary,c=>{c.ringDelayFrames=9}],
 radialGapPx:[secondary,c=>{c.radialGapPx=45}],arcGapPx:[particles,c=>{c.arcGapPx=40}],
 minIntervalFrames:[secondary,c=>{c.minIntervalFrames=8}],timeJitter:[secondary,c=>{c.timeJitter=.4}],
 spatialJitter:[random,c=>{c.spatialJitter=.45}],seed:[jitter,c=>{c.seed++}],
 distribution:[random,c=>{c.distribution='clustered'}],
 quality:[c=>{particles(c);c.arcGapPx=2},c=>{c.quality='low'}]
};
const curves={
 radiusCurve:[c=>{},c=>{c.radiusCurve.keys[1].y=.5}],
 widthCurve:[c=>{},c=>{c.widthCurve.keys[1].y=.2}],
 opacityCurve:[c=>{},c=>{c.opacityCurve.keys[1].y=.3}],
 intervalCurve:[secondary,c=>flat(c.intervalCurve,2)],
 arcSpacingCurve:[particles,c=>flat(c.arcSpacingCurve,2)],
 palette:[c=>{},c=>{c.palette.stops.forEach(s=>s.rgba=[24,98,220,.6])}]
};
(async()=>{
 const rel=path.relative(root,dir);A.ok(rel.startsWith('..'+path.sep)||path.isAbsolute(rel),'External evidence directory required');fs.mkdirSync(dir,{recursive:true});A.equal(fs.readdirSync(dir).length,0,'Empty evidence directory required');
 const browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{}),args:['--no-sandbox','--enable-unsafe-webgpu']});
 try{
 const page=await browser.newPage({offline:true,viewport:{width:1400,height:1000}}),errors=[],network=[],checks=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))network.push(r.url())});
 await page.goto(pathToFileURL(html).href);await page.waitForFunction(()=>document.body.dataset.ready==="true");
 await page.locator('#backend').selectOption(backend);await page.waitForFunction(b=>document.getElementById("backendActual").textContent===b.toUpperCase()&&!document.getElementById("backend").disabled,backend);
 const check=(id,kind,expected,actual,evidence=[],tolerance={})=>checks.push({id,kind,status:'PASS',expected,actual,evidence,tolerance});
 const pictures=new Map();
 async function capture(name,cfg,t){
  const bytes=await page.evaluate(async({cfg,t,backend})=>{
   const s=await FxShockwaveBake.sceneFactory()({settings:cfg,backend,crop:{x:0,y:0,width:512,height:512}});
   try{return Array.from(await FxShockwaveExport.encodePng(await s.readFrame(t)))}finally{s.destroy()}
  },{cfg,t,backend});
  const b=Buffer.from(bytes),image=P.decodePng(b),file=name+'.png';A.equal(image.width,512);A.equal(image.height,512);A.equal(image.colorType,6);
  fs.writeFileSync(path.join(dir,file),b);const c=P.countAlpha(image),p={image,ref:{path:file,sha256:sha(b)},visible:c.partial+c.opaque};pictures.set(name,p);return p;
 }
 for(const [id,t,minimum] of [['impact',0,1],['expansion',19.5/60,1],['dissipate',39/60,0]]){
  const p=await capture(id,base,t);if(minimum)A.ok(p.visible>=minimum);else A.equal(p.visible,0);
  check('phase.'+id,'visual',doc.phases.find(x=>x.id===id).look,{timeSeconds:t,visiblePixels:p.visible},[p.ref]);
 }
 const all=L.defaults();all.ringCount=3;for(const l of Object.values(all.emitters[0].layers))l.enabled=true;
 const both=await capture('all-enabled',all,.25);
 for(const key of layers){const c=structuredClone(all);c.emitters[0].layers[key].enabled=false;const p=await capture('without-'+key,c,.25),n=P.comparePixels(both.image,p.image,{step:1,channelTolerance:0}).changedPixels;A.ok(n>0,key);check('layer.'+key,'visual','Independent mute changes pixels',{changedPixels:n},[both.ref,p.ref],{changedPixelsMin:1})}
 for(const key of layers){const c=structuredClone(all);for(const [name,l] of Object.entries(c.emitters[0].layers))l.enabled=name===key;const p=await capture('only-'+key,c,.25);A.ok(p.visible>0,key);check('isolated.'+key,'visual','Visible isolated layer',{visiblePixels:p.visible},[p.ref]);}
 const off=structuredClone(all);for(const l of Object.values(off.emitters[0].layers))l.enabled=false;const blank=await capture('all-off',off,.25);A.equal(blank.visible,0);check('layers.all-off','visual','No hidden geometry',{visiblePixels:0},[blank.ref]);
 for(const [key,pair] of [...doc.parameters.map(p=>[p.key,cases[p.key]]),...Object.entries(curves)]){
  A.ok(pair,'Missing witness '+key);const a=L.defaults();pair[0](a);const b=structuredClone(a);pair[1](b);const before=L.createPlan(a);
  const id=(doc.parameters.some(p=>p.key===key)?'parameter.':'curve.')+key;
  if(key==='quality'){A.throws(()=>L.createPlan(b),/budget/);check(id,'numeric','Low capacity rejects stress',{reservedParticles:before.peakParticles,lowLimit:256,rejected:true});continue}
  const after=L.createPlan(b),x=sha(JSON.stringify(project(before))),y=sha(JSON.stringify(project(after)));A.notEqual(x,y,'Inert '+key);
  check(id,'numeric','Actual schedule, anchor or sampled geometry changes',{beforeHash:x,afterHash:y,beforeParticles:before.peakParticles,afterParticles:after.peakParticles});
 }
 // Check real editor backgrounds using non-empty phase and separate PNG evidence.
 await page.locator('#frame').evaluate(e=>{e.value='15';e.dispatchEvent(new Event('input',{bubbles:true}))});
 for(const mode of ['dark','light','checker']){
  await page.locator('#background').selectOption(mode);const b=await page.locator('#surface').screenshot(),f='background-'+mode+'.png';P.decodePng(b);fs.writeFileSync(path.join(dir,f),b);
    await page.locator('#frame').evaluate(e=>{e.value='39';e.dispatchEvent(new Event('input',{bubbles:true}))});const empty=await page.locator('#surface').screenshot(),ef='background-empty-'+mode+'.png';fs.writeFileSync(path.join(dir,ef),empty);
  const changedPixels=P.comparePixels(P.decodePng(b),P.decodePng(empty),{step:1,channelTolerance:0}).changedPixels;A.ok(changedPixels>0);
  check('background.'+mode,'visual','Visible pressure front on actual preview background',{background:mode,changedPixels},[{path:f,sha256:sha(b)},{path:ef,sha256:sha(empty)}]);
  await page.locator('#frame').evaluate(e=>{e.value='15';e.dispatchEvent(new Event('input',{bubbles:true}))});
 }
 const inf=await page.evaluate(async backend=>{const app=new PIXI.Application();await app.init({width:1,height:1,autoStart:false,preference:backend==='webgpu'?'webgpu':'webgl',preferWebGLVersion:backend==='webgl1'?1:2});const r=app.renderer,gl=r.gl,actual=gl?(gl instanceof WebGL2RenderingContext?'webgl2':'webgl1'):'webgpu',version=gl?gl.getParameter(gl.VERSION):null,ext=gl?.getExtension('WEBGL_debug_renderer_info'),gpu=ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):r.gpu?.adapter?.info?.description||'unavailable';app.destroy(true,{children:true});return {actual,version,gpu}},backend);
 A.equal(inf.actual,backend);check('backend.actual','backend',backend,backend);A.deepEqual(errors,[]);A.deepEqual(network,[]);
 const report={schemaVersion:1,effectId:doc.effectId,effectVersion:doc.effectVersion,sourceCommit:cp.execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),status:'PASS',environment:{browser:browser.version(),device:os.platform()+' '+os.release(),requestedBackend:backend==='webgpu'?'webgpu':'webgl',actualBackend:backend,glVersion:inf.version,gpu:inf.gpu,offline:true,networkRequests:0},fixture:{seed:base.seed,settings:base,width:512,height:512,fps:60,asset:'none; separate matching Spine fixture suite',frameTimesSeconds:[0,19.5/60,39/60]},checks,warnings:['Declared-parameter/curve and phase evidence only; separate UI/Spine/export suites required. Physical mobile performance NOT RUN.']};
 fs.writeFileSync(path.join(dir,'report.json'),JSON.stringify(report,null,2));const r=cp.spawnSync('python',['scripts/effect_validation.py',path.join(dir,'report.json'),'--require-pass'],{cwd:root,encoding:'utf8'});A.equal(r.status,0,r.stdout+' '+r.stderr);console.log('PASS GAME-05 evidence',backend,checks.length,r.stdout.trim());
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
