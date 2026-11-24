// GAME-05 offline Spine asset owner. No mutation of the active scene during parsing.
(function(root){
 'use strict';
 function sample(spec){
  return {name:spec.skeletonName,skeleton:new Blob([JSON.stringify(spec.skeleton)]),
   atlas:new Blob([spec.atlas]),images:new Map(Object.entries(spec.images).map(([name,b64])=>
    [name,new Blob([Uint8Array.from(atob(b64),c=>c.charCodeAt(0))],{type:'image/png'})]))};
 }
 async function create(source){
  if(!source?.skeleton||!source?.atlas||!source.images?.size)throw Error('Select one skeleton, one atlas and all texture pages');
  const binary=/\.skel$/i.test(source.name);
  if(!binary&&!/\.json$/i.test(source.name))throw Error('Expected Spine .json or .skel export');
  const bytes=new Uint8Array(await source.skeleton.arrayBuffer());
  const data=binary?bytes:JSON.parse(new TextDecoder().decode(bytes));
  let version;
  if(binary){const input=new spine.BinaryInput(bytes);input.readInt32();input.readInt32();version=input.readString();}
  else version=data?.skeleton?.spine;
  if(typeof version!=='string'||!/^4\.2\.(?:0|[1-9]\d*)$/.test(version))throw Error('Shockwave requires Spine 4.2 export. Actual: '+version);
  let atlas=null,model=null,dead=false;const textures=[],wrappers=[];
  function destroy(){
   if(dead)return;dead=true;
   if(model){model.removeFromParent();model.destroy();}
   for(const t of wrappers)t.dispose();
   for(const t of textures)t.destroy();
  }
  try{
   atlas=new spine.TextureAtlas(await source.atlas.text());
   if(!atlas.pages.length)throw Error('Atlas has no pages');
   const normalize=s=>s.replace(/\\/g,'/'),entries=[...source.images].map(([k,v])=>[normalize(k),v]);
   // Resolve every page before decoding textures. One selected entry may not
   // silently satisfy multiple pages, even through a basename fallback.
   const pageNames=new Set(),used=new Set();
   const pages=atlas.pages.map(page=>{
    const name=normalize(page.name);
    if(pageNames.has(name))throw Error('Duplicate atlas page '+page.name);
    pageNames.add(name);
    const exact=entries.filter(([k])=>k===name);
    const matches=exact.length?exact:entries.filter(([k])=>k.split('/').at(-1)===name.split('/').at(-1));
    if(matches.length!==1)throw Error((matches.length?'Ambiguous':'Missing')+' atlas page '+page.name);
    const [key,blob]=matches[0];
    if(used.has(key))throw Error('Texture reused by multiple atlas pages '+page.name);
    used.add(key);
    return [page,blob];
   });
   for(const [page,blob] of pages){
    const url=URL.createObjectURL(blob),img=new Image();
    try{img.src=url;await img.decode();}finally{URL.revokeObjectURL(url);}
    const texture=new PIXI.ImageSource({resource:img,alphaMode:page.pma?'premultiplied-alpha':'premultiply-alpha-on-upload',autoGenerateMipmaps:false});
    textures.push(texture);const wrapper=spine.SpineTexture.from(texture);wrappers.push(wrapper);page.setTexture(wrapper);
   }
   const loader=new spine.AtlasAttachmentLoader(atlas),parser=binary?new spine.SkeletonBinary(loader):new spine.SkeletonJson(loader);
   const parsed=parser.readSkeletonData(data);
   model=new spine.Spine({skeletonData:parsed,autoUpdate:false});model.update(0);
   const bounds=model.getLocalBounds();
   if(!Number.isFinite(bounds.width)||!Number.isFinite(bounds.height)||bounds.width<=0||bounds.height<=0)throw Error('Spine skeleton has no visible attachments');
   const scale=Math.min(260/Math.max(1,bounds.width),330/Math.max(1,bounds.height),2);
   model.scale.set(scale);model.position.set(256-(bounds.x+bounds.width/2)*scale,256-(bounds.y+bounds.height/2)*scale);
   const animations=parsed.animations.map(a=>a.name),skins=parsed.skins.map(a=>a.name);
   return {model,source,version,pages:atlas.pages.length,animations,skins,
    defaultSkin:parsed.defaultSkin?.name||skins[0]||'',defaultAnimation:animations.includes('idle')?'idle':animations[0]||'',destroy};
  }catch(error){destroy();throw error;}
 }
 root.FxShockwaveSpine=Object.freeze({create,sample});
})(globalThis);
