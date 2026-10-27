# Changelog

All notable changes are documented here. The project follows [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Fixed

- Preserve last successful quota with an explicit stale label after failures; bound quota reads with a 15-second timeout and two delayed retries.
- Record only allowlisted failure categories in size-bounded local logs without server messages or account data.

### Planned

- Code-signed Windows installer.
- Configured privacy-preserving telemetry endpoint after infrastructure review.

## [0.4.0] - 2026-08-23

### Added

- On-demand Quota Center with a responsive local dashboard for remaining quota, reset countdown, all reported limit windows, activity totals, and recent daily usage.
- Compact, balanced, and insight overlay modes with a visual remaining-quota meter.
- Current-cycle burn-rate, safe-pace, exhaustion-time, confidence, and pace-risk estimates.
- Session trend history plus explicit opt-in 7/14/30/90-day local persistence with bounded, compressed samples and one-click clearing.
- Optional once-per-cycle notifications for a 10/20/30% threshold or predicted early exhaustion.
- `--dashboard` startup/second-instance command and tray-icon double-click access.
- Dashboard interaction/responsive preview tooling and expanded Electron smoke coverage.

### Changed

- Parse all rate-limit buckets and primary/secondary windows instead of reducing the response to a single window.
- Read the documented `account/usage/read` aggregate activity fields when available; quota remains independently functional if usage is unavailable.
- Extend packaged-application self-tests to load both the overlay and the isolated Quota Center preload/renderer path.
- Publish Windows installer and portable assets as a stable release while retaining automated macOS compatibility validation without distributing macOS packages.

### Privacy

- Keep history session-only and alerts disabled by default.
- When history persistence is enabled, write only normalized percentages, timestamps, reset/window metadata, and a sanitized limit identifier; never persist activity/token summaries or raw responses.

### Security

- Added a dedicated sandboxed dashboard preload with sender/frame validation and an allowlisted settings patch surface.

## [0.3.0] - 2026-08-10

### Added

- GitHub Pages product site with English/Chinese copy, responsive platform downloads, and a privacy-redacted real product preview.
- Community governance, support, conduct, maintainers, roadmap, release, signing, troubleshooting, and third-party notice documentation.
- ESLint, Prettier, JavaScript type checking, enforced core coverage thresholds, and packaged-application self-tests.
- CodeQL, dependency review, OpenSSF Scorecard, CycloneDX SBOM, and release artifact attestations.

### Changed

- Standardized package/repository metadata, issue routing, ownership, CI permissions, and platform-specific release presentation.
- Upgraded the release process so published binaries originate only from tested tag workflows.

### Security

- Enabled Chromium renderer sandboxing, a restrictive Content Security Policy, navigation/new-window denial, and IPC sender validation.
- Enabled Electron ASAR integrity validation and restrictive production fuses.

## [0.2.0] - 2026-08-09

### Added

- Shared Electron application for Windows and macOS with matching one-line UI.
- Native privacy-preserving foreground-window helpers that omit conversation titles.
- Apple Silicon and Intel macOS DMG/ZIP build targets.
- Manual Codex CLI selection and automatic discovery on both platforms.
- Position calibration and copyable diagnostics capped at 200 sanitized characters.
- Windows/macOS CI, universal macOS helper validation, dual-platform release gating, and per-platform checksums.

### Changed

- Migrated the production Windows app from .NET Framework to the shared Electron core.
- Preserved the Windows Inno Setup AppId so 0.1.x installations upgrade in place.
- Replaced persistent operational logs with in-memory short diagnostic codes.
- Scoped releases to Windows and macOS because there is no official Linux Codex Desktop app.

## [0.1.0] - 2026-08-09

### Added

- Foreground-only, click-through quota overlay for the Codex Windows desktop app.
- Remaining quota, next reset time, reset-credit count, and credit expiration times.
- Per-monitor DPI positioning and minimized/cloaked-window handling.
- Notification-area menu with refresh, startup, updates, privacy, version, and exit actions.
- Graceful local shutdown during upgrades and uninstallation.
- Optional consent-based daily anonymous heartbeat client; disabled until an HTTPS endpoint is configured.
- Inno Setup installer, portable archive, SHA-256 checksums, CI, and tag-based GitHub Releases.
- English and Simplified Chinese documentation.

[Unreleased]: https://github.com/cpys/codex-quota-overlay/compare/v0.4.0...HEAD
[0.4.0]: https://github.com/cpys/codex-quota-overlay/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/cpys/codex-quota-overlay/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/cpys/codex-quota-overlay/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/cpys/codex-quota-overlay/releases/tag/v0.1.0
