#!/usr/bin/env node
'use strict';
const A=require('node:assert/strict'),Rain=require('../assets/rainfall/src/rain-core.js');
const clone=x=>JSON.parse(JSON.stringify(x));
const defaults=Rain.defaults();
A.equal(Rain.VERSION,1);
A.equal(defaults.durationFrames,60);
A.equal(defaults.exportFrames,60);
A.equal(defaults.loop,true);
A.equal(defaults.density,45);
A.equal(defaults.streakLength,14);
A.equal(defaults.windAngle,10);
A.equal(defaults.fallSpeed,260);
A.equal(defaults.dropWidth,2);
A.equal(defaults.impactProbability,.3);
A.equal(defaults.spatialGap,18);
A.equal(defaults.groundY,450);
A.equal(defaults.emitters.length,1);
A.deepEqual(Rain.LAYERS,['drops','far','near','impacts']);
const initial=Rain.sample(defaults,0);
A.ok(initial.emitters.length===1);
const drops=initial.emitters[0].layers.drops;
A.ok(drops.length>50,'pre-rolled rain must be present at frame0, even if lifetime >1 second');
A.ok(drops.some(d=>d.bornAt<0),'pre-roll must include prior cycle');
A.ok(drops.some(d=>d.age>1),'long-lived particles must span loop boundary');
const one=Rain.sample(defaults,1);
A.deepEqual(one,initial,'all periodized data same at t0 and t=1');
for(const frame of [0,1,3,14,29,30,31,58,59,60,119])
 A.deepEqual(Rain.sample(defaults,frame/60),Rain.sample(defaults,(frame%60)/60));
const before=Rain.sample(defaults,58/60).emitters[0].layers.drops.length;
const atSeam=Rain.sample(defaults,59/60).emitters[0].layers.drops.length;
const after=Rain.sample(defaults,0).emitters[0].layers.drops.length;
A.ok(Math.abs(before-atSeam)<=5&&Math.abs(atSeam-after)<=5,
 'no sudden global density reset between frame59 and frame0');
A.ok(Rain.schedule(defaults,defaults.emitters[0]).events.length>=40,
 'normalizing rate-envelope must target mean 45 arrivals/s');
A.ok(Rain.schedule(defaults,defaults.emitters[0]).events.length<=50);
const frame=Rain.sample(defaults,.3).emitters[0].layers;
A.ok(frame.drops.length>0&&frame.impacts.length>0);
A.equal(frame.far.length,0);A.equal(frame.near.length,0);
A.ok(frame.drops.every(x=>x.kind==='streak'&&Number.isFinite(x.x)&&Number.isFinite(x.y)&&x.length>0));
const calm=clone(defaults);calm.windAngle=0;
A.notDeepEqual(Rain.sample(calm,.3).emitters[0].layers.drops.map(x=>x.x),
 frame.drops.map(x=>x.x),'wind must displace drops');
A.notDeepEqual(Rain.sample(calm,.3).emitters[0].layers.drops.map(x=>x.rotation),
 frame.drops.map(x=>x.rotation),'wind must rotate streaks');
const noRain=clone(defaults);noRain.density=0;
const zero=Rain.sample(noRain,.3).emitters[0].layers;
A.equal(zero.drops.length,0);A.equal(zero.impacts.length,0);
const noHits=clone(defaults);noHits.impactProbability=0;
A.equal(Rain.sample(noHits,.3).emitters[0].layers.impacts.length,0);
const allHits=clone(defaults);allHits.impactProbability=1;
A.ok(Rain.sample(allHits,.3).emitters[0].layers.impacts.length>=frame.impacts.length);
const dropOnly=clone(defaults);dropOnly.emitters[0].layers.drops.enabled=false;
A.equal(Rain.sample(dropOnly,.3).emitters[0].layers.impacts.length,0);
const slow=clone(defaults);slow.fallSpeed=200;
A.notDeepEqual(Rain.sample(slow,.3).emitters[0].layers.drops.map(x=>x.y),
 frame.drops.map(x=>x.y));
const spread=clone(defaults);spread.spatialGap=27;
A.notDeepEqual(Rain.schedule(spread,spread.emitters[0]).positions,
 Rain.schedule(defaults,defaults.emitters[0]).positions);
const random=clone(defaults);random.spatialMode='clustered';
A.notDeepEqual(Rain.schedule(random,random.emitters[0]).positions,
 Rain.schedule(defaults,defaults.emitters[0]).positions);
const useSpacing=clone(defaults);useSpacing.spacingCurveEnabled=true;
A.notDeepEqual(Rain.schedule(useSpacing,useSpacing.emitters[0]).positions,
 Rain.schedule(defaults,defaults.emitters[0]).positions,
 'enable distinct 25px spacing curve must have visible spatial effect');
const jitter=clone(defaults);jitter.spatialJitter=.4;
A.notDeepEqual(Rain.schedule(jitter,jitter.emitters[0]).positions,
 Rain.schedule(defaults,defaults.emitters[0]).positions);
const thick=clone(defaults);thick.dropWidth=7;
A.ok(Rain.sample(thick,.3).emitters[0].layers.drops[0].width>
 frame.drops[0].width);
const long=clone(defaults);long.streakLength=60;
A.ok(Rain.sample(long,.3).emitters[0].layers.drops[0].length>
 frame.drops[0].length);
const density=clone(defaults);density.density=90;
A.ok(Rain.schedule(density,density.emitters[0]).events.length>
 Rain.schedule(defaults,defaults.emitters[0]).events.length);
const changeDensity=clone(defaults);changeDensity.densityCurve.keys[1].y=.1;
A.notDeepEqual(Rain.schedule(changeDensity,changeDensity.emitters[0]).events,
 Rain.schedule(defaults,defaults.emitters[0]).events);
const changeWind=clone(defaults);changeWind.windCurve.keys[1].y=.1;
A.notDeepEqual(Rain.sample(changeWind,.3).emitters[0].layers.drops,
 frame.drops);
const changeAlpha=clone(defaults);changeAlpha.dropAlphaCurve.keys[1].y=.1;
A.notDeepEqual(Rain.sample(changeAlpha,.3).emitters[0].layers.drops,
 frame.drops);
const shiftedGround=clone(defaults);shiftedGround.groundY=350;
A.notDeepEqual(Rain.sample(shiftedGround,.3).emitters[0].layers.impacts,
 frame.impacts);
const band=clone(defaults);band.groundBandHeight=54;
A.notDeepEqual(Rain.sample(band,.3).emitters[0].layers.impacts,
 frame.impacts,'Ground band height affects actual randomized crossing times/positions');
const altPalette=clone(defaults);altPalette.palette.stops[0].rgba=[200,25,255,1];
A.notDeepEqual(Rain.sample(altPalette,.3).emitters[0].layers.drops[0].rgba,
 frame.drops[0].rgba);
const near=clone(defaults);near.emitters[0].layers.near.enabled=true;
const far=clone(defaults);far.emitters[0].layers.far.enabled=true;
A.ok(Rain.sample(near,.3).emitters[0].layers.near.length>0);
A.ok(Rain.sample(far,.3).emitters[0].layers.far.length>0);
const two=clone(defaults);two.emitters.push(Rain.newEmitter(1));
A.equal(Rain.sample(two,.3).emitters.length,2);
A.deepEqual(Rain.sample(two,.3).emitters[0],Rain.sample(defaults,.3).emitters[0]);
two.emitters.reverse();
A.deepEqual(Rain.sample(two,.3).emitters.find(x=>x.id==='emitter1'),
 Rain.sample(defaults,.3).emitters[0]);
const bad=clone(defaults);bad.densityCurve.keys[1].y=NaN;
A.throws(()=>Rain.normalize(bad),/invalid|finite|curve/i);
A.throws(()=>Rain.normalize({...defaults,density:-1}),/density/i);
A.throws(()=>Rain.normalize({...defaults,extra:true}),/unknown/i);
A.throws(()=>Rain.normalize({...defaults,schemaVersion:2}),/version/i);
A.throws(()=>Rain.normalize({...defaults,emitters:[defaults.emitters[0],defaults.emitters[0]]}),/duplicate/i);
A.throws(()=>Rain.normalize({...defaults,emitters:[...defaults.emitters,...Array.from({length:4},(_,i)=>Rain.newEmitter(i+1))]}),/4|emitters/i);
const caps=clone(defaults);caps.density=250;caps.fallSpeed=20;caps.quality='low';
A.throws(()=>Rain.sample(caps,.2),/budget|overflow|limit/i,'never silently drop excess particles');
console.log('PASS WATER-02 deterministic seamless 60f rain numeric, 45/s mean, prior-cycle carry, true impact crossing, wind integration, layers, curves, strict caps and schema');
