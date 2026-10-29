'use strict';

exports.load = function () {
  console.log('[Open JS Obfuscator 3.x] 构建扩展已加载');
};

exports.unload = function () {};

exports.configs = {
  '*': {
    hooks: './hooks.js'
  }
};
