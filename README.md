# Codex Quota Overlay (Windows / macOS)

[![CI](https://github.com/cpys/codex-quota-overlay/actions/workflows/ci.yml/badge.svg)](https://github.com/cpys/codex-quota-overlay/actions/workflows/ci.yml)
[![CodeQL](https://github.com/cpys/codex-quota-overlay/actions/workflows/codeql.yml/badge.svg)](https://github.com/cpys/codex-quota-overlay/actions/workflows/codeql.yml)
[![Release](https://img.shields.io/github/v/release/cpys/codex-quota-overlay?include_prereleases)](https://github.com/cpys/codex-quota-overlay/releases)
[![License](https://img.shields.io/github/license/cpys/codex-quota-overlay)](LICENSE)

[Website](https://cpys.github.io/codex-quota-overlay/) · [简体中文](README.zh-CN.md) · [Download](https://github.com/cpys/codex-quota-overlay/releases/tag/v0.3.0) · [Privacy](PRIVACY.md) · [Support](SUPPORT.md)

Codex Quota Overlay shows the remaining quota, next reset time, and available reset credits on one line beside the current Codex conversation title. It disappears immediately when Codex is no longer active.

![Codex Quota Overlay](docs/images/preview.png)

The screenshot preserves the real Codex window and overlay placement. Unrelated workspace, conversation, and account content is blurred, and the original screenshot is not committed.

> [!IMPORTANT]
> This is an independent community project. It is not affiliated with, endorsed by, or supported by OpenAI.

## Features

- Shows remaining quota and the next reset time on one line.
- Shows reset-credit count and expiration times when the service provides them.
- Appears only while Codex Desktop is active; switching apps, minimizing, or quitting Codex hides it.
- Never takes focus and lets pointer input pass through to Codex.
- Handles high-DPI displays, multiple monitors, single-instance execution, and login startup.
- Provides refresh, placement adjustment, CLI selection, short diagnostics, privacy, and exit actions from the Windows tray or macOS menu bar.
- Reads the documented local Codex App Server `account/rateLimits/read` method. It does not capture screenshots, read conversation titles or browser cookies, or consume reset credits.
- Includes an optional anonymous daily heartbeat that is unconfigured by default and runs only after explicit opt-in. See [Privacy](PRIVACY.md).

## Support matrix

| Platform                | Status                                                                        | Assets                  |
| ----------------------- | ----------------------------------------------------------------------------- | ----------------------- |
| Windows 10/11 x64       | Verified on a physical Windows 11 host                                        | Setup EXE, portable ZIP |
| macOS 12+ Apple Silicon | Automated build and dual-architecture checks; physical-Mac acceptance pending | arm64 DMG, ZIP          |
| macOS 12+ Intel         | Automated build and dual-architecture checks; physical-Mac acceptance pending | x64 DMG, ZIP            |

There is currently no official Codex Desktop app for Linux, so this project does not publish Linux packages. Linux users can use the official Codex CLI.

A ChatGPT-managed Codex sign-in is required for ChatGPT quota data. API-key-only and other configurations may not expose this information.

## Install

### Windows

1. Open [GitHub Releases](https://github.com/cpys/codex-quota-overlay/releases).
2. Download `CodexQuotaOverlay-Windows-Setup-<version>-x64.exe`.
3. Run the installer. It upgrades an existing 0.1.x installation in place.
4. Launch the app; its icon remains in the notification area.

The `CodexQuotaOverlay-Windows-Portable-<version>-x64.zip` asset can instead be extracted completely to a stable folder.

### macOS

1. Download the `arm64.dmg` for Apple Silicon or the `x64.dmg` for an Intel Mac.
2. Open the DMG and drag **Codex Quota Overlay** to Applications.
3. The current preview is not notarized with an Apple Developer ID. On first launch, right-click the app in Finder, select **Open**, and confirm.
4. The app appears only in the menu bar, not the Dock.

If it reports `E01`, choose **Codex CLI → Choose manually…** and select the local `codex` executable.

> The Windows and macOS preview assets are not commercially code-signed. Download only from this repository and verify each asset against the matching `SHA256SUMS-*.txt` file.

## Use and short diagnostics

Keep the app running in the tray or menu bar. If placement needs adjustment, move it vertically by 2 px or horizontally by 4 px from **Position adjustment**, or reset the defaults.

Use **Copy short diagnostics** when reporting a problem. The result is at most 200 characters, for example:

```text
E01 | Codex CLI not found
```

Diagnostics exclude usernames, hostnames, paths, accounts, IPs, installation IDs, conversation titles, tokens, and raw quota responses. Version 0.2.0 writes no operational log and offers no long diagnostic export. The last error exists only in memory until exit.

Common codes:

- `E01`: Codex CLI was not found; choose it manually from the menu.
- `E02`–`E05`: local App Server start, initialization, read, or exit failure.
- `W01` / `W02`: Codex is closed, inactive, or its window identity was not recognized.
- `M01`: macOS did not return a usable Codex application identity or window boundary.

## Privacy

Quota data remains in local memory and is used only to render the overlay. The window probe reads the frontmost application identity and bounds while deliberately leaving the title field empty. It does not request screen recording to capture content and never stores screenshots or conversations.

Settings are stored at:

- Windows: `%LOCALAPPDATA%\CodexQuotaOverlay\settings.json`
- macOS: `~/Library/Application Support/CodexQuotaOverlay/settings.json`

See [Privacy](PRIVACY.md) for every local and optional network field.

## Build from source

Node.js 24 and npm are required.

```powershell
npm ci
.\test.ps1
.\package.ps1
```

The Windows installer also requires Inno Setup 6. macOS DMG/ZIP assets must be produced on macOS:

```bash
npm ci
npm test
npm run dist:mac
```

Tag pushes run Windows and macOS GitHub Actions jobs, package x64/arm64 assets, generate SHA-256 checksums, and create a Release only after both platforms succeed.

The project website, CI, source hosting, and release downloads use GitHub Pages, Actions, and Releases. No custom domain or third-party cloud account is required. Optional telemetry remains unconfigured in public builds.

## Compatibility

Quota data comes from the documented [`account/rateLimits/read`](https://learn.chatgpt.com/docs/app-server#6-rate-limits-chatgpt) method. Codex changes quickly, and the parser treats optional fields defensively. Reports need only the overlay version, Codex version, and short diagnostic code—never account information or long logs.

## Contributing and license

Issues and pull requests are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md), [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md), [SECURITY.md](SECURITY.md), and [GOVERNANCE.md](GOVERNANCE.md) first. Project direction is published in [ROADMAP.md](ROADMAP.md), and release architecture is documented under [docs](docs/ARCHITECTURE.md). Licensed under the [MIT License](LICENSE).
