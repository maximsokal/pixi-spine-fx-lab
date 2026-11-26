'use strict';
const {test}=require('node:test'),A=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const H=require('../assets/sword-slash/src/sword-slash-history.js');
function verifyBlueprint(raw,H,A){
 const m=raw.match(/^```json\s*\n([\s\S]*?)\n```$/m);A.ok(m,'Blueprint fence');const doc=JSON.parse(m[1]),base=H.defaults();
 A.equal(doc.effectId,'fx.game.sword-slash');
 A.equal(doc.implementation.status,'specification-only');A.equal(doc.tests.verified,false);
 A.equal(doc.parameters.length,71);
 const paths=new Set();
 for(const p of doc.parameters){A.ok(!paths.has(p.key),p.key);paths.add(p.key);const value=p.key.split('.').reduce((o,k)=>o[k],base);A.deepEqual(p.default,value,p.key);A.equal(p.exportPath,'settings.'+p.key);A.equal(doc.exportMapping.parameterMap[p.key],p.exportPath);if(p.type==='enum')A.ok(p.choices.includes(value),p.key);if(p.type==='number'||p.type==='integer'){A.ok(value>=p.min&&value<=p.max&&p.step>0,p.key);if(p.type==='integer')A.ok([value,p.min,p.max,p.step].every(Number.isInteger),p.key);}}
 for(const v of doc.curves){const c=v.key.split('.').reduce((o,k)=>o[k],base);A.equal(c.domain,v.domain);}
 for(const v of doc.palettes){const c=v.key.split('.').reduce((o,k)=>o[k],base);A.equal(c.domain,v.domain);}
 A.deepEqual(H.normalizeSettings(base),H.createCompiler({host:{},world:{}})(base).settings);
}

test('Sword Slash Blueprint scalar defaults, bindings and normalization match runtime',()=>verifyBlueprint(fs.readFileSync(path.join(__dirname,'../references/fx/game/sword-slash.md'),'utf8'),H,A));
