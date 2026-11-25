'use strict';
const A=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{execFileSync}=require('node:child_process'),{pathToFileURL}=require('node:url'),P=require('./fx_visual_png.cjs');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
function crc(b){let c=~0;for(const x of b){c^=x;for(let i=0;i<8;i++)c=c&1?(c>>>1)^0xedb88320:c>>>1;}return (~c)>>>0;}
function unzip(b){const m=new Map();let i=0;while(b.readUInt32LE(i)===0x04034b50){const n=b.readUInt16LE(i+26),e=b.readUInt16LE(i+28),z=b.readUInt32LE(i+18),name=b.subarray(i+30,i+30+n).toString(),a=i+30+n+e;A.equal(b.readUInt16LE(i+8),0);A.ok(!m.has(name));A.equal(crc(b.subarray(a,a+z)),b.readUInt32LE(i+14));m.set(name,b.subarray(a,a+z));i=a+z}return m}
const count=b=>{const a=P.countAlpha(P.decodePng(b));return a.opaque+a.partial};
(async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'shock-bake-')),html=path.join(dir,'shock.html');let browser;
 try{
 execFileSync('python',[path.join(__dirname,'build_shockwave_editor.py'),'--output',html]);
 browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{}),args:['--no-sandbox','--enable-unsafe-webgpu']});
 const page=await browser.newPage({offline:true,acceptDownloads:true,viewport:{width:1400,height:1000}}),errors=[],network=[],downloads=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))network.push(r.url())});page.on('download',d=>downloads.push(d.suggestedFilename()));
 await page.goto(pathToFileURL(html).href);await page.waitForFunction(()=>document.body.dataset.ready==='true');
 A.equal(await page.locator('#bakePng').count(),1);
 const set=async(id,v)=>page.locator('#'+id).evaluate((e,v)=>{e.value=String(v);e.dispatchEvent(new Event('change',{bubbles:true}))},v);
 const state=()=>page.evaluate(()=>({preset:JSON.parse(document.getElementById('preset').value),frame:document.getElementById('frame').value,animation:document.getElementById('animation').value,skin:document.getElementById('skin').value,visible:document.getElementById('showSpine').checked}));
 const ready=()=>page.waitForFunction(()=>!document.getElementById('bakePng').disabled);
 const bake=async()=>{const e=page.waitForEvent('download');await page.locator('#bakePng').click();const dl=await e;await ready();return fs.readFileSync(await dl.path())};
 const canvas=()=>page.locator('#surface canvas').screenshot();
 for(const backend of ['webgl1','webgl2','webgpu']){
  await page.locator('#backend').selectOption(backend);await page.waitForFunction(b=>document.getElementById('backendActual').textContent===b.toUpperCase()&&!document.getElementById('backend').disabled,backend);
  await set('frame',20);const prior=await state(),before=await canvas(),bytes=await bake(),files=unzip(bytes),meta=JSON.parse(files.get('sequence.json'));
  A.equal(meta.effectId,'fx.game.shockwave');A.equal(meta.backend,backend);A.equal(meta.count,40);A.equal(files.size,42);
  for(let i=0;i<40;i++){const f=meta.frames[i];A.equal(f.timeSeconds,i/60);const p=P.decodePng(files.get(f.file));A.equal(p.width,512);A.equal(p.height,512);A.equal(p.colorType,6)}
  A.ok(count(files.get('frames/frame_00000.png'))>0);A.ok(count(files.get('frames/frame_00020.png'))>100);A.equal(count(files.get('frames/frame_00039.png')),0);
  A.deepEqual(await state(),prior);A.ok(before.equals(await canvas()));
  await page.locator('#zoom').selectOption('0.5');A.deepEqual(await bake(),bytes);await page.locator('#zoom').selectOption('1');
  for(const [k,v] of Object.entries({bakeX:96,bakeY:190,bakeWidth:160,bakeHeight:120,bakeFrames:21}))await set(k,v);
  const cut=unzip(await bake()),full=P.decodePng(files.get('frames/frame_00020.png')),crop=P.decodePng(cut.get('frames/frame_00020.png'));
  A.ok(count(cut.get("frames/frame_00020.png"))>100);A.equal(crop.width,160);A.equal(crop.height,120);for(let y=0;y<120;y++)for(let x=0;x<160;x++)A.deepEqual(crop.rgba(x,y),full.rgba(x+96,y+190));
  for(const [k,v] of Object.entries({bakeX:0,bakeY:0,bakeWidth:512,bakeHeight:512,bakeFrames:40}))await set(k,v);
  // Independent real GPU alpha oracle (not the ring shader).
  const oracle=await page.evaluate(async backend=>{
   const app=new PIXI.Application();await app.init({width:16,height:16,backgroundAlpha:0,autoStart:false,preference:backend==='webgpu'?'webgpu':'webgl',preferWebGLVersion:backend==='webgl1'?1:2});
   const target=PIXI.RenderTexture.create({width:16,height:16,resolution:1});let reader;
   try{
    app.stage.addChild(new PIXI.Graphics().rect(2,3,6,4).fill({color:0xc86432,alpha:.5}));
    app.renderer.render({container:app.stage,target,clear:true,clearColor:[0,0,0,0]});
    let f;if(backend==='webgpu'){reader=FxShockwaveBake.gpuReader(app.renderer,target,16,16,globalThis);f={pixels:await reader.read(),width:16,height:16,alpha:'straight'}}
    else f={...app.renderer.extract.pixels(target),alpha:'premultiplied'};
    return Array.from(await FxShockwaveExport.encodePng(f));
   }finally{reader?.destroy();target.destroy(true);app.destroy(true,{children:true})}
  },backend);
  const image=P.decodePng(Buffer.from(oracle)),rgba=image.rgba(4,4);A.ok(Math.abs(rgba[0]-200)<=2&&Math.abs(rgba[1]-100)<=2&&Math.abs(rgba[2]-50)<=2&&Math.abs(rgba[3]-128)<=1,rgba);A.deepEqual(image.rgba(4,12),[0,0,0,0]);
  console.log('PASS actual PNG sequence, nonempty crop, zoom, alpha',backend);
 }
 await page.locator('summary').filter({hasText:'Spine 4.2 assets and animation'}).click();await page.locator('#sample').click();await page.waitForFunction(()=>document.getElementById('assetLabel').textContent.includes('2 atlas pages'));
 await page.locator('#animation').selectOption('attack_1');await page.locator('#showSpine').uncheck();
 const c=(await state()).preset;c.emitters[0].anchor={type:'bone',name:'hip'};c.emitters[0].x=c.emitters[0].y=0;c.finalRadius=90;
 await page.locator('#preset').fill(JSON.stringify(c));await page.locator('#applyPreset').click();
 await set('frame',20);const prior=await state(),before=await canvas(),anchored=unzip(await bake()),meta=JSON.parse(anchored.get('sequence.json'));
 A.equal(meta.asset.options.animation,'attack_1');A.equal(meta.asset.options.visible,false);A.ok(count(anchored.get('frames/frame_00020.png'))>0);
 A.deepEqual(await state(),prior);A.ok(before.equals(await canvas()));
 const n=downloads.length;await page.locator('#bakePng').click();await page.locator('#cancelBake').click();await ready();A.equal(downloads.length,n);A.match(await page.locator('#status').textContent(),/cancel/i);
 A.deepEqual(await state(),prior);A.ok(before.equals(await canvas()));A.deepEqual(unzip(await bake()).get('frames/frame_00020.png'),anchored.get('frames/frame_00020.png'));
 A.deepEqual(errors,[]);A.deepEqual(network,[]);console.log('PASS anchored Spine bake, cancel and retry');
 }finally{await browser?.close();fs.rmSync(dir,{recursive:true,force:true})}
})().catch(e=>{console.error(e);process.exitCode=1});
