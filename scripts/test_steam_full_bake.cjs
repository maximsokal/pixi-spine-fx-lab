#!/usr/bin/env node
'use strict';
const A=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),
 {pathToFileURL}=require('node:url'),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const dir=process.argv[2]||path.join(require('node:os').tmpdir(),'steam-qa'),root=path.resolve(__dirname,'..');
(async()=>{
 const browser=await chromium.launch({headless:true,
  ...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{}),
  args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-webgl']});
 const page=await browser.newPage({viewport:{width:1450,height:920},offline:true});
 const errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));
 page.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url())});
 try{
  await page.goto(pathToFileURL(path.join(root,'assets/Steam_Jet_Lab.html')).href);
  await page.waitForFunction(()=>typeof SteamEditor==='object'&&SteamEditor.getApp()!=null);
  // One 60-frame pass in a fresh browser to avoid retaining two huge readback buffers.
  const packed=await page.evaluate(async()=>{
   const result=await SteamExports.bake({download:false});
   return {manifest:result.manifest,
    bytes:Array.from(new Uint8Array(await result.blob.arrayBuffer()))};
  });
  A.equal(packed.manifest.effectId,'fx.water.steam-jet');
  A.equal(packed.manifest.width,512);A.equal(packed.manifest.height,512);
  A.equal(packed.manifest.fps,60);A.equal(packed.manifest.count,60);
  A.equal(packed.manifest.frames.length,60);
  A.deepEqual(errors,[]);A.deepEqual(requests,[]);
  fs.mkdirSync(dir,{recursive:true});
  fs.writeFileSync(path.join(dir,'steam-baked.zip'),Buffer.from(packed.bytes));
  const both=await page.evaluate(async()=>{
   const gl=await SteamExports.buildPackage('webgl'),
    gpu=await SteamExports.buildPackage('webgpu');
   return {gl:Array.from(new Uint8Array(await gl.blob.arrayBuffer())),
    gpu:Array.from(new Uint8Array(await gpu.blob.arrayBuffer())),
    glNames:gl.entries.map(x=>x.name),gpuNames:gpu.entries.map(x=>x.name)};
  });
  A.ok(both.glNames.includes('SteamJet.mjs')&&both.gpuNames.includes('SteamJet.mjs'));
  fs.writeFileSync(path.join(dir,'steam-webgl.zip'),Buffer.from(both.gl));
  fs.writeFileSync(path.join(dir,'steam-webgpu.zip'),Buffer.from(both.gpu));
  console.log('PASS WATER-06 full60 PNG ZIP + offline developer packages:',JSON.stringify({
   backend:packed.manifest.backend,frames:packed.manifest.frames.length,
   pngZipBytes:packed.bytes.length,glZipBytes:both.gl.length,
   gpuZipBytes:both.gpu.length,dir,errors,requests}));
 }finally{await browser.close()}
})().catch(e=>{console.error('FAIL WATER-06 FULL BAKE',e.stack||e);process.exitCode=1});
