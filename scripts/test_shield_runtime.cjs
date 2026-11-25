'use strict';
const {test}=require('node:test'),A=require('node:assert/strict');
const R=require('../assets/magic-shield/src/shield-runtime.js');
const primitive=(kind='shell',over={})=>({kind,x:100,y:150,radius:110,innerRadius:105,rgba:[218,247,255,.28],centerAlpha:.042,blend:'normal',placement:'front',...over});
function fixture(){
 const counts={mesh:0,geometry:0,texture:0},events={fail:false};
 class Container{constructor(){this.children=[];this.visible=true;this.destroyed=false;}addChild(v){v.removeFromParent();v.parent=this;this.children.push(v);return v;}removeFromParent(){if(this.parent){this.parent.children.splice(this.parent.children.indexOf(this),1);this.parent=null;}}destroy(o){A.equal(this.children.length,0);this.destroyed=true;this.removeFromParent();}}
 class BufferImageSource{constructor(o){this.options=o;}}
 class Texture{constructor(o){this.source=o.source;}destroy(source){A.equal(source,true);counts.texture++;}}
 class MeshSimple extends Container{constructor(o){super();if(events.fail)throw Error('allocation failure');this.vertices=o.vertices;this.texture=o.texture;this.geometry={uvs:o.uvs,getBuffer:()=>({update(){}}),destroy(){counts.geometry++;}};counts.mesh++;}destroy(o){A.equal(o.texture,false);super.destroy(o);}}
 const front=new Container(),behind=new Container(),PIXI={Container,BufferImageSource,Texture,MeshSimple};
 function compile(settings){if(settings.invalid)throw Error('bad settings');return {settings,reserved:settings.reserved??3,sample(t,poses){if(t<0)throw Error('bad time');const items=settings.items??[primitive(),primitive('halo',{placement:'behind'}),primitive('spark',{radius:2,innerRadius:0})];return {emitters:[{id:'e',layers:{shell:t===1?[]:items,halo:[],impact:[]}}],cost:t===1?0:items.length,diagnostics:[],poses};}};}
 return {PIXI,front,behind,compile,counts,events};
}
test('shell radius, center opacity and transparent outer edge are encoded in a bounded radial mesh',()=>{const p=primitive(),m=R.radialMesh(p);A.equal(m.bands[0].radius,0);A.ok(Math.abs(m.bands[0].alpha-.15)<1e-10);A.equal(m.bands.at(-1).radius,110);A.equal(m.bands.at(-1).alpha,0);A.ok(m.bands.some(x=>x.alpha===1));A.ok(m.positions.every(Number.isFinite));A.ok(m.indices.every(x=>x<m.positions.length/2));for(let i=0;i<m.positions.length;i+=2)A.ok(Math.hypot(m.positions[i]-p.x,m.positions[i+1]-p.y)<=110.0001);});
test('halo and ripple have transparent centers and edges even with a zero inner radius',()=>{for(const kind of ['halo','ripple']){const m=R.radialMesh(primitive(kind,{innerRadius:0}));A.equal(m.bands[0].alpha,0);A.equal(m.bands.at(-1).alpha,0);A.ok(m.bands.some(x=>x.alpha===1));}});
test('spark uses reduced tessellation and fades to zero at radius',()=>{const s=R.radialMesh(primitive('spark',{radius:2,innerRadius:0})),r=R.radialMesh(primitive('ripple'));A.ok(s.indices.length<r.indices.length);A.equal(s.bands[0].alpha,1);A.equal(s.bands.at(-1).alpha,0);});
test('premultiplied texture ramp has no color at zero alpha',()=>{const a=R.alphaRamp();A.equal(a.length,256*4);A.deepEqual([...a.slice(0,4)],[0,0,0,0]);A.deepEqual([...a.slice(512,516)],[128,128,128,128]);A.deepEqual([...a.slice(-4)],[255,255,255,255]);});
test('native object adapter separates layers and uses one shared texture',()=>{const f=fixture(),p=R.createRenderer({...f,settings:{}});A.equal(f.front.children.length,1);A.equal(f.behind.children.length,1);A.equal(p.stats.visible,3);const a=f.front.children[0].children,b=f.behind.children[0].children;A.equal(a.length,2);A.equal(b.length,1);A.equal(a[0].texture,b[0].texture);A.equal(a[0].alpha,.28);A.equal(a[0].tint,0xdaf7ff);A.equal(a[0].texture.source.options.alphaMode,'premultiplied-alpha');A.equal(a[0].blendMode,'normal');p.destroy();A.equal(f.counts.geometry,3);A.equal(f.counts.texture,1);A.equal(f.front.children.length,0);A.equal(f.behind.children.length,0);});
test('seek hides all stale meshes and reuses pools without allocation growth',()=>{const f=fixture(),p=R.createRenderer({...f,settings:{}});p.seek(1);A.equal(p.stats.visible,0);A.ok(f.front.children[0].children.every(x=>!x.visible));p.seek(.2);A.equal(p.stats.visible,3);A.equal(f.counts.mesh,3);p.destroy();p.destroy();A.equal(f.counts.texture,1);A.throws(()=>p.seek(0),/destroyed/);});
test('invalid reconfiguration leaves previous scene intact',()=>{const f=fixture(),p=R.createRenderer({...f,settings:{}}),old=f.front.children[0];A.throws(()=>p.configure({invalid:true}),/bad settings/);A.equal(f.front.children[0],old);A.equal(p.stats.visible,3);f.events.fail=true;A.throws(()=>p.configure({}),/allocation failure/);A.equal(f.front.children[0],old);A.equal(p.stats.visible,3);f.events.fail=false;p.configure({items:[],reserved:0});A.equal(p.stats.visible,0);A.equal(f.counts.geometry,3);p.destroy();A.equal(f.counts.texture,1);});
test('failed initial allocation leaves no host children and destroys texture',()=>{const f=fixture();f.events.fail=true;A.throws(()=>R.createRenderer({...f,settings:{}}),/allocation failure/);A.equal(f.front.children.length,0);A.equal(f.behind.children.length,0);A.equal(f.counts.texture,1);});
test('budget, malformed geometry and invalid host are rejected',()=>{const f=fixture();A.throws(()=>R.createRenderer({...f,settings:{reserved:1}}),/budget/);A.equal(f.front.children.length,0);for(const over of [{radius:NaN},{innerRadius:111},{rgba:[0,0,0,2]},{placement:'middle'},{blend:'bad'},{centerAlpha:.9}])A.throws(()=>R.radialMesh(primitive('shell',over)));A.throws(()=>R.createRenderer({...f,behind:f.front,settings:{}}),/hosts/);});
test('normal/add/screen/multiply and pose updates pass through without changing source',()=>{const f=fixture(),items=['normal','add','screen','multiply'].map(blend=>primitive('spark',{radius:3,innerRadius:0,blend}));const p=R.createRenderer({...f,settings:{items,reserved:4}});A.deepEqual(f.front.children[0].children.map(x=>x.blendMode),items.map(x=>x.blend));const pose={bones:{hip:{x:3,y:4}}};A.deepEqual(p.seek(.1,pose).poses,pose);p.destroy();});

test('real core: all 60 frames with manual impact, deterministic replay and bounded mesh pool',()=>{
 const S=require('../assets/magic-shield/src/shield-core.js');
 const f=fixture(),c=S.defaults();c.emitters[0].impacts=[{id:'hit1',frame:45}];
 const p=R.createShield({...f,settings:c}),first=p.seek(0);let peak=0;
 const budget=S.compile(c).reserved;
 for(let cycle=0;cycle<3;cycle++)for(let i=0;i<60;i++){const sample=p.seek(i/60+cycle);A.equal(p.stats.visible,sample.cost);A.ok(p.stats.allocated<=budget);peak=Math.max(peak,p.stats.visible);}
 A.ok(peak>40);A.deepEqual(p.seek(3),first);const n=p.stats.totalCreated;for(let i=59;i>=0;i--)p.seek(i/60);A.equal(p.stats.totalCreated,n);
 const invisible=S.defaults();for(const l of Object.values(invisible.emitters[0].layers))l.enabled=false;p.configure(invisible);A.equal(p.stats.visible,0);p.destroy();A.equal(f.counts.mesh,f.counts.geometry);
});
test('real core: moving bone anchor and missing pose hide only dependent layers',()=>{
 const S=require('../assets/magic-shield/src/shield-core.js');
 const f=fixture(),c=S.defaults(),e=c.emitters[0];e.anchor={type:'bone',name:'hip'};e.x=0;e.y=0;e.layers.halo.anchor={type:'world',name:''};e.layers.halo.x=150;e.layers.halo.y=200;
 const p=R.createShield({...f,settings:c});A.equal(p.stats.visible,1);
 const a=p.seek(.1,{bones:{hip:{x:100,y:150,rotation:0,scale:1}}});const b=p.seek(.1,{bones:{hip:{x:130,y:170,rotation:0,scale:1}}});
 A.equal(a.emitters[0].layers.shell[0].x,100);A.equal(b.emitters[0].layers.shell[0].x,130);A.deepEqual(a.emitters[0].layers.halo,b.emitters[0].layers.halo);A.equal(p.stats.visible,2);p.seek(.1,{});A.equal(p.stats.visible,1);p.destroy();
});
test('real core: one shot endpoints have zero visible primitives',()=>{
 const S=require('../assets/magic-shield/src/shield-core.js');
 const f=fixture(),c=S.defaults();c.mode='oneShot';const p=R.createShield({...f,settings:c});A.equal(p.stats.visible,0);p.seek(.5);A.ok(p.stats.visible>0);p.seek(59/60);A.equal(p.stats.visible,0);p.destroy();A.equal(f.counts.mesh,f.counts.geometry);
});
