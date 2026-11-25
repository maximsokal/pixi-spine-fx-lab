'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { mkdtempSync, writeFileSync, rmSync } = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// Synthetic process responses based on pinned Statik's Rust JSON structs.
// These tests verify our gate, not real Statik coverage.
const gate = path.join(__dirname, 'run-statik-health.cjs');
const { runHealth } = require('./run-statik-health.cjs');
const fixtureSource = `
const [command, ...args] = process.argv.slice(2);
const mode = process.env.FIXTURE_MODE;
const assert = require('node:assert/strict');
const emit = data => console.log(JSON.stringify(data));
if (mode === 'crash' && command === 'index') { console.error('fixture crash'); process.exit(7); }
if (command === 'index') {
  assert.deepEqual(args, ['.', '--exclude', 'assets/template/vendor/**', '--format', 'json']);
  emit({ files_indexed: mode === 'empty' ? 0 : mode === 'index-larger' ? 230 : mode === 'index-smaller' ? 228 : 229, symbols_extracted: 11836, references_found: 33334, duration_ms: 2 });
} else if (command === 'dead-code') {
  assert.deepEqual(args, ['--scope', 'files', '--no-index', '--format', 'json']);
  if (mode === 'malformed') { console.log('not json'); process.exit(0); }
  emit({ dead_files: mode === 'roots' ? Array.from({length:229},(_,i)=>({file_id:i+1,path:'file'+i+'.js'})) : mode === 'dead-list-mismatch' ? [{file_id:1,path:'orphan.js'}] : [], dead_exports: [], confidence: 'Certain', limitations: [], summary: { total_files: 229, dead_files: mode === 'roots' ? 229 : 0, total_exports: 0, dead_exports: 0, entry_points: mode === 'roots' ? 0 : (mode === 'bad-count' ? '229' : 229), files_with_unresolvable_imports: 0, unresolved_ratio: 0 } });
} else if (command === 'deps') {
  assert.deepEqual(args, ['assets/wind-gust/src/wind-core.js', '--direction', 'out', '--no-index', '--format', 'json']);
  const imports = mode === 'missing-edge' ? [] : [{file_id: 2, path: mode === 'wrong-root' ? '/unrelated/assets/template/src/curve-core.js' : 'assets/template/src/curve-core.js', depth: mode === 'indirect' ? 2 : 1, imported_names: ['*']}];
  if (mode === 'duplicate-edge') imports.push({...imports[0]});
  emit({ target_file: 1, target_path: 'assets/wind-gust/src/wind-core.js', imports, imported_by: [], confidence: 'Certain', summary: { direct_imports: mode === 'edge-count-mismatch' ? 99 : imports.length, transitive_imports: mode === 'transitive-count-mismatch' ? 99 : imports.length, direct_importers: 0, transitive_importers: 0 } });
} else if (command === 'lint') {
  assert.deepEqual(args, ['--no-index']);
  console.log('fixture lint ran');
  if (mode === 'lint-failure') process.exit(4);
} else { throw Error('unexpected command ' + command); }
`;
function run(mode) {
  const cwd = mkdtempSync(path.join(os.tmpdir(), 'statik-health-'));
  try {
    const fixture = path.join(cwd, 'fixture.cjs');
    writeFileSync(fixture, fixtureSource);
    const args = mode === 'absent' ? [gate] : [__filename, '--fixture', fixture];
    return spawnSync(process.execPath, args, { cwd, encoding: 'utf8', timeout: 10000, env: { ...process.env, STATIK_BIN: path.join(cwd, 'missing-binary'), FIXTURE_MODE: mode } });
  } finally { rmSync(cwd, { recursive: true, force: true }); }
}
if (process.argv[2] === '--fixture') {
  process.exitCode = runHealth(process.execPath, [process.argv[3]]);
} else {
  for (const [mode, code, label] of [
    ['healthy', 0, 'PASS'], ['empty', 2, 'DEGRADED'], ['roots', 2, 'DEGRADED'],
    ['missing-edge', 2, 'DEGRADED'], ['wrong-root', 2, 'DEGRADED'], ['indirect', 2, 'DEGRADED'],
    ['index-larger', 2, 'DEGRADED'], ['index-smaller', 2, 'DEGRADED'],
    ['dead-list-mismatch', 1, 'ERROR'], ['edge-count-mismatch', 1, 'ERROR'], ['transitive-count-mismatch', 1, 'ERROR'], ['duplicate-edge', 1, 'ERROR'],
    ['malformed', 1, 'ERROR'], ['bad-count', 1, 'ERROR'], ['absent', 2, 'UNVERIFIED'],
    ['crash', 1, 'ERROR'], ['lint-failure', 1, 'ERROR'],
  ]) {
    test(`health gate: ${mode}`, () => {
      const r = run(mode);
      assert.ifError(r.error);
      const output = r.stdout + r.stderr;
      assert.equal(r.status, code, output);
      assert.match(output, new RegExp('Statik health: ' + label));
      if (label !== 'PASS') assert.doesNotMatch(output, /Statik health: PASS/);
      if (mode === 'healthy' || mode === 'lint-failure') assert.match(output, /fixture lint ran/);
      else assert.doesNotMatch(output, /fixture lint ran/);
      if (mode === 'crash') assert.match(output, /fixture crash/);
    });
  }
}
