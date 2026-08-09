# Changelog

All notable changes are documented here. The project follows [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Planned

- Code-signed Windows installer.
- Configured privacy-preserving telemetry endpoint after infrastructure review.

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

[Unreleased]: https://github.com/cpys/codex-quota-overlay/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/cpys/codex-quota-overlay/releases/tag/v0.1.0
