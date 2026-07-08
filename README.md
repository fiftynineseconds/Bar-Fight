# Bar Fight

## Initial Prompt

> "Is there an app for musicians where I give it the tempo and song structure then hit play and it gives me a guide to follow while I'm practicing with my band? It could show a timeline like protools with song chords chorus/bridge notes."

## What It Does

- Enter a song's BPM and build a section list (Intro, Verse, Chorus, Bridge, Solo, Outro, etc.)
- Each section has a bar count, time signature, and chord notes
- Hit play — a beat-locked playhead scrolls across the timeline in real time
- Build a song live during playback: press `c` (Chorus), `v` (Verse), `b` (Bridge), `i` (Intro), `s` (Solo), `o` (Outro), `p` (Pre-Chorus), `k` (Break), or `a` (repeat current section type) to drop a new 2-bar section at the playhead, snapped to the nearest bar — the previous section trims or stretches to meet it. Without loaded audio, the last section auto-extends during a live-build take so playback never runs out of runway
- A header bar shows the current section, bar number, beat, and chords at a glance, with a "Next: [section]" preview
- Click anywhere on the timeline to seek
- Save songs to a portable JSON file (including currently loaded audio) and load them back from disk
- Load song JSON from a server URL (toolbar button or `?song=` query param)
- Optionally load audio, view waveform, and drag a timeline "Song Start" marker to line sections up visually
- Detect BPM from loaded audio and apply it to the timeline tempo
- Song JSON now includes optional `audio` metadata (`startOffsetSec`, `fileName`, `url`) and optional embedded base64 audio data for one-file portability

### Server-Load JSON Format

`audio.embedded` takes priority when present. If not present, `audio.url` is loaded (resolved relative to the song JSON URL).

```json
{
	"title": "My Song",
	"bpm": 120,
	"sections": [
		{ "id": 1, "type": "Intro", "bars": 4, "bpb": 4, "den": 4, "chords": "E A B A" }
	],
	"audio": {
		"startOffsetSec": 1.25,
		"fileName": "song-mix.mp3",
		"url": "./song-mix.mp3"
	}
}
```

## Stack & Structure

Plain static files, no framework, no build step — `index.html` loads classic scripts (works from `file://` and any static server):

- `js/constants.js` — layout metrics, section palette, keyboard shortcuts
- `js/state.js` — the single mutable app state (`window.BarFight.state`)
- `js/timing.js` — beat/bar/second/pixel math
- `js/countoff.js` — visual count-off
- `js/audio.js` — audio loading, waveform, song-start offset, BPM detect wiring
- `js/song-io.js` — song JSON validation, save/load, URL fetch
- `js/playback.js` — transport and the rAF tick loop
- `js/sections.js` — section add/reorder/live-build/drag interactions
- `js/render.js` — all DOM rendering
- `js/main.js` — event wiring and startup
- `bpm-detector.js` — standalone BPM detection (`window.BpmDetector`)

Each file is an IIFE exporting onto the `window.BarFight` namespace (kept as classic scripts, not ES modules, so the app stays build-free and the test harness can run it in jsdom).

### Features & Tests

- `FEATURES.md` catalogs every behavior with stable IDs (MODEL-1, PLAY-3, …).
- `tests/` is a vitest + jsdom suite that boots the real `index.html` + scripts and drives the app through the DOM. Run with:

```
npm install
npm test
```

Docker isn't necessary at this point.

Future plans:
- **Backend:** C# / ASP.NET Core
- **Database:** PostgreSQL (preferred) or SQL Server
- **Auth:** to be added before any persistence features
- **Goal:** save/load songs per user

## Docker Setup

`docker-compose.yml` runs a single nginx container serving `index.html`.
Structure is intentionally minimal so a C# API container and a database container can be added to the compose file later without rearchitecting.

run docker compose up then navigate to localhost:8080 or just server index.html with app.js in the same dir.
