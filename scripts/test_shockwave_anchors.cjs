'use strict';
const {test}=require('node:test'),A=require('node:assert/strict'),S=require('../assets/shockwave/src/shockwave-core.js');
const near=(a,b)=>A.ok(Math.abs(a-b)<1e-8,a+' != '+b);
const pose={x:100,y:120,rotation:90,scale:2};
test('legacy presets default to emitter world and layer inherit',()=>{
 const c=S.defaults();for(const e of c.emitters){delete e.anchor;for(const l of Object.values(e.layers))delete l.anchor}
 const n=S.normalize(c);A.deepEqual(n.emitters[0].anchor,{type:'world',name:''});
 A.deepEqual(n.emitters[0].layers.primary.anchor,{type:'inherit',name:''});
});
test('world/local/bone anchors are independently composed in host coordinates',()=>{
 const c=S.defaults(),e=c.emitters[0];e.x=10;e.y=5;e.rotation=30;e.anchor={type:'bone',name:'hip'};
 e.layers.primary.x=6;e.layers.primary.rotation=10;e.layers.secondary.anchor={type:'world',name:''};e.layers.secondary.x=200;e.layers.secondary.y=190;c.ringCount=2;
 e.layers.particles.enabled=true;e.layers.particles.anchor={type:'local',name:''};e.layers.particles.x=3;
 const row=S.createPlan(c).sample(.25,{$local:{x:30,y:40,rotation:0,scale:.5},hip:pose}).emitters[0];
 near(row.resolved.primary.x,90-6);near(row.resolved.primary.y,140+6*Math.sqrt(3));near(row.resolved.primary.rotation,130);near(row.resolved.primary.scale,2);
 A.deepEqual(row.resolved.secondary,{x:200,y:190,rotation:0,scale:1});near(row.resolved.particles.x,31.5);near(row.resolved.particles.scale,.5);
 A.ok(row.layers.primary.length&&row.layers.secondary.length&&row.layers.particles.length);
});
test('missing, inherited, malformed and inherited prototype keys do not leak layers',()=>{
 const c=S.defaults(),e=c.emitters[0];e.anchor={type:'bone',name:'hip'};c.ringCount=2;e.layers.secondary.anchor={type:'world',name:''};
 const p=S.createPlan(c),a=p.sample(.25,Object.create({hip:pose}));A.equal(a.emitters[0].layers.primary.length,0);A.ok(a.emitters[0].layers.secondary.length);
 A.ok(a.diagnostics.some(d=>d.layer==='primary'&&d.reason==='missing anchor'));
 const b=p.sample(.25,{hip:{...pose,scale:0}});A.deepEqual(a,b);
 A.ok(p.sample(.25,{hip:pose}).emitters[0].layers.primary.length);
 A.deepEqual(p.sample(.25,{hip:pose}),p.sample(.25,{hip:pose}));
});
test('strict anchor schema rejects invalid types, empty names and extra fields',()=>{
 for(const a of [null,{type:'inherit',name:''},{type:'bone',name:''},{type:'world',name:'hip'},{type:'bone',name:'hip',extra:1}]){
  const c=S.defaults();c.emitters[0].anchor=a;A.throws(()=>S.normalize(c),/anchor/);
 }
});
