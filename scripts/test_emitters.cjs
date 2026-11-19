#!/usr/bin/env node
'use strict';
// FX-CORE-03 unit contract: independent emitters/layers, budgets, absolute seek.
const assert=require('node:assert/strict');
const E=require('../assets/template/src/emitter-core.js');
const doc=E.makeExplosionPreset();
assert.equal(doc.schemaVersion,1);
assert.equal(doc.enabled,false,'backwards-compatible default');
assert.equal(doc.emitters.length,2);
assert.ok(doc.emitters[0].layers.length>=7);
assert.deepEqual(E.normalize(doc),doc);
assert.deepEqual(E.deserialize(E.serialize(doc)),doc);
const ids=new Set(doc.emitters.flatMap(e=>e.layers.map(l=>l.id)));
assert.equal(ids.size,doc.emitters.reduce((n,e)=>n+e.layers.length,0));
let copy=E.deserialize(E.serialize(doc));
copy.enabled=true;
const originalSecond=JSON.stringify(copy.emitters[1]);
copy.emitters[0].x+=107;
copy.emitters[0].layers[0].x+=17;
assert.equal(JSON.stringify(copy.emitters[1]),originalSecond,'moving first emitter cannot move second');
const first=E.sample(copy,1.2),same=E.sample(copy,1.2);
assert.deepEqual(first,same,'absolute seek must be deterministic');
assert.ok(first.layers.length>0);
assert.ok(first.layers.some(l=>l.primitives.length>0),'visible layers draw actual primitives');
for(const fps of [30,60,120]){
 const t=Math.round(1.2*fps)/fps;
 assert.deepEqual(E.sample(copy,t),first,'FPS-independent exact authoring time '+fps);
}
const reversed=E.sample(copy,1.8);
assert.notDeepEqual(first,reversed,'layer visual changes over time');
for(const type of E.LAYER_TYPES){
 const item=first.layers.find(l=>l.type===type);
 assert.ok(item, 'missing actual layer '+type);
 assert.ok(item.primitives.length>0,'empty layer '+type);
 const d=E.deserialize(E.serialize(copy));d.emitters[0].layers.find(l=>l.type===type).enabled=false;
 const after=E.sample(d,1.2);
 assert.ok(!after.layers.some(l=>l.id===item.id),type+' not disabled');
 assert.ok(after.layers.some(l=>l.id!==item.id),'other layers affected by '+type);
}
const oneOff=E.deserialize(E.serialize(copy));
oneOff.emitters[0].enabled=false;
const disabled=E.sample(oneOff,1.2);
assert.ok(!disabled.layers.some(l=>l.emitterId===oneOff.emitters[0].id));
assert.ok(disabled.layers.some(l=>l.emitterId===oneOff.emitters[1].id));
assert.ok(disabled.cost<first.cost,'disabled emitter must not consume budget');
const hidden=E.deserialize(E.serialize(copy));
hidden.emitters[1].visible=false;
assert.ok(!E.sample(hidden,1.2).layers.some(l=>l.emitterId===hidden.emitters[1].id));
const bound=E.deserialize(E.serialize(copy));
bound.globalBudget=15;
assert.ok(E.sample(bound,1.2).cost<=15,'global particle cost bounded');
bound.emitters[0].budget=5;
assert.ok(E.sample(bound,1.2).layers.filter(l=>l.emitterId===bound.emitters[0].id)
  .reduce((n,l)=>n+l.cost,0)<=5,'emitter subbudget bounded');
const renamed=E.deserialize(E.serialize(copy));
renamed.emitters[0].seed=999;
const a=E.sample(renamed,1.2),b=E.sample(copy,1.2);
assert.deepEqual(a.layers.filter(l=>l.emitterId===copy.emitters[1].id),
 b.layers.filter(l=>l.emitterId===copy.emitters[1].id),'RNG of emitter 1 changed emitter 2');
const change=E.deserialize(E.serialize(copy));
change.emitters[0].layers[1].enabled=false;
assert.deepEqual(E.sample(change,1.2).layers.filter(l=>l.emitterId===copy.emitters[1].id),
 b.layers.filter(l=>l.emitterId===copy.emitters[1].id),'toggle changed unrelated RNG');
const broken=E.deserialize(E.serialize(copy));
broken.emitters[1].id=broken.emitters[0].id;
assert.throws(()=>E.normalize(broken),/duplicate|unique/i);
const bad=E.deserialize(E.serialize(copy));
bad.emitters[0].anchor={type:'bone',name:''};
assert.throws(()=>E.normalize(bad),/anchor|name/i);
const huge=E.deserialize(E.serialize(copy));
huge.emitters=Array(17).fill(0).map((_,i)=>({...copy.emitters[0],id:'e'+i}));
assert.throws(()=>E.normalize(huge),/16|maximum/i);
assert.throws(()=>E.deserialize('{"schemaVersion":5}'),/version|schema/i);
assert.throws(()=>E.deserialize('{'),/json/i);
assert.throws(()=>E.normalize({...doc,globalBudget:Infinity}),/budget|finite/i);
const relative=E.deserialize(E.serialize(copy));
relative.emitters[0].timeOffset=.6;relative.emitters[0].duration=1;
assert.ok(E.sample(relative,.2).layers.every(l=>l.emitterId!==relative.emitters[0].id),
 'time offset must defer a layer');
assert.ok(E.sample(relative,2).layers.every(l=>l.emitterId!==relative.emitters[0].id),
 'expired emitter must render nothing');
console.log('PASS FX-CORE-03 contract: ids, schema, independent motion/seed/toggle, 7 real layer types, seek, FPS, budgets');
