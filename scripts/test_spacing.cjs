#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const S = require('../assets/template/src/spacing-core.js');
const C = require('../assets/template/src/curve-core.js');
const close=(a,b,t=.00001)=>assert.ok(Math.abs(a-b)<t,String(a)+' != '+String(b));
function config(opts={}) { return {schemaVersion:1,mode:'uniform',frequencySource:'rate',
  baseRate:10,interval:.1,duration:2,minInterval:0,jitter:0,burstCount:3,
  burstDelay:.01,seed:123,maxEvents:2048,rateCurve:null,intervalCurve:null,...opts}; }
const p=S.createTemporalSchedule(config());
assert.equal(p.events.length,20);
close(p.events[0].time,.1); close(p.events.at(-1).time,2);
assert.ok(p.events.every((e,i)=>e.index===i));
assert.deepEqual(S.createTemporalSchedule(config()).events,p.events);
let cursor=S.createCursor(p);
const byFrames=[];
for(let i=1;i<=240;i++)byFrames.push(...cursor.consume(i/120));
assert.deepEqual(byFrames,p.events,'cursor consumes all events without skipping on 120fps');
for(const fps of [30,60,120]) {
  let c=S.createCursor(p),arr=[];
  for(let i=1;i<=fps*2;i++)arr.push(...c.consume(i/fps));
  assert.deepEqual(arr,p.events,'frame rate '+fps);
}
// Independent analytic oracle (N(t)=integral of linearly changing rate).
for(const mode of ['accelerating','decelerating']){
 const events=S.createTemporalSchedule(config({mode})).events;
 for(let i=0;i<events.length;i++){
   const n=i+1;
   const exact=mode==='accelerating'?
     (-5+Math.sqrt(25+10*n))/5:
     (15-Math.sqrt(225-10*n))/5;
   assert.ok(Math.abs(events[i].time-exact)<=.001,
     mode+' mathematical crossing exceeded 1ms at event '+n);
 }
}
assert.equal(S.createTemporalSchedule(config({duration:0})).events.length,0);
assert.equal(S.createTemporalSchedule(config({baseRate:0})).events.length,0);
const high=S.createTemporalSchedule(config({baseRate:1000,duration:10,minInterval:.02,maxEvents:120}));
assert.ok(high.events.length<=120); assert.ok(high.capped);
for(let i=1;i<high.events.length;i++)assert.ok(high.events[i].time-high.events[i-1].time>=.02-1e-7);
const rate=S.createTemporalSchedule(config({frequencySource:'interval',interval:.25,duration:1}));
assert.equal(rate.events.length,4);
for(const mode of ['uniform','accelerating','decelerating','clustered','burst','custom']) {
  const params=config({mode,seed:77});
  const events=S.createTemporalSchedule(params).events;
  assert.ok(events.length>0,mode+' must create events');
  for(let i=1;i<events.length;i++)assert.ok(events[i].time>events[i-1].time,'strict timestamps '+mode);
}
const burst=S.createTemporalSchedule(config({mode:'burst',baseRate:2,duration:1,burstCount:3,burstDelay:.03}));
assert.equal(burst.events.length,4);close(burst.events[0].time,.5);close(burst.events[1].time,.53); // delayed tail outside duration is correctly discarded
const jit=S.createTemporalSchedule(config({jitter:.3,seed:19}));
assert.deepEqual(jit.events,S.createTemporalSchedule(config({jitter:.3,seed:19})).events);
assert.notDeepEqual(jit.events,S.createTemporalSchedule(config({jitter:.3,seed:20})).events);
const curve=C.createPreset('easeIn',{parameterKey:'emissionRate',domain:'emitterTime',inputUnit:'normalized-duration',
  valueUnit:'normalized',inputRange:[0,1],valueRange:[0,2],monotonic:true});
const custom=S.createTemporalSchedule(config({mode:'custom',rateCurve:curve}));
assert.ok(custom.events.length>0);
assert.notDeepEqual(custom.events.map(e=>e.time),p.events.map(e=>e.time));
const secCurve=C.createPreset('easeInOut',{parameterKey:'emissionInterval',domain:'emitterTime',
 inputUnit:'normalized-duration',valueUnit:'normalized',valueRange:[.5,1.5],monotonic:true});
const iv=S.createTemporalSchedule(config({mode:'custom',frequencySource:'interval',interval:.1,intervalCurve:secCurve}));
assert.ok(iv.events.length>0);
assert.throws(()=>S.createTemporalSchedule(config({jitter:5})),/jitter/i);
assert.throws(()=>S.createTemporalSchedule(config({baseRate:Infinity})),/finite|rate/i);
assert.throws(()=>S.createTemporalSchedule(config({maxEvents:1000000})),/maxEvents/i);
const linear={schemaVersion:1,closed:false,segments:[{p0:[0,0],p1:[33.333333,0],p2:[66.666667,0],p3:[100,0]}]};
const table=S.buildArcTable(linear);
close(table.length,100,.0001);
close(S.pointAtDistance(table,25).x,25,.001);
assert.ok(S.pointAtDistance(table,25).tangent.x>.999);
let place=S.createSpatialPlacement({path:linear,baseSpacingPx:10,minSpacing:1,maxSpacing:30,
  mode:'even',jitter:0,seed:4,maxPoints:100,alignToTangent:true,pathFollow:'clamp'});
assert.equal(place.points.length,10);
for(let i=0;i<10;i++){close(place.points[i].distance,(i+1)*10,.001);
 close(place.points[i].x,(i+1)*10,.001);}
const bezier={schemaVersion:1,closed:false,segments:[{p0:[0,0],p1:[20,80],p2:[80,80],p3:[100,0]}]};
const bt=S.buildArcTable(bezier,{tolerancePx:.25,maxDepth:16,maxPoints:8192});
const exactLength=(()=>{let total=0,prev=[0,0];for(let i=1;i<=20000;i++){let t=i/20000,q=S.evaluateCubic(bezier.segments[0],t);total+=Math.hypot(q.x-prev[0],q.y-prev[1]);prev=[q.x,q.y];}return total})();
assert.ok(Math.abs(bt.length-exactLength)<=.25,'arc-length tolerance');
const round=S.createSpatialPlacement({path:bezier,baseSpacingPx:10,minSpacing:2,maxSpacing:20,
 mode:'even',jitter:0,seed:7,maxPoints:100,alignToTangent:true,pathFollow:'clamp'});
for(let i=1;i<round.points.length;i++)close(round.points[i].distance-round.points[i-1].distance,10,.001);
assert.ok(round.points.some(p=>Math.abs(p.y)>1),'curve must not be sampled as a straight line');
const spacingCurve={
  schemaVersion:1,parameterKey:'spacingPx',domain:'pathPosition',inputUnit:'normalized-path',
  valueUnit:'px',inputRange:[0,1],valueRange:[2,30],defaultValue:10,clamp:'hold',
  monotonic:false,keys:[{id:'start',x:0,y:5,mode:'linear'},{id:'end',x:1,y:20,mode:'linear'}]
};
const variable=S.createSpatialPlacement({path:linear,baseSpacingPx:10,minSpacing:2,maxSpacing:30,
 mode:'even',spacingCurve,jitter:0,seed:3,maxPoints:100,alignToTangent:false,pathFollow:'clamp'});
assert.ok(variable.points.length!==place.points.length,'spacing curve changes count');
assert.ok(variable.points[1].distance-variable.points[0].distance<variable.points.at(-1).distance-variable.points.at(-2).distance);
for(const mode of ['even','random','stratified','clustered']){
 const opts={path:bezier,baseSpacingPx:10,minSpacing:3,maxSpacing:20,mode,jitter:.2,
  seed:99,maxPoints:120,alignToTangent:true,pathFollow:'clamp'};
 const a=S.createSpatialPlacement(opts),b=S.createSpatialPlacement(opts);
 assert.deepEqual(a,b,'seeded stable '+mode);assert.ok(a.points.length>0);
 const changed=S.createSpatialPlacement({...opts,seed:98});
 if(mode!=='even'||opts.jitter)assert.notDeepEqual(a.points,changed.points,'seed affects samples '+mode);
}
const closed={...linear,closed:true};
const ct=S.buildArcTable(closed);
close(ct.length,200,.001);
close(S.pointAtDistance(ct,230,'wrap').x,30,.01);
const rev=S.pointAtDistance(ct,30,'wrap',true);
close(rev.x,30,.01);
assert.equal(S.buildArcTable({schemaVersion:1,closed:false,segments:[{p0:[0,0],p1:[0,0],p2:[0,0],p3:[0,0]}]}).length,0);
assert.equal(S.createSpatialPlacement({path:{schemaVersion:1,closed:false,segments:[{p0:[0,0],p1:[0,0],p2:[0,0],p3:[0,0]}]},baseSpacingPx:10,minSpacing:1,maxSpacing:20,mode:'even',jitter:0,seed:0,maxPoints:20,alignToTangent:false,pathFollow:'clamp'}).points.length,0);
assert.throws(()=>S.createSpatialPlacement({path:linear,baseSpacingPx:0,minSpacing:.000001,maxSpacing:1,mode:'even',jitter:0,seed:0,maxPoints:20,alignToTangent:false,pathFollow:'clamp'}),/spacing|minimum/i);
const timelined=S.combineSchedule({schedule:p,placement:place,mode:'time',maxEvents:100});
assert.equal(timelined.events.length,20);
assert.equal(timelined.events.at(-1).anchorIndex,9,'open clamp path holds final anchor');
const track=[{time:0,x:0,y:0},{time:1,x:100,y:0},{time:2,x:100,y:0}];
const dist=S.combineSchedule({schedule:p,placement:place,motion:track,mode:'distance',teleportThresholdPx:300,maxEvents:100});
assert.equal(dist.events.length,10,'100px travel / 10px spacing');
const both=S.combineSchedule({schedule:p,placement:place,motion:track,mode:'both',teleportThresholdPx:300,maxEvents:100});
assert.ok(both.events.length>0&&both.events.length<=dist.events.length);
const stationary=S.combineSchedule({schedule:p,placement:place,motion:[{time:0,x:0,y:0},{time:2,x:0,y:0}],mode:'distance',teleportThresholdPx:200,maxEvents:100});
assert.equal(stationary.events.length,0);
const teleport=S.combineSchedule({schedule:p,placement:place,motion:[{time:0,x:0,y:0},{time:1,x:1000,y:0},{time:2,x:1000,y:0}],mode:'both',teleportThresholdPx:200,maxEvents:100});
assert.equal(teleport.events.length,0);
const explicitWrap=S.combineSchedule({schedule:p,placement:place,motion:[
 {time:0,x:100,y:0},{time:1,x:0,y:0,teleport:true},{time:2,x:0,y:0}],
 mode:'distance',teleportThresholdPx:300,maxEvents:100});
assert.equal(explicitWrap.events.length,0,'even a short explicit open-path wrap is a teleport');
const reversal=S.combineSchedule({schedule:p,placement:place,motion:[{time:0,x:0,y:0},{time:1,x:100,y:0},{time:2,x:0,y:0}],mode:'distance',teleportThresholdPx:200,maxEvents:100});
assert.ok(reversal.events.length>dist.events.length,'reverse movement counts distance traveled');
assert.ok(reversal.events[10].x<reversal.events[9].x,'reversal places events at the actual returning emitter');
// Arc-length inverse must not confuse a cubic's parameter with distance.
// Exact physical oracle: x=100*t^3, so x must equal requested distance.
const easedLine={schemaVersion:1,closed:false,segments:[{p0:[0,0],p1:[0,0],p2:[0,0],p3:[100,0]}]};
const et=S.buildArcTable(easedLine);
close(et.length,100);
for(const d of [0,1,10,25,50,75,99,100]){
 const q=S.pointAtDistance(et,d);
 close(q.x,d,.00001);close(q.y,0,.00001);
 close(q.t,Math.cbrt(d/100),.00001);
 close(S.pointAtDistance(et,d,'clamp',true).x,100-d,.00001);
}
const ep=S.createSpatialPlacement({path:easedLine,baseSpacingPx:10,minSpacing:10,maxSpacing:10,mode:'even'});
for(let i=0;i<ep.points.length;i++)close(ep.points[i].x,(i+1)*10,.00001);
// Exact De Casteljau split at t=.5 of the same cubic.
const splitEased={...easedLine,segments:[{p0:[0,0],p1:[0,0],p2:[0,0],p3:[12.5,0]},
 {p0:[12.5,0],p1:[25,0],p2:[50,0],p3:[100,0]}]};
const st=S.buildArcTable(splitEased);
for(let d=0;d<=100;d+=2.5)close(S.pointAtDistance(st,d).x,S.pointAtDistance(et,d).x,.00001);
// Dense independent integration of a nonuniform curved cubic.
const steep={schemaVersion:1,closed:false,segments:[{p0:[0,0],p1:[0,0],p2:[0,200],p3:[400,200]}]};
const at=S.buildArcTable(steep),seg=steep.segments[0],steps=40000,arc=[0];
const evalIndependent=t=>({x:400*t*t*t,y:200*(3*t*t-2*t*t*t)});
let prev=evalIndependent(0);
for(let i=1;i<=steps;i++){const q=evalIndependent(i/steps);arc.push(arc.at(-1)+Math.hypot(q.x-prev.x,q.y-prev.y));prev=q;}
for(let d=0;d<=at.length;d+=5){
 const p=S.pointAtDistance(at,d);
 const scaled=p.t*steps,j=Math.min(steps-1,Math.floor(scaled));
 const measured=arc[j]+(arc[j+1]-arc[j])*(scaled-j);
 close(measured,d,.25001);
}
// implicit and explicit jump position parity
{
 const motion=[{time:0,x:0,y:0},{time:1,x:30,y:0},{time:2,x:1030,y:0},{time:3,x:1060,y:0}];
 const schedule={events:[.5,1.5,2,2.5].map(time=>({time}))};
 const run=motion=>S.combineSchedule({schedule,placement:place,motion,mode:'both',teleportThresholdPx:200,maxEvents:100});
 const implicit=run(motion),explicit=run(motion.map((m,i)=>i===2?{...m,teleport:true}:m));
 assert.deepEqual(implicit.events.map(e=>e.x),[15,30,1030,1045]);
 assert.deepEqual(explicit,implicit);
 assert.deepEqual(implicit.events.map(e=>e.time),[.5,1.5,2,2.5]);
 assert.deepEqual(implicit.events.map(e=>e.distance),[10,20,30,40]);
 assert.equal(implicit.capped,false);
}
// heading and exact timestamp around discontinuity
{
 const motion=[{time:0,x:0,y:0},{time:1,x:0,y:80},{time:2,x:1000,y:80},{time:3,x:1000,y:120}];
 const times=[1.5,2-1e-7,2,2+1e-7,2.5];
 const schedule={events:times.map(time=>({time}))};
 const opts={schedule,placement:place,motion,mode:'both',teleportThresholdPx:200,maxEvents:100};
 const result=S.combineSchedule(opts),events=result.events;
 assert.deepEqual(events.map(e=>e.x),[0,0,1000,1000,1000]);
 assert.deepEqual(events.map(e=>e.time),times);
 for(const e of events)close(e.angle,Math.PI/2);
 close(events[0].y,80);close(events[1].y,80);close(events[2].y,80);close(events[3].y,80+40e-7);close(events[4].y,100);
 assert.deepEqual(result,S.combineSchedule(opts));
 const capped=S.combineSchedule({...opts,maxEvents:2});assert.equal(capped.capped,true);assert.deepEqual(capped.events,events.slice(0,2));
}
// terminal jump and previous real heading
{
 const motion=[{time:0,x:0,y:0},{time:1,x:0,y:50},{time:1.25,x:0,y:50},{time:2,x:1000,y:50,teleport:true}];
 const schedule={events:[1.5,2,2.5].map(time=>({time}))};
 const result=S.combineSchedule({schedule,placement:place,motion,mode:'both',teleportThresholdPx:200});
 assert.deepEqual(result.events.map(e=>e.x),[0,1000,1000]);
 for(const e of result.events)close(e.angle,Math.PI/2);
}
// teleport only, threshold equality, distance/time modes
{
 const schedule={events:[.5,1,1.5,2].map(time=>({time}))};
 const motion=[{time:0,x:0,y:0},{time:1,x:1000,y:0},{time:2,x:0,y:0,teleport:true}];
 for(const mode of ['both','distance'])assert.equal(S.combineSchedule({schedule,placement:place,motion,mode,teleportThresholdPx:200}).events.length,0);
 const real=[{time:0,x:0,y:0},{time:1,x:20,y:0},{time:2,x:0,y:0}];
 const opts={schedule,placement:place,motion:real,teleportThresholdPx:20,maxEvents:100};
 const combined=S.combineSchedule({...opts,mode:'both'}),distance=S.combineSchedule({...opts,mode:'distance'});
 assert.deepEqual(combined.events.map(e=>e.x),[10,20,10,0]);
 assert.deepEqual(distance.events.map(e=>e.x),[10,20,10,0]);
 assert.deepEqual(combined.events.map(e=>e.angle),[0,0,Math.PI,Math.PI]);
 assert.deepEqual(S.combineSchedule({...opts,mode:'time'}).events,S.combineSchedule({...opts,motion,mode:'time'}).events);
}
console.log('PASS FX-CORE-02 temporal scheduling, 30/60/120 FPS, burst/custom/jitter/caps, arc-length, modes, stationary/teleport/reverse/zero');
