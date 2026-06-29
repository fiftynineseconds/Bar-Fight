# Bar Fight

## Initial Prompt

> "Is there an app for musicians where I give it the tempo and song structure then hit play and it gives me a guide to follow while I'm practicing with my band? It could show a timeline like protools with song chords chorus/bridge notes."

## What It Does

- Enter a song's BPM and build a section list (Intro, Verse, Chorus, Bridge, Solo, Outro, etc.)
- Each section has a bar count, time signature, and chord notes
- Hit play — a beat-locked playhead scrolls across the timeline in real time
- A header bar shows the current section, bar number, beat, and chords at a glance, with a "Next: [section]" preview
- Click anywhere on the timeline to seek

## Design

- Dark DAW-inspired UI — think Pro Tools, not a music app
- Monospace font throughout
- Each section type has its own accent color; active section glows
- Single HTML file + vanilla JS, no framework, no build step

## Stack & Structure

Currently: a single `index.html` served by nginx in Docker.

Future plans:
- **Backend:** C# / ASP.NET Core
- **Database:** PostgreSQL (preferred) or SQL Server
- **Auth:** to be added before any persistence features
- **Goal:** save/load songs per user

## TODO:

- [ ] Add tap tempo
- [ ] Optimize for iPad
- [ ] Keep a `HISTORY.md` file — log all features and changes as a running quick log
- [ ] It should have some kind of flashing button or something that is an indicator of the tempo, and be switchable between on and off. It could even play a click and have that be a toggle.
- [ ] Underneath the scrolling area should be a new feature that shows you all of the upcoming parts of the song in a quick view.
- [ ] Set tempo by listening to the song through mic.

## Docker Setup

`docker-compose.yml` runs a single nginx container serving `index.html`.
Structure is intentionally minimal so a C# API container and a database container can be added to the compose file later without rearchitecting.

run docker compose up then navigate to localhost:8080
