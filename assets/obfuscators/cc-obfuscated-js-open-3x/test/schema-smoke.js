'use strict';

const Assert = require('assert');
const Fs = require('fs');
const Path = require('path');

const root = Path.resolve(__dirname, '..');
const manifest = JSON.parse(Fs.readFileSync(Path.join(root, 'package.json'), 'utf8'));
Assert.strictEqual(manifest.package_version, 2);
Assert.strictEqual(manifest.contributions.builder, './builder.js');
Assert.ok(manifest.panels.default);

global.Editor = {
  Panel: { define: function (definition) { return definition; } }
};
const panel = require('../panel/index');
delete global.Editor;
Assert.strictEqual(typeof panel.ready, 'function');
Assert.strictEqual(typeof panel.methods.start, 'function');

const builder = require('../builder');
Assert.strictEqual(builder.configs['*'].hooks, './hooks.js');

const main = require('../main');
Object.keys(manifest.contributions.messages).forEach(function (messageName) {
  manifest.contributions.messages[messageName].methods.forEach(function (methodName) {
    Assert.strictEqual(typeof main.methods[methodName], 'function', messageName + ' should map to ' + methodName);
  });
});

console.log('Creator 3.x manifest and panel schema smoke test passed');
