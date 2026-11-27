'use strict';
const H=require('../assets/chain-lightning/src/chain-core.js');
const U=require('../assets/chain-lightning/src/chain-authoring.js');
let assertions=0;
function ok(v,label){assertions++;if(!v)throw Error(label);}
function eq(a,b,label){ok(JSON.stringify(a)===JSON.stringify(b),label);}
function near(a,b,label){ok(Math.abs(a-b)<1e-8,label);}
function rejects(fn,label){let caught=false;try{fn();}catch{caught=true;}ok(caught,label);}
const base=H.normalize(H.defaults()),before=JSON.stringify(base),ids=c=>c.targets.map(t=>t.id);
const context={world:{toLocal:p=>p}};
const added=U.addTarget(base,'extra',100,200,42);
eq(ids(added),[...ids(base),'extra'],'add preserves existing order');
eq(added.targets[4],H.newTarget('extra',100,200,42),'new target defaults');
const reordered=U.reorderTarget(added,'extra',1);
eq(ids(reordered),['target-1','extra','target-2','target-3','target-4'],'stable reorder');
eq(reordered.targets[1],added.targets[4],'target fields preserved');
eq(H.compile(reordered).meta.plans.map(p=>p.from),['source','target-1','extra','target-2','target-3'],'compiled routing');
eq(U.removeTarget(reordered,'extra'),base,'remove restores base');
let eight=base;for(let i=4;i<8;i++)eight=U.addTarget(eight,'extra-'+i,10*i,10,100+i);
rejects(()=>U.addTarget(eight,'ninth',1,2,3),'maximum eight');
let two=U.removeTarget(U.removeTarget(base,'target-4'),'target-3');
rejects(()=>U.removeTarget(two,'target-2'),'minimum two');
for(const fn of [()=>U.addTarget(base,'target-1',1,2,3),()=>U.addTarget(base,'source',1,2,3),()=>U.addTarget(base,'extra',NaN,2,3),()=>U.reorderTarget(base,'target-1',4),()=>U.reorderTarget(base,'missing',0),()=>U.removeTarget(base,'missing')])rejects(fn,'invalid list edit');
const w=U.moveTarget(base,'target-1',190,210,context);
near(w.targets[0].x,46,'world offset x');near(w.targets[0].y,18,'world offset y');
const c=JSON.parse(before);c.targets[0].anchor={type:'bone',space:'local',name:'bone',slot:'',x:0,y:0,rotation:0};
const bone={active:true,worldX:100,worldY:150,a:0,b:-2,c:2,d:0};
const ctx={world:context.world,model:{skeleton:{findBone:n=>n==='bone'?bone:null}}};
const moved=U.moveTarget(c,'target-1',90,170,ctx);
near(moved.targets[0].x,10,'inverse rotated x');near(moved.targets[0].y,5,'inverse rotated y');
const layer=U.moveLayer(moved,'target-1','glow',82,176,ctx);
near(layer.targets[0].layers.glow.x,3,'layer inverse x');near(layer.targets[0].layers.glow.y,4,'layer inverse y');
eq(layer.targets[0].layers.arcs,moved.targets[0].layers.arcs,'unrelated layer untouched');
eq(layer.targets.slice(1),base.targets.slice(1),'unrelated targets untouched');
const b=U.bases(layer,'target-1',ctx);const q=U.transform(b.target,3,4);near(q.x,82,'forward x');near(q.y,176,'forward y');
const poses={'target-1':b.base};const sample=H.compile(layer).sample(0.1,poses);near(sample.targets[0].pose.x,90,'core parity x');near(sample.targets[0].pose.y,170,'core parity y');
rejects(()=>U.moveTarget(c,'target-1',1,2,context),'missing bone');
rejects(()=>U.moveLayer(base,'target-1','invalid',1,2,context),'unknown layer');
rejects(()=>U.moveTarget(base,'target-1',1e7,0,context),'out of range offset');
eq(JSON.stringify(base),before,'input immutable');
const m=H.compile(base).meta;eq(U.frame(0,m),0,'first frame');eq(U.frame(10,m),39,'last frame');eq(U.seek(-1,m),0,'lower clamp');eq(U.advance(0.5,1,m),39/60,'one-shot no wrap');
for(let i=0;i<40;i++)eq(U.frame(i/60,m),i,'exact authored frame');
rejects(()=>U.advance(0,-1,m),'negative elapsed');rejects(()=>U.seek(NaN,m),'invalid time');rejects(()=>U.seek(0,{...m,loop:true}),'no loop transport');
eq(U.pointer(138,84,{left:10,top:20,width:256,height:128}),{x:256,y:256},'viewport conversion');
rejects(()=>U.pointer(0,0,{left:0,top:0,width:0,height:10}),'empty viewport');
console.log('Chain Lightning authoring: '+assertions+' assertions PASS');
