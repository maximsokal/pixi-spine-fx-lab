'use strict';
const assert=require('node:assert/strict');
const {test}=require('node:test');
const E=require('../assets/template/src/emitter-core.js');
globalThis.FxEmitters=E;
require('../assets/template/src/emitter-runtime.js');

// CPU ownership oracle: actual runtime and sampler, no GPU or Spine renderer.
function fixture({customModel,editDoc,defer=false,noBlur=false,failFilterAt=0,failGraphicsAt=0}={}){
 const filters=[],nodes=[];let graphicsAttempts=0,filterAttempts=0;
 class Container{
  constructor(){
   nodes.push(this);this.children=[];this.parent=null;this.filters=[];this.destroyed=0;
   this.position={set:(x,y)=>{this.x=x;this.y=y;}};this.x=0;this.y=0;this.rotation=0;
   this.scale={x:1,y:1,set:x=>{this.scale.x=this.scale.y=x;}};
  }
  addChild(child){this.addChildAt(child,this.children.length);}
  addChildAt(child,index){if(child.parent)child.parent.removeChild(child);this.children.splice(index,0,child);child.parent=this;}
  removeChild(child){this.children.splice(this.children.indexOf(child),1);child.parent=null;}
  getChildIndex(child){return this.children.indexOf(child);}
  destroy(options){assert.equal(this.destroyed++,0,'double container destroy');
   if(options?.children)for(const child of [...this.children])child.destroy(options);
   if(this.parent)this.parent.removeChild(this);
  }
 }
 class Graphics extends Container{
  constructor(){if(++graphicsAttempts===failGraphicsAt)throw Error('graphics allocation failed');super();}
  clear(){this.draws=0;return this;}circle(){return this;}fill(){this.draws++;return this;}stroke(){this.draws++;return this;}
  moveTo(){return this;}lineTo(){return this;}poly(){return this;}
 }
 class BlurFilter{
  constructor(options){if(++filterAttempts===failFilterAt)throw Error('filter allocation failed');this.options=options;this.destroyed=0;filters.push(this);}
  destroy(){assert.ok(nodes.every(n=>!n.filters.includes(this)),'detach filter first');assert.equal(this.destroyed++,0,'double filter destroy');}
 }
 const stage=new Container(),host=new Container();stage.addChild(host);
 const model=customModel||{skeleton:{},worldTransform:{apply:(p,out)=>Object.assign(out,p)}};
 const doc=E.makeExplosionPreset();doc.enabled=true;editDoc?.(doc);
 const start=()=>globalThis.FxEmitterRuntime.createEmitterLayers({PIXI:{Container,Graphics,...(noBlur?{}:{BlurFilter})},app:{stage},host,model,settings:doc,bounds:{}});
 if(defer)return {start,stage,host,filters,nodes};
 const runtime=start();
 const record=(eid,lid)=>runtime.nodes.get(eid).layers.get(lid);
 const edit=(eid,lid,type)=>{const next=E.deserialize(E.serialize(runtime.document));
  next.emitters.find(e=>e.id===eid).layers.find(l=>l.id===lid).type=type;runtime.configure(next);};
 return {runtime,stage,host,filters,nodes,record,edit};
}
const eid='emitter1',glow='emitter1_glow',post='emitter1_postprocess';
test('same-ID ordinary layer changed to postprocess receives a blur filter',()=>{
 const f=fixture(),r=f.record(eid,glow),count=f.filters.length;
 f.edit(eid,glow,'postprocess');
 assert.equal(f.record(eid,glow),r);assert.equal(f.filters.length,count+1);
 assert.equal(r.filter,f.filters.at(-1));assert.deepEqual(r.container.filters,[r.filter]);
 assert.deepEqual(r.filter.options,{strength:2.5,quality:2});f.runtime.destroy();
});
test('same-ID postprocess changed to ordinary layer detaches and destroys blur',()=>{
 const f=fixture(),r=f.record(eid,post),filter=r.filter;
 const sibling=f.record('emitter2','emitter2_postprocess').filter;
 f.edit(eid,post,'glow');
 assert.equal(f.record(eid,post),r);assert.equal(r.filter,null);assert.deepEqual(r.container.filters,[]);
 assert.equal(filter.destroyed,1);assert.equal(sibling.destroyed,0);
 f.runtime.destroy();assert.equal(filter.destroyed,1);assert.equal(sibling.destroyed,1);
});
test('type round-trip creates one replacement filter and removes it on deletion',()=>{
 const f=fixture(),r=f.record(eid,post),original=r.filter;
 f.edit(eid,post,'sparks');f.edit(eid,post,'postprocess');const replacement=r.filter;
 assert.notEqual(replacement,original);assert.equal(original.destroyed,1);
 const next=E.deserialize(E.serialize(f.runtime.document));next.emitters[0].layers=next.emitters[0].layers.filter(l=>l.id!==post);
 f.runtime.configure(next);assert.equal(replacement.destroyed,1);assert.equal(r.container.destroyed,1);
 f.runtime.destroy();f.runtime.destroy();assert.equal(replacement.destroyed,1);
 assert.deepEqual(f.stage.children,[f.host]);assert.equal(f.host.destroyed,0);
});
test('unchanged postprocess and ordinary type transitions reuse resources',()=>{
 const f=fixture(),r=f.record(eid,post),filter=r.filter,count=f.filters.length,g=f.record(eid,glow);
 f.runtime.configure(f.runtime.document);f.runtime.seek(1.2);f.edit(eid,glow,'rays');
 assert.equal(f.record(eid,post),r);assert.equal(r.filter,filter);assert.equal(filter.destroyed,0);
 assert.equal(f.record(eid,glow),g);assert.equal(g.filter,null);assert.equal(f.filters.length,count);
 f.runtime.destroy();assert.ok(f.filters.every(v=>v.destroyed===1));assert.deepEqual(f.stage.children,[f.host]);
});

// Each emitter validates its own anchor even when sharing a Spine slot wrapper.
function slotFixture({fallback='hide',occupied=false}={}){
 const bone={active:true,worldX:10,worldY:20,a:1,b:0,c:0,d:1};
 let attachment=null,exists=true;
 const slot={bone,getAttachment:()=>attachment};
 const bindings=new Map();let added=0,removed=0;
 const callerObject={callerOwned:true};if(occupied)bindings.set('body',callerObject);
 const model={skeleton:{findSlot:name=>exists&&name==='body'?slot:null},
  worldTransform:{apply:(p,out)=>Object.assign(out,p)},
  addSlotObject(name,wrapper,options){assert.equal(name,'body');assert.equal(options.followAttachmentTimeline,false);
   assert.ok(!bindings.has(name));bindings.set(name,wrapper);added++;},
  getSlotObject:name=>bindings.get(name),
  removeSlotObject(name,wrapper){assert.equal(bindings.get(name),wrapper);bindings.delete(name);removed++;}};
 const setAttachment=name=>{attachment=name?{name,computeWorldVertices(_slot,vertices){vertices.set([0,0,2,0,2,2,0,2]);}}:null;};
 setAttachment('bodyA');
 const f=fixture({customModel:model,editDoc(doc){
  for(const [i,e] of doc.emitters.entries()){
   e.layers=e.layers.filter(l=>l.type==='glow');e.placement='slot';e.fallback=fallback;
   e.anchor=i===0?{type:'attachment',name:'bodyA',slot:'body'}:{type:'slot',name:'body'};
  }
 }});
 return {...f,bone,bindings,setAttachment,removeSlot(){exists=false;},restoreSlot(){exists=true;},
  get added(){return added;},get removed(){return removed;},callerObject};
}
function assertFrame(f,ids){
 const frame=f.runtime.seek(1.2);
 assert.deepEqual(frame.visibleLayers,ids);
 assert.equal(frame.cost,ids.length);
 assert.deepEqual(f.runtime.snapshot.layers.map(l=>l.id),ids);
 assert.equal(f.runtime.snapshot.cost,ids.length);
 for(const [eid,lid] of [['emitter1','emitter1_glow'],['emitter2','emitter2_glow']]){
  const layer=f.record(eid,lid),visible=ids.includes(lid);
  assert.equal(layer.container.visible,visible);
  assert.equal(layer.graphics.draws,visible?1:0);
 }
 return frame;
}
test('missing or changed attachment hides only its named emitter and restores on return',()=>{
 const f=slotFixture();assertFrame(f,['emitter1_glow','emitter2_glow']);const wrapper=f.bindings.get('body');
 f.setAttachment('bodyB');let frame=assertFrame(f,['emitter2_glow']);
 assert.ok(frame.diagnostics.some(d=>d.emitterId==='emitter1'&&d.code==='missing-attachment'));
 f.setAttachment(null);assertFrame(f,['emitter2_glow']);
 f.setAttachment('bodyA');assertFrame(f,['emitter1_glow','emitter2_glow']);
 assert.equal(f.bindings.get('body'),wrapper);assert.equal(f.added,1);f.runtime.destroy();assert.equal(f.removed,1);
});
test('inactive slot bone hides both emitters and restores without reallocating wrapper',()=>{
 const f=slotFixture();const wrapper=f.bindings.get('body');f.bone.active=false;
 const frame=assertFrame(f,[]);assert.equal(frame.diagnostics.filter(d=>d.code==='missing-slot').length,2);
 f.bone.active=true;assertFrame(f,['emitter1_glow','emitter2_glow']);
 assert.equal(f.bindings.get('body'),wrapper);assert.equal(f.added,1);f.runtime.destroy();
});
test('missing slot is not rendered even with front fallback and is absent from bake metadata',()=>{
 const f=slotFixture({fallback:'front'});f.removeSlot();
 const frame=assertFrame(f,[]);assert.equal(frame.diagnostics.filter(d=>d.code==='missing-slot').length,2);
 f.restoreSlot();assertFrame(f,['emitter1_glow','emitter2_glow']);f.runtime.destroy();
});
test('occupied slot uses front fallback only for resolved anchors and preserves caller object',()=>{
 const f=slotFixture({fallback:'front',occupied:true});
 assertFrame(f,['emitter1_glow','emitter2_glow']);f.setAttachment('bodyB');
 assertFrame(f,['emitter2_glow']);assert.equal(f.added,0);f.runtime.destroy();
 assert.equal(f.bindings.get('body'),f.callerObject);assert.equal(f.removed,0);
});

// Factory failures must not strand resources when no runtime is returned.
function assertClean(f){
 assert.deepEqual(f.stage.children,[f.host]);
 assert.ok(f.nodes.filter(n=>n!==f.stage&&n!==f.host).every(n=>n.destroyed===1));
 assert.ok(f.filters.every(filter=>filter.destroyed===1));
 assert.equal(f.host.destroyed,0);assert.equal(f.stage.destroyed,0);
}
test('missing BlurFilter is rejected before any owned allocation',()=>{
 const f=fixture({defer:true,noBlur:true});
 assert.throws(f.start,/BlurFilter unavailable/);assert.equal(f.nodes.length,2);assertClean(f);
});
test('second filter constructor failure disposes earlier allocations',()=>{
 const f=fixture({defer:true,failFilterAt:2});
 assert.throws(f.start,/filter allocation failed/);assert.equal(f.filters.length,1);assertClean(f);
});
test('graphics constructor failure disposes its partially created layer container',()=>{
 const f=fixture({defer:true,failGraphicsAt:8});
 assert.throws(f.start,/graphics allocation failed/);assert.equal(f.filters.length,1);assertClean(f);
});
test('initial seek failure releases resources and preserves caller host',()=>{
 const model={skeleton:{},worldTransform:{apply(){throw Error('pose transform failed');}}};
 const f=fixture({defer:true,customModel:model,editDoc(doc){doc.emitters[0].anchor={type:'skeleton',name:''};}});
 assert.throws(f.start,/pose transform failed/);assertClean(f);
});
test('configure with unavailable BlurFilter leaves the previous document and nodes unchanged',()=>{
 const f=fixture({noBlur:true,editDoc(doc){for(const e of doc.emitters)e.layers=e.layers.filter(l=>l.type!=='postprocess');}});
 const previous=f.runtime.document,record=f.record(eid,glow),count=f.nodes.length;
 assert.throws(()=>f.edit(eid,glow,'postprocess'),/BlurFilter unavailable/);
 assert.equal(f.runtime.document,previous);assert.equal(f.record(eid,glow),record);
 assert.equal(record.filter,null);assert.equal(f.nodes.length,count);f.runtime.seek(1.2);f.runtime.destroy();assertClean(f);
});
