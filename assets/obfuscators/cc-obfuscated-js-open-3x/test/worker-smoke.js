'use strict';

const Assert = require('assert');
const Fs = require('fs');
const Os = require('os');
const Path = require('path');
const Vm = require('vm');
const Runner = require('../lib/runner');

const root = Path.resolve(__dirname, '..');
const sandbox = Fs.mkdtempSync(Path.join(Os.tmpdir(), 'cc-obfuscator-3x-worker-'));
const target = Path.join(sandbox, 'worker-logic.js');
const source = 'function multiply(a,b){return a*b;} globalThis.workerAnswer=multiply(6,7);\n';
Fs.writeFileSync(target, source, 'utf8');

Runner.runWorker({
  targetPath: target,
  configPath: Path.join(root, 'runtime_Ts', 'cc_obfuscated_js.json'),
  requestId: 'worker-smoke'
}, function () {}).then(function (summary) {
  Assert.ok(summary);
  Assert.strictEqual(summary.processed, 1);
  Assert.strictEqual(summary.failed, 0);
  const output = Fs.readFileSync(target, 'utf8');
  Assert.notStrictEqual(output, source);
  const context = {};
  Vm.createContext(context);
  Vm.runInContext(output, context);
  Assert.strictEqual(context.workerAnswer, 42);
  console.log('Worker smoke test passed:', summary.processed + ' file in ' + summary.elapsedMs + 'ms');
}).catch(function (error) {
  console.error(error.stack || error.message);
  process.exitCode = 1;
}).finally(function () {
  Fs.rmSync(sandbox, { recursive: true, force: true });
});
