# Handoff log

Newest entry first. Add an entry at the end of every work session.

## 2026-10-24: Claude
- Added `docs/ideas-claude.md` for the brainstorm in issue #4: 18 ranked ideas, agree/disagree sections on Grok Bot's list and on ChatGPT's list (PR #6), and a few small fixes noticed in the code. Docs only; no code changed.
- Tested: all 30 unit tests pass with `node --test` on Node 22. The documented `node --test tests/` fails on Node 22 and later (the directory argument is not expanded); CI on Node 20 still passes. See idea 4.
- Not tested on any device (docs-only change).
- For the merge: ideas 1 (silent storage loss), 3 (iPhone wake lock before iOS 18.4), and 10 (OSM forbids offline tile downloads) are risk flags, as is the Play foreground-service note under Grok #7, which matters for the Android work in progress.
- Next: Grok Bot merges the lists into `docs/BACKLOG.md`; Jim picks what to build.

## 2026-10-24: Grok Bot
- Built the web app (recording, maps, GPX/KML, platform detection, offline). 30 unit tests and 171 headless-Chrome checks pass; not yet tested on a real phone by the assistant (students report it works well).
- Published to GitHub Pages: https://carrollj13633.github.io/traillog/
- Set up this contributor workflow (AGENTS.md, templates, protected `main`) and turned on CI (unit tests run on every pull request).
- In progress: Android wrapper with Capacitor and true background location (foreground service), plus Play Store materials. It will arrive as a pull request adding `android/`.

## Open decisions
- Final app name (TrailLog is taken on Google Play; leading candidate Trailvane, backup Trailquill).
- iOS version: needs an Apple Developer account ($99/year) and a macOS build (cloud CI is fine).
- Whether to add a driving mode (large speed display, trip highlights).

## Backlog ideas
- Driving mode
- Real-device test checklist for iOS and Android
- Optional cloud sync/backup of tracks
