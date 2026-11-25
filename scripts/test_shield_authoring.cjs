'use strict';
const {test}=require('node:test'),A=require('node:assert/strict');
const U=require('../assets/magic-shield/src/shield-authoring.js');
const tx=(x=0,y=0,rotation=0,scale=1,anchor={type:'world',name:''})=>({x,y,rotation,scale,anchor});
test('loop and one-shot timeline have distinct endpoints',()=>{
 A.equal(U.lastFrame({mode:'loop',durationFrames:60}),59);A.equal(U.lastFrame({mode:'oneShot',durationFrames:40}),39);
 A.equal(U.advance(59/60,1/60,{mode:'loop',durationFrames:60}),0);
 A.equal(U.advance(0,-1/60,{mode:'loop',durationFrames:60}),59/60);
 A.equal(U.advance(0,10,{mode:'oneShot',durationFrames:40}),39/60);
});
test('world position and inverse drag preserve inherited rotation and scale',()=>{
 const e=tx(100,150,90,2),l=tx(3,4,0,1,{type:'inherit',name:''});
 const p=U.resolve(e,l,{});A.ok(Math.abs(p.x-92)<1e-9);A.ok(Math.abs(p.y-156)<1e-9);
 const d=U.dragPosition(e,l,{},80,170);A.ok(Math.abs(d.x-10)<1e-9);A.ok(Math.abs(d.y-10)<1e-9);
});
test('missing bone disables inherited handles, world layer stays movable',()=>{
 const e=tx(0,0,0,1,{type:'bone',name:'hip'}),l=tx();
 A.equal(U.resolve(e,null,{}),null);A.equal(U.resolve(e,tx(0,0,0,1,{type:'inherit',name:''}),{}),null);
 A.deepEqual(U.dragPosition(e,l,{},42,16),{x:42,y:16});
 A.equal(U.dragPosition(e,null,{},42,16),null);
});
test('Spine map conversion preserves local anchor and hostile bone names',()=>{
 const p={x:1,y:2,rotation:30,scale:2};const m=Object.fromEntries([['$local',p],['__proto__',p],['hip',p]]);
 const out=U.poseMap(m);A.deepEqual(out.local,p);A.ok(Object.hasOwn(out.bones,'__proto__'));A.equal(Object.getPrototypeOf(out.bones),null);A.ok(!Object.hasOwn(out.bones,'$local'));
});
test('hit insertion is ordered, unique and excludes loop endpoint',()=>{
 const h=[{id:'hit1',frame:10},{id:'hit2',frame:40}];A.deepEqual(U.insertHit(h,20,60),[{id:'hit1',frame:10},{id:'hit3',frame:20},{id:'hit2',frame:40}]);
 A.throws(()=>U.insertHit(h,10,60),/already/);A.throws(()=>U.insertHit(h,60,60),/frame/);A.equal(h.length,2);
});
test('source collection rejects ambiguous skeleton and texture names',()=>{
 const f=n=>({name:n});const s=U.collectSource([f('a.json'),f('a.atlas'),f('page.png')]);A.equal(s.name,'a.json');A.equal(s.images.size,1);
 A.throws(()=>U.collectSource([f('a.json'),f('b.skel'),f('a.atlas'),f('page.png')]),/exactly/);
 A.throws(()=>U.collectSource([f('a.json'),f('a.atlas'),f('page.png'),f('page.png')]),/duplicate/);
});
