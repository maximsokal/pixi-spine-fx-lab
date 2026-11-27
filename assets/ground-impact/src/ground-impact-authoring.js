// EARTH-01 G03a: immutable logical authoring and fixed one-shot transport.
(function(root,make){
 'use strict';
 const api=Object.freeze(make(root.FxGroundImpact||(typeof require==='function'?require('./ground-impact-core.js'):null),root.FxGroundImpactAnchors||(typeof require==='function'?require('./ground-impact-anchors.js'):null)));
 if(typeof module==='object'&&module.exports)module.exports=api;else root.FxGroundImpactAuthoring=api;
})(globalThis,function(H,A){
 'use strict';
 if(!H||!A)throw Error('Ground Impact authoring dependencies');
 const FPS=H.FPS,END=39/FPS,RAD=Math.PI/180,finite=Number.isFinite,fail=m=>{throw RangeError('Ground Impact authoring: '+m);};
 function seek(t){if(!finite(t))fail('invalid time');return Math.max(0,Math.min(END,t));}
 function frame(t){const s=seek(t);let f=Math.floor(s*FPS);if(f/FPS>s)f--;else if((f+1)/FPS<=s)f++;return f;}
 function advance(t,dt,direction=1){if(!finite(dt)||dt<0||![1,-1].includes(direction))fail('invalid elapsed or direction');return seek(seek(t)+direction*dt);}
 function pointer(x,y,r){if(!r||![x,y,r.left,r.top,r.width,r.height].every(finite)||r.width<=0||r.height<=0)fail('invalid viewport');const p={x:(x-r.left)/r.width*512,y:(y-r.top)/r.height*512};if(![p.x,p.y].every(finite))fail('invalid pointer');return p;}
 function checked(b){if(!b||![b.x,b.y,b.rotation,b.scale].every(finite)||b.scale<1e-6||b.scale>1e4)fail('unresolved or singular anchor');}
 function compose(b,v){checked(b);if(!v||![v.x,v.y,v.rotation].every(finite))fail('invalid transform');const a=b.rotation*RAD,p={x:b.x+b.scale*(v.x*Math.cos(a)-v.y*Math.sin(a)),y:b.y+b.scale*(v.x*Math.sin(a)+v.y*Math.cos(a)),rotation:b.rotation+v.rotation,scale:b.scale};checked(p);return p;}
 function inverse(b,x,y){checked(b);if(![x,y].every(finite))fail('invalid pointer');const a=b.rotation*RAD,dx=(x-b.x)/b.scale,dy=(y-b.y)/b.scale,p={x:dx*Math.cos(a)+dy*Math.sin(a),y:-dx*Math.sin(a)+dy*Math.cos(a)};if(![p.x,p.y].every(finite)||Math.abs(p.x)>10000||Math.abs(p.y)>10000)fail('offset out of bounds');return p;}
 function contactBase(c,ctx){return A.resolve(c.contact.anchor,ctx);}
 function layerBase(c,k,ctx,contact){const l=c.layers[k];return l.anchor.type==='inherit'?contact:A.resolve(l.anchor,ctx);}
 function positions(input,ctx){const c=H.normalize(input),b=contactBase(c,ctx),contact=b?compose(b,c.contact):null,out={contact};for(const k of H.LAYERS){const p=layerBase(c,k,ctx,contact);out[k]=p?compose(p,c.layers[k]):null;}return out;}
 function move(input,id,x,y,ctx){const c=H.normalize(input);if(id!=='contact'&&!H.LAYERS.includes(id))fail('unknown marker');let b;
  if(id==='contact')b=contactBase(c,ctx);else if(c.layers[id].anchor.type==='inherit'){const a=contactBase(c,ctx);b=a?compose(a,c.contact):null;}else b=A.resolve(c.layers[id].anchor,ctx);
  const n=JSON.parse(JSON.stringify(c));Object.assign(id==='contact'?n.contact:n.layers[id],inverse(b,x,y));return H.compile(n).settings;
 }
 return {FPS,END,seek,frame,advance,pointer,compose,inverse,positions,move};
});
