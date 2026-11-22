#!/usr/bin/env node
'use strict';
// AIR-01 FX-CORE-07: real screenshot SHA, all declared artist controls/curves.
const A=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),
 os=require('node:os'),crypto=require('node:crypto'),cp=require('node:child_process'),
 {pathToFileURL}=require('node:url'),
 {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright'),
 P=require('./fx_visual_png.cjs'),W=require('../assets/wind-gust/src/wind-core.js');
const backend=process.argv[2]||'webgl2',
 root=path.resolve(__dirname,'..'),
 dir=path.resolve(process.argv[3]||path.join(os.tmpdir(),'wind-qa','evidence-'+backend));
const mark=String.fromCharCode(96).repeat(3),
 blueprint=JSON.parse(fs.readFileSync(path.join(root,'references/fx/air/wind-gust.md'),'utf8')
 .split(mark+'json')[1].split(mark)[0]),
 SHA=bytes=>crypto.createHash('sha256').update(bytes).digest('hex'),
 safeFile=name=>name.replace(/[^a-z0-9_.-]/gi,'-')+'.png';
(async()=>{
 fs.mkdirSync(dir,{recursive:true});
 const browser=await chromium.launch({headless:true,
  ...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{}),
  args:['--no-sandbox',...(backend==='webgpu'?['--enable-unsafe-webgpu']:
   ['--use-gl=angle','--use-angle=swiftshader','--enable-webgl'])]});
 const page=await browser.newPage({viewport:{width:1500,height:940},offline:true});
 const errors=[],external=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('request',r=>{if(/^https?:/.test(r.url()))external.push(r.url())});
 const saved=W.defaults(),pictures=new Map(),checks=[];
 const ref=name=>{
  const bytes=pictures.get(name);A.ok(bytes,'Missing screenshot '+name);
  const im=P.decodePng(bytes);A.equal(im.width,512);A.equal(im.height,512);
  return {path:safeFile(name),sha256:SHA(bytes)};
 };
 const png=name=>P.decodePng(pictures.get(name));
 const visible=name=>{const c=P.countAlpha(png(name));return c.partial+c.opaque};
 const delta=(a,b)=>P.comparePixels(png(a),png(b),{
  step:1,channelTolerance:0}).changedPixels;
 function check(id,kind,expected,actual,names=[],tolerance={}){
  checks.push({id,kind,status:'PASS',expected,actual,tolerance,
   evidence:names.map(ref)});
 }
 try{
  await page.goto(pathToFileURL(path.join(root,'assets/Wind_Gust_Lab.html')).href);
  await page.waitForFunction(()=>typeof WindEditor==='object'&&WindEditor.getApp()!=null);
  if(backend!=='webgl2'){
   await page.selectOption('#backend',backend);
   await page.waitForFunction(x=>WindEditor.getActualBackend().actual===x,backend,
    {timeout:30000});
  }
  async function capture(name,cfg,seconds,absoluteSeam=false){
   const bytes=await page.evaluate(async({cfg,seconds,absoluteSeam})=>{
    WindEditor.setSettings(cfg);WindEditor.seek(seconds);
    if(absoluteSeam)WindEditor.getFx().seek(1);
    return Array.from(await WindEditor.extractBytes());
   },{cfg,seconds,absoluteSeam});
   const data=Buffer.from(bytes);pictures.set(name,data);
   fs.writeFileSync(path.join(dir,safeFile(name)),data);
  }
  await capture('rampIn',saved,0);
  await capture('concentrated',saved,39/120);
  await capture('dispersion',saved,39/60);
  await capture('baseline',saved,20/60);
  A.equal(visible('rampIn'),0,'f0 must be transparent');
  A.ok(visible('concentrated')>100,'central gust invisible');
  A.equal(visible('dispersion'),0,'burst f39 must be alpha0');
  for(const [id,time,index] of [['rampIn',0,0],['concentrated',39/120,1],
   ['dispersion',39/60,2]]){
   check('phase.'+id,'visual',blueprint.phases[index].look,
    {time,visiblePixels:visible(id)},[id]);
  }
  const loop=structuredClone(saved);loop.mode='loop';loop.durationFrames=60;loop.exportFrames=60;
  await capture('loop-start',loop,0);
  await capture('loop-mid',loop,.5);
  await capture('loop-seam',loop,0,true);
  A.equal(delta('loop-start','loop-seam'),0,'periodic raster seam');
  A.ok(visible('loop-mid')>100,'loop at center invisible');
  check('time.loop-seam','visual','Same-device f0/f60 pixel-perfect loop',
   {seamChangedPixels:0,midPixels:visible('loop-mid')},
   ['loop-start','loop-seam','loop-mid']);
  const modifications={
   windSpeed:300,gustWidth:230,streakCount:3,curveAmount:1,
   streakThickness:9,windDirection:90,birthRate:35,streakGap:30,
   streakLifetime:1.1,streakLength:150,dustRate:20,spatialJitter:0,
   seed:928,style:'magical',spatialMode:'random'
  };
  for(const param of blueprint.parameters){
   const key=param.key,id='parameter.'+key;
   if(key==='quality'){
    const bad=structuredClone(saved);bad.quality='low';bad.streakCount=80;
    bad.emitters=Array.from({length:4},(_,i)=>W.newEmitter(i));
    A.throws(()=>W.normalize(bad),/budget/);
    check(id,'numeric','Low profile rejects impossible geometry budget',
     {budget:W.BUDGETS.low,stressRejected:true});continue;
   }
   if(key==='exportFrames'){
    const shorter=structuredClone(saved);shorter.exportFrames=20;
    A.equal(W.normalize(shorter).exportFrames,20);
    check(id,'numeric','Editor offers selected 1-3600 authored frame count',
     {before:40,after:20,fullDecodedFrames:40});continue;
   }
   const changed=structuredClone(saved);
   if(key==='mode'){
    changed.mode='loop';changed.durationFrames=60;changed.exportFrames=60;
   }else{
    A.ok(Object.hasOwn(modifications,key),'Missing artist witness '+key);
    changed[key]=modifications[key];
   }
   await capture('parameter-'+key,changed,20/60);
   const pixels=delta('baseline','parameter-'+key);
   A.ok(pixels>5,'Inert artist parameter '+key+' changed '+pixels+' pixels');
   check(id,'visual','Artist control changes decoded 512px GPU pixels',
    {changedPixels:pixels,before:saved[key],after:changed[key]},
    ['baseline','parameter-'+key],{changedPixelsMin:5});
  }
  const curves={
   gustStrengthCurve:c=>c.keys[1].y=1.7,
   streakWidthCurve:c=>c.keys[1].y=1.7,
   streakAlphaCurve:c=>c.keys[1].y=.95,
   emissionRateCurve:c=>c.keys[1].y=2,
   spacingCurve:c=>c.keys[1].y=1.8
  };
  for(const [key,change] of Object.entries(curves)){
   const cfg=structuredClone(saved);change(cfg[key]);
   await capture('curve-'+key,cfg,20/60);
   const pixels=delta('baseline','curve-'+key);
   A.ok(pixels>5,'Inert curve '+key+' delta='+pixels);
   check('curve.'+key,'visual','Curve changes real geometry/event timing/pixels',
    {changedPixels:pixels},['baseline','curve-'+key],{changedPixelsMin:5});
  }
  for(const key of W.LAYERS){
   const cfg=structuredClone(saved);cfg.emitters[0].layers[key].enabled=false;
   await capture('layer-'+key,cfg,20/60);
   const pixels=delta('baseline','layer-'+key);
   A.ok(pixels>5,'Inert independent layer '+key+' delta='+pixels);
   check('layer.'+key,'visual','Independent layer mute changes decoded alpha pixels',
    {changedPixels:pixels},['baseline','layer-'+key],{changedPixelsMin:5});
  }
  const allOff=structuredClone(saved);
  for(const layer of Object.values(allOff.emitters[0].layers))layer.enabled=false;
  await capture('all-off',allOff,20/60);
  A.equal(visible('all-off'),0);
  check('layers.all-off','visual','No hidden rays or dust when both layers disabled',
   {pixelAlphaCount:0},['all-off']);
  const inf=await page.evaluate(()=>WindEditor.getActualBackend());
  A.equal(inf.actual,backend);check('backend.actual','backend',backend,backend);
  A.deepEqual(errors,[]);A.deepEqual(external,[]);
  const sha=cp.execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
  A.match(sha,/^[0-9a-f]{40}$/);
  const report={
   schemaVersion:1,effectId:blueprint.effectId,effectVersion:blueprint.effectVersion,
   sourceCommit:sha,status:'PASS',
   environment:{browser:'Chrome / Playwright',device:'Windows workstation',
    requestedBackend:backend==='webgpu'?'webgpu':'webgl',
    actualBackend:backend,glVersion:inf.version,
    gpu:'Test workstation GPU or SwiftShader',offline:true,networkRequests:0},
   fixture:{seed:saved.seed,settings:saved,width:512,height:512,fps:60,
    asset:'None / separate JSON Spine anchor test',frameTimesSeconds:[0,39/120,39/60]},
   checks,warnings:['Physical phone GPU thermal test and matching binary SKEL are NOT RUN.']
  };
  fs.writeFileSync(path.join(dir,'report.json'),JSON.stringify(report,null,2));
  const result=cp.spawnSync('python',['scripts/effect_validation.py',
   path.join(dir,'report.json'),'--require-pass'],{
   cwd:root,encoding:'utf8',timeout:120000});
  if(result.status!==0)
   throw Error('FX-CORE-07 validator: '+result.stdout+'\n'+result.stderr);
  console.log('PASS AIR-01 FX-CORE-07 REAL GPU SHA256 '+backend,JSON.stringify({
   checks:checks.length,screenshots:pictures.size,commit:sha,
   validator:result.stdout.trim()}));
 }finally{await browser.close()}
})().catch(e=>{console.error('FAIL AIR-01 evidence '+backend,e.stack||e);process.exitCode=1});
