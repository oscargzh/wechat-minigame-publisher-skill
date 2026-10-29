'use strict';

const Config = require('./config');
const Obfuscator = require('./obfuscator');

function send(message) {
  if (typeof process.send === 'function' && process.connected) process.send(message);
}

function createLogger(requestId) {
  function output(level, message) {
    send({ type: 'log', level: level, message: String(message), requestId: requestId });
  }
  return {
    info: function (message) { output('info', message); },
    success: function (message) { output('success', message); },
    warn: function (message) { output('warn', message); },
    error: function (message) { output('error', message); }
  };
}

process.on('message', function (task) {
  const requestId = task && task.requestId ? task.requestId : '';
  try {
    const config = Config.readConfig(task.configPath);
    const summary = Obfuscator.obfuscateTarget(task.targetPath, config, createLogger(requestId));
    send({ type: 'done', summary: summary, requestId: requestId });
    if (process.connected) process.disconnect();
    process.exitCode = summary.failed > 0 ? 2 : 0;
  } catch (error) {
    send({
      type: 'failed',
      requestId: requestId,
      message: error && error.stack ? error.stack : String(error)
    });
    if (process.connected) process.disconnect();
    process.exitCode = 1;
  }
});
