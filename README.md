# Codex Quota Overlay (Windows)

[![CI](https://github.com/cpys/codex-quota-overlay/actions/workflows/ci.yml/badge.svg)](https://github.com/cpys/codex-quota-overlay/actions/workflows/ci.yml)
[![CodeQL](https://github.com/cpys/codex-quota-overlay/actions/workflows/codeql.yml/badge.svg)](https://github.com/cpys/codex-quota-overlay/actions/workflows/codeql.yml)
[![Release](https://img.shields.io/github/v/release/cpys/codex-quota-overlay?include_prereleases)](https://github.com/cpys/codex-quota-overlay/releases)
[![License](https://img.shields.io/github/license/cpys/codex-quota-overlay)](LICENSE)

[Website](https://cpys.github.io/codex-quota-overlay/) · [简体中文](README.zh-CN.md) · [Download](https://github.com/cpys/codex-quota-overlay/releases/tag/v0.4.0) · [Privacy](PRIVACY.md) · [Support](SUPPORT.md)

Codex Quota Overlay keeps the current limit beside the Codex conversation title, then turns the same local data into a practical Quota Center with pace, forecast, history, and activity views. The click-through overlay disappears immediately when Codex is no longer active; the dashboard opens only when requested.

![Codex Quota Overlay](docs/images/preview.png)

The screenshot preserves the real Codex window and overlay placement. Unrelated workspace, conversation, and account content is blurred, and the original screenshot is not committed.

> [!IMPORTANT]
> This is an independent community project. It is not affiliated with, endorsed by, or supported by OpenAI.

## Features

- Offers compact, balanced, and insight overlay modes with remaining quota, reset countdown, and optional burn-rate context.
- Opens a local Quota Center from the tray/menu bar or by double-clicking its icon.
- Shows every reported rate-limit bucket and its primary/secondary windows instead of silently collapsing the response to one limit.
- Estimates recent burn rate, a safe pace through the next reset, possible exhaustion time, and forecast confidence from current-cycle samples.
- Summarizes read-only Codex activity totals and recent daily usage when the local App Server provides them.
- Keeps trend samples in memory by default. Optional 7/14/30/90-day persistence stores only normalized quota percentages and timestamps and can be cleared from the dashboard.
- Can notify once per limit cycle when quota crosses 10/20/30% or the recent pace predicts early exhaustion. Alerts are off by default.
- Shows reset-credit count and expiration times when the service provides them.
- Appears only while Codex Desktop is active; switching apps, minimizing, or quitting Codex hides it.
- Never takes focus and lets pointer input pass through to Codex.
- Handles high-DPI displays, multiple monitors, single-instance execution, and login startup.
- Provides refresh, placement adjustment, CLI selection, short diagnostics, privacy, and exit actions from the Windows tray or macOS menu bar.
- Reads the documented local Codex App Server `account/rateLimits/read` and `account/usage/read` methods. It does not capture screenshots, read conversation titles or browser cookies, or consume reset credits.
- Includes an optional anonymous daily heartbeat that is unconfigured by default and runs only after explicit opt-in. See [Privacy](PRIVACY.md).

## Support matrix

| Platform                | Status                                                                                      | Distribution            |
| ----------------------- | ------------------------------------------------------------------------------------------- | ----------------------- |
| Windows 10/11 x64       | Verified on a physical Windows 11 host, packaged, installed, executed, and uninstalled      | Setup EXE, portable ZIP |
| macOS 12+ Apple Silicon | Built and package-self-tested on a GitHub-hosted macOS 14 environment; not a release target | Source/CI validation    |
| macOS 12+ Intel         | Universal helper and x64 package structure validated; not a release target                  | Source/CI validation    |

Version 0.4.0 is distributed for Windows only. macOS compatibility remains in the source tree and automated validation, but no macOS installer is attached to the release.

There is currently no official Codex Desktop app for Linux, so this project does not publish Linux packages. Linux users can use the official Codex CLI.

A ChatGPT-managed Codex sign-in is required for ChatGPT quota data. API-key-only and other configurations may not expose this information.

## Install

### Windows

1. Open [GitHub Releases](https://github.com/cpys/codex-quota-overlay/releases).
2. Download `CodexQuotaOverlay-Windows-Setup-<version>-x64.exe`.
3. Run the installer. It upgrades an existing 0.1.x installation in place.
4. Launch the app; its icon remains in the notification area.

The `CodexQuotaOverlay-Windows-Portable-<version>-x64.zip` asset can instead be extracted completely to a stable folder.

### macOS compatibility

No macOS binary is distributed in version 0.4.0. Maintainers still compile the universal native helper, build both architectures, verify DMG structure, and execute the host-architecture packaged self-test in GitHub's macOS environment. Developers can use the source-build instructions below.

> The Windows package is not commercially code-signed. Download only from this repository and verify it against `SHA256SUMS-Windows-0.4.0.txt`.

## Use and short diagnostics

Keep the app running in the tray or menu bar. Choose **Open Quota Center…** or double-click the icon for the full dashboard. The dashboard lets you change overlay density, alert thresholds, and optional local-history retention; changes are saved immediately. You can also start it directly with `CodexQuotaOverlay --dashboard`.

Choose **Overlay theme → Dark / Light** from the tray menu or Quota Center. The preference is saved locally and applies immediately, including while waiting for quota. Dark remains the default. This changes only the overlay; it does not automatically follow Codex or the system theme.

If overlay placement needs adjustment, move it vertically by 2 px or horizontally by 4 px from **Position adjustment**, or reset the defaults.

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

Quota and activity data remain local. The window probe reads the frontmost application identity and bounds while deliberately leaving the title field empty. It does not request screen recording to capture content and never stores screenshots or conversations.

Quota history is session-only by default. If persistence is explicitly enabled, the app writes only normalized percentage samples, timestamps, reset times, window duration, and a sanitized limit identifier to `quota-history.json`; activity/token summaries are never written to that file.

Settings are stored at:

- Windows: `%LOCALAPPDATA%\CodexQuotaOverlay\settings.json`
- macOS: `~/Library/Application Support/CodexQuotaOverlay/settings.json`

Optional history is stored beside the settings file as `quota-history.json` and can be cleared in Quota Center.

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

Tag pushes run Windows release packaging plus macOS compatibility validation. The Release is created only after both jobs succeed, but it contains Windows assets only.

The project website, CI, source hosting, and release downloads use GitHub Pages, Actions, and Releases. No custom domain or third-party cloud account is required. Optional telemetry remains unconfigured in public builds.

## Compatibility

Quota data comes from the documented [`account/rateLimits/read`](https://learn.chatgpt.com/docs/app-server#rate-limits-chatgpt) method, while the optional activity panel uses `account/usage/read`. Codex changes quickly, so both parsers treat missing and additional fields defensively. Reports need only the overlay version, Codex version, and short diagnostic code—never account information or long logs.

## Contributing and license

Issues and pull requests are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md), [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md), [SECURITY.md](SECURITY.md), and [GOVERNANCE.md](GOVERNANCE.md) first. Project direction is published in [ROADMAP.md](ROADMAP.md), and release architecture is documented under [docs](docs/ARCHITECTURE.md). Licensed under the [MIT License](LICENSE).
