# Handoff log

Newest entry first. Add an entry at the end of every work session.

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
