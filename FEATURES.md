# Bar Fight — Feature Inventory

This document catalogs the observable behavior of the app as implemented in
`index.html`, `app.js`, and `bpm-detector.js`. It is the contract for the test
suite (`tests/`) and the refactor: **behavior described here must not change
when the code is reorganized.**

Each feature has an ID so tests can reference it (e.g. `it('TIME-2 ...')`).

---

## 1. Song model (MODEL)

- **MODEL-1** A song has a `title` (string), `bpm` (integer), and an ordered
  list of `sections`.
- **MODEL-2** Each section has: `id` (unique positive integer), `type` (one of
  the eight known types), `bars` (number, may be fractional), `bpb` (time
  signature numerator, 1–16), `den` (denominator: 2, 4, 8, or 16), and
  `chords` (free text).
- **MODEL-3** The eight section types, each with a fixed color, are:
  Intro, Verse, Pre-Chorus, Chorus, Bridge, Solo, Outro, Break.
- **MODEL-4** On first load the app starts with a demo song: "New Song",
  120 BPM, nine sections (Intro 4, Verse 8, Chorus 8, Verse 8, Chorus 8,
  Bridge 4, Solo 8, Chorus 8, Outro 4 bars), all 4/4, with chord text.
- **MODEL-5** BPM is always clamped to 20–400.

## 2. Timing math (TIME)

All internal timing is in **quarter-note beats** (BPM = quarter notes per
minute).

- **TIME-1** A section's beats-per-bar in quarter notes is `bpb * 4 / den`
  (e.g. 4/4 → 4, 6/8 → 3, 3/4 → 3, 7/8 → 3.5).
- **TIME-2** Total song beats = sum over sections of `bars * quarterNotesPerBar`.
- **TIME-3** Beats ↔ seconds conversion uses the song BPM:
  `seconds = beats * 60 / bpm`.
- **TIME-4** Section bar counts are quantized to the section's finest step
  (`1 / quarterNotesPerBar`, min 1 quarter note), clamped to
  [step, 64 bars]. Non-numeric input becomes the minimum step.
- **TIME-5** Bar counts display with up to 2 decimal places, trailing zeros
  trimmed (e.g. `4`, `4.5`, `4.25`).
- **TIME-6** `getSectionAt(beat)` maps a beat position to the section under
  it, with the beat offset inside that section; negative beats (audio lead-in)
  are in no section.
- **TIME-7** The song-wide bar number counts bars across sections with mixed
  time signatures (bar 1 is the first bar).

## 3. Timeline (TL)

- **TL-1** The timeline renders one block per section, in order, sized at
  40 px per quarter-note beat, using the section type's color, showing type
  name, `<bars> bars · <bpb>/<den>`, and chords (`—` when empty).
- **TL-2** A ruler above shows a tick per beat with a numbered marker every
  4 beats (bar numbers assuming 4/4 visual grid), starting at the song start
  (after any audio lead-in).
- **TL-3** Clicking the timeline seeks the playhead to the clicked position
  (x px / 40 = beat, adjusted for lead-in).
- **TL-4** Clicking a section block seeks to that section's start.
- **TL-5** The playhead is a vertical line with a `bar.beat` label of its
  position within the current section (`—` outside any section).
- **TL-6** During playback the timeline auto-scrolls to keep the playhead
  centered.
- **TL-7** Sections can be reordered by dragging a block horizontally; the
  dragged section slots in where the pointer passes other sections' midpoints.
- **TL-8** Sections can be resized by dragging a block's left/right edge
  handle; the drag adjusts the neighboring boundary in 1-beat steps, and the
  left handle is hidden on the first section.
- **TL-9** A drag of more than 3 px suppresses the click that would otherwise
  seek.
- **TL-10** With audio loaded, a "Song Start" marker sits at the lead-in
  boundary and can be dragged to set where bar 1 lands in the audio.
- **TL-11** With audio loaded, a waveform renders behind the sections; without
  audio a "Load audio to display waveform" placeholder shows.
- **TL-12** The timeline extends to the longer of the song length or the
  loaded audio length (post-offset).

## 4. Transport & playback (PLAY)

- **PLAY-1** The play button toggles play/pause; its icon reflects state
  (play triangle when stopped/paused, pause bars while playing or counting
  off).
- **PLAY-2** Space bar toggles play/pause, except when focus is in an input,
  textarea, or select. Held-down key repeat does not retrigger.
- **PLAY-3** Without audio, the playhead advances beat-locked from the
  current position using `requestAnimationFrame` and wall-clock time at the
  song BPM.
- **PLAY-4** With audio loaded, the playhead position is derived from the
  audio element's `currentTime` (audio is the clock).
- **PLAY-5** Playback stops automatically at the end of the timeline; the
  playhead rests at the end.
- **PLAY-6** Pressing play when the playhead is at the end restarts from the
  beginning (beat 0, or the start of the audio lead-in when audio is loaded).
- **PLAY-7** The stop button pauses and resets the playhead to the beginning
  (beat 0, or the lead-in start with audio).
- **PLAY-8** Seeking while audio is loaded also moves the audio element's
  `currentTime` to the matching position.
- **PLAY-9** Changing BPM while playing restarts playback at the new tempo
  from the current position.

## 5. Count-off (COUNT)

- **COUNT-1** An optional visual count-off precedes playback: a full-screen
  overlay counts down from N beats to 1 at the song BPM, then playback
  starts.
- **COUNT-2** Count-off is enabled by default with 4 beats; the beats input
  accepts 1–16 and clamps out-of-range/non-numeric values to that range
  (default 4).
- **COUNT-3** Disabling the toggle disables the beats input and cancels any
  running count-off.
- **COUNT-4** Pressing play (or space) during a count-off cancels it without
  starting playback.
- **COUNT-5** Count-off settings are saved in song JSON (`countOff.enabled`,
  `countOff.beats`) and restored on load; missing values fall back to the
  defaults.

## 6. Live section building (LIVE)

- **LIVE-1** Pressing a section shortcut key drops a new section at the
  playhead: `c` Chorus, `v` Verse, `b` Bridge, `i` Intro, `s` Solo,
  `o` Outro, `p` Pre-Chorus, `k` Break.
- **LIVE-2** `a` drops a new section repeating the type of the section under
  the playhead (or the last section when past the end).
- **LIVE-3** The new section starts at 2 bars and inherits the time signature
  of the section it follows, with empty chords.
- **LIVE-4** The section under the playhead is trimmed (bars rounded to the
  nearest bar at the playhead) so it ends where the new section begins; the
  new section is inserted after it.
- **LIVE-5** If the playhead rounds to the very start of the section under
  it, the new section is inserted *before* that section instead of trimming
  it to zero.
- **LIVE-6** If the playhead is past the last section, the last section
  stretches to meet the playhead and the new section is appended.
- **LIVE-7** While live-building without audio, the last section auto-grows
  a bar at a time so playback never runs out of timeline; this mode resets on
  pause/stop.
- **LIVE-8** Shortcuts are ignored when a modifier (Ctrl/Cmd/Alt) is held,
  when focus is in a form field, when the playhead is before beat 0, and on
  key auto-repeat.
- **LIVE-9** Shortcut keys work while paused too (a section is dropped at the
  current playhead position).

## 7. Section editor (EDIT)

- **EDIT-1** The editor lists one row per section with: color swatch, up/down
  move buttons, type dropdown, bars number input, time signature dropdowns
  (numerator 2–12, denominator 2/4/8/16), chords text input, and a remove
  button.
- **EDIT-2** Up/down buttons swap the section with its neighbor; the first
  row's up and last row's down are disabled.
- **EDIT-3** Changing type re-colors the section everywhere immediately.
- **EDIT-4** Bars input is normalized on change per TIME-4 and written back
  into the field.
- **EDIT-5** Changing the time signature re-quantizes the section's bar count
  to the new signature's step.
- **EDIT-6** Chord edits update the timeline and now-playing display live on
  each keystroke without rebuilding the editor (typing keeps focus).
- **EDIT-7** The remove button deletes the section, but the last remaining
  section cannot be removed.
- **EDIT-8** "Add Section" (editor button and sidebar +) appends a 4-bar 4/4
  Verse with a fresh unique id.
- **EDIT-9** The editor panel can be shown/hidden with the editor toggle
  button.

## 8. Sidebar (SIDE)

- **SIDE-1** The sidebar lists one chip per section (color dot, type name,
  bar count); clicking a chip seeks to that section's start.
- **SIDE-2** The chip for the section under the playhead is highlighted as
  active.

## 9. Now-playing header (NP)

- **NP-1** Shows the current section name and chords on the section color,
  the current bar within the section (`bar / total`), and the beat within the
  bar.
- **NP-2** Shows a "Next" preview with the following section's name and
  color, or "End" after the last section.
- **NP-3** A progress bar fills proportionally to the playhead position over
  the whole timeline, labeled
  `Bar <n> / <total> · <elapsed m:ss> / <total m:ss>`.
- **NP-4** When the playhead is outside any section (lead-in), section fields
  show `—` and no timeline block or chip is active.

## 10. Tempo (TEMPO)

- **TEMPO-1** The BPM input sets the song tempo live; values are clamped to
  20–400 and non-numeric input falls back to 60.
- **TEMPO-2** Tap tempo: clicking the Tap button or pressing `t` repeatedly
  sets the BPM from the average interval of the recent taps (clamped 20–400).
- **TEMPO-3** A pause of more than 2 seconds resets the tap series.
- **TEMPO-4** "Detect BPM" analyzes loaded audio (autocorrelation of an onset
  envelope, 70–180 BPM range, first 90 s) and applies the rounded result
  (clamped 20–400) to the song, reporting confidence and up to two
  alternative candidates. The button is disabled with no audio and while
  detecting.
- **TEMPO-5** `BpmDetector.detectFromAudioBuffer(buffer, options)` is a pure
  function of an AudioBuffer-shaped object; it returns
  `{ bpm, confidence, candidates }` (bpm rounded to 0.1) and throws on audio
  too short to analyze.

## 11. Audio (AUD)

- **AUD-1** "Load Audio" decodes a local audio file via the Web Audio API,
  shows its name and duration in the status line, and renders its waveform.
- **AUD-2** Loading audio computes peak data for the waveform (~180 points/s,
  400–8000 total) and resets the playhead to the start of the lead-in.
- **AUD-3** The "Song Start" offset marks where bar 1 begins in the audio;
  timeline content before it is the lead-in. Offsets clamp to
  [0, duration − 0.01 s].
- **AUD-4** Adjusting the offset preserves the audio moment under the
  playhead (the beat shifts by the offset delta).
- **AUD-5** "Clear" removes the audio, waveform, and object URL, and re-clamps
  the playhead; the button is disabled when no audio is loaded. The expected
  file name is kept, so the status shows `No audio loaded · Expected: <name>`
  after clearing.
- **AUD-6** When a loaded song expects an audio file that isn't loaded, the
  status line shows `No audio loaded · Expected: <fileName>`.
- **AUD-7** Audio can also load from a URL (used by song JSON `audio.url`);
  the file name comes from the hint, the URL path, or `server-audio`.

## 12. Save / load song files (FILE)

- **FILE-1** "Save" downloads the song as JSON:
  `{ title, bpm, sections, countOff: { enabled, beats }, audio: { startOffsetSec, fileName, url } }`,
  with `startOffsetSec` rounded to ms.
- **FILE-2** When audio is loaded, the saved JSON embeds it:
  `audio.embedded = { fileName, mimeType, dataUrl }` (base64 data URL), for
  one-file portability.
- **FILE-3** The download filename is the slugified title
  (lowercase, non-alphanumerics → `-`, trimmed) + `.json`, falling back to
  `song.json`.
- **FILE-4** "Load" reads a local JSON file; invalid JSON or an invalid song
  shows an alert and leaves the current song untouched.
- **FILE-5** Loading validates and sanitizes: object with ≥1 section
  required; unknown section type, bad `bpb` (non-integer or outside 1–16), or
  non-positive bars are rejected with a per-section error; bad `den` falls
  back to 4; duplicate/invalid ids are reassigned uniquely; title falls back
  to "Untitled Song"; bpm clamps to 20–400 (default 120); bars are quantized
  per TIME-4.
- **FILE-6** Loading a song stops playback, resets the playhead to 0, clears
  loaded audio, restores count-off settings, applies `audio.startOffsetSec`,
  and continues section ids after the highest loaded id.
- **FILE-7** On load, embedded audio (`audio.embedded.dataUrl`) takes
  priority; otherwise `audio.url` is fetched (resolved relative to the song's
  own URL when it was loaded from one). Failures surface as alerts.

## 13. Load from server URL (URL)

- **URL-1** The toolbar URL button prompts for a song JSON URL (pre-filled
  from the `?song=` query param) and loads it.
- **URL-2** A `?song=<url>` query parameter auto-loads that song on page
  load.
- **URL-3** `github.com/<owner>/<repo>/blob/<path>` URLs are rewritten to
  `raw.githubusercontent.com/<owner>/<repo>/<path>` so CORS works.
- **URL-4** Song JSON is fetched with `cache: 'no-store'`; network errors,
  non-OK responses, and non-JSON bodies produce distinct alert messages.

## 14. Print view (PRINT)

- **PRINT-1** The print button opens an overlay listing the song title and
  every section in order (`<n>. <type>`, color dot and left border, chords or
  "No chords entered").
- **PRINT-2** The overlay closes via its close button, clicking the backdrop,
  or Escape.
- **PRINT-3** A "Print" button inside the overlay re-renders the sheet and
  calls `window.print()`.

## 15. New song (CLEAR)

- **CLEAR-1** "Clear Song" asks for confirmation, then resets to a single
  4-bar 4/4 Verse titled "New Song" at 120 BPM, clears audio and expected
  file name, resets count-off to defaults, and resets the playhead.
- **CLEAR-2** Declining the confirmation changes nothing.

## 16. Shortcuts panel (KEYS)

- **KEYS-1** A toggle button shows/hides a panel listing all live-build keys
  with their section colors, plus `A` repeat, Space play/pause, and `T` tap
  tempo.

---

## Architecture constraints for the refactor

- No build step: plain scripts loaded by `index.html`, runnable from
  `file://` and static nginx. **Classic scripts, not ES modules** (jsdom, the
  test harness, and `file://` all handle classic scripts; ES modules would
  break the harness and `file://`).
- The test harness discovers `<script src>` tags in `index.html` and executes
  them in order in a jsdom window — the refactor may split `app.js` into any
  number of files as long as the script tags are updated and load order is
  respected.
- DOM element ids and user-facing behavior are the stable contract; internal
  function names are free to change (tests interact via the DOM, not
  internals, except the already-public `window.BpmDetector`).
