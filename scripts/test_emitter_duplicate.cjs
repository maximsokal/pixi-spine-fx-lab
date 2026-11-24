'use strict';
const assert=require('node:assert/strict');
const {test}=require('node:test');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const E=require('../assets/template/src/emitter-core.js');
const Colors=require('../assets/template/src/color-core.js');
const source=fs.readFileSync(path.join(__dirname,'../assets/template/src/emitter-ui.js'),'utf8');

// Exercise actual UI handlers and the real schema/serialization code.
// DOM and unrelated color-editor mounting are lightweight test doubles.
class Element {
 constructor(){this.children=[];this.listeners=new Map();this.value='';this.textContent='';}
 setAttribute(key,value){this[key]=value;}
 append(...children){this.children.push(...children);}
 replaceChildren(...children){this.children=children;}
 addEventListener(name,handler){this.listeners.set(name,handler);}
 find(id){if(this.id===id)return this;for(const child of this.children){const found=child.find(id);if(found)return found;}}
}
function mount(value){
 const parent=new Element(),changes=[];
 let locked=false;
 const context=vm.createContext({FxEmitters:E,FxColors:Colors,FxColorUi:{mount(){}},
  document:{createElement:()=>new Element(),head:new Element()}});
 vm.runInContext(source,context,{filename:'emitter-ui.js'});
 const ui=context.FxEmitterUi.mount(parent,{value,onChange:next=>changes.push(next),isLocked:()=>locked});
 const control=id=>{const result=parent.find(id);assert.ok(result,'missing control '+id);return result;};
 return {ui,changes,control,lock(){locked=true;},click(id){control(id).listeners.get('click')();},
  select(id,value){const el=control(id);el.value=value;el.listeners.get('change')();}};
}
function single(){const doc=E.makeExplosionPreset();doc.enabled=true;doc.emitters.splice(1);return doc;}
function allIds(doc){return doc.emitters.flatMap(e=>[e.id,...e.layers.map(l=>l.id)]);}
function duplicate(probe){probe.click('fxEmitterDuplicate');}
function withLayers(count){
 const doc=single(),e=doc.emitters[0];
 e.layers=Array.from({length:count},(_,i)=>({...E.newLayer('sparks',e.id,i),id:'spark'+i}));
 return doc;
}
test('duplicate repeated layer types without duplicate IDs or changing the source',()=>{
 const doc=single(),probe=mount(doc);
 probe.select('fxEmitterNewLayerType','sparks');probe.click('fxEmitterLayerAdd');
 const before=E.deserialize(E.serialize(probe.ui.document)),original=before.emitters[0];
 assert.equal(original.layers.filter(l=>l.type==='sparks').length,2);
 const sampled=E.sample(before,1.2).layers.filter(l=>l.emitterId===original.id);
 duplicate(probe);
 const next=E.deserialize(E.serialize(probe.ui.document));
 assert.equal(next.emitters.length,2,probe.control('fxEmitterStatus').textContent);
 assert.equal(probe.changes.length,2);
 assert.deepEqual(next.emitters[0],original);
 assert.deepEqual(next.emitters[1].layers.map(({id,...l})=>l),original.layers.map(({id,...l})=>l));
 assert.equal(new Set(allIds(next)).size,allIds(next).length);
 assert.equal(probe.ui.getSelected().emitterId,next.emitters[1].id);
 assert.deepEqual(E.sample(next,1.2).layers.filter(l=>l.emitterId===original.id),sampled);
 assert.deepEqual(E.deserialize(E.serialize(next)),next);
});
test('new IDs avoid existing imported emitter and layer IDs',()=>{
 const doc=single();doc.emitters[0].id='custom';doc.emitters[0].layers[0].id='emitter1';
 doc.emitters[0].layers[1].id='emitter1_glow';doc.emitters[0].layers[2].id='layer2';
 const probe=mount(doc);duplicate(probe);
 assert.equal(probe.ui.document.emitters.length,2,probe.control('fxEmitterStatus').textContent);
 const ids=allIds(probe.ui.document);assert.equal(new Set(ids).size,ids.length);
});
test('duplicate at max name length, position and int32 seed remains valid',()=>{
 const doc=single(),e=doc.emitters[0];e.name='x'.repeat(96);e.x=16384;e.seed=2147483647;
 const probe=mount(doc);duplicate(probe);
 assert.equal(probe.ui.document.emitters.length,2,probe.control('fxEmitterStatus').textContent);
 const copy=probe.ui.document.emitters[1];
 assert.equal(copy.name.length,96);assert.ok(copy.name.endsWith(' copy'));
 assert.equal(copy.x,16352);assert.equal(copy.seed,-2147483648);
 assert.deepEqual(probe.ui.document.emitters[0],E.normalize(doc).emitters[0]);
});
test('reject over-budget duplicate without changing selection or notifying runtime',()=>{
 const doc=withLayers(33),probe=mount(doc),selected=JSON.stringify(probe.ui.getSelected());
 duplicate(probe);
 assert.equal(probe.changes.length,0);assert.deepEqual(probe.ui.document,E.normalize(doc));
 assert.equal(JSON.stringify(probe.ui.getSelected()),selected);
 assert.match(probe.control('fxEmitterStatus').textContent,/64/);
});
test('allow exactly 64 layers after duplication',()=>{
 const probe=mount(withLayers(32));duplicate(probe);
 assert.equal(probe.ui.document.emitters.length,2,probe.control('fxEmitterStatus').textContent);
 assert.equal(probe.ui.document.emitters.flatMap(e=>e.layers).length,64);
 assert.equal(new Set(allIds(probe.ui.document)).size,66);
});
test('locked duplicate preserves selected emitter and layer',()=>{
 const probe=mount(single()),selected=JSON.stringify(probe.ui.getSelected());probe.lock();duplicate(probe);
 assert.equal(probe.changes.length,0);assert.equal(probe.ui.document.emitters.length,1);
 assert.equal(JSON.stringify(probe.ui.getSelected()),selected);
 assert.match(probe.control('fxEmitterStatus').textContent,/baking\/loading/);
});
test('ordinary duplicate preserves independent settings and normal offset',()=>{
 const doc=single(),probe=mount(doc);duplicate(probe);
 assert.equal(probe.ui.document.emitters.length,2);
 const [original,copy]=probe.ui.document.emitters;
 assert.equal(copy.x,original.x+32);assert.equal(copy.seed,original.seed+1);
 assert.equal(copy.name,original.name+' copy');assert.notEqual(copy.id,original.id);
 assert.deepEqual(original,E.normalize(doc).emitters[0]);
});

// Add/remove operations must respect the same document and selection contract.
for(const button of ['fxEmitterAdd','fxEmitterDelete','fxEmitterLayerAdd','fxEmitterLayerDelete']){
 test('locked '+button+' preserves the document and selection',()=>{
  const doc=E.makeExplosionPreset(),probe=mount(doc);
  probe.select('fxEmitterSelect','emitter2');
  probe.select('fxEmitterLayerSelect','emitter2_sparks');
  const before=JSON.stringify(probe.ui.getSelected());probe.lock();probe.click(button);
  assert.equal(probe.changes.length,0);assert.deepEqual(probe.ui.document,E.normalize(doc));
  assert.equal(JSON.stringify(probe.ui.getSelected()),before);
  assert.match(probe.control('fxEmitterStatus').textContent,/baking\/loading/);
 });
}
test('reject adding seven default layers when only six slots remain',()=>{
 const doc=withLayers(58),probe=mount(doc),before=JSON.stringify(probe.ui.getSelected());
 probe.click('fxEmitterAdd');
 assert.equal(probe.changes.length,0);assert.deepEqual(probe.ui.document,E.normalize(doc));
 assert.equal(JSON.stringify(probe.ui.getSelected()),before);
 assert.match(probe.control('fxEmitterStatus').textContent,/64/);
});
test('allow adding an emitter at exactly 64 total layers',()=>{
 const probe=mount(withLayers(57));probe.click('fxEmitterAdd');
 assert.equal(probe.changes.length,1);assert.equal(probe.ui.document.emitters.length,2);
 assert.equal(probe.ui.document.emitters.flatMap(e=>e.layers).length,64);
});
test('new emitter and its layers avoid imported IDs',()=>{
 const doc=single(),e=doc.emitters[0];e.id='custom';
 e.layers[0].id='emitter1';e.layers[1].id='emitter2_glow';
 const probe=mount(doc);probe.click('fxEmitterAdd');
 assert.equal(probe.changes.length,1,probe.control('fxEmitterStatus').textContent);
 const ids=allIds(probe.ui.document);assert.equal(new Set(ids).size,ids.length);
 assert.deepEqual(probe.ui.document.emitters[0],E.normalize(doc).emitters[0]);
});
test('new layer cannot reuse an imported emitter ID',()=>{
 const doc=single();doc.emitters[0].id='layer1';const probe=mount(doc);
 probe.click('fxEmitterLayerAdd');assert.equal(probe.changes.length,1);
 const ids=allIds(probe.ui.document);assert.equal(new Set(ids).size,ids.length);
});
test('refresh to an empty document clears both selection IDs',()=>{
 const probe=mount(single());probe.ui.refresh({...single(),emitters:[]});
 assert.equal(probe.ui.getSelected().emitterId,null);
 assert.equal(probe.ui.getSelected().layerId,null);
});
test('remove selected emitter and last layer selects only surviving IDs',()=>{
 const probe=mount(E.makeExplosionPreset());probe.select('fxEmitterSelect','emitter2');
 probe.click('fxEmitterDelete');assert.equal(probe.ui.getSelected().emitterId,'emitter1');
 for(let i=0;i<7;i++)probe.click('fxEmitterLayerDelete');
 assert.equal(probe.ui.document.emitters[0].layers.length,0);
 assert.equal(probe.ui.getSelected().layerId,null);
 probe.click('fxEmitterDelete');assert.equal(probe.ui.document.emitters.length,0);
 assert.equal(probe.ui.getSelected().emitterId,null);assert.equal(probe.ui.getSelected().layerId,null);
});
test('full layer budget reports refusal without changing selection',()=>{
 const probe=mount(withLayers(64)),before=JSON.stringify(probe.ui.getSelected());
 probe.click('fxEmitterLayerAdd');assert.equal(probe.changes.length,0);
 assert.equal(JSON.stringify(probe.ui.getSelected()),before);
 assert.match(probe.control('fxEmitterStatus').textContent,/64/);
});
