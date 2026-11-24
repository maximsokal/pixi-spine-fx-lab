// FX-CORE-05 — deterministic seconds-based transport, fixed-step replay and PRNG.
(function(root,factory){
 const api=Object.freeze(factory());
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.FxTimeline=api;
})(globalThis,function(){
 'use strict';
 const VERSION=1,FPS=60,CHECKPOINT_FRAMES=60,MAX_CHECKPOINTS=64;
 const eps=1e-9;
 const canonicalSeconds=value=>{
  const f=Math.round(value*FPS),exact=f/FPS;
  return Math.abs(value-exact)<=1e-9?exact:value;
 };
 const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
 function num(v,name,min=0,max=1e6){
  if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)
   throw new RangeError(name+' must be finite in '+min+'..'+max);
  return v;
 }
 function createPrng(seed=0){
  if(!Number.isSafeInteger(seed)||seed< -2147483648||seed>2147483647)throw new TypeError('seed must be int32');
  const initial=((seed*1009)+0x6d2b79f5)>>>0;
  let state=initial;
  return {
   next(){state=(state+0x6d2b79f5)>>>0;
    let n=Math.imul(state^state>>>15,1|state);
    n^=n+Math.imul(n^n>>>7,61|n);
    return ((n^n>>>14)>>>0)/4294967296;},
   get state(){return state>>>0;},
   setState(value){if(!Number.isSafeInteger(value)||value<0||value>0xffffffff)throw new TypeError('PRNG state must be uint32');state=value>>>0;},
   reset(){state=initial}
  };
 }
 function createTransport({duration=3,time=0,direction=1,loop=false,playing=false}={}){
  let length=num(duration,'duration',1/FPS,1e6);
  // Authored endpoint wins over frame snapping; never snap outside duration.
  const transportSeconds=value=>{
   if(value===length)return length;
   const snapped=canonicalSeconds(value);
   return snapped<=length?snapped:value;
  };
  let t=transportSeconds(num(time,'time',0,length));
  if(direction!==1&&direction!==-1)throw new RangeError('direction must be +1 or -1');
  if(typeof loop!=='boolean'||typeof playing!=='boolean')throw new TypeError('loop and playing must be boolean');
  let velocity=direction,looped=loop,active=playing;
  const snapshot=()=>Object.freeze({time:t,phase:t/length,frame:t*FPS,duration:length,
   direction:velocity,loop:looped,playing:active});
  return {
   get state(){return snapshot()},
   seek(value){t=transportSeconds(num(value,'seek time',0,length));return snapshot()},
   play(next=velocity){if(next!==1&&next!==-1)throw new RangeError('direction must be +1 or -1');
    velocity=next;active=true;return snapshot();},
   pause(){active=false;return snapshot()},
   reset(){t=0;active=false;return snapshot()},
   setLoop(value){if(typeof value!=='boolean')throw new TypeError('loop must be boolean');
    looped=value;return snapshot();},
   setDuration(value){length=num(value,'duration',1/FPS,1e6);t=Math.min(t,length);return snapshot()},
   tick(delta){
    num(delta,'elapsed seconds',0,1e6);if(!active||delta===0)return snapshot();
    let next=t+delta*velocity;
    if(looped){
     if(next>=length||next<0){
      next=((next%length)+length)%length;
      // reverse crossing exact zero wraps to end; endpoint is otherwise exclusive.
      if(velocity<0&&Math.abs(next)<eps)next=length;
     }
    }else{
     if(next>=length-eps){next=length;active=false;}
     if(next<=eps){next=0;active=false;}
    }
    t=transportSeconds(next);return snapshot();
   }
  };
 }
 function seekSpine(model,seconds){
  num(seconds,'Spine animation time',0,1e6);
  if(!model?.skeleton||!model?.state||typeof model.update!=='function')
   throw new TypeError('seekSpine requires a Spine instance');
  const entry=typeof model.state.getCurrent==='function'?model.state.getCurrent(0):null;
  if(typeof model.skeleton.setToSetupPose==='function')model.skeleton.setToSetupPose();
  if(entry)entry.trackTime=seconds;
  model.update(0);
  return seconds;
 }
 function domains({effectTime,emitterOffset=0,particleBirth=0,particleLife=1,
   pathDistance=0,pathLength=1,spineTime=0}={}){
  num(effectTime,'effectTime');num(emitterOffset,'emitterOffset',-1e6,1e6);
  num(particleBirth,'particleBirth',-1e6,1e6);num(particleLife,'particleLife',eps,1e6);
  num(pathDistance,'pathDistance',0);num(pathLength,'pathLength',0);
  num(spineTime,'spineTime');
  return Object.freeze({effectTime,emitterLocalTime:effectTime-emitterOffset,
   particleAge:clamp((effectTime-particleBirth)/particleLife,0,1),
   pathPosition:pathLength>0?clamp(pathDistance/pathLength,0,1):0,spineAnimationTime:spineTime});
 }
 // Replay snapshots are CPU-only. Checkpoint at most one each second, keep frame zero,
 // evict oldest other checkpoints, never hold a GPU texture or PIXI object here.
 function createReplay({capture,restore,step,partial,render,fps=FPS,
   checkpointEvery=CHECKPOINT_FRAMES,maxCheckpoints=MAX_CHECKPOINTS,maxSeconds=3600}={}){
  if(typeof capture!=='function'||typeof restore!=='function'||typeof step!=='function')throw new TypeError('capture/restore/step required');
  if(!Number.isSafeInteger(fps)||fps<1||fps>240||
     !Number.isSafeInteger(checkpointEvery)||checkpointEvery<1||
     !Number.isSafeInteger(maxCheckpoints)||maxCheckpoints<2||maxCheckpoints>64)
    throw new RangeError('invalid replay limits');
  const clone=state=>structuredClone(state);
  let initial=clone(capture()),frame=0,at=0,fractional=false,whole=null;
  const checks=new Map([[0,clone(initial)]]);
  function save(n){
   if(n%checkpointEvery)return;
   checks.set(n,clone(capture()));
   while(checks.size>maxCheckpoints){
    const discard=[...checks.keys()].filter(k=>k!==0).sort((a,b)=>a-b)[0];
    checks.delete(discard);
   }
  }
  function rollback(){
   if(fractional){restore(clone(whole));fractional=false;at=frame/fps;}
  }
  function rewind(target){
   let n=0;
   for(const checkpoint of checks.keys())if(checkpoint<=target&&checkpoint>=n)n=checkpoint;
   restore(clone(checks.get(n)));frame=n;at=n/fps;fractional=false;
  }
  function seek(seconds){
   num(seconds,'seek seconds',0,maxSeconds);
   const snapped=canonicalSeconds(seconds);
   if(snapped<=maxSeconds)seconds=snapped;
   // Compare actual frame timestamps: multiplying by fps can round in either
   // direction, and an epsilon in frame units can advance physics too early.
   let target=Math.floor(seconds*fps);
   if(target/fps>seconds)target--;
   else if((target+1)/fps<=seconds)target++;
   const leftover=seconds-target/fps;
   rollback();
   if(target<frame)rewind(target);
   for(let i=frame+1;i<=target;i++){
    step(1/fps,i/fps,i);frame=i;at=i/fps;save(i);
   }
   whole=clone(capture());
   if(leftover>0){partial?.(leftover,seconds,target);fractional=true;}
   at=seconds;
   render?.(seconds);
   return Object.freeze({seconds,frame:target,fraction:leftover,checkpointCount:checks.size});
  }
  function invalidate(){
   restore(clone(initial));frame=0;at=0;fractional=false;whole=null;checks.clear();
   checks.set(0,clone(initial));render?.(0);
  }
  function rebase(){
   initial=clone(capture());frame=0;at=0;fractional=false;whole=null;
   checks.clear();checks.set(0,clone(initial));
  }
  return {seek,invalidate,rebase,get time(){return at;},get frame(){return frame;},
   get checkpointFrames(){return [...checks.keys()].sort((a,b)=>a-b)},
   get checkpointCount(){return checks.size},get fps(){return fps}};
 }
 return {VERSION,FPS,CHECKPOINT_FRAMES,MAX_CHECKPOINTS,canonicalSeconds,createPrng,createTransport,
  domains,createReplay,seekSpine};
});