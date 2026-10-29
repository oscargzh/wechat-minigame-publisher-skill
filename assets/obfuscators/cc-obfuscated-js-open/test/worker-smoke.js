'use strict';

const Assert = require('assert');
const ChildProcess = require('child_process');
const Fs = require('fs');
const Os = require('os');
const Path = require('path');
const Vm = require('vm');

const root = Path.resolve(__dirname, '..');
const sandbox = Fs.mkdtempSync(Path.join(Os.tmpdir(), 'cc-obfuscator-worker-'));
const target = Path.join(sandbox, 'worker-logic.js');
const source = 'function multiply(a,b){return a*b;} globalThis.workerAnswer=multiply(6,7);\n';
Fs.writeFileSync(target, source, 'utf8');

const child = ChildProcess.fork(Path.join(root, 'lib', 'worker.js'), [], {
  cwd: root,
  silent: true
});

let summary = null;
let failure = null;
const stderr = [];

child.stderr.on('data', function (data) { stderr.push(String(data)); });
child.on('message', function (message) {
  if (message.type === 'done') summary = message.summary;
  if (message.type === 'failed') failure = message.message;
});
child.on('error', function (error) { failure = error.stack || error.message; });
child.on('exit', function (code) {
  try {
    Assert.ifError(failure ? new Error(failure) : null);
    Assert.strictEqual(code, 0, 'worker should exit successfully: ' + stderr.join(''));
    Assert.ok(summary, 'worker should return a summary');
    Assert.strictEqual(summary.processed, 1);
    Assert.strictEqual(summary.failed, 0);
    const output = Fs.readFileSync(target, 'utf8');
    Assert.notStrictEqual(output, source);
    const context = {};
    Vm.createContext(context);
    Vm.runInContext(output, context);
    Assert.strictEqual(context.workerAnswer, 42);
    console.log('Worker smoke test passed:', summary.processed + ' file in ' + summary.elapsedMs + 'ms');
  } finally {
    if (summary && summary.backupRoot) {
      const backupParent = Path.dirname(summary.backupRoot);
      Fs.rmSync(backupParent, { recursive: true, force: true });
    }
    Fs.rmSync(sandbox, { recursive: true, force: true });
  }
});

child.send({
  targetPath: target,
  configPath: Path.join(root, 'runtime_Ts', 'cc_obfuscated_js.json'),
  requestId: 'worker-smoke'
});
