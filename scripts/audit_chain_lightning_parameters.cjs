'use strict';
// ELEC-02 L05: observe actual sampled primitives for every declared scalar.
function audit(read){
 const base='assets/template/',fx='assets/chain-lightning/src/';
 const g={};for(const p of [...['curve','spacing','path','color'].map(k=>base+'src/'+k+'-core.js'),fx+'chain-core.js',fx+'chain-anchors.js'])new Function('globalThis',read(p))(g);
 const H=g.FxChainLightning,A=g.FxChainAnchors,L=H.LAYERS;
 const doc={createElement:()=>({style:{},getContext:()=>null}),createElementNS:()=>({style:{}})},win={};
 const P=new Function('navigator','document','window','self',read(base+'vendor/pixi-8.22.0.min.js')+'\nreturn PIXI;')({userAgent:'Chromium',platform:'Linux'},doc,win,win);win.PIXI=P;
 const Sp=new Function('PIXI','window','self','require',read(base+'vendor/spine-pixi-v8-4.2.120.min.js')+'\nreturn spine;')(P,win,win,n=>{if(n==='pixi.js')return P;throw Error(n);});
 const world=new P.Container(),model=new Sp.Spine({skeletonData:new Sp.SkeletonJson({}).readSkeletonData({skeleton:{spine:'4.2.43'},bones:[{name:'root',x:8,y:12},{name:'weapon',parent:'root',x:20,y:3,rotation:25,scaleX:1.5,scaleY:.7}],slots:[],skins:[],animations:{idle:{}}}),autoUpdate:false});
 world.addChild(model);model.update(0);model.position.set(15,30);model.rotation=.4;model.scale.set(1.2);
 const ctx={world,model,Spine:Sp},copy=v=>JSON.parse(JSON.stringify(v)),same=(x,y)=>JSON.stringify(x)===JSON.stringify(y);
 const raw=read('references/fx/ice/chain-lightning.md'),bp=JSON.parse(raw.match(/\x60\x60\x60json\n([\s\S]*?)\n\x60\x60\x60/)[1]);
 const cases=new Map(),add=(k,v,prepare=()=>{},scope=null)=>{if(cases.has(k))throw Error('duplicate '+k);cases.set(k,{v,prepare,scope});};
 const restrike=c=>{c.restrikes=true;c.durationFrames=60;},interval=c=>{restrike(c);c.frequencySource='interval';},gap=c=>{c.arcGap=8;c.branchCount=4;},spacing=c=>{gap(c);for(const k of c.curves.spacing.keys)k.y=25;};
 for(const [k,args] of Object.entries({durationFrames:[50,c=>{c.glowLifeFrames=40;}],fadeFrames:[20],arcWidth:[8],jumpDelay:[8],arcGap:[25],branchSpread:[85],jitter:[.1],smoothness:[.8],arcLifeFrames:[20],branchLifeFrames:[20],glowLifeFrames:[25],branchCount:[4],branchLength:[45],branchWidthRatio:[.8],sparkGap:[20],sparkSize:[5],sparkSpeed:[150],glowRadius:[35],glowStrength:[.4],restrikeRate:[30,restrike],intervalFrames:[9,interval],minIntervalFrames:[10,restrike],timeJitter:[0,restrike],minGap:[22,gap],maxGap:[4,gap],spatialJitter:[.4,gap],frequencySource:['interval',c=>{restrike(c);c.intervalFrames=8;}],restrikes:[true],spacingCurveEnabled:[true,spacing]}))add(k,...args);
 add('quality','low');
 const bone=a=>Object.assign(a,{type:'bone',name:'weapon',space:'world',x:20,y:10});
 add('source.type','bone',c=>{c.source.name='weapon';});
 add('source.space','local',c=>bone(c.source));add('source.x',80);add('source.y',280);add('source.rotation',35);
 const E='targets.0.',target=c=>c.targets[0];
 add(E+'anchor.type','bone',c=>{target(c).anchor.name='weapon';});
 add(E+'anchor.space','local',c=>bone(target(c).anchor));
 add(E+'anchor.x',170);add(E+'anchor.y',215);
 add(E+'anchor.rotation',35,c=>{target(c).x=20;target(c).y=12;});
 for(const [k,v] of [['enabled',false],['x',20],['y',25],['delayFrames',5],['seed',1234]])add(E+k,v);
 for(const k of L)for(const [field,v] of [['enabled',false],['visible',false],['x',20],['y',25],['delayFrames',5],['seed',1234],['opacity',.4],['blend','normal'],['order',k==='glow'?'front':'behind']])add(E+'layers.'+k+'.'+field,v,()=>{},k);
 const required=bp.parameters.map(p=>p.key);if(new Set(required).size!==required.length||required.length!==cases.size||required.some(k=>!cases.has(k)))throw Error('coverage mismatch');
 const times=[2,2.5,3,5,7,9,12,15,17,20,25,30,34,38,39,42,48,55,59].map(f=>f/60);
 function observation(c){const p=H.compile(c),poses=A.resolvePoses(p.settings,ctx).poses;return {plan:p,frames:times.map(t=>p.sample(t,poses))};}
 function diff(x,y,scope){let changed=0,otherTargets=0,siblings=0;for(let i=0;i<times.length;i++){const a=x.frames[i],b=y.frames[i];if(L.some(k=>(!scope||k===scope)&&!same(a[k],b[k])))changed++;if(scope&&L.some(k=>k!==scope&&!same(a[k],b[k])))siblings++;if(scope&&L.some(k=>!same(a[k].filter(p=>p.emitterId!=='target-1'),b[k].filter(p=>p.emitterId!=='target-1'))))otherTargets++;}return {changedFrames:changed,sampledFrames:times.length,siblingLayerFrames:siblings,unrelatedTargetFrames:otherTargets};}
 function quality(){const c=H.defaults();c.durationFrames=120;c.restrikes=true;c.restrikeRate=30;c.jumpDelay=0;c.arcGap=90;c.branchCount=0;c.sparkGap=15;c.arcLifeFrames=c.branchLifeFrames=c.glowLifeFrames=30;const p=H.compile(c);let rejected=false;try{H.compile({...c,quality:'low'});}catch(e){if(!/budget/.test(e.message))throw e;rejected=true;}const hi=H.compile({...c,quality:'high'});return {primitiveBound:p.meta.primitiveBound,vertexBound:p.meta.vertexBound,lowLimit:H.BUDGETS.low,lowRejected:rejected,highSame:same(p.sample(.15),hi.sample(.15))};}
 const out=[];
 try{for(const key of required){const {v,prepare,scope}=cases.get(key);let actual,pass=false;try{
  if(key==='quality'){actual=quality();pass=actual.lowRejected&&actual.primitiveBound>actual.lowLimit&&actual.highSame;}
  else{const c=H.defaults();prepare(c);const d=copy(c),path=key.split('.'),last=path.pop();path.reduce((o,k)=>o[k],d)[last]=v;actual=diff(observation(c),observation(d),scope);pass=actual.changedFrames>0&&actual.unrelatedTargetFrames===0;
   // The incoming arc path is shared with branches, so arc seed affects both.
   if(scope&&key!==E+'layers.arcs.seed')pass=pass&&actual.siblingLayerFrames===0;}
 }catch(e){actual={error:String(e.message||e)};}out.push({id:'parameter.'+key,kind:'numeric',expected:key==='quality'?'Low rejects over-budget fixture, high preserves motion':'Changes sampled geometry, color, visibility or render assignment; scoped layer keeps unrelated targets',actual,tolerance:{},evidence:[],status:pass?'PASS':'FAIL'});}
 return out;}finally{world.destroy({children:true});}
}
module.exports={audit};
if(require.main===module){const fs=require('node:fs'),path=require('node:path'),checks=audit(p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8'));console.log(JSON.stringify(checks,null,2));if(checks.some(c=>c.status!=='PASS'))process.exitCode=2;}
