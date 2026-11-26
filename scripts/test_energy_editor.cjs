'use strict';
// Native pinned CPU objects, fixture DOM/application initialization and asset decoding.
async function run(read,A){
 const base='assets/energy-projectile/src/',shared='assets/template/src/',vendor='assets/template/vendor/',win={};
 const doc={createElement:()=>({style:{},getContext:()=>null}),createElementNS:()=>({style:{}})};
 const P=new Function('navigator','document','window','self',read(vendor+'pixi-8.22.0.min.js')+'\nreturn PIXI;')({userAgent:'Chromium',platform:'Linux'},doc,win,win);win.PIXI=P;
 const Sp=new Function('PIXI','window','self','require',read(vendor+'spine-pixi-v8-4.2.120.min.js')+'\nreturn spine;')(P,win,win,n=>{if(n==='pixi.js')return P;throw Error(n);});
 const G={};for(const path of [...['curve','spacing','path','color'].map(n=>shared+n+'-core.js'),...['core','anchors','runtime','pose','authoring'].map(n=>base+'energy-'+n+'.js')])new Function('globalThis','module','require',read(path))(G,undefined,undefined);
 const H=G.FxEnergyProjectile,U=G.FxEnergyAuthoring;
 class Element{constructor(){this.children=[];this.style={};this.dataset={};this.validity={valid:true};this._value='';this.checked=false;this.hidden=false;this.disabled=false;this.textContent='';}
  set value(v){this._value=String(v);}get value(){return this._value;}append(...v){this.children.push(...v);}prepend(...v){this.children.unshift(...v);}replaceChildren(...v){this.children=v;}setAttribute(){}setPointerCapture(){}getBoundingClientRect(){return {left:10,top:20,width:256,height:256};}}
 const ui=read(base+'ui.html'),ids=[...ui.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]),nodes=Object.fromEntries(ids.map(id=>[id,new Element()]));A.equal(new Set(ids).size,ids.length);
 for(const [k,v] of Object.entries({layer:'core',curveKey:'pulse',anchorScope:'emitter',backend:'webgl2',speed:'1',sampleData:'{}'}))if(k==='sampleData')nodes[k].textContent=v;else nodes[k].value=v;
 const document={getElementById:id=>{if(!nodes[id])throw Error('Unknown id '+id);return nodes[id];},createElement:()=>new Element()};
 function Option(label,value){return {label,value};}
 const apps=[],assets=[];let close,curve,palette,failGpu=false,failAsset=false,pending=null,raf;
 class App{constructor(){this.stage=new P.Container();this.canvas=new Element();apps.push(this);}async init(o){if(o.preference==='webgpu'&&failGpu)throw Error('no GPU');this.renderer=o.preference==='webgpu'?{gpu:{device:{}}}:{gl:{},context:{webGLVersion:o.preferWebGLVersion}};}render(){}destroy(){this.dead=true;this.stage.destroy({children:true});}}
 function asset(source){const data={skeleton:{spine:'4.2.43'},bones:[{name:'root'},{name:'weapon',parent:'root',x:20}],slots:[],skins:[{name:'default',attachments:{}}],animations:{idle:{bones:{root:{translate:[{x:0},{time:1,x:120}]}}}}};const model=new Sp.Spine({skeletonData:new Sp.SkeletonJson({}).readSkeletonData(data),autoUpdate:false});model.update(0);let a={model,source,defaultAnimation:'idle',defaultSkin:'default',animations:['idle'],skins:['default'],destroy(){if(this.dead)return;this.dead=true;model.removeFromParent();model.destroy();}};assets.push(a);return a;}
 const loader={sample:()=>({name:'sample.json'}),anchorPoses:()=>({}),async create(source){if(failAsset)throw Error('bad asset');if(source.name==='pending')return new Promise(resolve=>{pending=()=>resolve(asset(source));});return asset(source);}};
 const env={...G,document,Option,PIXI:{...P,Application:App},spine:Sp,FxShockwaveSpine:loader,FxCurveEditor:{mount(h,o){curve=o;}},FxColorUi:{mount(h,o){palette=o;}},addEventListener:(n,f)=>{close=f;},requestAnimationFrame:f=>{raf=f;return 1;},cancelAnimationFrame(){}};
 const m={exports:{}};new Function('module','globalThis',read(base+'energy-editor.js'))(m,env);const editor=m.exports.mount(env);
 A.equal(await editor.ready,true);A.equal(nodes.actual.textContent,'webgl2');A.equal(editor.session.meta.frames,40);
 const cfg=()=>JSON.parse(nodes.preset.value),field=(host,key)=>nodes[host].children.flatMap(x=>x.children).find(x=>x.dataset.field===key),change=(host,key,value)=>{const el=field(host,key);A.ok(el,key);if(el.type==='checkbox')el.checked=value;else el.value=value;el.onchange();};
 const near=(a,b)=>A.ok(Math.abs(a-b)<1e-6,a+' != '+b);
 nodes.frame.value=15;nodes.frame.oninput();const head=nodes.head.style.left,origin=nodes.handle.style.left;nodes.frame.value=20;nodes.frame.oninput();A.notEqual(nodes.head.style.left,head);A.equal(nodes.handle.style.left,origin);
 change('general','travelSpeed',400);A.equal(cfg().travelSpeed,400);change('general','coreRadius',2);A.equal(editor.session.settings.coreRadius,20);A.equal(nodes.status.dataset.error,'true');
 change('layerFields','x',12);A.equal(cfg().emitters[0].layers.core.x,12);A.equal(cfg().emitters[0].layers.ribbon.x,0);
 nodes.handle.onkeydown({key:'ArrowRight',preventDefault(){}});near(cfg().emitters[0].layers.core.x,13);
 const before=cfg().trajectory.segments[0].p3.slice();nodes.p3.onkeydown({key:'ArrowDown',preventDefault(){}});near(cfg().trajectory.segments[0].p3[1],before[1]+1);A.deepEqual(cfg().trajectory.segments[0].p3,cfg().trajectory.segments[1].p0);
 const n=cfg().trajectory.segments.length;nodes.splitSegment.onclick();A.equal(cfg().trajectory.segments.length,n+1);A.deepEqual(cfg().trajectory.segments[0].p3,cfg().trajectory.segments[1].p0);
 change('general','mode','flightLoop');A.equal(cfg().trajectory.closed,true);A.deepEqual(cfg().trajectory.segments[0].p0,cfg().trajectory.segments.at(-1).p3);A.ok(editor.session.meta.frames>6);const meta=editor.session.meta;editor.session.seek(meta.duration-.005);near(editor.session.seconds,meta.duration-.005);
 change('general','mode','oneShot');A.equal(cfg().trajectory.closed,false);A.equal(editor.session.meta.frames,40);
 const pp=JSON.parse(JSON.stringify(cfg().curves.pulse));pp.keys[1].y=1.5;curve.onChange(pp);A.equal(cfg().curves.pulse.keys[1].y,1.5);
 const color=JSON.parse(JSON.stringify(cfg().palettes.core));color.stops[0].rgba[0]=10;palette.onChange(color);A.equal(cfg().palettes.core.stops[0].rgba[0],10);
 nodes.addEmitter.onclick();A.equal(cfg().emitters.length,2);A.equal(nodes.emitter.value,'emitter-2');nodes.removeEmitter.onclick();A.equal(cfg().emitters.length,1);
 nodes.frame.value=35;nodes.frame.oninput();change('general','durationFrames',20);A.equal(nodes.frame.value,'19');const old=editor.session.settings;nodes.preset.value='{}';nodes.apply.onclick();A.equal(editor.session.settings,old);A.equal(nodes.status.dataset.error,'true');
 nodes.defaults.onclick();A.equal(cfg().durationFrames,40);await nodes.sample.onclick();A.equal(editor.session.asset,assets[0]);A.equal(nodes.animation.value,'idle');change('anchorFields','type','bone');nodes.frame.value=12;nodes.frame.oninput();const first=editor.session.sample;nodes.frame.value=18;nodes.frame.oninput();nodes.frame.value=12;nodes.frame.oninput();A.deepEqual(editor.session.sample,first);
 failAsset=true;A.equal(await nodes.sample.onclick(),false);A.equal(editor.session.asset,assets[0]);A.equal(assets[0].dead,undefined);failAsset=false;
 nodes.speed.value=2;nodes.speed.onchange();A.equal(editor.session.options.speed,2);const preset=editor.session.settings,at=editor.session.seconds;
 failGpu=true;nodes.backend.value='webgpu';A.equal(await nodes.backend.onchange(),true);A.equal(nodes.actual.textContent,'webgl2 (fallback from webgpu)');A.equal(editor.session.options.speed,2);A.deepEqual(editor.session.settings,preset);near(editor.session.seconds,at);A.ok(assets[0].dead);
 await nodes.remove.onclick();A.equal(editor.session.asset,null);A.ok(editor.session.missing.includes('emitter-1:core'));A.equal(nodes.handle.hidden,true);
 const w=U.pointer(138,148,{left:10,top:20,width:256,height:256});A.deepEqual(w,{x:256,y:256});const basis={x:10,y:20,rotation:45,scale:2},v=U.transform(basis,3,7),inv=U.inverse(basis,v.x,v.y);near(inv.x,3);near(inv.y,7);
 const closed=U.mode(H.defaults(),'flightLoop'),moved=U.movePoint(closed.trajectory,0,'p0',[4,9]);A.deepEqual(moved.segments[0].p0,moved.segments.at(-1).p3);A.notEqual(moved.segments[0].p1[0],closed.trajectory.segments[0].p1[0]);
 nodes.files.files=[{name:'pending',arrayBuffer(){}},{name:'file.atlas'},{name:'page.png'}]; // direct session async lifecycle fixture
 const waiting=editor.session.replaceSource({name:'pending'});close();pending();await A.rejects(()=>waiting,/destroyed/);A.ok(assets.every(a=>a.dead));A.ok(apps.filter(a=>a.renderer).every(a=>a.dead));A.equal(editor.session,null);
}
module.exports={run};
if(require.main===module){const fs=require('node:fs'),path=require('node:path'),root=path.resolve(__dirname,'..');require('node:test').test('Energy editor authoring and lifecycle',()=>run(p=>fs.readFileSync(path.join(root,p),'utf8'),require('node:assert/strict')));}
