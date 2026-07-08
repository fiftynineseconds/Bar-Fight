// COUNT: visual count-off before playback.
import { describe, it, expect } from 'vitest';
import { loadApp } from './harness.js';

describe('Count-off (COUNT)', () => {
  it('COUNT-2 defaults to enabled with 4 beats and clamps the input to 1-16', async () => {
    const app = await loadApp();
    expect(app.byId('countoff-toggle').checked).toBe(true);
    expect(app.byId('countoff-beats').value).toBe('4');
    await app.setInput('#countoff-beats', '99');
    expect(app.byId('countoff-beats').value).toBe('16');
    await app.setInput('#countoff-beats', '0');
    expect(app.byId('countoff-beats').value).toBe('1');
    await app.setInput('#countoff-beats', 'abc');
    expect(app.byId('countoff-beats').value).toBe('4');
    app.close();
  });

  it('COUNT-1 counts down at the song BPM, then playback starts', async () => {
    const app = await loadApp();
    const overlay = app.byId('countoff-overlay');
    await app.key(' ');
    expect(overlay.classList.contains('show')).toBe(true);
    expect(app.byId('countoff-value').textContent).toBe('4');
    expect(app.playheadLeftPx()).toBe(0); // playback has not started yet
    await app.clock.tick(500); // one beat at 120 BPM
    expect(app.byId('countoff-value').textContent).toBe('3');
    await app.clock.tick(500);
    await app.clock.tick(500);
    expect(app.byId('countoff-value').textContent).toBe('1');
    await app.clock.tick(500);
    expect(overlay.classList.contains('show')).toBe(false);
    expect(app.isPlaying()).toBe(true);
    await app.clock.frame(0);
    await app.clock.frame(500);
    expect(app.playheadLeftPx()).toBeCloseTo(40, 3);
    app.close();
  });

  it('COUNT-1 play button shows pause state during the count-off', async () => {
    const app = await loadApp();
    await app.key(' ');
    expect(app.byId('play-btn').title).toBe('Pause');
    app.close();
  });

  it('COUNT-4 pressing play during the count-off cancels it', async () => {
    const app = await loadApp();
    await app.key(' ');
    await app.clock.tick(500);
    await app.key(' '); // cancel
    expect(app.byId('countoff-overlay').classList.contains('show')).toBe(false);
    expect(app.isPlaying()).toBe(false);
    await app.clock.tick(3000); // nothing pending starts playback later
    expect(app.isPlaying()).toBe(false);
    app.close();
  });

  it('COUNT-3 disabling the toggle disables the beats input and cancels a running count-off', async () => {
    const app = await loadApp();
    await app.key(' ');
    const toggle = app.byId('countoff-toggle');
    toggle.checked = false;
    toggle.dispatchEvent(new app.window.Event('change', { bubbles: true }));
    await app.clock.flush();
    expect(app.byId('countoff-overlay').classList.contains('show')).toBe(false);
    expect(app.byId('countoff-beats').disabled).toBe(true);
    expect(app.isPlaying()).toBe(false);
    app.close();
  });
});
