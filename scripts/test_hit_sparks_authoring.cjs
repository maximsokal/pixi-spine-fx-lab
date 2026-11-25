'use strict';
// Exact numerical modules and pinned CPU Pixi/Spine objects; minimal DOM/application shell.
// This is not a browser/GPU integration test.
function run(read,A,test){
 const vendor='assets/template/vendor/',shared='assets/template/src/',fx='assets/hit-sparks/src/';
 const documentShim={createElement:()=>({style:{},getContext:()=>null}),createElementNS:()=>({style:{}})},browser={};
 const P=new Function('navigator','document','window','self',read(vendor+'pixi-8.22.0.min.js')+'\nreturn PIXI;')({userAgent:'Chromium',platform:'Linux'},documentShim,browser,browser);
 browser.PIXI=P;
 const Sp=new Function('PIXI','window','self','require',read(vendor+'spine-pixi-v8-4.2.120.min.js')+'\nreturn spine;')(P,browser,browser,n=>{if(n==='pixi.js')return P;throw Error(n);});
 const mods={};
 for(const path of [...['curve','spacing','color','timeline'].map(n=>shared+n+'-core.js'),...['core','anchors','runtime','authoring','pose'].map(n=>fx+'hit-sparks-'+n+'.js')]){
  const m={exports:{}};new Function('module','require',read(path))(m,n=>{const k=n.split('/').at(-1);if(!Object.hasOwn(mods,k))throw Error(n);return mods[k];});mods[path.split('/').at(-1)]=m.exports;
 }
 const H=mods['hit-sparks-core.js'],An=mods['hit-sparks-anchors.js'],R=mods['hit-sparks-runtime.js'],U=mods['hit-sparks-authoring.js'],Pose=mods['hit-sparks-pose.js'];
 const near=(a,b,e=1e-6)=>A.ok(Math.abs(a-b)<=e,a+' != '+b);
 const preset=()=>({schemaVersion:1,effect:H.defaults(),anchors:An.defaults()});
 const env={FxTimeline:mods['timeline-core.js']};new Function('globalThis',read('assets/shockwave/src/shockwave-spine.js'))(env);const L=env.FxShockwaveSpine;
 test('60 FPS exclusive frame end, duration and rotated drag helpers',()=>{
  const p=preset();A.equal(U.frameCount(p),40);near(U.seek(1,p),39/60);A.equal(U.frame(U.seek(2,p),p),39);near(U.advance(.1,.1,p),.2);
  const pose={x:100,y:200,rotation:90},o=U.origin(pose,{x:10,y:20});near(o.x,80);near(o.y,210);const q=U.offset(pose,o.x,o.y);near(q.x,10);near(q.y,20);
  A.deepEqual(U.pointer(150,250,{left:50,top:50,width:200,height:400}),{x:256,y:256});A.throws(()=>U.pointer(1,1,{left:0,top:0,width:0,height:1}));
 });
 test('selected source requires one skeleton, one atlas, all named texture files',()=>{
  const f=['hero.skel','hero.atlas','page.png','page2.webp'].map(name=>({name})),s=U.collect(f);A.equal(s.name,'hero.skel');A.equal(s.images.size,2);
  A.throws(()=>U.collect(f.slice(0,2)));A.throws(()=>U.collect([...f,{name:'hero.json'}]));A.throws(()=>U.collect([...f,{name:'page.png'}]));
 });
 test('actual Spine physics deterministic seek and zero speed, no asset no-op',()=>{
  const data={skeleton:{spine:'4.2.43'},bones:[{name:'root'},{name:'weapon',parent:'root',length:20}],physics:[{name:'spring',bone:'weapon',x:1,rotate:1,step:60,strength:100,damping:.5}],animations:{idle:{bones:{root:{translate:[{x:0,y:0},{time:.5,x:80,y:0},{time:1,x:0,y:0}]}}}}};
  const make=()=>({model:new Sp.Spine({skeletonData:new Sp.SkeletonJson({}).readSkeletonData(data),autoUpdate:false})}),a=make(),b=make(),opts={animation:'idle',skin:'',speed:1,visible:true};
  try{const first=Pose.pose(a,.5,opts,L).weapon;for(let i=0;i<=30;i++)Pose.pose(b,i/60,opts,L);near(Pose.pose(b,.5,opts,L).weapon.x,first.x);Pose.pose(a,.1,opts,L);near(Pose.pose(a,.5,opts,L).weapon.x,first.x);near(Pose.pose(a,.5,{...opts,speed:0},L).weapon.x,0);A.deepEqual(Pose.pose(null,0,opts,L),{});}finally{a.model.destroy();b.model.destroy();}
 });
 test('actual Spine nonphysics seek resets animation, speed and setup pose',()=>{
  const data={skeleton:{spine:'4.2.43'},bones:[{name:'root'}],animations:{idle:{bones:{root:{translate:[{x:0,y:0},{time:.5,x:80,y:0},{time:1,x:0,y:0}]}}}}};
  const a={model:new Sp.Spine({skeletonData:new Sp.SkeletonJson({}).readSkeletonData(data),autoUpdate:false})};
  try{const opt={animation:'idle',skin:'',speed:1,visible:true};near(Pose.pose(a,.5,opt,L).root.x,80);near(Pose.pose(a,.25,opt,L).root.x,40);near(Pose.pose(a,.5,{...opt,speed:0},L).root.x,0);near(Pose.pose(a,.5,{...opt,animation:'',visible:false},L).root.x,0);A.equal(a.model.visible,false);}
  finally{a.model.destroy();}
 });
 test('editor wiring: actual core, anchors and CPU Graphics, mock DOM and renderer shell',async()=>{
  class El{
   constructor(tag='div'){this.tag=tag;this.children=[];this.style={};this.dataset={};this.value='';this.checked=false;this.validity={valid:true};this.disabled=false;}
   append(...c){this.children.push(...c);}prepend(c){this.children.unshift(c);}replaceChildren(...c){this.children=c;}add(c){this.append(c);}setAttribute(){}setPointerCapture(){}
   getBoundingClientRect(){return {left:0,top:0,width:512,height:512};}
  }
  class GL2{}const ids=Object.fromEntries([...read(fx+'ui.html').matchAll(/\bid="([^"]+)"/g)].map(m=>[m[1],new El()]));
  const get=k=>{if(!ids[k])throw Error('Missing element '+k);return ids[k];};
  get('layer').value='flash';get('curveKey').value='burstRate';get('speed').value='1';get('showSpine').checked=true;get('backend').value='webgl2';
  const doc={getElementById:get,createElement:t=>new El(t),body:new El('body')};
  let onHide,failed=false,created=[],mountCurve,mountColor,clock;
  class App{
   constructor(){this.stage=new P.Container();this.canvas=new El('canvas');created.push(this);}
   async init(){this.renderer={gl:new GL2()};if(failed)throw Error('simulated unavailable backend');}
   render(){this.renders=(this.renders||0)+1;}
   destroy(){this.stage.destroy({children:true});this.destroyed=true;}
  }
  const win={addEventListener:(k,fn)=>{if(k==='pagehide')onHide=fn;}};
  const e={document:doc,window:win,PIXI:{...P,Application:App},spine:Sp,WebGL2RenderingContext:GL2,Option:class{constructor(text,value){this.text=text;this.value=value;}},requestAnimationFrame:fn=>{clock=fn;return 1;},cancelAnimationFrame:()=>{},FxHitSparksAuthoring:U,FxHitSparks:H,FxHitSparksAnchors:An,FxHitSparksRuntime:R,FxHitSparksPose:Pose,FxShockwaveSpine:L,FxCurveEditor:{mount:(h,o)=>{mountCurve=o;}},FxColorUi:{mount:(h,o)=>{mountColor=o;}}};
  new Function(...Object.keys(e),read(fx+'hit-sparks-editor.js'))(...Object.values(e));await Promise.resolve();await Promise.resolve();
  const cfg=()=>JSON.parse(get('preset').value),field=(host,key)=>get(host).children.flatMap(x=>x.children).find(x=>x.dataset.field===key),set=(host,key,val)=>{const el=field(host,key);A.ok(el,'missing field '+key);el.value=String(val);el.onchange();};
  try{
   A.equal(doc.body.dataset.ready,'true');A.equal(cfg().effect.burstCount,20);A.ok(get('timingInfo').textContent.includes('primary 20'));
   set('general','burstCount',5);A.equal(cfg().effect.burstCount,5);A.ok(get('timingInfo').textContent.includes('primary 5'));
   set('general','durationSeconds',.5);A.equal(cfg().effect.durationFrames,30);set('general','burstCount',999);A.equal(cfg().effect.burstCount,5);
   get('layer').value='primary';get('layer').onchange();const h=get('handle');h.onpointerdown({button:0,pointerId:1,clientX:260,clientY:260});h.onpointermove({pointerId:1,clientX:280,clientY:270});h.onpointerup();near(cfg().effect.layers.primary.x,20);near(cfg().effect.layers.primary.y,10);near(cfg().effect.layers.flash.x,0);
   const color=JSON.parse(JSON.stringify(cfg().effect.palettes.primary));color.parameterKey='natural';color.stops[0].rgba=[20,30,40,1];mountColor.onChange(color);A.equal(cfg().effect.palettes.primary.parameterKey,'primaryPalette');A.deepEqual(cfg().effect.palettes.primary.stops[0].rgba,[20,30,40,1]);
   const cv=JSON.parse(JSON.stringify(cfg().effect.curves.burstRate));cv.keys[0].y=.5;mountCurve.onChange(cv);near(cfg().effect.curves.burstRate.keys[0].y,.5);
   get('frame').value='39';get('frame').oninput();A.ok(get('frameLabel').textContent.startsWith('39 / 39'));get('play').onclick();clock(0);clock(1000);A.equal(get('play').textContent,'Play');
   failed=true;get('backend').value='webgpu';await get('backend').onchange();A.equal(get('actual').textContent,'WEBGL2');A.equal(created[0].destroyed,undefined);A.equal(created[1].destroyed,true);
   const old=cfg();get('preset').value='{"schemaVersion":2}';get('apply').onclick();A.equal(get('status').dataset.error,'true');get('preset').value=JSON.stringify(old);get('apply').onclick();A.deepEqual(cfg(),old);
  }finally{onHide();A.equal(created[0].destroyed,true);}
 });
}
module.exports={run};
if(require.main===module){const fs=require('node:fs'),path=require('node:path'),root=path.resolve(__dirname,'..');run(p=>fs.readFileSync(path.join(root,p),'utf8'),require('node:assert/strict'),require('node:test').test);}
