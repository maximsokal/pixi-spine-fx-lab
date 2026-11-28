(function(root,make){'use strict';const api=Object.freeze(make(root.FxMotionCurve||(typeof require==='function'?require('../../template/src/motion-curve.js'):null),root.FxCurves||(typeof require==='function'?require('../../template/src/curve-core.js'):null)));if(typeof module==='object'&&module.exports)module.exports=api;else root.FxAuraMotion=api;})(globalThis,function(M,C){
 'use strict';
 function glowCurve(durationFrames,options){
  const keys=['center','amplitude','cycles','phaseCycles','tolerance'];
  if(!options||typeof options!=='object'||Reflect.ownKeys(options).length!==keys.length||!keys.every(k=>Object.hasOwn(options,k)))throw TypeError('Explicit halo pulse controls required');
  if(!Number.isInteger(durationFrames)||durationFrames<6||durationFrames>3600)throw RangeError('Aura durationFrames');
  const {center,amplitude,cycles,phaseCycles,tolerance}=options;
  if(!Number.isFinite(center)||!Number.isFinite(amplitude)||amplitude<0||center-amplitude<0||center+amplitude>2)throw RangeError('Halo pulse must stay in 0–2');
  const r=M.convert({schemaVersion:1,type:'pulse',durationFrames,center,amplitude,cycles,phaseCycles},{parameterKey:'glowPulse',domain:'effectTime',inputUnit:'normalized-duration',valueUnit:'normalized',valueRange:[0,2],defaultValue:center,monotonic:false,tolerance,protectedSeconds:[]});
  return {curve:C.normalize({...r.curve,valueUnit:'multiplier'}),diagnostics:r.diagnostics};
 }
 return {VERSION:1,glowCurve};
});
