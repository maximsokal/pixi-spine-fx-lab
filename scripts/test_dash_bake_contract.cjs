'use strict';
const {test}=require('node:test'),A=require('node:assert/strict');
const B=require('../assets/teleport-dash/src/dash-bake.js'),L=require('../assets/teleport-dash/src/dash-core.js');
function fixture({backend='webgl2',format='bgra8unorm',failInit=false,failTarget=false,failRead=false,max=512}={}){
 const state={apps:[],roots:[],assets:[],effects:[],targets:[],buffers:[],commands:[],events:[],disposal:[]};
 class GL2{constructor(){this.MAX_TEXTURE_SIZE=123;}getParameter(){return max;}}
 class Container{constructor(){this.children=[];this.position={set:(x,y)=>{this.xy=[x,y]}};state.roots.push(this)}addChild(x){this.children.push(x)}destroy(){this.destroyed=true}}
 const data=new Uint8Array(512*512*4);data.set([16,32,64,128,1,2,3,0],0);data.set([4,8,12,64,50,60,70,255],512*4);const tiny=new Uint8Array(512);tiny.set(data.subarray(0,8),0);tiny.set(data.subarray(512*4,512*4+8),256);
 const device={limits:{maxTextureDimension2D:max},createBuffer(o){const b={opts:o,unmaps:0,destroys:0,async mapAsync(){if(failRead)throw Error('map failure')},getMappedRange(){return (o.size===512?tiny:data).buffer},unmap(){this.unmaps++},destroy(){this.destroys++}};state.buffers.push(b);return b},
 createCommandEncoder(){return {copyTextureToBuffer(a,b,c){state.commands.push({a,b,c})},finish(){return {}}}},queue:{submit(){}}};
 class Application{
  constructor(){state.apps.push(this)}
  async init(o){if(failInit)throw Error('init failure');this.opts=o;this.renderer={gl:backend==='webgpu'?null:backend==='webgl2'?new GL2():{MAX_TEXTURE_SIZE:1,getParameter:()=>max},gpu:{device},texture:{getGpuSource:()=>({format})},render:o=>{state.events.push(['render',o.container.xy,o.clearColor])},extract:{pixels:()=>{const pixels=new Uint8Array(512*512*4);pixels.set([64,32,16,128]);return {width:512,height:512,pixels}}}}}
  destroy(){this.destroyed=true}
 }
 const env={PIXI:{Application,Container,RenderTexture:{create(o){if(failTarget)throw Error('target failure');const t={opts:o,source:{},destroy(){this.destroyed=true}};state.targets.push(t);return t}}},WebGL2RenderingContext:GL2,GPUBufferUsage:{COPY_DST:1,MAP_READ:2},GPUMapMode:{READ:1},
 FxDashSpine:{async create(s,env,selection){const a={source:s,selection,model:{},checkReplay(times,o){state.preflight={times,options:o};if(times[0]*o.speed>60)throw Error('replay budget');},poseAt(t,o){state.events.push(['pose',t,o.speed]);return {hand:{x:t,y:2,scale:1,rotation:0}}},destroy(){this.destroyed=true;state.disposal.push('asset')}};state.assets.push(a);return a}},
 FxDashRuntime:{createDash({host,settings,asset,poseOptions}){const p=L.compile(settings),f={asset,poseOptions,seek(t){state.events.push(['fx',t]);return p.sample(t)},destroy(){this.destroyed=true;state.disposal.push('fx')}};state.effects.push(f);return f}}};
 return {env,state};
}
const crop={x:0,y:0,width:2,height:2},opts=backend=>({settings:L.defaults(),backend,crop});
test('WebGL PMA, crop root, immutable source/pose, pose before FX and teardown',async()=>{
 const {env,state}=fixture(),source={name:'hero.json',skeleton:{},atlas:{},images:new Map([['a.png',{}]])},poseOptions={speed:2};
 const factory=B.sceneFactory({source,poseOptions,env});source.images.clear();poseOptions.speed=9;
 const scene=await factory(opts('webgl2'));A.equal(scene.backend,'webgl2');A.equal(scene.maxTextureSize,512);A.equal(state.assets[0].source.images.size,1);
 const f=await scene.readFrame(.25);A.equal(f.alpha,'premultiplied');A.deepEqual(Array.from(f.pixels.slice(0,4)),[64,32,16,128]);
 A.deepEqual(state.events,[['pose',.25,2],['fx',.25],['render',[-0,-0],[0,0,0,0]]]);
 scene.destroy();scene.destroy();for(const k of ['apps','roots','assets','effects','targets'])A.ok(state[k].some(x=>x.destroyed));
 await A.rejects(()=>scene.readFrame(0),/unavailable/);
});
test('GPU padded rows, BGRA swizzle, one alpha conversion and unmap',async()=>{
 const {env,state}=fixture({backend:'webgpu'}),s=await B.sceneFactory({env})(opts('webgpu')),f=await s.readFrame(0);
 A.equal(f.alpha,'straight');A.deepEqual(Array.from(f.pixels),[128,64,32,128,0,0,0,0,48,32,16,64,70,60,50,255]);
 A.equal(state.commands[0].b.bytesPerRow,2048);A.equal(state.buffers[0].opts.size,512*512*4);A.equal(state.buffers[0].unmaps,1);
 await s.readFrame(.25);A.equal(state.buffers.length,1);A.equal(state.buffers[0].unmaps,2);s.destroy();A.equal(state.buffers[0].destroys,1);
});
test('RGBA GPU format and error cleanup',async()=>{
 const {env,state}=fixture({backend:'webgpu',format:'rgba8unorm'}),s=await B.sceneFactory({env})(opts('webgpu'));
 A.deepEqual(Array.from((await s.readFrame(0)).pixels.slice(0,4)),[32,64,128,128]);s.destroy();
 for(const v of [{backend:'webgpu',format:'rgba16float'},{backend:'webgpu',failRead:true}]){
  const {env,state}=fixture(v),s=await B.sceneFactory({env})(opts('webgpu'));await A.rejects(()=>s.readFrame(0));s.destroy();A.equal(state.buffers[0].destroys,1);A.equal(state.buffers[0].unmaps,0);
 }
});
test('backend mismatch, limit and allocation failure reject and dispose',async()=>{
 for(const v of [{backend:'webgl1'},{max:1},{failTarget:true}]){
  const {env,state}=fixture(v);await A.rejects(()=>B.sceneFactory({env})(opts('webgl2')));A.ok(state.apps[0].destroyed);A.ok(state.effects.every(x=>x.destroyed));
 }
});

test('world-aligned tiles retain overlap and handle negative crop and tile boundaries',async()=>{
 const {env,state}=fixture();const factory=B.sceneFactory({env});
 const scene=await factory({...opts('webgl2'),crop:{x:-1,y:-1,width:3,height:3}});
 const f=await scene.readFrame(0);A.equal(f.width,3);A.equal(f.height,3);
 A.deepEqual(Array.from(f.pixels.slice(16,20)),[64,32,16,128]);
 A.deepEqual(state.events.filter(e=>e[0]==='render').map(e=>e[1]),[[512,512],[-0,512],[512,-0],[-0,-0]]);
 A.equal(state.targets.length,1);scene.destroy();
});
test('GPU reader retains 256-byte padding for a nonaligned width',async()=>{
 const {env,state}=fixture({backend:'webgpu'});const app=new env.PIXI.Application();await app.init({});
 const r=B.gpuReader(app.renderer,{source:{}},2,2,env);const f=await r.read();
 A.deepEqual(Array.from(f),[128,64,32,128,0,0,0,0,48,32,16,64,70,60,50,255]);
 A.equal(state.commands[0].b.bytesPerRow,256);r.destroy();app.destroy();
});

test('historical owner is shared only within isolated scene; selected skin and full bake range preflight',async()=>{
 const {env,state}=fixture(),source={name:'hero.json',skeleton:{},atlas:{},images:new Map([['a.png',{}]])},poseOptions={speed:2,skin:'alternate',visible:false};
 const factory=B.sceneFactory({env,source,poseOptions}),s=await factory({...opts('webgl2'),frameCount:31});
 A.deepEqual(state.assets[0].selection,{skin:'alternate'});A.equal(state.effects[0].asset,state.assets[0]);A.equal(state.effects[0].poseOptions.visible,false);A.deepEqual(state.preflight.times,[.5]);A.equal(state.preflight.options.speed,2);
 await s.readFrame(.5);s.destroy();A.deepEqual(state.disposal,['fx','asset']);
 const f=fixture();await A.rejects(()=>B.sceneFactory({env:f.env,source,poseOptions})( {...opts('webgl2'),frameCount:3600}),/budget/);A.ok(f.state.apps[0].destroyed);A.ok(f.state.assets[0].destroyed);A.equal(f.state.effects.length,0);
});
