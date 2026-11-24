'use strict';
const A=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto'),{pathToFileURL}=require('node:url');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fixture=process.argv[3],sample=path.resolve(__dirname,'../assets/template/sample');
if(!fixture)throw Error('Provide local official Spineboy fixture directory');
const hashes={'spineboy-pro.skel':'1345de0e8e4729559f39060ed614429b21ab39bfc09ed2e1f58fcf054a8b5925','spineboy-pro.json':'488face411ddfad77ee3239b29431deb574d73f4feca7eca541452ad24bb6bfc','spineboy-pma.atlas':'a53dd09fa8d304b395062c0a35a4c3952e979dda00e74b9cd95a5bc264cd6d5d','spineboy-pma.png':'eb8a9b9f105517acda7ab5c9961f6c487a6bc2ac28a6a123f6303a6af805dd3f'};
const raw=Object.fromEntries(Object.entries(hashes).map(([n,h])=>{const b=fs.readFileSync(path.join(fixture,n));A.equal(createHash('sha256').update(b).digest('hex'),h);return [n,b]}));
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{}),args:['--no-sandbox','--enable-unsafe-webgpu']});
 try{
  const page=await browser.newPage({offline:true,viewport:{width:1400,height:1000}}),errors=[],network=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))network.push(r.url())});
  await page.goto(pathToFileURL(process.argv[2]).href);await page.waitForFunction(()=>lootEditor.ready);
  A.equal(await page.locator('#sample').count(),1);
  A.match(await page.locator('#assetLabel').textContent(),/No Spine/);
  await page.locator('#sample').click();await page.waitForFunction(()=>lootEditor.ready&&lootEditor.asset?.pages===2);
  const sampleInfo=await page.evaluate(()=>lootEditor.asset);A.ok(sampleInfo.animations.length>1);
  const load=async()=>{await page.locator('#loadSpine').click();await page.waitForFunction(()=>lootEditor.ready)};
  const file=(name,buffer)=>({name,mimeType:'application/octet-stream',buffer});
  const select=async(name,bytes,atlas,images)=>{await page.locator('#skeletonFile').setInputFiles(file(name,bytes));await page.locator('#atlasFile').setInputFiles(file('input.atlas',atlas));await page.locator('#clearTextures').click();if(images.length)await page.locator('#textureFiles').setInputFiles(images);await load()};
  const get=()=>page.evaluate(()=>lootEditor.asset),seek=f=>page.evaluate(f=>lootEditor.seek(f/60),f);
  const canvas=()=>page.locator('#surface canvas').screenshot();
  const img=file('spineboy-pma.png',raw['spineboy-pma.png']);
  await select('spineboy-pro.json',raw['spineboy-pro.json'],raw['spineboy-pma.atlas'],[img]);
  const json=await get();A.equal(json.version,'4.2.22');A.ok(json.bones.length>1);
  await select('spineboy #1 %.skel',raw['spineboy-pro.skel'],raw['spineboy-pma.atlas'],[img]);
  const binary=await get();for(const k of ['version','bones','slots','skins','animations'])A.deepEqual(binary[k],json[k],k);
  A.equal(binary.name,'spineboy #1 %.skel');A.equal(binary.bytes,raw['spineboy-pro.skel'].length);
  await page.locator('#animation').selectOption('walk');await seek(15);
  const pose=await page.evaluate(()=>lootEditor.poses),bone=binary.bones.find(n=>n==='hip')||binary.bones[1];A.ok(pose[bone]);
  await page.locator('#l-anchor').selectOption('bone');await page.locator('#l-bone').selectOption(bone);
  await page.locator('#l-x').fill('0');await page.locator('#l-x').dispatchEvent('change');
  const p=await page.evaluate(()=>lootEditor.sample);A.ok(p.emitters[0].layers.stars.length);
  await seek(18);const moved=await page.evaluate(()=>lootEditor.poses);A.notDeepEqual(pose[bone],moved[bone]);
  await seek(15);A.deepEqual(await page.evaluate(()=>lootEditor.sample),p);
  const prior=await canvas();
  await select('bad.skel',raw['spineboy-pro.skel'].subarray(0,24),raw['spineboy-pma.atlas'],[img]);
  A.equal(await page.locator('#status').getAttribute('data-error'),'true');A.deepEqual(await get(),binary);A.ok(prior.equals(await canvas()));
  const wrong=Buffer.from(raw['spineboy-pro.skel']);const off=wrong.indexOf(Buffer.from(binary.version));wrong[off+2]=51;
  await select('bad.skel',wrong,raw['spineboy-pma.atlas'],[img]);A.match(await page.locator('#status').textContent(),/4\.2/);A.ok(prior.equals(await canvas()));
  await select('bad.json',Buffer.from('{'),raw['spineboy-pma.atlas'],[img]);A.ok(prior.equals(await canvas()));
  await select('missing.skel',raw['spineboy-pro.skel'],raw['spineboy-pma.atlas'],[]);A.equal(await page.locator('#status').getAttribute('data-error'),'true');A.ok(prior.equals(await canvas()));
  for(const b of ['webgl1','webgpu','webgl2']){await page.locator('#backend').selectOption(b);await page.waitForFunction(b=>lootEditor.ready&&lootEditor.backend===b,b);A.deepEqual(await get(),binary);A.equal(await page.locator('#animation').inputValue(),'walk');A.equal(await page.locator('#surface canvas').count(),1);A.deepEqual(await page.evaluate(()=>lootEditor.sample),p)}
  await page.locator('#showSpine').uncheck();const hidden=await canvas();A.deepEqual(await page.evaluate(()=>lootEditor.sample),p);
  await page.locator('#showSpine').check();A.ok(!hidden.equals(await canvas()));
  await page.locator('#animationSpeed').fill('.5');await page.locator('#animationSpeed').dispatchEvent('change');
  A.notDeepEqual((await page.evaluate(()=>lootEditor.poses))[bone],pose[bone]);
  await page.locator('#animationSpeed').fill('1');await page.locator('#animationSpeed').dispatchEvent('change');
  A.deepEqual(await page.evaluate(()=>lootEditor.sample),p);
  // Independent inverse transform for a bone-relative drag.
  await page.locator('#moveTarget').selectOption('layer');await page.evaluate(()=>lootEditor.zoom(.5));
  const before=await page.evaluate(()=>lootEditor.settings.emitters[0].layers.stars);
  const bp=(await page.evaluate(()=>lootEditor.poses))[bone],handle=page.locator('#originHandle');
  await handle.scrollIntoViewIfNeeded();const rect=await handle.boundingBox();
  await page.mouse.move(rect.x+rect.width/2,rect.y+rect.height/2);await page.mouse.down();await page.mouse.move(rect.x+rect.width/2+5,rect.y+rect.height/2,{steps:3});await page.mouse.up();
  const after=await page.evaluate(()=>lootEditor.settings.emitters[0].layers.stars);
  A.ok(Math.abs(after.x-before.x-10*Math.cos(bp.rotation*Math.PI/180)/bp.scale)<.1);
  A.ok(Math.abs(after.y-before.y+10*Math.sin(bp.rotation*Math.PI/180)/bp.scale)<.1);
  const doctor=fs.readdirSync(sample).map(n=>path.join(sample,n)),sk=doctor.find(n=>n.endsWith('.json')),at=doctor.find(n=>n.endsWith('.atlas')),pages=doctor.filter(n=>n.endsWith('.png'));
  A.equal(pages.length,2);
  const kept=await get(),keptPixels=await canvas();
  await page.locator('#skeletonFile').setInputFiles(sk);await page.locator('#atlasFile').setInputFiles(at);await page.locator('#clearTextures').click();
  await page.locator('#textureFiles').setInputFiles(pages[0]);await load();A.match(await page.locator('#status').textContent(),/missing atlas page/i);A.deepEqual(await get(),kept);A.ok(keptPixels.equals(await canvas()));
  await page.locator('#textureFiles').setInputFiles(pages[1]);await load();A.equal((await get()).pages,2);
  // Direct loader with two equal basenames and no exact match must reject.
  const ambiguous=await page.evaluate(async()=>{
   const src=FxLootSpine.sample(JSON.parse(document.getElementById('sampleData').textContent)),images=new Map();
   for(const [n,b] of src.images){images.set('a/'+n,b);images.set('b/'+n,b)}
   try{const a=await FxLootSpine.create({...src,images});a.destroy();return false}catch(e){return /ambiguous atlas page/i.test(e.message)}
  });A.equal(ambiguous,true);
  // Dropping complete files does not change the active asset until explicit load.
  await page.evaluate(()=>{
   const src=FxLootSpine.sample(JSON.parse(document.getElementById('sampleData').textContent)),d=new DataTransfer();
   d.items.add(new File([src.skeleton],'drop.json'));d.items.add(new File([src.atlas],'drop.atlas'));
   for(const [n,b] of src.images)d.items.add(new File([b],n));
   document.getElementById('surface').dispatchEvent(new DragEvent('drop',{dataTransfer:d,bubbles:true,cancelable:true}));
  });
  A.match(await page.locator('#pendingFiles').textContent(),/drop.json/);A.notEqual((await get()).name,'drop.json');
  await load();A.equal((await get()).name,'drop.json');
  // A missing source anchor must not hide a separate world-anchored halo.
  const preset=await page.evaluate(()=>lootEditor.settings);preset.emitters[0].layers.halo.enabled=true;
  await page.locator('#preset').fill(JSON.stringify(preset));await page.locator('#applyPreset').click();
  await page.locator('#removeSpine').click();A.equal(await get(),null);A.equal((await page.evaluate(()=>lootEditor.sample)).emitters[0].layers.stars.length,0);A.ok((await page.evaluate(()=>lootEditor.sample)).emitters[0].layers.halo.length);
  A.deepEqual(errors,[]);A.deepEqual(network,[]);
  console.log('PASS GAME-12 Spine JSON/SKEL and anchor motion',JSON.stringify({version:binary.version,bones:binary.bones.length,slots:binary.slots.length,animations:binary.animations.length,skins:binary.skins.length,bytes:binary.bytes,samplePages:sampleInfo.pages,offline:true}));
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
