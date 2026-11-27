// ELEC-02 L02: resolve current Spine anchors in the logical world plane.
(function(root,make){
 'use strict';const api=Object.freeze(make());
 if(typeof module==='object'&&module.exports)module.exports=api;else root.FxChainAnchors=api;
})(globalThis,function(){
 'use strict';
 const RAD=Math.PI/180,EPS=1e-8,MAX_VERTICES=65536,finite=Number.isFinite;
 const bone=b=>b?.active&&[b.worldX,b.worldY,b.a,b.b,b.c,b.d].every(finite)?{x:b.worldX,y:b.worldY,a:b.a,b:b.b,c:b.c,d:b.d}:null;
 const identity=()=>({x:0,y:0,a:1,b:0,c:0,d:1});
 function rotated(b,r){const co=Math.cos(r),si=Math.sin(r);return {...b,a:b.a*co+b.b*si,c:b.c*co+b.d*si,b:-b.a*si+b.b*co,d:-b.c*si+b.d*co};}
 function attachment(slot,b,a,Spine){
  const att=slot.getAttachment();if(!Spine||!att||att.name!==a.name)return null;
  if(Spine.PointAttachment&&att instanceof Spine.PointAttachment){const p=att.computeWorldPosition(slot.bone,{x:0,y:0});if(!p||![p.x,p.y,att.rotation].every(finite))return null;return rotated({...b,x:p.x,y:p.y},att.rotation*RAD);}
  const mesh=Spine.MeshAttachment&&att instanceof Spine.MeshAttachment,region=Spine.RegionAttachment&&att instanceof Spine.RegionAttachment;
  if(!mesh&&!region)return null;const n=mesh?att.worldVerticesLength:8;
  if(!Number.isInteger(n)||n<6||n>MAX_VERTICES||n%2)return null;
  const v=new Float32Array(n);v.fill(NaN);
  if(mesh)att.computeWorldVertices(slot,0,n,v,0,2);else att.computeWorldVertices(slot,v,0,2);
  // Arithmetic centroid of all deformed vertices, including weighted meshes.
  let x=0,y=0;for(let i=0;i<n;i+=2){if(!finite(v[i])||!finite(v[i+1]))return null;x+=v[i];y+=v[i+1];}
  x/=n/2;y/=n/2;const r=mesh?0:att.rotation??0;if(!finite(r))return null;
  return rotated({...b,x,y},r*RAD);
 }
 function resolve(a,{world,model=null,Spine=null}){
  if(!world||world.destroyed||typeof world.toLocal!=='function')throw Error('Chain Lightning anchor: live world required');
  if(a.type==='inherit')throw Error('Chain Lightning anchor: inherit resolved by core');
  if(a.type==='world')return {x:a.x,y:a.y,rotation:a.rotation,scale:1};
  if(!model?.skeleton||model.destroyed)return null;
  try{
   const sk=model.skeleton;let b=identity();
   if(a.type==='bone')b=bone(sk.findBone(a.name));
   else if(a.type==='slot'||a.type==='attachment'){const slot=sk.findSlot(a.type==='slot'?a.name:a.slot);b=bone(slot?.bone);if(b&&a.type==='attachment')b=attachment(slot,b,a,Spine);}
   else if(a.type!=='skeleton')return null;
   if(!b)return null;
   const local=a.space==='local',p={x:b.x+(local?b.a*a.x+b.b*a.y:0),y:b.y+(local?b.c*a.x+b.d*a.y:0)};
   const o=world.toLocal(p,model),u=world.toLocal({x:p.x+b.a,y:p.y+b.c},model),v=world.toLocal({x:p.x+b.b,y:p.y+b.d},model);
   const dx=u.x-o.x,dy=u.y-o.y,ex=v.x-o.x,ey=v.y-o.y,scale=Math.hypot(dx,dy),det=dx*ey-dy*ex;
   // Positive uniform scale projected from the transformed local X axis.
   // No shear/reflection is applied to the authored trajectory.
   const x=o.x+(local?0:a.x),y=o.y+(local?0:a.y);
   if(![x,y,scale,det].every(finite)||scale<EPS||scale>100||Math.abs(det)<EPS||Math.abs(x)>1e6||Math.abs(y)>1e6)return null;
   return {x,y,rotation:Math.atan2(dy,dx)/RAD+a.rotation,scale};
  }catch{return null;}
 }
 function resolvePoses(settings,context){
  const poses=Object.create(null),missing=[];
  const put=(id,a)=>{const p=resolve(a,context);if(p)poses[id]=p;else missing.push(id);};
  put('source',settings.source);for(const t of settings.targets)if(t.enabled)put(t.id,t.anchor);
  return {poses,missing};
 }
 return {VERSION:1,MAX_VERTICES,resolve,resolvePoses};
});
