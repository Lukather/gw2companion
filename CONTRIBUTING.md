# Contributing

Notes for working on this project — including a future version of you.

---

## Commits

This project uses [Conventional Commits](https://www.conventionalcommits.org/).

### Format

```
<type>(<scope>): <description>

<body>

<footer>
```

### Types

| Type       | Use for                                                       |
| ---------- | ------------------------------------------------------------- |
| `feat`     | New feature or page                                           |
| `fix`      | Bug fix                                                       |
| `docs`     | `README.md`, `SESSION.md`, code comments                      |
| `refactor` | Code reorganization, no behavior change                       |
| `style`    | Formatting, CSS tweaks (no logic change)                      |
| `perf`     | Performance improvement                                       |
| `test`     | Adding or fixing tests                                        |
| `build`    | Build system / bundler changes                                |
| `ci`       | CI/CD configuration                                           |
| `chore`    | `.gitignore`, dependencies, misc config                       |

### Rules

- **Subject**: imperative mood, lowercase after the type, no trailing period, ≤72 characters.
- **Body**: explain *what* and *why*, not *how*. Wrap at ~72 chars. Blank line after the subject.
- **Scope** (in parens) is optional but encouraged when the change is localized — e.g. `feat(builds): ...`, `fix(analyzer): ...`.
- **One logical change per commit.** If you can split it cleanly, split it.
- **Breaking changes**: append `!` after the type/scope (e.g. `feat(api)!: ...`) and add a `BREAKING CHANGE:` footer explaining the migration path.

### Examples

```
feat(builds): add per-slot meta equipment suggestions
```

```
fix(analyzer): cap salvage recommendations at material TP value
```

```
docs: document complete API key permissions in README
```

```
refactor: extract PROFESSION_COLORS to lib/professions.js
```

```
perf(frontend): dedupe shared helpers, drop 2 kB from bundle
```

```
chore(deps): pin concurrently to ^8.2.2
```

---

## Dev setup

See the [Quick Start](README.md#quick-start) section of the README. One-shot:

```bash
npm install
npm run dev
```

---

## Session notes

`SESSION.md` at the repo root is a running log of significant changes within a work session. **Append to it, don't replace it** when you finish a chunk of work — it's the cheapest way to pick up where you left off next time. It should reflect the *current* state, not the history of how you got there.

---

## Don't commit

Already protected by `.gitignore`, but worth knowing:

- `backend/data/config.json` — your GW2 API key.
- `node_modules/`, `frontend/dist/`, `backend/dist/`.
- `*.bak`, `*.bak.*`, `*.swp`, `*.swo` — backup and editor swap files.
- Stray temp files. The Windows reserved device name `nul` has already bitten this repo once — if you see a file with that name, delete it, don't `git rm` it. (See the [Security & Privacy](README.md#security--privacy) section for the related API-key-rotation note.)

---

## Push policy

This is a solo project — committing and pushing straight to `main` is fine. If you ever start collaborating, the convention is: feature branches off `main`, PR back to `main`, squash-merge.
