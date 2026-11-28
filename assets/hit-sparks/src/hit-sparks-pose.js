// GAME-02: one deterministic Spine pose path for preview, PNG and developer demo.
(function(root,make){
 'use strict';const api=Object.freeze(make());
 if(typeof module==='object'&&module.exports)module.exports=api;else root.FxHitSparksPose=api;
})(globalThis,function(){
 'use strict';
 const FPS=60,MAX_FRAMES=3600,cache=new WeakMap();
 function pose(asset,seconds,{animation='',skin='',speed=1,visible=true}={},loader){
  if(!asset)return {};
  if(!Number.isFinite(seconds)||seconds<0||seconds>MAX_FRAMES/FPS||!Number.isFinite(speed)||speed<0||speed>4||typeof animation!=='string'||typeof skin!=='string'||typeof visible!=='boolean')throw Error('Invalid hit sparks pose options');
  const model=asset.model,skeleton=model.skeleton;
  if(!skeleton.physicsConstraints?.length){
   const previous=cache.get(model);
   try{
    if(!previous||previous.animation!==animation||previous.skin!==skin){
     cache.delete(model);model.state.clearTracks();skeleton.setSkin(null);if(skin)skeleton.setSkinByName(skin);skeleton.setToSetupPose();
     if(animation)model.state.setAnimation(0,animation,true);
    }
    const entry=model.state.getCurrent(0);if(entry)entry.trackTime=seconds*speed;
    skeleton.setToSetupPose();model.update(0);model.visible=visible;model.updateLocalTransform();
    const result=loader.anchorPoses(model);
    cache.set(model,{animation,skin,speed,frame:0});return result;
   }catch(error){cache.delete(model);throw error;}
  }
  // Physics advances on authored frames, never on browser RAF deltas or tile count.
  // Zero speed freezes the initial pose; subdivide faster playback.
  const frame=speed>0?Math.min(MAX_FRAMES,Math.floor(seconds*FPS+1e-8)):0;
  const steps=Math.max(1,Math.ceil(speed)),dt=speed/(FPS*steps),previous=cache.get(model);
  let at=previous?.frame??0;
  try{
   if(!previous||previous.animation!==animation||previous.skin!==skin||previous.speed!==speed||frame<at){
    cache.delete(model);model.state.clearTracks();skeleton.setSkin(null);if(skin)skeleton.setSkinByName(skin);skeleton.setToSetupPose();skeleton.time=0;
    for(const constraint of skeleton.physicsConstraints)constraint.reset();
    if(animation)model.state.setAnimation(0,animation,true);model.update(0);at=0;
   }
   for(;at<frame;at++)for(let j=0;j<steps;j++)model.update(dt);
   model.visible=visible;model.updateLocalTransform();const result=loader.anchorPoses(model);
   cache.set(model,{frame,animation,skin,speed});return result;
  }catch(error){cache.delete(model);throw error;}
 }
 return {pose};
});
