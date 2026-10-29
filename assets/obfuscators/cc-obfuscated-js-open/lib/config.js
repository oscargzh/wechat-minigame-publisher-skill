'use strict';

const Fs = require('fs');
const Path = require('path');

const DEFAULT_CONFIG = {
  auto: true,
  createBackup: true,
  continueOnError: true,
  specialNavigateReference: '',
  filePathExclude: ['node_modules', '.git', 'js-obfuscator-backups', 'cocos-js', 'wasm'],
  fileNameExclude: ['application', 'settings', 'engine', 'jsb', 'adapter', 'polyfills', 'cocos2d-js-min'],
  fullPathExclude: [],
  protectedPatterns: ['._super']
};

function hasOwn(object, key) {
  return Boolean(object) && Object.prototype.hasOwnProperty.call(object, key);
}

function readValue(raw, sectionName, key, fallback) {
  const section = raw && raw[sectionName];
  if (hasOwn(section, key)) return section[key];
  if (hasOwn(raw, key)) return raw[key];
  return fallback;
}

function cloneArray(value, fallback) {
  if (!Array.isArray(value)) return (fallback || []).slice();
  return value.slice();
}

function uniqueStrings(values) {
  const seen = Object.create(null);
  return values.filter(function (value) {
    if (typeof value !== 'string') return false;
    const normalized = value.trim();
    if (!normalized || seen[normalized]) return false;
    seen[normalized] = true;
    return true;
  });
}

function protectedNamesFromPatterns(patterns) {
  return patterns.map(function (pattern) {
    return String(pattern).replace(/^\./, '').replace(/[^A-Za-z0-9_$]/g, '');
  }).filter(Boolean).map(function (name) {
    return '^' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$';
  });
}

function normalizeConfig(raw) {
  raw = raw || {};
  const filterSection = raw['过滤设置'] || {};
  const specialSection = raw['特殊功能'] || {};
  const protectedConfig = filterSection['保护特定代码模式'] || {};
  const protectedPatterns = protectedConfig['启用'] === false ? [] : cloneArray(
    protectedConfig['保护模式列表'],
    DEFAULT_CONFIG.protectedPatterns
  );

  const reservedNames = uniqueStrings(
    cloneArray(readValue(raw, '标识符处理', 'reservedNames', []))
      .concat(cloneArray(specialSection.reservedNames))
      .concat(protectedNamesFromPatterns(protectedPatterns))
  );
  const reservedStrings = uniqueStrings(cloneArray(specialSection.reservedStrings));
  const domainLockEnabled = Boolean(specialSection.domainLockEnabled);

  const options = {
    compact: Boolean(readValue(raw, '基本设置', 'compact', true)),
    target: readValue(raw, '基本设置', 'target', 'browser'),
    log: Boolean(readValue(raw, '基本设置', 'log', false)),
    simplify: Boolean(readValue(raw, '基本设置', 'simplify', true)),

    selfDefending: Boolean(readValue(raw, '保护设置', 'selfDefending', false)),
    debugProtection: Boolean(readValue(raw, '保护设置', 'debugProtection', false)),
    debugProtectionInterval: Number(readValue(raw, '保护设置', 'debugProtectionInterval', 0)),
    disableConsoleOutput: Boolean(readValue(raw, '保护设置', 'disableConsoleOutput', false)),

    controlFlowFlattening: Boolean(readValue(raw, '混淆强度', 'controlFlowFlattening', false)),
    controlFlowFlatteningThreshold: Number(readValue(raw, '混淆强度', 'controlFlowFlatteningThreshold', 0.25)),
    deadCodeInjection: Boolean(readValue(raw, '混淆强度', 'deadCodeInjection', false)),
    deadCodeInjectionThreshold: Number(readValue(raw, '混淆强度', 'deadCodeInjectionThreshold', 0.1)),

    stringArray: Boolean(readValue(raw, '字符串处理', 'stringArray', true)),
    stringArrayRotate: Boolean(readValue(raw, '字符串处理', 'stringArrayRotate', readValue(raw, '字符串处理', 'rotateStringArray', true))),
    stringArrayShuffle: Boolean(readValue(raw, '字符串处理', 'stringArrayShuffle', readValue(raw, '字符串处理', 'shuffleStringArray', true))),
    stringArrayEncoding: cloneArray(readValue(raw, '字符串处理', 'stringArrayEncoding', [])),
    stringArrayIndexesType: cloneArray(readValue(raw, '字符串处理', 'stringArrayIndexesType', ['hexadecimal-number'])),
    stringArrayIndexShift: Boolean(readValue(raw, '字符串处理', 'stringArrayIndexShift', true)),
    stringArrayWrappersCount: Number(readValue(raw, '字符串处理', 'stringArrayWrappersCount', 1)),
    stringArrayWrappersType: readValue(raw, '字符串处理', 'stringArrayWrappersType', 'variable'),
    stringArrayWrappersChainedCalls: Boolean(readValue(raw, '字符串处理', 'stringArrayWrappersChainedCalls', true)),
    stringArrayWrappersParametersMaxCount: Number(readValue(raw, '字符串处理', 'stringArrayWrappersParametersMaxCount', 2)),
    stringArrayThreshold: Number(readValue(raw, '字符串处理', 'stringArrayThreshold', 0.75)),
    stringArrayCallsTransform: Boolean(readValue(raw, '字符串处理', 'stringArrayCallsTransform', false)),
    stringArrayCallsTransformThreshold: Number(readValue(raw, '混淆强度', 'stringArrayCallsTransformThreshold', 0.5)),
    forceTransformStrings: cloneArray(readValue(raw, '字符串处理', 'forceTransformStrings', [])),
    splitStrings: Boolean(readValue(raw, '字符串处理', 'splitStrings', false)),
    splitStringsChunkLength: Number(readValue(raw, '字符串处理', 'splitStringsChunkLength', 10)),

    identifierNamesGenerator: readValue(raw, '标识符处理', 'identifierNamesGenerator', 'hexadecimal'),
    identifiersPrefix: readValue(raw, '标识符处理', 'identifiersPrefix', ''),
    identifiersDictionary: cloneArray(readValue(raw, '标识符处理', 'identifiersDictionary', [])),
    transformObjectKeys: Boolean(readValue(raw, '标识符处理', 'transformObjectKeys', false)),
    renameGlobals: Boolean(readValue(raw, '标识符处理', 'renameGlobals', false)),
    renameProperties: Boolean(readValue(raw, '标识符处理', 'renameProperties', false)),
    renamePropertiesMode: readValue(raw, '标识符处理', 'renamePropertiesMode', 'safe'),
    reservedNames: reservedNames,
    reservedStrings: reservedStrings,

    sourceMap: Boolean(readValue(raw, '源码映射', 'sourceMap', false)),
    sourceMapMode: readValue(raw, '源码映射', 'sourceMapMode', 'separate'),
    sourceMapBaseUrl: readValue(raw, '源码映射', 'sourceMapBaseUrl', ''),
    sourceMapFileName: readValue(raw, '源码映射', 'sourceMapFileName', ''),
    sourceMapSourcesMode: readValue(raw, '源码映射', 'sourceMapSourcesMode', 'sources-content'),

    domainLock: domainLockEnabled ? cloneArray(specialSection.domainLock) : [],
    domainLockRedirectUrl: specialSection.domainLockRedirectUrl || 'about:blank',
    seed: hasOwn(specialSection, 'seed') ? specialSection.seed : readValue(raw, '特殊功能', 'seed', 0),
    numbersToExpressions: Boolean(readValue(raw, '特殊功能', 'numbersToExpressions', false)),
    unicodeEscapeSequence: Boolean(readValue(raw, '特殊功能', 'unicodeEscapeSequence', false)),
    ignoreImports: Boolean(readValue(raw, '特殊功能', 'ignoreImports', false))
  };

  return {
    raw: raw,
    auto: hasOwn(raw, 'auto') ? Boolean(raw.auto) : DEFAULT_CONFIG.auto,
    createBackup: Boolean(readValue(raw, '基本设置', 'createBackup', DEFAULT_CONFIG.createBackup)),
    continueOnError: hasOwn(raw, 'continueOnError') ? Boolean(raw.continueOnError) : DEFAULT_CONFIG.continueOnError,
    specialNavigateReference: typeof specialSection.tt_navigateToScene === 'string' ? specialSection.tt_navigateToScene.trim() : '',
    filters: {
      filePathExclude: uniqueStrings(cloneArray(filterSection.filePathExclude, DEFAULT_CONFIG.filePathExclude)),
      fileNameExclude: uniqueStrings(cloneArray(filterSection.fileNameExclude, DEFAULT_CONFIG.fileNameExclude)),
      fullPathExclude: uniqueStrings(cloneArray(filterSection.fullPathExclude, DEFAULT_CONFIG.fullPathExclude)),
      protectedPatterns: uniqueStrings(protectedPatterns)
    },
    options: options
  };
}

function readConfig(configPath) {
  const content = Fs.readFileSync(configPath, 'utf8');
  return normalizeConfig(JSON.parse(content));
}

function saveAutoFlag(configPath, enabled) {
  const raw = JSON.parse(Fs.readFileSync(configPath, 'utf8'));
  raw.auto = Boolean(enabled);
  Fs.writeFileSync(configPath, JSON.stringify(raw, null, 2) + '\n', 'utf8');
  return normalizeConfig(raw);
}

function normalizeRelative(filePath) {
  return String(filePath).replace(/\\/g, '/').replace(/^\.\//, '');
}

function matchesDirectory(relativePath, pattern) {
  const cleanPattern = normalizeRelative(pattern).replace(/^\/+|\/+$/g, '').toLowerCase();
  if (!cleanPattern) return false;
  const directory = normalizeRelative(Path.dirname(relativePath)).toLowerCase();
  const segments = directory.split('/');
  return segments.indexOf(cleanPattern) !== -1 || ('/' + directory + '/').indexOf('/' + cleanPattern + '/') !== -1;
}

function isExcluded(filePath, rootPath, filters) {
  const relative = normalizeRelative(Path.relative(rootPath, filePath));
  const normalizedFullPath = '/' + relative.toLowerCase();
  const fileName = Path.basename(filePath, Path.extname(filePath)).toLowerCase();

  if (filters.fullPathExclude.some(function (pattern) {
    const normalized = '/' + normalizeRelative(pattern).replace(/^\/+/, '').toLowerCase();
    if (normalized.length <= 1) return false;
    if (normalized.slice(-1) === '/') return normalizedFullPath.indexOf(normalized) === 0;
    return normalizedFullPath === normalized;
  })) return { excluded: true, reason: 'fullPathExclude' };

  if (filters.filePathExclude.some(function (pattern) {
    return matchesDirectory(relative, pattern);
  })) return { excluded: true, reason: 'filePathExclude' };

  if (filters.fileNameExclude.some(function (pattern) {
    const value = String(pattern).trim().toLowerCase();
    return value && fileName.indexOf(value) !== -1;
  })) return { excluded: true, reason: 'fileNameExclude' };

  return { excluded: false, reason: '' };
}

module.exports = {
  DEFAULT_CONFIG: DEFAULT_CONFIG,
  isExcluded: isExcluded,
  normalizeConfig: normalizeConfig,
  normalizeRelative: normalizeRelative,
  readConfig: readConfig,
  saveAutoFlag: saveAutoFlag
};
