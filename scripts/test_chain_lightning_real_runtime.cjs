'use strict';
// Executes real pinned CPU runtime objects, not a GPU renderer.
function run(read,A,test){
 const fx='assets/chain-lightning/src/',shared='assets/template/src/',vendor='assets/template/vendor/';
 const doc={createElement:()=>({style:{},getContext:()=>null}),createElementNS:()=>({style:{}})},win={};
 const P=new Function('navigator','document','window','self',read(vendor+'pixi-8.22.0.min.js')+'\nreturn PIXI;')({userAgent:'Chromium',platform:'Linux'},doc,win,win);win.PIXI=P;
 const Sp=new Function('PIXI','window','self','require',read(vendor+'spine-pixi-v8-4.2.120.min.js')+'\nreturn spine;')(P,win,win,n=>{if(n==='pixi.js')return P;throw Error(n);});
 const mods={};for(const path of [...['curve','spacing','path','color'].map(n=>shared+n+'-core.js'),...['core','anchors','runtime'].map(n=>fx+'chain-'+n+'.js')]){
  const m={exports:{}};new Function('module','require',read(path))(m,n=>{const k=n.split('/').at(-1);if(!Object.hasOwn(mods,k))throw Error(n);return mods[k];});mods[path.split('/').at(-1)]=m.exports;
 }
 const H=mods['chain-core.js'],An=mods['chain-anchors.js'],R=mods['chain-runtime.js'];
 const near=(a,b,e=1e-5)=>A.ok(Math.abs(a-b)<=e,a+' != '+b),at=(type,name='',slot='',space='local',x=0,y=0,rotation=0)=>({type,name,slot,space,x,y,rotation});
 function scene(rig=false){const camera=new P.Container(),world=new P.Container(),behindHost=new P.Container(),host=new P.Container();camera.addChild(world);world.addChild(behindHost);
  let model=null;if(rig){const data={skeleton:{spine:'4.2.43'},bones:[{name:'root',x:8,y:12},{name:'weapon',parent:'root',x:20,y:3,rotation:25,scaleX:1.5,scaleY:.7}],slots:[{name:'impact',bone:'weapon',attachment:'tip'}],skins:[{name:'default',attachments:{impact:{tip:{type:'point',x:12,y:5}}}}],animations:{idle:{}}};
   model=new Sp.Spine({skeletonData:new Sp.SkeletonJson({newPointAttachment:(skin,name)=>new Sp.PointAttachment(name)}).readSkeletonData(data),autoUpdate:false});world.addChild(model);model.skeleton.setSkinByName('default');model.skeleton.setToSetupPose();model.update(0);model.position.set(15,30);model.rotation=.4;model.scale.set(1.2,1.2);}
  world.addChild(host);return {camera,world,behindHost,host,model,Spine:Sp};}
 const create=(s,d=H.defaults())=>R.createRenderer({...s,PIXI:P,settings:d});
 const views=g=>g.children.flatMap(v=>v.children.flatMap(v=>v.children));
 const all=f=>[...views(f.owned.behind),...views(f.owned.front)];
 const nodes=(f,k,order,id='target-1')=>f.owned[order].children.find(x=>x.label===k).children.find(x=>x.label===id+':'+k)?.children??[];
 const visible=f=>all(f).filter(v=>v.visible);
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
 test('native mesh buffers, PMA ramp, distinct soft glow and spark masks, fixed identity',()=>{
  const s=scene(),d=H.defaults();d.jumpDelay=0;for(const p of d.palettes.arcs.stops)p.rgba=[100,50,25,.5];const f=create(s,d);
  try{A.equal(P.VERSION,'8.22.0');const q=f.seek(4/60),arc=nodes(f,'arcs','front')[0],branch=nodes(f,'branches','front')[0],glow=nodes(f,'glow','behind')[0],sparks=nodes(f,'branches','front').slice(1);
   A.ok(arc instanceof P.Mesh&&branch instanceof P.Mesh&&glow instanceof P.Sprite);A.ok(arc.geometry instanceof P.MeshGeometry);A.ok(arc.geometry.indices instanceof Uint16Array);
   const r=q.arcs.find(x=>x.emitterId==='target-1'),[red,g,b,a]=r.rgba;
   A.deepEqual([...arc.geometry.positions.slice(0,r.positions.length)],[...Float32Array.from(r.positions)]);A.deepEqual([...arc.geometry.indices.slice(0,r.indices.length)],r.indices);
   A.deepEqual([...arc.texture.source.resource.slice(0,4)],[Math.round(red*a),Math.round(g*a),Math.round(b*a),Math.round(255*a)]);A.equal(arc.texture.source.alphaMode,'premultiplied-alpha');A.ok(arc.geometry.indices.slice(r.indices.length).every(x=>x===0));
   const bq=q.branches.filter(x=>x.emitterId==='target-1'&&x.kind==='ribbon');let v=0,j=0;for(const row of bq){A.deepEqual([...branch.geometry.positions.slice(v*2,v*2+row.positions.length)],[...Float32Array.from(row.positions)]);A.deepEqual([...branch.geometry.indices.slice(j,j+row.indices.length)],row.indices.map(x=>x+v));v+=row.positions.length/2;j+=row.indices.length;}
   A.equal(sparks.filter(x=>x.visible).length,q.branches.filter(x=>x.emitterId==='target-1'&&x.kind==='disc').length);
   const soft=glow.texture.source.resource,hard=sparks[0].texture.source.resource;A.ok(soft!==hard);A.equal(soft[3],0);A.equal(hard[3],0);A.ok(soft[(32*64+32)*4+3]>200);A.ok(soft[(32*64+48)*4+3]<hard[(32*64+48)*4+3]);for(const m of [soft,hard])A.ok(m.every((x,i)=>i%4===3||x===m[i-i%4+3]));
   const objects=all(f),buffers=[arc.geometry.positions,arc.geometry.uvs,arc.geometry.indices,arc.texture.source.resource],count=f.allocated;for(let i=0;i<120;i++){const t=(i%40)/60;f.seek(t);}
   A.deepEqual(all(f),objects);A.equal(f.allocated,count);A.equal(arc.geometry.positions,buffers[0]);A.equal(arc.geometry.uvs,buffers[1]);A.equal(arc.geometry.indices,buffers[2]);A.equal(arc.texture.source.resource,buffers[3]);A.ok(f.allocatedVertices>=f.meta.vertexBound);A.ok(f.allocatedVertices<=8192);A.ok(f.allocatedViews<f.allocated);
  }finally{f.destroy();s.camera.destroy({children:true});}
 });
 test('actual independent source/target anchors, moving endpoint, missing and over-cap links',()=>{
  const s=scene(true),d=H.defaults();d.jumpDelay=0;d.jitter=0;d.source=at('bone','root');d.targets[1].anchor=at('attachment','tip','impact');d.targets[1].layers.glow.x=7;d.targets[1].layers.arcs.order='behind';const f=create(s,d);
  try{const q=f.seek(4/60),p=An.resolve(d.targets[1].anchor,s),arc=q.arcs.find(x=>x.emitterId==='target-2'),gl=q.glow.find(x=>x.emitterId==='target-2');
   near(arc.sections.at(-1).x,p.x);near(arc.sections.at(-1).y,p.y);near(gl.x,p.x+Math.cos(p.rotation*Math.PI/180)*7*p.scale);A.ok(nodes(f,'arcs','behind','target-2')[0].visible);
   s.model.position.x+=30;const m=f.seek(4/60);near(m.arcs.find(x=>x.emitterId==='target-2').sections.at(-1).x,arc.sections.at(-1).x+30);near(m.arcs.find(x=>x.emitterId==='target-3').sections[0].x,p.x+30);A.deepEqual(m.arcs.find(x=>x.emitterId==='target-4'),q.arcs.find(x=>x.emitterId==='target-4'));
   s.camera.scale.set(2);s.camera.position.set(30,50);s.camera.rotation=.3;const zoom=f.seek(4/60);near(zoom.targets[1].pose.x,m.targets[1].pose.x);near(zoom.targets[1].pose.y,m.targets[1].pose.y);
   s.model.skeleton.findSlot('impact').setAttachment(null);const missing=f.seek(4/60);A.deepEqual(f.missing,['target-2']);A.deepEqual(missing.arcs.map(r=>r.emitterId),['target-1','target-4']);A.ok(!nodes(f,'arcs','behind','target-2')[0].visible);A.ok(missing.glow.some(x=>x.emitterId==='target-3'));
   f.setModel(null);A.deepEqual(f.missing,['source','target-2']);A.deepEqual(f.sample.arcs.map(x=>x.emitterId),['target-4']);
   const far=H.defaults();far.jumpDelay=0;far.targets[1].anchor.x=3000;f.configure(far);A.deepEqual(f.capacityExceeded,['target-1>target-2','target-2>target-3']);A.ok(f.sample.glow.some(x=>x.emitterId==='target-2'));
  }finally{f.destroy();s.camera.destroy({children:true});}
 });
 test('restrikes, maximum targets, rollback, ownership and exact resource caps',()=>{
  const s=scene(),d=H.defaults();d.quality='high';d.restrikes=true;d.restrikeRate=6;d.arcGap=32;d.jumpDelay=1;d.branchCount=1;for(let i=5;i<=8;i++)d.targets.push(H.newTarget('target-'+i,440-i*15,200+i*9,i));const f=create(s,d),foreign=new P.Container();s.host.addChild(foreign);
  try{const old=f.owned,objects=all(f),textures=[...new Set(objects.map(v=>v.texture))],sources=textures.map(t=>t.source),geometries=objects.filter(v=>v instanceof P.Mesh).map(v=>v.geometry),count=f.allocated;
   A.ok(f.allocated<=H.BUDGETS.high);A.ok(f.allocatedVertices<=8192);A.ok(f.meta.eventCount>8);for(let i=0;i<80;i++)f.seek(i%40/60);A.equal(f.allocated,count);A.deepEqual(all(f),objects);
   const bad=H.defaults();bad.arcWidth=0;A.throws(()=>f.configure(bad));A.equal(f.owned.front,old.front);
   const too=H.defaults();too.quality='high';too.arcGap=2;too.branchCount=0;too.jumpDelay=35;too.durationFrames=400;for(let i=5;i<=8;i++)too.targets.push(H.newTarget('target-'+i,200+i*5,200,i));A.ok(H.compile(too).meta.vertexBound<=8192);A.throws(()=>f.configure(too),/reserved draw-group capacity/);A.equal(f.owned.front,old.front);
   s.host.position.set(1,0);A.throws(()=>f.seek(.2),/logical world plane/);s.host.position.set(0,0);
   f.configure(H.defaults());A.ok(old.front.destroyed&&old.behind.destroyed);A.ok(objects.every(v=>v.destroyed));A.ok(textures.every(t=>t.destroyed));A.ok(sources.every(t=>t.destroyed));A.ok(geometries.every(g=>g.attributes===null||g.indexBuffer===null||g.destroyed===true));
   f.seek(39/60);A.equal(visible(f).length,0);f.seek(.2);A.ok(visible(f).length>0);f.seek(0);A.equal(visible(f).length,0);
   const off=H.defaults();for(const t of off.targets)for(const l of Object.values(t.layers))l.enabled=false;f.configure(off);A.equal(f.allocated,0);A.equal(f.allocatedVertices,0);A.equal(f.allocatedViews,0);
   f.destroy();f.destroy();A.deepEqual(s.host.children,[foreign]);A.equal(foreign.destroyed,false);A.throws(()=>f.seek(0));
  }finally{f.destroy();s.camera.destroy({children:true});}
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
