'use strict';
// GAME-07: real offline renderer evidence + explicit numerical witnesses.
const A=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process'),os=require('node:os'),{pathToFileURL}=require('node:url');
const L=require('../assets/teleport-dash/src/dash-core.js'),P=require('./fx_visual_png.cjs');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),html=path.resolve(process.argv[2]),backend=process.argv[3],dir=path.resolve(process.argv[4]);
const doc=JSON.parse(fs.readFileSync(path.join(root,'references/fx/game/teleport-dash.md'),'utf8').split(String.fromCharCode(96).repeat(3)+'json')[1].split(String.fromCharCode(96).repeat(3))[0]);
const E=require('../assets/teleport-dash/src/dash-editor-state.js');
const none=c=>{},distance=c=>{c.echoMode='distance'},rate=c=>{c.frequencySource='rate'},burst=c=>{c.temporalEchoGap=8;c.burstCount=2;c.burstDelayFrames=1},teleport=c=>{c.mode='teleport'},jitter=c=>{distance(c);c.distribution='random'},flat=(c,v)=>{c.defaultValue=v;for(const k of c.keys)k.y=v};
const cases={
 mode:[none,c=>{c.mode='teleport'}],durationFrames:[none,c=>{c.durationFrames=60}],teleportFrame:[teleport,c=>{c.teleportFrame=22}],
 dashLength:[none,c=>E.scalePath(c,250)],afterimageCount:[none,c=>{c.afterimageCount=9}],temporalEchoGap:[none,c=>{c.temporalEchoGap=5}],spatialEchoGap:[distance,c=>{c.spatialEchoGap=25}],trailWidth:[none,c=>{c.trailWidth=40}],afterimageAlpha:[none,c=>{c.afterimageAlpha=.2}],echoLifetimeFrames:[none,c=>{c.echoLifetimeFrames=8}],
 echoMode:[none,distance],frequencySource:[c=>{c.echoRate=12},rate],echoRate:[rate,c=>{c.echoRate=12}],burstCount:[c=>{c.temporalEchoGap=8;c.burstDelayFrames=1},c=>{c.burstCount=2}],burstDelayFrames:[burst,c=>{c.burstDelayFrames=2}],minIntervalFrames:[none,c=>{c.minIntervalFrames=5}],timeJitter:[none,c=>{c.timeJitter=.3}],
 minGapPx:[distance,c=>{c.minGapPx=24}],maxGapPx:[distance,c=>{c.maxGapPx=8}],spatialJitter:[jitter,c=>{c.spatialJitter=.35}],distribution:[c=>{distance(c);c.spatialJitter=.3},c=>{c.distribution='random'}],
 particleCount:[none,c=>{c.particleCount=24}],particleLifetimeFrames:[none,c=>{c.particleLifetimeFrames=20}],particleSize:[none,c=>{c.particleSize=4}],flashLifetimeFrames:[none,c=>{c.flashLifetimeFrames=12}],flashRadius:[none,c=>{c.flashRadius=45}],seed:[none,c=>{c.seed++}],quality:[c=>{c.afterimageCount=24;c.temporalEchoGap=1},c=>{c.quality='low'}]
};
const curves={
 progressCurve:[none,c=>{c.progressCurve.keys[1].y=.25}],widthCurve:[none,c=>flat(c.widthCurve,.5)],echoAlphaCurve:[none,c=>flat(c.echoAlphaCurve,.4)],rateCurve:[rate,c=>flat(c.rateCurve,2)],intervalCurve:[none,c=>flat(c.intervalCurve,2)],spacingCurve:[distance,c=>flat(c.spacingCurve,24)],palette:[none,c=>{c.palette.stops.forEach(s=>s.rgba=[245,90,36,.5])}],path:[none,c=>E.movePathPoint(c,0,'p1',[60,60])]
};
function project(p){return {travel:p.travelLength,rows:p.emitters,samples:Array.from({length:121},(_,i)=>p.sample(i/120).emitters.map(e=>e.layers))};}
function witnesses(assert,hash){
 const results=[];
 for(const [key,pair] of [...Object.entries(cases),...Object.entries(curves)]){
  let a=L.defaults();a=pair[0](a)||a;let b=JSON.parse(JSON.stringify(a));b=pair[1](b)||b;const before=L.compile(a);
  const id=(Object.hasOwn(cases,key)?'parameter.':'curve.')+key;
  if(key==='quality'){assert.throws(()=>L.compile(b),/echo budget/);results.push({id,actual:{baselineEchoes:before.emitters[0].echoes.length,lowLimit:8,rejected:true}});continue;}
  const x=hash(JSON.stringify(project(before))),y=hash(JSON.stringify(project(L.compile(b))));assert.notEqual(x,y,'inert '+key);results.push({id,actual:{beforeHash:x,afterHash:y}});
 }
 return results;
}
const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),base=L.defaults(),layers=L.LAYERS;
(async()=>{
 const rel=path.relative(root,dir);A.ok(rel.startsWith('..'+path.sep)||path.isAbsolute(rel),'External evidence directory required');fs.mkdirSync(dir,{recursive:true});A.equal(fs.readdirSync(dir).length,0,'Empty evidence directory required');
 const browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{}),args:['--no-sandbox','--enable-unsafe-webgpu']});
 try{
 const page=await browser.newPage({offline:true,viewport:{width:1440,height:1000}}),errors=[],network=[],checks=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))network.push(r.url());});
 await page.goto(pathToFileURL(html).href);await page.waitForSelector('body[data-ready=true]');
 await page.locator('#backend').selectOption(backend);await page.waitForFunction(b=>document.getElementById('backendActual').textContent===b.toUpperCase()&&!document.getElementById('settingsPanel').disabled,backend);
 const check=(id,kind,expected,actual,evidence=[],tolerance={})=>checks.push({id,kind,status:'PASS',expected,actual,evidence,tolerance});
 function save(name,b){const image=P.decodePng(b),file=name+'.png';fs.writeFileSync(path.join(dir,file),b);const c=P.countAlpha(image);return {image,ref:{path:file,sha256:sha(b)},visible:c.partial+c.opaque};}
 async function capture(name,cfg,t){const bytes=await page.evaluate(async({cfg,t,backend})=>{
  const data=JSON.parse(document.getElementById('sampleData').textContent),source={name:data.skeletonName,skeleton:new Blob([JSON.stringify(data.skeleton)]),atlas:new Blob([data.atlas]),images:new Map(Object.entries(data.images).map(([n,b])=>[n,new Blob([Uint8Array.from(atob(b),c=>c.charCodeAt(0))],{type:'image/png'})]))};
  const s=await FxDashBake.sceneFactory({source,poseOptions:{visible:false,animation:'attack_1'}})({settings:cfg,backend,crop:{x:0,y:0,width:512,height:512}});try{return Array.from(await FxDashExport.encodePng(await s.readFrame(t)));}finally{s.destroy();}
 },{cfg,t,backend});const p=save(name,Buffer.from(bytes));A.equal(p.image.width,512);A.equal(p.image.height,512);A.equal(p.image.colorType,6);return p;}
 for(const [id,t,min] of [['start',0,0],['peak',19.5/60,1],['end',39/60,0]]){const p=await capture(id,base,t);if(min)A.ok(p.visible>0);else A.equal(p.visible,0);check('phase.'+id,'visual',doc.phases.find(x=>x.id===id).look,{timeSeconds:t,visiblePixels:p.visible},[p.ref]);}
 for(const key of layers){const t=(key==='flash'?3:15)/60,both=await capture('all-'+key,base,t),c=structuredClone(base);c.emitters[0].layers[key].enabled=false;const muted=await capture('without-'+key,c,t),n=P.comparePixels(both.image,muted.image,{step:1,channelTolerance:0}).changedPixels;A.ok(n>0,key);check('layer.'+key,'visual','Independent mute changes pixels',{changedPixels:n},[both.ref,muted.ref],{changedPixelsMin:1});
 const solo=structuredClone(base);for(const [k,l] of Object.entries(solo.emitters[0].layers))l.enabled=k===key;const p=await capture('only-'+key,solo,t);A.ok(p.visible>0,key);check('isolated.'+key,'visual','Visible isolated layer',{visiblePixels:p.visible},[p.ref]);}
 const off=structuredClone(base);for(const l of Object.values(off.emitters[0].layers))l.enabled=false;const blank=await capture('all-off',off,.25);A.equal(blank.visible,0);check('layers.all-off','visual','No hidden geometry',{visiblePixels:0},[blank.ref]);
 const jump=structuredClone(base);jump.mode='teleport';jump.echoMode='distance';const plan=L.compile(jump);A.equal(plan.travelLength,0);A.equal(plan.emitters[0].echoes.length,0);const p=await capture('teleport',jump,16/60);A.ok(p.visible>0);check('teleport.jump','visual','Flash at jump; no traversed distance or spatial births',{visiblePixels:p.visible,travelLength:0,echoes:0},[p.ref]);
 for(const w of witnesses(A,sha))check(w.id,'numeric','Actual schedule or geometry changes; quality rejects excess capacity',w.actual);
 A.deepEqual(doc.parameters.map(p=>p.key).sort(),Object.keys(cases).sort());for(const p of doc.parameters)A.deepEqual(p.default,base[p.key],p.key);
 A.deepEqual(Object.keys(base).filter(k=>!['schemaVersion','emitters',...Object.keys(curves)].includes(k)).sort(),Object.keys(cases).sort());
 const l=id=>page.locator('#'+id);await l('showGuides').uncheck();await l('actualSize').click();
 for(const mode of ['dark','light','checker']){await l('background').selectOption(mode);const grab=async f=>{await l('frame').evaluate((e,f)=>{e.value=String(f);e.dispatchEvent(new Event('input',{bubbles:true}));},f);return l('surface').screenshot();};const peak=save('background-'+mode,await grab(15)),empty=save('background-empty-'+mode,await grab(39));const n=P.comparePixels(peak.image,empty.image,{step:1,channelTolerance:0}).changedPixels;A.ok(n>0);check('background.'+mode,'visual','Visible FX over actual preview background',{changedPixels:n},[peak.ref,empty.ref]);}
 const inf=await page.evaluate(async backend=>{const app=new PIXI.Application();await app.init({width:1,height:1,autoStart:false,preference:backend==='webgpu'?'webgpu':'webgl',preferWebGLVersion:backend==='webgl1'?1:2});const r=app.renderer,gl=r.gl,actual=gl?(gl instanceof WebGL2RenderingContext?'webgl2':'webgl1'):'webgpu',version=gl?gl.getParameter(gl.VERSION):null,ext=gl?.getExtension('WEBGL_debug_renderer_info'),gpu=ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):r.gpu?.adapter?.info?.description||'unavailable';app.destroy(true,{children:true});return {actual,version,gpu}},backend);
 A.equal(inf.actual,backend);check('backend.actual','backend',backend,backend);A.deepEqual(errors,[]);A.deepEqual(network,[]);
 const report={schemaVersion:1,effectId:doc.effectId,effectVersion:doc.effectVersion,sourceCommit:cp.execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),status:'PASS',environment:{browser:browser.version(),device:os.platform()+' '+os.release(),requestedBackend:backend==='webgpu'?'webgpu':'webgl',actualBackend:backend,glVersion:inf.version,gpu:inf.gpu,offline:true,networkRequests:0},fixture:{seed:base.seed,settings:base,width:512,height:512,fps:60,asset:'Doctor_head.json; two atlas pages, attack_1, hidden source; background preview no asset',frameTimesSeconds:[0,19.5/60,39/60]},checks,warnings:['Catalog phase/parameter/layer evidence; separate T02–T04 acceptance covers asset and export. Physical mobile and max-size bake performance NOT RUN.']};
 fs.writeFileSync(path.join(dir,'report.json'),JSON.stringify(report,null,2));const v=cp.spawnSync('python',['scripts/effect_validation.py',path.join(dir,'report.json'),'--require-pass'],{cwd:root,encoding:'utf8'});A.equal(v.status,0,v.stdout+' '+v.stderr);console.log('PASS GAME-07 evidence',backend,checks.length,v.stdout.trim());
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
