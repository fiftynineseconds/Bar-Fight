// LIVE: keyboard section building at the playhead.
import { describe, it, expect } from 'vitest';
import { loadApp } from './harness.js';

describe('Live section building (LIVE)', () => {
  it('LIVE-1 / LIVE-3 / LIVE-4 a shortcut trims the current section and inserts a new 2-bar one', async () => {
    const app = await loadApp();
    // Beat 24 = 2 bars into the first Verse (which starts at beat 16)
    await app.click('#timeline-wrap', { clientX: 24 * 40 });
    await app.key('b');
    expect(app.sidebarTypes().slice(0, 4)).toEqual(['Intro', 'Verse', 'Bridge', 'Chorus']);
    const rows = app.editorRows();
    expect(rows[1].bars).toBe('2'); // Verse trimmed to the playhead
    expect(rows[2].type).toBe('Bridge');
    expect(rows[2].bars).toBe('2'); // new section starts at 2 bars
    expect(rows[2].bpb).toBe('4'); // inherits time signature
    expect(rows[2].den).toBe('4');
    expect(rows[2].chords).toBe('');
    app.close();
  });

  it('LIVE-5 at a section boundary the new section is inserted before, not trimming to zero', async () => {
    const app = await loadApp();
    await app.click('#timeline-wrap', { clientX: 16 * 40 }); // exactly at Verse start
    await app.key('c');
    expect(app.sidebarTypes().slice(0, 3)).toEqual(['Intro', 'Chorus', 'Verse']);
    expect(app.editorRows()[2].bars).toBe('8'); // Verse untouched
    app.close();
  });

  it('LIVE-2 "a" repeats the current section type', async () => {
    const app = await loadApp();
    await app.click('#timeline-wrap', { clientX: 24 * 40 }); // inside Verse
    await app.key('a');
    expect(app.sidebarTypes().slice(0, 3)).toEqual(['Intro', 'Verse', 'Verse']);
    app.close();
  });

  it('LIVE-6 past the last section, it stretches to meet the playhead and the new section is appended', async () => {
    const app = await loadApp();
    await app.click('#timeline-wrap', { clientX: 240 * 40 }); // clamped to the very end
    await app.key('s');
    const types = app.sidebarTypes();
    expect(types).toHaveLength(10);
    expect(types[9]).toBe('Solo');
    expect(app.editorRows()[8].bars).toBe('4'); // Outro already reached the playhead
    app.close();
  });

  it('LIVE-8 shortcuts are ignored with modifiers, on repeat, and while typing', async () => {
    const app = await loadApp();
    await app.key('c', { ctrlKey: true });
    await app.key('c', { repeat: true });
    app.byId('song-title').focus();
    await app.key('c');
    expect(app.sidebarTypes()).toHaveLength(9);
    app.close();
  });

  it('LIVE-7 while live-building without audio, the last section grows so playback continues', async () => {
    const app = await loadApp({ confirmResult: true });
    await app.click('#clear-song-btn'); // 1 Verse, 4 bars = 16 beats
    await app.disableCountOff();
    await app.key(' ');
    await app.clock.frame(0);
    await app.clock.frame(4000); // beat 8
    await app.key('v'); // live-build: Verse trimmed to 2 bars + new 2-bar Verse
    expect(app.sidebarTypes()).toEqual(['Verse', 'Verse']);
    // Total is 4 bars = 16 beats; run past it — the last section should grow, not stop.
    await app.clock.frame(5000); // beat 18
    expect(app.isPlaying()).toBe(true);
    expect(Number(app.editorRows()[1].bars)).toBeGreaterThan(2);
    // Pause resets live-build mode: playback now ends at the timeline end.
    await app.key(' ');
    const barsAfterPause = app.editorRows()[1].bars;
    await app.key(' ');
    await app.clock.frame(0);
    await app.clock.frame(60000);
    expect(app.isPlaying()).toBe(false);
    expect(app.editorRows()[1].bars).toBe(barsAfterPause);
    app.close();
  });

  it('LIVE-9 shortcuts also work while paused', async () => {
    const app = await loadApp();
    expect(app.isPlaying()).toBe(false);
    await app.click('#timeline-wrap', { clientX: 24 * 40 });
    await app.key('k');
    expect(app.sidebarTypes()[2]).toBe('Break');
    app.close();
  });
});
