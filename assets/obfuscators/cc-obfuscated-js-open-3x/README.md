# cc-obfuscated-js-open-3x

这是一个面向 Cocos Creator 3.x 扩展 API 的开源 JavaScript 混淆插件。它参考同目录
`Cocos Creator Code Obfuscation` 的扩展接入结构重新实现，但不会使用或绕过原插件的
校验码、硬件绑定、许可证逻辑及闭源可执行文件。

混淆引擎为 `javascript-obfuscator 4.1.1`，整个处理流程由 Node.js 完成，可在 Windows、
macOS 和 Linux 上运行。

## 功能

- 使用 Creator 3.x 的 `contributions.messages`、`Editor.Panel.define` 和 Builder Hook。
- 构建完成后自动递归混淆发布目录中的 `.js` 文件。
- 面板内手动处理单个 `.js` 文件或整个目录。
- 支持备份、排除规则、源码映射、字符串数组、控制流扁平化等参数。
- 混淆任务在独立 Node 子进程运行，避免阻塞编辑器主进程。
- 无设备码、无许可证、无外部 EXE、无联网校验。

## 安装

将整个目录复制到 Creator 3.x 项目的 `extensions` 下：

```text
你的项目/
└─ extensions/
   └─ cc-obfuscated-js-open-3x/
```

然后安装依赖并重启编辑器：

```powershell
cd 你的项目\extensions\cc-obfuscated-js-open-3x
npm install
```

插件结构按参考包使用的 Creator 3.x package v2 接口实现，目标为 Creator 3.6–3.8 系列。

## 使用

1. 在 Creator 顶部“扩展”菜单打开“开源 JS 代码混淆 3.x”。
2. 可选择单个 `.js` 文件或目录手动执行。
3. 菜单或面板均可开启/关闭构建后自动混淆。
4. 参数文件为 `runtime_Ts/cc_obfuscated_js.json`。

默认会创建备份，路径位于目标旁的 `js-obfuscator-backups`。稳定使用于构建目录后，
可把 `基本设置.createBackup` 改为 `false`，减少磁盘占用。

## 构建钩子

默认在 `onAfterBuild` 执行。若某个原生平台会在构建结束前把 JavaScript 转成 JSC，
可将下面的配置改为 `onBeforeCompressSettings`：

```json
"构建设置": {
  "hook": "onBeforeCompressSettings",
  "failBuildOnError": true
}
```

同一次构建只会在选中的钩子执行，不会重复混淆。

## 迁移旧配置

中文配置分组与参考插件相近，但 `许可证` 字段完全不读取，也不需要迁移。建议优先保留
本项目默认的 `过滤设置`，确认发布包可以正常启动后，再逐项调整强度。

以下选项默认关闭，因为它们较容易破坏 Cocos 的反射、序列化或第三方 SDK：

- `renameGlobals`
- `renameProperties`
- `selfDefending`

控制流扁平化和死代码注入默认以较低阈值开启，构建后必须完成运行回归和包体检查。

## 测试

```powershell
npm test
```

测试包含核心混淆、子进程、3.x 主进程消息方法、Builder Hook 和扩展清单校验。
