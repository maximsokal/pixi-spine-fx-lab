// WATER-01 numerical source: actual instantaneous impact plus deterministic residual events.
// Same UMD implementation is embedded into offline HTML and WebGL/WebGPU packages.
(function(root,factory){
 'use strict';
 const api=Object.freeze(factory(
  root.FxCurves||(typeof require==='function'?require('../../template/src/curve-core.js'):null),
  root.FxSpacing||(typeof require==='function'?require('../../template/src/spacing-core.js'):null),
  root.FxPath||(typeof require==='function'?require('../../template/src/path-core.js'):null),
  root.FxColors||(typeof require==='function'?require('../../template/src/color-core.js'):null)));
 if(typeof module==='object'&&module.exports)module.exports=api;else root.FxSplash=api;
})(globalThis,function(Curves,Spacing,Path,Colors){
 'use strict';
 if(!Curves||!Spacing||!Path||!Colors)throw Error('WATER-01 requires exact FX-CORE 01/02/04/08');
 const VERSION=1,DEG=Math.PI/180,LAYERS=Object.freeze(['crown','droplets','mist','ripple']);
 const BUDGETS=Object.freeze({
  low:{maxParticles:160,maxVertices:2048,maxTriangles:2048,sampleSpacingPx:9},
  balanced:{maxParticles:360,maxVertices:8192,maxTriangles:8192,sampleSpacingPx:5},
  high:{maxParticles:800,maxVertices:16384,maxTriangles:16384,sampleSpacingPx:3}
 });
 const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
 function numeric(n,name,a,b,integer=false){
  if(typeof n!=='number'||!Number.isFinite(n)||n<a||n>b||
   (integer&&!Number.isInteger(n)))throw TypeError('WATER-01 invalid '+name);
  return n;
 }
 function strict(v,keys,label){
  if(!v||typeof v!=='object'||Array.isArray(v))throw TypeError('WATER-01 invalid '+label);
  for(const k of Object.keys(v))if(!keys.includes(k))
   throw TypeError('WATER-01 unknown '+label+'.'+k);
 }
 function hash(s){
  let x=2166136261;for(let i=0;i<s.length;i++)
   x=Math.imul(x^s.charCodeAt(i),16777619);
  return x|0;
 }
 function random(seed,i,stream=0){
  let x=(seed^Math.imul(i+1,0x9e3779b1)^Math.imul(stream+1,0x85ebca6b))|0;
  x=Math.imul(x^(x>>>16),0x7feb352d);x=Math.imul(x^(x>>>15),0x846ca68b);
  return ((x^(x>>>16))>>>0)/4294967296;
 }
 function curve(key,domain,entries){
  return Curves.normalize({schemaVersion:1,parameterKey:key,domain,
   inputUnit:domain==='particleAge'?'normalized-lifetime':'normalized-duration',
   valueUnit:'multiplier',inputRange:[0,1],valueRange:[0,3],
   defaultValue:entries[0][1],clamp:'hold',monotonic:false,
   keys:entries.map(([x,y],i)=>({id:'k'+i,x,y,mode:'linear'}))});
 }
 function newEmitter(index=0){
  const layer=(enabled,alpha)=>({enabled,visible:true,x:0,y:0,rotation:0,
   timeOffset:0,alpha,blend:'normal'});
  return {id:'emitter'+(index+1),name:'Impact '+(index+1),
   enabled:true,visible:true,x:index*36,y:0,rotation:0,timeOffset:0,seed:493+index*173,
   anchor:{type:'world',space:'world',name:'',slot:'',x:256,y:350,rotation:0},
   layers:{crown:layer(true,1),droplets:layer(true,1),
    mist:layer(true,.65),ripple:layer(false,.6)}};
 }
 function defaults(){
  return {schemaVersion:1,durationFrames:40,exportFrames:40,loop:false,
   droplets:24,spread:140,gravity:420,launchSpeed:220,dropletSize:6,
   crownHeight:55,rippleRadius:85,openingSpacing:10,openingJitter:.1,
   spatialMode:'even',sprayRate:12,sprayEnabled:false,mistCount:12,
   seed:42022,quality:'balanced',style:'natural',
   burstDensityCurve:curve('burstDensity','effectTime',[[0,1],[.2,.5],[1,0]]),
   dropletSizeCurve:curve('dropletSize','particleAge',[[0,1],[.65,.8],[1,.4]]),
   crownExpansionCurve:curve('crownExpansion','effectTime',[[0,0],[.2,1],[1,.4]]),
   palette:Colors.normalize({schemaVersion:1,parameterKey:'splashColor',
    domain:'particleAge',inputUnit:'normalized-lifetime',space:'srgb',clamp:'hold',
    stops:[{id:'start',position:0,rgba:[225,249,255,1]},
     {id:'middle',position:.55,rgba:[117,211,239,.85]},
     {id:'end',position:1,rgba:[39,135,190,0]}]}),
   emitters:[newEmitter(0)]};
 }
 const fields=Object.keys(defaults());
 const ranges={
  durationFrames:[1,1200],exportFrames:[1,3600],
  droplets:[0,160],spread:[0,360],gravity:[0,1200],
  launchSpeed:[0,800],dropletSize:[1,22],crownHeight:[0,160],
  rippleRadius:[0,250],openingSpacing:[2,50],openingJitter:[0,.45],
  sprayRate:[0,120],mistCount:[0,64],seed:[-2147483648,2147483647]
 };
 const ints=new Set(['durationFrames','exportFrames','droplets','mistCount','seed']);
 function normalize(input){
  strict(input,fields,'settings');
  if(input.schemaVersion!==VERSION)throw TypeError('WATER-01 invalid schema version');
  const c={schemaVersion:VERSION};
  for(const [k,[a,b]] of Object.entries(ranges))
   c[k]=numeric(input[k],k,a,b,ints.has(k));
  for(const key of ['loop','sprayEnabled']){
   if(typeof input[key]!=='boolean')throw TypeError('WATER-01 invalid '+key);
   c[key]=input[key];
  }
  for(const [key,options] of Object.entries({
   spatialMode:['even','random','clustered'],quality:Object.keys(BUDGETS),
   style:['natural','stylized','magical']})){
   if(!options.includes(input[key]))throw TypeError('WATER-01 invalid '+key);
   c[key]=input[key];
  }
  for(const [key,id,domain] of [
   ['burstDensityCurve','burstDensity','effectTime'],
   ['dropletSizeCurve','dropletSize','particleAge'],
   ['crownExpansionCurve','crownExpansion','effectTime']]){
   const v=Curves.normalize(input[key]);
   if(v.parameterKey!==id||v.domain!==domain||v.valueUnit!=='multiplier')
    throw TypeError('WATER-01 incompatible '+key);
   c[key]=v;
  }
  c.palette=Colors.normalize(input.palette);
  if(c.palette.parameterKey!=='splashColor'||c.palette.domain!=='particleAge')
   throw TypeError('WATER-01 invalid palette');
  if(!Array.isArray(input.emitters)||input.emitters.length>4)
   throw TypeError('WATER-01 permits 0–4 emitters');
  c.emitters=[];const ids=new Set();
  for(const item of input.emitters){
   strict(item,['id','name','enabled','visible','x','y','rotation','timeOffset','seed','anchor','layers'],'emitter');
   if(typeof item.id!=='string'||!/^[a-z][\w-]{0,63}$/i.test(item.id)||ids.has(item.id))
    throw TypeError('WATER-01 duplicate/invalid emitter id');
   ids.add(item.id);
   if(typeof item.name!=='string'||!item.name.trim()||item.name.length>128)
    throw TypeError('WATER-01 invalid emitter name');
   for(const k of ['enabled','visible'])
    if(typeof item[k]!=='boolean')throw TypeError('WATER-01 invalid emitter '+k);
   const e={id:item.id,name:item.name,enabled:item.enabled,visible:item.visible,
    x:numeric(item.x,'x',-10000,10000),y:numeric(item.y,'y',-10000,10000),
    rotation:numeric(item.rotation,'rotation',-360,360),
    timeOffset:numeric(item.timeOffset,'timeOffset',-3600,3600,true),
    seed:numeric(item.seed,'seed',-2147483648,2147483647,true)};
   const a=item.anchor;
   strict(a,['type','space','name','slot','x','y','rotation'],'anchor');
   if(!['world','skeleton','bone','slot','attachment'].includes(a.type)||
    !['world','local'].includes(a.space)||typeof a.name!=='string'||
    typeof a.slot!=='string'||(a.type==='attachment'&&!a.slot.trim())||
    (['bone','slot','attachment'].includes(a.type)&&!a.name.trim()))
    throw TypeError('WATER-01 invalid anchor');
   e.anchor={type:a.type,space:a.space,name:a.name,slot:a.slot,
    x:numeric(a.x,'anchor.x',-10000,10000),y:numeric(a.y,'anchor.y',-10000,10000),
    rotation:numeric(a.rotation,'anchor.rotation',-360,360)};
   if(!item.layers||Object.keys(item.layers).sort().join(',')!==[...LAYERS].sort().join(','))
    throw TypeError('WATER-01 needs four independent layers');
   e.layers={};
   for(const kind of LAYERS){
    const l=item.layers[kind];
    strict(l,['enabled','visible','x','y','rotation','timeOffset','alpha','blend'],'layer');
    if(typeof l.enabled!=='boolean'||typeof l.visible!=='boolean'||
     !['normal','add'].includes(l.blend))throw TypeError('WATER-01 invalid layer');
    e.layers[kind]={enabled:l.enabled,visible:l.visible,
     x:numeric(l.x,'layer.x',-10000,10000),
     y:numeric(l.y,'layer.y',-10000,10000),
     rotation:numeric(l.rotation,'layer.rotation',-360,360),
     timeOffset:numeric(l.timeOffset,'layer.timeOffset',-3600,3600,true),
     alpha:numeric(l.alpha,'layer.alpha',0,1),blend:l.blend};
   }
   c.emitters.push(e);
  }
  return c;
 }
 const normalizedTime=(t,p)=>Math.round(((t%p)+p)%p*1e9)/1e9;
 const active=(t,frames)=>t>=0&&t<(frames-1)/60-1e-11;
 const faded=(t,frames)=>clamp(((frames-1)/60-t)/(7/60),0,1);
 const seedFor=(cfg,e)=>(cfg.seed^e.seed^hash(e.id))|0;
 function sprayEvents(c,e){
  if(!c.sprayEnabled||!c.sprayRate)return [];
  const duration=Math.min(20,c.durationFrames-1)/60;
  const rateCurve=Curves.normalize({...c.burstDensityCurve,
   parameterKey:'emissionRate',domain:'emitterTime'});
  const s=Spacing.createTemporalSchedule({schemaVersion:1,mode:'custom',
   frequencySource:'rate',baseRate:c.sprayRate,interval:1/c.sprayRate,
   duration,minInterval:0,jitter:0,burstCount:1,burstDelay:0,
   seed:seedFor(c,e),maxEvents:128,rateCurve,intervalCurve:null});
  return s.events.map((x,i)=>({index:c.droplets+i,time:x.time}));
 }
 function schedule(input,e){
  const c=normalize(input);
  return {impact:Array.from({length:c.droplets},(_,i)=>({index:i,time:0})),
   residual:sprayEvents(c,e),capped:false};
 }
 function opening(c,seed){
  const length=Math.max(2,(Math.max(1,c.droplets)-1)*c.openingSpacing);
  const path={schemaVersion:1,closed:false,segments:[{
   p0:[-length/2,0],p1:[-length/6,0],p2:[length/6,0],p3:[length/2,0]}]};
  return Spacing.createSpatialPlacement({schemaVersion:1,path,
   baseSpacingPx:c.openingSpacing,minSpacing:2,maxSpacing:50,
   mode:c.spatialMode,jitter:c.openingJitter,seed,maxPoints:512,
   pathFollow:'clamp',alignToTangent:true,spacingCurve:null});
 }
 function color(c,t,alpha){
  const col=Colors.sample(c.palette,clamp(t,0,1));
  const mult=c.style==='natural'?[1,1,1]:
   c.style==='stylized'?[1.06,1.04,1.01]:[1.09,.88,1.18];
  return col.slice(0,3).map((v,i)=>clamp(v*mult[i],0,255))
   .concat([col[3]*clamp(alpha,0,1)]);
 }
 function crown(c,t,alpha,seed){
  if(!c.crownHeight||alpha<=0)return [];
  const u=clamp(t/(c.durationFrames/60),0,1);
  const height=c.crownHeight*(.08+.92*Curves.evaluate(c.crownExpansionCurve,u))*
   (c.style==='magical'?1.22:1);
  const width=c.openingSpacing*2.3;
  return Array.from({length:3},(_,i)=>{
   const x=(i-1)*width*1.3;
   const path={schemaVersion:1,closed:false,segments:[{
    p0:[x,0],p1:[x+(i-1)*10,-height*.12],
    p2:[x+(i-1)*16,-height*.8],
    p3:[x+(i-1)*19,-height*(.82+random(seed,i,5)*.24)]}]};
   const out=Path.buildRibbon({path,
    width:{start:6,middle:9,end:0,startTaper:.4,endTaper:1,minVisiblePx:.25,curve:null},
    quality:c.quality,sampleSpacingPx:BUDGETS[c.quality].sampleSpacingPx,
    seed:seed^i,edgeIrregularity:.06});
   return {kind:'mesh',positions:out.positions,indices:out.indices,
    uvs:out.uvs,rgba:color(c,u,alpha)};
  });
 }
 function droplets(c,t,alpha,e,seed,kind){
  const events=kind==='mist'?Array.from({length:c.mistCount},(_,i)=>({
   index:c.droplets+20000+i,time:i/60})):
   schedule(c,e).impact.concat(sprayEvents(c,e));
  const pos=opening(c,seed),points=pos.points,result=[];
  for(const ev of events){
   const age=t-ev.time;
   if(!active(age,c.durationFrames))continue;
   const u=clamp(age/(c.durationFrames/60),0,1);
   const i=kind==='mist'?ev.index-c.droplets-20000:ev.index;
   const angle=(!c.spread?0:
    ((i%Math.max(1,c.droplets))-(Math.max(0,c.droplets-1)/2))/
     Math.max(1,c.droplets-1)*c.spread)*DEG;
   const speed=c.launchSpeed*(kind==='mist'?.3:1)*
    (1+(random(seed,ev.index,1)*2-1)*.08);
   const vx=Math.sin(angle)*speed,vy=-Math.cos(angle)*speed;
   const at=points.length?points[Math.min(points.length-1,Math.floor(
    i/Math.max(1,c.droplets-1)*(points.length-1)))]:null;
   const x0=kind==='mist'?(random(seed,i,21)*2-1)*c.openingSpacing*2:at?.x??0;
   const y0=kind==='mist'?-random(seed,i,22)*8:0;
   const x=x0+vx*age+(kind==='mist'?(random(seed,i,23)*2-1)*age*25:0);
   const y=y0+vy*age+.5*c.gravity*age*age*(kind==='mist'?.45:1);
   const radius=c.dropletSize/2*Curves.evaluate(c.dropletSizeCurve,u)*
    (kind==='mist'?.25:1)*(1+.12*(random(seed,ev.index,7)*2-1));
   if(radius<.03||alpha<=0)continue;
   result.push({kind:'circle',x,y,radius,rgba:color(c,u,alpha*(kind==='mist'?.5:.98)),
    vx,vy,bornAt:ev.time,index:ev.index});
  }
  return result;
 }
 function primitives(c,e,kind,t,seed){
  const l=e.layers[kind],age=t-l.timeOffset/60;
  if(!l.enabled||!l.visible||l.alpha===0||!active(age,c.durationFrames))return [];
  const alpha=l.alpha*faded(age,c.durationFrames);
  if(alpha<=0)return [];
  if(kind==='crown')return crown(c,age,alpha,seed);
  if(kind==='droplets'||kind==='mist')return droplets(c,age,alpha,e,seed,kind);
  if(!c.rippleRadius)return [];
  const u=clamp(age/((c.durationFrames-1)/60),0,1);
  return [{kind:'ring',x:0,y:0,radius:c.rippleRadius*u,
   thickness:Math.max(.5,3*(1-u)),rgba:color(c,u,alpha*(1-u))}];
 }
 function sample(input,seconds){
  const c=normalize(input);
  numeric(seconds,'seconds',0,1e8);
  const period=c.durationFrames/60;
  const time=c.loop?normalizedTime(seconds,period):seconds;
  if(!active(time,c.durationFrames))
   return {schemaVersion:1,time,frame:time*60,emitters:[],diagnostics:[]};
  let particles=0,vertices=0,triangles=0;
  const emitters=[];
  for(const e of c.emitters){
   const local=time-e.timeOffset/60;
   if(!e.enabled||!e.visible||!active(local,c.durationFrames))continue;
   const layers={};
   for(const kind of LAYERS){
    layers[kind]=primitives(c,e,kind,local,seedFor(c,e));
    if(kind==='mist'||kind==='droplets')particles+=layers[kind].length;
    for(const item of layers[kind])if(item.kind==='mesh'){
     vertices+=item.positions.length/2;
     triangles+=item.indices.length/3;
    }
   }
   emitters.push({id:e.id,layers});
  }
  const b=BUDGETS[c.quality];
  if(particles>b.maxParticles||vertices>b.maxVertices||triangles>b.maxTriangles)
   throw RangeError('WATER-01 quality budget overflow '+particles+'/'+
    vertices+'/'+triangles+' > '+b.maxParticles+'/'+b.maxVertices+'/'+b.maxTriangles);
  return {schemaVersion:1,time,frame:time*60,emitters,diagnostics:[]};
 }
 function bounds(frame,anchors,settings){
  const c=normalize(settings),b={empty:true,inside:true,
   minX:Infinity,minY:Infinity,maxX:-Infinity,maxY:-Infinity};
  for(const entry of frame.emitters){
   const e=c.emitters.find(x=>x.id===entry.id),a=anchors?.[entry.id];
   if(!e||!a)continue;
   const mainAngle=(e.rotation+e.anchor.rotation)*DEG;
   for(const kind of LAYERS){
    const layer=e.layers[kind],angle=mainAngle+layer.rotation*DEG,
     co=Math.cos(angle),si=Math.sin(angle);
    const mainCo=Math.cos(mainAngle),mainSi=Math.sin(mainAngle);
    const ox=a.x+(e.x+layer.x)*mainCo-(e.y+layer.y)*mainSi,
     oy=a.y+(e.x+layer.x)*mainSi+(e.y+layer.y)*mainCo;
    for(const item of entry.layers[kind]){
     const points=item.kind==='mesh'?
      Array.from({length:item.positions.length/2},(_,i)=>
       [item.positions[i*2],item.positions[i*2+1],0]):
       [[item.x,item.y,item.radius||0]];
     for(const [x,y,r] of points){
      const X=ox+x*co-y*si,Y=oy+x*si+y*co;
      b.empty=false;
      b.minX=Math.min(b.minX,X-r);b.minY=Math.min(b.minY,Y-r);
      b.maxX=Math.max(b.maxX,X+r);b.maxY=Math.max(b.maxY,Y+r);
     }
    }
   }
  }
  if(!b.empty)b.inside=b.minX>=0&&b.minY>=0&&b.maxX<=512&&b.maxY<=512;
  return b;
 }
 return Object.freeze({VERSION,LAYERS,BUDGETS,defaults,newEmitter,normalize,
  schedule,sample,bounds,random});
});
