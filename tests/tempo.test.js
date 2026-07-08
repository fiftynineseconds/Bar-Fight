// TEMPO: tap tempo and BPM detection wiring.
import { describe, it, expect } from 'vitest';
import { loadApp, makeFakeAudioBuffer } from './harness.js';

function clickTrackBuffer({ bpm, seconds, sampleRate = 11025 }) {
  const length = Math.floor(seconds * sampleRate);
  const data = new Float32Array(length);
  const samplesPerBeat = (60 / bpm) * sampleRate;
  for (let beat = 0; beat * samplesPerBeat < length; beat += 1) {
    const start = Math.floor(beat * samplesPerBeat);
    for (let i = 0; i < 200 && start + i < length; i += 1) {
      data[start + i] = (1 - i / 200) * (i % 2 === 0 ? 1 : -1);
    }
  }
  return makeFakeAudioBuffer({ durationSec: seconds, sampleRate, channelData: data });
}

describe('Tempo (TEMPO)', () => {
  it('TEMPO-2 tapping "t" sets the BPM from the average interval', async () => {
    const app = await loadApp();
    for (let i = 0; i < 5; i += 1) {
      await app.key('t');
      await app.clock.tick(500); // 500ms apart = 120 BPM
    }
    expect(app.byId('bpm-input').value).toBe('120');
    app.close();
  });

  it('TEMPO-3 a pause over 2s starts a fresh tap series', async () => {
    const app = await loadApp();
    for (let i = 0; i < 4; i += 1) {
      await app.key('t');
      await app.clock.tick(500);
    }
    expect(app.byId('bpm-input').value).toBe('120');
    await app.clock.tick(2500); // series resets
    for (let i = 0; i < 5; i += 1) {
      await app.key('t');
      await app.clock.tick(250); // 250ms apart = 240 BPM
    }
    expect(app.byId('bpm-input').value).toBe('240');
    app.close();
  });

  it('TEMPO-4 Detect BPM is disabled without audio, and applies the detected tempo with audio', async () => {
    const app = await loadApp({
      decodedAudioBuffer: clickTrackBuffer({ bpm: 100, seconds: 30 }),
    });
    const detectBtn = app.byId('detect-bpm-btn');
    expect(detectBtn.disabled).toBe(true);

    const file = new app.window.File([new Uint8Array([1, 2, 3])], 'track.mp3', { type: 'audio/mpeg' });
    await app.chooseFile('load-audio-input', file);
    expect(detectBtn.disabled).toBe(false);
    expect(app.byId('bpm-detect-result').textContent).toMatch(/detect bpm/i);

    await app.click('#detect-bpm-btn');
    await app.waitUntil(() => !app.byId('detect-bpm-btn').disabled);
    const applied = Number(app.byId('bpm-input').value);
    expect(Math.abs(applied - 100)).toBeLessThanOrEqual(5);
    expect(app.byId('bpm-detect-result').textContent).toMatch(/^Set to \d+ BPM \(\d+% conf\)/);
    app.close();
  });
});
