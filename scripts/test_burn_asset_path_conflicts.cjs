'use strict';
const {test}=require('node:test'),A=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../assets/template/src/export-ui.js'),'utf8');
// Isolate the actual pure archive path helpers; no Pixi or DOM is needed.
const start=source.indexOf('function safePath('),end=source.indexOf('function preset(',start);
A.ok(start>=0);
const env={};vm.runInNewContext(source.slice(start,end<0?undefined:end),env);
const asset=(skeletonName,atlasName,images=[])=>({skeletonName,atlasName,images:new Map(images)});
// Baseline has two independent name selections. Test the actual old behavior too.
const paths=a=>typeof env.assetArchivePaths==='function'?env.assetArchivePaths(a):{skeleton:env.assetArchiveName(a.skeletonName,'skeleton'),atlas:env.assetArchiveName(a.atlasName,'atlas')};
const plain=x=>JSON.parse(JSON.stringify(x));
function portable(names){
 for(const name of names){A.match(name,/^[A-Za-z0-9._/-]+$/);for(const p of name.split('/')){A.doesNotMatch(p,/\.$/);A.doesNotMatch(p,/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i);}}
 const lower=names.map(x=>x.toLowerCase());for(let i=0;i<lower.length;i++)for(let j=i+1;j<lower.length;j++)A.ok(lower[i]!==lower[j]&&!lower[i].startsWith(lower[j]+'/')&&!lower[j].startsWith(lower[i]+'/'),names.join(' vs '));
}
test('safe existing skeleton and atlas paths remain unchanged',()=>A.deepEqual(plain(paths(asset('hero/hero.skel','hero/hero.atlas'))),{skeleton:'hero/hero.skel',atlas:'hero/hero.atlas'}));
test('Windows device basenames and reserved nested directories are aliased',()=>{const a=asset('CON.json','LPT1/hero.atlas');const p=paths(a);portable(Object.values(p));A.equal(p.skeleton,'skeleton.json');A.equal(p.atlas,'skeleton.atlas');});
test('Windows trailing-dot directory is aliased and binary suffix preserved',()=>{const p=paths(asset('folder./hero.skel','hero.atlas'));portable(Object.values(p));A.equal(p.skeleton,'skeleton.skel');A.equal(p.atlas,'hero.atlas');});
test('skeleton file conflicts with atlas directory regardless of case',()=>{const p=paths(asset('Hero.json','hero.JSON/body.atlas'));portable(Object.values(p));A.equal(p.skeleton,'Hero.json');A.equal(p.atlas,'skeleton.atlas');});
test('atlas alias also conflicts with a skeleton ancestor',()=>{const p=paths(asset('skeleton.atlas/hero.skel','hero #.atlas'));portable(Object.values(p));A.equal(p.atlas,'atlas_001.atlas');});
test('atlas file conflicts with skeleton directory',()=>{const p=paths(asset('body.atlas/hero.skel','body.atlas'));portable(Object.values(p));A.equal(p.skeleton,'body.atlas/hero.skel');});
test('page aliases reserve the actual resolved skeleton and atlas names and preserve bytes',()=>{const data=new Uint8Array([1,2,3]),a=asset('hero.json','hero.json/body.atlas',[['skeleton.atlas/image.png',data],['page_000.png',data]]),p=paths(a);const pages=env.pageArchiveEntries(a,[{name:'skeleton.atlas/image.png'},{name:'page_000.png'}],p);portable([...Object.values(p),...pages.map(v=>v.path.slice(7))]);A.equal(pages[0].path,'assets/page_001.png');A.equal(pages[1].path,'assets/page_000.png');A.equal(pages[0].image,data);A.deepEqual(plain(paths(a)),plain(p));});
test('unsafe traversal still fails rather than aliasing',()=>A.throws(()=>paths(asset('../hero.skel','hero.atlas')),/unsupported export path/));
