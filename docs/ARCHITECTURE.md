# Architecture

Codex Quota Overlay is a single-process Windows Forms application targeting .NET Framework 4.8.

## Runtime flow

1. A named per-user mutex prevents duplicate instances.
2. Win32 window enumeration selects the largest visible Codex desktop window.
3. While Codex is present, the app launches the installed `codex.exe app-server` process over stdio.
4. After the JSON-RPC initialization handshake, it calls `account/rateLimits/read` and listens for `account/rateLimits/updated`.
5. The response is reduced to display-only quota and reset-credit fields.
6. A non-activating, topmost, click-through form is positioned relative to the Codex window and shown only when that process owns the foreground window.

The app never attaches to Codex private desktop IPC, edits Codex storage, reads browser cookies, or consumes reset credits.

## Local state

- `settings.json`: anonymous installation ID, telemetry consent, last successful heartbeat.
- `overlay.log`: bounded-content operational summaries. It intentionally omits raw JSON-RPC payloads.
- `HKCU\Software\Microsoft\Windows\CurrentVersion\Run`: optional startup entry.

## Telemetry boundary

The client is inert when `AppInfo.TelemetryEndpoint` is empty. A configured endpoint must be HTTPS. After consent, the client sends at most one privacy-documented heartbeat per 24 hours and backs off for one hour after a failure. Quota values and Codex data never cross this boundary.

The reference Cloudflare Worker validates a small schema, ignores request IP headers, deduplicates one installation per UTC day, and deletes records older than 90 days.

## Release pipeline

Windows CI compiles with the inbox .NET Framework compiler, runs reflection-based parser tests, packages an Inno Setup installer and portable ZIP, and generates SHA-256 checksums. A `v*` tag publishes those artifacts as a GitHub Release after verifying the tag matches `VERSION`.
