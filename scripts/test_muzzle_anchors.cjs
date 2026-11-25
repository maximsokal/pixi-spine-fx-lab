'use strict';
const {test}=require('node:test'),A=require('node:assert/strict');
const M=require('../assets/muzzle-flash/src/muzzle-anchors.js');
const near=(a,b)=>A.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
function plane(x=0,y=0,s=1){return {x,y,s,toLocal(p,from){return {x:(from.x+p.x*from.s-x)/s,y:(from.y+p.y*from.s-y)/s};}};}
const host=plane(100,200,2),world=plane(100,200,2);
const bone={active:true,worldX:10,worldY:20,a:0,b:-2,c:3,d:0};
const slot={bone,getAttachment:()=>slot.att};
const model={...plane(120,240,2),skeleton:{findBone:n=>n==='weapon'?bone:null,findSlot:n=>n==='weaponSlot'?slot:null}};
const ctx={host,world,model},a=(extra={})=>({...M.defaults().core,...extra});
const local=(extra={})=>a({type:'bone',space:'local',name:'weapon',x:2,y:4,...extra});
test('world coordinate is unaffected by shared preview camera',()=>{
 A.deepEqual(M.resolve(a(),ctx),{x:256,y:256,rotation:0});
 A.deepEqual(M.resolve(a(),{host:plane(1000,-500,4),world:plane(1000,-500,4)}),{x:256,y:256,rotation:0});
});
test('bone basis rotates and scales local offsets; world offset is independent',()=>{
 const p=M.resolve(local(),ctx);near(p.x,12);near(p.y,46);near(p.rotation,90);
 const q=M.resolve(local({space:'world'}),ctx);near(q.x,22);near(q.y,44);near(q.rotation,90);
});
test('reflected bone axis and host scale preserve direction',()=>{
 const b={...bone,a:-2,c:0},m={...model,skeleton:{...model.skeleton,findBone:()=>b}};
 const p=M.resolve(local({x:0,y:0}),{...ctx,model:m});near(Math.abs(p.rotation),180);
});
test('region uses full vertex bounds and local rotation',()=>{
 slot.att={name:'muzzle',rotation:90,computeWorldVertices(s,v,o,stride){A.equal(s,slot);A.equal(stride,2);v.set([0,0,10,0,10,8,0,8],o);}};
 const p=M.resolve(local({type:'attachment',slot:'weaponSlot',name:'muzzle',x:0,y:0}),ctx);
 near(p.x,15);near(p.y,24);near(Math.abs(p.rotation),180);
});
test('mesh beyond 512 values includes final vertex; no silent truncation',()=>{
 slot.att={name:'mesh',worldVerticesLength:520,computeWorldVertices(s,start,n,v){A.equal(n,520);v.fill(0);v[518]=100;v[519]=60;}};
 const p=M.resolve(local({type:'attachment',slot:'weaponSlot',name:'mesh',x:0,y:0}),ctx);
 near(p.x,60);near(p.y,50);near(p.rotation,90);
});
test('point attachment keeps explicit orientation',()=>{
 slot.att={name:'point',rotation:90,computeWorldPosition:(b,p)=>Object.assign(p,{x:4,y:5}),computeWorldRotation:()=>180};
 const p=M.resolve(local({type:'attachment',slot:'weaponSlot',name:'point',x:0,y:0}),ctx);near(p.x,14);near(p.y,25);near(Math.abs(p.rotation),180);
});
test('missing, invalid or oversized attachment and degenerate bone hide',()=>{
 A.equal(M.resolve(local({name:'absent'}),ctx),null);
 slot.att={name:'mesh',worldVerticesLength:65538,computeWorldVertices(){throw Error('must not call');}};
 A.equal(M.resolve(local({type:'attachment',slot:'weaponSlot',name:'mesh'}),ctx),null);
 slot.att={name:'mesh',worldVerticesLength:8,computeWorldVertices(){}};
 A.equal(M.resolve(local({type:'attachment',slot:'weaponSlot',name:'mesh'}),ctx),null);
 A.equal(M.resolve(local(),{...ctx,model:{...model,skeleton:{findBone:()=>({...bone,a:0,c:0})}}}),null);
});
test('per-layer sampling hides only missing layer and reuses identical poses',()=>{
 let calls=0;const p={x:1,y:2,rotation:3};const plan={sample(t,p){calls++;return {core:[p.x],tongues:[p.y],sparks:[p.rotation]};}};
 A.deepEqual(M.sampleLayers(plan,0,{core:p,tongues:null,sparks:{...p}}),{core:[1],tongues:[],sparks:[3]});A.equal(calls,1);
});
test('compiled adapter snapshots anchors, updates animated bone, and rejects invalid config',()=>{
 const compile=effect=>({settings:effect,sample(t,p){return {core:[p],tongues:[p],sparks:[p]};}});
 const anchors=M.defaults();anchors.core=local();anchors.tongues=local({name:'missing'});
 const make=M.createCompiler({...ctx,compile}),plan=make({effect:{},anchors});
 anchors.core.x=999;const f=plan.sample(0);A.equal(f.tongues.length,0);near(f.core[0].x,12);near(f.sparks[0].x,256);
 bone.worldX+=5;try{near(plan.sample(.1).core[0].x,17);}finally{bone.worldX-=5;}
 A.ok(Object.isFrozen(plan.settings.anchors.core));A.throws(()=>make({effect:{},anchors:{core:anchors.core}}));A.throws(()=>plan.sample(-1));
});
