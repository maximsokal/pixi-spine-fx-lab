'use strict';
const assert=require('node:assert/strict');
const {test}=require('node:test');
const Snow=require('../assets/snowfall/src/snow-core.js');

// Independent literal schedule: the shared spacing adapter will supply these
// event times and source distances, rather than inventing frame-based births.
const births=[{id:0,time:0,x:24},{id:1,time:.25,x:48},{id:2,time:.5,x:72},{id:3,time:.75,x:96}];
const options={period:1,lifetime:10,limit:100};
const visible=t=>Snow.periodicAges(births,t,options);
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);

test('pre-roll fills the field from ten preceding seconds and repeats exactly at the seam',()=>{
 const start=visible(0);assert.equal(start.length,40);
 assert.deepEqual(visible(1),start);assert.deepEqual(visible(10),start);
 assert.ok(start.some(p=>p.age>9));assert.ok(start.some(p=>p.age===0));
});
test('a surviving particle advances by the true elapsed time across the periodic seam',()=>{
 const dt=1/60,before=visible(1-dt),after=visible(1);
 const survivor=before.find(p=>p.id===1&&p.cycle===-4);
 const same=after.find(p=>p.id===survivor.id&&p.cycle===survivor.cycle-1);
 assert.ok(same);close(same.age-survivor.age,dt);assert.equal(same.x,survivor.x);
});
test('non-integer lifetime includes only live half-open births, without duplicate boundary particles',()=>{
 const p=Snow.periodicAges(births,0,{...options,lifetime:.5});
 assert.deepEqual(p.map(v=>[v.id,v.age]),[[3,.25],[0,0]]);
 assert.ok(p.every(v=>v.age>=0&&v.age<.5));
});
test('empty schedule, zero lifetime, arbitrary seek order and immutable input',()=>{
 const original=structuredClone(births),start=visible(.25);visible(.9);visible(0);
 assert.deepEqual(visible(.25),start);assert.deepEqual(births,original);
 assert.deepEqual(Snow.periodicAges([],0,options),[]);
 assert.deepEqual(Snow.periodicAges(births,0,{...options,lifetime:0}),[]);
});
test('invalid schedule and unsafe work are rejected before allocating particle records',()=>{
 for(const bad of [{...options,period:0},{...options,lifetime:Infinity},{...options,limit:0}, {...options,limit:39}])
  assert.throws(()=>Snow.periodicAges(births,0,bad),/AIR-02/);
 for(const bad of [[births[0],births[0]],[{id:0,time:1,x:0}],[{id:0,time:NaN,x:0}],[{id:0,time:0,x:Infinity}],[births[2],births[1]]])
  assert.throws(()=>Snow.periodicAges(bad,0,options),/AIR-02/);
 assert.throws(()=>Snow.periodicAges(births,-1,options),/AIR-02/);
});
test('bounded long scenic period preserves causal ages and seam equality',()=>{
 const b=[{id:0,time:0,x:1},{id:1,time:8,x:2}],o={period:12,lifetime:13,limit:16};
 assert.deepEqual(Snow.periodicAges(b,0,o),Snow.periodicAges(b,12,o));
 assert.deepEqual(Snow.periodicAges(b,0,o).map(v=>[v.id,v.age]),[[0,12],[1,4],[0,0]]);
});

// Motion accepts the shared half-open event schedule; renderer independence is intentional.
test('snow flight samples move continuously and repeat at the seam',()=>{
 const cfg=Snow.flightDefaults();cfg.depthVariation=0;cfg.windDrift=0;cfg.rotationSpeed=0;
 const at=t=>Snow.sampleFlights(births,t,cfg);
 const a=at(0),b=at(1),before=at(59/60);
 assert.deepEqual(b,a);assert.ok(a.length>0);
 const prev=before.find(p=>p.id===1&&p.cycle===-4);
 const next=b.find(p=>p.id===prev.id&&p.cycle===prev.cycle-1);
 close(next.y-prev.y,50/60);close(next.x,prev.x);close(next.rotation,prev.rotation);
});
test('near and far are exclusive shares and depth separates sizes/speeds',()=>{
 const cfg=Snow.flightDefaults(),events=Array.from({length:20},(_,id)=>({id,time:id/20,x:id*24}));
 const p=Snow.sampleFlights(events,0,cfg),near=p.filter(v=>v.layer==='near'),far=p.filter(v=>v.layer==='far');
 assert.equal(new Set(near.map(v=>v.id)).size,7);assert.equal(new Set(far.map(v=>v.id)).size,13);
 assert.ok(Math.min(...near.map(v=>v.size))>Math.max(...far.map(v=>v.size)));
 cfg.depthVariation=0;const neutral=Snow.sampleFlights(events,0,cfg);
 assert.ok(neutral.every(v=>v.size===7&&v.speed===50));
});
test('velocity curves integrate to authored means, alpha and color follow flight age',()=>{
 const cfg=Snow.flightDefaults();cfg.depthVariation=0;cfg.fieldWidth=2048;
 const p=Snow.sampleFlights([{id:0,time:0,x:0}],1,cfg).find(v=>v.cycle===-2);
 const q=Snow.sampleFlights([{id:0,time:0,x:0}],0,cfg).find(v=>v.cycle===-1);
 close(p.y-q.y,50);close(p.x-q.x,24);
 assert.ok(p.rotation>q.rotation);assert.ok(p.rgba[3]>q.rgba[3]);assert.ok(p.rgba[2]>=p.rgba[0]);
 const zero=structuredClone(cfg);zero.windDrift=0;zero.rotationSpeed=0;
 const v=Snow.sampleFlights([{id:0,time:0,x:0}],0,zero).find(v=>v.cycle===-2);
 close(v.x,0);assert.equal(v.rotation,Snow.sampleFlights([{id:0,time:0,x:0}],0,zero).find(v=>v.cycle===-1).rotation);
});
test('layer visibility never reassigns births and rejects total excess',()=>{
 const cfg=Snow.flightDefaults(),all=Snow.sampleFlights(births,0,cfg);
 cfg.layers.near=false;assert.deepEqual(Snow.sampleFlights(births,0,cfg),all.filter(p=>p.layer==='far'));
 cfg.layers.far=false;assert.deepEqual(Snow.sampleFlights(births,0,cfg),[]);
 cfg.layers.near=cfg.layers.far=true;cfg.limit=1;assert.throws(()=>Snow.sampleFlights(births,0,cfg),/budget/);
});
test('a dormant layer does not exceed an exactly full budget on a long period',()=>{
 const cfg=Snow.flightDefaults();Object.assign(cfg,{period:16,fieldHeight:64,fallSpeed:240,limit:1});
 const p=Snow.sampleFlights([{id:0,time:0,x:0},{id:1,time:8,x:24}],0,cfg);
 assert.equal(p.length,1);assert.equal(p[0].layer,'near');
});
