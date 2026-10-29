'use strict';

const Assert = require('assert');
const Events = require('events');
const Fs = require('fs');
const Module = require('module');
const Os = require('os');
const Path = require('path');
const Vm = require('vm');

const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === 'electron') {
    return { shell: { showItemInFolder: function () {} } };
  }
  return originalLoad.call(this, request, parent, isMain);
};

const logs = [];
const builder = new Events.EventEmitter();
global.Editor = {
  log: function () { logs.push(Array.prototype.join.call(arguments, ' ')); },
  warn: function () { logs.push(Array.prototype.join.call(arguments, ' ')); },
  error: function () { logs.push(Array.prototype.join.call(arguments, ' ')); },
  Builder: builder,
  Ipc: {
    sendToPanel: function () {},
    sendToAll: function () {}
  },
  Panel: {
    open: function () {}
  }
};

const main = require('../main');
const sandbox = Fs.mkdtempSync(Path.join(Os.tmpdir(), 'cc-obfuscator-main-'));
const target = Path.join(sandbox, 'build-output');
const sourcePath = Path.join(target, 'logic.js');
Fs.mkdirSync(target, { recursive: true });
Fs.writeFileSync(sourcePath, 'globalThis.mainHookAnswer=(20+22);\n', 'utf8');

main.load();
Assert.strictEqual(builder.listenerCount('build-start'), 1, 'should register build-start');
Assert.strictEqual(builder.listenerCount('before-change-files'), 1, 'should register before-change-files');

let timeout;
const completion = new Promise(function (resolve, reject) {
  timeout = setTimeout(function () { reject(new Error('build callback timed out')); }, 15000);
  main.onBeforeChangeFiles({ platform: 'web-mobile', dest: target }, function () {
    clearTimeout(timeout);
    resolve();
  });
});

completion.then(function () {
  const output = Fs.readFileSync(sourcePath, 'utf8');
  const context = {};
  Vm.createContext(context);
  Vm.runInContext(output, context);
  Assert.strictEqual(context.mainHookAnswer, 42, 'build hook output should preserve behavior');
  Assert.ok(logs.some(function (line) { return line.indexOf('处理 1 个') !== -1; }), 'should report a build summary');
  main.unload();
  Assert.strictEqual(builder.listenerCount('build-start'), 0, 'should remove build-start');
  Assert.strictEqual(builder.listenerCount('before-change-files'), 0, 'should remove before-change-files');
  console.log('Main-process smoke test passed:', logs.length + ' log entries');
}).catch(function (error) {
  console.error(error.stack || error.message);
  process.exitCode = 1;
}).finally(function () {
  Module._load = originalLoad;
  delete global.Editor;
  const backupParent = Path.join(sandbox, 'js-obfuscator-backups');
  Fs.rmSync(backupParent, { recursive: true, force: true });
  Fs.rmSync(sandbox, { recursive: true, force: true });
});
