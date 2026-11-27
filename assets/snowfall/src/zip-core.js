// Local no-dependency ZIP store writer for AIR-02 PNG frames and developer handoff.
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
  const names=new Set(),directories=new Set(),local=[],central=[];
  const decoder=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true});
  let offset=0,total=22;
  const rec=n=>{const b=new Uint8Array(n);return [b,new DataView(b.buffer)]};
  for(const entry of entries){
   checkCancel();
   const raw=entry?.name;
   if(typeof raw!=='string'||!raw||/[\\\x00-\x1f\x7f:<>"|?*]/.test(raw)||
    raw.split('/').some(x=>!x||x==='.'||x==='..'||/[. ]$/.test(x)||/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(x)))
    throw Error('Unsafe ZIP entry name');
   const name=enc.encode(raw);
   if(name.length>65535||decoder.decode(name)!==raw)throw Error('Invalid ZIP entry name encoding/length');
   const key=raw.toLowerCase(),parts=key.split('/');
   if(names.has(key)||directories.has(key))throw Error('Duplicate/conflicting ZIP entry');
   let prefix='';
   for(const part of parts.slice(0,-1)){
    prefix=prefix?prefix+'/'+part:part;
    if(names.has(prefix))throw Error('Conflicting ZIP entry directory');
    directories.add(prefix);
   }
   names.add(key);
   // Local header + central-directory header + both encoded names + EOCD.
   const overhead=30+46+2*name.length;
   const rawData=entry.data;
   if(rawData instanceof Blob&&(rawData.size>128*1024*1024||total+overhead+rawData.size>256*1024*1024))throw Error('ZIP entry or package exceeds budget');
   const data=rawData instanceof Blob?new Uint8Array(await rawData.arrayBuffer()):
    typeof rawData==='string'?enc.encode(rawData):rawData;
   checkCancel();
   if(!(data instanceof Uint8Array)||data.length>128*1024*1024||
    total+overhead+data.length>256*1024*1024)throw Error('ZIP entry or package exceeds budget');
   total+=overhead+data.length;
   const checksum=crc(data);
   const [lh,lv]=rec(30);lv.setUint32(0,0x04034b50,true);lv.setUint16(4,20,true);
   lv.setUint16(6,0x800,true);lv.setUint32(14,checksum,true);
   lv.setUint32(18,data.length,true);lv.setUint32(22,data.length,true);
   lv.setUint16(26,name.length,true);local.push(lh,name,data);
   const [ch,cv]=rec(46);cv.setUint32(0,0x02014b50,true);
   cv.setUint16(4,20,true);cv.setUint16(6,20,true);cv.setUint16(8,0x800,true);
   cv.setUint32(16,checksum,true);cv.setUint32(20,data.length,true);
   cv.setUint32(24,data.length,true);cv.setUint16(28,name.length,true);
   cv.setUint32(42,offset,true);central.push(ch,name);
   offset+=30+name.length+data.length;
  }
  const size=central.reduce((v,b)=>v+b.length,0);
  const [end,ed]=rec(22);ed.setUint32(0,0x06054b50,true);
  ed.setUint16(8,entries.length,true);ed.setUint16(10,entries.length,true);
  ed.setUint32(12,size,true);ed.setUint32(16,offset,true);
  checkCancel();
  return new Blob([...local,...central,end],{type:'application/zip'});
 }
 function download(blob,name){
  const url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
 }
 root.FxSnowZip=Object.freeze({makeZip,download});
})(globalThis);
