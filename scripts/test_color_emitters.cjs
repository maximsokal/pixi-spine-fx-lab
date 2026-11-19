#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),E=require('../assets/template/src/emitter-core.js');
const Colors=require('../assets/template/src/color-core.js');
const doc=E.makeExplosionPreset();doc.enabled=true;
const base=E.sample(doc,1.2),before=base.layers.find(x=>x.type==='glow'&&x.emitterId==='emitter1');
assert.ok(before);
const pristine=E.deserialize(E.serialize(doc));
const own=doc.emitters[0].layers.find(l=>l.type==='glow');
const life=Colors.defaultLifetime('#ff00ff');
life.enabled=true;
life.colorOverLife.stops=[{id:'single',position:.5,rgba:[255,0,255,.5]}];
life.alphaOverLife.keys.forEach(k=>k.y=1);
life.opacityOverLife.keys.forEach(k=>k.y=1);
life.sizeOverLife.keys.forEach(k=>k.y=2);
life.glowOverLife.keys.forEach(k=>k.y=1.5);
own.lifetime=life;
const transformed=E.sample(doc,1.2);
const after=transformed.layers.find(x=>x.id===before.id);
assert.equal(after.primitives[0].color,'#ff00ff');
assert.ok(Math.abs(after.primitives[0].alpha-.5)<1e-8);
assert.ok(Math.abs(after.primitives[0].radius-before.primitives[0].radius*3)<1e-8);
assert.deepEqual(transformed.layers.filter(l=>l.emitterId==='emitter2'),
  base.layers.filter(l=>l.emitterId==='emitter2'),'other emitter independent of color-over-life');
assert.deepEqual(E.sample(doc,1.2),transformed,'absolute-time seek is deterministic');
for(const fps of [30,60,120])assert.deepEqual(E.sample(doc,Math.round(1.2*fps)/fps),transformed);
const round=E.deserialize(E.serialize(doc));assert.deepEqual(round,doc);
const disabled=JSON.parse(JSON.stringify(doc));
disabled.emitters[0].layers[0].lifetime.enabled=false;
const legacy=E.sample(disabled,1.2);
assert.deepEqual(legacy.layers.find(l=>l.id===before.id).primitives,
 E.sample(pristine,1.2).layers.find(l=>l.id===before.id).primitives,'disabled lifetime retains legacy math');
const gone=E.deserialize(E.serialize(doc));
gone.emitters[0].layers[0].lifetime.sizeOverLife.keys.forEach(k=>k.y=0);
assert.equal(E.sample(gone,1.2).layers.find(l=>l.id===before.id).primitives[0].alpha,0);
const bad=E.deserialize(E.serialize(doc));
bad.emitters[0].layers[0].lifetime.colorOverLife.stops[0].position=-.2;
assert.throws(()=>E.normalize(bad),/position/);
console.log('PASS FX-CORE-04 emitter integration: RGBA, alpha, size, glow, disabled fallback, independence, seek, FPS and strict JSON');
