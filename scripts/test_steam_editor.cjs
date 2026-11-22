#!/usr/bin/env node
'use strict';
const A=require('node:assert/strict'),path=require('node:path'),
 {pathToFileURL}=require('node:url'),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright'),
 P=require('./fx_visual_png.cjs');
const root=path.resolve(__dirname,'..'),backend=process.argv[2]||'webgl2';
(async()=>{
 const browser=await chromium.launch({headless:true,
  ...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{}),
  args:['--no-sandbox',...(backend==='webgpu'?['--enable-unsafe-webgpu']:
   ['--use-gl=angle','--use-angle=swiftshader','--enable-webgl'])]});
 const page=await browser.newPage({viewport:{width:1540,height:940},offline:true});
 const errors=[],requests=[];
 page.on('pageerror',x=>errors.push(x.message));
 page.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url())});
 try{
  await page.goto(pathToFileURL(path.join(root,'assets/Steam_Jet_Lab.html')).href);
  await page.waitForFunction(()=>typeof SteamEditor==='object'&&SteamEditor.getApp()!==null,
   {timeout:20000}).catch(()=>{});
  if(backend!=='webgl2'){
   await page.selectOption('#backend',backend);
   await page.waitForFunction(requested=>SteamEditor.getActualBackend().actual===requested,
    backend,{timeout:20000});
  }
  const result=await page.evaluate(async()=>{
   const core=FxSteam,editor=SteamEditor;
   const saved=editor.getSettings(),first=editor.getStatus();
   const backend=editor.getActualBackend();
   const png=async()=>{
    const bytes=await editor.extractBytes();
    return Array.from(bytes);
   };
   editor.seek(0);const start=await png();
   editor.seek(.5);const half=await png();
   editor.getFx().seek(1);const seam=await png();
   const controls={};
   for(const key of ['rate','initialSize','expansion','flowSpeed','diffusion','softness']){
    const el=document.getElementById('p-'+key);
    controls[key]=!!el&&String(el.value)===String(saved[key]);
   }
   const changes={};
   for(const [key,value] of [
    ['rate',22],['initialSize',33],['expansion',4],['flowSpeed',140],
    ['diffusion',1],['softness',0]]){
    const c=structuredClone(saved);c[key]=value;
    editor.setSettings(c);editor.seek(.5);changes[key]=await png();
   }
   editor.setSettings(saved);
   const fx=editor.getFx(),layers=core.LAYERS.every(k=>fx.emitters.get(saved.emitters[0].id).layers[k]);
   const zip=await SteamExports.buildPackage('webgl');
   const preset=zip.preset;
   const html={size:document.documentElement.outerHTML.length,
    title:document.title,status:editor.getStatus()};
   return {first,backend,start,half,seam,controls,changes,layers,
    zipEntries:zip.entries.map(x=>x.name),preset,html};
  });
  A.equal(result.backend.actual,backend,'requested renderer changed');
  const png=x=>P.decodePng(Buffer.from(x)),diff=(a,b)=>
   P.comparePixels(png(a),png(b),{step:1,channelTolerance:0}).changedPixels;
  A.equal(diff(result.start,result.seam),0,'seam not pixel identical');
  A.ok(diff(result.start,result.half)>100);
  for(const [k,v] of Object.entries(result.controls))A.ok(v,'missing control '+k);
  for(const [k,p] of Object.entries(result.changes))
   A.ok(diff(result.half,p)>100,'control '+k+' has no GPU pixel effect');
  A.ok(result.layers);
  A.equal(result.preset.effectId,'fx.water.steam-jet');
  A.ok(result.zipEntries.includes('FxSteam.mjs'));
  A.ok(result.zipEntries.includes('SteamJet.mjs'));
  A.deepEqual(errors,[]);
  A.deepEqual(requests,[]);
  console.log('PASS WATER-06 STEAM EDITOR '+backend,JSON.stringify({
   backend:result.backend,controls:Object.keys(result.controls),
   changes:Object.fromEntries(Object.entries(result.changes).map(([k,p])=>[k,diff(result.half,p)])),
   packageFiles:result.zipEntries.length,errors}));
 }finally{await browser.close()}
})().catch(e=>{console.error('FAIL WATER-06 STEAM EDITOR',e.stack||e);process.exitCode=1});
