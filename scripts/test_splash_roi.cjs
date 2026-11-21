#!/usr/bin/env node
'use strict';
const A=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url');
async function run(){
 const target=process.argv[2]||'webgl2';
 const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
 const browser=await chromium.launch({headless:true,
  ...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{}),
  args:['--no-sandbox',...(target==='webgpu'?['--enable-unsafe-webgpu']:
   ['--use-gl=angle','--use-angle=swiftshader','--enable-webgl'])]});
 const page=await browser.newPage({offline:true,viewport:{width:1400,height:1100}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto(pathToFileURL(path.resolve(__dirname,'../assets/Water_Splash_Lab.html')).href);
  await page.waitForFunction(()=>typeof SplashEditor!=='undefined'&&!!SplashEditor.getApp(),null,{timeout:60000});
  if(target!=='webgl2'){
   await page.selectOption('#backend',target);
   await page.waitForFunction(x=>SplashEditor.getActualBackend().actual===x,
    target,{timeout:60000});
  }
  const c=await page.evaluate(()=>SplashEditor.getSettings());
  const result=await page.evaluate(async cfg=>{
   const s=structuredClone(cfg);
   s.emitters[0].anchor.x=22;
   SplashEditor.setSettings(s);SplashEditor.seek(0);
   const bounds=SplashEditor.getFx().currentBounds();
   const before={time:SplashEditor.getTime(),settings:JSON.stringify(SplashEditor.getSettings())};
   let rejected=null;
   try{await SplashExports.bake({download:false,frames:8})}
   catch(e){rejected=String(e.message)}
   const after={time:SplashEditor.getTime(),settings:JSON.stringify(SplashEditor.getSettings()),
    busy:SplashEditor.isBusy};
   SplashEditor.setSettings(cfg);
   SplashEditor.seek(0);
   const original=SplashEditor.getFx().currentBounds();
   return {bounds,rejected,before,after,original,backend:SplashEditor.getActualBackend()};
  },c);
  A.equal(result.backend.actual,target);
  A.equal(result.bounds.inside,false);
  A.match(result.rejected,/exceeds 512x512/i,'silent crop forbidden');
  A.deepEqual(result.after.time,result.before.time);
  A.deepEqual(result.after.settings,result.before.settings);
  A.equal(result.after.busy,false);
  A.equal(result.original.inside,true);
  A.deepEqual(errors,[]);
  console.log('PASS WATER-01 ROI',target,
   JSON.stringify({bounds:result.bounds,rejected:result.rejected,restored:true}));
 }finally{await browser.close()}
}
run().catch(e=>{console.error(e.stack||e);process.exitCode=1});
