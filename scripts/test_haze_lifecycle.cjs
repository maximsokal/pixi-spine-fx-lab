#!/usr/bin/env node
'use strict';
// FIRE-06 lifecycle: cancellation, state restoration, no partial ZIP and reseek.
const assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const editor=path.resolve(process.argv[2]||path.join(__dirname,'../assets/Heat_Haze_Lab.html'));
async function main(){
 const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
 const browser=await chromium.launch({headless:true,
  ...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{}),
  args:['--no-sandbox',...(process.env.FX_SOFTWARE_GPU==='1'?
   ['--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--enable-unsafe-webgpu']:[])]
 });
 const page=await browser.newPage({viewport:{width:1350,height:960},offline:true});
 const errors=[],downloads=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('download',d=>downloads.push(d.suggestedFilename()));
 try{
  await page.goto(pathToFileURL(editor).href);
  await page.waitForFunction(()=>typeof HazeEditor!=='undefined'&&!!HazeEditor.getApp(),null,{timeout:20000});
  await page.evaluate(()=>HazeEditor.stop());
  await page.evaluate(()=>HazeEditor.seek(.35));
  const before=await page.evaluate(()=>({time:HazeEditor.getTime(),playing:HazeEditor.getPlaying(),
   settings:JSON.stringify(HazeEditor.getSettings())}));
  assert.equal(before.playing,false);
  const started=page.evaluate(()=>HazeExports.bake({download:false}).then(
   ()=>({cancelled:false}),error=>({cancelled:String(error.message)})));
  await page.waitForFunction(()=>document.getElementById('cancel').disabled===false,
   null,{timeout:15000});
  await page.click('#cancel');
  const result=await started;
  assert.match(result.cancelled,/cancel/i,'Cancellation did not interrupt PNG bake');
  const after=await page.evaluate(()=>({time:HazeEditor.getTime(),playing:HazeEditor.getPlaying(),
   settings:JSON.stringify(HazeEditor.getSettings()),
   cancelDisabled:document.getElementById('cancel').disabled,
   bakeDisabled:document.getElementById('bake').disabled}));
  assert.deepEqual([after.time,after.playing,after.settings],
   [before.time,before.playing,before.settings]);
  assert.equal(after.cancelDisabled,true);
  assert.equal(after.bakeDisabled,false);
  assert.deepEqual(downloads,[],'Cancelled export must not download partial archive');
  await page.evaluate(()=>HazeEditor.seek(.25));
  const bytes=await page.evaluate(async()=>Array.from(await HazeEditor.extractBytes()));
  assert.ok(bytes.length>5000,'Editor unusable after cancellation');
  assert.deepEqual(errors,[]);
  console.log('PASS FIRE-06 cancellation, no partial ZIP, settings/time/playback restored, reusable renderer');
 }finally{await browser.close()}
}
main().catch(e=>{console.error(e.stack||e);process.exitCode=1});
