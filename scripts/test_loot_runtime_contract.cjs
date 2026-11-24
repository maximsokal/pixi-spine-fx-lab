'use strict';
// Structural renderer contract using a deliberately small Pixi API spy.
// Actual Pixi pixels are covered separately by test_loot_runtime.cjs.
const {test}=require('node:test'),A=require('node:assert/strict');
const L=require('../assets/loot-sparkle/src/loot-core.js'),R=require('../assets/loot-sparkle/src/loot-runtime.js');
let failDraw=false;
class Container{
 constructor(){this.children=[];this.parent=null;this.destroyed=false;this.visible=true;}
 addChild(x){if(this.destroyed)throw Error('dead parent');x.removeFromParent();this.children.push(x);x.parent=this;return x;}
 removeFromParent(){if(this.parent){const p=this.parent;p.children=p.children.filter(x=>x!==this);this.parent=null;}}
 destroy(opts){if(this.destroyed)throw Error('double destroy');this.removeFromParent();if(opts?.children)for(const c of [...this.children])c.destroy(opts);this.destroyed=true;}
}
class Graphics extends Container{
 constructor(){super();this.commands=[];}
 clear(){this.commands=[];return this;}
 poly(points,closed){if(failDraw)throw Error('injected draw failure');this.commands.push(['poly',points,closed]);return this;}
 circle(...args){this.commands.push(['circle',...args]);return this;}
 fill(style){this.commands.push(['fill',style]);return this;}
}
const PIXI={Container,Graphics},create=c=>{const host=new Container(),source=new Container();host.addChild(source);const fx=R.createLoot({PIXI,host,settings:c});return {fx,host,source};};
const tree=fx=>fx.owned.children[0],layer=(fx,k,i=0)=>tree(fx).children[i].children.find(x=>x.label===k),visible=(fx,k,i=0)=>layer(fx,k,i).children.filter(x=>x.visible);
const json=x=>JSON.parse(JSON.stringify(x));
test('draws exact core polygons and no hidden layers',()=>{
 const c=L.defaults(),{fx}=create(c),s=fx.seek(.25);
 const g=visible(fx,'stars');A.ok(g.length>0);A.equal(g.length,s.emitters[0].layers.stars.length);
 g.forEach((v,i)=>{const p=s.emitters[0].layers.stars[i];A.deepEqual(v.commands[0],['poly',p.points.flat(),true]);A.equal(v.commands[1][1].alpha,p.rgba[3]);A.equal(v.blendMode,p.blend);});
 A.equal(visible(fx,'halo').length,0);A.equal(visible(fx,'sweep').length,0);
 fx.seek(39/60);A.equal(visible(fx,'stars').length,0);fx.destroy();
});
test('halo and clipped sweep independent; bounded soft geometry',()=>{
 const c=L.defaults(),l=c.emitters[0].layers;l.halo.enabled=true;l.sweep.enabled=true;l.stars.enabled=false;
 const {fx}=create(c),s=fx.seek(.25),halo=visible(fx,'halo')[0],sweep=visible(fx,'sweep')[0];
 A.equal(sweep.commands[0][0],'poly');A.deepEqual(sweep.commands[0][1],s.emitters[0].layers.sweep[0].points.flat());
 A.equal(halo.commands.filter(x=>x[0]==='circle').length,12);
 const alphas=halo.commands.filter(x=>x[0]==='fill').map(x=>x[1].alpha);
 const combined=1-alphas.reduce((a,x)=>a*(1-x),1);
 A.ok(Math.abs(combined-s.emitters[0].layers.halo[0].rgba[3])<1e-10);
 c.haloRadius=0;fx.configure(c);A.equal(visible(fx,'halo').length,0);A.deepEqual(visible(fx,'sweep')[0].commands,sweep.commands);fx.destroy();
});
test('pool is bounded by plan and does not allocate during arbitrary seeks',()=>{
 const c=L.defaults();c.mode='idle';c.durationFrames=60;c.spawnIntervalFrames=1;c.sparkleCount=4;c.emitters.push(L.newEmitter(1));
 const {fx}=create(c),n=fx.allocated,total=fx.totalCreated;A.equal(n,L.compile(c).reservedPrimitives);
 for(let i=0;i<120;i++){const s=fx.seek((i*17%60)/60);A.ok(s.cost<=n);}
 A.equal(fx.allocated,n);A.equal(fx.totalCreated,total);
 const a=json(fx.seek(.25)),commands=json(visible(fx,'stars').map(g=>g.commands));fx.seek(.8);A.deepEqual(fx.seek(.25),a);A.deepEqual(visible(fx,'stars').map(g=>g.commands),commands);fx.destroy();
});
test('invalid config and failed staged draw preserve prior tree, time and settings',()=>{
 const c=L.defaults(),{fx}=create(c);fx.seek(.25);const old=tree(fx),snap=fx.sample;
 A.throws(()=>fx.configure({...c,sparkleSize:NaN}));A.equal(tree(fx),old);A.equal(fx.sample,snap);
 failDraw=true;try{A.throws(()=>fx.configure({...c,sparkleSize:12}),/injected/);}finally{failDraw=false;}
 A.equal(tree(fx),old);A.equal(fx.sample,snap);A.equal(fx.owned.children.length,1);
 fx.configure({...c,sparkleSize:12});A.ok(old.destroyed);A.equal(fx.sample.frame,15);A.equal(fx.settings.sparkleSize,12);fx.destroy();
});
test('anchor snapshots copied, missing dependent layer hidden; host survives disposal',()=>{
 const c=L.defaults();c.emitters[0].layers.stars.anchor={type:'bone',name:'hand'};
 const {fx,host,source}=create(c);A.equal(fx.seek(.25).diagnostics.length,1);
 const poses={hand:{x:10,y:20,rotation:0,scale:1}};const a=fx.seek(.25,poses);A.ok(visible(fx,'stars').length);
 poses.hand.x=1000;A.deepEqual(fx.seek(.25),a);
 const owned=fx.owned;fx.destroy();fx.destroy();A.ok(owned.destroyed);A.equal(fx.allocated,0);A.deepEqual(host.children,[source]);A.ok(!source.destroyed);A.throws(()=>fx.seek(0),/destroyed/);A.throws(()=>fx.configure(c),/destroyed/);
});
