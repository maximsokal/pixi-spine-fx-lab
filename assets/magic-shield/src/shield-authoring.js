// GAME-08: authoring coordinate and timeline helpers, no renderer or DOM.
(function(root,factory){const api=Object.freeze(factory());if(typeof module==='object'&&module.exports)module.exports=api;else root.FxShieldAuthoring=api;})(globalThis,function(){
 'use strict';
 const DEG=Math.PI/180,identity={x:0,y:0,rotation:0,scale:1},finite=Number.isFinite;
 const good=p=>p&&[p.x,p.y,p.rotation,p.scale].every(finite)&&p.scale>=1e-9&&p.scale<=1e6&&Math.max(Math.abs(p.x),Math.abs(p.y),Math.abs(p.rotation))<=1e6;
 function lastFrame(c){return c.durationFrames-1;}
 function advance(t,dt,c){const duration=c.durationFrames/60,end=lastFrame(c)/60;
  if(c.mode!=='loop')return Math.max(0,Math.min(end,t+dt));
  const f=(t+dt)*60,n=Math.round(f),frame=Math.abs(f-n)<6e-8?n:f;
  return ((frame%c.durationFrames)+c.durationFrames)%c.durationFrames/60;
 }
 function anchor(a,poses,parent){if(a.type==='world')return identity;if(a.type==='inherit')return parent;if(a.type==='local')return poses.local;return poses.bones&&Object.hasOwn(poses.bones,a.name)?poses.bones[a.name]:null;}
 function compose(a,b){if(!good(a)||!good(b))return null;const angle=a.rotation*DEG,c=Math.cos(angle),s=Math.sin(angle),p={x:a.x+a.scale*(c*b.x-s*b.y),y:a.y+a.scale*(s*b.x+c*b.y),rotation:a.rotation+b.rotation,scale:a.scale*b.scale};return good(p)?p:null;}
 function parent(e,l,poses){const a=anchor(e.anchor,poses,null);return l?anchor(l.anchor,poses,compose(a,e)):a;}
 function resolve(e,l,poses){return compose(parent(e,l,poses),l||e);}
 function dragPosition(e,l,poses,x,y){const p=parent(e,l,poses);if(!good(p)||![x,y].every(finite))return null;const a=p.rotation*DEG,c=Math.cos(a),s=Math.sin(a),dx=(x-p.x)/p.scale,dy=(y-p.y)/p.scale;return {x:c*dx+s*dy,y:-s*dx+c*dy};}
 function poseMap(map){const bones=Object.create(null);for(const [k,p] of Object.entries(map||{}))if(k!=='$local')bones[k]={...p};return {local:map?.$local?{...map.$local}:null,bones};}
 function insertHit(hits,frame,duration){if(!finite(frame)||frame<0||frame>=duration)throw RangeError('Invalid hit frame');if(hits.some(h=>Math.abs(h.frame-frame)<1e-8))throw Error('Hit already exists');let i=1;while(hits.some(h=>h.id==='hit'+i))i++;return [...hits.map(h=>({...h})),{id:'hit'+i,frame}].sort((a,b)=>a.frame-b.frame);}
 function collectSource(files){const skeleton=files.filter(f=>/\.(json|skel)$/i.test(f.name)),atlas=files.filter(f=>/\.atlas$/i.test(f.name));if(skeleton.length!==1||atlas.length!==1)throw Error('Select exactly one skeleton and atlas');const images=new Map();for(const f of files.filter(f=>/\.(png|webp|jpe?g)$/i.test(f.name))){const name=f.webkitRelativePath||f.name;if(images.has(name))throw Error('duplicate texture name: '+name);images.set(name,f);}if(!images.size)throw Error('Select all atlas texture pages');return {name:skeleton[0].name,skeleton:skeleton[0],atlas:atlas[0],images};}
 return {lastFrame,advance,resolve,dragPosition,poseMap,insertHit,collectSource};
});
