#!/usr/bin/env node
'use strict';
// FIRE-02 actual-browser QA: independent PNG decoder, real backend, Spine & ZIP.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const {decodePng,countAlpha,comparePixels}=require('./fx_visual_png.cjs');
function arg(k,def){const i=process.argv.indexOf('--'+k);return i>=0?process.argv[i+1]:def}
const target=arg('backend','webgl2'),output=path.resolve(arg('output','explosion-qa'));
if(!['webgl1','webgl2','webgpu'].includes(target))throw Error('Invalid backend '+target);
const editor=path.resolve(arg('html',path.join(__dirname,'../assets/Fire_Explosion_Lab.html')));
async function main(){
 const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
 const browser=await chromium.launch({headless:true,
  ...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{}),
  args:['--no-sandbox',
   ...(process.env.FX_ENABLE_UNSAFE_WEBGPU==='1'?['--enable-unsafe-webgpu']:[]),
   ...(process.env.FX_SOFTWARE_GPU==='1'?[
    '--use-gl=angle','--use-angle=swiftshader','--enable-webgl',
    '--enable-unsafe-webgpu','--use-vulkan=swiftshader','--enable-features=Vulkan']:[])]
 });
 const page=await browser.newPage({viewport:{width:1360,height:1040},offline:true});
 const errors=[],requests=[];
 page.on('pageerror',e=>errors.push('page: '+e.message));
 page.on('console',m=>{if(m.type()==='error')errors.push('console: '+m.text())});
 page.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url())});
 fs.mkdirSync(output,{recursive:true});
 async function png(name){
  const data=await page.evaluate(async()=>Array.from(await ExplosionEditor.extractBytes()));
  const bytes=Buffer.from(data),decoded=decodePng(bytes);
  assert.equal(decoded.width,512);assert.equal(decoded.height,512);
  fs.writeFileSync(path.join(output,name+'.png'),bytes);
  return decoded;
 }
 async function seek(time){await page.evaluate(t=>ExplosionEditor.seek(t),time)}
 const delta=(a,b)=>comparePixels(a,b,{step:1,channelTolerance:0}).changedPixels;
 try{
  await page.goto(pathToFileURL(editor).href);
  await page.waitForFunction(()=>typeof ExplosionEditor!=='undefined'&&ExplosionEditor.getApp(),null,{timeout:60000});
  await page.selectOption('#backend',target);
  await page.waitForFunction(expected=>ExplosionEditor.getActualBackend().actual===expected,target,{timeout:60000});
  const actual=await page.evaluate(()=>ExplosionEditor.getActualBackend());
  assert.equal(actual.actual,target);assert.equal(actual.pixi,'8.22.0');
  await seek(0);const flash=await png('phase-flash');
  await seek(6/60);const expansion=await png('phase-expand');
  await seek(12/60);const peak=await png('phase-fire');
  await seek(20/60);const breakup=await png('phase-breakup');
  await seek(39/60);const end=await png('phase-smoke');
  assert.ok(countAlpha(flash).partial+countAlpha(flash).opaque>300,'initial flash not visible');
  assert.ok(countAlpha(peak).partial+countAlpha(peak).opaque>1000,'fireball invisible');
  assert.ok(delta(flash,peak)>100,'static/no-changing fireball');
  assert.ok(delta(breakup,end)>100,'residual smoke not animated');
  await page.evaluate(()=>{const s=ExplosionEditor.getSettings();
   s.exportFrames=65;ExplosionEditor.setSettings(s)});
  await seek(40/60);const endpoint=await png('phase-endpoint');
  assert.ok(countAlpha(endpoint).partial+countAlpha(endpoint).opaque>100,
    'one-shot exclusive endpoint should preserve residual smoke');
  await seek(50/60);const tail=await png('phase-smoke-tail');
  assert.ok(countAlpha(tail).partial+countAlpha(tail).opaque>100,
    'smoke must survive the 40-frame starting sequence');
  await page.evaluate(()=>ExplosionEditor.setSettings(FxExplosion.defaults()));
  await seek(12/60);const baseline=await png('baseline');
  const zoomDeltas={};
  for(const z of ['.5','1','2']){
   await page.selectOption('#zoom',z);
   const other=await png('zoom-'+z);
   zoomDeltas[z]=delta(baseline,other);assert.equal(zoomDeltas[z],0,'zoom changed extracted PNG');
  }
  await page.selectOption('#zoom','1');
  const backgrounds={};
  for(const b of ['checker','dark','light']){
   await page.selectOption('#background',b);
   await page.locator('#preview').screenshot({path:path.join(output,'background-'+b+'.png')});
   backgrounds[b]=delta(baseline,await png('background-png-'+b));
   assert.equal(backgrounds[b],0,'CSS backdrop changed PNG');
  }
  const setRange=async(id,value)=>page.locator('#p-'+id).evaluate((el,v)=>{
   el.value=String(v);el.dispatchEvent(new Event('input',{bubbles:true}))
  },value);
  await setRange('turbulence',.92);
  const turb=await png('turbulence');
  const turbulenceDifference=comparePixels(baseline,turb,{step:4,channelTolerance:3}).changedPixels;
  assert.ok(turbulenceDifference>=15,'turbulence does not affect rendered shapes');
  await setRange('turbulence',.5);
  for(const layer of ['flash','fire','shockwave','sparks','debris','smoke']){
   const at=layer==='flash'?0:layer==='smoke'?24/60:12/60;
   await seek(at);const start=await png('layer-'+layer+'-visible');
   const cfg=await page.evaluate(()=>ExplosionEditor.getSettings());
   if(!cfg.layers[layer].enabled)throw Error('Layer default disabled: '+layer);
   cfg.layers[layer].enabled=false;
   await page.evaluate(x=>ExplosionEditor.setSettings(x),cfg);
   const hidden=await png('layer-'+layer+'-hidden');
   assert.ok(delta(start,hidden)>3,'layer toggle invisible: '+layer);
   cfg.layers[layer].enabled=true;cfg.layers[layer].x+=42;
   await page.evaluate(x=>ExplosionEditor.setSettings(x),cfg);
   const moved=await png('layer-'+layer+'-moved');
   assert.ok(delta(start,moved)>3,'layer movement invisible: '+layer);
   cfg.layers[layer].x-=42;
   await page.evaluate(x=>ExplosionEditor.setSettings(x),cfg);
  }
  await seek(12/60);
  const none=await page.evaluate(()=>{
   const cfg=ExplosionEditor.getSettings();
   for(const key of FxExplosion.LAYERS)cfg.layers[key].enabled=false;
   ExplosionEditor.setSettings(cfg);
   return ExplosionEditor.getFx().sample.primitives;
  });
  assert.equal(none,0,'ghost primitives when all effects disabled');
  const transparent=await png('all-disabled');
  assert.equal(countAlpha(transparent).partial+countAlpha(transparent).opaque,0,
   'all-disabled image has ghost pixels');
  await page.evaluate(()=>ExplosionEditor.setSettings(FxExplosion.defaults()));
  await seek(12/60);const before=await png('seek-before');
  await seek(39/60);await seek(5/60);await seek(12/60);
  assert.equal(delta(before,await png('seek-after')),0,'40->5->12 seek nondeterministic');
  const normalBounds=await page.evaluate(()=>ExplosionEditor.getFx().currentBounds());
  assert.equal(normalBounds.inside,true);
  const fit=await page.evaluate(()=>{
   const cfg=ExplosionEditor.getSettings();cfg.blastRadius=350;cfg.expansion=6;
   ExplosionEditor.setSettings(cfg);ExplosionEditor.seek(12/60);
   return ExplosionEditor.getFx().currentBounds();
  });
  assert.equal(fit.inside,false,'extreme blast was not caught outside canvas');
  const failed=await page.evaluate(async()=>{
   try{await ExplosionExports.bake({download:false});return null}
   catch(e){return String(e.message)}
  });
  assert.match(failed,/exceeds 512x512/i,'oversized PNG bake silently clipped');
  await page.click('#fitCanvas');
  const fitResult=await page.evaluate(()=>({
   status:ExplosionEditor.getStatus(),size:ExplosionEditor.getSettings().blastRadius,
   expansion:ExplosionEditor.getSettings().expansion,
   bounds:ExplosionEditor.getFx().currentBounds()
  }));
  assert.equal(fitResult.bounds.inside,true,'explicit canvas fit failed');
  await page.evaluate(()=>ExplosionEditor.setSettings(FxExplosion.defaults()));
  // UI preset must actually round-trip through JSON save/load, not only normalize().
  for(const id of ['radiusCurveEditor','fireCurveEditor','sparkCurveEditor',
    'smokeCurveEditor','emissionCurveEditor','spacingCurveEditor']){
   assert.ok(await page.locator('#'+id).locator('svg').count()>0,
    'missing mounted SVG curve editor '+id);
  }
  const presetDownload=page.waitForEvent('download',{timeout:120000});
  await page.click('#savePreset');
  const presetDl=await presetDownload;
  const presetFile=path.join(output,'Fire_Explosion_Preset.json');
  await presetDl.saveAs(presetFile);
  const presetSaved=JSON.parse(fs.readFileSync(presetFile,'utf8'));
  assert.equal(presetSaved.effectId,'fx.fire.fire-explosion');
  assert.equal(presetSaved.settings.blastRadius,100);
  await setRange('blastRadius',150);
  assert.equal((await page.evaluate(()=>ExplosionEditor.getSettings())).blastRadius,150);
  await page.locator('#presetFile').setInputFiles(presetFile);
  await page.waitForFunction(()=>ExplosionEditor.getSettings().blastRadius===100);
  assert.deepEqual(await page.evaluate(()=>ExplosionEditor.getSettings()),presetSaved.settings);
  await page.click('#sample');
  await page.waitForFunction(()=>ExplosionEditor.getModel()!=null,null,{timeout:60000});
  const asset=await page.evaluate(()=>({
   images:ExplosionEditor.getAsset().images.size,
   animation:document.getElementById('animation').value
  }));
  assert.ok(asset.images>=2,'real multipage Spine atlas not loaded');
  const moving=await page.evaluate(()=>{
   const model=ExplosionEditor.getModel();
   ExplosionEditor.seek(.12);
   const before=model.skeleton.bones.map(b=>({name:b.data.name,x:b.worldX,y:b.worldY}));
   ExplosionEditor.seek(.44);
   const after=model.skeleton.bones.map(b=>({name:b.data.name,x:b.worldX,y:b.worldY}));
   return after.map((b,i)=>({...b,displacement:Math.hypot(b.x-before[i].x,b.y-before[i].y)}))
    .sort((a,b)=>b.displacement-a.displacement)[0];
  });
  assert.ok(moving.displacement>.05,'Spine sample has no animated anchor');
  const follow=await page.evaluate(name=>{
   const cfg=ExplosionEditor.getSettings();
   cfg.anchor={...cfg.anchor,type:'bone',space:'local',name,x:0,y:0};
   ExplosionEditor.setSettings(cfg);
   function probe(t){
    ExplosionEditor.seek(t);
    const model=ExplosionEditor.getModel(),bone=model.skeleton.findBone(name);
    const expected=model.worldTransform.apply({x:bone.worldX,y:bone.worldY},{x:0,y:0});
    return {actual:ExplosionEditor.getFx().resolveAnchor(),expected};
   }
   return [probe(.12),probe(.44)];
  },moving.name);
  for(const f of follow)assert.ok(Math.hypot(f.actual.x-f.expected.x,
   f.actual.y-f.expected.y)<.01,'Explosion does not track animated bone');
  assert.ok(Math.hypot(follow[0].actual.x-follow[1].actual.x,
   follow[0].actual.y-follow[1].actual.y)>.05);
  const missing=await page.evaluate(()=>{
   const cfg=ExplosionEditor.getSettings();cfg.anchor.name='ABSENT_BONE_100';
   ExplosionEditor.setSettings(cfg);
   return {visible:ExplosionEditor.getFx().owned.visible,
    diagnostic:ExplosionEditor.getFx().diagnostics};
  });
  assert.equal(missing.visible,false);assert.match(missing.diagnostic,/missing/i);
  // Restore world anchor to avoid crop by a moving Spine joint during export.
  await page.evaluate(()=>{
   const cfg=ExplosionEditor.getSettings();
   cfg.anchor={...cfg.anchor,type:'world',space:'world',name:'',slot:'',x:256,y:256};
   ExplosionEditor.setSettings(cfg);
  });
  const shortExport=await page.evaluate(async()=>{
   const settings=ExplosionEditor.getSettings();
   settings.exportFrames=8;
   ExplosionEditor.setSettings(settings);
   const result=await ExplosionExports.bake({download:false});
   settings.exportFrames=40;
   ExplosionEditor.setSettings(settings);
   return {frames:result.manifest.frames.length,size:result.blob.size,
    finalTime:result.manifest.frames.at(-1).timeSeconds};
  });
  assert.equal(shortExport.frames,8);
  assert.equal(shortExport.finalTime,7/60);
  assert.ok(shortExport.size>10000);
  const exported=await page.evaluate(async()=>{
   const result=await ExplosionExports.bake({download:false});
   return {size:result.blob.size,frameCount:result.manifest.frames.length,
    meta:result.manifest.frames.slice(0,3),alpha:result.manifest.alpha};
  });
  assert.equal(exported.frameCount,40);assert.ok(exported.size>100000);
  assert.equal(exported.meta[0].timeSeconds,0);
  assert.equal(exported.meta[1].timeSeconds,1/60);
  assert.equal(exported.alpha,'straight-rgba8');
  const packages=await page.evaluate(async()=>{
   const gl=await ExplosionExports.buildPackage('webgl');
   const gpu=await ExplosionExports.buildPackage('webgpu');
   return [gl,gpu].map(p=>({size:p.blob.size,names:p.entries.map(x=>x.name),
    pins:p.preset.compatibility}));
  });
  for(const pkg of packages){
   assert.ok(pkg.size>100000);
   for(const n of ['FireExplosion.mjs','FxExplosion.mjs','example.js','public/preset.json',
    'public/assets/Doctor_head.json','public/assets/Doctor_head.png','public/assets/Doctor_head_2.png'])
    assert.ok(pkg.names.includes(n),'missing developer member '+n);
   assert.equal(pkg.pins.pixi,'8.22.0');assert.equal(pkg.pins.spine,'4.2.120');
  }
  for(const [button,filename] of [['bake','Fire_Explosion_PNG.zip'],
    ['webglZip','Fire_Explosion_WebGL.zip'],['webgpuZip','Fire_Explosion_WebGPU.zip']]){
   const dlPromise=page.waitForEvent('download',{timeout:120000});
   await page.click('#'+button);
   const dl=await dlPromise;
   await dl.saveAs(path.join(output,filename));
   assert.ok(fs.statSync(path.join(output,filename)).size>100000);
  }
  assert.deepEqual(requests,[],'offline editor requested HTTP');
  assert.deepEqual(errors,[],'browser exception during QA');
  const report={status:'PASS',backend:actual,browser:browser.version(),
   images:asset.images,frameCount:exported.frameCount,packages:packages.map(p=>p.size),
   zoomDeltas,backgrounds,phases:{flash:countAlpha(flash),peak:countAlpha(peak),
    smoke:countAlpha(end),tail:countAlpha(tail)},
   turbulenceDifference,boneDisplacement:moving.displacement,network:requests.length};
  fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
  console.log('PASS FIRE-02 BROWSER',JSON.stringify(report));
 }finally{await browser.close()}
}
main().catch(e=>{console.error(e.stack||e);process.exitCode=1});
