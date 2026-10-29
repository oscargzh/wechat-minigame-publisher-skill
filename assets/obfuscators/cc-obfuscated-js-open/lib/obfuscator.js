'use strict';

const Fs = require('fs');
const Path = require('path');
const JavaScriptObfuscator = require('javascript-obfuscator');
const Config = require('./config');

function noop() {}

function createLogger(logger) {
  logger = logger || {};
  return {
    info: typeof logger.info === 'function' ? logger.info : noop,
    success: typeof logger.success === 'function' ? logger.success : noop,
    warn: typeof logger.warn === 'function' ? logger.warn : noop,
    error: typeof logger.error === 'function' ? logger.error : noop
  };
}

function timestampForPath() {
  const date = new Date();
  function pad(value) { return String(value).padStart(2, '0'); }
  return date.getFullYear() + pad(date.getMonth() + 1) + pad(date.getDate()) + '-' +
    pad(date.getHours()) + pad(date.getMinutes()) + pad(date.getSeconds());
}

function collectJavaScriptFiles(targetPath, config, logger) {
  const targetStat = Fs.statSync(targetPath);
  const rootPath = targetStat.isDirectory() ? targetPath : Path.dirname(targetPath);
  const files = [];
  const skipped = [];

  function visit(currentPath) {
    const stat = Fs.lstatSync(currentPath);
    if (stat.isSymbolicLink()) {
      skipped.push({ path: currentPath, reason: 'symbolicLink' });
      return;
    }
    if (stat.isDirectory()) {
      const relative = Config.normalizeRelative(Path.relative(rootPath, currentPath));
      if (relative && config.filters.filePathExclude.some(function (pattern) {
        const normalized = Config.normalizeRelative(pattern).replace(/^\/+|\/+$/g, '').toLowerCase();
        return normalized && relative.toLowerCase().split('/').indexOf(normalized) !== -1;
      })) {
        skipped.push({ path: currentPath, reason: 'filePathExclude' });
        return;
      }
      Fs.readdirSync(currentPath).sort().forEach(function (entry) {
        visit(Path.join(currentPath, entry));
      });
      return;
    }
    if (!stat.isFile() || Path.extname(currentPath).toLowerCase() !== '.js') return;
    const exclusion = Config.isExcluded(currentPath, rootPath, config.filters);
    if (exclusion.excluded) {
      skipped.push({ path: currentPath, reason: exclusion.reason });
      return;
    }
    files.push(currentPath);
  }

  visit(targetPath);
  logger.info('扫描完成：找到 ' + files.length + ' 个待混淆 JS 文件，跳过 ' + skipped.length + ' 项');
  return { files: files, skipped: skipped, rootPath: rootPath, targetStat: targetStat };
}

function createBackupRoot(targetPath, targetStat) {
  const parent = Path.dirname(targetPath);
  const baseName = targetStat.isDirectory()
    ? Path.basename(targetPath)
    : Path.basename(targetPath, Path.extname(targetPath));
  return Path.join(parent, 'js-obfuscator-backups', baseName + '-' + timestampForPath());
}

function copyBackup(filePath, rootPath, backupRoot) {
  const relative = Path.relative(rootPath, filePath) || Path.basename(filePath);
  const destination = Path.join(backupRoot, relative);
  Fs.mkdirSync(Path.dirname(destination), { recursive: true });
  Fs.copyFileSync(filePath, destination);
  return destination;
}

function atomicWrite(filePath, content) {
  const temporaryPath = filePath + '.cc-obfuscator-' + process.pid + '-' + Date.now() + '.tmp';
  Fs.writeFileSync(temporaryPath, content, 'utf8');
  try {
    Fs.copyFileSync(temporaryPath, filePath);
  } finally {
    if (Fs.existsSync(temporaryPath)) Fs.unlinkSync(temporaryPath);
  }
}

function preserveShebang(source) {
  if (source.slice(0, 2) !== '#!') return { shebang: '', source: source };
  const newline = source.indexOf('\n');
  if (newline === -1) return { shebang: source + '\n', source: '' };
  return { shebang: source.slice(0, newline + 1), source: source.slice(newline + 1) };
}

function navigateReference(config) {
  if (!config.specialNavigateReference) return '';
  if (config.specialNavigateReference.indexOf('tt.navigateToScene') === -1) return '';
  return ';if(typeof tt!=="undefined"&&tt.navigateToScene){void tt.navigateToScene;}';
}

function obfuscateFile(filePath, rootPath, config, backupRoot, logger) {
  const startedAt = Date.now();
  const source = Fs.readFileSync(filePath, 'utf8');
  const beforeBytes = Buffer.byteLength(source, 'utf8');
  const split = preserveShebang(source);
  const options = Object.assign({}, config.options, {
    inputFileName: Config.normalizeRelative(Path.relative(rootPath, filePath))
  });

  if (options.sourceMap && options.sourceMapMode === 'separate') {
    options.sourceMapFileName = Path.basename(filePath) + '.map';
  }

  const result = JavaScriptObfuscator.obfuscate(split.source, options);
  const output = split.shebang + result.getObfuscatedCode() + navigateReference(config) + '\n';
  const afterBytes = Buffer.byteLength(output, 'utf8');

  let backupPath = '';
  if (config.createBackup) backupPath = copyBackup(filePath, rootPath, backupRoot);
  atomicWrite(filePath, output);

  let sourceMapPath = '';
  if (options.sourceMap) {
    sourceMapPath = filePath + '.map';
    atomicWrite(sourceMapPath, result.getSourceMap());
  }

  const elapsedMs = Date.now() - startedAt;
  logger.success('已混淆 ' + Config.normalizeRelative(Path.relative(rootPath, filePath)) + ' (' + elapsedMs + 'ms)');
  return {
    path: filePath,
    backupPath: backupPath,
    sourceMapPath: sourceMapPath,
    beforeBytes: beforeBytes,
    afterBytes: afterBytes,
    elapsedMs: elapsedMs
  };
}

function obfuscateTarget(targetPath, config, logger) {
  logger = createLogger(logger);
  targetPath = Path.resolve(String(targetPath || '').replace(/^['"]|['"]$/g, ''));
  if (!targetPath || !Fs.existsSync(targetPath)) throw new Error('目标路径不存在：' + targetPath);

  const targetStat = Fs.statSync(targetPath);
  if (!targetStat.isDirectory() && !(targetStat.isFile() && Path.extname(targetPath).toLowerCase() === '.js')) {
    throw new Error('目标必须是 JS 文件或目录：' + targetPath);
  }

  const scan = collectJavaScriptFiles(targetPath, config, logger);
  const backupRoot = config.createBackup ? createBackupRoot(targetPath, scan.targetStat) : '';
  const results = [];
  const errors = [];
  const startedAt = Date.now();

  scan.files.forEach(function (filePath) {
    try {
      results.push(obfuscateFile(filePath, scan.rootPath, config, backupRoot, logger));
    } catch (error) {
      const detail = { path: filePath, message: error && error.message ? error.message : String(error) };
      errors.push(detail);
      logger.error('混淆失败 ' + Config.normalizeRelative(Path.relative(scan.rootPath, filePath)) + '：' + detail.message);
      if (!config.continueOnError) throw error;
    }
  });

  const summary = {
    targetPath: targetPath,
    processed: results.length,
    skipped: scan.skipped.length,
    failed: errors.length,
    elapsedMs: Date.now() - startedAt,
    backupRoot: results.length && config.createBackup ? backupRoot : '',
    beforeBytes: results.reduce(function (sum, item) { return sum + item.beforeBytes; }, 0),
    afterBytes: results.reduce(function (sum, item) { return sum + item.afterBytes; }, 0),
    files: results,
    errors: errors
  };

  if (summary.processed === 0 && summary.failed === 0) logger.warn('没有找到可混淆的 JS 文件');
  return summary;
}

module.exports = {
  collectJavaScriptFiles: collectJavaScriptFiles,
  obfuscateTarget: obfuscateTarget
};
