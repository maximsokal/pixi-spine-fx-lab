// EARTH-01 G03c: pending local file selection, separate from accepted preview.
(function(root,make){
 'use strict';const api=Object.freeze(make());if(typeof module==='object'&&module.exports)module.exports=api;else root.FxGroundImpactSelection=api;
})(globalThis,function(){
 'use strict';
 const fail=m=>{throw Error('Ground Impact selection: '+m);};
 const key=f=>f.name.replace(/\\/g,'/');
 function kind(f){
  if(!(f instanceof Blob)||typeof f.name!=='string'||!f.name.trim()||f.size===0)fail('invalid file');
  if(/\.(json|skel)$/i.test(f.name))return 'skeleton';
  if(/\.atlas$/i.test(f.name))return 'atlas';
  if(/\.(png|jpe?g|webp)$/i.test(f.name)||(/^image\//i.test(f.type)&&!/\.spine$/i.test(f.name)))return 'texture';
  return 'unsupported';
 }
 function createSelection(session){
  if(!session||typeof session.replaceSource!=='function')fail('session required');
  let skeleton=null,atlas=null,images=new Map(),pending=false;
  const busy=()=>pending||session.busy===true;
  function ready(){if(busy())fail('busy');}
  const complete=()=>!!(skeleton&&atlas&&images.size);
  function select(files,expected){
   ready();const list=Array.from(files);if(!list.length)return;
   if(list.length!==1||kind(list[0])!==expected)fail('select one '+expected);
   if(expected==='skeleton')skeleton=list[0];else atlas=list[0];
  }
  function mergeTextures(target,files){
   for(const f of files){if(kind(f)!=='texture')fail('invalid texture file');const name=key(f);if(target.has(name))fail('duplicate texture '+name);target.set(name,f);}
  }
  function addTextures(files){ready();const next=new Map(images);mergeTextures(next,Array.from(files));images=next;}
  function drop(files){
   ready();const groups={skeleton:[],atlas:[],texture:[]};
   for(const f of Array.from(files)){const k=kind(f);if(k==='unsupported')fail('unsupported dropped file '+f.name);groups[k].push(f);}
   if(groups.skeleton.length>1)fail('select one skeleton');if(groups.atlas.length>1)fail('select one atlas');
   const next=new Map(images);mergeTextures(next,groups.texture);
   skeleton=groups.skeleton[0]??skeleton;atlas=groups.atlas[0]??atlas;images=next;
  }
  async function loadSource(source){ready();pending=true;try{return await session.replaceSource(source);}finally{pending=false;}}
  async function load(){ready();if(!complete())fail('complete skeleton, atlas and textures required');return loadSource({name:skeleton.name,skeleton,atlas,atlasName:atlas.name,images:new Map(images)});}
  function clear(){ready();skeleton=atlas=null;images=new Map();}
  function removeTexture(name){ready();images.delete(name.replace(/\\/g,'/'));}
  return Object.freeze({selectSkeleton:files=>select(files,'skeleton'),selectAtlas:files=>select(files,'atlas'),addTextures,drop,removeTexture,clear,load,loadSource,removePreview:()=>loadSource(null),get busy(){return busy();},get complete(){return complete();},get files(){return {skeleton:skeleton?.name??null,atlas:atlas?.name??null,textures:[...images.keys()]};}});
 }
 return {createSelection};
});
