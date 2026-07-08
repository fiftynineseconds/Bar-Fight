// FILE / COUNT-5: saving and loading song JSON.
import { describe, it, expect } from 'vitest';
import { loadApp } from './harness.js';

const validSong = () => ({
  title: 'Loaded Song',
  bpm: 96,
  sections: [
    { id: 1, type: 'Intro', bars: 2, bpb: 4, den: 4, chords: 'A D' },
    { id: 2, type: 'Verse', bars: 8, bpb: 3, den: 4, chords: 'A E' },
  ],
});

async function loadSongJson(app, obj, raw = null) {
  const file = new app.window.File([raw ?? JSON.stringify(obj)], 'song.json', { type: 'application/json' });
  await app.chooseFile('load-song-input', file);
}

describe('Save / load song files (FILE)', () => {
  it('FILE-1 / FILE-3 save downloads the song JSON with a slugified filename', async () => {
    const app = await loadApp();
    await app.click('#save-song-btn');
    await app.waitUntil(() => app.saves.length > 0);
    expect(app.saves[0].download).toBe('new-song.json');
    const payload = JSON.parse(await app.objectUrls.at(-1).text());
    expect(payload.title).toBe('New Song');
    expect(payload.bpm).toBe(120);
    expect(payload.sections).toHaveLength(9);
    expect(payload.sections[0]).toMatchObject({ type: 'Intro', bars: 4, bpb: 4, den: 4 });
    expect(payload.countOff).toEqual({ enabled: true, beats: 4 });
    expect(payload.audio).toMatchObject({ startOffsetSec: 0, fileName: '', url: '' });
    expect(payload.audio.embedded).toBeUndefined();
    app.close();
  });

  it('FILE-3 an odd title still produces a usable filename', async () => {
    const app = await loadApp();
    await app.setInput('#song-title', '  Héy!! Zeus?? ');
    await app.click('#save-song-btn');
    await app.waitUntil(() => app.saves.length > 0);
    expect(app.saves[0].download).toBe('h-y-zeus.json');
    app.close();
  });

  it('FILE-2 with audio loaded, the save embeds it as a base64 data URL', async () => {
    const app = await loadApp();
    const audio = new app.window.File([new Uint8Array([7, 7, 7])], 'take1.mp3', { type: 'audio/mpeg' });
    await app.chooseFile('load-audio-input', audio);
    await app.click('#save-song-btn');
    await app.waitUntil(() => app.saves.length > 0);
    const payload = JSON.parse(await app.objectUrls.at(-1).text());
    expect(payload.audio.fileName).toBe('take1.mp3');
    expect(payload.audio.embedded.fileName).toBe('take1.mp3');
    expect(payload.audio.embedded.mimeType).toBe('audio/mpeg');
    expect(payload.audio.embedded.dataUrl).toMatch(/^data:audio\/mpeg;base64,/);
    app.close();
  });

  it('FILE-4 invalid JSON alerts and leaves the song untouched', async () => {
    const app = await loadApp();
    await loadSongJson(app, null, '{ not json');
    expect(app.alerts.some((a) => /could not parse/i.test(a))).toBe(true);
    expect(app.byId('song-title').value).toBe('New Song');
    expect(app.editorRows()).toHaveLength(9);
    app.close();
  });

  it('FILE-5 rejects structurally invalid songs with per-section errors', async () => {
    const app = await loadApp();
    await loadSongJson(app, { title: 'X', bpm: 100, sections: [] });
    expect(app.alerts.at(-1)).toMatch(/at least one section/i);

    await loadSongJson(app, { sections: [{ type: 'Chors', bars: 4, bpb: 4, den: 4 }] });
    expect(app.alerts.at(-1)).toMatch(/unsupported type/i);

    await loadSongJson(app, { sections: [{ type: 'Verse', bars: 4, bpb: 99, den: 4 }] });
    expect(app.alerts.at(-1)).toMatch(/time signature/i);

    await loadSongJson(app, { sections: [{ type: 'Verse', bars: -1, bpb: 4, den: 4 }] });
    expect(app.alerts.at(-1)).toMatch(/bar count/i);

    // Nothing was applied
    expect(app.editorRows()).toHaveLength(9);
    app.close();
  });

  it('FILE-5 sanitizes recoverable fields (title, bpm, den, duplicate ids)', async () => {
    const app = await loadApp();
    await loadSongJson(app, {
      bpm: 9999,
      sections: [
        { id: 5, type: 'Verse', bars: 4, bpb: 4, den: 7, chords: '' },
        { id: 5, type: 'Chorus', bars: 4, bpb: 4, den: 4, chords: '' },
      ],
    });
    expect(app.byId('song-title').value).toBe('Untitled Song');
    expect(app.byId('bpm-input').value).toBe('400');
    const rows = app.editorRows();
    expect(rows).toHaveLength(2);
    expect(rows[0].den).toBe('4'); // bad denominator falls back to 4
    app.close();
  });

  it('FILE-6 / COUNT-5 loading applies count-off settings and resets the playhead', async () => {
    const app = await loadApp();
    await app.click('#timeline-wrap', { clientX: 800 });
    const song = { ...validSong(), countOff: { enabled: false, beats: 8 } };
    await loadSongJson(app, song);
    expect(app.byId('song-title').value).toBe('Loaded Song');
    expect(app.byId('bpm-input').value).toBe('96');
    expect(app.sidebarTypes()).toEqual(['Intro', 'Verse']);
    expect(app.byId('countoff-toggle').checked).toBe(false);
    expect(app.byId('countoff-beats').value).toBe('8');
    expect(app.byId('countoff-beats').disabled).toBe(true);
    expect(app.playheadLeftPx()).toBe(0);
    app.close();
  });

  it('FILE-6 new sections after a load continue from the highest loaded id', async () => {
    const app = await loadApp();
    await loadSongJson(app, validSong());
    // Add a section; it must render as a distinct third section (no id collision)
    await app.click('#add-section-btn');
    expect(app.editorRows()).toHaveLength(3);
    const ids = app.$$('.tl-section').map((el) => el.dataset.id);
    expect(new Set(ids).size).toBe(3);
    app.close();
  });

  it('FILE-7 embedded audio in the JSON is loaded on song load', async () => {
    const app = await loadApp();
    const dataUrl = `data:audio/mpeg;base64,${Buffer.from([9, 9, 9]).toString('base64')}`;
    const song = {
      ...validSong(),
      audio: {
        startOffsetSec: 0,
        fileName: 'embedded.mp3',
        url: '',
        embedded: { fileName: 'embedded.mp3', mimeType: 'audio/mpeg', dataUrl },
      },
    };
    await loadSongJson(app, song);
    await app.waitUntil(() => app.byId('audio-status').textContent.includes('embedded.mp3 (0:10)'));
    app.close();
  });
});
