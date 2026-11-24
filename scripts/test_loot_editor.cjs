'use strict';
const A=require('node:assert/strict'),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright'),{pathToFileURL}=require('node:url');
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{}),args:['--no-sandbox','--enable-unsafe-webgpu']});
 try{
  const page=await browser.newPage({offline:true,viewport:{width:1400,height:1000}}),errors=[],network=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))network.push(r.url())});
  await page.goto(pathToFileURL(process.argv[2]).href);
  await page.waitForFunction(()=>globalThis.lootEditor?.ready);
  const state=()=>page.evaluate(()=>lootEditor.settings);
  const seek=frame=>page.evaluate(f=>lootEditor.seek(f/60),frame);
  const snap=()=>page.evaluate(()=>lootEditor.sample);
  const set=async(id,value)=>{await page.locator('#'+id).fill(String(value));await page.locator('#'+id).dispatchEvent('change')};
  await seek(15);const baseline=await snap();A.ok(baseline.cost>0);
  await set('p-sparkleSize',16);A.notDeepEqual(await snap(),baseline);
  await page.locator('#layerSelect').selectOption('halo');
  await page.locator('#l-enabled').check();A.ok((await snap()).emitters[0].layers.halo.length);
  await page.locator('#layerSelect').selectOption('stars');
  await page.locator('#moveTarget').selectOption('layer');
  await set('e-rotation',90);
  for(const zoom of [.5,1,2]){
   await page.evaluate(z=>lootEditor.zoom(z),zoom);
   const handle=page.locator('#originHandle');await handle.scrollIntoViewIfNeeded();const b=await handle.boundingBox();
   const surface=await page.locator('#surface').boundingBox(),scale=surface.width/512;
   const prior=(await state()).emitters[0].layers.stars;
   await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();await page.mouse.move(b.x+b.width/2+10*scale,b.y+b.height/2,{steps:3});await page.mouse.up();
   const next=(await state()).emitters[0].layers.stars;
   A.ok(Math.abs(next.x-prior.x)<.6&&Math.abs(next.y-prior.y+10)<.6,JSON.stringify({prior,next,zoom}));
  }
  const saved=await state();await page.locator('#copyEmitter').click();A.equal((await state()).emitters.length,2);
  await page.locator('#deleteEmitter').click();A.equal((await state()).emitters.length,1);
  await page.locator('#preset').fill(JSON.stringify(saved));await page.locator('#applyPreset').click();A.deepEqual(await state(),saved);
  await page.locator('#preset').fill('{"schemaVersion":999}');await page.locator('#applyPreset').click();A.deepEqual(await state(),saved);
  await page.locator('#p-mode').selectOption('idle');A.equal((await state()).durationFrames,60);
  await seek(0);const seam=await snap();await seek(60);A.deepEqual(await snap(),seam);
  for(const b of ['webgl1','webgpu','webgl2']){
   await page.locator('#backend').selectOption(b);await page.waitForFunction(x=>lootEditor.ready&&lootEditor.backend===x,b);
   A.deepEqual(await snap(),seam);
  }
  await page.locator('#curveSelect').selectOption('alphaCurve');A.ok(await page.locator('#curveHost svg').count());
  await seek(15);const preCurve=await snap();
  await page.locator('#lootCurveGraph circle[data-kind="key"][data-id="k1"]').click();
  await set('lootCurveValue',.4);
  A.equal((await state()).alphaCurve.keys[1].y,.4);A.notDeepEqual(await snap(),preCurve);
  const prePalette=await snap();await page.locator('#magical').click();
  A.deepEqual((await state()).palette.stops[1].rgba,[166,232,255,1]);A.notDeepEqual(await snap(),prePalette);
  const beforeCamera=await snap();await page.locator('#background').selectOption('checker');await page.locator('#fit').click();
  A.deepEqual(await snap(),beforeCamera);await page.locator('#background').selectOption('light');A.deepEqual(await snap(),beforeCamera);
  const download=page.waitForEvent('download');await page.locator('#savePreset').click();
  const dl=await download;A.equal(dl.suggestedFilename(),'loot-sparkle.json');
  const data=JSON.parse(require('node:fs').readFileSync(await dl.path(),'utf8'));A.deepEqual(data,await state());
  await seek(15);await page.locator('#play').click();await page.waitForFunction(()=>lootEditor.sample.frame>18);
  await page.locator('#play').click();const stopped=(await snap()).frame;await page.waitForTimeout(100);A.equal((await snap()).frame,stopped);
  await seek(30);await page.locator('#reverse').click();await page.waitForFunction(()=>lootEditor.sample.frame<27);
  await page.locator('#play').click();await page.locator('#resetFrame').click();A.equal((await snap()).frame,0);
  A.deepEqual(errors,[]);A.deepEqual(network,[]);
  console.log('PASS GAME-12 offline authoring, 3 actual backends, camera inverse drag, preset rollback, layer controls and seam');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
