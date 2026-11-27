// EARTH-01 G01: pure compiled ground impact; 60 Hz authored one-shot.
(function(root,factory){
 const api=Object.freeze(factory(
  root.FxCurves||(typeof require==='function'?require('../../template/src/curve-core.js'):null),
  root.FxSpacing||(typeof require==='function'?require('../../template/src/spacing-core.js'):null),
  root.FxColors||(typeof require==='function'?require('../../template/src/color-core.js'):null)));
 if(typeof module==='object'&&module.exports)module.exports=api;else root.FxGroundImpact=api;
})(globalThis,function(C,S,K){
 'use strict';
 if(!C||!S||!K)throw Error('Ground Impact requires curves, spacing and colors');
 const VERSION=1,FPS=60,FRAMES=40,END=39/FPS,TAU=2*Math.PI,MAX_EVENTS=4096,MAX_BAND_RADIUS=280;
 const LAYERS=Object.freeze(['ring','debris','dust']),BUDGETS=Object.freeze({low:96,balanced:256,high:512});
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),fail=m=>{throw RangeError('EARTH-01 '+m);};
 const finite=(v,k,a,b,i=false)=>{if(typeof v!=='number'||!Number.isFinite(v)||v<a||v>b||(i&&!Number.isInteger(v)))fail('invalid '+k);return v;};
 const choice=(v,k,a)=>{if(!a.includes(v))fail('invalid '+k);return v;},bool=(v,k)=>{if(typeof v!=='boolean')fail('invalid '+k);return v;};
 function shape(v,keys,k){if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).length!==keys.length||keys.some(n=>!Object.hasOwn(v,n)))fail('invalid '+k+' fields');}
 function dense(v){if(Array.isArray(v)){for(let i=0;i<v.length;i++){if(!Object.hasOwn(v,i))fail('sparse array');dense(v[i]);}}else if(v&&typeof v==='object'){for(const x of Object.values(v))dense(x);}}
 function freeze(v){if(v&&typeof v==='object'&&!Object.isFrozen(v)){Object.values(v).forEach(freeze);Object.freeze(v);}return v;}
 function rand(seed,index,salt){let x=seed^Math.imul(index+1,0x9e3779b1)^Math.imul(salt+1,0x85ebca6b);x=Math.imul(x^(x>>>16),0x7feb352d);x=Math.imul(x^(x>>>15),0x846ca68b);return ((x^(x>>>16))>>>0)/4294967296;}
 const ranges={debrisCount:[0,160,true],impactRadius:[8,280],gravity:[0,1300],debrisSize:[2,45],dustDensity:[0,1],launchSpeed:[0,750],planeRatio:[.05,1],planeAngle:[-360,360],ringWidth:[.5,60],originGapPx:[4,60],spacingPx:[4,60],minGapPx:[.25,60],spatialJitter:[0,.45],dustRate:[0,300],dustInterval:[1/300,60],dustEndFrame:[0,38,true],minIntervalFrames:[0,38],timeJitter:[0,.45],seed:[-2147483648,2147483647,true]};
 const specs={
  radius:['shockRadius','effectTime','multiplier',[0,1],[[0,0],[.2,1],[1,1]]],
  dustOpacity:['dustOpacity','particleAge','multiplier',[0,1],[[0,.8],[.6,.5],[1,0]]],
  debrisSpeed:['debrisSpeed','particleAge','multiplier',[0,4],[[0,1],[1,.2]]],
  rate:['emissionRate','emitterTime','multiplier',[0,4],[[0,1],[1,1]]],
  interval:['emissionInterval','emitterTime','multiplier',[.05,4],[[0,1],[1,1]]],
  spacing:['spacingPx','pathPosition','px',[.25,60],[[0,12],[1,12]]]
 };
 const unit=d=>d==='particleAge'?'normalized-lifetime':d==='pathPosition'?'normalized-path':'normalized-duration';
 function curve(k){const [parameterKey,domain,valueUnit,valueRange,points]=specs[k];return C.normalize({schemaVersion:1,parameterKey,domain,inputUnit:unit(domain),valueUnit,inputRange:[0,1],valueRange:valueRange.slice(),defaultValue:points[0][1],clamp:'hold',monotonic:false,keys:points.map(([x,y],i)=>({id:'k'+i,x,y,mode:'linear'}))});}
 function palette(k){const domain=k==='ring'?'effectTime':'particleAge';return K.normalize({schemaVersion:1,parameterKey:k+'Color',domain,inputUnit:unit(domain),space:'srgb',clamp:'hold',stops:[{id:'start',position:0,rgba:[183,161,138,1]},{id:'end',position:1,rgba:[116,97,82,1]}]});}
 const anchor=(type='world')=>({type,name:'',slot:''});
 function defaults(){return {schemaVersion:1,mode:'oneShot',durationFrames:FRAMES,quality:'balanced',seed:7311,debrisCount:35,impactRadius:90,gravity:500,debrisSize:13,dustDensity:.65,launchSpeed:210,planeRatio:.3,planeAngle:0,ringWidth:8,originGapPx:12,spacingPx:12,minGapPx:4,spatialJitter:0,distribution:'even',spacingCurveEnabled:false,trailingDustEnabled:true,frequencySource:'rate',dustRate:10,dustInterval:.1,dustEndFrame:18,minIntervalFrames:0,timeJitter:0,contact:{id:'contact',x:256,y:320,rotation:0,anchor:anchor()},layers:Object.fromEntries(LAYERS.map((k,i)=>[k,{id:k,enabled:true,visible:true,x:k==='dust'?256:0,y:k==='dust'?320:0,rotation:0,opacity:1,delayFrames:0,seed:31+i*97,blend:'normal',order:k==='ring'?'behind':'front',anchor:anchor(k==='dust'?'world':'inherit')} ])),curves:Object.fromEntries(Object.keys(specs).map(k=>[k,curve(k)])),palettes:Object.fromEntries(LAYERS.map(k=>[k,palette(k)]))};}
 function normAnchor(a,layer){shape(a,['type','name','slot'],'anchor');choice(a.type,'anchor type',['world','local','bone','slot','attachment',...(layer?['inherit']:[])]);if(typeof a.name!=='string'||typeof a.slot!=='string'||a.name.length>256||a.slot.length>256)fail('anchor name');if(['bone','slot','attachment'].includes(a.type)?!a.name.trim():a.name!=='')fail('anchor name');if(a.type==='attachment'?!a.slot.trim():a.slot!=='')fail('anchor slot');return {...a};}
 function transform(v){return {x:finite(v.x,'x',-10000,10000),y:finite(v.y,'y',-10000,10000),rotation:finite(v.rotation,'rotation',-360,360)};}
 function normalize(input){
  const d=defaults();shape(input,Object.keys(d),'preset');dense(input);
  if(input.schemaVersion!==VERSION||input.mode!=='oneShot'||input.durationFrames!==FRAMES)fail('version/mode/duration');
  const c={...d};for(const [k,v] of Object.entries(ranges))c[k]=finite(input[k],k,...v);
  c.quality=choice(input.quality,'quality',Object.keys(BUDGETS));c.distribution=choice(input.distribution,'distribution',['even','random','stratified','clustered']);c.frequencySource=choice(input.frequencySource,'frequency source',['rate','interval']);
  for(const k of ['spacingCurveEnabled','trailingDustEnabled'])c[k]=bool(input[k],k);
  if(c.minGapPx>c.spacingPx)fail('minimum spacing exceeds base spacing');
  shape(input.contact,Object.keys(d.contact),'contact');if(input.contact.id!=='contact')fail('contact id');c.contact={id:'contact',...transform(input.contact),anchor:normAnchor(input.contact.anchor,false)};
  shape(input.layers,LAYERS,'layers');c.layers={};
  for(const k of LAYERS){const l=input.layers[k];shape(l,Object.keys(d.layers[k]),k);if(l.id!==k)fail('layer id');c.layers[k]={id:k,enabled:bool(l.enabled,k),visible:bool(l.visible,k),...transform(l),opacity:finite(l.opacity,'opacity',0,1),delayFrames:finite(l.delayFrames,'delay',0,120,true),seed:finite(l.seed,'layer seed',-2147483648,2147483647,true),blend:choice(l.blend,'blend',['normal','add']),order:choice(l.order,'order',['behind','front']),anchor:normAnchor(l.anchor,true)};}
  shape(input.curves,Object.keys(specs),'curves');c.curves={};for(const k of Object.keys(specs)){const x=C.normalize(input.curves[k]),b=d.curves[k];for(const p of ['parameterKey','domain','inputUnit','valueUnit','clamp','monotonic'])if(x[p]!==b[p])fail('curve binding '+k);if(x.valueRange.some((v,i)=>v!==b.valueRange[i]))fail('curve range '+k);c.curves[k]=x;}
  shape(input.palettes,LAYERS,'palettes');c.palettes={};for(const k of LAYERS){const p=K.normalize(input.palettes[k]),b=d.palettes[k];if(p.parameterKey!==b.parameterKey||p.domain!==b.domain||p.inputUnit!==b.inputUnit)fail('palette binding '+k);c.palettes[k]=p;}
  return freeze(c);
 }
 // Parametric Bezier integral: integrate y(t)*x'(t) analytically; invert x
 // on the normalized segment by bisection. Cumulative area is fixed at compile.
 const coefficients=(a,b,c,d)=>[a,3*(b-a),3*(a-2*b+c),d-a+3*(b-c)];
 const poly=(a,t)=>a.reduceRight((s,v)=>s*t+v,0);
 function speedIntegral(c){
  let total=0;const segments=[];
  for(let i=0;i<c.keys.length-1;i++){const a=c.keys[i],b=c.keys[i+1],w=b.x-a.x;let area;
   if(a.mode==='stepped')area=x=>a.y*(x-a.x);
   else if(a.mode==='linear')area=x=>{const u=(x-a.x)/w;return w*(a.y*u+(b.y-a.y)*u*u/2);};
   else{const X=coefficients(0,(a.out[0]-a.x)/w,(b.in[0]-a.x)/w,1),Y=coefficients(a.y,a.out[1],b.in[1],b.y),P=Array(7).fill(0);
    for(let j=0;j<4;j++)for(let k=1;k<4;k++)P[j+k]+=Y[j]*k*X[k]*w/(j+k);
    area=x=>{let t;if(x<=a.x)t=0;else if(x>=b.x)t=1;else{let lo=0,hi=1,q=(x-a.x)/w;for(let n=0;n<40;n++){const mid=(lo+hi)/2;if(poly(X,mid)<q)lo=mid;else hi=mid;}t=(lo+hi)/2;}return poly(P,t);};}
   segments.push({a:a.x,b:b.x,total,area});total+=area(b.x);
  }
  return u=>{u=clamp(u,0,1);if(u===1)return total;const s=segments.find(v=>u<v.b);return s.total+s.area(u);};
 }
 function circle(r){const q=.5522847498307936*r;return {schemaVersion:1,closed:true,segments:[{p0:[r,0],p1:[r,q],p2:[q,r],p3:[0,r]},{p0:[0,r],p1:[-q,r],p2:[-r,q],p3:[-r,0]},{p0:[-r,0],p1:[-r,-q],p2:[-q,-r],p3:[0,-r]},{p0:[0,-r],p1:[q,-r],p2:[r,-q],p3:[r,0]}]};}
 const active=l=>l.enabled&&l.visible&&l.opacity>0;
 const rotation=(x,y,a)=>[Math.cos(a)*x-Math.sin(a)*y,Math.sin(a)*x+Math.cos(a)*y];
 const deg=a=>a*Math.PI/180;
 function placement(c,seed,count){
  const points=[];
  for(let r=c.originGapPx,band=0;r<=MAX_BAND_RADIUS+1e-9&&points.length<count;r+=c.spacingPx,band++){
   const p=S.createSpatialPlacement({path:circle(r),baseSpacingPx:c.spacingPx,minSpacing:c.minGapPx,maxSpacing:60,spacingCurve:c.spacingCurveEnabled?c.curves.spacing:null,mode:c.distribution,jitter:c.spatialJitter,seed:(seed^Math.imul(band+1,0x6d2b79f5))|0,maxPoints:Math.max(1,count-points.length),tolerancePx:.05});
   const angle=rand(seed,band,11)*TAU;
   for(const v of p.points){const [x,y]=rotation(v.x,v.y,angle);points.push({band,bandRadius:r,pathLength:p.table.length,distance:v.distance,x,y});}
  }
  if(points.length!==count)fail('insufficient spatial capacity for debris count');
  return points;
 }
 const identity={x:0,y:0,rotation:0,scale:1};
 function supplied(poses,key){const p=poses[key];if(p==null)return null;
  return {x:finite(p.x,'resolved x',-1e7,1e7),y:finite(p.y,'resolved y',-1e7,1e7),rotation:finite(p.rotation,'resolved rotation',-1e7,1e7),scale:finite(p.scale,'resolved scale',1e-6,1e4)};}
 function compose(p,v){if(!p)return null;const [x,y]=rotation(v.x*p.scale,v.y*p.scale,deg(p.rotation));return {x:p.x+x,y:p.y+y,rotation:p.rotation+v.rotation,scale:p.scale};}
 function origin(c,k,poses){const l=c.layers[k];
  if(l.anchor.type==='inherit')return compose(compose(c.contact.anchor.type==='world'?identity:supplied(poses,'contact'),c.contact),l);
  return compose(l.anchor.type==='world'?identity:supplied(poses,k),l);
 }
 function compile(input){
  const c=normalize(input),schedule={ring:[],debris:[],dust:[]},omitted={ring:0,debris:0,dust:0};const limit=BUDGETS[c.quality];
  const seed=k=>(c.seed^c.layers[k].seed^({ring:0x78a4,debris:0x2893,dust:0x712c}[k]))|0;
  function append(k,local,extra){const born=local+c.layers[k].delayFrames/FPS;if(born>=END-1e-12){omitted[k]++;return;}schedule[k].push({id:k+'-'+schedule[k].length,born,...extra});}
  if(active(c.layers.ring))append('ring',0,{});
  if(active(c.layers.debris)){
   if(c.layers.debris.delayFrames>=FRAMES-1)omitted.debris=c.debrisCount;
   else{const s=seed('debris');for(const [i,p] of placement(c,s,c.debrisCount).entries()){append('debris',0,{...p,angle:-Math.PI*(.08+.84*rand(s,i,21)),speedScale:.75+.5*rand(s,i,22),sizeScale:.65+.7*rand(s,i,23),spin:(rand(s,i,24)-.5)*12,rotation:rand(s,i,25)*TAU});}}
  }
  if(active(c.layers.dust)&&c.dustDensity>0){
   const s=seed('dust');function dust(t){const i=schedule.dust.length+omitted.dust,a=rand(s,i,31)*TAU,rad=c.originGapPx*(.5+rand(s,i,32));append('dust',t,{x:Math.cos(a)*rad,y:Math.sin(a)*rad*.3,dx:Math.cos(a)*(20+40*rand(s,i,33)),dy:-10-30*rand(s,i,34),radius:8+16*rand(s,i,35)});}
   for(let i=0;i<Math.round(24*c.dustDensity);i++)dust(0);
   if(c.trailingDustEnabled){
    const p=S.createTemporalSchedule({schemaVersion:1,mode:'custom',frequencySource:c.frequencySource,baseRate:c.dustRate,interval:c.dustInterval,duration:c.dustEndFrame/FPS,minInterval:c.minIntervalFrames/FPS,jitter:c.timeJitter,seed:s,maxEvents:MAX_EVENTS,rateCurve:c.curves.rate,intervalCurve:c.curves.interval});
    if(p.capped)fail('dust event budget');for(const e of p.events)dust(e.time);
   }
  }
  const counts=Object.fromEntries(LAYERS.map(k=>[k,schedule[k].length])),count=Object.values(counts).reduce((a,b)=>a+b,0);
  if(count>MAX_EVENTS||count>limit)fail('quality primitive/event budget exceeded');
  const meta=freeze({frames:FRAMES,fps:FPS,mode:c.mode,authoredDuration:FRAMES/FPS,terminalSeconds:END,schedule,counts,omitted,primitiveBound:count,limit,maxEvents:MAX_EVENTS,maxBandRadius:MAX_BAND_RADIUS});
  const integral=active(c.layers.debris)?speedIntegral(c.curves.debrisSpeed):()=>0;
  function sample(seconds,poses={}){
   finite(seconds,'time',0,1e8);if(!poses||typeof poses!=='object'||Array.isArray(poses))fail('resolved origins');
   const layers={ring:[],debris:[],dust:[]},missing=[],t=seconds,terminal=clamp((END-t)/(6/FPS),0,1);
   if(t>=END-1e-12)return {seconds:t,layers,missing,primitives:0};
   for(const k of LAYERS){if(!schedule[k].length)continue;const p=origin(c,k,poses);if(!p){missing.push(k);continue;}
    const l=c.layers[k],a=deg(p.rotation+(k==='dust'?0:c.planeAngle));
    function pos(x,y){const [rx,ry]=rotation(x*p.scale,y*p.scale,a);return {x:p.x+rx,y:p.y+ry};}
    function rgba(u,alpha){const v=K.sample(c.palettes[k],u);v[3]*=alpha*l.opacity*terminal;return v;}
    for(const e of schedule[k]){
     const dt=t-e.born;if(dt<-1e-12)continue;const elapsed=Math.max(0,dt);
     if(k==='ring'){const u=clamp(elapsed/END,0,1),radius=c.impactRadius*C.evaluate(c.curves.radius,u)*p.scale,alpha=(1-u)**1.5;
      const color=rgba(u,alpha);if(color[3]>0)layers.ring.push({id:e.id,kind:'ellipse-ring',...pos(0,0),radiusX:radius,radiusY:radius*c.planeRatio,width:c.ringWidth*(1-.8*u)*(1+.1*Math.sin(Math.PI*u)*(2*rand(seed('ring'),0,41)-1))*p.scale,rotation:a,rgba:color,blend:l.blend,order:l.order});
     }else if(k==='debris'){const u=clamp(elapsed/END,0,1);if(u>=1)continue;const dist=c.launchSpeed*e.speedScale*END*integral(u),x=e.x+Math.cos(e.angle)*dist,y=e.y*c.planeRatio+Math.sin(e.angle)*dist+.5*c.gravity*elapsed*elapsed;
      const color=rgba(u,1-u),size=c.debrisSize*e.sizeScale*p.scale;if(color[3]>0)layers.debris.push({id:e.id,kind:'fragment',...pos(x,y),size,rotation:a+e.rotation+elapsed*e.spin,age:u,travel:dist,rgba:color,blend:l.blend,order:l.order});
     }else{const life=Math.min(.45,END-e.born),u=clamp(elapsed/life,0,1);if(u>=1)continue;
      const color=rgba(u,c.dustDensity*C.evaluate(c.curves.dustOpacity,u));if(color[3]>0)layers.dust.push({id:e.id,kind:'soft-dust',...pos(e.x+e.dx*elapsed,e.y+e.dy*elapsed),radius:e.radius*(.6+1.8*u)*p.scale,age:u,rgba:color,blend:l.blend,order:l.order});}
    }
   }
   return {seconds:t,layers,missing,primitives:LAYERS.reduce((n,k)=>n+layers[k].length,0)};
  }
  return Object.freeze({settings:c,meta,sample});
 }
 return {VERSION,FPS,LAYERS,BUDGETS,defaults,normalize,compile};
});
