# Contributing

Thank you for helping improve Codex Quota Overlay.

## Before opening an issue

- Confirm the issue still occurs with the latest overlay and Codex desktop versions.
- Check existing issues.
- Include the operating system, Codex version, overlay version, and short diagnostic code plus clear reproduction steps.
- Never post tokens, account details, complete App Server responses, conversation content, private file paths, settings files, or telemetry installation UUIDs.

## Development

1. Fork and clone the repository on Windows or macOS.
2. Create a focused branch.
3. Use Node.js 24 and npm 11, then run `npm ci` and `npm run verify`.
4. On Windows, run `./test.ps1`; installer changes also require Inno Setup 6 and `./package.ps1`.
5. On macOS, run `npm run native` and `npm run dist:mac` for packaging changes.
6. Keep English and Chinese user documentation aligned when behavior changes.

Prefer small, reviewable changes. New network access, persistence, startup behavior, or collected fields must include corresponding privacy and security documentation.

## Pull requests

- Explain the user-visible outcome and why the change is needed.
- List the validation performed.
- Add or update tests for parsing and compatibility changes.
- Update `CHANGELOG.md` under `Unreleased`.
- Do not commit build artifacts, credentials, production telemetry secrets, or private screenshots.
- Follow [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) and the decisions in [GOVERNANCE.md](GOVERNANCE.md).
