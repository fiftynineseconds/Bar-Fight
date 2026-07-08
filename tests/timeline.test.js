// TL: seeking, drag-reorder, drag-resize, click suppression.
import { describe, it, expect } from 'vitest';
import { loadApp } from './harness.js';

describe('Timeline interactions (TL)', () => {
  it('TL-3 / TL-5 clicking the timeline seeks and labels the playhead bar.beat', async () => {
    const app = await loadApp();
    await app.click('#timeline-wrap', { clientX: 400 }); // beat 10
    expect(app.playheadLeftPx()).toBe(400);
    // Beat 10 inside Intro (4 bars of 4/4): bar 3, beat 3
    expect(app.byId('playhead-label').textContent).toBe('3.3');
    app.close();
  });

  it('TL-4 clicking a section block seeks to its start', async () => {
    const app = await loadApp();
    await app.click(app.timelineSections()[1].el, { clientX: 700 });
    expect(app.playheadLeftPx()).toBe(16 * 40);
    app.close();
  });

  it('SIDE-1 clicking a sidebar chip seeks to that section start', async () => {
    const app = await loadApp();
    await app.click(app.$$('.sidebar-chip')[2]); // Chorus starts at beat 48
    expect(app.playheadLeftPx()).toBe(48 * 40);
    app.close();
  });

  it('TL-7 dragging a section block reorders sections', async () => {
    const app = await loadApp();
    const verse = app.timelineSections()[1].el;
    app.pointer('pointerdown', verse, { clientX: 700 });
    app.pointer('pointermove', app.window, { clientX: 100 });
    app.pointer('pointerup', app.window, { clientX: 100 });
    await app.clock.flush();
    expect(app.sidebarTypes().slice(0, 2)).toEqual(['Verse', 'Intro']);
    app.close();
  });

  it('TL-8 dragging a resize handle changes the neighbor boundary in whole beats', async () => {
    const app = await loadApp();
    const rightHandle = app.timelineSections()[0].el.querySelector('.tl-section-handle.right');
    app.pointer('pointerdown', rightHandle, { clientX: 640 });
    app.pointer('pointermove', app.window, { clientX: 800 }); // +4 beats = +1 bar
    app.pointer('pointerup', app.window, { clientX: 800 });
    await app.clock.flush();
    expect(app.editorRows()[0].bars).toBe('5');
    app.close();
  });

  it('TL-8 the first section has no left resize handle', async () => {
    const app = await loadApp();
    const sections = app.timelineSections();
    expect(sections[0].el.querySelector('.tl-section-handle.left').style.display).toBe('none');
    expect(sections[1].el.querySelector('.tl-section-handle.left').style.display).toBe('');
    app.close();
  });

  it('TL-9 a drag suppresses the click that would otherwise seek', async () => {
    const app = await loadApp();
    const rightHandle = app.timelineSections()[0].el.querySelector('.tl-section-handle.right');
    app.pointer('pointerdown', rightHandle, { clientX: 640 });
    app.pointer('pointermove', app.window, { clientX: 720 });
    app.pointer('pointerup', app.window, { clientX: 720 });
    await app.clock.flush();
    const before = app.playheadLeftPx();
    await app.click('#timeline-wrap', { clientX: 4000 }); // swallowed by the drag
    expect(app.playheadLeftPx()).toBe(before);
    await app.click('#timeline-wrap', { clientX: 4000 }); // next click seeks again
    expect(app.playheadLeftPx()).toBe(4000);
    app.close();
  });

  it('TL-11 shows a waveform placeholder without audio', async () => {
    const app = await loadApp();
    expect(app.byId('waveform-empty')).not.toBeNull();
    expect(app.byId('waveform-empty').textContent).toMatch(/load audio/i);
    app.close();
  });
});
