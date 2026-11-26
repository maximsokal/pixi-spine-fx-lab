// ELEC-03 A03: independent authoring session, no DOM ownership.
(function(root,make){
 'use strict';const api=Object.freeze(make(root.FxElectricAura||(typeof require==='function'?require('./aura-core.js'):null),root.FxAuraAnchors||(typeof require==='function'?require('./aura-anchors.js'):null)));
 if(typeof module==='object'&&module.exports)module.exports=api;else root.FxAuraAuthoring=api;
})(globalThis,function(H,A){
 'use strict';
 const FPS=60,finite=Number.isFinite,fail=m=>{throw Error('Electric Aura authoring: '+m);},clone=v=>JSON.parse(JSON.stringify(v)),clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 function seek(t,meta){if(!finite(t)||!Number.isInteger(meta.frames)||meta.frames<1||meta.frames>3600)fail('time/frames');const loop=meta.loop===true;return clamp(t,0,loop?meta.duration-1e-9:(meta.frames-1)/FPS);}
 function frame(t,m){return Math.min(m.frames-1,Math.floor(seek(t,m)*FPS+1e-8));}
 function advance(t,dt,m,loop){if(!finite(dt)||dt<0)fail('elapsed');return loop?((t+dt)%m.duration+m.duration)%m.duration:seek(t+dt,m);}
 function pointer(x,y,r){if(!r||![x,y,r.left,r.top,r.width,r.height].every(finite)||r.width<=0||r.height<=0)fail('viewport');return {x:(x-r.left)*512/r.width,y:(y-r.top)*512/r.height};}
 function transform(b,x,y){const a=b.rotation*Math.PI/180;return {x:b.x+b.scale*(x*Math.cos(a)-y*Math.sin(a)),y:b.y+b.scale*(x*Math.sin(a)+y*Math.cos(a))};}
 function inverse(b,x,y){if(!b||!finite(b.scale)||b.scale<=0)fail('anchor');const a=b.rotation*Math.PI/180,dx=(x-b.x)/b.scale,dy=(y-b.y)/b.scale;return {x:dx*Math.cos(a)+dy*Math.sin(a),y:-dx*Math.sin(a)+dy*Math.cos(a)};}
 function bases(settings,id,k,context){const e=settings.emitters.find(e=>e.id===id),l=e?.layers[k];if(!l)return null;const inherited=l.anchor.type==='inherit',b=A.resolve(inherited?e.anchor:l.anchor,context);if(!b)return null;const base=b;return {base,layer:{...base,...transform(base,l.x,l.y),rotation:base.rotation+l.rotation}};}
 function mode(settings,value){const n=clone(settings);if(!['oneShot','loop'].includes(value))fail('mode');n.mode=value;return n;}
 function options(v,asset){if(!v||typeof v.animation!=='string'||typeof v.skin!=='string'||!finite(v.speed)||v.speed<0||v.speed>4||typeof v.visible!=='boolean')fail('pose options');if(v.animation&&!asset?.animations.includes(v.animation)||v.skin&&!asset?.skins.includes(v.skin))fail('unknown animation or skin');return Object.freeze({animation:v.animation,skin:v.skin,speed:v.speed,visible:v.visible});}
 function createSession({PIXI,Spine,world,host,behindHost,models,loader,runtime,pose,initial=H.defaults()}){
  let dead=false,busy=false,asset=null,source=null,fx=null,cfg=initial,seconds=0,opt=options({animation:'',skin:'',speed:1,visible:true},null);
  function alive(){if(dead)fail('destroyed');}function ready(){alive();if(busy)fail('busy');}
  function paint(a,r,t,o){pose.pose(a,t,o,loader);return r.seek(t);}
  function stage(a,c,o,t){const plan=H.compile(c),at=seek(t,plan.meta);pose.pose(a,at,o,loader);const r=runtime.createRenderer({PIXI,Spine,world,host,behindHost,model:a?.model??null,settings:plan.settings});try{r.seek(at);return {r,at};}catch(e){r.destroy();throw e;}}
  function change(c,o){ready();let next;try{next=stage(asset,c,o,seconds);}catch(e){pose.pose(asset,seconds,opt,loader);throw e;}const old=fx;fx=next.r;cfg=fx.settings;seconds=next.at;opt=o;old?.destroy();return cfg;}
  async function replaceSource(input){ready();busy=true;let candidate=null,next=null;try{if(input!==null){candidate=await loader.create(input);alive();models.addChild(candidate.model);}const o=options({...opt,animation:candidate?.defaultAnimation||'',skin:candidate?.defaultSkin||''},candidate);next=stage(candidate,cfg,o,seconds);alive();const old=fx,prior=asset;fx=next.r;seconds=next.at;cfg=fx.settings;asset=candidate;source=input;opt=o;next=candidate=null;try{old.destroy();}finally{prior?.destroy();}return cfg;}finally{try{next?.r.destroy();}finally{try{candidate?.destroy();}finally{busy=false;}}}}
  function seekTo(t){ready();const at=seek(t,fx.meta);try{const q=paint(asset,fx,at,opt);seconds=at;return q;}catch(e){paint(asset,fx,seconds,opt);throw e;}}
  function setOptions(o){ready();const n=options(o,asset);try{paint(asset,fx,seconds,n);}catch(e){paint(asset,fx,seconds,opt);throw e;}opt=n;return opt;}
  function destroy(){if(dead)return;dead=true;try{fx?.destroy();}finally{try{asset?.destroy();}finally{fx=asset=source=null;}}}
  change(initial,opt);
  return Object.freeze({configure:c=>change(c,opt),replaceSource,setOptions,seek:seekTo,destroy,bases:(id,k)=>bases(cfg,id,k,{world,model:asset?.model,Spine}),get settings(){return cfg;},get seconds(){return seconds;},get meta(){return fx?.meta??null;},get sample(){return fx?.sample??null;},get missing(){return fx?.missing??[];},get asset(){return asset;},get source(){return source;},get options(){return opt;},get busy(){return busy;}});
 }
 return {FPS,seek,frame,advance,pointer,transform,inverse,bases,mode,createSession};
});
