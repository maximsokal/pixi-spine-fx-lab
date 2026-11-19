#!/usr/bin/env node
'use strict';
// FX-CORE-03: real Chrome UI, Pixi and Spine slot/bone integration.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const {entries,decodeRgba}=require('./test_png_pma.cjs');
const E=require('../assets/template/src/emitter-core.js');
const get=(name,alt)=>{const idx=process.argv.indexOf('--'+name);return idx<0?alt:process.argv[idx+1]};
const html=get('html'),backend=get('backend','webgl'),out=path.resolve(get('output','fx-emitter-qa'));
if(!html||!['webgl','webgpu'].includes(backend))throw Error('Usage: --html FILE --backend webgl|webgpu --output DIR');
async function run(){
 const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
 fs.mkdirSync(out,{recursive:true});
 const browser=await chromium.launch({headless:true,
   ...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{}),
   args:['--no-sandbox',...(process.env.FX_SOFTWARE_GPU==='1'?
     ['--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--enable-unsafe-webgpu','--use-vulkan=swiftshader','--enable-features=Vulkan']:[])]});
 const page=await browser.newPage({viewport:{width:1400,height:950},offline:true,acceptDownloads:true});
 const errors=[];let network=0;
 page.on('pageerror',e=>errors.push(e.stack||e.message));
 page.on('request',r=>{if(/^https?:/.test(r.url()))network++});
 const check=async(id,checked)=>checked?page.locator('#'+id).check():page.locator('#'+id).uncheck();
 const fill=async(id,value)=>{
   await page.locator('#'+id).fill(String(value));
   await page.locator('#'+id).dispatchEvent('change');
 };
 const select=async(id,value)=>page.locator('#'+id).selectOption(String(value));
 const val=()=>page.evaluate(()=>({doc:cfg.multiEmitters,snapshot:multiFx?.snapshot,
   diagnostics:multiFx?.diagnostics,bindings:multiFx?.slotBindings,
   owned:multiFx?.ownedCount}));
 try{
  const url=pathToFileURL(path.resolve(html));url.searchParams.set('renderer',backend);
  await page.goto(url.href);
  await page.waitForFunction(()=>document.querySelector('#viewport canvas')&&
    document.getElementById('loading').style.display==='none'&&
    !document.getElementById('assetName').textContent.includes('Loading'),null,{timeout:60000});
  assert.equal(await page.evaluate(()=>backend),backend,'backend mismatch');
  if(process.argv.includes('--webgl1')){
    assert.equal(backend,'webgl');
    const actual=await page.evaluate(async()=>{cfg.quality='low';await switchRenderer();
      return app.renderer.gl instanceof WebGL2RenderingContext?'webgl2':'webgl1'});
    assert.equal(actual,'webgl1','must use real WebGL1');
  }
  let initial=await val();
  assert.equal(initial.doc.enabled,false);
  assert.equal(initial.snapshot.cost,0);
  assert.equal(initial.owned,2);
  await page.locator('#fxEmitterPanel summary').click();
  await check('fxEmittersEnabled',true);
  await page.evaluate(()=>{setPlaying(false);phase=.4;setProgress(ease(.4));});
  let state=await val();
  assert.ok(state.snapshot.cost>0,'explosion must actually draw');
  assert.equal(state.doc.emitters.length,2);
  assert.equal(state.snapshot.layers.length,14);
  const firstOrigin=await page.evaluate(()=>multiFx.scenePositionForEmitter('emitter1'));
  const secondOrigin=await page.evaluate(()=>multiFx.scenePositionForEmitter('emitter2'));
  const secondSettings=JSON.stringify(state.doc.emitters[1]);
  await fill('fxEmitterX',-13);
  state=await val();
  assert.equal(state.doc.emitters[0].x,-13);
  assert.equal(JSON.stringify(state.doc.emitters[1]),secondSettings,'emitter2 moved with emitter1');
  assert.notDeepEqual(await page.evaluate(()=>multiFx.scenePositionForEmitter('emitter1')),firstOrigin);
  assert.deepEqual(await page.evaluate(()=>multiFx.scenePositionForEmitter('emitter2')),secondOrigin);

  // Every visible layer can disappear independently without affecting its siblings.
  for(const type of E.LAYER_TYPES){
    const layer=state.doc.emitters[0].layers.find(l=>l.type===type);
    assert.ok(layer);
    const siblingIds=new Set((await val()).snapshot.layers.filter(l=>l.emitterId==='emitter1'&&l.id!==layer.id).map(l=>l.id));
    await check('fxEmitterToggle_'+layer.id,false);
    const next=(await val()).snapshot.layers;
    assert.ok(!next.some(l=>l.id===layer.id),'disabled layer persists: '+type);
    for(const id of siblingIds)assert.ok(next.some(l=>l.id===id),'sibling vanished: '+id);
    await check('fxEmitterToggle_'+layer.id,true);
  }
  await select('fxEmitterLayerSelect','emitter1_smoke');
  await fill('fxEmitterLayerX',37);
  await fill('fxEmitterLayerY',-11);
  state=await val();
  assert.equal(state.doc.emitters[0].layers.find(l=>l.type==='smoke').x,37);
  assert.equal(state.doc.emitters[0].layers.find(l=>l.type==='smoke').y,-11);
  assert.equal(JSON.stringify(state.doc.emitters[1]),secondSettings);
  assert.ok(state.snapshot.layers.find(l=>l.id==='emitter1_smoke').primitives.length>0);

  // Frame updates must not replace DOM handles while the pointer is over them.
  const stableHandle=await page.evaluate(async()=>{
    const a=document.querySelector('#fxEmitterGuide circle[data-id="emitter1"]');
    if(!a)return false;
    for(let i=0;i<8;i++)await new Promise(requestAnimationFrame);
    return a.isConnected&&a===document.querySelector('#fxEmitterGuide circle[data-id="emitter1"]');
  });
  assert.equal(stableHandle,true,'continuous preview must preserve draggable SVG handle identity');

  // Actual pointer event drag at different camera zooms, with inverse transform.
  for(const zoom of [.5,1,2]){
    await page.evaluate(z=>zoomPreviewCamera(z),zoom);
    const circle=page.locator('#fxEmitterGuide circle[data-id="emitter1"]');
    const bounds=await circle.evaluate(n=>{const r=n.getBoundingClientRect();return r.width&&r.height?{x:r.x,y:r.y,width:r.width,height:r.height}:null;});
    if(!bounds)console.log('EMITTER_HANDLE_DIAG',JSON.stringify(await page.evaluate(()=>({
      guideHidden:document.getElementById('fxEmitterGuide').hidden,guideChildren:document.getElementById('fxEmitterGuide').children.length,
      panelOpen:document.getElementById('fxEmitterPanel').open,selected:emitterUi.getSelected(),
      docEnabled:cfg.multiEmitters.enabled,multi:!!multiFx,position:multiFx?.scenePositionForEmitter('emitter1'),
      renderer:backend,quality:cfg.quality,previewScale,camera:cameraState,svg:document.getElementById('fxEmitterGuide')?.outerHTML.slice(0,1500),computed: getComputedStyle(document.getElementById('fxEmitterGuide')).display,root:document.getElementById('fxEmitterGuide')?.getBoundingClientRect().toJSON(),circles:[...document.querySelectorAll('#fxEmitterGuide circle')].map(n=>({id:n.getAttribute('data-id'),bbox:n.getBoundingClientRect().toJSON(),display:getComputedStyle(n).display}))}))));
    assert.ok(bounds,'draggable emitter handle missing');
    const x=bounds.x+bounds.width/2,y=bounds.y+bounds.height/2;
    const before=await page.evaluate(()=>({local:cfg.multiEmitters.emitters[0].x,world:multiFx.scenePositionForEmitter('emitter1')}));
    await page.mouse.move(x,y);await page.mouse.down();
    await page.mouse.move(x+16,y+7,{steps:4});await page.mouse.up();
    const after=await page.evaluate(()=>({local:cfg.multiEmitters.emitters[0].x,world:multiFx.scenePositionForEmitter('emitter1')}));
    assert.ok(Math.abs(after.world.x-before.world.x-16/zoom)<.5,'inverse camera drag failed '+zoom+': '+(after.world.x-before.world.x));
    assert.ok(Math.abs(after.world.y-before.world.y-7/zoom)<.5,'inverse camera Y drag failed '+zoom);
  }
  const layerBox=await page.locator('#fxEmitterGuide rect[data-kind="layer"]').boundingBox();
  if(!layerBox)console.log('WEBGL1_LAYER_DIAG',JSON.stringify(await page.evaluate(()=>({selection:emitterUi.getSelected(),
    emitter:multiFx.scenePositionForEmitter('emitter1'),layer:multiFx.scenePositionForLayer('emitter1','emitter1_smoke'),
    layerHandle:document.querySelector('#fxEmitterGuide rect[data-kind=layer]')?.outerHTML,
    panelOpen:document.getElementById('fxEmitterPanel').open,guideHidden:document.getElementById('fxEmitterGuide').hidden,
    doc:cfg.multiEmitters.emitters[0].layers.find(l=>l.type==='smoke')}))));
  assert.ok(layerBox);
  const layerBefore=await page.evaluate(()=>multiFx.scenePositionForLayer('emitter1','emitter1_smoke'));
  const dragX=layerBox.x+layerBox.width/2,dragY=layerBox.y+layerBox.height/2;
  await page.mouse.move(dragX,dragY);await page.mouse.down();
  await page.mouse.move(dragX+20,dragY,{steps:3});await page.mouse.up();
  const layerAfter=await page.evaluate(()=>multiFx.scenePositionForLayer('emitter1','emitter1_smoke'));
  assert.ok(Math.abs(layerAfter.x-layerBefore.x-10)<.5,'selected layer drag @ zoom=2');

  // Anchor references must be resolved against actual Spine pose.
  await select('fxEmitterAnchorType','bone');
  await fill('fxEmitterAnchorName','body_ctrl');
  assert.ok(await page.evaluate(()=>multiFx.scenePositionForEmitter('emitter1')));
  await fill('fxEmitterAnchorName','missing_bone_test');
  state=await val();
  assert.ok(state.diagnostics.some(d=>d.code==='missing-bone'));
  assert.equal(await page.evaluate(()=>multiFx.scenePositionForEmitter('emitter1')),null);
  assert.ok(state.snapshot.layers.some(l=>l.emitterId==='emitter2'),'missing bone killed other emitter');
  await fill('fxEmitterAnchorName','root');
  await select('fxEmitterAnchorType','slot');
  await fill('fxEmitterAnchorName','body');
  await select('fxEmitterPlacement','slot');
  state=await val();
  assert.equal(state.bindings,1,'actual slot binding was not made');
  assert.ok(await page.evaluate(()=>Boolean(model.getSlotObject('body'))),'Spine did not own slot Pixi object');
  await select('fxEmitterSelect','emitter2');
  await select('fxEmitterAnchorType','slot');
  await fill('fxEmitterAnchorName','body');
  await select('fxEmitterPlacement','slot');
  state=await val();
  assert.equal(state.bindings,1,'two emitters must share one slot container');
  assert.equal(state.owned,2);
  const slotNodes=await page.evaluate(()=>model.getSlotObject('body')?.children.length||0);
  assert.equal(slotNodes,2,'slot wrapper must hold both emitters');
  await select('fxEmitterSelect','emitter1');
  await select('fxEmitterPlacement','front');
  await select('fxEmitterAnchorType','attachment');
  const found=await page.evaluate(()=>({slot:'body',name:model.skeleton.findSlot('body')?.getAttachment()?.name||''}));
  assert.ok(found.name,'sample must provide an attachment for anchor test');
  await fill('fxEmitterAnchorName',found.name);
  await fill('fxEmitterAnchorSlot',found.slot);
  assert.ok(await page.evaluate(()=>multiFx.scenePositionForEmitter('emitter1')),
    'attachment centroid cannot be resolved');
  await select('fxEmitterPlacement','front');
  await select('fxEmitterAnchorType','skeleton');
  // Separate budgets and no ghost after selective removal.
  await fill('fxEmitterBudget',12);
  await fill('fxEmittersGlobalBudget',20);
  state=await val();
  assert.ok(state.snapshot.cost<=20);
  assert.ok(state.snapshot.layers.filter(l=>l.emitterId==='emitter1')
    .reduce((n,l)=>n+l.cost,0)<=12);
  await page.locator('#fxEmitterAdd').click();
  assert.equal((await val()).owned,3);
  await page.locator('#fxEmitterDelete').click();
  assert.equal((await val()).owned,2,'selective deletion failed');
  assert.equal(await page.evaluate(()=>model.getSlotObject('body')?.children.length||0),1);
  console.log('PASS EMITTER UI/ANCHORS',JSON.stringify({backend,layers:14,zoom:[.5,1,2],slotTests:true,attachment:found.name}));

  // Reset stage to an off-model explosion that the crop should capture.
  await page.evaluate(()=>{
    cfg.multiEmitters=FxEmitters.makeExplosionPreset();
    const d=cfg.multiEmitters;
    d.enabled=true;d.globalBudget=180;
    for(const e of d.emitters){e.anchor={type:'world',name:''};e.space='world';e.placement='front';
      e.x=bakeCrop().x+bakeCrop().width*.8;e.y=bakeCrop().y+bakeCrop().height*.25;e.duration=3;}
    emitterUi.refresh(d);multiFx.configure(d);multiFx.seek(.8);updateEmitterHandles();
  });
  await page.locator('#animPlay').uncheck();
  for(const [id,v]of [['bakeWidth',320],['bakeHeight',256],['bakeFrames',40],['durationFrames',40]]){
    await fill(id,v);
  }
  await page.evaluate(()=>{
    const crop=bakeCrop(),d=FxEmitters.deserialize(FxEmitters.serialize(cfg.multiEmitters));
    for(const e of d.emitters){e.x=crop.x+crop.width*.78;e.y=crop.y+crop.height*.22;}
    cfg.multiEmitters=d;multiFx.configure(d);emitterUi.refresh(d);
  });
  const pending=page.waitForEvent('download',{timeout:120000});
  await page.locator('#bakeStart').click();
  const result=await pending;
  const file=path.join(out,backend+'-emitters.zip');
  await result.saveAs(file);
  await page.waitForFunction(()=>!document.getElementById('bakeStart').disabled);
  const zip=entries(fs.readFileSync(file)),names=[...zip.keys()].filter(n=>n.endsWith('.png'));
  assert.equal(names.length,40);
  const meta=JSON.parse(zip.get('sequence.json'));
  assert.equal(meta.emitters.enabled,true);
  assert.equal(meta.emitters.frames.length,40);
  assert.ok(meta.emitters.frames.some(f=>f.cost>0),'bake drew no effect layers');
  assert.ok(meta.effectSettings.multiEmitters.enabled);
  const frame=decodeRgba(zip.get('frames/frame_00020.png'));
  assert.equal(frame.width,320);assert.equal(frame.height,256);
  // The new owned layers must actually affect PNG pixels.
  await page.evaluate(()=>{const d=FxEmitters.deserialize(FxEmitters.serialize(cfg.multiEmitters));
    d.enabled=false;cfg.multiEmitters=d;multiFx.configure(d);emitterUi.refresh(d);});
  const emptyPending=page.waitForEvent('download',{timeout:120000});
  await page.locator('#bakeStart').click();
  const emptyFile=path.join(out,backend+'-disabled.zip');
  await (await emptyPending).saveAs(emptyFile);
  await page.waitForFunction(()=>!document.getElementById('bakeStart').disabled);
  const empty=entries(fs.readFileSync(emptyFile));
  assert.ok(!zip.get('frames/frame_00020.png').equals(empty.get('frames/frame_00020.png')),
    'enabling the multilayer explosion must change baked PNG');
  console.log('PASS EMITTER BAKE',JSON.stringify({backend,frames:40,costAt20:meta.emitters.frames[20].cost}));
  // Exported developer project imports reusable independent runtime.
  await page.evaluate(()=>{const d=FxEmitters.deserialize(FxEmitters.serialize(cfg.multiEmitters));
    d.enabled=true;cfg.multiEmitters=d;multiFx.configure(d);emitterUi.refresh(d);});
  for(const flavor of ['WebGL','WebGPU']){
    const wait=page.waitForEvent('download',{timeout:60000});
    await page.locator('#export'+flavor).click();
    const zipFile=path.join(out,backend+'-developer-'+flavor+'.zip');
    await (await wait).saveAs(zipFile);
    const files=entries(fs.readFileSync(zipFile));
    for(const name of ['FxEmitters.mjs','FxEmitterRuntime.mjs','FxSpacing.mjs','FxCurves.mjs','BurnTransition.mjs'])
      assert.ok(files.has(name),'Missing developer module '+name);
    assert.ok(files.get('example.js').toString().includes("createEmitterLayers"));
    const preset=JSON.parse(files.get('preset.json'));
    assert.equal(preset.settings.multiEmitters.enabled,true);
    const folder=path.join(out,'esm-'+flavor);fs.mkdirSync(folder,{recursive:true});
    for(const name of ['FxEmitters.mjs','FxEmitterRuntime.mjs','FxSpacing.mjs','FxCurves.mjs','BurnTransition.mjs'])
      fs.writeFileSync(path.join(folder,name),files.get(name));
    const module=await import(pathToFileURL(path.join(folder,'FxEmitterRuntime.mjs')).href);
    assert.equal(typeof module.createEmitterLayers,'function');
  }
  assert.equal(network,0);assert.deepEqual(errors,[]);
  console.log('PASS EMITTER EXPORT',JSON.stringify({backend,exports:2,offline:true}));
 }finally{await browser.close();}
}
run().catch(e=>{console.error(e);process.exitCode=1;});
