'use strict';
const A=require('node:assert/strict'),test=require('node:test').test;
const L=require('../assets/falling-leaves/src/leaves-core.js'),E=require('../assets/falling-leaves/src/leaves-editor.js');
const near=(a,b)=>A.ok(Math.abs(a-b)<1e-8,a+' != '+b);
test('transactional settings; adapter rejection and external mutation do not leak',()=>{
 let reject=false,configured=0,seeks=0;
 const s=E.createSession(L.defaults(),{configure(c){configured++;if(reject)throw Error('rejected');c.leafRate=99;},seek(){seeks++;}});
 s.edit(c=>c.leafRate=20);A.equal(s.settings.leafRate,20);
 const copy=s.settings;copy.leafRate=1;A.equal(s.settings.leafRate,20);
 reject=true;A.throws(()=>s.edit(c=>c.leafRate=30),/rejected/);A.equal(s.settings.leafRate,20);
 A.throws(()=>s.edit(c=>c.leafRate=-1));A.equal(configured,2);s.seek(.5);A.equal(seeks,1);
});
test('half-open playback, reverse, pause, seek and failed seek rollback',()=>{
 let reject=false;const s=E.createSession(L.defaults(),{seek(){if(reject)throw Error('reject seek');}});
 s.seek(1.9);s.play();s.tick(.2);near(s.time,.1);s.reverse();s.tick(.2);near(s.time,1.9);
 s.pause();s.tick(1);near(s.time,1.9);reject=true;A.throws(()=>s.seek(.4));near(s.time,1.9);
 reject=false;s.reset();A.equal(s.time,0);A.equal(s.playing,false);A.throws(()=>s.seek(NaN));
});
test('independent emitter duplication and four-emitter limit',()=>{
 const s=E.createSession(L.defaults());const first=s.settings.emitters[0];s.duplicate();
 A.equal(s.settings.emitters[0].id,first.id);A.notEqual(s.settings.emitters[1].seed,first.seed);
 s.add();s.add();A.throws(()=>s.add(),/maximum 4/);
 for(let i=0;i<4;i++)s.remove();A.equal(s.selectedId,null);A.equal(s.settings.emitters.length,0);
 s.add();A.ok(s.selectedId);
});
test('preset identity, version and roundtrip including curves and layers',()=>{
 const s=E.createSession(L.defaults());s.edit(c=>{c.spinCurve.keys[1].y=.3;c.emitters[0].layers.background.parallax=.1;});
 const json=s.serialize(),before=s.settings;s.replace(L.defaults());s.importPreset(json);A.deepEqual(s.settings,before);
 A.throws(()=>s.importPreset('{"schemaVersion":1,"effectId":"other","settings":{}}'),/preset/);
});
test('pointer inverse at 50, 100 and 200 percent zoom and rotated layers',()=>{
 const e=L.newEmitter(),a={x:80,y:100,rotation:30};e.rotation=60;
 for(const zoom of [.5,1,2]){
  const d=E.pointerDelta(20*zoom,-10*zoom,{width:512*zoom,height:512*zoom});
  const before=E.origin(a,e,'foreground');E.shift(e,'foreground',d,a);const after=E.origin(a,e,'foreground');
  near(after.x-before.x,20);near(after.y-before.y,-10);
 }
 const other=E.origin(a,e,'background'),base=E.origin(a,e,'origin');E.shift(e,'origin',{x:10,y:10},a);
 near(E.origin(a,e,'origin').x-base.x,10);near(E.origin(a,e,'background').y-other.y,10);
 A.throws(()=>E.pointerDelta(1,1,{width:0,height:5}));
});
test('all authored curve, style and spacing keys remain valid after import',()=>{
 const s=E.createSession(L.defaults());s.edit(c=>{c.style='magical';c.palette=L.palette('magical');c.spacingCurveEnabled=true;c.rateCurve.keys[1].y=1.5;c.timingMode='burst';c.timeJitter=.1;c.spawnDelay=.2;});
 A.deepEqual(L.normalize(s.settings),s.settings);A.equal(L.sample(s.settings,.5).diagnostics.length,0);
});
