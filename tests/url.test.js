// URL / FILE-7: loading songs (and their audio) from server URLs.
import { describe, it, expect } from 'vitest';
import { loadApp, jsonResponse, blobResponse, errorResponse } from './harness.js';

const serverSong = (extra = {}) => ({
  title: 'Server Song',
  bpm: 100,
  sections: [{ id: 1, type: 'Verse', bars: 4, bpb: 4, den: 4, chords: 'A' }],
  ...extra,
});

describe('Load from server URL (URL)', () => {
  it('URL-1 / URL-4 the toolbar button prompts for a URL and fetches with no-store', async () => {
    const calls = [];
    const app = await loadApp({
      promptResult: 'http://songs.test/my-song.json',
      fetch: (url, opts) => {
        calls.push({ url, opts });
        return jsonResponse(serverSong());
      },
    });
    await app.click('#load-song-url-btn');
    await app.waitUntil(() => app.byId('song-title').value === 'Server Song');
    expect(calls[0].url).toBe('http://songs.test/my-song.json');
    expect(calls[0].opts).toMatchObject({ cache: 'no-store' });
    expect(app.byId('bpm-input').value).toBe('100');
    app.close();
  });

  it('URL-3 github blob URLs are rewritten to raw.githubusercontent.com', async () => {
    const calls = [];
    const app = await loadApp({
      promptResult: 'https://github.com/owner/repo/blob/main/songs/song.json',
      fetch: (url) => {
        calls.push(url);
        return jsonResponse(serverSong());
      },
    });
    await app.click('#load-song-url-btn');
    await app.waitUntil(() => calls.length > 0);
    expect(calls[0]).toBe('https://raw.githubusercontent.com/owner/repo/main/songs/song.json');
    app.close();
  });

  it('URL-2 a ?song= query parameter auto-loads on startup', async () => {
    const app = await loadApp({
      url: 'http://localhost/?song=http://songs.test/auto.json',
      fetch: () => jsonResponse(serverSong({ title: 'Auto Song' })),
    });
    await app.waitUntil(() => app.byId('song-title').value === 'Auto Song');
    expect(app.sidebarTypes()).toEqual(['Verse']);
    app.close();
  });

  it('URL-4 failures produce distinct alerts', async () => {
    let mode = 'network';
    const app = await loadApp({
      promptResult: 'http://songs.test/song.json',
      fetch: () => {
        if (mode === 'network') throw new Error('boom');
        if (mode === '404') return errorResponse(404);
        return { ok: true, status: 200, json: async () => { throw new Error('nope'); } };
      },
    });
    await app.click('#load-song-url-btn');
    await app.waitUntil(() => app.alerts.length >= 1);
    expect(app.alerts.at(-1)).toMatch(/network error loading song url/i);

    mode = '404';
    await app.click('#load-song-url-btn');
    await app.waitUntil(() => app.alerts.length >= 2);
    expect(app.alerts.at(-1)).toMatch(/request failed \(404\)/i);

    mode = 'badjson';
    await app.click('#load-song-url-btn');
    await app.waitUntil(() => app.alerts.length >= 3);
    expect(app.alerts.at(-1)).toMatch(/did not return valid json/i);
    app.close();
  });

  it('FILE-7 / AUD-7 song audio.url is fetched relative to the song URL', async () => {
    const calls = [];
    const app = await loadApp({
      promptResult: 'http://songs.test/dir/song.json',
      fetch: (url) => {
        calls.push(url);
        if (String(url).endsWith('song.json')) {
          return jsonResponse(serverSong({
            audio: { startOffsetSec: 0.5, fileName: 'mix.mp3', url: './mix.mp3' },
          }));
        }
        return blobResponse(new app.window.Blob([new Uint8Array([1, 2, 3])], { type: 'audio/mpeg' }));
      },
    });
    await app.click('#load-song-url-btn');
    await app.waitUntil(() => app.byId('audio-status').textContent.includes('mix.mp3'));
    expect(calls[1]).toBe('http://songs.test/dir/mix.mp3');
    expect(app.byId('audio-status').textContent).toContain('mix.mp3 (0:10)');
    app.close();
  });

  it('FILE-7 embedded audio takes priority over audio.url', async () => {
    const calls = [];
    const dataUrl = `data:audio/mpeg;base64,${Buffer.from([9]).toString('base64')}`;
    const app = await loadApp({
      promptResult: 'http://songs.test/song.json',
      fetch: (url) => {
        calls.push(url);
        return jsonResponse(serverSong({
          audio: {
            startOffsetSec: 0,
            fileName: 'embedded.mp3',
            url: './should-not-load.mp3',
            embedded: { fileName: 'embedded.mp3', mimeType: 'audio/mpeg', dataUrl },
          },
        }));
      },
    });
    await app.click('#load-song-url-btn');
    await app.waitUntil(() => app.byId('audio-status').textContent.includes('embedded.mp3'));
    expect(calls).toHaveLength(1); // no second fetch for the audio URL
    app.close();
  });
});
