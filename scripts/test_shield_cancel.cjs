'use strict';
const {test}=require('node:test'),A=require('node:assert/strict'),{deflateSync}=require('node:zlib');
const B=require('../assets/magic-shield/src/shield-bake.js'),X=require('../assets/magic-shield/src/shield-export.js');
const settings={durationFrames:60,mode:'loop'},crop={x:0,y:0,width:1025,height:1};
function fixture({backend='webgl2',onInit,onLoad,onRender,onExtract,onMap}={}){
 const log=[],pixels=new Uint8Array(512*512*4);pixels.fill(255);
 class Container{constructor(){this.position={set(){}};}addChild(){}destroy(){log.push('root destroy');}}
 class GL2{getParameter(){return 4096;}}
 const buffer={async mapAsync(){log.push('map');await onMap?.();},getMappedRange(){return pixels.buffer;},unmap(){log.push('unmap');},destroy(){log.push('buffer destroy');}};
 const device={limits:{maxTextureDimension2D:4096},createBuffer(){return buffer;},createCommandEncoder(){return {copyTextureToBuffer(){},finish(){}};},queue:{submit(){}}};
 class Application{async init(){log.push('init');this.renderer={render(){log.push('render');onRender?.();},...(backend==='webgpu'?{gpu:{device},texture:{getGpuSource:()=>({format:'rgba8unorm'})}}:{gl:new GL2(),extract:{pixels(){onExtract?.();return {pixels,width:512,height:512};}}})};await onInit?.();}destroy(){log.push('app destroy');}}
 const env={PIXI:{Container,Application,RenderTexture:{create(){log.push('target');return {source:{},destroy(){log.push('target destroy');}};}}},WebGL2RenderingContext:GL2,GPUBufferUsage:{COPY_DST:1,MAP_READ:2},GPUMapMode:{READ:1},FxShieldExport:X,FxShieldAuthoring:{advance:t=>t,poseMap:v=>v},FxShieldPhysics:{pose:()=>({})},FxShockwaveSpine:{async create(){log.push('load');await onLoad?.();return {model:{},destroy(){log.push('asset destroy');}};}},FxShieldRuntime:{createShield(){log.push('fx');return {seek(){},destroy(){log.push('fx destroy');}};}}};
 const source={name:'asset.json',skeleton:{},atlas:{},images:new Map([['page.png',{}]])};
 const factory=B.sceneFactory({env,source:onLoad?source:null});
 return {log,factory,open:signal=>factory({settings,backend,crop,signal}),count:key=>log.filter(v=>v===key).length};
}
const deflate=b=>new Uint8Array(deflateSync(b));
function exportOptions(f,signal){return {settings,compile:s=>({settings:s}),backend:'webgl2',crop,frameCount:1,createScene:f.factory,signal,deflate};}
test('real packager forwards AbortSignal and timer cancellation stops WebGL after one tile',async()=>{
 const c=new AbortController();let scheduled=false,encoded=0,progress=0;
 const f=fixture({onRender(){if(!scheduled){scheduled=true;setTimeout(()=>c.abort(),0);}}});
 const opts=exportOptions(f,c.signal);opts.createScene=p=>{A.equal(p.signal,c.signal);return f.factory(p);};opts.deflate=b=>{encoded++;return deflate(b);};opts.progress=()=>progress++;
 await A.rejects(()=>X.bakeSequence(opts),/cancelled/);A.equal(f.count('render'),1);A.equal(encoded,0);A.equal(progress,0);
 for(const key of ['fx destroy','target destroy','root destroy','app destroy'])A.equal(f.count(key),1,key);
});
test('pre-aborted isolated scene allocates nothing',async()=>{const c=new AbortController();c.abort();const f=fixture();await A.rejects(()=>f.open(c.signal),/cancelled/);A.deepEqual(f.log,[]);});
test('abort during renderer initialization destroys app before creating FX',async()=>{const c=new AbortController(),f=fixture({onInit:()=>c.abort()});await A.rejects(()=>f.open(c.signal),/cancelled/);A.equal(f.count('app destroy'),1);A.equal(f.count('fx'),0);A.equal(f.count('target'),0);});
test('abort during Spine load destroys loaded asset and skips FX',async()=>{const c=new AbortController(),f=fixture({onLoad:()=>c.abort()});await A.rejects(()=>f.open(c.signal),/cancelled/);for(const key of ['asset destroy','root destroy','app destroy'])A.equal(f.count(key),1,key);A.equal(f.count('fx'),0);});
test('abort during WebGPU mapping unmaps before cleanup and prevents next tile',async()=>{const c=new AbortController(),f=fixture({backend:'webgpu',onMap:async()=>{await new Promise(r=>setTimeout(r,0));c.abort();}});const s=await f.open(c.signal);try{await A.rejects(()=>s.readFrame(0),/cancelled/);A.equal(f.count('map'),1);A.equal(f.count('unmap'),1);A.equal(f.count('render'),1);}finally{s.destroy();}A.equal(f.count('buffer destroy'),1);A.ok(f.log.indexOf('unmap')<f.log.indexOf('buffer destroy'));});
test('abort during synchronous readback releases read lock without further renders',async()=>{const c=new AbortController(),f=fixture({onExtract:()=>c.abort()}),s=await f.open(c.signal);try{await A.rejects(()=>s.readFrame(0),/cancelled/);await A.rejects(()=>s.readFrame(0),/cancelled/);A.equal(f.count('render'),1);}finally{s.destroy();s.destroy();}A.equal(f.count('app destroy'),1);});
test('non-aborted signal preserves complete deterministic PNG archive bytes',async()=>{const a=fixture(),b=fixture(),c=new AbortController();const x=await X.bakeSequence(exportOptions(a)),y=await X.bakeSequence(exportOptions(b,c.signal));A.deepEqual(x,y);A.equal(a.count('render'),3);A.equal(b.count('render'),3);A.equal(b.count('app destroy'),1);});
test('isolated WebGL scene yields to cancellation between tiles',async()=>{const c=new AbortController();let scheduled=false;const f=fixture({onRender(){if(!scheduled){scheduled=true;setTimeout(()=>c.abort(),0);}}}),s=await f.open(c.signal);try{await A.rejects(()=>s.readFrame(0),/cancelled/);A.equal(f.count('render'),1);}finally{s.destroy();}A.equal(f.count('app destroy'),1);});
