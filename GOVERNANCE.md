# Governance

Codex Quota Overlay currently uses a lightweight maintainer-led model appropriate for a small desktop utility.

## Roles

- **Users** install releases, report problems, and suggest improvements.
- **Contributors** submit issues, documentation, tests, or code under the project's license and policies.
- **Maintainers** review changes, manage releases and security reports, and make final decisions when consensus is not reached.

Current maintainers are listed in [MAINTAINERS.md](MAINTAINERS.md). Maintainer status is based on sustained, constructive contributions and sound judgment around privacy, desktop security, and cross-platform behavior.

## Decisions

Routine changes are decided through issue and pull-request review. Changes that add network access, data collection, persistence, startup behavior, elevated privileges, or a new supported platform require:

1. a public design discussion;
2. privacy and threat-model updates;
3. tests and release notes; and
4. explicit maintainer approval.

The maintainer may reject technically valid changes that materially weaken the local-first privacy model, make diagnostics unsafe for managed devices, or cannot be maintained across supported platforms.

## Releases and security

Releases follow [Semantic Versioning](https://semver.org/) and the process in [docs/RELEASING.md](docs/RELEASING.md). Security reports are handled privately under [SECURITY.md](SECURITY.md). Project governance changes are proposed and reviewed like code changes.
