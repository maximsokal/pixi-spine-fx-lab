#!/usr/bin/env node
'use strict';
const A=require('node:assert/strict'),path=require('node:path'),
 {pathToFileURL}=require('node:url'),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const repo=path.resolve(__dirname,'..');
 const browser=await chromium.launch({headless:true,
  ...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{}),
  args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-webgl']});
 const page=await browser.newPage({viewport:{width:1450,height:940},offline:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto(pathToFileURL(path.join(repo,'assets/Steam_Jet_Lab.html')).href);
  await page.waitForFunction(()=>typeof SteamEditor==='object'&&SteamEditor.getApp()!=null);
  const result=await page.evaluate(async()=>{
   await SteamEditor.loadSample();
   const show=document.getElementById('showSpine');
   const digest=async blob=>{
    const bytes=new Uint8Array(await blob.arrayBuffer());
    let h=2166136261;
    for(let i=0;i<bytes.length;i++)h=Math.imul(h^bytes[i],16777619);
    return {hash:h>>>0,size:bytes.length};
   };
   show.checked=true;SteamEditor.render();
   const first=await SteamExports.bake({download:false,frames:4});
   const restored=SteamEditor.getModel()?.visible;
   show.checked=false;SteamEditor.render();
   const second=await SteamExports.bake({download:false,frames:4});
   return {first:await digest(first.blob),second:await digest(second.blob),
    manifest:first.manifest,restored,
    status:SteamEditor.getStatus()};
  });
  A.equal(result.manifest.effectId,'fx.water.steam-jet');
  A.equal(result.manifest.count,4);
  A.equal(result.restored,true);
  A.deepEqual(result.first,result.second,
   'Spine source leaked into isolated PNG sequence');
  A.deepEqual(errors,[]);
  console.log('PASS WATER-06 4-FRAME SOURCE ISOLATION',JSON.stringify(result));
 }finally{await browser.close()}
})().catch(e=>{console.error('FAIL WATER-06 SOURCE ISOLATION',e.stack||e);process.exitCode=1});
