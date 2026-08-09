# Codex 额度悬浮层（Windows / macOS）

[English](README.md) · [下载](https://github.com/cpys/codex-quota-overlay/releases) · [隐私说明](PRIVACY.zh-CN.md)

Codex 额度悬浮层会在 Codex 当前会话标题旁，用一行显示剩余额度、下次重置时间和可用 Reset 卡；Codex 不在前台时，它会立即隐藏。

![Codex 额度悬浮层](docs/images/preview.png)

截图保留了真实的 Codex 窗口和悬浮位置；与演示无关的工作区、会话和账户内容已经模糊处理。仓库不包含原始截图。

> [!IMPORTANT]
> 这是独立的社区开源项目，与 OpenAI 没有隶属、授权或支持关系。

## 功能

- 在同一行显示剩余额度百分比和下次重置时间。
- 服务返回 Reset 卡时，显示可用数量及每张卡的到期时间。
- 只在 Codex Desktop 位于前台时显示；切换应用、最小化或退出后立即隐藏。
- 不抢焦点，鼠标可穿透悬浮层继续操作 Codex。
- 支持高 DPI、多显示器、单实例和登录时自动启动。
- Windows 通知区域和 macOS 菜单栏提供刷新、位置微调、CLI 选择、短诊断码、隐私说明和退出。
- 使用 Codex 官方公开的本地 App Server `account/rateLimits/read` 接口；不截图、不读取会话标题或浏览器 Cookie，也不会消耗 Reset 卡。
- 可选的匿名每日心跳默认未配置，只有用户主动开启后才会发送，详见[隐私说明](PRIVACY.zh-CN.md)。

## 支持范围

| 平台 | 支持状态 | 安装包 |
| --- | --- | --- |
| Windows 10/11 x64 | 已在 Windows 11 真机验证 | Setup EXE、便携 ZIP |
| macOS 12+ Apple Silicon | 自动构建和双架构验证；等待 Mac 真机验收 | arm64 DMG、ZIP |
| macOS 12+ Intel | 自动构建和双架构验证；等待 Mac 真机验收 | x64 DMG、ZIP |

Linux 没有当前官方 Codex Desktop 应用，因此本项目不发布 Linux 安装包。Linux 用户可直接使用官方 Codex CLI。

使用 ChatGPT 托管账户登录的 Codex 才有对应的 ChatGPT 额度。仅 API Key 或其他账户配置可能没有可读取的额度信息。

## 安装

### Windows

1. 打开 [GitHub Releases](https://github.com/cpys/codex-quota-overlay/releases)。
2. 下载 `CodexQuotaOverlay-Windows-Setup-<版本>-x64.exe`。
3. 运行安装器；它可以直接升级旧的 0.1.x 版本。
4. 启动后，通知区域会出现应用图标。

也可以下载 `CodexQuotaOverlay-Windows-Portable-<版本>-x64.zip`，完整解压到固定目录后运行。

### macOS

1. Apple Silicon（M1/M2/M3/M4 等）下载 `arm64.dmg`；Intel Mac 下载 `x64.dmg`。
2. 打开 DMG，把 **Codex Quota Overlay** 拖入 Applications。
3. 当前测试包尚未使用 Apple Developer ID 公证。第一次运行请在 Finder 中右键应用并选择“打开”，再确认一次。
4. 应用只显示在菜单栏，不显示 Dock 图标。

如果状态显示 `E01`，从菜单栏选择 **Codex CLI → 手动选择…**，然后选择本机 `codex` 可执行文件。

> Windows 和 macOS 测试包当前都没有商业代码签名。请只从本仓库下载，并用同一版本的 `SHA256SUMS-*.txt` 校验文件完整性。

## 使用与短诊断

保持应用在通知区域或菜单栏运行即可。悬浮条的位置不合适时，用 **位置微调** 每次上下移动 2 px、左右移动 4 px，也可以恢复默认位置。

遇到问题时选择 **复制简短诊断信息**。复制内容最多 200 个字符，例如：

```text
E01 | 找不到 Codex CLI
```

诊断信息不会包含用户名、主机名、文件路径、账户、IP、安装 ID、会话标题、令牌或原始额度响应。0.2.0 起不写运行日志，也不提供长诊断文件导出。退出应用后，内存中的最后错误会随进程清除。

常见代码：

- `E01`：找不到 Codex CLI，可在菜单中手动选择。
- `E02`–`E05`：本地 App Server 启动、初始化、读取或退出错误。
- `W01` / `W02`：Codex 未打开、未位于前台或窗口身份未识别。
- `M01`：macOS 没有返回可用的 Codex 应用身份或窗口边界。

## 隐私

额度响应只在本机内存中用于绘制。窗口探针只读取前台应用身份和窗口边界，并且主动把标题字段留空。应用不请求屏幕录制来截取内容，也不保存截图或会话信息。

设置文件位置：

- Windows：`%LOCALAPPDATA%\CodexQuotaOverlay\settings.json`
- macOS：`~/Library/Application Support/CodexQuotaOverlay/settings.json`

完整字段说明见[隐私说明](PRIVACY.zh-CN.md)。

## 从源码构建

需要 Node.js 24 和 npm。

```powershell
npm ci
.\test.ps1
.\package.ps1
```

Windows 安装包还需要 Inno Setup 6。macOS DMG/ZIP 必须在 macOS 上生成：

```bash
npm ci
npm test
npm run dist:mac
```

推送标签后，GitHub Actions 会分别在 Windows 与 macOS runner 上测试、打包 x64/arm64 产物、生成 SHA-256，并在两端都成功后才创建 Release。

## 兼容性

额度来自官方文档中的 [`account/rateLimits/read`](https://learn.chatgpt.com/docs/app-server#6-rate-limits-chatgpt)。Codex 更新较快，解析器会忽略缺失的可选字段。报告问题时只需提供悬浮层版本、Codex 版本和短诊断码，不要上传账户资料或长日志。

## 参与贡献与许可

欢迎提交 Issue 和 Pull Request。请先阅读 [CONTRIBUTING.md](CONTRIBUTING.md)、[SECURITY.md](SECURITY.md) 和 [CHANGELOG.md](CHANGELOG.md)。项目使用 [MIT License](LICENSE)。
