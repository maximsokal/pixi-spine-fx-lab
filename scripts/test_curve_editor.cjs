#!/usr/bin/env node
// FX-CORE-01 end-to-end offline browser contract: UI, preview, bake & developer ZIP.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {entries,decodeRgba} = require('./test_png_pma.cjs');
const C = require('../assets/template/src/curve-core.js');
const opt=(k,d)=>{const i=process.argv.indexOf('--'+k);return i<0?d:process.argv[i+1]};
const html=opt('html'),backend=opt('backend','webgl'),output=path.resolve(opt('output','fx-curves-qa'));
if(!html||!['webgl','webgpu'].includes(backend))throw new Error('Usage: test_curve_editor.cjs --html FILE --backend webgl|webgpu --output DIR');
async function main(){
 const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
 fs.mkdirSync(output,{recursive:true});
 const browser=await chromium.launch({headless:true,
  ...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{}),
  args:['--no-sandbox',...(process.env.FX_SOFTWARE_GPU==='1'?['--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--enable-unsafe-webgpu','--use-vulkan=swiftshader','--enable-features=Vulkan']:[])]});
 const page=await browser.newPage({viewport:{width:1300,height:900},offline:true,acceptDownloads:true});
 let network=0;const errors=[];
 page.on('request',q=>{if(/^https?:/.test(q.url()))network++});
 page.on('pageerror',e=>errors.push(e.message));
 try{
  const url=pathToFileURL(path.resolve(html));url.searchParams.set('renderer',backend);
  await page.goto(url.href);
  await page.waitForFunction(()=>document.querySelector('#viewport canvas') &&
    document.getElementById('loading').style.display==='none' &&
    !document.getElementById('assetName').textContent.includes('Loading'),null,{timeout:60000});
  assert.equal(await page.evaluate(()=>backend),backend,'backend fallback');
  if(process.argv.includes('--webgl1')){
    assert.equal(backend,'webgl','WebGL1 only applies to webgl');
    const actual=await page.evaluate(async()=>{
      cfg.quality='low';await switchRenderer();
      return app.renderer.gl instanceof WebGL2RenderingContext?'webgl2':'webgl1';
    });
    assert.equal(actual,'webgl1','must confirm actual WebGL1 context');
  }
  const legacy=await page.evaluate(()=>({easing:cfg.easing,progress:SpineBurnFx.ease(.35,cfg.easing,cfg.timeCurve)}));
  assert.equal(legacy.easing,1);
  assert.ok(Math.abs(legacy.progress-(3*.35**2-2*.35**3))<1e-8);
  await page.locator('#fxCurvePanel summary').click();
  await page.locator('#fxCurvePreset').selectOption('fastAttack');
  let state=await page.evaluate(()=>({mode:cfg.easing,curve:cfg.timeCurve,fx:fx.progress,phase}));
  assert.equal(state.mode,4);assert.equal(state.curve.parameterKey,'transitionProgress');
  assert.deepEqual(C.normalize(state.curve),state.curve);
  assert.ok(state.fx>=0&&state.fx<=1);
  const middle=C.evaluate(state.curve,.25);
  assert.ok(middle>.25,'fast attack should exceed linear at 25%');
  await page.locator('#fxCurveAdd').click();
  assert.equal(await page.evaluate(()=>cfg.timeCurve.keys.length),3,'add key');
  await page.locator('#fxCurveCopy').click();
  assert.equal(await page.evaluate(()=>cfg.timeCurve.keys.length),4,'copy key');
  await page.locator('#fxCurveDelete').click();
  assert.equal(await page.evaluate(()=>cfg.timeCurve.keys.length),3,'delete key');
  await page.locator('#fxCurveFrame').fill('65');
  await page.locator('#fxCurveFrame').dispatchEvent('change');
  assert.equal(await page.evaluate(()=>Math.round(cfg.timeCurve.keys[1].x*180)),65,'frame snap');
  await page.locator('#fxCurveValue').fill('0.82');
  await page.locator('#fxCurveValue').dispatchEvent('change');
  assert.ok(Math.abs(await page.evaluate(()=>cfg.timeCurve.keys[1].y)-.82)<1e-8,'numeric key edit');
  await page.locator('#fxCurveMode').selectOption('stepped');
  assert.equal(await page.evaluate(()=>cfg.timeCurve.keys[1].mode),'stepped');
  await page.locator('#fxCurveMode').selectOption('bezier');
  assert.equal(await page.evaluate(()=>cfg.timeCurve.keys[1].mode),'bezier');
  assert.equal(await page.locator('#fxCurveOutX').isEnabled(),true);
  await page.locator('#fxCurveOutX').fill('0.7');
  await page.locator('#fxCurveOutX').dispatchEvent('change');
  assert.ok(Math.abs(await page.evaluate(()=>cfg.timeCurve.keys[1].out[0])-.7)<1e-8,'numeric handle edit');
  // Real SVG pointer drag, not merely a programmatic model mutation.
  const key=page.locator('#fxCurveGraph circle[data-kind="key"]').nth(1);
  const box=await key.boundingBox();
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
  await page.mouse.down();
  await page.mouse.move(box.x+box.width/2+16,box.y+box.height/2-5,{steps:4});
  await page.mouse.up();
  state=await page.evaluate(()=>({mode:cfg.easing,curve:cfg.timeCurve}));
  assert.deepEqual(C.normalize(state.curve),state.curve);
  assert.equal(state.mode,4);
  const hover=page.locator('#fxCurveGraph');
  const rect=await hover.boundingBox();
  await page.mouse.click(rect.x+rect.width*.6,rect.y+rect.height*.85);
  const live=await page.evaluate(()=>({phase,output:fx.progress,screen:+document.getElementById('progress').value,
    oracle:FxCurves.evaluate(cfg.timeCurve,phase),runtime:SpineBurnFx.ease(phase,cfg.easing,cfg.timeCurve)}));
  assert.ok(Math.abs(live.output-live.oracle)<1e-7,'preview must sample curve');
  assert.ok(Math.abs(live.runtime-live.oracle)<1e-7,'engine and UI curve evaluator agree');
  assert.ok(Math.abs(live.screen-live.oracle)<.002,'preview progress display');

  // Bake the actual Spine model, logging the same time/curve evaluator calls.
  await page.locator('#animPlay').uncheck();
  for(const [id,v]of [['bakeWidth',160],['bakeHeight',128],['bakeFrames',40],['durationFrames',40]]){
    await page.locator('#'+id).fill(String(v));await page.locator('#'+id).dispatchEvent('change');
  }
  assert.equal(Number(await page.locator('#fxCurveFrame').inputValue()),
    await page.evaluate(()=>Math.round(cfg.timeCurve.keys[1].x*40)),
    'frame editor must refresh when the effect duration changes');
  await page.evaluate(()=>{
    const original=SpineBurnFx.ease;
    window.__curveBake=[];
    SpineBurnFx.ease=function(t,kind,curve){
      const result=original(t,kind,curve);
      window.__curveBake.push({t,kind,result});
      return result;
    };
  });
  const pending=page.waitForEvent('download',{timeout:120000});
  await page.locator('#bakeStart').click();
  const downloaded=await pending,file=path.join(output,backend+'-custom-bake.zip');
  await downloaded.saveAs(file);
  await page.waitForFunction(()=>!document.getElementById('bakeStart').disabled);
  const archive=entries(fs.readFileSync(file)),frames=[...archive.keys()].filter(n=>n.endsWith('.png'));
  assert.equal(frames.length,40);
  const metadata=JSON.parse(archive.get('sequence.json'));
  assert.equal(metadata.effectSettings.easing,4);
  assert.deepEqual(metadata.effectSettings.timeCurve,C.normalize(state.curve));
  const baked=await page.evaluate(()=>window.__curveBake);
  // Fixed-step replay evaluates progress both at simulation and render
  // boundaries. Validate each required timestamp rather than call count.
  assert.ok(baked.length>=40);
  for(let i=0;i<40;i++){
    const matches=baked.filter(x=>Math.abs(x.t-i/40)<1e-9);
    assert.ok(matches.length>=1,'missing custom curve sample at frame '+i);
    const expected=C.evaluate(metadata.effectSettings.timeCurve,i/40);
    for(const sample of matches){
      assert.equal(sample.kind,4);
      assert.ok(Math.abs(sample.result-expected)<1e-7,'bake sample matches curve at frame '+i);
    }
  }
  assert.equal(decodeRgba(archive.get('frames/frame_00000.png')).width,160);
  console.log('PASS CURVE BAKE',JSON.stringify({backend,frames:40,curveKeys:state.curve.keys.length}));

  for(const target of ['WebGL','WebGPU']){
    const dl=page.waitForEvent('download',{timeout:60000});
    await page.locator('#export'+target).click();
    const zipPath=path.join(output,backend+'-developer-'+target+'.zip');
    await (await dl).saveAs(zipPath);
    const items=entries(fs.readFileSync(zipPath));
    assert.ok(items.has('FxCurves.mjs'),'curve engine missing from developer zip');
    assert.ok(items.has('BurnTransition.mjs'),'effect missing from developer zip');
    const preset=JSON.parse(items.get('preset.json'));
    assert.equal(preset.settings.easing,4);assert.deepEqual(preset.settings.timeCurve,state.curve);
    const moduleText=items.get('BurnTransition.mjs').toString();
    assert.ok(moduleText.includes("import './FxCurves.mjs'"),'developer effect must import shared evaluator');
    const dir=path.join(output,'module-'+backend+'-'+target);fs.mkdirSync(dir,{recursive:true});
    for(const n of ['FxCurves.mjs','BurnTransition.mjs',...(items.has('FxSpacing.mjs')?['FxSpacing.mjs']:[]),...(items.has('FxColors.mjs')?['FxColors.mjs']:[]),...(items.has('FxTimeline.mjs')?['FxTimeline.mjs']:[])])fs.writeFileSync(path.join(dir,n),items.get(n));
    const loaded=await import(pathToFileURL(path.join(dir,'BurnTransition.mjs')).href);
    const runtime=await import(pathToFileURL(path.join(dir,'FxCurves.mjs')).href);
    assert.equal(typeof loaded.createBurnTransition,'function');
    assert.ok(Math.abs(runtime.FxCurves.evaluate(preset.settings.timeCurve,.333)-
       C.evaluate(state.curve,.333))<1e-9,'exported evaluator parity');
  }
  await page.locator('#fxCurveReset').click();
  const reset=await page.evaluate(()=>cfg.timeCurve);
  assert.deepEqual(reset,C.createPreset('fastAttack',{parameterKey:'transitionProgress',monotonic:true}),'reset restores selected preset');
  const generic=await page.evaluate(()=>{
    const host=document.createElement('section');host.id='fxCurveGenericQA';document.body.append(host);
    const source=FxCurves.createPreset('pulse',{parameterKey:'sparkSize',domain:'pathPosition',
      inputUnit:'pixels',inputRange:[0,100],valueRange:[2,12],defaultValue:2,monotonic:false,valueUnit:'px'});
    let changed=null;
    const editor=FxCurveEditor.mount(host,{curve:source,onChange(v){changed=v},
      onScrub(){},getFrameCount:()=>60});
    const menu=host.querySelector('#fxCurvePreset');
    const options=[...menu.options].map(o=>o.value);
    menu.value='burst';menu.dispatchEvent(new Event('change'));
    const output={options,initialMid:FxCurves.evaluate(source,25),updated:editor.getCurve(),
      emitted:changed,svg:!!host.querySelector('svg polyline')};
    host.remove();return output;
  });
  assert.ok(generic.options.includes('pulse')&&generic.options.includes('slowDecay')&&generic.options.includes('burst'));
  assert.equal(generic.initialMid,7);
  assert.equal(generic.updated.keys.length,4);
  assert.equal(generic.updated.monotonic,false);
  assert.deepEqual(generic.updated,generic.emitted);
  assert.ok(generic.svg,'generic value-curve editor must draw in SVG');
  console.log('PASS CURVE EDITOR AND ZIP',JSON.stringify({backend,tools:['presets','add','copy','delete','numeric','handles','step','bezier','drag','scrub','reset'],exports:2,offline:true}));
  assert.equal(network,0,'no network from offline editor');assert.deepEqual(errors,[],'no JavaScript errors');
 } finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
