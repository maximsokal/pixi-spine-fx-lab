#!/usr/bin/env node
'use strict';
// AIR-01: loaded Spine never leaks into effect-only PNG even if caller keeps it visible.
const A=require('node:assert/strict'),path=require('node:path'),
 {pathToFileURL}=require('node:url'),
 {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright'),
 {createHash}=require('node:crypto');
(async()=>{
 const root=path.resolve(__dirname,'..');
 const browser=await chromium.launch({headless:true,
  ...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{}),
  args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-webgl']});
 const page=await browser.newPage({viewport:{width:1500,height:930},offline:true});
 const errs=[];page.on('pageerror',e=>errs.push(e.message));
 try{
  await page.goto(pathToFileURL(path.join(root,'assets/Wind_Gust_Lab.html')).href);
  await page.waitForFunction(()=>typeof WindEditor==='object'&&WindEditor.getApp()!=null);
  const result=await page.evaluate(async()=>{
   await WindEditor.loadSample();
   const m=WindEditor.getModel();
   m.visible=true;
   const one=await WindExports.bake({download:false,frames:12});
   const restored=m.visible;
   document.getElementById('showSpine').checked=false;
   WindEditor.render();
   const two=await WindExports.bake({download:false,frames:12});
   const dig=async blob=>{
    const bytes=new Uint8Array(await blob.arrayBuffer());
    let h=2166136261;
    for(const b of bytes)h=Math.imul(h^b,16777619);
    return {hash:h>>>0,size:bytes.length};
   };
   return {a:await dig(one.blob),b:await dig(two.blob),manifest:one.manifest,
    restored,nowHidden:WindEditor.getModel().visible===false};
  });
  A.equal(result.manifest.effectId,'fx.air.wind-gust');
  A.equal(result.manifest.frameCount,12);
  A.equal(result.restored,true);A.ok(result.nowHidden);
  A.deepEqual(result.a,result.b,'Spine leaked into PNG export');
  A.deepEqual(errs,[]);
  console.log('PASS AIR-01 PNG source isolation, Spine visible/hidden same ZIP',result.a);
 }finally{await browser.close()}
})().catch(e=>{console.error('FAIL AIR-01 export',e.stack||e);process.exitCode=1});
