'use strict';
// E05 numerical evidence fragment, not a release report or a GPU certification.
// All declared scalar parameters must be exercised against actual output, not
// settings hashes. A no-op or an error is FAIL; missing coverage is an error.
const copy=v=>JSON.parse(JSON.stringify(v));
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function get(o,key){return key.split('.').reduce((v,k)=>v[k],o);}
function set(o,key,value){const p=key.split('.'),k=p.pop();p.reduce((v,k)=>v[k],o)[k]=value;}
function audit(read){
 const fx='assets/energy-projectile/src/',shared='assets/template/src/',vendor='assets/template/vendor/';
 const doc={createElement:()=>({style:{},getContext:()=>null}),createElementNS:()=>({style:{}})},win={};
 const P=new Function('navigator','document','window','self',read(vendor+'pixi-8.22.0.min.js')+'\nreturn PIXI;')({userAgent:'Chromium',platform:'Linux'},doc,win,win);win.PIXI=P;
 const Sp=new Function('PIXI','window','self','require',read(vendor+'spine-pixi-v8-4.2.120.min.js')+'\nreturn spine;')(P,win,win,n=>{if(n==='pixi.js')return P;throw Error(n);});
 const mods={};for(const path of [...['curve','spacing','path','color'].map(n=>shared+n+'-core.js'),...['core','anchors','runtime'].map(n=>fx+'energy-'+n+'.js')]){
  const m={exports:{}};new Function('module','require',read(path))(m,n=>{const k=n.split('/').at(-1);if(!Object.hasOwn(mods,k))throw Error(n);return mods[k];});mods[path.split('/').at(-1)]=m.exports;
 }
 const H=mods['energy-core.js'],An=mods['energy-anchors.js'],R=mods['energy-runtime.js'];
 const raw=read('references/fx/game/energy-projectile.md'),blueprint=JSON.parse(raw.match(/```json\n([\s\S]*?)\n```/)[1]);
 const L=H.LAYERS,checks=[],used=new Set(),cases=new Map(),add=(key,value,prepare=()=>{},scope=null,inactive=null)=>{if(cases.has(key))throw Error('duplicate '+key);cases.set(key,{value,prepare,scope,inactive});};
 const E='emitters.0.',layer=(c,k)=>c.emitters[0].layers[k];
 const interval=c=>{c.frequencySource='interval';},distance=c=>{c.emissionMode='distance';};
 const burst=c=>{c.burstCount=3;},spacing=c=>{distance(c);for(const k of c.curves.spacing.keys)k.y=20;};
 const closedShape=c=>{c.trajectory.segments=[{p0:[0,0],p1:[80,0],p2:[0,80],p3:[0,0]}];c.travelSpeed=0;};
 const fields={
  smoothing:[0,c=>{c.trajectory.segments=[{p0:[0,0],p1:[40,0],p2:[60,0],p3:[80,0]},{p0:[80,0],p1:[80,20],p2:[80,60],p3:[80,90]}];c.travelSpeed=500;c.durationFrames=60;}],durationFrames:[60],chargeFrames:[10],fadeFrames:[12],coreRadius:[35],travelSpeed:[0],
  tailLength:[30],trailGap:[19,distance],glow:[0],particleRate:[36],trailRate:[36],orbitGap:[37],
  orbitPulseHz:[6],orbitLifeFrames:[12],trailLifeFrames:[7],particleSize:[5],trailWidth:[12],
  intervalFrames:[7,interval],minIntervalFrames:[9],timeJitter:[.3],burstCount:[3],burstDelayFrames:[3,burst],
  minGap:[23,distance],maxGap:[4,distance],spatialJitter:[.4,distance],mode:['flightLoop',closedShape],
  frequencySource:['interval',c=>{c.intervalFrames=7;}],emissionMode:['distance'],distribution:['random',distance],
  spacingCurveEnabled:[true,spacing], 'trajectory.closed':[true,closedShape]
 };
 for(const [key,args] of Object.entries(fields))add(key,...args);
 add('quality','low');add(E+'enabled',false);add(E+'anchor.type','bone',c=>{c.emitters[0].anchor.name='weapon';});
 const boneAnchor=a=>Object.assign(a,{type:'bone',name:'weapon',space:'world',x:20,y:10});
 add(E+'anchor.space','local',c=>boneAnchor(c.emitters[0].anchor));
 add(E+'anchor.x',300);add(E+'anchor.y',300);add(E+'anchor.rotation',37);
 for(const k of L){
  const prefix=E+'layers.'+k+'.';
  for(const [name,value] of [['enabled',false],['visible',false],['x',25],['y',30],['rotation',37],['delayFrames',7],['seed',4119+L.indexOf(k)],['opacity',.4],['blend',k==='ribbon'?'add':'normal'],['order',k==='ribbon'?'front':'behind']])
   add(prefix+name,value,name==='seed'&&k==='ribbon'?c=>{c.timeJitter=.3;c.spatialJitter=.2;}:()=>{},k);
  add(prefix+'anchor.type','world',()=>{},k);
  add(prefix+'anchor.space','local',c=>boneAnchor(layer(c,k).anchor),k);
  for(const [name,value] of [['x',80],['y',90],['rotation',37]])add(prefix+'anchor.'+name,value,()=>{},k);
 }
 const required=blueprint.parameters.map(p=>p.key);
 if(new Set(required).size!==required.length||required.length!==cases.size||required.some(k=>!cases.has(k)))throw Error('parameter witness coverage mismatch');
 const camera=new P.Container(),world=new P.Container(),behindHost=new P.Container(),host=new P.Container();camera.addChild(world);world.addChild(behindHost);
 const rig={skeleton:{spine:'4.2.43'},bones:[{name:'root',x:8,y:12},{name:'weapon',parent:'root',x:20,y:3,rotation:25,scaleX:1.5,scaleY:.7}],slots:[],skins:[],animations:{idle:{}}};
 const model=new Sp.Spine({skeletonData:new Sp.SkeletonJson({}).readSkeletonData(rig),autoUpdate:false});world.addChild(model);model.skeleton.setToSetupPose();model.update(0);model.position.set(15,30);model.rotation=.4;model.scale.set(1.2);world.addChild(host);
 const context={world,model,Spine:Sp};
 function observe(c){
  const p=H.compile(c),poses=An.resolvePoses(p.settings,context).poses;
  // Fixed wall-clock times spanning both default and changed durations; output
  // projection contains primitive geometry, positions, RGBA, order and blend.
  const frames=Array.from({length:61},(_,i)=>p.sample(i/60,poses));
  return {frames,plan:p};
 }
 function diff(a,b,scope){
  let changed=0,unintended=0;
  for(let i=0;i<a.frames.length;i++){
   const x=a.frames[i],y=b.frames[i];
   if(L.some(k=>(!scope||scope===k)&&!same(x[k],y[k])))changed++;
   if(scope&&L.some(k=>scope!==k&&!same(x[k],y[k])))unintended++;
  }return {changedFrames:changed,unintendedSiblingFrames:unintended,sampledFrames:a.frames.length};
 }
 function quality(){
  const c=H.defaults();c.durationFrames=120;c.particleRate=120;c.orbitLifeFrames=120;c.burstCount=1;
  c.emitters.push(H.newEmitter('b',2));for(const e of c.emitters){e.layers.core.enabled=false;e.layers.ribbon.enabled=false;}
  const balanced=H.compile(c),high=H.compile({...c,quality:'high'});let rejected=false;
  try{H.compile({...c,quality:'low'});}catch(e){if(!/budget/.test(e.message))throw e;rejected=true;}
  const actual={primitiveBound:balanced.meta.primitiveBound,lowLimit:H.BUDGETS.low,balancedLimit:H.BUDGETS.balanced,lowRejected:rejected,highSame:same(balanced.sample(.2),high.sample(.2))};
  return {actual,pass:rejected&&actual.primitiveBound>actual.lowLimit&&actual.primitiveBound<=actual.balancedLimit&&actual.highSame,expected:{lowRejected:true,highSame:true}};
 }
 function nativeControl(c,k,field,value){
  const f=R.createRenderer({...context,host,behindHost,PIXI:P,settings:c});
  try{let seen=false;for(let i=0;i<61;i++){const s=f.seek(i/60);if(!s[k].length)continue;
   const expectedOrder=layer(c,k).order,root=f.owned[expectedOrder],group=root.children.find(x=>x.label===k)?.children.find(x=>x.label===c.emitters[0].id+':'+k);
   const views=group?.children.filter(v=>v.visible)??[];if(!views.length)return false;
   if(field==='blend'&&!views.every(v=>v.blendMode===value))return false;
   if(field==='order'&&expectedOrder!==value)return false;seen=true;
  }return seen;}finally{f.destroy();}
 }
 try{
  for(const p of blueprint.parameters){const key=p.key,id='parameter.'+key,entry=cases.get(key);used.add(key);let result;
   try{
    if(key==='quality')result=quality();
    else{
     const a=H.defaults();entry.prepare(a);const b=copy(a),before=get(a,key);if(same(before,entry.value))throw Error('mutation is unchanged');
     set(b,key,entry.value);const coupled=key==='mode'||key==='trajectory.closed';if(coupled){b.mode='flightLoop';b.trajectory.closed=true;}const x=observe(a),y=observe(b),actual=diff(x,y,entry.scope),expected={changedFramesMin:1,unintendedSiblingFrames:0};if(coupled){actual.coupledKeys=['mode','trajectory.closed'];let rejected=false;const invalid=copy(a);set(invalid,key,entry.value);try{H.compile(invalid);}catch(e){if(!/path\/mode mismatch/.test(e.message))throw e;rejected=true;}actual.isolatedInvalidRejected=rejected;expected.isolatedInvalidRejected=true;}
     if(entry.inactive){const inactive=H.defaults();entry.inactive(inactive);const inactiveAlt=copy(inactive);set(inactiveAlt,key,entry.value);actual.inactiveChangedFrames=diff(observe(inactive),observe(inactiveAlt),entry.scope).changedFrames;expected.inactiveChangedFrames=0;}
     if(entry.scope&&/\.(blend|order)$/.test(key)){actual.nativeControl=nativeControl(b,entry.scope,key.split('.').at(-1),entry.value);expected.nativeControl=true;}
     result={actual:{before,after:entry.value,...actual},expected,pass:actual.changedFrames>0&&actual.unintendedSiblingFrames===0&&(actual.inactiveChangedFrames??0)===0&&actual.nativeControl!==false&&actual.isolatedInvalidRejected!==false};
    }
   }catch(e){result={actual:{error:String(e.message)},expected:{validWitness:true},pass:false};}
   checks.push({id,kind:'numeric',status:result.pass?'PASS':'FAIL',expected:result.expected,actual:result.actual,tolerance:0,evidence:[]});
  }
 }finally{camera.destroy({children:true});}
 if(used.size!==cases.size)throw Error('unused witness');
 const passed=checks.filter(c=>c.status==='PASS').length;
 return {effectId:blueprint.effectId,effectVersion:blueprint.effectVersion,scope:'parameter-numerical-fragment-only',pixiVersion:P.VERSION,spineVersion:'4.2.120 (bundled CPU runtime)',status:passed===checks.length?'PASS':'FAIL',counts:{total:checks.length,passed,failed:checks.length-passed},checks,warnings:['No GPU pixels, actual browser, PNG archives or release certification in this fragment.','Layer order and blend additionally checked on native CPU views.','Mode and trajectory.closed are a coupled invariant: isolated invalid changes reject; paired valid changes are tested together. Ribbon seed is tested with active jitter.']};
}
module.exports={audit};
if(require.main===module){
 const fs=require('node:fs'),path=require('node:path'),root=path.resolve(__dirname,'..');
 const report=audit(p=>fs.readFileSync(path.join(root,p),'utf8'));
 process.stdout.write(JSON.stringify(report,null,2)+'\n');
 if(!process.argv.includes('--allow-incomplete')&&report.status!=='PASS')process.exitCode=2;
}
