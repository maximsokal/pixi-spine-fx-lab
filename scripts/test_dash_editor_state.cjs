'use strict';
const A=require('node:assert/strict'),{test}=require('node:test');
const D=require('../assets/teleport-dash/src/dash-core.js'),S=require('../assets/template/src/spacing-core.js'),E=require('../assets/teleport-dash/src/dash-editor-state.js');
const copy=v=>JSON.parse(JSON.stringify(v));
const near=(a,b,e=1e-7)=>A.ok(Math.abs(a-b)<=e,a+' != '+b);
const point=(a,b,e)=>{near(a[0],b[0],e);near(a[1],b[1],e);};
const camera=z=>({left:-36,top:42,width:512*z,height:512*z});
const screen=(p,z)=>[p[0]*z-36,p[1]*z+42];
test('inverse camera and anchor transforms at 50/100/200 percent',()=>{
 for(const z of [.5,1,2]){point(E.screenToWorld(camera(z),screen([200,100],z)),[200,100]);for(const rotation of [-3600,-180,0,45,90,3600])for(const scale of [.01,.25,1,20]){const p={x:20,y:-130,rotation,scale};point(E.toLocal(p,E.toWorld(p,[10,-11])),[10,-11],1e-8);}}
 A.throws(()=>E.screenToWorld({...camera(1),width:0},[1,2]));A.throws(()=>E.screenToWorld({...camera(1),width:Number.MIN_VALUE},[1,2]));A.throws(()=>E.toLocal({x:0,y:0,rotation:0,scale:0},[1,2]));
});
test('world emitter drag at each zoom preserves sibling emitters and all layers',()=>{
 const c=E.addEmitter(D.defaults()).settings,id=c.emitters[0].id;
 for(const z of [.5,1,2]){const start=screen([c.emitters[0].x,c.emitters[0].y],z),drag=E.startDrag(c,{id,rect:camera(z),point:start}),a=drag.move([start[0]+12*z,start[1]-6*z]),b=drag.move([start[0]+24*z,start[1]+9*z]);near(a.emitters[0].x,182);near(b.emitters[0].x,194);near(b.emitters[0].y,265);A.deepEqual(b.emitters[0].layers,c.emitters[0].layers);A.deepEqual(b.emitters[1],c.emitters[1]);}
 near(c.emitters[0].x,170);
});
test('inherited layer uses inverse parent rotation and scale, independent world anchor stays world',()=>{
 const c=D.defaults(),e=c.emitters[0],id=e.id;e.rotation=90;e.scale=2;
 const a=E.startDrag(c,{id,layer:'trail',rect:camera(2),point:screen([e.x,e.y],2)}).move(screen([e.x,e.y+20],2));near(a.emitters[0].layers.trail.x,10);near(a.emitters[0].layers.trail.y,0);A.deepEqual(a.emitters[0].layers.echoes,e.layers.echoes);
 e.layers.flash.anchor={type:'world',name:''};const b=E.moveOrigin(c,id,'flash',{},[30,50]);near(b.emitters[0].layers.flash.x,30);near(b.emitters[0].layers.flash.y,50);
});
test('historical bone basis and frozen drag camera, invalid bone refuses editing',()=>{
 const c=D.defaults(),e=c.emitters[0],id=e.id;e.anchor={type:'bone',name:'hip'};e.x=2;e.y=3;const poses={hip:{x:50,y:60,rotation:90,scale:2}},p=E.originTransform(c,id,'emitter',poses);near(p.x,44);near(p.y,64);
 const rect=camera(1),start=screen([p.x,p.y],1),drag=E.startDrag(c,{id,poses,rect,point:start});poses.hip.x=999;rect.width=100;const a=drag.move([start[0],start[1]+20]);near(a.emitters[0].x,12);near(a.emitters[0].y,3);A.equal(E.originTransform(c,id,'emitter',{}),null);A.throws(()=>E.startDrag(c,{id,rect:camera(1),point:start}),/anchor/);
});
test('cubic control editing derives true arc length, resize preserves authored shape',()=>{
 const c=D.defaults(),curved=E.movePathPoint(c,0,'p1',[50,55]),old=curved.path.segments[0];near(curved.dashLength,S.buildArcTable(curved.path).length);A.ok(curved.dashLength>170);
 const longer=E.scalePath(curved,300),factor=longer.path.segments[0].p3[0]/old.p3[0];near(longer.dashLength,300);near(S.buildArcTable(longer.path).length,300,.01);for(const k of ['p0','p1','p2','p3'])point(longer.path.segments[0][k],old[k].map(v=>v*factor));A.deepEqual(c,D.defaults());A.throws(()=>E.scalePath(c,601));
});
test('de Casteljau subdivision retains curve geometry and adjacent knots remain joined',()=>{
 const c=E.movePathPoint(D.defaults(),0,'p1',[40,70]),a=E.splitPath(c,0,.5),s=a.path.segments;A.equal(s.length,2);point(s[0].p3,s[1].p0);near(c.dashLength,a.dashLength,.25);
 const b=E.movePathPoint(a,0,'p3',[80,50]);point(b.path.segments[0].p3,[80,50]);point(b.path.segments[1].p0,[80,50]);const d=E.movePathPoint(b,1,'p0',[90,45]);point(d.path.segments[0].p3,[90,45]);A.throws(()=>E.movePathPoint(c,0,'p0',[10,0]),/fixed/);A.throws(()=>E.splitPath(c,0,0));A.throws(()=>E.movePathPoint(c,0,'p3',[601,0]));
});
test('path handle drag under rotated trail transform at all zooms',()=>{
 const c=D.defaults(),e=c.emitters[0];e.rotation=90;e.scale=2;const id=e.id,base=E.originTransform(c,id,'trail'),old=c.path.segments[0].p1;
 const startWorld=E.toWorld(base,old),destination=[old[0]+5,old[1]+10],endWorld=E.toWorld(base,destination);
 for(const z of [.5,1,2]){const d=E.startDrag(c,{id,layer:'trail',kind:'path',index:0,key:'p1',rect:camera(z),point:screen(startWorld,z)}),a=d.move(screen(endWorld,z));point(a.path.segments[0].p1,destination);A.deepEqual(a.emitters,c.emitters);}
 A.throws(()=>E.movePathAtWorld(c,id,'echoes',{},0,'p1',endWorld));point(c.path.segments[0].p1,old);
});
test('candidate transaction retains old plan/frame/selection on failed prepare and invalid preset',()=>{
 const c=E.addEmitter(D.defaults()),state=E.create(c.settings);state.select(c.id,'echoes');state.seek(20/60);const plan=state.plan,old=state.settings;
 const next=copy(old);next.durationFrames=12;let calls=0;A.throws(()=>state.commit(next,()=>{calls++;throw Error('renderer rejected');}),/renderer rejected/);A.equal(calls,1);A.equal(state.plan,plan);A.equal(state.settings,old);A.equal(state.frame,20);A.equal(state.selectedId,c.id);
 A.throws(()=>state.commit({...next,trailWidth:NaN},()=>calls++));A.equal(calls,1);A.throws(()=>state.commit(next,()=>state.seek(0)),/transaction/);A.equal(state.plan,plan);
 state.commit(next,(s,t)=>{A.equal(s.durationFrames,12);near(t,11/60);A.equal(state.settings,old);});A.equal(state.frame,11);A.equal(state.selectedId,c.id);A.equal(state.layer,'echoes');state.commit(E.removeEmitter(state.settings,c.id));A.equal(state.selectedId,'dash1');A.equal(state.layer,'echoes');
});
test('emitter duplication and removal preserve stable sibling identities and independent seeds',()=>{
 const c=D.defaults(),a=E.addEmitter(c,'dash1');A.equal(a.id,'dash2');A.equal(a.settings.emitters[1].x,190);A.notEqual(a.settings.emitters[1].seed,c.emitters[0].seed);A.deepEqual(a.settings.emitters[0],c.emitters[0]);let s=E.addEmitter(a.settings).settings;s=E.addEmitter(s).settings;A.equal(s.emitters.length,4);A.throws(()=>E.addEmitter(s),/limit/);const removed=E.removeEmitter(s,'dash2'),again=E.addEmitter(removed);A.equal(again.id,'dash2');A.deepEqual(again.settings.emitters.slice(0,3),removed.emitters);A.throws(()=>E.removeEmitter(c,'dash1'));
});
test('timeline markers are actual compiled birth timestamps and traveled arc distances',()=>{
 const c=D.defaults(),state=E.create(c);state.markers.forEach((m,i)=>near(m.frame,[3,6,9,12,15][i]));A.equal(state.markers.length,5);
 c.echoMode='distance';state.commit(c);state.markers.forEach((m,i)=>near(m.travelDistance,[14,28,42,56,70][i],1e-5));A.equal(state.markers.length,5);A.ok(state.markers[0].frame!==3);const b=copy(c);b.mode='teleport';state.commit(b);A.equal(state.markers.length,0);state.seek(50);A.equal(state.frame,39);state.seek(-1);A.equal(state.frame,0);
});
