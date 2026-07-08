# Bar Fight — History

## 2026-06-28 — Initial build

- Project named **Bar Fight**
- Single `index.html`, vanilla JS, no framework, no build step
- Beat-locked scrolling timeline with playhead driven by `requestAnimationFrame`
- Section editor: add/remove/reorder sections with type, bars, time signature, chords
- Now-playing header shows current section, bar, beat, chords, and next section preview
- Click-to-seek on timeline
- Served by nginx in Docker via `docker-compose.yml`
- Future hooks stubbed in compose file for ASP.NET Core API + PostgreSQL

## 2026-07-08 — Feature inventory, test suite, refactor

- `FEATURES.md`: full behavior inventory with stable feature IDs
- `tests/`: vitest + jsdom suite (71 tests) that boots the real `index.html`
  and its scripts, driving the app through the DOM only — written and green
  against the monolithic `app.js` *before* the refactor, unchanged after
- `app.js` (~2,050 lines) split into ten focused classic scripts under `js/`
  (constants, state, timing, countoff, audio, song-io, playback, sections,
  render, main), each an IIFE exporting onto the `window.BarFight` namespace;
  still no build step, still `file://`-friendly
- Dropped the do-nothing `updateAudioOffsetUi()` placeholder

## 2026-07-08 — Live section building

- Keyboard shortcuts add sections at the playhead during playback: `c` Chorus, `v` Verse, `b` Bridge, `i` Intro, `s` Solo, `o` Outro, `p` Pre-Chorus, `k` Break, `a` repeats the current section's type
- The section under the playhead trims (or the last section stretches) to end at the nearest bar line where the new section begins
- New sections start at 2 bars, inheriting the time signature of the section they follow, ready to rename/resize in the editor
- While live-building without loaded audio, the last section auto-extends a bar at a time so playback never stops mid-take (resets on pause/stop)
