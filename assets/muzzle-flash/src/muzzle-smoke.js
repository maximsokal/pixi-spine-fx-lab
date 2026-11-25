// GAME-01 M02b2: optional deterministic smoke and independent layer blending.
(function(root,make){
 'use strict';
 const api=Object.freeze(make());
 if(typeof module==='object'&&module.exports)module.exports=api;else root.FxMuzzleSmoke=api;
})(globalThis,function(){
 'use strict';
 const FPS=60,RAD=Math.PI/180,KINDS=['core','tongues','sparks','smoke'];
 function fail(k){throw TypeError('Muzzle smoke: '+k);}
 function exact(v,keys,k){if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).length!==keys.length||keys.some(x=>!Object.hasOwn(v,x)))fail(k);}
 function num(v,k,min,max,int=false){if(!Number.isFinite(v)||v<min||v>max||(int&&!Number.isInteger(v)))fail(k);return v;}
 function freeze(v){if(v&&typeof v==='object'&&!Object.isFrozen(v)){Object.values(v).forEach(freeze);Object.freeze(v);}return v;}
 function defaults(){return {enabled:false,x:0,y:0,rotation:0,delayFrames:2,seed:31418,opacity:.35,count:4,spreadFrames:4,lifeFrames:18,speed:65,radius:7,growth:2,
  palette:{schemaVersion:1,parameterKey:'smokePalette',domain:'particleAge',inputUnit:'normalized-lifetime',space:'srgb',clamp:'hold',stops:[{id:'start',position:0,rgba:[165,150,135,0]},{id:'peak',position:.18,rgba:[145,136,128,1]},{id:'end',position:1,rgba:[100,100,105,0]}]}};}
 const ranges={x:[-10000,10000],y:[-10000,10000],rotation:[-360,360],delayFrames:[0,60,true],seed:[-2147483648,2147483647,true],opacity:[0,1],count:[0,16,true],spreadFrames:[0,24,true],lifeFrames:[1,120,true],speed:[0,1000],radius:[1,100],growth:[1,4]};
 function normalize(v,colors){
  exact(v,['enabled',...Object.keys(ranges),'palette'],'settings');if(typeof v.enabled!=='boolean')fail('enabled');
  const out={enabled:v.enabled};for(const [k,r] of Object.entries(ranges))out[k]=num(v[k],k,...r);
  if(!colors||typeof colors.normalize!=='function'||typeof colors.sample!=='function')fail('shared colors required');
  const raw=v.palette;if(!raw||!Array.isArray(raw.stops)||raw.stops.length>8)fail('palette');
  for(const s of raw.stops){if(!s||!Array.isArray(s.rgba)||s.rgba.length!==4||Array.from(s.rgba).some((x,i)=>!Number.isFinite(x)||x<0||x>(i===3?1:255)))fail('RGBA');}
  const p=colors.normalize(raw);if(p.parameterKey!=='smokePalette'||p.domain!=='particleAge'||p.inputUnit!=='normalized-lifetime')fail('palette binding');out.palette=p;return out;
 }
 function random(seed,i,salt){let n=(seed^Math.imul(i+1,0x9e3779b1)^Math.imul(salt+1,0x85ebca6b))|0;n=Math.imul(n^(n>>>16),0x7feb352d);n=Math.imul(n^(n>>>15),0x846ca68b);return ((n^(n>>>16))>>>0)/4294967296;}
 function compile(input,colors){
  const s=freeze(normalize(input,colors)),life=s.lifeFrames/FPS;
  const events=freeze(Array.from({length:s.count},(_,i)=>({index:i,time:(s.delayFrames+(s.count===1?0:i*s.spreadFrames/(s.count-1)))/FPS,angle:(random(s.seed,i,0)-.5)*.7,rate:.65+.7*random(s.seed,i,1),size:.75+.5*random(s.seed,i,2)})));
  function sample(t,p){
   num(t,'time',0,3600);if(!p||!s.enabled||!s.opacity)return [];
   const ax=num(p.x,'anchor x',-900000,900000),ay=num(p.y,'anchor y',-900000,900000),a=num(p.rotation,'anchor rotation',-359640,359640)*RAD;
   const x=ax+s.x*Math.cos(a)-s.y*Math.sin(a),y=ay+s.x*Math.sin(a)+s.y*Math.cos(a);
   return events.flatMap(e=>{const dt=t-e.time;if(dt<0||dt>=life-1e-9)return [];
    const age=dt/life,rgba=colors.sample(s.palette,age),alpha=rgba[3]*s.opacity;if(!alpha)return [];
    const direction=a+s.rotation*RAD+e.angle,dist=s.speed*e.rate*dt*(1-.5*age);
    return [{index:e.index,age,x:x+dist*Math.cos(direction),y:y+dist*Math.sin(direction),radius:s.radius*e.size*(1+(s.growth-1)*age),rgba:[...rgba.slice(0,3),alpha]}];});
  }
  return Object.freeze({settings:s,events,sample});
 }
 function blendDefaults(){return Object.fromEntries(KINDS.map(k=>[k,'normal']));}
 function blends(v){exact(v,KINDS,'blends');for(const k of KINDS)if(!['normal','add'].includes(v[k]))fail('blend '+k);return Object.freeze({...v});}
 // Compose existing effect and anchor contracts without changing their v1 schemas.
 function createCompiler({compileEffect,anchors,colors,host,world,model=null}){
  if(typeof compileEffect!=='function'||!anchors||typeof anchors.createCompiler!=='function')fail('dependencies');
  const base=anchors.createCompiler({compile:compileEffect,host,world,model});
  return function(input){
   const legacy=input&&Object.keys(input).length===2&&Object.hasOwn(input,'effect')&&Object.hasOwn(input,'anchors');
   const v=legacy?{schemaVersion:1,...input,smoke:defaults(),smokeAnchor:anchors.defaults().core,blends:blendDefaults()}:input;
   exact(v,['schemaVersion','effect','anchors','smoke','smokeAnchor','blends'],'preset');if(v.schemaVersion!==1)fail('schemaVersion');
   const fx=base({effect:v.effect,anchors:v.anchors}),smoke=compile(v.smoke,colors),mix=blends(v.blends);
   const smokeAnchor=anchors.normalizeMap({core:v.smokeAnchor,tongues:v.smokeAnchor,sparks:v.smokeAnchor}).core;
   const settings=freeze({schemaVersion:1,effect:fx.settings.effect,anchors:fx.settings.anchors,smoke:smoke.settings,smokeAnchor,blends:mix});
   function sample(t){const result=fx.sample(t),p=smoke.settings.enabled?anchors.resolve(smokeAnchor,{host,world,model}):null;
    result.smoke=smoke.sample(t,p);return Object.fromEntries(KINDS.map(k=>[k,result[k].map(item=>({...item,blend:mix[k]}))]));}
   return Object.freeze({settings,sample});
  };
 }
 return {VERSION:1,defaults,normalize,compile,blendDefaults,createCompiler};
});
