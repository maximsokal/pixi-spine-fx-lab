// GAME-03 S03: editor session and logical authoring helpers, without DOM ownership.
(function(root,make){
 'use strict';const api=Object.freeze(make());
 if(typeof module==='object'&&module.exports)module.exports=api;else root.FxSwordSlashAuthoring=api;
})(globalThis,function(){
 'use strict';
 const FPS=60,finite=Number.isFinite,fail=m=>{throw Error('Sword Slash authoring: '+m);};
 function frameCount(c){const n=c?.effect?.exportFrames;if(!Number.isInteger(n)||n<1||n>3600)fail('frame count');return n;}
 function seek(t,c){if(!finite(t))fail('time');return Math.max(0,Math.min((frameCount(c)-1)/FPS,t));}
 function frame(t,c){return Math.min(frameCount(c)-1,Math.floor(seek(t,c)*FPS+1e-8));}
 function advance(t,dt,c){if(!finite(dt)||dt<0)fail('elapsed time');return seek(t+dt,c);}
 function pointer(x,y,r){if(!r||![x,y,r.left,r.top,r.width,r.height].every(finite)||r.width<=0||r.height<=0)fail('viewport');return {x:(x-r.left)*512/r.width,y:(y-r.top)*512/r.height};}
 function origin(p,l){if(!p||!l||![p.x,p.y,p.rotation,l.x,l.y].every(finite))return null;const a=p.rotation*Math.PI/180;return {x:p.x+l.x*Math.cos(a)-l.y*Math.sin(a),y:p.y+l.x*Math.sin(a)+l.y*Math.cos(a)};}
 function offset(p,x,y){if(!p||![p.x,p.y,p.rotation,x,y].every(finite))return null;const a=p.rotation*Math.PI/180,dx=x-p.x,dy=y-p.y,clamp=v=>Math.max(-10000,Math.min(10000,v));return {x:clamp(Math.cos(a)*dx+Math.sin(a)*dy),y:clamp(-Math.sin(a)*dx+Math.cos(a)*dy)};}
 function options(v,asset){
  if(!v||typeof v.animation!=='string'||typeof v.skin!=='string'||!finite(v.speed)||v.speed<0||v.speed>4||typeof v.visible!=='boolean')fail('pose options');
  if(v.animation&&(!asset||!asset.animations.includes(v.animation))||v.skin&&(!asset||!asset.skins.includes(v.skin)))fail('unknown animation or skin');
  return Object.freeze({animation:v.animation,skin:v.skin,speed:v.speed,visible:v.visible});
 }
 function createSession({PIXI,Spine,host,world,models,loader,history,runtime,pose,initial}){
  let dead=false,busy=false,source=null,live=null,replay=null,fx=null,cfg=initial,seconds=0,opt=options({animation:'',skin:'',speed:1,visible:true},null);
  function alive(){if(dead)fail('destroyed');}
  function ready(){alive();if(busy)fail('busy');}
  function dispose(a,b){try{a?.destroy();}finally{if(b!==a)b?.destroy();}}
  function paint(a,r,t,o){pose.pose(a,t,o,loader);return r.seek(t);}
  function stage(a,b,c,t,o){
   pose.pose(a,t,o,loader);
   const compile=history.createCompiler({host,world,model:a?.model??null,Spine,historyAsset:b,poseOptions:o,loader});
   const r=runtime.createRenderer({PIXI,host,compile,settings:c});
   try{r.seek(t);return r;}catch(e){r.destroy();throw e;}
  }
  function change(c,o){
   ready();const t=seek(seconds,c);let next;
   try{next=stage(live,replay,c,t,o);}catch(e){pose.pose(live,seconds,opt,loader);throw e;}
   const old=fx;fx=next;cfg=next.settings;seconds=t;opt=o;old?.destroy();return cfg;
  }
  async function replaceSource(nextSource){
   ready();busy=true;let a=null,b=null,next=null;
   try{
    if(nextSource!==null){a=await loader.create(nextSource);alive();b=await loader.create(nextSource);alive();if(a===b||a.model===b.model)fail('history must be independent');b.model.visible=false;models.addChild(a.model);models.addChild(b.model);}
    const o=options({...opt,animation:a?.defaultAnimation||'',skin:a?.defaultSkin||''},a);
    next=stage(a,b,cfg,seconds,o);alive();
    const old=fx,oldLive=live,oldReplay=replay;
    fx=next;live=a;replay=b;source=nextSource;cfg=next.settings;opt=o;next=a=b=null;
    try{old.destroy();}finally{dispose(oldLive,oldReplay);}
    return cfg;
   }finally{try{next?.destroy();}finally{try{dispose(a,b);}finally{busy=false;}}}
  }
  function seekTo(t){ready();const next=seek(t,cfg);try{const sample=paint(live,fx,next,opt);seconds=next;return sample;}catch(e){paint(live,fx,seconds,opt);throw e;}}
  function destroy(){if(dead)return;dead=true;try{fx?.destroy();}finally{try{dispose(live,replay);}finally{fx=live=replay=null;source=null;}}}
  change(initial,opt);
  return Object.freeze({replaceSource,configure:c=>change(c,opt),setOptions:o=>change(cfg,options(o,live)),seek:seekTo,destroy,get settings(){return cfg;},get seconds(){return seconds;},get options(){return opt;},get source(){return source;},get asset(){return live;},get meta(){return fx?.meta??null;},get busy(){return busy;}});
 }
 return {FPS,frameCount,seek,frame,advance,pointer,origin,offset,createSession};
});
