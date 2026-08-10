# Release process

Releases are built by GitHub Actions from an immutable `v<version>` tag. Maintainers do not upload locally built binaries to a release.

## Prepare

1. Move the intended changelog entries out of `Unreleased` and add the release date.
2. Set the same semantic version in `package.json` and `VERSION`, update versioned download links under `site/`, then run `npm install --package-lock-only --ignore-scripts`.
3. Run `npm ci`, `npm run verify`, and the native/package checks for the current host.
4. Confirm the working tree contains no credentials, private screenshots, generated settings, build output, or long diagnostics.
5. Open and merge a pull request after required checks pass.

## Publish

Create and push an annotated tag from the reviewed main-branch commit:

```bash
git tag -a v0.3.0 -m "Codex Quota Overlay 0.3.0"
git push origin v0.3.0
```

The release workflow verifies the tag/version match, tests both operating systems, executes the packaged application self-test, creates Windows and macOS packages, generates checksums and a CycloneDX SBOM, attests release artifacts, and publishes a GitHub pre-release. A release remains a pre-release until physical-Mac acceptance is recorded and signing/notarization status is clear.

## Validate

- Download each asset from GitHub rather than relying on workflow artifacts.
- Verify the matching SHA-256 file.
- Confirm platform/architecture names on the release page.
- Install or mount the package on supported hardware and run the primary flow.
- Record only short diagnostic codes; never attach managed-device screenshots or long logs.
- Promote the pre-release only after acceptance criteria are satisfied.

See [SIGNING.md](SIGNING.md) for optional certificate integration.
