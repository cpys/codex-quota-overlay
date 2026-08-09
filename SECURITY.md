# Security Policy

## Supported versions

Security fixes are provided for the latest released version.

## Reporting a vulnerability

Do not publish exploitable details, tokens, account information, or private logs in a public issue. Contact the maintainer privately through the security-reporting option on the GitHub repository. Include the affected version, impact, reproduction steps, and any suggested mitigation.

## Security model

- The app runs as the current user and never requires administrator privileges.
- It launches the locally installed Codex App Server over stdio and does not expose a listening network port.
- It requests only rate-limit information and never calls the reset-credit consumption method.
- The overlay is non-activating and click-through.
- Native window helpers return only application identity and bounds; title fields are deliberately empty.
- Diagnostics are sanitized, capped at 200 characters, kept in memory, and never exported as long log files.
- Telemetry is optional, consent-based, HTTPS-only, and excludes Codex/account data.
- Pushes and pull requests are scanned for committed secrets across the complete Git history.
- Release checksums are published for Windows and macOS. Until commercial code signing and Apple notarization are available, users should verify SHA-256 hashes and download only from this repository.
