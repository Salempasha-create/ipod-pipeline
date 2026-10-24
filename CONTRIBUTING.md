# Contributing to ipod-pipeline

Thanks for helping out! [SPEC.md](SPEC.md) describes what the app does — please read it before proposing changes.

## Proposing changes

- **Open an issue first for anything major** — new features, new sources, architecture changes, or anything that touches the spec. Small fixes (typos, obvious bugs) can go straight to a pull request.
- Want to add a new source plugin? Use the **New source** issue template.

## Pull requests

- **One change per pull request.** Keep unrelated fixes in separate PRs.
- Link the issue your PR addresses.
- Say which OS(es) you tested on.

## Secrets

- **Never commit secrets** — passwords, API keys, tokens, or personal settings files.
- The app stores credentials in the OS credential store and settings in the OS app-data folder, never in the repo.

## Spec changes

- [SPEC.md](SPEC.md) is the single source of truth. **Changes to the spec go through pull requests**, like code.
- Significant decisions are recorded in [docs/DECISIONS.md](docs/DECISIONS.md) with a date and reason.
