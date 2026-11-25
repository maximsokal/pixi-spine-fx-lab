'use strict';
const {test}=require('node:test'),A=require('node:assert/strict');
const S=require('../assets/muzzle-flash/src/muzzle-smoke.js'),anchors=require('../assets/muzzle-flash/src/muzzle-anchors.js');
// Injected gradient test double; real shared FxColors integration is separately tested.
const colors={normalize:v=>structuredClone(v),sample(v,t){const a=v.stops.findLast(s=>s.position<=t),b=v.stops.find(s=>s.position>t)||a;return a.rgba.map((x,i)=>a===b?x:x+(b.rgba[i]-x)*(t-a.position)/(b.position-a.position));}};
const pose={x:100,y:200,rotation:0};const cfg=()=>({...S.defaults(),enabled:true});
const near=(a,b)=>A.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
test('disabled default, delayed births, transparent end and zero count',()=>{
 A.deepEqual(S.compile(S.defaults(),colors).sample(.15,pose),[]);const p=S.compile(cfg(),colors);
 A.deepEqual(p.sample(0,pose),[]);A.ok(p.sample(.15,pose).length>0);A.deepEqual(p.sample(39/60,pose),[]);
 A.deepEqual(S.compile({...cfg(),count:0},colors).sample(.15,pose),[]);
});
test('deterministic seek, count budget and independent seed',()=>{
 const p=S.compile({...cfg(),count:16},colors),a=p.sample(.15,pose);A.equal(a.length,16);p.sample(.1,pose);A.deepEqual(p.sample(.15,pose),a);
 const b=S.compile({...cfg(),count:16,seed:123},colors).sample(.15,pose);A.notDeepEqual(a,b);A.ok(Object.isFrozen(p.events));
});
test('rotated anchor and local offset, movement and growth',()=>{
 const p=S.compile({...cfg(),x:10,y:4,count:1},colors),a=p.sample(.12,pose)[0],b=p.sample(.12,{...pose,rotation:90})[0];
 near(b.x-100,-(a.y-200));near(b.y-200,a.x-100);A.ok(p.sample(.2,pose)[0].radius>a.radius);
});
test('editable gradient and opacity without hidden fade multiplier',()=>{
 const d=cfg();d.palette.stops.forEach(s=>s.rgba=[20,30,40,.8]);d.opacity=.5;const p=S.compile(d,colors).sample(.15,pose);A.deepEqual(p[0].rgba,[20,30,40,.4]);
});
test('reject malformed settings, palette and bounds',()=>{
 for(const edit of [d=>d.count=17,d=>d.seed=1.5,d=>d.lifeFrames=0,d=>d.extra=1,d=>d.enabled=1,d=>delete d.palette.stops[0].rgba[0],d=>d.palette.domain='effectTime']){const d=cfg();edit(d);A.throws(()=>S.compile(d,colors));}
});
const plane={toLocal:p=>({...p})};
function make(){return S.createCompiler({anchors,colors,host:plane,world:plane,compileEffect:effect=>({settings:effect,sample(t,p){return {core:[p],tongues:[p],sparks:[p]};}})});}
test('legacy preset migration keeps smoke disabled and normal blend',()=>{
 const p=make()({effect:{},anchors:anchors.defaults()});A.equal(p.settings.smoke.enabled,false);A.deepEqual(p.sample(.15).smoke,[]);A.equal(p.sample(.15).core[0].blend,'normal');A.ok(Object.isFrozen(p.settings));
});
test('independent blend, missing smoke anchor and unchanged base layers',()=>{
 const build=make(),base=build({effect:{},anchors:anchors.defaults()}),d=structuredClone(base.settings);d.smoke.enabled=true;d.blends.sparks='add';
 let p=build(d),a=p.sample(.15);A.ok(a.smoke.length>0);A.equal(a.sparks[0].blend,'add');A.deepEqual(a.core,base.sample(.15).core);A.deepEqual(a.tongues,base.sample(.15).tongues);
 d.smokeAnchor={...d.smokeAnchor,type:'bone',space:'local',name:'absent'};p=build(d);A.deepEqual(p.sample(.15).smoke,[]);A.deepEqual(p.sample(.15).core,a.core);d.blends.core='unknown';A.throws(()=>build(d));
});
