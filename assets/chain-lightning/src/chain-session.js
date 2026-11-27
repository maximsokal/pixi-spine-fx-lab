// ELEC-02 L03b: one pose clock and transactional editor session.
(function(root,make){
 'use strict';const api=Object.freeze(make(root.FxChainLightning||(typeof require==='function'?require('./chain-core.js'):null),root.FxChainAuthoring||(typeof require==='function'?require('./chain-authoring.js'):null)));
 if(typeof module==='object'&&module.exports)module.exports=api;else root.FxChainSession=api;
})(globalThis,function(H,U){
 'use strict';
 const FPS=60,cache=new WeakMap(),finite=Number.isFinite,fail=m=>{throw Error('Chain Lightning session: '+m);};
 function options(v,a){if(!v||typeof v.animation!=='string'||typeof v.skin!=='string'||!finite(v.speed)||v.speed<0||v.speed>4||typeof v.visible!=='boolean')fail('pose options');if(v.animation&&!a?.animations.includes(v.animation)||v.skin&&!a?.skins.includes(v.skin))fail('unknown animation or skin');return Object.freeze({animation:v.animation,skin:v.skin,speed:v.speed,visible:v.visible});}
 function pose(asset,t,input){
  if(!finite(t)||t<0||t>60)fail('pose time');const o=options(input,asset);if(!asset)return;
  const m=asset.model,s=m.skeleton,physics=s.physicsConstraints?.length>0,p=cache.get(m),frame=physics&&o.animation&&o.speed>0?Math.floor(t*FPS+1e-8):0;
  let at=p?.frame??0;
  try{
   if(!p||p.animation!==o.animation||p.skin!==o.skin||(physics&&(p.speed!==o.speed||frame<at))){
    cache.delete(m);m.state.clearTracks();s.setSkin(null);if(o.skin)s.setSkinByName(o.skin);s.setToSetupPose();s.time=0;
    for(const c of s.physicsConstraints??[])c.reset();if(o.animation)m.state.setAnimation(0,o.animation,true);m.update(0);at=0;
   }
   if(physics){const steps=Math.max(1,Math.ceil(o.speed)),dt=o.speed/(FPS*steps);for(;at<frame;at++)for(let j=0;j<steps;j++)m.update(dt);}
   else{const entry=m.state.getCurrent(0);if(entry)entry.trackTime=t*o.speed;s.setToSetupPose();m.update(0);}
   m.visible=o.visible;m.updateLocalTransform();cache.set(m,{...o,frame});
  }catch(e){cache.delete(m);throw e;}
 }
 function createSession({PIXI,Spine,world,host,behindHost,models,loader,runtime,initial=H.defaults()}){
  let dead=false,busy=false,broken=false,asset=null,source=null,fx=null,seconds=0,opt=options({animation:'',skin:'',speed:1,visible:true},null);
  function alive(){if(dead)fail('destroyed');}function ready(){alive();if(busy)fail('busy');if(broken)fail('rollback failed; recreate session');}
  function paint(a,r,t,o){pose(a,t,o);return r.seek(t);}
  function recover(error){if(fx)try{paint(asset,fx,seconds,opt);}catch(other){broken=true;throw new AggregateError([error,other],'Chain Lightning rollback failed');}throw error;}
  function stage(a,c,t,o){const p=H.compile(c),at=U.seek(t,p.meta);pose(a,at,o);const r=runtime.createRenderer({PIXI,Spine,world,host,behindHost,model:a?.model??null,settings:p.settings});try{r.seek(at);return {r,at};}catch(e){r.destroy();throw e;}}
  function configure(c){ready();let n;try{n=stage(asset,c,seconds,opt);}catch(e){recover(e);}const old=fx;fx=n.r;seconds=n.at;old?.destroy();return fx.settings;}
  async function replaceSource(input){ready();busy=true;let a=null,n=null;try{
   if(input!==null){a=await loader.create(input);alive();models.addChild(a.model);}
   const o=options({...opt,animation:a?.defaultAnimation??'',skin:a?.defaultSkin??''},a);n=stage(a,fx.settings,seconds,o);alive();
   const old=fx,prior=asset;fx=n.r;seconds=n.at;asset=a;source=input;opt=o;n=a=null;try{old.destroy();}finally{prior?.destroy();}return fx.settings;
  }finally{try{n?.r.destroy();}finally{try{a?.destroy();}finally{busy=false;}}}}
  function seek(t){ready();const at=U.seek(t,fx.meta);let q;try{q=paint(asset,fx,at,opt);}catch(e){recover(e);}seconds=at;return q;}
  function setOptions(v){ready();const o=options(v,asset);try{paint(asset,fx,seconds,o);}catch(e){recover(e);}opt=o;return opt;}
  function destroy(){if(dead)return;dead=true;try{fx?.destroy();}finally{try{asset?.destroy();}finally{fx=asset=source=null;}}}
  configure(initial);
  return Object.freeze({configure,replaceSource,seek,setOptions,destroy,get settings(){return fx?.settings??null;},get seconds(){return seconds;},get meta(){return fx?.meta??null;},get sample(){return fx?.sample??null;},get missing(){return fx?.missing??[];},get capacityExceeded(){return fx?.capacityExceeded??[];},get asset(){return asset;},get source(){return source;},get options(){return opt;},get busy(){return busy;},get broken(){return broken;}});
 }
 return {options,pose,createSession};
});
