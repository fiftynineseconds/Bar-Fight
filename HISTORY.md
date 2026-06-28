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
