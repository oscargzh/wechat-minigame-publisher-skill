'use strict';

const Assert = require('assert');
const Fs = require('fs');
const Module = require('module');
const Os = require('os');
const Path = require('path');
const Vm = require('vm');

const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === 'electron') return { shell: { showItemInFolder: function () {} } };
  return originalLoad.call(this, request, parent, isMain);
};

const logs = [];
global.Editor = {
  Panel: { open: function () {} },
  Message: {
    broadcast: function (channel, payload) { logs.push({ channel: channel, payload: payload }); }
  }
};

const main = require('../main');
const sandbox = Fs.mkdtempSync(Path.join(Os.tmpdir(), 'cc-obfuscator-3x-main-'));
const target = Path.join(sandbox, 'manual.js');
const source = 'globalThis.mainAnswer=(20+22);\n';
Fs.writeFileSync(target, source, 'utf8');

main.load();
Assert.strictEqual(typeof main.methods.openPanel, 'function');
Assert.strictEqual(main.methods.getStatus().auto, true);

main.methods.runManual({ path: target, requestId: 'main-smoke' }).then(function (summary) {
  Assert.strictEqual(summary.processed, 1);
  const output = Fs.readFileSync(target, 'utf8');
  const context = {};
  Vm.createContext(context);
  Vm.runInContext(output, context);
  Assert.strictEqual(context.mainAnswer, 42);
  Assert.ok(logs.some(function (item) { return item.channel === 'cc-obfuscated-js-open-3x:log'; }));
  console.log('Main-process smoke test passed:', logs.length + ' broadcasts');
}).catch(function (error) {
  console.error(error.stack || error.message);
  process.exitCode = 1;
}).finally(function () {
  Module._load = originalLoad;
  delete global.Editor;
  Fs.rmSync(sandbox, { recursive: true, force: true });
});
