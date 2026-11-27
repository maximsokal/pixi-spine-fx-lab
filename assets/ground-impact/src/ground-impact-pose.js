// EARTH-01 G03b: deterministic Spine pose shared by future preview and bake.
(function(root,make){
 'use strict';const api=Object.freeze(make(root.FxGroundImpactAuthoring||(typeof require==='function'?require('./ground-impact-authoring.js'):null)));
 if(typeof module==='object'&&module.exports)module.exports=api;else root.FxGroundImpactPose=api;
})(globalThis,function(U){
 'use strict';
 const cache=new WeakMap(),fail=m=>{throw Error('Ground Impact pose: '+m);};
 function options(v,a){
  if(!v||typeof v.animation!=='string'||typeof v.skin!=='string'||!Number.isFinite(v.speed)||v.speed<0||v.speed>4||typeof v.visible!=='boolean')fail('invalid options');
  if((v.animation&&!a?.animations.includes(v.animation))||(v.skin&&!a?.skins.includes(v.skin)))fail('unknown animation or skin');
  return Object.freeze({animation:v.animation,skin:v.skin,speed:v.speed,visible:v.visible});
 }
 function seek(asset,seconds,input){
  return apply(asset,U.seek(seconds),input);
 }
 function seekAbsolute(asset,seconds,input){
  if(!Number.isFinite(seconds)||seconds<0||seconds>3599/U.FPS)fail('invalid absolute time');return apply(asset,seconds,input);
 }
 function apply(asset,t,input){
  const o=options(input,asset);if(!asset)return t;
  const m=asset.model,s=m.skeleton,physics=!!s.physicsConstraints?.length,frame=frameAt(t),old=cache.get(m);let at=old?.frame??0;
  try{
   if(!old||old.animation!==o.animation||old.skin!==o.skin||old.speed!==o.speed||t<old.seconds){
    cache.delete(m);m.state.clearTracks();s.setSkin(null);if(o.skin)s.setSkinByName(o.skin);s.setToSetupPose();s.time=0;
    for(const c of s.physicsConstraints??[])c.reset();if(o.animation)m.state.setAnimation(0,o.animation,true);m.update(0);at=0;
   }
   if(physics){
    // Setup-pose physics is real motion too. Speed zero must not advance it.
    if(o.speed>0){const steps=Math.max(1,Math.ceil(o.speed)),dt=o.speed/(U.FPS*steps);for(;at<frame;at++)for(let j=0;j<steps;j++)m.update(dt);}
   }else{const entry=m.state.getCurrent(0);if(entry)entry.trackTime=t*o.speed;s.setToSetupPose();m.update(0);}
   m.visible=o.visible;m.updateLocalTransform();cache.set(m,{...o,frame,seconds:t});return t;
  }catch(e){cache.delete(m);throw e;}
 }
 function frameAt(t){let f=Math.floor(t*U.FPS);if(f/U.FPS>t)f--;else if((f+1)/U.FPS<=t)f++;return f;}
 function invalidate(asset){if(asset)cache.delete(asset.model);}
 return {options,seek,seekAbsolute,invalidate};
});
