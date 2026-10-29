'use strict';

const Fs = require('fs');
const Path = require('path');
const ChildProcess = require('child_process');
const Electron = require('electron');
const PackageJson = require('./package.json');
const Config = require('./lib/config');

const PACKAGE_NAME = PackageJson.name;
const CONFIG_PATH = Path.join(__dirname, 'runtime_Ts', 'cc_obfuscated_js.json');
const CONFIG_UUID = '51d74f16-fc28-4fc4-8380-72b6fe653f90';
const WORKER_PATH = Path.join(__dirname, 'lib', 'worker.js');

let jobQueue = Promise.resolve();

function stripAnsi(value) {
  return String(value).replace(/\x1b\[\d+(;\d+)*m/g, '');
}

function sendPanel(channel, payload) {
  try {
    Editor.Ipc.sendToPanel(PACKAGE_NAME, PACKAGE_NAME + ':' + channel, payload);
  } catch (error) {
    // The panel may be closed; editor logging still works.
  }
}

const Logger = {
  write: function (level, message, requestId) {
    const clean = stripAnsi(message);
    const prefix = level === 'error' ? '[❌]' : level === 'warn' ? '[⚠]' : level === 'success' ? '[✅]' : '[ℹ]';
    if (level === 'error' && Editor.error) Editor.error('[Open JS Obfuscator] ' + prefix + ' ' + clean);
    else if (level === 'warn' && Editor.warn) Editor.warn('[Open JS Obfuscator] ' + prefix + ' ' + clean);
    else Editor.log('[Open JS Obfuscator] ' + prefix + ' ' + clean);
    sendPanel('log', { level: level, message: clean, requestId: requestId || '' });
  },
  info: function (message, requestId) { this.write('info', message, requestId); },
  success: function (message, requestId) { this.write('success', message, requestId); },
  warn: function (message, requestId) { this.write('warn', message, requestId); },
  error: function (message, requestId) { this.write('error', message, requestId); }
};

function readConfig() {
  if (!Fs.existsSync(CONFIG_PATH)) throw new Error('配置文件不存在：' + CONFIG_PATH);
  return Config.readConfig(CONFIG_PATH);
}

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
  return (bytes / 1024 / 1024).toFixed(2) + ' MB';
}

function runWorker(targetPath, source, requestId) {
  return new Promise(function (resolve, reject) {
    let settled = false;
    let summary = null;
    const workerEnvironment = Object.assign({}, process.env, {
      // In Cocos Creator/Electron, process.execPath points at the Electron host.
      // This flag makes the forked host run as a plain Node process.
      ELECTRON_RUN_AS_NODE: '1'
    });
    const child = ChildProcess.fork(WORKER_PATH, [], {
      cwd: __dirname,
      silent: true,
      env: workerEnvironment,
      execArgv: []
    });

    function finish(error) {
      if (settled) return;
      settled = true;
      if (error) reject(error);
      else resolve(summary);
    }

    child.stdout.on('data', function (data) {
      const text = stripAnsi(data).trim();
      if (text) Logger.info(text, requestId);
    });
    child.stderr.on('data', function (data) {
      const text = stripAnsi(data).trim();
      if (text) Logger.error(text, requestId);
    });
    child.on('message', function (message) {
      if (!message) return;
      if (message.type === 'log') {
        Logger.write(message.level || 'info', message.message, requestId);
      } else if (message.type === 'done') {
        summary = message.summary;
      } else if (message.type === 'failed') {
        finish(new Error(message.message || '混淆工作进程失败'));
      }
    });
    child.on('error', finish);
    child.on('exit', function (code) {
      if (settled) return;
      if (summary) {
        if (summary.failed > 0) Logger.warn('任务完成，但有 ' + summary.failed + ' 个文件失败', requestId);
        finish(null);
      } else {
        finish(new Error('混淆工作进程退出，代码：' + code));
      }
    });

    Logger.info('开始' + (source === 'build' ? '构建后' : '手动') + '混淆：' + targetPath, requestId);
    child.send({
      targetPath: targetPath,
      configPath: CONFIG_PATH,
      requestId: requestId
    });
  });
}

function enqueue(targetPath, source, requestId) {
  const queuedJob = jobQueue.catch(function () {}).then(function () {
    return runWorker(targetPath, source, requestId);
  });
  jobQueue = queuedJob.catch(function () {});
  return queuedJob;
}

function reportSummary(summary, requestId) {
  const message = '处理 ' + summary.processed + ' 个，跳过 ' + summary.skipped + ' 个，失败 ' + summary.failed +
    ' 个；' + formatBytes(summary.beforeBytes) + ' → ' + formatBytes(summary.afterBytes) +
    '，耗时 ' + summary.elapsedMs + 'ms';
  if (summary.failed) Logger.warn(message, requestId);
  else Logger.success(message, requestId);
  if (summary.backupRoot) Logger.info('备份目录：' + summary.backupRoot, requestId);
}

function once(callback) {
  let called = false;
  return function () {
    if (called) return;
    called = true;
    if (typeof callback === 'function') callback();
  };
}

function showConfigInExplorer() {
  if (Electron.shell && Electron.shell.showItemInFolder) Electron.shell.showItemInFolder(CONFIG_PATH);
  try {
    Editor.Ipc.sendToAll('assets:hint', CONFIG_UUID);
    Editor.Ipc.sendToAll('selection:selected', CONFIG_UUID);
  } catch (error) {}
}

module.exports = {
  load: function () {
    try {
      const config = readConfig();
      Logger.info('插件 ' + PackageJson.version + ' 已加载；构建后自动混淆：' + (config.auto ? '开启' : '关闭'));
    } catch (error) {
      Logger.error(error.message);
    }
    Editor.Builder.on('build-start', this.onBuildStart);
    Editor.Builder.on('before-change-files', this.onBeforeChangeFiles);
  },

  unload: function () {
    Editor.Builder.removeListener('build-start', this.onBuildStart);
    Editor.Builder.removeListener('before-change-files', this.onBeforeChangeFiles);
  },

  onBuildStart: function (options, callback) {
    try {
      const config = readConfig();
      if (config.auto) Logger.info('构建完成后将自动混淆 ' + (options.platform || '当前') + ' 平台输出');
    } catch (error) {
      Logger.error(error.message);
    } finally {
      if (typeof callback === 'function') callback();
    }
  },

  onBeforeChangeFiles: function (options, callback) {
    const done = once(callback);
    let config;
    try {
      config = readConfig();
      if (!config.auto) {
        Logger.info('构建后自动混淆已关闭');
        done();
        return;
      }
      if (!options || !options.dest) throw new Error('构建输出目录为空');
    } catch (error) {
      Logger.error('无法启动构建后混淆：' + error.message);
      done();
      return;
    }

    enqueue(options.dest, 'build', 'build-' + Date.now().toString(36))
      .then(function (summary) { reportSummary(summary, ''); })
      .catch(function (error) { Logger.error('构建后混淆失败：' + error.message); })
      .then(done, done);
  },

  messages: {
    open_panel: function () {
      Editor.Panel.open(PACKAGE_NAME);
    },

    open_config: function () {
      showConfigInExplorer();
    },

    enable_auto: function () {
      try {
        Config.saveAutoFlag(CONFIG_PATH, true);
        Logger.success('已开启构建后自动混淆');
        showConfigInExplorer();
      } catch (error) {
        Logger.error('开启失败：' + error.message);
      }
    },

    disable_auto: function () {
      try {
        Config.saveAutoFlag(CONFIG_PATH, false);
        Logger.success('已关闭构建后自动混淆');
        showConfigInExplorer();
      } catch (error) {
        Logger.error('关闭失败：' + error.message);
      }
    },

    run_manual: function (event, params) {
      const requestId = params && params.requestId ? params.requestId : 'manual-' + Date.now().toString(36);
      const targetPath = params && params.path ? params.path : '';
      if (!targetPath) {
        const error = '请选择 JS 文件或目录';
        Logger.error(error, requestId);
        sendPanel('failed', { requestId: requestId, message: error });
        return;
      }

      enqueue(targetPath, 'manual', requestId)
        .then(function (summary) {
          reportSummary(summary, requestId);
          sendPanel('done', { requestId: requestId, summary: summary });
        })
        .catch(function (error) {
          Logger.error('手动混淆失败：' + error.message, requestId);
          sendPanel('failed', { requestId: requestId, message: error.message });
        });
    }
  }
};
