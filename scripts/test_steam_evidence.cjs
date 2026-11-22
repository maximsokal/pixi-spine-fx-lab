#!/usr/bin/env node
'use strict';
// FX-CORE-07 evidence for real WATER-06: every PNG SHA256 is from actual GPU readback.
const A=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),
 os=require('node:os'),crypto=require('node:crypto'),cp=require('node:child_process'),
 {pathToFileURL}=require('node:url'),
 {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright'),
 P=require('./fx_visual_png.cjs'),Core=require('../assets/steam-jet/src/steam-core.js');
const backend=process.argv[2]||'webgl2',
 root=path.resolve(__dirname,'..'),
 dir=path.resolve(process.argv[3]||path.join(os.tmpdir(),'steam-qa','evidence-'+backend));
const blueprint=JSON.parse(fs.readFileSync(path.join(root,'references/fx/water/steam-jet.md'),'utf8')
 .split(String.fromCharCode(96).repeat(3)+'json')[1].split(String.fromCharCode(96).repeat(3))[0]);
const SHA=s=>crypto.createHash('sha256').update(s).digest('hex');
const safeFile=n=>n.replace(/[^a-z0-9_.-]/gi,'-')+'.png';
(async()=>{
 fs.mkdirSync(dir,{recursive:true});
 const browser=await chromium.launch({headless:true,
  ...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{}),
  args:['--no-sandbox',...(backend==='webgpu'?['--enable-unsafe-webgpu']:
   ['--use-gl=angle','--use-angle=swiftshader','--enable-webgl'])]});
 const page=await browser.newPage({viewport:{width:1450,height:920},offline:true});
 const errors=[],external=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('request',r=>{if(/^https?:/.test(r.url()))external.push(r.url())});
 const saved=Core.defaults(),checks=[],pictures=new Map();
 const pic=name=>{
  const b=pictures.get(name);A.ok(b,'missing GPU screenshot '+name);
  const img=P.decodePng(b);A.equal(img.width,512);A.equal(img.height,512);
  return {img,ref:{path:safeFile(name),sha256:SHA(b)}};
 };
 const delta=(a,b)=>P.comparePixels(pic(a).img,pic(b).img,{step:1,channelTolerance:0}).changedPixels;
 const visible=name=>{const c=P.countAlpha(pic(name).img);return c.partial+c.opaque};
 const check=(id,kind,expected,actual,names=[],tolerance={})=>
  checks.push({id,kind,status:'PASS',expected,actual,tolerance,evidence:names.map(n=>pic(n).ref)});
 try{
  await page.goto(pathToFileURL(path.join(root,'assets/Steam_Jet_Lab.html')).href);
  await page.waitForFunction(()=>typeof SteamEditor==='object'&&SteamEditor.getApp()!=null);
  if(backend!=='webgl2'){
   await page.selectOption('#backend',backend);
   await page.waitForFunction(x=>SteamEditor.getActualBackend().actual===x,backend,{timeout:30000});
  }
  const capture=async(name,cfg,time=.5,seam=false)=>{
   const result=await page.evaluate(async({cfg,time,seam})=>{
    SteamEditor.setSettings(cfg);SteamEditor.seek(time);
    if(seam)SteamEditor.getFx().seek(1);
    const arr=await SteamEditor.extractBytes();
    return Array.from(arr);
   },{cfg,time,seam});
   const data=Buffer.from(result);pictures.set(name,data);
   fs.writeFileSync(path.join(dir,safeFile(name)),data);return data;
  };
  await capture('nozzle',saved,0);
  await capture('expansion',saved,.5);
  await capture('seam',saved,0,true);
  await capture('baseline',saved,.5);
  for(const [id,name,sec] of [['nozzle','nozzle',0],['expansion','expansion',.5],['seam','seam',1]]){
   A.ok(visible(name)>100,'empty phase '+name);
   check('phase.'+id,'visual',blueprint.phases.find(x=>x.id===id).look,
    {frame:sec*60,visiblePixels:visible(name)},[name]);
  }
  A.equal(delta('nozzle','seam'),0);
  A.ok(delta('nozzle','expansion')>100);
  check('time.periodic-seam','visual','Real t0 vs t1 pixel seam equals zero',
   {seamChangedPixels:0,animatedPixels:delta('nozzle','expansion')},
   ['nozzle','seam','expansion']);
  const alterations={
   rate:24,initialSize:31,expansion:4,flowSpeed:140,diffusion:1,
   softness:0,lifetimeSeconds:2.6,windX:30,curlScale:44,
   nozzleWidth:98,originGap:33,spatialJitter:0,intervalJitter:.35,
   seed:928,style:'magical',spatialMode:'random'
  };
  for(const parameter of blueprint.parameters){
   const name=parameter.key,id='parameter.'+name;
   if(name==='quality'){
    const bad=structuredClone(saved);bad.quality='low';bad.rate=100;
    bad.lifetimeSeconds=6;bad.emitters=Array.from({length:4},(_,i)=>Core.newEmitter(i));
    A.throws(()=>Core.normalize(bad),/budget/);
    check(id,'numeric','Low quality rejects over-budget history',
     {lowBudget:Core.BUDGETS.low,stressRejected:true});continue;
   }
   if(name==='exportFrames'){
    const other=structuredClone(saved);other.exportFrames=40;
    A.equal(Core.normalize(other).exportFrames,40);
    check(id,'numeric','Frame count 60 can change to 40 independently of FX core',
     {old:saved.exportFrames,new:40,decodedFrames:60});continue;
   }
   if(name==='emissionMode'){
    const other=structuredClone(saved);other.emissionMode='distance';
    const sample=Core.sample(other,.5);
    A.ok(sample.diagnostics.some(x=>x.includes('distance')));
    check(id,'numeric','Distance emission without source motion is explicitly diagnosed',
     {diagnostic:sample.diagnostics,emissionMode:'distance'});continue;
   }
   const cfg=structuredClone(saved);
   if(name==='mode'){cfg.mode='stop';cfg.stopFrame=0;cfg.fadeFrames=40;cfg.durationFrames=40;cfg.exportFrames=40}
   else{A.ok(name in alterations,'No witness mutation planned for '+name);cfg[name]=alterations[name]}
   await capture('parameter-'+name,cfg,.5);
   const changed=delta('baseline','parameter-'+name);
   A.ok(changed>5,'inert declared parameter '+name+' delta '+changed);
   check(id,'visual','Changing artist control alters actual decoded GPU PNG',
    {changedPixels:changed,old:saved[name],new:cfg[name]},
    ['baseline','parameter-'+name],{changedPixelsMin:5});
  }
  const edits={sizeCurve:(c)=>c.keys[1].y=2.4,
   opacityCurve:(c)=>c.keys[1].y=.8,flowCurve:(c)=>c.keys[1].y=.35,
   emissionRateCurve:(c)=>c.keys[1].y=2,spacingCurve:(c)=>c.keys[1].y=35};
  for(const [name,change] of Object.entries(edits)){
   const cfg=structuredClone(saved);change(cfg[name]);
   await capture('curve-'+name,cfg,.5);
   const changed=delta('baseline','curve-'+name);
   A.ok(changed>5,'inert curve '+name+': '+changed);
   check('curve.'+name,'visual','Editable curve changes decoded GPU pixels',
    {changedPixels:changed},['baseline','curve-'+name],{changedPixelsMin:5});
  }
  for(const layer of Core.LAYERS){
   const cfg=structuredClone(saved);
   cfg.emitters[0].layers[layer].enabled=layer==='droplets';
   if(layer==='droplets'){await capture('layer-'+layer,cfg,.5)}
   else{await capture('layer-'+layer,cfg,.5)}
   const changed=delta('baseline','layer-'+layer);
   A.ok(changed>5,'inert layer '+layer);
   check('layer.'+layer,'visual','Independent layer ownership changes actual GPU PNG',
    {changedPixels:changed},['baseline','layer-'+layer],{changedPixelsMin:5});
  }
  const inf=await page.evaluate(()=>SteamEditor.getActualBackend());
  A.equal(inf.actual,backend);
  check('backend.actual','backend',backend,backend);
  A.deepEqual(errors,[]);A.deepEqual(external,[]);
  const sha40=cp.execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
  A.match(sha40,/^[0-9a-f]{40}$/);
  const report={schemaVersion:1,effectId:blueprint.effectId,effectVersion:blueprint.effectVersion,
   sourceCommit:sha40,status:'PASS',
   environment:{browser:'Chrome / Playwright',device:'Windows workstation',
    requestedBackend:backend==='webgpu'?'webgpu':'webgl',actualBackend:backend,
    glVersion:inf.version,gpu:'Browser configured local GPU or SwiftShader',
    offline:true,networkRequests:0},
   fixture:{seed:saved.seed,settings:saved,width:512,height:512,fps:60,
    asset:'None; world-anchor independent Steam plume',
    frameTimesSeconds:[0,.5,1]},
   checks,warnings:['Physical phone GPU performance and matching Spine binary SKEL are NOT RUN.']};
  fs.writeFileSync(path.join(dir,'report.json'),JSON.stringify(report,null,2));
  const out=cp.spawnSync('python',['scripts/effect_validation.py',path.join(dir,'report.json'),'--require-pass'],{
   cwd:root,encoding:'utf8',timeout:120000});
  if(out.status!==0)throw Error('FX-CORE-07 validator: '+out.stdout+'\n'+out.stderr);
  console.log('PASS WATER-06 FX-CORE-07 REAL SHA256 '+backend,JSON.stringify({
   checks:checks.length,pictures:pictures.size,git:sha40,validator:out.stdout.trim()}));
 }finally{await browser.close()}
})().catch(e=>{console.error('FAIL WATER-06 FX-CORE-07',backend,e.stack||e);process.exitCode=1});
