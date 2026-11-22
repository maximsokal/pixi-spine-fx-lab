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
  await page.goto(pathToFileURL(path.resolve(__dirname,'../assets/Waterfall_Lab.html')).href);
  await page.waitForFunction(()=>typeof WaterfallEditor!=='undefined'&&!!WaterfallEditor.getApp(),
   null,{timeout:60000});
  const defaults=await page.evaluate(()=>WaterfallEditor.getSettings());
  for(const zoom of [.5,1,2]){
   const z=zoom===.5?'.5':String(zoom);
   await page.evaluate(c=>WaterfallEditor.setSettings(c),defaults);
   await page.selectOption('#zoom',z);
   const current=await page.evaluate(()=>WaterfallEditor.getSettings());
   const box=await page.locator('#impactHandle').boundingBox();
   A.ok(box&&box.width>0, 'impact handle hidden zoom='+z);
   const cx=box.x+box.width/2,cy=box.y+box.height/2;
   await page.mouse.move(cx,cy);await page.mouse.down();
   await page.mouse.move(cx+20*zoom,cy+9*zoom,{steps:8});
   await page.mouse.up();
   const moved=await page.evaluate(()=>WaterfallEditor.getSettings());
   A.ok(Math.abs(moved.emitters[0].layers.baseSprayFoam.x-20)<=3,
    'Impact drag fails pixel-correct inverse zoom '+z+': '+moved.emitters[0].layers.baseSprayFoam.x);
   A.equal(moved.emitters[0].anchor.x,current.emitters[0].anchor.x);
   await page.evaluate(c=>WaterfallEditor.setSettings(c),defaults);
   const origin=await page.locator('#originHandle').boundingBox();
   A.ok(origin&&origin.width>0);
   const x=origin.x+origin.width/2,y=origin.y+origin.height/2;
   await page.mouse.move(x,y);await page.mouse.down();
   await page.mouse.move(x+18*zoom,y+7*zoom,{steps:8});await page.mouse.up();
   const source=await page.evaluate(()=>WaterfallEditor.getSettings());
   A.ok(Math.abs(source.emitters[0].anchor.x-defaults.emitters[0].anchor.x-18)<=3,
    'Source drag fails zoom '+z);
   A.equal(source.emitters[0].layers.baseSprayFoam.x,0);
  }
  A.deepEqual(errors,[]);
  console.log('PASS WATER-04 independent orange/base and cyan/source drag at 50/100/200% zoom with stable inverse logical-512 scaling');
 }finally{await browser.close()}
})().catch(e=>{console.error('FAIL WATER-04 DRAG ZOOM',e.stack||e);process.exitCode=1});
