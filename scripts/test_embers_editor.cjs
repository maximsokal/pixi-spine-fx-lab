#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const {decodePng,countAlpha,comparePixels}=require('./fx_visual_png.cjs');
const arg=(key,fallback)=>{const i=process.argv.indexOf('--'+key);return i<0?fallback:process.argv[i+1]};
const target=arg('backend','webgl2'),dir=path.resolve(arg('output','embers-browser-qa')),
 html=path.resolve(arg('html',path.join(__dirname,'../assets/Embers_Sparks_Lab.html')));
const visible=p=>{const o=countAlpha(p);return o.partial+o.opaque};
const diff=(a,b)=>comparePixels(a,b,{step:1,channelTolerance:0}).changedPixels;
async function main(){
 const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
 const browser=await chromium.launch({headless:true,
  ...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{}),
  args:['--no-sandbox',
   ...(process.env.FX_SOFTWARE_GPU==='1'?['--use-gl=angle','--use-angle=swiftshader',
    '--enable-webgl','--enable-unsafe-webgpu','--use-vulkan=swiftshader',
    '--enable-features=Vulkan']:[]),
   ...(process.env.FX_ENABLE_UNSAFE_WEBGPU==='1'?['--enable-unsafe-webgpu']:[])]});
 const page=await browser.newPage({viewport:{width:1440,height:1100},acceptDownloads:true,offline:true});
 const errors=[],external=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error')errors.push('console:'+m.text())});
 page.on('request',r=>{if(/^https?:/.test(r.url()))external.push(r.url())});
 fs.mkdirSync(dir,{recursive:true});
 async function snapshot(id){
  const bytes=Buffer.from(await page.evaluate(async()=>Array.from(
   await EmbersEditor.extractBytes())));
  const img=decodePng(bytes);
  assert.equal(img.width,512);assert.equal(img.height,512);
  fs.writeFileSync(path.join(dir,id+'.png'),bytes);
  return img;
 }
 async function seek(time){await page.evaluate(v=>EmbersEditor.seek(v),time)}
 async function get(){return page.evaluate(()=>EmbersEditor.getSettings())}
 async function set(o){return page.evaluate(v=>EmbersEditor.setSettings(v),o)}
 try{
  await page.goto(pathToFileURL(html).href);
  await page.waitForFunction(()=>typeof EmbersEditor!=='undefined'&&!!EmbersEditor.getApp(),
   null,{timeout:60000});
  await page.selectOption('#backend',target);
  await page.waitForFunction(v=>EmbersEditor.getActualBackend().actual===v,target,{timeout:60000});
  const backend=await page.evaluate(()=>EmbersEditor.getActualBackend());
  assert.equal(backend.actual,target);assert.equal(backend.pixi,'8.22.0');
  const baseline=await get();
  assert.equal(baseline.emissionFrames,40);assert.equal(baseline.exportFrames,90);
  assert.equal(baseline.emitters.length,1);
  assert.equal(baseline.emitters[0].motion.mode,'stationary');
  await seek(0);const start=await snapshot('phase-launch');
  await seek(25/60);const peak=await snapshot('phase-emission');
  await seek(60/60);const cool=await snapshot('phase-cooling');
  await seek(75/60);const fade=await snapshot('phase-shrinking');
  await seek(89/60);const end=await snapshot('phase-end-transparent');
  assert.ok(visible(start)>5,'initial particle invisible');
  assert.ok(visible(peak)>30,'emission invisible');
  assert.ok(visible(cool)>20,'emission tail invisible');
  assert.ok(visible(fade)>=3,'late cooling/size fade invisible');
  assert.equal(visible(end),0,'endpoint must be transparent');
  assert.ok(diff(start,peak)>30);assert.ok(diff(peak,cool)>30);
  await seek(.5);const reference=await snapshot('baseline');
  await seek(89/60);await seek(10/60);await seek(.5);
  assert.equal(diff(reference,await snapshot('backward-seek')),0,'non-deterministic seek');
  const zoomDeltas={};
  for(const z of ['.5','1','2']){
   await page.selectOption('#zoom',z);
   zoomDeltas[z]=diff(reference,await snapshot('zoom-'+z));
   assert.equal(zoomDeltas[z],0,'CSS camera affects PNG pixels');
  }
  await page.selectOption('#zoom','1');
  const backgrounds={};
  for(const b of ['checker','dark','light']){
   await page.selectOption('#background',b);
   await page.locator('#preview').screenshot({path:path.join(dir,'preview-'+b+'.png')});
   backgrounds[b]=diff(reference,await snapshot('background-'+b));
   assert.equal(backgrounds[b],0);
  }
  await page.selectOption('#background','checker');
  const layerDeltas={};
  for(const k of ['hot','streaks','bloom']){
   const s=structuredClone(baseline);s.emitters[0].layers[k].enabled=true;
   await set(s);await seek(.5);const yes=await snapshot('layer-'+k+'-on');
   s.emitters[0].layers[k].enabled=false;await set(s);
   const no=await snapshot('layer-'+k+'-off');
   layerDeltas[k]=diff(yes,no);
   assert.ok(layerDeltas[k]>2,'inert layer '+k);
   s.emitters[0].layers[k].enabled=true;s.emitters[0].layers[k].x+=26;
   await set(s);const offset=await snapshot('layer-'+k+'-moved');
   assert.ok(diff(yes,offset)>2,'layer XY inert '+k);
  }
  const all=structuredClone(baseline);
  for(const k of ['hot','streaks','bloom'])all.emitters[0].layers[k].enabled=false;
  await set(all);await seek(.5);
  assert.equal(visible(await snapshot('all-layers-disabled')),0);
  assert.equal((await page.evaluate(()=>EmbersEditor.getFx().sample.primitives)),0);
  await set(baseline);await seek(.5);
  // Multi emitter add, duplicate, remove are actual UI, not preset-only operations.
  await page.click('#addEmitter');assert.equal((await get()).emitters.length,2);
  await page.click('#duplicateEmitter');assert.equal((await get()).emitters.length,3);
  await page.click('#addEmitter');assert.equal((await get()).emitters.length,4);
  assert.equal(await page.locator('#addEmitter').isDisabled(),true);
  await page.click('#removeEmitter');assert.equal((await get()).emitters.length,3);
  await page.click('#removeEmitter');assert.equal((await get()).emitters.length,2);
  await page.click('#removeEmitter');assert.equal((await get()).emitters.length,1);
  await set(baseline);
  // A selected world emitter origin handle must be draggable independently.
  const orig=await get(),handle=page.locator('#originHandle'),r=await handle.boundingBox();
  assert.ok(r&&r.width>0);
  await page.mouse.move(r.x+r.width/2,r.y+r.height/2);
  await page.mouse.down();
  await page.mouse.move(r.x+r.width/2+34,r.y+r.height/2-24,{steps:5});
  await page.mouse.up();
  const moved=await get();
  assert.ok(Math.abs(moved.emitters[0].anchor.x-orig.emitters[0].anchor.x)>15);
  assert.ok(Math.abs(moved.emitters[0].anchor.y-orig.emitters[0].anchor.y)>10);
  assert.ok(diff(reference,await snapshot('origin-moved'))>3);
  await set(baseline);await seek(.5);
  for(const zoom of ['.5','2']){
   await page.selectOption('#zoom',zoom);
   const start=await get(),bounds=await page.locator('#originHandle').boundingBox();
   assert.ok(bounds);
   await page.mouse.move(bounds.x+bounds.width/2,bounds.y+bounds.height/2);
   await page.mouse.down();
   await page.mouse.move(bounds.x+bounds.width/2+20,bounds.y+bounds.height/2,
    {steps:4});await page.mouse.up();
   const result=await get();
   const expected=20/Number(zoom);
   assert.ok(Math.abs((result.emitters[0].anchor.x-start.emitters[0].anchor.x)-expected)<=2,
    'Pointer to logical pixel conversion wrong at '+zoom+' zoom');
   await set(baseline);
  }
  await page.selectOption('#zoom','1');
  // Mode gating is visible and has real 10 px path spacing effects.
  const stationary=structuredClone(baseline);stationary.emissionMode='distance';
  await set(stationary);
  assert.equal(await page.locator('#p-rate').isDisabled(),true,
   'Temporal rate must be visibly gated in distance mode');
  assert.equal(await page.locator('#p-spatialSpacing').isDisabled(),false);
  assert.equal((await page.evaluate(()=>EmbersEditor.getFx().sample.primitives)),0);
  assert.match(await page.locator('#status').textContent(),/moving source/i);
  const moving=structuredClone(stationary);
  moving.emitters[0].motion.mode='path';moving.emitters[0].motion.speed=80;
  await set(moving);await seek(.5);
  assert.ok(visible(await snapshot('moving-distance'))>0);
  const pathMark=page.locator('#trajectoryHandles circle[data-handle="c1"]');
  const rect=await pathMark.boundingBox();assert.ok(rect);
  const old=await get();await page.mouse.move(rect.x+rect.width/2,rect.y+rect.height/2);
  await page.mouse.down();await page.mouse.move(rect.x+20,rect.y-10,{steps:5});await page.mouse.up();
  assert.notDeepEqual((await get()).emitters[0].motion.path,old.emitters[0].motion.path);
  await set(baseline);await seek(.5);
  // Editable curves and independent RGBA gradient.
  for(const id of ['emissionCurveEditor','sizeCurveEditor','temperatureCurveEditor',
   'alphaCurveEditor','spacingCurveEditor'])
   assert.ok(await page.locator('#'+id+' svg').count(),'missing curve UI '+id);
  const different=structuredClone(baseline);different.palette.stops[0].rgba=[80,230,220,.3];
  await set(different);
  assert.ok(diff(reference,await snapshot('color-edited'))>5,'RGBA gradient inert');
  await set(baseline);
  const style=structuredClone(baseline);style.style='magical';await set(style);
  assert.ok(diff(reference,await snapshot('magical-style'))>3);
  await set(baseline);
  // Preset serialization carries all 4-emitter-compatible state and curve keys.
  const pending=page.waitForEvent('download');
  await page.click('#savePreset');const dl=await pending;
  const presetFile=path.join(dir,'Embers_Sparks_Preset.json');await dl.saveAs(presetFile);
  const preset=JSON.parse(fs.readFileSync(presetFile,'utf8'));
  assert.equal(preset.effectId,'fx.fire.embers-sparks');
  assert.deepEqual(preset.settings,baseline);
  await page.locator('#p-rate').evaluate(el=>{
   el.value='53';el.dispatchEvent(new Event('input',{bubbles:true}));
  });
  assert.equal((await get()).rate,53);
  await page.locator('#presetFile').setInputFiles(presetFile);
  await page.waitForFunction(()=>EmbersEditor.getSettings().rate===35);
  assert.deepEqual(await get(),baseline);
  // Out-of-bounds particles are rejected rather than silently cropped; Fit scans all export frames.
  const oversized=structuredClone(baseline);
  oversized.emitters[0].anchor.x=510;
  oversized.emitters[0].anchor.y=500;
  await set(oversized);await seek(0);
  assert.equal((await page.evaluate(()=>EmbersEditor.getFx().currentBounds())).inside,false);
  const clipMessage=await page.evaluate(async()=>{
   try{await EmbersExports.bake({download:false});return null}
   catch(e){return e.message}
  });
  assert.match(clipMessage,/exceeds 512x512/);
  await page.click('#fitCanvas');
  assert.equal((await page.evaluate(()=>EmbersEditor.getFx().currentBounds())).inside,true);
  await set(baseline);await seek(.5);
  // Real animated Spine rig with two atlas pages and active slot/attachment.
  await page.click('#sample');
  await page.waitForFunction(()=>EmbersEditor.getModel()!=null,null,{timeout:60000});
  const spine=await page.evaluate(()=>{
   const e=EmbersEditor;return {pages:e.getAsset().images.size,
    animations:e.getModel().skeleton.data.animations.length};
  });
  assert.ok(spine.pages>=2);assert.ok(spine.animations>=1);
  const bone=await page.evaluate(()=>{
   const m=EmbersEditor.getModel();
   EmbersEditor.seek(.2);const x=m.skeleton.bones.map(b=>({name:b.data.name,x:b.worldX,y:b.worldY}));
   EmbersEditor.seek(.8);const y=m.skeleton.bones.map(b=>({name:b.data.name,x:b.worldX,y:b.worldY}));
   return y.map((b,i)=>({...b,distance:Math.hypot(b.x-x[i].x,b.y-x[i].y)}))
    .sort((a,b)=>b.distance-a.distance)[0];
  });
  assert.ok(bone.distance>.05);
  const follow=await page.evaluate(name=>{
   const s=EmbersEditor.getSettings();
   s.emitters[0].anchor={...s.emitters[0].anchor,type:'bone',space:'local',
    name,x:0,y:0};
   EmbersEditor.setSettings(s);
   return [.2,.8].map(t=>{
    EmbersEditor.seek(t);
    const m=EmbersEditor.getModel(),b=m.skeleton.findBone(name);
    return {actual:EmbersEditor.getFx().resolveAnchor(s.emitters[0]),
     expected:m.worldTransform.apply({x:b.worldX,y:b.worldY},{x:0,y:0})};
   });
  },bone.name);
  for(const p of follow)assert.ok(Math.hypot(p.actual.x-p.expected.x,
   p.actual.y-p.expected.y)<.01);
  assert.ok(Math.hypot(follow[0].actual.x-follow[1].actual.x,
   follow[0].actual.y-follow[1].actual.y)>.05);
  const slot=await page.evaluate(()=>{
   const ed=EmbersEditor,m=ed.getModel();
   const selected=m.skeleton.slots.find(s=>
    s.getAttachment?.()&&s.bone?.active&&typeof s.getAttachment().computeWorldVertices==='function');
   if(!selected)return null;
   const att=selected.getAttachment(),cfg=ed.getSettings();
   cfg.emitters[0].anchor={...cfg.emitters[0].anchor,
    type:'slot',space:'local',name:selected.data.name,x:0,y:0};
   ed.setSettings(cfg);ed.seek(.5);
   const slotPos=ed.getFx().resolveAnchor(cfg.emitters[0]);
   cfg.emitters[0].anchor.type='attachment';cfg.emitters[0].anchor.name=att.name;
   cfg.emitters[0].anchor.slot=selected.data.name;ed.setSettings(cfg);ed.seek(.5);
   return {slot:slotPos,attachment:ed.getFx().resolveAnchor(cfg.emitters[0]),
    name:att.name};
  });
  assert.ok(slot?.slot&&slot.attachment&&Number.isFinite(slot.attachment.x));
  const missing=await page.evaluate(()=>{
   const s=EmbersEditor.getSettings();s.emitters[0].anchor.name='INVALID_BONE';
   s.emitters[0].anchor.type='bone';EmbersEditor.setSettings(s);EmbersEditor.seek(.5);
   return {diag:EmbersEditor.getFx().diagnostics,
    displayed:EmbersEditor.getFx().emitters.get('emitter1').container.visible};
  });
  assert.equal(missing.displayed,false);assert.match(missing.diag,/missing/i);
  // One invalid Spine anchor must not suppress an independent valid emitter.
  const sibling=await page.evaluate(()=>{
   const a=EmbersEditor.getSettings();
   const e=FxEmbers.newEmitter(1);e.anchor={...e.anchor,type:'bone',
    name:'missing_nonexistent_bone',space:'local'};
   a.emitters[0].anchor={...a.emitters[0].anchor,type:'world',name:'',slot:''};
   a.emitters.push(e);EmbersEditor.setSettings(a);EmbersEditor.seek(.5);
   return {first:EmbersEditor.getFx().emitters.get('emitter1').container.visible,
    second:EmbersEditor.getFx().emitters.get('emitter2').container.visible,
    msg:EmbersEditor.getFx().diagnostics};
  });
  assert.equal(sibling.first,true);
  assert.equal(sibling.second,false);
  assert.match(sibling.msg,/missing/i);
  await set(baseline);await seek(.5);
  // Isolated PNG ZIP + two developer ZIP packages.
  const rendered=await page.evaluate(async()=>{
   const x=await EmbersExports.bake({download:false});
   return {frames:x.manifest.frames.length,last:x.manifest.frames.at(-1).timeSeconds,
    alpha:x.manifest.alpha,size:x.blob.size};
  });
  assert.equal(rendered.frames,90);assert.equal(rendered.last,89/60);
  assert.equal(rendered.alpha,'straight-rgba8');
  const multiBake=await page.evaluate(async()=>{
   const s=EmbersEditor.getSettings();s.emitters.push(FxEmbers.newEmitter(1));
   s.exportFrames=8;EmbersEditor.setSettings(s);
   const seq=await EmbersExports.bake({download:false});
   const pack=await EmbersExports.buildPackage('webgl');
   const result={frames:seq.manifest.frames.length,
    emitters:seq.manifest.settings.emitters.length,
    exportedEmitters:pack.preset.settings.emitters.length};
   s.emitters.pop();s.exportFrames=90;EmbersEditor.setSettings(s);
   return result;
  });
  assert.deepEqual(multiBake,{frames:8,emitters:2,exportedEmitters:2});
  const dev=await page.evaluate(async()=>{
   const p=await EmbersExports.buildPackage('webgl'),q=await EmbersExports.buildPackage('webgpu');
   return [p,q].map(v=>({bytes:v.blob.size,files:v.entries.map(x=>x.name),
    effect:v.preset.effectId,compat:v.preset.compatibility}));
  });
  for(const pack of dev){
   assert.ok(pack.bytes>50000);
   assert.equal(pack.effect,'fx.fire.embers-sparks');
   assert.deepEqual(pack.compat,{pixi:'8.22.0',spine:'4.2.120'});
   for(const n of ['FxEmbers.mjs','EmbersSparks.mjs','FxCurves.mjs','FxSpacing.mjs',
    'FxColors.mjs','FxTimeline.mjs','example.js','public/preset.json',
    'public/assets/Doctor_head.json','public/assets/Doctor_head.png'])
    assert.ok(pack.files.includes(n),'Developer ZIP missing '+n);
  }
  for(const [id,filename] of [['bake','Embers_Sparks_PNG.zip'],
   ['webglZip','Embers_Sparks_WebGL.zip'],['webgpuZip','Embers_Sparks_WebGPU.zip']]){
   const pending=page.waitForEvent('download',{timeout:120000});
   await page.click('#'+id);const dl=await pending;
   await dl.saveAs(path.join(dir,filename));
   assert.ok(fs.statSync(path.join(dir,filename)).size>10000);
  }
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
  const report={status:'PASS',backend,browser:browser.version(),
   spine,boneMotion:bone.distance,slotAttachment:slot.name,
   phases:{start:visible(start),peak:visible(peak),cool:visible(cool),
    fade:visible(fade),end:visible(end)},zoomDeltas,backgrounds,layerDeltas,
   frames:rendered.frames,alpha:rendered.alpha,developerBytes:dev.map(x=>x.bytes),
   externalRequests:external.length};
  fs.writeFileSync(path.join(dir,'report.json'),JSON.stringify(report,null,2)+'\n');
  console.log('PASS FIRE-04 EDITOR',JSON.stringify(report));
 }finally{await browser.close()}
}
main().catch(e=>{console.error(e.stack||e);process.exitCode=1});
