// FIRE-01 — deterministic, renderer-neutral continuously looping torch geometry.
// All authored values use logical pixels/seconds; no ticker, GPU or camera.
(function(root, factory) {
  'use strict';
  const api=Object.freeze(factory(
    root.FxCurves||(typeof require==='function'?require('../../template/src/curve-core.js'):null),
    root.FxSpacing||(typeof require==='function'?require('../../template/src/spacing-core.js'):null),
    root.FxColors||(typeof require==='function'?require('../../template/src/color-core.js'):null)));
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.FxTorch=api;
})(globalThis,function(Curves,Spacing,Colors) {
 'use strict';
 if(!Curves||!Spacing||!Colors)throw Error('FxTorch requires Curves, Spacing, Colors');
 const BUDGETS=Object.freeze({
  low:{maxTongues:6,maxEmbers:32,maxPrimitives:50,glowPasses:2},
  balanced:{maxTongues:12,maxEmbers:96,maxPrimitives:125,glowPasses:4},
  high:{maxTongues:16,maxEmbers:160,maxPrimitives:210,glowPasses:6}
 });
 const clamp=(v,a,b)=>Math.min(b,Math.max(a,v)),TAU=Math.PI*2;
 const num=(v,key,a,b)=>{if(typeof v!=='number'||!Number.isFinite(v)||v<a||v>b)
   throw new TypeError('Invalid Torch '+key+' must be '+a+'..'+b);return v;};
 const ints=(v,key,a,b)=>{num(v,key,a,b);if(!Number.isInteger(v))throw new TypeError('Invalid integer '+key);return v;};
 function curve(key,domain,keys,min=0,max=4) {
  return Curves.normalize({schemaVersion:1,parameterKey:key,domain,
   inputUnit:domain==='particleAge'?'normalized-lifetime':'normalized-duration',
   valueUnit:'multiplier',inputRange:[0,1],valueRange:[min,max],defaultValue:1,
   clamp:'hold',monotonic:false,
   keys:keys.map((key,i)=>({id:'k'+i,x:key[0],y:key[1],mode:'linear'}))});
 }
 function defaults(){
  return {schemaVersion:1,flameHeight:110,baseWidth:36,turbulence:.4,
   tongueCount:5,emberSize:3,glowRadius:24,flickerFrequency:7,
   emberRate:20,emberOriginGap:8,emberIntervalJitter:.25,emberSpacingJitter:0,
   tongueGap:8,emberLife:.85,
   cycleFrames:60,ignitionFrames:0,extinguishFrames:0,seed:8,
   emberSpacingMode:'even',emberSpacingCurveEnabled:false,
   quality:'balanced',style:'natural',
   anchor:{type:'world',space:'world',name:'',slot:'',x:256,y:355,rotation:0},
   flameGradient:Colors.normalize({schemaVersion:1,parameterKey:'flamePalette',
    domain:'flameIntensity',inputUnit:'normalized-intensity',space:'srgb',
    clamp:'hold',stops:[
     {id:'outer',position:0,rgba:[214,46,18,.9]},
     {id:'mid',position:.5,rgba:[255,148,46,.95]},
     {id:'core',position:1,rgba:[255,241,173,1]}]}),
   widthCurve:curve('flameWidth','effectTime',[[0,.8],[.3,1.15],[1,.8]]),
   flickerCurve:curve('flickerStrength','effectTime',[[0,.4],[.25,1],[.55,.5],[1,.4]]),
   emberAlphaCurve:curve('emberAlpha','particleAge',[[0,0],[.15,1],[1,0]]),
   emberRateCurve:curve('emissionRate','emitterTime',[[0,1],[.5,1],[1,1]]),
   emberSpacingCurve:Curves.normalize({schemaVersion:1,parameterKey:'spacingPx',
    domain:'pathPosition',inputUnit:'normalized-path',valueUnit:'px',
    inputRange:[0,1],valueRange:[.25,100],defaultValue:8,clamp:'hold',
    monotonic:false,keys:[{id:'start',x:0,y:8,mode:'linear'},
      {id:'end',x:1,y:8,mode:'linear'}]}),
   layers:Object.fromEntries(['core','tongues','glow','embers'].map(key=>
    [key,{enabled:true,visible:true,x:0,y:0,blend:key==='glow'?'add':'normal'}]))
  };
 }
 const FIELDS=Object.keys(defaults()),LAYER_NAMES=['core','tongues','glow','embers'];
 function normalize(input) {
  if(!input||typeof input!=='object'||Array.isArray(input))throw TypeError('Invalid Torch settings');
  for(const key of Object.keys(input))if(!FIELDS.includes(key))throw TypeError('Unknown Torch parameter '+key);
  if(input.schemaVersion!==1)throw TypeError('Unsupported Torch schemaVersion');
  const out={schemaVersion:1};
  const ranges={flameHeight:[16,320],baseWidth:[4,160],turbulence:[0,1],
   tongueCount:[1,16],emberSize:[1,12],glowRadius:[0,90],
   flickerFrequency:[0,20],emberRate:[0,240],emberOriginGap:[.25,100],
   emberIntervalJitter:[0,.45],emberSpacingJitter:[0,.45],
   tongueGap:[4,24],emberLife:[.1,4],cycleFrames:[6,3600],
   ignitionFrames:[0,600],extinguishFrames:[0,600],
   seed:[-2147483648,2147483647]};
  for(const [key,[lo,hi]] of Object.entries(ranges))
   out[key]=['tongueCount','cycleFrames','ignitionFrames','extinguishFrames','seed']
      .includes(key)?ints(input[key],key,lo,hi):num(input[key],key,lo,hi);
  out.emberSpacingMode=input.emberSpacingMode;
  if(!['even','random','stratified','clustered'].includes(out.emberSpacingMode))
    throw TypeError('Invalid ember spacing mode');
  if(typeof input.emberSpacingCurveEnabled!=='boolean')
    throw TypeError('Invalid ember spacing curve enabled state');
  out.emberSpacingCurveEnabled=input.emberSpacingCurveEnabled;
  out.quality=input.quality;
  out.style=input.style;
  if(!BUDGETS[out.quality])throw TypeError('Invalid quality');
  if(!['natural','stylized','magical'].includes(out.style))throw TypeError('Invalid style');
  const a=input.anchor;
  if(!a||Object.keys(a).sort().join(',')!=='name,rotation,slot,space,type,x,y')
    throw TypeError('Invalid anchor document');
  if(!['world','skeleton','bone','slot','attachment'].includes(a.type)||
     !['world','local'].includes(a.space)||typeof a.name!=='string'||
     typeof a.slot!=='string'||a.name.length>80||a.slot.length>80)
    throw TypeError('Invalid anchor type, name or space');
  if(['bone','slot','attachment'].includes(a.type)&&!a.name.trim())
    throw TypeError('Invalid empty named anchor');
  out.anchor={...a,x:num(a.x,'anchor x',-10000,10000),y:num(a.y,'anchor y',-10000,10000),
   rotation:num(a.rotation,'anchor rotation',-360,360)};
  out.flameGradient=Colors.normalize(input.flameGradient);
  if(out.flameGradient.domain!=='flameIntensity'||out.flameGradient.parameterKey!=='flamePalette')
    throw TypeError('Invalid flame gradient domain');
  for(const [key,parameter,domain] of [
   ['widthCurve','flameWidth','effectTime'],['flickerCurve','flickerStrength','effectTime'],
   ['emberAlphaCurve','emberAlpha','particleAge'],
   ['emberRateCurve','emissionRate','emitterTime'],
   ['emberSpacingCurve','spacingPx','pathPosition']]){
    const c=Curves.normalize(input[key]);
    if(c.domain!==domain||c.parameterKey!==parameter||
      c.valueUnit!==(key==='emberSpacingCurve'?'px':'multiplier'))
      throw TypeError('Invalid Torch curve domain '+key);
    // Cyclic curves must meet exactly at the seam.
    if(['widthCurve','flickerCurve','emberRateCurve'].includes(key)&&
       Math.abs(Curves.evaluate(c,0)-Curves.evaluate(c,1))>1e-9)
      throw TypeError('Invalid cyclic curve: endpoints must match '+key);
    out[key]=c;
  }
  if(!input.layers||Object.keys(input.layers).sort().join(',')!==[...LAYER_NAMES].sort().join(','))
    throw TypeError('Invalid Torch layer set');
  out.layers={};
  for(const key of LAYER_NAMES){
   const l=input.layers[key];
   if(!l||Object.keys(l).sort().join(',')!=='blend,enabled,visible,x,y'||
      typeof l.enabled!=='boolean'||typeof l.visible!=='boolean'||
      !['normal','add','multiply','screen'].includes(l.blend))
    throw TypeError('Invalid Torch layer '+key);
   out.layers[key]={enabled:l.enabled,visible:l.visible,
    x:num(l.x,key+' x',-10000,10000),y:num(l.y,key+' y',-10000,10000),blend:l.blend};
  }
  return out;
 }
 function hash(seed,salt){
  let x=(seed^salt)|0;x=Math.imul(x^(x>>>16),0x7feb352d);
  x=Math.imul(x^(x>>>15),0x846ca68b);return ((x^(x>>>16))>>>0)/4294967296;
 }
 function shape(points,rgba,kind='poly'){return {kind,points,rgba};}
 function sample(input,seconds){
  const cfg=normalize(input),secondsSafe=num(seconds,'time',0,1e7);
  const period=cfg.cycleFrames/60,at=((secondsSafe%period)+period)%period,u=at/period;
  const phase=TAU*u,quality=BUDGETS[cfg.quality];
  const widthPulse=Curves.evaluate(cfg.widthCurve,u);
  const flickerPower=Curves.evaluate(cfg.flickerCurve,u);
  const freq=cfg.flickerFrequency?Math.max(1,Math.round(cfg.flickerFrequency*period)):0;
  const flick=1+.16*flickerPower*Math.sin(phase*freq+.2);
  const lifeScale=cfg.ignitionFrames?Math.min(1,secondsSafe/(cfg.ignitionFrames/60)):1;
  const ending=cfg.extinguishFrames&&secondsSafe>=period-cfg.extinguishFrames/60?
      Math.max(0,(period-secondsSafe)/(cfg.extinguishFrames/60)):1;
  const gain=clamp(lifeScale*ending,0,1);
  const H=cfg.flameHeight*flick*gain,W=cfg.baseWidth*widthPulse*gain;
  const rgba=i=>Colors.sample(cfg.flameGradient,clamp(i,0,1));
  const layers={core:[],tongues:[],glow:[],embers:[]};
  const active=name=>cfg.layers[name].enabled&&cfg.layers[name].visible&&gain>0;
  function add(name,primitive){
    if(!active(name))return;
    const offset=cfg.layers[name];
    if(primitive.kind==='circle'||primitive.kind==='ellipse'){
     primitive.x+=offset.x;primitive.y+=offset.y;
    }else primitive.points=primitive.points.map(([x,y])=>[x+offset.x,y+offset.y]);
    layers[name].push(primitive);
  }
  const tongueCount=Math.min(cfg.tongueCount,quality.maxTongues);
  const wav=(i,v,k=0)=>Math.sin(phase*(freq||1)+hash(cfg.seed,i*119+k)*TAU+v*9);
  const bend=(i,v)=>cfg.turbulence*W*(.3*wav(i,v)+.13*Math.sin(phase*3+v*5+i));
  function makeTongue(i,x,width,height,intensity){
    const left=[],right=[],seg=cfg.style==='stylized'?6:cfg.style==='magical'?12:9;
    const styleHeight=cfg.style==='magical'?1.14:cfg.style==='stylized'?.96:1;
    const heightVar=height*styleHeight*(1+cfg.turbulence*.13*wav(i,.25));
    for(let j=0;j<=seg;j++){
      const v=j/seg,vertical=-heightVar*v;
      const taper=Math.pow(1-v,1.25)*width*.5;
      const noise=cfg.turbulence*.14*Math.sin(TAU*(v*3+u*freq)+i)*Math.sin(Math.PI*v);
      const centre=x+bend(i,v)*v;
      left.push([centre-taper*(1+noise),vertical]);
      right.push([centre+taper*(1-noise),vertical]);
    }
    return shape([...left,...right.reverse()],rgba(intensity));
  }
  if(H>0&&W>0){
   add('core',makeTongue(101,0,W*.62,H*.85,.97));
   for(let i=0;i<tongueCount;i++){
    const x=(i-(tongueCount-1)/2)*Math.min(cfg.tongueGap,W/Math.max(1,tongueCount-1));
    const variance=.64+.32*hash(cfg.seed,i*899+137);
    const height=H*variance*(1+.12*Math.sin(phase*(2+i%3)+i*2));
    add('tongues',makeTongue(i,x,W/(1.8+Math.sqrt(tongueCount)),height,.31+i/(tongueCount*3)));
   }
  }
  if(active('glow')&&cfg.glowRadius>0&&H>0){
   const rad=cfg.glowRadius,passes=quality.glowPasses;
   for(let i=passes;i>0;i--){
    const ratio=i/passes;
    const color=rgba(.45);color[3]*=(.04+(.11*(1-ratio)))*gain;
    const y=-H*.42;
    add('glow',{kind:'ellipse',x:0,y,rx:W*.5+rad*ratio,ry:H*.45+rad*ratio,rgba:color});
   }
  }
  const events=[];
  if(cfg.emberRate>0&&cfg.layers.embers.enabled&&cfg.layers.embers.visible){
   const schedule=Spacing.createTemporalSchedule({schemaVersion:1,mode:'custom',frequencySource:'rate',
    baseRate:cfg.emberRate,duration:period,seed:cfg.seed,maxEvents:quality.maxEmbers*4,
    interval:1/cfg.emberRate,minInterval:1/480,jitter:cfg.emberIntervalJitter,
    rateCurve:cfg.emberRateCurve});
   const basePath={schemaVersion:1,closed:false,segments:[{p0:[-W/2,0],
     p1:[-W/6,0],p2:[W/6,0],p3:[W/2,0]}]};
   const placement=W>0?Spacing.createSpatialPlacement({path:basePath,
     baseSpacingPx:cfg.emberOriginGap,minSpacing:.25,maxSpacing:100000,
     seed:cfg.seed,mode:cfg.emberSpacingMode,jitter:cfg.emberSpacingJitter,
     spacingCurve:cfg.emberSpacingCurveEnabled?cfg.emberSpacingCurve:null,
     maxPoints:200,alignToTangent:true,
     pathFollow:'clamp'}):{points:[]};
   const anchors=placement.points.length?placement.points:[{x:0}];
   const cycles=Math.ceil(cfg.emberLife/period)+1;
   for(let c=-cycles;c<=0;c++)for(const e of schedule.events){
    const birth=c*period+e.time,age=(at-birth)/cfg.emberLife;
    if(age<0||age>=1)continue;
    const id=(e.index+c*schedule.events.length)|0;
    const x=anchors[e.index%anchors.length].x+(hash(cfg.seed,id+77)-.5)*W*.13;
    events.push({id,birth:Math.round((birth%period+period)%period*1e9)/1e9,x,age});
    const sway=Math.sin(age*9+hash(cfg.seed,id+103)*TAU)*W*.4;
    const opacity=clamp(Curves.evaluate(cfg.emberAlphaCurve,age),0,1)*.82;
    if(opacity>.001){
     const color=rgba(.7);color[3]*=opacity;
     add('embers',{kind:'circle',x:x+sway,y:-H*.15-age*H*1.3,
      radius:Math.max(.25,cfg.emberSize*(1-age*.5)),rgba:color});
    }
   }
   // Deterministically select most-recent visible embers under global quality cap.
   if(layers.embers.length>quality.maxEmbers)layers.embers.splice(0,layers.embers.length-quality.maxEmbers);
  }
  const primitives=Object.values(layers).reduce((n,a)=>n+a.length,0);
  if(primitives>quality.maxPrimitives)throw Error('Invalid Torch global primitive budget');
  return {time:at,period,phase:u,layers,events:events.slice(-quality.maxEmbers),quality:cfg.quality};
 }
 return {VERSION:1,BUDGETS,defaults,normalize,sample};
});
