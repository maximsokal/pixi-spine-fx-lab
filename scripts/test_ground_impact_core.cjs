'use strict';
function run(H,C,A,test){
 const copy=x=>JSON.parse(JSON.stringify(x)),near=(a,b,t=1e-8)=>A.ok(Math.abs(a-b)<=t,a+' != '+b);
 const flat=(c,y)=>{c.defaultValue=y;for(const k of c.keys)k.y=y;};
 const at=(c,f=12)=>H.compile(c).sample(f/60),fresh=()=>H.defaults();
 test('defaults, strict JSON roundtrip and immutable compile snapshot',()=>{
  const c=fresh(),p=H.compile(c);A.equal(H.VERSION,1);A.equal(H.FPS,60);A.deepEqual(H.LAYERS,['ring','debris','dust']);A.equal(c.debrisCount,35);A.equal(p.meta.frames,40);A.deepEqual(H.normalize(copy(c)),p.settings);
  A.ok(Object.isFrozen(p.settings)&&Object.isFrozen(p.meta.schedule.debris[0]));c.debrisCount=0;A.equal(p.meta.counts.debris,35);A.equal(p.sample(0).layers.debris.length,35);
  for(const mutate of [v=>v.schemaVersion=2,v=>v.mode='loop',v=>v.durationFrames=41,v=>v.gravity=NaN,v=>v.debrisCount=1.2,v=>v.extra=1,v=>v.layers.ring.id='dust',v=>v.layers.dust.seed=2147483648,v=>v.curves.radius.domain='particleAge',v=>v.palettes.ring.domain='particleAge',v=>delete v.curves.rate.keys[0]]){const x=fresh();mutate(x);A.throws(()=>H.compile(x));}
  for(const t of [-1,Infinity,NaN])A.throws(()=>p.sample(t));
 });
 test('35 simultaneous IDs, dust schedule, endpoint and seek parity',()=>{
  const p=H.compile(fresh()),m=p.meta;A.equal(m.counts.debris,35);A.equal(new Set(m.schedule.debris.map(x=>x.id)).size,35);A.ok(m.schedule.debris.every(x=>x.born===0));A.equal(m.counts.dust,19);
  for(const [i,t] of [.1,.2,.3].entries())near(m.schedule.dust.slice(16)[i].born,t);
  A.ok(p.sample(0).layers.debris.length>0);A.ok(p.sample(12/60).layers.ring[0].radiusX>0);A.ok(p.sample(12/60).layers.dust.length>0);
  for(const t of [39/60,40/60,10])A.equal(p.sample(t).primitives,0);
  const x=p.sample(.217);p.sample(.5);p.sample(.03);A.deepEqual(p.sample(.217),x);
  for(let i=0;i<20;i++)A.deepEqual(p.sample(i/30),p.sample(4*i/120));
 });
 test('physical controls affect intended layer only',()=>{
  const c=fresh(),base=at(c);for(const [key,value,layer] of [['gravity',900,'debris'],['launchSpeed',420,'debris'],['debrisSize',30,'debris'],['impactRadius',160,'ring'],['ringWidth',16,'ring'],['dustDensity',.2,'dust']]){
   const x=fresh();x[key]=value;const q=at(x);A.notDeepEqual(q.layers[layer],base.layers[layer]);for(const k of H.LAYERS.filter(k=>k!==layer))A.deepEqual(q.layers[k],base.layers[k]);
  }
  const v=fresh();v.gravity=0;const a=at(v),e=H.compile(c).meta.schedule.debris[0];near(base.layers.debris[0].y-a.layers.debris[0].y,.5*c.gravity*(12/60)**2);near(base.layers.debris[0].x,a.layers.debris[0].x);A.ok(e.angle<0);
 });
 test('independent offsets, delay, opacity, seed, switches and explicit origins',()=>{
  const c=fresh(),base=at(c);
  for(const k of H.LAYERS){const x=fresh();x.layers[k].enabled=false;const q=at(x);A.equal(q.layers[k].length,0);for(const other of H.LAYERS.filter(v=>v!==k))A.deepEqual(q.layers[other],base.layers[other]);}
  const x=fresh();x.contact.x+=20;const q=at(x);near(q.layers.ring[0].x,base.layers.ring[0].x+20);near(q.layers.debris[0].x,base.layers.debris[0].x+20);A.deepEqual(q.layers.dust,base.layers.dust);
  for(const k of H.LAYERS){const x=fresh();x.layers[k].seed++;const q=at(x);A.notDeepEqual(q.layers[k],base.layers[k]);for(const other of H.LAYERS.filter(v=>v!==k))A.deepEqual(q.layers[other],base.layers[other]);}
  for(const k of H.LAYERS){const x=fresh();x.layers[k].delayFrames=25;A.equal(at(x).layers[k].length,0);x.layers[k].delayFrames=40;const p=H.compile(x);A.ok(p.meta.omitted[k]>0);A.equal(p.meta.counts[k],0);}
  const d=fresh();d.layers.debris.opacity=.5;near(at(d).layers.debris[0].rgba[3],base.layers.debris[0].rgba[3]*.5);
  d.layers.debris.x+=5;near(at(d).layers.debris[0].x,base.layers.debris[0].x+5);
  const b=fresh();b.contact.anchor={type:'bone',name:'hip',slot:''};b.contact.x=0;b.contact.y=0;const p=H.compile(b);const absent=p.sample(.2);A.deepEqual(absent.missing,['ring','debris']);A.deepEqual(absent.layers.dust,base.layers.dust);A.equal(absent.layers.ring.length,0);
  const present=p.sample(.2,{contact:{x:100,y:200,rotation:90,scale:2}});near(present.layers.ring[0].x,100);near(present.layers.ring[0].y,200);near(present.layers.ring[0].radiusX,base.layers.ring[0].radiusX*2);A.deepEqual(present.layers.dust,base.layers.dust);
  const all=fresh();for(const l of Object.values(all.layers))l.visible=false;A.equal(H.compile(all).meta.primitiveBound,0);A.equal(at(all).primitives,0);
 });
 test('shared arc distances, bounds, jitter and count preservation',()=>{
  const c=fresh(),p=H.compile(c),list=p.meta.schedule.debris;A.equal(list.length,35);
  for(const e of list){near(Math.hypot(e.x,e.y),e.bandRadius,.08);A.ok(e.distance>=c.minGapPx-1e-8&&e.distance<e.pathLength);}
  for(let i=1;i<list.length;i++)if(list[i].band===list[i-1].band)near(list[i].distance-list[i-1].distance,12);
  const first=list[0];near(first.bandRadius,12);for(const band of new Set(list.map(x=>x.band))){const a=list.filter(x=>x.band===band);A.ok(a[0].distance+a[0].pathLength-a.at(-1).distance>=c.minGapPx);}
  const x=fresh();x.spatialJitter=.4;x.spacingCurveEnabled=true;flat(x.curves.spacing,16);const q=H.compile(x);A.deepEqual(q.meta.schedule,H.compile(x).meta.schedule);A.notDeepEqual(q.meta.schedule.debris,list);A.deepEqual(q.meta.schedule.dust,p.meta.schedule.dust);
  const impossible=fresh();impossible.debrisCount=160;impossible.originGapPx=60;impossible.spacingPx=60;A.throws(()=>H.compile(impossible),/spatial capacity/);impossible.layers.debris.enabled=false;A.equal(H.compile(impossible).meta.counts.debris,0);
 });
 test('temporal rate, interval, minimum interval and inactive budget',()=>{
  const c=fresh(),p=H.compile(c);const x=fresh();flat(x.curves.rate,2);A.equal(H.compile(x).meta.counts.dust,22);
  x.frequencySource='interval';flat(x.curves.interval,2);A.equal(H.compile(x).meta.counts.dust,17);A.deepEqual(H.compile(x).meta.schedule.debris,p.meta.schedule.debris);
  const j=fresh();j.timeJitter=.4;j.minIntervalFrames=5;const a=H.compile(j).meta.schedule.dust.slice(16);A.deepEqual(a,H.compile(j).meta.schedule.dust.slice(16));A.ok(a.slice(1).every((e,i)=>e.born-a[i].born>=5/60-1e-9));
  const z=fresh();z.debrisCount=0;z.dustRate=0;z.dustDensity=0;const q=H.compile(z);A.equal(q.meta.counts.debris,0);A.equal(q.meta.counts.dust,0);
  const b=fresh();b.quality='low';b.debrisCount=120;A.throws(()=>H.compile(b),/budget/);b.layers.debris.enabled=false;A.ok(H.compile(b).meta.primitiveBound<96);
 });
 test('integrated speed: constant, linear, stepped and cubic independent oracle',()=>{
  const c=fresh(),t=.271,u=t/(39/60),life=39/60;
  function travel(cfg){const p=H.compile(cfg),e=p.meta.schedule.debris[0];return p.sample(t).layers.debris[0].travel/(cfg.launchSpeed*e.speedScale*life);}
  near(travel(c),u-.4*u*u);
  const flatC=fresh();flat(flatC.curves.debrisSpeed,2);near(travel(flatC),2*u);
  const step=fresh();step.curves.debrisSpeed.keys[0].mode='stepped';near(travel(step),u);
  const cubic=fresh(),v=cubic.curves.debrisSpeed;v.keys[0].mode='bezier';v.keys[0].out=[.1,3];v.keys[1].in=[.85,.1];let expected=0,n=4096;for(let i=0;i<n;i++)expected+=C.evaluate(v,(i+.5)*u/n)*u/n;near(travel(cubic),expected,2e-6);
  const changed=fresh();flat(changed.curves.radius,.5);near(at(changed).layers.ring[0].radiusX,45);A.deepEqual(at(changed).layers.debris,at(c).layers.debris);
  const d=fresh();flat(d.curves.dustOpacity,0);A.equal(at(d).layers.dust.length,0);A.deepEqual(at(d).layers.debris,at(c).layers.debris);
 });
 test('finite extreme samples, global bound and palette isolation',()=>{
  const c=fresh();c.quality='high';c.gravity=1300;c.launchSpeed=750;c.debrisSize=45;c.debrisCount=160;c.spacingPx=4;c.originGapPx=4;c.dustRate=300;c.dustEndFrame=38;
  const p=H.compile(c);for(let i=0;i<40;i++){const q=p.sample(i/60);A.ok(q.primitives<=p.meta.primitiveBound);const json=JSON.stringify(q);A.ok(!json.includes('null'));}
  const d=fresh();d.palettes.dust.stops[0].rgba=[20,30,40,.5];A.notDeepEqual(at(d).layers.dust,at(fresh()).layers.dust);A.deepEqual(at(d).layers.debris,at(fresh()).layers.debris);
 });
}
module.exports=run;
if(require.main===module){run(require('../assets/ground-impact/src/ground-impact-core.js'),require('../assets/template/src/curve-core.js'),require('node:assert/strict'),require('node:test').test);}
