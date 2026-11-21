#!/usr/bin/env node
'use strict';
// FIRE-06 highest distortion within a near-edge real captured-scene ROI.
// Never distort outside B coverage nor silently bake cropped 512px fields.
const assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url'),{decodePng}=require('./fx_visual_png.cjs');
async function run(){
 const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
 const browser=await chromium.launch({headless:true,
  ...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{}),
  args:['--no-sandbox',...(process.env.HAZE_GPU==='webgpu'?
   ['--enable-unsafe-webgpu']:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl'])]});
 const page=await browser.newPage({offline:true,viewport:{width:1430,height:1080}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto(pathToFileURL(path.resolve(__dirname,'../assets/Heat_Haze_Lab.html')).href);
  await page.waitForFunction(()=>typeof HazeEditor!=='undefined'&&!!HazeEditor.getApp(),null,{timeout:60000});
  const backend=process.env.HAZE_GPU||'webgl2';
  if(backend!=='webgl2'){
   await page.selectOption('#backend',backend);
   await page.waitForFunction(x=>HazeEditor.getActualBackend().actual===x,
    backend,{timeout:60000});
  }
  const originalSettings=await page.evaluate(()=>HazeEditor.getSettings());
  const c=structuredClone(originalSettings);
  c.amplitude=32;c.emitters[0].anchor.x=55;c.emitters[0].anchor.y=255;
  c.regionWidth=90;
  await page.evaluate(s=>HazeEditor.setSettings(s),c);
  assert.ok((await page.evaluate(()=>HazeEditor.getFx().bounds())).inside);
  await page.evaluate(()=>HazeEditor.seek(.47));
  const image=async kind=>decodePng(Buffer.from(await page.evaluate(async type=>
   Array.from(await HazeEditor.extractBytes(type)),kind)));
  const map=await image('displacement'),composite=await image('composite');
  c.amplitude=0;
  await page.evaluate(s=>HazeEditor.setSettings(s),c);
  const original=await image('composite');
  let changed=0,changedOutside=0,zeroBlue=0;
  for(let i=0;i<map.pixels.length;i+=4){
   if(map.pixels[i+2]===0)zeroBlue++;
   if([0,1,2,3].some(n=>composite.pixels[i+n]!==original.pixels[i+n])){
    changed++;
    if(map.pixels[i+2]===0)changedOutside++;
   }
  }
  assert.ok(changed>150&&zeroBlue>160000);
  assert.equal(changedOutside,0,'Max distortion near canvas edge leaks outside exact B region');
  c.amplitude=32;c.emitters[0].anchor.x=10;
  await page.evaluate(s=>HazeEditor.setSettings(s),c);
  assert.equal((await page.evaluate(()=>HazeEditor.getFx().bounds())).inside,false);
  await assert.rejects(()=>page.evaluate(()=>HazeExports.bake({download:false,kind:'displacement'})),
   /Heat region exceeds 512x512/);
  assert.deepEqual(errors,[]);
  console.log('PASS FIRE-06 MAX-32-PX EXACT ROI',JSON.stringify({backend,changed,changedOutside,zeroBlue,
   noCropping:true}));
 }finally{await browser.close()}
}
run().catch(e=>{console.error(e.stack||e);process.exitCode=1});
