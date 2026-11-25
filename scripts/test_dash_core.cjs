'use strict';
const A=require('node:assert/strict'),{test}=require('node:test'),D=require('../assets/teleport-dash/src/dash-core.js'),S=require('../assets/template/src/spacing-core.js'),C=require('../assets/template/src/curve-core.js');
const close=(a,b,e=1e-7)=>A.ok(Math.abs(a-b)<=e,a+' != '+b);
const at=(p,f,poses)=>p.sample(f/60,poses),row=(p,f,poses)=>at(p,f,poses).emitters[0],echo=p=>p.emitters[0].echoes;
function curve(c,points){c.keys=points.map(([x,y,mode],i)=>({id:'k'+i,x,y,mode:mode||'linear'}));c.defaultValue=points[0][1];return c}
function linear(c){curve(c.progressCurve,[[0,0],[1,1]]);return c}
function distance(c){c.echoMode='distance';return c}
test('defaults, strict detached preset and exact time echo schedule',()=>{
 const c=D.defaults(),p=D.compile(c);A.equal(c.durationFrames,40);A.equal(c.dashLength,170);A.deepEqual(echo(p).map(e=>e.birthFrame),[3,6,9,12,15]);A.deepEqual(D.normalize(JSON.parse(JSON.stringify(c))),c);
 c.trailWidth=50;A.equal(p.settings.trailWidth,24);A.ok(Object.isFrozen(p.settings));A.ok(Object.isFrozen(p.emitters[0].echoes));
 A.equal(row(p,0).layers.echoes.length,0);for(const f of [39,40,200])for(const l of Object.values(row(p,f).layers))A.equal(l.length,0);
});
test('time and arc spacing independent; exact continuous distance inversion',()=>{
 const a=D.defaults(),p=D.compile(a);a.spatialEchoGap=28;A.deepEqual(echo(D.compile(a)),echo(p));a.temporalEchoGap=5;A.deepEqual(echo(D.compile(a)).map(e=>e.birthFrame),[5,10,15,20,25]);
 const c=distance(linear(D.defaults())),q=D.compile(c);A.deepEqual(echo(q).map(e=>e.travelDistance),[14,28,42,56,70]);for(const e of echo(q)){close(e.x,e.travelDistance);close(e.birthFrame,e.travelDistance/170*39);}
 c.temporalEchoGap=10;A.deepEqual(echo(D.compile(c)),echo(q));c.spatialEchoGap=20;A.deepEqual(echo(D.compile(c)).map(e=>e.travelDistance),[20,40,60,80,100]);
});
test('nonuniform cubic inverse and curved arc error independent of t',()=>{
 const c=distance(linear(D.defaults()));c.path.segments[0].p1=[0,0];c.path.segments[0].p2=[0,0];const p=D.compile(c);
 for(const e of echo(p)){close(e.x,e.travelDistance);close(e.birthFrame,e.travelDistance/170*39);}
 c.path={schemaVersion:1,closed:false,segments:[{p0:[0,0],p1:[0,80],p2:[90,110],p3:[120,20]}]};c.dashLength=S.buildArcTable(c.path).length;const q=D.compile(c),s=c.path.segments[0];
 let last=S.evaluateCubic(s,0),sum=0;const oracle=[0];for(let i=1;i<=20000;i++){const x=S.evaluateCubic(s,i/20000);sum+=Math.hypot(x.x-last.x,x.y-last.y);oracle.push(sum);last=x}
 for(const e of echo(q)){const pt=S.pointAtDistance(S.buildArcTable(c.path),e.pathDistance),n=pt.t*20000,i=Math.min(19999,Math.floor(n));close(oracle[i]+(oracle[i+1]-oracle[i])*(n-i),e.travelDistance,.25001);close(e.x,pt.x);close(e.y,pt.y);}
});
test('teleport exact timestamp with no arc credit, trail or phantom echoes',()=>{
 const c=D.defaults();c.mode='teleport';c.teleportFrame=15;const p=D.compile(c);A.equal(at(p,15-1e-7).head.x,0);A.equal(at(p,15).head.x,170);A.equal(at(p,15+1e-7).head.x,170);
 A.equal(at(p,16).head.travelDistance,0);A.equal(row(p,16).layers.trail.length,0);A.deepEqual(echo(p).map(e=>e.x),[0,0,0,0,170]);A.equal(row(p,15).layers.flash.length,2);
 c.echoMode='distance';A.equal(echo(D.compile(c)).length,0);
});
test('stepped jump is not traveled arc; time echo snap and disjoint trails',()=>{
 const c=D.defaults();curve(c.progressCurve,[[0,0],[.25,.2,'stepped'],[.5,.8],[1,1]]);const p=D.compile(c);
 close(at(p,19.5-1e-6).head.x,34);close(at(p,19.5).head.x,136);close(at(p,19.5).head.travelDistance,34);close(at(p,39).head.travelDistance,68);
 const trails=row(p,30).layers.trail;A.equal(trails.length,2);for(const s of trails){A.equal(s.points[0].width,0);A.equal(s.points.at(-1).width,0);A.ok(s.points.every(x=>x.pathDistance<=34+1e-7||x.pathDistance>=136-1e-7));}
 c.echoMode='distance';c.afterimageCount=24;const e=echo(D.compile(c));A.deepEqual(e.map(x=>x.travelDistance),[14,28,42,56]);A.ok(e.every(x=>x.x<=34||x.x>=136));
 c.echoMode='time';c.temporalEchoGap=13;curve(c.progressCurve,[[0,0,'stepped'],[1/3,.8],[1,1]]);A.equal(echo(D.compile(c))[0].x,136);
});
test('stationary hold and Bezier motion preserve exact arc and causality',()=>{
 const c=distance(D.defaults());curve(c.progressCurve,[[0,0],[.5,0],[1,1]]);const p=D.compile(c);A.equal(row(p,10).layers.trail.length,0);A.ok(echo(p).every(e=>e.birthFrame>19.5));
 const b=linear(c);b.progressCurve.keys[0].mode='bezier';b.progressCurve.keys[0].out=[.25,0];b.progressCurve.keys[1].in=[.75,1];const q=D.compile(b);
 for(const e of echo(q))close(C.evaluate(b.progressCurve,e.birthFrame/39)*170,e.pathDistance,1e-5);
 A.notDeepEqual(echo(p),echo(q));
});
test('alpha, lifetime, absolute birth time and independent historical anchors',()=>{
 const c=D.defaults();c.emitters[0].anchor={type:'bone',name:'hip'};c.emitters[0].x=0;c.emitters[0].y=0;const p=D.compile(c),pose=t=>({hip:{x:100*t,y:0,rotation:0,scale:1}});
 const e=row(p,3,pose).layers.echoes[0];close(e.rgba[3],.6);close(e.sourceSeconds,.05);close(e.birthSeconds,.05);close(e.x,echo(p)[0].x+5);
 const mid=row(p,12.9,pose).layers.echoes.find(x=>x.id===e.id);close(mid.rgba[3],.35);close(mid.x,e.x);A.ok(!row(p,21,pose).layers.echoes.some(x=>x.id===e.id));
});
test('anchors, offsets and sibling isolation, no disabled ghost layers',()=>{
 const c=D.defaults(),e=c.emitters[0];e.x=e.y=0;e.anchor={type:'bone',name:'hip'};e.layers.flash.anchor={type:'world',name:''};
 const p=D.compile(c);A.equal(row(p,9).layers.echoes.length,0);A.ok(at(p,9).diagnostics.some(d=>d.layer==='echoes'));
 const pos={hip:{x:10,y:20,rotation:90,scale:2}},a=row(p,9,pos).layers.echoes[0];close(a.x,10);close(a.y,20+2*echo(p)[0].x);
 c.emitters.push(D.newEmitter(1));const q=D.compile(c);e.layers.echoes.timeOffset=4;e.layers.echoes.seed++;const changed=D.compile(c);A.deepEqual(at(q,12,pos).emitters[1],at(changed,12,pos).emitters[1]);
 A.equal(row(changed,6,pos).layers.echoes.length,0);A.ok(row(changed,7,pos).layers.echoes.length>0);
 A.deepEqual(row(q,12,pos).layers.trail,row(changed,12,pos).layers.trail);
 for(const e of c.emitters)for(const l of Object.values(e.layers))l.enabled=false;A.equal(at(D.compile(c),12,pos).cost,0);
});
test('curve, burst, rate, jitter and gap actually change event schedules',()=>{
 const c=D.defaults(),a=D.compile(c);c.afterimageCount=12;c.frequencySource='rate';c.echoRate=12;const rate=D.compile(c);A.deepEqual(echo(rate).slice(0,3).map(x=>x.birthFrame),[5,10,15]);
 curve(c.rateCurve,[[0,2],[1,2]]);A.ok(echo(D.compile(c))[0].birthFrame<echo(rate)[0].birthFrame);
 c.frequencySource='interval';c.temporalEchoGap=6;c.burstCount=2;c.burstDelayFrames=1;const b=D.compile(c);A.deepEqual(echo(b).slice(0,4).map(x=>x.birthFrame),[6,7,12,13]);
 c.burstDelayFrames=6;A.throws(()=>D.compile(c),/overlap/);c.burstDelayFrames=1;c.burstCount=1;c.timeJitter=.3;const j=D.compile(c);A.notDeepEqual(echo(j),echo(b));A.deepEqual(echo(j),echo(D.compile(c)));c.seed++;A.notDeepEqual(echo(j),echo(D.compile(c)));
 const s=distance(D.defaults());const plain=D.compile(s);curve(s.spacingCurve,[[0,14],[1,28]]);A.notDeepEqual(echo(plain),echo(D.compile(s)));s.spatialJitter=.3;const w=D.compile(s);A.ok(echo(w).every((x,i,ar)=>!i||x.travelDistance-ar[i-1].travelDistance>=s.minGapPx-1e-8));
 A.deepEqual(row(a,10).layers.trail,row(D.compile({...D.defaults(),afterimageCount:0}),10).layers.trail);
});
test('seek order/fps and finite output, independent particle seeds',()=>{
 const c=D.defaults(),p=D.compile(c),expected=at(p,18);for(const fps of [30,60,120]){for(let i=0;i<fps;i++)p.sample(i/fps);A.deepEqual(at(p,18),expected);}
 A.deepEqual(at(p,18),at(p,18));A.ok(row(p,18).layers.particles.length>0);c.emitters[0].layers.particles.seed++;const q=D.compile(c);A.deepEqual(row(p,18).layers.echoes,row(q,18).layers.echoes);A.notDeepEqual(row(p,18).layers.particles,row(q,18).layers.particles);
});
test('validation, budgets and zero count',()=>{
 const c=D.defaults();c.afterimageCount=0;A.equal(echo(D.compile(c)).length,0);
 for(const mutate of [x=>x.schemaVersion=2,x=>x.extra=1,x=>x.dashLength=200,x=>x.path.closed=true,x=>x.trailWidth=NaN,x=>x.progressCurve.keys[1].y=2,x=>x.progressCurve.monotonic=false,x=>x.emitters[0].scale=0,x=>x.emitters[0].layers.echoes.anchor={type:'bone',name:''},x=>x.emitters.push(D.newEmitter(1),D.newEmitter(2),D.newEmitter(3),D.newEmitter(4))]){const x=D.defaults();mutate(x);A.throws(()=>D.compile(x));}
 const low=D.defaults();low.quality='low';low.afterimageCount=24;A.throws(()=>D.compile(low),/budget/);low.emitters[0].layers.echoes.enabled=false;A.doesNotThrow(()=>D.compile(low));
 const large=D.defaults();large.quality='low';large.particleCount=128;large.emitters.push(D.newEmitter(1));A.throws(()=>D.compile(large),/budget/);
 A.throws(()=>D.compile(D.defaults()).sample(NaN));
});

test('adjacent representable times respect discontinuities and birth causality',()=>{
 const c=D.defaults();c.mode='teleport';c.teleportFrame=15;const p=D.compile(c),t=15/60,before=t-Number.EPSILON,after=t+Number.EPSILON;
 A.equal(p.sample(before).head.x,0);A.equal(p.sample(t).head.x,170);A.equal(p.sample(after).head.x,170);
 const b=echo(p)[0],earlier=p.sample(b.birthSeconds-Number.EPSILON).emitters[0].layers.echoes;A.equal(earlier.length,0);
 const a=D.defaults();curve(a.progressCurve,[[0,0,'stepped'],[.37,.8],[1,1]]);const q=D.compile(a),jump=.37*39/60;
 close(q.sample(jump-Number.EPSILON).head.x,0);close(q.sample(jump).head.x,136);close(q.sample(jump+Number.EPSILON).head.x,136);
 const e=a.emitters[0];e.layers.trail.timeOffset=4;const r=D.compile(a),shifted=(.37*39+4)/60;
 A.equal(r.sample(shifted-Number.EPSILON).emitters[0].layers.trail.length,0);
});
test('strict burst minimum, disabled schedules, path direction and budget upper bounds',()=>{
 const c=D.defaults();c.temporalEchoGap=6;c.burstCount=2;c.burstDelayFrames=1;c.minIntervalFrames=2;A.throws(()=>D.compile(c),/minimum/);
 c.emitters[0].layers.echoes.enabled=false;A.doesNotThrow(()=>D.compile(c));
 const a=D.defaults();a.path.segments[0]={p0:[0,0],p1:[-170/3,0],p2:[-340/3,0],p3:[-170,0]};a.echoMode='distance';const p=D.compile(a);close(echo(p)[0].x,-14);close(Math.abs(echo(p)[0].angle),Math.PI);
 const big=D.defaults();big.dashLength=600;big.path.segments[0]={p0:[0,0],p1:[200,0],p2:[400,0],p3:[600,0]};big.quality='low';big.emitters.push(D.newEmitter(1));A.throws(()=>D.compile(big),/ribbon vertex budget/);
 big.quality='high';const q=D.compile(big);for(let f=0;f<40;f++){const s=at(q,f),n=s.emitters.reduce((sum,e)=>sum+e.layers.trail.reduce((v,l)=>v+l.points.length*2,0),0);A.ok(n<=q.reserved.vertices);}
});
test('numeric artist control witnesses, malformed poses and independent visibility',()=>{
 const c=D.defaults(),a=D.compile(c),f=10;const mod=(k,v)=>D.compile({...D.defaults(),[k]:v});
 A.notDeepEqual(row(a,f).layers.trail,row(mod('trailWidth',40),f).layers.trail);
 A.notDeepEqual(row(a,f).layers.echoes,row(mod('afterimageAlpha',.2),f).layers.echoes);
 A.notDeepEqual(row(a,f).layers.echoes,row(mod('echoLifetimeFrames',8),f).layers.echoes);
 A.notDeepEqual(row(a,f).layers.particles,row(mod('particleSize',8),f).layers.particles);
 c.emitters[0].anchor={type:'bone',name:'hip'};c.emitters[0].layers.flash.anchor={type:'world',name:''};const p=D.compile(c),s=at(p,3,{hip:{x:0,y:0,rotation:0,scale:1e308}});A.equal(s.emitters[0].layers.echoes.length,0);A.equal(s.emitters[0].layers.trail.length,0);A.ok(s.emitters[0].layers.flash.length>0);
 A.throws(()=>p.sample(.2,()=>null),/pose map/);
});
