'use strict';
async function run(read,A,T){
 const g={};for(const p of ['assets/template/src/curve-core.js','assets/template/src/spacing-core.js','assets/template/src/color-core.js','assets/snowfall/src/snow-core.js'])new Function('globalThis',read(p))(g);
 function load(p){const m={exports:{}};new Function('globalThis','module',read(p))(g,m);return m.exports;}
 const E=load('assets/snowfall/src/snow-editor.js'),X=load('assets/snowfall/src/snow-export.js');
 const doc={createElement:()=>({style:{},getContext:()=>null}),createElementNS:()=>({style:{}})},win={};
 const P=new Function('navigator','document','window','self',read('assets/template/vendor/pixi-8.22.0.min.js')+'\nreturn PIXI;')({userAgent:'Chromium',platform:'Linux'},doc,win,win);win.PIXI=P;
 const Sp=new Function('PIXI','window','self','require',read('assets/template/vendor/spine-pixi-v8-4.2.120.min.js')+'\nreturn spine;')(P,win,win,n=>{if(n==='pixi.js')return P;throw Error(n);});
 const pages=names=>names.map(name=>({name})),src=id=>'// '+id;
 const args=(asset,target='webgl')=>({settings:g.FxSnow.defaults(),asset,source:src,target});
 const atlasText='nested/a.png\nsize: 16,16\npma: true\n\n雪 #?.png\nsize: 16,16\npma: false\n';
 const images=new Map([['a.png','original A'],['雪 #?.png','original B']]);
 const asset={skeletonName:'hero #.json',skeleton:'{}',atlasName:'nested/hero.atlas',atlas:atlasText,images,skin:'default',animation:'idle'};
 await T('actual Spine atlas parser and accepted basename mapping survive both developer archives',async()=>{
  const atlas=new Sp.TextureAtlas(atlasText);try{
   const bindings=E.pageBindings(atlas.pages,images);A.deepEqual(bindings,[{name:'nested/a.png',key:'a.png'},{name:'雪 #?.png',key:'雪 #?.png'}]);
   for(const target of ['webgl','webgpu']){
    const r=X.packageEntries(args({...asset,pageBindings:bindings},target)),m=r.preset.asset,entries=new Map(r.entries.map(e=>[e.name,e.data]));
    A.equal(m.sourceSkeletonName,asset.skeletonName);A.equal(m.sourceAtlasName,asset.atlasName);
    A.equal(entries.get('public/'+m.skeleton),asset.skeleton);A.equal(entries.get('public/'+m.atlas),atlasText);
    A.deepEqual(m.pages,[{name:'nested/a.png',path:'assets/nested/a.png'},{name:'雪 #?.png',path:'assets/page_001.png'}]);
    A.equal(entries.get('public/'+m.pages[0].path),'original A');A.equal(entries.get('public/'+m.pages[1].path),'original B');
    A.ok(entries.get('example.js').includes('data:{images:Object.fromEntries(p.asset.pages.map(({name,path})=>[name,path]))}'));
    A.equal(entries.has('public/assets/a.png'),false);
   }
  }finally{atlas.dispose();}
 });
 await T('duplicate, missing, ambiguous, reused and unsafe pages rejected before allocation',()=>{
  for(const [names,input] of [
   [[],images],[['missing.png'],images],[['a.png','a.png'],images],[['folder/a.png','a.png'],images],
   [['folder/a.png'],new Map([['one/a.png','a'],['two/a.png','b']])],
   [['a.png'],new Map([['x/a.png','a'],['x\\a.png','b']])],[['../a.png'],images]
  ])A.throws(()=>E.pageBindings(pages(names),input));
  A.deepEqual(E.pageBindings(pages(['x/a.png']),new Map([['x/a.png','exact'],['other/a.png','other']])),[{name:'x/a.png',key:'x/a.png'}]);
 });
 await T('archive rejects missing or reused bindings and preserves portable noncolliding pages',()=>{
  for(const bindings of [undefined,[],[{name:'a.png',key:'absent'}],[{name:'a.png',key:'a.png'},{name:'b.png',key:'a.png'}],[{name:'../a.png',key:'a.png'}]])A.throws(()=>X.packageEntries(args({...asset,pageBindings:bindings})));
  const a={...asset,skeletonName:'Hero.json',atlasName:'hero.JSON/body.atlas',images:new Map([['A.png','1'],['a.png','2'],['aux.png','3']]),pageBindings:[{name:'A.png',key:'A.png'},{name:'a.png',key:'a.png'},{name:'aux.png',key:'aux.png'}]};
  const m=X.packageEntries(args(a)).preset.asset;
  const paths=[m.skeleton,m.atlas,...m.pages.map(p=>p.path)].map(p=>p.toLowerCase());
  A.equal(new Set(paths).size,paths.length);for(let i=0;i<paths.length;i++)for(let j=0;j<paths.length;j++)if(i!==j)A.ok(!paths[i].startsWith(paths[j]+'/'));
  A.ok(m.pages.every(p=>/^[A-Za-z0-9._/-]+$/.test(p.path)));A.ok(!m.pages[2].path.endsWith('/aux.png'));
 });
}
module.exports={run};
if(require.main===module){const fs=require('node:fs'),path=require('node:path'),cases=[];run(p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8'),require('node:assert/strict'),(n,f)=>{cases.push([n,f]);}).then(()=>{for(const [n,f] of cases)require('node:test').test(n,f);}).catch(e=>{console.error(e);process.exitCode=1;});}
