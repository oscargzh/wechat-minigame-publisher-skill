'use strict';

const Assert = require('assert');
const Fs = require('fs');
const Os = require('os');
const Path = require('path');
const Vm = require('vm');

const sandbox = Fs.mkdtempSync(Path.join(Os.tmpdir(), 'cc-obfuscator-3x-hooks-'));
const target = Path.join(sandbox, 'web-mobile');
const scriptPath = Path.join(target, 'assets', 'main', 'index.js');
const source = 'globalThis.hookAnswer=(40+2);\n';
Fs.mkdirSync(Path.dirname(scriptPath), { recursive: true });
Fs.writeFileSync(scriptPath, source, 'utf8');

global.Editor = { Project: { path: sandbox } };
const hooks = require('../hooks');

Assert.strictEqual(hooks._test.resolveBuildOutput({}, { dest: target }), target);

hooks.onBeforeCompressSettings({ platform: 'web-mobile' }, { dest: target }).then(function () {
  Assert.strictEqual(Fs.readFileSync(scriptPath, 'utf8'), source, 'non-selected hook should not change output');
  return hooks.onAfterBuild({ platform: 'web-mobile' }, { dest: target });
}).then(function (result) {
  Assert.strictEqual(result, true);
  const output = Fs.readFileSync(scriptPath, 'utf8');
  Assert.notStrictEqual(output, source);
  const context = {};
  Vm.createContext(context);
  Vm.runInContext(output, context);
  Assert.strictEqual(context.hookAnswer, 42);
  console.log('Builder hook smoke test passed');
}).catch(function (error) {
  console.error(error.stack || error.message);
  process.exitCode = 1;
}).finally(function () {
  delete global.Editor;
  Fs.rmSync(sandbox, { recursive: true, force: true });
});
