'use strict';
const {test}=require('node:test'),A=require('node:assert/strict');
const P=require('../assets/poison-cloud/src/poison-core.js'),R=require('../assets/poison-cloud/src/poison-runtime.js');
const near=(a,b,e=.25)=>A.ok(Math.abs(a-b)<=e,a+' != '+b);
test('independent dense cubic arc oracle verifies all candidate distances',()=>{
 const c=P.defaults(),s=P.compile(c).schedules[0].spores,r=c.cloudRadius,h=r*.6,k=.5522847498307936;
 const segments=[[[r,0],[r,k*h],[k*r,h],[0,h]],[[0,h],[-k*r,h],[-r,k*h],[-r,0]],[[-r,0],[-r,-k*h],[-k*r,-h],[0,-h]],[[0,-h],[k*r,-h],[r,-k*h],[r,0]]];
 const points=[{x:r,y:0,d:0}];let d=0,prev=points[0];
 for(const v of segments)for(let i=1;i<=8192;i++){const t=i/8192,u=1-t,coeff=[u*u*u,3*u*u*t,3*u*t*t,t*t*t],x=v.reduce((a,p,j)=>a+coeff[j]*p[0],0),y=v.reduce((a,p,j)=>a+coeff[j]*p[1],0);d+=Math.hypot(x-prev.x,y-prev.y);prev={x,y,d};points.push(prev);}
 near(s.pathLength,d);
 for(const a of s.anchors){let best=null,dist=Infinity;for(const p of points){const delta=Math.hypot(a.x-p.x,a.y-p.y);if(delta<dist){best=p;dist=delta;}}near(dist,0);near(a.distance,best.d);}
});
test('30/60/120fps and backwards replay have identical common frames',()=>{
 for(const mode of ['loop','oneShot']){const c=P.defaults(mode);c.burstEnabled=true;c.emitters[0].layers.edge.enabled=true;const p=P.compile(c),baseline=Array.from({length:31},(_,i)=>p.sample(i/30));for(const fps of [60,120])for(let i=fps;i>=0;i--){const s=p.sample(i/fps);if(i%(fps/30)===0)A.deepEqual(s,baseline[i/(fps/30)]);} }
});
test('per-primitive fog alpha bound and premultiplied profile, no claim about aggregate alpha',()=>{
 const c=P.defaults();c.fogOpacity=.9;c.emitters[0].layers.edge.enabled=true;const p=P.compile(c),ramp=R.alphaRamp();
 for(let i=0;i<256;i++)A.deepEqual(Array.from(ramp.subarray(i*4,i*4+4)),[i,i,i,i]);
 for(let i=0;i<=75;i++){const s=p.sample(i/60);for(const v of s.emitters[0].layers.fog){A.ok(v.rgba[3]<=.9);const g=R.meshData(v);for(let j=128;j<160;j++)near(g.uvs[j*2],.5/256,1e-9);}}
});
