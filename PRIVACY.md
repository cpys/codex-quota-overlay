# Privacy

Last updated: 2026-08-10

Codex Quota Overlay is local-first. Quota reads, foreground-Codex detection, and overlay placement happen on the user's Windows or macOS computer.

## Codex and window data

The app starts the local `codex app-server` and calls only `account/rateLimits/read`. Quota percentage, reset time, and reset-credit metadata remain in memory solely for rendering and are not sent to the maintainer.

The window probe uses only the frontmost app name, process or bundle identity, and window bounds. The implementation deliberately leaves the title field empty and does not read or store conversation titles. It does not collect or upload ChatGPT account details, access tokens, API keys, conversation content, prompts, responses, source code, screenshots, or browser cookies.

## Short diagnostics

**Copy short diagnostics** copies one error code and short description, capped at 200 characters. The sanitizer removes local paths and long identifiers. Diagnostics exclude usernames, hostnames, accounts, IPs, installation UUIDs, window titles, tokens, quota values, and raw App Server responses.

Version 0.2.0 writes no operational log and provides no long diagnostic export. The last error exists only in process memory. An `overlay.log` left by version 0.1.x is no longer used and can be deleted after exit.

## Local settings

- Windows: `%LOCALAPPDATA%\CodexQuotaOverlay\settings.json`
- macOS: `~/Library/Application Support/CodexQuotaOverlay/settings.json`

Settings may contain placement offsets, the telemetry choice, a random installation UUID, the last successful heartbeat time, and a manually selected Codex CLI path. All remain local except the heartbeat fields explicitly listed below. Uninstalling does not automatically delete settings.

## Optional anonymous usage statistics

Public source builds and current release builds have no telemetry endpoint configured, so they send no heartbeat. Only a build with an HTTPS endpoint and an explicit user opt-in can send one `daily_active` event per 24 hours containing:

- a random installation UUID;
- the overlay version;
- `windows` or `macos` as the platform;
- the operating-system version;
- the UI locale;
- event time and schema version.

The payload excludes quota, reset credits, Codex accounts, and CLI paths, and does not explicitly include an IP address. As with any HTTPS request, network and hosting providers process the source IP for delivery and may temporarily retain it in security logs. The analytics store must not use it as an identifier or copy it into analytics records. Reference-backend heartbeat retention is at most 90 days.

Deleting settings creates a new random UUID the next time a heartbeat needs one. Disabling telemetry stops further heartbeats.

The GitHub Pages product site contains no analytics script, cookies, forms, or third-party tracking pixels. GitHub may process standard web request metadata as the hosting provider under its own terms.

## Changes and questions

Material privacy changes are recorded in the changelog and this document. Issues should contain only versions and a short diagnostic code—never account information, tokens, local paths, or the settings file.
