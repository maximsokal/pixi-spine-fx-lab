// GAME-10 P03: authoring coordinates, timeline and deterministic Spine pose adapter.
(function(root,factory){const api=Object.freeze(factory());if(typeof module==='object'&&module.exports)module.exports=api;else root.FxPoisonAuthoring=api;})(globalThis,function(){
 'use strict';
 const DEG=Math.PI/180,identity={x:0,y:0,rotation:0,scale:1},finite=Number.isFinite,cache=new WeakMap();
 const good=p=>p&&[p.x,p.y,p.rotation,p.scale].every(finite)&&p.scale>=1e-9&&p.scale<=1e6&&Math.max(Math.abs(p.x),Math.abs(p.y),Math.abs(p.rotation))<=1e6;
 function lastFrame(c){return c.durationFrames-1;}
 function advance(t,dt,c){const end=lastFrame(c)/60;if(c.mode!=='loop')return Math.max(0,Math.min(end,t+dt));const f=(t+dt)*60,n=Math.round(f),frame=Math.abs(f-n)<6e-8?n:f,r=frame%c.durationFrames;return (r<0?r+c.durationFrames:r||0)/60;}
 function anchor(a,poses,parent){if(a.type==='world')return identity;if(a.type==='inherit')return parent;if(a.type==='local')return poses.local;return poses.bones&&Object.hasOwn(poses.bones,a.name)?poses.bones[a.name]:null;}
 function compose(a,b){if(!good(a)||!good(b))return null;const angle=a.rotation*DEG,c=Math.cos(angle),s=Math.sin(angle),p={x:a.x+a.scale*(c*b.x-s*b.y),y:a.y+a.scale*(s*b.x+c*b.y),rotation:a.rotation+b.rotation,scale:a.scale*b.scale};return good(p)?p:null;}
 function parent(e,l,poses){const a=anchor(e.anchor,poses,null);return l?anchor(l.anchor,poses,compose(a,e)):a;}
 function resolve(e,l,poses){return compose(parent(e,l,poses),l||e);}
 function dragPosition(e,l,poses,x,y){const p=parent(e,l,poses);if(!good(p)||![x,y].every(finite))return null;const a=p.rotation*DEG,c=Math.cos(a),s=Math.sin(a),dx=(x-p.x)/p.scale,dy=(y-p.y)/p.scale;return {x:c*dx+s*dy,y:-s*dx+c*dy};}
 function poseMap(map){const bones=Object.create(null);for(const [k,p] of Object.entries(map||{}))if(k!=='$local')bones[k]={...p};return {local:map?.$local?{...map.$local}:null,bones};}
 function collectSource(files){const skeleton=files.filter(f=>/\.(json|skel)$/i.test(f.name)),atlas=files.filter(f=>/\.atlas$/i.test(f.name));if(skeleton.length!==1||atlas.length!==1)throw Error('Select exactly one skeleton and atlas');const images=new Map();for(const f of files.filter(f=>/\.(png|webp|jpe?g)$/i.test(f.name))){const name=(f.webkitRelativePath||f.name).replace(/\\/g,'/');if(images.has(name))throw Error('duplicate texture name: '+name);images.set(name,f);}if(!images.size)throw Error('Select all atlas texture pages');return {name:skeleton[0].name,skeleton:skeleton[0],atlas:atlas[0],images};}
 function pose(asset,seconds,{animation='',skin='',speed=1,visible=true}={},loader){if(!asset)return {};if(!finite(seconds)||seconds<0||seconds>60||!finite(speed)||speed<.1||speed>4||typeof animation!=='string'||typeof skin!=='string'||typeof visible!=='boolean')throw Error('Invalid animation pose');const model=asset.model,skeleton=model.skeleton;
  if(!skeleton.physicsConstraints?.length){if(!skin&&skeleton.skin){skeleton.setSkin(null);skeleton.setSlotsToSetupPose();}return loader.pose(asset,seconds,{animation,skin,speed,visible});}
  const frame=animation?Math.min(3600,Math.floor(seconds*60+1e-8)):0,substeps=Math.ceil(speed),dt=speed/(60*substeps),previous=cache.get(model);let at=previous?.frame??0;
  try{if(!previous||previous.animation!==animation||previous.skin!==skin||previous.speed!==speed||frame<at){cache.delete(model);model.state.clearTracks();skeleton.setSkin(null);if(skin)skeleton.setSkinByName(skin);skeleton.setToSetupPose();skeleton.time=0;for(const constraint of skeleton.physicsConstraints)constraint.reset();if(animation)model.state.setAnimation(0,animation,true);model.update(0);at=0;}for(;at<frame;at++)for(let j=0;j<substeps;j++)model.update(dt);model.visible=visible;model.updateLocalTransform();const result=loader.anchorPoses(model);cache.set(model,{frame,animation,skin,speed});return result;}catch(error){cache.delete(model);throw error;}
 }
 // Named preset resets only lifecycle curves and duration, not artist placement or colors.
 function modePreset(settings,mode,core){const d=core.defaults(mode),next=JSON.parse(JSON.stringify(settings));next.mode=mode;next.durationFrames=d.durationFrames;next.lifetimeFrames=Math.min(next.lifetimeFrames,d.durationFrames);next.cloudSizeCurve=d.cloudSizeCurve;next.fogOpacityCurve=d.fogOpacityCurve;return core.compile(next).settings;}
 return {lastFrame,advance,resolve,dragPosition,poseMap,collectSource,pose,modePreset};
});
