#!/usr/bin/env node
'use strict';
const A=require('node:assert/strict'),path=require('node:path'),
 {pathToFileURL}=require('node:url'),
 {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,
  executablePath:process.env.BROWSER_EXECUTABLE,
  args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-webgl']});
 const page=await browser.newPage({viewport:{width:2200,height:1600},offline:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto(pathToFileURL(path.resolve(__dirname,'../assets/Rising_Bubbles_Lab.html')).href);
  await page.waitForFunction(()=>typeof BubblesEditor!=='undefined'&&!!BubblesEditor.getApp(),
   null,{timeout:60000});
  const defaults=await page.evaluate(()=>BubblesEditor.getSettings());
  for(const zoom of [.5,1,2]){
   const z=zoom===.5?'.5':String(zoom);
   await page.evaluate(c=>BubblesEditor.setSettings(c),defaults);
   await page.selectOption('#zoom',z);
   const current=await page.evaluate(()=>BubblesEditor.getSettings());
   const box=await page.locator('#highlightHandle').boundingBox();
   A.ok(box&&box.width>0, 'highlight handle hidden zoom='+z);
   const cx=box.x+box.width/2,cy=box.y+box.height/2;
   await page.mouse.move(cx,cy);await page.mouse.down();
   await page.mouse.move(cx+20*zoom,cy+9*zoom,{steps:8});
   await page.mouse.up();
   const moved=await page.evaluate(()=>BubblesEditor.getSettings());
   A.ok(Math.abs(moved.emitters[0].layers.highlights.x-20)<=3,
    'Highlight drag fails pixel-correct inverse zoom '+z+': '+moved.emitters[0].layers.highlights.x);
   A.equal(moved.emitters[0].anchor.x,current.emitters[0].anchor.x);
   await page.evaluate(c=>BubblesEditor.setSettings(c),defaults);
   const origin=await page.locator('#originHandle').boundingBox();
   A.ok(origin&&origin.width>0);
   const x=origin.x+origin.width/2,y=origin.y+origin.height/2;
   await page.mouse.move(x,y);await page.mouse.down();
   await page.mouse.move(x+18*zoom,y+7*zoom,{steps:8});await page.mouse.up();
   const source=await page.evaluate(()=>BubblesEditor.getSettings());
   A.ok(Math.abs(source.emitters[0].anchor.x-defaults.emitters[0].anchor.x-18)<=3,
    'Source drag fails zoom '+z);
   A.equal(source.emitters[0].layers.highlights.x,0);
   await page.evaluate(c=>BubblesEditor.setSettings(c),defaults);
   const bend=await page.locator('#nozzle-bend').boundingBox();
   A.ok(bend&&bend.width>0);
   await page.mouse.move(bend.x+bend.width/2,bend.y+bend.height/2);
   await page.mouse.down();
   await page.mouse.move(bend.x+bend.width/2,bend.y+bend.height/2-21*zoom,{steps:8});
   await page.mouse.up();
   const adjustedBend=await page.evaluate(()=>BubblesEditor.getSettings());
   A.ok(adjustedBend.nozzleBend>defaults.nozzleBend+15,
    'Cubic nozzle bend drag ignored zoom '+z);
   A.equal(adjustedBend.originSpan,defaults.originSpan);
   await page.evaluate(c=>BubblesEditor.setSettings(c),defaults);
   const right=await page.locator('#nozzle-right').boundingBox();
   A.ok(right&&right.width>0);
   await page.mouse.move(right.x+right.width/2,right.y+right.height/2);
   await page.mouse.down();
   await page.mouse.move(right.x+right.width/2+15*zoom,right.y+right.height/2,{steps:8});
   await page.mouse.up();
   const adjustedSpan=await page.evaluate(()=>BubblesEditor.getSettings());
   A.ok(Math.abs(adjustedSpan.originSpan-defaults.originSpan-30)<=4,
    'Physical nozzle span drag ignored zoom '+z);
   A.equal(adjustedSpan.nozzleBend,defaults.nozzleBend);
  }
  A.deepEqual(errors,[]);
  console.log('PASS WATER-05 independent orange/highlight and cyan/source drag at 50/100/200% zoom with stable inverse logical-512 scaling');
 }finally{await browser.close()}
})().catch(e=>{console.error('FAIL WATER-05 DRAG ZOOM',e.stack||e);process.exitCode=1});
