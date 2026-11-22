#!/usr/bin/env node
'use strict';
const A=require('node:assert/strict'),path=require('node:path'),
 {pathToFileURL}=require('node:url'),
 {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright'),
 P=require('./fx_visual_png.cjs');
const backend=process.argv[2]||'webgl2',root=path.resolve(__dirname,'..');
(async()=>{
 const browser=await chromium.launch({headless:true,
  ...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{}),
  args:['--no-sandbox',...(backend==='webgpu'?['--enable-unsafe-webgpu']:
   ['--use-gl=angle','--use-angle=swiftshader','--enable-webgl'])]});
 const page=await browser.newPage({viewport:{width:1600,height:980},offline:true});
 const errors=[],network=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('request',r=>{if(/^https?:/.test(r.url()))network.push(r.url())});
 try{
  await page.goto(pathToFileURL(path.join(root,'assets/Wind_Gust_Lab.html')).href);
  await page.waitForFunction(()=>typeof WindEditor==='object'&&WindEditor.getApp()!=null,null,{timeout:5500}).catch(async e=>{console.error('WIND DEBUG',JSON.stringify({errors,html:await page.locator('#status').textContent(),vars:await page.evaluate(()=>({editor:typeof WindEditor,core:typeof FxWind,runtime:typeof FxWindRuntime}))}));throw e});
  if(backend!=='webgl2'){
   await page.selectOption('#backend',backend);
   await page.waitForFunction(requested=>WindEditor.getActualBackend().actual===requested,
    backend,{timeout:20000});
  }
  const result=await page.evaluate(async()=>{
   const W=FxWind,editor=WindEditor,saved=editor.getSettings();
   const png=async()=>Array.from(await editor.extractBytes());
   editor.seek(20/60);const baseline=await png();
   const changes={};
   for(const [key,value] of [
    ['windSpeed',300],['gustWidth',230],['streakCount',3],
    ['curveAmount',1],['streakThickness',9],['windDirection',90],
    ['birthRate',40],['streakGap',30],['dustRate',20]]){
    const c=structuredClone(saved);c[key]=value;
    editor.setSettings(c);editor.seek(20/60);changes[key]=await png();
   }
   editor.setSettings(saved);editor.seek(20/60);
   const inputs={};
   for(const key of ['windSpeed','gustWidth','streakCount','curveAmount',
    'streakThickness','windDirection','birthRate','streakGap','dustRate'])
    inputs[key]=!!document.getElementById('p-'+key);
   const curves=['gustStrengthCurve','streakWidthCurve','streakAlphaCurve',
    'emissionRateCurve','spacingCurve'];
   const curveWidgets=curves.map(key=>!!document.getElementById(key+'Editor'));
   const layers=W.LAYERS.every(name=>document.getElementById('layer-'+name)&&
    document.getElementById('layer-'+name+'-anchor-type'));
   const actual=editor.getActualBackend().actual;
   const preset={schemaVersion:1,effectId:'fx.air.wind-gust',settings:saved};
   editor.setSettings(W.normalize(preset.settings));
   const roundtrip=JSON.stringify(editor.getSettings())===JSON.stringify(saved);
   return {baseline,changes,inputs,curveWidgets,layers,actual,roundtrip,
    title:document.title,curve:document.getElementById('curveMounts')?.innerText};
  });
  A.equal(result.actual,backend);
  const diff=(a,b)=>P.comparePixels(P.decodePng(Buffer.from(a)),
   P.decodePng(Buffer.from(b)),{step:1,channelTolerance:0}).changedPixels;
  for(const [key,value] of Object.entries(result.inputs))
   A.ok(value,'Missing parameter control '+key);
  A.ok(result.curveWidgets.every(Boolean),'Missing editable FX curves');
  A.ok(result.layers,'Missing independent layer anchor controls');
  A.ok(result.roundtrip,'JSON preset normalization changes settings');
  for(const [key,p] of Object.entries(result.changes))
   A.ok(diff(result.baseline,p)>5,'Inert GPU parameter '+key);
  A.match(result.title,/Wind Gust/i);
  A.deepEqual(errors,[]);A.deepEqual(network,[]);
  console.log('PASS AIR-01 editor '+backend,JSON.stringify({
   controls:Object.keys(result.inputs),
   deltas:Object.fromEntries(Object.entries(result.changes).map(([k,p])=>
    [k,diff(result.baseline,p)]))}));
 }finally{await browser.close()}
})().catch(e=>{console.error('FAIL AIR-01 editor',e.stack||e);process.exitCode=1});
