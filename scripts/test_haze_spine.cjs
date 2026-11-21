#!/usr/bin/env node
'use strict';
// FIRE-06 real Spine 4.2 / 2-page atlas / animated bone/slot/attachment
// provenance, bounded owned capture, source unaffected on source swaps.
const assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url');
async function run(){
 const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
 const b=await chromium.launch({headless:true,
 ...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{}),
 args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-webgl']});
 const page=await b.newPage({viewport:{width:1380,height:1080},offline:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
 await page.goto(pathToFileURL(path.resolve(__dirname,'../assets/Heat_Haze_Lab.html')).href);
 await page.waitForFunction(()=>typeof HazeEditor!=='undefined'&&!!HazeEditor.getApp(),null,{timeout:60000});
 await page.click('#sample');
 await page.waitForFunction(()=>HazeEditor.getModel()!=null,null,{timeout:60000});
 const result=await page.evaluate(()=>{
  const e=HazeEditor,m=e.getModel(),original=e.getSettings();
  const spine={pages:e.getAsset().images.size,
   animations:m.skeleton.data.animations.length};
  e.seek(.22);
  const first=m.skeleton.bones.map(b=>({name:b.data.name,x:b.worldX,y:b.worldY}));
  e.seek(.82);
  const best=m.skeleton.bones.map((b,i)=>({name:b.data.name,
   delta:Math.hypot(first[i].x-b.worldX,first[i].y-b.worldY)}))
    .sort((a,b)=>b.delta-a.delta)[0];
  const s=e.getSettings();
  s.emitters[0].anchor={...s.emitters[0].anchor,
   type:'bone',name:best.name,x:0,y:0,space:'local'};
  e.setSettings(s);
  const followed=[.2,.8].map(t=>{
   e.seek(t);
   const b=e.getModel().skeleton.findBone(best.name),
    pt=e.getModel().worldTransform.apply({x:b.worldX,y:b.worldY},{x:0,y:0});
   return {actual:e.getFx().resolveAnchor(s.emitters[0]),expected:pt,
    captures:e.getFx().captureCount};
  });
  const slot=m.skeleton.slots.find(s=>s.getAttachment?.()&&s.bone?.active&&
    typeof s.getAttachment().computeWorldVertices==='function');
  if(!slot)return {spine,best,followed,slot:null};
  s.emitters[0].anchor={...s.emitters[0].anchor,
   type:'slot',name:slot.data.name,x:0,y:0,space:'local'};
  e.setSettings(s);e.seek(.5);
  const slotAnchor=e.getFx().resolveAnchor(s.emitters[0]);
  s.emitters[0].anchor.type='attachment';
  s.emitters[0].anchor.name=slot.getAttachment().name;
  s.emitters[0].anchor.slot=slot.data.name;
  e.setSettings(s);e.seek(.5);
  const attachmentAnchor=e.getFx().resolveAnchor(s.emitters[0]);
  s.emitters[0].anchor={...s.emitters[0].anchor,
   type:'bone',name:'MISSING BONE'};
  s.emitters.push(FxHaze.newEmitter(1));
  e.setSettings(s);e.seek(.5);
  const diag=e.getFx().diagnostic,visible=e.getFx().snapshot.state.geometries
    .map(g=>g.e.id);
  e.setSettings(original);e.seek(.5);
  return {spine,best,followed,slot:slotAnchor,attachment:attachmentAnchor,
   diag,visible,captures:e.getFx().captureCount,
   sourceRenderable:e.getFx().sceneSource.renderable};
 });
 assert.ok(result.spine.pages>=2&&result.spine.animations>=1);
 assert.ok(result.best.delta>.05);
 for(const item of result.followed){
  assert.ok(item.actual&&item.expected);
  assert.ok(Math.hypot(item.actual.x-item.expected.x,
   item.actual.y-item.expected.y)<.1,
   'bone anchor differs from Spine world');
  assert.ok(item.captures>0);
 }
 assert.ok(Math.hypot(result.followed[0].actual.x-result.followed[1].actual.x,
   result.followed[0].actual.y-result.followed[1].actual.y)>.05);
 assert.ok(result.slot&&result.attachment,'slot/attachment resolution failed');
 assert.match(result.diag,/Missing\/inactive anchors/);
 assert.ok(!result.visible.includes('emitter1'));
 assert.ok(result.visible.includes('emitter2'));
 assert.equal(result.sourceRenderable,false);
 assert.ok(result.captures>0);
 assert.deepEqual(errors,[]);
 console.log('PASS FIRE-06 Spine anchors, two-page atlas, animated bone, slot/attachment, isolated missing source',JSON.stringify(result));
 }finally{await b.close()}
}
run().catch(e=>{console.error(e.stack||e);process.exitCode=1});
