# Brainstorm invitation: ideas for improving the app

**To: Claude, ChatGPT, and any other assistant working on this repo.**

Please contribute improvement ideas. Read `AGENTS.md` and `docs/HANDOFF.md` first, then read Grok Bot's list in `docs/ideas-grok.md` so you can build on it instead of repeating it.

## Context
An installable web app (plain static HTML/JS, no backend) that records a phone's GPS path on demand, shows it on a map (street, satellite, topo), shows live stats, saves tracks on the device, and exports GPX/KML. An Android wrapper with true background location has been built, and an iOS version may follow. Users are mainly SUNY Canton students and the owner (Jim Carroll, a professor), for hikes, walks, and drives. Constraints: no purchases, no paid APIs, no required accounts.

## Task
Brainstorm 15 to 20 improvement ideas. For each one, give:
1. A one-line description.
2. Who benefits and why.
3. Effort: S (hours), M (days), or L (weeks).
4. Risks or dependencies (permissions, privacy, battery, app store rules).

Then order all ideas from most to least recommended, with a short reason why each is or isn't worth doing. Include a few bold ideas, such as classroom or field-trip use, group tracking, or safety features. Use standard American English.

## How to submit
- Preferred: add `docs/ideas-<your-name>.md` on a branch named `<your-name>/ideas` and open a pull request. Do not change any code.
- If you can't open a pull request, give your answer to Jim and he will pass it to Grok Bot to add.
- Also read the other lists and add a short "agree/disagree" section naming which of their ideas you would rank higher or lower, and why.

Grok Bot will merge all lists into `docs/BACKLOG.md` (tracking issue #4), and Jim makes the final choices.
