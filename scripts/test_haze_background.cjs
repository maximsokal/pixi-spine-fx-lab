#!/usr/bin/env node
'use strict';
// Local image input remains explicit and included in Vite developer handoff.
const assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const {decodePng,comparePixels}=require('./fx_visual_png.cjs');
async function run(){
 const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
 const b=await chromium.launch({headless:true,
  ...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{}),
  args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-webgl']});
 const page=await b.newPage({viewport:{width:1400,height:1100},offline:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto(pathToFileURL(path.resolve(__dirname,'../assets/Heat_Haze_Lab.html')).href);
  await page.waitForFunction(()=>typeof HazeEditor!=='undefined'&&!!HazeEditor.getApp());
  const before=decodePng(Buffer.from(await page.evaluate(async()=>Array.from(await HazeEditor.extractBytes()))));
  const image=Buffer.from(await page.evaluate(async()=>{
   const canvas=document.createElement('canvas');canvas.width=canvas.height=256;
   const ctx=canvas.getContext('2d');
   for(let y=0;y<256;y+=8)for(let x=0;x<256;x+=8){
    ctx.fillStyle=((x+y)/8)%2===0?'#6a87aa':'#e0b54f';
    ctx.fillRect(x,y,8,8)
   }
   const blob=await new Promise(ok=>canvas.toBlob(ok,'image/png'));
   return Array.from(new Uint8Array(await blob.arrayBuffer()));
  }));
  await page.locator('#backgroundFile').setInputFiles({
   name:'my_heat_background.png',mimeType:'image/png',buffer:image});
  await page.waitForFunction(()=>HazeEditor.getBackgroundKind()==='local');
  const after=decodePng(Buffer.from(await page.evaluate(async()=>Array.from(await HazeEditor.extractBytes()))));
  assert.ok(comparePixels(before,after,{step:1,channelTolerance:0}).changedPixels>10000);
  const dev=await page.evaluate(async()=>{
   const x=await HazeExports.buildPackage('webgl');
   return {background:x.preset.background,images:x.entries.filter(x=>x.name.startsWith('public/assets/')).map(x=>x.name)};
  });
  assert.equal(dev.background.policy,'staticTexture');
  assert.equal(dev.background.path,'assets/my_heat_background.png');
  assert.ok(dev.images.includes('public/assets/my_heat_background.png'));
  await page.selectOption('#background','checker');
  assert.equal(await page.evaluate(()=>HazeEditor.getBackgroundKind()),'checker');
  await page.selectOption('#background','local');
  assert.equal(await page.evaluate(()=>HazeEditor.getBackgroundKind()),'local');
  const recycled=decodePng(Buffer.from(await page.evaluate(async()=>Array.from(await HazeEditor.extractBytes()))));
  assert.equal(comparePixels(after,recycled,{step:1,channelTolerance:0}).changedPixels,0);
  assert.deepEqual(errors,[]);
  console.log('PASS FIRE-06 explicit local Pixi background, developer inclusion, GPU texture release and reselect');
 }finally{await b.close()}
}
run().catch(e=>{console.error(e.stack||e);process.exitCode=1});
