# cc-obfuscated-js-open

一个面向 Cocos Creator 2.x 扩展 API 的开源 JavaScript 混淆插件。它使用
[`javascript-obfuscator`](https://github.com/javascript-obfuscator/javascript-obfuscator)
4.1.1，不包含设备许可证、闭源可执行文件或联网授权逻辑。

## 功能

- 构建完成后自动递归混淆输出目录中的 `.js` 文件。
- 在面板中手动选择单个 JS 文件或一个目录。
- 支持 Windows、macOS 和 Linux；处理逻辑使用 Node.js，不调用平台专属 EXE。
- 支持备份、排除目录/文件、源码映射、字符串数组、控制流扁平化等配置。
- 混淆工作运行在独立 Node 子进程中，避免长任务阻塞编辑器主进程。
- 构建钩子的回调在成功或失败时都会释放，避免构建面板卡住。

## 安装

当前目录已经位于项目的 `packages/cc-obfuscated-js-open` 中。安装依赖后，重启
Cocos Creator：

```powershell
cd D:\games\混淆\packages\cc-obfuscated-js-open
npm install
```

插件要求宿主 Node.js `>=12.22.0`。它与原闭源工具使用的
`javascript-obfuscator 4.1.1` 保持一致。

## 使用

1. 从 Cocos Creator 的“扩展”菜单打开“开源 JS 代码混淆”。
2. 手动选择一个 `.js` 文件或目录，然后点击“开始混淆”。
3. “开启/关闭构建后自动混淆”可在扩展菜单切换。
4. 参数位于 `runtime_Ts/cc_obfuscated_js.json`。

默认 `createBackup` 为 `true`，备份会写入目标旁边的
`js-obfuscator-backups/`。确认流程稳定后，可以关闭备份以减少构建产物占用。

## 与原配置的兼容性

配置保留了原来的中文分组结构：

- `基本设置`
- `保护设置`
- `混淆强度`
- `字符串处理`
- `标识符处理`
- `源码映射`
- `过滤设置`
- `特殊功能`

原配置中的 `许可证` 字段不会读取，也不需要复制。若直接迁移旧配置，建议先保留
本插件生成的 `过滤设置`，避免误混淆 Cocos 引擎和启动文件。

## 注意事项

- 混淆是原地写入操作。手动处理源码时请保持备份开启并纳入版本控制。
- 默认以低阈值开启控制流扁平化和死代码注入；`renameGlobals`、`renameProperties`、
  `selfDefending` 仍保持关闭，避免破坏 Cocos 反射、序列化、组件名或第三方 SDK。
- 默认排除了 `game.js`、`settings.js`、引擎、适配器和 polyfills 等启动文件。
- 自动构建任务会等待混淆完成后才继续构建回调。

## 测试

```powershell
npm test
```
