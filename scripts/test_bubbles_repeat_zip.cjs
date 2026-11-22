#!/usr/bin/env node
'use strict';
const A=require('node:assert/strict'),path=require('node:path'),
 {pathToFileURL}=require('node:url'),
 {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,
  executablePath:process.env.BROWSER_EXECUTABLE,
  args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-webgl']});
 const page=await browser.newPage({viewport:{width:1200,height:900},offline:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto(pathToFileURL(path.resolve(__dirname,'../assets/Rising_Bubbles_Lab.html')).href);
  await page.waitForFunction(()=>typeof BubblesEditor!=='undefined'&&!!BubblesEditor.getApp(),
   null,{timeout:60000});
  const result=await page.evaluate(async()=>{
   const before=BubblesEditor.getSettings(),
    timeBefore=BubblesEditor.getTime(),backend=BubblesEditor.getActualBackend();
   const a=await BubblesExports.bake({download:false,frames:60});
   const b=await BubblesExports.bake({download:false,frames:60});
   const x=new Uint8Array(await a.blob.arrayBuffer()),
    y=new Uint8Array(await b.blob.arrayBuffer());
   let changed=0;
   if(x.length===y.length)for(let i=0;i<x.length;i++)if(x[i]!==y[i])changed++;
   return {backend,countA:a.manifest.frameCount,countB:b.manifest.frameCount,
    sizeA:x.length,sizeB:y.length,changed,
    settingsSame:JSON.stringify(before)===JSON.stringify(BubblesEditor.getSettings()),
    timeSame:BubblesEditor.getTime()===timeBefore,
    busy:BubblesEditor.isBusy};
  });
  A.equal(result.backend.actual,'webgl2');
  A.equal(result.countA,60);A.equal(result.countB,60);
  A.equal(result.sizeA,result.sizeB);A.ok(result.sizeA>100000);
  A.equal(result.changed,0,'Two 60-frame ZIP bakes must be exactly byte-identical');
  A.equal(result.settingsSame,true);A.equal(result.timeSame,true);
  A.equal(result.busy,false);A.deepEqual(errors,[]);
  console.log('PASS WATER-05 DOUBLE 60-FRAME PNG ZIP BYTE-REPRODUCIBILITY',JSON.stringify(result));
 }finally{await browser.close()}
})().catch(e=>{console.error('FAIL WATER-05 REPEAT ZIP',e.stack||e);process.exitCode=1});
