#!/usr/bin/env node
'use strict';
const A=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url'),
 {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const root=path.resolve(__dirname,'..'),browser=await chromium.launch({
  headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{}),
  args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-webgl']});
 const page=await browser.newPage({viewport:{width:1550,height:940},offline:true}),errors=[];
 page.on('pageerror',x=>errors.push(x.message));
 try{
  await page.goto(pathToFileURL(path.join(root,'assets/Steam_Jet_Lab.html')).href);
  await page.waitForFunction(()=>typeof SteamEditor==='object'&&SteamEditor.getApp()!=null);
  const expected=await page.evaluate(async()=>{
   await SteamEditor.loadSample();
   const model=SteamEditor.getModel();
   const skeleton=model.skeleton;
   const validBone=skeleton.bones.find(b=>b.active)?.data?.name;
   const cfg=SteamEditor.getSettings(),e=cfg.emitters[0];
   e.layers.wisps.anchor.type='bone';e.layers.wisps.anchor.name=validBone;
   e.layers.wisps.anchor.space='local';
   SteamEditor.setSettings(cfg);SteamEditor.seek(.25);
   const anchored=SteamEditor.getFx().emitters.get(e.id).layers.wisps.surface.visible;
   e.layers.wisps.anchor.name='missing-bone';
   SteamEditor.setSettings(cfg);SteamEditor.seek(.25);
   const fx=SteamEditor.getFx();
   const missing=!fx.emitters.get(e.id).layers.wisps.surface.visible,
    sibling=fx.emitters.get(e.id).layers.dense.surface.visible;
   e.layers.wisps.anchor.type='inherit';e.layers.wisps.anchor.name='';
   SteamEditor.setSettings(cfg);
   return {validBone,anchored,missing,sibling,
    fields:['dense','wisps','droplets'].every(k=>
     document.getElementById('layer-'+k+'-anchor-type')&&
     document.getElementById('layer-'+k+'-anchor-name')),
    handles:['dense','wisps','droplets'].every(k=>
     document.getElementById('steamHandle-'+k))};
  });
  A.ok(expected.validBone,'sample fixture has no valid bones');
  A.ok(expected.anchored,'Spine bone layer did not follow model');
  A.ok(expected.missing,'missing anchor not hidden');
  A.ok(expected.sibling,'missing anchor affected independent sibling');
  A.ok(expected.fields,'per-layer anchor not exposed to artist');
  A.ok(expected.handles,'layer drag handles missing from existing viewport');
  for(const zoom of ['.5','1','2']){
   await page.selectOption('#zoom',zoom);
   const h=page.locator('#steamHandle-dense');await h.scrollIntoViewIfNeeded();
   const box=await h.boundingBox();
   A.ok(box,'no visible draggable dense-layer handle '+zoom);
   const before=await page.evaluate(()=>SteamEditor.getSettings().emitters[0].layers.dense.x);
   const from={x:box.x+box.width/2,y:box.y+box.height/2};
   await page.mouse.move(from.x,from.y);await page.mouse.down();
   await page.mouse.move(from.x+20*Number(zoom),from.y,{steps:3});
   await page.mouse.up();
   const after=await page.evaluate(()=>SteamEditor.getSettings().emitters[0].layers.dense.x);
   A.ok(Math.abs(after-before-20)<=2,'drag wrong at zoom '+zoom+' got '+(after-before));
  }
  A.deepEqual(errors,[]);
  console.log('PASS WATER-06 independent layer anchors, missing isolation, 50/100/200% drag');
 }finally{await browser.close()}
})().catch(e=>{console.error('FAIL WATER-06 LAYER UX',e.stack||e);process.exitCode=1});
