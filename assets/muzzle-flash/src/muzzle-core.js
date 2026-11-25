// GAME-01 M01b: canonical settings and pure, compiled absolute-time sampler.
(function(root,make){
 'use strict';
 const load=(name,path)=>root[name]||(typeof require==='function'?require(path):null);
 const api=Object.freeze(make(load('FxCurves','../../template/src/curve-core.js'),
  load('FxSpacing','../../template/src/spacing-core.js'),load('FxColors','../../template/src/color-core.js'),
  load('FxMuzzleGeometry','./muzzle-geometry.js')));
 if(typeof module==='object'&&module.exports)module.exports=api;else root.FxMuzzle=api;
})(globalThis,function(C,S,COL,G){
 'use strict';
 if(!C||!S||!COL||!G)throw Error('Muzzle requires shared curves, spacing, colors and geometry');
 const FPS=60,RAD=Math.PI/180,LAYERS=Object.freeze(['core','tongues','sparks']);
 const specs={
  flashAlpha:['effectTime','normalized-duration','normalized',0,1,[[0,1],[.35,.8],[1,0]]],
  flashWidth:['pathPosition','normalized-path','normalized',0,2,[[0,.9],[.3,1],[1,0]]],
  sparkSpeed:['particleAge','normalized-lifetime','normalized',0,4,[[0,1],[1,.1]]],
  emissionRate:['emitterTime','normalized-duration','normalized',0,3,[[0,1],[1,1]]],
  spacingPx:['pathPosition','normalized-path','px',1,30,[[0,7],[1,7]]]
 };
 function fail(k){throw TypeError('Invalid muzzle '+k);}
 function exact(o,keys,k){
  if(!o||typeof o!=='object'||Array.isArray(o)||Object.keys(o).length!==keys.length||
   keys.some(x=>!Object.hasOwn(o,x)))fail(k);
 }
 function scalar(v,k,min,max,int=false){
  if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max||(int&&!Number.isInteger(v)))fail(k);return v;
 }
 function bool(v,k){if(typeof v!=='boolean')fail(k);return v;}
 function choice(v,k,values){if(!values.includes(v))fail(k);return v;}
 function dense(a,k){if(!Array.isArray(a))fail(k);for(let i=0;i<a.length;i++)if(!Object.hasOwn(a,i))fail(k);return a;}
 function curveDefault(key){
  const [domain,inputUnit,valueUnit,min,max,points]=specs[key];
  return C.normalize({schemaVersion:1,parameterKey:key,domain,inputUnit,valueUnit,inputRange:[0,1],
   valueRange:[min,max],defaultValue:points[0][1],clamp:'hold',monotonic:false,
   keys:points.map(([x,y],i)=>({id:'key'+i,x,y,mode:'linear'}))});
 }
 function gradient(key,domain){
  return COL.normalize({schemaVersion:1,parameterKey:key,domain,
   inputUnit:domain==='particleAge'?'normalized-lifetime':'normalized-duration',space:'srgb',clamp:'hold',
   stops:[{id:'hot',position:0,rgba:[255,249,216,1]},{id:'warm',position:1,rgba:[255,187,89,1]}]});
 }
 function defaults(){
  return {schemaVersion:1,flashLength:65,coneAngle:35,flashWidth:20,flashDuration:6,tongueCount:5,sparkCount:8,
   sparkLifeFrames:6,sparkSpeed:180,burstFrames:2,minInterval:0,timeJitter:0,rateCurveEnabled:false,
   tongueGap:7,minGap:1,maxGap:30,spatialMode:'even',spatialJitter:0,spacingCurveEnabled:false,
   exportFrames:40,curves:Object.fromEntries(Object.keys(specs).map(k=>[k,curveDefault(k)])),
   palette:gradient('flashPalette','effectTime'),sparkPalette:gradient('sparkPalette','particleAge'),
   layers:Object.fromEntries(LAYERS.map((k,i)=>[k,{enabled:true,x:0,y:0,rotation:0,delayFrames:0,seed:31415+i,opacity:1}]))};
 }
 const ranges={flashLength:[8,260],coneAngle:[5,150],flashWidth:[2,100],flashDuration:[1,24,true],
  tongueCount:[1,20,true],sparkCount:[0,50,true],sparkLifeFrames:[1,60,true],sparkSpeed:[0,10000],
  burstFrames:[1,24,true],minInterval:[0,1],timeJitter:[0,.45],tongueGap:[1,30],minGap:[1,30],
  maxGap:[1,30],spatialJitter:[0,.45],exportFrames:[1,3600,true]};
 const keys=['schemaVersion',...Object.keys(ranges),'rateCurveEnabled','spacingCurveEnabled','spatialMode',
  'curves','palette','sparkPalette','layers'];
 function readCurve(v,k){
  if(!v||typeof v!=='object')fail(k);
  dense(v.inputRange,k);dense(v.valueRange,k);
  for(const q of dense(v.keys,k)){if(!q||typeof q!=='object')fail(k);for(const h of ['in','out'])if(q[h]!=null)dense(q[h],k);}
  const c=C.normalize(v),[domain,inputUnit,valueUnit,min,max]=specs[k];
  if(c.parameterKey!==k||c.domain!==domain||c.inputUnit!==inputUnit||c.valueUnit!==valueUnit||
   c.valueRange[0]!==min||c.valueRange[1]!==max||c.clamp!=='hold')fail(k+' binding');
  return c;
 }
 function readGradient(v,key,domain){
  if(!v||typeof v!=='object')fail(key);
  for(const q of dense(v.stops,key)){if(!q||typeof q!=='object')fail(key);dense(q.rgba,key);}
  const p=COL.normalize(v);if(p.parameterKey!==key||p.domain!==domain)fail(key+' binding');return p;
 }
 function normalize(input){
  exact(input,keys,'settings');if(input.schemaVersion!==1)fail('schemaVersion');
  const out={schemaVersion:1};
  for(const [k,r] of Object.entries(ranges))out[k]=scalar(input[k],k,...r);
  if(out.minGap>out.maxGap)fail('gap bounds');
  for(const k of ['rateCurveEnabled','spacingCurveEnabled'])out[k]=bool(input[k],k);
  out.spatialMode=choice(input.spatialMode,'spatialMode',['even','random','stratified','clustered']);
  exact(input.curves,Object.keys(specs),'curves');
  out.curves=Object.fromEntries(Object.keys(specs).map(k=>[k,readCurve(input.curves[k],k)]));
  out.palette=readGradient(input.palette,'flashPalette','effectTime');
  out.sparkPalette=readGradient(input.sparkPalette,'sparkPalette','particleAge');
  exact(input.layers,LAYERS,'layers');
  out.layers=Object.fromEntries(LAYERS.map(k=>{
   const v=input.layers[k];exact(v,['enabled','x','y','rotation','delayFrames','seed','opacity'],k);
   return [k,{enabled:bool(v.enabled,k),x:scalar(v.x,k,-10000,10000),y:scalar(v.y,k,-10000,10000),
    rotation:scalar(v.rotation,k,-360,360),delayFrames:scalar(v.delayFrames,k,0,60,true),
    seed:scalar(v.seed,k,-2147483648,2147483647,true),opacity:scalar(v.opacity,k,0,1)}];
  }));
  return out;
 }
 function freeze(o){if(o&&typeof o==='object'&&!Object.isFrozen(o)){Object.values(o).forEach(freeze);Object.freeze(o);}return o;}
 function compile(input){
  const cfg=freeze(normalize(input)),span=cfg.flashLength*cfg.coneAngle*RAD;
  // An exact linear arc-length coordinate, not a geometric approximation of the circle.
  const path={schemaVersion:1,closed:false,segments:[{p0:[0,0],p1:[span/3,0],p2:[2*span/3,0],p3:[span,0]}]};
  const placement=S.createSpatialPlacement({path,mode:cfg.spatialMode,baseSpacingPx:cfg.tongueGap,
   minSpacing:cfg.minGap,maxSpacing:cfg.maxGap,jitter:cfg.spatialJitter,seed:cfg.layers.tongues.seed,
   maxPoints:cfg.tongueCount,spacingCurve:cfg.spacingCurveEnabled?cfg.curves.spacingPx:null});
  const ds=placement.points.map(p=>Math.min(span,p.distance));
  if(!ds.length)ds.push(span/2);else{
   const shift=(span-ds[0]-ds.at(-1))/2;
   for(let i=0;i<ds.length;i++)ds[i]+=shift;
  }
  const window=Math.min(cfg.burstFrames,cfg.flashDuration)/FPS;
  let events=[],capped=false;
  // Ignition spark at zero; additional births are a shared intensity timetable.
  // Count is a hard upper bound. Min interval applies across the ignition boundary.
  if(cfg.sparkCount){
   events.push({index:0,time:0});
   if(cfg.sparkCount>1){
    const schedule=S.createTemporalSchedule({mode:cfg.rateCurveEnabled?'custom':'uniform',
     baseRate:(cfg.sparkCount-1)/window,duration:window,minInterval:cfg.minInterval,
     jitter:cfg.timeJitter,seed:cfg.layers.sparks.seed,maxEvents:cfg.sparkCount-1,
     rateCurve:cfg.rateCurveEnabled?cfg.curves.emissionRate:null});
    capped=schedule.capped;
    for(const e of schedule.events)if(e.time>0&&e.time+1e-12>=events.at(-1).time+cfg.minInterval)
     events.push({index:e.index+1,time:e.time});
   }
  }
  const widths=Array.from({length:17},(_,i)=>C.evaluate(cfg.curves.flashWidth,i/16));
  // Integrate speed once per preset; sample the cumulative normalized-age integral.
  const N=256,integral=[0];
  for(let i=0;i<N;i++)integral.push(integral[i]+C.evaluate(cfg.curves.sparkSpeed,(i+.5)/N)/N);
  function meanSpeed(age){
   if(age===0)return C.evaluate(cfg.curves.sparkSpeed,0);
   const x=age*N,i=Math.min(N-1,Math.floor(x));
   return (integral[i]+(integral[i+1]-integral[i])*(x-i))/age;
  }
  const meta=freeze({tongueDistances:ds,events,spatialCapped:placement.capped,
   spatialLimited:ds.length<cfg.tongueCount,temporalCapped:capped});
  function sample(seconds,anchor={x:256,y:256,rotation:0}){
   scalar(seconds,'time',0,3600);
   if(!anchor||typeof anchor!=='object')fail('anchor');
   const ax=scalar(anchor.x,'anchor.x',-900000,900000),ay=scalar(anchor.y,'anchor.y',-900000,900000),
    rotation=scalar(anchor.rotation,'anchor.rotation',-359640,359640),theta=rotation*RAD;
   const result={core:[],tongues:[],sparks:[]};
   for(const k of LAYERS){
    const l=cfg.layers[k],t=seconds-l.delayFrames/FPS;
    if(!l.enabled||!l.opacity||t<0)continue;
    const frame={x:ax+l.x*Math.cos(theta)-l.y*Math.sin(theta),y:ay+l.x*Math.sin(theta)+l.y*Math.cos(theta),
     rotation:rotation+l.rotation,length:cfg.flashLength,width:cfg.flashWidth,coneAngle:cfg.coneAngle};
    if(k==='sparks'){
     const life=cfg.sparkLifeFrames/FPS;
     for(const e of meta.events){
      const dt=t-e.time;if(dt<0||dt>=life-1e-9)continue;
      const age=dt/life,rgba=COL.sample(cfg.sparkPalette,age),alpha=l.opacity*rgba[3];
      if(!alpha)continue;
      const p=G.sparks({...frame,alpha,life,speed:cfg.sparkSpeed,seed:l.seed},[e],t,meanSpeed(age))[0];
      if(p)result.sparks.push({...p,rgba:[rgba[0],rgba[1],rgba[2],p.alpha]});
     }
    }else{
     const duration=cfg.flashDuration/FPS;
     if(t>=duration-1e-9)continue;
     const u=t/duration,rgba=COL.sample(cfg.palette,u),alpha=l.opacity*rgba[3]*C.evaluate(cfg.curves.flashAlpha,u);
     if(!alpha)continue;
     const color=[rgba[0],rgba[1],rgba[2],alpha];
     if(k==='core')result.core.push({vertices:G.ribbon({...frame,alpha},widths),rgba:color});
     else result.tongues=G.tongues({...frame,alpha},meta.tongueDistances,l.seed).map(p=>({...p,rgba:color.slice()}));
    }
   }
   return result;
  }
  return Object.freeze({settings:cfg,meta,sample});
 }
 function serialize(input){return JSON.stringify(normalize(input));}
 function deserialize(text){if(typeof text!=='string'||text.length>262144)fail('preset text');return normalize(JSON.parse(text));}
 return {VERSION:1,LAYERS,defaults,normalize,serialize,deserialize,compile};
});
