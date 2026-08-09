# Contributing

Thank you for helping improve Codex Quota Overlay.

## Before opening an issue

- Confirm the issue still occurs with the latest overlay and Codex desktop versions.
- Check existing issues.
- Include Windows, Codex, and overlay versions plus clear reproduction steps.
- Never post tokens, account details, complete App Server responses, conversation content, private file paths, or your telemetry installation UUID.

## Development

1. Fork and clone the repository on Windows.
2. Create a focused branch.
3. Run `./test.ps1` in PowerShell.
4. For installer changes, install Inno Setup 6 and run `./package.ps1`.
5. Keep English and Chinese user documentation aligned when behavior changes.

Prefer small, reviewable changes. New network access, persistence, startup behavior, or collected fields must include corresponding privacy and security documentation.

## Pull requests

- Explain the user-visible outcome and why the change is needed.
- List the validation performed.
- Add or update tests for parsing and compatibility changes.
- Update `CHANGELOG.md` under `Unreleased`.
- Do not commit build artifacts, local logs, credentials, production telemetry secrets, or private screenshots.
