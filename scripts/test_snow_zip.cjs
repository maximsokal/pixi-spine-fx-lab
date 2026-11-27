'use strict';
const {test}=require('node:test'),A=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../assets/snowfall/src/zip-core.js'),'utf8');
function load(code=source){const ctx={TextEncoder,TextDecoder,Uint8Array,DataView,Blob};vm.runInNewContext(code,ctx);return ctx.FxSnowZip.makeZip;}
const make=load(),entry=(name,data='x')=>({name,data});
test('reject unsafe raw paths before writing',async()=>{
 for(const name of ['../x','/x','C:/x','a//b','a\\b','a\x00b','a:b','a\n.txt','aux.txt','dir./x','a?b','x\uD800'])await A.rejects(make([entry(name)]),/Unsafe|name/i,name);
});
test('reject case-insensitive and file-directory alias conflicts in both orders',async()=>{
 for(const names of [['A.png','a.PNG'],['a','A/b'],['a/b','A'],['a','a']])await A.rejects(make(names.map(n=>entry(n))),/Unsafe|duplicate|conflict/i,names.join(','));
});
test('UTF-8 filename length must fit ZIP16',async()=>{
 await A.rejects(make([entry('雪'.repeat(21846))]),/name/i);
 const blob=await make([entry('a'.repeat(65535),'')]);const b=Buffer.from(await blob.arrayBuffer());A.equal(b.readUInt16LE(26),65535);A.equal(b.readUInt16LE(30+65535+28),65535);
});
test('archive budget includes both headers, both names and EOCD',async()=>{
 // Only shrink the byte limit in the actual implementation to make boundary tests cheap.
 const small=load(source.replaceAll('256*1024*1024','150'));
 const ok=await small([entry('a','x'.repeat(50))]);A.equal(ok.size,150);
 await A.rejects(small([entry('a','x'.repeat(51))]),/budget/i);
 await A.rejects(small([entry('a',''),entry('b','')]),/budget/i);
});
test('cancellation while awaiting Blob and final assembly rejects instead of returning ZIP',async()=>{
 let cancelled=false;const check=()=>{if(cancelled)throw Error('cancelled')};
 class Slow extends Blob{async arrayBuffer(){const b=await super.arrayBuffer();cancelled=true;return b;}}
 await A.rejects(make([entry('a',new Slow(['x']))],check),/cancelled/);
});
test('valid entries retain UTF-8 names, exact bytes, ZIP headers and independent CRC oracle',async()=>{
 const files=[entry('frames/0000.png',Uint8Array.from([0,255,128,1])),entry('public/assets/雪.png',new Blob(['123456789'])),entry('preset.json','{}')];
 const blob=await make(files),buf=Buffer.from(await blob.arrayBuffer()),end=buf.length-22;A.equal(buf.readUInt32LE(end),0x06054b50);A.equal(buf.readUInt16LE(end+10),files.length);const central=buf.readUInt32LE(end+16);A.equal(buf.readUInt32LE(end+12),end-central);
 let pos=central;for(let i=0;i<files.length;i++){A.equal(buf.readUInt32LE(pos),0x02014b50);const off=buf.readUInt32LE(pos+42),len=buf.readUInt16LE(pos+28),size=buf.readUInt32LE(pos+24);A.equal(buf.readUInt32LE(off),0x04034b50);A.equal(buf.readUInt16LE(off+6),0x800);A.equal(buf.readUInt16LE(off+26),len);A.equal(buf.subarray(pos+46,pos+46+len).toString('utf8'),files[i].name);A.equal(buf.subarray(off+30,off+30+len).toString('utf8'),files[i].name);
 const bytes=buf.subarray(off+30+len,off+30+len+size),expected=files[i].data instanceof Blob?Buffer.from(await files[i].data.arrayBuffer()):Buffer.from(files[i].data);A.deepEqual(bytes,expected);if(i===1)A.equal(buf.readUInt32LE(pos+16),0xcbf43926);A.equal(buf.readUInt32LE(off+14),buf.readUInt32LE(pos+16));pos+=46+len;}A.equal(pos,end);
});
