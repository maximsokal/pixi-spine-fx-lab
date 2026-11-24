'use strict';
// External, licensed real Spine 4.2 fixture supplied by the developer; no network in this test.
const A=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {createHash}=require('node:crypto'),{execFileSync}=require('node:child_process'),{pathToFileURL}=require('node:url');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),fixture=process.argv[2];
if(!fixture)throw Error('Usage: node scripts/test_real_spine_binary.cjs /path/to/official-spineboy-export');
const hashes={
 'spineboy-pro.skel':'1345de0e8e4729559f39060ed614429b21ab39bfc09ed2e1f58fcf054a8b5925',
 'spineboy-pro.json':'488face411ddfad77ee3239b29431deb574d73f4feca7eca541452ad24bb6bfc',
 'spineboy-pma.atlas':'a53dd09fa8d304b395062c0a35a4c3952e979dda00e74b9cd95a5bc264cd6d5d',
 'spineboy-pma.png':'eb8a9b9f105517acda7ab5c9961f6c487a6bc2ac28a6a123f6303a6af805dd3f'
};
const raw=Object.fromEntries(Object.entries(hashes).map(([n,sha])=>{
 const b=fs.readFileSync(path.join(fixture,n));A.equal(createHash('sha256').update(b).digest('hex'),sha,n);return [n,b];
}));
function entries(bytes){
 const out=new Map();let pos=0;
 while(pos+30<=bytes.length&&bytes.readUInt32LE(pos)===0x04034b50){
  A.equal(bytes.readUInt16LE(pos+8),0);A.equal(bytes.readUInt16LE(pos+6)&8,0);
  const size=bytes.readUInt32LE(pos+18),n=bytes.readUInt16LE(pos+26),e=bytes.readUInt16LE(pos+28);
  const name=bytes.subarray(pos+30,pos+30+n).toString();pos+=30+n+e;
  A.ok(!out.has(name));out.set(name,bytes.subarray(pos,pos+size));pos+=size;
 }
 return out;
}
async function main(){
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'spine-binary-qa-'));let browser;
 try{
  const html=path.join(temp,'Burn.html');
  execFileSync('python',[path.join(root,'scripts/build_editor.py'),path.join(root,'assets/template'),'--output',html],{stdio:'inherit'});
  browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{}),args:['--no-sandbox']});
  for(const backend of ['webgl','webgpu']){
   const page=await browser.newPage({viewport:{width:1280,height:900},offline:true,acceptDownloads:true});
   const errors=[],external=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))external.push(r.url())});
   const url=pathToFileURL(html);url.searchParams.set('renderer',backend);await page.goto(url.href);
   await page.waitForFunction(()=>window.__burnLab?.model&&document.getElementById('loading').style.display==='none');
   A.equal(await page.evaluate(()=>window.__burnLab.backend),backend,'actual backend');
   await page.locator('#animPlay').uncheck();
   const skeletonName='spineboy #1 % pro.skel',atlasName='spineboy #1 %.atlas';
   const upload=async(bytes,name=skeletonName)=>page.evaluate(async data=>{
    const make=([n,b])=>new File([Uint8Array.from(atob(b),c=>c.charCodeAt(0))],n);
    return window.__burnLab.loadFiles(data.map(make));
   },[[name,bytes.toString('base64')],[atlasName,raw['spineboy-pma.atlas'].toString('base64')],['spineboy-pma.png',raw['spineboy-pma.png'].toString('base64')]]);
   const get=()=>page.evaluate(()=>{
    const l=window.__burnLab,m=l.model,d=m.skeleton.data;
    return {version:d.version,bones:d.bones.map(b=>b.name),slots:d.slots.map(s=>s.name),
     animations:d.animations.map(a=>a.name),skins:d.skins.map(s=>s.name),
     name:l.loadedAsset.skeletonName,bytes:l.loadedAsset.skeleton.size,
     mesh:m.skeleton.slots.some(s=>s.getAttachment() instanceof spine.MeshAttachment)};
   });
   A.equal(await upload(raw['spineboy-pro.json'],'spineboy-pro.json'),true);
   const json=await get();A.match(json.version,/^4\.2\./);A.ok(json.bones.length>1&&json.animations.length>1);
   A.equal(await upload(raw['spineboy-pro.skel']),true);
   const binary=await get();
   for(const key of ['version','bones','slots','animations','skins'])A.deepEqual(binary[key],json[key],key+' JSON/SKEL parity');
   A.equal(binary.bytes,raw['spineboy-pro.skel'].length);A.equal(binary.name,skeletonName);
   await page.evaluate(()=>{window.__qaPriorModel=window.__burnLab.model;window.__qaPriorAsset=window.__burnLab.loadedAsset;});
   const corrupt=raw['spineboy-pro.skel'].subarray(0,24);
   A.equal(await upload(corrupt),false,'truncated genuine SKEL');
   A.equal(await page.evaluate(()=>window.__qaPriorModel===window.__burnLab.model&&window.__qaPriorAsset===window.__burnLab.loadedAsset),true,'failed import retained ownership');
   const mismatch=Buffer.from(raw['spineboy-pro.skel']);const off=mismatch.indexOf(Buffer.from(binary.version));A.ok(off>=8&&off<20);mismatch[off+2]=51;
   A.equal(await upload(mismatch),false,'wrong 4.3 binary header');A.deepEqual(await get(),binary);
   const missing=await page.evaluate(async data=>window.__burnLab.loadFiles(data.map(([n,b])=>new File([Uint8Array.from(atob(b),c=>c.charCodeAt(0))],n))),[[skeletonName,raw['spineboy-pro.skel'].toString('base64')],[atlasName,raw['spineboy-pma.atlas'].toString('base64')],['wrong.png',raw['spineboy-pma.png'].toString('base64')]]);
   A.equal(missing,false);A.deepEqual(await get(),binary);
   for(const target of ['WebGL','WebGPU']){
    const pending=page.waitForEvent('download');await page.locator('#export'+target).click();const dl=await pending,file=path.join(temp,backend+'-'+target+'.zip');await dl.saveAs(file);
    const zip=entries(fs.readFileSync(file)),p=JSON.parse(zip.get('preset.json'));
    for(const [key,name,original] of [['skeleton',skeletonName,'spineboy-pro.skel'],['atlas',atlasName,'spineboy-pma.atlas']]){
     A.equal(p.asset[key==='skeleton'?'sourceSkeletonName':'sourceAtlasName'],name);
     const url=new URL(p.asset[key],'https://example.invalid/');
     A.equal(url.hash,'','asset filename became URL fragment');
     A.equal(url.search,'','asset filename became URL query');
     A.match(url.pathname,/^\/assets\/[A-Za-z0-9._-]+$/,'developer path must be safe for Vite static server');
     A.deepEqual(zip.get('public'+url.pathname),raw[original],'asset URL does not select original bytes');
    }
    A.deepEqual(zip.get('public/assets/spineboy-pma.png'),raw['spineboy-pma.png']);
    A.equal(p.asset.spineVersion,binary.version);
    // Optional local handoff for running the generated developer examples.
    if(process.env.FX_BINARY_QA_ZIPS&&backend==='webgl'){
     fs.mkdirSync(process.env.FX_BINARY_QA_ZIPS,{recursive:true});
     fs.copyFileSync(file,path.join(process.env.FX_BINARY_QA_ZIPS,target+'.zip'),fs.constants.COPYFILE_EXCL);
    }
   }
   A.deepEqual(errors,[]);A.deepEqual(external,[]);
   console.log('PASS real Spine JSON/SKEL, corrupt/mismatch/missing page rollback, exact ZIP asset bytes and URL identity',JSON.stringify({backend,version:binary.version,bones:binary.bones.length,slots:binary.slots.length,animations:binary.animations.length,skins:binary.skins.length,mesh:binary.mesh,bytes:binary.bytes}));
   await page.close();
  }
 }finally{if(browser)await browser.close();fs.rmSync(temp,{recursive:true,force:true});}
}
main().catch(e=>{console.error(e.stack||e);process.exitCode=1});
