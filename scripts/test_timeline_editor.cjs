#!/usr/bin/env node
// FX-CORE-05: actual Chrome/Spine timing, arbitrary replay and identical PNGs.
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url'),{entries,decodeRgba}=require('./test_png_pma.cjs');
const arg=(key,defaultValue)=>{const i=process.argv.indexOf('--'+key);return i<0?defaultValue:process.argv[i+1]};
const html=arg('html'),backend=arg('backend','webgl'),output=path.resolve(arg('output','timeline-qa'));
if(!html||!['webgl','webgpu'].includes(backend))throw Error('Usage: --html file --backend webgl|webgpu --output dir');
function plain(state){return JSON.parse(JSON.stringify(state))}
async function main(){
 const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
 fs.mkdirSync(output,{recursive:true});
 const browser=await chromium.launch({headless:true,
  ...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{}),
  args:['--no-sandbox',...(process.env.FX_SOFTWARE_GPU==='1'?[
   '--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--enable-unsafe-webgpu',
   '--use-vulkan=swiftshader','--enable-features=Vulkan']:[])]});
 const page=await browser.newPage({viewport:{width:1366,height:900},offline:true,acceptDownloads:true});
 const errors=[];let network=0,downloads=0;
 page.on('pageerror',e=>errors.push(e.stack||e.message));
 page.on('request',r=>{if(/^https?:/.test(r.url()))network++});
 page.on('download',()=>downloads++);
 const fill=async(id,val)=>{const control=page.locator('#'+id);await control.fill(String(val));await control.dispatchEvent('change')};
 const bake=async(label)=>{
  const pending=page.waitForEvent('download',{timeout:120000});
  await page.locator('#bakeStart').click();
  const downloaded=await pending,file=path.join(output,backend+'-'+label+'.zip');
  await downloaded.saveAs(file);
  await page.waitForFunction(()=>!document.getElementById('bakeStart').disabled,null,{timeout:60000});
  return entries(fs.readFileSync(file));
 };
 try{
  const url=pathToFileURL(path.resolve(html));url.searchParams.set('renderer',backend);
  await page.goto(url.href);
  await page.waitForFunction(()=>document.querySelector('#viewport canvas')&&
   document.getElementById('loading').style.display==='none'&&
   document.getElementById('assetName').textContent.includes('Doctor'),null,{timeout:60000});
  assert.equal(await page.evaluate(()=>backend),backend);
  if(process.argv.includes('--webgl1')){
   const actual=await page.evaluate(async()=>{cfg.quality='low';await switchRenderer();
    return app.renderer.gl instanceof WebGL2RenderingContext?'webgl2':'webgl1'});
   assert.equal(actual,'webgl1');
  }
  assert.equal(await page.evaluate(()=>Boolean(FxTimeline&&FxTimeline.createReplay&&fx.seek)),true);
  const unit=await page.evaluate(()=>{
   setPlaying(false);$('animPlay').checked=true;
   // Force a nonempty seeded path-spark population; a zero-particle test
   // would not validate particle state restoration.
   cfg.spacingEnabled=true;cfg.spacingCombine='time';cfg.spacingBaseRate=60;cfg.sparks=65;
   syncUniforms();
   const seekFrame=i=>setProgress(ease(i/(cfg.duration*60)));
   const snapshot=()=>({
    frame:Math.round(transport.state.frame),time:fx.absoluteTime,
    p:fx.particles.map(p=>({...p})),
    glow:multiFx.seek(transport.state.time).cost,
    pose:model.skeleton.bones.slice(0,5).map(b=>[b.worldX,b.worldY,b.a,b.b,b.c,b.d])
   });
   seekFrame(30);const at30=snapshot();seekFrame(10);const at10=snapshot();
   seekFrame(30);const recovered=snapshot();
   const atFps={};
   for(const fps of [30,60,120]){
    seekFrame(0);transport.play(1);
    for(let i=0;i<fps;i++){const state=transport.tick(1/fps);setProgress(ease(state.phase));}
    transport.pause();
    atFps[fps]=snapshot();
   }
   // Reverse playback is a negative clock step, not shader mask reversal.
   seekFrame(120);transport.play(-1);
   const reverse=transport.tick(.25);setProgress(ease(reverse.phase));transport.pause();
   const reverseCheck={time:transport.state.time,direction:transport.state.direction,reverseMask:$('reverse').checked};
   // Loop wraps the effect clock without RNG/particle accumulation.
   transport.setLoop(true);seekFrame(175);transport.play(1);
   const loop=transport.tick(.3);setProgress(ease(loop.phase));transport.pause();
   const loopCheck={time:transport.state.time,particles:fx.particles.length};
   transport.setLoop(false);
   // A paused effect clock must not advance even if the skeleton keeps moving.
   seekFrame(42);transport.pause();const pauseBefore=snapshot();transport.tick(9);
   const pauseAfter=snapshot();
   return {at30,at10,recovered,atFps,reverseCheck,loopCheck,
    pauseBefore,pauseAfter,checkpointFrames:fx.checkpointFrames};
  });
  assert.ok(Math.abs(unit.at30.time-.5)<1e-8);
  assert.ok(unit.at30.p.length>0,'seek test must exercise real particles, not empty state');
  assert.deepEqual(unit.recovered,unit.at30,'30 -> 10 -> 30 must recover same particles and Spine pose');
  assert.deepEqual(unit.atFps[30],unit.atFps[60]);
  assert.deepEqual(unit.atFps[60],unit.atFps[120]);
  assert.ok(Math.abs(unit.reverseCheck.time-1.75)<1e-6,'reverse playback from 2.0s to 1.75s');
  assert.equal(unit.reverseCheck.direction,-1);
  assert.ok(unit.loopCheck.time<.3&&unit.loopCheck.time>0,'loop wraps within duration');
  assert.deepEqual(unit.pauseBefore,unit.pauseAfter,'paused FX clock');
  assert.ok(unit.checkpointFrames.length<=64);
  console.log('PASS TIMELINE SEEK/FPS/REVERSE/LOOP',JSON.stringify({backend,
    particlesAt30:unit.at30.p.length,checkpoints:unit.checkpointFrames.length,
    paused:true,fps:[30,60,120]}));
  // A fixed preview snapshot, including source skeleton animation time, is restored after bake.
  await page.locator('#animPlay').uncheck();
  await page.evaluate(()=>{cfg.spacingEnabled=false;syncUniforms();setProgress(progress);});
  await fill('bakeWidth',160);await fill('bakeHeight',128);
  await fill('durationFrames',40);await fill('bakeFrames',40);
  const before=await page.evaluate(()=>({time:fx.absoluteTime,phase,playing,
   pose:model.skeleton.bones.slice(0,5).map(b=>[b.worldX,b.worldY,b.a,b.b,b.c,b.d]),
   particles:fx.particles.map(p=>({...p}))}));
  const archive1=await bake('first');
  const between=await page.evaluate(()=>({time:fx.absoluteTime,phase,playing,
   pose:model.skeleton.bones.slice(0,5).map(b=>[b.worldX,b.worldY,b.a,b.b,b.c,b.d]),
   particles:fx.particles.map(p=>({...p}))}));
  assert.deepEqual(between,before,'bake must leave live time, particles, pose and playback state unchanged');
  const archive2=await bake('second');
  const meta1=JSON.parse(archive1.get('sequence.json')),meta2=JSON.parse(archive2.get('sequence.json'));
  assert.deepEqual(meta2,meta1,'repeat bake metadata must be identical');
  assert.equal(meta1.timeline.schemaVersion,1);
  assert.equal(meta1.timeline.fps,60);
  assert.equal(meta1.timeline.checkpointIntervalFrames,60);
  assert.equal(meta1.firstSampleSeconds,0);
  assert.ok(Math.abs(meta1.lastSampleSeconds-39/60)<1e-10);
  assert.equal(meta1.animateSkeleton,false);
  const frames=[...archive1.keys()].filter(s=>s.endsWith('.png')).sort();
  assert.equal(frames.length,40);
  for(let i=0;i<frames.length;i++){
   const name='frames/frame_'+String(i).padStart(5,'0')+'.png';
   assert.equal(frames[i],name);
   assert.ok(archive1.get(name).equals(archive2.get(name)),'repeat bake differs at '+name);
  }
  const poseAfter=await page.evaluate(()=>({time:fx.absoluteTime,phase,playing,
   pose:model.skeleton.bones.slice(0,5).map(b=>[b.worldX,b.worldY,b.a,b.b,b.c,b.d]),
   particles:fx.particles.map(p=>({...p}))}));
  assert.deepEqual(poseAfter,before);
  assert.equal(downloads,2);
  assert.equal(network,0);assert.deepEqual(errors,[]);
  console.log('PASS TIMELINE DOUBLE-BAKE',JSON.stringify({backend,frames:40,
   sample0:meta1.firstSampleSeconds,last:meta1.lastSampleSeconds,
   byteIdentical:true,metaIdentical:true,liveStateRestored:true,offline:true}));
 }finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
