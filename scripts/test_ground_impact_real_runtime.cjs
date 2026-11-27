'use strict';
// Real pinned Pixi/Spine CPU objects; backend selection fixtures are not GPU tests.
async function run(read,A,test){
 const fx='assets/ground-impact/src/',shared='assets/template/src/',vendor='assets/template/vendor/';
 const doc={createElement:()=>({style:{},getContext:()=>null}),createElementNS:()=>({style:{}})},win={};
 const P=new Function('navigator','document','window','self',read(vendor+'pixi-8.22.0.min.js')+'\nreturn PIXI;')({userAgent:'Chromium',platform:'Linux'},doc,win,win);win.PIXI=P;
 const Sp=new Function('PIXI','window','self','require',read(vendor+'spine-pixi-v8-4.2.120.min.js')+'\nreturn spine;')(P,win,win,n=>{if(n==='pixi.js')return P;throw Error(n);});
 const mods={};for(const path of [...['curve','spacing','color'].map(n=>shared+n+'-core.js'),...['core','anchors','runtime'].map(n=>fx+'ground-impact-'+n+'.js')]){
  const m={exports:{}};new Function('module','require',read(path))(m,n=>{const k=n.split('/').at(-1);if(!Object.hasOwn(mods,k))throw Error(n);return mods[k];});mods[path.split('/').at(-1)]=m.exports;
 }
 const H=mods['ground-impact-core.js'],An=mods['ground-impact-anchors.js'],R=mods['ground-impact-runtime.js'],near=(a,b,e=1e-5)=>A.ok(Math.abs(a-b)<=e,a+' != '+b);
 function scene(rig=false){const camera=new P.Container(),world=new P.Container(),behindHost=new P.Container(),host=new P.Container();camera.addChild(world);world.addChild(behindHost);let model=null;
  if(rig){const data={skeleton:{spine:'4.2.43'},bones:[{name:'root',x:8,y:12},{name:'hip',parent:'root',x:20,y:3,rotation:25,scaleX:1.5,scaleY:.7}],slots:[{name:'impact',bone:'hip',attachment:'tip'}],skins:[{name:'default',attachments:{impact:{tip:{type:'point',x:12,y:5}}}}],animations:{idle:{}}};
   model=new Sp.Spine({skeletonData:new Sp.SkeletonJson({newPointAttachment:(skin,name)=>new Sp.PointAttachment(name)}).readSkeletonData(data),autoUpdate:false});world.addChild(model);model.skeleton.setSkinByName('default');model.skeleton.setToSetupPose();model.update(0);model.position.set(15,30);model.rotation=.4;model.scale.set(1.2);}
  world.addChild(host);return {camera,world,behindHost,host,model,Spine:Sp};}
 const create=(s,d=H.defaults(),PIXI=P)=>R.createRenderer({...s,PIXI,settings:d}),all=f=>[...f.owned.behind.children,...f.owned.front.children].flatMap(x=>x.children),nodes=(f,k)=>[...f.owned.behind.children,...f.owned.front.children].find(x=>x.label===k)?.children??[],visible=f=>all(f).filter(x=>x.visible);
 const anchor=(type,name='',slot='')=>({type,name,slot});
 await test('native anchor projection, point/region/deformed mesh and camera invariance',()=>{
  const s=scene(true);try{A.equal(P.VERSION,'8.22.0');const b=s.model.skeleton.findBone('hip'),p=An.resolve(anchor('bone','hip'),s),o=s.world.toLocal({x:b.worldX,y:b.worldY},s.model),u=s.world.toLocal({x:b.worldX+b.a,y:b.worldY+b.c},s.model);near(p.x,o.x);near(p.y,o.y);near(p.scale,Math.hypot(u.x-o.x,u.y-o.y));near(p.rotation,Math.atan2(u.y-o.y,u.x-o.x)*180/Math.PI);
   A.deepEqual(An.resolve(anchor('slot','impact'),s),p);const slot=s.model.skeleton.findSlot('impact'),tip=slot.getAttachment(),t=An.resolve(anchor('attachment','tip','impact'),s),q=s.world.toLocal(tip.computeWorldPosition(b,{x:0,y:0}),s.model);near(t.x,q.x);near(t.y,q.y);
   const region=new Sp.RegionAttachment('region','region');region.offset.set([0,0,0,8,12,8,12,0]);region.rotation=15;slot.setAttachment(region);const rv=new Float32Array(8);region.computeWorldVertices(slot,rv,0,2);const rp=An.resolve(anchor('attachment','region','impact'),s),ro=s.world.toLocal({x:(rv[0]+rv[2]+rv[4]+rv[6])/4,y:(rv[1]+rv[3]+rv[5]+rv[7])/4},s.model);near(rp.x,ro.x);near(rp.y,ro.y);
   const mesh=new Sp.MeshAttachment('weighted','weighted');mesh.worldVerticesLength=6;mesh.bones=[2,0,1,1,1,1,0];mesh.vertices=[0,0,.5,10,0,.5,30,0,1,0,20,1];slot.setAttachment(mesh);slot.deform=[1,2,3,4,5,6,7,8];const v=new Float32Array(6);mesh.computeWorldVertices(slot,0,6,v,0,2);const m=An.resolve(anchor('attachment','weighted','impact'),s),z=s.world.toLocal({x:(v[0]+v[2]+v[4])/3,y:(v[1]+v[3]+v[5])/3},s.model);near(m.x,z.x);near(m.y,z.y);A.equal(An.resolve(anchor('attachment','wrong','impact'),s),null);mesh.worldVerticesLength=65538;A.equal(An.resolve(anchor('attachment','weighted','impact'),s),null);slot.setAttachment(tip);
   s.camera.position.set(180,90);s.camera.rotation=.6;s.camera.scale.set(2.5);const after=An.resolve(anchor('bone','hip'),s);for(const k of ['x','y','rotation','scale'])near(after[k],p[k]);A.ok(An.resolve(anchor('local'),s));b.active=false;A.equal(An.resolve(anchor('slot','impact'),s),null);
  }finally{s.camera.destroy({children:true});}
 });
 await test('native mesh and masks, fixed pools, independent order/alpha and terminal blank',()=>{
  const s=scene(),d=H.defaults();d.layers.debris.blend='add';d.layers.dust.opacity=.5;const f=create(s,d);
  try{A.equal(f.allocated,55);A.equal(all(f).length,55);const objects=all(f),ring=nodes(f,'ring')[0],dust=nodes(f,'dust')[0],debris=nodes(f,'debris')[0];A.ok(ring instanceof P.Mesh&&debris instanceof P.Sprite&&dust instanceof P.Sprite);A.ok(ring.geometry.indices instanceof Uint16Array);
   A.deepEqual(f.owned.behind.children.map(x=>x.label),['ring']);A.deepEqual(f.owned.front.children.map(x=>x.label),['dust','debris']);A.equal(debris.blendMode,'add');
   for(const view of [ring,dust,debris]){const src=view.texture.source;A.equal(src.alphaMode,'premultiplied-alpha');const b=src.resource;for(let i=0;i<b.length;i+=4)A.ok(b[i]===b[i+1]&&b[i]===b[i+2]&&b[i]===b[i+3]);}
   A.ok(dust.texture.source.resource.some(v=>v>0&&v<200));A.notDeepEqual(Array.from(dust.texture.source.resource),Array.from(debris.texture.source.resource));
   const start=ring.geometry.positions;A.ok(start.every(Number.isFinite));near(start[6],4);const p=f.seek(.2),r=p.layers.ring[0],pos=ring.geometry.positions;near(pos[6],r.radiusX+r.width/2);near(pos[24*8+7],r.radiusY+r.width/2);A.deepEqual(Array.from(pos.slice(0,8)),Array.from(pos.slice(-8)));A.ok(ring.geometry.indices.every(x=>x<pos.length/2));near(ring.x,r.x);near(debris.alpha,p.layers.debris[0].rgba[3]);near(dust.alpha,p.layers.dust[0].rgba[3]);
   for(let i=0;i<80;i++){f.seek((i%40)/60);A.equal(f.allocated,55);A.ok(all(f).every((v,i)=>v===objects[i]));}
   f.seek(39/60);A.equal(visible(f).length,0);f.seek(.2);A.ok(visible(f).length>0);f.seek(0);A.equal(visible(f).length,52);
   const off=H.defaults();for(const l of Object.values(off.layers))l.enabled=false;f.configure(off);A.equal(f.allocated,0);A.equal(visible(f).length,0);A.ok(objects.every(v=>v.destroyed));
  }finally{f.destroy();s.camera.destroy({children:true});}
 });
 await test('contact projection applied once, missing bone and model replacement recovery',()=>{
  const s=scene(true),d=H.defaults();d.contact.anchor=anchor('bone','hip');d.contact.x=4;d.contact.y=7;d.contact.rotation=12;const f=create(s,d);
  try{const p=f.seek(.2),a=An.resolve(d.contact.anchor,s),rad=a.rotation*Math.PI/180;near(p.layers.ring[0].x,a.x+a.scale*(4*Math.cos(rad)-7*Math.sin(rad)));near(p.layers.ring[0].y,a.y+a.scale*(4*Math.sin(rad)+7*Math.cos(rad)));near(p.layers.ring[0].rotation,(a.rotation+12)*Math.PI/180);near(p.layers.ring[0].radiusX,90*a.scale);
   s.camera.scale.set(2);s.camera.position.set(50,30);s.camera.rotation=.5;const q=f.seek(.2);near(q.layers.ring[0].x,p.layers.ring[0].x);near(q.layers.ring[0].y,p.layers.ring[0].y);
   f.setModel(null);A.deepEqual(f.missing,['ring','debris']);A.deepEqual(f.sample.layers.dust,p.layers.dust);A.ok(nodes(f,'debris').every(v=>!v.visible));f.setModel(s.model);A.equal(f.missing.length,0);A.ok(nodes(f,'ring')[0].visible);
   const x=H.defaults();x.layers.dust.anchor=anchor('attachment','tip','impact');x.layers.dust.x=0;x.layers.dust.y=0;f.configure(x);A.ok(f.sample.layers.dust.length>0);s.model.skeleton.findSlot('impact').setAttachment(null);f.seek(.2);A.deepEqual(f.missing,['dust']);A.equal(f.sample.layers.dust.length,0);A.ok(f.sample.layers.debris.length>0);
  }finally{f.destroy();s.camera.destroy({children:true});}
 });
 await test('transactional configure, paint failure recovery, foreign ownership and cleanup',()=>{
  const s=scene(),foreign=new P.Container();s.host.addChild(foreign);const f=create(s);
  try{f.seek(.2);const old=f.owned,objects=all(f),tex=[...new Set(objects.map(v=>v.texture))],sources=tex.map(t=>t.source),geo=nodes(f,'ring')[0].geometry,settings=f.settings;
   const invalid=H.defaults();invalid.gravity=9999;A.throws(()=>f.configure(invalid));A.equal(f.owned.front,old.front);A.equal(f.settings,settings);
   const add=s.host.addChild;let staged; s.host.addChild=function(v){staged=v;throw Error('injected attach');};try{A.throws(()=>f.configure(H.defaults()),/injected attach/);}finally{s.host.addChild=add;}
   A.ok(staged.destroyed);A.equal(f.owned.front,old.front);A.equal(f.settings,settings);A.deepEqual(s.behindHost.children,[old.behind]);
   const buf=geo.getBuffer('aPosition'),update=buf.update;buf.update=()=>{throw Error('injected paint');};try{A.throws(()=>f.seek(.3),/injected paint/);A.ok(!old.behind.visible&&!old.front.visible);}finally{buf.update=update;}f.seek(.3);A.ok(old.behind.visible&&old.front.visible);
   let once=true;buf.update=function(...args){if(once){once=false;throw Error('model paint');}return update.apply(this,args);};try{A.throws(()=>f.setModel(null),/model paint/);A.ok(!f.broken&&old.behind.visible);}finally{buf.update=update;}
   s.host.position.set(1,0);A.throws(()=>f.seek(.2),/logical world plane/);s.host.position.set(0,0);
   f.configure(H.defaults());A.ok(objects.every(v=>v.destroyed));A.ok(tex.every(v=>v.destroyed));A.ok(sources.every(v=>v.destroyed));A.ok(old.front.destroyed&&old.behind.destroyed);
   f.destroy();f.destroy();A.deepEqual(s.host.children,[foreign]);A.ok(!foreign.destroyed);A.throws(()=>f.seek(0),/destroyed/);
  }finally{f.destroy();s.camera.destroy({children:true});}
 });
 await test('construction failure frees staged native resources',()=>{
  const s=scene(),owned=[];class Sprite extends P.Sprite{constructor(t){if(owned.length===2)throw Error('injected allocation');super(t);owned.push(this);}}
  try{A.throws(()=>create(s,H.defaults(),{...P,Sprite}),/injected allocation/);A.equal(owned.length,2);A.ok(owned.every(x=>x.destroyed));A.equal(s.host.children.length,0);A.equal(s.behindHost.children.length,0);}finally{s.camera.destroy({children:true});}
 });
 await test('backend labels strict or explicit fallback (fixture)',async()=>{
  const apps=[];class GL2{}class App{constructor(){apps.push(this);}async init(o){this.renderer=o.preference==='webgpu'?{gl:new GL2()}:{gl:o.preferWebGLVersion===2?new GL2():{}};}destroy(){this.dead=true;}}
  const opts={PIXI:{Application:App},backend:'webgpu',GL2};const f=await R.initApplication(opts);A.equal(f.actual,'webgl2');A.equal(f.fallback,true);A.ok(apps[0].dead);await A.rejects(()=>R.initApplication({...opts,allowFallback:false}),/requested webgpu/);A.ok(apps.at(-1).dead);A.equal((await R.initApplication({...opts,backend:'webgl1'})).actual,'webgl1');A.equal(R.actualBackend({gpu:{device:{}}},GL2),'webgpu');
 });
}
module.exports={run};
if(require.main===module){const fs=require('node:fs'),path=require('node:path'),root=path.resolve(__dirname,'..');const cases=[];run(p=>fs.readFileSync(path.join(root,p),'utf8'),require('node:assert/strict'),(name,fn)=>{cases.push([name,fn]);}).then(()=>{for(const [name,fn] of cases)require('node:test').test(name,fn);}).catch(e=>{console.error(e);process.exitCode=1;});}
