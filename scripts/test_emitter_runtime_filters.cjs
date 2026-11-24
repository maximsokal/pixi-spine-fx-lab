'use strict';
const assert=require('node:assert/strict');
const {test}=require('node:test');
const E=require('../assets/template/src/emitter-core.js');
globalThis.FxEmitters=E;
require('../assets/template/src/emitter-runtime.js');

// CPU ownership oracle: actual runtime and sampler, no GPU or Spine renderer.
function fixture(){
 const filters=[],nodes=[];
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
  clear(){return this;}circle(){return this;}fill(){return this;}stroke(){return this;}
  moveTo(){return this;}lineTo(){return this;}poly(){return this;}
 }
 class BlurFilter{
  constructor(options){this.options=options;this.destroyed=0;filters.push(this);}
  destroy(){assert.ok(nodes.every(n=>!n.filters.includes(this)),'detach filter first');assert.equal(this.destroyed++,0,'double filter destroy');}
 }
 const stage=new Container(),host=new Container();stage.addChild(host);
 const model={skeleton:{},worldTransform:{apply:(p,out)=>Object.assign(out,p)}};
 const doc=E.makeExplosionPreset();doc.enabled=true;
 const runtime=globalThis.FxEmitterRuntime.createEmitterLayers({PIXI:{Container,Graphics,BlurFilter},app:{stage},host,model,settings:doc,bounds:{}});
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
