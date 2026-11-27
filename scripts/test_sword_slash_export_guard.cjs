'use strict';
const {test}=require('node:test'),A=require('node:assert/strict');
const E=require('../assets/sword-slash/src/sword-slash-export.js'),B=require('../assets/sword-slash/src/sword-slash-bake.js');
const preset=()=>({schemaVersion:1,effect:{exportFrames:40,seed:17,curve:{keys:[{x:0,y:1},{x:1,y:0}]}},anchors:{main:{type:'bone',name:'hand'}}});
const copy=x=>JSON.parse(JSON.stringify(x));
function fixture(mutate){
 const state={reads:0,encodes:0,zips:0,destroyed:0},settings=preset();
 return {state,params:{settings,frameCount:1,backend:'webgl2',crop:{x:0,y:0,width:1,height:1},codec:{cropSpec:c=>({...c}),async encodePng(){state.encodes++;return new Uint8Array(4);},makeZip(e){state.zips++;return e;}},async createScene({settings,backend}){
  return {settings:mutate(copy(settings)),backend,maxTextureSize:4096,async readFrame(){state.reads++;return {width:1,height:1,alpha:'premultiplied',pixels:new Uint8Array(4)};},destroy(){state.destroyed++;}};
 }}};
}
for(const [name,mutate] of [
 ['seed',s=>{s.effect.seed++;return s;}],
 ['curve',s=>{s.effect.curve.keys[0].y=.5;return s;}],
 ['anchor',s=>{s.anchors.main.name='hip';return s;}],
 ['missing field',s=>{delete s.anchors;return s;}],
 ['extra field',s=>({...s,extra:true})],
 ['array order',s=>{s.effect.curve.keys.reverse();return s;}]
])test('reject changed '+name+' before reading or encoding',async()=>{const f=fixture(mutate);await A.rejects(E.bakeSequence(f.params),/scene settings mismatch/);A.deepEqual(f.state,{reads:0,encodes:0,zips:0,destroyed:1});});
test('equivalent JSON with different property order is accepted',async()=>{const f=fixture(s=>({anchors:s.anchors,effect:{curve:s.effect.curve,seed:s.effect.seed,exportFrames:s.effect.exportFrames},schemaVersion:s.schemaVersion}));const r=await E.bakeSequence(f.params);A.deepEqual(r.manifest.settings,f.params.settings);A.deepEqual(f.state,{reads:1,encodes:1,zips:1,destroyed:1});});
function environment(onRender=()=>{}){
 const state={renders:[],dead:[],world:null};let current;
 class Container{constructor(){this.position={set:(x,y)=>{this.x=x;this.y=y;}};}addChild(...c){for(const m of c)m.parent=this;}destroy(){state.dead.push('world');}}
 class Application{async init(){this.renderer={gl:{MAX_TEXTURE_SIZE:1,getParameter:()=>4096},render({container}){current=container;state.renders.push([container.x,container.y]);onRender(state.renders.length);},extract:{pixels(){const p=new Uint8Array(512*512*4);for(let y=0;y<512;y++)for(let x=0;x<512;x++){const i=(y*512+x)*4;p[i]=(x-current.x)&255;p[i+1]=(y-current.y)&255;p[i+3]=255;}return {width:512,height:512,pixels:p};}}};}destroy(){state.dead.push('app');}}
 const env={PIXI:{Application,Container,RenderTexture:{create:()=>({destroy(){state.dead.push('target');}})}},FxSwordSlashHistory:{createCompiler(o){state.world=o.world;return settings=>({settings});}},FxSwordSlashRuntime:{createRenderer:({compile,settings})=>({settings:compile(settings).settings,seek(){},destroy(){state.dead.push('fx');}})},FxShockwaveSpine:{},FxSwordSlashPose:{pose(){}},FxShieldExport:{cropSpec:c=>({...c})}};return {env,state};
}
const crop={x:-1,y:511,width:3,height:2};
test('timer cancellation stops synchronous WebGL between tiles and cleans resources',async()=>{
 const ac=new AbortController(),{env,state}=environment(n=>{if(n===1)setTimeout(()=>ac.abort(),0);});
 const s=await B.sceneFactory({env})({settings:preset(),backend:'webgl1',crop,signal:ac.signal});
 try{await A.rejects(s.readFrame(.2),/cancelled/);A.equal(state.renders.length,1);A.equal(state.world.x,0);A.equal(state.world.y,0);}finally{s.destroy();}
 A.deepEqual(state.dead,['fx','target','world','app']);
});
test('uncancelled tiling keeps exact pixels with and without signal',async()=>{
 const expected=[255,255,0,255,0,255,0,255,1,255,0,255,255,0,0,255,0,0,0,255,1,0,0,255];
 for(const signal of [undefined,new AbortController().signal]){const {env,state}=environment(),s=await B.sceneFactory({env})({settings:preset(),backend:'webgl1',crop,signal});try{const f=await s.readFrame(.2);A.deepEqual([...f.pixels],expected);A.equal(state.renders.length,4);A.equal(state.world.x,0);A.equal(state.world.y,0);}finally{s.destroy();}}
});
