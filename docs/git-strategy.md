# Git Strategy

Trunk-based development with short-lived feature branches and PRs merged into main.

## Branching Model

**Main branch (`main`)** is always deployable. All work happens on short-lived branches merged via pull request.

### Branch Naming

```
type/description
```

| Type | Use |
|---|---|
| `feat/` | New feature (`feat/exercise-crud`) |
| `fix/` | Bug fix (`fix/session-status`) |
| `refactor/` | Code restructuring (`refactor/store-transactions`) |
| `docs/` | Documentation only (`docs/api-spec`) |
| `test/` | Test additions/fixes (`test/cycle-acceptance`) |
| `chore/` | Build, CI, deps, config (`chore/ci-workflow`) |

### Rules

- Branches should be **short-lived** — ideally merged within a day
- One focused concern per branch (don't mix features with refactors)
- Branch from `main`, merge back to `main`
- Delete branches after merge

## Pull Requests

### Creating a PR

```bash
git checkout -b feat/exercise-crud
# ... make changes ...
git add <files>
git commit -m "Add exercise CRUD endpoints"
git push -u origin feat/exercise-crud
gh pr create --title "Add exercise CRUD endpoints" --body "..."
```

### PR Requirements

- CI must pass (go vet, go test, go build)
- PR title should be concise (< 70 chars)
- Description includes a summary and test plan

### Merging

- Merge via GitHub (squash or merge commit — your preference)
- Delete the branch after merge
- Pull latest main before starting new work

## Branch Protection (main)

Configure on GitHub:
- Require pull request before merging
- Require CI status checks to pass
- No direct pushes to main (except initial setup)

## Claude Agent Workflow

When the Claude agent works on a task:

1. Create a short-lived branch: `git checkout -b type/description`
2. Make changes in small, focused commits
3. Push and create a PR: `gh pr create`
4. CI runs automatically
5. User reviews and merges

The agent should never force-push, push directly to main (after protection is enabled), or amend published commits.

## CI Pipeline

See `.github/workflows/ci.yml`. Runs on every PR targeting main:

1. **Vet** — `go vet ./...` (static analysis)
2. **Test** — `go test ./...` (unit + integration + acceptance)
3. **Build** — `go build ./...` (compilation check)

All three must pass for the PR to be mergeable.
