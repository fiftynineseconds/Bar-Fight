// AUD / TL-10 / TL-11: audio loading, song-start offset, clearing.
import { describe, it, expect } from 'vitest';
import { loadApp } from './harness.js';

async function loadTestAudio(app, name = 'song-mix.mp3') {
  const file = new app.window.File([new Uint8Array([1, 2, 3, 4])], name, { type: 'audio/mpeg' });
  await app.chooseFile('load-audio-input', file);
}

describe('Audio (AUD)', () => {
  it('AUD-1 / TL-10 / TL-11 loading audio shows status, waveform, and song-start marker', async () => {
    const app = await loadApp(); // default fake decode: 10s buffer
    expect(app.byId('audio-status').textContent).toBe('No audio loaded');
    expect(app.byId('clear-audio-btn').disabled).toBe(true);

    await loadTestAudio(app);
    expect(app.byId('audio-status').textContent).toBe('song-mix.mp3 (0:10) · Drag Song Start in timeline');
    expect(app.byId('waveform-layer')).not.toBeNull();
    expect(app.byId('waveform-empty')).toBeNull();
    expect(app.byId('song-start-marker')).not.toBeNull();
    expect(app.byId('clear-audio-btn').disabled).toBe(false);
    app.close();
  });

  it('AUD-3 / AUD-4 dragging the song-start marker sets the offset and keeps the playhead pinned', async () => {
    const app = await loadApp();
    await loadTestAudio(app);
    await app.click('#timeline-wrap', { clientX: 160 }); // beat 4
    const before = app.playheadLeftPx();

    app.pointer('pointerdown', '#song-start-marker', { clientX: 0 });
    app.pointer('pointermove', app.window, { clientX: 80 }); // 2 beats = 1s at 120 BPM
    app.pointer('pointerup', app.window, { clientX: 80 });
    await app.clock.flush();

    expect(parseFloat(app.byId('song-start-marker').style.left)).toBe(80);
    // The playhead keeps pointing at the same audio moment (same visual px).
    expect(app.playheadLeftPx()).toBe(before);
    app.close();
  });

  it('AUD-5 clearing audio removes waveform, marker, and status', async () => {
    const app = await loadApp();
    await loadTestAudio(app);
    await app.click('#clear-audio-btn');
    // The song still remembers which audio file it expects after a clear.
    expect(app.byId('audio-status').textContent).toBe('No audio loaded · Expected: song-mix.mp3');
    expect(app.byId('song-start-marker')).toBeNull();
    expect(app.byId('waveform-empty')).not.toBeNull();
    expect(app.byId('clear-audio-btn').disabled).toBe(true);
    app.close();
  });

  it('AUD-6 a song expecting audio shows the expected file name', async () => {
    const app = await loadApp();
    const song = {
      title: 'Needs Audio',
      bpm: 100,
      sections: [{ id: 1, type: 'Verse', bars: 4, bpb: 4, den: 4, chords: '' }],
      audio: { startOffsetSec: 0, fileName: 'mix.mp3', url: '' },
    };
    const file = new app.window.File([JSON.stringify(song)], 'song.json', { type: 'application/json' });
    await app.chooseFile('load-song-input', file);
    expect(app.byId('audio-status').textContent).toBe('No audio loaded · Expected: mix.mp3');
    app.close();
  });
});
