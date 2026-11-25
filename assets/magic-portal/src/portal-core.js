// GAME-06 M01: deterministic polar portal, independent emission clock.
(function(root,make){
 const api=Object.freeze(make(root.FxCurves||(typeof require==='function'?require('../../template/src/curve-core.js'):null),root.FxSpacing||(typeof require==='function'?require('../../template/src/spacing-core.js'):null),root.FxColors||(typeof require==='function'?require('../../template/src/color-core.js'):null)));
 if(typeof module==='object'&&module.exports)module.exports=api;else root.FxPortal=api;
})(globalThis,function(C,S,COL){
 'use strict';
 const TAU=Math.PI*2,DEG=Math.PI/180,LAYERS=Object.freeze(['aperture','rim','particles']),BUDGETS=Object.freeze({low:256,balanced:1024,high:2048});
 const fail=m=>{throw RangeError('GAME-06 '+m)},mod=(x,n)=>((x%n)+n)%n,clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
 function num(v,k,a,b,int=false){if(!Number.isFinite(v)||v<a||v>b||int&&!Number.isInteger(v))fail('invalid '+k);return v}
 function one(v,arr,k){if(!arr.includes(v))fail('invalid '+k);return v}
 function bool(v){if(typeof v!=='boolean')fail('invalid toggle');return v}
 function fields(o,base){if(!o||typeof o!=='object'||Array.isArray(o)||Object.keys(o).length!==Object.keys(base).length||Object.keys(base).some(k=>!Object.hasOwn(o,k)))fail('invalid fields')}
 function freeze(o){if(o&&typeof o==='object'&&!Object.isFrozen(o)){Object.values(o).forEach(freeze);Object.freeze(o)}return o}
 function hash(s){let h=2166136261;for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619);return h|0}
 function rand(seed,i,salt){let x=seed^Math.imul(i+1,0x9e3779b1)^hash(salt);x=Math.imul(x^(x>>>16),0x7feb352d);x=Math.imul(x^(x>>>15),0x846ca68b);return ((x^(x>>>16))>>>0)/4294967296}
 const anchor=type=>({type,name:''});
 function newEmitter(i=0){num(i,'emitter index',0,100000,true);const t=(seed,type)=>({enabled:true,visible:true,x:0,y:0,rotation:0,scale:1,timeOffset:0,seed,anchor:anchor(type)});return {id:'portal'+(i+1),...t(131+i*137,'world'),x:256,y:256,layers:Object.fromEntries(LAYERS.map((k,j)=>[k,{...t(31+j*97,'inherit'),alpha:1,blend:'normal'}]))}}
 function curve(parameterKey,domain,points,valueRange=[0,1],valueUnit='multiplier'){return C.normalize({schemaVersion:1,parameterKey,domain,inputUnit:domain==='pathPosition'?'normalized-path':domain==='particleAge'?'normalized-lifetime':'normalized-duration',valueUnit,inputRange:[0,1],valueRange,defaultValue:points[0][1],clamp:'hold',monotonic:false,keys:points.map(([x,y],i)=>({id:'k'+i,x,y,mode:'linear'}))})}
 function defaults(){return {schemaVersion:1,mode:'loop',durationFrames:120,portalRadius:90,rimWidth:14,swirlSpeed:120,particleRate:30,particleLifetimeFrames:36,spacing:13,minGapPx:2,maxGapPx:80,spatialJitter:0,distribution:'even',frequencySource:'rate',intervalFrames:2,timeJitter:0,minIntervalFrames:0,groupCount:1,groupDelayFrames:0,glow:.7,warp:.4,seed:4106,quality:'balanced',
 apertureCurve:curve('apertureOpen','effectTime',[[0,0],[.2,1],[.85,1],[1,0]]),
 swirlCurve:curve('swirlSpeed','effectTime',[[0,.5],[.5,1],[1,.5]],[0,2]),
 rimCurve:curve('rimWidth','pathPosition',[[0,.8],[.5,1],[1,.8]],[0,2]),
 rateCurve:curve('emissionRate','emitterTime',[[0,1],[1,1]],[0,4]),
 intervalCurve:curve('emissionInterval','emitterTime',[[0,1],[1,1]],[.25,4]),
 spacingCurve:curve('spacingPx','pathPosition',[[0,13],[1,13]],[2,80],'px'),
 alphaCurve:curve('particleAlpha','particleAge',[[0,0],[.15,1],[1,0]]),
 palette:COL.normalize({schemaVersion:1,parameterKey:'portalColor',domain:'particleAge',inputUnit:'normalized-lifetime',space:'srgb',clamp:'hold',stops:[{id:'light',position:0,rgba:[224,178,255,1]},{id:'middle',position:.5,rgba:[153,85,222,1]},{id:'dark',position:1,rgba:[67,32,117,1]}]}),emitters:[newEmitter()]}}
 function normalize(input){
  const base=defaults();fields(input,base);if(input.schemaVersion!==1)fail('schemaVersion');
  const c={schemaVersion:1,mode:one(input.mode,['loop','oneShot'],'mode'),durationFrames:num(input.durationFrames,'durationFrames',2,3600,true)};
  for(const [k,a,b,i] of [['portalRadius',15,300],['rimWidth',1,70],['swirlSpeed',-720,720],['particleRate',0,240],['particleLifetimeFrames',1,c.durationFrames],['spacing',2,80],['minGapPx',2,80],['maxGapPx',2,80],['spatialJitter',0,.45],['intervalFrames',.25,3600],['timeJitter',0,.45],['minIntervalFrames',0,3600],['groupCount',1,8,true],['groupDelayFrames',0,3600],['glow',0,2],['warp',0,1],['seed',-2147483648,2147483647,true]])c[k]=num(input[k],k,a,b,i);
  if(c.minGapPx>c.maxGapPx)fail('gap range');
  c.distribution=one(input.distribution,['even','random','stratified','clustered'],'distribution');c.frequencySource=one(input.frequencySource,['rate','interval'],'frequencySource');c.quality=one(input.quality,Object.keys(BUDGETS),'quality');
  for(const k of ['apertureCurve','swirlCurve','rimCurve','rateCurve','intervalCurve','spacingCurve','alphaCurve']){const v=C.normalize(input[k]),b=base[k];for(const prop of ['parameterKey','domain','inputUnit','valueUnit'])if(v[prop]!==b[prop])fail('invalid '+k);if(v.valueRange[0]<b.valueRange[0]||v.valueRange[1]>b.valueRange[1])fail('curve range '+k);c[k]=v}
  if(Math.abs(C.evaluate(c.rimCurve,0)-C.evaluate(c.rimCurve,1))>1e-9)fail('rim width seam');
  if(c.mode==='oneShot'&&(C.evaluate(c.apertureCurve,0)!==0||C.evaluate(c.apertureCurve,1)!==0))fail('one-shot aperture endpoints');
  c.palette=COL.normalize(input.palette);if(c.palette.parameterKey!=='portalColor'||c.palette.domain!=='particleAge')fail('palette');
  const ids=new Set();function transform(t,layer){const a=t.anchor;fields(a,anchor('world'));one(a.type,layer?['inherit','world','local','bone']:['world','local','bone'],'anchor');if(typeof a.name!=='string'||a.name.length>128||(a.type==='bone'?!a.name.trim():a.name!==''))fail('anchor name');
   return {enabled:bool(t.enabled),visible:bool(t.visible),x:num(t.x,'x',-16384,16384),y:num(t.y,'y',-16384,16384),rotation:num(t.rotation,'rotation',-3600,3600),scale:num(t.scale,'scale',.01,20),timeOffset:num(t.timeOffset,'delay',-3600,3600),seed:num(t.seed,'seed',-2147483648,2147483647,true),anchor:{...a}}}
  if(!Array.isArray(input.emitters)||input.emitters.length<1||input.emitters.length>4)fail('emitter count');
  c.emitters=Array.from(input.emitters,e=>{const b=newEmitter();fields(e,b);if(typeof e.id!=='string'||!/^[a-z][\w-]{0,63}$/i.test(e.id)||ids.has(e.id))fail('emitter id');ids.add(e.id);fields(e.layers,b.layers);return {id:e.id,...transform(e,false),layers:Object.fromEntries(LAYERS.map(k=>{const l=e.layers[k];fields(l,b.layers[k]);return [k,{...transform(l,true),alpha:num(l.alpha,'alpha',0,1),blend:one(l.blend,['normal','add','screen','multiply'],'blend')}]}))}});
  return c;
 }
 function ring(r){const k=.5522847498307936*r;return {schemaVersion:1,closed:true,segments:[{p0:[r,0],p1:[r,k],p2:[k,r],p3:[0,r]},{p0:[0,r],p1:[-k,r],p2:[-r,k],p3:[-r,0]},{p0:[-r,0],p1:[-r,-k],p2:[-k,-r],p3:[0,-r]},{p0:[0,-r],p1:[k,-r],p2:[r,-k],p3:[r,0]}]}}
 const active=(e,l)=>e.enabled&&e.visible&&l.enabled&&l.visible&&l.alpha>0;
 function compile(input){
  const c=freeze(normalize(input)),loop=c.mode==='loop',period=c.durationFrames,end=loop?period:period-1,seconds=end/60,steps=2048;
  // Piecewise midpoint integral sampled once. Normalized curve values nonnegative;
  // sign comes only from swirlSpeed. Twofold symmetric shader closes every 180deg.
  const integral=new Float64Array(steps+1);
  for(let i=1;i<=steps;i++)integral[i]=integral[i-1]+C.evaluate(c.swirlCurve,(i-.5)/steps)/steps;
  const mean=integral[steps],requested=c.swirlSpeed*seconds*mean;
  const total=loop&&requested!==0?Math.sign(requested)*180*Math.max(1,Math.round(Math.abs(requested)/180)):requested;
  const effectiveSpeed=mean===0?0:total/(seconds*mean);
  function phase(t){const x=clamp(t/end,0,1)*steps,i=Math.min(steps-1,Math.floor(x));return mean===0?0:total*(integral[i]+(integral[i+1]-integral[i])*(x-i))/mean}
  function placement(seed){
   const factor=c.spacing/13,sc=c.spacingCurve,scale=v=>v*factor;
   const curve={...sc,valueRange:sc.valueRange.map(scale),defaultValue:scale(sc.defaultValue),keys:sc.keys.map(k=>({...k,y:scale(k.y),...(k.in?{in:[k.in[0],scale(k.in[1])]}:{}),...(k.out?{out:[k.out[0],scale(k.out[1])]}:{})}))};
   const p=S.createSpatialPlacement({path:ring(c.portalRadius),baseSpacingPx:c.spacing,minSpacing:c.minGapPx,maxSpacing:c.maxGapPx,spacingCurve:curve,mode:c.distribution,jitter:c.spatialJitter,seed,maxPoints:2048});if(p.capped)fail('placement budget');
   const anchors=[{distance:0,x:c.portalRadius,y:0},...p.points.filter(v=>p.table.length-v.distance>=c.minGapPx-1e-9).map(v=>({distance:v.distance,x:v.x,y:v.y}))];return {anchors,pathLength:p.table.length};
  }
  let reserved=0,events=0;
  const rows=c.emitters.map(e=>{
   const seed=k=>c.seed^e.seed^e.layers[k].seed^hash(e.id+':'+k);
   const rim=active(e,e.layers.rim)?placement(seed('rim')):{anchors:[],pathLength:0};
   const particles=active(e,e.layers.particles)?placement(seed('particles')):{anchors:[],pathLength:0};
   let births=[];
   if(particles.anchors.length){
    const s=S.createTemporalSchedule({mode:'custom',frequencySource:c.frequencySource,baseRate:c.particleRate,interval:c.intervalFrames/60,duration:seconds,minInterval:c.minIntervalFrames/60,jitter:c.timeJitter,seed:seed('particles'),rateCurve:c.rateCurve,intervalCurve:c.intervalCurve,maxEvents:4096});if(s.capped)fail('event budget');
    const triggers=s.events.map(v=>v.time*60).map(t=>loop&&Math.abs(t-period)<1e-7?0:t).sort((a,b)=>a-b);
    const unique=[];for(const t of triggers){if(!loop&&t>=end-1e-9)continue;if(unique.length&&t-unique.at(-1)<Math.max(1e-8,c.minIntervalFrames-1e-8))continue;unique.push(t)}
    if(loop&&unique.length>1&&period-unique.at(-1)+unique[0]<Math.max(1e-8,c.minIntervalFrames-1e-8))unique.pop();
    for(let i=0;i<unique.length;i++){const t=unique[i],next=unique[i+1]??(loop?unique[0]+period:Infinity);
     if(c.groupDelayFrames*(c.groupCount-1)>0&&t+c.groupDelayFrames*(c.groupCount-1)>=next-1e-9)fail('overlapping groups');
     for(let j=0;j<c.groupCount;j++){const at=t+j*c.groupDelayFrames;if(loop||at<end-1e-9)births.push({frame:loop?mod(at,period):at,index:births.length})}
    }
    births.sort((a,b)=>a.frame-b.frame||a.index-b.index);events+=births.length;if(events>4096)fail('event budget');
   }
   // Conservative whole-effect bound; no runtime allocation or silent eviction.
   reserved+=rim.anchors.length+births.length+Number(active(e,e.layers.aperture))+Number(active(e,e.layers.rim));
   return {id:e.id,rim,particles,births};
  });
  if(reserved>BUDGETS[c.quality])fail('quality budget exceeded');freeze(rows);
  function compose(p,t){const a=p.rotation*DEG,x=t.x*p.scale,y=t.y*p.scale;return {x:p.x+x*Math.cos(a)-y*Math.sin(a),y:p.y+x*Math.sin(a)+y*Math.cos(a),rotation:p.rotation+t.rotation,scale:p.scale*t.scale}}
  function validPose(p){return p&&[p.x,p.y,p.rotation,p.scale].every(Number.isFinite)&&p.scale>1e-10}
  function resolve(t,parent,poses){let p={x:0,y:0,rotation:0,scale:1};if(t.anchor.type==='inherit')p=parent;else if(t.anchor.type!=='world'){const key=t.anchor.type==='local'?'$local':t.anchor.name;p=poses&&Object.hasOwn(poses,key)?poses[key]:null}if(!validPose(p))return null;const result=compose(p,t);return validPose(result)?result:null}
  // A finite anchor alone does not guarantee finite generated positions or radii.
  // Bound the largest orbit, rim width and particle size before emitting geometry.
  function finiteExtent(pose){const extent=(c.portalRadius*1.5+c.rimWidth*2+4)*pose.scale;return Number.isFinite(extent)&&Number.isFinite(Math.abs(pose.x)+extent)&&Number.isFinite(Math.abs(pose.y)+extent)}
  function sample(time,poses={}){
   num(time,'time',0,1e7);const exact=time*60,raw=Math.abs(exact-Math.round(exact))<6e-8?Math.round(exact):exact,frame=loop?mod(raw,period):Math.min(raw,end),diagnostics=[];let cost=0;
   const emitters=c.emitters.map((e,i)=>{const row=rows[i],origin=resolve(e,null,poses),layers={aperture:[],rim:[],particles:[]};
    for(const k of LAYERS){const l=e.layers[k];if(!active(e,l)||!loop&&(raw>=end||raw===0))continue;
     const pose=resolve(l,origin,poses);if(!pose||!finiteExtent(pose)){diagnostics.push({emitterId:e.id,layer:k,reason:pose?'invalid anchor geometry':'missing anchor'});continue}
     const local=loop?mod(frame-e.timeOffset-l.timeOffset,period):frame-e.timeOffset-l.timeOffset;
     if(!loop&&(local<0||local>=end))continue;
     const u=local/end,open=loop?1:C.evaluate(c.apertureCurve,u)*clamp((end-frame)/6,0,1)*clamp(frame/6,0,1);
     if(open<=0)continue;
     const seed=c.seed^e.seed^l.seed^hash(e.id+':'+k),angle=phase(local),radius=c.portalRadius*open*pose.scale,rgba=COL.sample(c.palette,.5);rgba[3]*=l.alpha*open;
     const common={...pose,radius,phaseDegrees:mod(angle,180),rgba,blend:l.blend,glow:c.glow,seed};
     if(k==='aperture')layers[k].push({...common,id:e.id+'-aperture',warp:c.warp,open});
     else if(k==='rim'){
      const runes=row.rim.anchors.map((a,j)=>{const theta=Math.atan2(a.y,a.x)+pose.rotation*DEG;return {id:j,x:pose.x+radius*Math.cos(theta),y:pose.y+radius*Math.sin(theta),width:c.rimWidth*C.evaluate(c.rimCurve,a.distance/row.rim.pathLength)*pose.scale*open,angle:theta/DEG,accent:rand(seed,j,'rune')}});
      layers[k].push({...common,id:e.id+'-rim',width:c.rimWidth*pose.scale*open,runes});cost+=runes.length;
     }else for(const b of row.births){
      const age=loop?mod(local-b.frame,period):local-b.frame;if(age<0||age>=c.particleLifetimeFrames)continue;
      const v=age/c.particleLifetimeFrames,color=COL.sample(c.palette,v);color[3]*=l.alpha*open*C.evaluate(c.alphaCurve,v);if(color[3]<=0)continue;
      const a=row.particles.anchors[Math.floor(rand(seed,b.index,'anchor')*row.particles.anchors.length)],distance=radius*(1+.5*v);
      // Particle motion uses only periodic twofold phase, not unwrapped angular velocity.
      const polar=Math.atan2(a.y,a.x)+pose.rotation*DEG+Math.sin(angle*2*DEG)*.25+v*.8*(rand(seed,b.index,'direction')<.5?-1:1);
      layers[k].push({id:e.id+'-particle-'+b.index,x:pose.x+distance*Math.cos(polar),y:pose.y+distance*Math.sin(polar),radius:(1.5+rand(seed,b.index,'size')*2)*pose.scale*open,age,bornFrame:b.frame,rgba:color,blend:l.blend,glow:c.glow});
     }
    }
    cost+=LAYERS.reduce((n,k)=>n+layers[k].length,0);return {id:e.id,layers};
   });return {frame,cost,emitters,diagnostics};
  }
  return Object.freeze({settings:c,emitters:rows,requestedRotation:requested,totalRotation:total,effectiveSpeed,reserved,sample});
 }
 return {VERSION:1,LAYERS,BUDGETS,defaults,normalize,newEmitter,compile,sample:(c,t,p)=>compile(c).sample(t,p)};
});
