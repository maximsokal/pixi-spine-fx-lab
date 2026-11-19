#!/usr/bin/env node
// FX-PNG-PMA-01: independent PNG byte oracle and real-browser WebGL/WebGPU bake.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const { pathToFileURL } = require('node:url');
function arg(name, fallback) { const i = process.argv.indexOf('--' + name); return i < 0 ? fallback : process.argv[i + 1]; }
const html = arg('html'), output = path.resolve(arg('output', 'fx-pma-qa')), requested = arg('backend', 'webgl');
if (require.main === module && !process.argv.includes('--unit') && (!html || !['webgl', 'webgpu'].includes(requested))) {
  console.error('Usage: node test_png_pma.cjs --html FILE --backend webgl|webgpu --output DIR [--unit]');
  process.exit(2);
}
function entries(bytes) {
  const result = new Map(); let offset = 0;
  while (offset + 30 < bytes.length && bytes.readUInt32LE(offset) === 0x04034b50) {
    const flags = bytes.readUInt16LE(offset + 6), method = bytes.readUInt16LE(offset + 8);
    assert.equal(flags & 8, 0); assert.equal(method, 0);
    const size = bytes.readUInt32LE(offset + 18), nlen = bytes.readUInt16LE(offset + 26), xlen = bytes.readUInt16LE(offset + 28);
    const name = bytes.subarray(offset + 30, offset + 30 + nlen).toString();
    const start = offset + 30 + nlen + xlen;
    result.set(name, bytes.subarray(start, start + size)); offset = start + size;
  }
  return result;
}
function decodeRgba(bytes) {
  assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', 'PNG signature');
  let offset = 8, width, height, depth, type, interlace;
  const idat = [];
  while (offset < bytes.length) {
    const length = bytes.readUInt32BE(offset), tag = bytes.toString('ascii', offset + 4, offset + 8);
    const data = bytes.subarray(offset + 8, offset + 8 + length);
    if (tag === 'IHDR') { width = data.readUInt32BE(0); height = data.readUInt32BE(4); depth = data[8]; type = data[9]; interlace = data[12]; }
    if (tag === 'IDAT') idat.push(data);
    offset += 12 + length;
    if (tag === 'IEND') break;
  }
  assert.equal(depth, 8, '8-bit PNG'); assert.equal(type, 6, 'RGBA PNG'); assert.equal(interlace, 0, 'non-interlaced PNG');
  const scan = zlib.inflateSync(Buffer.concat(idat)), stride = width * 4, pixels = Buffer.alloc(stride * height);
  let pos = 0;
  for (let y = 0; y < height; y++) {
    const filter = scan[pos++];
    assert.ok(filter >= 0 && filter <= 4, 'PNG filter');
    for (let x = 0; x < stride; x++) {
      const v = scan[pos++], dst = y * stride + x;
      const a = x >= 4 ? pixels[dst - 4] : 0, b = y ? pixels[dst - stride] : 0;
      const c = (y && x >= 4) ? pixels[dst - stride - 4] : 0;
      let pred = 0;
      if (filter === 1) pred = a;
      if (filter === 2) pred = b;
      if (filter === 3) pred = Math.floor((a + b) / 2);
      if (filter === 4) {
        const q = a + b - c, da = Math.abs(q - a), db = Math.abs(q - b), dc = Math.abs(q - c);
        pred = da <= db && da <= dc ? a : db <= dc ? b : c;
      }
      pixels[dst] = (v + pred) & 255;
    }
  }
  return { width, height, rgba(x, y) { return [...pixels.subarray((y * width + x) * 4, (y * width + x) * 4 + 4)]; } };
}
function unit() {
  const source = fs.readFileSync(path.resolve(__dirname, '../assets/template/src/ui.html'), 'utf8');
  const start = source.indexOf('function unpremultiplyRgba8InPlace(pixels) {');
  assert.ok(start !== -1, 'PMA helper must be present in the source template');
  const end = source.indexOf('\n}', start);
  assert.ok(end !== -1, 'PMA helper source end');
  const unpremultiply = new Function(source.slice(start, end + 2) + '\nreturn unpremultiplyRgba8InPlace;')();
  const fixtures = [[64,32,0,64], [0,0,0,0], [255,255,255,255], [1,0,0,1], [2,1,0,2], [50,100,127,127], [128,64,0,128], [254,127,0,254], [255,255,255,1], [255,255,255,0]];
  const pixels = Uint8ClampedArray.from(fixtures.flat()), before = Uint8ClampedArray.from(pixels);
  unpremultiply(pixels);
  for (let i = 0; i < fixtures.length; i++) {
    const alpha = before[i * 4 + 3]; assert.equal(pixels[i * 4 + 3], alpha, 'alpha unchanged');
    for (let ch = 0; ch < 3; ch++) {
      const input = before[i * 4 + ch], expected = alpha ? Math.min(255, Math.round(input * 255 / alpha)) : 0;
      assert.equal(pixels[i * 4 + ch], expected, 'byte conversion');
    }
  }
  assert.deepEqual([...pixels.subarray(0, 4)], [255,128,0,64]);
  console.log('PASS PMA-01/02/03 unit (10 fixtures, edge alpha)');
}
async function browser() {
  let chromium;
  try { ({ chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')); }
  catch { throw new Error('Playwright not found: set PLAYWRIGHT_MODULE'); }
  fs.mkdirSync(output, {recursive:true});
  const b = await chromium.launch({headless:true, ...(process.env.BROWSER_EXECUTABLE ? {executablePath:process.env.BROWSER_EXECUTABLE} : {}),
    args:['--no-sandbox',...(process.env.FX_SOFTWARE_GPU === '1' ? ['--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--enable-unsafe-webgpu','--use-vulkan=swiftshader','--enable-features=Vulkan'] : [])]});
  const page = await b.newPage({viewport:{width:1200,height:900},acceptDownloads:true,offline:true});
  const errors = []; let network = 0;
  page.on('pageerror', e => errors.push(e.message));
  page.on('request', e => {if (/^https?:/.test(e.url())) network++;});
  try {
    const url = pathToFileURL(path.resolve(html)); url.searchParams.set('renderer', requested);
    await page.goto(url.href);
    await page.waitForFunction(() => document.querySelector('#viewport canvas') && document.getElementById('loading').style.display === 'none' && !document.getElementById('assetName').textContent.includes('Loading'), null, {timeout:60000});
    if (process.argv.includes('--webgl1')) {
      assert.equal(requested, 'webgl', 'WebGL1 requires a WebGL bake');
      // The actual editor chooses WebGL1 for its low quality profile.
      await page.evaluate(async () => { cfg.quality = 'low'; await switchRenderer(); });
      await page.waitForFunction(() => document.querySelector('#viewport canvas') && document.getElementById('loading').style.display === 'none');
    }
    const info = await page.evaluate(() => {
      const version = typeof app === 'undefined' ? 'NO APP' :
        app.renderer.gl ? (app.renderer.gl instanceof WebGL2RenderingContext ? 'webgl2' : 'webgl1') : 'webgpu';
      return {requested: new URLSearchParams(location.search).get('renderer'), runtime:version, selected:typeof backend === 'undefined'?'UNKNOWN':backend};
    });
    console.log('BACKEND', JSON.stringify(info));
    assert.equal(info.selected, requested, 'backend fallback is NOT PASS');
    if (requested === 'webgl') assert.equal(info.runtime, process.argv.includes('--webgl1') ? 'webgl1' : 'webgl2', 'prove the actual WebGL version');
    if (requested === 'webgpu') assert.equal(info.runtime, 'webgpu');
    await page.locator('#animPlay').uncheck();
    for (const [name, value] of [['bakeWidth','320'],['bakeHeight','256'],['bakeFrames','1']]) {
      await page.locator('#'+name).fill(value); await page.locator('#'+name).dispatchEvent('change');
    }
    // This is the real bakeSequence() and its actual renderer; replace only
    // the render-target *contents* for deterministic exact-color testing.
    await page.evaluate(() => {
      const original = app.renderer.render.bind(app.renderer);
      const graphic = new PIXI.Graphics().rect(0,0,320,256).fill({color:0xff8000, alpha:64/255});
      window.__pmaRaw = null;
      app.renderer.render = function(options) {
        if (options && options.target) {
          const result = original({...options, container:graphic});
          if (app.renderer.gl) {
            const {pixels,width,height} = app.renderer.extract.pixels(options.target);
            const off = (16*width + 16)*4;
            window.__pmaRaw = {rgba:[...pixels.subarray(off,off+4)], width, height};
          }
          return result;
        }
        return original(options);
      };
    });
    const promise = page.waitForEvent('download',{timeout:120000});
    await page.locator('#bakeStart').click();
    const dl = await promise, file = path.join(output,requested+'-fixture.zip');
    await dl.saveAs(file);
    await page.waitForFunction(() => !document.getElementById('bakeStart').disabled);
    const archive = entries(fs.readFileSync(file));
    const png = decodeRgba(archive.get('frames/frame_00000.png'));
    assert.equal(png.width,320); assert.equal(png.height,256);
    const rgba = png.rgba(16,16);
    const raw = await page.evaluate(() => window.__pmaRaw);
    console.log('PIXELS',JSON.stringify({backend:info.runtime,raw,encodedPng:rgba,expected:[255,128,0,64]}));
    if (requested === 'webgl') {
      assert.ok(raw && raw.rgba.every((v,i) => Math.abs(v-[64,32,0,64][i])<=2), 'WebGL source must really contain PMA bytes');
    }
    for (let c=0;c<4;c++) assert.ok(Math.abs(rgba[c]-[255,128,0,64][c])<=2,
      'PMA-04/05/06/07: encoded PNG pixel channel '+c+' expected '+[255,128,0,64][c]+' actual '+rgba[c]);
    assert.equal(network,0); assert.deepEqual(errors,[]);
    console.log('PASS PMA controlled fixture '+info.runtime);
  } finally { await b.close(); }
}
module.exports = { entries, decodeRgba };
if (require.main === module) {
  (async () => { if (process.argv.includes('--unit')) unit(); else await browser(); })().catch(e => {console.error(e);process.exitCode=1;});
}
