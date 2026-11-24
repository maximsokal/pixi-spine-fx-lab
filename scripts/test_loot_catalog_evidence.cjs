'use strict';
// GAME-12: real offline renderer evidence + explicit numerical witnesses.
const A=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process'),os=require('node:os'),{pathToFileURL}=require('node:url');
const L=require('../assets/loot-sparkle/src/loot-core.js'),P=require('./fx_visual_png.cjs');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),html=path.resolve(process.argv[2]),backend=process.argv[3],dir=path.resolve(process.argv[4]);
const doc=JSON.parse(fs.readFileSync(path.join(root,'references/fx/game/loot-sparkle.md'),'utf8').split(String.fromCharCode(96).repeat(3)+'json')[1].split(String.fromCharCode(96).repeat(3))[0]);
const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),base=L.defaults(),flat=(c,v)=>{c.defaultValue=v;for(const k of c.keys)k.y=v};
const times=Array.from({length:80},(_,i)=>i/120);
const project=p=>({rows:p.emitters.map(r=>({anchors:r.anchors,births:r.births,accepted:r.accepted,maxActive:r.maxActive})),frames:times.map(t=>p.sample(t).emitters.map(e=>e.layers))});
const cases={
 mode:[c=>{},c=>{c.mode='idle'}],quality:[c=>{c.spawnIntervalFrames=1;c.sparkleCount=80;c.emitters.push(L.newEmitter(1),L.newEmitter(2),L.newEmitter(3))},c=>{c.quality='low'}],
 durationFrames:[c=>{},c=>{c.durationFrames=60}],sparkleCount:[c=>{c.spawnIntervalFrames=1},c=>{c.sparkleCount=2}],
 sparkleSize:[c=>{},c=>{c.sparkleSize=16}],spawnIntervalFrames:[c=>{},c=>{c.spawnIntervalFrames=3}],lifetimeFrames:[c=>{},c=>{c.lifetimeFrames=9}],
 haloRadius:[c=>{c.emitters[0].layers.halo.enabled=true},c=>{c.haloRadius=80}],twinkleHz:[c=>{},c=>{c.twinkleHz=10}],
 spreadRadius:[c=>{},c=>{c.spreadRadius=90}],baseGapPx:[c=>{},c=>{c.baseGapPx=30}],minGapPx:[c=>{},c=>{c.minGapPx=40}],
 maxGapPx:[c=>{},c=>{c.maxGapPx=8}],spatialJitter:[c=>{c.distribution='random'},c=>{c.spatialJitter=.45}],
 distribution:[c=>{},c=>{c.distribution='random'}],timeJitter:[c=>{},c=>{c.timeJitter=.4}],
 minIntervalFrames:[c=>{},c=>{c.minIntervalFrames=12}],
 frequencySource:[c=>{flat(c.rateCurve,2);flat(c.intervalCurve,2)},c=>{c.frequencySource='rate'}],
 groupCount:[c=>{},c=>{c.groupCount=3}],groupDelayFrames:[c=>{c.groupCount=2},c=>{c.groupDelayFrames=2}],
 shineDelayFrames:[c=>{c.emitters[0].layers.sweep.enabled=true},c=>{c.shineDelayFrames=8}],seed:[c=>{},c=>{c.seed=39121}]
};
const curves={
 sizeCurve:[c=>{},c=>{c.sizeCurve.keys[1].y=.5}],alphaCurve:[c=>{},c=>{c.alphaCurve.keys[1].y=.4}],
 haloCurve:[c=>{c.emitters[0].layers.halo.enabled=true},c=>{c.haloCurve.keys[1].y=.2}],
 rateCurve:[c=>{c.frequencySource='rate'},c=>flat(c.rateCurve,2)],
 intervalCurve:[c=>{},c=>flat(c.intervalCurve,2)],spacingCurve:[c=>{},c=>flat(c.spacingCurve,36)],
 palette:[c=>{},c=>{c.palette.stops.forEach(s=>s.rgba=[24,98,220,.6])}]
};
(async()=>{
 fs.mkdirSync(dir,{recursive:true});
 const browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{}),args:['--no-sandbox','--enable-unsafe-webgpu']});
 try{
 const page=await browser.newPage({offline:true,viewport:{width:1400,height:1000}}),errors=[],network=[],checks=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))network.push(r.url())});
 await page.goto(pathToFileURL(html).href);await page.waitForFunction(()=>lootEditor.ready);
 await page.locator('#backend').selectOption(backend);await page.waitForFunction(b=>lootEditor.ready&&lootEditor.backend===b,backend);
 const check=(id,kind,expected,actual,evidence=[],tolerance={})=>checks.push({id,kind,status:'PASS',expected,actual,evidence,tolerance});
 const pictures=new Map();
 async function capture(name,cfg,t){
  const bytes=await page.evaluate(async({cfg,t,backend})=>{
   const s=await FxLootBake.sceneFactory()({settings:cfg,backend,crop:{x:0,y:0,width:512,height:512}});
   try{return Array.from(await FxLootExport.encodePng(await s.readFrame(t)))}finally{s.destroy()}
  },{cfg,t,backend});
  const b=Buffer.from(bytes),image=P.decodePng(b),file=name+'.png';A.equal(image.width,512);A.equal(image.height,512);A.equal(image.colorType,6);
  fs.writeFileSync(path.join(dir,file),b);const c=P.countAlpha(image),p={image,ref:{path:file,sha256:sha(b)},visible:c.partial+c.opaque};pictures.set(name,p);return p;
 }
 for(const [id,t,minimum] of [['appear',0,0],['glint',19.5/60,1],['fade',39/60,0]]){
  const p=await capture(id,base,t);if(minimum)A.ok(p.visible>=minimum);else A.equal(p.visible,0);
  check('phase.'+id,'visual',doc.phases.find(x=>x.id===id).look,{timeSeconds:t,visiblePixels:p.visible},[p.ref]);
 }
 const idle=L.defaults();idle.mode='idle';idle.durationFrames=60;
 const i0=await capture('idle-start',idle,0),i1=await capture('idle-end',idle,1);
 A.ok(i0.visible>0);A.equal(P.comparePixels(i0.image,i1.image,{step:1,channelTolerance:0}).changedPixels,0);
 check('loop.seam','visual','Exact idle seam',{seamChangedPixels:0,visiblePixels:i0.visible},[i0.ref,i1.ref]);
 const all=L.defaults();for(const l of Object.values(all.emitters[0].layers))l.enabled=true;
 const both=await capture('all-enabled',all,.25);
 for(const key of L.LAYERS){const c=structuredClone(all);c.emitters[0].layers[key].enabled=false;const p=await capture('without-'+key,c,.25),n=P.comparePixels(both.image,p.image,{step:1,channelTolerance:0}).changedPixels;A.ok(n>0,key);check('layer.'+key,'visual','Independent mute changes pixels',{changedPixels:n},[both.ref,p.ref],{changedPixelsMin:1})}
 const off=structuredClone(all);for(const l of Object.values(off.emitters[0].layers))l.enabled=false;const blank=await capture('all-off',off,.25);A.equal(blank.visible,0);check('layers.all-off','visual','No hidden geometry',{visiblePixels:0},[blank.ref]);
 for(const [key,pair] of [...doc.parameters.map(p=>[p.key,cases[p.key]]),...Object.entries(curves)]){
  A.ok(pair,'Missing witness '+key);const a=L.defaults();pair[0](a);const b=structuredClone(a);pair[1](b);const before=L.compile(a);
  const id=(doc.parameters.some(p=>p.key===key)?'parameter.':'curve.')+key;
  if(key==='quality'){A.throws(()=>L.compile(b),/budget/);check(id,'numeric','Low capacity rejects stress',{reservedStars:before.reservedStars,lowLimit:L.BUDGETS.low.stars,rejected:true});continue}
  const after=L.compile(b),x=sha(JSON.stringify(project(before))),y=sha(JSON.stringify(project(after)));A.notEqual(x,y,'Inert '+key);
  check(id,'numeric','Actual schedule, anchor or sampled geometry changes',{beforeHash:x,afterHash:y,beforeBirths:before.emitters[0].births.length,afterBirths:after.emitters[0].births.length,beforeAnchors:before.emitters[0].anchors.length,afterAnchors:after.emitters[0].anchors.length});
 }
 // Check real editor backgrounds using non-empty phase and separate PNG evidence.
 await page.evaluate(()=>lootEditor.seek(.25));
 for(const mode of ['dark','light','checker']){
  await page.locator('#background').selectOption(mode);const b=await page.locator('#surface').screenshot(),f='background-'+mode+'.png';P.decodePng(b);fs.writeFileSync(path.join(dir,f),b);
    await page.evaluate(()=>lootEditor.seek(0));const empty=await page.locator('#surface').screenshot(),ef='background-empty-'+mode+'.png';fs.writeFileSync(path.join(dir,ef),empty);
  const changedPixels=P.comparePixels(P.decodePng(b),P.decodePng(empty),{step:1,channelTolerance:0}).changedPixels;A.ok(changedPixels>0);
  check('background.'+mode,'visual','Visible glint on actual preview background',{background:mode,changedPixels},[{path:f,sha256:sha(b)},{path:ef,sha256:sha(empty)}]);
  await page.evaluate(()=>lootEditor.seek(.25));
 }
 const inf=await page.evaluate(async backend=>{const app=new PIXI.Application();await app.init({width:1,height:1,autoStart:false,preference:backend==='webgpu'?'webgpu':'webgl',preferWebGLVersion:backend==='webgl1'?1:2});const r=app.renderer,gl=r.gl,actual=gl?(gl instanceof WebGL2RenderingContext?'webgl2':'webgl1'):'webgpu',version=gl?gl.getParameter(gl.VERSION):null,ext=gl?.getExtension('WEBGL_debug_renderer_info'),gpu=ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):r.gpu?.adapter?.info?.description||'unavailable';app.destroy(true,{children:true});return {actual,version,gpu}},backend);
 A.equal(inf.actual,backend);check('backend.actual','backend',backend,backend);A.deepEqual(errors,[]);A.deepEqual(network,[]);
 const report={schemaVersion:1,effectId:doc.effectId,effectVersion:doc.effectVersion,sourceCommit:cp.execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),status:'PASS',environment:{browser:browser.version(),device:os.platform()+' '+os.release(),requestedBackend:backend==='webgpu'?'webgpu':'webgl',actualBackend:backend,glVersion:inf.version,gpu:inf.gpu,offline:true,networkRequests:0},fixture:{seed:base.seed,settings:base,width:512,height:512,fps:60,asset:'none; separate matching Spine fixture suite',frameTimesSeconds:[0,19.5/60,39/60]},checks,warnings:['Declared-parameter/curve and phase evidence only; separate UI/Spine/export suites required. Physical mobile performance NOT RUN.']};
 fs.writeFileSync(path.join(dir,'report.json'),JSON.stringify(report,null,2));const r=cp.spawnSync('python',['scripts/effect_validation.py',path.join(dir,'report.json'),'--require-pass'],{cwd:root,encoding:'utf8'});A.equal(r.status,0,r.stdout+' '+r.stderr);console.log('PASS GAME-12 evidence',backend,checks.length,r.stdout.trim());
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
