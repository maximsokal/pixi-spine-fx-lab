#!/usr/bin/env node
'use strict';
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const path=require('node:path'),{pathToFileURL}=require('node:url');
const backend=process.argv[2]||'webgpu';
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE,
  args:['--no-sandbox',...(backend==='webgpu'?['--enable-unsafe-webgpu']:
    ['--use-gl=angle','--use-angle=swiftshader','--enable-webgl'])]});
 try{
  const page=await browser.newPage({offline:true});
  const base=path.resolve(__dirname,'..');
  await page.goto(pathToFileURL(path.join(base,'scripts/fixtures/splash-runtime.html')).href);
  await page.addScriptTag({path:path.join(base,'assets/template/vendor/pixi-8.22.0.min.js')});
  const q=await page.evaluate(async b=>{
   const app=new PIXI.Application();
   await app.init({width:180,height:120,resolution:1,backgroundAlpha:0,
    preference:b==='webgpu'?'webgpu':'webgl',preferWebGLVersion:2});
   const actual=app.renderer.gl?'webgl':'webgpu';
   const image=document.createElement('canvas');image.width=16;image.height=16;
   const c=image.getContext('2d');
   c.fillStyle='#ff0000';c.fillRect(0,0,16,16);
   const source=new PIXI.ImageSource({resource:image,alphaMode:'premultiply-alpha-on-upload'});
   const tex=new PIXI.Texture({source});
   const sprite=new PIXI.Sprite(tex);sprite.position.set(5,5);sprite.scale.set(4);app.stage.addChild(sprite);
   const mesh=new PIXI.MeshSimple({texture:tex,
    vertices:new Float32Array([90,5,155,5,90,69,155,69]),
    uvs:new Float32Array([.1,.1,.9,.1,.1,.9,.9,.9]),
    indices:new Uint32Array([0,1,2,1,3,2])});
   app.stage.addChild(mesh);
   const graphics=new PIXI.Graphics().rect(5,77,60,35).fill(0x3322ff);
   app.stage.addChild(graphics);
   app.render();
   const pixels=await app.renderer.extract.pixels({target:app.stage,
     frame:new PIXI.Rectangle(0,0,180,120)});
   const data=pixels.pixels;
   const p=(x,y)=>Array.from(data.slice((y*180+x)*4,(y*180+x)*4+4));
   return {actual,sprite:p(25,25),mesh:p(105,25),graphics:p(25,92),
    texWidth:tex.width,texHeight:tex.height,sourceType:tex.source.constructor.name};
  },backend);
  console.log(backend,JSON.stringify(q));
 }finally{await browser.close()}
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
