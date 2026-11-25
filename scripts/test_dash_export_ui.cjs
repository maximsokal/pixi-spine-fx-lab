'use strict';
const A=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{execFileSync}=require('node:child_process'),{pathToFileURL}=require('node:url'),P=require('./fx_visual_png.cjs');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
function crc(b){let c=~0;for(const x of b){c^=x;for(let i=0;i<8;i++)c=c&1?(c>>>1)^0xedb88320:c>>>1;}return (~c)>>>0;}
function unzip(b){const m=new Map();let i=0;while(b.readUInt32LE(i)===0x04034b50){const n=b.readUInt16LE(i+26),e=b.readUInt16LE(i+28),z=b.readUInt32LE(i+18),name=b.subarray(i+30,i+30+n).toString(),a=i+30+n+e;A.equal(b.readUInt16LE(i+8),0);A.ok(!m.has(name));A.equal(crc(b.subarray(a,a+z)),b.readUInt32LE(i+14));m.set(name,b.subarray(a,a+z));i=a+z}return m}
const count=b=>{const a=P.countAlpha(P.decodePng(b));return a.opaque+a.partial;};
(async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'dash-bake-')),html=path.join(dir,'dash.html');let browser;
 try{
 execFileSync('python',[path.join(__dirname,'build_dash_editor.py'),'--output',html]);
 browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{}),args:['--no-sandbox','--enable-unsafe-webgpu']});
 const page=await browser.newPage({offline:true,acceptDownloads:true,viewport:{width:1400,height:1000}}),errors=[],network=[],downloads=[];
 page.setDefaultTimeout(45000);page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))network.push(r.url())});page.on('download',d=>downloads.push(d.suggestedFilename()));
 await page.goto(pathToFileURL(html).href);await page.waitForSelector('body[data-ready=true]');
 const l=id=>page.locator('#'+id);A.equal(await l('bakePng').count(),1,'PNG control missing');
 const set=async(id,v)=>l(id).evaluate((e,v)=>{e.value=String(v);e.dispatchEvent(new Event('change',{bubbles:true}))},v);
 const state=()=>page.evaluate(()=>({preset:JSON.parse(document.getElementById('preset').value),frame:document.getElementById('frame').value,animation:document.getElementById('animation').value,skin:document.getElementById('skin').value,visible:document.getElementById('showSpine').checked}));
 const ready=()=>page.waitForFunction(()=>!document.getElementById('settingsPanel').disabled);
 const bake=async()=>{const e=page.waitForEvent('download');await l('bakePng').click();const dl=await e;await ready();return fs.readFileSync(await dl.path())};
 const canvas=()=>l('surface').locator('canvas').screenshot();
 const apply=async p=>{await l('preset').fill(JSON.stringify(p));await l('applyPreset').click();A.equal(await l('status').getAttribute('data-error'),'false')};
 await l('preset').locator('..').locator('summary').click();
 const original=(await state()).preset;A.equal(await l('bakeFrames').inputValue(),'40');
 const one=structuredClone(original);await apply(one);A.equal(await l('bakeFrames').inputValue(),'40');
 for(const backend of ['webgl1','webgl2','webgpu']){
  await l('backend').selectOption(backend);await page.waitForFunction(b=>document.getElementById('backendActual').textContent===b.toUpperCase()&&!document.getElementById('backend').disabled,backend);
  await set('frame',20);const prior=await state(),before=await canvas(),bytes=await bake(),files=unzip(bytes),meta=JSON.parse(files.get('sequence.json'));
  A.equal(meta.effectId,'fx.game.teleport-dash');A.equal(meta.backend,backend);A.equal(meta.count,40);A.equal(files.size,42);
  for(let i=0;i<40;i++){const f=meta.frames[i];A.equal(f.timeSeconds,i/60);const p=P.decodePng(files.get(f.file));A.equal(p.width,512);A.equal(p.height,512);A.equal(p.colorType,6)}
  A.equal(count(files.get('frames/frame_00000.png')),0);A.ok(count(files.get('frames/frame_00020.png'))>100);A.equal(count(files.get('frames/frame_00039.png')),0);
  A.deepEqual(await state(),prior);A.deepEqual(await canvas(),before);
  await l('zoomOut').click();await l('showCrop').check();await l('background').selectOption('checker');A.deepEqual(await bake(),bytes);await l('showCrop').uncheck();await l('background').selectOption('dark');await l('actualSize').click();
  for(const [k,v] of Object.entries({bakeX:96,bakeY:190,bakeWidth:250,bakeHeight:120,bakeFrames:21}))await set(k,v);
  const cut=unzip(await bake()),full=P.decodePng(files.get('frames/frame_00020.png')),crop=P.decodePng(cut.get('frames/frame_00020.png'));
  A.ok(count(cut.get('frames/frame_00020.png'))>100);A.equal(crop.width,250);A.equal(crop.height,120);for(let y=0;y<120;y++)for(let x=0;x<250;x++)A.deepEqual(crop.rgba(x,y),full.rgba(x+96,y+190));
  for(const [k,v] of Object.entries({bakeX:0,bakeY:0,bakeWidth:512,bakeHeight:512,bakeFrames:40}))await set(k,v);
  const oracle=await page.evaluate(async backend=>{
   const app=new PIXI.Application();await app.init({width:16,height:16,backgroundAlpha:0,autoStart:false,preference:backend==='webgpu'?'webgpu':'webgl',preferWebGLVersion:backend==='webgl1'?1:2});
   const target=PIXI.RenderTexture.create({width:16,height:16,resolution:1});let reader;
   try{app.stage.addChild(new PIXI.Graphics().rect(2,3,6,4).fill({color:0xc86432,alpha:.5}));app.renderer.render({container:app.stage,target,clear:true,clearColor:[0,0,0,0]});
    let f;if(backend==='webgpu'){reader=FxDashBake.gpuReader(app.renderer,target,16,16,globalThis);f={pixels:await reader.read(),width:16,height:16,alpha:'straight'}}
    else f={...app.renderer.extract.pixels(target),alpha:'premultiplied'};return Array.from(await FxDashExport.encodePng(f));
   }finally{reader?.destroy();target.destroy(true);app.destroy(true,{children:true})}
  },backend);
  const image=P.decodePng(Buffer.from(oracle)),rgba=image.rgba(4,4);A.ok(Math.abs(rgba[0]-200)<=2&&Math.abs(rgba[1]-100)<=2&&Math.abs(rgba[2]-50)<=2&&Math.abs(rgba[3]-128)<=1,rgba);A.deepEqual(image.rgba(4,12),[0,0,0,0]);
  // A crop must not change raster precision, even across negative/world tile boundaries.
  const tiles=await page.evaluate(async backend=>{
   const settings=FxDash.defaults();
   const read=async crop=>{const scene=await FxDashBake.sceneFactory()({settings,backend,crop});try{return Array.from(await FxDashExport.encodePng(await scene.readFrame(20/60)))}finally{scene.destroy()}};
   const full=await read({x:0,y:0,width:512,height:512}),cut=await read({x:96,y:190,width:250,height:120});
   settings.emitters[0].x=480;settings.emitters[0].y=0;
   return {full,cut,wide:await read({x:350,y:-120,width:320,height:240}),cross:await read({x:480,y:-30,width:80,height:60})};
  },backend);
  const pairs=[[tiles.full,tiles.cut,96,190],[tiles.wide,tiles.cross,130,90]];
  for(const [a,b,dx,dy] of pairs){const big=P.decodePng(Buffer.from(a)),small=P.decodePng(Buffer.from(b));A.ok(count(Buffer.from(b))>0);
   for(let y=0;y<small.height;y++)for(let x=0;x<small.width;x++)A.deepEqual(small.rgba(x,y),big.rgba(x+dx,y+dy),backend+' crop overlap at '+x+','+y);}
  console.log('PASS actual one-shot PNG, crop, zoom/guide/background invariance, alpha and cross-tile overlap',backend);
 }
 // The frame count follows effect duration until explicitly overridden.
 const longer=structuredClone(original);longer.durationFrames=60;await apply(longer);A.equal(await l('bakeFrames').inputValue(),'60');await set('bakeFrames',21);await apply(original);A.equal(await l('bakeFrames').inputValue(),'21');
 // Crop drag must use the inverse CSS camera, not screen pixels.
 await l('showCrop').check();
 for(const z of [.5,1,2]){await l('actualSize').click();if(z===.5)await l('zoomOut').click();if(z===2)await l('zoomIn').click();await set('bakeX',100);await set('bakeY',100);await set('bakeWidth',180);await set('bakeHeight',140);
  await l('cropHandle').scrollIntoViewIfNeeded();const b=await l('cropHandle').boundingBox();await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();await page.mouse.move(b.x+b.width/2+12*z,b.y+b.height/2-8*z,{steps:3});await page.mouse.up();
  A.equal(await l('bakeX').inputValue(),'112');A.equal(await l('bakeY').inputValue(),'92');}
 await l('showCrop').uncheck();await l('actualSize').click();
 await l('spinePanel').locator('summary').click();await l('sample').click();await ready();A.match(await l('assetLabel').textContent(),/2 atlas pages/);
 await l('animation').selectOption('attack_1');await ready();await l('showSpine').uncheck();
 const c=structuredClone(original);for(const k of Object.keys(c.emitters[0].layers))c.emitters[0].layers[k].enabled=k==='echoes';await apply(c);
 for(const [k,v] of Object.entries({bakeX:0,bakeY:0,bakeWidth:512,bakeHeight:512,bakeFrames:40}))await set(k,v);
 await set('frame',15);const prior=await state(),before=await canvas(),anchored=unzip(await bake()),am=JSON.parse(anchored.get('sequence.json'));
 A.equal(am.asset.options.animation,'attack_1');A.equal(am.asset.options.visible,false);A.equal(am.spacing.scheduledEchoes[0].births.length,5);A.deepEqual(am.spacing.scheduledEchoes[0].births.map(b=>b.birthSeconds),[3,6,9,12,15].map(f=>f/60));
 A.equal(count(anchored.get('frames/frame_00000.png')),0);A.ok(count(anchored.get('frames/frame_00015.png'))>100);A.equal(count(anchored.get('frames/frame_00039.png')),0);
 A.deepEqual(await state(),prior);A.deepEqual(await canvas(),before);
 const n=downloads.length;await l('bakePng').click();await page.waitForFunction(()=>document.getElementById('bakeProgress').value>=1&&!document.getElementById('cancelBake').disabled);await l('cancelBake').click();await ready();A.equal(downloads.length,n);A.match(await l('status').textContent(),/cancel/i);
 A.deepEqual(await state(),prior);A.deepEqual(await canvas(),before);A.deepEqual(unzip(await bake()).get('frames/frame_00015.png'),anchored.get('frames/frame_00015.png'));
 await set('bakeWidth',0);await l('bakePng').click();A.match(await l('status').textContent(),/Invalid bakeWidth/);A.equal(downloads.length,n+1);await set('bakeWidth',512);
 A.deepEqual(errors,[]);A.deepEqual(network,[]);console.log('PASS crop drag, duration following, historical echo-only PNG with hidden source, cancel/retry, invalid crop, zero network');
 }finally{await browser?.close();fs.rmSync(dir,{recursive:true,force:true})}
})().catch(e=>{console.error(e);process.exitCode=1});
