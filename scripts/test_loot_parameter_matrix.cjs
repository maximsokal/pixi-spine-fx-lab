'use strict';
// T05 numeric parameter evidence. Compare actual geometry/appearance, not settings echoes.
const {test}=require('node:test'),A=require('node:assert/strict'),L=require('../assets/loot-sparkle/src/loot-core.js');
const clone=x=>JSON.parse(JSON.stringify(x)),flat=(c,v)=>{c.defaultValue=v;for(const k of c.keys)k.y=v};
const layers=c=>{c.emitters[0].layers.halo.enabled=true;c.emitters[0].layers.sweep.enabled=true};
const load=c=>{c.spawnIntervalFrames=1;c.sparkleCount=12;};
const rate=c=>{c.frequencySource='rate'};
const group=c=>{c.groupCount=2;c.spawnIntervalFrames=8};
const samples=p=>Array.from({length:40},(_,i)=>p.sample((i+.25)/60,{hand:{x:140,y:160,rotation:30,scale:1.5},$local:{x:20,y:30,rotation:12,scale:1}}).emitters.map(e=>e.layers));
const cases=[
 ['mode',c=>c.mode='idle'],
 ['durationFrames',c=>c.durationFrames=54],
 ['sparkleCount',c=>c.sparkleCount=2,load],
 ['sparkleSize',c=>c.sparkleSize=15],
 ['spawnIntervalFrames',c=>c.spawnIntervalFrames=3],
 ['lifetimeFrames',c=>c.lifetimeFrames=10],
 ['haloRadius',c=>c.haloRadius=65,layers],
 ['twinkleHz',c=>c.twinkleHz=7],
 ['spreadRadius',c=>c.spreadRadius=80],
 ['baseGapPx',c=>c.baseGapPx=27],
 ['minGapPx',c=>c.minGapPx=20,c=>c.baseGapPx=9],
 ['maxGapPx',c=>c.maxGapPx=12,c=>c.baseGapPx=35],
 ['spatialJitter',c=>c.spatialJitter=.4,c=>c.distribution='random'],
 ['distribution',c=>c.distribution='stratified'],
 ['timeJitter',c=>c.timeJitter=.4],
 ['minIntervalFrames',c=>c.minIntervalFrames=10],
 ['frequencySource',c=>c.frequencySource='rate',c=>flat(c.rateCurve,2)],
 ['groupCount',c=>c.groupCount=3],
 ['groupDelayFrames',c=>c.groupDelayFrames=2,group],
 ['shineDelayFrames',c=>c.shineDelayFrames=7,layers],
 ['seed',c=>c.seed++],
 ['sizeCurve',c=>flat(c.sizeCurve,.5)],
 ['alphaCurve',c=>flat(c.alphaCurve,.25)],
 ['haloCurve',c=>flat(c.haloCurve,.3),layers],
 ['rateCurve',c=>flat(c.rateCurve,2),rate],
 ['intervalCurve',c=>flat(c.intervalCurve,2)],
 ['spacingCurve',c=>flat(c.spacingCurve,35)],
 ['palette',c=>c.palette.stops.forEach(s=>s.rgba=[10,80,220,1])]
];
for(const [key,change,setup=()=>{}] of cases)test('parameter '+key,()=>{
 const a=L.defaults();setup(a);const b=clone(a);change(b);
 A.notDeepEqual(samples(L.compile(a)),samples(L.compile(b)),'inert '+key);
});
test('quality is a rejection budget, not an appearance modifier',()=>{
 const c=L.defaults();c.mode='idle';c.durationFrames=60;c.lifetimeFrames=30;c.spawnIntervalFrames=1;c.sparkleCount=40;c.spreadRadius=150;c.baseGapPx=3;c.minGapPx=3;
 c.emitters.push(L.newEmitter(1),L.newEmitter(2),L.newEmitter(3));
 const p=L.compile(c);A.ok(p.reservedStars>40);
 c.quality='low';A.throws(()=>L.compile(c),/budget/);c.quality='high';A.deepEqual(samples(L.compile(c)),samples(p));
});
test('every top-level setting covered or explicitly structural',()=>{
 A.deepEqual(Object.keys(L.defaults()).sort(),[...cases.map(c=>c[0]),'schemaVersion','quality','emitters'].sort());
});
for(const scope of ['emitter','stars','halo','sweep']){
 const get=c=>scope==='emitter'?c.emitters[0]:c.emitters[0].layers[scope];
 for(const [key,mutate] of [['enabled',x=>x.enabled=false],['visible',x=>x.visible=false],['x',x=>x.x+=20],['y',x=>x.y+=20],['rotation',x=>x.rotation=35],['scale',x=>x.scale=1.5],['timeOffset',x=>x.timeOffset=4],['seed',x=>x.seed++],['anchor',x=>x.anchor={type:'bone',name:'hand'}],...(scope==='emitter'?[]:[['alpha',x=>x.alpha=.4],['blend',x=>x.blend='add']])]){
  // A circular halo is rotation symmetric. Verify the descriptor rotation separately,
  // never claim that rotating a centered circular halo changes its rendered pixels.
  test(scope+'.'+key,()=>{const a=L.defaults();layers(a);const b=clone(a);mutate(get(b));const x=samples(L.compile(a)),y=samples(L.compile(b));A.notDeepEqual(x,y,scope+'.'+key);});
 }
}
