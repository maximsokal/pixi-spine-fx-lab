'use strict';
const assert=require('node:assert/strict');
const {test}=require('node:test');
const Snow=require('../assets/snowfall/src/snow-core.js');
const Runtime=()=>require('../assets/snowfall/src/snow-runtime.js');
function fixture(settings=Snow.defaults(),opts={}){
 const nodes=[],textures=[],particles=[],sources=[];
 class Container{
  constructor(){this.children=[];this.parent=null;this.destroyed=0;this.x=0;this.y=0;this.rotation=0;this.scale={x:1,y:1};this.visible=true;
   this.position={set:(x,y)=>{this.x=x;this.y=y}};nodes.push(this)}
  addChild(v){return this.addChildAt(v,this.children.length)}
  addChildAt(v,i){v.removeFromParent();this.children.splice(i,0,v);v.parent=this;return v}
  getChildIndex(v){return this.children.indexOf(v)}
  removeChild(v){const i=this.children.indexOf(v);if(i>=0){this.children.splice(i,1);v.parent=null}}
  removeFromParent(){this.parent?.removeChild(this)}
  toGlobal(p){return this.parent?this.parent.toGlobal({x:p.x+this.x,y:p.y+this.y}):{x:p.x+this.x,y:p.y+this.y}}
  toLocal(p){const q=this.parent?this.parent.toLocal(p):p;return {x:q.x-this.x,y:q.y-this.y}}
  destroy(o){assert.equal(this.destroyed,0);this.destroyed++;this.removeFromParent();if(o?.children)for(const v of [...this.children])v.destroy(o)}
 }
 let failAt=opts.failAt||0,attempt=0;
 class ParticleContainer extends Container{
  constructor(o){if(++attempt===failAt)throw Error('allocation failed');super();this.texture=o.texture;this.dynamicProperties=o.dynamicProperties;this.particleChildren=[];this.updates=0}
  update(){this.updates++}
  destroy(o){this.particleChildren.length=0;super.destroy(o)}
 }
 class Particle{constructor(o){Object.assign(this,o);particles.push(this)}}
 class ImageSource{constructor(o){Object.assign(this,o);this.destroyed=0;sources.push(this)}destroy(){assert.equal(this.destroyed++,0)}}
 class Texture{constructor(o){this.source=o.source;this.width=32;this.height=32;this.destroyed=0;textures.push(this)}destroy(source){assert.equal(this.destroyed++,0);if(source)this.source.destroy()}}
 class Rectangle{constructor(x,y,width,height){Object.assign(this,{x,y,width,height})}}
 const stage=new Container(),before=new Container(),host=new Container(),after=new Container();stage.addChild(before);stage.addChild(host);stage.addChild(after);
 const makeCanvas=()=>({width:0,height:0,getContext(){return {createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData:()=>{}}}});
 const PIXI={Container,ParticleContainer,Particle,ImageSource,Texture,Rectangle};
 const bone={active:true,worldX:10,worldY:20,a:2,b:0,c:0,d:3};
 let attachment={name:'bodyA',computeWorldVertices(slot,out){out.set([0,0,20,0,20,40,0,40])}};
 const model=new Container();host.addChild(model);model.x=100;model.y=200;model.skeleton={findBone:n=>n==='head'?bone:null,findSlot:n=>n==='body'?{bone,getAttachment:()=>attachment}:null};
 const start=()=>Runtime().createSnow({PIXI,app:{stage},host,model,settings,makeCanvas,worldOffset:opts.worldOffset});
 return {start,stage,host,before,after,model,bone,nodes,textures,sources,particles,PIXI,failNext(){failAt=attempt+2},setAttachment(v){attachment=v}};
}
const groups=(f,r)=>r.owned.behind.children.concat(r.owned.front.children);
const record=(r,id,kind)=>r.emitters.get(id).layers[kind];
test('three different white RGB masks have soft alpha and transparent borders',()=>{
 const masks=[0,1,2].map(i=>Runtime().maskRGBA(i));
 assert.equal(new Set(masks.map(a=>JSON.stringify(Array.from(a)))).size,3);
 for(const m of masks){assert.equal(m.length,32*32*4);
  assert.ok(m.every((v,i)=>i%4===3||v===255));
  assert.ok(m.some((v,i)=>i%4===3&&v>0&&v<255));
  assert.equal(m[3],0);assert.equal(m.at(-1),0);assert.ok(m[(16*32+16)*4+3]>200);
 }
});
test('native groups flank Spine without changing foreign sibling order',()=>{
 const f=fixture(),r=f.start();
 assert.deepEqual(f.stage.children,[f.before,r.owned.behind,f.host,r.owned.front,f.after]);
 assert.equal(record(r,'emitter1','far').surface.parent,r.owned.behind);
 assert.equal(record(r,'emitter1','near').surface.parent,r.owned.front);
 for(const surface of groups(f,r)){assert.equal(surface.children.length,3);for(const c of surface.children){assert.ok(c instanceof f.PIXI.ParticleContainer);assert.equal(c.dynamicProperties.uvs,false)}}
 assert.equal(f.textures.length,3);r.destroy();assert.deepEqual(f.stage.children,[f.before,f.host,f.after]);
 assert.ok(f.textures.every(t=>t.destroyed===1));assert.ok(f.sources.every(s=>s.destroyed===1));assert.equal(f.model.destroyed,0);
});
test('numeric positions sizes alpha and degrees-to-radians agree with the actual plan',()=>{
 const f=fixture(),r=f.start(),frame=r.seek(.23),near=frame.emitters[0].layers.find(l=>l.id==='near');
 const dst=record(r,'emitter1','near');
 for(let shape=0;shape<3;shape++){
  const expected=near.particles.filter(p=>p.shape===shape&&p.rgba[3]>0),actual=dst.batches[shape].particleChildren;
  assert.equal(actual.length,expected.length);
  for(let i=0;i<actual.length;i++){const a=actual[i],b=expected[i];
   assert.equal(a.x,b.x);assert.equal(a.y,b.y);assert.equal(a.scaleX,b.size/32);assert.ok(Math.abs(a.rotation-b.rotation*Math.PI/180)<1e-12);
   assert.equal(a.alpha,b.rgba[3]);assert.equal(a.texture,f.textures[shape]);
  }
 }
 assert.equal(r.totalActive,frame.cost);r.destroy();
});
test('shared pool plateaus across repeat seeks and disabled layers have no active particles',()=>{
 const f=fixture(),r=f.start();for(let i=0;i<60;i++)r.seek(i/60);
 const count=r.totalCreated;for(let i=59;i>=0;i--)r.seek(i/60);assert.equal(r.totalCreated,count);
 const c=Snow.defaults();c.emitters[0].layers.near.enabled=false;r.configure(c);r.seek(.2);
 assert.ok(record(r,'emitter1','near').batches.every(b=>b.particleChildren.length===0));
 assert.ok(r.totalActive>0);assert.ok(r.totalAllocated<=Snow.BUDGETS.balanced);r.destroy();assert.equal(r.totalAllocated,0);
});
test('missing attachment hides only its layer and recovers with no stale active particles',()=>{
 const c=Snow.defaults();c.emitters[0].layers.near.anchor={type:'attachment',space:'local',name:'bodyA',slot:'body',x:3,y:4,rotation:15};
 const f=fixture(c),r=f.start();r.seek(.2);const near=record(r,'emitter1','near').surface;
 assert.equal(near.x,116);assert.equal(near.y,232);assert.equal(near.rotation,15*Math.PI/180);
 const far=record(r,'emitter1','far');f.setAttachment(null);r.seek(.2);
 assert.equal(near.visible,false);assert.ok(record(r,'emitter1','near').batches.every(b=>!b.particleChildren.length));
 assert.ok(far.batches.some(b=>b.particleChildren.length));assert.ok(r.diagnostics.some(d=>d.layer==='near'));
 f.setAttachment({name:'bodyA',computeWorldVertices(slot,out){out.set([0,0,20,0,20,40,0,40])}});r.seek(.2);assert.equal(near.visible,true);r.destroy();
});
test('world crop offset is applied once; model already occupies crop stage coordinates',()=>{
 const c=Snow.defaults();c.emitters[0].layers.near.anchor={type:'bone',space:'world',name:'head',slot:'',x:3,y:4,rotation:0};
 const f=fixture(c,{worldOffset:{x:-30,y:-40}}),r=f.start();r.seek(.2);
 assert.equal(record(r,'emitter1','near').surface.x,113);assert.equal(record(r,'emitter1','near').surface.y,224);
 assert.equal(record(r,'emitter1','far').surface.x,226);assert.equal(record(r,'emitter1','far').surface.y,216);r.destroy();
});
test('initial allocation failure cleans only owned resources',()=>{
 const f=fixture(Snow.defaults(),{failAt:5});assert.throws(f.start,/allocation failed/);
 assert.deepEqual(f.stage.children,[f.before,f.host,f.after]);assert.ok(f.textures.every(t=>t.destroyed===1));
 assert.ok(f.nodes.filter(n=>![f.stage,f.before,f.host,f.after,f.model].includes(n)).every(n=>n.destroyed===1));
});
test('configure allocation failure preserves old groups and configuration, successful retry reuses resources',()=>{
 const f=fixture(),r=f.start();const before=r.settings,old=record(r,'emitter1','near');r.seek(.25);
 const next=Snow.defaults();next.emitters.push(Snow.newEmitter(1));f.failNext();
 assert.throws(()=>r.configure(next),/allocation failed/);assert.equal(r.settings,before);assert.equal(record(r,'emitter1','near'),old);assert.equal(r.emitters.size,1);
 r.configure(next);assert.equal(r.emitters.size,2);assert.equal(record(r,'emitter1','near'),old);r.destroy();r.destroy();
});
test('all layers disabled or one-shot endpoint produce empty bounds and no live particles',()=>{
 const c=Snow.defaults();c.mode='oneShot';c.durationFrames=40;const f=fixture(c),r=f.start();
 assert.ok(r.currentBounds());r.seek(39/60);assert.equal(r.totalActive,0);assert.equal(r.currentBounds(),null);
 r.destroy();assert.throws(()=>r.seek(0),/destroyed/);
});

test('quality downgrade releases free capacity, invalid budget leaves live document intact',()=>{
 const c=Snow.defaults();c.emitters.push(Snow.newEmitter(1),Snow.newEmitter(2),Snow.newEmitter(3));
 const f=fixture(c),r=f.start();assert.ok(r.totalAllocated>512);const old=r.settings;
 const low=Snow.defaults();low.quality='low';const bad=JSON.parse(JSON.stringify(c));bad.quality='low';
 assert.throws(()=>r.configure(bad),/budget/);assert.equal(r.settings,old);
 r.configure(low);assert.equal(r.emitters.size,1);assert.ok(r.totalAllocated<=512);assert.ok(r.totalActive>0);r.destroy();
});
test('setModel clears unresolved inherited anchors but preserves independent world layer',()=>{
 const c=Snow.defaults();c.emitters[0].anchor={type:'bone',space:'local',name:'head',slot:'',x:2,y:3,rotation:0};
 c.emitters[0].layers.far.anchor={type:'world',space:'world',name:'',slot:'',x:50,y:70,rotation:0};
 const f=fixture(c),r=f.start(),near=record(r,'emitter1','near'),far=record(r,'emitter1','far');
 assert.equal(near.surface.x,114);assert.equal(near.surface.y,229);assert.equal(far.surface.x,50);
 r.setModel(null);assert.equal(near.surface.visible,false);assert.ok(far.surface.visible);
 r.setModel(f.model);assert.equal(near.surface.visible,true);r.destroy();
});
test('malformed attachment vertices cannot produce a phantom origin',()=>{
 const c=Snow.defaults();c.emitters[0].layers.near.anchor={type:'attachment',space:'world',name:'bodyA',slot:'body',x:0,y:0,rotation:0};
 const f=fixture(c),r=f.start();f.setAttachment({name:'bodyA',computeWorldVertices(slot,out){out[0]=0;out[1]=0}});
 r.seek(.1);assert.equal(record(r,'emitter1','near').surface.visible,false);assert.ok(r.totalActive>0);r.destroy();
});
