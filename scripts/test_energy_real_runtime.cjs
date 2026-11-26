'use strict';
// Executes real pinned CPU runtime objects, not a GPU renderer.
function run(read,A,test){
 const fx='assets/energy-projectile/src/',shared='assets/template/src/',vendor='assets/template/vendor/';
 const doc={createElement:()=>({style:{},getContext:()=>null}),createElementNS:()=>({style:{}})},win={};
 const P=new Function('navigator','document','window','self',read(vendor+'pixi-8.22.0.min.js')+'\nreturn PIXI;')({userAgent:'Chromium',platform:'Linux'},doc,win,win);win.PIXI=P;
 const Sp=new Function('PIXI','window','self','require',read(vendor+'spine-pixi-v8-4.2.120.min.js')+'\nreturn spine;')(P,win,win,n=>{if(n==='pixi.js')return P;throw Error(n);});
 const mods={};for(const path of [...['curve','spacing','path','color'].map(n=>shared+n+'-core.js'),...['core','anchors','runtime'].map(n=>fx+'energy-'+n+'.js')]){
  const m={exports:{}};new Function('module','require',read(path))(m,n=>{const k=n.split('/').at(-1);if(!Object.hasOwn(mods,k))throw Error(n);return mods[k];});mods[path.split('/').at(-1)]=m.exports;
 }
 const H=mods['energy-core.js'],An=mods['energy-anchors.js'],R=mods['energy-runtime.js'];
 const near=(a,b,e=1e-5)=>A.ok(Math.abs(a-b)<=e,a+' != '+b),at=(type,name='',slot='',space='local',x=0,y=0,rotation=0)=>({type,name,slot,space,x,y,rotation});
 function scene(rig=false){const camera=new P.Container(),world=new P.Container(),behindHost=new P.Container(),host=new P.Container();camera.addChild(world);world.addChild(behindHost);
  let model=null;if(rig){const data={skeleton:{spine:'4.2.43'},bones:[{name:'root',x:8,y:12},{name:'weapon',parent:'root',x:20,y:3,rotation:25,scaleX:1.5,scaleY:.7}],slots:[{name:'impact',bone:'weapon',attachment:'tip'}],skins:[{name:'default',attachments:{impact:{tip:{type:'point',x:12,y:5}}}}],animations:{idle:{}}};
   model=new Sp.Spine({skeletonData:new Sp.SkeletonJson({newPointAttachment:(skin,name)=>new Sp.PointAttachment(name)}).readSkeletonData(data),autoUpdate:false});world.addChild(model);model.skeleton.setSkinByName('default');model.skeleton.setToSetupPose();model.update(0);model.position.set(15,30);model.rotation=.4;model.scale.set(1.2,1.2);}
  world.addChild(host);return {camera,world,behindHost,host,model,Spine:Sp};}
 const create=(s,d=H.defaults())=>R.createRenderer({...s,PIXI:P,settings:d});
 const views=g=>g.children.flatMap(v=>v.children.flatMap(v=>v.children));
 const all=f=>[...views(f.owned.behind),...views(f.owned.front)];
 const nodes=(f,k,order,id='emitter-1')=>f.owned[order].children.find(x=>x.label===k).children.find(x=>x.label===id+':'+k)?.children??[];
 const visible=f=>all(f).filter(v=>v.visible);
 test('pinned native MeshGeometry, premultiplied ramp, fixed arrays and radial masks',()=>{
  const s=scene(),d=H.defaults();for(const p of d.palettes.ribbon.stops)p.rgba=[100,50,25,.5];const f=create(s,d);
  try{A.equal(P.VERSION,'8.22.0');const q=f.seek(.3),p=q.ribbon.find(x=>x.kind==='ribbon'),mesh=nodes(f,'ribbon','behind').find(x=>x instanceof P.Mesh),n=p.sections.length,source=mesh.texture.source;
   A.ok(mesh.geometry instanceof P.MeshGeometry);A.equal(source.alphaMode,'premultiplied-alpha');A.deepEqual([...mesh.geometry.positions.slice(0,n*4)],[...Float32Array.from(p.positions)]);
   A.deepEqual([...mesh.geometry.indices.slice(0,(n-1)*6)],p.indices);A.ok(mesh.geometry.indices.slice((n-1)*6).every(x=>x===0));
   for(const i of [0,Math.floor(n/2),n-1]){const [r,g,b,a]=p.sections[i].rgba;A.deepEqual([...source.resource.slice(i*4,i*4+4)],[Math.round(r*a),Math.round(g*a),Math.round(b*a),Math.round(255*a)]);near(mesh.geometry.uvs[i*4],(i+.5)/source.width);}
   const core=nodes(f,'core','front'),glow=core[0],disc=core[1];A.ok(glow instanceof P.Sprite&&disc instanceof P.Sprite);A.equal(glow.texture.source.alphaMode,'premultiplied-alpha');const data=glow.texture.source.resource;A.equal(data[3],0);A.ok(data[(32*64+32)*4+3]>200);A.ok(data[(32*64+16)*4+3]<data[(32*64+32)*4+3]);A.ok(data.every((v,i)=>i%4===3||v===data[i-i%4+3]));
   const arrays=[mesh.geometry.positions,mesh.geometry.uvs,mesh.geometry.indices,source.resource],objects=all(f),count=f.allocated;for(let i=0;i<80;i++)f.seek(i%40/60);A.equal(f.allocated,count);A.deepEqual(all(f),objects);A.equal(mesh.geometry.positions,arrays[0]);A.equal(mesh.geometry.uvs,arrays[1]);A.equal(mesh.geometry.indices,arrays[2]);A.equal(source.resource,arrays[3]);f.seek(39/60);A.equal(visible(f).length,0);
  }finally{f.destroy();s.camera.destroy({children:true});}
 });
 test('actual Spine bone/slot/local and world offsets, camera cancellation, positive projected scale',()=>{
  const s=scene(true);try{const b=s.model.skeleton.findBone('weapon'),base=An.resolve(at('bone','weapon'),s);A.ok(base);const p=s.world.toLocal({x:b.worldX,y:b.worldY},s.model),x=s.world.toLocal({x:b.worldX+b.a,y:b.worldY+b.c},s.model);
   near(base.x,p.x);near(base.y,p.y);near(base.scale,Math.hypot(x.x-p.x,x.y-p.y));near(base.rotation,Math.atan2(x.y-p.y,x.x-p.x)*180/Math.PI);
   const local=An.resolve(at('bone','weapon','','local',4,7,15),s),oracle=s.world.toLocal({x:b.worldX+b.a*4+b.b*7,y:b.worldY+b.c*4+b.d*7},s.model);near(local.x,oracle.x);near(local.y,oracle.y);near(local.rotation,base.rotation+15);
   const w=An.resolve(at('bone','weapon','','world',4,7),s);near(w.x,base.x+4);near(w.y,base.y+7);near(w.scale,base.scale);
   A.deepEqual(An.resolve(at('slot','impact'),s),base);const tip=An.resolve(at('attachment','tip','impact'),s),v=s.model.skeleton.findSlot('impact').getAttachment().computeWorldPosition(b,{x:0,y:0}),q=s.world.toLocal(v,s.model);near(tip.x,q.x);near(tip.y,q.y);
   s.camera.position.set(180,90);s.camera.rotation=.6;s.camera.scale.set(2.5);const after=An.resolve(at('bone','weapon'),s);near(after.x,base.x);near(after.y,base.y);near(after.rotation,base.rotation);near(after.scale,base.scale);
   A.equal(An.resolve(at('bone','missing'),s),null);b.active=false;A.equal(An.resolve(at('slot','impact'),s),null);
  }finally{s.camera.destroy({children:true});}
 });
 test('native region and weighted deform mesh use all actual vertices, not bounding-box center',()=>{
  const s=scene(true);try{const slot=s.model.skeleton.findSlot('impact'),b=slot.bone;
   const region=new Sp.RegionAttachment('region','region');region.offset.set([0,0,0,8,12,8,12,0]);region.rotation=15;slot.setAttachment(region);
   const rp=An.resolve(at('attachment','region','impact'),s),v=new Float32Array(8);region.computeWorldVertices(slot,v,0,2);const q=s.world.toLocal({x:(v[0]+v[2]+v[4]+v[6])/4,y:(v[1]+v[3]+v[5]+v[7])/4},s.model);near(rp.x,q.x);near(rp.y,q.y);
   const mesh=new Sp.MeshAttachment('weighted','weighted');mesh.worldVerticesLength=6;mesh.bones=[2,0,1,1,1,1,0];mesh.vertices=[0,0,.5,10,0,.5,30,0,1,0,20,1];slot.setAttachment(mesh);slot.deform=[1,2,3,4,5,6,7,8];
   const vv=new Float32Array(6);mesh.computeWorldVertices(slot,0,6,vv,0,2);const expected=s.world.toLocal({x:(vv[0]+vv[2]+vv[4])/3,y:(vv[1]+vv[3]+vv[5])/3},s.model),mp=An.resolve(at('attachment','weighted','impact'),s);near(mp.x,expected.x);near(mp.y,expected.y);
   const bbox=s.world.toLocal({x:(Math.min(vv[0],vv[2],vv[4])+Math.max(vv[0],vv[2],vv[4]))/2,y:(Math.min(vv[1],vv[3],vv[5])+Math.max(vv[1],vv[3],vv[5]))/2},s.model);A.ok(Math.hypot(mp.x-bbox.x,mp.y-bbox.y)>1);
   A.equal(An.resolve(at('attachment','wrong','impact'),s),null);mesh.worldVerticesLength=65538;A.equal(An.resolve(at('attachment','weighted','impact'),s),null);slot.setAttachment(null);A.equal(An.resolve(at('attachment','weighted','impact'),s),null);b.active=false;A.equal(An.resolve(at('slot','impact'),s),null);
  }finally{s.model.skeleton.findSlot('impact').setAttachment(null);s.camera.destroy({children:true});}
 });
 test('independent anchors, inherited offsets and front/behind ordering; no ghosts',()=>{
  const s=scene(true),d=H.defaults(),e=d.emitters[0];e.anchor=at('attachment','tip','impact');e.layers.core.anchor.x=7;e.layers.orbit.anchor=at('world','','','world',200,300);e.layers.ribbon.order='front';const f=create(s,d);
  try{const q=f.seek(.3),p=An.resolve(e.anchor,s);near(q.emitters[0].layers.core.origin.x,p.x+Math.cos(p.rotation*Math.PI/180)*7*p.scale);A.deepEqual(q.emitters[0].layers.orbit.origin,{x:200,y:300});A.ok(nodes(f,'ribbon','front').some(v=>v.visible));A.equal(nodes(f,'ribbon','behind').length,0);
   A.equal(s.world.children[0],s.behindHost);A.equal(s.world.children[1],s.model);A.equal(s.world.children[2],s.host);s.model.skeleton.findSlot('impact').setAttachment(null);const missing=f.seek(.3);A.deepEqual(f.missing,['emitter-1:core','emitter-1:ribbon']);A.equal(missing.core.length,0);A.equal(missing.ribbon.length,0);A.ok(missing.orbit.length);A.ok(nodes(f,'core','front').every(v=>!v.visible));A.ok(nodes(f,'ribbon','front').every(v=>!v.visible));
   f.setModel(null);A.ok(f.sample.orbit.length);const off=H.defaults();for(const l of Object.values(off.emitters[0].layers))l.enabled=false;f.configure(off);A.equal(f.allocated,0);A.equal(visible(f).length,0);
  }finally{f.destroy();s.camera.destroy({children:true});}
 });
 test('four emitters, staged reconfigure, resource ownership and no per-seek allocation',()=>{
  const s=scene(),d=H.defaults();d.quality='high';for(let i=2;i<=4;i++)d.emitters.push(H.newEmitter('e'+i,i));const f=create(s,d),foreign=new P.Container();s.host.addChild(foreign);
  try{f.seek(.3);const old=f.owned,objects=all(f),textures=[...new Set(objects.map(v=>v.texture))],sources=textures.map(t=>t.source),geometries=objects.filter(v=>v instanceof P.Mesh).map(v=>v.geometry),count=f.allocated,verts=f.allocatedVertices;
   A.ok(count<=H.BUDGETS.high);A.equal(verts,f.meta.vertexBound);A.ok(verts<=8192);for(let i=0;i<60;i++)f.seek(i%40/60);A.equal(f.allocated,count);A.deepEqual(all(f),objects);
   const bad=H.defaults();bad.coreRadius=0;A.throws(()=>f.configure(bad));A.equal(f.owned.front,old.front);A.equal(f.owned.behind,old.behind);
   s.host.position.set(1,0);A.throws(()=>f.seek(.2),/logical world plane/);s.host.position.set(0,0);
   const fresh=H.defaults();f.configure(fresh);A.ok(old.front.destroyed&&old.behind.destroyed);A.ok(objects.every(v=>v.destroyed));A.ok(textures.every(t=>t.destroyed));A.ok(sources.every(t=>t.destroyed));A.ok(geometries.every(g=>g.attributes===null||g.indexBuffer===null||g.destroyed===true));
   f.destroy();f.destroy();A.deepEqual(s.host.children,[foreign]);A.equal(foreign.destroyed,false);A.throws(()=>f.seek(0));
  }finally{f.destroy();s.camera.destroy({children:true});}
 });
 test('extreme permitted pose scale and pulse preserve valid core geometry',()=>{
  const s=scene(true),d=H.defaults();d.coreRadius=100;d.glow=2;d.curves.pulse.keys.forEach(k=>k.y=2);
  d.emitters[0].anchor=at('skeleton');for(const k of ['ribbon','orbit'])d.emitters[0].layers[k].enabled=false;
  s.model.position.set(1000,1000);s.model.rotation=0;s.model.scale.set(100);const f=create(s,d);
  try{const q=f.seek(.3);A.equal(q.core.length,2);near(q.core.find(x=>x.kind==='glow').radius,60000,.001);A.equal(visible(f).length,2);A.ok(nodes(f,'core','front').every(v=>v.visible));}
  finally{f.destroy();s.camera.destroy({children:true});}
 });
 test('backend selection rejects silent mismatches and explicit fallback reports actual renderer',async()=>{
  const apps=[];class GL2{}class App{constructor(){apps.push(this);}async init(o){this.options=o;this.renderer=o.preference==='webgpu'?{gl:new GL2()}:{gl:o.preferWebGLVersion===2?new GL2():{}};}destroy(){this.dead=true;}}
  const opts={PIXI:{Application:App},backend:'webgpu',GL2};const f=await R.initApplication(opts);A.equal(f.requested,'webgpu');A.equal(f.actual,'webgl2');A.equal(f.fallback,true);A.ok(apps[0].dead);A.equal(apps.length,2);
  await A.rejects(()=>R.initApplication({...opts,allowFallback:false}),/requested webgpu/);A.ok(apps.at(-1).dead);
  const webgl=await R.initApplication({...opts,backend:'webgl1'});A.equal(webgl.actual,'webgl1');A.equal(webgl.fallback,false);A.equal(R.actualBackend({gpu:{device:{}}},GL2),'webgpu');A.equal(R.actualBackend({},GL2),'unsupported');
 });
}
module.exports={run};
if(require.main===module){const fs=require('node:fs'),path=require('node:path'),root=path.resolve(__dirname,'..');run(p=>fs.readFileSync(path.join(root,p),'utf8'),require('node:assert/strict'),require('node:test').test);}
