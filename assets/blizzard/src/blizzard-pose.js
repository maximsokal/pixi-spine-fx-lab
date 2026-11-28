// AIR-03 B04: one deterministic Spine pose for preview, bake and developer demo.
(function(root){
 'use strict';
 const cache=new WeakMap(),FPS=60;
 function time(settings,seconds){
  if(!Number.isFinite(seconds)||seconds<0||seconds>1e8||!Number.isInteger(settings.durationFrames)||settings.durationFrames<1||settings.durationFrames>960||!['loop','oneShot'].includes(settings.mode))throw Error('AIR-03 invalid pose time');
  if(settings.mode==='oneShot')return Math.min(seconds,(settings.durationFrames-1)/FPS);
  const period=settings.durationFrames/FPS,t=Math.round(((seconds%period+period)%period)*1e12)/1e12;
  return t>=period-1e-12?0:t;
 }
 function seek(model,settings,seconds,{skin='',animation=''}={}){
  const t=time(settings,seconds);
  if(!model)return t;
  const sk=model.skeleton,state=model.state;
  if(typeof skin!=='string'||typeof animation!=='string')throw Error('AIR-03 invalid pose options');
  const physics=!!sk.physicsConstraints?.length,frame=Math.floor(t*FPS+1e-8),old=cache.get(model);
  let at=old?.frame??0;
  try{
   if(!old||old.skin!==skin||old.animation!==animation||(physics&&frame<at)){
    cache.delete(model);state.clearTracks();sk.setSkin(null);if(skin)sk.setSkinByName(skin);sk.setToSetupPose();
    if(physics){sk.time=0;for(const constraint of sk.physicsConstraints)constraint.reset();}
    if(animation)state.setAnimation(0,animation,true);
    model.update(0);at=0;
   }
   if(physics){
    // Fixed authored frame steps, including physics-only setup poses.
    for(;at<frame;at++)model.update(1/FPS);
   }else{
    const entry=state.getCurrent(0);if(entry)entry.trackTime=t;
    sk.setToSetupPose();model.update(0);
   }
   model.updateLocalTransform();cache.set(model,{skin,animation,frame});return t;
  }catch(error){cache.delete(model);throw error;}
 }
 const api=Object.freeze({time,seek});
 if(typeof module==='object'&&module.exports)module.exports=api;else root.FxBlizzardPose=api;
})(globalThis);
