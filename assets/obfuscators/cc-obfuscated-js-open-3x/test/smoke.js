'use strict';

const Assert = require('assert');
const Fs = require('fs');
const Os = require('os');
const Path = require('path');
const Vm = require('vm');
const Config = require('../lib/config');
const Obfuscator = require('../lib/obfuscator');

const sandbox = Fs.mkdtempSync(Path.join(Os.tmpdir(), 'cc-obfuscator-3x-core-'));
const target = Path.join(sandbox, 'output');
Fs.mkdirSync(Path.join(target, 'src'), { recursive: true });
Fs.mkdirSync(Path.join(target, 'node_modules', 'ignored'), { recursive: true });

const inputPath = Path.join(target, 'src', 'logic.js');
const excludedFile = Path.join(target, 'engine.js');
const excludedDirectoryFile = Path.join(target, 'node_modules', 'ignored', 'module.js');
const inputSource = 'function add(a,b){return a+b;} globalThis.answer=add(19,23);\n';
Fs.writeFileSync(inputPath, inputSource, 'utf8');
Fs.writeFileSync(excludedFile, 'globalThis.engineUntouched=true;\n', 'utf8');
Fs.writeFileSync(excludedDirectoryFile, 'globalThis.moduleUntouched=true;\n', 'utf8');

const config = Config.normalizeConfig({
  auto: true,
  continueOnError: false,
  '许可证': { deviceId: 'ignored-by-open-version' },
  '基本设置': { createBackup: true, compact: true, target: 'browser', simplify: true },
  '字符串处理': { stringArray: true, stringArrayEncoding: ['base64'], stringArrayThreshold: 1 },
  '过滤设置': {
    filePathExclude: ['node_modules', 'js-obfuscator-backups'],
    fileNameExclude: ['engine'],
    fullPathExclude: [],
    '保护特定代码模式': { '保护模式列表': ['._super'] }
  },
  '特殊功能': { seed: 12345, domainLockEnabled: false, reservedNames: [], reservedStrings: [] }
});

const logs = [];
const summary = Obfuscator.obfuscateTarget(target, config, {
  info: function (message) { logs.push(message); },
  success: function (message) { logs.push(message); },
  warn: function (message) { logs.push(message); },
  error: function (message) { logs.push(message); }
});

Assert.strictEqual(summary.processed, 1);
Assert.strictEqual(summary.failed, 0);
Assert.ok(summary.skipped >= 2);
Assert.ok(summary.backupRoot && Fs.existsSync(summary.backupRoot));
Assert.strictEqual(Fs.readFileSync(excludedFile, 'utf8'), 'globalThis.engineUntouched=true;\n');
Assert.strictEqual(Fs.readFileSync(excludedDirectoryFile, 'utf8'), 'globalThis.moduleUntouched=true;\n');

const outputSource = Fs.readFileSync(inputPath, 'utf8');
Assert.notStrictEqual(outputSource, inputSource);
const context = {};
Vm.createContext(context);
Vm.runInContext(outputSource, context);
Assert.strictEqual(context.answer, 42);
Assert.strictEqual(Fs.readFileSync(Path.join(summary.backupRoot, 'src', 'logic.js'), 'utf8'), inputSource);
Assert.ok(config.options.reservedNames.indexOf('^_super$') !== -1);

Fs.rmSync(sandbox, { recursive: true, force: true });
console.log('Core smoke test passed:', summary.processed + ' processed, ' + summary.skipped + ' skipped, ' + logs.length + ' logs');
