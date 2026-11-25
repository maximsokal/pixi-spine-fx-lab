// GAME-05: deterministic 40-frame pressure-front geometry, no renderer state.
(function(root,factory){
 const api=Object.freeze(factory(root.FxCurves||(typeof require==='function'?require('../../template/src/curve-core.js'):null),root.FxColors||(typeof require==='function'?require('../../template/src/color-core.js'):null)));
 if(typeof module==='object'&&module.exports)module.exports=api;else root.FxShockwave=api;
})(globalThis,function(C,COL){
 'use strict';
 const END=39,TAU=2*Math.PI,LAYERS=['primary','secondary','particles'];
 const BUDGETS={low:256,balanced:1024,high:2048};
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 const fail=s=>{throw RangeError('GAME-05 '+s);};
 function num(v,k,a,b,int=false){if(!Number.isFinite(v)||v<a||v>b||(int&&!Number.isInteger(v)))fail('invalid '+k);return v;}
 function shape(o,keys){if(!o||typeof o!=='object'||Array.isArray(o)||Object.keys(o).some(k=>!keys.includes(k)))fail('invalid fields');}
 function bool(v){if(typeof v!=='boolean')fail('invalid toggle');return v;}
 function hash(s){let h=2166136261;for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619);return h|0;}
 function rand(seed,i){let x=seed^Math.imul(i+1,0x9e3779b1);x=Math.imul(x^(x>>>16),0x7feb352d);x=Math.imul(x^(x>>>15),0x846ca68b);return ((x^(x>>>16))>>>0)/4294967296;}
 function curve(key,domain,points,min=0,max=1){return C.normalize({schemaVersion:1,parameterKey:key,domain,inputUnit:domain==='pathPosition'?'normalized-path':'normalized-duration',valueUnit:'multiplier',inputRange:[0,1],valueRange:[min,max],defaultValue:points[0][1],clamp:'hold',monotonic:false,keys:points.map(([x,y],i)=>({id:'k'+i,x,y,mode:'linear'}))});}
 function newEmitter(i=0){num(i,'emitter index',0,100000,true);const layer=(enabled,k)=>({enabled,x:0,y:0,rotation:0,timeOffset:0,seed:31+k*97,alpha:1,anchor:{type:'inherit',name:''}});return {id:'emitter'+(i+1),enabled:true,x:256,y:256,rotation:0,timeOffset:0,seed:1033+i*137,anchor:{type:'world',name:''},layers:{primary:layer(true,0),secondary:layer(true,1),particles:layer(false,2)}};}
 function defaults(){return {schemaVersion:1,durationFrames:40,startRadius:0,finalRadius:150,ringWidth:8,edgeSoftness:.6,ringCount:1,ringDelayFrames:5,radialGapPx:22,arcGapPx:22,minIntervalFrames:0,timeJitter:0,spatialJitter:0,distribution:'even',seed:7321,quality:'balanced',distortion:0,
  radiusCurve:curve('radius','effectTime',[[0,0],[.18,.75],[.65,1],[1,1]]),widthCurve:curve('width','effectTime',[[0,1],[.4,.7],[1,.1]]),opacityCurve:curve('opacity','effectTime',[[0,.9],[.4,.8],[1,0]]),intervalCurve:curve('interval','effectTime',[[0,1],[1,1]],.25,3),arcSpacingCurve:curve('arcSpacing','pathPosition',[[0,1],[1,1]],.25,3),palette:COL.normalize({schemaVersion:1,parameterKey:'shockColor',domain:'particleAge',inputUnit:'normalized-lifetime',space:'srgb',clamp:'hold',stops:[{id:'start',position:0,rgba:[224,249,255,1]},{id:'end',position:1,rgba:[136,205,235,1]}]}),emitters:[newEmitter()]};}
 const KEYS=Object.keys(defaults()),EK=Object.keys(newEmitter()),LK=Object.keys(newEmitter().layers.primary);
 function anchor(v,layer){
  if(v===undefined)return {type:layer?'inherit':'world',name:''};
  if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).some(k=>!['type','name'].includes(k))||
   !['world','local','bone',...(layer?['inherit']:[])].includes(v.type)||typeof v.name!=='string'||
   (v.type==='bone'?(!v.name.trim()||v.name.length>256||v.name==='$local'):v.name!==''))fail('invalid anchor');
  return {type:v.type,name:v.name};
 }
 const identity=()=>({x:0,y:0,rotation:0,scale:1});
 function parentPose(a,poses,parent){
  if(a.type==='inherit')return parent;
  if(a.type==='world')return identity();
  const key=a.type==='local'?'$local':a.name;
  const p=poses&&Object.hasOwn(poses,key)?poses[key]:null;
  return p&&[p.x,p.y,p.rotation,p.scale].every(Number.isFinite)&&p.scale>1e-10?p:null;
 }
 function compose(p,o){
  if(!p)return null;
  const a=p.rotation*Math.PI/180,x=o.x*p.scale,y=o.y*p.scale;
  const result={x:p.x+x*Math.cos(a)-y*Math.sin(a),y:p.y+x*Math.sin(a)+y*Math.cos(a),rotation:p.rotation+o.rotation,scale:p.scale};
  return Object.values(result).every(Number.isFinite)?result:null;
 }
 // Host-local authored coordinates. Resolve layers independently of emitter
 // visibility: an explicit world/bone/local layer need not inherit its anchor.
 function resolveOrigin(e,k,poses={}){
  const ep=parentPose(anchor(e.anchor,false),poses,null);
  if(k==='emitter')return {parent:ep,pose:compose(ep,e)};
  const l=e.layers[k],p=parentPose(anchor(l.anchor,true),poses,compose(ep,e));
  return {parent:p,pose:compose(p,l)};
 }
 function transform(v){return {enabled:bool(v.enabled),x:num(v.x,'x',-10000,10000),y:num(v.y,'y',-10000,10000),rotation:num(v.rotation,'rotation',-360,360),timeOffset:num(v.timeOffset,'timeOffset',-3600,3600,true),seed:num(v.seed,'seed',-2147483648,2147483647,true)};}
 function normalize(input){shape(input,KEYS);if(input.schemaVersion!==1)fail('unsupported version');const c={schemaVersion:1};
  for(const [k,a,b,int] of [['durationFrames',40,40,true],['startRadius',0,60],['finalRadius',20,500],['ringWidth',.5,60],['edgeSoftness',0,1],['ringCount',1,8,true],['ringDelayFrames',0,30],['radialGapPx',2,100],['arcGapPx',2,100],['minIntervalFrames',0,30],['timeJitter',0,.45],['spatialJitter',0,.45],['seed',-2147483648,2147483647,true],['distortion',0,0]])c[k]=num(input[k],k,a,b,int);
  if(c.finalRadius<=c.startRadius)fail('final radius must exceed start');
  if(!Object.hasOwn(BUDGETS,input.quality)||!['even','random','clustered'].includes(input.distribution))fail('invalid quality/distribution');
  c.quality=input.quality;c.distribution=input.distribution;
  for(const [k,key,domain,min,max] of [['radiusCurve','radius','effectTime',0,1],['widthCurve','width','effectTime',0,1],['opacityCurve','opacity','effectTime',0,1],['intervalCurve','interval','effectTime',.25,3],['arcSpacingCurve','arcSpacing','pathPosition',.25,3]]){
   const v=C.normalize(input[k]);if(v.parameterKey!==key||v.domain!==domain||v.valueUnit!=='multiplier'||v.inputUnit!==(domain==='pathPosition'?'normalized-path':'normalized-duration')||v.valueRange[0]<min||v.valueRange[1]>max)fail('invalid '+k);c[k]=v;
  }
  c.palette=COL.normalize(input.palette);if(c.palette.parameterKey!=='shockColor'||c.palette.domain!=='particleAge')fail('invalid palette');
  if(!Array.isArray(input.emitters)||input.emitters.length>4)fail('max 4 emitters');const ids=new Set();
  c.emitters=input.emitters.map(e=>{shape(e,EK);if(typeof e.id!=='string'||!/^[a-z][\w-]{0,63}$/i.test(e.id)||ids.has(e.id))fail('invalid/duplicate emitter');ids.add(e.id);shape(e.layers,LAYERS);const layers={};for(const k of LAYERS){const l=e.layers[k];shape(l,LK);layers[k]={...transform(l),alpha:num(l.alpha,'alpha',0,1),anchor:anchor(l.anchor,true)};}return {id:e.id,...transform(e),anchor:anchor(e.anchor,false),layers};});return c;
 }
 function births(c,e,layer='secondary'){const t=[0],seed=c.seed^e.seed^e.layers[layer].seed^hash(e.id);for(let i=1;i<c.ringCount;i++){
  const gap=c.ringDelayFrames*C.evaluate(c.intervalCurve,t[i-1]/END),next=t[i-1]+Math.max(c.minIntervalFrames,gap*(1+(rand(seed,i)*2-1)*c.timeJitter));
  if(next>=END)fail('ring schedule exceeds 40-frame window');t.push(next);
 }return t;}
 function schedule(input,id,layer='secondary'){const c=normalize(input),e=c.emitters.find(v=>v.id===id);if(!e)fail('unknown emitter');if(!LAYERS.includes(layer))fail('unknown layer');return layer==='primary'?[0]:births(c,e,layer);}
 // Exact circle arc length. Place stable directions at the final radius, then
 // advect along the growing wave; no per-frame rebirth or seam duplicate.
 function directions(c,radius,seed,remaining){const length=TAU*radius,out=[];let d=0;
  while(d<length){if(c.distribution==='even'&&d>0&&length-d<2-1e-9)break;if(out.length>=remaining)fail('particle budget exceeded');out.push(d);const gap=clamp(c.arcGapPx*C.evaluate(c.arcSpacingCurve,d/length),2,100);d+=gap;}
  return out.map((distance,i)=>{const prev=out[i-1]??0,next=out[i+1]??length,span=Math.min(distance-prev,next-distance),j=c.distribution==='even'?0:(rand(seed,i)*2-1)*c.spatialJitter*span;
   const offset=c.distribution==='clustered'?Math.sin(distance/radius*4)*.2*span:0;
   const dist=clamp(distance+j+offset,prev,next);return {distance:dist,angle:dist/radius};});
 }
 function freeze(o){if(o&&typeof o==='object'&&!Object.isFrozen(o)){Object.values(o).forEach(freeze);Object.freeze(o);}return o;}
 function createPlan(input){const c=freeze(normalize(input)),limit=BUDGETS[c.quality],compiled=[];let peak=0;
  for(const e of c.emitters){const active=k=>e.enabled&&e.layers[k].enabled&&e.layers[k].alpha>0;
   // Inactive layers keep their settings but cannot veto another layer's plan.
   const times={primary:active('primary')?[0]:[],secondary:active('secondary')?births(c,e,'secondary'):[],particles:active('particles')?births(c,e,'particles'):[]},dirs=[];if(active('particles')){for(let i=0;i<times.particles.length;i++){const a=directions(c,c.finalRadius+i*c.radialGapPx,c.seed^e.seed^e.layers.particles.seed^hash(e.id)^i,limit-peak);peak+=a.length;dirs.push(a);}}compiled.push({e,times,dirs});}
  function sample(seconds,poses={}){num(seconds,'time',0,1e8);const frame=seconds*60,emitters=[],diagnostics=[];let cost=0;
   for(const {e,times,dirs} of compiled){const layers={primary:[],secondary:[],particles:[]},transforms={},resolved={};
    for(const k of LAYERS){const l=e.layers[k];transforms[k]={x:l.x,y:l.y,rotation:l.rotation};resolved[k]=resolveOrigin(e,k,poses).pose;if(!e.enabled||!l.enabled||!l.alpha||frame>=END)continue;
     if(!resolved[k]){diagnostics.push({emitterId:e.id,layer:k,reason:'missing anchor'});continue;}
     for(let i=0;i<times[k].length;i++){if(k==='secondary'&&i===0)continue;
      const age=frame-e.timeOffset-l.timeOffset-times[k][i];if(age<0||age>=END)continue;const u=age/END,radius=c.startRadius+i*c.radialGapPx+(c.finalRadius-c.startRadius)*C.evaluate(c.radiusCurve,u),width=c.ringWidth*C.evaluate(c.widthCurve,u),rgba=COL.sample(c.palette,u);
      rgba[3]*=l.alpha*C.evaluate(c.opacityCurve,u)*clamp((END-frame)/6,0,1);if(!rgba[3]||!width)continue;
      const ring={id:e.id+'-'+k+'-'+i,index:i,bornFrame:times[k][i]+e.timeOffset+l.timeOffset,radius,width,edgeSoftness:c.edgeSoftness,rgba};
      if(k==='particles'){for(const p of dirs[i]||[])layers[k].push({...p,id:ring.id+'-'+layers[k].length,x:radius*Math.cos(p.angle),y:radius*Math.sin(p.angle),rgba:rgba.slice()});}
      else layers[k].push(ring);
     }cost+=layers[k].length;
    }emitters.push({id:e.id,origin:{x:e.x,y:e.y,rotation:e.rotation},layers,transforms,resolved});
   }return {frame,cost,emitters,diagnostics};
  }return Object.freeze({settings:c,peakParticles:peak,sample});
 }
 function sample(input,seconds,poses){return createPlan(input).sample(seconds,poses);}
 // Four radial bands: transparent inner edge, opaque core, transparent outer
 // edge. Return straight RGB separately from per-vertex alpha for Pixi upload.
 function annulus(ring,segments=96){num(segments,'segments',12,256,true);const r=num(ring.radius,'radius',0,1200),w=num(ring.width,'width',0,60),s=num(ring.edgeSoftness,'softness',0,1),alpha=num(ring.rgba?.[3],'alpha',0,1);
  const inner=Math.max(0,r-w/2),outer=r+w/2,soft=(outer-inner)*(.005+.495*s),radii=[inner,inner+soft,outer-soft,outer],positions=[],alphas=[],indices=[];
  for(let i=0;i<=segments;i++){const a=i===segments?0:TAU*i/segments;for(let j=0;j<4;j++){positions.push(radii[j]*Math.cos(a),radii[j]*Math.sin(a));alphas.push(j===0||j===3?0:alpha);}if(i<segments)for(let j=0;j<3;j++){const n=i*4+j;indices.push(n,n+4,n+1,n+1,n+4,n+5);}}
  return {positions,alphas,indices,rgb:ring.rgba.slice(0,3)};
 }
 return {defaults,newEmitter,normalize,schedule,createPlan,sample,annulus,resolveOrigin};
});
