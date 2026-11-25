'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const G=require('../assets/muzzle-flash/src/muzzle-geometry.js');
const approx=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);
const base={x:100,y:200,rotation:0,length:65,width:20,coneAngle:35,alpha:1};
test('core is anchored and tapers to its tip',()=>{
 const p=G.ribbon(base,[.9,1,0]);
 assert.equal(p.length,6);approx(p[0].x,100);approx(p[0].y,209);
 approx(p[4].x,165);assert.deepEqual(p[4],p[5]);
});
test('attachment angle rotates complete geometry',()=>{
 const a=G.ribbon(base,[1,1,0]),b=G.ribbon({...base,rotation:90},[1,1,0]);
 a.forEach((p,i)=>{approx(b[i].x,100-(p.y-200));approx(b[i].y,200+(p.x-100));});
});
test('explicit arc distances give independent tongue tip gaps',()=>{
 const a=G.tongues(base,[0,7,14],7);assert.equal(a.length,3);
 approx(a[1].angle-a[0].angle,7/65);approx(a[2].angle-a[1].angle,7/65);
 assert.deepEqual(a,G.tongues(base,[0,7,14],7));
 assert.notDeepEqual(a,G.tongues(base,[0,7,14],8));
});
test('spark birth and death are absolute, with independent seeds',()=>{
 const events=[{time:0,index:0},{time:2/60,index:1}];
 const cfg={...base,life:4/60,speed:120,seed:42};
 const a=G.sparks(cfg,events,0,0.5);assert.equal(a.length,1);approx(a[0].x,100);approx(a[0].y,200);
 const b=G.sparks(cfg,events,3/60,.5);assert.equal(b.length,2);
 assert.deepEqual(b,G.sparks(cfg,events,3/60,.5));
 assert.deepEqual(b[1],G.sparks(cfg,events.slice(1),3/60,.5)[0]);
 assert.equal(G.sparks(cfg,events,6/60,.5).length,0);
});
test('zero alpha gives no primitives',()=>{
 const cfg={...base,alpha:0,life:1,speed:120,seed:1};
 assert.deepEqual(G.ribbon(cfg,[1,0]),[]);assert.deepEqual(G.tongues(cfg,[0],1),[]);
 assert.deepEqual(G.sparks(cfg,[{time:0,index:0}],0,1),[]);
});
test('reject nonfinite, malformed and over-budget input',()=>{
 assert.throws(()=>G.ribbon({...base,rotation:NaN},[1,0]));
 assert.throws(()=>G.ribbon(base,[1,,0]));
 assert.throws(()=>G.tongues(base,[0,100],1));
 assert.throws(()=>G.tongues(base,Array.from({length:21},(_,i)=>i),1));
 assert.throws(()=>G.sparks({...base,life:1,speed:100,seed:0},[{time:0,index:0},{time:0,index:0}],0,1));
});
test('tip arc endpoints tolerate only floating point roundoff',()=>{
 for(const length of [8,9,10,30,65,100,260])for(let coneAngle=5;coneAngle<=150;coneAngle++){
  const c={...base,length,coneAngle},span=length*coneAngle*(Math.PI/180),half=coneAngle*Math.PI/360;
  const tips=G.tongues(c,[0,span],1);
  approx(tips[0].angle,-half);approx(tips[1].angle,half);
  assert.throws(()=>G.tongues(c,[0,span+1e-8],1));
 }
});
