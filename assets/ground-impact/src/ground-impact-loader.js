// EARTH-01 G03b: bounded, offline Spine asset owner; limits supplied by host.
(function(root,make){
 'use strict';const api=Object.freeze(make());if(typeof module==='object'&&module.exports)module.exports=api;else root.FxGroundImpactLoader=api;
})(globalThis,function(){
 'use strict';
 const fail=m=>{throw Error('Ground Impact loader: '+m);};
 const positive=n=>Number.isSafeInteger(n)&&n>0;
 const canonical=n=>{if(typeof n!=='string'||!n.trim())fail('invalid texture name');return n.replace(/\\/g,'/');};
 const basename=n=>n.split('/').at(-1);
 const text=async b=>new TextDecoder('utf-8',{fatal:true}).decode(await b.arrayBuffer());
 function file(b,max,label){if(!(b instanceof Blob)||!positive(b.size)||b.size>max)fail('invalid or oversized '+label);}
 function createLoader({PIXI,Spine,URL=globalThis.URL,Image=globalThis.Image,limits}){
  const keys=['skeletonBytes','atlasBytes','encodedBytes','decodedBytes','maxDimension'];
  if(!limits||!keys.every(k=>positive(limits[k])))fail('explicit positive limits required');
  const cap=Object.freeze(Object.fromEntries(keys.map(k=>[k,limits[k]])));
  async function create(input){
   if(!input||typeof input.name!=='string'||!(/\.(json|skel)$/i.test(input.name))||!(input.images instanceof Map)||!input.images.size)fail('complete skeleton, atlas and textures required');
   const source={name:input.name,skeleton:input.skeleton,atlas:input.atlas,images:new Map(input.images)};
   file(source.skeleton,cap.skeletonBytes,'skeleton');file(source.atlas,cap.atlasBytes,'atlas');
   let encoded=0;const entries=new Map();
   for(const [key,b] of source.images){const name=canonical(key);if(entries.has(name))fail('duplicate texture '+name);file(b,cap.encodedBytes,'encoded texture');encoded+=b.size;if(encoded>cap.encodedBytes)fail('encoded texture budget');entries.set(name,b);}
   const binary=/\.skel$/i.test(source.name),raw=binary?new Uint8Array(await source.skeleton.arrayBuffer()):JSON.parse(await text(source.skeleton));
   let version=raw?.skeleton?.spine;
   if(binary){const reader=new Spine.BinaryInput(raw);reader.readInt32();reader.readInt32();version=reader.readString();}
   if(typeof version!=='string'||!/^4\.2\.(?:0|[1-9]\d*)$/.test(version))fail('expected Spine 4.2.x; actual '+version);
   const atlas=new Spine.TextureAtlas(await text(source.atlas));if(!atlas.pages.length)fail('missing atlas pages');
   const seen=new Set(),used=new Set();
   const pages=atlas.pages.map(page=>{const name=canonical(page.name);if(seen.has(name))fail('duplicate atlas page '+name);seen.add(name);
    const matches=entries.has(name)?[name]:[...entries.keys()].filter(k=>basename(k)===basename(name));
    if(matches.length!==1)fail((matches.length?'ambiguous':'missing')+' atlas page '+name);const key=matches[0];if(used.has(key))fail('reused texture '+key);used.add(key);return [page,entries.get(key)];});
   let decoded=0;const images=[];
   for(const [page,b] of pages){const url=URL.createObjectURL(b);let img;try{img=new Image();img.src=url;await img.decode();}finally{URL.revokeObjectURL(url);}
    const w=img.naturalWidth,h=img.naturalHeight;if(!positive(w)||!positive(h)||w>cap.maxDimension||h>cap.maxDimension)fail('decoded texture dimension '+page.name);
    const bytes=w*h*4;if(!positive(bytes)||bytes>cap.decodedBytes-decoded)fail('decoded texture budget');decoded+=bytes;images.push([page,img]);}
   let model=null;const wrappers=[],textures=[];
   function destroy(){const errors=[];const release=fn=>{try{fn();return true;}catch(e){errors.push(e);return false;}};
    if(model&&release(()=>{model.removeFromParent();model.destroy();}))model=null;
    for(const list of [wrappers,textures])for(let i=0;i<list.length;){const item=list[i];if(release(()=>item()))list.splice(i,1);else i++;}
    if(errors.length)throw new AggregateError(errors,'Ground Impact loader cleanup failed');
   }
   try{
    for(const [page,img] of images){const texture=new PIXI.ImageSource({resource:img,alphaMode:page.pma?'premultiplied-alpha':'premultiply-alpha-on-upload',autoGenerateMipmaps:false});textures.push(()=>texture.destroy());const wrapper=Spine.SpineTexture.from(texture);wrappers.push(()=>wrapper.dispose());page.setTexture(wrapper);}
    const attachment=new Spine.AtlasAttachmentLoader(atlas),parser=binary?new Spine.SkeletonBinary(attachment):new Spine.SkeletonJson(attachment),data=parser.readSkeletonData(raw);
    model=new Spine.Spine({skeletonData:data,autoUpdate:false});model.update(0);const b=model.getLocalBounds();
    if(![b.x,b.y,b.width,b.height].every(Number.isFinite)||b.width<=0||b.height<=0)fail('empty or invalid Spine bounds');
    const scale=Math.min(260/Math.max(1,b.width),330/Math.max(1,b.height),2);model.scale.set(scale);model.position.set(256-(b.x+b.width/2)*scale,256-(b.y+b.height/2)*scale);
    const animations=data.animations.map(a=>a.name),skins=data.skins.map(s=>s.name);
    return {model,source,version,pages:pages.length,animations,skins,defaultSkin:data.defaultSkin?.name||skins[0]||'',defaultAnimation:animations.includes('idle')?'idle':animations[0]||'',destroy};
   }catch(error){try{destroy();}catch(cleanup){throw new AggregateError([error,cleanup],'Ground Impact load and cleanup failed');}throw error;}
  }
  return Object.freeze({create});
 }
 return {createLoader};
});
