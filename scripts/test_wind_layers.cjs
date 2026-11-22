#!/usr/bin/env node
'use strict';
const A=require('node:assert/strict'),path=require('node:path'),
 {pathToFileURL}=require('node:url'),
 {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const root=path.resolve(__dirname,'..');
 const browser=await chromium.launch({headless:true,
  ...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{}),
  args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-webgl']});
 const page=await browser.newPage({viewport:{width:1500,height:980},offline:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto(pathToFileURL(path.join(root,'assets/Wind_Gust_Lab.html')).href);
  await page.waitForFunction(()=>typeof WindEditor==='object'&&WindEditor.getApp()!=null);
  const examined=await page.evaluate(async()=>{
   await WindEditor.loadSample();
   const model=WindEditor.getModel();
   const bone=model.skeleton.bones.find(b=>b.active)?.data?.name;
   const cfg=WindEditor.getSettings(),e=cfg.emitters[0];
   e.layers.streaks.anchor.type='bone';
   e.layers.streaks.anchor.space='local';e.layers.streaks.anchor.name=bone;
   WindEditor.setSettings(cfg);WindEditor.seek(20/60);
   const fx=WindEditor.getFx();
   const anchored=fx.emitters.get(e.id).layers.streaks.surface.visible;
   e.layers.streaks.anchor.name='no-such-bone';
   WindEditor.setSettings(cfg);WindEditor.seek(20/60);
   const missing=!WindEditor.getFx().emitters.get(e.id).layers.streaks.surface.visible;
   const sibling=WindEditor.getFx().emitters.get(e.id).layers.dust.surface.visible;
   const diagnostic=WindEditor.getFx().diagnostics;
   e.layers.streaks.anchor.type='inherit';e.layers.streaks.anchor.name='';
   WindEditor.setSettings(cfg);WindEditor.seek(20/60);
   return {bone,anchored,missing,sibling,diagnostic,
    controls:FxWind.LAYERS.every(kind=>
     document.getElementById('layer-'+kind+'-anchor-type')&&
     document.getElementById('layer-'+kind+'-x')&&
     document.getElementById('layer-'+kind+'-y')),
    drag:!!document.getElementById('dustHandle')};
  });
  A.ok(examined.bone&&examined.anchored);
  A.ok(examined.missing&&examined.sibling,'missing named anchor affected sibling');
  A.match(examined.diagnostic,/missing|inactive/i);
  A.ok(examined.controls&&examined.drag);
  for(const zoom of ['.5','1','2']){
   await page.selectOption('#zoom',zoom);
   const h=page.locator('#dustHandle');
   await h.scrollIntoViewIfNeeded();
   const box=await h.boundingBox();
   A.ok(box,'dust drag handle hidden '+zoom);
   const before=await page.evaluate(()=>WindEditor.getSettings().emitters[0].layers.dust.x);
   const pt={x:box.x+box.width/2,y:box.y+box.height/2};
   await page.mouse.move(pt.x,pt.y);await page.mouse.down();
   await page.mouse.move(pt.x+20*Number(zoom),pt.y,{steps:3});
   await page.mouse.up();
   const after=await page.evaluate(()=>WindEditor.getSettings().emitters[0].layers.dust.x);
   A.ok(Math.abs(after-before-20)<=2,'wrong drag delta at zoom '+zoom+': '+(after-before));
  }
  A.deepEqual(errors,[]);
  console.log('PASS AIR-01 Spine 4.2 anchor, missing sibling isolation, 50/100/200% dust drag');
 }finally{await browser.close()}
})().catch(e=>{console.error('FAIL AIR-01 layers',e.stack||e);process.exitCode=1});
