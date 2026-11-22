#!/usr/bin/env node
'use strict';
const A=require('node:assert/strict'),fs=require('node:fs'),
 path=require('node:path'),os=require('node:os'),
 {pathToFileURL}=require('node:url'),
 {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,
  executablePath:process.env.BROWSER_EXECUTABLE,
  args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-webgl']});
 const page=await browser.newPage({viewport:{width:1536,height:1050},offline:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto(pathToFileURL(path.resolve(__dirname,'../assets/Rising_Bubbles_Lab.html')).href);
  await page.waitForFunction(()=>typeof BubblesEditor!=='undefined'&&!!BubblesEditor.getApp(),
   null,{timeout:60000});
  const result=await page.evaluate(async()=>{
   const e=BubblesEditor,c=e.getSettings(),scene=e.getFx();
   const data=await e.extractBytes();
   return {backend:e.getActualBackend(),style:c.style,mode:c.mode,
    frameCount:c.exportFrames,alphaEnabled:c.emitters[0].layers.highlights.enabled,
    layerKeys:Object.keys(c.emitters[0].layers),
    rate:c.rate,src:scene.anchors.emitter1,
    bounds:scene.currentBounds(),html:document.title,
    dataLength:data.length,status:document.getElementById('status').textContent,
    controls:document.querySelectorAll('input[type=range]').length,
    curveCount:document.querySelectorAll('#curveMounts svg').length
   };
  });
  A.equal(result.backend.actual,'webgl2');
  A.deepEqual(result.layerKeys,['bubbles','highlights','popRings']);
  A.equal(result.frameCount,60);A.equal(result.curveCount,5);
  A.ok(result.dataLength>12000);
  A.deepEqual(errors,[]);
  const dirname=path.join(os.tmpdir(),'fxlab_bubbles_smoke');
  fs.mkdirSync(dirname,{recursive:true});
  await page.screenshot({path:path.join(dirname,'editor.png')});
  const bytes=Buffer.from(await page.evaluate(async()=>Array.from(
   await BubblesEditor.extractBytes())));
  fs.writeFileSync(path.join(dirname,'bubbles.png'),bytes);
  console.log('PASS WATER-05 OFFLINE EDITOR SMOKE',JSON.stringify(result),
   'SCREENSHOT',dirname);
 }finally{await browser.close()}
})().catch(e=>{console.error('FAIL WATER-05 EDITOR SMOKE',e.stack||e);process.exitCode=1});
