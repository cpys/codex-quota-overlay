# Privacy

Last updated: 2026-08-23

Codex Quota Overlay is local-first. Quota reads, foreground-Codex detection, and overlay placement happen on the user's Windows or macOS computer.

## Codex and window data

The app starts the local `codex app-server` and calls `account/rateLimits/read` for quota windows and `account/usage/read` for the optional activity panel. Quota percentage, reset time, reset-credit metadata, aggregate activity totals, and daily token totals are not sent to the maintainer.

Quota samples remain in process memory by default. If the user explicitly enables local history, the app stores only the sample time, normalized used percentage, reset time, window duration, and a sanitized rate-limit identifier in `quota-history.json`. It does not persist the activity summary, daily token totals, raw App Server responses, account identifiers, or reset-credit details. The retention choices are 7, 14, 30, or 90 days, with a hard limit of 2,000 compressed samples.

The window probe uses only the frontmost app name, process or bundle identity, and window bounds. The implementation deliberately leaves the title field empty and does not read or store conversation titles. It does not collect or upload ChatGPT account details, access tokens, API keys, conversation content, prompts, responses, source code, screenshots, or browser cookies.

## Short diagnostics

**Copy short diagnostics** copies one error code and short description, capped at 200 characters. The sanitizer removes local paths and long identifiers. Diagnostics exclude usernames, hostnames, accounts, IPs, installation UUIDs, window titles, tokens, quota values, and raw App Server responses.

Version 0.2.0 writes no operational log and provides no long diagnostic export. The last error exists only in process memory. An `overlay.log` left by version 0.1.x is no longer used and can be deleted after exit.

## Local settings

- Windows: `%LOCALAPPDATA%\CodexQuotaOverlay\settings.json`
- macOS: `~/Library/Application Support/CodexQuotaOverlay/settings.json`

Settings may contain placement offsets, overlay detail mode, overlay theme (dark or light), local-history choice and retention, alert choice and threshold, the telemetry choice, a random installation UUID, the last successful heartbeat time, and a manually selected Codex CLI path. All remain local except the heartbeat fields explicitly listed below. Uninstalling does not automatically delete settings.

Optional history is stored beside the settings file:

- Windows: `%LOCALAPPDATA%\CodexQuotaOverlay\quota-history.json`
- macOS: `~/Library/Application Support/CodexQuotaOverlay/quota-history.json`

History persistence and alerts are disabled by default. Disabling persistence stops further disk writes but deliberately does not delete an existing file. **Clear history** in Quota Center removes both current-session samples and the history file. Uninstalling does not automatically delete either local file.

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
