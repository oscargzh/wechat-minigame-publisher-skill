'use strict';

const Fs = require('fs');
const Path = require('path');

const PACKAGE_NAME = 'cc-obfuscated-js-open-3x';
const LOG_CHANNEL = PACKAGE_NAME + ':log';

module.exports = Editor.Panel.define({
  template: `
    <div class="header">
      <div>
        <h1>Open JS Obfuscator 3.x</h1>
        <div class="sub">开源、跨平台、无设备绑定 · javascript-obfuscator 4.1.1</div>
      </div>
      <button id="openConfig">打开配置位置</button>
    </div>

    <section class="card status-row">
      <div>构建后自动混淆：<strong id="autoStatus">读取中…</strong></div>
      <div class="actions">
        <button id="enableAuto">开启</button>
        <button id="disableAuto">关闭</button>
      </div>
    </section>

    <section class="card">
      <label for="targetPath">选择要混淆的 JavaScript 文件或目录</label>
      <div class="path-row">
        <input id="targetPath" type="text" placeholder="可直接粘贴完整路径" />
        <button id="pickFile">选择文件</button>
        <button id="pickFolder">选择目录</button>
      </div>
      <div class="run-row">
        <button id="start" class="primary">开始混淆</button>
        <span id="running" class="hidden">正在处理，请稍候…</span>
      </div>
      <div class="warning">混淆会原地写入目标。默认开启备份，备份目录会显示在结果中。</div>
    </section>

    <section id="statsCard" class="card hidden">
      <div class="stats">
        <div class="stat"><div id="processed" class="stat-value">0</div><div class="stat-name">已处理</div></div>
        <div class="stat"><div id="skipped" class="stat-value">0</div><div class="stat-name">已跳过</div></div>
        <div class="stat"><div id="failed" class="stat-value">0</div><div class="stat-name">失败</div></div>
        <div class="stat"><div id="elapsed" class="stat-value">0ms</div><div class="stat-name">耗时</div></div>
      </div>
      <div id="backup" class="backup"></div>
    </section>

    <section class="card log-card">
      <div class="log-head"><strong>运行日志</strong><button id="clear">清空</button></div>
      <div id="logs" class="logs"></div>
    </section>
  `,

  style: `
    :host { box-sizing:border-box; display:block; height:100%; padding:16px; overflow:auto; color:#d1d5db; background:#171b22; font-family:Arial,"Microsoft YaHei",sans-serif; }
    * { box-sizing:border-box; }
    .header { display:flex; align-items:center; justify-content:space-between; gap:12px; border-bottom:1px solid #343b47; padding-bottom:12px; margin-bottom:16px; }
    h1 { margin:0; color:#38bdf8; font-size:20px; }
    .sub { color:#8b97a8; font-size:12px; margin-top:4px; }
    .card { background:#222833; border:1px solid #343b47; border-radius:8px; padding:14px; margin-bottom:14px; }
    .status-row,.run-row,.actions,.log-head { display:flex; align-items:center; justify-content:space-between; gap:8px; }
    label { display:block; color:#e5e7eb; font-size:14px; font-weight:600; margin-bottom:9px; }
    .path-row { display:grid; grid-template-columns:minmax(180px,1fr) auto auto; gap:8px; }
    input,button { min-height:34px; border:1px solid #46505e; border-radius:5px; color:#dbe4ef; background:#171b22; padding:6px 10px; }
    input { width:100%; outline:none; }
    input:focus { border-color:#38bdf8; }
    button { cursor:pointer; }
    button:hover { border-color:#60a5fa; background:#263241; }
    button:disabled { cursor:not-allowed; opacity:.55; }
    .run-row { justify-content:flex-start; margin-top:12px; }
    .primary { min-width:160px; min-height:42px; color:white; border-color:#0284c7; background:#0369a1; font-weight:700; }
    .warning { color:#fbbf24; font-size:12px; line-height:1.6; margin-top:10px; }
    .enabled { color:#86efac; } .disabled { color:#fca5a5; }
    .stats { display:grid; grid-template-columns:repeat(4,1fr); gap:8px; }
    .stat { background:#171b22; border-radius:6px; padding:10px; text-align:center; }
    .stat-value { color:#a7f3d0; font-size:18px; font-weight:700; }
    .stat-name { color:#8390a3; font-size:11px; margin-top:3px; }
    .backup { color:#9ca3af; font:11px/1.5 Consolas,monospace; word-break:break-all; margin-top:10px; }
    .log-card { min-height:230px; display:flex; flex-direction:column; }
    .logs { flex:1; min-height:190px; max-height:330px; overflow:auto; background:#11151b; border-radius:6px; padding:10px; font:12px/1.55 Consolas,"Microsoft YaHei",monospace; }
    .log { margin-bottom:4px; white-space:pre-wrap; word-break:break-word; }
    .log.info { color:#cbd5e1; } .log.success { color:#86efac; } .log.warn { color:#fde68a; } .log.error { color:#fca5a5; }
    .time { color:#64748b; margin-right:7px; }
    .hidden { display:none; }
    @media (max-width:620px) { .path-row { grid-template-columns:1fr 1fr; } .path-row input { grid-column:1 / -1; } .stats { grid-template-columns:repeat(2,1fr); } }
  `,

  $: {
    targetPath: '#targetPath',
    pickFile: '#pickFile',
    pickFolder: '#pickFolder',
    start: '#start',
    running: '#running',
    openConfig: '#openConfig',
    enableAuto: '#enableAuto',
    disableAuto: '#disableAuto',
    autoStatus: '#autoStatus',
    statsCard: '#statsCard',
    processed: '#processed',
    skipped: '#skipped',
    failed: '#failed',
    elapsed: '#elapsed',
    backup: '#backup',
    logs: '#logs',
    clear: '#clear'
  },

  methods: {
    addLog: function (level, message) {
      const line = document.createElement('div');
      line.className = 'log ' + (level || 'info');
      const time = document.createElement('span');
      time.className = 'time';
      time.textContent = '[' + new Date().toLocaleTimeString() + ']';
      const content = document.createElement('span');
      content.textContent = String(message);
      line.appendChild(time);
      line.appendChild(content);
      this.$.logs.appendChild(line);
      this.$.logs.scrollTop = this.$.logs.scrollHeight;
    },

    setRunning: function (running) {
      this.running = running;
      this.$.start.disabled = running;
      this.$.running.classList.toggle('hidden', !running);
    },

    setAutoStatus: function (enabled) {
      this.$.autoStatus.textContent = enabled ? '已开启' : '已关闭';
      this.$.autoStatus.className = enabled ? 'enabled' : 'disabled';
    },

    refreshStatus: async function () {
      try {
        const status = await Editor.Message.request(PACKAGE_NAME, 'get-status');
        this.setAutoStatus(Boolean(status.auto));
      } catch (error) {
        this.$.autoStatus.textContent = '读取失败';
        this.addLog('error', '读取状态失败：' + (error.message || error));
      }
    },

    resolveSelection: function (selection) {
      if (!selection) return '';
      if (Array.isArray(selection)) return selection[0] || '';
      if (Array.isArray(selection.filePaths)) return selection.filePaths[0] || '';
      return typeof selection === 'string' ? selection : '';
    },

    pick: async function (directory) {
      try {
        let selection;
        if (typeof Editor.Dialog.select === 'function') {
          selection = await Editor.Dialog.select({
            title: directory ? '选择需要混淆的目录' : '选择需要混淆的 JavaScript 文件',
            path: Editor.Project && Editor.Project.path ? Editor.Project.path : undefined,
            type: directory ? 'directory' : 'file',
            multi: false,
            filters: directory ? undefined : [{ name: 'JavaScript', extensions: ['js'] }]
          });
        } else if (typeof Editor.Dialog.openFile === 'function') {
          selection = await Editor.Dialog.openFile({
            title: directory ? '选择需要混淆的目录' : '选择需要混淆的 JavaScript 文件',
            properties: directory ? ['openDirectory'] : ['openFile'],
            filters: directory ? undefined : [{ name: 'JavaScript', extensions: ['js'] }]
          });
        } else {
          throw new Error('当前编辑器未提供文件选择接口');
        }
        const selected = this.resolveSelection(selection);
        if (selected) this.$.targetPath.value = selected;
      } catch (error) {
        this.addLog('error', '打开选择框失败：' + (error.message || error) + '；也可以直接粘贴路径。');
      }
    },

    showSummary: function (summary) {
      this.$.processed.textContent = String(summary.processed || 0);
      this.$.skipped.textContent = String(summary.skipped || 0);
      this.$.failed.textContent = String(summary.failed || 0);
      this.$.elapsed.textContent = String(summary.elapsedMs || 0) + 'ms';
      this.$.backup.textContent = summary.backupRoot ? '备份：' + summary.backupRoot : '本次未创建备份';
      this.$.statsCard.classList.remove('hidden');
    },

    start: async function () {
      if (this.running) return;
      const targetPath = String(this.$.targetPath.value || '').trim();
      if (!targetPath) return this.addLog('error', '请先选择 JS 文件或目录');
      if (!Fs.existsSync(targetPath)) return this.addLog('error', '目标路径不存在：' + targetPath);
      if (Fs.statSync(targetPath).isFile() && Path.extname(targetPath).toLowerCase() !== '.js') {
        return this.addLog('error', '只能选择 .js 文件或目录');
      }

      const requestId = 'manual-' + Date.now().toString(36);
      this.setRunning(true);
      this.$.statsCard.classList.add('hidden');
      this.addLog('info', '任务已加入队列：' + targetPath);
      try {
        const summary = await Editor.Message.request(PACKAGE_NAME, 'run-manual', {
          path: targetPath,
          requestId: requestId
        });
        this.showSummary(summary || {});
      } catch (error) {
        this.addLog('error', '任务失败：' + (error.message || error));
      } finally {
        this.setRunning(false);
      }
    }
  },

  ready: function () {
    this.running = false;
    this._onLog = function (payload) {
      if (payload) this.addLog(payload.level, payload.message);
    }.bind(this);
    Editor.Message.addBroadcastListener(LOG_CHANNEL, this._onLog);
    this.$.pickFile.addEventListener('click', function () { this.pick(false); }.bind(this));
    this.$.pickFolder.addEventListener('click', function () { this.pick(true); }.bind(this));
    this.$.start.addEventListener('click', function () { this.start(); }.bind(this));
    this.$.openConfig.addEventListener('click', function () { Editor.Message.send(PACKAGE_NAME, 'open-config'); });
    this.$.enableAuto.addEventListener('click', async function () {
      const status = await Editor.Message.request(PACKAGE_NAME, 'enable-auto');
      this.setAutoStatus(status.auto);
    }.bind(this));
    this.$.disableAuto.addEventListener('click', async function () {
      const status = await Editor.Message.request(PACKAGE_NAME, 'disable-auto');
      this.setAutoStatus(status.auto);
    }.bind(this));
    this.$.clear.addEventListener('click', function () { this.$.logs.innerHTML = ''; }.bind(this));
    this.addLog('info', '请选择文件或目录；构建后自动处理使用 Creator 3.x Builder Hook。');
    this.refreshStatus();
  },

  beforeClose: function () {},

  close: function () {
    if (this._onLog && typeof Editor.Message.removeBroadcastListener === 'function') {
      Editor.Message.removeBroadcastListener(LOG_CHANNEL, this._onLog);
    }
  }
});
