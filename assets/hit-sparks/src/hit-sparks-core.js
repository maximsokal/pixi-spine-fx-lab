// GAME-02 H01: pure immutable, absolute-time Hit Sparks sampler.
(function(root,make){
 'use strict';
 const api=Object.freeze(make(
  root.FxCurves||(typeof require==='function'?require('../../template/src/curve-core.js'):null),
  root.FxSpacing||(typeof require==='function'?require('../../template/src/spacing-core.js'):null),
  root.FxColors||(typeof require==='function'?require('../../template/src/color-core.js'):null)));
 if(typeof module==='object'&&module.exports)module.exports=api;else root.FxHitSparks=api;
})(globalThis,function(C,S,Col){
 'use strict';
 if(!C||!S||!Col)throw Error('Hit Sparks requires shared curves, spacing and colors');
 const FPS=60,RAD=Math.PI/180,LAYERS=Object.freeze(['flash','primary','dust']),CAPS=Object.freeze({flash:1,primary:140,dust:70}),N=1024;
 const fail=k=>{throw TypeError('Invalid hit sparks '+k);};
 const num=(v,k,a,b,int=false)=>{if(!Number.isFinite(v)||v<a||v>b||(int&&!Number.isInteger(v)))fail(k);return v;};
 const choice=(v,k,values)=>{if(!values.includes(v))fail(k);return v;};
 const bool=(v,k)=>{if(typeof v!=='boolean')fail(k);return v;};
 function exact(v,keys,k){if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).length!==keys.length||keys.some(x=>!Object.hasOwn(v,x)))fail(k);}
 function dense(v){if(Array.isArray(v)){for(let i=0;i<v.length;i++){if(!Object.hasOwn(v,i))fail('sparse array');dense(v[i]);}}else if(v&&typeof v==='object')Object.values(v).forEach(dense);}
 function freeze(v){if(v&&typeof v==='object'&&!Object.isFrozen(v)){Object.values(v).forEach(freeze);Object.freeze(v);}return v;}
 const specs={
  burstRate:['effectTime','normalized-duration','normalized',0,3,[[0,1],[.15,.8],[.3,0],[1,0]]],
  burstInterval:['effectTime','normalized-duration','multiplier',.05,4,[[0,1],[1,1]]],
  sparkSpeed:['particleAge','normalized-lifetime','normalized',0,4,[[0,1],[.5,.55],[1,0]]],
  widthTaper:['pathPosition','normalized-path','normalized',0,2,[[0,1],[.6,.6],[1,0]]],
  alpha:['particleAge','normalized-lifetime','normalized',0,1,[[0,1],[.4,1],[1,0]]],
  spacingPx:['pathPosition','normalized-path','px',1,35,[[0,7],[1,7]]]
 };
 function curve(k){const [domain,inputUnit,valueUnit,min,max,points]=specs[k];return C.normalize({schemaVersion:1,parameterKey:k,domain,inputUnit,valueUnit,inputRange:[0,1],valueRange:[min,max],defaultValue:points[0][1],clamp:'hold',monotonic:false,keys:points.map(([x,y],i)=>({id:'k'+i,x,y,mode:'linear'}))});}
 function gradient(k){return Col.normalize({schemaVersion:1,parameterKey:k+'Palette',domain:'particleAge',inputUnit:'normalized-lifetime',space:'srgb',clamp:'hold',stops:[{id:'hot',position:0,rgba:[255,255,255,1]},{id:'warm',position:1,rgba:[255,200,107,1]}]});}
 const ranges={burstCount:[0,140,true],spread:[0,360],initialSpeed:[0,900],sparkLength:[2,80],width:[.5,12],durationFrames:[1,120,true],
  dustCount:[0,70,true],dustDelayFrames:[2,6,true],flashFrames:[1,120,true],flashRadius:[1,80],staggerFrames:[0,120,true],minInterval:[0,2],timeJitter:[0,.45],
  gap:[1,35],minGap:[1,35],maxGap:[1,35],spatialJitter:[0,.45],collisionNormal:[-360,360],exportFrames:[1,3600,true]};
 function defaults(){return {schemaVersion:1,burstCount:20,spread:170,initialSpeed:250,sparkLength:18,width:2,durationFrames:16,dustCount:10,dustDelayFrames:4,flashFrames:4,flashRadius:10,staggerFrames:0,minInterval:0,timeJitter:0,gap:7,minGap:1,maxGap:35,spatialJitter:0,collisionNormal:0,exportFrames:40,frequencySource:'rate',spatialMode:'even',spacingCurveEnabled:false,curves:Object.fromEntries(Object.keys(specs).map(k=>[k,curve(k)])),palettes:Object.fromEntries(LAYERS.map(k=>[k,gradient(k)])),layers:Object.fromEntries(LAYERS.map((k,i)=>[k,{enabled:true,x:0,y:0,rotation:0,delayFrames:0,seed:31415+i,opacity:1,blend:'normal'}]))};}
 function normalize(v){
  exact(v,['schemaVersion',...Object.keys(ranges),'frequencySource','spatialMode','spacingCurveEnabled','curves','palettes','layers'],'settings');
  if(v.schemaVersion!==1)fail('schemaVersion');
  const out={schemaVersion:1};for(const [k,r] of Object.entries(ranges))out[k]=num(v[k],k,...r);
  if(out.minGap>out.maxGap)fail('gap bounds');
  out.frequencySource=choice(v.frequencySource,'frequencySource',['rate','interval']);
  out.spatialMode=choice(v.spatialMode,'spatialMode',['even','random','stratified','clustered']);
  out.spacingCurveEnabled=bool(v.spacingCurveEnabled,'spacingCurveEnabled');
  exact(v.curves,Object.keys(specs),'curves');out.curves=Object.fromEntries(Object.keys(specs).map(k=>{
   dense(v.curves[k]);const c=C.normalize(v.curves[k]),[d,u,vu,min,max]=specs[k];
   if(c.parameterKey!==k||c.domain!==d||c.inputUnit!==u||c.valueUnit!==vu||c.valueRange[0]!==min||c.valueRange[1]!==max||c.clamp!=='hold')fail(k+' binding');
   return [k,c];
  }));
  exact(v.palettes,LAYERS,'palettes');out.palettes=Object.fromEntries(LAYERS.map(k=>{dense(v.palettes[k]);const p=Col.normalize(v.palettes[k]);if(p.parameterKey!==k+'Palette'||p.domain!=='particleAge')fail(k+' palette');return [k,p];}));
  exact(v.layers,LAYERS,'layers');out.layers=Object.fromEntries(LAYERS.map(k=>{const l=v.layers[k];exact(l,['enabled','x','y','rotation','delayFrames','seed','opacity','blend'],k);return [k,{enabled:bool(l.enabled,k),x:num(l.x,k,-10000,10000),y:num(l.y,k,-10000,10000),rotation:num(l.rotation,k,-360,360),delayFrames:num(l.delayFrames,k,0,120,true),seed:num(l.seed,k,-2147483648,2147483647,true),opacity:num(l.opacity,k,0,1),blend:choice(l.blend,k,['normal','add'])}];}));
  return out;
 }
 function rand(seed,index,salt){let n=(seed^Math.imul(index+1,0x9e3779b1)^Math.imul(salt+1,0x85ebca6b))|0;n=Math.imul(n^(n>>>16),0x7feb352d);n=Math.imul(n^(n>>>15),0x846ca68b);return ((n^(n>>>16))>>>0)/4294967296;}
 function integral(fn){const a=[0];for(let i=0;i<N;i++)a.push(a[i]+fn((i+.5)/N)/N);return a;}
 function valueAt(a,u){const x=u*N,i=Math.min(N-1,Math.floor(x));return a[i]+(a[i+1]-a[i])*(x-i);}
 function inverse(a,target){let lo=0,hi=N;while(lo+1<hi){const m=(lo+hi)>>1;if(a[m]<target)lo=m;else hi=m;}return (lo+(a[hi]>a[lo]?(target-a[lo])/(a[hi]-a[lo]):0))/N;}
 // A single simultaneous birth group is distinct from a strictly ordered
 // stagger schedule. Rejected groups never leak into the next playback loop.
 function schedule(c,count,seed,delay){
  const a=integral(u=>c.frequencySource==='rate'?C.evaluate(c.curves.burstRate,u):1/C.evaluate(c.curves.burstInterval,u));
  const total=a[N],events=[];
  if(!count||total<=0)return {events,rejected:count};
  const window=c.staggerFrames/FPS;
  if(!window)return {events:Array.from({length:count},(_,index)=>({index,time:delay})),rejected:0};
  const first=(a.findIndex(v=>v>0)-1)/N;
  const slots=Array.from({length:count},(_,i)=>i===0?first*window:inverse(a,total*i/count)*window);
  let prev=-Infinity;
  for(let i=0;i<count;i++){
   const gap=Math.min(i?slots[i]-slots[i-1]:0,i+1<count?slots[i+1]-slots[i]:window-slots[i]);
   const time=slots[i]+(2*rand(seed,i,1)-1)*gap*c.timeJitter;
   if(time<=prev+1e-12||time+1e-12<prev+c.minInterval)continue;
   events.push({index:i,time:delay+time});prev=time;
  }
  return {events,rejected:count-events.length};
 }
 function placement(c,count,seed){
  if(!count)return {distances:[],reused:0};
  if(count===1)return {distances:[0],reused:0};
  const span=Math.min(512,(count-1)*c.gap),path={schemaVersion:1,closed:false,segments:[{p0:[0,0],p1:[span/3,0],p2:[span*2/3,0],p3:[span,0]}]};
  const p=S.createSpatialPlacement({path,baseSpacingPx:c.gap,minSpacing:c.minGap,maxSpacing:c.maxGap,spacingCurve:c.spacingCurveEnabled?c.curves.spacingPx:null,mode:c.spatialMode,jitter:c.spatialJitter,seed,maxPoints:count-1});
  const distances=[0,...p.points.map(x=>Math.min(span,x.distance))],center=distances.at(-1)/2;
  return {distances:distances.map(x=>x-center),reused:Math.max(0,count-distances.length)};
 }
 function compile(input){
  const settings=freeze(normalize(input)),c=settings;
  const timing={},positions={};
  for(const k of ['primary','dust']){
   const count=k==='primary'?c.burstCount:c.dustCount,seed=c.layers[k].seed;
   timing[k]=schedule(c,count,seed,k==='dust'?c.dustDelayFrames/FPS:0);
   positions[k]=placement(c,count,seed);
  }
  const meta=freeze({timing,positions,primitiveCap:211});
  const speed=integral(u=>C.evaluate(c.curves.sparkSpeed,u)),taper=Array.from({length:9},(_,i)=>C.evaluate(c.curves.widthTaper,i/8));
  const defaultPoses=freeze(Object.fromEntries(LAYERS.map(k=>[k,{x:256,y:256,rotation:0}])));
  function sample(seconds,layerPoses=defaultPoses){
   num(seconds,'time',0,3600);if(!layerPoses||typeof layerPoses!=='object'||Array.isArray(layerPoses))fail('poses');
   const result={flash:[],primary:[],dust:[]};
   for(const k of LAYERS){
    const l=c.layers[k],p=Object.hasOwn(layerPoses,k)?layerPoses[k]:null,t=seconds-l.delayFrames/FPS;
    if(!l.enabled||!l.opacity||p==null||t<0)continue;
    const r=num(p.rotation,'pose rotation',-360000,360000)*RAD,x=num(p.x,'pose x',-900000,900000)+l.x*Math.cos(r)-l.y*Math.sin(r),y=num(p.y,'pose y',-900000,900000)+l.x*Math.sin(r)+l.y*Math.cos(r);
    const axis=r+(l.rotation+c.collisionNormal)*RAD;
    function rgba(age){const a=Col.sample(c.palettes[k],age);a[3]*=l.opacity*C.evaluate(c.curves.alpha,age);return a;}
    if(k==='flash'){
     const life=c.flashFrames/FPS;if(t>=life-1e-12)continue;
     const age=t/life,color=rgba(age);if(!color[3])continue;
     const radius=c.flashRadius*(1-.5*age),vertices=Array.from({length:12},(_,i)=>{const a=axis+i*Math.PI/6,rr=radius*(i%2?.45:.85+.15*rand(l.seed,i,3));return {x:x+rr*Math.cos(a),y:y+rr*Math.sin(a)};});
     result.flash.push({x,y,age,vertices,rgba:color,blend:l.blend});continue;
    }
    const life=c.durationFrames/FPS,ds=positions[k].distances;
    for(const e of timing[k].events){
     const dt=t-e.time;if(dt<0||dt>=life-1e-12)continue;
     const age=dt/life,color=rgba(age);if(!color[3])continue;
     const a=axis+(rand(l.seed,e.index,2)-.5)*c.spread*RAD,dist=c.initialSpeed*(k==='dust'?.35:1)*life*valueAt(speed,age),offset=ds[e.index%ds.length];
     const ox=x-Math.sin(axis)*offset,oy=y+Math.cos(axis)*offset,hx=ox+dist*Math.cos(a),hy=oy+dist*Math.sin(a);
     const base={index:e.index,age,x:hx,y:hy,origin:{x:ox,y:oy},angle:a/RAD,rgba:color,blend:l.blend};
     if(k==='dust'){result.dust.push({...base,radius:c.width*.5*(1-.5*age)});continue;}
     const vertices=[];for(let i=0;i<taper.length;i++){const d=c.sparkLength*i/(taper.length-1),w=c.width*taper[i]/2,px=hx-d*Math.cos(a),py=hy-d*Math.sin(a);vertices.push({x:px-w*Math.sin(a),y:py+w*Math.cos(a)},{x:px+w*Math.sin(a),y:py-w*Math.cos(a)});}
     result.primary.push({...base,vertices});
    }
   }
   return result;
  }
  return Object.freeze({settings,meta,sample});
 }
 function serialize(v){return JSON.stringify(normalize(v));}
 function deserialize(s){if(typeof s!=='string'||s.length>262144)fail('preset text');return normalize(JSON.parse(s));}
 return {VERSION:1,FPS,LAYERS,CAPS,defaults,normalize,compile,serialize,deserialize};
});
