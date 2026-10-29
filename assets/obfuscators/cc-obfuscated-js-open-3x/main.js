'use strict';

const Fs = require('fs');
const Path = require('path');
const PackageJson = require('./package.json');
const Config = require('./lib/config');
const Runner = require('./lib/runner');

const PACKAGE_NAME = PackageJson.name;
const CONFIG_PATH = Path.join(__dirname, 'runtime_Ts', 'cc_obfuscated_js.json');
let jobQueue = Promise.resolve();

function broadcast(level, message, requestId) {
  const text = Runner.stripAnsi(message);
  const prefix = '[Open JS Obfuscator 3.x] ';
  if (level === 'error') console.error(prefix + text);
  else if (level === 'warn') console.warn(prefix + text);
  else console.log(prefix + text);
  try {
    Editor.Message.broadcast(PACKAGE_NAME + ':log', {
      level: level,
      message: text,
      requestId: requestId || ''
    });
  } catch (error) {}
}

function readConfig() {
  if (!Fs.existsSync(CONFIG_PATH)) throw new Error('配置文件不存在：' + CONFIG_PATH);
  return Config.readConfig(CONFIG_PATH);
}

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
  return (bytes / 1024 / 1024).toFixed(2) + ' MB';
}

function summaryText(summary) {
  return '处理 ' + summary.processed + ' 个，跳过 ' + summary.skipped + ' 个，失败 ' + summary.failed +
    ' 个；' + formatBytes(summary.beforeBytes) + ' → ' + formatBytes(summary.afterBytes) +
    '，耗时 ' + summary.elapsedMs + 'ms';
}

function enqueue(targetPath, requestId) {
  const queued = jobQueue.catch(function () {}).then(function () {
    broadcast('info', '开始混淆：' + targetPath, requestId);
    return Runner.runWorker({
      targetPath: targetPath,
      configPath: CONFIG_PATH,
      requestId: requestId
    }, function (level, message) {
      broadcast(level, message, requestId);
    });
  });
  jobQueue = queued.catch(function () {});
  return queued;
}

function setAuto(enabled) {
  const config = Config.saveAutoFlag(CONFIG_PATH, enabled);
  broadcast('success', enabled ? '已开启构建后自动混淆' : '已关闭构建后自动混淆');
  return { auto: config.auto, configPath: CONFIG_PATH };
}

exports.methods = {
  openPanel: function () {
    return Editor.Panel.open(PACKAGE_NAME);
  },

  openConfig: function () {
    try {
      const Electron = require('electron');
      if (Electron.shell && Electron.shell.showItemInFolder) Electron.shell.showItemInFolder(CONFIG_PATH);
      return CONFIG_PATH;
    } catch (error) {
      broadcast('error', '打开配置位置失败：' + error.message);
      throw error;
    }
  },

  enableAuto: function () {
    return setAuto(true);
  },

  disableAuto: function () {
    return setAuto(false);
  },

  getStatus: function () {
    const config = readConfig();
    return {
      auto: config.auto,
      createBackup: config.createBackup,
      configPath: CONFIG_PATH,
      version: PackageJson.version
    };
  },

  runManual: async function (params) {
    const targetPath = params && params.path ? String(params.path).trim() : '';
    const requestId = params && params.requestId ? params.requestId : 'manual-' + Date.now().toString(36);
    if (!targetPath) throw new Error('请选择 JS 文件或目录');
    try {
      const summary = await enqueue(targetPath, requestId);
      broadcast(summary.failed ? 'warn' : 'success', summaryText(summary), requestId);
      if (summary.backupRoot) broadcast('info', '备份目录：' + summary.backupRoot, requestId);
      return summary;
    } catch (error) {
      broadcast('error', '手动混淆失败：' + error.message, requestId);
      throw error;
    }
  }
};

exports.load = function () {
  try {
    const status = exports.methods.getStatus();
    broadcast('info', '插件 ' + status.version + ' 已加载；构建后自动混淆：' + (status.auto ? '开启' : '关闭'));
  } catch (error) {
    broadcast('error', '加载失败：' + error.message);
  }
};

exports.unload = function () {};

exports._test = {
  configPath: CONFIG_PATH,
  summaryText: summaryText
};
