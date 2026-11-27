// ELEC-02 L03: immutable target authoring and one-shot transport.
(function(root,make){
 'use strict';const api=Object.freeze(make(root.FxChainLightning||(typeof require==='function'?require('./chain-core.js'):null),root.FxChainAnchors||(typeof require==='function'?require('./chain-anchors.js'):null)));
 if(typeof module==='object'&&module.exports)module.exports=api;else root.FxChainAuthoring=api;
})(globalThis,function(H,A){
 'use strict';
 const FPS=60,finite=Number.isFinite,fail=m=>{throw Error('Chain Lightning authoring: '+m);},clone=v=>JSON.parse(JSON.stringify(v));
 function seek(t,m){if(!finite(t)||!Number.isInteger(m?.frames)||m.frames<6||m.frames>3600||m.loop!==false)fail('one-shot time/frames');return Math.max(0,Math.min(t,(m.frames-1)/FPS));}
 function frame(t,m){return Math.min(m.frames-1,Math.floor(seek(t,m)*FPS+1e-8));}
 function advance(t,dt,m){if(!finite(dt)||dt<0)fail('elapsed');return seek(seek(t,m)+dt,m);}
 function pointer(x,y,r){if(!r||![x,y,r.left,r.top,r.width,r.height].every(finite)||r.width<=0||r.height<=0)fail('viewport');return {x:(x-r.left)*512/r.width,y:(y-r.top)*512/r.height};}
 function index(c,id){const i=c.targets.findIndex(t=>t.id===id);if(i<0)fail('unknown target');return i;}
 function edit(c,fn){const n=clone(H.normalize(c));fn(n);return H.normalize(n);}
 function addTarget(c,id,x,y,seed){return edit(c,n=>{if(n.targets.length>=8||typeof id!=='string'||!id||id==='source'||n.targets.some(t=>t.id===id)||![x,y,seed].every(finite))fail('new target');n.targets.push(H.newTarget(id,x,y,seed));});}
 function removeTarget(c,id){return edit(c,n=>{if(n.targets.length<=2)fail('minimum two targets');n.targets.splice(index(n,id),1);});}
 function reorderTarget(c,id,to){return edit(c,n=>{if(!Number.isInteger(to)||to<0||to>=n.targets.length)fail('target index');const [t]=n.targets.splice(index(n,id),1);n.targets.splice(to,0,t);});}
 function checked(b,x,y){if(!b||![b.x,b.y,b.rotation,b.scale,x,y].every(finite)||b.scale<=0)fail('unresolved anchor');}
 function transform(b,x,y){checked(b,x,y);const a=b.rotation*Math.PI/180;return {x:b.x+b.scale*(x*Math.cos(a)-y*Math.sin(a)),y:b.y+b.scale*(x*Math.sin(a)+y*Math.cos(a))};}
 function inverse(b,x,y){checked(b,x,y);const a=b.rotation*Math.PI/180,dx=(x-b.x)/b.scale,dy=(y-b.y)/b.scale;return {x:dx*Math.cos(a)+dy*Math.sin(a),y:-dx*Math.sin(a)+dy*Math.cos(a)};}
 function bases(c,id,context){const t=c.targets[index(c,id)],base=A.resolve(t.anchor,context);return base?{base,target:{...base,...transform(base,t.x,t.y)}}:null;}
 function moveTarget(c,id,x,y,context){return edit(c,n=>{const b=bases(n,id,context),p=inverse(b?.base,x,y);Object.assign(n.targets[index(n,id)],p);});}
 function moveLayer(c,id,k,x,y,context){return edit(c,n=>{if(!H.LAYERS.includes(k))fail('unknown layer');const b=bases(n,id,context),p=inverse(b?.target,x,y);Object.assign(n.targets[index(n,id)].layers[k],p);});}
 return {FPS,seek,frame,advance,pointer,addTarget,removeTarget,reorderTarget,transform,inverse,bases,moveTarget,moveLayer};
});
