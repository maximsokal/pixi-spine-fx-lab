// GAME-08 M01c: authoring preset -> shared curves/spacing -> shield geometry.
(function(root,factory){
 const load=(global,name)=>root[global]||(typeof require==='function'?require(name):null);
 const api=Object.freeze(factory(load('FxCurves','../../template/src/curve-core.js'),load('FxSpacing','../../template/src/spacing-core.js'),load('FxColors','../../template/src/color-core.js'),load('FxShieldGeometry','./shield-geometry.js')));
 if(typeof module==='object'&&module.exports)module.exports=api;else root.FxShield=api;
})(globalThis,function(C,S,COL,G){
 'use strict';
 if(!C||!S||!COL||!G)throw Error('GAME-08 missing core dependency');
 const fail=m=>{throw RangeError('GAME-08 '+m);};
 function fields(o,keys){if(!o||typeof o!=='object'||Array.isArray(o)||Object.keys(o).length!==keys.length||keys.some(k=>!Object.hasOwn(o,k)))fail('invalid preset fields');}
 function num(v,k,min,max){if(!Number.isFinite(v)||v<min||v>max)fail('invalid '+k);return v;}
 function choice(v,values,k){if(!values.includes(v))fail('invalid '+k);return v;}
 function freeze(o){if(o&&typeof o==='object'&&!Object.isFrozen(o)){Object.values(o).forEach(freeze);Object.freeze(o);}return o;}
 function curve(parameterKey,domain,points,valueRange=[0,1],valueUnit='multiplier'){
  return C.normalize({schemaVersion:1,parameterKey,domain,inputUnit:domain==='pathPosition'?'normalized-path':'normalized-duration',valueUnit,inputRange:[0,1],valueRange,defaultValue:points[0][1],clamp:'hold',monotonic:false,keys:points.map(([x,y],i)=>({id:'k'+i,x,y,mode:'linear'}))});
 }
 function defaultSpacingCurve(){return curve('spacingPx','pathPosition',[[0,14],[1,14]],[.25,140],'px');}
 function newEmitter(i=0){
  const {sparkAnchors,...e}=G.newEmitter(i);
  return {...e,hitMode:'manual',sparksEnabled:true};
 }
 function defaults(){
  const {emitters,...base}=G.defaults();
  return {...base,hitRate:2,hitIntervalFrames:30,frequencySource:'rate',minHitGapFrames:0,timeJitter:0,
   spacingPx:14,minGapPx:2,maxGapPx:140,spatialJitter:0,distribution:'even',
   glowCurve:curve('shieldGlow','effectTime',[[0,.6],[.5,1],[1,.6]]),
   hitRadiusCurve:curve('impactRadius','emitterTime',[[0,0],[.3,1],[1,1]]),
   hitAlphaCurve:curve('hitAlpha','emitterTime',[[0,1],[1,0]]),
   rateCurve:curve('emissionRate','emitterTime',[[0,1],[1,1]],[0,4]),
   intervalCurve:curve('emissionInterval','emitterTime',[[0,1],[1,1]],[.25,4]),
   spacingCurve:null,palette:COL.normalize({schemaVersion:1,parameterKey:'shieldColor',domain:'particleAge',inputUnit:'normalized-lifetime',space:'srgb',clamp:'hold',stops:[{id:'light',position:0,rgba:[218,247,255,1]},{id:'blue',position:1,rgba:[76,159,225,1]}]}),
   emitters:[newEmitter()]};
 }
 function geometryInput(input){
  const g=G.defaults();
  for(const k of Object.keys(g))if(k!=='emitters')g[k]=input[k];
  g.emitters=Array.from(input.emitters,e=>{const {hitMode,sparksEnabled,...rest}=e;return {...rest,sparkAnchors:[]};});
  return g;
 }
 function normalize(input){
  const base=defaults();fields(input,Object.keys(base));
  if(!Array.isArray(input.emitters)||input.emitters.length<1||input.emitters.length>4)fail('emitter count');
  for(const e of input.emitters){fields(e,Object.keys(newEmitter()));choice(e.hitMode,['manual','scheduled'],'hitMode');if(typeof e.sparksEnabled!=='boolean')fail('sparksEnabled');if(e.hitMode==='scheduled'&&e.impacts.length)fail('scheduled mode cannot contain manual hits');}
  const {emitters,...g}=G.normalize(geometryInput(input)),c={...g};
  for(const [k,a,b] of [['hitRate',0,60],['hitIntervalFrames',.25,3600],['minHitGapFrames',0,3600],['timeJitter',0,.45],['spacingPx',.25,140],['minGapPx',.25,140],['maxGapPx',.25,140],['spatialJitter',0,.45]])c[k]=num(input[k],k,a,b);
  if(c.minGapPx>c.maxGapPx)fail('gap range');
  c.frequencySource=choice(input.frequencySource,['rate','interval'],'frequencySource');c.distribution=choice(input.distribution,['even','random','stratified','clustered'],'distribution');
  function normalized(v,b){
   const q=C.normalize(v);
   for(const k of ['parameterKey','domain','inputUnit','valueUnit'])if(q[k]!==b[k])fail('invalid curve '+b.parameterKey);
   if(q.valueRange[0]<b.valueRange[0]||q.valueRange[1]>b.valueRange[1])fail('curve range '+b.parameterKey);
   return q;
  }
  for(const k of ['glowCurve','hitRadiusCurve','hitAlphaCurve','rateCurve','intervalCurve'])c[k]=normalized(input[k],base[k]);
  c.spacingCurve=input.spacingCurve===null?null:normalized(input.spacingCurve,defaultSpacingCurve());
  const glow=c.glowCurve.keys,first=glow[0],last=glow.at(-1),prev=glow.at(-2);
  // The final exact key can equal the first while a stepped segment still jumps.
  if(c.mode==='loop'&&[last.y,prev.mode==='stepped'?prev.y:last.y].some(y=>Math.abs(y-first.y)>1e-9))fail('glow curve seam');
  c.palette=COL.normalize(input.palette);
  if(c.palette.parameterKey!=='shieldColor'||c.palette.domain!=='particleAge')fail('palette binding');
  c.emitters=emitters.map((e,i)=>{const {sparkAnchors,...rest}=e;return {...rest,hitMode:input.emitters[i].hitMode,sparksEnabled:input.emitters[i].sparksEnabled};});
  return c;
 }
 function ring(r){
  const k=.5522847498307936*r;
  return {schemaVersion:1,closed:true,segments:[{p0:[r,0],p1:[r,k],p2:[k,r],p3:[0,r]},{p0:[0,r],p1:[-k,r],p2:[-r,k],p3:[-r,0]},{p0:[-r,0],p1:[-r,-k],p2:[-k,-r],p3:[0,-r]},{p0:[0,-r],p1:[k,-r],p2:[r,-k],p3:[r,0]}]};
 }
 function hash(s){let h=2166136261;for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619);return h|0;}
 function compile(input){
  const c=freeze(normalize(input)),loop=c.mode==='loop',end=loop?c.durationFrames:c.durationFrames-1,seconds=end/60,g=geometryInput(c);
  const schedules=c.emitters.map((e,i)=>{
   const l=e.layers.impact,active=e.enabled&&e.visible&&l.enabled&&l.visible&&l.alpha>0;
   const seed=salt=>c.seed^e.seed^l.seed^hash(e.id+':'+salt);
   let impacts=[],sparkAnchors=[],pathLength=0;
   if(active){
    if(e.hitMode==='manual')impacts=e.impacts.map(h=>({...h}));
    else {
     const t=S.createTemporalSchedule({mode:'custom',frequencySource:c.frequencySource,baseRate:c.hitRate,interval:c.hitIntervalFrames/60,duration:seconds,minInterval:c.minHitGapFrames/60,jitter:c.timeJitter,seed:seed('time'),rateCurve:c.rateCurve,intervalCurve:c.intervalCurve,maxEvents:4096});
     if(t.capped)fail('hit event budget');
     const sorted=t.events.map((h,j)=>({id:'auto'+j,frame:loop&&Math.abs(h.time-seconds)<=1e-9?0:Math.min(end,h.time*60)})).sort((a,b)=>a.frame-b.frame);
     for(const h of sorted)if(!impacts.length||h.frame-impacts.at(-1).frame>1e-8)impacts.push(h);
     if(loop&&impacts.length>0&&end-impacts.at(-1).frame+impacts[0].frame<c.minHitGapFrames-1e-8)fail('scheduled hit seam gap');
    }
    if(e.sparksEnabled&&impacts.length){
     const p=S.createSpatialPlacement({path:ring(c.radius),baseSpacingPx:c.spacingPx,minSpacing:c.minGapPx,maxSpacing:c.maxGapPx,spacingCurve:c.spacingCurve,mode:c.distribution,jitter:c.spatialJitter,seed:seed('space'),maxPoints:2048});
     if(p.capped)fail('spark anchor budget');
     pathLength=p.table.length;
     if(pathLength>=c.minGapPx){
      sparkAnchors=[{x:c.radius,y:0,distance:0},...p.points.filter(v=>pathLength-v.distance>=c.minGapPx-1e-9).map(v=>({x:v.x,y:v.y,distance:v.distance}))];
     }
    }
   }
   g.emitters[i].impacts=impacts;g.emitters[i].sparkAnchors=sparkAnchors;
   return {emitterId:e.id,impacts,sparkAnchors,pathLength};
  });
  const plan=G.compileGeometry(g,{glow:u=>C.evaluate(c.glowCurve,u),radius:u=>C.evaluate(c.hitRadiusCurve,u),alpha:u=>C.evaluate(c.hitAlphaCurve,u),color:u=>COL.sample(c.palette,u)});
  return Object.freeze({settings:c,requestedHz:plan.requestedHz,effectiveHz:plan.effectiveHz,reserved:plan.reserved,schedules:freeze(schedules),sample:plan.sample});
 }
 return {defaults,newEmitter,defaultSpacingCurve,normalize,compile};
});
