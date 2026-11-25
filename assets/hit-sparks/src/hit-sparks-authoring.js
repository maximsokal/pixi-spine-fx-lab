// GAME-02 authoring helpers, independent of DOM and Pixi.
(function(root,make){
 'use strict';const api=Object.freeze(make());
 if(typeof module==='object'&&module.exports)module.exports=api;else root.FxHitSparksAuthoring=api;
})(globalThis,function(){
 'use strict';
 const FPS=60,KINDS=Object.freeze(['flash','primary','dust']);
 const finite=Number.isFinite;
 function fail(s){throw TypeError('Hit Sparks authoring: '+s);}
 function frameCount(c){const n=c?.effect?.exportFrames;if(!Number.isInteger(n)||n<1||n>3600)fail('frame count');return n;}
 function seek(t,c){if(!finite(t))fail('time');return Math.max(0,Math.min((frameCount(c)-1)/FPS,t));}
 function frame(t,c){return Math.min(frameCount(c)-1,Math.floor(seek(t,c)*FPS+1e-8));}
 function advance(t,dt,c){if(!finite(dt)||dt<0)fail('elapsed time');return seek(t+dt,c);}
 function layer(c,k){if(!KINDS.includes(k))fail('layer');return c.effect.layers[k];}
 function anchor(c,k){if(!KINDS.includes(k))fail('layer');return c.anchors[k];}
 function offset(p,x,y){if(!p||![p.x,p.y,p.rotation,x,y].every(finite))return null;
  const a=p.rotation*Math.PI/180,dx=x-p.x,dy=y-p.y;
  return {x:Math.max(-10000,Math.min(10000,Math.cos(a)*dx+Math.sin(a)*dy)),y:Math.max(-10000,Math.min(10000,-Math.sin(a)*dx+Math.cos(a)*dy))};}
 function origin(p,l){if(!p||!l||![p.x,p.y,p.rotation,l.x,l.y].every(finite))return null;
  const a=p.rotation*Math.PI/180;return {x:p.x+l.x*Math.cos(a)-l.y*Math.sin(a),y:p.y+l.x*Math.sin(a)+l.y*Math.cos(a)};}
 function pointer(x,y,r){if(!r||![x,y,r.left,r.top,r.width,r.height].every(finite)||r.width<=0||r.height<=0)fail('viewport');return {x:(x-r.left)*512/r.width,y:(y-r.top)*512/r.height};}
 function collect(files){const list=Array.from(files),sk=list.filter(f=>/\.(json|skel)$/i.test(f.name)),atlas=list.filter(f=>/\.atlas$/i.test(f.name)),images=new Map();
  if(sk.length!==1||atlas.length!==1)fail('Select one skeleton and atlas');
  for(const f of list.filter(f=>/\.(png|webp|jpe?g)$/i.test(f.name))){const name=f.webkitRelativePath||f.name;if(images.has(name))fail('Duplicate texture '+name);images.set(name,f);}
  if(!images.size)fail('Select all texture pages');return {name:sk[0].name,skeleton:sk[0],atlas:atlas[0],images};}
 return {FPS,KINDS,frameCount,seek,frame,advance,layer,anchor,offset,origin,pointer,collect};
});
