// EDIT: the section editor panel.
import { describe, it, expect } from 'vitest';
import { loadApp } from './harness.js';

describe('Section editor (EDIT)', () => {
  it('EDIT-8 add section appends a 4-bar 4/4 Verse', async () => {
    const app = await loadApp();
    await app.click('#add-section-btn');
    const rows = app.editorRows();
    expect(rows).toHaveLength(10);
    expect(rows[9]).toMatchObject({ type: 'Verse', bars: '4', bpb: '4', den: '4', chords: '' });
    // The sidebar + button does the same
    await app.click('#sidebar-add');
    expect(app.editorRows()).toHaveLength(11);
    app.close();
  });

  it('EDIT-2 up/down buttons swap neighbors and are disabled at the ends', async () => {
    const app = await loadApp();
    const buttons = app.editorRows().map((r) => r.row.querySelectorAll('.move-btn'));
    expect(buttons[0][0].disabled).toBe(true); // first row up
    expect(buttons[8][1].disabled).toBe(true); // last row down
    await app.click(buttons[0][1]); // move Intro down
    expect(app.sidebarTypes().slice(0, 2)).toEqual(['Verse', 'Intro']);
    app.close();
  });

  it('EDIT-3 changing the type updates the timeline immediately', async () => {
    const app = await loadApp();
    await app.setSelect(app.editorRows()[0].row.querySelector('.type-sel'), 'Break');
    expect(app.timelineSections()[0].name).toBe('Break');
    expect(app.sidebarTypes()[0]).toBe('Break');
    app.close();
  });

  it('EDIT-4 / TIME-4 / TIME-5 bar input quantizes to the section step and clamps', async () => {
    const app = await loadApp();
    const barsInput = () => app.editorRows()[0].row.querySelector('.num-in');
    await app.setInput(barsInput(), '3.7', 'change'); // 4/4 step is 0.25
    expect(barsInput().value).toBe('3.75');
    await app.setInput(barsInput(), '0', 'change'); // clamps up to the minimum step
    expect(barsInput().value).toBe('0.25');
    await app.setInput(barsInput(), '200', 'change'); // clamps down to 64
    expect(barsInput().value).toBe('64');
    app.close();
  });

  it('EDIT-5 changing the time signature re-quantizes the bar count', async () => {
    const app = await loadApp();
    let row = app.editorRows()[0].row;
    await app.setSelect(row.querySelectorAll('.time-sel')[0], '6');
    row = app.editorRows()[0].row;
    await app.setSelect(row.querySelectorAll('.time-sel')[1], '8');
    // 6/8 -> 3 quarter-note beats per bar -> step 1/3
    const barsInput = app.editorRows()[0].row.querySelector('.num-in');
    await app.setInput(barsInput, '4.1', 'change');
    expect(app.editorRows()[0].bars).toBe('4');
    app.close();
  });

  it('EDIT-6 chord edits update the timeline live without stealing focus', async () => {
    const app = await loadApp();
    const chordInput = app.editorRows()[0].row.querySelector('.chord-in');
    chordInput.focus();
    await app.setInput(chordInput, 'F#m D A E');
    expect(app.timelineSections()[0].chords).toBe('F#m D A E');
    expect(app.document.activeElement).toBe(chordInput);
    app.close();
  });

  it('EDIT-7 remove deletes a section but never the last one', async () => {
    const app = await loadApp();
    await app.click(app.editorRows()[0].row.querySelector('.rm-btn'));
    expect(app.editorRows()).toHaveLength(8);
    expect(app.sidebarTypes()[0]).toBe('Verse');
    // Delete down to one, then try again
    for (let i = 0; i < 7; i += 1) {
      await app.click(app.editorRows()[0].row.querySelector('.rm-btn'));
    }
    expect(app.editorRows()).toHaveLength(1);
    await app.click(app.editorRows()[0].row.querySelector('.rm-btn'));
    expect(app.editorRows()).toHaveLength(1);
    app.close();
  });

  it('EDIT-9 the editor panel toggles visibility', async () => {
    const app = await loadApp();
    const editor = app.byId('editor');
    const wasHidden = editor.classList.contains('hidden');
    await app.click('#editor-toggle');
    expect(editor.classList.contains('hidden')).toBe(!wasHidden);
    await app.click('#editor-toggle');
    expect(editor.classList.contains('hidden')).toBe(wasHidden);
    app.close();
  });
});
