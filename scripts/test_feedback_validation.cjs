'use strict';
const {test}=require('node:test'),A=require('node:assert/strict'),F=require('./feedback.cjs');
const input=()=>({action:'create',title:'FX preview freezes',summary:'Preview fails after reset.',expected:'Preview updates.',actual:'Preview remains static.',reproduction:['Open synthetic fixture','Reset preview'],environment:'Pixi 8.22.0',hypothesis:'Stale state',visibility:'unknown',dedup:'checked'});
const prepare=(overrides={})=>F.prepare({...input(),...overrides});
test('require dense reproduction steps and reject custom array map bypass',()=>{
 A.throws(()=>prepare({reproduction:new Array(2)}),/reproduction/);
 const sparse=['Open fixture',,'Reset'];A.throws(()=>prepare({reproduction:sparse}),/reproduction/);
 const custom=['token=secret'];custom.map=()=>['Safe text'];A.throws(()=>prepare({reproduction:custom}),/sensitive|reproduction/);
});
test('text-only reports reject HTML and Markdown image constructs in all body fields',()=>{
 for(const value of ['<!-- hidden evidence -->','<img src="https://example.invalid/pixel.png">','![image](https://example.invalid/pixel.png)','![image][ref]','![image]','```js\ncode','~~~\ncode'])for(const field of ['summary','actual','hypothesis','environment','expected'])A.throws(()=>prepare({[field]:value}),/markup/);
 A.throws(()=>prepare({reproduction:['![image](https://example.invalid/pixel.png)']}),/markup/);
});
test('reject bidi controls and Unicode line separators in title or body',()=>{
 for(const value of ['safe\u202Etext','safe\u2066text','safe\u2028text','safe\u2029text']){A.throws(()=>prepare({summary:value}),/invalid/);A.throws(()=>prepare({title:value}),/invalid/);}
});
test('comment contextual title is bound to exact reviewed draft',()=>{
 const a=prepare({action:'comment',issue:42,title:'FX preview freezes'}),b=prepare({action:'comment',issue:42,title:'Different issue title'});
 A.notEqual(a.digest,b.digest);A.throws(()=>F.createGate(b).approve(a.digest),/approval/);
});
test('ordinary technical syntax still works',()=>{
 const d=prepare({summary:'Alpha < 0.5; x > 0; `foo()`; [array index]; PNG RGBA',reproduction:['Open fixture','Inspect x < 2']});A.match(d.body,/Alpha < 0.5/);A.match(d.body,/NOT REPRODUCED/);
});
