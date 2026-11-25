// GAME-01: pure geometry; callers own curves, event schedules and anchor resolution.
(function(root,factory){
 'use strict';
 const api=Object.freeze(factory());
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.FxMuzzleGeometry=api;
})(globalThis,function(){
 'use strict';
 const RAD=Math.PI/180,EPS=1e-9;
 function scalar(v,name,lo,hi){
  if(typeof v!=='number'||!Number.isFinite(v)||v<lo||v>hi)throw TypeError('Invalid muzzle '+name);
  return v;
 }
 function integer(v,name,lo,hi){
  scalar(v,name,lo,hi);if(!Number.isInteger(v))throw TypeError('Invalid muzzle '+name);return v;
 }
 function array(v,name,min,max,read){
  if(!Array.isArray(v)||v.length<min||v.length>max)throw TypeError('Invalid muzzle '+name);
  return Array.from({length:v.length},(_,i)=>{if(!Object.hasOwn(v,i))throw TypeError('Sparse muzzle '+name);return read(v[i],i);});
 }
 function frame(c){
  if(!c||typeof c!=='object')throw TypeError('Invalid muzzle frame');
  return {x:scalar(c.x,'x',-1e6,1e6),y:scalar(c.y,'y',-1e6,1e6),
   angle:scalar(c.rotation,'rotation',-360000,360000)*RAD,
   length:scalar(c.length,'length',8,260),width:scalar(c.width,'width',2,100),
   cone:scalar(c.coneAngle,'coneAngle',5,150)*RAD,alpha:scalar(c.alpha,'alpha',0,1)};
 }
 function point(c,x,y){return {x:c.x+x*Math.cos(c.angle)-y*Math.sin(c.angle),y:c.y+x*Math.sin(c.angle)+y*Math.cos(c.angle)};}
 function random(seed,index,channel){
  let x=(seed^Math.imul(index+1,0x9e3779b1)^Math.imul(channel+1,0x85ebca6b))|0;
  x=Math.imul(x^(x>>>16),0x7feb352d);x=Math.imul(x^(x>>>15),0x846ca68b);
  return ((x^(x>>>16))>>>0)/4294967296;
 }
 // Ordered left/right vertex pairs, width samples from the path-position curve.
 function ribbon(config,widthSamples){
  const c=frame(config),widths=array(widthSamples,'width samples',2,128,v=>scalar(v,'width multiplier',0,2));
  if(!c.alpha)return [];
  return widths.flatMap((w,i)=>{const x=c.length*i/(widths.length-1),y=c.width*w/2;return [point(c,x,y),point(c,x,-y)];});
 }
 // Distances are measured along the tip arc, not a parameterized curve or chord.
 // Seed only changes tongue thickness, never the supplied spatial distribution.
 function tongues(config,distances,seed){
  const c=frame(config);integer(seed,'seed',-2147483648,2147483647);
  const span=c.length*c.cone;
  // Accept only representational error at either endpoint; never widen the authored cone.
  const tolerance=8*Number.EPSILON*Math.max(1,span);
  const d=array(distances,'tongue distances',0,20,v=>Math.max(0,Math.min(span,scalar(v,'arc distance',-tolerance,span+tolerance))));
  for(let i=1;i<d.length;i++)if(d[i]<=d[i-1])throw TypeError('Unordered muzzle arc distances');
  if(!c.alpha)return [];
  return d.map((distance,i)=>{
   const angle=c.angle-c.cone/2+distance/c.length;
   return {angle,origin:{x:c.x,y:c.y},tip:{x:c.x+c.length*Math.cos(angle),y:c.y+c.length*Math.sin(angle)},
    width:c.width*(.08+.12*random(seed,i,0)),alpha:c.alpha};
  });
 }
 // speedMultiplier is an externally integrated mean multiplier over particle age.
 // The next layer owns the age curve integration and stable event identities.
 function sparks(config,events,time,speedMultiplier){
  const c=frame(config),life=scalar(config.life,'life',1/60,60),speed=scalar(config.speed,'speed',0,10000),
   seed=integer(config.seed,'seed',-2147483648,2147483647);
  scalar(time,'time',0,3600);scalar(speedMultiplier,'speed multiplier',0,4);
  const seen=new Set(),births=array(events,'events',0,50,e=>{
   if(!e||typeof e!=='object')throw TypeError('Invalid muzzle event');
   const index=integer(e.index,'event index',0,2147483647),birth=scalar(e.time,'event time',0,3600);
   if(seen.has(index))throw TypeError('Duplicate muzzle event');seen.add(index);return {index,birth};
  });
  if(!c.alpha)return [];
  return births.flatMap(({index,birth})=>{
   const dt=time-birth;if(dt<0||dt>=life-EPS)return [];
   const age=dt/life,angle=c.angle+(random(seed,index,1)-.5)*c.cone,
    distance=speed*speedMultiplier*dt*(.65+.7*random(seed,index,2));
   return [{index,age,x:c.x+distance*Math.cos(angle),y:c.y+distance*Math.sin(angle),alpha:c.alpha*(1-age)}];
  });
 }
 return {VERSION:1,ribbon,tongues,sparks};
});
