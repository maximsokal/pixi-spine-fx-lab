// GAME-08: pure shield geometry driven by compiled curves and explicit schedules.
(function(root,factory){
 const api=Object.freeze(factory(root.FxShieldClock||(typeof require==='function'?require('./shield-clock.js'):null)));
 if(typeof module==='object'&&module.exports)module.exports=api;else root.FxShieldGeometry=api;
})(globalThis,function(Clock){
 'use strict';
 const FPS=60,DEG=Math.PI/180,KEYS=['shell','halo','impact'],BUDGETS=Object.freeze({low:256,balanced:1024,high:2048}),LIMIT=1e6;
 const fail=m=>{throw RangeError('GAME-08 '+m);},clamp=(x,a,b)=>Math.max(a,Math.min(b,x)),mod=(x,n)=>((x%n)+n)%n;
 const identity=Object.freeze({x:0,y:0,rotation:0,scale:1});
 function fields(o,keys){if(!o||typeof o!=='object'||Array.isArray(o)||Object.keys(o).length!==keys.length||keys.some(k=>!Object.hasOwn(o,k)))fail('invalid fields');}
 function number(v,k,a,b,int=false){if(!Number.isFinite(v)||v<a||v>b||(int&&!Number.isInteger(v)))fail('invalid '+k);return v;}
 function bool(v){if(typeof v!=='boolean')fail('invalid toggle');return v;}
 function choice(v,options,k){if(!options.includes(v))fail('invalid '+k);return v;}
 function id(v){if(typeof v!=='string'||!/^[a-z][a-z0-9_-]{0,63}$/i.test(v))fail('invalid id');return v;}
 function freeze(o){if(o&&typeof o==='object'&&!Object.isFrozen(o)){Object.values(o).forEach(freeze);Object.freeze(o);}return o;}
 function transform(seed,type){return {enabled:true,visible:true,x:0,y:0,rotation:0,scale:1,timeOffset:0,seed,anchor:{type,name:''}};}
 function newEmitter(i=0){number(i,'emitter index',0,100000,true);return {id:'shield'+(i+1),...transform(131+137*i,'world'),x:256,y:256,impacts:[],sparkAnchors:[],layers:Object.fromEntries(KEYS.map((k,j)=>[k,{...transform(31+97*j,'inherit'),alpha:1,blend:k==='shell'?'normal':'add',placement:k==='halo'?'behind':'front'}]))};}
 function defaults(){return {schemaVersion:1,mode:'loop',durationFrames:60,pulseRate:1.5,radius:110,rimThickness:5,baseAlpha:.28,glow:.55,hitRadius:90,hitLifeFrames:24,sparkTravel:18,seed:4108,quality:'balanced',emitters:[newEmitter()]};}
 function normalize(input){
  const base=defaults();fields(input,Object.keys(base));if(input.schemaVersion!==1)fail('schemaVersion');
  const c={schemaVersion:1,mode:choice(input.mode,['loop','oneShot'],'mode'),durationFrames:number(input.durationFrames,'durationFrames',2,3600,true)};
  for(const [k,a,b,int] of [['pulseRate',0,10],['radius',12,350],['rimThickness',.5,35],['baseAlpha',0,.85],['glow',0,2],['hitRadius',0,250],['hitLifeFrames',1,c.durationFrames,true],['sparkTravel',0,250],['seed',-2147483648,2147483647,true]])c[k]=number(input[k],k,a,b,int);
  c.quality=choice(input.quality,Object.keys(BUDGETS),'quality');
  function tx(v,layer){
   const a=v.anchor;fields(a,['type','name']);const type=choice(a.type,layer?['inherit','world','local','bone']:['world','local','bone'],'anchor');
   if(typeof a.name!=='string'||a.name.length>128||(type==='bone'?!a.name.trim():a.name!==''))fail('invalid anchor name');
   return {enabled:bool(v.enabled),visible:bool(v.visible),x:number(v.x,'x',-16384,16384),y:number(v.y,'y',-16384,16384),rotation:number(v.rotation,'rotation',-3600,3600),scale:number(v.scale,'scale',.01,20),timeOffset:number(v.timeOffset,'timeOffset',-3600,3600),seed:number(v.seed,'seed',-2147483648,2147483647,true),anchor:{type,name:a.name}};
  }
  if(!Array.isArray(input.emitters)||input.emitters.length<1||input.emitters.length>4)fail('emitter count');
  const ids=new Set(),end=c.durationFrames-1;
  c.emitters=Array.from(input.emitters,e=>{
   const b=newEmitter();fields(e,Object.keys(b));const eid=id(e.id);if(ids.has(eid))fail('duplicate emitter id');ids.add(eid);fields(e.layers,KEYS);
   if(!Array.isArray(e.impacts)||e.impacts.length>4096||!Array.isArray(e.sparkAnchors)||e.sparkAnchors.length>2048)fail('schedule bounds');
   const events=new Set();let last=-1;
   const impacts=Array.from(e.impacts,h=>{fields(h,['id','frame']);const hid=id(h.id),frame=number(h.frame,'hit frame',0,c.mode==='loop'?c.durationFrames:end);if((c.mode==='loop'&&frame===c.durationFrames)||frame<=last||events.has(hid))fail('invalid hit order/id');last=frame;events.add(hid);return {id:hid,frame};});
   last=-1;
   const sparkAnchors=Array.from(e.sparkAnchors,p=>{fields(p,['x','y','distance']);const x=number(p.x,'spark x',-350,350),y=number(p.y,'spark y',-350,350),distance=number(p.distance,'spark distance',0,1e6);if(Math.hypot(x,y)<1e-9||distance<=last)fail('invalid spark anchor');last=distance;return {x,y,distance};});
   const layers=Object.fromEntries(KEYS.map(k=>{const l=e.layers[k];fields(l,Object.keys(b.layers[k]));return [k,{...tx(l,true),alpha:number(l.alpha,'layer alpha',0,1),blend:choice(l.blend,['normal','add','screen','multiply'],'blend'),placement:choice(l.placement,['front','behind'],'placement')}];}));
   return {id:eid,...tx(e,false),impacts,sparkAnchors,layers};
  });return c;
 }
 function goodPose(p){return p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&Number.isFinite(p.rotation)&&Number.isFinite(p.scale)&&p.scale>=1e-9&&p.scale<=LIMIT&&Math.abs(p.x)<=LIMIT&&Math.abs(p.y)<=LIMIT&&Math.abs(p.rotation)<=LIMIT;}
 function point(p,x,y){const a=p.rotation*DEG,cos=Math.cos(a),sin=Math.sin(a);return {x:p.x+p.scale*(cos*x-sin*y),y:p.y+p.scale*(sin*x+cos*y)};}
 function compose(a,b){if(!goodPose(a))return null;const p={...point(a,b.x,b.y),rotation:a.rotation+b.rotation,scale:a.scale*b.scale};return goodPose(p)?p:null;}
 function anchor(a,poses,parent){if(a.type==='inherit')return parent;if(a.type==='world')return identity;if(a.type==='local')return poses.local;return poses.bones&&Object.hasOwn(poses.bones,a.name)?poses.bones[a.name]:null;}
 const active=(e,l)=>e.enabled&&e.visible&&l.enabled&&l.visible&&l.alpha>0;
 function hash(s){let h=2166136261;for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619);return h|0;}
 function random(seed,index,salt){let x=seed^Math.imul(index+1,0x9e3779b1)^hash(salt);x=Math.imul(x^(x>>>16),0x7feb352d);x=Math.imul(x^(x>>>15),0x846ca68b);return ((x^(x>>>16))>>>0)/4294967296;}
 function compileGeometry(input,evals){
  if(!Clock)fail('clock dependency missing');fields(evals,['glow','radius','alpha','color']);for(const f of Object.values(evals))if(typeof f!=='function')fail('curve evaluator');
  // Copy callbacks so replacing a property on the caller's object cannot change compiled behavior.
  const {glow:glowAt,radius:radiusAt,alpha:alphaAt,color:colorAt}=evals,c=freeze(normalize(input));
  const clock=Clock.compilePulseClock({mode:c.mode,durationFrames:c.durationFrames,pulseRate:c.pulseRate}),loop=c.mode==='loop',end=loop?c.durationFrames:c.durationFrames-1;
  let reserved=0;
  for(const e of c.emitters){for(const k of KEYS)if(active(e,e.layers[k]))reserved+=k==='impact'?e.impacts.length*(1+e.sparkAnchors.length):1;}
  if(reserved>BUDGETS[c.quality])fail('primitive budget');
  function rgba(u,opacity){const v=colorAt(u);if(!Array.isArray(v)||v.length!==4||Array.from(v).some((x,i)=>!Number.isFinite(x)||x<0||x>(i===3?1:255)))fail('color evaluator');return [v[0],v[1],v[2],clamp(v[3]*opacity,0,1)];}
  function localFrame(seconds){const n=Math.round(seconds*FPS);return Math.abs(seconds-n/FPS)<=1e-9?n:seconds*FPS;}
  function sample(seconds,poses={}){
   number(seconds,'seconds',0,1e6);if(!poses||typeof poses!=='object'||Array.isArray(poses))fail('poses');
   const frame=localFrame(seconds),diagnostics=[];let cost=0;
   const emitters=c.emitters.map(e=>{
    const parent=compose(anchor(e.anchor,poses,null),e),layers={shell:[],halo:[],impact:[]};
    for(const k of KEYS){
     const l=e.layers[k];if(!active(e,l))continue;
     let f=frame-localFrame(e.timeOffset)-localFrame(l.timeOffset);
     if(loop)f=mod(f,end);else if(f<=0||f>=end||frame<=0||frame>=end)continue;
     const envelope=loop?1:Math.min(1,f/(end*.2),(end-f)/(end*.2),frame/(end*.2),(end-frame)/(end*.2));
     const p=compose(anchor(l.anchor,poses,parent),l);
     // Bound derived geometry too, not just the input pose. Maximum local
     // extent includes the shield/rim and spark anchor/travel ranges.
     if(!p||Math.max(Math.abs(p.x),Math.abs(p.y))+800*p.scale>LIMIT){diagnostics.push({emitterId:e.id,layer:k,reason:'invalid-or-missing-anchor'});continue;}
     const items=layers[k];
     function primitive(kind,x,y,r,inner,opacity,u,extra={}){const color=rgba(u,opacity*l.alpha*envelope);if(color[3]===0)return;const pos=point(p,x,y);items.push({kind,...pos,radius:r*p.scale,innerRadius:clamp(inner,0,r)*p.scale,rgba:color,blend:l.blend,placement:l.placement,...(kind==='shell'?{centerAlpha:color[3]*.15}:{}),...extra});}
     if(k!=='impact'){
      const pulse=clock.sample(f/FPS),g=number(glowAt(f/end),'glow curve',0,1),intensity=g*(.6+.4*pulse.pulse);
      if(k==='shell'&&c.baseAlpha>0)primitive('shell',0,0,c.radius,Math.max(0,c.radius-c.rimThickness),c.baseAlpha*intensity,0);
      if(k==='halo'&&c.glow>0)primitive('halo',0,0,c.radius+c.rimThickness,Math.max(0,c.radius-c.rimThickness),Math.min(.85,c.glow*.5*intensity),.5);
     }else{
      const seed=c.seed^e.seed^l.seed^hash(e.id);
      for(const h of e.impacts){let ageFrame=f-h.frame;if(loop)ageFrame=mod(ageFrame,end);if(ageFrame<0||ageFrame>=c.hitLifeFrames)continue;
       const age=ageFrame/c.hitLifeFrames,opacity=number(alphaAt(age),'hit alpha curve',0,1);if(opacity===0)continue;
       const r=c.hitRadius*number(radiusAt(age),'hit radius curve',0,1);
       if(r>0)primitive('ripple',0,0,r,Math.max(0,r-c.rimThickness),opacity,age,{hitId:h.id,age});
       for(let i=0;i<e.sparkAnchors.length;i++){const a=e.sparkAnchors[i],length=Math.hypot(a.x,a.y),travel=c.sparkTravel*age*(.5+random(seed,i,h.id));primitive('spark',a.x+a.x/length*travel,a.y+a.y/length*travel,1.5+2*random(seed,i,h.id+':size'),0,opacity*(1-age),age,{hitId:h.id,age,anchorDistance:a.distance});}
      }
     }
     cost+=items.length;
    }
    return {id:e.id,layers};
   });return {emitters,diagnostics,cost};
  }
  return Object.freeze({settings:c,requestedHz:clock.requestedHz,effectiveHz:clock.effectiveHz,reserved,sample});
 }
 return {defaults,newEmitter,normalize,compileGeometry};
});
