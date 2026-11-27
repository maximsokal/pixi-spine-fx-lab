// EARTH-04 shared offline Spine loader.
(function(root,factory){const api=Object.freeze(factory());if(typeof module==='object'&&module.exports)module.exports=api;else root.FxLeavesSpine=api;})(globalThis,function(){
 'use strict';
  async function readSpine(source,{PIXI,spine}){
   const bytes=await source.skeleton.arrayBuffer(),binary=/\.skel$/i.test(source.skeletonName);
   const raw=binary?new Uint8Array(bytes):JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
   let version=raw?.skeleton?.spine;
   if(binary){const input=new spine.BinaryInput(raw);input.readInt32();input.readInt32();version=input.readString();}
   if(typeof version!=='string'||!/^4\.2\.(?:0|[1-9]\d*)$/.test(version))throw Error('Falling Leaves requires Spine 4.2; received '+version);
   const atlas=new spine.TextureAtlas(await source.atlas.text());let model=null;
   try{
    if(!atlas.pages.length)throw Error('Atlas has no pages');
    const normalize=s=>s.replaceAll('\\','/'),entries=[...source.images].map(([k,v])=>[normalize(k),v]);
    const names=new Set(),used=new Set();
    const pages=atlas.pages.map(page=>{
     const name=normalize(page.name);
     if(names.has(name))throw Error('Duplicate atlas page '+name);names.add(name);
     const exact=entries.filter(([k])=>k===name);
     const matches=exact.length?exact:entries.filter(([k])=>k.split('/').at(-1)===name.split('/').at(-1));
     if(matches.length!==1)throw Error((matches.length?'Ambiguous':'Missing')+' atlas page '+name);
     const [key,blob]=matches[0];
     if(used.has(key))throw Error('Texture reused by multiple atlas pages '+name);used.add(key);
     if(!blob)throw Error('Missing atlas page '+name);
     return [page,blob];
    });
    for(const [page,blob] of pages){
     const url=URL.createObjectURL(blob);let image;
     try{image=new Image();image.src=url;await image.decode();}finally{URL.revokeObjectURL(url);}
     page.setTexture(spine.SpineTexture.from(new PIXI.ImageSource({resource:image,alphaMode:page.pma?'premultiplied-alpha':'premultiply-alpha-on-upload',autoGenerateMipmaps:false})));
    }
    const loader=new spine.AtlasAttachmentLoader(atlas),parser=binary?new spine.SkeletonBinary(loader):new spine.SkeletonJson(loader);
    const data=parser.readSkeletonData(raw);model=new spine.Spine({skeletonData:data,autoUpdate:false});model.update(0);
    const b=model.getLocalBounds();if(!(b.width>0&&b.height>0))throw Error('Empty Spine skeleton');
    const scale=Math.min(260/b.width,330/b.height,2);model.scale.set(scale);model.position.set(256-(b.x+b.width/2)*scale,260-(b.y+b.height/2)*scale);
    return {model,atlas,data,version};
   }catch(e){model?.destroy();atlas.dispose();throw e;}
  }
 return {readSpine};
});
