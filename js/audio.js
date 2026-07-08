// Bar Fight — audio loading, waveform peaks, song-start offset, BPM detection.
(() => {
  const BF = window.BarFight;
  const { state } = BF;
  const { PX_PER_BEAT } = BF.constants;
  const T = BF.timing;

  function updateAudioStatus() {
    const status = document.getElementById('audio-status');
    if (!state.loadedAudioDurationSec) {
      if (state.expectedAudioFileName) {
        status.textContent = `No audio loaded · Expected: ${state.expectedAudioFileName}`;
        return;
      }
      status.textContent = 'No audio loaded';
      return;
    }
    status.textContent = `${state.loadedAudioName} (${T.fmtTime(state.loadedAudioDurationSec)}) · Drag Song Start in timeline`;
  }

  function setBpmDetectionResult(message) {
    document.getElementById('bpm-detect-result').textContent = message;
  }

  function updateBpmDetectionUi() {
    const detectBtn = document.getElementById('detect-bpm-btn');
    const hasAudio = state.loadedAudioDurationSec > 0 && state.loadedAudioBuffer != null;
    detectBtn.disabled = !hasAudio || state.detectingBpm;
    detectBtn.textContent = state.detectingBpm ? 'Detecting...' : 'Detect BPM';
    if (!hasAudio) {
      setBpmDetectionResult('—');
    }
  }

  function updateAudioClearState() {
    const clearBtn = document.getElementById('clear-audio-btn');
    clearBtn.disabled = !state.loadedAudioDurationSec;
  }

  function cleanupAudioUrl() {
    if (!state.audioObjectUrl) {
      return;
    }
    URL.revokeObjectURL(state.audioObjectUrl);
    state.audioObjectUrl = null;
  }

  function clearLoadedAudio() {
    BF.playback.pause();
    state.draggingSongStart = false;
    state.activeSongStartPointerId = null;
    document.body.style.cursor = '';
    cleanupAudioUrl();
    state.audioPlayer.removeAttribute('src');
    state.audioPlayer.load();
    state.loadedAudioName = '';
    state.loadedAudioDurationSec = 0;
    state.loadedAudioBuffer = null;
    state.loadedAudioBlob = null;
    state.loadedAudioSourceUrl = '';
    state.waveformPeaks = null;
    state.waveformVersion += 1;
    state.currentBeat = T.clampBeat(state.currentBeat);
    updateAudioStatus();
    updateAudioClearState();
    updateBpmDetectionUi();
    BF.ui.refresh();
  }

  function ensureAudioContext() {
    if (!state.audioCtx) {
      const ContextCtor = window.AudioContext || window.webkitAudioContext;
      if (!ContextCtor) {
        throw new Error('This browser does not support audio decoding.');
      }
      state.audioCtx = new ContextCtor();
    }
    return state.audioCtx;
  }

  function buildWaveformPeaks(decodedBuffer, points) {
    const channelCount = decodedBuffer.numberOfChannels;
    const blockSize = Math.max(1, Math.floor(decodedBuffer.length / points));
    const peaks = [];

    for (let i = 0; i < points; i += 1) {
      const start = i * blockSize;
      const end = Math.min(start + blockSize, decodedBuffer.length);
      let peak = 0;
      for (let ch = 0; ch < channelCount; ch += 1) {
        const channelData = decodedBuffer.getChannelData(ch);
        for (let j = start; j < end; j += 1) {
          const value = Math.abs(channelData[j]);
          if (value > peak) {
            peak = value;
          }
        }
      }
      peaks.push(peak);
    }

    return peaks;
  }

  async function loadAudioFile(file) {
    const buffer = await file.arrayBuffer();
    const context = ensureAudioContext();
    const decoded = await context.decodeAudioData(buffer.slice(0));
    if (!Number.isFinite(decoded.duration) || decoded.duration <= 0) {
      throw new Error('The selected audio file has no playable duration.');
    }

    const points = Math.max(400, Math.min(8000, Math.floor(decoded.duration * 180)));
    const peaks = buildWaveformPeaks(decoded, points);
    const objectUrl = URL.createObjectURL(file);

    BF.playback.pause();
    state.draggingSongStart = false;
    document.body.style.cursor = '';
    cleanupAudioUrl();
    state.audioObjectUrl = objectUrl;
    state.audioPlayer.src = state.audioObjectUrl;
    state.loadedAudioName = file.name;
    state.loadedAudioDurationSec = decoded.duration;
    state.expectedAudioFileName = state.loadedAudioName;
    state.loadedAudioBuffer = decoded;
    state.loadedAudioBlob = file;
    state.loadedAudioSourceUrl = '';
    state.audioStartOffsetSec = T.clampAudioStartOffset(state.audioStartOffsetSec);
    state.waveformPeaks = peaks;
    state.waveformVersion += 1;
    state.currentBeat = T.clampBeat(-T.timelineLeadInBeats());
    updateAudioStatus();
    updateAudioClearState();
    updateBpmDetectionUi();
    setBpmDetectionResult('Click Detect BPM');
    BF.ui.refresh();
  }

  async function loadAudioFromUrl(audioUrl, fileNameHint = '') {
    let response;
    try {
      response = await fetch(audioUrl);
    } catch (error) {
      throw new Error(`Network error loading audio URL: ${error.message}`);
    }

    if (!response.ok) {
      throw new Error(`Audio URL request failed (${response.status})`);
    }

    const blob = await response.blob();
    const fileNameFromUrl = (() => {
      try {
        const pathname = new URL(audioUrl, window.location.href).pathname;
        const last = pathname.split('/').pop();
        return last ? decodeURIComponent(last) : '';
      } catch (error) {
        return '';
      }
    })();
    const fileName = fileNameHint || fileNameFromUrl || 'server-audio';
    const file = new File([blob], fileName, { type: blob.type || 'application/octet-stream' });
    await loadAudioFile(file);
    state.loadedAudioSourceUrl = audioUrl;
  }

  async function detectBpmFromLoadedAudio() {
    if (!state.loadedAudioBuffer) {
      window.alert('Load an audio file first.');
      return;
    }
    if (!window.BpmDetector || typeof window.BpmDetector.detectFromAudioBuffer !== 'function') {
      window.alert('BPM detector is not available.');
      return;
    }

    state.detectingBpm = true;
    updateBpmDetectionUi();
    try {
      const result = await Promise.resolve(window.BpmDetector.detectFromAudioBuffer(state.loadedAudioBuffer, {
        minBpm: 70,
        maxBpm: 180,
        analyzeSeconds: 90,
      }));
      const detectedBpm = Math.max(20, Math.min(400, Math.round(result.bpm)));
      state.song.bpm = detectedBpm;
      BF.ui.syncSongInputs();
      state.currentBeat = T.clampBeat(state.currentBeat);
      BF.ui.refresh();

      const altCandidates = result.candidates
        .map((candidate) => candidate.bpm)
        .filter((bpm) => Math.round(bpm) !== detectedBpm)
        .slice(0, 2)
        .map((bpm) => String(Math.round(bpm)));
      const confidencePct = Math.round(result.confidence * 100);
      const altText = altCandidates.length ? ` · Alt: ${altCandidates.join(', ')}` : '';
      setBpmDetectionResult(`Set to ${detectedBpm} BPM (${confidencePct}% conf)${altText}`);
    } catch (error) {
      setBpmDetectionResult('Detection failed');
      window.alert(`Could not detect BPM: ${error.message}`);
      console.error(error);
    } finally {
      state.detectingBpm = false;
      updateBpmDetectionUi();
    }
  }

  function setAudioStartOffset(nextOffset, options = {}) {
    const { keepPlayback = true } = options;
    const previousOffset = state.audioStartOffsetSec;
    const clampedOffset = T.clampAudioStartOffset(nextOffset);
    state.audioStartOffsetSec = clampedOffset;

    if (state.loadedAudioDurationSec > 0) {
      if (keepPlayback) {
        state.currentBeat = T.clampBeat(state.currentBeat + T.secondsToBeat(previousOffset - state.audioStartOffsetSec));
      } else {
        state.currentBeat = T.clampBeat(state.currentBeat);
      }
      state.audioPlayer.currentTime = Math.min(state.loadedAudioDurationSec, Math.max(0, T.beatToAudioTime(state.currentBeat)));
    } else {
      state.currentBeat = T.clampBeat(state.currentBeat);
    }

    updateAudioStatus();
    BF.ui.refresh();
  }

  function setAudioStartOffsetFromTimelineX(xPx) {
    const nextOffset = T.beatToSeconds(Math.max(0, xPx / PX_PER_BEAT));
    setAudioStartOffset(nextOffset);
  }

  function updateSongStartFromPointer(clientX) {
    const wrap = document.getElementById('timeline-wrap');
    const rect = wrap.getBoundingClientRect();
    const x = clientX - rect.left + wrap.scrollLeft;
    setAudioStartOffsetFromTimelineX(x);
  }

  function beginSongStartDrag(event) {
    if (state.loadedAudioDurationSec <= 0) {
      return;
    }
    state.draggingSongStart = true;
    state.activeSongStartPointerId = event.pointerId ?? null;
    document.body.style.cursor = 'ew-resize';
    updateSongStartFromPointer(event.clientX);
  }

  BF.audio = {
    updateAudioStatus,
    setBpmDetectionResult,
    updateBpmDetectionUi,
    updateAudioClearState,
    cleanupAudioUrl,
    clearLoadedAudio,
    loadAudioFile,
    loadAudioFromUrl,
    detectBpmFromLoadedAudio,
    setAudioStartOffset,
    updateSongStartFromPointer,
    beginSongStartDrag,
  };
})();
