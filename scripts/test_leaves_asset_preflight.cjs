'use strict';
const {test}=require('node:test'),A=require('node:assert/strict');
const {readSpine}=require('../assets/falling-leaves/src/leaves-spine.js');
const valid=JSON.stringify({skeleton:{spine:'4.2.22'},bones:[{name:'root'}]});
const invalid=Buffer.concat([Buffer.from(valid.replace('root','').split('"name":"')[0]+'"name":"'),Buffer.from([0xff]),Buffer.from('"}]}')]);
function fixture(names,keys,raw=valid){
 const counts={atlas:0,disposed:0,images:0,parser:0},boundary=new Error('image decode boundary');
 const source={skeletonName:'sample.json',skeleton:new Blob([raw]),atlas:{async text(){counts.atlas++;return 'fixture';}},images:new Map(keys.map(k=>[k,new Blob(['image'])]))};
 const spine={TextureAtlas:class{constructor(){this.pages=names.map(name=>({name,setTexture(){}}));}dispose(){counts.disposed++;}},AtlasAttachmentLoader:class{constructor(){counts.parser++;throw boundary;}}};
 return {source,spine,counts,boundary};
}
// Stop at the first image allocation; never decode real artwork or allocate GPU textures.
async function run(f){const original=global.Image;global.Image=class{constructor(){f.counts.images++;throw f.boundary;}};try{return await readSpine(f.source,{PIXI:{},spine:f.spine});}finally{if(original===undefined)delete global.Image;else global.Image=original;}}
test('invalid UTF-8 rejected before atlas access',async()=>{const f=fixture(['a.png'],['a.png'],invalid);await A.rejects(()=>run(f),TypeError);A.deepEqual(f.counts,{atlas:0,disposed:0,images:0,parser:0});});
for(const [label,names,keys,error] of [
 ['empty atlas',[],['a.png'],/Atlas has no pages/],
 ['duplicate canonical pages',['dir/a.png','dir\\a.png'],['dir/a.png'],/Duplicate atlas page/],
 ['ambiguous canonical inputs',['dir/a.png'],['dir/a.png','dir\\a.png'],/Ambiguous atlas page/],
 ['one input reused',['one/a.png','two/a.png'],['a.png'],/Texture reused/],
 ['missing second page',['a.png','b.png'],['a.png'],/Missing atlas page/],
 ['ambiguous basename',['a.png'],['one/a.png','two/a.png'],/Ambiguous atlas page/]
])test(label+' rejected before first texture',async()=>{const f=fixture(names,keys);await A.rejects(()=>run(f),error);A.deepEqual(f.counts,{atlas:1,disposed:1,images:0,parser:0});});
for(const [label,names,keys] of [
 ['distinct exact pages',['one/a.png','two/a.png'],['one/a.png','two/a.png']],
 ['unique basename fallback',['one/a.png','two/b.png'],['a.png','b.png']],
 ['exact wins over basename',['one/a.png'],['one/a.png','two/a.png']],
 ['canonical input separator',['one/a.png'],['one\\a.png']]
])test(label+' passes preflight',async()=>{const f=fixture(names,keys);await A.rejects(()=>run(f),e=>e===f.boundary);A.deepEqual(f.counts,{atlas:1,disposed:1,images:1,parser:0});});
