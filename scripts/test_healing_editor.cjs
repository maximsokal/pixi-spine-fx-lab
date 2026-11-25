'use strict';
const {test}=require('node:test'),A=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=p=>fs.readFileSync(path.resolve(__dirname,'..',p),'utf8');
const prefix='assets/healing-aura/src/',shared='assets/template/src/';
test('editor wires real core to controls, placement, timeline and backend lifecycle (DOM/Pixi fixtures)',async()=>{
 const html=read(prefix+'ui.html'),nodes=new Map(),downloads=[],requests=[];
 class Element{
  constructor(tag='div'){this.tagName=tag;this.children=[];this.dataset={};this.style={};this.validity={valid:true};this._value='';this.checked=false;}
  get value(){return this._value;}set value(v){this._value=String(v);}
  append(...v){this.children.push(...v);for(const child of v)child.parent=this;}click(){downloads.push(this.download);}prepend(v){this.children.unshift(v);v.parent=this;}
  add(v){this.children.push(v);}replaceChildren(...v){this.children=v;}setAttribute(){}setPointerCapture(){}
  getBoundingClientRect(){return {left:0,top:0,width:256,height:256};}
  remove(){if(this.parent){this.parent.children=this.parent.children.filter(c=>c!==this);this.parent=null;}}
 }
 for(const m of html.matchAll(/id="([^"]+)"/g)){A.ok(!nodes.has(m[1]));nodes.set(m[1],new Element());}
 const $=id=>{A.ok(nodes.has(id),'Missing '+id);return nodes.get(id);};
 $('layer').value='emitter';$('curveKey').value='glowCurve';$('speed').value='1';$('showSpine').checked=true;$('sampleData').textContent='{}';for(const [id,v] of Object.entries({cropX:0,cropY:0,cropWidth:512,cropHeight:512,exportFrames:''}))$(id).value=v;for(const id of ['runtimeLicenses','healing-core.js']){const n=new Element();n.textContent='fixture';nodes.set(id,n);}
 const body=new Element(),document={getElementById:$,createElement:t=>new Element(t),querySelectorAll:()=>[],body};
 class GL2{};let failBackend=false,failLoad=false,appDestroyed=0,assetDestroyed=0,fxDestroyed=0,scene;
 class Container{constructor(){this.children=[];}addChild(...v){this.children.push(...v);}}
 class Application{constructor(){this.stage=new Container();this.canvas=new Element('canvas');}async init(o){if(failBackend)throw Error('backend failed');this.renderer=o.preference==='webgpu'?{}:{gl:o.preferWebGLVersion===1?{}:new GL2()};}render(){}destroy(){appDestroyed++;}}
 const box={document,AbortController,Blob,URL:{createObjectURL:()=> 'blob:fixture',revokeObjectURL(){}},setTimeout:f=>{f();},Option:class{constructor(text,value){this.text=text;this.value=value;}},WebGL2RenderingContext:GL2,PIXI:{Application,Container},requestAnimationFrame(){},FxCurveEditor:{mount(h,o){box.curve=o;}},FxColorUi:{mount(h,o){box.palette=o;return {refresh(){}};}},FxShockwaveSpine:{sample(){return {name:'sample.json'};},async create(source){if(failLoad)throw Error('load failed');return {source,model:{skeleton:{bones:[{active:true,data:{name:'head'}}]}},animations:['idle'],skins:['default'],defaultAnimation:'idle',defaultSkin:'default',destroy(){assetDestroyed++;}};},pose(){return {$local:{x:100,y:100,rotation:0,scale:1},head:{x:120,y:110,rotation:0,scale:1}};}}};
 const ctx=vm.createContext(box);for(const p of [shared+'curve-core.js',shared+'spacing-core.js',shared+'color-core.js',prefix+'healing-core.js',prefix+'healing-authoring.js',prefix+'healing-export-ui.js'])vm.runInContext(read(p),ctx);
 box.FxHealingRuntime={createHealing({settings}){let plan=box.FxHealing.compile(settings);const fx={stats:{visible:0,allocated:plan.reserved},seek(t,p){const result=plan.sample(t,p);this.stats.visible=result.cost;return result;},configure(s){plan=box.FxHealing.compile(s);this.stats.allocated=plan.reserved;},destroy(){fxDestroyed++;}};scene=fx;return fx;}};
 box.FxHealingBake={sceneFactory(o){return ()=>o;}};
 box.FxHealingExport={cropSpec:c=>c,makeZip(){},async bakeSequence(p){requests.push(p);p.progress(p.frameCount,p.frameCount);return {zip:Uint8Array.of(1)};}};
 box.FxHealingDeveloper={FILES:['healing-core.js'],async developer(p){requests.push(p);return {zip:Uint8Array.of(2)};}};
 vm.runInContext(read(prefix+'healing-editor.js'),ctx);
 const settle=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
 const preset=()=>JSON.parse($('preset').value),field=(host,key)=>$(host).children.flatMap(e=>e.children).find(e=>e.dataset.key===key);
 await settle();A.equal(body.dataset.ready,'true');A.equal($('actual').textContent,'WEBGL2');
 A.equal(preset().particleRate,18);A.equal(scene.stats.allocated,23);
 const scalar=Object.keys(preset()).filter(k=>k!=='schemaVersion'&&typeof preset()[k]!=='object');for(const k of scalar)A.ok(field('globalControls',k),'Missing control: '+k);
 let el=field('globalControls','particleRate');el.value=24;el.onchange();A.equal(preset().particleRate,24);
 el=field('globalControls','particleRate');el.value=999;el.onchange();A.equal(preset().particleRate,24);A.equal($('status').dataset.error,'true');A.equal(field('globalControls','particleRate').value,'24');
 $('duplicate').onclick();A.equal(preset().emitters.length,2);$('delete').onclick();A.equal(preset().emitters.length,1);
 $('layer').value='lines';$('layer').onchange();el=field('layerControls','enabled');el.checked=false;el.onchange();A.equal(preset().emitters[0].layers.lines.enabled,false);
 $('layer').value='emitter';$('layer').onchange();const h=$('handle');h.onpointerdown({pointerId:1,clientX:128,clientY:128});h.onpointermove({pointerId:1,clientX:148,clientY:138});h.onpointerup();A.equal(preset().emitters[0].x,296);A.equal(preset().emitters[0].y,276);
 h.onkeydown({key:'ArrowRight',shiftKey:true,preventDefault(){}});A.equal(preset().emitters[0].x,306);
 const cfg=preset();cfg.mode='oneShot';cfg.durationFrames=40;$('preset').value=JSON.stringify(cfg);$('apply').onclick();$('frame').value=39;$('frame').oninput();A.equal(scene.stats.visible,0);$('play').onclick();A.equal($('frame').value,'0');$('reset').onclick();
 $('curveKey').value='alphaCurve';$('curveKey').onchange();const c=JSON.parse(JSON.stringify(box.curve.curve));c.keys[1].y=.4;box.curve.onChange(c);A.equal(preset().alphaCurve.keys[1].y,.4);
 const pal=JSON.parse(JSON.stringify(box.palette.value));pal.stops[0].rgba=[255,200,50,1];box.palette.onChange(pal);A.deepEqual(preset().palette.stops[0].rgba,[255,200,50,1]);
 await $('sample').onclick();await settle();A.equal($('assetLabel').textContent,'sample.json');failLoad=true;await $('sample').onclick();await settle();A.equal($('assetLabel').textContent,'sample.json');A.equal($('status').dataset.error,'true');
 failBackend=true;$('backend').value='webgpu';await $('backend').onchange();A.equal($('actual').textContent,'WEBGL2');A.equal($('backend').value,'webgl2');
 failBackend=false;$('backend').value='webgpu';await $('backend').onchange();A.equal($('actual').textContent,'WEBGL2');A.equal($('assetLabel').textContent,'sample.json');
 failLoad=false;$('backend').value='webgpu';await $('backend').onchange();A.equal($('actual').textContent,'WEBGPU');A.equal(appDestroyed,2);A.equal(fxDestroyed,1);A.equal(assetDestroyed,1);A.equal($('surface').children.filter(c=>c.tagName==='canvas').length,1);
 await $('remove').onclick();A.equal($('assetLabel').textContent,'No Spine asset');A.equal(assetDestroyed,2);
 $('cropWidth').value=64;$('cropHeight').value=32;$('cropX').value=-12;$('cropY').value=9;$('exportFrames').value=40;$('showCrop').checked=true;$('showCrop').onchange();A.equal($('cropGuide').hidden,false);
 $('cropLabel').onpointerdown({pointerId:7,clientX:0,clientY:0});$('cropLabel').onpointermove({pointerId:7,clientX:5,clientY:-2});$('cropLabel').onpointerup();A.equal($('cropX').value,'-2');A.equal($('cropY').value,'5');
 const canceled=$('exportPng').onclick();$('cancelExport').onclick();A.equal(await canceled,false);A.equal(downloads.length,0);A.equal($('exportPng').disabled,false);
 A.equal(await $('exportPng').onclick(),true);A.equal(downloads[0],'healing-aura-png.zip');A.deepEqual(JSON.parse(JSON.stringify(requests.at(-1).crop)),{x:222,y:245,width:64,height:32});A.equal(requests.at(-1).frameCount,40);A.equal(requests.at(-1).backend,'webgpu');
 await $('exportWebgl').onclick();await $('exportWebgpu').onclick();A.deepEqual(downloads,['healing-aura-png.zip','healing-aura-developer-webgl.zip','healing-aura-developer-webgpu.zip']);A.equal(requests.at(-2).target,'webgl');A.equal(requests.at(-1).target,'webgpu');A.equal($('status').dataset.error,'false');
});
