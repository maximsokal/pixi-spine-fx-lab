'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');
const root = path.resolve(__dirname, '..');
const pkg = require('../package.json');
const glob = 'assets/*/src';
const prefix = `depcruise "${glob}" scripts --config .dependency-cruiser.cjs`;

test('configuration: both architecture commands discover all current and future FX roots', () => {
  assert.equal(pkg.scripts['arch:deps'], prefix);
  assert.equal(pkg.scripts['arch:graph'], `${prefix} --output-type dot --output-to docs/architecture-dependency-graph.dot`);
  const expected = fs.readdirSync(path.join(root, 'assets'), { withFileTypes: true })
    .filter(d => d.isDirectory() && fs.existsSync(path.join(root, 'assets', d.name, 'src')))
    .map(d => `assets/${d.name}/src`).sort();
  assert.ok(expected.includes('assets/template/src'));
  assert.deepEqual(fs.globSync(glob, { cwd: root }).map(p => p.split(path.sep).join('/')).sort(), expected);
});

test('real analyzer: unreferenced new FX roots, graph output and forbidden edge', t => {
  const cli = path.join(root, 'node_modules/dependency-cruiser/bin/dependency-cruiser.mjs');
  assert.ok(fs.existsSync(cli), 'Install pinned dependencies with npm ci before running the real analyzer test');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pixi-deps-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  function write(file, content) {
    const target = path.join(dir, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  }
  write('package.json', '{"type":"commonjs"}');
  write('.dependency-cruiser.cjs', fs.readFileSync(path.join(root, '.dependency-cruiser.cjs')));
  write('assets/template/src/curve-core.js', 'module.exports = 1;\n');
  write('assets/future-fx/src/nested/standalone.js', 'module.exports = 2;\n');
  write('assets/template/vendor/ignored.js', 'module.exports = 3;\n');
  write('scripts/tool.cjs', 'module.exports = 4;\n');
  fs.mkdirSync(path.join(dir, 'docs'));
  const run = (...args) => spawnSync(process.execPath, [cli, glob, 'scripts', '--config', '.dependency-cruiser.cjs', ...args], { cwd: dir, encoding: 'utf8' });
  const first = run('--output-type', 'json');
  assert.equal(first.status, 0, first.stderr || first.stdout);
  const sources = JSON.parse(first.stdout).modules.map(m => m.source);
  assert.ok(sources.includes('assets/future-fx/src/nested/standalone.js'));
  assert.ok(sources.includes('assets/template/src/curve-core.js'));
  assert.ok(sources.includes('scripts/tool.cjs'));
  assert.ok(!sources.includes('assets/template/vendor/ignored.js'));
  const dot = run('--output-type', 'dot', '--output-to', 'docs/architecture-dependency-graph.dot');
  assert.equal(dot.status, 0, dot.stderr || dot.stdout);
  assert.ok(fs.readFileSync(path.join(dir, 'docs/architecture-dependency-graph.dot'), 'utf8').includes('standalone.js'));
  write('assets/template/src/curve-core.js', "module.exports = require('../../future-fx/src/nested/standalone.js');\n");
  const bad = run();
  assert.equal(bad.status, 1, bad.stderr || bad.stdout);
  assert.match(bad.stdout + bad.stderr, /shared-core-does-not-depend-on-effects/);
  const report = run('--output-type', 'json');
  assert.equal(report.status, 0, report.stderr || report.stdout);
  assert.ok(JSON.parse(report.stdout).summary.violations.some(v => v.rule.name === 'shared-core-does-not-depend-on-effects'));
});
