'use strict';
// Real pinned CPU scene objects; injected allocation/paint faults, not GPU rendering.
function suite(read,A,T){
 const base='assets/template/',vendor=base+'vendor/',src=base+'src/';
 const dom={createElement:()=>({style:{},getContext:()=>null}),createElementNS:()=>({style:{}})},win={};
 const P=new Function('navigator','document','window','self',read(vendor+'pixi-8.22.0.min.js')+'\nreturn PIXI;')({userAgent:'Chromium',platform:'Linux'},dom,win,win);win.PIXI=P;
 const Sp=new Function('PIXI','window','self','require',read(vendor+'spine-pixi-v8-4.2.120.min.js')+'\nreturn spine;')(P,win,win,n=>{if(n==='pixi.js')return P;throw Error(n);});
 const g={};for(const n of ['curve-core','color-core','emitter-core','emitter-runtime'])new Function('globalThis',read(src+n+'.js'))(g);
 const E=g.FxEmitters,clone=d=>E.deserialize(E.serialize(d));
 function fixture({slot=false,foreign=false}={}){
  const stage=new P.Container(),host=new P.Container();stage.addChild(host);
  const model=new Sp.Spine({skeletonData:new Sp.SkeletonJson({newPointAttachment:(_skin,name)=>new Sp.PointAttachment(name)}).readSkeletonData({skeleton:{spine:'4.2.43'},bones:[{name:'root'}],slots:[{name:'body',bone:'root',attachment:'point'},{name:'other',bone:'root'}],skins:[{name:'default',attachments:{body:{point:{type:'point'}}}}],animations:{idle:{}}}),autoUpdate:false});
  host.addChild(model);model.update(0);
  const caller=new P.Container();if(foreign)model.addSlotObject('other',caller);
  let fault=null,persistent=false;const nodes=[],filters=[];
  function hit(n){if(fault===n){if(!persistent)fault=null;throw Error('injected '+n);}}
  class Container extends P.Container{constructor(){super();nodes.push(this);}}
  class Graphics extends P.Graphics{constructor(){hit('allocation');super();nodes.push(this);}clear(){hit('paint');return super.clear();}}
  class BlurFilter extends P.BlurFilter{constructor(opts){hit('filter');super(opts);filters.push(this);}}
  const d=E.makeExplosionPreset();d.enabled=true;
  if(slot){d.emitters[0].placement='slot';d.emitters[0].anchor={type:'slot',name:'body'};}
  const runtime=g.FxEmitterRuntime.createEmitterLayers({PIXI:{...P,Container,Graphics,BlurFilter},app:{stage},host,model,settings:d,bounds:{}});
  runtime.seek(1.2);
  const previous=runtime.document,snapshot=runtime.snapshot,prior=nodes.slice();
  return {stage,host,model,caller,runtime,previous,snapshot,prior,nodes,filters,
   fault(n,repeat=false){fault=n;persistent=repeat;},clear(){fault=null;},
   verifyRestore(){A.equal(runtime.document,previous);A.deepEqual(runtime.snapshot,snapshot);A.equal(runtime.clock,1.2);A.equal(runtime.broken,false);A.ok(prior.every(n=>n.label?.startsWith('FX emitters ')||n.destroyed),'old owned nodes not cleaned');A.equal(runtime.ownedCount,2);A.equal(host.parent,stage);A.equal(model.parent,host);if(slot){A.ok(model.getSlotObject('body'));A.equal(runtime.slotBindings,1);}if(foreign)A.equal(model.getSlotObject('other'),caller);},
   close(){fault=null;runtime.destroy();A.ok(nodes.every(n=>n.destroyed));A.equal(stage.children.length,1);A.equal(stage.children[0],host);A.equal(model.destroyed,false);if(slot)A.ok(!model.getSlotObject('body'));if(foreign){A.equal(model.getSlotObject('other'),caller);A.equal(caller.destroyed,false);model.removeSlotObject('other',caller);caller.destroy();}stage.destroy({children:true});}
  };
 }
 T('native allocation failure restores document, resources, slot and foreign binding',()=>{
  const f=fixture({slot:true,foreign:true});try{const n=clone(f.previous),l=E.newLayer('rays','emitter1',8);l.id='new_rays';n.emitters[0].layers.push(l);n.emitters[0].x+=20;f.fault('allocation');A.throws(()=>f.runtime.configure(n),/injected allocation/);f.verifyRestore();A.ok(!f.runtime.nodes.get('emitter1').layers.has(l.id));f.runtime.configure(n);A.equal(f.runtime.document.emitters[0].x,n.emitters[0].x);A.ok(f.runtime.nodes.get('emitter1').layers.has(l.id));}finally{f.close();}
 });
 T('native paint failure after deletion and filter replacement rebuilds accepted scene',()=>{
  const f=fixture({slot:true,foreign:true});try{const n=clone(f.previous);n.emitters[0].placement='front';n.emitters[0].anchor={type:'world',name:''};n.emitters[0].layers.find(l=>l.type==='postprocess').type='glow';n.emitters[0].layers.find(l=>l.id==='emitter1_glow').type='postprocess';n.emitters.pop();f.fault('paint');A.throws(()=>f.runtime.configure(n),/injected paint/);f.verifyRestore();A.ok(f.runtime.nodes.get('emitter1').layers.get('emitter1_postprocess').filter);A.equal(f.runtime.nodes.get('emitter1').layers.get('emitter1_glow').filter,null);}finally{f.close();}
 });
 T('persistent rollback paint failure hides every owned plane and blocks further edits',()=>{
  const f=fixture({slot:true,foreign:true});try{const n=clone(f.previous);n.emitters[0].x+=10;f.fault('paint',true);A.throws(()=>f.runtime.configure(n),/rollback failed/);A.equal(f.runtime.document,f.previous);A.equal(f.runtime.broken,true);A.equal(f.runtime.snapshot,null);A.equal(f.runtime.clock,1.2);A.ok([...f.runtime.nodes.values()].every(e=>!e.container.visible));A.ok(!f.model.getSlotObject('body')?.visible);A.equal(f.runtime.scenePositionForEmitter('emitter1'),null);A.equal(f.runtime.scenePositionForLayer('emitter1','emitter1_glow'),null);A.throws(()=>f.runtime.emitterOffsetFromScene('emitter1',1,2),/recreation/);A.throws(()=>f.runtime.layerOffsetFromScene('emitter1','emitter1_glow',1,2),/recreation/);f.clear();A.throws(()=>f.runtime.configure(f.previous),/recreation/);A.equal(f.runtime.seek(2).broken,true);A.equal(f.runtime.clock,1.2);A.equal(f.runtime.snapshot,null);A.equal(f.model.getSlotObject('other'),f.caller);}finally{f.close();}
 });
 T('native successful configure and filter preflight failure keep existing object identities',()=>{
  const f=fixture();try{const records=[...f.runtime.nodes.values()].flatMap(e=>[...e.layers.values()]);const n=clone(f.previous);n.emitters[0].layers.find(l=>l.id==='emitter1_glow').type='postprocess';f.fault('filter');A.throws(()=>f.runtime.configure(n),/injected filter/);A.equal(f.runtime.document,f.previous);A.equal(f.runtime.snapshot,f.snapshot);A.equal(f.runtime.clock,1.2);const same=()=>[...f.runtime.nodes.values()].flatMap(e=>[...e.layers.values()]).every((v,i)=>v===records[i]);A.ok(same());f.runtime.configure(n);A.ok(same());A.ok(f.runtime.nodes.get('emitter1').layers.get('emitter1_glow').filter);A.equal(f.runtime.broken,false);}finally{f.close();}
 });
}
module.exports={suite};
if(require.main===module){const fs=require('node:fs'),path=require('node:path');suite(p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8'),require('node:assert/strict'),require('node:test').test);}
