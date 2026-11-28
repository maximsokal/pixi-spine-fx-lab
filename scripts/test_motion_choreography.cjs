'use strict';
const {test}=require('node:test'),A=require('node:assert/strict');
const H=require('../assets/template/src/motion-choreography.js');
const near=(a,b,e=1e-9)=>A.ok(Math.abs(a-b)<=e,`${a} != ${b}`);
const element=(id,depth=0,overrides={})=>({id,depth,seed:0,enabled:true,weight:1,phaseCycles:0,...overrides});
const style=(overrides={})=>H.profile('power',{anticipationAmplitude:.25,peakAmplitude:1,lagFrames:6,jitterFrames:0,attenuation:.5,secondaryAmplitude:1,frequencyHz:1,dampingRatio:1,phaseJitterCycles:0,...overrides});
const config=(overrides={})=>({schemaVersion:1,durationFrames:120,anticipationFrame:12,releaseFrame:24,peakFrame:36,seed:7,style:style(),elements:[element('root'),element('tail',2)],...overrides});
const row=(p,t,id)=>p.sample(t).secondary.find(x=>x.id===id);
test('protected primary cues and analytic smoothstep derivative',()=>{
 const p=H.compile(config());A.deepEqual(p.cues,{start:0,anticipation:.2,release:.4,peak:.6,end:2});
 for(const [t,v] of [[0,0],[.2,-.25],[.4,0],[.6,1],[2,0],[100,0]])A.deepEqual(p.sample(t).primary,{value:v,velocity:0});
 near(p.sample(.1).primary.value,-.125);near(p.sample(.1).primary.velocity,-1.875);
 near(p.sample(.5).primary.value,.5);near(p.sample(.5).primary.velocity,7.5);
});
test('follow-through delay and attenuation match independent critical-spring oracle',()=>{
 const p=H.compile(config()),w=2*Math.PI;const tail=p.elements.find(x=>x.id==='tail');near(tail.startSeconds,.8);
 A.deepEqual(row(p,.799,'tail'),{id:'tail',value:0,velocity:0});
 near(row(p,tail.startSeconds,'tail').velocity,w*.25);
 const t=1,age=t-tail.startSeconds,u=age/(2-tail.startSeconds),fade=1-u*u*(3-2*u),df=-6*u*(1-u)/(2-tail.startSeconds);
 const x=w*.25*age*Math.exp(-w*age),v=w*.25*(1-w*age)*Math.exp(-w*age);
 near(row(p,t,'tail').value,x*fade);near(row(p,t,'tail').velocity,v*fade+x*df);
 A.deepEqual(row(p,2,'tail'),{id:'tail',value:0,velocity:0});
});
test('secondary jitter and phase are independent of sibling order and enablement',()=>{
 const c=config({style:style({jitterFrames:4,phaseJitterCycles:.25}),elements:[element('a',1,{seed:13,phaseCycles:.9}),element('b',2)]}),p=H.compile(c);
 const variants=[[c.elements[1],c.elements[0]],[{...c.elements[1],enabled:false},c.elements[0]],[c.elements[0]],[element('new'),...c.elements]];
 for(const elements of variants){const q=H.compile({...c,elements});A.deepEqual(q.elements.find(x=>x.id==='a'),p.elements.find(x=>x.id==='a'));for(const t of [0,.8,1.2,2])A.deepEqual(row(q,t,'a'),row(p,t,'a'));A.deepEqual(q.cues,p.cues);}
 const a=p.elements[0],b=H.compile({...c,seed:8}).elements[0];A.notDeepEqual([a.startSeconds,a.phaseCycles],[b.startSeconds,b.phaseCycles]);A.ok(a.startSeconds>=.7&&a.startSeconds<=.7+4/60);A.ok(a.phaseCycles>=0&&a.phaseCycles<1);
});
test('profile values are editable suggestions with no implicit cue changes',()=>{
 A.ok(H.PROFILES.includes('calm')&&H.PROFILES.includes('power')&&H.PROFILES.includes('playful'));
 const p=H.profile('calm'),q=H.profile('calm',{peakAmplitude:2});A.notEqual(p.peakAmplitude,q.peakAmplitude);A.equal(q.peakAmplitude,2);
 for(const name of H.PROFILES){const s=H.profile(name);A.deepEqual(H.compile(config({style:s})).cues,H.compile(config()).cues);}
 A.throws(()=>H.profile('not-real'));A.throws(()=>H.profile('calm',{oops:1}));A.throws(()=>H.profile('calm',{dampingRatio:NaN}));
});
test('disabled and zero weight produce no secondary motion',()=>{
 const p=H.compile(config({elements:[element('off',0,{enabled:false}),element('zero',1,{weight:0})]}));
 for(const t of [0,.6,1,2])for(const s of p.sample(t).secondary)A.deepEqual([s.value,s.velocity],[0,0]);
});
test('absolute-time sample order and common 30/60/120 FPS times are equal',()=>{
 const p=H.compile(config({style:style({jitterFrames:4,phaseJitterCycles:.5})}));
 const ref=Array.from({length:61},(_,i)=>p.sample(i/30));for(const fps of [30,60,120])for(let i=60;i>=0;i--)A.deepEqual(p.sample(i*(fps/30)/fps),ref[i]);
});
test('reject invalid cues, duplicate ids, unbounded delays and malformed inputs',()=>{
 for(const overrides of [{durationFrames:3},{durationFrames:3601},{anticipationFrame:0},{releaseFrame:12},{peakFrame:24},{peakFrame:120},{seed:2**31},{elements:[element('a'),element('a')]},{elements:[element('bad id')]},{elements:[element('a',64)]},{elements:[element('a',63)],style:style({lagFrames:60})},{elements:Array.from({length:65},(_,i)=>element('e'+i))},{style:{...style(),unknown:1}},{style:{...style(),secondaryAmplitude:Infinity}},{unknown:1}])A.throws(()=>H.compile(config(overrides)));
 const p=H.compile(config());for(const t of [-1,NaN,Infinity,'1'])A.throws(()=>p.sample(t));
});
test('immutable compiled settings and finite terminal behavior',()=>{
 const c=config(),p=H.compile(c),before=p.sample(1);c.elements[0].weight=0;A.deepEqual(p.sample(1),before);A.ok(Object.isFrozen(p.settings)&&Object.isFrozen(p.settings.elements)&&Object.isFrozen(p.settings.elements[0])&&Object.isFrozen(p.settings.style));
 const max=H.compile(config({durationFrames:3600,style:style({frequencyHz:20,dampingRatio:4,secondaryAmplitude:10}),elements:Array.from({length:64},(_,i)=>element('e'+i,0,{weight:10}))}));
 for(const t of [0,.6,.60000000001,1,59.999999,60,Number.MAX_VALUE])for(const s of max.sample(t).secondary)A.ok(Number.isFinite(s.value)&&Number.isFinite(s.velocity));
});
test('secondary taper joins rest continuously in value and velocity',()=>{
 const p=H.compile(config({style:style({dampingRatio:0})}));for(const id of ['root','tail']){const a=row(p,2-1e-7,id),b=row(p,2,id);near(a.value,b.value,1e-10);near(a.velocity,b.velocity,1e-4);}
});
test('shortest sequence and zero amplitudes preserve every authored cue',()=>{
 const p=H.compile(config({durationFrames:4,anticipationFrame:1,releaseFrame:2,peakFrame:3,style:style({lagFrames:0,jitterFrames:0,anticipationAmplitude:0,peakAmplitude:0,secondaryAmplitude:0})}));
 for(let i=0;i<=4;i++){const r=p.sample(i/60);A.deepEqual(r.primary,{value:0,velocity:0});A.ok(r.secondary.every(x=>x.value===0&&x.velocity===0));}
});
test('phase and delay channels are independent, and only secondary uses seed',()=>{
 const c=config({style:style({jitterFrames:5,phaseJitterCycles:.5}),elements:[element('a',1,{phaseCycles:.99})]}),p=H.compile(c);
 const noPhase=H.compile({...c,style:{...c.style,phaseJitterCycles:0}}),noDelay=H.compile({...c,style:{...c.style,jitterFrames:0}}),newSeed=H.compile({...c,seed:-17});
 A.equal(p.elements[0].startSeconds,noPhase.elements[0].startSeconds);A.equal(p.elements[0].phaseCycles,noDelay.elements[0].phaseCycles);
 for(let i=0;i<=120;i++)A.deepEqual(p.sample(i/60).primary,newSeed.sample(i/60).primary);
});
test('standalone browser global matches CommonJS without DOM dependencies',()=>{
 const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),ctx=vm.createContext({});
 for(const n of ['motion-core.js','motion-choreography.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../assets/template/src',n),'utf8'),ctx);
 const c=config(),actual=vm.runInContext('JSON.stringify(FxMotionChoreography.compile('+JSON.stringify(c)+').sample(1))',ctx);
 A.deepEqual(JSON.parse(actual),H.compile(c).sample(1));
});
