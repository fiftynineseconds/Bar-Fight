(() => {
  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function toMono(buffer) {
    const channels = buffer.numberOfChannels;
    const length = buffer.length;
    const mono = new Float32Array(length);
    for (let ch = 0; ch < channels; ch += 1) {
      const data = buffer.getChannelData(ch);
      for (let i = 0; i < length; i += 1) {
        mono[i] += data[i];
      }
    }
    const scale = 1 / Math.max(1, channels);
    for (let i = 0; i < length; i += 1) {
      mono[i] *= scale;
    }
    return mono;
  }

  function downsample(signal, sourceRate, targetRate) {
    if (sourceRate <= targetRate) {
      return signal;
    }
    const step = sourceRate / targetRate;
    const outLength = Math.max(1, Math.floor(signal.length / step));
    const out = new Float32Array(outLength);
    let sourceIndex = 0;
    for (let i = 0; i < outLength; i += 1) {
      out[i] = signal[Math.floor(sourceIndex)];
      sourceIndex += step;
    }
    return out;
  }

  function buildOnsetEnvelope(signal, sampleRate) {
    const frameSize = 1024;
    const hopSize = 256;
    const frameCount = Math.max(0, Math.floor((signal.length - frameSize) / hopSize));
    const energies = new Float32Array(frameCount);

    for (let i = 0; i < frameCount; i += 1) {
      const start = i * hopSize;
      let energy = 0;
      for (let j = 0; j < frameSize; j += 1) {
        const s = signal[start + j];
        energy += s * s;
      }
      energies[i] = Math.sqrt(energy / frameSize);
    }

    const envelope = new Float32Array(frameCount);
    const smoothWindow = 8;
    for (let i = 0; i < frameCount; i += 1) {
      let localMean = 0;
      let count = 0;
      const minI = Math.max(0, i - smoothWindow);
      const maxI = Math.min(frameCount - 1, i + smoothWindow);
      for (let j = minI; j <= maxI; j += 1) {
        localMean += energies[j];
        count += 1;
      }
      const threshold = localMean / Math.max(1, count);
      envelope[i] = Math.max(0, energies[i] - threshold);
    }

    let maxValue = 0;
    for (let i = 0; i < envelope.length; i += 1) {
      if (envelope[i] > maxValue) {
        maxValue = envelope[i];
      }
    }
    if (maxValue > 0) {
      for (let i = 0; i < envelope.length; i += 1) {
        envelope[i] /= maxValue;
      }
    }

    return { envelope, fps: sampleRate / hopSize };
  }

  function scoreCandidates(envelope, fps, minBpm, maxBpm) {
    const minLag = Math.floor((fps * 60) / maxBpm);
    const maxLag = Math.ceil((fps * 60) / minBpm);
    const lagScores = [];

    for (let lag = minLag; lag <= maxLag; lag += 1) {
      let sum = 0;
      for (let i = lag; i < envelope.length; i += 1) {
        sum += envelope[i] * envelope[i - lag];
      }
      lagScores.push({ lag, score: sum });
    }

    lagScores.sort((a, b) => b.score - a.score);
    const topLagScores = lagScores.slice(0, 20);
    const candidates = [];

    topLagScores.forEach((entry) => {
      let bpm = (fps * 60) / entry.lag;
      while (bpm < minBpm) {
        bpm *= 2;
      }
      while (bpm > maxBpm) {
        bpm /= 2;
      }
      bpm = clamp(bpm, minBpm, maxBpm);

      const existing = candidates.find((candidate) => Math.abs(candidate.bpm - bpm) < 0.5);
      if (existing) {
        existing.score += entry.score;
      } else {
        candidates.push({ bpm, score: entry.score });
      }
    });

    candidates.sort((a, b) => b.score - a.score);
    return candidates;
  }

  function detectFromAudioBuffer(buffer, options = {}) {
    const minBpm = options.minBpm || 70;
    const maxBpm = options.maxBpm || 180;
    const analyzeSeconds = options.analyzeSeconds || 90;
    const targetRate = options.targetRate || 11025;

    const mono = toMono(buffer);
    const maxSamples = Math.min(mono.length, Math.floor(buffer.sampleRate * analyzeSeconds));
    const sliced = mono.slice(0, maxSamples);
    const reduced = downsample(sliced, buffer.sampleRate, targetRate);
    const { envelope, fps } = buildOnsetEnvelope(reduced, Math.min(buffer.sampleRate, targetRate));

    if (envelope.length < 32) {
      throw new Error('Audio is too short to estimate BPM.');
    }

    const candidates = scoreCandidates(envelope, fps, minBpm, maxBpm);
    if (!candidates.length) {
      throw new Error('Could not estimate BPM from this audio.');
    }

    const best = candidates[0];
    const second = candidates[1] || { score: 0 };
    const confidence = best.score > 0 ? best.score / Math.max(best.score + second.score, 1e-6) : 0;

    return {
      bpm: Math.round(best.bpm * 10) / 10,
      confidence,
      candidates: candidates.slice(0, 3).map((candidate) => ({
        bpm: Math.round(candidate.bpm * 10) / 10,
        score: candidate.score,
      })),
    };
  }

  window.BpmDetector = { detectFromAudioBuffer };
})();
