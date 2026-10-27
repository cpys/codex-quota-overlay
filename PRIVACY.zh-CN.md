# 隐私说明

最后更新：2026-08-23

Codex 额度悬浮层以本地运行为首要原则。读取额度、识别前台 Codex 和定位悬浮层都在用户自己的 Windows 或 macOS 电脑上完成。

## Codex 与窗口数据

应用启动本机 `codex app-server`：通过 `account/rateLimits/read` 获取额度窗口，通过 `account/usage/read` 填充可选活跃度面板。额度百分比、重置时间、Reset 卡元数据、活跃度汇总和每日 Token 总量都不会发送给维护者。

额度采样默认只存在于进程内存。只有用户明确开启本地历史后，应用才会在 `quota-history.json` 中保存采样时间、规范化已用百分比、重置时间、窗口时长和经过清洗的限制标识。活跃度汇总、每日 Token 总量、原始 App Server 响应、账户标识和 Reset 卡详情都不会落盘。可选保留期为 7、14、30 或 90 天，压缩后的采样硬上限为 2,000 条。

窗口探针只使用前台应用名称、进程或 Bundle 身份以及窗口边界。代码主动把标题字段设为空，不读取或保存会话标题。应用不会收集或上传 ChatGPT 账户资料、访问令牌、API Key、会话内容、提示词、回复、源代码、截图或浏览器 Cookie。

## 短诊断

托盘或菜单栏中的“复制简短诊断信息”只复制一个错误码和短描述，最长 200 个字符。清洗器会移除本地路径和长标识。诊断不包含用户名、主机名、账户、IP、安装 UUID、窗口标题、令牌、额度值或原始 App Server 响应。

现在会将额度服务失败记录到与 `settings.json` 同目录的本地 `quota-errors.jsonl`。每条仅包含 UTC 时间、固定 E01–E05 错误码及白名单类别（timeout、transport、rpc-error、invalid-response 或 unspecified）。不序列化错误原文、stderr、额度数值、账户标识、路径、URL 或凭据。文件达到 64 KiB 时轮转，仅保留一个 `.1` 旧文件（合计约 128 KiB）。这些文件不会上传，可在退出后删除。0.1.x 的 `overlay.log` 仍不使用。

## 本地设置

- Windows：`%LOCALAPPDATA%\CodexQuotaOverlay\settings.json`
- macOS：`~/Library/Application Support/CodexQuotaOverlay/settings.json`

设置可能包含：悬浮位置偏移、悬浮条信息密度、本地历史开关与保留期、提醒开关与阈值、统计开关、随机安装 UUID、上次成功心跳时间，以及用户手动选择的 Codex CLI 路径。所有字段都保留在本机；只有下一节明确列出的心跳字段可能发送。卸载不会自动删除设置文件。

可选历史与设置文件位于同一目录：

- Windows：`%LOCALAPPDATA%\CodexQuotaOverlay\quota-history.json`
- macOS：`~/Library/Application Support/CodexQuotaOverlay/quota-history.json`

历史持久化和智能提醒默认关闭。关闭持久化会停止后续写盘，但不会擅自删除已有文件；Quota Center 中的“清空历史”会同时移除本次运行的采样和历史文件。卸载不会自动删除这两个本地文件。

## 可选匿名使用统计

公开源码和当前发布版默认没有统计服务地址，因此不会发送心跳。只有构建者配置 HTTPS 地址且用户在菜单中主动开启时，应用才会每 24 小时最多发送一次 `daily_active`：

- 随机安装 UUID；
- 悬浮层版本；
- 平台值 `windows` 或 `macos`；
- 操作系统版本；
- 界面语言；
- 事件时间和结构版本。

负载不包含额度、Reset 卡、Codex 账户或 CLI 路径，也不主动包含 IP。与任何 HTTPS 请求一样，网络和托管服务会为传输处理来源 IP，并可能暂时写入安全日志。统计数据库不得把 IP 当作用户标识或复制进统计记录。参考后端的心跳记录最多保留 90 天。

删除设置文件会在下次需要心跳时创建新的随机 UUID。关闭统计后，应用会停止心跳。

GitHub Pages 项目主页不包含统计脚本、Cookie、表单或第三方追踪像素。GitHub 作为托管方，可能会按照其条款处理标准 Web 请求元数据。

## 变更和问题

重要隐私变更会记录在更新日志和本文档中。提交 Issue 时只提供版本和短诊断码，不要公开账户信息、令牌、本地路径或设置文件。
