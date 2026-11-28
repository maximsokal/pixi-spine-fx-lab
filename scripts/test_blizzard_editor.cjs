'use strict';
function run(read,A,T){
 const base='assets/blizzard/src/',vendor='assets/template/vendor/',g={},dom={createElement:()=>({style:{},getContext:()=>null}),createElementNS:()=>({style:{}})},win={};
 for(const p of ['assets/template/src/curve-core.js','assets/template/src/spacing-core.js','assets/template/src/color-core.js',base+'blizzard-core.js',base+'blizzard-runtime.js',base+'blizzard-pose.js'])new Function('globalThis',read(p))(g);
 const P=new Function('navigator','document','window','self',read(vendor+'pixi-8.22.0.min.js')+'\nreturn PIXI;')({userAgent:'Chromium',platform:'Linux'},dom,win,win);win.PIXI=P;
 const Sp=new Function('PIXI','window','self','require',read(vendor+'spine-pixi-v8-4.2.120.min.js')+'\nreturn spine;')(P,win,win,n=>{if(n==='pixi.js')return P;throw Error(n);});
 const B=g.FxBlizzard,Pose=g.FxBlizzardPose,src=read(base+'blizzard-editor.js'),html=read(base+'ui.html');
 function editor(root=g,document=dom){const m={exports:{}};new Function('globalThis','module','require','document',src)(root,m,()=>{throw Error('unexpected require');},document);return m.exports;}
 const E=editor(),clone=v=>JSON.parse(JSON.stringify(v)),close=(a,b,e=1e-7)=>A.ok(Math.abs(a-b)<=e,a+' != '+b);
 T('session rollback, validated mode change and selected emitter identity',()=>{
  let configs=0,seeks=0,fail=false,last=null;
  const s=E.createSession(B.defaults(),{configure(c,t){if(fail)throw Error('fixture configure failure');configs++;last={c,t};},seek(){seeks++;}});
  s.edit(c=>c.windSpeed=500);s.seek(.3);A.equal(configs,1);A.equal(seeks,1);const old=s.settings;
  fail=true;A.throws(()=>s.setMode('oneShot',40),/fixture/);A.equal(s.settings,old);close(s.time,.3);
  fail=false;s.setMode('oneShot',40);A.equal(last.c.mode,'oneShot');A.equal(last.t,0);A.equal(s.time,0);
  A.throws(()=>s.edit(c=>c.windSpeed=901));A.equal(s.settings.windSpeed,500);
  s.add();s.duplicate();s.add();A.equal(new Set(s.settings.emitters.map(e=>e.id)).size,4);A.throws(()=>s.add());
  for(let i=0;i<4;i++)s.remove();A.equal(s.selectedId,null);A.equal(s.settings.emitters.length,0);
 });
 T('preset roundtrip, strict schema and budget failure',()=>{
  const s=E.createSession(B.defaults()),saved=s.serialize();s.edit(c=>c.angle=-48);s.importPreset(saved);A.equal(s.settings.angle,35);
  for(const invalid of [null,{schemaVersion:2,effectId:'fx.air.blizzard',settings:B.defaults()},{schemaVersion:1,effectId:'fx.air.snowfall',settings:B.defaults()},{...JSON.parse(saved),unexpected:1}])A.throws(()=>s.importPreset(JSON.stringify(invalid)));
  const bad=B.defaults();bad.particleRate=400;bad.quality='low';A.throws(()=>s.replace(bad));A.equal(s.serialize(),saved);A.throws(()=>s.replace(B.defaults(),NaN));A.equal(s.serialize(),saved);
 });
 T('absolute timeline wraps at authored period, not export frame count',()=>{
  const s=E.createSession(B.defaults());s.setMode('loop',600);s.edit(c=>c.exportFrames=60);s.seek(9.9);s.play();s.tick(.2);close(s.time,.1);
  s.reverse();s.tick(.2);close(s.time,9.9);s.setMode('oneShot',40);s.reverse();s.play();s.tick(1);close(s.time,39/60);A.equal(s.playing,false);
  s.reverse();s.play();s.tick(1);A.equal(s.time,0);A.equal(s.playing,false);
 });
 T('Spine 4.2 metadata gate and actual binary reader, malformed headers rejected',()=>{
  for(const v of ['4.2.0','4.2.43','4.2.120']){A.equal(E.spineVersion({skeleton:{spine:v}},false,Sp),v);const raw=new Uint8Array(9+v.length);raw[8]=v.length+1;for(let i=0;i<v.length;i++)raw[9+i]=v.charCodeAt(i);A.equal(E.spineVersion(raw,true,Sp),v);}
  for(const v of [null,42,'4.3.0','4.2.','4.2.foo','4.2.43x','3.8.99'])A.throws(()=>E.spineVersion({skeleton:{spine:v}},false,Sp));
  for(const raw of [new Uint8Array(0),new Uint8Array(9),new Uint8Array(64).fill(255)])A.throws(()=>E.spineVersion(raw,true,Sp));
 });
 T('actual atlas parser and selected-file preflight preserve unique page mapping',()=>{
  const atlas=new Sp.TextureAtlas('nested/a.png\nsize: 16, 16\nfilter: Linear, Linear\npma: true\n\nb.png\nsize: 16, 16\nfilter: Linear, Linear\npma: false\n');
  A.deepEqual(atlas.pages.map(p=>p.name),['nested/a.png','b.png']);
  A.deepEqual(E.pageBindings(atlas.pages,new Map([['a.png',{}],['b.png',{}]])),[{name:'nested/a.png',key:'a.png'},{name:'b.png',key:'b.png'}]);
  A.throws(()=>E.pageBindings(atlas.pages,new Map([['x/a.png',{}],['y/a.png',{}],['b.png',{}]])));
  A.throws(()=>E.pageBindings([{name:'../a.png'}],new Map([['a.png',{}]])));
  A.throws(()=>E.pageBindings([{name:'a.png'},{name:'a.png'}],new Map([['a.png',{}]])));
  A.throws(()=>E.pageBindings(atlas.pages,new Map([['a.png',{}]])));
  const files=['rig.json','rig.atlas','a.png','b.png'].map(name=>({name,size:100}));A.equal(E.selectFiles(files).images.size,2);
  A.throws(()=>E.selectFiles([...files,files[2]]),/Duplicate/);A.throws(()=>E.selectFiles(files.slice(0,2)));A.throws(()=>E.selectFiles([...files,{name:'huge.png',size:193*1024*1024}]),/budget/);
  A.deepEqual(E.originDelta(a=>({x:5+2*a.x+3*a.y,y:7-a.x+4*a.y}),{x:0,y:0},8,5),{x:17/11,y:18/11});
  A.equal(E.originDelta(a=>({x:a.x+a.y,y:a.x+a.y}),{},1,2),null);
 });
 T('actual Spine physics setup and animation: fixed-step oracle, reverse, loop and skin failure recovery',()=>{
  const data=new Sp.SkeletonJson({}).readSkeletonData({skeleton:{spine:'4.2.43'},bones:[{name:'root'},{name:'weapon',parent:'root',x:20,length:40}],physics:[{name:'lag',bone:'weapon',x:1,y:1,rotate:1,step:60,inertia:1,strength:20,damping:.7,wind:5,gravity:3}],animations:{idle:{bones:{root:{translate:[{x:0},{time:.5,x:80},{time:1,x:0}]}}}}});
  const create=()=>new Sp.Spine({skeletonData:data,autoUpdate:false}),snap=m=>{const b=m.skeleton.findBone('weapon');return [b.worldX,b.worldY,b.a,b.b,b.c,b.d,m.skeleton.time];},settings=B.defaults();
  function oracle(animation,frame){const m=create();m.state.clearTracks();m.skeleton.setSkin(null);m.skeleton.setToSetupPose();m.skeleton.time=0;for(const c of m.skeleton.physicsConstraints)c.reset();if(animation)m.state.setAnimation(0,animation,true);m.update(0);for(let i=0;i<frame;i++)m.update(1/60);const v=snap(m);m.destroy();return v;}
  const model=create();try{
   for(const animation of ['', 'idle'])for(const t of [.5,.2,.8,1,.5,1.5,0]){Pose.seek(model,settings,t,{animation});const want=oracle(animation,Math.floor(Pose.time(settings,t)*60+1e-8));snap(model).forEach((v,i)=>close(v,want[i]));}
   Pose.seek(model,settings,.5);A.ok(Math.abs(snap(model)[0]-20)>1);
   A.throws(()=>Pose.seek(model,settings,.2,{animation:'missing'}));Pose.seek(model,settings,.5);snap(model).forEach((v,i)=>close(v,oracle('',30)[i]));
   A.equal(Pose.time({...settings,mode:'oneShot',durationFrames:40},10),39/60);A.throws(()=>Pose.time(settings,NaN));
  }finally{model.destroy();}
 });
 T('UI source contains all blueprint parameters and independent handles, no premature export',()=>{
  const doc=JSON.parse(read('references/fx/air/blizzard.md').match(/\x60\x60\x60json\s*\n([\s\S]*?)\n\x60\x60\x60/)[1]),ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
  A.equal(new Set(ids).size,ids.length);for(const m of src.matchAll(/\$\('([^']+)'\)/g))A.ok(ids.includes(m[1]),m[1]);
  for(const p of doc.parameters)A.ok(src.includes(p.key),p.key);for(const c of doc.curves)A.ok(src.includes("'"+c.key+"'"),c.key);
  for(const l of doc.layers)A.ok(ids.includes('handle-'+l.id));for(const id of ['bake','webglZip','webgpuZip'])A.ok(!ids.includes(id));
 });
 T('editor mount wires authoring controls to real CPU particle runtime using a DOM/app fixture',async()=>{
  const elements=new Map(),all=[],canvas=()=>({width:0,height:0,tagName:'canvas',getContext:()=>({createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData(){}}),remove(){},getBoundingClientRect:()=>({width:512,height:512})});
  class El{constructor(tag='div'){this.tagName=tag;this.children=[];this.style={};this.value='';this.type='';this.hidden=false;this.disabled=false;this.checked=false;this.classList={toggle(){}};all.push(this);}append(...v){this.children.push(...v);}prepend(v){this.children.unshift(v);}replaceChildren(){this.children=[];}querySelector(s){return this.children.find(c=>c.tagName===s)||null;}setPointerCapture(){}click(){this.onclick?.();}}
  for(const m of html.matchAll(/\bid="([^"]+)"/g))elements.set(m[1],new El());
  elements.get('backend').value='webgl2';elements.get('showSpine').checked=true;
  const document={getElementById:id=>elements.get(id),createElement:tag=>tag==='canvas'?canvas():new El(tag),querySelectorAll:()=>all};
  let curveMounts=0,gradientMounts=0;
  class Application{constructor(){this.stage=new P.Container();this.canvas=canvas();this.renderer={type:-1};this.ticker={add(){}};}async init(){}render(){}start(){}destroy(){this.stage.destroy({children:true});}}
  const root={...g,PIXI:{...P,Application},spine:Sp,FxCurveEditor:{mount(){curveMounts++;return {destroy(){}};}},FxColorUi:{mount(){gradientMounts++;return {destroy(){}};}}};
  new Function('globalThis','document',read(base+'blizzard-runtime.js'))(root,document);
  const app=editor(root,document).mount();for(let i=0;i<12&&app.busy;i++)await Promise.resolve();
  A.ok(app.scene,elements.get('status').textContent);A.equal(app.busy,false);A.equal(app.getActualBackend().actual,'unknown');A.equal(curveMounts,6);A.equal(gradientMounts,1);
  const speed=all.find(v=>v.id==='p-windSpeed');A.ok(speed);speed.value='456';speed.onchange();A.equal(app.getSettings().windSpeed,456);
  speed.value='';speed.onchange();A.equal(app.getSettings().windSpeed,456);A.equal(speed.value,'456');
  elements.get('frame').value='19';elements.get('frame').oninput();close(app.session.time,19/60);
  const before=app.session.serialize();elements.get('zoom').value='2';elements.get('zoom').onchange();elements.get('background').value='checker';elements.get('background').onchange();A.equal(app.session.serialize(),before);
  A.ok(elements.get('preview').style.transform.includes('2'));app.scene.dispose();
 });
}
module.exports={run};
if(require.main===module){const fs=require('node:fs'),path=require('node:path');run(p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8'),require('node:assert/strict'),require('node:test').test);}
