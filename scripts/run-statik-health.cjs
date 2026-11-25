#!/usr/bin/env node
'use strict';
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const WIND = 'assets/wind-gust/src/wind-core.js';
const CURVE = 'assets/template/src/curve-core.js';
const count = n => Number.isSafeInteger(n) && n >= 0;

// Compare the actual repository path, not an arbitrary matching suffix.
function samePath(actual, expected) {
  if (typeof actual !== 'string') return false;
  const normalize = value => {
    let p = value.replace(/\\/g, '/');
    if (process.platform === 'win32') {
      p = p.replace(/^\/\/\?\/UNC\//i, '//').replace(/^\/\/\?\//, '');
      return path.resolve(p).toLowerCase();
    }
    return path.resolve(p);
  };
  return normalize(actual) === normalize(expected);
}

function runHealth(command = process.env.STATIK_BIN || 'statik', prefix = []) {
  function report(label, message, code) {
    console.error(`Statik health: ${label} — ${message}`);
    return code;
  }
  function run(args, json = true) {
    const r = spawnSync(command, [...prefix, ...args], {
      encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, timeout: 120000,
    });
    if (r.stderr) process.stderr.write(r.stderr);
    if (r.error) {
      const unavailable = r.error.code === 'ENOENT';
      throw Object.assign(new Error(`${args[0]}: ${r.error.message}`), { unavailable });
    }
    if (r.status !== 0) {
      if (r.stdout) process.stdout.write(r.stdout);
      throw Error(`${args[0]} exited ${r.status ?? r.signal ?? 'without status'}`);
    }
    if (!json) {
      if (r.stdout) process.stdout.write(r.stdout);
      return;
    }
    try { return JSON.parse(r.stdout); }
    catch { throw Error(`${args[0]} returned invalid JSON`); }
  }
  try {
    const indexed = run(['index', '.', '--exclude', 'assets/template/vendor/**', '--format', 'json']);
    if (!count(indexed?.files_indexed)) throw Error('invalid index file count');
    if (!indexed.files_indexed) return report('DEGRADED', 'empty index; lint not run', 2);
    const dead = run(['dead-code', '--scope', 'files', '--no-index', '--format', 'json']);
    const s = dead?.summary;
    if (!s || !count(s.total_files) || !count(s.dead_files) || !count(s.entry_points) ||
        s.entry_points > s.total_files || s.dead_files > s.total_files - s.entry_points ||
        !Array.isArray(dead.dead_files) || dead.dead_files.length !== s.dead_files) {
      throw Error('invalid dead-code summary counts');
    }
    // Unfiltered graph and index must describe the same set size; stale or missing rows invalidate coverage.
    if (s.total_files !== indexed.files_indexed) {
      return report('DEGRADED', `index files=${indexed.files_indexed}, graph files=${s.total_files}; lint not run`, 2);
    }
    if (!s.total_files || !s.entry_points) {
      return report('DEGRADED', `files=${s.total_files}, entry_points=${s.entry_points}; lint not run`, 2);
    }
    // Pinned direct_deps deduplicates file IDs; both summary counts describe this returned direct list.
    const deps = run(['deps', WIND, '--direction', 'out', '--no-index', '--format', 'json']);
    if (!samePath(deps?.target_path, WIND) || !Array.isArray(deps.imports) ||
        !deps.imports.every(d => d && typeof d.path === 'string' && count(d.depth) && d.depth > 0) ||
        !count(deps.summary?.direct_imports) ||
        !count(deps.summary?.transitive_imports) ||
        deps.summary.transitive_imports !== deps.imports.length ||
        deps.summary.direct_imports !== deps.imports.length ||
        new Set(deps.imports.map(d => d.file_id)).size !== deps.imports.length ||
        !deps.imports.every(d => count(d.file_id) && d.path.trim())) {
      throw Error('invalid dependency response for Wind Gust canary');
    }
    if (!deps.summary.direct_imports || !deps.imports.some(d => d.depth === 1 && samePath(d.path, CURVE))) {
      return report('DEGRADED', 'known Wind Gust -> curve-core direct edge missing; lint not run', 2);
    }
    run(['lint', '--no-index'], false);
    return report('PASS', 'limited index/root/direct-edge canary and lint; not proof of full graph coverage', 0);
  } catch (error) {
    return report(error.unavailable ? 'UNVERIFIED' : 'ERROR', error.message, error.unavailable ? 2 : 1);
  }
}

if (require.main === module) process.exitCode = runHealth();
module.exports = { runHealth };
