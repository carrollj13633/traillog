# Improvement ideas: Grok Bot

Ranked from most to least recommended. Effort: S = small (hours), M = medium (days), L = large (weeks).

| # | Idea | Effort | Why this rank |
|---|------|--------|---------------|
| 1 | **Real-device test checklist and field-test feedback form** (a Help-tab "Report a problem" that attaches the Compatibility check and the last error) | S | Cheapest way to learn what actually breaks on students' phones; everything else depends on this. |
| 2 | **Driving mode**: large speed readout, auto-dim screen with wake lock, trip summary (top speed, moving time, stops) | S | Jim asked about driving; mostly UI on data we already collect. |
| 3 | **Track stats and summary card**: moving vs. stopped time, pace/speed splits per mile/km, max/min elevation | S | High value for hikers and drivers; pure logic that fits `geo.js` and is easy to unit test. |
| 4 | **Auto backup/restore**: one-tap "Export everything" ZIP and re-import; reminder when unexported tracks exist | S | Tracks live only in browser storage, so clearing data loses them. Prevents the worst failure. |
| 5 | **Waypoints and photos**: drop a pin with a note (and optional photo) during a recording; include in GPX/KML | M | Makes field trips and class use much richer; GPX supports waypoints natively. |
| 6 | **Track smoothing and cleanup tools**: trim start/end, split/merge tracks, remove spikes | M | Common fix after real use; works offline on saved data. |
| 7 | **Android background recording** (in progress via Capacitor) | M | Biggest functional gap on phones; already underway. Ranked below the quick wins only because it is already in flight. |
| 8 | **Offline map areas**: pre-download tiles for a chosen area before a hike | M | Valuable on trails without signal; must respect tile server usage rules (use a permissive provider or self-host). |
| 9 | **Class/field-trip mode**: shared link or QR that preloads a trip name and exports a combined GPX from many students' tracks | M | Fits Jim's SUNY Canton use; can be done without accounts by importing files into one view. |
| 10 | **Compare and overlay tracks** (same route over time, instructor vs. students) | M | Useful for teaching and training; needs only multi-track display. |
| 11 | **Safety share**: "I'm here" link or text with current coordinates, plus a low-battery auto-save | M | Real safety value, but live sharing needs a backend or a third-party service, so privacy and cost need decisions. |
| 12 | **Heading/compass and "return to start" arrow** | S | Nice navigation aid with small effort, but less central than recording quality. |
| 13 | **Planned routes**: import a GPX and follow it, showing off-route alerts | L | Turns the app into navigation, which is a different product with higher risk and testing burden. |
| 14 | **Optional cloud sync** (user's own Google Drive or similar) | L | Handy, but adds auth, privacy and store-review complexity; manual backup (idea 4) covers most of the need. |
| 15 | **Gamification**: weekly distance goals, badges | S | Easy, but least aligned with the research and teaching purpose. |

## Cross-cutting notes
- Keep the website, Android, and (later) iOS versions on one shared codebase.
- Anything that sends location off the device needs a privacy review and an updated Play/App Store data-safety answer.
- Every idea above should ship with unit tests for its logic.
