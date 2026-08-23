# Roadmap

This roadmap communicates direction, not guaranteed dates. Concrete work is tracked in GitHub issues and milestones.

## Current development

- Quota Center with multi-window limits, read-only activity summaries, trend charts, and preference controls.
- Compact, balanced, and insight overlay modes.
- Current-cycle burn-rate, safe-pace, exhaustion, and confidence estimates.
- Opt-in bounded local history and once-per-cycle low-quota/pace-risk notifications.
- Renderer, core, host-simulation, packaged-app, and responsive visual verification for the expanded product.

## Now — quality and adoption

- Keep macOS source compatibility green in hosted dual-architecture build and package-self-test environments without making it a Windows release gate.
- Improve placement compatibility as Codex Desktop UI versions change.
- Tune forecast confidence against longer real-world cycles without collecting remote quota telemetry.
- Add accessible chart descriptions and additional keyboard-navigation review.
- Collect privacy-safe compatibility reports through short diagnostic codes.
- Keep release, dependency, CodeQL, secret-scan, and package verification green.

## Next

- Add commercial Windows signing and Apple Developer ID signing/notarization when credentials are available.
- Evaluate opt-in update notifications without adding a background updater.
- Add localization contributions beyond English and Simplified Chinese if maintainers are available.
- Evaluate export of an explicitly user-created, privacy-reviewed aggregate report without raw App Server data.

## Later / exploratory

- Evaluate additional placement presets for future Codex Desktop layouts.
- Revisit telemetry only after a public infrastructure and data-protection review. Public builds remain unconfigured by default.

## Explicitly out of scope

- Linux packages while there is no official Codex Desktop app for Linux.
- Reading conversation content, browser cookies, account secrets, or private Codex storage.
- Consuming reset credits or automating account actions.
- Long diagnostic exports or background screenshot capture.
