// PLAY / TEMPO-1: play/pause/stop, beat-locked playhead, BPM clamping.
import { describe, it, expect } from 'vitest';
import { loadApp } from './harness.js';

describe('Transport & playback (PLAY)', () => {
  it('PLAY-1 / PLAY-3 space starts beat-locked playback at the song BPM', async () => {
    const app = await loadApp();
    await app.disableCountOff();
    expect(app.isPlaying()).toBe(false);
    await app.key(' ');
    expect(app.isPlaying()).toBe(true);
    await app.clock.frame(0);   // first frame anchors the start time
    await app.clock.frame(500); // 0.5s at 120 BPM = 1 beat
    expect(app.playheadLeftPx()).toBeCloseTo(40, 3);
    await app.clock.frame(500);
    expect(app.playheadLeftPx()).toBeCloseTo(80, 3);
    await app.key(' ');
    expect(app.isPlaying()).toBe(false);
    app.close();
  });

  it('PLAY-2 space is ignored while typing in a field', async () => {
    const app = await loadApp();
    await app.disableCountOff();
    app.byId('song-title').focus();
    await app.key(' ');
    expect(app.isPlaying()).toBe(false);
    app.close();
  });

  it('PLAY-2 held-down space does not retrigger', async () => {
    const app = await loadApp();
    await app.disableCountOff();
    await app.key(' ');
    expect(app.isPlaying()).toBe(true);
    await app.key(' ', { repeat: true });
    expect(app.isPlaying()).toBe(true);
    app.close();
  });

  it('PLAY-5 / PLAY-6 playback stops at the end and restarts from the top', async () => {
    const app = await loadApp();
    await app.disableCountOff();
    await app.click('#timeline-wrap', { clientX: 238 * 40 }); // 2 beats before the end
    await app.key(' ');
    await app.clock.frame(0);
    await app.clock.frame(2000); // 4 beats — overshoots the end
    expect(app.isPlaying()).toBe(false);
    // The displayed playhead rests an epsilon inside the end of the timeline.
    expect(app.playheadLeftPx()).toBeCloseTo(240 * 40, 1);
    // Play again: restarts from the beginning
    await app.key(' ');
    expect(app.isPlaying()).toBe(true);
    await app.clock.frame(0);
    await app.clock.frame(500);
    expect(app.playheadLeftPx()).toBeCloseTo(40, 3);
    app.close();
  });

  it('PLAY-7 stop pauses and resets the playhead', async () => {
    const app = await loadApp();
    await app.disableCountOff();
    await app.click('#timeline-wrap', { clientX: 800 });
    await app.key(' ');
    await app.click('#stop-btn');
    expect(app.isPlaying()).toBe(false);
    expect(app.playheadLeftPx()).toBe(0);
    app.close();
  });

  it('TEMPO-1 BPM input clamps to 20-400 and falls back to 60', async () => {
    const app = await loadApp();
    // Total 240 beats. At 400 BPM that is 36s; progress label shows total time.
    await app.setInput('#bpm-input', '9999');
    expect(app.byId('progress-label').textContent).toContain('0:36');
    await app.setInput('#bpm-input', '5'); // clamps to 20 -> 720s
    expect(app.byId('progress-label').textContent).toContain('12:00');
    await app.setInput('#bpm-input', 'abc'); // falls back to 60 -> 240s
    expect(app.byId('progress-label').textContent).toContain('4:00');
    app.close();
  });
});
