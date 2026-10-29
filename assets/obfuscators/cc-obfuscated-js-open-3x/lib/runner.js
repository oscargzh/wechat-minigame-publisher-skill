'use strict';

const ChildProcess = require('child_process');
const Path = require('path');

const WORKER_PATH = Path.join(__dirname, 'worker.js');

function stripAnsi(value) {
  return String(value || '').replace(/\x1b\[\d+(;\d+)*m/g, '');
}

function runWorker(task, onLog) {
  return new Promise(function (resolve, reject) {
    let settled = false;
    let summary = null;
    const child = ChildProcess.fork(WORKER_PATH, [], {
      cwd: Path.resolve(__dirname, '..'),
      silent: true,
      env: Object.assign({}, process.env, { ELECTRON_RUN_AS_NODE: '1' }),
      execArgv: []
    });

    function log(level, message) {
      if (typeof onLog === 'function' && message) onLog(level, stripAnsi(message));
    }

    function finish(error) {
      if (settled) return;
      settled = true;
      if (error) reject(error);
      else resolve(summary);
    }

    child.stdout.on('data', function (data) {
      const message = stripAnsi(data).trim();
      if (message) log('info', message);
    });
    child.stderr.on('data', function (data) {
      const message = stripAnsi(data).trim();
      if (message) log('error', message);
    });
    child.on('message', function (message) {
      if (!message) return;
      if (message.type === 'log') log(message.level || 'info', message.message);
      if (message.type === 'done') summary = message.summary;
      if (message.type === 'failed') finish(new Error(message.message || '混淆工作进程失败'));
    });
    child.on('error', finish);
    child.on('exit', function (code) {
      if (settled) return;
      if (summary) finish(null);
      else finish(new Error('混淆工作进程退出，代码：' + code));
    });

    child.send(task);
  });
}

module.exports = {
  runWorker: runWorker,
  stripAnsi: stripAnsi
};
