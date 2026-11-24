// GAME-12 T03: isolated Spine 4.2 asset owner and pure anchor snapshots.
(function(root,make){
 'use strict';
 const api=Object.freeze(make());
 if(typeof module==='object'&&module.exports)module.exports=api;else root.FxLootSpine=api;
})(globalThis,function(){
 'use strict';
 function sample(spec){
  return {name:spec.skeletonName,skeleton:new Blob([JSON.stringify(spec.skeleton)]),
   atlas:new Blob([spec.atlas]),images:new Map(Object.entries(spec.images).map(([name,b64])=>
    [name,new Blob([Uint8Array.from(atob(b64),c=>c.charCodeAt(0))],{type:'image/png'})]))};
 }
 const fail=m=>{throw Error('GAME-12 Spine: '+m);};
 const versionOk=v=>typeof v==='string'&&/^4\.2\.(?:0|[1-9]\d*)$/.test(v);
 const normalized=n=>n.replace(/\\/g,'/');
 function matchPages(pages,images){
  if(!Array.isArray(pages)||!pages.length)fail('atlas has no pages');
  if(!(images instanceof Map)||!images.size)fail('select texture pages');
  const entries=[...images].map(([name,blob])=>{if(typeof name!=='string'||!name.trim()||!blob)fail('invalid image entry');return [normalized(name),blob];});
  const used=new Set(),names=new Set();
  return pages.map(page=>{
   if(typeof page?.name!=='string'||!page.name.trim())fail('invalid atlas page');
   const name=normalized(page.name);if(names.has(name))fail('duplicate atlas page '+name);names.add(name);
   const exact=entries.filter(([k])=>k===name);
   const matches=exact.length?exact:entries.filter(([k])=>k.split('/').at(-1)===name.split('/').at(-1));
   if(matches.length!==1)fail((matches.length?'ambiguous':'missing')+' atlas page '+name);
   if(used.has(matches[0][0]))fail('texture reused by multiple pages '+name);used.add(matches[0][0]);
   return [page,matches[0][1]];
  });
 }
 function decodeSkeleton(name,bytes,{spine,TextDecoder:Decoder}){
  if(typeof name!=='string'||!(bytes instanceof Uint8Array))fail('invalid skeleton');
  const binary=/\.skel$/i.test(name);if(!binary&&!/\.json$/i.test(name))fail('expected .json or .skel');
  let data,version;
  if(binary){const input=new spine.BinaryInput(bytes.slice());input.readInt32();input.readInt32();version=input.readString();data=bytes.slice();}
  else{data=JSON.parse(new Decoder('utf-8',{fatal:true}).decode(bytes));version=data?.skeleton?.spine;}
  if(!versionOk(version))fail('requires Spine 4.2.x; actual '+version);
  return {binary,data,version};
 }
 // Coordinates are in the FX host (model's direct parent), not camera pixels.
 // The v1 core supports a positive uniform scale and rotation, not a full affine
 // basis. Project onto the transformed +X axis, preserving origin and heading.
 // Spine Pixi sets Skeleton.yDown=true, so negative determinants are normal.
 // Reflection, nonuniform scaling and shear of local FX offsets are not reproduced.
 function anchorPoses(model){
  const m=model.localTransform;const values=[m?.a,m?.b,m?.c,m?.d,m?.tx,m?.ty];
  if(!values.every(Number.isFinite))fail('invalid model transform');
  const [a,b,c,d,tx,ty]=values,result=Object.create(null);
  function put(name,x,y,ax,ay,bx,by){
   const scale=Math.hypot(ax,ay),sy=Math.hypot(bx,by),det=ax*by-ay*bx;
   if(![x,y,scale,sy,det].every(Number.isFinite)||scale<=1e-10||sy<=1e-10||Math.abs(det)<=1e-10)return;
   result[name]={x,y,rotation:Math.atan2(ay,ax)*180/Math.PI,scale};
  }
  put('$local',tx,ty,a,b,c,d);
  for(const bone of model.skeleton.bones){
   if(!bone.active||bone.data.name==='$local')continue;
   put(bone.data.name,a*bone.worldX+c*bone.worldY+tx,b*bone.worldX+d*bone.worldY+ty,
    a*bone.a+c*bone.c,b*bone.a+d*bone.c,a*bone.b+c*bone.d,b*bone.b+d*bone.d);
  }
  return result;
 }
 async function create(source,env=globalThis){
  const {PIXI,spine,TextDecoder:Decoder,URL,Image,FxTimeline}=env;
  if(!source?.skeleton||!source?.atlas||!(source.images instanceof Map))fail('select skeleton, atlas and textures');
  if(!PIXI||!spine||!FxTimeline)fail('pinned runtime unavailable');
  if(source.skeleton.size>64*1024*1024||source.atlas.size>4*1024*1024||source.images.size>64||
   [...source.images.values()].reduce((n,b)=>n+(b.size||0),0)>192*1024*1024)fail('asset budget exceeded');
  const retained={name:source.name,skeleton:source.skeleton,atlas:source.atlas,images:new Map(source.images)};
  const decoded=decodeSkeleton(retained.name,new Uint8Array(await retained.skeleton.arrayBuffer()),{spine,TextDecoder:Decoder});
  const atlas=new spine.TextureAtlas(await retained.atlas.text()),pages=matchPages(atlas.pages,retained.images);
  let model=null,dead=false;const textures=[],wrappers=[];
  function destroy(){
   if(dead)return;dead=true;
   // Each resource is owned here, never by a shared asset cache or host.
   let error;
   const dispose=fn=>{try{fn()}catch(e){error??=e;}};
   if(model){dispose(()=>model.removeFromParent());dispose(()=>model.destroy());}
   for(const t of wrappers)dispose(()=>t.dispose());
   for(const t of textures)dispose(()=>t.destroy());
   if(error)throw error;
  }
  try{
   for(const [page,blob] of pages){
    const url=URL.createObjectURL(blob),img=new Image();
    try{img.src=url;await img.decode();}finally{URL.revokeObjectURL(url);}
    const texture=new PIXI.ImageSource({resource:img,alphaMode:page.pma?'premultiplied-alpha':'premultiply-alpha-on-upload',autoGenerateMipmaps:false});textures.push(texture);
    const wrapper=spine.SpineTexture.from(texture);wrappers.push(wrapper);page.setTexture(wrapper);
   }
   const loader=new spine.AtlasAttachmentLoader(atlas),parser=decoded.binary?new spine.SkeletonBinary(loader):new spine.SkeletonJson(loader);
   const parsed=parser.readSkeletonData(decoded.data);
   model=new spine.Spine({skeletonData:parsed,autoUpdate:false});model.update(0);
   const bounds=model.getLocalBounds();
   if(![bounds.x,bounds.y,bounds.width,bounds.height].every(Number.isFinite)||bounds.width<=0||bounds.height<=0)fail('no visible attachments');
   const scale=Math.min(260/Math.max(1,bounds.width),330/Math.max(1,bounds.height),2);
   model.scale.set(scale);model.position.set(256-(bounds.x+bounds.width/2)*scale,256-(bounds.y+bounds.height/2)*scale);
   const animations=Object.freeze(parsed.animations.map(a=>a.name)),skins=Object.freeze(parsed.skins.map(a=>a.name));
   const defaultSkin=parsed.defaultSkin?.name||skins[0]||'',defaultAnimation=animations.includes('idle')?'idle':animations[0]||'';
   function pose(seconds,{animation=defaultAnimation,skin=defaultSkin,speed=1,visible=true}={}){
    if(dead)fail('asset destroyed');
    if(!Number.isFinite(seconds)||seconds<0||!Number.isFinite(speed)||speed<0||speed>10||seconds*speed>1e6||typeof visible!=='boolean')fail('invalid pose options');
    if(animation!==''&&!animations.includes(animation))fail('unknown animation');
    if(skin!==''&&!skins.includes(skin))fail('unknown skin');
    if(skin&&model.skeleton.skin?.name!==skin){model.skeleton.setSkinByName(skin);model.skeleton.setSlotsToSetupPose();}
    if(animation){if(model.state.getCurrent(0)?.animation.name!==animation)model.state.setAnimation(0,animation,true);FxTimeline.seekSpine(model,seconds*speed);}
    else{model.state.clearTracks();model.skeleton.setToSetupPose();model.update(0);}
    model.visible=visible;model.updateLocalTransform();
    return anchorPoses(model);
   }
   return Object.freeze({model,source:retained,version:decoded.version,pages:pages.length,animations,skins,defaultSkin,defaultAnimation,pose,destroy});
  }catch(e){try{destroy()}catch(cleanup){e.cleanupError=cleanup;}throw e;}
 }
 return {VERSION:1,matchPages,decodeSkeleton,anchorPoses,create,sample};
});
