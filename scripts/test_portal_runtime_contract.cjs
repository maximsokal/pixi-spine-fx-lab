'use strict';
// Structural ownership tests; real GPU output is tested separately.
const {test}=require('node:test'),A=require('node:assert/strict');
const P=require('../assets/magic-portal/src/portal-core.js'),R=require('../assets/magic-portal/src/portal-runtime.js');
let failDraw=false,resources=[];
class Resource{
 constructor(){this.destroyed=false;resources.push(this);}
 destroy(){A.equal(this.destroyed,false,'double destroy');this.destroyed=true;}
}
class Container extends Resource{
 constructor(){super();this.children=[];this.parent=null;this.visible=true;this.position={set:(x,y)=>{this.x=x;this.y=y}};this.scale={set:s=>{this.size=s}};}
 addChild(x){x.removeFromParent();this.children.push(x);x.parent=this;return x;}
 removeFromParent(){if(this.parent){this.parent.children=this.parent.children.filter(x=>x!==this);this.parent=null;}}
 destroy(opts){this.removeFromParent();if(opts?.children)for(const c of [...this.children])c.destroy(opts);super.destroy();}
}
class Graphics extends Container{
 clear(){return this;}poly(){if(failDraw)throw Error('injected draw');return this;}circle(){return this;}fill(){return this;}
}
class Shader extends Resource{
 constructor(){super();this.resources={portalUniforms:{uniforms:{uTint:new Float32Array(4),uPolar:new Float32Array(4)},update(){}}};}
}
class Mesh extends Container{constructor(o){super();this.shader=o.shader;this.geometry=o.geometry;}}
const PIXI={Container,Graphics,Mesh,Shader,MeshGeometry:Resource,GlProgram:{from:o=>o},GpuProgram:{from:o=>o}};
const create=()=>{resources=[];const host=new Container(),source=new Container();host.addChild(source);const fx=R.createPortal({PIXI,host,settings:P.defaults()});return {fx,host,source};};
test('no display allocations on seek and caller host preserved',()=>{
 const {fx,host,source}=create();const n=resources.length,created=fx.totalCreated;A.equal(created,4);
 const snapshot=fx.seek(.25);for(let i=0;i<120;i++)fx.seek(i/60);
 A.deepEqual(fx.seek(.25),snapshot);A.equal(resources.length,n);
 fx.destroy();fx.destroy();A.deepEqual(host.children,[source]);A.ok(resources.slice(2).every(r=>r.destroyed));A.throws(()=>fx.seek(0),/destroyed/);
});
test('invalid or failed candidate keeps previous render tree and disposes candidate',()=>{
 const {fx}=create();const old=fx.owned.children[0],sample=fx.seek(.25),c=P.defaults();c.warp=.8;
 A.throws(()=>fx.configure({...c,warp:NaN}));A.equal(fx.owned.children[0],old);A.equal(fx.sample,sample);
 const n=resources.length;failDraw=true;try{A.throws(()=>fx.configure(c),/injected draw/);}finally{failDraw=false;}
 A.ok(resources.slice(n).every(r=>r.destroyed));A.equal(fx.owned.children[0],old);A.equal(fx.sample,sample);
 fx.configure(c);A.ok(old.destroyed);A.equal(fx.settings.warp,.8);fx.destroy();
});
