'use strict';
const {test}=require('node:test'),A=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../assets/loot-sparkle/src'),editor=fs.readFileSync(path.join(root,'loot-editor.js'),'utf8'),html=fs.readFileSync(path.join(root,'ui.html'),'utf8');
function fixture({playing=true,fail=false}={}){
 const nodes=new Map();for(const m of html.matchAll(/id="([^"]+)"/g))nodes.set(m[1],{value:'',textContent:'',validity:{valid:true}});
 const $=id=>{if(!nodes.has(id))throw Error('Missing control '+id);return nodes.get(id)};
 const start=editor.indexOf(' let bakeController=null;'),end=editor.indexOf(' function seek(t){',start);
 A.ok(start>=0&&end>start);
 const state={playing,direction:-1,time:.25,locks:[],calls:[],messages:[],paused:0};
 const config={durationFrames:40,seed:17},transport={get state(){return {playing:state.playing,direction:state.direction,time:state.time}},play(d){state.playing=true;state.direction=d}};
 class Controller{constructor(){this.signal={aborted:false}}abort(){this.signal.aborted=true}}
 const FxLootBake={sceneFactory(o){state.factory=o;return ()=>{}}},FxLootExport={async bakeSequence(o){state.calls.push(o);await Promise.resolve();if(o.signal.aborted)throw Error('cancelled');if(fail)throw Error('injected');o.progress(40,40);return {zip:Uint8Array.of(1),manifest:{count:40}}}};
 const body='let busy=false,fx={},backend="webgl2",cfg=config,source={name:"hero.json"},lastTime=5;const clone=o=>JSON.parse(JSON.stringify(o)),spineOptions=()=>({animation:"walk",speed:2});const pause=()=>{state.paused++;state.playing=false},lock=v=>{busy=v;state.locks.push(v)};const status=(m,e)=>state.messages.push([m,e]);'+editor.slice(start,end)+'return {bakePng,cancelBake,get busy(){return busy}};';
 const api=new Function('$','config','transport','state','FxLootBake','FxLootExport','AbortController',body)($,config,transport,state,FxLootBake,FxLootExport,Controller);
 return {api,state,$,config};
}
test('export freezes options, restores playing direction, never changes preview time',async()=>{
 const {api,state,$,config}=fixture(),p=api.bakePng({download:false,crop:{x:0,y:0,width:512,height:512}});
 config.seed=99;A.equal(api.busy,true);await A.rejects(()=>api.bakePng({download:false}),/busy/);
 A.equal((await p).manifest.count,40);A.equal(state.calls[0].settings.seed,17);A.equal(state.factory.source.name,'hero.json');A.equal(state.factory.poseOptions.speed,2);A.equal(state.time,.25);A.equal(state.direction,-1);A.equal(state.playing,true);A.deepEqual(state.locks,[true,false]);A.equal($('cancelBake').disabled,true);A.equal($('bakeProgress').value,40);
});
test('cancel and failure release lock and preserve paused or playing transport',async()=>{
 for(const fail of [false,true]){const {api,state,$}=fixture({playing:fail,fail});const p=api.bakePng({download:false});if(!fail)api.cancelBake();await A.rejects(()=>p,fail?/injected/:/cancelled/);A.equal(api.busy,false);A.equal(state.playing,fail);A.equal(state.time,.25);A.equal($('cancelBake').disabled,true);}
});
