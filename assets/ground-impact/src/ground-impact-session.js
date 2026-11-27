// EARTH-01 G03b: staged preview ownership; loader supplied by the caller.
(function(root,make){
 'use strict';const load=(n,p)=>root[n]||(typeof require==='function'?require(p):null);
 const api=Object.freeze(make(load('FxGroundImpact','./ground-impact-core.js'),load('FxGroundImpactAuthoring','./ground-impact-authoring.js'),load('FxGroundImpactPose','./ground-impact-pose.js')));
 if(typeof module==='object'&&module.exports)module.exports=api;else root.FxGroundImpactSession=api;
})(globalThis,function(H,U,Q){
 'use strict';
 const fail=m=>{throw Error('Ground Impact session: '+m);};
 function copySource(s){if(s===null)return null;if(!s||typeof s.name!=='string'||!s.skeleton||!s.atlas||!(s.images instanceof Map)||!s.images.size)fail('complete source required');return Object.freeze({name:s.name,atlasName:s.atlasName,skeleton:s.skeleton,atlas:s.atlas,images:new Map(s.images)});}
 function createSession({PIXI,Spine,world,host,behindHost,models,loader,runtime,initial=H.defaults()}){
  if(!loader||typeof loader.create!=='function'||!runtime||typeof runtime.createRenderer!=='function')fail('missing dependencies');
  let dead=false,busy=false,broken=false,asset=null,source=null,fx=null,seconds=0,cleanupError=null,opt=Q.options({animation:'',skin:'',speed:1,visible:true},null);
  const retired=[];
  function alive(){if(dead)fail('destroyed');}
  function ready(){alive();if(busy)fail('busy');if(broken)fail('rollback failed; recreate session');}
  function retire(owner){if(!owner)return;
   // Stop a rejected/retired owner from contributing even if disposal throws.
   const roots=owner.owned;if(roots){if(!roots.behind.destroyed)roots.behind.visible=false;if(!roots.front.destroyed)roots.front.visible=false;}
   if(owner.model&&!owner.model.destroyed)owner.model.visible=false;
   try{owner.destroy();}catch(e){retired.push(owner);cleanupError=String(e?.message||e);}
  }
  function hide(){if(fx?.owned){fx.owned.behind.visible=false;fx.owned.front.visible=false;}if(asset?.model&&!asset.model.destroyed)asset.model.visible=false;}
  function recover(error){
   try{Q.invalidate(asset);Q.seek(asset,seconds,opt);fx.seek(seconds);}
   catch(other){broken=true;hide();throw new AggregateError([error,other],'Ground Impact session rollback failed');}
   throw error;
  }
  function stage(a,c,t){const p=H.compile(c),r=runtime.createRenderer({PIXI,Spine,world,host,behindHost,model:a?.model??null,settings:p.settings});
   try{r.seek(t);return r;}catch(e){retire(r);throw e;}
  }
  function configure(c){ready();const n=stage(asset,c,seconds),old=fx;fx=n;retire(old);return fx.settings;}
  async function replaceSource(input){
   ready();const snapshot=copySource(input);busy=true;let a=null,n=null;
   try{
    if(snapshot!==null){a=await loader.create(copySource(snapshot));alive();if(!a?.model||typeof a.destroy!=='function')fail('invalid loaded asset');models.addChild(a.model);}
    const o=Q.options({...opt,animation:a?.defaultAnimation??'',skin:a?.defaultSkin??''},a);
    Q.seek(a,seconds,o);n=stage(a,fx.settings,seconds);alive();
    const old=fx,prior=asset;fx=n;asset=a;source=snapshot;opt=o;n=a=null;retire(old);retire(prior);return fx.settings;
   }finally{retire(n);retire(a);busy=false;}
  }
  function seek(t){ready();const at=U.seek(t);let q;try{Q.seek(asset,at,opt);q=fx.seek(at);}catch(e){recover(e);}seconds=at;return q;}
  function setOptions(v){ready();const o=Q.options(v,asset);try{Q.seek(asset,seconds,o);fx.seek(seconds);}catch(e){recover(e);}opt=o;return opt;}
  function destroy(){if(dead)return;dead=true;retire(fx);retire(asset);fx=asset=source=null;const pending=retired.splice(0);for(const x of pending)retire(x);if(retired.length)fail('owned resource cleanup failed: '+cleanupError);}
  configure(initial);
  return Object.freeze({configure,replaceSource,seek,setOptions,destroy,get settings(){return fx?.settings??null;},get seconds(){return seconds;},get meta(){return fx?.meta??null;},get sample(){return broken?null:fx?.sample??null;},get missing(){return broken?[]:fx?.missing??[];},get asset(){return asset;},get source(){return copySource(source);},get options(){return opt;},get busy(){return busy;},get broken(){return broken;},get cleanupError(){return cleanupError;}});
 }
 return {createSession};
});
