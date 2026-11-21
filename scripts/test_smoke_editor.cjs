#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const {decodePng,countAlpha,comparePixels}=require('./fx_visual_png.cjs');
const arg=(key,fallback)=>{const i=process.argv.indexOf('--'+key);return i<0?fallback:process.argv[i+1]};
const backend=arg('backend','webgl2'),dir=path.resolve(arg('output','smoke-browser-qa'));
const full=process.argv.includes('--full');
const html=path.resolve(arg('html',path.join(__dirname,'../assets/Smoke_Plume_Lab.html')));
const count=a=>{const c=countAlpha(a);return c.partial+c.opaque};
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
  const bytes=Buffer.from(await page.evaluate(async()=>Array.from(await SmokeEditor.extractBytes())));
  const img=decodePng(bytes);
  assert.equal(img.width,512);assert.equal(img.height,512);
  fs.writeFileSync(path.join(dir,id+'.png'),bytes);
  return img;
 }
 const seek=async v=>page.evaluate(t=>SmokeEditor.seek(t),v);
 const get=async()=>page.evaluate(()=>SmokeEditor.getSettings());
 const set=async o=>page.evaluate(v=>SmokeEditor.setSettings(v),o);
 try{
  await page.goto(pathToFileURL(html).href);
  await page.waitForFunction(()=>typeof SmokeEditor!=='undefined'&&!!SmokeEditor.getApp(),
    null,{timeout:60000});
  await page.selectOption('#backend',backend);
  await page.waitForFunction(v=>SmokeEditor.getActualBackend().actual===v,
   backend,{timeout:60000});
  const real=await page.evaluate(()=>SmokeEditor.getActualBackend());
  assert.equal(real.actual,backend);
  assert.equal(real.pixi,'8.22.0');
  const base=await get();
  assert.equal(base.mode,'loop');assert.equal(base.rate,18);
  assert.equal(base.durationFrames,120);assert.equal(base.lifetimeSeconds,2);
  assert.equal(base.emitters.length,1);
  const masks=await page.evaluate(()=>{
   const fx=SmokeEditor.getFx();
   return fx.masks.map(m=>{
    const ctx=m.canvas.getContext('2d'),pixels=ctx.getImageData(0,0,96,96).data;
    const at=(x,y)=>pixels[(y*96+x)*4+3];
    return {size:[m.canvas.width,m.canvas.height],
     corners:[at(0,0),at(95,0),at(0,95),at(95,95)],
     border:[at(48,0),at(48,95),at(0,48),at(95,48)],
     center:at(48,48),nearEdge:at(89,48),
     textureReady:m.texture!=null};
   });
  });
  assert.equal(masks.length,4);
  for(const m of masks){
   assert.deepEqual(m.size,[96,96]);
   assert.deepEqual(m.corners,[0,0,0,0]);
   assert.deepEqual(m.border,[0,0,0,0]);
   assert.ok(m.center>100);
   assert.ok(m.nearEdge<50);
   assert.equal(m.textureReady,true);
  }
  await seek(0);const opening=await snapshot('phase-established');
  await seek(.5);const middle=await snapshot('phase-lofting');
  await seek(1.5);const late=await snapshot('phase-broadening');
  await seek(119/60);const last=await snapshot('phase-loop-end');
  assert.ok(count(opening)>100,'warm loop has no smoke');
  assert.ok(count(middle)>100);assert.ok(count(late)>100);
  assert.ok(diff(opening,middle)>200);
  assert.ok(diff(middle,late)>200);
  await page.evaluate(()=>{SmokeEditor.getFx().seek(120/60);SmokeEditor.getApp().render()});
  const cycle=await snapshot('phase-wrap-120');
  assert.equal(diff(opening,cycle),0,'loop seam pixels changed at period boundary');
  await seek(.5);const reference=await snapshot('baseline');
  await seek(1.8);await seek(.1);await seek(.5);
  assert.equal(diff(reference,await snapshot('backwards-seek')),0);
  const zooms={};
  for(const z of ['.5','1','2']){
   await page.selectOption('#zoom',z);
   zooms[z]=diff(reference,await snapshot('zoom-'+z));
   assert.equal(zooms[z],0,'CSS zoom contaminates 512px PNG');
  }
  await page.selectOption('#zoom','1');
  const backgrounds={};
  for(const name of ['checker','dark','light']){
   await page.selectOption('#background',name);
   await page.locator('#preview').screenshot({path:path.join(dir,'preview-'+name+'.png')});
   backgrounds[name]=diff(reference,await snapshot('background-'+name));
   assert.equal(backgrounds[name],0);
  }
  await page.selectOption('#background','checker');
  // Smoke overlap should not have alpha-opaque rectangular footprint or black PMA fringe.
  const alpha=countAlpha(reference);
  assert.ok(alpha.partial>300,'smoke mask has no semitransparent feather');
  assert.ok(alpha.transparent>100000,'smoke PNG unexpectedly opaque canvas');
  let alpha64Pixels=0,minRGBAtAlpha64=255;
  for(let i=0;i<reference.pixels.length;i+=4){
   const p=reference.pixels;
   if(p[i+3]<64)continue;
   alpha64Pixels++;
   minRGBAtAlpha64=Math.min(minRGBAtAlpha64,p[i],p[i+1],p[i+2]);
  }
  assert.ok(alpha64Pixels>1500,'no smoke with meaningful partial alpha');
  assert.ok(minRGBAtAlpha64>=38,
   'premultiplied dark seam leaked into straight RGBA PNG: RGB='+minRGBAtAlpha64);
  const layers={};
  for(const k of ['core','wisps','ash']){
   const value=structuredClone(base);
   value.emitters[0].layers[k].enabled=true;
   await set(value);await seek(.5);const yes=await snapshot('layer-'+k+'-on');
   value.emitters[0].layers[k].enabled=false;await set(value);
   const no=await snapshot('layer-'+k+'-off');
   layers[k]=diff(yes,no);
   assert.ok(layers[k]>4,'inert layer '+k);
   value.emitters[0].layers[k].enabled=true;
   value.emitters[0].layers[k].x+=24;
   await set(value);
   assert.ok(diff(yes,await snapshot('layer-'+k+'-offset'))>5);
  }
  const off=structuredClone(base);
  for(const k of ['core','wisps','ash'])off.emitters[0].layers[k].enabled=false;
  await set(off);
  assert.equal(count(await snapshot('layers-all-off')),0);
  assert.equal((await page.evaluate(()=>SmokeEditor.getFx().sample.primitives)),0);
  await set(base);await seek(.5);
  await page.click('#addEmitter');assert.equal((await get()).emitters.length,2);
  await page.click('#duplicateEmitter');assert.equal((await get()).emitters.length,3);
  await page.click('#addEmitter');assert.equal((await get()).emitters.length,4);
  assert.equal(await page.locator('#addEmitter').isDisabled(),true);
  await page.click('#removeEmitter');await page.click('#removeEmitter');
  await page.click('#removeEmitter');
  assert.equal((await get()).emitters.length,1);
  await set(base);
  const orig=await get(),handle=page.locator('#originHandle'),h=await handle.boundingBox();
  assert.ok(h);
  await page.mouse.move(h.x+h.width/2,h.y+h.height/2);await page.mouse.down();
  await page.mouse.move(h.x+h.width/2+25,h.y+h.height/2-18,{steps:5});
  await page.mouse.up();
  const moved=await get();
  assert.ok(Math.abs(moved.emitters[0].anchor.x-orig.emitters[0].anchor.x)>12);
  assert.ok(Math.abs(moved.emitters[0].anchor.y-orig.emitters[0].anchor.y)>10);
  assert.ok(diff(reference,await snapshot('emitter-origin-moved'))>100);
  await set(base);
  for(const z of ['.5','2']){
   await page.selectOption('#zoom',z);
   const b=await page.locator('#originHandle').boundingBox();assert.ok(b);
   await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();
   await page.mouse.move(b.x+b.width/2+20,b.y+b.height/2,{steps:4});
   await page.mouse.up();
   const changed=await get();
   assert.ok(Math.abs((changed.emitters[0].anchor.x-base.emitters[0].anchor.x)-
     20/Number(z))<=2,'incorrect zoom pointer '+z);
   await set(base);
  }
  await page.selectOption('#zoom','1');
  // One independent source position mode can emit from its nozzle at rest.
  assert.ok(count(reference)>0);
  const distance=structuredClone(base);distance.emissionMode='distance';
  await set(distance);await seek(.5);
  assert.equal(count(await snapshot('stationary-distance')),0);
  assert.match(await page.locator('#status').textContent(),/moving source/i);
  const pathSource=structuredClone(distance);
  pathSource.emitters[0].motion.mode='path';pathSource.emitters[0].motion.speed=90;
  await set(pathSource);await seek(.5);
  assert.ok(count(await snapshot('moving-distance'))>0);
  const curveHandle=page.locator('#trajectoryHandles circle[data-handle="c1"]');
  const rect=await curveHandle.boundingBox();assert.ok(rect);
  const old=await get();
  await page.mouse.move(rect.x+rect.width/2,rect.y+rect.height/2);
  await page.mouse.down();await page.mouse.move(rect.x+22,rect.y-14,{steps:5});
  await page.mouse.up();
  assert.notDeepEqual((await get()).emitters[0].motion.path,old.emitters[0].motion.path);
  await set(base);await seek(.5);
  for(const id of ['emissionCurveEditor','sizeCurveEditor','opacityCurveEditor',
   'riseCurveEditor','spacingCurveEditor']){
   assert.ok(await page.locator('#'+id+' svg').count(),'missing curve surface '+id);
  }
  const changedColor=structuredClone(base);
  changedColor.palette.stops[0].rgba=[90,210,210,.5];await set(changedColor);
  assert.ok(diff(reference,await snapshot('palette-rgba'))>40);
  const magical=structuredClone(base);magical.style='magical';
  await set(magical);assert.ok(diff(reference,await snapshot('style-magical'))>40);
  await set(base);
  const pending=page.waitForEvent('download');
  await page.click('#savePreset');const download=await pending;
  const presetFile=path.join(dir,'Smoke_Plume_Preset.json');
  await download.saveAs(presetFile);
  assert.deepEqual(JSON.parse(fs.readFileSync(presetFile,'utf8')).settings,base);
  await page.locator('#p-rate').evaluate(el=>{
   el.value='33';el.dispatchEvent(new Event('input',{bubbles:true}));
  });
  assert.equal((await get()).rate,33);
  await page.locator('#presetFile').setInputFiles(presetFile);
  await page.waitForFunction(()=>SmokeEditor.getSettings().rate===18);
  assert.deepEqual(await get(),base);
  // Mode switching must edit all dependent sequence frame controls coherently.
  await page.selectOption('#mode','burst');
  const burst=await get();assert.equal(burst.mode,'burst');
  assert.equal(burst.durationFrames,100);assert.equal(burst.exportFrames,100);
  await seek(.5);assert.ok(count(await snapshot('burst-rise'))>50);
  await seek(98/60);const tail=await snapshot('burst-fade-98');
  await seek(99/60);assert.equal(count(await snapshot('burst-transparent-99')),0);
  await page.evaluate(()=>{SmokeEditor.getFx().seek(100/60);SmokeEditor.getApp().render()});
  assert.equal(count(await snapshot('burst-transparent-100')),0);
  await page.selectOption('#mode','stop');
  const stop=await get();assert.equal(stop.mode,'stop');
  assert.equal(stop.durationFrames,120);
  await seek(90/60);assert.ok(count(await snapshot('stop-half-fade'))>0);
  await seek(119/60);assert.equal(count(await snapshot('stop-transparent-119')),0);
  await page.evaluate(()=>{SmokeEditor.getFx().seek(120/60);SmokeEditor.getApp().render()});
  assert.equal(count(await snapshot('stop-transparent-120')),0);
  await set(base);await seek(.5);
  // Spine 4.2 JSON, two-page atlas, animated bone and active slot / attachment.
  await page.click('#sample');
  await page.waitForFunction(()=>SmokeEditor.getModel()!=null,null,{timeout:60000});
  const spine=await page.evaluate(()=>{
   const e=SmokeEditor;return {pages:e.getAsset().images.size,
    animations:e.getModel().skeleton.data.animations.length};
  });
  assert.ok(spine.pages>=2);assert.ok(spine.animations>=1);
  const bone=await page.evaluate(()=>{
   const m=SmokeEditor.getModel();SmokeEditor.seek(.2);
   const first=m.skeleton.bones.map(b=>({name:b.data.name,x:b.worldX,y:b.worldY}));
   SmokeEditor.seek(.8);
   return m.skeleton.bones.map((b,i)=>({name:b.data.name,
    delta:Math.hypot(b.worldX-first[i].x,b.worldY-first[i].y)}))
    .sort((a,b)=>b.delta-a.delta)[0];
  });
  assert.ok(bone.delta>.05);
  const follows=await page.evaluate(name=>{
   const e=SmokeEditor,s=e.getSettings();
   s.emitters[0].anchor={...s.emitters[0].anchor,type:'bone',name,
    space:'local',x:0,y:0};
   e.setSettings(s);
   return [.2,.8].map(t=>{e.seek(t);
    const bone=e.getModel().skeleton.findBone(name);
    const expected=e.getModel().worldTransform.apply(
     {x:bone.worldX,y:bone.worldY},{x:0,y:0});
    return {actual:e.getFx().resolveAnchor(s.emitters[0]),expected};
   });
  },bone.name);
  for(const f of follows)
   assert.ok(Math.hypot(f.actual.x-f.expected.x,f.actual.y-f.expected.y)<.01);
  assert.ok(Math.hypot(follows[0].actual.x-follows[1].actual.x,
   follows[0].actual.y-follows[1].actual.y)>.05);
  const attachment=await page.evaluate(()=>{
   const e=SmokeEditor,m=e.getModel();
   const slot=m.skeleton.slots.find(s=>
    s.getAttachment?.()&&s.bone?.active&&typeof s.getAttachment().computeWorldVertices==='function');
   if(!slot)return null;
   const a=e.getSettings();
   a.emitters[0].anchor={...a.emitters[0].anchor,type:'slot',
    name:slot.data.name,space:'local',x:0,y:0};
   e.setSettings(a);e.seek(.5);
   const slotPt=e.getFx().resolveAnchor(a.emitters[0]);
   a.emitters[0].anchor.type='attachment';
   a.emitters[0].anchor.name=slot.getAttachment().name;
   a.emitters[0].anchor.slot=slot.data.name;
   e.setSettings(a);e.seek(.5);
   return {slot:slotPt,att:e.getFx().resolveAnchor(a.emitters[0])};
  });
  assert.ok(attachment?.slot&&attachment.att);
  const missing=await page.evaluate(()=>{
   const e=SmokeEditor,s=e.getSettings();
   s.emitters[0].anchor.type='bone';s.emitters[0].anchor.name='MISSING';
   s.emitters.push(FxSmoke.newEmitter(1));
   e.setSettings(s);e.seek(.5);
   return {first:e.getFx().emitters.get('emitter1').container.visible,
    second:e.getFx().emitters.get('emitter2').container.visible,
    diag:e.getFx().diagnostics};
  });
  assert.equal(missing.first,false);assert.equal(missing.second,true);
  assert.match(missing.diag,/missing/i);
  await set(base);await seek(.5);
  // Full isolated PNG sequence only on WebGL2 run; other backends validate
  // 8 sampled frames and the entire real preview/camera/anchor surface.
  const frameCount=full?120:8;
  const loopSettings=structuredClone(base);loopSettings.exportFrames=frameCount;
  await set(loopSettings);
  const loopPackage=await page.evaluate(async()=>{
   const p=await SmokeExports.bake({download:false});
   return {count:p.manifest.frames.length,last:p.manifest.frames.at(-1).timeSeconds,
    alpha:p.manifest.alpha,bytes:p.blob.size};
  });
  assert.equal(loopPackage.count,frameCount);assert.equal(loopPackage.alpha,'straight-rgba8');
  assert.equal(loopPackage.last,(frameCount-1)/60);
  if(full){
   const b=structuredClone(base);
   b.mode='burst';b.durationFrames=100;b.exportFrames=100;
   await set(b);
   const pack=await page.evaluate(async()=>{
    const p=await SmokeExports.bake({download:false});
    return {count:p.manifest.frames.length,bytes:p.blob.size};
   });
   assert.equal(pack.count,100);
  }
  await set(base);await seek(.5);
  const dev=await page.evaluate(async()=>{
   const [a,b]=await Promise.all([SmokeExports.buildPackage('webgl'),
    SmokeExports.buildPackage('webgpu')]);
   return [a,b].map(p=>({size:p.blob.size,files:p.entries.map(e=>e.name),
    effect:p.preset.effectId,compat:p.preset.compatibility}));
  });
  for(const p of dev){
   assert.ok(p.size>50000);
   assert.equal(p.effect,'fx.fire.smoke-plume');
   assert.deepEqual(p.compat,{pixi:'8.22.0',spine:'4.2.120'});
   for(const name of ['FxSmoke.mjs','SmokePlume.mjs','FxCurves.mjs','FxSpacing.mjs',
    'FxColors.mjs','FxTimeline.mjs','example.js','public/preset.json',
    'public/assets/Doctor_head.json'])
    assert.ok(p.files.includes(name),'Dev ZIP missing '+name);
  }
  // Exact download zip contents and CRC are checked by host after this test.
  for(const [id,filename] of [['webglZip','Smoke_Plume_WebGL.zip'],
   ['webgpuZip','Smoke_Plume_WebGPU.zip']]){
   const done=page.waitForEvent('download',{timeout:120000});
   await page.click('#'+id);const item=await done;
   await item.saveAs(path.join(dir,filename));
   assert.ok(fs.statSync(path.join(dir,filename)).size>10000);
  }
  if(full){
   const expected=page.waitForEvent('download',{timeout:120000});
   await page.click('#bake');const item=await expected;
   await item.saveAs(path.join(dir,'Smoke_Plume_120frames_PNG.zip'));
   assert.ok(fs.statSync(path.join(dir,'Smoke_Plume_120frames_PNG.zip')).size>10000);
  }
  assert.deepEqual(errors,[],'browser errors');
  assert.deepEqual(external,[],'unexpected network');
  const report={status:'PASS',backend:real,browser:browser.version(),
   full,modeFrames:frameCount,spine,animatedBoneDelta:bone.delta,
   masks,phases:{opening:count(opening),lofting:count(middle),
    broadening:count(late),loopEnd:count(last),wrap:count(cycle),
    burstLate:count(tail)},
   layers,zooms,backgrounds,alpha,minRGBAtAlpha64,alpha64Pixels,package:loopPackage,
   developerBytes:dev.map(p=>p.size),network:external.length};
  fs.writeFileSync(path.join(dir,'report.json'),JSON.stringify(report,null,2)+'\n');
  console.log('PASS FIRE-05 EDITOR '+JSON.stringify(report));
 }finally{await browser.close()}
}
main().catch(e=>{console.error(e.stack||e);process.exitCode=1});
