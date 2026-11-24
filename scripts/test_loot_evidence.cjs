#!/usr/bin/env node
'use strict';
// T05 phase/layer pixel evidence. A PASS here is not full effect certification.
// Run once per actual backend with separate external output directories.
const A=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process');
const {pathToFileURL}=require('node:url'),{decodePng,countAlpha,comparePixels}=require('./fx_visual_png.cjs');
const repo=path.resolve(__dirname,'..'),backend=process.argv[2];
if(!['webgl1','webgl2','webgpu'].includes(backend)||!process.argv[3])throw Error('Usage: node scripts/test_loot_evidence.cjs webgl1|webgl2|webgpu EXTERNAL_EMPTY_DIR');
const out=path.resolve(process.argv[3]),rel=path.relative(repo,out);
if(!rel||(!rel.startsWith('..'+path.sep)&&rel!=='..'&&!path.isAbsolute(rel)))throw Error('Evidence must be written outside the repository');
fs.mkdirSync(out,{recursive:true});
if(fs.readdirSync(out).length)throw Error('Evidence directory must be empty');
const sources=['assets/template/vendor/pixi-8.22.0.min.js','assets/template/src/curve-core.js','assets/template/src/spacing-core.js','assets/template/src/color-core.js','assets/loot-sparkle/src/loot-core.js','assets/loot-sparkle/src/loot-runtime.js','assets/loot-sparkle/src/loot-export.js','assets/loot-sparkle/src/loot-bake.js','scripts/fixtures/splash-runtime.html','scripts/fx_visual_png.cjs','scripts/test_loot_evidence.cjs','scripts/test_loot_parameter_matrix.cjs'];
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const report={schemaVersion:1,effectId:'fx.game.loot-sparkle',scope:'T05 phase and isolated layer PNG evidence only',status:'NOT RUN',requestedBackend:backend,actualBackend:null,sourceCommit:null,sources:{},captures:{},checks:{},warnings:['Does not certify complete FX-CORE-07, Spine import, developer exports, physical-device performance or artist acceptance.']};
const save=()=>fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
save();
(async()=>{
 let browser;
 try{
  report.sourceCommit=cp.execFileSync('git',['-C',repo,'rev-parse','HEAD'],{encoding:'utf8'}).trim();
  A.match(report.sourceCommit,/^[0-9a-f]{40}$/);
  for(const f of sources){const b=fs.readFileSync(path.join(repo,f));report.sources[f]=sha(b);
   A.equal(sha(cp.execFileSync('git',['-C',repo,'show',report.sourceCommit+':'+f],{maxBuffer:16*1024*1024})),report.sources[f],'source does not match commit '+f);}
  const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
  browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{}),args:['--no-sandbox',...(backend==='webgpu'?['--enable-unsafe-webgpu']:['--enable-webgl'])]});
  report.browser=browser.version();const page=await browser.newPage({offline:true}),errors=[],network=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))network.push(r.url())});
  await page.goto(pathToFileURL(path.join(repo,'scripts/fixtures/splash-runtime.html')).href);
  for(const f of sources.slice(0,8))await page.addScriptTag({path:path.join(repo,f)});
  const result=await page.evaluate(async backend=>{
   const captures={},settings=FxLoot.defaults();
   const copy=x=>structuredClone(x);
   const all=copy(settings);for(const l of Object.values(all.emitters[0].layers))l.enabled=true;
   const only=k=>{const c=copy(all);for(const [name,l] of Object.entries(c.emitters[0].layers))l.enabled=name===k;return c;};
   let actual=null;
   async function collect(config,times){
    const scene=await FxLootBake.sceneFactory()({settings:config,backend,crop:{x:0,y:0,width:512,height:512}});
    try{actual=scene.backend;for(const [id,time] of times){const frame=await scene.readFrame(time),png=await FxLootExport.encodePng(frame);captures[id]={time,settings:config,png:Array.from(png)};}}
    finally{scene.destroy()}
   }
   await collect(settings,[['start',0],['birth',7/60],['peak',17/60],['fade',36/60],['end',39/60],['repeat',17/60]]);
   for(const k of ['stars','halo','sweep','none'])await collect(only(k),[[k,.25]]);
   await collect(all,[['all',.25]]);
   for(const k of ['stars','halo','sweep']){const c=copy(all);c.emitters[0].layers[k].enabled=false;await collect(c,[['without-'+k,.25]]);}
   const idle=copy(all);idle.mode='idle';idle.durationFrames=60;
   await collect(idle,[['idle-zero',0],['idle-seam',1]]);
   return {actual,captures};
  },backend);
  report.actualBackend=result.actual;report.networkRequests=network;report.pageErrors=errors;
  A.equal(result.actual,backend);A.deepEqual(network,[]);A.deepEqual(errors,[]);
  const decoded={};
  for(const [id,v] of Object.entries(result.captures)){
   const bytes=Buffer.from(v.png),image=decodePng(bytes),file=id+'.png';
   A.equal(image.width,512);A.equal(image.height,512);A.equal(image.colorType,6);
   const alpha=countAlpha(image);fs.writeFileSync(path.join(out,file),bytes);
   report.captures[id]={file,sha256:sha(bytes),timeSeconds:v.time,settings:v.settings,...alpha,visiblePixels:alpha.partial+alpha.opaque};
   decoded[id]=image;
  }
  const count=id=>report.captures[id].visiblePixels,delta=(a,b)=>comparePixels(decoded[a],decoded[b],{step:1,channelTolerance:0}).changedPixels;
  for(const id of ['start','end','none']){A.equal(count(id),0,id);report.checks[id]={visiblePixels:0};}
  for(const id of ['birth','peak','fade','stars','halo','sweep','idle-zero']){A.ok(count(id)>0,id+' invisible');report.checks[id]={visiblePixels:count(id)};}
  for(const k of ['stars','halo','sweep']){const n=delta('all','without-'+k);A.ok(n>0,k+' toggle has no pixel effect');report.checks['toggle-'+k]={changedPixels:n};}
  A.ok(report.captures.halo.partial>0);report.checks.haloAlpha={partialPixels:report.captures.halo.partial};
  for(const [a,b] of [['peak','repeat'],['idle-zero','idle-seam']]){A.equal(delta(a,b),0);report.checks[a+'-equals-'+b]={changedPixels:0};}
  report.status='PASS';
 }catch(e){report.status='FAIL';report.error=String(e.stack||e);process.exitCode=1;}
 finally{try{await browser?.close()}catch(e){report.status='FAIL';report.cleanupError=String(e);process.exitCode=1;}save();console.log(report.status,backend,path.join(out,'report.json'));}
})();
