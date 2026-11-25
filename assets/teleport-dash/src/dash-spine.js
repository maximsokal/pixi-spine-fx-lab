// GAME-07 T02a: independent pose state, shared owned atlas, bounded fixed replay.
(function(root,make){'use strict';const api=Object.freeze(make());if(typeof module==='object'&&module.exports)module.exports=api;else root.FxDashSpine=api;})(globalThis,function(){
 'use strict';
 const fail=m=>{throw Error('GAME-07 Spine: '+m);},finite=Number.isFinite,DEG=Math.PI/180;
 const limits=Object.freeze({clones:96,bones:24000,slots:24000,steps:3600,work:200000});
 const normal=n=>n.replace(/\\/g,'/');
 function matchPages(pages,images){
  if(!Array.isArray(pages)||!pages.length||!(images instanceof Map)||!images.size)fail('missing atlas pages or textures');
  const entries=[...images].map(([n,b])=>{if(typeof n!=='string'||!n.trim()||!b)fail('invalid texture');return [normal(n),b];}),used=new Set(),seen=new Set();
  return pages.map(p=>{if(typeof p?.name!=='string'||!p.name.trim())fail('invalid page');const n=normal(p.name);if(seen.has(n))fail('duplicate page '+n);seen.add(n);
   const exact=entries.filter(([k])=>k===n),matches=exact.length?exact:entries.filter(([k])=>k.split('/').at(-1)===n.split('/').at(-1));
   if(matches.length!==1)fail((matches.length?'ambiguous':'missing')+' page '+n);if(used.has(matches[0][0]))fail('texture reused');used.add(matches[0][0]);return [p,matches[0][1]];});
 }
 function decodeSkeleton(name,bytes,{spine,TextDecoder:Decoder}){
  if(typeof name!=='string'||!(bytes instanceof Uint8Array))fail('invalid skeleton');const binary=/\.skel$/i.test(name);if(!binary&&!/\.json$/i.test(name))fail('expected JSON/SKEL');
  let data,version;if(binary){data=bytes.slice();const reader=new spine.BinaryInput(data);reader.readInt32();reader.readInt32();version=reader.readString();}else{data=JSON.parse(new Decoder('utf-8',{fatal:true}).decode(bytes));version=data?.skeleton?.spine;}
  if(typeof version!=='string'||!/^4\.2\.(?:0|[1-9]\d*)$/.test(version))fail('requires Spine 4.2.x');return {binary,data,version};
 }
 const valid=p=>p&&[p.x,p.y,p.rotation,p.scale].every(finite)&&p.scale>1e-10;
 function relativeTransform(M,F,T){
  if(![M,F,T].every(valid))fail('invalid anchor transform');const scale=T.scale/F.scale,a=(T.rotation-F.rotation)*DEG,dx=(M.x-F.x)*scale,dy=(M.y-F.y)*scale;
  const result={x:T.x+dx*Math.cos(a)-dy*Math.sin(a),y:T.y+dx*Math.sin(a)+dy*Math.cos(a),rotation:M.rotation+T.rotation-F.rotation,scale:M.scale*scale};if(!valid(result))fail('invalid composed transform');return result;
 }
 function anchorPoses(model){
  model.updateLocalTransform();const m=model.localTransform,[a,b,c,d,x,y]=[m.a,m.b,m.c,m.d,m.tx,m.ty];if(![a,b,c,d,x,y].every(finite))fail('invalid model transform');const out=Object.create(null);
  function put(n,px,py,ax,ay,bx,by){const scale=Math.hypot(ax,ay),det=ax*by-ay*bx;if([px,py,scale,det].every(finite)&&scale>1e-10&&Math.abs(det)>1e-10)out[n]=Object.freeze({x:px,y:py,rotation:Math.atan2(ay,ax)/DEG,scale});}
  put('$local',x,y,a,b,c,d);for(const bone of model.skeleton.bones)if(bone.active&&bone.data.name!=='$local')put(bone.data.name,x+a*bone.worldX+c*bone.worldY,y+b*bone.worldX+d*bone.worldY,a*bone.a+c*bone.c,b*bone.a+d*bone.c,a*bone.b+c*bone.d,b*bone.b+d*bone.d);return Object.freeze(out);
 }
 function replayClock(seconds,speed=1){
  if(!finite(seconds)||seconds<0||!finite(speed)||speed<0||speed>10)fail('invalid pose time');const t=seconds*speed;if(t>limits.steps/60)fail('replay budget exceeded');
  let frames=Math.floor(t*60);while(frames>0&&frames/60>t)frames--;while((frames+1)/60<=t)frames++;
  return {frames,remainder:t-frames/60,updates:1+frames+Number(t>frames/60)};
 }
 async function create(source,env=globalThis,selection={}){
  const {PIXI,spine,TextDecoder,URL,Image}=env;if(!PIXI||!spine)fail('pinned runtime unavailable');
  const blob=b=>b&&finite(b.size)&&b.size>=0&&typeof b.arrayBuffer==='function';
  if(!blob(source?.skeleton)||!blob(source.atlas)||typeof source.atlas.text!=='function'||!(source.images instanceof Map)||!source.images.size||[...source.images.values()].some(b=>!blob(b)))fail('select skeleton, atlas and textures');
  if(source.skeleton.size>64*1024*1024||source.atlas.size>4*1024*1024||source.images.size>64||[...source.images.values()].reduce((n,b)=>n+b.size,0)>192*1024*1024)fail('asset budget exceeded');
  if(!selection||typeof selection!=='object'||Object.keys(selection).some(k=>k!=='skin'))fail('invalid selection');
  const retained={name:source.name,skeleton:source.skeleton,atlas:source.atlas,images:new Map(source.images)},decoded=decodeSkeleton(retained.name,new Uint8Array(await retained.skeleton.arrayBuffer()),{spine,TextDecoder});
  const atlas=new spine.TextureAtlas(await retained.atlas.text()),pages=matchPages(atlas.pages,retained.images),textures=[],wrappers=[],clones=new Set();let model,scratch,dead=false;
  const live=()=>{if(dead)fail('asset destroyed');};
  function drop(m){if(m&&!m.destroyed){try{m.removeFromParent();}finally{m.destroy({children:true,texture:false,textureSource:false});}}}
  function destroy(){if(dead)return;dead=true;let error;const attempt=f=>{try{f();}catch(e){error??=e;}};for(const m of [...clones,scratch,model])attempt(()=>drop(m));clones.clear();for(const w of wrappers)attempt(()=>w.dispose());for(const t of textures)attempt(()=>t.destroy());if(error)throw error;}
  try{
   for(const [page,b] of pages){const url=URL.createObjectURL(b);let img;try{img=new Image();img.src=url;await img.decode();}finally{URL.revokeObjectURL(url);}
    const t=new PIXI.ImageSource({resource:img,alphaMode:page.pma?'premultiplied-alpha':'premultiply-alpha-on-upload',autoGenerateMipmaps:false});textures.push(t);const w=spine.SpineTexture.from(t);wrappers.push(w);page.setTexture(w);}
   const loader=new spine.AtlasAttachmentLoader(atlas),parser=decoded.binary?new spine.SkeletonBinary(loader):new spine.SkeletonJson(loader),data=parser.readSkeletonData(decoded.data);
   const skins=Object.freeze(data.skins.map(s=>s.name)),animations=Object.freeze(data.animations.map(a=>a.name));
   function checkCapacity(n){live();if(!Number.isSafeInteger(n)||n<0||n>limits.clones||(n+2)*data.bones.length>limits.bones||(n+2)*data.slots.length>limits.slots)fail('clone budget exceeded');}
   checkCapacity(0);const make=()=>new spine.Spine({skeletonData:data,autoUpdate:false});model=make();
   function reset(m,skin,animation='',loop=true){m.state.clearTracks();m.skeleton.setSkin(null);if(skin)m.skeleton.setSkinByName(skin);m.skeleton.setToSetupPose();m.skeleton.time=0;for(const c of m.skeleton.physicsConstraints)c.reset();if(animation)m.state.setAnimation(0,animation,loop);m.update(0);}
   const candidates=selection.skin!==undefined?[selection.skin]:[...new Set([data.defaultSkin?.name||'',...skins])];
   let defaultSkin,bounds;for(const s of candidates){if(typeof s!=='string'||s!==''&&!skins.includes(s))fail('unknown skin');reset(model,s);const q=model.getLocalBounds();if([q.x,q.y,q.width,q.height].every(finite)&&q.width>0&&q.height>0){defaultSkin=s;bounds=q;break;}}
   if(!bounds)fail('no visible attachments in selected skin');const scale=Math.min(260/Math.max(1,bounds.width),330/Math.max(1,bounds.height),2),fit=Object.freeze({x:256-(bounds.x+bounds.width/2)*scale,y:256-(bounds.y+bounds.height/2)*scale,rotation:0,scale});
   const applyFit=m=>{m.position.set(fit.x,fit.y);m.rotation=0;m.scale.set(fit.scale);};applyFit(model);scratch=make();applyFit(scratch);
   const defaultAnimation=animations.includes('idle')?'idle':animations[0]||'';
   function options(o={}){if(!o||typeof o!=='object'||Array.isArray(o)||Object.keys(o).some(k=>!['animation','skin','speed','loop','visible'].includes(k)))fail('invalid pose options');const v={animation:defaultAnimation,skin:defaultSkin,speed:1,loop:true,visible:true,...o};if(typeof v.skin!=='string'||v.skin!==''&&!skins.includes(v.skin))fail('unknown skin');if(typeof v.animation!=='string'||v.animation!==''&&!animations.includes(v.animation))fail('unknown animation');if(typeof v.loop!=='boolean'||typeof v.visible!=='boolean')fail('invalid pose options');replayClock(0,v.speed);return v;}
   function checkReplay(times,o={}){live();const v=options(o);let work=0;for(const t of times){work+=replayClock(t,v.speed).updates;if(work>limits.work)fail('replay work budget exceeded');}return work;}
   function poseAt(seconds,o={},m=model){live();if(m!==model&&m!==scratch&&!clones.has(m)||m.destroyed)fail('model not owned');const v=options(o),clock=replayClock(seconds,v.speed);reset(m,v.skin,v.animation,v.loop);for(let i=0;i<clock.frames;i++)m.update(1/60);if(clock.remainder>0)m.update(clock.remainder);m.visible=v.visible;return anchorPoses(m);}
   function anchorAt(seconds,o={}){return poseAt(seconds,o,scratch);}
   function createClone(){checkCapacity(clones.size+1);const m=make();try{applyFit(m);m.visible=false;clones.add(m);return m;}catch(e){drop(m);throw e;}}
   function releaseClone(m){live();if(!clones.delete(m))fail('model not owned clone');drop(m);}
   return Object.freeze({model,get source(){return {...retained,images:new Map(retained.images)};},version:decoded.version,pages:pages.length,skins,animations,bones:Object.freeze(model.skeleton.bones.map(b=>b.data.name).filter(n=>n!=='$local')),defaultSkin,defaultAnimation,fit,createClone,releaseClone,poseAt,anchorAt,checkCapacity,checkReplay,destroy,get cloneCount(){return clones.size;}});
  }catch(e){try{destroy();}catch(cleanup){e.cleanupError=cleanup;}throw e;}
 }
 return {VERSION:1,limits,matchPages,decodeSkeleton,relativeTransform,anchorPoses,replayClock,create};
});
