const {test}=require('node:test');
const assert=require('node:assert/strict');
require('../assets/fireball-projectile/src/zip-core.js');
const {makeZip}=globalThis.FxProjectileZip;
test('ordinary UTF-8 name and data produce correct ZIP local header',async()=>{
 const name='assets/тест.png';
 const b=new Uint8Array(await (await makeZip([{name,data:'abc'}])).arrayBuffer());
 const view=new DataView(b.buffer);
 assert.equal(view.getUint32(0,true),0x04034b50);
 assert.equal(view.getUint16(26,true),Buffer.byteLength(name));
 assert.equal(view.getUint32(14,true),0x352441c2);
});
test('reject duplicate name',async()=>{
 await assert.rejects(makeZip([{name:'a',data:'1'},{name:'a',data:'2'}]),/duplicate/);
});
test('reject forward-slash traversal',async()=>{
 await assert.rejects(makeZip([{name:'../outside',data:'x'}]),/Unsafe/);
});
test('reject backslash traversal at writer boundary',async()=>{
 await assert.rejects(makeZip([{name:'..\\outside',data:'x'}]),/Unsafe/);
});
test('reject embedded NUL in archive path',async()=>{
 await assert.rejects(makeZip([{name:'a\0b',data:'x'}]),/Unsafe/);
});
test('reject names exceeding ZIP 16-bit byte count',async()=>{
 await assert.rejects(makeZip([{name:'é'.repeat(32768),data:'x'}]),/name|Unsafe|length/i);
});
test('cancel during asynchronous final Blob read',async()=>{
 let cancelled=false;
 const blob=new Blob(['x']);
 const read=blob.arrayBuffer.bind(blob);
 blob.arrayBuffer=async()=>{const b=await read();cancelled=true;return b;};
 await assert.rejects(makeZip([{name:'last',data:blob}],()=>{if(cancelled)throw Error('cancelled');}),/cancelled/);
});
test('accept exact 65535-byte UTF-8 filename in both headers',async()=>{
 const name='é'.repeat(32767)+'a';
 const bytes=new Uint8Array(await (await makeZip([{name,data:'x'}])).arrayBuffer());
 const view=new DataView(bytes.buffer);
 assert.equal(view.getUint16(26,true),65535);
 const central=30+65535+1;
 assert.equal(view.getUint32(central,true),0x02014b50);
 assert.equal(view.getUint16(central+28,true),65535);
});
test('preserve nested paths and Blob data',async()=>{
 const entries=[{name:'assets/nested/тест.png',data:new Blob(['abc'])},{name:'preset.json',data:new Uint8Array([123,125])}];
 const bytes=new Uint8Array(await (await makeZip(entries)).arrayBuffer());
 const view=new DataView(bytes.buffer);
 assert.equal(view.getUint32(0,true),0x04034b50);
 assert.equal(view.getUint32(14,true),0x352441c2);
 const next=30+Buffer.byteLength(entries[0].name)+3;
 assert.equal(view.getUint32(next,true),0x04034b50);
 assert.equal(view.getUint32(next+18,true),2);
});
