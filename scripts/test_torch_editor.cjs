#!/usr/bin/env node
'use strict';
// FIRE-01 browser QA with real 8.22 Pixi backend and independent PNG decoding.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const {decodePng,countAlpha,comparePixels}=require('./fx_visual_png.cjs');
function arg(n,def){let i=process.argv.indexOf('--'+n);return i<0?def:process.argv[i+1];}
const target=arg('backend','webgl2'),output=path.resolve(arg('output','torch-qa'));
if(!['webgl1','webgl2','webgpu'].includes(target))throw Error('Bad backend: '+target);
const editor=path.resolve(arg('html',path.join(__dirname,'../assets/Torch_Flame_Lab.html')));
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
 const page=await browser.newPage({viewport:{width:1320,height:1040},offline:true});
 const errors=[];let network=0;
 page.on('pageerror',e=>errors.push('page: '+e.message));
 page.on('console',m=>{if(m.type()==='error')errors.push('console: '+m.text())});
 page.on('request',r=>{if(/^https?:/.test(r.url()))network++});
 fs.mkdirSync(output,{recursive:true});
 async function pixels(name){
  const data=await page.evaluate(async()=>Array.from(await TorchEditor.extractBytes()));
  const bytes=Buffer.from(data);const decoded=decodePng(bytes);
  fs.writeFileSync(path.join(output,name+'.png'),bytes);
  assert.equal(decoded.width,512);assert.equal(decoded.height,512);
  return decoded;
 }
 try{
  await page.goto(pathToFileURL(editor).href);
  await page.waitForFunction(()=>typeof TorchEditor!=='undefined'&&TorchEditor.getApp(),null,{timeout:60000});
  await page.waitForTimeout(1100);
  await page.selectOption('#backend',target);
  await page.waitForFunction(wanted=>(typeof TorchEditor!=='undefined'&&
    TorchEditor.getActualBackend().actual===wanted),target,{timeout:60000});
  const actual=await page.evaluate(()=>TorchEditor.getActualBackend());
  assert.equal(actual.actual,target);
  assert.equal(actual.pixi,'8.22.0');
  await page.click('#play'); // pause to make cross-frame comparisons deterministic
  // The loop endpoint is sampled explicitly (frame 60, exclusive in the ZIP).
  await page.evaluate(()=>TorchEditor.seek(0));
  const start=await pixels('phase-loop-start');
  await page.evaluate(()=>TorchEditor.seek(.5));
  const peak=await pixels('phase-active');
  await page.evaluate(()=>TorchEditor.seek(1));
  const end=await pixels('phase-loop-seam');
  const loopDelta=comparePixels(start,end,{step:1,channelTolerance:0}).changedPixels;
  assert.equal(loopDelta,0,'loop endpoint must match frame 0 exactly');
  assert.ok(comparePixels(start,peak,{step:4,channelTolerance:2}).changedPixels>20,
    'animated flame peak must differ visibly from loop start');
  await page.evaluate(()=>TorchEditor.seek(.25));
  const baseline=await pixels('baseline');
  assert.ok(countAlpha(baseline).opaque+countAlpha(baseline).partial>1000,'Torch not visible');
  const repeatedBeforeZoom=await pixels('baseline-repeat');
  console.log('BASE_REPEAT_DIFF',target,comparePixels(baseline,repeatedBeforeZoom,{step:1,channelTolerance:0}).changedPixels);
  const zoomDeltas={};
  for(const zoom of ['.5','1','2']){
   await page.selectOption('#zoom',zoom);
   const result=await pixels('zoom-'+zoom);
   zoomDeltas[zoom]=comparePixels(baseline,result,{step:1,channelTolerance:0}).changedPixels;
   console.log('ZOOM_DIFF',target,zoom,zoomDeltas[zoom]);
   assert.equal(comparePixels(baseline,result,{step:1,channelTolerance:0}).changedPixels,0,
    'camera must not change PNG');
  }
  await page.selectOption('#zoom','1');
  const setRange=async(id,value)=>page.locator('#p-'+id).evaluate((el,v)=>{
   el.value=String(v);el.dispatchEvent(new Event('input',{bubbles:true}));
  },value);
  await setRange('turbulence',.9);
  const turbulent=await pixels('turbulence');
  const turbulenceDifference=comparePixels(baseline,turbulent,{step:4,channelTolerance:3}).changedPixels;
  console.log('TURB_DIFF',target,turbulenceDifference);
  assert.ok(turbulenceDifference>=30,'turbulence must visibly change tongues');
  await setRange('turbulence',.4);
  await setRange('glowRadius',0);
  const noGlow=await pixels('glow-zero');
  assert.ok(comparePixels(baseline,noGlow,{step:4,channelTolerance:3}).changedPixels>20,'glow zero affects pixels');
  await setRange('glowRadius',24);
  await page.locator('summary').filter({hasText:'Independent layers'}).click();
  for(const key of ['core','tongues','glow','embers'])await page.locator('#layer-'+key).uncheck();
  const noLayers=await pixels('all-disabled');
  const alpha=countAlpha(noLayers);
  assert.equal(alpha.opaque+alpha.partial,0,'disabled Torch has ghost primitives');
  for(const key of ['core','tongues','glow','embers'])await page.locator('#layer-'+key).check();
  await page.evaluate(()=>TorchEditor.seek(.25));
  const repeated=await pixels('repeated');
  assert.equal(comparePixels(baseline,repeated,{step:1,channelTolerance:0}).changedPixels,0,
   'repeat at absolute time returns identical PNG');
  // Real Spine 4.2 multipage sample and an actual animated bone.
  await page.click('#sample');
  await page.waitForFunction(()=>!!TorchEditor.getModel(),null,{timeout:60000});
  const spineData=await page.evaluate(()=>({
   names:[...TorchEditor.getModel().skeleton.bones].slice(0,6).map(b=>b.data.name),
   animation:document.getElementById('animation').value,
   imageCount:TorchEditor.getAsset().images.size
  }));
  assert.ok(spineData.imageCount>=2,'Spine atlas pages not loaded');
  await pixels('with-spine');
  const skeletonAnchor=await page.evaluate(()=>{
   const config=TorchEditor.getSettings();
   config.anchor={...config.anchor,type:'bone',space:'local',name:config.anchor.name||'root',x:0,y:0};
   TorchEditor.setSettings(config);
   return {status:TorchEditor.getStatus(),resolved:TorchEditor.getFx().resolveAnchor()};
  });
  assert.ok(skeletonAnchor.resolved,'Spine bone anchor not resolved: '+skeletonAnchor.status);
  const movement=await page.evaluate(()=>{
   const model=TorchEditor.getModel();
   TorchEditor.seek(.12);
   const before=model.skeleton.bones.map(b=>({name:b.data.name,x:b.worldX,y:b.worldY}));
   TorchEditor.seek(.44);
   const after=model.skeleton.bones.map(b=>({name:b.data.name,x:b.worldX,y:b.worldY}));
   return after.map((b,i)=>({...b,displacement:Math.hypot(b.x-before[i].x,b.y-before[i].y)}))
     .sort((a,b)=>b.displacement-a.displacement)[0];
  });
  console.log('ANIMATED_BONE',movement);
  assert.ok(movement.displacement>.05,'Sample idle animation lacks moving bone for anchor test');
  const following=await page.evaluate(name=>{
   const config=TorchEditor.getSettings();
   config.anchor={...config.anchor,type:'bone',space:'local',name,x:0,y:0};
   TorchEditor.setSettings(config);
   function position(t){
    TorchEditor.seek(t);
    const m=TorchEditor.getModel(),bone=m.skeleton.findBone(name);
    const world=m.worldTransform.apply({x:bone.worldX,y:bone.worldY},{x:0,y:0});
    return {actual:TorchEditor.getFx().resolveAnchor(),expected:world};
   }
   return [position(.12),position(.44)];
  },movement.name);
  for(const found of following){
   assert.ok(found.actual,'moving Spine bone is not resolved');
   assert.ok(Math.hypot(found.actual.x-found.expected.x,
     found.actual.y-found.expected.y)<.01,'Torch is not attached to animated bone');
  }
  assert.ok(Math.hypot(following[0].actual.x-following[1].actual.x,
    following[0].actual.y-following[1].actual.y)>.05,
    'Torch anchor does not move with Spine animation');
  const absent=await page.evaluate(()=>{
   const config=TorchEditor.getSettings();
   config.anchor.name='MISSING_BONE_000';
   TorchEditor.setSettings(config);
   return {hidden:!TorchEditor.getFx().owned.visible,diagnostics:TorchEditor.getFx().diagnostics};
  });
  assert.ok(absent.hidden&&/missing/i.test(absent.diagnostics),
   'Missing anchor must hide Torch and diagnose it');
  await page.evaluate(()=>{
   const config=TorchEditor.getSettings();
   config.anchor.type='world';config.anchor.space='world';
   config.anchor.name='';config.anchor.x=256;config.anchor.y=355;
   TorchEditor.setSettings(config);
  });
  const sample=await page.evaluate(async()=>{
   const result=await TorchExports.bake({download:false});
   return {bytes:result.blob.size,frames:result.manifest.frames.length,
    data:result.manifest.frames.slice(0,2)};
  });
  assert.equal(sample.frames,60);assert.ok(sample.bytes>25000);
  const packages=await page.evaluate(async()=>{
   const gl=await TorchExports.buildPackage('webgl');
   const gpu=await TorchExports.buildPackage('webgpu');
   return [gl,gpu].map(p=>({
    bytes:p.blob.size,files:p.entries.map(x=>x.name),pins:p.preset.compatibility
   }));
  });
  for(const pkg of packages){
   assert.ok(pkg.bytes>100000);
   for(const req of ['TorchFlame.mjs','FxTorch.mjs','example.js','public/preset.json',
       'public/assets/Doctor_head.json','public/assets/Doctor_head.png','public/assets/Doctor_head_2.png'])
    assert.ok(pkg.files.includes(req),'Missing package member: '+req);
   assert.equal(pkg.pins.pixi,'8.22.0');assert.equal(pkg.pins.spine,'4.2.120');
  }
  for(const [key,name] of [
   ['bake','Torch_Flame_PNG.zip'],
   ['webglZip','Torch_Flame_WebGL.zip'],
   ['webgpuZip','Torch_Flame_WebGPU.zip']
  ]){
   const downloadPromise=page.waitForEvent('download',{timeout:120000});
   await page.click('#'+key);
   const dl=await downloadPromise;
   const filepath=path.join(output,name);
   await dl.saveAs(filepath);
   assert.ok(fs.statSync(filepath).size>30000,'downloaded ZIP is empty: '+name);
  }
  assert.equal(network,0,'Editor contacted the network');
  assert.deepEqual(errors,[],'Unexpected browser exception');
  const report={status:'PASS',actual,browser:browser.version(),files:15,alpha,turbulenceDifference,loopDelta,zoomDeltas,
    boneDisplacement:movement.displacement,
    frameCount:sample.frames,packages:packages.map(x=>x.bytes),network,spineData};
  fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
  console.log('PASS FIRE-01 TORCH BROWSER',JSON.stringify(report));
 }finally{await browser.close()}
}
main().catch(e=>{console.error(e.stack||e);process.exitCode=1});
