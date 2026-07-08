// TEMPO-5: BpmDetector is a pure function of an AudioBuffer-shaped object.
import { describe, it, expect } from 'vitest';
import { loadApp } from './harness.js';

function makeClickTrack({ bpm, seconds, sampleRate = 11025 }) {
  const length = Math.floor(seconds * sampleRate);
  const data = new Float32Array(length);
  const samplesPerBeat = (60 / bpm) * sampleRate;
  for (let beat = 0; beat * samplesPerBeat < length; beat += 1) {
    const start = Math.floor(beat * samplesPerBeat);
    // Short decaying click.
    for (let i = 0; i < 200 && start + i < length; i += 1) {
      data[start + i] = (1 - i / 200) * (i % 2 === 0 ? 1 : -1);
    }
  }
  return {
    duration: seconds,
    sampleRate,
    length,
    numberOfChannels: 1,
    getChannelData: () => data,
  };
}

describe('BpmDetector (TEMPO-5)', () => {
  it('TEMPO-5 detects the tempo of a synthetic click track', async () => {
    const app = await loadApp();
    const buffer = makeClickTrack({ bpm: 120, seconds: 30 });
    const result = app.window.BpmDetector.detectFromAudioBuffer(buffer, {
      minBpm: 70,
      maxBpm: 180,
      analyzeSeconds: 90,
    });
    // The detector's autocorrelation lag is quantized (~43 envelope frames/s),
    // so at 120 BPM the result can land a few BPM off. ±5% characterizes the
    // real resolution.
    expect(Math.abs(result.bpm - 120)).toBeLessThanOrEqual(6);
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
    expect(result.candidates.length).toBeGreaterThanOrEqual(1);
    expect(result.candidates.length).toBeLessThanOrEqual(3);
    // bpm values are rounded to 0.1
    for (const candidate of result.candidates) {
      expect(Math.round(candidate.bpm * 10)).toBeCloseTo(candidate.bpm * 10, 6);
    }
    app.close();
  });

  it('TEMPO-5 throws on audio too short to analyze', async () => {
    const app = await loadApp();
    const buffer = makeClickTrack({ bpm: 120, seconds: 0.2 });
    expect(() => app.window.BpmDetector.detectFromAudioBuffer(buffer)).toThrow(/too short/i);
    app.close();
  });
});
