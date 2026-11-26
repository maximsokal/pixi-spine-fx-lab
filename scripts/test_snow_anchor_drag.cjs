'use strict';
const {test}=require('node:test'),A=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const read=name=>fs.readFileSync(path.join(__dirname,'../assets/snowfall/src',name),'utf8');
const editor=read('snow-editor.js'),runtime=read('snow-runtime.js');
// Exercise actual DOM wiring and resolver, with deterministic scene/DOM doubles.
function section(code,start,end,from=0){const a=code.indexOf(start,from),b=code.indexOf(end,a+start.length);A.ok(a>=0&&b>a,start);return code.slice(a,b);}
const helper=editor.includes(' function originDelta(')?section(editor,' function originDelta(',' function mount('):'';
const handles=section(editor,'  function updateHandles(){','  function attempt(');
const wiring=section(editor,"  for(const kind of ['origin',...Core.LAYERS]){",'  refresh();switchScene(null);',editor.indexOf("$('presetFile').onchange"));
const resolver=section(runtime,'  function fromSpine(','  function pose(');
const near=(a,b)=>A.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
function fixture(type,space='local',zoom=2){
 const bone={active:true,worldX:40,worldY:60,a:0,b:-2,c:3,d:0};
 const at={name:'tip',computeWorldVertices(slot,out){out.set([30,50,50,50,50,70,30,70]);}};
 const model={skeleton:{findBone:n=>n==='head'?bone:null,findSlot:n=>n==='body'?{bone,getAttachment:()=>at}:null},toGlobal:({x,y})=>({x:100+2*x,y:200+3*y})};
 const stage={toLocal:p=>p},offset={x:0,y:0};
 const resolve=vm.runInNewContext(resolver+'\nresolveAnchor',{model,stage,offset,finite:p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)});
 const a={type,space,name:type==='attachment'?'tip':type==='slot'?'body':'head',slot:'body',x:4,y:5,rotation:0};
 const settings={emitters:[{id:'e1',anchor:a,rotation:0,layers:{near:{x:0,y:0,anchor:{type:'inherit'}},far:{},windSwirls:{}}}]};
 const nodes=Object.fromEntries(['origin','near','far','windSwirls'].map(k=>['handle-'+k,{style:{},hidden:true,setPointerCapture(){}}]));
 nodes.preview={getBoundingClientRect:()=>({width:514*zoom,height:514*zoom})};
 const scene={app:{canvas:{getBoundingClientRect:()=>({width:512*zoom,height:512*zoom})}},fx:{resolveAnchor:resolve,emitters:new Map()}};
 const session={settings,edit(fn){fn(settings);}};let error=null;
 const ctx={scene,session,selection:c=>c.emitters[0],Core:{LAYERS:['near','far','windSwirls']},$:id=>nodes[id],busy:false,refresh(){},attempt(fn){try{fn();}catch(e){error=e;}}};
 vm.runInNewContext(helper+handles+wiring+'\nupdateHandles();',ctx);
 const h=nodes['handle-origin'];
 return {a,bone,h,resolve,ctx,error:()=>error,drag(dx,dy){h.onpointerdown({clientX:100,clientY:100,pointerId:1,preventDefault(){}});h.onpointermove({clientX:100+dx*zoom,clientY:100+dy*zoom,pointerId:1});h.onpointerup();}};
}
for(const type of ['skeleton','bone','slot','attachment'])test('origin follows '+type+' and local drag inverts the actual resolver transform',()=>{
 const f=fixture(type),p=f.resolve(f.a);A.equal(f.h.hidden,false);near(parseFloat(f.h.style.left),p.x);near(parseFloat(f.h.style.top),p.y);
 f.drag(18,-12);const q=f.resolve(f.a);near(q.x-p.x,18);near(q.y-p.y,-12);A.equal(f.error(),null);
});
for(const zoom of [.5,1,2])test('world-space anchor drag at '+zoom+'x zoom ignores preview border',()=>{
 const f=fixture('bone','world',zoom),p=f.resolve(f.a);A.equal(f.h.hidden,false);f.drag(14,-8);const q=f.resolve(f.a);near(q.x-p.x,14);near(q.y-p.y,-8);
});
test('free world anchor drag remains independent of preview border',()=>{const f=fixture('world'),p=f.resolve(f.a);A.equal(f.h.hidden,false);f.drag(20,10);const q=f.resolve(f.a);near(q.x-p.x,20);near(q.y-p.y,10);});
test('inactive anchor hides origin without jumping to zero',()=>{const f=fixture('bone');f.bone.active=false;vm.runInNewContext('updateHandles()',f.ctx);A.equal(f.h.hidden,true);const before={...f.a};f.drag(10,10);A.deepEqual(f.a,before);});
test('singular local transform rejects drag without corrupting anchor',()=>{const f=fixture('bone');f.bone.a=f.bone.b=f.bone.c=f.bone.d=0;const before={...f.a};A.equal(f.h.hidden,false);f.drag(10,10);A.deepEqual(f.a,before);A.match(String(f.error()),/anchor transform/);});
