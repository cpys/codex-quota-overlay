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
git tag -a v0.4.0 -m "Codex Quota Overlay 0.4.0"
git push origin v0.4.0
```

The release workflow verifies the tag/version match, builds and self-tests Windows packages, generates checksums and a CycloneDX SBOM, attests every published asset, and creates a stable Windows-only GitHub Release. A separate macOS job still builds both architectures, verifies DMGs and signature structure, and executes the host-architecture package self-test, but does not upload macOS assets. Physical-Mac acceptance is not a release gate for the Windows distribution.

## Validate

- Download each asset from GitHub rather than relying on workflow artifacts.
- Verify the matching SHA-256 file.
- Confirm the release contains only the expected Windows x64 assets.
- Install the package on supported Windows hardware and run the primary flow.
- Record only short diagnostic codes; never attach managed-device screenshots or long logs.
- Confirm the verified stable release is marked as the latest release.

See [SIGNING.md](SIGNING.md) for optional certificate integration.
