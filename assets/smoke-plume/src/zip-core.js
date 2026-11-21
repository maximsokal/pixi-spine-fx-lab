// Local no-dependency ZIP store writer for FIRE-05 PNG frames and developer handoff.
(function(root){
 'use strict';
 const enc=new TextEncoder();
 const crcTable=Array.from({length:256},(_,n)=>{for(let k=0;k<8;k++)n=(n&1)?0xedb88320^(n>>>1):n>>>1;return n>>>0});
 function crc(bytes){
  let s=0xffffffff;
  for(const b of bytes)s=crcTable[(s^b)&255]^(s>>>8);
  return (s^0xffffffff)>>>0;
 }
 async function makeZip(entries,checkCancel=()=>{}){
  if(!Array.isArray(entries)||entries.length<1||entries.length>3605)throw Error('Invalid ZIP entry count');
  const names=new Set(),local=[],central=[];
  let offset=0;
  const rec=n=>{const b=new Uint8Array(n);return [b,new DataView(b.buffer)]};
  for(const entry of entries){
   checkCancel();
   if(typeof entry.name!=='string'||entry.name.startsWith('/')||/^[a-z]:/i.test(entry.name)||
    entry.name.split('/').some(x=>x===''||x==='.'||x==='..')||names.has(entry.name))
    throw Error('Unsafe/duplicate ZIP entry '+entry.name);
   names.add(entry.name);
   const name=enc.encode(entry.name);
   const data=entry.data instanceof Blob?new Uint8Array(await entry.data.arrayBuffer()):
    typeof entry.data==='string'?enc.encode(entry.data):entry.data;
   if(!(data instanceof Uint8Array)||data.length>128*1024*1024||
    offset+data.length>256*1024*1024)throw Error('ZIP entry or package exceeds budget');
   const [lh,lv]=rec(30);lv.setUint32(0,0x04034b50,true);lv.setUint16(4,20,true);
   lv.setUint16(6,0x800,true);lv.setUint32(14,crc(data),true);
   lv.setUint32(18,data.length,true);lv.setUint32(22,data.length,true);
   lv.setUint16(26,name.length,true);local.push(lh,name,data);
   const [ch,cv]=rec(46);cv.setUint32(0,0x02014b50,true);
   cv.setUint16(4,20,true);cv.setUint16(6,20,true);cv.setUint16(8,0x800,true);
   cv.setUint32(16,crc(data),true);cv.setUint32(20,data.length,true);
   cv.setUint32(24,data.length,true);cv.setUint16(28,name.length,true);
   cv.setUint32(42,offset,true);central.push(ch,name);
   offset+=30+name.length+data.length;
  }
  const size=central.reduce((v,b)=>v+b.length,0);
  const [end,ed]=rec(22);ed.setUint32(0,0x06054b50,true);
  ed.setUint16(8,entries.length,true);ed.setUint16(10,entries.length,true);
  ed.setUint32(12,size,true);ed.setUint32(16,offset,true);
  return new Blob([...local,...central,end],{type:'application/zip'});
 }
 function download(blob,name){
  const url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
 }
 root.FxSmokeZip=Object.freeze({makeZip,download});
})(globalThis);
