'use strict';
// Real pinned CPU anchor/primitive witnesses; not a browser or GPU test.
function run(read,A,test){
 const fx='assets/ground-impact/src/',shared='assets/template/src/',vendor='assets/template/vendor/';
 const mods={};for(const path of [...['curve','spacing','color'].map(n=>shared+n+'-core.js'),...['core','anchors','authoring'].map(n=>fx+'ground-impact-'+n+'.js')]){
  const m={exports:{}};new Function('module','require',read(path))(m,n=>{const k=n.split('/').at(-1);if(!Object.hasOwn(mods,k))throw Error(n);return mods[k];});mods[path.split('/').at(-1)]=m.exports;
 }
 const H=mods['ground-impact-core.js'],An=mods['ground-impact-anchors.js'],U=mods['ground-impact-authoring.js'];
 const doc={createElement:()=>({style:{},getContext:()=>null}),createElementNS:()=>({style:{}})},win={};
 const P=new Function('navigator','document','window','self',read(vendor+'pixi-8.22.0.min.js')+'\nreturn PIXI;')({userAgent:'Chromium',platform:'Linux'},doc,win,win);win.PIXI=P;
 const Sp=new Function('PIXI','window','self','require',read(vendor+'spine-pixi-v8-4.2.120.min.js')+'\nreturn spine;')(P,win,win,n=>{if(n==='pixi.js')return P;throw Error(n);});
 const near=(a,b,e=1e-7)=>A.ok(Math.abs(a-b)<=e,a+' != '+b),anchor=(type,name='',slot='')=>({type,name,slot});
 function scene(){const camera=new P.Container(),world=new P.Container();camera.addChild(world);const model=new Sp.Spine({skeletonData:new Sp.SkeletonJson({newPointAttachment:(skin,name)=>new Sp.PointAttachment(name)}).readSkeletonData({skeleton:{spine:'4.2.43'},bones:[{name:'root',x:8,y:12},{name:'hip',parent:'root',x:20,y:3,rotation:25,scaleX:1.5,scaleY:.7}],slots:[{name:'impact',bone:'hip',attachment:'tip'}],skins:[{name:'default',attachments:{impact:{tip:{type:'point',x:12,y:5}}}}],animations:{idle:{}}}),autoUpdate:false});world.addChild(model);model.skeleton.setSkinByName('default');model.skeleton.setToSetupPose();model.update(0);model.position.set(15,30);model.rotation=.4;model.scale.set(1.2);return {camera,world,model,Spine:Sp};}
 const sample=(c,s)=>H.compile(c).sample(.2,An.resolvePoses(c,s).poses);
 test('fixed one-shot transport, exact frame boundaries and reverse',()=>{
  A.equal(U.seek(-10),0);A.equal(U.seek(1),39/60);A.equal(U.advance(.6,.1),39/60);A.equal(U.advance(.05,.2,-1),0);A.equal(U.advance(.25,.125,-1),.125);
  for(let i=0;i<40;i++){A.equal(U.frame(i/60),i);if(i>0)A.equal(U.frame(i/60-1e-12),i-1);if(i<39)A.equal(U.frame(i/60+1e-12),i);}
  for(const t of [NaN,Infinity,-Infinity,'0'])A.throws(()=>U.seek(t));
  for(const dt of [-1,NaN,Infinity])A.throws(()=>U.advance(0,dt));A.throws(()=>U.advance(0,1,0));
 });
 test('logical viewport inverse at 50/100/200%, translated and rectangular',()=>{
  for(const z of [.5,1,2])for(const [x,y] of [[0,0],[256,320],[512,512],[-10,530]]){const rect={left:41,top:-32,width:512*z,height:512*z};const p=U.pointer(rect.left+x*z,rect.top+y*z,rect);near(p.x,x);near(p.y,y);}
  A.deepEqual(U.pointer(110,220,{left:10,top:20,width:200,height:400}),{x:256,y:256});
  for(const rect of [null,{left:0,top:0,width:0,height:512},{left:0,top:0,width:512,height:-1},{left:NaN,top:0,width:512,height:512}])A.throws(()=>U.pointer(1,2,rect));
  A.throws(()=>U.pointer(Infinity,2,{left:0,top:0,width:512,height:512}));
 });
 test('compose inverse matches degree rotation and positive uniform scale',()=>{
  const b={x:100,y:200,rotation:90,scale:2},v={x:4,y:7,rotation:12},p=U.compose(b,v);near(p.x,86);near(p.y,208);near(p.rotation,102);near(p.scale,2);const q=U.inverse(b,p.x,p.y);near(q.x,4);near(q.y,7);
  for(const base of [null,{...b,scale:0},{...b,scale:-1},{...b,rotation:NaN}]){A.throws(()=>U.compose(base,v));A.throws(()=>U.inverse(base,1,2));}
  A.throws(()=>U.inverse(b,1e8,0));A.throws(()=>U.inverse(b,NaN,0));
 });
 test('default markers, immutable contact move, sibling and sampled primitive isolation',()=>{
  const s=scene();try{const c=H.defaults(),before=JSON.stringify(c),p=U.positions(c,s);for(const k of ['contact','ring','debris','dust']){near(p[k].x,256);near(p[k].y,320);}
   const n=U.move(c,'contact',280,335,s),q=U.positions(n,s),a=sample(c,s),b=sample(n,s);A.equal(JSON.stringify(c),before);A.ok(Object.isFrozen(n)&&Object.isFrozen(n.layers));A.deepEqual(n,H.normalize(JSON.parse(JSON.stringify(n))));A.deepEqual(n.layers,H.normalize(c).layers);A.deepEqual(n.curves,H.normalize(c).curves);A.deepEqual(n.palettes,H.normalize(c).palettes);
   for(const k of ['contact','ring','debris']){near(q[k].x,280);near(q[k].y,335);}
   for(const k of ['ring','debris'])for(let i=0;i<a.layers[k].length;i++){near(b.layers[k][i].x-a.layers[k][i].x,24);near(b.layers[k][i].y-a.layers[k][i].y,15);}
   A.deepEqual(a.layers.dust,b.layers.dust);A.deepEqual(q.dust,p.dust);
   for(const k of H.LAYERS){const v=U.move(n,k,q[k].x+10,q[k].y-5,s),z=sample(v,s);for(const other of H.LAYERS.filter(x=>x!==k))A.deepEqual(z.layers[other],b.layers[other]);for(let i=0;i<z.layers[k].length;i++){near(z.layers[k][i].x-b.layers[k][i].x,10);near(z.layers[k][i].y-b.layers[k][i].y,-5);}A.deepEqual(v.contact,n.contact);}
  }finally{s.camera.destroy({children:true});}
 });
 test('real Spine bone/slot/point/local marker positions and camera cancellation',()=>{
  const s=scene();try{A.equal(P.VERSION,'8.22.0');for(const a of [anchor('world'),anchor('local'),anchor('bone','hip'),anchor('slot','impact'),anchor('attachment','tip','impact')]){
   const c=H.defaults();c.contact.anchor=a;c.contact.x=4;c.contact.y=7;c.contact.rotation=31;c.layers.ring.x=12;c.layers.ring.y=8;c.layers.dust.anchor=a;c.layers.dust.x=4;c.layers.dust.y=7;
   const base=An.resolve(a,s),p=U.positions(c,s),r=sample(c,s).layers.ring[0];near(p.contact.x,base.x+base.scale*(4*Math.cos(base.rotation*Math.PI/180)-7*Math.sin(base.rotation*Math.PI/180)));near(p.ring.x,r.x);near(p.ring.y,r.y);near(p.dust.x,p.contact.x);near(p.dust.y,p.contact.y);
   const n=U.move(c,'ring',p.ring.x+20,p.ring.y-10,s),q=U.positions(n,s);near(q.ring.x,p.ring.x+20);near(q.ring.y,p.ring.y-10);A.deepEqual(q.contact,p.contact);A.deepEqual(q.dust,p.dust);
   const independent=U.move(c,'dust',p.dust.x-10,p.dust.y+20,s);const ip=U.positions(independent,s);near(ip.dust.x,p.dust.x-10);near(ip.dust.y,p.dust.y+20);A.deepEqual(ip.ring,p.ring);
   s.camera.position.set(180,90);s.camera.rotation=.6;s.camera.scale.set(2.5);const cam=U.positions(c,s);for(const k of Object.keys(cam))for(const f of ['x','y','rotation','scale'])near(cam[k][f],p[k][f]);s.camera.position.set(0);s.camera.rotation=0;s.camera.scale.set(1);
  }}finally{s.camera.destroy({children:true});}
 });
 test('missing anchor never teleports, disabled and terminal markers retained',()=>{
  const s=scene();try{const c=H.defaults();c.contact.anchor=anchor('bone','missing');c.layers.ring.visible=false;const p=U.positions(c,s);A.equal(p.contact,null);A.equal(p.ring,null);A.equal(p.debris,null);near(p.dust.x,256);A.throws(()=>U.move(c,'ring',100,100,s));A.throws(()=>U.move(c,'contact',100,100,s));A.throws(()=>U.move(c,'unknown',100,100,s));A.throws(()=>U.move(c,'dust',10001,0,s));const d=U.move(c,'dust',100,100,s);near(d.layers.dust.x,100);near(d.layers.dust.y,100);A.equal(H.compile(d).sample(39/60).primitives,0);near(U.positions(d,s).dust.x,100);
   const off=H.defaults();off.layers.ring.enabled=false;near(U.positions(off,s).ring.x,256);const over=H.defaults();over.quality='low';over.debrisCount=160;A.throws(()=>U.move(over,'dust',100,100,s),/budget/);
  }finally{s.camera.destroy({children:true});}
 });
}
module.exports={run};
if(require.main===module){const fs=require('node:fs'),path=require('node:path');run(p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8'),require('node:assert/strict'),require('node:test').test);}
