// PRINT / CLEAR / KEYS: print view, clear song, shortcuts panel.
import { describe, it, expect } from 'vitest';
import { loadApp } from './harness.js';

describe('Print view (PRINT)', () => {
  it('PRINT-1 lists every section with chords or a placeholder', async () => {
    const app = await loadApp();
    // Clear the first section's chords to exercise the placeholder
    await app.setInput(app.editorRows()[0].row.querySelector('.chord-in'), '');
    await app.click('#print-view-btn');
    const overlay = app.byId('print-view-overlay');
    expect(overlay.classList.contains('open')).toBe(true);
    expect(app.byId('print-song-title').textContent).toBe('New Song');
    const rows = app.$$('.print-section-row');
    expect(rows).toHaveLength(9);
    expect(rows[0].querySelector('.print-section-name').textContent).toBe('1. Intro');
    expect(rows[0].querySelector('.print-section-chords').textContent).toBe('No chords entered');
    expect(rows[1].querySelector('.print-section-chords').textContent).toBe('E  A  E  B');
    app.close();
  });

  it('PRINT-2 closes via button, backdrop, and Escape', async () => {
    const app = await loadApp();
    const overlay = app.byId('print-view-overlay');

    await app.click('#print-view-btn');
    await app.click('#close-print-view-btn');
    expect(overlay.classList.contains('open')).toBe(false);

    await app.click('#print-view-btn');
    await app.click(overlay); // backdrop click (target is the overlay itself)
    expect(overlay.classList.contains('open')).toBe(false);

    await app.click('#print-view-btn');
    await app.key('Escape');
    expect(overlay.classList.contains('open')).toBe(false);
    app.close();
  });

  it('PRINT-3 the print button invokes window.print', async () => {
    const app = await loadApp();
    await app.click('#print-view-btn');
    await app.click('#print-sheet-btn');
    expect(app.prints).toBe(1);
    app.close();
  });
});

describe('New song (CLEAR)', () => {
  it('CLEAR-1 confirming resets to a single fresh Verse', async () => {
    const app = await loadApp({ confirmResult: true });
    await app.setInput('#song-title', 'My Masterpiece');
    await app.setInput('#countoff-beats', '9');
    await app.click('#clear-song-btn');
    expect(app.confirms).toHaveLength(1);
    expect(app.byId('song-title').value).toBe('New Song');
    expect(app.byId('bpm-input').value).toBe('120');
    expect(app.editorRows()).toHaveLength(1);
    expect(app.editorRows()[0]).toMatchObject({ type: 'Verse', bars: '4', bpb: '4', den: '4', chords: '' });
    expect(app.byId('countoff-beats').value).toBe('4');
    expect(app.playheadLeftPx()).toBe(0);
    app.close();
  });

  it('CLEAR-2 declining the confirmation changes nothing', async () => {
    const app = await loadApp({ confirmResult: false });
    await app.setInput('#song-title', 'Keep Me');
    await app.click('#clear-song-btn');
    expect(app.byId('song-title').value).toBe('Keep Me');
    expect(app.editorRows()).toHaveLength(9);
    app.close();
  });
});

describe('Shortcuts panel (KEYS)', () => {
  it('KEYS-1 the toggle reveals the live-build key listing', async () => {
    const app = await loadApp();
    const panel = app.byId('shortcuts-panel');
    expect(panel.hidden).toBe(true);
    await app.click('#shortcuts-toggle');
    expect(panel.hidden).toBe(false);
    const text = panel.textContent;
    for (const label of ['Chorus', 'Verse', 'Bridge', 'Intro', 'Solo', 'Outro', 'Pre-Chorus', 'Break', 'Repeat section', 'Play / Pause', 'Tap tempo']) {
      expect(text).toContain(label);
    }
    await app.click('#shortcuts-toggle');
    expect(panel.hidden).toBe(true);
    app.close();
  });
});
