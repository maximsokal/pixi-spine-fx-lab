'use strict';
const {test}=require('node:test');
const A=require('node:assert/strict');
const R=require('../assets/muzzle-flash/src/muzzle-runtime.js');
class Container {
 constructor(){this.children=[];this.parent=null;this.destroyed=false;this.visible=true;}
 addChild(c){c.removeFromParent();this.children.push(c);c.parent=this;return c;}
 removeChild(c){this.children.splice(this.children.indexOf(c),1);c.parent=null;return c;}
 removeFromParent(){if(this.parent)this.parent.removeChild(this);}
 destroy({children=false}={}){this.removeFromParent();if(children)for(const c of [...this.children])c.destroy({children:true});this.destroyed=true;}
}
class Graphics extends Container {
 constructor(){super();this.draws=0;this.position={set:(x,y)=>{this.x=x;this.y=y;}};this.scale={set:s=>{this.size=s;}};}
 clear(){this.draws++;this.shape=null;return this;}
 poly(points,close){this.shape={points,close};return this;}
 circle(x,y,r){this.shape={x,y,r};return this;}
 fill(color){this.fillColor=color;return this;}
}
const PIXI={Container,Graphics},pose={x:100,y:200,rotation:0};
const settings={length:10,color:[255,100,30,1],enabled:true};
function compile(s){
 if(!Number.isFinite(s.length)||s.length<=0)throw Error('invalid settings');
 const cfg=structuredClone(s);
 return {settings:cfg,sample(t,p){
  if(t<0||!Number.isFinite(t))throw Error('invalid time');
  if(!cfg.enabled||t>=1)return {core:[],tongues:[],sparks:[]};
  const {x,y}=p,l=cfg.length,a=cfg.color;
  return {core:[{vertices:[{x,y:y+2},{x,y:y-2},{x:x+l,y},{x:x+l,y}],rgba:a}],
   tongues:[{origin:{x,y},tip:{x:x+l,y:y+5},width:2,rgba:a}],
   sparks:Array.from({length:t>.1?2:1},(_,i)=>({x:x+i+t*5,y,age:t,rgba:a}))};
 }};
}
function fixture(cfg=settings,pixi=PIXI){const host=new Container(),foreign=new Container();host.addChild(foreign);
 const fx=R.createRenderer({PIXI:pixi,host,compile,settings:cfg});return {host,foreign,fx};}
const layers=fx=>Object.fromEntries(fx.owned.children.map(c=>[c.label,c]));
const counts=fx=>Object.fromEntries(Object.entries(layers(fx)).map(([k,g])=>[k,g.children.filter(x=>x.visible).length]));
test('ordered layers, straight color and one closed core outline',()=>{
 const {fx}=fixture();fx.seek(0,pose);const g=layers(fx);
 A.deepEqual(fx.owned.children.map(c=>c.label),['tongues','core','sparks']);
 A.deepEqual(counts(fx),{tongues:1,core:1,sparks:1});
 A.deepEqual(g.core.children[0].shape,{points:[100,202,110,200,100,198],close:true});
 A.equal(g.core.children[0].tint,0xff641e);A.equal(g.core.children[0].fillColor,0xffffff);
 A.equal(g.core.children[0].blendMode,'normal');fx.destroy();
});
test('same shape not retriangulated and spark pool bounded across seeks',()=>{
 const {fx}=fixture();fx.seek(0,pose);const core=layers(fx).core.children[0],n=core.draws;
 fx.seek(.2,pose);A.equal(core.draws,n);const allocated=fx.allocated;A.equal(allocated,4);
 for(let i=0;i<200;i++)fx.seek((i%10)/10,pose);
 A.equal(fx.allocated,allocated);A.equal(core.draws,n);fx.destroy();
});
test('end, missing anchor and disabled settings remove all visible geometry',()=>{
 const {fx}=fixture();fx.seek(.2,pose);fx.seek(1,pose);A.deepEqual(counts(fx),{tongues:0,core:0,sparks:0});
 fx.seek(0,null);A.equal(fx.owned.visible,false);A.equal(fx.sample,null);
 fx.seek(0,pose);A.equal(fx.owned.visible,true);fx.configure({...settings,enabled:false});
 A.deepEqual(counts(fx),{tongues:0,core:0,sparks:0});fx.destroy();
});
test('pose translation and tint change actual commands; invalid configure preserves previous frame',()=>{
 const {fx}=fixture();fx.seek(0,pose);const old=fx.owned;
 A.throws(()=>fx.configure({...settings,length:NaN}));A.equal(fx.owned,old);
 fx.configure({...settings,color:[0,120,255,.5]});A.ok(old.destroyed);
 fx.seek(0,{...pose,x:20});const g=layers(fx).core.children[0];A.equal(g.shape.points[0],20);
 A.equal(g.tint,0x0078ff);A.equal(g.alpha,.5);fx.destroy();
});
test('malformed snapshot or over-budget layer does not replace previous valid frame',()=>{
 const host=new Container();const fx=R.createRenderer({PIXI,host,settings,compile(s){const p=compile(s);return {...p,sample(t,a){const q=p.sample(t,a);if(t===.3)q.sparks=Array(51).fill(q.sparks[0]);if(t===.4)q.core[0].vertices[0].x=NaN;return q;}}}});
 fx.seek(0,pose);const before=fx.sample;A.throws(()=>fx.seek(.3,pose));A.throws(()=>fx.seek(.4,pose));A.equal(fx.sample,before);A.deepEqual(counts(fx),{tongues:1,core:1,sparks:1});fx.destroy();
});
test('allocation failure rolls back all newly attached views',()=>{
 let limit=100;class Limited extends Graphics{constructor(){super();if(--limit<0)throw Error('allocation');}}
 const {fx}=fixture(settings,{Container,Graphics:Limited});fx.seek(0,pose);const n=fx.allocated;
 limit=0;A.throws(()=>fx.seek(.2,pose));A.equal(fx.allocated,n);A.deepEqual(counts(fx),{tongues:1,core:1,sparks:1});fx.destroy();
});
test('idempotent disposal leaves unrelated host children intact',()=>{
 const {fx,host,foreign}=fixture();fx.seek(.2,pose);const owned=fx.owned,views=owned.children.flatMap(g=>g.children);
 fx.destroy();fx.destroy();A.ok(owned.destroyed);A.ok(views.every(g=>g.destroyed));A.deepEqual(host.children,[foreign]);A.equal(foreign.destroyed,false);A.throws(()=>fx.seek(0,pose));
});
