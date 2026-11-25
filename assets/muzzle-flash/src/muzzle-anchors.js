// GAME-01 M02b: resolve independent layer poses in the render host's local plane.
(function(root,make){
 'use strict';
 const api=Object.freeze(make());
 if(typeof module==='object'&&module.exports)module.exports=api;else root.FxMuzzleAnchors=api;
})(globalThis,function(){
 'use strict';
 const LAYERS=['core','tongues','sparks'],RAD=Math.PI/180,MAX_VERTICES=65536;
 const finite=Number.isFinite;
 function fail(k){throw TypeError('Muzzle anchor: '+k);}
 function number(v,k,max){if(!finite(v)||Math.abs(v)>max)fail(k);return v;}
 function normalize(a){
  const keys=['type','space','name','slot','x','y','rotation'];
  if(!a||typeof a!=='object'||Array.isArray(a)||Object.keys(a).length!==keys.length||keys.some(k=>!Object.hasOwn(a,k)))fail('shape');
  if(!['world','skeleton','bone','slot','attachment'].includes(a.type)||!['world','local'].includes(a.space))fail('type/space');
  for(const k of ['name','slot'])if(typeof a[k]!=='string'||a[k].length>256)fail(k);
  if(['bone','slot','attachment'].includes(a.type)&&!a.name)fail('missing name');
  if(a.type==='attachment'&&!a.slot)fail('missing slot');
  if(a.type==='world'&&a.space!=='world')fail('world space');
  return {...a,x:number(a.x,'x',10000),y:number(a.y,'y',10000),rotation:number(a.rotation,'rotation',360)};
 }
 function defaults(){return Object.fromEntries(LAYERS.map(k=>[k,{type:'world',space:'world',name:'',slot:'',x:256,y:256,rotation:0}]));}
 function normalizeMap(v){
  if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).length!==LAYERS.length||LAYERS.some(k=>!Object.hasOwn(v,k)))fail('layer map');
  return Object.freeze(Object.fromEntries(LAYERS.map(k=>[k,Object.freeze(normalize(v[k]))])));
 }
 function boneBasis(b){
  if(!b?.active||![b.a,b.b,b.c,b.d,b.worldX,b.worldY].every(finite))return null;
  return {x:b.worldX,y:b.worldY,a:b.a,b:b.b,c:b.c,d:b.d};
 }
 function attachmentBasis(att,slot,b){
  if(typeof att.computeWorldPosition==='function'&&typeof att.computeWorldRotation==='function'){
   const p=att.computeWorldPosition(slot.bone,{x:0,y:0}),r=att.rotation*RAD;
   if(!p||![p.x,p.y,r].every(finite))return null;
   return {x:p.x,y:p.y,a:b.a*Math.cos(r)+b.b*Math.sin(r),c:b.c*Math.cos(r)+b.d*Math.sin(r),b:-b.a*Math.sin(r)+b.b*Math.cos(r),d:-b.c*Math.sin(r)+b.d*Math.cos(r)};
  }
  if(typeof att.computeWorldVertices!=='function')return null;
  const mesh=att.worldVerticesLength!==undefined,n=mesh?att.worldVerticesLength:8;
  if(!Number.isInteger(n)||n<8||n>MAX_VERTICES||n%2)return null;
  const v=new Float32Array(n);v.fill(NaN);
  if(mesh)att.computeWorldVertices(slot,0,n,v,0,2);else att.computeWorldVertices(slot,v,0,2);
  let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
  for(let i=0;i<n;i+=2){if(!finite(v[i])||!finite(v[i+1]))return null;x0=Math.min(x0,v[i]);x1=Math.max(x1,v[i]);y0=Math.min(y0,v[i+1]);y1=Math.max(y1,v[i+1]);}
  const r=mesh?0:(att.rotation??0)*RAD;if(!finite(r))return null;
  return {x:(x0+x1)/2,y:(y0+y1)/2,a:b.a*Math.cos(r)+b.b*Math.sin(r),c:b.c*Math.cos(r)+b.d*Math.sin(r),b:-b.a*Math.sin(r)+b.b*Math.cos(r),d:-b.c*Math.sin(r)+b.d*Math.cos(r)};
 }
 function resolve(input,{host,world,model=null}){
  const a=normalize(input);
  if(!host||host.destroyed||typeof host.toLocal!=='function'||!world||world.destroyed)fail('live coordinate planes required');
  const convert=(p,from,to=host)=>to.toLocal(p,from);
  try{
   let basis={x:0,y:0,a:1,b:0,c:0,d:1},from=world;
   if(a.type!=='world'){
    if(!model?.skeleton||model.destroyed)return null;
    from=model;const sk=model.skeleton;
    if(a.type==='bone')basis=boneBasis(sk.findBone(a.name));
    else if(a.type!=='skeleton'){
     const slot=sk.findSlot(a.type==='attachment'?a.slot:a.name);basis=boneBasis(slot?.bone);
     if(basis&&a.type==='attachment'){
      const att=slot.getAttachment();if(!att||att.name!==a.name)return null;
      basis=attachmentBasis(att,slot,basis);
     }
    }
    if(!basis)return null;
   }
   let p={x:basis.x,y:basis.y};
   if(a.space==='local'){p.x+=basis.a*a.x+basis.b*a.y;p.y+=basis.c*a.x+basis.d*a.y;}
   const q={x:p.x+basis.a,y:p.y+basis.c};
   let origin=convert(p,from),axis=convert(q,from);
   if(a.space==='world'){
    // World offsets are in the logical world plane, not screen pixels.
    const w0=convert({x:0,y:0},world),w1=convert({x:a.x,y:a.y},world);
    const dx=w1.x-w0.x,dy=w1.y-w0.y;
    origin={x:origin.x+dx,y:origin.y+dy};axis={x:axis.x+dx,y:axis.y+dy};
   }
   const dx=axis.x-origin.x,dy=axis.y-origin.y;
   if(![origin.x,origin.y,dx,dy].every(finite)||Math.hypot(dx,dy)<1e-8||Math.max(Math.abs(origin.x),Math.abs(origin.y))>900000)return null;
   return {x:origin.x,y:origin.y,rotation:Math.atan2(dy,dx)/RAD+a.rotation};
  }catch{return null;}
 }
 // The compiler remains the sole owner of geometry, time and palettes.
 // Missing poses hide only their own layer; identical poses share one sample.
 function sampleLayers(plan,t,poses){
  const out={core:[],tongues:[],sparks:[]},cache=new Map();
  for(const k of LAYERS){const p=poses[k];if(!p)continue;const key=JSON.stringify([p.x,p.y,p.rotation]);
   if(!cache.has(key))cache.set(key,plan.sample(t,p));out[k]=cache.get(key)[k];}
  return out;
 }
 function createCompiler({compile,host,world,model=null}){
  if(typeof compile!=='function')fail('compiler');
  return function(config){
   if(!config||typeof config!=='object'||!Object.hasOwn(config,'effect')||!Object.hasOwn(config,'anchors')||Object.keys(config).length!==2)fail('anchored preset');
   const anchors=normalizeMap(config.anchors),plan=compile(config.effect),settings=Object.freeze({effect:plan.settings,anchors});
   return Object.freeze({settings,sample(t){
    number(t,'time',3600);if(t<0)fail('time');
    const poses=Object.fromEntries(LAYERS.map(k=>[k,resolve(anchors[k],{host,world,model})]));
    return sampleLayers(plan,t,poses);
   }});
  };
 }
 return {VERSION:1,defaults,normalizeMap,resolve,sampleLayers,createCompiler};
});
