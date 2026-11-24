'use strict';
const A=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url'),P=require('./fx_visual_png.cjs');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
function crc32(bytes){let c=0xffffffff;for(const b of bytes){c^=b;for(let i=0;i<8;i++)c=c&1?0xedb88320^(c>>>1):c>>>1}return (c^0xffffffff)>>>0}
function unzip(b){const m=new Map();let i=0;while(b.readUInt32LE(i)===0x04034b50){const n=b.readUInt16LE(i+26),e=b.readUInt16LE(i+28),z=b.readUInt32LE(i+18),name=b.subarray(i+30,i+30+n).toString(),a=i+30+n+e;A.equal(b.readUInt16LE(i+8),0);A.ok(!m.has(name));A.equal(crc32(b.subarray(a,a+z)),b.readUInt32LE(i+14));m.set(name,b.subarray(a,a+z));i=a+z}return m}
const decode=b=>P.decodePng(b),count=b=>{const a=P.countAlpha(decode(b));return a.partial+a.opaque};
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{}),args:['--no-sandbox','--enable-unsafe-webgpu']});
 try{
 const page=await browser.newPage({offline:true,acceptDownloads:true,viewport:{width:1400,height:1000}}),errors=[],external=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))external.push(r.url())});
 await page.goto(pathToFileURL(process.argv[2]).href);await page.waitForFunction(()=>lootEditor.ready);
 A.equal(await page.locator('#bakePng').count(),1);
 const download=async id=>{const event=page.waitForEvent('download');await page.locator('#'+id).click();const dl=await event;await page.waitForFunction(()=>lootEditor.ready);return fs.readFileSync(await dl.path())};
 const seek=f=>page.evaluate(f=>lootEditor.seek(f/60),f),snap=()=>page.evaluate(()=>({settings:lootEditor.settings,sample:lootEditor.sample,asset:lootEditor.asset,poses:lootEditor.poses}));
 for(const backend of ['webgl1','webgl2','webgpu']){
  await page.locator('#backend').selectOption(backend);await page.waitForFunction(b=>lootEditor.ready&&lootEditor.backend===b,backend);
  await seek(15);const prior=await snap(),before=await page.locator('#surface canvas').screenshot();
  const bytes=await download('bakePng'),files=unzip(bytes),meta=JSON.parse(files.get('sequence.json'));
  A.equal(meta.backend,backend);A.equal(meta.count,40);A.equal(meta.frames.length,40);A.equal(files.size,42);
  for(let i=0;i<40;i++){const f=meta.frames[i];A.equal(f.timeSeconds,i/60);const p=decode(files.get(f.file));A.equal(p.width,512);A.equal(p.height,512)}
  A.equal(count(files.get('frames/frame_00000.png')),0);A.ok(count(files.get('frames/frame_00015.png'))>0);A.equal(count(files.get('frames/frame_00039.png')),0);
  A.deepEqual(await snap(),prior);A.ok(before.equals(await page.locator('#surface canvas').screenshot()));
  await page.evaluate(()=>lootEditor.zoom(.5));A.deepEqual(await download('bakePng'),bytes);await page.evaluate(()=>lootEditor.zoom(1));
  // Independent color oracle: a semi-transparent rectangle, not the effect renderer.
  const rgba=await page.evaluate(async backend=>{
   const app=new PIXI.Application();await app.init({width:16,height:16,backgroundAlpha:0,autoStart:false,preference:backend==='webgpu'?'webgpu':'webgl',preferWebGLVersion:backend==='webgl1'?1:2});
   const g=new PIXI.Graphics().rect(2,3,6,4).fill({color:0xc86432,alpha:.5});app.stage.addChild(g);
   const p=app.renderer.extract.pixels({target:app.stage,frame:new PIXI.Rectangle(0,0,16,16)});
   const b=await FxLootExport.encodePng({...p,alpha:backend==='webgpu'?'straight':'premultiplied'});
   app.destroy(true,{children:true});return Array.from(b)
  },backend);
  const oracle=decode(Buffer.from(rgba)),c=oracle.rgba(4,4);A.ok(Math.abs(c[0]-200)<=2&&Math.abs(c[1]-100)<=2&&Math.abs(c[2]-50)<=2&&Math.abs(c[3]-128)<=1,c);
  A.deepEqual(oracle.rgba(4,12),[0,0,0,0]);
  // An off-center crop must select the corresponding authored coordinates.
  const set=async(id,n)=>{await page.locator('#'+id).fill(String(n));await page.locator('#'+id).dispatchEvent('change')};
  for(const [k,v] of Object.entries({bakeX:176,bakeY:190,bakeWidth:160,bakeHeight:120,bakeFrames:16}))await set(k,v);
  await page.locator('#showCrop').check();
  const cut=unzip(await download('bakePng')),p=decode(cut.get('frames/frame_00015.png')),full=decode(files.get('frames/frame_00015.png'));
  A.equal(p.width,160);A.equal(p.height,120);A.ok(count(cut.get('frames/frame_00015.png'))>0);
  for(let y=0;y<120;y++)for(let x=0;x<160;x++)A.deepEqual(p.rgba(x,y),full.rgba(x+176,y+190));
  await page.locator('#showCrop').uncheck();
  for(const [k,v] of Object.entries({bakeX:0,bakeY:0,bakeWidth:512,bakeHeight:512,bakeFrames:40}))await set(k,v);
  console.log('PASS actual 40-frame PNG',backend);
 }
 await page.locator('#bakeFrames').fill('');await page.locator('#p-mode').selectOption('idle');await seek(20);const prior=await snap();
 const idle=unzip(await download('bakePng'));A.equal(JSON.parse(idle.get('sequence.json')).count,60);A.ok(count(idle.get('frames/frame_00000.png'))>0);
 A.deepEqual(await snap(),prior);
 await page.locator('#bakePng').click();await page.locator('#cancelBake').click();await page.waitForFunction(()=>lootEditor.ready);A.match(await page.locator('#status').textContent(),/cancel/i);A.deepEqual(await snap(),prior);
 const retry=await download('bakePng');A.deepEqual(unzip(retry).get('frames/frame_00020.png'),idle.get('frames/frame_00020.png'));
 await page.locator('#sample').click();await page.waitForFunction(()=>lootEditor.ready&&lootEditor.asset?.pages===2);
 await seek(20);const source=await snap(),withSpine=unzip(await download('bakePng'));A.ok(count(withSpine.get('frames/frame_00000.png'))>100);A.deepEqual(await snap(),source);
 for(const target of ['webgl','webgpu']){
  const b=await download(target+'Zip'),z=unzip(b),p=JSON.parse(z.get('preset.json'));A.equal(p.rendererPreference,target);A.deepEqual(p.settings,source.settings);A.equal(p.asset.images.length,2);A.ok(z.has('LICENSES.txt')&&z.has('example.js'));if(process.argv[3]){fs.mkdirSync(process.argv[3],{recursive:true});fs.writeFileSync(path.join(process.argv[3],target+'.zip'),b)}
 }
 A.deepEqual(errors,[]);A.deepEqual(external,[]);console.log('PASS 60-frame loop, cancel/retry, Spine export and developer packages');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
