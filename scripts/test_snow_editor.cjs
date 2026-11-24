'use strict';
const assert=require('node:assert/strict');
const {test}=require('node:test');
const Snow=require('../assets/snowfall/src/snow-core.js');
const UI=()=>require('../assets/snowfall/src/snow-editor.js');
const Ex=()=>require('../assets/snowfall/src/snow-export.js');
test('session edits are validated atomically, with no configuration on seek',()=>{
 let configs=0,seeks=0;
 const s=UI().createSession(Snow.defaults(),{configure(){configs++},seek(){seeks++}});
 s.edit(c=>c.windDrift=36);assert.equal(s.settings.windDrift,36);assert.equal(configs,1);
 s.seek(.25);s.seek(.5);assert.equal(configs,1);assert.equal(seeks,2);
 const old=s.settings;assert.throws(()=>s.edit(c=>c.fallSpeed=0),/AIR-02/);
 assert.deepEqual(s.settings,old);assert.equal(configs,1);
});
test('session import validates effect/version and full budget before replacing settings',()=>{
 const s=UI().createSession(Snow.defaults());
 const json=s.serialize();s.edit(c=>c.fieldWidth=700);s.importPreset(json);assert.equal(s.settings.fieldWidth,512);
 assert.throws(()=>s.importPreset(JSON.stringify({schemaVersion:2,effectId:'fx.air.snowfall',settings:Snow.defaults()})),/preset/);
 const c=Snow.defaults();c.flakesPerSecond=120;c.fallSpeed=5;assert.throws(()=>s.replace(c),/budget/);
 assert.equal(s.settings.fallSpeed,50);
});
test('session duplicates independent emitter IDs, respects caps, and permits empty selection',()=>{
 const s=UI().createSession(Snow.defaults());
 s.add();s.duplicate();s.add();assert.equal(s.settings.emitters.length,4);
 assert.equal(new Set(s.settings.emitters.map(e=>e.id)).size,4);
 assert.throws(()=>s.add(),/4/);for(let i=0;i<4;i++)s.remove();
 assert.equal(s.selectedId,null);assert.equal(s.settings.emitters.length,0);
});
test('one shot stops and scenic playback wraps at authored duration not export count',()=>{
 const s=UI().createSession(Snow.defaults());s.edit(c=>{c.durationFrames=600;c.exportFrames=60});
 s.seek(9.9);s.play();s.tick(.2);assert.ok(Math.abs(s.time-.1)<1e-8);
 s.setMode('oneShot',40);s.play();s.tick(1);assert.equal(s.time,39/60);assert.equal(s.playing,false);
 s.reverse();s.play();s.tick(1);assert.equal(s.time,0);assert.equal(s.playing,false);
});
test('package pins actual modules and copies settings, assets and unique safe paths',()=>{
 const config=Snow.defaults(),src=id=>'// '+id,asset={skeletonName:'body.json',skeleton:'{}',atlasName:'body.atlas',atlas:'atlas',images:new Map([['page.png','bytes']]),skin:'default',animation:'idle'};
 const pack=Ex().packageEntries({settings:config,asset,source:src,target:'webgpu'});
 const map=new Map(pack.entries.map(e=>[e.name,e.data]));assert.equal(map.size,pack.entries.length);
 assert.equal(JSON.parse(map.get('package.json')).dependencies['pixi.js'],'8.22.0');
 assert.ok(map.get('Snow.mjs').includes('FxSnowRuntime.createSnow'));assert.ok(map.get('FxSnow.mjs').includes('fxSnowCore'));
 assert.ok(map.get('example.js').includes('createSnow'));assert.ok(map.has('public/assets/page.png'));
 assert.deepEqual(JSON.parse(map.get('preset.json')).settings,Snow.normalize(config));
 assert.throws(()=>Ex().packageEntries({settings:config,asset:{...asset,images:new Map([['../page.png','bytes']])},source:src,target:'webgl'}),/Unsafe/);
});
test('frame contract is half-open, bounded and intentionally crops the snow field',()=>{
 const c=Snow.defaults(),m=Ex().manifest(c,{actual:'webgl2'},60);
 assert.equal(m.frames.length,60);assert.equal(m.frames.at(-1).timeSeconds,59/60);
 assert.equal(m.width,512);assert.equal(m.height,512);assert.equal(m.alpha,'straight-rgba8');
 assert.ok(m.cropPolicy.includes('field'));assert.throws(()=>Ex().manifest(c,{},61),/frame count/);
});
