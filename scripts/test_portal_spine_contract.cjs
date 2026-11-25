'use strict';
const A=require('node:assert/strict'),{test}=require('node:test'),L=require('../assets/magic-portal/src/portal-spine.js');
const pages=(...names)=>names.map(name=>({name})),images=(...names)=>new Map(names.map(name=>[name,{name}]));
test('exact paths, unique basename fallback and no ambiguous reuse',()=>{
 const a=images('a/face.png','b/face.png','body.png');
 A.equal(L.matchPages(pages('a\\face.png','folder/body.png'),a)[0][1],a.get('a/face.png'));
 A.throws(()=>L.matchPages(pages('face.png'),a),/ambiguous/);
 A.throws(()=>L.matchPages(pages('missing.png'),a),/missing/);
 A.throws(()=>L.matchPages(pages('body.png','folder/body.png'),a),/reused/);
 A.throws(()=>L.matchPages(pages('body.png','body.png'),a),/duplicate/);
});
test('strict JSON and binary version gate',()=>{
 class Decoder{decode(bytes){return String.fromCharCode(...bytes);}}
 const bytes=s=>Uint8Array.from([...s].map(x=>x.charCodeAt(0)));
 class BinaryInput{constructor(b){this.b=b;}readInt32(){}readString(){return String.fromCharCode(...this.b);}}
 const env={TextDecoder:Decoder,spine:{BinaryInput}};
 A.equal(L.decodeSkeleton('a.JSON',bytes('{"skeleton":{"spine":"4.2.120"}}'),env).version,'4.2.120');
 A.equal(L.decodeSkeleton('a.skel',bytes('4.2.0'),env).binary,true);
 for(const version of ['4.2.','4.2.bad','4.2.01','4.3.0','3.8.99']){A.throws(()=>L.decodeSkeleton('a.skel',bytes(version),env),/4.2/);A.throws(()=>L.decodeSkeleton('a.json',bytes(JSON.stringify({skeleton:{spine:version}})),env),/4.2/);}
 A.throws(()=>L.decodeSkeleton('a.json',bytes('null'),env),/4.2/);
 A.throws(()=>L.decodeSkeleton('a.png',bytes(''),env),/expected/);
});
test('host-local bone coordinates, rotation and scale, Y-down and affine projection',()=>{
 const bone={active:true,data:{name:'hand'},worldX:10,worldY:20,a:0,b:-1,c:1,d:0};
 const model={localTransform:{a:0,b:2,c:-2,d:0,tx:100,ty:200},skeleton:{bones:[bone,{...bone,data:{name:'inactive'},active:false},{...bone,data:{name:'shear'},b:-2},{...bone,data:{name:'mirror'},b:1}]}};
 const p=L.anchorPoses(model);
 A.deepEqual(p.$local,{x:100,y:200,rotation:90,scale:2});
 A.equal(p.hand.x,60);A.equal(p.hand.y,220);A.ok(Math.abs(Math.abs(p.hand.rotation)-180)<1e-8);A.equal(p.hand.scale,2);
 A.equal(p.inactive,undefined);A.deepEqual(p.shear,p.hand);A.deepEqual(p.mirror,p.hand);
 model.skeleton.bones=[{...bone,data:{name:'degenerate'},a:0,c:0}];A.equal(L.anchorPoses(model).degenerate,undefined);
});

function fixture({badImage=false,badParser=false,version='4.2.120',missing=false}={}){
 const state={urls:0,revoked:0,textures:[],wrappers:[],models:[],seeks:[]};
 class Decoder{decode(b){return String.fromCharCode(...b);}}
 class TextureAtlas{constructor(){this.pages=[{name:'face.png',pma:true,setTexture(){}},{name:'body.png',pma:false,setTexture(){}}]}}
 class ImageSource{constructor(opts){this.opts=opts;this.destroyed=0;state.textures.push(this)}destroy(){this.destroyed++}}
 class Image{async decode(){if(badImage&&this.src==='blob:2')throw Error('decode failure')}}
 class Parser{readSkeletonData(){if(badParser)throw Error('parse failure');return {animations:[{name:'idle'},{name:'walk'}],skins:[{name:'default'},{name:'alt'}],defaultSkin:{name:'default'}}}}
 class Spine{
  constructor(){state.models.push(this);this.destroyed=0;this.visible=true;
   this.skeleton={skin:{name:'default'},bones:[{active:true,data:{name:'hand'},worldX:10,worldY:20,a:1,b:0,c:0,d:-1}],setSkinByName:n=>{this.skeleton.skin={name:n}},setSlotsToSetupPose(){},setToSetupPose(){}};
   let entry=null;this.state={getCurrent:()=>entry,setAnimation:(_,name)=>{entry={animation:{name}}},clearTracks:()=>{entry=null}};
   this.localTransform={a:1,b:0,c:0,d:1,tx:0,ty:0};this.scale={set:s=>{this.localTransform.a=this.localTransform.d=s}};this.position={set:(x,y)=>{this.localTransform.tx=x;this.localTransform.ty=y}};
  }update(){}updateLocalTransform(){}getLocalBounds(){return {x:0,y:0,width:100,height:100}}removeFromParent(){}destroy(){this.destroyed++}
 }
 const env={TextDecoder:Decoder,PIXI:{ImageSource},Image,URL:{createObjectURL:()=> 'blob:'+ ++state.urls,revokeObjectURL:()=>state.revoked++},FxTimeline:{seekSpine:(m,t)=>{state.seeks.push(t);m.skeleton.bones[0].worldX=10+t;}},spine:{TextureAtlas,AtlasAttachmentLoader:class{},SkeletonJson:Parser,SkeletonBinary:Parser,Spine,SpineTexture:{from:()=>{const w={disposed:0,dispose(){this.disposed++}};state.wrappers.push(w);return w;}}}};
 const bytes=Uint8Array.from([...JSON.stringify({skeleton:{spine:version}})].map(x=>x.charCodeAt(0)));
 const source={name:'test.json',skeleton:{arrayBuffer:async()=>bytes.buffer},atlas:{text:async()=>''},images:images(...(missing?['face.png']:['face.png','body.png']))};
 return {state,env,source};
}
test('asset ownership, PMA, absolute pose and retained image snapshot',async()=>{
 const {state,env,source}=fixture(),asset=await L.create(source,env);
 A.equal(asset.pages,2);A.equal(asset.defaultAnimation,'idle');A.equal(state.urls,2);A.equal(state.revoked,2);
 A.deepEqual(state.textures.map(t=>t.opts.alphaMode),['premultiplied-alpha','premultiply-alpha-on-upload']);
 source.images.clear();A.equal(asset.source.images.size,2);
 const a=asset.pose(.5,{animation:'walk',skin:'alt',speed:2,visible:false});
 A.deepEqual(state.seeks,[1]);A.equal(a.hand.x,178);A.equal(asset.model.visible,false);
 A.deepEqual(asset.pose(.5,{animation:'walk',skin:'alt',speed:2,visible:false}),a);
 A.throws(()=>asset.pose(.5,{animation:'missing'}),/unknown animation/);
 asset.destroy();asset.destroy();A.deepEqual(state.textures.map(t=>t.destroyed),[1,1]);A.deepEqual(state.wrappers.map(t=>t.disposed),[1,1]);A.equal(state.models[0].destroyed,1);
 A.throws(()=>asset.pose(0),/destroyed/);
});
test('reject before allocation and dispose partial decode/parser failures',async()=>{
 for(const opts of [{version:'4.2.bad'},{missing:true},{badImage:true},{badParser:true}]){
  const {state,env,source}=fixture(opts);await A.rejects(()=>L.create(source,env));
  A.equal(state.urls,state.revoked);A.ok(state.textures.every(t=>t.destroyed===1));A.ok(state.wrappers.every(t=>t.disposed===1));
  if(opts.version||opts.missing)A.equal(state.textures.length,0);
  if(opts.badImage)A.equal(state.textures.length,1);
  if(opts.badParser)A.equal(state.textures.length,2);
 }
});
