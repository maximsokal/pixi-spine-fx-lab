'use strict';
// Actual editor modules, deterministic DOM/event fixtures, no GPU claim.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {test}=require('node:test');
const ROOT=path.join(__dirname,'..');
const files=['curve-core.js','color-core.js','emitter-core.js','emitter-ui.js','ui.html'].map(p=>'assets/template/src/'+p);
class NodeFixture {
 constructor(tag){this.tag=tag;this.children=[];this.attrs={};this.listeners={};this.value='';this.checked=false;this.textContent='';}
 setAttribute(k,v){this.attrs[k]=String(v);}
 append(...nodes){this.children.push(...nodes);}
 replaceChildren(...nodes){this.children=nodes;}
 addEventListener(k,f){this.listeners[k]=f;}
 find(id){if(this.attrs.id===id)return this;for(const child of this.children){const n=child.find?.(id);if(n)return n;}}
}
function suite(read,A,T){
 function fixture(){
  const dom={head:new NodeFixture('head'),createElement:t=>new NodeFixture(t)},g={FxColorUi:{mount(){}}};
  for(const p of files.slice(0,4))new Function('globalThis','document','FxColorUi','FxColors',read(p))(g,dom,g.FxColorUi,g.FxColors);
  const E=g.FxEmitters,parent=new NodeFixture('root'),cfg={multiEmitters:E.makeExplosionPreset()};
  let calls=0,accepted=E.normalize(cfg.multiEmitters),fail=true,guideFail=false,notifications=0;
  // Execute the actual mount callbacks from the HTML assembly, not an independently
  // reimplemented host. Other DOM/browser functions are injected fixtures.
  const html=read(files[4]),marker='emitterUi=FxEmitterUi.mount(holder,{';
  const start=html.indexOf(marker);if(start<0)throw Error('missing host mount');
  const stop=html.indexOf('\n  });',start);if(stop<0)throw Error('missing host end');
  const expr=html.slice(start+'emitterUi='.length,stop+5);
  const runtime={get diagnostics(){return [];},configure(value){calls++;if(fail)throw Error('renderer rejected candidate');accepted=E.normalize(value);}};
  const update=()=>{notifications++;if(guideFail)throw Error('guide failed');};
  const factory=new Function('FxEmitterUi','holder','cfg','multiFx','updateEmitterHandles','state','return '+expr.replace('bakeBusy||loading||rendererBusy','state.locked'));
  const state={locked:false};
  const ui=factory(g.FxEmitterUi,parent,cfg,runtime,update,state);
  const fire=(id,event,value)=>{const node=parent.find(id);A.ok(node,'missing '+id);if(value!==undefined){if(typeof value==='boolean')node.checked=value;else node.value=String(value);}node.listeners[event]();};
  const snapshot=()=>({doc:JSON.stringify(ui.document),cfg:JSON.stringify(cfg.multiEmitters),accepted:JSON.stringify(accepted),selection:JSON.stringify(ui.getSelected())});
  return {ui,parent,fire,snapshot,get calls(){return calls;},get notifications(){return notifications;},setFail:v=>fail=v,setLocked:v=>state.locked=v,setGuideFail:v=>guideFail=v};
 }
 const cases=[
  ['position',f=>f.fire('fxEmitterX','change',123)],
  ['drag',f=>A.equal(f.ui.setFromScene('emitter','emitter1',222,333),false)],
  ['add emitter',f=>f.fire('fxEmitterAdd','click')],
  ['delete emitter',f=>f.fire('fxEmitterDelete','click')],
  ['duplicate emitter',f=>f.fire('fxEmitterDuplicate','click')],
  ['add layer',f=>f.fire('fxEmitterLayerAdd','click')],
  ['delete layer',f=>f.fire('fxEmitterLayerDelete','click')],
  ['toggle',f=>f.fire('fxEmitterVisible','change',false)]
 ];
 for(const [name,action] of cases)T('rejected '+name+' preserves UI, host and selection',()=>{
  const f=fixture(),before=f.snapshot(),x=f.parent.find('fxEmitterX').value;
  action(f);A.deepEqual(f.snapshot(),before);A.equal(f.calls,1);A.equal(f.notifications,0);
  A.equal(f.parent.find('fxEmitterX').value,x);A.equal(f.parent.find('fxEmitterVisible').checked,true);
  A.ok(/renderer rejected/.test(f.parent.find('fxEmitterStatus').textContent));
 });
 T('locked controls restore accepted values without renderer call',()=>{
  const f=fixture(),before=f.snapshot();f.setLocked(true);f.fire('fxEmitterX','change',23);
  A.deepEqual(f.snapshot(),before);A.equal(f.calls,0);A.equal(f.parent.find('fxEmitterX').value,String(f.ui.document.emitters[0].x));
  A.equal(f.ui.setFromScene('emitter','emitter1',3,4),false);A.equal(f.calls,0);
 });
 T('invalid normalized field does not publish or invoke renderer',()=>{
  const f=fixture(),before=f.snapshot();f.fire('fxEmitterName','change','');A.deepEqual(f.snapshot(),before);A.equal(f.calls,0);
  A.equal(f.parent.find('fxEmitterName').value,f.ui.document.emitters[0].name);
 });
 T('successful mutation publishes same document then guides once; successful add selects new ID',()=>{
  const f=fixture();f.setFail(false);f.fire('fxEmitterX','change',123);
  let s=f.snapshot();A.equal(s.doc,s.cfg);A.equal(s.doc,s.accepted);A.equal(f.ui.document.emitters[0].x,123);A.equal(f.calls,1);A.equal(f.notifications,1);
  f.fire('fxEmitterAdd','click');s=f.snapshot();A.equal(s.doc,s.cfg);A.equal(s.doc,s.accepted);A.equal(f.ui.document.emitters.length,3);
  A.equal(f.ui.getSelected().emitterId,f.ui.document.emitters[2].id);A.equal(f.calls,2);A.equal(f.notifications,2);
 });
 T('guide failure after commit is not reported as rejected mutation',()=>{
  const f=fixture();f.setFail(false);f.setGuideFail(true);
  A.equal(f.ui.setFromScene('emitter','emitter1',222,333),true);
  const s=f.snapshot();A.equal(s.doc,s.cfg);A.equal(s.doc,s.accepted);A.equal(f.calls,1);A.equal(f.notifications,1);
  A.ok(/Settings accepted; UI refresh failed/.test(f.parent.find('fxEmitterStatus').textContent));
 });
 T('rejected edit can retry once with accepted baseline and unrelated emitter unchanged',()=>{
  const f=fixture(),sibling=JSON.stringify(f.ui.document.emitters[1]);
  f.fire('fxEmitterX','change',123);f.setFail(false);f.fire('fxEmitterX','change',456);
  const s=f.snapshot();A.equal(s.doc,s.cfg);A.equal(s.doc,s.accepted);A.equal(f.calls,2);A.equal(f.notifications,1);
  A.equal(f.ui.document.emitters[0].x,456);A.equal(JSON.stringify(f.ui.document.emitters[1]),sibling);
 });
}
module.exports={suite};
if(require.main===module)suite(p=>fs.readFileSync(path.join(ROOT,p),'utf8'),assert,test);
