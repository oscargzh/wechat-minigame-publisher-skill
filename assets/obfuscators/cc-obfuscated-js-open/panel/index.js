'use strict';

const Fs = require('fs');

const PACKAGE_NAME = 'cc-obfuscated-js-open';

Editor.Panel.extend({
  style: `
    :host { box-sizing:border-box; height:100%; padding:16px; overflow:auto; color:#d1d5db; background:#171b22; font-family:Arial,"Microsoft YaHei",sans-serif; }
    * { box-sizing:border-box; }
    .header { display:flex; align-items:center; justify-content:space-between; border-bottom:1px solid #343b47; padding-bottom:12px; margin-bottom:16px; }
    h1 { margin:0; color:#38bdf8; font-size:20px; }
    .sub { color:#8b97a8; font-size:12px; margin-top:4px; }
    .card { background:#222833; border:1px solid #343b47; border-radius:8px; padding:14px; margin-bottom:14px; }
    .label { color:#e5e7eb; font-size:14px; font-weight:600; margin-bottom:8px; }
    .path-row { display:grid; grid-template-columns:1fr auto auto; gap:8px; align-items:center; }
    ui-input { width:100%; }
    ui-button { min-height:32px; }
    .actions { display:flex; gap:10px; align-items:center; flex-wrap:wrap; }
    .primary { min-width:160px; min-height:42px; }
    .warning { color:#fbbf24; font-size:12px; line-height:1.6; margin-top:10px; }
    .stats { display:grid; grid-template-columns:repeat(4,1fr); gap:8px; }
    .stat { background:#171b22; border-radius:6px; padding:10px; text-align:center; }
    .stat-value { color:#a7f3d0; font-size:18px; font-weight:700; }
    .stat-name { color:#8390a3; font-size:11px; margin-top:3px; }
    .backup { color:#9ca3af; font-family:Consolas,monospace; font-size:11px; word-break:break-all; margin-top:10px; }
    .log-card { min-height:230px; display:flex; flex-direction:column; }
    .log-head { display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; }
    .logs { flex:1; min-height:190px; max-height:320px; overflow:auto; background:#11151b; border-radius:6px; padding:10px; font:12px/1.55 Consolas,"Microsoft YaHei",monospace; }
    .log { margin-bottom:4px; white-space:pre-wrap; word-break:break-word; }
    .log.info { color:#cbd5e1; } .log.success { color:#86efac; } .log.warn { color:#fde68a; } .log.error { color:#fca5a5; }
    .time { color:#64748b; margin-right:7px; }
    .hidden { display:none; }
    @media (max-width:600px) { .path-row { grid-template-columns:1fr 1fr; } .path-row ui-input { grid-column:1 / -1; } .stats { grid-template-columns:repeat(2,1fr); } }
  `,

  template: `
    <div class="header">
      <div>
        <h1>Open JS Obfuscator</h1>
        <div class="sub">开源、跨平台、无设备绑定 · javascript-obfuscator 4.1.1</div>
      </div>
      <ui-button id="openConfig">打开配置</ui-button>
    </div>

    <div class="card">
      <div class="label">选择要混淆的 JS 文件或目录</div>
      <div class="path-row">
        <ui-input id="targetPath" placeholder="可直接粘贴完整路径"></ui-input>
        <ui-button id="pickFile">选择文件</ui-button>
        <ui-button id="pickFolder">选择目录</ui-button>
      </div>
      <div class="actions" style="margin-top:12px">
        <ui-button id="start" class="blue primary">开始混淆</ui-button>
        <span id="running" class="hidden">正在处理，请稍候…</span>
      </div>
      <div class="warning">默认会在目标旁创建备份。自动构建模式可通过顶部“扩展”菜单开启或关闭。</div>
    </div>

    <div id="statsCard" class="card hidden">
      <div class="stats">
        <div class="stat"><div id="processed" class="stat-value">0</div><div class="stat-name">已处理</div></div>
        <div class="stat"><div id="skipped" class="stat-value">0</div><div class="stat-name">已跳过</div></div>
        <div class="stat"><div id="failed" class="stat-value">0</div><div class="stat-name">失败</div></div>
        <div class="stat"><div id="elapsed" class="stat-value">0ms</div><div class="stat-name">耗时</div></div>
      </div>
      <div id="backup" class="backup"></div>
    </div>

    <div class="card log-card">
      <div class="log-head"><div class="label" style="margin:0">运行日志</div><ui-button id="clear">清空</ui-button></div>
      <div id="logs" class="logs"></div>
    </div>
  `,

  $: {
    targetPath: '#targetPath',
    pickFile: '#pickFile',
    pickFolder: '#pickFolder',
    start: '#start',
    running: '#running',
    openConfig: '#openConfig',
    statsCard: '#statsCard',
    processed: '#processed',
    skipped: '#skipped',
    failed: '#failed',
    elapsed: '#elapsed',
    backup: '#backup',
    logs: '#logs',
    clear: '#clear'
  },

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
    this.$logs.appendChild(line);
    this.$logs.scrollTop = this.$logs.scrollHeight;
  },

  setRunning: function (running) {
    this.running = running;
    if (running) {
      this.$start.setAttribute('disabled', 'true');
      this.$running.classList.remove('hidden');
    } else {
      this.$start.removeAttribute('disabled');
      this.$running.classList.add('hidden');
    }
  },

  resolveSelection: function (selection) {
    if (!selection) return '';
    if (Array.isArray(selection)) return selection[0] || '';
    if (Array.isArray(selection.filePaths)) return selection.filePaths[0] || '';
    return typeof selection === 'string' ? selection : '';
  },

  pick: function (directory) {
    const self = this;
    try {
      const options = {
        title: directory ? '选择需要混淆的目录' : '选择需要混淆的 JavaScript 文件',
        properties: directory ? ['openDirectory'] : ['openFile'],
        filters: directory ? undefined : [{ name: 'JavaScript', extensions: ['js'] }]
      };
      const selection = Editor.Dialog.openFile(options);
      if (selection && typeof selection.then === 'function') {
        selection.then(function (value) {
          const selected = self.resolveSelection(value);
          if (selected) self.$targetPath.value = selected;
        });
      } else {
        const selected = this.resolveSelection(selection);
        if (selected) this.$targetPath.value = selected;
      }
    } catch (error) {
      this.addLog('error', '打开选择框失败：' + error.message + '，可以直接粘贴路径。');
    }
  },

  start: function () {
    if (this.running) return;
    const targetPath = String(this.$targetPath.value || '').trim();
    if (!targetPath) {
      this.addLog('error', '请先选择 JS 文件或目录');
      return;
    }
    if (!Fs.existsSync(targetPath)) {
      this.addLog('error', '目标路径不存在：' + targetPath);
      return;
    }
    this.requestId = 'manual-' + Date.now().toString(36);
    this.setRunning(true);
    this.$statsCard.classList.add('hidden');
    this.addLog('info', '任务已加入队列：' + targetPath);
    Editor.Ipc.sendToAll(PACKAGE_NAME + ':run_manual', {
      path: targetPath,
      requestId: this.requestId
    });
  },

  showSummary: function (summary) {
    this.$processed.textContent = String(summary.processed || 0);
    this.$skipped.textContent = String(summary.skipped || 0);
    this.$failed.textContent = String(summary.failed || 0);
    this.$elapsed.textContent = String(summary.elapsedMs || 0) + 'ms';
    this.$backup.textContent = summary.backupRoot ? '备份：' + summary.backupRoot : '本次未创建备份';
    this.$statsCard.classList.remove('hidden');
  },

  ready: function () {
    const self = this;
    this.running = false;
    this.requestId = '';
    this.$pickFile.addEventListener('confirm', function () { self.pick(false); });
    this.$pickFolder.addEventListener('confirm', function () { self.pick(true); });
    this.$start.addEventListener('confirm', function () { self.start(); });
    this.$openConfig.addEventListener('confirm', function () { Editor.Ipc.sendToAll(PACKAGE_NAME + ':open_config'); });
    this.$clear.addEventListener('confirm', function () { self.$logs.innerHTML = ''; });
    this.addLog('info', '请选择文件或目录。配置位于插件的 runtime_Ts 目录。');
  },

  messages: {
    'cc-obfuscated-js-open:log': function (event, payload) {
      this.addLog(payload.level, payload.message);
    },
    'cc-obfuscated-js-open:done': function (event, payload) {
      if (this.requestId && payload.requestId !== this.requestId) return;
      this.setRunning(false);
      this.showSummary(payload.summary || {});
    },
    'cc-obfuscated-js-open:failed': function (event, payload) {
      if (this.requestId && payload.requestId !== this.requestId) return;
      this.setRunning(false);
      this.addLog('error', payload.message || '任务失败');
    }
  }
});
