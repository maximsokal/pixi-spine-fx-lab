#!/usr/bin/env node
'use strict';
// Real Spine 4.2 two-page atlas, animated bone, slot/attachment centroid,
 // isolate missing source without destroying the caller's Spine model.
const A=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url');
async function run(){
 const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
 const browser=await chromium.launch({headless:true,
  ...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{}),
  args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-webgl']});
 const page=await browser.newPage({viewport:{width:1400,height:1050},offline:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto(pathToFileURL(path.resolve(__dirname,'../assets/Waterfall_Lab.html')).href);
  await page.waitForFunction(()=>typeof WaterfallEditor!=='undefined'&&!!WaterfallEditor.getApp(),null,{timeout:60000});
  await page.click('#sample');
  await page.waitForFunction(()=>WaterfallEditor.getModel()!=null,null,{timeout:60000});
  const result=await page.evaluate(()=>{
   const e=WaterfallEditor,m=e.getModel(),settings=e.getSettings();
   const spine={pages:e.getAsset().images.size,
    animations:m.skeleton.data.animations.length,spine:m.skeleton.data.version};
   e.seek(.2);
   const initial=m.skeleton.bones.map(b=>({name:b.data.name,x:b.worldX,y:b.worldY}));
   e.seek(.4);
   const bone=m.skeleton.bones.map((b,i)=>({name:b.data.name,
    delta:Math.hypot(b.worldX-initial[i].x,b.worldY-initial[i].y)}))
    .sort((a,b)=>b.delta-a.delta)[0];
   const s=e.getSettings();
   s.emitters[0].anchor={...s.emitters[0].anchor,
    type:'bone',space:'local',name:bone.name,x:0,y:0};
   e.setSettings(s);
   const tracking=[.1,.3].map(t=>{
    e.seek(t);const b=m.skeleton.findBone(bone.name);
    const expected=m.worldTransform.apply({x:b.worldX,y:b.worldY},{x:0,y:0});
    return {actual:e.getFx().resolveAnchor(s.emitters[0].anchor),expected};
   });
   const slot=m.skeleton.slots.find(x=>x.getAttachment?.()&&x.bone?.active&&
    typeof x.getAttachment().computeWorldVertices==='function');
   if(!slot)return {spine,bone,tracking,slot:null};
   s.emitters[0].anchor={...s.emitters[0].anchor,
    type:'slot',name:slot.data.name,space:'local',x:0,y:0};
   e.setSettings(s);e.seek(.25);
   const slotAnchor=e.getFx().resolveAnchor(s.emitters[0].anchor);
   s.emitters[0].anchor.type='attachment';
   s.emitters[0].anchor.name=slot.getAttachment().name;
   s.emitters[0].anchor.slot=slot.data.name;
   e.setSettings(s);e.seek(.25);
   const attachment=e.getFx().resolveAnchor(s.emitters[0].anchor);
   // WATER-04 can hide one broken layer without destroying sibling layers.
   s.emitters[0].anchor={type:'world',space:'world',name:'',slot:'',
    x:256,y:64,rotation:0};
   s.emitters[0].layers.streams.anchor={
    type:'bone',space:'local',name:'MISSING_IN_SPINE',slot:'',
    x:0,y:0,rotation:0};
   s.emitters.push(FxWaterfall.newEmitter(1));
   e.setSettings(s);e.seek(.25);
   const fx=e.getFx(),diag=fx.diagnostics;
   const visible=Array.from(fx.emitters).map(([id,v])=>({id,
    visible:v.container.visible,
    primary:v.layers.streams.surface.visible,
    secondary:v.layers.fragments.surface.visible}));
   e.setSettings(settings);e.seek(.25);
   return {spine,bone,tracking,slot:slotAnchor,attachment,
    diag,visible,host:e.getFx().sceneSource===e.getModel().parent,
    restored:e.getFx().sample.emitters.length};
  });
  A.ok(result.spine.pages>=2&&result.spine.animations>=1);
  A.ok(result.bone.delta>.05);
  for(const item of result.tracking){
   A.ok(item.actual&&item.expected);
   A.ok(Math.hypot(item.actual.x-item.expected.x,
    item.actual.y-item.expected.y)<.05);
  }
  A.ok(Math.hypot(result.tracking[0].actual.x-result.tracking[1].actual.x,
   result.tracking[0].actual.y-result.tracking[1].actual.y)>.05);
  A.ok(result.slot&&result.attachment);
  A.match(result.diag,/missing\/inactive waterfall anchor/i);
  A.equal(result.visible.find(x=>x.id==='emitter1').primary,false);
  A.equal(result.visible.find(x=>x.id==='emitter1').secondary,true);
  A.equal(result.visible.find(x=>x.id==='emitter2').primary,true);
  A.equal(result.host,true);A.equal(result.restored,1);
  A.deepEqual(errors,[]);
  console.log('PASS WATER-04 real Spine 4.2 two-page atlas, animated bone, slot/attachment and missing-source isolation',JSON.stringify(result));
 }finally{await browser.close()}
}
run().catch(e=>{console.error(e.stack||e);process.exitCode=1});
