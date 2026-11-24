#!/usr/bin/env node
const { spawnSync } = require('node:child_process');

const command = process.env.STATIK_BIN || 'statik';
const result = spawnSync(command, process.argv.slice(2), { stdio: 'inherit' });

if (result.error) {
  console.error(`Unable to run statik at "${command}": ${result.error.message}`);
  process.exitCode = 1;
} else if (result.status === null) {
  console.error(`statik exited without a status (signal: ${result.signal || 'unknown'}).`);
  process.exitCode = 1;
} else {
  process.exitCode = result.status;
}
