# Contributor guide for AI assistants (ChatGPT, Claude, Grok Bot, and others)

This file is the single source of truth for any AI assistant working on this repo. `CLAUDE.md` points here. Read this file and `docs/HANDOFF.md` before you change anything.

## What this project is
A GPS trail recorder. It is an installable web app (PWA) made of plain static files, with no build step and no backend. An Android wrapper (Capacitor, with true background location) is planned under `android/`; an iOS wrapper may follow. The live site is served by GitHub Pages from `main` at the repo root: https://carrollj13633.github.io/traillog/

The app name is not final (TrailLog is already taken on Google Play; Trailvane is the leading candidate). Keep the name in one place where possible.

## Layout
- `index.html`, `manifest.webmanifest`, `sw.js`: app shell and PWA files (repo root, because GitHub Pages serves from here)
- `js/geo.js`: pure logic (distance, filtering, stats, GPX/KML). No DOM. Unit tested.
- `js/platform.js`: OS/browser detection and help text. Unit tested.
- `js/db.js`: IndexedDB storage
- `js/app.js`: UI and recording flow
- `css/app.css`, `icons/`, `vendor/leaflet/`
- `tests/`: `geo.test.js` and `platform.test.js` (Node), `e2e.py` (Playwright)
- `docs/HANDOFF.md`: running log of who did what and what is next
- `docs/ci.yml.example`: unit-test CI workflow; move it to `.github/workflows/ci.yml` (needs a token with the `workflow` scope)
- `android/`: the Android wrapper (to be added)

## Rules
1. Never push directly to `main`. Work on a branch named `<author>/<short-topic>` (for example `claude/android-bg-location`) and open a pull request. `main` is protected.
2. Keep the website working. Every change must pass `node --test tests/` before you open a PR. Run `tests/e2e.py` too for UI changes.
3. Keep it static: no bundler or build step for the web app unless the owner approves.
4. Use standard American English spelling in all text and docs (center, color, -ize).
5. Never commit secrets: signing keystores, passwords, API keys, or tokens. Android signing material lives outside the repo.
6. Keep changes small and focused, and explain the why in the PR description.
7. Update `docs/HANDOFF.md` at the end of every work session: what changed, what was tested, what is next, and any open questions.
8. Do not claim something was tested on a real device unless it was. State clearly what was only tested with mocks.
9. The owner (Jim Carroll) makes final decisions and does all purchases and store-account steps. Do not make purchases or create accounts on his behalf.

## Working together (multiple AIs)
- Check open pull requests and `docs/HANDOFF.md` first so you do not duplicate work.
- Claim a task by commenting on its issue or opening a draft PR early.
- Review each other's PRs: a different assistant than the author should review before the owner merges.
- Squash-merge to keep history clean.

## Commands
```bash
node --test tests/                 # unit tests
python3 -m http.server 8000        # run locally at http://localhost:8000
python3 tests/e2e.py               # browser tests (needs Playwright and Chrome)
```
