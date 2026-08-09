# Codex Quota Overlay for Windows

[简体中文](README.zh-CN.md) · [Download](https://github.com/cpys/codex-quota-overlay/releases/latest) · [Privacy](PRIVACY.md)

Codex Quota Overlay is a lightweight Windows companion for the Codex desktop app. It places the current quota, next reset time, and available reset credits beside the active conversation title, then disappears as soon as Codex is no longer the foreground app.

![Codex Quota Overlay](docs/images/preview.png)

The screenshot keeps the real Codex window and overlay placement visible; unrelated workspace, conversation, and account content has been intentionally blurred for privacy.

> [!IMPORTANT]
> This is an independent community project. It is not affiliated with, endorsed by, or supported by OpenAI.

## Features

- Shows the remaining Codex quota and next reset time on one line.
- Shows the number and expiration time of available reset credits when provided.
- Appears only while the Codex desktop window is active.
- Never takes focus and lets mouse input pass through to Codex.
- Supports per-monitor DPI, minimized windows, multiple displays, and a single running instance.
- Provides tray actions for refresh, startup, updates, privacy information, and exit.
- Reads quota through the documented local Codex App Server JSON-RPC interface; it does not scrape pixels, inspect browser cookies, or consume reset credits.
- Offers an optional, consent-based daily anonymous heartbeat. See [Privacy](PRIVACY.md).

## Requirements

- Windows 10 or Windows 11.
- The Codex desktop app installed and signed in with a ChatGPT-managed account.
- .NET Framework 4.8 (included with current supported Windows releases or available from Microsoft).

API-key-only and non-ChatGPT Codex configurations may not expose ChatGPT quota information.

## Install

1. Open the [latest GitHub release](https://github.com/cpys/codex-quota-overlay/releases/latest).
2. Download `CodexQuotaOverlay-Setup-<version>.exe`.
3. Run the installer and optionally enable startup or a desktop shortcut.
4. Launch Codex Quota Overlay. A `%` icon remains in the Windows notification area.

The unsigned installer may initially trigger a Windows SmartScreen warning. Always compare its SHA-256 hash with `SHA256SUMS.txt` from the same release. Code signing is planned when a suitable certificate is available.

A portable ZIP is also attached to each release. Extract it to a stable folder before enabling startup.

## Use

Keep Codex Quota Overlay running in the notification area. When Codex is the foreground app, the overlay is positioned beside the conversation title. Switching apps, minimizing Codex, or closing Codex hides it immediately.

Right-click the tray icon to:

- refresh quota now;
- enable or disable startup;
- control anonymous usage statistics when configured;
- open privacy information or the releases page;
- view the installed version or exit.

Logs containing only operational error summaries are stored at:

```text
%LOCALAPPDATA%\CodexQuotaOverlay\overlay.log
```

The log does not contain account tokens or complete App Server responses.

## Build from source

The dependency-free local build uses the .NET Framework compiler already present on Windows:

```powershell
.\build.ps1
```

The executable is written to `artifacts\bin`. Visual Studio 2022 users can also open `CodexQuotaOverlay.sln` and build the `net48` project.

To build the installer, install [Inno Setup 6](https://jrsoftware.org/isinfo.php), then run:

```powershell
.\package.ps1
```

To run the source-level and parser smoke tests:

```powershell
.\test.ps1
```

## Releases and versioning

The project uses semantic versioning. `VERSION`, assembly metadata, the installer, Git tags, and GitHub Releases must carry the same version. Pushing a tag such as `v0.1.0` runs the release workflow and publishes the installer, portable ZIP, and SHA-256 checksums.

## Compatibility note

Quota data is read from the documented [`account/rateLimits/read`](https://learn.chatgpt.com/docs/app-server#6-rate-limits-chatgpt) method. Codex evolves quickly, so releases test against the then-current desktop build and treat missing optional fields defensively. Please include the Codex and overlay versions when reporting a compatibility issue.

## Contributing

Bug reports and pull requests are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md), [SECURITY.md](SECURITY.md), and [CHANGELOG.md](CHANGELOG.md) first.

## License

[MIT](LICENSE)
