// GAME-08: deterministic per-model Spine physics on the 60 FPS authoring grid.
(function(root,factory){const api=Object.freeze(factory());if(typeof module==='object'&&module.exports)module.exports=api;else root.FxShieldPhysics=api;})(globalThis,function(){
 'use strict';
 const cache=new WeakMap(),FPS=60,MAX_FRAMES=3600;
 function pose(asset,seconds,{animation='',skin='',speed=1,visible=true}={},loader){
  if(!asset)return {};
  const model=asset.model,skeleton=model.skeleton;
  if(!skeleton.physicsConstraints?.length)return loader.pose(asset,seconds,{animation,skin,speed,visible});
  if(!Number.isFinite(seconds)||seconds<0||seconds>MAX_FRAMES/FPS||!Number.isFinite(speed)||speed<.1||speed>4||typeof animation!=='string'||typeof skin!=='string'||typeof visible!=='boolean')throw Error('GAME-08 invalid physics pose options');
  // Physics samples the authored frame, not the arbitrary browser RAF time.
  // At higher animation speeds subdivide so no integration step exceeds 1/60s.
  const frame=animation?Math.min(MAX_FRAMES,Math.floor(seconds*FPS+1e-8)):0,substeps=Math.ceil(speed),dt=speed/(FPS*substeps);
  const previous=cache.get(model);let at=previous?.frame??0;
  try{
   if(!previous||previous.animation!==animation||previous.skin!==skin||previous.speed!==speed||frame<at){
    cache.delete(model);model.state.clearTracks();skeleton.setSkin(null);if(skin)skeleton.setSkinByName(skin);skeleton.setToSetupPose();skeleton.time=0;
    for(const constraint of skeleton.physicsConstraints)constraint.reset();
    if(animation)model.state.setAnimation(0,animation,true);model.update(0);at=0;
   }
   for(;at<frame;at++)for(let j=0;j<substeps;j++)model.update(dt);
   model.visible=visible;model.updateLocalTransform();const result=loader.anchorPoses(model);
   cache.set(model,{frame,animation,skin,speed});return result;
  }catch(error){cache.delete(model);throw error;}
 }
 return {pose};
});
