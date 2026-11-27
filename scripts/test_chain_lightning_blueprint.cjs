'use strict';
function verify(raw,H,A){
 const d=JSON.parse(raw.match(/\x60\x60\x60json\n([\s\S]*?)\n\x60\x60\x60/)[1]),base=H.defaults(),seen=new Set(),get=k=>k.split('.').reduce((o,x)=>o[x],base);
 A.equal(d.effectId,'fx.ice.chain-lightning');A.equal(d.implementation.status,'specification-only');A.equal(d.tests.verified,false);
 const expected=[...Object.keys(base).filter(k=>!['schemaVersion','mode','source','targets','curves','palettes'].includes(k)),...['source','targets.0.anchor'].flatMap(p=>['type','space','x','y','rotation'].map(k=>p+'.'+k)),...['enabled','x','y','delayFrames','seed'].map(k=>'targets.0.'+k),...H.LAYERS.flatMap(l=>Object.keys(base.targets[0].layers[l]).map(k=>'targets.0.layers.'+l+'.'+k))];
 for(const p of d.parameters){A.ok(!seen.has(p.key));seen.add(p.key);A.deepEqual(p.default,get(p.key));A.equal(p.exportPath,'settings.'+p.key);A.equal(d.exportMapping.parameterMap[p.key],p.exportPath);if(p.type==='enum')A.ok(p.choices.includes(p.default));if(p.type==='number'||p.type==='integer'){A.ok(p.min<=p.default&&p.default<=p.max&&p.step>0);if(p.type==='integer')A.ok([p.default,p.min,p.max,p.step].every(Number.isInteger));}}
 A.deepEqual([...seen].sort(),expected.sort());A.equal(Object.keys(d.exportMapping.parameterMap).length,seen.size);
 for(const v of [...d.curves,...d.palettes])A.equal(v.domain,get(v.key).domain);
 A.deepEqual(d.curves.map(v=>v.key).sort(),Object.keys(base.curves).map(k=>'curves.'+k).sort());
 A.deepEqual(d.palettes.map(v=>v.key).sort(),Object.keys(base.palettes).map(k=>'palettes.'+k).sort());
 for(const [k,n] of Object.entries(H.BUDGETS)){const b=d.qualityBudgets[k];A.equal(b.maxPrimitives,n);A.equal(b.maxEvents,H.MAX_EVENTS);A.equal(b.maxVertices,H.MAX_VERTICES);A.equal(b.maxLinkPx,H.MAX_LINK);A.equal(b.maxEmitters,8);}
 A.deepEqual(H.normalize(base),H.compile(base).settings);A.equal(base.targets.length,4);A.equal(H.compile(base).meta.plans[0].contactFrame,2);A.equal(H.compile(base).meta.plans.at(-1).contactFrame,17);
}
module.exports={verify};
if(require.main===module){const fs=require('node:fs'),path=require('node:path'),H=require('../assets/chain-lightning/src/chain-core.js');require('node:test').test('Chain Lightning blueprint matches actual defaults and contracts',()=>verify(fs.readFileSync(path.join(__dirname,'../references/fx/ice/chain-lightning.md'),'utf8'),H,require('node:assert/strict')));}
