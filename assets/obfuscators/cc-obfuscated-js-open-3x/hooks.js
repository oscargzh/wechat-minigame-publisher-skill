'use strict';

const Fs = require('fs');
const Path = require('path');
const Config = require('./lib/config');
const Runner = require('./lib/runner');

const CONFIG_PATH = Path.join(__dirname, 'runtime_Ts', 'cc_obfuscated_js.json');

function log(level, message) {
  const prefix = '[Open JS Obfuscator 3.x][构建] ';
  if (level === 'error') console.error(prefix + message);
  else if (level === 'warn') console.warn(prefix + message);
  else console.log(prefix + message);
}

function resolveBuildOutput(options, result) {
  const candidates = [
    result && result.dest,
    options && options.dest
  ];
  const projectPath = typeof Editor !== 'undefined' && Editor.Project ? Editor.Project.path : '';
  if (options && options.buildPath) {
    let buildPath = String(options.buildPath);
    if (buildPath.indexOf('project://') === 0 && projectPath) {
      buildPath = Path.join(projectPath, buildPath.slice('project://'.length));
    }
    candidates.push(options.outputName ? Path.join(buildPath, options.outputName) : buildPath);
  }
  for (let index = 0; index < candidates.length; index += 1) {
    if (!candidates[index]) continue;
    const resolved = Path.resolve(String(candidates[index]).replace(/^['"]|['"]$/g, ''));
    if (Fs.existsSync(resolved)) return resolved;
  }
  throw new Error('无法确定构建输出目录');
}

exports.throwError = true;

exports.load = function () {
  log('info', '构建钩子已加载');
};

exports.unload = function () {};

exports.onBeforeBuild = function (options) {
  const platform = options && options.platform ? options.platform : 'unknown';
  log('info', '开始构建：' + platform);
};

async function runForStage(stage, options, result) {
  const config = Config.readConfig(CONFIG_PATH);
  const buildSettings = config.raw['构建设置'] || {};
  const configuredStage = buildSettings.hook || 'onAfterBuild';
  if (configuredStage !== stage) return true;
  if (!config.auto) {
    log('info', '构建后自动混淆已关闭');
    return true;
  }

  const targetPath = resolveBuildOutput(options, result);
  const platform = options && options.platform ? options.platform : 'unknown';
  log('info', '[' + platform + '] 开始混淆构建目录：' + targetPath);
  const summary = await Runner.runWorker({
    targetPath: targetPath,
    configPath: CONFIG_PATH,
    requestId: 'build-' + Date.now().toString(36)
  }, log);

  log(summary.failed ? 'warn' : 'success', '处理 ' + summary.processed + ' 个，跳过 ' + summary.skipped +
    ' 个，失败 ' + summary.failed + ' 个，耗时 ' + summary.elapsedMs + 'ms');
  if (summary.backupRoot) log('info', '备份目录：' + summary.backupRoot);
  if (summary.failed > 0 && buildSettings.failBuildOnError !== false) {
    throw new Error('构建后混淆有 ' + summary.failed + ' 个文件失败');
  }
  return true;
}

exports.onBeforeCompressSettings = async function (options, result) {
  return runForStage('onBeforeCompressSettings', options, result);
};

exports.onAfterBuild = async function (options, result) {
  return runForStage('onAfterBuild', options, result);
};

exports._test = {
  resolveBuildOutput: resolveBuildOutput,
  runForStage: runForStage
};
