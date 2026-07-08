// MODEL / TIME: song model defaults, section types, timeline geometry.
import { describe, it, expect } from 'vitest';
import { loadApp } from './harness.js';

describe('Song model (MODEL)', () => {
  it('MODEL-4 starts with the demo song', async () => {
    const app = await loadApp();
    expect(app.byId('song-title').value).toBe('New Song');
    expect(app.byId('bpm-input').value).toBe('120');
    expect(app.sidebarTypes()).toEqual([
      'Intro', 'Verse', 'Chorus', 'Verse', 'Chorus', 'Bridge', 'Solo', 'Chorus', 'Outro',
    ]);
    const rows = app.editorRows();
    expect(rows.map((r) => r.bars)).toEqual(['4', '8', '8', '8', '8', '4', '8', '8', '4']);
    expect(rows.every((r) => r.bpb === '4' && r.den === '4')).toBe(true);
    app.close();
  });

  it('MODEL-3 offers exactly the eight known section types', async () => {
    const app = await loadApp();
    const options = [...app.editorRows()[0].row.querySelectorAll('.type-sel option')].map((o) => o.value);
    expect(options).toEqual(['Intro', 'Verse', 'Pre-Chorus', 'Chorus', 'Bridge', 'Solo', 'Outro', 'Break']);
    app.close();
  });

  it('TIME-2 / TL-1 lays sections out at 40px per quarter-note beat', async () => {
    const app = await loadApp();
    const sections = app.timelineSections();
    expect(sections).toHaveLength(9);
    // Intro: 4 bars of 4/4 = 16 beats
    expect(sections[0].left).toBe(0);
    expect(sections[0].width).toBe(16 * 40 - 2);
    expect(sections[0].name).toBe('Intro');
    expect(sections[0].bars).toBe('4 bars · 4/4');
    // Verse starts after Intro
    expect(sections[1].left).toBe(16 * 40);
    expect(sections[1].width).toBe(32 * 40 - 2);
    // Outro (last) starts at beat 224 of 240
    expect(sections[8].left).toBe(224 * 40);
    app.close();
  });

  it('TIME-1 sizes non-4/4 sections in quarter-note beats (6/8 bar = 3 beats)', async () => {
    const app = await loadApp();
    const row = app.editorRows()[0];
    await app.setSelect(row.row.querySelectorAll('.time-sel')[0], '6');
    await app.setSelect(app.editorRows()[0].row.querySelectorAll('.time-sel')[1], '8');
    // 4 bars of 6/8 = 12 quarter-note beats
    const intro = app.timelineSections()[0];
    expect(intro.bars).toBe('4 bars · 6/8');
    expect(intro.width).toBe(12 * 40 - 2);
    app.close();
  });
});
