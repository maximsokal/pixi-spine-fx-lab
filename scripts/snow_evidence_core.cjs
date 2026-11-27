'use strict';
// AIR-02 T06: parameter-specific numerical witnesses; never hashes settings.
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.FxSnowEvidence=api;})(globalThis,function(){
 const clone=v=>JSON.parse(JSON.stringify(v)),eq=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
 function audit(H,E,blueprint){
  const keys=new Set(),out=[],add=(id,expected,actual,pass)=>{if(keys.has(id))throw Error('duplicate witness '+id);keys.add(id);out.push({id,kind:'numeric',expected,actual,tolerance:{},evidence:[],status:pass?'PASS':'FAIL'});};
  const layers=f=>f.emitters.map(e=>e.layers.map(l=>l.particles));
  function compare(a,b){const p=H.createPlan(a),q=H.createPlan(b);let changed=0;for(let i=0;i<60;i++)if(!eq(layers(p.sample(i/60)),layers(q.sample(i/60))))changed++;return {changedFrames:changed,sampledFrames:60};}
  const scalar={flakesPerSecond:32,flakeSize:12,fallSpeed:80,windDrift:-24,rotationSpeed:-45,depthVariation:.9,horizontalGapPx:12,spatialMode:'random',spatialJitter:.4,fieldWidth:700,seed:7322,mode:'oneShot',durationFrames:600,style:'magical'};
  for(const [key,value] of Object.entries(scalar)){
   const a=H.defaults(),b=clone(a);b[key]=value;
   if(key==='mode')b.durationFrames=40;
   if(key==='style')b.palette=H.stylePalette(value);
   try{const actual=compare(a,b);add('parameter.'+key,'Changes sampled particle output',actual,actual.changedFrames>0);}catch(e){add('parameter.'+key,'Valid edit changes output',{error:e.message},false);}
  }
  const a=H.defaults(),b=clone(a);b.exportFrames=40;
  const m=E.manifest(a,{actual:'webgl2'},a.exportFrames),n=E.manifest(b,{actual:'webgl2'},b.exportFrames);
  add('parameter.exportFrames','Changes exported frame count, preserves sampled motion',{before:m.frames.length,after:n.frames.length,...compare(a,b)},m.frames.length===60&&n.frames.length===40&&compare(a,b).changedFrames===0);
  const budget=H.defaults();budget.flakesPerSecond=70;budget.fallSpeed=30;const mid=H.createPlan(budget),hi=H.createPlan({...budget,quality:'high'});let rejected=false;try{H.createPlan({...budget,quality:'low'});}catch(e){if(!/budget/.test(e.message))throw e;rejected=true;}
  add('parameter.quality','Low rejects over-budget configuration; balanced/high retain same motion',{bound:mid.peakUpperBound,lowLimit:H.BUDGETS.low,balancedLimit:H.BUDGETS.balanced,lowRejected:rejected,highSame:eq(mid.sample(.3),hi.sample(.3))},rejected&&mid.peakUpperBound>H.BUDGETS.low&&eq(mid.sample(.3),hi.sample(.3)));
  for(const c of blueprint.curves){const a=H.defaults(),b=clone(a),curve=b[c.key];if(!curve)throw Error('unknown curve '+c.key);
   if(c.key==='driftCurve'){curve.keys[1].y=.3;}else if(c.key==='rotationCurve'){curve.keys[0].y=1;}else if(c.key==='flakeAlphaCurve'){curve.keys[1].y=.2;curve.keys[2].y=.2;}else{curve.defaultValue=2;for(const k of curve.keys)k.y=2;}
   try{const actual=compare(a,b);add('curve.'+c.id,'Curve edit changes actual particles',actual,actual.changedFrames>0);}catch(e){add('curve.'+c.id,'Valid curve edit changes output',{error:e.message},false);}
  }
  const a0=H.defaults(),s=H.schedule(a0,'emitter1'),s2=H.schedule({...a0,horizontalGapPx:12},'emitter1'),p=H.createPlan(a0),base=p.sample(0);p.sample(.73);
  add('spacing.independent','22 shared events; gap changes launch distances, not times; arc error <= .25px',{births:s.events.length,near:s.events.filter(e=>e.layer==='near').length,far:s.events.filter(e=>e.layer==='far').length,timesEqual:eq(s.events.map(e=>e.time),s2.events.map(e=>e.time)),positionsDiffer:!eq(s.launchDistances,s2.launchDistances),errorPx:s.arcErrorBound},s.events.length===22&&eq(s.events.map(e=>e.time),s2.events.map(e=>e.time))&&!eq(s.launchDistances,s2.launchDistances)&&s.arcErrorBound<=.25);
  add('timeline.periodic','Start is populated; exact numeric seam and reverse seek',{startParticles:base.cost,seamEqual:eq(base,p.sample(1)),reverseEqual:eq(base,p.sample(0))},base.cost>0&&eq(base,p.sample(1))&&eq(base,p.sample(0)));
  for(const k of H.LAYERS){const a=H.defaults();a.emitters[0].layers[k].enabled=true;const b=clone(a);b.emitters[0].layers[k].enabled=false;const x=H.createPlan(a).sample(.3).emitters[0].layers,y=H.createPlan(b).sample(.3).emitters[0].layers;
   const before=x.find(l=>l.id===k).particles.length,after=y.find(l=>l.id===k).particles.length,siblingsSame=x.filter(l=>l.id!==k).every(l=>eq(l,y.find(q=>q.id===l.id)));
   add('layer.'+k,'Independent layer disable, no sibling changes',{before,after,siblingsSame},before>0&&after===0&&siblingsSame);
  }
  for(const p of blueprint.parameters)if(!keys.has('parameter.'+p.key))throw Error('missing scalar '+p.key);
  if(out.filter(x=>x.id.startsWith('parameter.')).length!==blueprint.parameters.length)throw Error('unexpected scalar witness');
  return out;
 }
 return {audit};
});
if(typeof module==='object'&&module.exports&&require.main===module){const fs=require('node:fs'),path=require('node:path'),H=require('../assets/snowfall/src/snow-core.js'),E=require('../assets/snowfall/src/snow-export.js'),doc=JSON.parse(fs.readFileSync(path.join(__dirname,'../references/fx/air/snowfall.md'),'utf8').match(/\x60\x60\x60json\n([\s\S]*?)\n\x60\x60\x60/)[1]);const checks=module.exports.audit(H,E,doc);console.log(JSON.stringify(checks,null,2));if(checks.some(c=>c.status!=='PASS'))process.exitCode=2;}
