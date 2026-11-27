'use strict';
// Pure Chain Lightning acceptance; no GPU, DOM or wall-clock dependency.
function suite(H,C,S,P,A,test){
 const clone=v=>JSON.parse(JSON.stringify(v)),near=(a,b,e=1e-6)=>A.ok(Math.abs(a-b)<=e,a+' != '+b),at=(p,f)=>p.sample(f/60),all=s=>[...s.arcs,...s.branches,...s.glow],verts=s=>all(s).reduce((n,r)=>n+(r.kind==='disc'?4:r.positions.length/2),0);
 test('canonical 40-frame attack, fractional monotone contact times and transparent ends',()=>{
  const p=H.compile(H.defaults());A.equal(p.meta.frames,40);A.equal(p.meta.eventCount,4);A.deepEqual(p.meta.plans.map(x=>x.from),['source','target-1','target-2','target-3']);[2,9+1/12,14.5,17].forEach((f,i)=>near(p.meta.plans[i].contactFrame,f));A.equal(all(at(p,0)).length,0);A.equal(all(at(p,39)).length,0);A.equal(all(at(p,80)).length,0);A.ok(at(p,20).arcs.length>0);A.ok(at(p,20).branches.length>0);A.ok(at(p,20).glow.length>0);A.ok(Object.isFrozen(p.settings.targets[0].layers));A.ok(Object.isFrozen(p.meta.plans[0].events));
 });
 test('zero jump delay, target and layer delay, overflow omitted rather than clamped',()=>{
  const c=H.defaults();c.jumpDelay=0;const p=H.compile(c);A.deepEqual(p.meta.plans.map(x=>x.contactFrame),[2,2,2,2]);c.targets[0].delayFrames=3;c.targets[0].layers.glow.delayFrames=4;const q=H.compile(c);near(q.meta.plans[0].contactFrame,5);near(q.meta.plans[0].layers.glow.events[0].time,9/60);A.ok(at(q,6).glow.every(x=>x.emitterId!=='target-1'));c.jumpDelay=40;const r=H.compile(c);A.deepEqual(r.meta.overflow,['target-2','target-3','target-4']);A.equal(r.meta.eventCount,1);
 });
 test('strict validation rejects invalid anchors, duplicate targets, curve domains, sparse arrays, time and budgets',()=>{
  for(const mutate of [c=>c.targets.pop()&&c.targets.splice(1),c=>c.targets[1].id=c.targets[0].id,c=>c.targets[0].id='source',c=>c.source.type='bone',c=>c.targets[0].x=Infinity,c=>c.targets[0].layers.arcs.seed=.1,c=>c.curves.jump.keys[1].y=.9,c=>c.curves.jump.keys[0].y=.1,c=>c.curves.width.domain='particleAge',c=>delete c.targets[1],c=>c.schemaVersion=2,c=>c.fadeFrames=39,c=>c.minGap=90,c=>c.palettes.glow.domain='effectTime',c=>c.mode='loop']){
   const c=H.defaults();mutate(c);if(c.minGap===90)c.maxGap=2;A.throws(()=>H.compile(c));
  }
  const c=H.defaults();c.quality='low';c.arcGap=2;c.restrikes=true;c.restrikeRate=120;c.jumpDelay=0;A.throws(()=>H.compile(c),/budget/);const p=H.compile(H.defaults());for(const t of [NaN,Infinity,-1])A.throws(()=>p.sample(t));
 });
 test('curve-modulated contact times and independent rate/interval restrike schedules',()=>{
  const c=H.defaults(),p=H.compile(c);c.curves.jump.keys[1].y=.05;c.curves.jump.keys[2].y=.25;const q=H.compile(c);A.ok(q.meta.plans[1].contact<p.meta.plans[1].contact);near(q.meta.plans[3].contact,p.meta.plans[3].contact);
  c.restrikes=true;c.restrikeRate=8;c.timeJitter=0;const a=H.compile(c);c.curves.rate.keys.forEach(k=>k.y=2);const b=H.compile(c);A.ok(b.meta.eventCount>a.meta.eventCount);c.frequencySource='interval';c.intervalFrames=8;const d=H.compile(c);c.curves.rate.keys.forEach(k=>k.y=0);A.deepEqual(H.compile(c).meta.plans.map(x=>x.events),d.meta.plans.map(x=>x.events));c.curves.interval.keys.forEach(k=>k.y=.5);const e=H.compile(c);A.ok(e.meta.eventCount>d.meta.eventCount);for(const plan of e.meta.plans)for(let i=1;i<plan.events.length;i++){A.ok(plan.events[i].time<39/60);A.ok(plan.events[i].time-plan.events[i-1].time>=c.minIntervalFrames/60-1e-8);}
 });
 test('actual arc distances, exact endpoints, taper and independent spark spacing',()=>{
  const c=H.defaults();c.jitter=0;c.smoothness=0;c.sparkSpeed=0;const p=H.compile(c),s=at(p,3),r=s.arcs[0];near(r.length,Math.hypot(80,64));near(r.sections[0].x,64);near(r.sections[0].y,256);near(r.sections.at(-1).x,144);near(r.sections.at(-1).y,192);near(r.sections[0].width,2.8);near(r.sections.at(-1).width,.4);A.ok(r.errorBound<=.25);for(let i=1;i<r.sections.length;i++){const d=r.sections[i].distance-r.sections[i-1].distance;A.ok(d>0&&d<=12+1e-6);}const sparks=s.branches.filter(x=>x.kind==='disc');A.equal(sparks.length,4);near(sparks[0].x,144);near(sparks[0].y,192);for(let i=1;i<sparks.length;i++)near(Math.hypot(sparks[i].x-sparks[i-1].x,sparks[i].y-sparks[i-1].y),30);const b=s.branches.find(x=>x.kind==='ribbon');A.ok(b);near(b.length,c.branchLength,1e-5);A.ok(b.errorBound<=.25);
  c.curves.width.keys[1].y=.3;const q=at(H.compile(c),3).arcs[0];A.ok(q.sections.some((v,i)=>Math.abs(v.width-r.sections[i].width)>1e-5));c.spacingCurveEnabled=true;c.curves.spacing.keys.forEach(k=>k.y=25);const z=at(H.compile(c),3);A.deepEqual(z.arcs,[q]);A.ok(JSON.stringify(z.branches)!==JSON.stringify(s.branches));
 });
 test('layer toggles, opacity, color and offsets do not mutate other layers',()=>{
  const c=H.defaults(),p=H.compile(c),s=at(p,12);c.targets[0].layers.arcs.enabled=false;const a=at(H.compile(c),12);A.deepEqual(a.branches,s.branches);A.deepEqual(a.glow,s.glow);A.ok(a.arcs.every(r=>r.emitterId!=='target-1'));
  c.targets[0].layers.arcs.enabled=true;c.targets[1].layers.branches.enabled=false;const b=at(H.compile(c),12);A.deepEqual(b.arcs,s.arcs);A.deepEqual(b.glow,s.glow);
  c.targets[1].layers.branches.enabled=true;c.targets[1].layers.glow.x=21;const d=at(H.compile(c),12);A.deepEqual(d.arcs,s.arcs);A.deepEqual(d.branches,s.branches);near(d.glow.find(r=>r.emitterId==='target-2').x-s.glow.find(r=>r.emitterId==='target-2').x,21);
  c.palettes.glow.stops[0].rgba=[255,0,0,1];const e=at(H.compile(c),12);A.deepEqual(e.arcs,d.arcs);A.deepEqual(e.branches,d.branches);A.ok(JSON.stringify(e.glow)!==JSON.stringify(d.glow));
 });
 test('reordered targets, incident endpoint changes, missing target without bridging, coincident target impact',()=>{
  const c=H.defaults();c.jumpDelay=0;c.jitter=0;const p=H.compile(c),s=at(p,3);c.targets[1].x=20;const moved=at(H.compile(c),3);A.deepEqual(moved.arcs[0],s.arcs[0]);A.deepEqual(moved.arcs[3],s.arcs[3]);near(moved.arcs[1].sections.at(-1).x,s.arcs[1].sections.at(-1).x+20);near(moved.arcs[2].sections[0].x,s.arcs[2].sections[0].x+20);near(moved.glow[1].x,s.glow[1].x+20);
  c.targets[1].anchor={...c.targets[1].anchor,type:'bone',name:'weapon',space:'local',x:0,y:0};c.targets[1].x=0;const q=H.compile(c),missing=at(q,3);A.deepEqual(missing.missing,['target-2']);A.deepEqual(missing.arcs.map(r=>r.emitterId),['target-1','target-4']);A.ok(missing.glow.every(r=>r.emitterId!=='target-2'));const pose={'target-2':{x:144,y:192,rotation:0,scale:1}},co=q.sample(3/60,pose);A.ok(co.arcs.every(r=>r.emitterId!=='target-2'));A.ok(co.glow.some(r=>r.emitterId==='target-2'));A.ok(co.branches.some(r=>r.emitterId==='target-2'&&r.kind==='disc'));
  pose['target-2'].x=3000;const far=q.sample(3/60,pose);A.deepEqual(far.capacityExceeded,['target-1>target-2','target-2>target-3']);A.ok(far.glow.some(r=>r.emitterId==='target-2'));
  const r=H.defaults();r.jumpDelay=0;r.targets.reverse();const rev=H.compile(r);A.deepEqual(rev.meta.plans.map(t=>t.edge),['source>target-4','target-4>target-3','target-3>target-2','target-2>target-1']);A.deepEqual(at(rev,4),at(H.compile(clone(r)),4));
 });
 test('seek order, finite geometry and whole-effect capacity over varied presets',()=>{
  for(let i=0;i<16;i++){const c=H.defaults();c.jumpDelay=i%6;c.jitter=(i%5)/4;c.smoothness=(i%4)/3;c.arcGap=6+i;c.branchCount=i%5;c.sparkGap=15+i*3;c.targets[0].seed=i-8;c.targets[0].anchor.x+=i*4;c.targets[3].anchor.y-=i*4;const p=H.compile(c),first=at(p,13);at(p,32);at(p,2);A.deepEqual(at(p,13),first);for(let f=0;f<40;f++){const s=at(p,f);A.ok(all(s).length<=p.meta.primitiveBound);A.ok(verts(s)<=p.meta.vertexBound);for(const r of all(s)){A.ok(r.rgba.every(Number.isFinite));if(r.kind==='ribbon'){A.ok(r.positions.every(Number.isFinite));A.ok(r.indices.every(x=>Number.isInteger(x)&&x>=0&&x<r.positions.length/2));A.ok(r.errorBound<=.25);}else A.ok([r.x,r.y,r.radius].every(Number.isFinite));}}}
 });
}
module.exports={suite};
if(require.main===module){const H=require('../assets/chain-lightning/src/chain-core.js'),C=require('../assets/template/src/curve-core.js'),S=require('../assets/template/src/spacing-core.js'),P=require('../assets/template/src/path-core.js');suite(H,C,S,P,require('node:assert/strict'),require('node:test').test);}
