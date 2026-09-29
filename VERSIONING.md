# Versioning

PullBackup uses [Conventional Commits](https://www.conventionalcommits.org/) and [semantic-release](https://semantic-release.gitbook.io/) to automate versioning. Pushing to `main` automatically determines the next version, creates a GitHub release, and publishes a Docker image to GitHub Container Registry.

## Commit Format

```
<type>(<scope>): <subject>
```

The `scope` is optional. Keep the subject under 72 characters, use imperative mood ("add" not "added"), no trailing period.

## Types

| Type | Effect | When to use |
|------|--------|-------------|
| `feat` | Minor version bump | New user-facing feature |
| `fix` | Patch version bump | Bug fix |
| `perf` | Patch version bump | Performance improvement |
| `refactor` | No release | Code restructure, no behaviour change |
| `docs` | No release | Documentation only |
| `chore` | No release | Tooling, dependencies, config |
| `ci` | No release | CI/CD pipeline changes |
| `test` | No release | Tests only |

## Breaking Changes

Add `BREAKING CHANGE:` in the commit footer to trigger a major version bump:

```
feat: replace session auth with JWT

BREAKING CHANGE: all clients must send Authorization: Bearer <token>
```

## Common Scopes

`auth` · `backup-jobs` · `browse` · `dashboard` · `email` · `servers` · `settings` · `setup` · `ssh-keys` · `terminal`

## Examples

```bash
# Patch — 1.2.3 → 1.2.4
git commit -m "fix(browse): resolve relative path in directory picker"

# Minor — 1.2.4 → 1.3.0
git commit -m "feat(settings): add backup storage location tab"

# Major — 1.3.0 → 2.0.0
git commit -m "feat(api): new authentication flow

BREAKING CHANGE: session tokens replaced by JWT; clients must re-authenticate"
```

## Release Pipeline

On every push to `main`:

1. **semantic-release** analyses commits since the last tag
2. Determines the next version (or skips if no releasable commits)
3. Tags the commit `vX.Y.Z`
4. Creates a GitHub release with generated notes
5. Builds the image from the tag and pushes it to `ghcr.io/damiankw/pullbackup` tagged `X.Y.Z`, `X.Y`, `X`, and `latest`
6. Appends the `docker pull` command to the release notes

Both steps run in `.github/workflows/release.yml`. The image build lives in the same workflow because tags pushed with `GITHUB_TOKEN` don't trigger other workflows.

The package inherits the repository's visibility. While the repo is private, pulling needs a login with a personal access token that has the `read:packages` scope:

```bash
echo <token> | docker login ghcr.io -u damiankw --password-stdin
```
