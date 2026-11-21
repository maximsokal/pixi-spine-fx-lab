// FIRE-02: pure, bounded, absolute-time one-shot explosion geometry (no Pixi/DOM/ticker).
(function(root, factory){
 'use strict';
 const api=Object.freeze(factory(
  root.FxCurves||(typeof require==='function'?require('../../template/src/curve-core.js'):null),
  root.FxSpacing||(typeof require==='function'?require('../../template/src/spacing-core.js'):null),
  root.FxColors||(typeof require==='function'?require('../../template/src/color-core.js'):null)));
 if(typeof module==='object'&&module.exports)module.exports=api;else root.FxExplosion=api;
})(globalThis,function(Curves,Spacing,Colors){
 'use strict';
 if(!Curves||!Spacing||!Colors)throw Error('FxExplosion requires curves, spacing and colors');
 const TAU=Math.PI*2, K=.5522847498307936, LAYERS=Object.freeze(['flash','fire','shockwave','sparks','debris','smoke']);
 const BUDGETS=Object.freeze({
  low:{maxSparks:48,maxDebris:30,maxSmoke:8,maxTongues:8,maxPrimitives:112},
  balanced:{maxSparks:120,maxDebris:64,maxSmoke:16,maxTongues:14,maxPrimitives:235},
  high:{maxSparks:320,maxDebris:108,maxSmoke:28,maxTongues:24,maxPrimitives:505}
 });
 const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
 const finite=(n,k,a,b)=>{if(typeof n!=='number'||!Number.isFinite(n)||n<a||n>b)
  throw TypeError('Invalid Explosion '+k+' must be finite '+a+'..'+b);return n;};
 const integer=(n,k,a,b)=>{finite(n,k,a,b);if(!Number.isInteger(n))throw TypeError('Invalid integer '+k);return n;};
 const rotate=(x,y,a)=>[Math.cos(a)*x-Math.sin(a)*y,Math.sin(a)*x+Math.cos(a)*y];
 function hash(seed,a,b=0){
  let x=(seed^Math.imul((a+1)|0,0x9e3779b1)^Math.imul(b+1,0x85ebca6b))|0;
  x=Math.imul(x^(x>>>16),0x7feb352d);x=Math.imul(x^(x>>>15),0x846ca68b);
  return ((x^(x>>>16))>>>0)/4294967296;
 }
 function curve(key,domain,keys,range=[0,4],unit='multiplier'){
  return Curves.normalize({schemaVersion:1,parameterKey:key,domain,
   inputUnit:domain==='particleAge'?'normalized-lifetime':
    domain==='pathPosition'?'normalized-path':'normalized-duration',
   valueUnit:unit,inputRange:[0,1],valueRange:range,defaultValue:keys[0][1],
   clamp:'hold',monotonic:false,keys:keys.map(([x,y],i)=>({id:'k'+i,x,y,mode:'linear'}))});
 }
 function defaults(){
  return {schemaVersion:1,blastRadius:100,burstSparks:80,initialSpeed:240,
   expansion:2,shockwaveWidth:12,smokePersistence:24,turbulence:.5,
   sparkOriginGap:8,debrisSpacing:16,burstJitter:.15,secondaryBursts:false,
   secondaryCount:16,smokeCount:12,
   durationFrames:40,exportFrames:40,loop:false,
   directionMode:'radial',heading:0,spread:90,
   quality:'balanced',style:'natural',seed:419,spatialMode:'even',
   debrisSpacingCurveEnabled:false,
   anchor:{type:'world',space:'world',name:'',slot:'',x:256,y:256,rotation:0},
   explosionGradient:Colors.normalize({schemaVersion:1,parameterKey:'explosionPalette',
    domain:'flameIntensity',inputUnit:'normalized-intensity',space:'srgb',clamp:'hold',
    stops:[{id:'outer',position:0,rgba:[219,64,28,.95]},
     {id:'middle',position:.5,rgba:[255,178,44,1]},
     {id:'core',position:1,rgba:[255,246,203,1]}]}),
   radiusCurve:curve('explosionRadius','effectTime',[[0,0],[.12,.8],[.35,1],[1,1]],[0,1.5]),
   fireAlphaCurve:curve('fireAlpha','effectTime',[[0,0],[.08,1],[.45,.85],[1,0]],[0,1]),
   sparkSpeedCurve:curve('sparkSpeed','particleAge',[[0,1],[.4,.55],[1,.1]],[0,2]),
   smokeSizeCurve:curve('smokeSize','particleAge',[[0,.3],[1,1.5]],[0,3]),
   emissionGapCurve:curve('emissionGap','emitterTime',[[0,0],[1,0]],[0,4],'frames'),
   debrisSpacingCurve:curve('spacingPx','pathPosition',[[0,12],[1,12]],[.25,100],'px'),
   layers:Object.fromEntries(LAYERS.map(name=>[name,{
    enabled:true,visible:true,x:0,y:0,rotation:0,timeOffset:0,
    blend:['flash','sparks'].includes(name)?'add':'normal'}]))
  };
 }
 const KNOWN=Object.keys(defaults());
 function normalize(input){
  if(!input||typeof input!=='object'||Array.isArray(input))throw TypeError('Invalid Explosion settings');
  for(const k of Object.keys(input))if(!KNOWN.includes(k))throw TypeError('Unknown Explosion key '+k);
  if(input.schemaVersion!==1)throw TypeError('Unsupported Explosion version');
  const ranges={blastRadius:[10,350],burstSparks:[0,500],initialSpeed:[0,800],
   expansion:[.2,6],shockwaveWidth:[0,60],smokePersistence:[0,180],turbulence:[0,1],
   sparkOriginGap:[.25,100],debrisSpacing:[8,32],burstJitter:[0,.45],
   secondaryCount:[0,500],smokeCount:[0,64],
   durationFrames:[6,600],exportFrames:[1,3600],heading:[-360,360],spread:[1,360],
   seed:[-2147483648,2147483647]};
  const integers=new Set(['burstSparks','smokePersistence','secondaryCount','smokeCount',
   'durationFrames','exportFrames','seed']);
  const out={schemaVersion:1};
  for(const [k,[a,b]] of Object.entries(ranges))out[k]=integers.has(k)?
   integer(input[k],k,a,b):finite(input[k],k,a,b);
  for(const k of ['secondaryBursts','loop','debrisSpacingCurveEnabled']){
   if(typeof input[k]!=='boolean')throw TypeError('Invalid boolean '+k);out[k]=input[k];
  }
  for(const [key,valid] of [['directionMode',['radial','directional']],
   ['quality',Object.keys(BUDGETS)],['style',['natural','stylized','magical']],
   ['spatialMode',['even','random','stratified','clustered']]]){
   if(!valid.includes(input[key]))throw TypeError('Invalid '+key);out[key]=input[key];
  }
  const a=input.anchor;
  if(!a||Object.keys(a).sort().join(',')!=='name,rotation,slot,space,type,x,y')
   throw TypeError('Invalid Explosion anchor');
  if(!['world','skeleton','bone','slot','attachment'].includes(a.type)||
     !['local','world'].includes(a.space)||typeof a.name!=='string'||typeof a.slot!=='string'||
     a.name.length>80||a.slot.length>80)throw TypeError('Invalid anchor semantics');
  if(['bone','slot','attachment'].includes(a.type)&&!a.name.trim())throw TypeError('Missing anchor name');
  out.anchor={...a,x:finite(a.x,'anchor.x',-10000,10000),
   y:finite(a.y,'anchor.y',-10000,10000),
   rotation:finite(a.rotation,'anchor.rotation',-360,360)};
  out.explosionGradient=Colors.normalize(input.explosionGradient);
  if(out.explosionGradient.domain!=='flameIntensity'||out.explosionGradient.parameterKey!=='explosionPalette')
   throw TypeError('Invalid Explosion gradient identity');
  for(const [key,name,domain,unit] of [
   ['radiusCurve','explosionRadius','effectTime','multiplier'],
   ['fireAlphaCurve','fireAlpha','effectTime','multiplier'],
   ['sparkSpeedCurve','sparkSpeed','particleAge','multiplier'],
   ['smokeSizeCurve','smokeSize','particleAge','multiplier'],
   ['emissionGapCurve','emissionGap','emitterTime','frames'],
   ['debrisSpacingCurve','spacingPx','pathPosition','px']]){
   const c=Curves.normalize(input[key]);
   if(c.parameterKey!==name||c.domain!==domain||c.valueUnit!==unit)
    throw TypeError('Invalid curve contract '+key);
   out[key]=c;
  }
  if(!input.layers||Object.keys(input.layers).sort().join(',')!==[...LAYERS].sort().join(','))
   throw TypeError('Invalid Explosion layer list');
  out.layers={};
  for(const key of LAYERS){
   const v=input.layers[key];
   if(!v||Object.keys(v).sort().join(',')!=='blend,enabled,rotation,timeOffset,visible,x,y'||
      typeof v.enabled!=='boolean'||typeof v.visible!=='boolean'||
      !['normal','add','screen','multiply'].includes(v.blend))
    throw TypeError('Invalid Explosion layer '+key);
   out.layers[key]={enabled:v.enabled,visible:v.visible,blend:v.blend,
    x:finite(v.x,key+'.x',-10000,10000),y:finite(v.y,key+'.y',-10000,10000),
    rotation:finite(v.rotation,key+'.rotation',-360,360),
    timeOffset:finite(v.timeOffset,key+'.timeOffset',-3600,3600)};
  }
  return out;
 }
 function circlePath(r){
  return {schemaVersion:1,closed:true,segments:[
   {p0:[r,0],p1:[r,K*r],p2:[K*r,r],p3:[0,r]},
   {p0:[0,r],p1:[-K*r,r],p2:[-r,K*r],p3:[-r,0]},
   {p0:[-r,0],p1:[-r,-K*r],p2:[-K*r,-r],p3:[0,-r]},
   {p0:[0,-r],p1:[K*r,-r],p2:[r,-K*r],p3:[r,0]}]};
 }
 function integrate(curve,v){
  const n=12;let sum=0;for(let j=0;j<n;j++)sum+=Curves.evaluate(curve,(j+.5)*v/n);
  return sum*v/n;
 }
 function sample(input,seconds){
  const cfg=normalize(input),t0=finite(seconds,'time',0,1e7);
  const duration=cfg.durationFrames/60,t=cfg.loop?t0%duration:t0;
  const quality=BUDGETS[cfg.quality],layers=Object.fromEntries(LAYERS.map(k=>[k,[]]));
  const events={sparks:[],debris:[]},color=u=>Colors.sample(cfg.explosionGradient,clamp(u,0,1));
  const active=name=>cfg.layers[name].enabled&&cfg.layers[name].visible;
  function phase(name){
   const local=t-cfg.layers[name].timeOffset/60;
   return {local,u:clamp(local/duration,0,1),active:active(name)&&local>=0};
  }
  function add(name,p){
   if(!active(name))return;
   const layer=cfg.layers[name],a=layer.rotation*Math.PI/180;
   if(p.kind==='poly'){
    p.points=p.points.map(([x,y])=>{const [rx,ry]=rotate(x,y,a);return [rx+layer.x,ry+layer.y]});
   }else {
    const [x,y]=rotate(p.x,p.y,a);
    p.x=x+layer.x;p.y=y+layer.y;
    if(p.kind==='rect')p.rotation=(p.rotation||0)+a;
   }
   layers[name].push(p);
  }
  const rgb=u=>color(u),base=cfg.blastRadius*cfg.expansion;
  function polar(a,r){return [Math.cos(a)*r,Math.sin(a)*r]}
  function angle(i,n,salt){
   if(cfg.directionMode==='radial')return TAU*((i+.5+cfg.turbulence*.15*(hash(cfg.seed,i,salt)-.5))/Math.max(1,n));
   const scatter=(i+.5)/Math.max(1,n)-.5;
   return cfg.heading*Math.PI/180+scatter*cfg.spread*Math.PI/180+
    (hash(cfg.seed,i,salt)-.5)*cfg.turbulence*.12;
  }
  // White-hot flash: independent, self-extinguishing, no ghost after frame 4.
  {const s=phase('flash');
   if(s.active&&s.local<=4/60){
    const strength=Math.pow(Math.max(0,1-s.local/(4/60)),1.6);
    const r=cfg.blastRadius*(.27+.17*(1-strength));
    if(strength>.0001){
     add('flash',{kind:'circle',x:0,y:0,radius:r,rgba:[255,247,212,.86*strength]});
     add('flash',{kind:'circle',x:0,y:0,radius:r*.57,rgba:[255,255,244,.95*strength]});
    }
   }
  }
  // Fire has rapid eased expansion and an independent, dying alpha envelope.
  {const s=phase('fire');
   if(s.active&&s.local<=duration){
    const radius=base*Curves.evaluate(cfg.radiusCurve,s.u);
    const opacity=clamp(Curves.evaluate(cfg.fireAlphaCurve,s.u),0,1);
    if(radius>0&&opacity>0){
     const tongues=Math.min(quality.maxTongues,cfg.style==='stylized'?8:cfg.style==='magical'?14:12);
     add('fire',{kind:'circle',x:0,y:0,radius:radius*.43,
      rgba:(()=>{const c=rgb(.9);c[3]*=opacity*.8;return c})()});
     for(let i=0;i<tongues;i++){
      const a=angle(i,tongues,97),w=TAU/Math.max(1,tongues)*.34;
      const mod=1+cfg.turbulence*.25*Math.sin(s.u*TAU*5+hash(cfg.seed,i,15)*TAU);
      const tip=polar(a,radius*(.74+.23*hash(cfg.seed,i,11))*mod);
      const left=polar(a-w,radius*.32),right=polar(a+w,radius*.32);
      const tipColor=rgb(.22+.65*hash(cfg.seed,i,21));tipColor[3]*=opacity*.86;
      add('fire',{kind:'poly',points:[left,tip,right,polar(a,radius*.15)],rgba:tipColor});
     }
    }
   }
  }
  // An explicitly independent, disappearing shockwave ring.
  {const s=phase('shockwave');
   if(s.active&&s.local<=duration&&cfg.shockwaveWidth>0&&s.u<.7){
    const v=clamp(s.u/.35,0,1),r=base*(1-Math.pow(1-v,3));
    const a=Math.pow(1-s.u/.7,1.5)*.85;
    if(r>0&&a>0)add('shockwave',{kind:'ring',x:0,y:0,
     radius:r,width:cfg.shockwaveWidth,rgba:[255,192,103,a]});
   }
  }
  // True absolute-time, individually seeded spark births. Speed is integrated,
  // not mistakenly used as a particles-per-frame rate.
  {const s=phase('sparks');
   if(s.active){
    const count=Math.min(cfg.burstSparks,quality.maxSparks);
    const groups=[{start:0,count,group:0}];
    if(cfg.secondaryBursts){
     groups.push({start:5/60,count:Math.min(cfg.secondaryCount,quality.maxSparks),group:1});
     groups.push({start:9/60,count:Math.min(cfg.secondaryCount,quality.maxSparks),group:2});
    }
    let budget=0;
    for(const group of groups)for(let i=0;i<group.count;i++){
     if(budget>=quality.maxSparks)continue;
     const idx=i+group.group*8192;
     const u=i/Math.max(1,group.count-1);
     const gap=Curves.evaluate(cfg.emissionGapCurve,u)/60;
     const born=group.start+gap+hash(cfg.seed,idx,51)*cfg.burstJitter/60;
     const age=(s.local-born)/Math.max(1/60,duration*.95);
     if(age<0||age>=1)continue;
     const a=angle(i,Math.max(1,group.count),group.group+117);
     const dist=cfg.sparkOriginGap+
      cfg.initialSpeed*(duration*.95)*integrate(cfg.sparkSpeedCurve,age)*
      (.75+.5*hash(cfg.seed,idx,23));
     const [x,y]=polar(a,dist);
     const ev={id:idx,born,x,y,age,group:group.group};
     events.sparks.push(ev);
     budget++;
     const c=rgb(.65+hash(cfg.seed,idx,77)*.35);
     c[3]*=(1-age)*.88;
     add('sparks',{kind:'circle',x,y,radius:Math.max(.4,2.6*(1-age*.7)),rgba:c});
    }
   }
  }
  // Arc-length distributed perimeter debris, independent from spark launches.
  {const s=phase('debris');
   if(s.active&&s.local<duration&&s.u>.025){
    const v=Curves.evaluate(cfg.radiusCurve,s.u);
    const R=Math.max(8,base*.64*v);
    const placement=Spacing.createSpatialPlacement({
     path:circlePath(R),baseSpacingPx:cfg.debrisSpacing,
     minSpacing:.25,maxSpacing:100,seed:(cfg.seed+23)|0,mode:cfg.spatialMode,
     jitter:0,spacingCurve:cfg.debrisSpacingCurveEnabled?cfg.debrisSpacingCurve:null,
     maxPoints:Math.max(200,quality.maxDebris*3),alignToTangent:true});
    const points=placement.points||[];
    for(let i=0;i<Math.min(points.length,quality.maxDebris);i++){
     const pt=points[i],noise=cfg.turbulence*9*(hash(cfg.seed,i,87)-.5);
     const x=pt.x+noise,y=pt.y+noise+12*s.u*s.u;
     events.debris.push({id:i,distance:pt.distance,x,y});
     const c=rgb(.15+.4*hash(cfg.seed,i,73));c[3]*=(1-s.u)*.93;
     const size=1.8+3.2*hash(cfg.seed,i,67);
     add('debris',{kind:'rect',x,y,w:size,h:size*.7,
      rotation:TAU*hash(cfg.seed,i,92)+s.u*4,rgba:c});
    }
   }
  }
  // Residual smoke can outlive durationFrames when exportFrames is extended.
  {const s=phase('smoke'),start=12/60,persist=cfg.smokePersistence/60;
   if(s.active&&persist>0&&s.local>=start&&s.local<duration+persist){
    const total=Math.max(1/60,duration+persist-start);
    const progress=clamp((s.local-start)/total,0,1),n=Math.min(cfg.smokeCount,quality.maxSmoke);
    const cloudRadius=cfg.blastRadius*(.12+.19*cfg.expansion);
    for(let i=0;i<n;i++){
     const born=start+(i/Math.max(1,n))*Math.min(duration-start,.24);
     if(s.local<born)continue;
     const age=clamp((s.local-born)/Math.max(1/60,duration+persist-born),0,1);
     const a=angle(i,Math.max(1,n),230);
     const drift=cloudRadius*(.22+.42*hash(cfg.seed,i,230));
     const [dx,dy]=polar(a,drift*age);
     const x=dx+Math.sin(age*7+i)*cfg.turbulence*12,
      y=dy-age*cfg.blastRadius*(.36+.38*hash(cfg.seed,i,231));
     const size=cfg.blastRadius*(.07+.09*hash(cfg.seed,i,233))*
      Curves.evaluate(cfg.smokeSizeCurve,age);
     const alpha=(1-age)*Math.min(1,(s.local-born)*12)*.22;
     if(size>0&&alpha>.0001)add('smoke',{kind:'circle',x,y,radius:size,
      rgba:[95+Math.round(22*hash(cfg.seed,i,235)),91,90,alpha]});
    }
   }
  }
  const primitives=LAYERS.reduce((sum,k)=>sum+layers[k].length,0);
  if(primitives>quality.maxPrimitives)throw Error('Explosion exceeds quality global primitive budget');
  return {time:t,oneShot:!cfg.loop,duration,phase:clamp(t/duration,0,1),
   layers,events,primitives,quality:cfg.quality};
 }
 function bounds(snapshot,anchor,rotation=0){
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  const hit=(x,y)=>{const [a,b]=rotate(x,y,rotation);const px=a+anchor.x,py=b+anchor.y;
   minX=Math.min(minX,px);maxX=Math.max(maxX,px);
   minY=Math.min(minY,py);maxY=Math.max(maxY,py)};
  for(const primitives of Object.values(snapshot.layers))for(const p of primitives){
   if(p.kind==='poly'){for(const pt of p.points)hit(pt[0],pt[1]);continue}
   if(p.kind==='rect'){
    for(const [x,y] of [[-p.w/2,-p.h/2],[p.w/2,-p.h/2],
      [-p.w/2,p.h/2],[p.w/2,p.h/2]]){
     const [dx,dy]=rotate(x,y,p.rotation);hit(p.x+dx,p.y+dy);
    }
   }else {
    const r=p.radius+(p.kind==='ring'?p.width/2:0);
    // A circle remains a circle after translation/rotation.
    const [x,y]=rotate(p.x,p.y,rotation);
    const cx=anchor.x+x,cy=anchor.y+y;
    minX=Math.min(minX,cx-r);maxX=Math.max(maxX,cx+r);
    minY=Math.min(minY,cy-r);maxY=Math.max(maxY,cy+r);
   }
  }
  return {empty:minX===Infinity,minX,maxX,minY,maxY,
   inside:minX===Infinity||(minX>=0&&minY>=0&&maxX<=512&&maxY<=512)};
 }
 return {VERSION:1,LAYERS,BUDGETS,defaults,normalize,sample,bounds};
});
