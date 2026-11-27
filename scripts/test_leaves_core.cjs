'use strict';
const test=require('node:test');
const A=require('node:assert/strict');
const L=require('../assets/falling-leaves/src/leaves-core.js');
const make=()=>L.defaults(), id='emitter1';
const plan=(c,k='foreground')=>L.schedule(c,id,k);
const layer=(c,k='foreground',time=.73)=>L.sample(c,time).emitters[0].layers[k];
const near=(a,b,e=1e-6)=>A.ok(Math.abs(a-b)<=e,a+' != '+b);
test('default contract and 20 births per 120-frame cycle',()=>{
 const c=make();A.equal(c.durationFrames,120);A.equal(c.leafRate,10);A.equal(c.leafSize,18);
 A.equal(c.fallSpeed,55);A.equal(c.windSpeed,30);A.equal(c.tumble,110);A.equal(c.shapeVariance,.4);
 A.equal(plan(c).events.length,20);A.equal(c.exportFrames,120);
 A.ok(plan(c).events.every(e=>e.time>=0&&e.time<2));
});
test('exact seam and arbitrary deterministic seeking',()=>{
 const c=make();A.deepEqual(L.sample(c,0),L.sample(c,2));A.deepEqual(L.sample(c,0),L.sample(c,20));
 const frame=L.sample(c,53/60);L.sample(c,119/60);A.deepEqual(frame,L.sample(c,53/60));
 A.deepEqual(L.sample(c,1/60+1e-13),L.sample(c,1/60));
});
test('pre-roll and near-seam physical continuity',()=>{
 const c=make();A.ok(layer(c,'foreground',0).length>0);
 const a=layer(c,'foreground',2-1e-6),b=layer(c,'foreground',1e-6);
 for(const x of a){
  const candidates=b.filter(y=>x.id.split(':')[1]===y.id.split(':')[1]);
  const y=candidates.find(y=>Math.abs(x.age-y.age)<1e-4);
  if(y){near(x.x,y.x,.01);near(x.y,y.y,.01);near(x.alpha,y.alpha,.01);}
  else A.ok(x.alpha<.001,'nonmatching cohort must be fading out');
 }
});
test('rate changes events not movement controls; gap changes lanes not timestamps',()=>{
 const c=make(),baseline=plan(c),faster=make(),wide=make();
 faster.leafRate=17;wide.spatialGap=60;
 A.equal(plan(faster).events.length,34);
 A.deepEqual(plan(faster).lanes,baseline.lanes);
 A.deepEqual(plan(wide).events.map(e=>e.time),baseline.events.map(e=>e.time));
 A.notDeepEqual(plan(wide).lanes,baseline.lanes);
 for(const [i,p] of plan(wide).lanes.entries())if(i)A.ok(p.distance-plan(wide).lanes[i-1].distance>=wide.minGap-1e-6);
});
test('rate and spatial curves affect only their proper domain',()=>{
 const c=make(),rate=make(),space=make();
 rate.rateCurve.keys[1].y=2;space.spacingCurveEnabled=true;space.spacingCurve.keys[1].y=80;
 A.notDeepEqual(plan(rate).events,plan(c).events);A.deepEqual(plan(rate).lanes,plan(c).lanes);
 A.notDeepEqual(plan(space).lanes,plan(c).lanes);
 A.deepEqual(plan(space).events.map(v=>v.time),plan(c).events.map(v=>v.time));
});
test('time delay and seeded jitter are real and reproducible',()=>{
 const c=make(),d=make(),j=make();d.spawnDelay=.17;j.timeJitter=.3;
 A.notDeepEqual(plan(j).events,plan(c).events);A.deepEqual(plan(j),plan(j));
 for(const ev of plan(c).events){const v=plan(d).events.find(x=>x.index===ev.index);near(v.time,(ev.time+.17)%2);}
});
test('cluster and burst scheduling, zero rate',()=>{
 const c=make();c.timingMode='burst';A.ok(plan(c).events.length>20);
 c.timingMode='clustered';A.notDeepEqual(plan(c).events,plan(make()).events);
 c.leafRate=0;A.equal(plan(c).events.length,0);A.equal(layer(c).length,0);
});
test('layer toggles do not perturb other layers',()=>{
 const c=make(),d=make();d.emitters[0].layers.background.enabled=false;
 A.deepEqual(layer(c),layer(d));A.equal(layer(d,'background').length,0);
 d.emitters[0].layers.foreground.enabled=false;A.equal(L.sample(d,.73).counters.particles,0);
 d.emitters[0].layers.gusts.enabled=true;A.ok(layer(d,'gusts').length>0);
});
test('independent origins, phase, seed and parallax',()=>{
 const c=make(),d=make();d.emitters[0].layers.foreground.x=30;
 for(const [i,v] of layer(c).entries()){near(layer(d)[i].x-v.x,30);near(layer(d)[i].y,v.y);}
 A.deepEqual(layer(c,'background'),layer(d,'background'));
 d.emitters[0].layers.foreground.timeOffset=17;A.notDeepEqual(layer(c),layer(d));
 const q=make();q.emitters[0].layers.background.parallax=0;
 A.notDeepEqual(layer(c,'background'),layer(q,'background'));A.deepEqual(layer(c),layer(q));
 q.emitters[0].layers.background.seed++;A.notDeepEqual(plan(c,'background'),plan(q,'background'));
});
test('fall, wind, spin, drift, shape and alpha controls affect actual samples',()=>{
 const c=make(),base=layer(c);
 for(const [k,v,field] of [['fallSpeed',100,'y'],['windSpeed',-30,'x'],['tumble',0,'rotation'],
  ['shapeVariance',0,'shape'],['leafSize',35,'width']]){
  const d=make();d[k]=v;A.ok(layer(d).some((x,i)=>Math.abs(x[field]-base[i][field])>1e-5),k);
 }
 const d=make();d.driftCurve.keys[1].y=0;A.notDeepEqual(layer(d).map(x=>x.x),base.map(x=>x.x));
 const s=make();s.spinCurve.keys[1].y=0;A.notDeepEqual(layer(s).map(x=>x.rotation),base.map(x=>x.rotation));
 const a=make();a.alphaCurve.keys[1].y=.2;A.notDeepEqual(layer(a).map(x=>x.alpha),base.map(x=>x.alpha));
});
test('normalized preset roundtrip, style palette and strict rejection',()=>{
 const c=make();A.deepEqual(L.normalize(JSON.parse(JSON.stringify(c))),L.normalize(c));
 const d=make();d.style='magical';d.palette=L.palette(d.style);A.notDeepEqual(layer(d).map(x=>x.tint),layer(c).map(x=>x.tint));
 for(const key of ['leafRate','fallSpeed','shapeVariance']){const q=make();q[key]=NaN;A.throws(()=>L.normalize(q));}
 const q=make();q.alphaCurve.keys[0].y=.1;A.throws(()=>L.normalize(q));
 const e=make();e.emitters.push(e.emitters[0]);A.throws(()=>L.normalize(e));
});
test('resolved anchor, missing anchor and explicit quality overflow',()=>{
 const c=make();c.emitters[0].anchor.type='bone';c.emitters[0].anchor.name='hand';
 A.equal(L.sample(c,.73).counters.particles,0);A.equal(L.sample(c,.73).diagnostics[0].code,'missing-anchor');
 const a=L.sample(c,.73,{[id]:{x:100,y:100,rotation:0}});
 A.ok(a.counters.particles>0);
 const d=make();d.quality='low';d.leafRate=80;d.lifetime=8;
 A.throws(()=>L.sample(d,.73),/quality budget/);
});
test('schedule return mutation cannot poison cached simulation',()=>{
 const c=make(),first=plan(c),copy=plan(c);copy.events[0].time=99;copy.lanes[0].x=999;
 A.deepEqual(plan(c),first);
});

test('inactive layers need no anchor, but re-enabled layers still report a missing pose',()=>{
 const c=make(),e=c.emitters[0];Object.assign(e.anchor,{type:'bone',name:'missing'});
 e.layers.foreground.enabled=false;e.layers.background.visible=false;e.layers.gusts.enabled=true;e.layers.gusts.alpha=0;
 for(const t of [0,.73,119/60,2]){
  const s=L.sample(c,t);A.deepEqual(s.diagnostics,[]);A.equal(s.counters.particles,0);
  A.deepEqual(s.emitters,[{id,layers:{foreground:[],background:[],gusts:[]}}]);
 }
 c.emitters.push(L.newEmitter(1));const s=L.sample(c,.73);A.equal(s.diagnostics.length,0);
 A.deepEqual(s.emitters[1],L.sample({...c,emitters:[c.emitters[1]]},.73).emitters[0]);
 e.layers.foreground.enabled=true;const bad=L.sample(c,.73);
 A.deepEqual(bad.diagnostics,[{code:'missing-anchor',emitter:id}]);A.deepEqual(bad.emitters,[s.emitters[1]]);
 A.equal(L.sample(c,.73,{[id]:{x:100,y:100,rotation:0}}).diagnostics.length,0);
});
