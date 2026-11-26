'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
async function runEditorScenarios(sources,editor,ui,assert){
 let downloads=0,pending,request;const G={FxSwordSlashPose:{pose(a,t,o){if(a){a.model.visible=o.visible;a.model.skeleton.bones[0].worldX=t*180*o.speed;}return {};}}};
 for(const src of sources)new Function('globalThis','module','require',src)(G,undefined,undefined);
 class Element{
  constructor(tag='div'){this.tag=tag;this.children=[];this.style={};this.dataset={};this.validity={valid:true};this._value='';this.checked=false;this.hidden=false;this.disabled=false;this.textContent='';}
  set value(v){this._value=String(v);}get value(){return this._value;}
  append(...v){this.children.push(...v);}prepend(...v){this.children.unshift(...v);}add(v){this.append(v);}
  replaceChildren(...v){this.children=v;}setAttribute(){}setPointerCapture(){}click(){downloads++;}remove(){}
  getBoundingClientRect(){return {left:0,top:0,width:512,height:512};}
 }
 const nodes=Object.fromEntries([...ui.matchAll(/\bid="([^"]+)"/g)].map(m=>[m[1],new Element()]));
 Object.assign(nodes.layer,{value:'main'});Object.assign(nodes.curveKey,{value:'reveal'});Object.assign(nodes.backend,{value:'webgl2'});Object.assign(nodes.speed,{value:'1'});nodes.showSpine.checked=true;nodes.sampleData.textContent='{}';for(const [k,v] of Object.entries({x:0,y:0,width:512,height:512,frames:3}))nodes['export-'+k].value=v;
 const document={getElementById:id=>{if(!nodes[id])throw Error('Unknown id '+id);return nodes[id];},createElement:tag=>new Element(tag),body:new Element()};
 function Option(label,value){return {label,value};}
 class Container{constructor(){this.children=[];}addChild(...c){for(const x of c){x.parent=this;this.children.push(x);}}toLocal(p){return {...p};}}
 class GL2{}
 const apps=[],assets=[],renderers=[];let rejectGPU=false,close,curve,palette;
 class App{constructor(){this.stage=new Container();this.canvas=new Element('canvas');apps.push(this);}async init(o){if(o.preference==='webgpu'&&rejectGPU)throw Error('GPU unavailable');this.renderer=o.preference==='webgpu'?{gpu:{device:{}},type:2}:{gl:o.preferWebGLVersion===2?new GL2():{}};}render(){}destroy(){this.dead=true;}}
 const loader={sample:()=>({name:'fixture'}),anchorPoses:()=>({}),async create(source){const b={active:true,a:1,b:0,c:0,d:1,worldX:0,worldY:0,data:{name:'weapon'}};const m={skeleton:{bones:[b],slots:[],findBone:n=>n==='weapon'?b:null},visible:true};const a={model:m,source,defaultAnimation:'swing',defaultSkin:'base',animations:['swing'],skins:['base'],destroy(){this.dead=true;}};assets.push(a);return a;}};
 const runtime={createRenderer({compile,settings}){const plan=compile(settings),r={settings:plan.settings,meta:plan.meta,seek:t=>plan.sample(t),destroy(){this.dead=true;}};renderers.push(r);return r;}};
 // Actual compiler/session/kernels. DOM, GPU, Spine pose/asset decoder are fixtures.
 const env={...G,document,Option,URL:{createObjectURL:()=> 'blob:test',revokeObjectURL(){}},Blob:class {},setTimeout:fn=>fn(),FxShieldExport:{},FxSwordSlashBake:{sceneFactory:()=>()=>{}},FxSwordSlashExport:{bakeSequence(p){request=p;return new Promise(resolve=>{pending=()=>{p.progress(3,3);resolve({zip:new Uint8Array(1)});};});}},PIXI:{Application:App,Container,RendererType:{WEBGPU:2}},spine:{},WebGL2RenderingContext:GL2,window:{addEventListener:(name,fn)=>{if(name==='pagehide')close=fn;}},requestAnimationFrame:()=>1,cancelAnimationFrame:()=>{},FxShockwaveSpine:loader,FxSwordSlashRuntime:runtime,FxCurveEditor:{mount(h,o){curve=o;}},FxColorUi:{mount(h,o){palette=o;}}};
 new Function(...Object.keys(env),editor)(...Object.values(env));
 for(let i=0;i<12;i++)await Promise.resolve();
 const cfg=()=>JSON.parse(nodes.preset.value);
 const field=(host,key)=>nodes[host].children.flatMap(x=>x.children).find(x=>x.dataset?.field===key);
 function change(host,key,v){const e=field(host,key);assert.ok(e,key);if(e.type==='checkbox')e.checked=v;else e.value=v;e.onchange();}
 const actualPath=()=>G.FxSwordSlash.compile(cfg().effect).meta.path.segments;
 const near=(a,b)=>assert.ok(Math.hypot(a[0]-b[0],a[1]-b[1])<1e-8,'opposite actual endpoint moved');
 assert.equal(document.body.dataset.ready,'true');assert.equal(nodes.actual.textContent,'WEBGL2');assert.equal(cfg().effect.exportFrames,40);
 change('general','pathMode','custom');const before=actualPath().at(-1).p3;
 const x=Number(field('endpoints','startX').value);change('endpoints','startX',x+3);
 near(actualPath().at(-1).p3,before);assert.equal(nodes.startHandle.hidden,false);
 const s0=actualPath()[0].p0;nodes.endHandle.onkeydown({key:'ArrowRight',preventDefault(){}});
 near(actualPath()[0].p0,s0);
 change('layerFields','x',12);assert.equal(cfg().effect.layers.edge.x,0);
 const cc=JSON.parse(JSON.stringify(cfg().effect.curves.reveal));cc.keys[1].y=.5;curve.onChange(cc);assert.equal(cfg().effect.curves.reveal.keys[1].y,.5);
 const pp=JSON.parse(JSON.stringify(cfg().effect.palettes.main));pp.stops[0].rgba[0]=44;palette.onChange(pp);assert.equal(cfg().effect.palettes.main.stops[0].rgba[0],44);
 nodes.frame.value=35;nodes.frame.oninput();change('general','exportFrames',10);assert.equal(nodes.frame.value,'9');const snapshot=nodes.preset.value;nodes.preset.value='{}';nodes.apply.onclick();assert.equal(nodes.status.dataset.error,'true');nodes.preset.value=snapshot;
 change('layerFields','trajectory','recorded');assert.equal(cfg().trajectory.main,'authored');
 await nodes.sample.onclick();assert.equal(assets.length,2);assert.equal(assets[1].model.visible,false);
 change('anchorFields','type','bone');change('layerFields','trajectory','recorded');assert.equal(cfg().trajectory.main,'recorded',nodes.status.textContent);assert.equal(nodes.startHandle.hidden,true);assert.equal(field('general','arcAngle').disabled,true);
 nodes.speed.value=2;nodes.speed.onchange();assert.equal(nodes.speed.value,'2');
 nodes.backend.value='webgl1';await nodes.backend.onchange();assert.equal(nodes.actual.textContent,'WEBGL1');assert.equal(cfg().trajectory.main,'recorded');assert.equal(nodes.speed.value,'2');assert.equal(nodes.frame.value,'9');assert.ok(assets.slice(0,2).every(a=>a.dead));
 rejectGPU=true;nodes.backend.value='webgpu';await nodes.backend.onchange();assert.equal(nodes.actual.textContent,'WEBGL1');assert.equal(nodes.backend.value,'webgl1');assert.equal(cfg().trajectory.main,'recorded');
 await nodes.remove.onclick();assert.equal(cfg().trajectory.main,'recorded');assert.equal(nodes.assetName.textContent,'fixture');
 change('layerFields','trajectory','authored');await nodes.remove.onclick();assert.equal(nodes.assetName.textContent,'No Spine asset');
 const oldPreset=nodes.preset.value,oldFrame=nodes.frame.value;
 const first=nodes.exportPng.onclick();assert.equal(nodes.controls.disabled,true);assert.equal(nodes.exportFields.disabled,true);assert.equal(request.frameCount,3);assert.equal(request.backend,'webgl1');assert.equal(request.crop.width,512);assert.equal(await nodes.exportPng.onclick(),false);
 nodes.cancelExport.onclick();pending();assert.equal(await first,false);assert.equal(downloads,0);assert.equal(nodes.controls.disabled,false);assert.equal(nodes.cancelExport.disabled,true);assert.equal(nodes.preset.value,oldPreset);assert.equal(nodes.frame.value,oldFrame);
 const second=nodes.exportPng.onclick();pending();assert.equal(await second,true);assert.equal(downloads,1);assert.equal(nodes.exportCount.textContent,'3 / 3');assert.equal(nodes.preset.value,oldPreset);assert.equal(nodes.frame.value,oldFrame);
 const third=nodes.exportPng.onclick();close();pending();assert.equal(await third,false);assert.equal(downloads,1);assert.ok(assets.every(a=>a.dead));assert.ok(renderers.every(r=>r.dead));assert.ok(apps.filter(a=>a.renderer).every(a=>a.dead));
}

const root=path.join(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const paths=["assets/template/src/curve-core.js","assets/template/src/spacing-core.js","assets/template/src/path-core.js","assets/template/src/color-core.js","assets/sword-slash/src/sword-slash-core.js","assets/sword-slash/src/sword-slash-anchors.js","assets/sword-slash/src/sword-slash-history.js","assets/sword-slash/src/sword-slash-authoring.js","assets/magic-shield/src/shield-export-ui.js"];
test('Sword Slash editor orchestration (DOM, GPU and Spine loader fixtures)',async()=>runEditorScenarios(paths.map(read),read('assets/sword-slash/src/sword-slash-editor.js'),read('assets/sword-slash/src/ui.html'),assert));
