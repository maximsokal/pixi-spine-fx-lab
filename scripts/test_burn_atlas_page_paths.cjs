'use strict';
const {test}=require('node:test'),A=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../assets/template/src/export-ui.js'),'utf8');
function fixture(pageNames,images,asset={}){
 const loadedAsset={skeletonName:'nested/hero #1.skel',atlasName:'nested/hero.atlas',skeleton:new Uint8Array([1,2]),atlas:new Uint8Array([3,4]),version:'4.2.43',images:new Map(images),...asset};
 const dom={textContent:'',value:'idle',checked:false,classList:{contains:()=>false}};
 const window={},env={TextEncoder,Uint8Array,DataView,Blob,window,$:()=>({...dom}),loadedAsset,atlas:{pages:pageNames.map(name=>({name}))},cfg:{duration:1,animationSpeed:1},durationFrames:()=>60,TIMELINE_FPS:60,progress:0,inverseEase:x=>x,fx:{profile:'low'},app:{screen:{width:512,height:512}},frameBox:{},poseBox:{},SpineBurnFx:{GL_VERTEX:'',GL_FRAGMENT:'',GPU_SHADER:'',PROFILES:{low:{steps:3,halo:0}}},sequenceZip:null};
 vm.runInNewContext(source,env);return {run:target=>window.__burnExport.buildPackage(target),loadedAsset};
}
const bytes=n=>new Uint8Array([n]);
const plain=x=>JSON.parse(JSON.stringify(x));
function check(pack,original){
 const names=pack.entries.map(e=>e.name);A.equal(new Set(names).size,names.length);
 A.deepEqual(plain(JSON.parse(pack.entries.find(e=>e.name==='public/preset.json').data)),plain(pack.preset));
 const files=new Map(pack.entries.map(e=>[e.name,e.data]));
 A.deepEqual(files.get('public/'+pack.preset.asset.atlas),original.atlas);
 A.deepEqual(files.get('public/'+pack.preset.asset.skeleton),original.skeleton);
 for(const p of pack.preset.asset.pages){A.match(p.path,/^assets\/[A-Za-z0-9._/-]+$/);A.ok(files.has('public/'+p.path));}
 A.match(files.get('example.js'),/data: \{ images: Object.fromEntries\(preset.asset.pages.map/);
}
test('both archives retain original bytes, safe URLs and exact atlas page identities',async()=>{
 const f=fixture(['hero #1 %.png','sub/other?.png','page_000.png','normal.png'],[['hero #1 %.png',bytes(11)],['other?.png',bytes(22)],['page_000.png',bytes(33)],['normal.png',bytes(44)]]);
 for(const target of ['webgl','webgpu']){const p=await f.run(target);check(p,f.loadedAsset);A.deepEqual(plain(p.preset.asset.pages),[{name:'hero #1 %.png',path:'assets/page_001.png'},{name:'sub/other?.png',path:'assets/page_002.png'},{name:'page_000.png',path:'assets/page_000.png'},{name:'normal.png',path:'assets/normal.png'}]);for(const [i,n] of [11,22,33,44].entries())A.deepEqual(p.entries.find(e=>e.name==='public/'+p.preset.asset.pages[i].path).data,bytes(n));}
});
test('nested atlas and backslash page names use explicit root-relative package paths',async()=>{
 const f=fixture(['sub\\texture.png','other.png'],[['sub/texture.png',bytes(1)],['other.png',bytes(2)]]),p=await f.run('webgl');check(p,f.loadedAsset);A.deepEqual(plain(p.preset.asset.pages),[{name:'sub\\texture.png',path:'assets/sub/texture.png'},{name:'other.png',path:'assets/other.png'}]);A.equal(p.preset.asset.atlas,'assets/nested/hero.atlas');
});
test('case-insensitive collision, Windows reserved names and directory collision are aliased',async()=>{
 const f=fixture(['A.png','a.png','CON.png','page_000.png/x.png'],[['A.png',bytes(1)],['a.png',bytes(2)],['CON.png',bytes(3)],['page_000.png/x.png',bytes(4)]]),p=await f.run('webgpu');check(p,f.loadedAsset);A.deepEqual(plain(p.preset.asset.pages).map(x=>x.path),['assets/A.png','assets/page_001.png','assets/page_002.png','assets/page_000.png/x.png']);
});
test('missing, ambiguous, traversal, unsupported type and duplicate pages fail before returning ZIP',async()=>{
 for(const [names,images] of [[['missing.png'],[]],[['sub/a.png'],[['one/a.png',bytes(1)],['two/a.png',bytes(2)]]],[['../a.png'],[['../a.png',bytes(1)]]],[['a.exe'],[['a.exe',bytes(1)]]],[['a.png','a.png'],[['a.png',bytes(1)]]]])await A.rejects(fixture(names,images).run('webgl'));
});
