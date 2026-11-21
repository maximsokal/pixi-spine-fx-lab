#!/usr/bin/env node
'use strict';
// FIRE-03: real Chromium backend, encoded PNG, draggable path, alpha, Spine, ZIP QA.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const {decodePng,countAlpha,comparePixels}=require('./fx_visual_png.cjs');
const opt=(name,fallback)=>{const i=process.argv.indexOf('--'+name);
 return i<0?fallback:process.argv[i+1]};
const expected=opt('backend','webgl2'),out=path.resolve(opt('output','projectile-browser-qa'));
const html=path.resolve(opt('html',path.join(__dirname,'../assets/Fireball_Projectile_Lab.html')));
const count=x=>{const o=countAlpha(x);return o.partial+o.opaque};
const difference=(a,b)=>comparePixels(a,b,{step:1,channelTolerance:0}).changedPixels;
async function main(){
 const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
 const browser=await chromium.launch({headless:true,
  ...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{}),
  args:['--no-sandbox',...(process.env.FX_SOFTWARE_GPU==='1'?
    ['--use-gl=angle','--use-angle=swiftshader','--enable-webgl',
     '--enable-unsafe-webgpu','--use-vulkan=swiftshader','--enable-features=Vulkan']:[]),
   ...(process.env.FX_ENABLE_UNSAFE_WEBGPU==='1'?['--enable-unsafe-webgpu']:[])]});
 const page=await browser.newPage({viewport:{width:1440,height:1060},offline:true,acceptDownloads:true});
 const errors=[],remote=[];
 page.on('pageerror',e=>errors.push('page:'+e.message));
 page.on('console',m=>{if(m.type()==='error')errors.push('console:'+m.text())});
 page.on('request',r=>{if(/^https?:/.test(r.url()))remote.push(r.url())});
 fs.mkdirSync(out,{recursive:true});
 async function snap(name){
  const bytes=Buffer.from(await page.evaluate(async()=>Array.from(
   await ProjectileEditor.extractBytes())));
  const image=decodePng(bytes);
  assert.equal(image.width,512);assert.equal(image.height,512);
  fs.writeFileSync(path.join(out,name+'.png'),bytes);
  return image;
 }
 async function seek(seconds){await page.evaluate(t=>ProjectileEditor.seek(t),seconds)}
 async function set(cfg){return page.evaluate(x=>ProjectileEditor.setSettings(x),cfg)}
 async function settings(){return page.evaluate(()=>ProjectileEditor.getSettings())}
 try{
  await page.goto(pathToFileURL(html).href);
  await page.waitForFunction(()=>typeof ProjectileEditor!=='undefined'&&!!ProjectileEditor.getApp(),null,{timeout:60000});
  await page.selectOption('#backend',expected);
  await page.waitForFunction(b=>ProjectileEditor.getActualBackend().actual===b,expected,{timeout:60000});
  const backend=await page.evaluate(()=>ProjectileEditor.getActualBackend());
  assert.equal(backend.actual,expected);assert.equal(backend.pixi,'8.22.0');
  const originals=await settings();
  assert.equal(originals.exportFrames,120);
  assert.equal(originals.loop,false);
  await seek(0);const start=await snap('phase-launch');
  await seek(30/60);const travel=await snap('phase-flight');
  await seek(60/60);const turn=await snap('phase-turn');
  await seek(119/60);const fade=await snap('phase-fade');
  assert.ok(count(start)>300,'spawn not visible');
  assert.ok(count(travel)>350,'travel invisible');
  assert.ok(difference(start,travel)>150,'static projectile');
  assert.ok(difference(travel,turn)>150,'missing motion');
  assert.ok(difference(turn,fade)>150,'no fade');
  const future={...originals,exportFrames:125};
  await set(future);await seek(120/60);
  const end=await snap('phase-end-transparent');
  assert.equal(count(end),0,'one-shot endpoint still visible');
  await set(originals);
  await seek(60/60);const baseline=await snap('baseline');
  await seek(119/60);await seek(6/60);await seek(60/60);
  assert.equal(difference(baseline,await snap('seek-repeat')),0,'absolute reseek non-deterministic');
  const zoomDeltas={};
  for(const zoom of ['.5','1','2']){
   await page.selectOption('#zoom',zoom);
   zoomDeltas[zoom]=difference(baseline,await snap('zoom-'+zoom));
   assert.equal(zoomDeltas[zoom],0,'CSS zoom changed PNG');
  }
  await page.selectOption('#zoom','1');
  const backgrounds={};
  for(const b of ['checker','dark','light']){
   await page.selectOption('#background',b);
   await page.locator('#preview').screenshot({path:path.join(out,'preview-'+b+'.png')});
   backgrounds[b]=difference(baseline,await snap('background-'+b));
   assert.equal(backgrounds[b],0,'CSS background polluted PNG');
  }
  await page.selectOption('#background','checker');
  await page.locator('#trajectoryHandles').evaluate(el=>el.hidden=true);
  assert.equal(difference(baseline,await snap('without-dom-path-guide')),0,
   'DOM guide leaked into export');
  await page.locator('#trajectoryHandles').evaluate(el=>el.hidden=false);
  // Each artist-independent layer must alter only its own drawing.
  const layerDeltas={};
  for(const k of ['core','ribbon','sparks','embers','haze']){
   let s=await settings();
   if(k==='haze'){s.heatHaze=true;s.layers.haze.enabled=true}
   await set(s);await seek(k==='core'?0:60/60);
   const initial=await snap('layer-'+k+'-visible');
   s.layers[k].enabled=false;await set(s);
   const hidden=await snap('layer-'+k+'-off');
   layerDeltas[k]=difference(initial,hidden);
   assert.ok(layerDeltas[k]>3,'layer toggle no-op: '+k);
   s.layers[k].enabled=true;s.layers[k].x+=24;
   await set(s);const shifted=await snap('layer-'+k+'-shifted');
   assert.ok(difference(initial,shifted)>3,'layer XY no-op: '+k);
   await set(originals);
  }
  const disabled=structuredClone(originals);
  for(const k of Object.keys(disabled.layers))disabled.layers[k].enabled=false;
  await set(disabled);await seek(60/60);
  assert.equal((await page.evaluate(()=>ProjectileEditor.getFx().sample.primitives)),0);
  assert.equal(count(await snap('all-disabled')),0,'all-disabled contains ghost alpha');
  await set(originals);await seek(60/60);
  const labels=['taperCurveEditor','trailAlphaCurveEditor','pulseCurveEditor',
    'emissionCurveEditor','spacingCurveEditor'];
  for(const id of labels)assert.ok(await page.locator('#'+id+' svg').count()>0,
    'missing interactive curve '+id);
  // Artist path drag is tracked in native 512 logical authoring coordinates.
  const before=await settings();
  const marker=page.locator('#trajectoryHandles circle[data-handle="c1"]');
  const r=await marker.boundingBox();
  assert.ok(r&&r.width>0);
  await page.mouse.move(r.x+r.width/2,r.y+r.height/2);
  await page.mouse.down();
  await page.mouse.move(r.x+r.width/2+23,r.y+r.height/2-15,{steps:6});
  await page.mouse.up();
  const changed=await settings();
  assert.ok(Math.abs(changed.trajectory.segments[0].p1[0]-
    before.trajectory.segments[0].p1[0])>10,'Bezier handle not editable');
  assert.ok(Math.abs(changed.trajectory.segments[0].p1[1]-
    before.trajectory.segments[0].p1[1])>5);
  const modified=await snap('path-handle-moved');
  assert.ok(difference(baseline,modified)>10,'trajectory edit not visible');
  await set(originals);
  // Independent tail unlocking: head coordinates MUST stay fixed.
  const unlock={...originals,unlockTail:true};
  await set(unlock);await seek(.7);
  const tail=page.locator('#trajectoryHandles circle[data-handle="tail"]');
  const tRect=await tail.boundingBox();
  assert.ok(tRect&&tRect.width>0);
  const originalHead=await page.evaluate(()=>ProjectileEditor.getFx().sample.head);
  await page.mouse.move(tRect.x+tRect.width/2,tRect.y+tRect.height/2);
  await page.mouse.down();
  await page.mouse.move(tRect.x+tRect.width/2-32,tRect.y+tRect.height/2+25,{steps:4});
  await page.mouse.up();
  const tailState=await settings();
  const nextHead=await page.evaluate(()=>ProjectileEditor.getFx().sample.head);
  assert.deepEqual(nextHead,originalHead,'tail drag moved projectile head');
  assert.ok(Math.abs(tailState.tailX-unlock.tailX)>8,'tail XY drag did not persist');
  await set(originals);
  // Save/load actual JSON preset via DOM controls, including entire path and curves.
  const pending=page.waitForEvent('download');
  await page.click('#savePreset');const presetDl=await pending;
  const file=path.join(out,'Fireball_Projectile_Preset.json');
  await presetDl.saveAs(file);
  const saved=JSON.parse(fs.readFileSync(file,'utf8'));
  assert.equal(saved.effectId,'fx.fire.fireball-projectile');
  assert.deepEqual(saved.settings,originals);
  await page.locator('#p-speed').evaluate(el=>{
   el.value='420';el.dispatchEvent(new Event('input',{bubbles:true}));
  });
  assert.equal((await settings()).speed,420);
  await page.locator('#presetFile').setInputFiles(file);
  await page.waitForFunction(()=>ProjectileEditor.getSettings().speed===200);
  assert.deepEqual(await settings(),originals,'preset roundtrip lost path/control');
  // Boundary check must block oversized path and Fit requires explicit artist action.
  const oversized=structuredClone(originals);
  oversized.trajectory.segments=oversized.trajectory.segments.map(seg=>
   Object.fromEntries(Object.entries(seg).map(([k,v])=>[k,[v[0]*2.8,v[1]*2.8]])));
  oversized.coreRadius=120;
  await set(oversized);await seek(.7);
  const clipped=await page.evaluate(()=>ProjectileEditor.getFx().currentBounds());
  assert.equal(clipped.inside,false,'oversized path not detected');
  const error=await page.evaluate(async()=>{
   try{await ProjectileExports.bake({download:false});return null}
   catch(e){return e.message}
  });
  assert.match(error,/exceeds 512x512/,'cropped PNG incorrectly allowed');
  await page.click('#fitCanvas');
  const fit=await page.evaluate(()=>ProjectileEditor.getFx().currentBounds());
  assert.equal(fit.inside,true,'explicit Fit did not solve oversized source');
  await set(originals);
  // Spine real JSON with two atlas pages; animated bone follow and missing anchors.
  await page.click('#sample');
  await page.waitForFunction(()=>ProjectileEditor.getModel()!=null,null,{timeout:60000});
  const spine=await page.evaluate(()=>{
   const ed=ProjectileEditor;
   return {imageCount:ed.getAsset().images.size,animations:ed.getModel().skeleton.data.animations.length}
  });
  assert.ok(spine.imageCount>=2);
  const bone=await page.evaluate(()=>{
   const m=ProjectileEditor.getModel();
   ProjectileEditor.seek(.2);const a=m.skeleton.bones.map(b=>({name:b.data.name,x:b.worldX,y:b.worldY}));
   ProjectileEditor.seek(.8);const b=m.skeleton.bones.map(b=>({name:b.data.name,x:b.worldX,y:b.worldY}));
   return b.map((p,i)=>({...p,motion:Math.hypot(p.x-a[i].x,p.y-a[i].y)}))
    .sort((x,y)=>y.motion-x.motion)[0];
  });
  assert.ok(bone.motion>.05,'Spine sample lacks animated bone');
  const following=await page.evaluate(name=>{
   const cfg=ProjectileEditor.getSettings();
   cfg.anchor={...cfg.anchor,type:'bone',space:'local',name,x:0,y:0};
   ProjectileEditor.setSettings(cfg);
   return [.2,.8].map(t=>{
    ProjectileEditor.seek(t);
    const model=ProjectileEditor.getModel(),b=model.skeleton.findBone(name);
    const expected=model.worldTransform.apply({x:b.worldX,y:b.worldY},{x:0,y:0});
    return {actual:ProjectileEditor.getFx().resolveAnchor(),expected};
   });
  },bone.name);
  for(const frame of following){
   assert.ok(frame.actual);
   assert.ok(Math.hypot(frame.actual.x-frame.expected.x,
    frame.actual.y-frame.expected.y)<.01,'anchor does not follow Spine bone');
  }
  assert.ok(Math.hypot(following[0].actual.x-following[1].actual.x,
   following[0].actual.y-following[1].actual.y)>.05);
  const slotAttachment=await page.evaluate(()=>{
   const ed=ProjectileEditor,model=ed.getModel();
   const selected=model.skeleton.slots.find(s=>
    s.getAttachment?.()&&s.bone?.active&&
    typeof s.getAttachment().computeWorldVertices==='function');
   if(!selected)return null;
   const attachment=selected.getAttachment(),slotName=selected.data.name;
   const cfg=ed.getSettings();cfg.anchor.type='slot';cfg.anchor.name=slotName;
   cfg.anchor.space='local';cfg.anchor.x=0;cfg.anchor.y=0;
   ed.setSettings(cfg);ed.seek(.7);
   const slotPos=ed.getFx().resolveAnchor();
   cfg.anchor.type='attachment';cfg.anchor.name=attachment.name;cfg.anchor.slot=slotName;
   ed.setSettings(cfg);ed.seek(.7);
   const attachmentPos=ed.getFx().resolveAnchor();
   return {slotName,attachmentName:attachment.name,slotPos,attachmentPos,
    diagnostic:ed.getFx().diagnostics};
  });
  assert.ok(slotAttachment,'Sample has no active region/mesh attachment for anchor test');
  for(const value of [slotAttachment.slotPos,slotAttachment.attachmentPos])
   assert.ok(value&&Number.isFinite(value.x)&&Number.isFinite(value.y),
    'Missing slot/attachment anchor transform: '+JSON.stringify(slotAttachment));
  const missing=await page.evaluate(()=>{
   const cfg=ProjectileEditor.getSettings();cfg.anchor.name='NO_SUCH_BONE';
   ProjectileEditor.setSettings(cfg);
   return {visible:ProjectileEditor.getFx().owned.visible,
    diagnostics:ProjectileEditor.getFx().diagnostics};
  });
  assert.equal(missing.visible,false);
  assert.match(missing.diagnostics,/missing|inactive/i);
  await set(originals);
  // 8-frame sample and full 120-frame one-shot PNG ZIP.
  const short=await page.evaluate(async()=>{
   const cfg=ProjectileEditor.getSettings();cfg.exportFrames=8;ProjectileEditor.setSettings(cfg);
   const result=await ProjectileExports.bake({download:false});
   cfg.exportFrames=120;ProjectileEditor.setSettings(cfg);
   return {count:result.manifest.frames.length,
    last:result.manifest.frames.at(-1).timeSeconds,size:result.blob.size};
  });
  assert.equal(short.count,8);assert.equal(short.last,7/60);assert.ok(short.size>10000);
  const baked=await page.evaluate(async()=>{
   const result=await ProjectileExports.bake({download:false});
   return {count:result.manifest.frames.length,
    final:result.manifest.frames.at(-1).timeSeconds,
    alpha:result.manifest.alpha,size:result.blob.size};
  });
  assert.equal(baked.count,120);assert.equal(baked.final,119/60);
  assert.equal(baked.alpha,'straight-rgba8');assert.ok(baked.size>100000);
  const dev=await page.evaluate(async()=>{
   const a=await ProjectileExports.buildPackage('webgl');
   const b=await ProjectileExports.buildPackage('webgpu');
   return [a,b].map(p=>({size:p.blob.size,names:p.entries.map(x=>x.name),
    schema:p.preset.schemaVersion,effectId:p.preset.effectId,compat:p.preset.compatibility}));
  });
  for(const pkg of dev){
   assert.ok(pkg.size>100000);
   assert.equal(pkg.effectId,'fx.fire.fireball-projectile');
   assert.deepEqual(pkg.compat,{pixi:'8.22.0',spine:'4.2.120'});
   for(const filename of ['FxPath.mjs','FxProjectile.mjs','FireballProjectile.mjs',
    'FxCurves.mjs','FxSpacing.mjs','FxColors.mjs','FxTimeline.mjs',
    'example.js','public/preset.json','public/assets/Doctor_head.json',
    'public/assets/Doctor_head.png','public/assets/Doctor_head_2.png'])
    assert.ok(pkg.names.includes(filename),'Missing developer ZIP member '+filename);
  }
  for(const [id,outfile] of [
   ['bake','Fireball_Projectile_PNG.zip'],['webglZip','Fireball_Projectile_WebGL.zip'],
   ['webgpuZip','Fireball_Projectile_WebGPU.zip']]){
   const pending=page.waitForEvent('download',{timeout:120000});await page.click('#'+id);
   const dl=await pending;await dl.saveAs(path.join(out,outfile));
   assert.ok(fs.statSync(path.join(out,outfile)).size>100000);
  }
  assert.deepEqual(errors,[],'browser exceptions');
  assert.deepEqual(remote,[],'offline editor made external request');
  const report={status:'PASS',backend,browser:browser.version(),spine,boneMotion:bone.motion,
   slotAttachment:{slot:slotAttachment.slotName,attachment:slotAttachment.attachmentName},
   phases:{launch:count(start),travel:count(travel),turn:count(turn),fade:count(fade),
    end:count(end)},zoomDeltas,backgrounds,layerDeltas,frameCount:baked.count,
   alpha:baked.alpha,developerBytes:dev.map(x=>x.size),networkRequests:remote.length};
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
  console.log('PASS FIRE-03 PROJECTILE BROWSER',JSON.stringify(report));
 }finally{await browser.close()}
}
main().catch(e=>{console.error(e.stack||e);process.exitCode=1});
