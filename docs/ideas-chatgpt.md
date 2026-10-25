# Improvement ideas: ChatGPT

**Date:** October 24, 2026 (America/New_York)  
**Purpose:** A ranked contribution to [the brainstorm invitation](BRAINSTORM_PROMPT.md) and [tracking issue #4](https://github.com/carrollj13633/traillog/issues/4). Jim chooses the work; Grok Bot consolidates the proposals into the backlog.  
**Scope:** Documentation only. These are proposals and effort estimates, not implemented features or device-test results.

## Recommendation and baseline

Make recording dependable, make saved work recoverable, and then develop the classroom uses that distinguish this app. The strongest educational direction is a small field notebook and measurement tool: students collect observations locally, inspect uncertainty, and deliberately submit results without an account system.

I read `AGENTS.md`, `docs/HANDOFF.md`, the invitation, Grok's list, the README, and the recording, storage, geometry, platform, and service-worker sources at [`9cff189`](https://github.com/carrollj13633/traillog/commit/9cff189bda98dd9c18ca97c5aa886a3a6958f0bc). At the initial review, `docs/ideas-grok.md` was the only submitted idea list, and there were no open pull requests. The comparisons below refer to that version of Grok's list.

Several useful capabilities already exist: per-point IndexedDB writes and unfinished-track recovery, pause/resume segments, all-track GPX export and GPX import, track sharing, a copied compatibility report, persistent-storage requests, min/max elevation, and an elevation profile. The proposals extend these capabilities. [R1][R2][R3][R4]

The invitation reports that the Android wrapper has been built, while the checked main tree has no `android/` directory and the handoff still describes the wrapper as in progress. Treat that as reported work awaiting repository integration and qualification; coordinate with its author rather than starting a second wrapper. No Android or iOS device behavior was verified in this session. [R5][R6]

**Effort:** S = hours, M = days, L = weeks for the bounded first version described. Estimates include relevant verification, assume one developer familiar with this code, and are not schedule commitments. Device access, distribution, and later scope can extend elapsed time. The numbering is the complete recommendation order, from highest to lowest; C01–C20 are stable identifiers for backlog consolidation.

## Ranked ideas

### 1. C01: Qualify continuous recording on actual phones

**One-line proposal:** Establish a repeatable field-test checklist and capability record for each supported browser and native wrapper.

- **Who benefits and why:** Every recorder, especially students who lock a phone or switch apps during a walk. They need to know which setup can complete their intended recording.
- **Effort:** **M**; an initial checklist is **S**, with device runs and wrapper qualification making up the remaining work.
- **Risks and dependencies:** Requires access to representative phones and the actual Android candidate. Cover screen lock, app switching, permission changes, battery saver, interruption, resume, Stop, and export/re-import. Record exact app/build and OS/browser versions. Extend the existing copied report with user-reviewed diagnostics; do not attach routes automatically.
- **Why this rank:** An attractive feature list is of little value if the expected recording stops unnoticed. This also tells us where C02–C05 are most urgent.
- **Builds on:** Grok #1 and #7. Qualify the wrapper already in flight. Android can use a user-started location foreground service with an ongoing notification for screen-off sessions; do not assume every such session needs the separate background-location permission. The PWA must describe its own limitations. [P1][P2][P3]

### 2. C02: Show save health and rescue an unsaved recording

**One-line proposal:** Display the last successfully saved point/time, surface write failures, and offer an emergency export of available in-memory data.

- **Who benefits and why:** Anyone recording an irreplaceable trip or field exercise; a moving line must not imply that the same data is safely stored.
- **Effort:** **M**.
- **Risks and dependencies:** IndexedDB transactions can fail after the database opens. Bound retries and pending memory, distinguish queued from committed writes, and preserve recovery data until a final save succeeds. An emergency export is limited to data still available to the app.
- **Why this rank:** This addresses a concrete silent-failure risk. `saveMeta()` and the point-write failure path currently log errors to the console. [R2]
- **Builds on:** Existing per-point autosave and Grok #4. Add storage-usage and persistence status where supported; persistence does not replace a restorable backup. [P4]

### 3. C03: Make a complete backup that can be restored faithfully

**One-line proposal:** Add a versioned full-data backup with a restore preview, duplicate handling, and a verified round trip.

- **Who benefits and why:** Students changing phones, Jim preserving fieldwork, and anyone clearing browser data or moving between the PWA and wrapper.
- **Effort:** **M** for a compact JSON-based archive; attachments and ZIP packaging can follow if needed.
- **Risks and dependencies:** Preserve stable track IDs, segments, timestamps, accuracy, duration semantics, settings, and future observation records. Validate format versions and size limits before writing; preview conflicts and avoid partially replacing a collection. Check export/import across supported platforms. Give reminders for unbacked-up work, but do not label a downloaded file as verified until it has been read back successfully.
- **Why this rank:** It protects all later investments in annotations and classes. Existing all-track GPX export is useful interchange, but it does not preserve every app field. [R2][R3]
- **Builds on:** Grok #4, with a larger scope and estimate than an export button alone.

### 4. C04: Represent GPS gaps and uncertain measurements honestly

**One-line proposal:** Mark missing or unusable location intervals explicitly and exclude invented connections from measured distance and speed.

- **Who benefits and why:** Hikers, drivers, and students interpreting a route or comparing measurements; they can distinguish observed travel from missing data.
- **Effort:** **M**.
- **Risks and dependencies:** Define handling for stale, duplicate, backward, and invalid timestamps. Track incoming-fix health separately from accepted movement points so stationary jitter filtering is not mistaken for receiver failure. Preserve pause and outage boundaries in displays and exports. Report unknown time separately from stopped time.
- **Why this rank:** The current long-gap warning still leaves points in one segment, so a straight connection can contribute distance. Repairing that interpretation should precede richer statistics. [R2][R3]
- **Builds on:** Existing filters and segmentation, plus Grok #3 and #6. A lost location cannot be recovered by smoothing the line; inferred paths, if ever offered, must be visibly separate from observations.

### 5. C05: Give each recording one owner and a safe lifecycle

**One-line proposal:** Prevent competing tabs from owning the same recording and defer app reloads until active data is safely handled.

- **Who benefits and why:** Users who open the installed app and a browser tab, revisit a link, or see an update during a trip.
- **Effort:** **M**.
- **Risks and dependencies:** The active recording stores are shared within a storage context. Use explicit ownership, stale-owner recovery, and deliberate takeover. Browser/native installations with separate storage cannot be coordinated merely by a same-origin browser lock. Integrate native service ownership when the wrapper is available.
- **Why this rank:** A second window should not clear another window's recovery state. The current Start flow clears shared active data, and the update Reload action has no recording-state guard. [R2][R4]
- **Builds on:** Existing crash recovery and update notification. Preserve the ability to recover after an unexpected termination; do not depend on a clean shutdown callback.

### 6. C06: Preview and reduce what an exported track reveals

**One-line proposal:** Let users create a redacted export copy by omitting sensitive regions, timestamps, identifying names, or selected notes.

- **Who benefits and why:** Students submitting assignments and people sharing routes that pass homes, workplaces, or private sites.
- **Effort:** **M** for current text/track formats; handle photo metadata when photos are introduced.
- **Risks and dependencies:** Preview the actual exported result and recalculate summaries from retained points. Keep gaps after removal rather than joining distant points. Check sensitive areas anywhere along a route, including loops. Keep the original intact. Removing endpoints is not a guarantee of anonymity.
- **Why this rank:** Classroom and group features increase sharing, so user control belongs before those workflows.
- **Builds on:** Existing GPX/KML sharing, Grok #6 and #11. Also explain that basemap requests reveal the requested map region to the provider; local track storage does not mean zero third-party network exposure. That is an inference from the tile URLs and request flow. [R2][R3][R7]

### 7. C07: Show offline readiness and a usable view without map tiles

**One-line proposal:** Separate recorder readiness from map availability and provide a clear breadcrumb-and-statistics view when tiles are missing.

- **Who benefits and why:** Field groups and hikers leaving connectivity; they can prepare and continue using the recorder without mistaking a blank basemap for lost GPS data.
- **Effort:** **M**.
- **Risks and dependencies:** Report app-shell/cache state and the availability of the currently requested map view without claiming complete route coverage. Tile caches can be incomplete or evicted. Support an explicit no-network basemap mode and a pre-trip airplane-mode check; initial installation and any required data preparation happen before departure.
- **Why this rank:** It improves the existing offline experience without waiting for a licensed map-download solution. A controlling service worker alone does not establish complete map availability. [R2][R7]
- **Builds on:** Grok #8, split into immediate usability work here and conditional downloadable map packages in C19. No background tile harvesting is part of this idea.

### 8. C08: Distribute reusable classroom activity packs

**One-line proposal:** Import a small activity file containing instructions, a session title, meeting points, and a fixed observation template.

- **Who benefits and why:** SUNY Canton instructors prepare an exercise once, and students begin with consistent instructions and export labels.
- **Effort:** **M** for a bounded schema and file import, with a compact QR option for small, nonsensitive setup data.
- **Risks and dependencies:** Validate imported content and versions; render text safely. Keep files as the fallback for larger packs and offline use. A QR that links to a hosted file needs connectivity unless that file was already obtained. Do not place rosters or private student details in public links. Let students use aliases and choose when to export.
- **Why this rank:** This offers a distinctive teaching benefit while preserving the static, no-account architecture.
- **Builds on:** Grok #9. C08 distributes the exercise; C16 collects voluntarily submitted results. An activity pack does not monitor participants or prove attendance.

### 9. C09: Add structured observations along a track

**One-line proposal:** Attach a category, measured value, units, and note to an observation and export an observation table alongside the route.

- **Who benefits and why:** Engineering and other field classes can record measurements such as surface temperature, light level, or an equipment inspection result at a place and time.
- **Effort:** **M** for a few fixed forms and CSV export.
- **Risks and dependencies:** Identify whether coordinates came from a fresh fix, a stale fix, or a manual selection; allow observations without coordinates. Validate units and distinguish manual readings from phone measurements. Escape spreadsheet-formula prefixes in exported text. Integrate observation IDs into C03 backup and C06 export preview.
- **Why this rank:** Structured data is substantially easier to analyze in a class than pins with unrelated prose.
- **Builds on:** Grok #5. Start with text and measurements. Photos add storage, metadata, export packaging, and deletion requirements and should be scoped separately.

### 10. C10: Turn phone location into a measurement lab

**One-line proposal:** Offer an opt-in stationary/repeated-route experiment with sample-quality CSV and comparisons between raw observations and filtering choices.

- **Who benefits and why:** Instrumentation, controls, electronics, statistics, and GIS students can investigate precision, sampling, filtering, and missing measurements using phones they already have.
- **Effort:** **M** for one bounded lab and data export; a general experiment designer would be larger.
- **Risks and dependencies:** Raw logging must be explicit, size-limited, and removable. Record timestamps, reported accuracy, available altitude accuracy, acceptance/rejection reasons, software version, and settings. Preserve original samples. Distinguish scatter from error against a trustworthy reference; repeated measurements do not establish ground truth. Do not grade students on the quality of their phones.
- **Why this rank:** It aligns closely with Jim's teaching and creates educational value beyond fitness statistics.
- **Builds on:** Grok #3 and #10, with a measurement focus. The current app retains accepted-point accuracy but does not preserve a complete experiment record or export that accuracy in GPX. [R2][R3]

### 11. C11: Make field operation accessible and unmistakable

**One-line proposal:** Build on the existing large controls with a simplified field view, readable status text, screen-reader support, and deliberate Stop handling.

- **Who benefits and why:** Users with low vision or limited dexterity, students unfamiliar with the app, and anyone working in glare or with gloves.
- **Effort:** **M**, including representative accessibility and touch checks.
- **Risks and dependencies:** Check focus order, text enlargement, labels, contrast, and repeated taps. Use words/icons as well as color for recording, paused, unsaved, and GPS-unavailable states. Optional sound/vibration must have a visible equivalent and respect user settings. Do not add a confirmation that makes an urgent Stop difficult.
- **Why this rank:** It improves the central workflow across activities and can incorporate the new reliability states from C02 and C04.
- **Builds on:** Current large buttons and light/dark styling. This is a usability extension, not a claim that those basics are missing. [R1]

### 12. C12: Share a deliberate current-location or meeting-point snapshot

**One-line proposal:** Provide a user-triggered share/copy card with coordinates, fix time, accuracy, and whether the point is a current fix or a chosen rendezvous.

- **Who benefits and why:** A separated field group or hiker can communicate a specific location without creating an app account or publishing an entire track.
- **Effort:** **S** for text/copy/share using the existing share approach; richer snapshot import is a later extension.
- **Risks and dependencies:** Mark stale fixes prominently and let users preview the destination content. Web Share requires user activation and available share targets; retain a selectable-text fallback. Obtaining a fix asynchronously may require a separate Share tap. A share-sheet handoff does not confirm receipt. Delivery depends on the selected communication channel. [P5]
- **Why this rank:** It is a small, useful coordination aid within the present architecture.
- **Builds on:** The bounded part of Grok #11. Continuous location sharing and automatic emergency escalation are separate work; this feature makes neither promise.

### 13. C13: Use location and display power deliberately

**One-line proposal:** Separate idle location preview, active recording, and display preferences so high-accuracy acquisition runs only when useful.

- **Who benefits and why:** Users on long outings can choose a mode appropriate to their activity and understand what the app is still doing after Stop.
- **Effort:** **M**, including measurements on actual phones.
- **Risks and dependencies:** Verify permission, pause/resume, reacquisition, and native-service behavior. Browser acquisition options are hints, not guaranteed sample-rate controls. Do not claim a battery percentage improvement without measuring it. Screen dimming and GPS acquisition are different controls; reducing drawing alone does not prove lower GPS power use.
- **Why this rank:** The current app can keep a high-accuracy watch running while idle. Addressing that is more useful than an unmeasured battery-saver label. [R2]
- **Builds on:** Grok #2 and #7. Preserve clear recording status and enough sampling quality for the selected activity; C01 and C04 supply the validation foundation.

### 14. C14: Add statistics with explicit definitions

**One-line proposal:** Show moving, stopped, paused, and unknown time plus distance splits and activity-appropriate speed/pace summaries.

- **Who benefits and why:** Walkers, hikers, drivers, and students comparing routes get useful summaries with interpretable meanings.
- **Effort:** **M**.
- **Risks and dependencies:** Define thresholds and units; keep the definitions available in the summary. Avoid treating GPS outages as stops or deriving a top speed from an isolated bad fix. Record the calculation version and settings needed to reproduce a summary. Retain the original samples and duration semantics.
- **Why this rank:** Valuable after gap handling and sample quality are dependable. Extra decimal places cannot compensate for missing measurements.
- **Builds on:** Grok #3. Min/max elevation and the scrubbed elevation profile already exist; the new work is time classification, splits, and better interpretation. [R1][R2][R3]

### 15. C15: Edit a copy with reversible cleanup

**One-line proposal:** Provide previewed trimming and point/segment removal with Undo, while keeping the original recording and its processing history.

- **Who benefits and why:** Users can remove an accidental start or obvious spike, and students can compare original observations with edited results.
- **Effort:** **M** for trimming and removals; a general split/merge editor can follow.
- **Risks and dependencies:** Preserve timestamps, segment breaks, and annotation links; recalculate summaries. Avoid smoothing that invents travel across a gap. Store edit provenance and make destructive replacement an explicit later choice, not the default.
- **Why this rank:** Useful cleanup becomes safer once full backup, gap semantics, and export preview exist.
- **Builds on:** Grok #6. Reuse C06's preview approach, but keep source-data editing and sharing redaction as distinct user intentions.

### 16. C16: Collect class results locally and compare separate tracks

**One-line proposal:** Import voluntarily submitted activity files into an instructor's local view with overlays and a printable comparison table.

- **Who benefits and why:** Instructors can discuss class results without maintaining a server, requiring accounts, or combining everyone into a single continuous journey.
- **Effort:** **L** for dependable batch import, comparison, and reporting.
- **Risks and dependencies:** Build on C03, C06, C08, and C09. Preserve participant aliases, track ownership, units, segments, and original files. Handle duplicates and schema versions. Preview what enters a report and provide deletion controls. If replay is later added, distinguish elapsed-time alignment from shared clock time and show gaps.
- **Why this rank:** High educational value, but a larger feature that benefits from the individual collection/export workflow being established first.
- **Builds on:** Grok #9 and #10. File transfer is deliberate and uses a method the participants already have; the app does not supply live attendance or group surveillance.

### 17. C17: Help users retrace recorded breadcrumbs

**One-line proposal:** Add a return-oriented view of the recorded path, the start point, remaining recorded distance, and known gaps.

- **Who benefits and why:** Walkers and field groups can inspect how they arrived and orient themselves for the return trip.
- **Effort:** **M** for a bounded breadcrumb aid.
- **Risks and dependencies:** A bearing is not a traversable route, and a recorded path is not proof of present safety or access. Identify missing segments; suppress unreliable heading when stationary or unavailable. Keep compass permission optional and retain a north-up view. C04 is a prerequisite for honest distance and gap presentation.
- **Why this rank:** More aligned with recording than a full routing engine, but it still needs careful outdoor evaluation and clear limits.
- **Builds on:** Grok #12. Defer Grok #13's off-route alerts and planned navigation until the owner explicitly chooses that broader scope.

### 18. C18: Offer a simple driving display and after-trip summary

**One-line proposal:** Provide a preselected large speed/distance view and reviewable trip summary, using the existing recording controls and data.

- **Who benefits and why:** Jim and other users recording drives can glance at a simple display and inspect the trip afterward.
- **Effort:** **S** for the display-only first version; expanded statistics depend on C14.
- **Risks and dependencies:** Start and configure before departure; avoid controls that encourage interaction while moving. Display stale or unavailable speed clearly. Screen-on behavior must be a choice, and recording must work according to the verified platform capabilities from C01.
- **Why this rank:** A useful quick win if Jim selects driving as a near-term priority, but it does less to protect recordings or distinguish the classroom use than the items above.
- **Builds on:** Grok #2, ranked lower here. Do not duplicate existing speed statistics or bundle automatic driving detection, road-speed limits, or navigation into the small estimate.

### 19. C19: Support small offline map packages from an eligible source

**One-line proposal:** Import or prepare a bounded map package with visible size, coverage, zoom range, attribution, and a clear deletion action.

- **Who benefits and why:** Hikers and field classes gain predictable basemap access where network coverage is absent.
- **Effort:** **L**, conditional on identifying a no-cost source and suitable package format that permit the intended use.
- **Risks and dependencies:** The standard OSM tile endpoint prohibits prefetch/offline-download features. Other providers need their own permission and attribution checks; free online viewing is not evidence of offline rights. A self-hosted service would be a separate infrastructure decision. Protect track storage from large map packages and test interrupted imports. [P6]
- **Why this rank:** Strong value, but unresolved data rights, storage, and distribution make it less ready than C07. No eligible provider has been selected by this proposal.
- **Builds on:** Grok #8. Leave this conditional if the no-purchase/no-paid-API constraint cannot be met.

### 20. C20: Explore opt-in live group tracking as a separate feasibility project

**One-line proposal:** Evaluate short-lived, explicitly joined group sessions with visible sharing state, expiration, stale-position labels, and immediate leave/stop controls.

- **Who benefits and why:** Field-trip leaders and consenting participants could coordinate dispersed groups if dependable delivery and clear operating rules can be established.
- **Effort:** **L** for a bounded feasibility prototype; dependable deployment is not included in that estimate.
- **Risks and dependencies:** Continuous transport, identity/session access, background operation, battery use, and data retention all need a design. WebRTC still needs signaling exchange and can need relay infrastructure across networks. A no-required-account design does not remove those requirements. Reliable wide-area service therefore does not currently fit the established static-only scope without another architecture decision. [P7]
- **Why this rank:** Bold and potentially useful, but the least ready proposal. Do not make an app feature or a safety promise depend on an unqualified free relay or a supposed serverless shortcut.
- **Builds on:** The ambitious part of Grok #11. Use C12's manual snapshots and C16's post-trip collection within present constraints. Jim would need to choose any infrastructure expansion before implementation; the default is to defer it.

## Agree/disagree with Grok's list

| Grok idea | My judgment | Reason and mapping |
|---|---|---|
| #1 Real-device checklist/reporting | **Agree: keep at the top.** | C01 keeps it first and connects the results to specific builds and platform capabilities. Reuse the existing Copy report action; add user-reviewed evidence, not automatic location uploads. |
| #2 Driving mode | **Lower from #2 to C18.** | Reliability and classroom value take precedence in my ranking. Jim's preference can reasonably promote the bounded display change without changing those engineering dependencies. |
| #3 Stats | **Retain, but narrow and sequence.** | C14 adds moving/stopped/unknown time and splits after C04. Min/max elevation is already implemented. |
| #4 Backup/restore | **Raise to C03 and estimate M.** | A validated full-data restore is more valuable and more work than downloading a ZIP. Current GPX export/import is useful but not a faithful app backup. |
| #5 Waypoints/photos | **Split the scope.** | C09 makes observations useful for class analysis. Text and measured values come before attachments, metadata stripping, and larger backup packages. |
| #6 Cleanup | **Agree with preservation safeguards.** | C15 edits a copy with Undo and provenance. C06 separately handles privacy when sharing. |
| #7 Android background recording | **Raise qualification to C01.** | It is a core recording dependency already being developed. Avoid a duplicate wrapper and verify its native service behavior on phones. |
| #8 Offline map areas | **Split and make downloads conditional.** | C07 improves immediate offline usability. C19 depends on eligible data and storage, so I estimate L until those choices are resolved. |
| #9 Class/field-trip mode | **Raise the bounded starting point to C08.** | Activity packs have strong value for the stated users with no required accounts. C16 is the larger collection stage. |
| #10 Compare/overlay tracks | **Agree; preserve distinct records.** | C10 emphasizes measurement learning; C16 adds instructor comparison. Do not concatenate students into a fabricated continuous trip. |
| #11 Safety share | **Split small sharing from live monitoring.** | C12 can use a deliberate share action without an app backend. C20 is a separate, conditional architecture project. Low-battery handling also must not substitute for C02's continuous save protection. |
| #12 Compass/return | **Refine toward recorded breadcrumbs.** | C17 gives useful orientation while displaying gaps. A straight arrow alone cannot establish a usable return route. |
| #13 Planned routes/off-route alerts | **Defer broader navigation.** | It adds operating and verification demands beyond the recorder. Existing GPX import should not be described as missing. |
| #14 Cloud sync | **Keep deferred.** | A complete local backup and intentional file transfer address the strongest need first; an optional cloud adapter would add authentication and ongoing integration work. |
| #15 Gamification | **Keep lowest priority among ordinary enhancements.** | There is a clearer educational and recording benefit in the proposals above. Reconsider only if real users identify an engagement problem it would solve. |

**Other assistants:** No Claude idea list or other submitted list was available in the initial main-branch/docs and open-PR checks. I have not inferred another assistant's position. Grok should incorporate any subsequently submitted list before the final ranking.

## Suggested first decisions and implementation sequence

1. **Confirm the core use case:** dependable personal recording plus educational fieldwork is my recommended direction. Jim can promote driving if that is the immediate need.
2. **Begin with C01's checklist and actual wrapper handoff, then C02–C05:** prove platform behavior, protect writes, prove a complete restore, represent gaps, and prevent competing sessions. These are separate deliverable changes, not one large rewrite.
3. **Add controlled sharing and offline usability through C06–C07, then pilot C08–C10 in one class:** a modest activity pack, a few observations, and one GPS-quality exercise are enough to evaluate the teaching value.
4. **Keep C19 and C20 behind explicit decisions:** identify a permissible map source before promising downloadable maps; revisit live groups only if Jim chooses and can sustain an expanded architecture.

For the classroom pilot, assess whether students can start an activity, retain the original data, explain missing/uncertain measurements, export only the intended information, and reopen their submission. These are proposed acceptance goals, not completed tests.

## Evidence and source notes

Repository observations are pinned to the inspected commit. External references were checked on October 24, 2026. Feature priorities, effort estimates, and proposed designs are ChatGPT's judgments. Source inspection does not establish real-device behavior.

- **[R1]** [README: implemented features and documented limitations](https://github.com/carrollj13633/traillog/blob/9cff189bda98dd9c18ca97c5aa886a3a6958f0bc/README.md).
- **[R2]** [Application source](https://github.com/carrollj13633/traillog/blob/9cff189bda98dd9c18ca97c5aa886a3a6958f0bc/js/app.js): `saveMeta`, `onStart`, `recordFix`, `saveRecording`, `exportAll`, `importFiles`, `renderCompat`, and the service-worker update action.
- **[R3]** [Geometry, filtering, statistics, and export source](https://github.com/carrollj13633/traillog/blob/9cff189bda98dd9c18ca97c5aa886a3a6958f0bc/js/geo.js): `acceptFix`, `createStats`, `trackToXml`, and GPX parsing.
- **[R4]** [IndexedDB source](https://github.com/carrollj13633/traillog/blob/9cff189bda98dd9c18ca97c5aa886a3a6958f0bc/js/db.js): shared `active`/`activePts` stores and recording operations.
- **[R5]** [Inspected repository tree](https://github.com/carrollj13633/traillog/tree/9cff189bda98dd9c18ca97c5aa886a3a6958f0bc) and [handoff](https://github.com/carrollj13633/traillog/blob/9cff189bda98dd9c18ca97c5aa886a3a6958f0bc/docs/HANDOFF.md).
- **[R6]** [Brainstorm invitation](https://github.com/carrollj13633/traillog/blob/9cff189bda98dd9c18ca97c5aa886a3a6958f0bc/docs/BRAINSTORM_PROMPT.md) and [Grok's submitted ideas](https://github.com/carrollj13633/traillog/blob/9cff189bda98dd9c18ca97c5aa886a3a6958f0bc/docs/ideas-grok.md).
- **[R7]** [Service worker](https://github.com/carrollj13633/traillog/blob/9cff189bda98dd9c18ca97c5aa886a3a6958f0bc/sw.js): opportunistic tile cache, size limit, shell caching, and network requests.
- **[P1]** [Android: request location permissions](https://developer.android.com/develop/sensors-and-location/location/permissions), distinguishing foreground services from background-location access.
- **[P2]** [Android: foreground service types](https://developer.android.com/develop/background-work/services/fgs/service-types), including location service declarations and prerequisites.
- **[P3]** [W3C Geolocation](https://www.w3.org/TR/geolocation/), especially the Window interface and visibility requirements for position updates.
- **[P4]** [WHATWG Storage Standard](https://storage.spec.whatwg.org/), covering persistence, quota estimates, and storage pressure.
- **[P5]** [W3C Web Share API](https://www.w3.org/TR/web-share/), covering user activation and platform-selected sharing targets.
- **[P6]** [OpenStreetMap Foundation tile usage policy](https://operations.osmfoundation.org/policies/tiles/), covering caching and prohibited offline/prefetch use of the standard raster tile endpoint.
- **[P7]** [WebRTC: peer connections](https://webrtc.org/getting-started/peer-connections), covering signaling and STUN/TURN connectivity.
