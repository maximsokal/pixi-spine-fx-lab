'use strict';
const {test}=require('node:test'),A=require('node:assert/strict');
// The first run must fail on the missing implementation, not a fake sampler.
const M=require('../assets/template/src/motion-core.js');
const spring=(v={})=>({schemaVersion:1,type:'spring',durationFrames:120,frequencyHz:1,dampingRatio:.3,initialDisplacement:1,initialVelocity:0,...v});
const bounce=(v={})=>({schemaVersion:1,type:'bounce',durationFrames:120,launchSpeed:100,gravity:200,restitution:.5,maxBounces:2,...v});
const pulse=(v={})=>({schemaVersion:1,type:'pulse',durationFrames:60,center:2,amplitude:.5,cycles:1,phaseCycles:0,...v});
const near=(a,b,e=1e-9)=>A.ok(Math.abs(a-b)<=e,`${a} != ${b} (tol ${e})`);
const finite=s=>{A.ok(Number.isFinite(s.value));A.ok(Number.isFinite(s.velocity));};
test('undamped spring quarter period and initial conditions',()=>{
 const s=M.compile(spring({dampingRatio:0}));A.deepEqual(s.sample(0),{value:1,velocity:0});
 near(s.sample(.25).value,0);near(s.sample(.25).velocity,-2*Math.PI);near(s.sample(.5).value,-1);near(s.sample(1).value,1);
 const q=M.compile(spring({dampingRatio:0,initialDisplacement:0,initialVelocity:2*Math.PI}));near(q.sample(.25).value,1);near(q.sample(.25).velocity,0);
});
test('critical and overdamped spring match independent closed forms',()=>{
 const w=2*Math.PI,x=2,v=-3,t=.35;
 const c=M.compile(spring({dampingRatio:1,initialDisplacement:x,initialVelocity:v}));
 near(c.sample(t).value,(x+(v+w*x)*t)*Math.exp(-w*t));near(c.sample(t).velocity,(v-w*(v+w*x)*t)*Math.exp(-w*t));
 const z=2,a=-w*(z-Math.sqrt(z*z-1)),b=-w*(z+Math.sqrt(z*z-1)),k=(v-b*x)/(a-b),l=x-k;
 const o=M.compile(spring({dampingRatio:z,initialDisplacement:x,initialVelocity:v}));
 near(o.sample(t).value,k*Math.exp(a*t)+l*Math.exp(b*t));near(o.sample(t).velocity,k*a*Math.exp(a*t)+l*b*Math.exp(b*t));
});
test('spring velocity, differential equation and near-critical continuity',()=>{
 const w=2*Math.PI,h=1e-5;
 for(const z of [0,.2,.999999999999,1,1.000000000001,2,4]){
  const s=M.compile(spring({dampingRatio:z,initialDisplacement:-2,initialVelocity:3}));A.deepEqual(s.sample(0),{value:-2,velocity:3});
  for(const t of [.03,.17,.4,1.1]){const a=s.sample(t-h),b=s.sample(t),c=s.sample(t+h);near((c.value-a.value)/(2*h),b.velocity,1e-6);near((c.velocity-a.velocity)/(2*h)+2*z*w*b.velocity+w*w*b.value,0,2e-5);}
 }
 const c=M.compile(spring({dampingRatio:1})).sample(.2);
 for(const z of [1-1e-12,1+1e-12]){const x=M.compile(spring({dampingRatio:z})).sample(.2);near(x.value,c.value);near(x.velocity,c.velocity);}
});
test('spring holds sampled endpoint without claiming rest',()=>{
 const s=M.compile(spring({durationFrames:15,dampingRatio:0}));near(s.sample(.25).value,0);A.equal(s.sample(.25).velocity,0);A.deepEqual(s.sample(.25),s.sample(100));A.ok(s.sample(.25-1e-6).velocity<-6);
});
test('bounce uses exact ballistic height and right-sided restitution',()=>{
 const b=M.compile(bounce());A.deepEqual(b.sample(0),{value:0,velocity:100});A.deepEqual(b.sample(.5),{value:25,velocity:0});
 A.deepEqual(b.sample(1),{value:0,velocity:50});A.deepEqual(b.sample(1.25),{value:6.25,velocity:0});A.deepEqual(b.sample(1.5),{value:0,velocity:25});A.deepEqual(b.sample(1.75),{value:0,velocity:0});A.deepEqual(b.sample(2),{value:0,velocity:0});
 A.ok(b.sample(1-1e-8).velocity<-99);A.ok(b.sample(1-1e-8).value>0);A.ok(b.sample(1+1e-8).value>0);
});
test('bounce rejects a truncated flight and handles zero launch/restitution',()=>{
 A.throws(()=>M.compile(bounce({durationFrames:104})),/duration/);A.doesNotThrow(()=>M.compile(bounce({durationFrames:105})));
 for(const cfg of [bounce({launchSpeed:0,durationFrames:1}),bounce({restitution:0}),bounce({maxBounces:0})]){const p=M.compile(cfg);A.deepEqual(p.sample(1),{value:0,velocity:0});}
 const tiny=M.compile(bounce({launchSpeed:1e-8,gravity:2000,maxBounces:32,restitution:.95,durationFrames:1}));A.ok(tiny.sample(1e-12).value>0);A.equal(tiny.sample(1/60).value,0);
});
test('pulse is phase-continuous and periodic in value and velocity',()=>{
 const p=M.compile(pulse());A.deepEqual(p.sample(0),{value:2.5,velocity:0});near(p.sample(.25).value,2);near(p.sample(.25).velocity,-Math.PI);near(p.sample(.5).value,1.5);
 for(const frames of [1,40,60,119,3600])for(const phaseCycles of [0,.125,.99]){const q=M.compile(pulse({durationFrames:frames,phaseCycles,cycles:3})),d=frames/60;
  for(const n of [1,2,3,10])A.deepEqual(q.sample(d*n),q.sample(0));const h=d*1e-5,t=d*.23;near((q.sample(t+h).value-q.sample(t-h).value)/(2*h),q.sample(t).velocity,Math.max(1e-6,Math.abs(q.sample(t).velocity)*1e-6));
  finite(q.sample(Number.MAX_VALUE));}
});
test('phase offsets and area-preserving squash/stretch',()=>{
 near(M.phaseOffset(2,4,.125),.625);near(M.phaseOffset(0,4,-.25),.75);near(M.phaseOffset(3,4,.5),.25);
 for(const s of [.1,.5,1,2,10]){const a=M.squashStretch(s,true);near(a.x*a.y,1);A.equal(a.y,s);A.deepEqual(M.squashStretch(s,false),{x:1,y:s});}
 for(const f of [()=>M.phaseOffset(4,4,0),()=>M.phaseOffset(0,0,0),()=>M.phaseOffset(.5,4,0),()=>M.phaseOffset(0,4,Infinity),()=>M.squashStretch(0,true),()=>M.squashStretch(1,'true')])A.throws(f);
});
test('strict configuration, immutable compiled state and finite time',()=>{
 A.equal(M.VERSION,1);
 for(const x of [null,[],{},spring({schemaVersion:2}),spring({type:'other'}),spring({durationFrames:0}),spring({durationFrames:1.5}),spring({durationFrames:3601}),spring({frequencyHz:0}),spring({dampingRatio:NaN}),spring({initialVelocity:101}),spring({unknown:1}),bounce({gravity:0}),bounce({restitution:1}),bounce({maxBounces:33}),pulse({cycles:.5}),pulse({phaseCycles:1}),pulse({amplitude:-1}),pulse({center:'2'})])A.throws(()=>M.compile(x));
 const missing=spring();delete missing.initialVelocity;A.throws(()=>M.compile(missing));
 const c=spring(),p=M.compile(c);A.ok(Object.isFrozen(p));A.ok(Object.isFrozen(p.settings));c.initialDisplacement=9;A.equal(p.sample(0).value,1);A.throws(()=>{p.settings.frequencyHz=2;});A.deepEqual(M.normalize(JSON.parse(JSON.stringify(p.settings))),p.settings);
 for(const t of [-1,NaN,Infinity,'0',null])A.throws(()=>p.sample(t));
});
test('absolute seek is independent of sample order and FPS',()=>{
 for(const cfg of [spring(),bounce(),pulse()]){const p=M.compile(cfg),d=cfg.durationFrames/60,baseline=Array.from({length:31},(_,i)=>p.sample(d*i/30));for(const fps of [30,60,120]){for(let i=30;i>=0;i--){const s=p.sample(d*(i*(fps/30))/fps);near(s.value,baseline[i].value,1e-10);near(s.velocity,baseline[i].velocity,1e-9);}}}
});
test('bound sweep stays finite across extreme regimes',()=>{
 for(const frequencyHz of [.1,1,20])for(const dampingRatio of [0,.999999999999,1,1.000000000001,4])for(const initialDisplacement of [-10,10])for(const initialVelocity of [-100,100]){const p=M.compile(spring({frequencyHz,dampingRatio,initialDisplacement,initialVelocity,durationFrames:3600}));for(const t of [0,1e-12,1/60,.25,1,10,59.999,60,Number.MAX_VALUE])finite(p.sample(t));}
 for(const restitution of [0,.1,.95]){const p=M.compile(bounce({launchSpeed:1000,gravity:2000,restitution,maxBounces:32,durationFrames:3600}));for(let i=0;i<=3600;i++){const q=p.sample(i/60);finite(q);A.ok(q.value>=0);}}
});
test('phase remains canonical even for negative subnormal offsets',()=>{
 for(const offset of [-Number.MIN_VALUE,-1e-100,-1e-20,-1e20,Number.MAX_VALUE]){const phase=M.phaseOffset(0,1,offset);A.ok(phase>=0&&phase<1,`noncanonical phase ${phase}`);}
});
test('standalone global module exports the same API as CommonJS',()=>{
 const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),ctx=vm.createContext({});
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../assets/template/src/motion-core.js'),'utf8'),ctx);
 A.deepEqual(Object.keys(ctx.FxMotion),Object.keys(M));
 const value=vm.runInContext('FxMotion.compile({schemaVersion:1,type:"pulse",durationFrames:60,center:2,amplitude:.5,cycles:1,phaseCycles:0}).sample(.25).value',ctx);
 near(value,2);
});
