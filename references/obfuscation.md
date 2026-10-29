# Cocos Creator 构建后 JavaScript 混淆

本 Skill 自带两套基于 `javascript-obfuscator 4.1.1` 的 MIT 许可开源扩展：

- Creator 2.x：`assets/obfuscators/cc-obfuscated-js-open`
- Creator 3.x：`assets/obfuscators/cc-obfuscated-js-open-3x`

它们用于常规构建产物保护，不得用于掩盖无权发布的代码或规避平台审核。

## 安装

先确认 Creator 主版本，然后执行：

```powershell
& '<skill>/scripts/install-obfuscator.ps1' -ProjectPath '<project>' -CreatorMajor 2
```

或：

```powershell
& '<skill>/scripts/install-obfuscator.ps1' -ProjectPath '<project>' -CreatorMajor 3
```

脚本会复制完整扩展目录、补装缺失依赖、写入本 Skill 的默认混淆强度并运行 `npm test`。

安装位置：

- Creator 2.x：`<project>/packages/cc-obfuscated-js-open`
- Creator 3.x：`<project>/extensions/cc-obfuscated-js-open-3x`

不要只复制 `main.js`，也不要把 2.x 和 3.x 扩展混用。

## 自动构建顺序

1. 在 Cocos 构建前安装扩展并重启或重新加载编辑器，使构建钩子生效。
2. 保持 `runtime_Ts/cc_obfuscated_js.json` 中 `auto: true`。
3. Creator 2.x 通过构建事件处理 `options.dest`。
4. Creator 3.x 默认在 `onAfterBuild` 处理最终目录。仅当原生平台会提前把 JavaScript 转为 JSC 时，才把 `构建设置.hook` 改成 `onBeforeCompressSettings`。
5. 混淆成功后再在微信开发者工具中打开或刷新构建目录。
6. 以混淆后的产物重新计算包体，并完成运行回归后再上传。

## 默认混淆强度

首次使用保持：

- `createBackup: true`
- `renameGlobals: false`
- `renameProperties: false`
- `selfDefending: false`
- `controlFlowFlattening: true`
- `controlFlowFlatteningThreshold: 0.25`
- `deadCodeInjection: true`
- `deadCodeInjectionThreshold: 0.10`

控制流扁平化和死代码注入会增加构建时间与包体，并可能暴露原本不明显的兼容问题。不要混淆 Cocos 引擎、启动文件、适配器、开放数据域入口、第三方 SDK 或配置中已排除的文件。混淆后必须执行启动、场景切换、序列化组件、广告、分享和资源加载回归；任一失败时禁止上传，先恢复备份并定位具体文件，必要时对该文件增加排除规则。

## 构建门禁

每次构建必须记录：处理数量、跳过数量、失败数量、耗时和备份目录。失败数不为 0、没有找到预期业务 JS、启动失败或关键流程异常时，不得上传；应恢复备份或重新构建后修复配置。

备份目录不得包含在微信待上传目录中。混淆会改变文件大小，因此 4 MB 主包和 30 MB 总包检查必须放在混淆之后。
