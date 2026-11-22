#!/usr/bin/env node
'use strict';
const A=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),
 os=require('node:os'),{pathToFileURL}=require('node:url'),
 {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),dir=path.resolve(process.argv[2]||
 path.join(os.tmpdir(),'wind-qa'));
(async()=>{
 const browser=await chromium.launch({headless:true,
  ...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{}),
  args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-webgl']});
 fs.mkdirSync(dir,{recursive:true});
 try{
  for(const mode of ['burst','loop']){
   const page=await browser.newPage({viewport:{width:1500,height:940},offline:true});
   const errs=[],network=[];
   page.on('pageerror',e=>errs.push(e.message));
   page.on('request',r=>{if(/^https?:/.test(r.url()))network.push(r.url())});
   try{
    await page.goto(pathToFileURL(path.join(root,'assets/Wind_Gust_Lab.html')).href);
    await page.waitForFunction(()=>typeof WindEditor==='object'&&WindEditor.getApp()!=null);
    const info=await page.evaluate(async mode=>{
     const c=WindEditor.getSettings();
     c.mode=mode;c.durationFrames=mode==='loop'?60:40;
     c.exportFrames=c.durationFrames;
     WindEditor.setSettings(c);
     const result=await WindExports.bake({download:false});
     const bytes=Array.from(new Uint8Array(await result.blob.arrayBuffer()));
     if(mode==='burst'){
      const gl=await WindExports.buildPackage('webgl'),
       gpu=await WindExports.buildPackage('webgpu');
      return {manifest:result.manifest,bytes,
       gl:Array.from(new Uint8Array(await gl.blob.arrayBuffer())),
       gpu:Array.from(new Uint8Array(await gpu.blob.arrayBuffer())),
       glNames:gl.entries.map(v=>v.name),gpuNames:gpu.entries.map(v=>v.name)};
     }
     return {manifest:result.manifest,bytes};
    },mode);
    A.equal(info.manifest.effectId,'fx.air.wind-gust');
    A.equal(info.manifest.frameCount,mode==='burst'?40:60);
    A.equal(info.manifest.frames.length,mode==='burst'?40:60);
    A.equal(info.manifest.width,512);A.equal(info.manifest.height,512);
    A.equal(info.manifest.fps,60);A.equal(info.manifest.alpha,'straight-rgba8');
    A.deepEqual(errs,[]);A.deepEqual(network,[]);
    fs.writeFileSync(path.join(dir,'wind-'+mode+'.zip'),Buffer.from(info.bytes));
    if(mode==='burst'){
     A.ok(info.glNames.includes('Wind.mjs')&&info.glNames.includes('FxWind.mjs'));
     A.ok(info.gpuNames.includes('Wind.mjs')&&info.gpuNames.includes('FxWind.mjs'));
     fs.writeFileSync(path.join(dir,'wind-webgl.zip'),Buffer.from(info.gl));
     fs.writeFileSync(path.join(dir,'wind-webgpu.zip'),Buffer.from(info.gpu));
    }
    console.log('PASS AIR-01 '+mode+' '+info.manifest.frameCount+
     ' GPU PNG frames, source ZIP bytes='+info.bytes.length+
     ' offline='+network.length+' errors='+errs.length);
   }finally{await page.close()}
  }
  console.log('PASS AIR-01 40f burst, 60f loop and both source developer ZIPs '+dir);
 }finally{await browser.close()}
})().catch(e=>{console.error('FAIL AIR-01 full bake',e.stack||e);process.exitCode=1});
