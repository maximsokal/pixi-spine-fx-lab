// GAME-08: pure pulse clock; no impact scheduling or renderer ownership.
(function(root,factory){
 const api=Object.freeze(factory());
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.FxShieldClock=api;
})(globalThis,function(){
 'use strict';
 const FPS=60,MAX_HZ=10,MAX_SECONDS=1e6;
 function compilePulseClock(input){
  if(!input||typeof input!=='object'||Array.isArray(input)||
     Object.keys(input).length!==3||!['mode','durationFrames','pulseRate'].every(k=>Object.hasOwn(input,k)))
   throw TypeError('GAME-08 invalid pulse clock fields');
  const {mode,durationFrames,pulseRate}=input;
  if(mode!=='loop'&&mode!=='oneShot')throw RangeError('GAME-08 invalid mode');
  if(!Number.isInteger(durationFrames)||durationFrames<2||durationFrames>3600)
   throw RangeError('GAME-08 invalid durationFrames');
  if(!Number.isFinite(pulseRate)||pulseRate<0||pulseRate>MAX_HZ)
   throw RangeError('GAME-08 invalid pulseRate');
  const loop=mode==='loop',endFrame=loop?durationFrames:durationFrames-1;
  const durationSeconds=endFrame/FPS;
  // A loop must contain whole cycles. Enforce the artist frequency ceiling
  // even for very short periods; never silently turn a positive rate off.
  const maxCycles=Math.floor(MAX_HZ*endFrame/FPS);
  if(loop&&pulseRate>0&&maxCycles===0)throw RangeError('GAME-08 no positive pulse cycle fits duration');
  const cycles=loop?(pulseRate===0?0:Math.min(maxCycles,Math.max(1,Math.round(pulseRate*durationSeconds)))):null;
  const effectiveHz=loop?cycles*FPS/endFrame:pulseRate;
  function sample(seconds){
   if(!Number.isFinite(seconds)||seconds<0||seconds>MAX_SECONDS)
    throw RangeError('GAME-08 invalid seconds');
   // Same 1ns authored-frame snap policy as FX-CORE-05. Keep fractional
   // seeks outside that tolerance; modulo in frame units avoids seam drift.
   const nearest=Math.round(seconds*FPS);
   const frame=Math.abs(seconds-nearest/FPS)<=1e-9?nearest:seconds*FPS;
   const local=loop?frame%endFrame:Math.min(frame,endFrame);
   const turns=loop?local*cycles/endFrame:local/FPS*effectiveHz;
   const phase=turns%1||0;
   return {phase,pulse:(1-Math.cos(2*Math.PI*phase))/2};
  }
  return Object.freeze({requestedHz:pulseRate,effectiveHz,cycles,durationSeconds,sample});
 }
 return {compilePulseClock};
});
