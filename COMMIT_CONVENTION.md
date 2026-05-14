# Commit Message Convention

This project uses [Conventional Commits](https://www.conventionalcommits.org/) for automated versioning and changelog generation.

## Commit Message Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

## Type

Must be one of the following:

- **feat**: A new feature (triggers MINOR version bump)
- **fix**: A bug fix (triggers PATCH version bump)
- **perf**: A code change that improves performance (triggers PATCH version bump)
- **docs**: Documentation only changes (triggers PATCH version bump)
- **style**: Changes that don't affect code meaning (formatting, etc.)
- **refactor**: Code change that neither fixes a bug nor adds a feature
- **test**: Adding missing tests or correcting existing tests
- **build**: Changes that affect the build system or dependencies
- **ci**: Changes to CI configuration files and scripts
- **chore**: Other changes that don't modify src or test files (no release)

## Breaking Changes

Add `BREAKING CHANGE:` in the footer to trigger a MAJOR version bump:

```
feat: redesign authentication API

BREAKING CHANGE: authentication endpoints now use JWT tokens instead of sessions
```

## Examples

### Patch Release (1.0.0 → 1.0.1)
```bash
git commit -m "fix: resolve cloudflare IP detection issue"
git commit -m "docs: update installation instructions"
```

### Minor Release (1.0.0 → 1.1.0)
```bash
git commit -m "feat: add audit logging system"
git commit -m "feat(backup): implement incremental backups"
```

### Major Release (1.0.0 → 2.0.0)
```bash
git commit -m "feat: redesign API authentication

BREAKING CHANGE: all API endpoints now require Bearer token authentication"
```

## Scope (Optional)

The scope provides additional context:

```bash
git commit -m "feat(ssh-keys): add key fingerprint validation"
git commit -m "fix(backup-jobs): correct schedule parsing"
git commit -m "docs(api): add audit log endpoint documentation"
```

Common scopes:
- `api` - API changes
- `frontend` - Frontend changes
- `backend` - Backend changes
- `ssh-keys` - SSH key management
- `servers` - Server management
- `backup-jobs` - Backup job functionality
- `audit` - Audit logging
- `auth` - Authentication/authorization
- `email` - Email notifications

## Tips

1. **Use lowercase** for type and scope
2. **Use imperative mood** in subject ("add" not "added")
3. **Don't end subject with period**
4. **Limit subject to 72 characters**
5. **Separate subject from body with blank line**
6. **Use body to explain what and why, not how**

## Automated Versioning

When you push to `main` branch:
- Semantic Release analyzes your commits
- Determines the next version number
- Generates CHANGELOG.md
- Creates a GitHub release
- Tags the commit with the version

No need to manually update version numbers!
