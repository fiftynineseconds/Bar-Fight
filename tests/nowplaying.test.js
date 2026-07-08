// NP / SIDE-2: the now-playing header and active-section highlighting.
import { describe, it, expect } from 'vitest';
import { loadApp } from './harness.js';

describe('Now-playing header (NP)', () => {
  it('NP-1 / NP-2 / NP-3 shows section, bar, beat, next section, and progress', async () => {
    const app = await loadApp();
    await app.click('#timeline-wrap', { clientX: 18 * 40 }); // beat 18: bar 1 beat 3 of Verse
    expect(app.byId('np-section-name').textContent).toBe('Verse');
    expect(app.byId('np-chords').textContent).toBe('E  A  E  B');
    expect(app.byId('np-bar-num').textContent).toBe('1');
    expect(app.byId('np-bar-total').textContent).toBe('8');
    expect(app.byId('np-beat-num').textContent).toBe('3');
    expect(app.byId('np-next-name').textContent).toBe('Chorus');
    // Beat 18 of 240 at 120 BPM: bar 5 of 60, 0:09 of 2:00
    expect(app.byId('progress-label').textContent).toBe('Bar 5 / 60 · 0:09 / 2:00');
    expect(app.byId('progress-fill').style.width).toBe(`${(18 / 240) * 100}%`);
    app.close();
  });

  it('NP-2 shows "End" after the last section', async () => {
    const app = await loadApp();
    await app.click('#timeline-wrap', { clientX: 239 * 40 });
    expect(app.byId('np-section-name').textContent).toBe('Outro');
    expect(app.byId('np-next-name').textContent).toBe('End');
    app.close();
  });

  it('SIDE-2 / TL highlighting follows the playhead section', async () => {
    const app = await loadApp();
    await app.click('#timeline-wrap', { clientX: 18 * 40 }); // inside first Verse
    const activeChips = app.$$('.sidebar-chip.active');
    expect(activeChips).toHaveLength(1);
    expect(activeChips[0].textContent).toContain('Verse');
    const activeSections = app.$$('.tl-section.active');
    expect(activeSections).toHaveLength(1);
    expect(activeSections[0].querySelector('.tl-section-name').textContent).toBe('Verse');
    app.close();
  });
});
