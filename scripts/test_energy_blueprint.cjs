'use strict';
function verify(raw,H,A){
 const doc=JSON.parse(raw.match(/```json\n([\s\S]*?)\n```/)[1]),base=H.defaults(),seen=new Set();
 A.equal(doc.effectId,'fx.game.energy-projectile');A.equal(doc.implementation.status,'specification-only');A.equal(doc.tests.verified,false);A.equal(doc.parameters.length,83);
 for(const p of doc.parameters){A.ok(!seen.has(p.key));seen.add(p.key);const value=p.key.split('.').reduce((o,k)=>o[k],base);A.deepEqual(p.default,value);A.equal(p.exportPath,'settings.'+p.key);A.equal(doc.exportMapping.parameterMap[p.key],p.exportPath);if(p.type==='enum')A.ok(p.choices.includes(value));if(p.type==='number'||p.type==='integer'){A.ok(value>=p.min&&value<=p.max&&p.step>0);if(p.type==='integer')A.ok([value,p.min,p.max,p.step].every(Number.isInteger));}}
 for(const v of [...doc.curves,...doc.palettes])A.equal(v.key.split('.').reduce((o,k)=>o[k],base).domain,v.domain);
 for(const [k,b] of Object.entries(H.BUDGETS))A.equal(doc.qualityBudgets[k].maxPrimitives,b);
 A.deepEqual(H.normalize(base),H.compile(base).settings);
}
module.exports={verify};
if(require.main===module){const fs=require('node:fs'),path=require('node:path'),H=require('../assets/energy-projectile/src/energy-core.js');require('node:test').test('Energy blueprint matches runtime defaults and contracts',()=>verify(fs.readFileSync(path.join(__dirname,'../references/fx/game/energy-projectile.md'),'utf8'),H,require('node:assert/strict')));}
