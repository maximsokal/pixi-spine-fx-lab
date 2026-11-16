#!/usr/bin/env node
// Portable infrastructure regression. Requires Playwright + Chromium, not a
// particular workspace path. Add appearance-specific tests for every new FX.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
function option(name, fallback) { const i = process.argv.indexOf('--' + name); return i < 0 ? fallback : process.argv[i + 1]; }
const html = option('html'), backend = option('backend', 'both'), output = path.resolve(option('output', 'fx-qa-results'));
if (!html || !['webgl', 'webgpu', 'both'].includes(backend)) {
  console.error('Usage: node smoke_editor.cjs --html FILE --backend webgl|webgpu|both --output DIR'); process.exit(2);
}
let chromium;
try { ({ chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')); }
catch { console.error('Install Playwright in the developer environment, or set PLAYWRIGHT_MODULE to its existing module path.'); process.exit(2); }
// The reference exporter uses uncompressed ZIP entries. Deliberately reject
// unknown compression instead of returning incorrect preset/PNG bytes.
function entries(file) {
  const bytes = fs.readFileSync(file), found = new Map(); let offset = 0;
  while (bytes.readUInt32LE(offset) === 0x04034b50) {
    const flags = bytes.readUInt16LE(offset + 6), method = bytes.readUInt16LE(offset + 8);
    if (method !== 0 || flags & 8) throw new Error('Smoke reader expects stored ZIP entries without data descriptors. Extend the test if the encoder changes.');
    const size = bytes.readUInt32LE(offset + 18), length = bytes.readUInt16LE(offset + 26), extra = bytes.readUInt16LE(offset + 28);
    const name = bytes.subarray(offset + 30, offset + 30 + length).toString();
    const start = offset + 30 + length + extra;
    found.set(name, bytes.subarray(start, start + size)); offset = start + size;
  }
  return found;
}
async function main() {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ headless: true,
    ...(process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE } : {}),
    args: ['--no-sandbox', ...(process.env.FX_SOFTWARE_GPU === '1' ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--enable-unsafe-webgpu', '--use-vulkan=swiftshader', '--enable-features=Vulkan'] : [])] });
  const results = [];
  try {
    for (const requested of backend === 'both' ? ['webgl', 'webgpu'] : [backend]) {
      const page = await browser.newPage({ viewport: { width: 1200, height: 900 }, offline: true });
      const errors = []; let network = 0;
      page.on('pageerror', e => errors.push(e.message));
      page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
      page.on('request', r => { if (/^https?:/.test(r.url())) network++; });
      const url = pathToFileURL(path.resolve(html)); url.searchParams.set('renderer', requested);
      await page.goto(url.href);
      await page.waitForFunction(() => document.querySelector('#viewport canvas') && document.getElementById('loading').style.display === 'none' && !document.getElementById('assetName').textContent.includes('Loading'));
      await page.locator('#animPlay').uncheck();
      // The built-in sample must load completely: every atlas page, every animation, no fallback to another asset.
      const sample = await page.evaluate(() => {
        const data = JSON.parse(document.getElementById('sampleData').textContent);
        return { label: data.label, skeletonName: data.skeletonName, atlasName: data.atlasName, images: Object.keys(data.images),
          pages: data.atlas.split(/\r?\n/).filter(l => /^\S.*\.(png|jpe?g|webp)$/i.test(l)).length,
          animations: Object.keys(data.skeleton.animations || {}), skins: (data.skeleton.skins || []).map(x => x.name) };
      });
      assert.ok(sample.pages > 0 && sample.images.length >= sample.pages, 'Sample atlas pages need embedded images');
      assert.match(await page.locator('#assetName').innerText(), new RegExp(sample.label));
      assert.match(await page.locator('#status').textContent(), new RegExp(sample.pages + ' atlas pages? · ' + sample.animations.length + ' animations'));
      assert.deepEqual(await page.locator('#animation option').evaluateAll(o => o.map(x => x.value).filter(Boolean)), sample.animations);
      assert.deepEqual(await page.locator('#skin option').evaluateAll(o => o.map(x => x.value)), sample.skins);
      const viewport = await page.locator('#viewport').boundingBox();
      assert.ok(viewport.height > 700, 'Preview should use the available desktop height');
      for (const id of ['play', 'progress', 'duration', 'animation', 'skin', 'background', 'loadPreview'])
        assert.equal(await page.locator('#' + id).evaluate(el => !!el.closest('aside')), true, id + ' belongs in sidebar');
      await page.locator('#settings').evaluate(el => el.scrollTop = el.scrollHeight);
      assert.deepEqual(await page.locator('#viewport').boundingBox(), viewport);
      const fill = async (id, value) => { await page.locator('#' + id).fill(String(value)); await page.locator('#' + id).dispatchEvent('change'); };
      await fill('bakeWidth', 320); await fill('bakeHeight', 256); await fill('bakeFrames', 6); await fill('durationFrames', 12);
      await page.locator('#cameraActual').click();
      async function bake(name) {
        const pending = page.waitForEvent('download', { timeout: 120000 });
        await page.locator('#bakeStart').click();
        const download = await pending, file = path.join(output, requested + '-' + name + '.zip');
        await download.saveAs(file); await page.locator('#bakeStart').waitFor({ state: 'visible' });
        await page.waitForFunction(() => !document.getElementById('bakeStart').disabled);
        assert.match(await page.locator('#bakeMessage').innerText(), /Exported/);
        return entries(file);
      }
      const initialBox = await page.locator('#bakeOverlay').boundingBox();
      const first = await bake('100');
      await page.locator('#cameraZoomIn').click();
      const zoomedBox = await page.locator('#bakeOverlay').boundingBox();
      assert.ok(Math.abs(zoomedBox.width / initialBox.width - 1.25) < .001);
      const second = await bake('125');
      const pngs = [...first.keys()].filter(name => name.endsWith('.png'));
      assert.equal(pngs.length, 6);
      for (const name of pngs) {
        assert.deepEqual(second.get(name), first.get(name), 'Camera changed PNG: ' + name);
        const png = first.get(name);
        assert.equal(png.readUInt32BE(16), 320); assert.equal(png.readUInt32BE(20), 256);
        assert.equal(png[25], 6, 'Expected RGBA PNG');
      }
      assert.deepEqual(second.get('sequence.json'), first.get('sequence.json'));
      const meta = JSON.parse(first.get('sequence.json'));
      assert.equal(meta.renderer, requested, 'A fallback is not evidence that actual WebGPU passed');
      assert.equal(meta.fps, 60); assert.equal(meta.frameCount, 6);
      const alpha = await page.evaluate(async frames => {
        let maximum = 0, minimum = 255;
        for (const encoded of frames) {
          const bytes = Uint8Array.from(atob(encoded), c => c.charCodeAt(0));
          const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
          const canvas = document.createElement('canvas'); canvas.width = bitmap.width; canvas.height = bitmap.height;
          const context = canvas.getContext('2d'); context.drawImage(bitmap, 0, 0); bitmap.close();
          const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
          for (let i = 3; i < pixels.length; i += 4) { maximum = Math.max(maximum, pixels[i]); minimum = Math.min(minimum, pixels[i]); }
          canvas.width = canvas.height = 1;
        }
        return { maximum, minimum };
      }, pngs.map(name => first.get(name).toString('base64')));
      assert.ok(alpha.maximum > 0, 'All baked frames are empty; inspect GPU readback and effect endpoints');
      await page.locator('#cameraFit').click();
      for (const target of ['WebGL', 'WebGPU']) {
        const pending = page.waitForEvent('download', { timeout: 60000 });
        await page.locator('#export' + target).click();
        const file = path.join(output, requested + '-developer-' + target + '.zip');
        await (await pending).saveAs(file);
        const archive = entries(file);
        for (const name of ['preset.json', 'README.md', 'example.js', 'package.json']) assert.ok(archive.has(name), name);
        for (const file of [sample.skeletonName, sample.atlasName, ...sample.images])
          assert.ok([...archive.keys()].some(name => name.endsWith('/' + file) || name === file), target + ' ZIP lacks sample file ' + file);
        const preset = JSON.parse(archive.get('preset.json')); assert.equal(preset.timing.durationFrames, 12);
      }
      assert.equal(network, 0); assert.deepEqual(errors, []);
      results.push({ backend: requested, offline: true, frames: pngs.length, alpha, cameraInvariant: true, exports: 2 });
      console.log('PASS', JSON.stringify(results.at(-1))); await page.close();
    }
  } finally { await browser.close(); }
  fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify(results, null, 2));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
