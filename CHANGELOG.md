# Changelog

All notable changes are documented here. The project follows [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Planned

- Code-signed Windows installer.
- Configured privacy-preserving telemetry endpoint after infrastructure review.

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

[Unreleased]: https://github.com/cpys/codex-quota-overlay/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/cpys/codex-quota-overlay/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/cpys/codex-quota-overlay/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/cpys/codex-quota-overlay/releases/tag/v0.1.0
