'use strict';
const {test}=require('node:test');
const A=require('node:assert/strict');
const {createLoader}=require('../assets/ground-impact/src/ground-impact-loader.js');
const limits={skeletonBytes:256,atlasBytes:256,encodedBytes:32,decodedBytes:128,maxDimension:8};
const blob=x=>new Blob([x]);
function source(names=['a.png','b.png'],pages=['a.png','b.png']){return {name:'rig.json',skeleton:blob('{"skeleton":{"spine":"4.2.43"}}'),atlas:blob(pages.join('\n')),images:new Map(names.map(n=>[n,blob('img')]))};}
function fixture(fault=''){
 const live=new Set(),released=[],created=[];let decodes=0;
 const URL={createObjectURL(){const key={};live.add(key);return key;},revokeObjectURL(key){A.ok(live.delete(key));}};
 class Image{constructor(){if(fault==='constructor')throw Error('constructor');this.naturalWidth=fault==='large'?9:4;this.naturalHeight=4;}async decode(){if(++decodes===2&&fault==='decode')throw Error('decode');}}
 class ImageSource{constructor(o){created.push(o);this.destroyed=false;}destroy(){A.equal(this.destroyed,false);this.destroyed=true;released.push('source');}}
 const Spine={TextureAtlas:class{constructor(t){this.pages=t.split('\n').map((name,i)=>({name,pma:i===0,setTexture(){if(fault==='setTexture')throw Error('setTexture');}}));}},SpineTexture:{from(){let dead=false;return {dispose(){A.equal(dead,false);if(fault==='dispose'&&!released.includes('failed')){released.push('failed');throw Error('dispose');}dead=true;released.push('wrapper');}};}},AtlasAttachmentLoader:class{},SkeletonJson:class{readSkeletonData(){return {animations:[{name:'idle'}],skins:[{name:'default'}]};}},Spine:class{scale={set(){}};position={set(){}};update(){}getLocalBounds(){return {x:0,y:0,width:10,height:20};}removeFromParent(){}destroy(){released.push('model');}}};
 return {loader:createLoader({PIXI:{ImageSource},Spine,URL,Image,limits}),live,released,created,get decodes(){return decodes;}};
}
test('complete pages preserve PMA and release exactly once',async()=>{const f=fixture(),a=await f.loader.create(source());A.equal(a.defaultAnimation,'idle');A.equal(a.pages,2);A.deepEqual(f.created.map(x=>x.alphaMode),['premultiplied-alpha','premultiply-alpha-on-upload']);A.equal(f.live.size,0);a.destroy();a.destroy();A.deepEqual(f.released,['model','wrapper','wrapper','source','source']);});
test('fatal JSON and atlas UTF8 before decoding',async()=>{for(const key of ['skeleton','atlas']){const f=fixture(),s=source();s[key]=blob(new Uint8Array([255]));await A.rejects(f.loader.create(s),/UTF-8|encoded data/i);A.equal(f.decodes,0);}});
test('duplicates, missing and reused pages reject before decoding',async()=>{for(const s of [source(['a.png','b.png','x/c.png','x\\c.png']),source(['a.png']),source(['x/a.png','y/a.png'],['a.png']),source(['a.png'],['a.png','x/a.png']),source(['a.png'],['a.png','a.png'])]){const f=fixture();await A.rejects(f.loader.create(s),/duplicate|missing|ambiguous|reused/i);A.equal(f.decodes,0);}});
test('exact path wins; basename fallback works',async()=>{const f=fixture(),a=await f.loader.create(source(['x/a.png','y/a.png','b.png'],['x/a.png','z/b.png']));A.equal(a.pages,2);a.destroy();});
test('encoded and decoded budgets reject without GPU allocation',async()=>{const f=fixture(),s=source();s.images.set('a.png',blob('x'.repeat(33)));await A.rejects(f.loader.create(s),/encoded/i);A.equal(f.decodes,0);const g=fixture('large');await A.rejects(g.loader.create(source()),/dimension/i);A.equal(g.created.length,0);A.equal(g.live.size,0);const h=fixture();await A.rejects(h.loader.create(source(['a.png','b.png','c.png'],['a.png','b.png','c.png'])),/decoded/i);A.equal(h.created.length,0);A.equal(h.live.size,0);});
test('constructor and second decode failure revoke every URL before allocation',async()=>{for(const fault of ['constructor','decode']){const f=fixture(fault);await A.rejects(f.loader.create(source()),new RegExp(fault));A.equal(f.live.size,0);A.equal(f.created.length,0);}});
test('failed texture assignment releases owned resources',async()=>{const f=fixture('setTexture');await A.rejects(f.loader.create(source()),/setTexture/);A.deepEqual(f.released,['wrapper','source']);A.equal(f.live.size,0);});
test('cleanup continues after failure and retries only failed resource',async()=>{const f=fixture('dispose'),a=await f.loader.create(source());A.throws(()=>a.destroy(),/cleanup/i);A.deepEqual(f.released,['model','failed','wrapper','source','source']);a.destroy();a.destroy();A.deepEqual(f.released,['model','failed','wrapper','source','source','wrapper']);});
