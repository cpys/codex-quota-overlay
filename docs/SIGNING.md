# Code signing and notarization

The release pipeline is designed to build reproducibly without private signing credentials. Public preview artifacts are therefore unsigned unless a release explicitly states otherwise.

## Windows

A production Windows release requires a trusted code-signing certificate or managed signing service. Credentials must be stored as GitHub Actions secrets or obtained through short-lived workload identity; they must never be committed. Both the installed executable and installer should be signed and verified with `signtool verify /pa` before publication.

## macOS

A production macOS release requires Apple Developer Program membership, a Developer ID Application certificate, a Team ID, and notarization credentials. The `.app` must be hardened-runtime signed, notarized, stapled, and verified with `codesign`, `spctl`, and `stapler` before a release is promoted from preview.

## Project policy

- Missing credentials must produce an explicitly unsigned preview, never a misleading success claim.
- Fork pull requests never receive signing secrets.
- Secret values must not appear in logs, artifacts, caches, or diagnostics.
- Checksums, SBOMs, and build attestations complement signing but do not replace platform trust decisions.
