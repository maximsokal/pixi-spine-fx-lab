'use strict';
function run(read,A,T){
 const g={},common='assets/template/src/',base='assets/blizzard/src/',vendor='assets/template/vendor/',sample='assets/template/sample/';
 for(const p of [common+'curve-core.js',common+'spacing-core.js',common+'color-core.js',base+'blizzard-core.js',base+'blizzard-runtime.js',base+'blizzard-pose.js'])new Function('globalThis',read(p))(g);
 const doc={createElement:()=>({style:{},getContext:()=>null}),createElementNS:()=>({style:{}})},win={};
 const P=new Function('navigator','document','window','self',read(vendor+'pixi-8.22.0.min.js')+'\nreturn PIXI;')({userAgent:'Chromium',platform:'Linux'},doc,win,win);win.PIXI=P;
 const Sp=new Function('PIXI','window','self','require',read(vendor+'spine-pixi-v8-4.2.120.min.js')+'\nreturn spine;')(P,win,win,n=>{if(n==='pixi.js')return P;throw Error(n);});
 T('actual Doctor head atlas and all animations, anchored runtime and seek parity (CPU only)',()=>{
  const atlas=new Sp.TextureAtlas(read(sample+'Doctor_head.atlas')),sources=[],stage=new P.Container(),host=new P.Container();stage.addChild(host);let model,fx;
  try{
   for(const p of atlas.pages){const src=new P.ImageSource({resource:{width:p.width,height:p.height},alphaMode:p.pma?'premultiplied-alpha':'premultiply-alpha-on-upload'});sources.push(src);p.setTexture(Sp.SpineTexture.from(src));}
   const data=new Sp.SkeletonJson(new Sp.AtlasAttachmentLoader(atlas)).readSkeletonData(JSON.parse(read(sample+'Doctor_head.json')));
   A.equal(data.bones.length,76);A.equal(data.slots.length,58);A.equal(data.animations.length,9);A.equal(atlas.pages.length,2);
   model=new Sp.Spine({skeletonData:data,autoUpdate:false});model.update(0);const b=model.getLocalBounds(),scale=Math.min(260/b.width,330/b.height,2);model.scale.set(scale);model.position.set(256-(b.x+b.width/2)*scale,260-(b.y+b.height/2)*scale);host.addChild(model);
   const canvas=()=>({width:0,height:0,getContext:()=>({createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData(){}})});
   const d=g.FxBlizzard.defaults(),e=d.emitters[0];e.anchor={type:'bone',name:data.bones[1].name,slot:'',space:'local',x:0,y:0,rotation:0};e.layers.foreground.anchor={type:'slot',name:data.slots[1].name,slot:'',space:'world',x:0,y:0,rotation:0};e.layers.whiteout.enabled=true;
   fx=g.FxBlizzardRuntime.createBlizzard({PIXI:P,app:{stage},host,model,settings:d,makeCanvas:canvas});
   const times=[0,.1,.5,.9,59/60,1];let checked=0;
   for(const animation of ['',...data.animations.map(a=>a.name)]){
    const snap=t=>{g.FxBlizzardPose.seek(model,d,t,{animation});fx.seek(t);A.equal(fx.diagnostics.length,0);const bounds=fx.currentBounds();A.ok(bounds&&Object.values(bounds).every(Number.isFinite));A.ok(fx.totalActive<=g.FxBlizzard.BUDGETS.balanced);checked++;return {frame:fx.sample,positions:[...fx.emitters.values()].flatMap(o=>Object.values(o.layers).map(l=>[l.surface.x,l.surface.y,l.surface.rotation]))};};
    const expected=times.map(snap);A.deepEqual(expected[0],expected.at(-1));for(let i=times.length-1;i>=0;i--)A.deepEqual(snap(times[i]),expected[i]);
   }A.equal(checked,120);
  }finally{fx?.destroy();model?.destroy();atlas.dispose();for(const s of sources)if(!s.destroyed)s.destroy();stage.destroy({children:true});}
 });
}
module.exports={run};
if(require.main===module){const fs=require('node:fs'),path=require('node:path');run(p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8'),require('node:assert/strict'),require('node:test').test);}
