'use strict';
// Cross-effect export lifecycle regression. Real ZIP/PNG packagers; injected
// scene and compiler isolate cancellation from browser/GPU availability.
const cases=[
 ['magic-shield','shield'],['dissolve','dissolve'],['healing-aura','healing'],
 ['chain-lightning','chain'],['electric-aura','aura'],['energy-projectile','energy'],
 ['hit-sparks','hit-sparks'],['sword-slash','sword-slash'],['muzzle-flash','muzzle']
];
const file=([dir,name])=>'assets/'+dir+'/src/'+name+'-export.js';
function suite(load,A,test,{AbortController,deflate},selected=cases){
 const codec=load(file(cases[0]));
 for(const row of selected){const [dir]=row,api=load(file(row));
  for(const backend of ['webgl2','webgpu']){
   function setup(mode){const c=new AbortController(),counts={read:0,destroy:0};let enter,release;
    const entered=new Promise(r=>{enter=r;}),gate=new Promise(r=>{release=r;});
    const settings={schemaVersion:1,mode:'oneShot',durationFrames:40,effect:{exportFrames:40},targets:[{id:'target-1'}]};
    const readError=Error('fixture read failure'),cleanupError=Error('fixture cleanup failure');
    const args={codec,settings,compile:v=>({settings:v,meta:{frames:40,plans:[{id:'target-1',contactFrame:2}],overflow:[]}}),backend,crop:{x:0,y:0,width:1,height:1},frameCount:1,signal:c.signal,deflate,
     async createScene({settings}){return {settings,backend,maxTextureSize:4096,async readFrame(){counts.read++;if(mode==='both')throw readError;return {width:1,height:1,pixels:Uint8Array.of(0,0,0,0),alpha:backend==='webgpu'&&dir!=='dissolve'?'straight':'premultiplied'};},async destroy(){counts.destroy++;if(mode==='cancel'){enter();await gate;}if(mode==='cleanup'||mode==='both')throw cleanupError;}};}};
    return {args,c,counts,entered,release,readError,cleanupError};
   }
   test(dir+' '+backend+' success returns ZIP only after cleanup',async()=>{const f=setup('ok'),r=await api.bakeSequence(f.args);A.equal(f.counts.destroy,1);A.equal(f.counts.read,1);A.equal(r.manifest.count,1);A.deepEqual([...r.zip.slice(0,4)],[80,75,3,4]);});
   test(dir+' '+backend+' cancel while cleanup is pending rejects archive',async()=>{const f=setup('cancel'),job=api.bakeSequence(f.args);await Promise.race([f.entered,job.then(()=>{throw Error('returned before cleanup');})]);f.c.abort();f.release();await A.rejects(job,/cancelled/i);A.equal(f.counts.read,1);A.equal(f.counts.destroy,1);});
   test(dir+' '+backend+' cleanup error rejects instead of returning ZIP',async()=>{const f=setup('cleanup');await A.rejects(api.bakeSequence(f.args),e=>e===f.cleanupError);A.equal(f.counts.destroy,1);});
   test(dir+' '+backend+' original read and cleanup errors both retained',async()=>{const f=setup('both');await A.rejects(api.bakeSequence(f.args),e=>e instanceof AggregateError&&e.errors[0]===f.readError&&e.errors[1]===f.cleanupError);A.equal(f.counts.destroy,1);});
  }
 }
}
module.exports={suite,cases,file};
if(require.main===module){const path=require('node:path'),{deflateSync}=require('node:zlib');const selected=process.argv.slice(2);const rows=selected.length?cases.filter(r=>selected.includes(r[0])):cases;if(!rows.length||selected.some(n=>!rows.some(r=>r[0]===n)))throw Error('unknown effect');suite(p=>require(path.join(__dirname,'..',p)),require('node:assert/strict'),require('node:test').test,{AbortController,deflate:async b=>new Uint8Array(deflateSync(b))},rows);}
