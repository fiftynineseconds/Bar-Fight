# Bar Fight

## Initial Prompt

> "Is there an app for musicians where I give it the tempo and song structure then hit play and it gives me a guide to follow while I'm practicing with my band? It could show a timeline like protools with song chords chorus/bridge notes."

## What It Does

- Enter a song's BPM and build a section list (Intro, Verse, Chorus, Bridge, Solo, Outro, etc.)
- Each section has a bar count, time signature, and chord notes
- Hit play — a beat-locked playhead scrolls across the timeline in real time
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

Currently: a single `index.html` served by nginx in Docker.

Future plans:
- **Backend:** C# / ASP.NET Core
- **Database:** PostgreSQL (preferred) or SQL Server
- **Auth:** to be added before any persistence features
- **Goal:** save/load songs per user

## TODO:

- [ ] Optimize for iPad
- [ ] It should have some kind of flashing button or something that is an indicator of the tempo, and be switchable between on and off. It could even play a click and have that be a toggle.

## Docker Setup

`docker-compose.yml` runs a single nginx container serving `index.html`.
Structure is intentionally minimal so a C# API container and a database container can be added to the compose file later without rearchitecting.

run docker compose up then navigate to localhost:8080
