#!/usr/bin/env node
'use strict';
// FX-CORE-04 real Chrome/Spine alpha and palette contract.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const {entries,decodeRgba}=require('./test_png_pma.cjs');
const Colors=require('../assets/template/src/color-core.js');
const arg=(key,otherwise)=>{const i=process.argv.indexOf('--'+key);return i<0?otherwise:process.argv[i+1]};
const html=arg('html'),backend=arg('backend','webgl'),output=path.resolve(arg('output','color-qa'));
if(!html)throw Error('Usage --html FILE --backend webgl|webgpu --output DIRECTORY');
async function main(){
 const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
 const browser=await chromium.launch({headless:true,
  ...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{}),
  args:['--no-sandbox',...(process.env.FX_SOFTWARE_GPU==='1'?[
   '--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--enable-unsafe-webgpu',
   '--use-vulkan=swiftshader','--enable-features=Vulkan']:[])]});
 fs.mkdirSync(output,{recursive:true});
 const page=await browser.newPage({viewport:{width:1366,height:900},offline:true,acceptDownloads:true});
 const errors=[];let network=0;
 page.on('pageerror',e=>errors.push(e.stack||e.message));
 page.on('console',m=>{const text=m.text();if(m.type()==='error'||(m.type()==='warning'&&/shader|validation|error|invalid/i.test(text)&&!/Automatic fallback to software WebGL has been deprecated/i.test(text)&&!/WebGL: INVALID_ENUM: texParameter: invalid parameter name/i.test(text)))errors.push(text)});
 page.on('request',r=>{if(/^https?:/.test(r.url()))network++});
 const action=async(id,v)=>{
  const locator=page.locator('#'+id);
  const tag=await locator.evaluate(el=>el.tagName);
  const type=await locator.getAttribute('type');
  if(type==='checkbox'){v?await locator.check():await locator.uncheck();}
  else if(tag==='SELECT')await locator.selectOption(String(v));
  else {await locator.fill(String(v));await locator.dispatchEvent('change');}
 };
 const bake=async(name)=>{
  const pending=page.waitForEvent('download',{timeout:120000});
  await page.locator('#bakeStart').click();
  const dl=await pending,filename=path.join(output,backend+'-'+name+'.zip');
  await dl.saveAs(filename);
  await page.waitForFunction(()=>!document.getElementById('bakeStart').disabled);
  const archive=entries(fs.readFileSync(filename));
  assert.equal([...archive.keys()].filter(n=>n.endsWith('.png')).length,40);
  return archive;
 };
 try {
  const url=pathToFileURL(path.resolve(html));url.searchParams.set('renderer',backend);
  await page.goto(url.href);
  await page.waitForFunction(()=>document.querySelector('#viewport canvas') &&
   document.getElementById('loading').style.display==='none' &&
   document.getElementById('assetName').textContent.includes('Doctor'),null,{timeout:60000});
  if(process.argv.includes('--webgl1')){
    assert.equal(backend,'webgl');
    const version=await page.evaluate(async()=>{cfg.quality='low';await switchRenderer();
       return app.renderer.gl instanceof WebGL2RenderingContext?'webgl2':'webgl1'});
    assert.equal(version,'webgl1','must use actual WebGL1 not silent fallback');
  }
  assert.equal(await page.evaluate(()=>cfg.fireGradientEnabled),false);
  assert.equal(await page.evaluate(()=>cfg.sparkLifetime.enabled),false);
  await page.locator('#animPlay').uncheck();
  for(const [id,value]of [['bakeWidth',256],['bakeHeight',192],['bakeFrames',40],['durationFrames',40]])
    await action(id,value);
  // Isolate flame and glow from the legacy stochastic sparks.
  await page.evaluate(()=>{cfg.sparks=0;syncUniforms();});
  const legacy=await bake('legacy');
  await page.locator('#fxFlamePanel summary').click();
  await action('fxFlamePaletteEnabled',true);
  await action('fxFlamePreset','magical');
  await action('fxFlameSpace','linear-rgb');
  assert.equal(await page.evaluate(()=>cfg.fireGradientEnabled),true);
  assert.equal(await page.evaluate(()=>cfg.fireGradient.space),'linear-rgb');
  assert.equal(await page.evaluate(()=>cfg.fireGradient.stops.length),4);
  await page.locator('#fxFlameAdd').click();
  assert.equal(await page.evaluate(()=>cfg.fireGradient.stops.length),5);
  await page.locator('#fxFlameCopy').click();
  assert.equal(await page.evaluate(()=>cfg.fireGradient.stops.length),6);
  await page.locator('#fxFlameDelete').click();
  assert.equal(await page.evaluate(()=>cfg.fireGradient.stops.length),5);
  await action('fxFlameAlpha',0);
  const zero=await page.evaluate(()=>FxColors.sample(cfg.fireGradient,cfg.fireGradient.stops.find(s=>s.id===document.getElementById('fxFlameStop').value).position));
  assert.equal(zero[3],0);
  assert.ok(zero.slice(0,3).some(v=>v>50),'alpha-zero must preserve authored bright RGB');
  await action('fxFlameAlpha',1);
  const gradient=await bake('magical');
  const meta=JSON.parse(gradient.get('sequence.json'));
  assert.equal(meta.effectSettings.fireGradientEnabled,true);
  assert.deepEqual(meta.effectSettings.fireGradient,Colors.normalize(meta.effectSettings.fireGradient));
  let changed=0,partial=0,blackChanged=0,whiteChanged=0,alphaMin=255,alphaMax=0;
  for(const idx of [12,18,25]){
    const name='frames/frame_'+String(idx).padStart(5,'0')+'.png';
    const a=decodeRgba(legacy.get(name)),b=decodeRgba(gradient.get(name));
    assert.equal(a.width,b.width);
    for(let y=0;y<b.height;y+=2)for(let x=0;x<b.width;x+=2){
      const before=a.rgba(x,y),after=b.rgba(x,y);
      if(after[3]>0&&after[3]<255)partial++;
      alphaMin=Math.min(alphaMin,after[3]);alphaMax=Math.max(alphaMax,after[3]);
      const pxDiff=before.some((v,i)=>v!==after[i]);
      if(pxDiff){
        changed++;
        const darkA=Colors.composite([before[0],before[1],before[2],before[3]/255],[0,0,0]);
        const darkB=Colors.composite([after[0],after[1],after[2],after[3]/255],[0,0,0]);
        const lightA=Colors.composite([before[0],before[1],before[2],before[3]/255],[255,255,255]);
        const lightB=Colors.composite([after[0],after[1],after[2],after[3]/255],[255,255,255]);
        if(darkA.some((v,i)=>Math.abs(v-darkB[i])>1))blackChanged++;
        if(lightA.some((v,i)=>Math.abs(v-lightB[i])>1))whiteChanged++;
      }
    }
  }
  assert.ok(changed>40,'real flame/glow PNG must visibly change with RGBA palette; found '+changed);
  assert.ok(blackChanged>20&&whiteChanged>20,'color change visible on dark and light backgrounds');
  assert.ok(partial>0&&alphaMin===0&&alphaMax===255,'straight RGBA must retain alpha range');
  // View-only background does not change encoded PNG.
  await action('background','#ffffff');
  const light=await bake('light-background');
  await action('background','#111318');
  const dark=await bake('dark-background');
  await action('background','checker');
  for(const name of ['frames/frame_00012.png','frames/frame_00018.png','frames/frame_00025.png']){
   assert.ok(gradient.get(name).equals(light.get(name)),'white background changed bake '+name);
   assert.ok(gradient.get(name).equals(dark.get(name)),'dark background changed bake '+name);
  }
  await page.locator('#fxSparkPanel summary').click();
  await action('fxSparkEnabled',true);
  await action('fxSparkPreset','stylized');
  await action('fxSparkSpace','srgb');
  await action('fxSparkCurveTarget','sizeOverLife');
  await action('fxSparkCurveValue',2);
  const spark=await page.evaluate(()=>cfg.sparkLifetime);
  assert.equal(spark.enabled,true);
  assert.equal(spark.colorOverLife.stops.length,4);
  assert.equal(spark.sizeOverLife.keys[0].y,2);
  await action('fxSparkBlend','normal');
  assert.equal(await page.evaluate(()=>fx.settings.sparkBlend),'normal');
  await page.locator('#fxEmitterPanel > summary').click();
  await action('fxEmittersEnabled',true);
  await page.locator('#fxLayerLifePanel summary').click();
  await action('fxLayerLifeEnabled',true);
  const layerState=await page.evaluate(()=>({
    lifetime:cfg.multiEmitters.emitters[0].layers[0].lifetime,
    other:cfg.multiEmitters.emitters[1].layers[0].lifetime
  }));
  assert.equal(layerState.lifetime.enabled,true);
  assert.equal(layerState.other.enabled,false,'changing one layer cannot affect other emitter');
  const layerOutput=await page.evaluate(()=>FxEmitters.sample(cfg.multiEmitters,1.2));
  assert.ok(layerOutput.layers.some(l=>l.primitives.some(p=>typeof p.color==='string')));
  await page.locator('#fxFlameReset').click();
  assert.deepEqual(await page.evaluate(()=>cfg.fireGradient),Colors.createPreset('natural','flameIntensity'));
  await action('fxFlamePreset','magical');
  const after=await bake('full-lifetime');
  const latest=JSON.parse(after.get('sequence.json'));
  assert.equal(latest.effectSettings.sparkLifetime.enabled,true);
  assert.equal(latest.effectSettings.sparkBlend,'normal');
  assert.equal(latest.effectSettings.multiEmitters.emitters[0].layers[0].lifetime.enabled,true);
  for(const target of ['WebGL','WebGPU']){
   const pending=page.waitForEvent('download',{timeout:60000});
   await page.locator('#export'+target).click();
   const dest=path.join(output,backend+'-developer-'+target+'.zip');
   await (await pending).saveAs(dest);
   const entriesMap=entries(fs.readFileSync(dest));
   for(const module of ['FxColors.mjs','BurnTransition.mjs','FxEmitters.mjs','FxEmitterRuntime.mjs'])
     assert.ok(entriesMap.has(module),'developer package missing '+module);
   assert.ok(entriesMap.get('BurnTransition.mjs').toString().includes("import './FxColors.mjs'"));
   assert.ok(entriesMap.get('FxEmitters.mjs').toString().includes("import './FxColors.mjs'"));
   const preset=JSON.parse(entriesMap.get('preset.json'));
   assert.deepEqual(preset.settings.fireGradient,latest.effectSettings.fireGradient);
   assert.deepEqual(preset.settings.sparkLifetime,latest.effectSettings.sparkLifetime);
   const folder=path.join(output,'modules-'+backend+'-'+target);fs.mkdirSync(folder,{recursive:true});
   for(const name of ['FxCurves.mjs','FxColors.mjs','FxSpacing.mjs','FxEmitters.mjs','FxEmitterRuntime.mjs','BurnTransition.mjs'])
     fs.writeFileSync(path.join(folder,name),entriesMap.get(name));
   const colors=await import(pathToFileURL(path.join(folder,'FxColors.mjs')).href);
   const runtime=await import(pathToFileURL(path.join(folder,'BurnTransition.mjs')).href);
   assert.equal(typeof runtime.createBurnTransition,'function');
   assert.deepEqual(colors.FxColors.sample(preset.settings.fireGradient,.37),Colors.sample(latest.effectSettings.fireGradient,.37));
  }
  assert.equal(network,0,'offline editor must never request HTTP resources');
  assert.deepEqual(errors,[],'no shader validation errors or uncaught JavaScript errors');
  console.log('PASS COLOR UI/PNG/EXPORT',JSON.stringify({backend,flameChangedPixels:changed,
   blackChanged,whiteChanged,partiallyTransparent:partial,alphaMin,alphaMax,
   palettes:3,previewAndBake:true,frames:40,exportTargets:2,offline:true}));
 }finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
