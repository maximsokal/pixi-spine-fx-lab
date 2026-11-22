#!/usr/bin/env node
'use strict';
const A=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const out=path.resolve(process.env.TEMP||'.','fxlab_bubbles_packages');
async function run(){
 fs.mkdirSync(out,{recursive:true});
 const browser=await chromium.launch({headless:true,
  ...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{}),
  args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-webgl']});
 const page=await browser.newPage({viewport:{width:1440,height:1050},offline:true,acceptDownloads:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto(pathToFileURL(path.resolve(__dirname,'../assets/Rising_Bubbles_Lab.html')).href);
  await page.waitForFunction(()=>typeof BubblesEditor!=='undefined'&&!!BubblesEditor.getApp(),null,{timeout:60000});
  for(const [id,file] of [['webglZip','Rising_Bubbles_WEBGL.zip'],
   ['webgpuZip','Rising_Bubbles_WEBGPU.zip'],['bake','Rising_Bubbles_60frames_PNG.zip']]){
   const downloaded=page.waitForEvent('download',{timeout:120000});
   await page.click('#'+id);
   const item=await downloaded;
   await item.saveAs(path.join(out,file));
   const bytes=fs.statSync(path.join(out,file)).size;
   A.ok(bytes>30000,'Archive unexpectedly small '+file+' '+bytes);
   console.log('BUBBLES_ZIP_WRITTEN',file,bytes);
  }
  const backend=await page.evaluate(()=>BubblesEditor.getActualBackend());
  A.equal(backend.actual,'webgl2');
  A.deepEqual(errors,[]);
 }finally{await browser.close()}
}
run().catch(e=>{console.error(e.stack||e);process.exitCode=1});
