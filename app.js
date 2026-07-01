const PX_PER_BEAT = 40;
const SECTION_RESIZE_BEAT_STEP = 1;
const SECTION_MAX_BARS = 64;

const ICON_PLAY = '<svg width="11" height="13" viewBox="0 0 11 13" fill="currentColor" aria-hidden="true"><path d="M1.5 1.5l8 5-8 5z"></path></svg>';
const ICON_PAUSE = '<svg width="11" height="13" viewBox="0 0 11 13" fill="currentColor" aria-hidden="true"><rect x="1" y="1" width="3" height="11" rx="1"></rect><rect x="7" y="1" width="3" height="11" rx="1"></rect></svg>';
const WAVEFORM_HEIGHT = 194;

const COLORS = {
  Intro: { fill: '#15803d', text: '#bbf7d0' },
  Verse: { fill: '#1d4ed8', text: '#bfdbfe' },
  'Pre-Chorus': { fill: '#7e22ce', text: '#e9d5ff' },
  Chorus: { fill: '#b91c1c', text: '#fecaca' },
  Bridge: { fill: '#c2410c', text: '#fed7aa' },
  Solo: { fill: '#0e7490', text: '#a5f3fc' },
  Outro: { fill: '#854d0e', text: '#fef08a' },
  Break: { fill: '#374151', text: '#d1d5db' },
};
const TYPES = Object.keys(COLORS);

// Quarter-note beats per bar — the unit all timing math works in (BPM = quarter notes/min)
function secQpb(sec) { return sec.bpb * 4 / sec.den; }

function roundToStep(value, step) {
  if (!Number.isFinite(value) || !Number.isFinite(step) || step <= 0) {
    return value;
  }
  return Math.round(value / step) * step;
}

function getSectionBarStep(sec) {
  return 1 / Math.max(1, secQpb(sec));
}

function normalizeSectionBars(rawBars, sec) {
  const step = getSectionBarStep(sec);
  const bars = Number(rawBars);
  if (!Number.isFinite(bars)) {
    return step;
  }
  const quantized = roundToStep(bars, step);
  return Math.max(step, Math.min(SECTION_MAX_BARS, quantized));
}

function formatBars(value) {
  const rounded = Math.round(Number(value) * 100) / 100;
  if (!Number.isFinite(rounded)) {
    return '0';
  }
  return Number.isInteger(rounded) ? String(rounded) : String(rounded).replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');
}

let song = {
  title: 'New Song',
  bpm: 120,
  sections: [
    { id: 1, type: 'Intro', bars: 4, bpb: 4, den: 4, chords: 'E  A  B  A' },
    { id: 2, type: 'Verse', bars: 8, bpb: 4, den: 4, chords: 'E  A  E  B' },
    { id: 3, type: 'Chorus', bars: 8, bpb: 4, den: 4, chords: 'A  E  B  A' },
    { id: 4, type: 'Verse', bars: 8, bpb: 4, den: 4, chords: 'E  A  E  B' },
    { id: 5, type: 'Chorus', bars: 8, bpb: 4, den: 4, chords: 'A  E  B  A' },
    { id: 6, type: 'Bridge', bars: 4, bpb: 4, den: 4, chords: 'C#m  A  B  B' },
    { id: 7, type: 'Solo', bars: 8, bpb: 4, den: 4, chords: 'E  A  E  B' },
    { id: 8, type: 'Chorus', bars: 8, bpb: 4, den: 4, chords: 'A  E  B  A' },
    { id: 9, type: 'Outro', bars: 4, bpb: 4, den: 4, chords: 'E  E  E  E' },
  ],
};

let nextId = 100;
let playing = false;
let currentBeat = 0;
let startTime = null;
let startBeat = 0;
let rafId = null;
const audioPlayer = new Audio();
audioPlayer.preload = 'auto';
let audioCtx = null;
let audioObjectUrl = null;
let loadedAudioName = '';
let loadedAudioDurationSec = 0;
let waveformPeaks = null;
let waveformVersion = 0;
let audioStartOffsetSec = 0;
let draggingSongStart = false;
let sectionInteraction = null;
let suppressTimelineClick = false;
let loadedAudioBuffer = null;
let loadedAudioBlob = null;
let loadedAudioSourceUrl = '';
let detectingBpm = false;
let expectedAudioFileName = '';
let printViewOpen = false;
const COUNT_OFF_DEFAULT_ENABLED = true;
const COUNT_OFF_DEFAULT_BEATS = 4;
const COUNT_OFF_MIN_BEATS = 1;
const COUNT_OFF_MAX_BEATS = 16;
let countOffEnabled = COUNT_OFF_DEFAULT_ENABLED;
let countOffBeats = COUNT_OFF_DEFAULT_BEATS;
let countOffAbortController = null;
let countOffRunning = false;

function clampCountOffBeats(value) {
  const parsed = parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    return COUNT_OFF_DEFAULT_BEATS;
  }
  return Math.max(COUNT_OFF_MIN_BEATS, Math.min(COUNT_OFF_MAX_BEATS, parsed));
}

function syncCountOffInputs() {
  const toggle = document.getElementById('countoff-toggle');
  const beatsInput = document.getElementById('countoff-beats');
  if (!toggle || !beatsInput) {
    return;
  }
  toggle.checked = countOffEnabled;
  beatsInput.value = String(countOffBeats);
  beatsInput.disabled = !countOffEnabled;
}

function hideCountOffOverlay() {
  const overlay = document.getElementById('countoff-overlay');
  if (!overlay) {
    return;
  }
  overlay.classList.remove('show', 'pulse');
  overlay.setAttribute('aria-hidden', 'true');
}

function updateCountOffOverlay(value) {
  const overlay = document.getElementById('countoff-overlay');
  const valueEl = document.getElementById('countoff-value');
  if (!overlay || !valueEl) {
    return;
  }
  valueEl.textContent = String(value);
  overlay.classList.add('show');
  overlay.setAttribute('aria-hidden', 'false');
  overlay.classList.remove('pulse');
  void overlay.offsetWidth;
  overlay.classList.add('pulse');
}

function cancelCountOff() {
  if (countOffAbortController) {
    countOffAbortController.abort();
    countOffAbortController = null;
  }
  countOffRunning = false;
  hideCountOffOverlay();
  setPlayButtonState();
}

function sleepWithAbort(ms, signal) {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);

    function onAbort() {
      window.clearTimeout(timer);
      reject(new DOMException('Count-off canceled', 'AbortError'));
    }

    signal.addEventListener('abort', onAbort, { once: true });
  });
}

async function runVisualCountOff() {
  if (!countOffEnabled || countOffBeats <= 0) {
    return true;
  }

  cancelCountOff();
  const controller = new AbortController();
  countOffAbortController = controller;
  countOffRunning = true;
  setPlayButtonState();

  const msPerBeat = (60 / Math.max(1, song.bpm)) * 1000;
  try {
    for (let beat = countOffBeats; beat >= 1; beat -= 1) {
      if (controller.signal.aborted) {
        throw new DOMException('Count-off canceled', 'AbortError');
      }
      updateCountOffOverlay(beat);
      await sleepWithAbort(msPerBeat, controller.signal);
    }
    hideCountOffOverlay();
    countOffRunning = false;
    countOffAbortController = null;
    setPlayButtonState();
    return true;
  } catch (error) {
    hideCountOffOverlay();
    countOffRunning = false;
    countOffAbortController = null;
    setPlayButtonState();
    if (error && error.name === 'AbortError') {
      return false;
    }
    throw error;
  }
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Could not encode audio for export.'));
    reader.readAsDataURL(blob);
  });
}

function dataUrlToFile(dataUrl, fileName, mimeTypeHint = '') {
  const match = /^data:([^;,]+)?(?:;charset=[^;,]+)?;base64,(.+)$/i.exec(String(dataUrl || ''));
  if (!match) {
    throw new Error('Embedded audio data is not a valid base64 data URL.');
  }

  const mimeType = mimeTypeHint || match[1] || 'application/octet-stream';
  const bytesRaw = atob(match[2]);
  const bytes = new Uint8Array(bytesRaw.length);
  for (let i = 0; i < bytesRaw.length; i += 1) {
    bytes[i] = bytesRaw.charCodeAt(i);
  }

  const safeName = (fileName && String(fileName).trim()) || 'embedded-audio';
  return new File([bytes], safeName, { type: mimeType });
}

function availableAudioDurationSec() {
  return Math.max(0, loadedAudioDurationSec - audioStartOffsetSec);
}

function timelineLeadInBeats() {
  if (loadedAudioDurationSec <= 0) {
    return 0;
  }
  return secondsToBeat(audioStartOffsetSec);
}

function clampAudioStartOffset(seconds) {
  if (loadedAudioDurationSec <= 0) {
    return Math.max(0, seconds);
  }
  const maxOffset = Math.max(0, loadedAudioDurationSec - 0.01);
  return Math.max(0, Math.min(seconds, maxOffset));
}

function updateAudioOffsetUi() {
  // Timeline marker is the primary alignment control.
}

function setAudioStartOffset(nextOffset, options = {}) {
  const { keepPlayback = true } = options;
  const previousOffset = audioStartOffsetSec;
  const clampedOffset = clampAudioStartOffset(nextOffset);
  audioStartOffsetSec = clampedOffset;

  if (loadedAudioDurationSec > 0) {
    if (keepPlayback) {
      currentBeat = clampBeat(currentBeat + secondsToBeat(previousOffset - audioStartOffsetSec));
    } else {
      currentBeat = clampBeat(currentBeat);
    }
    audioPlayer.currentTime = Math.min(loadedAudioDurationSec, Math.max(0, beatToAudioTime(currentBeat)));
  } else {
    currentBeat = clampBeat(currentBeat);
  }

  updateAudioOffsetUi();
  updateAudioStatus();
  refresh();
}

function setAudioStartOffsetFromTimelineX(xPx) {
  const nextOffset = beatToSeconds(Math.max(0, xPx / PX_PER_BEAT));
  setAudioStartOffset(nextOffset);
}

function updateSongStartFromPointer(clientX) {
  const wrap = document.getElementById('timeline-wrap');
  const rect = wrap.getBoundingClientRect();
  const x = clientX - rect.left + wrap.scrollLeft;
  setAudioStartOffsetFromTimelineX(x);
}

function beginSongStartDrag(event) {
  if (loadedAudioDurationSec <= 0) {
    return;
  }
  draggingSongStart = true;
  document.body.style.cursor = 'ew-resize';
  updateSongStartFromPointer(event.clientX);
}

function totalTimelineBeats() {
  const songBeats = totalBeats();
  if (loadedAudioDurationSec <= 0) {
    return songBeats;
  }
  return Math.max(songBeats, secondsToBeat(availableAudioDurationSec()));
}

function totalVisualTimelineBeats() {
  return totalTimelineBeats() + timelineLeadInBeats();
}

function beatToSeconds(beat) {
  return (beat * 60) / song.bpm;
}

function secondsToBeat(seconds) {
  return (seconds * song.bpm) / 60;
}

function beatToAudioTime(beat) {
  return beatToSeconds(beat) + audioStartOffsetSec;
}

function audioTimeToBeat(seconds) {
  return secondsToBeat(seconds - audioStartOffsetSec);
}

function updateAudioStatus() {
  const status = document.getElementById('audio-status');
  if (!loadedAudioDurationSec) {
    if (expectedAudioFileName) {
      status.textContent = `No audio loaded · Expected: ${expectedAudioFileName}`;
      return;
    }
    status.textContent = 'No audio loaded';
    return;
  }
  status.textContent = `${loadedAudioName} (${fmtTime(loadedAudioDurationSec)}) · Drag Song Start in timeline`;
}

function setBpmDetectionResult(message) {
  document.getElementById('bpm-detect-result').textContent = message;
}

function updateBpmDetectionUi() {
  const detectBtn = document.getElementById('detect-bpm-btn');
  const hasAudio = loadedAudioDurationSec > 0 && loadedAudioBuffer != null;
  detectBtn.disabled = !hasAudio || detectingBpm;
  detectBtn.textContent = detectingBpm ? 'Detecting...' : 'Detect BPM';
  if (!hasAudio) {
    setBpmDetectionResult('—');
  }
}

function updateAudioClearState() {
  const clearBtn = document.getElementById('clear-audio-btn');
  clearBtn.disabled = !loadedAudioDurationSec;
}

function cleanupAudioUrl() {
  if (!audioObjectUrl) {
    return;
  }
  URL.revokeObjectURL(audioObjectUrl);
  audioObjectUrl = null;
}

function clearLoadedAudio() {
  pause();
  draggingSongStart = false;
  document.body.style.cursor = '';
  cleanupAudioUrl();
  audioPlayer.removeAttribute('src');
  audioPlayer.load();
  loadedAudioName = '';
  loadedAudioDurationSec = 0;
  loadedAudioBuffer = null;
  loadedAudioBlob = null;
  loadedAudioSourceUrl = '';
  waveformPeaks = null;
  waveformVersion += 1;
  currentBeat = clampBeat(currentBeat);
  updateAudioStatus();
  updateAudioClearState();
  updateAudioOffsetUi();
  updateBpmDetectionUi();
  refresh();
}

function ensureAudioContext() {
  if (!audioCtx) {
    const ContextCtor = window.AudioContext || window.webkitAudioContext;
    if (!ContextCtor) {
      throw new Error('This browser does not support audio decoding.');
    }
    audioCtx = new ContextCtor();
  }
  return audioCtx;
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

  pause();
  draggingSongStart = false;
  document.body.style.cursor = '';
  cleanupAudioUrl();
  audioObjectUrl = objectUrl;
  audioPlayer.src = audioObjectUrl;
  loadedAudioName = file.name;
  loadedAudioDurationSec = decoded.duration;
  expectedAudioFileName = loadedAudioName;
  loadedAudioBuffer = decoded;
  loadedAudioBlob = file;
  loadedAudioSourceUrl = '';
  audioStartOffsetSec = clampAudioStartOffset(audioStartOffsetSec);
  waveformPeaks = peaks;
  waveformVersion += 1;
  currentBeat = clampBeat(-timelineLeadInBeats());
  updateAudioStatus();
  updateAudioClearState();
  updateAudioOffsetUi();
  updateBpmDetectionUi();
  setBpmDetectionResult('Click Detect BPM');
  refresh();
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
  loadedAudioSourceUrl = audioUrl;
}

async function detectBpmFromLoadedAudio() {
  if (!loadedAudioBuffer) {
    window.alert('Load an audio file first.');
    return;
  }
  if (!window.BpmDetector || typeof window.BpmDetector.detectFromAudioBuffer !== 'function') {
    window.alert('BPM detector is not available.');
    return;
  }

  detectingBpm = true;
  updateBpmDetectionUi();
  try {
    const result = await Promise.resolve(window.BpmDetector.detectFromAudioBuffer(loadedAudioBuffer, {
      minBpm: 70,
      maxBpm: 180,
      analyzeSeconds: 90,
    }));
    const detectedBpm = Math.max(20, Math.min(400, Math.round(result.bpm)));
    song.bpm = detectedBpm;
    syncSongInputs();
    currentBeat = clampBeat(currentBeat);
    refresh();

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
    detectingBpm = false;
    updateBpmDetectionUi();
  }
}

function syncSongInputs() {
  const titleInput = document.getElementById('song-title');
  const bpmInput = document.getElementById('bpm-input');
  titleInput.value = song.title;
  bpmInput.value = String(song.bpm);
  syncCountOffInputs();
}

function sanitizeSong(rawSong) {
  if (!rawSong || typeof rawSong !== 'object') {
    throw new Error('Song file must contain a JSON object.');
  }

  if (!Array.isArray(rawSong.sections) || rawSong.sections.length === 0) {
    throw new Error('Song file must include at least one section.');
  }

  const title = String(rawSong.title || '').trim() || 'Untitled Song';
  const bpm = Math.max(20, Math.min(400, parseInt(rawSong.bpm, 10) || 120));
  const rawAudio = rawSong.audio && typeof rawSong.audio === 'object' ? rawSong.audio : {};
  const parsedOffset = Number(rawAudio.startOffsetSec);
  const audioStartOffset = Number.isFinite(parsedOffset) && parsedOffset >= 0 ? parsedOffset : 0;
  const audioFileName = rawAudio.fileName ? String(rawAudio.fileName).trim() : '';
  const audioUrl = rawAudio.url ? String(rawAudio.url).trim() : '';
  const rawEmbeddedAudio = rawAudio.embedded && typeof rawAudio.embedded === 'object' ? rawAudio.embedded : {};
  const audioEmbeddedDataUrl = typeof rawEmbeddedAudio.dataUrl === 'string' ? rawEmbeddedAudio.dataUrl : '';
  const audioEmbeddedMimeType = typeof rawEmbeddedAudio.mimeType === 'string' ? rawEmbeddedAudio.mimeType : '';
  const rawCountOff = rawSong.countOff && typeof rawSong.countOff === 'object' ? rawSong.countOff : {};
  const countOffEnabledValue = typeof rawCountOff.enabled === 'boolean' ? rawCountOff.enabled : COUNT_OFF_DEFAULT_ENABLED;
  const countOffBeatsValue = clampCountOffBeats(rawCountOff.beats);
  const usedIds = new Set();

  const sections = rawSong.sections.map((section, index) => {
    if (!section || typeof section !== 'object') {
      throw new Error(`Section ${index + 1} is invalid.`);
    }

    if (!TYPES.includes(section.type)) {
      throw new Error(`Section ${index + 1} has an unsupported type: ${section.type}`);
    }

    const bpb = parseInt(section.bpb, 10);
    if (!Number.isInteger(bpb) || bpb < 1 || bpb > 16) {
      throw new Error(`Section ${index + 1} has an invalid time signature numerator.`);
    }

    const rawDen = parseInt(section.den, 10);
    const den = [2, 4, 8, 16].includes(rawDen) ? rawDen : 4;

    const parsedBars = Number(section.bars);
    if (!Number.isFinite(parsedBars) || parsedBars <= 0) {
      throw new Error(`Section ${index + 1} has an invalid bar count.`);
    }
    const bars = normalizeSectionBars(parsedBars, { bpb, den });

    let id = Number(section.id);
    if (!Number.isInteger(id) || id < 1 || usedIds.has(id)) {
      id = index + 1;
      while (usedIds.has(id)) {
        id += 1;
      }
    }
    usedIds.add(id);

    return {
      id,
      type: section.type,
      bars,
      bpb,
      den,
      chords: section.chords ? String(section.chords) : '',
    };
  });

  return {
    title,
    bpm,
    sections,
    audioStartOffset,
    audioFileName,
    audioUrl,
    audioEmbeddedDataUrl,
    audioEmbeddedMimeType,
    countOffEnabled: countOffEnabledValue,
    countOffBeats: countOffBeatsValue,
  };
}

function resolveUrlWithBase(maybeRelativeUrl, baseUrl = '') {
  const trimmed = String(maybeRelativeUrl || '').trim();
  if (!trimmed) {
    return '';
  }
  if (!baseUrl) {
    return trimmed;
  }
  try {
    return new URL(trimmed, baseUrl).href;
  } catch (error) {
    return trimmed;
  }
}

async function loadSongFromData(rawSong, options = {}) {
  const { sourceUrl = '' } = options;
  const nextSong = sanitizeSong(rawSong);
  pause();
  currentBeat = 0;
  startBeat = 0;
  startTime = null;
  song = {
    title: nextSong.title,
    bpm: nextSong.bpm,
    sections: nextSong.sections,
  };
  countOffEnabled = nextSong.countOffEnabled;
  countOffBeats = nextSong.countOffBeats;
  cancelCountOff();

  clearLoadedAudio();
  expectedAudioFileName = nextSong.audioFileName;

  if (nextSong.audioEmbeddedDataUrl) {
    let embeddedFile;
    try {
      embeddedFile = dataUrlToFile(
        nextSong.audioEmbeddedDataUrl,
        nextSong.audioFileName || 'embedded-audio',
        nextSong.audioEmbeddedMimeType,
      );
    } catch (error) {
      throw new Error(`Could not decode embedded audio: ${error.message}`);
    }

    try {
      await loadAudioFile(embeddedFile);
    } catch (error) {
      throw new Error(`Could not load embedded audio: ${error.message}`);
    }
  } else if (nextSong.audioUrl) {
    const resolvedAudioUrl = resolveUrlWithBase(nextSong.audioUrl, sourceUrl);
    try {
      await loadAudioFromUrl(resolvedAudioUrl, nextSong.audioFileName);
    } catch (error) {
      throw new Error(`Could not load audio from URL: ${error.message}`);
    }
  }

  setAudioStartOffset(nextSong.audioStartOffset, { keepPlayback: false });
  nextId = song.sections.reduce((maxId, section) => Math.max(maxId, section.id), 0) + 1;
  syncSongInputs();
  refresh();
}

function toRawGithubUrl(url) {
  // Convert github.com blob URLs to raw.githubusercontent.com so CORS works
  const match = url.match(/^https?:\/\/github\.com\/([^/]+\/[^/]+)\/blob\/(.+)$/);
  if (match) {
    return `https://raw.githubusercontent.com/${match[1]}/${match[2]}`;
  }
  return url;
}

async function fetchSongJsonFromUrl(songUrl) {
  const fetchUrl = toRawGithubUrl(songUrl);
  let response;
  try {
    response = await fetch(fetchUrl, { cache: 'no-store' });
  } catch (error) {
    throw new Error(`Network error loading song URL: ${error.message}`);
  }

  if (!response.ok) {
    throw new Error(`Song URL request failed (${response.status})`);
  }

  let parsed;
  try {
    parsed = await response.json();
  } catch (error) {
    throw new Error('Song URL did not return valid JSON.');
  }

  const resolvedSongUrl = resolveUrlWithBase(songUrl, window.location.href);
  await loadSongFromData(parsed, { sourceUrl: resolvedSongUrl });
}

function buildSaveFileName() {
  const cleanedTitle = song.title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${cleanedTitle || 'song'}.json`;
}

async function saveSongToDisk() {
  try {
    const payload = {
      title: song.title,
      bpm: song.bpm,
      sections: song.sections,
      countOff: {
        enabled: countOffEnabled,
        beats: countOffBeats,
      },
      audio: {
        startOffsetSec: Math.round(audioStartOffsetSec * 1000) / 1000,
        fileName: loadedAudioName || expectedAudioFileName || '',
        url: loadedAudioSourceUrl || '',
      },
    };

    if (loadedAudioBlob) {
      payload.audio.embedded = {
        fileName: loadedAudioName || expectedAudioFileName || 'embedded-audio',
        mimeType: loadedAudioBlob.type || '',
        dataUrl: await blobToDataUrl(loadedAudioBlob),
      };
    }

    const json = JSON.stringify(payload, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = buildSaveFileName();
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  } catch (error) {
    window.alert(`Could not save song file: ${error.message}`);
    console.error(error);
  }
}

function totalBeats() {
  return song.sections.reduce((sum, sec) => sum + sec.bars * secQpb(sec), 0);
}

function getSectionIndexById(sectionId) {
  return song.sections.findIndex((sec) => sec.id === sectionId);
}

function getSectionStartBeatByIndex(index) {
  let acc = 0;
  for (let i = 0; i < index; i += 1) {
    acc += song.sections[i].bars * secQpb(song.sections[i]);
  }
  return acc;
}

function clientXToTimelineBeat(clientX) {
  const wrap = document.getElementById('timeline-wrap');
  const rect = wrap.getBoundingClientRect();
  const x = clientX - rect.left + wrap.scrollLeft;
  return (x / PX_PER_BEAT) - timelineLeadInBeats();
}

function moveSectionToIndex(fromIndex, toIndex) {
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= song.sections.length || toIndex >= song.sections.length) {
    return;
  }
  const [moved] = song.sections.splice(fromIndex, 1);
  song.sections.splice(toIndex, 0, moved);
}

function beginSectionMove(event, sectionId) {
  const index = getSectionIndexById(sectionId);
  if (index < 0) {
    return;
  }
  sectionInteraction = {
    mode: 'move',
    sectionId,
    startClientX: event.clientX,
  };
  document.body.style.cursor = 'grabbing';
  refresh();
}

function beginSectionResize(event, sectionId, side) {
  const index = getSectionIndexById(sectionId);
  if (index < 0) {
    return;
  }

  const targetIndex = side === 'left' ? index - 1 : index;
  if (targetIndex < 0 || targetIndex >= song.sections.length) {
    return;
  }

  const targetSection = song.sections[targetIndex];
  const boundaryBeat = getSectionStartBeatByIndex(side === 'left' ? index : index + 1);
  sectionInteraction = {
    mode: side === 'left' ? 'resize-left' : 'resize-right',
    sectionId,
    startClientX: event.clientX,
    targetIndex,
    startBars: targetSection.bars,
    boundaryBeat,
    beatsPerBar: secQpb(targetSection),
  };
  document.body.style.cursor = 'ew-resize';
  refresh();
}

function updateSectionMove(clientX) {
  const { sectionId } = sectionInteraction;
  const currentIndex = getSectionIndexById(sectionId);
  if (currentIndex < 0) {
    return;
  }
  const pointerBeat = clientXToTimelineBeat(clientX);

  let acc = 0;
  const others = song.sections
    .map((sec, index) => {
      const start = acc;
      const beats = sec.bars * secQpb(sec);
      acc += beats;
      return { sec, index, mid: start + (beats / 2) };
    })
    .filter((entry) => entry.sec.id !== sectionId);

  let nextIndex = 0;
  others.forEach((entry) => {
    if (pointerBeat > entry.mid) {
      nextIndex += 1;
    }
  });

  if (nextIndex !== currentIndex) {
    moveSectionToIndex(currentIndex, nextIndex);
    currentBeat = clampBeat(currentBeat);
    refresh();
  }
}

function updateSectionResize(clientX) {
  const { targetIndex, startBars, boundaryBeat, beatsPerBar } = sectionInteraction;
  const targetSection = song.sections[targetIndex];
  if (!targetSection) {
    return;
  }

  const pointerBeat = clientXToTimelineBeat(clientX);
  const deltaBeats = roundToStep(pointerBeat - boundaryBeat, SECTION_RESIZE_BEAT_STEP);
  const nextBars = normalizeSectionBars(startBars + (deltaBeats / beatsPerBar), targetSection);
  if (nextBars !== targetSection.bars) {
    targetSection.bars = nextBars;
    currentBeat = clampBeat(currentBeat);
    refresh();
  }
}

function endSectionInteraction() {
  if (!sectionInteraction) {
    return;
  }
  sectionInteraction = null;
  document.body.style.cursor = '';
  refresh();
}

function totalBars() {
  return Math.round(song.sections.reduce((sum, sec) => sum + sec.bars, 0) * 1000) / 1000;
}

function bpx(beats) {
  return beats * PX_PER_BEAT;
}

function fmtTime(seconds) {
  const sec = Math.max(0, Math.floor(seconds));
  const m = Math.floor(sec / 60);
  const s = String(sec % 60).padStart(2, '0');
  return `${m}:${s}`;
}

function renderPrintView() {
  const titleEl = document.getElementById('print-song-title');
  const listEl = document.getElementById('print-sections-list');

  if (!titleEl || !listEl) {
    return;
  }

  titleEl.textContent = song.title || 'Untitled Song';

  listEl.innerHTML = '';
  song.sections.forEach((sec, index) => {
    const color = COLORS[sec.type] || { fill: '#6b7280', text: '#111827' };
    const row = document.createElement('div');
    row.className = 'print-section-row';

    const head = document.createElement('div');
    head.className = 'print-section-head';

    const dot = document.createElement('span');
    dot.className = 'print-section-dot';
    dot.style.background = color.fill;

    const name = document.createElement('span');
    name.className = 'print-section-name';
    name.textContent = `${index + 1}. ${sec.type}`;

    head.appendChild(dot);
    head.appendChild(name);

    row.style.borderLeftColor = color.fill;

    const chords = document.createElement('div');
    chords.className = 'print-section-chords';
    chords.textContent = sec.chords ? sec.chords : 'No chords entered';

    row.appendChild(head);
    row.appendChild(chords);
    listEl.appendChild(row);
  });
}

function openPrintView() {
  const overlay = document.getElementById('print-view-overlay');
  if (!overlay) {
    return;
  }
  renderPrintView();
  overlay.classList.add('open');
  overlay.setAttribute('aria-hidden', 'false');
  printViewOpen = true;
}

function closePrintView() {
  const overlay = document.getElementById('print-view-overlay');
  if (!overlay) {
    return;
  }
  overlay.classList.remove('open');
  overlay.setAttribute('aria-hidden', 'true');
  printViewOpen = false;
}

function clampBeat(beat) {
  const minBeat = -timelineLeadInBeats();
  return Math.max(minBeat, Math.min(beat, totalTimelineBeats()));
}

function displayBeat() {
  const total = totalTimelineBeats();
  const minBeat = -timelineLeadInBeats();
  if (total <= 0) {
    return minBeat;
  }
  return Math.max(minBeat, Math.min(currentBeat, total - 0.0001));
}

function getSectionAt(beat) {
  if (beat < 0) {
    return null;
  }
  let acc = 0;
  for (let i = 0; i < song.sections.length; i += 1) {
    const sec = song.sections[i];
    const secBeats = sec.bars * secQpb(sec);
    if (beat < acc + secBeats) {
      return { sec, idx: i, beatInSec: beat - acc, secStart: acc };
    }
    acc += secBeats;
  }
  return null;
}

function getSongBarNumber(beat) {
  const clamped = Math.max(0, clampBeat(beat));
  let accBeats = 0;
  let accBars = 0;
  for (let i = 0; i < song.sections.length; i += 1) {
    const sec = song.sections[i];
    const secBeats = sec.bars * secQpb(sec);
    if (clamped < accBeats + secBeats || i === song.sections.length - 1) {
      return accBars + Math.floor((clamped - accBeats) / secQpb(sec)) + 1;
    }
    accBeats += secBeats;
    accBars += sec.bars;
  }
  return 1;
}

function setPlayButtonState() {
  const playBtn = document.getElementById('play-btn');
  const active = playing || countOffRunning;
  playBtn.innerHTML = active ? ICON_PAUSE : ICON_PLAY;
  playBtn.title = active ? 'Pause' : 'Play';
}

function tick(timestamp) {
  const total = totalTimelineBeats();
  let beat = currentBeat;

  if (loadedAudioDurationSec > 0) {
    beat = audioTimeToBeat(audioPlayer.currentTime || 0);
  } else {
    if (startTime == null) {
      startTime = timestamp;
    }
    const bps = song.bpm / 60;
    beat = startBeat + ((timestamp - startTime) / 1000) * bps;
  }

  if (beat >= total) {
    currentBeat = total;
    pause();
    if (loadedAudioDurationSec > 0) {
      audioPlayer.currentTime = Math.min(audioPlayer.duration || 0, beatToAudioTime(total));
    }
    updatePlayhead();
    updateNowPlaying();
    return;
  }

  currentBeat = beat;
  updatePlayhead();
  updateNowPlaying();
  rafId = requestAnimationFrame(tick);
}

async function play() {
  if (countOffRunning) {
    cancelCountOff();
    return;
  }

  const shouldCountOff = countOffEnabled;
  if (shouldCountOff) {
    const countCompleted = await runVisualCountOff();
    if (!countCompleted || playing) {
      return;
    }
  }

  if (currentBeat >= totalTimelineBeats()) {
    currentBeat = loadedAudioDurationSec > 0 ? -timelineLeadInBeats() : 0;
  }

  if (loadedAudioDurationSec > 0) {
    const nextTime = Math.min(loadedAudioDurationSec, Math.max(0, beatToAudioTime(currentBeat)));
    audioPlayer.currentTime = nextTime;
    try {
      await audioPlayer.play();
    } catch (error) {
      window.alert('Could not start audio playback. Try loading another file.');
      console.error(error);
      return;
    }
  }

  playing = true;
  startBeat = currentBeat;
  startTime = null;
  setPlayButtonState();
  rafId = requestAnimationFrame(tick);
}

function pause() {
  cancelCountOff();
  playing = false;
  if (loadedAudioDurationSec > 0) {
    audioPlayer.pause();
  }
  if (rafId != null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
  setPlayButtonState();
}

function stop() {
  pause();
  currentBeat = loadedAudioDurationSec > 0 ? -timelineLeadInBeats() : 0;
  if (loadedAudioDurationSec > 0) {
    audioPlayer.currentTime = 0;
  }
  updatePlayhead();
  updateNowPlaying();
}

function seekToBeat(beat) {
  currentBeat = clampBeat(beat);
  if (loadedAudioDurationSec > 0) {
    audioPlayer.currentTime = Math.min(loadedAudioDurationSec, Math.max(0, beatToAudioTime(currentBeat)));
  }
  startBeat = currentBeat;
  startTime = null;
  updatePlayhead();
  updateNowPlaying();
}

function updatePlayhead() {
  const playhead = document.getElementById('playhead');
  const label = document.getElementById('playhead-label');
  if (!playhead || !label) {
    return;
  }

  const beat = displayBeat();
  const px = bpx(beat + timelineLeadInBeats());
  playhead.style.left = `${px}px`;

  const info = getSectionAt(beat);
  if (info) {
    const bar = Math.floor(info.beatInSec / secQpb(info.sec)) + 1;
    const beatInBar = Math.floor(info.beatInSec % secQpb(info.sec)) + 1;
    label.textContent = `${bar}.${beatInBar}`;
  } else {
    label.textContent = '—';
  }

  if (playing) {
    const wrap = document.getElementById('timeline-wrap');
    wrap.scrollLeft = px - wrap.clientWidth / 2;
  }
}

function updateNowPlaying() {
  const beat = displayBeat();
  const info = getSectionAt(beat);
  const npSectionSlab = document.getElementById('np-section-slab');
  const npSectionName = document.getElementById('np-section-name');
  const npChords = document.getElementById('np-chords');
  const npNextName = document.getElementById('np-next-name');
  const npBarNum = document.getElementById('np-bar-num');
  const npBarTotal = document.getElementById('np-bar-total');
  const npBeatNum = document.getElementById('np-beat-num');
  const progressFill = document.getElementById('progress-fill');
  const progressLabel = document.getElementById('progress-label');

  if (!info) {
    const tBeats = totalTimelineBeats() || 1;
    const progressBeat = Math.max(0, beat);
    npSectionName.textContent = '—';
    npChords.textContent = '';
    npNextName.textContent = '—';
    npBarNum.textContent = '—';
    npBarTotal.textContent = '—';
    npBeatNum.textContent = '—';
    progressFill.style.width = `${(progressBeat / tBeats) * 100}%`;
    progressLabel.textContent = `Bar — / ${formatBars(totalBars())} · ${fmtTime((progressBeat * 60) / song.bpm)} / ${fmtTime((tBeats * 60) / song.bpm)}`;
    document.querySelectorAll('.tl-section').forEach((el) => {
      el.classList.remove('active');
      el.classList.add('inactive');
    });
    document.querySelectorAll('.sidebar-chip').forEach((el) => {
      el.classList.remove('active');
    });
    return;
  }

  const { sec, idx, beatInSec } = info;
  const color = COLORS[sec.type];
  const bar = Math.floor(beatInSec / secQpb(sec)) + 1;
  const beatInBar = Math.floor(beatInSec % secQpb(sec)) + 1;
  const nextSec = song.sections[idx + 1];

  npSectionSlab.style.background = color.fill;
  npSectionName.style.color = color.text;
  npSectionName.textContent = sec.type;
  npChords.style.color = color.text;
  npChords.textContent = sec.chords || '—';
  npBarNum.textContent = String(bar);
  npBarTotal.textContent = formatBars(sec.bars);
  npBeatNum.textContent = String(beatInBar);

  if (nextSec) {
    const nextColor = COLORS[nextSec.type];
    npNextName.textContent = nextSec.type;
    npNextName.style.background = nextColor.fill;
    npNextName.style.color = nextColor.text;
  } else {
    npNextName.textContent = 'End';
    npNextName.style.background = 'transparent';
    npNextName.style.color = 'var(--muted2)';
  }

  const tBeats = totalTimelineBeats() || 1;
  const songBar = Math.min(getSongBarNumber(beat), totalBars());
  const progressBeat = Math.max(0, beat);
  progressFill.style.width = `${(progressBeat / tBeats) * 100}%`;
  progressLabel.textContent = `Bar ${formatBars(songBar)} / ${formatBars(totalBars())} · ${fmtTime((progressBeat * 60) / song.bpm)} / ${fmtTime((tBeats * 60) / song.bpm)}`;

  const activeId = sec.id;
  document.querySelectorAll('.tl-section').forEach((el) => {
    const id = Number(el.dataset.id);
    const isActive = id === activeId;
    el.classList.toggle('active', isActive);
    el.classList.toggle('inactive', !isActive);
  });
  document.querySelectorAll('.sidebar-chip').forEach((el) => {
    const id = Number(el.dataset.id);
    el.classList.toggle('active', id === activeId);
  });
}

function renderRuler(total, leadIn = 0) {
  const ruler = document.getElementById('ruler');
  ruler.innerHTML = '';
  ruler.style.width = `${bpx(total) + 120}px`;

  const songAlignedBeats = Math.max(0, total - leadIn);
  for (let beat = 0; beat <= songAlignedBeats; beat += 1) {
    const visualBeat = leadIn + beat;
    const isMajor = beat % 4 === 0;
    const tick = document.createElement('div');
    tick.className = `r-tick ${isMajor ? 'major' : 'minor'}`;
    tick.style.left = `${bpx(visualBeat)}px`;
    ruler.appendChild(tick);

    if (isMajor) {
      const mark = document.createElement('div');
      mark.className = 'r-mark';
      mark.style.left = `${bpx(visualBeat)}px`;
      mark.textContent = String(Math.floor(beat / 4) + 1);
      ruler.appendChild(mark);
    }
  }
}

function renderWaveform(totalBeatsCount) {
  const inner = document.getElementById('timeline-inner');
  const canvas = document.createElement('canvas');
  const widthPx = Math.max(2, Math.floor(bpx(totalBeatsCount)));
  const heightPx = WAVEFORM_HEIGHT;
  canvas.id = 'waveform-layer';
  canvas.width = widthPx;
  canvas.height = heightPx;
  canvas.style.width = `${widthPx}px`;
  canvas.style.height = `${heightPx}px`;
  inner.appendChild(canvas);

  const drawVersion = waveformVersion;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'rgba(8, 6, 4, 0.55)';
  ctx.fillRect(0, 0, widthPx, heightPx);

  if (!waveformPeaks || !waveformPeaks.length || loadedAudioDurationSec <= 0) {
    const empty = document.createElement('div');
    empty.id = 'waveform-empty';
    empty.textContent = 'Load audio to display waveform';
    inner.appendChild(empty);
    return;
  }

  const audioBeats = Math.max(1, secondsToBeat(loadedAudioDurationSec));
  const audioPx = Math.max(1, Math.floor(bpx(audioBeats)));
  const centerY = Math.floor(heightPx / 2);
  const maxBarHeight = Math.floor(heightPx * 0.44);
  const sampleCount = waveformPeaks.length;

  ctx.fillStyle = 'rgba(245, 158, 11, 0.9)';
  for (let x = 0; x < audioPx; x += 1) {
    if (drawVersion !== waveformVersion) {
      return;
    }
    const sampleIndex = Math.min(sampleCount - 1, Math.floor((x / audioPx) * sampleCount));
    const amp = waveformPeaks[sampleIndex];
    const h = Math.max(1, Math.floor(amp * maxBarHeight));
    ctx.fillRect(x, centerY - h, 1, h * 2);
  }
}

function renderTimeline() {
  const inner = document.getElementById('timeline-inner');
  const total = totalVisualTimelineBeats();
  const leadIn = timelineLeadInBeats();
  inner.style.width = `${bpx(total) + 120}px`;
  inner.innerHTML = '';
  renderRuler(total, leadIn);
  renderWaveform(total);

  let acc = 0;
  song.sections.forEach((sec) => {
    const color = COLORS[sec.type];
    const width = bpx(sec.bars * secQpb(sec));
    const sectionStart = acc;
    const block = document.createElement('div');
    const isDragging = sectionInteraction && sectionInteraction.sectionId === sec.id;
    block.className = `tl-section inactive${isDragging ? ' dragging' : ''}`;
    block.dataset.id = String(sec.id);
    block.style.left = `${bpx(acc + leadIn)}px`;
    block.style.width = `${Math.max(width - 2, 20)}px`;
    block.style.background = color.fill;
    block.innerHTML = `
      <div class="tl-section-handle left" aria-hidden="true"></div>
      <div class="tl-section-body">
        <div class="tl-section-name" style="color:${color.text}">${sec.type}</div>
        <div class="tl-section-bars" style="color:${color.text}">${formatBars(sec.bars)} bars · ${sec.bpb}/${sec.den}</div>
        <div class="tl-section-chords" style="color:${color.text}">${sec.chords || '—'}</div>
      </div>
      <div class="tl-section-handle right" aria-hidden="true"></div>
    `;
    block.onmousedown = (event) => {
      if (event.button !== 0 || event.target.closest('.tl-section-handle')) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      beginSectionMove(event, sec.id);
    };
    block.onclick = (event) => {
      if (suppressTimelineClick) {
        suppressTimelineClick = false;
        event.stopPropagation();
        return;
      }
      event.stopPropagation();
      seekToBeat(sectionStart);
    };
    const leftHandle = block.querySelector('.tl-section-handle.left');
    const rightHandle = block.querySelector('.tl-section-handle.right');
    if (leftHandle) {
      leftHandle.onmousedown = (event) => {
        event.preventDefault();
        event.stopPropagation();
        beginSectionResize(event, sec.id, 'left');
      };
      leftHandle.style.display = sectionStart > 0 ? '' : 'none';
    }
    if (rightHandle) {
      rightHandle.onmousedown = (event) => {
        event.preventDefault();
        event.stopPropagation();
        beginSectionResize(event, sec.id, 'right');
      };
    }
    inner.appendChild(block);
    acc += sec.bars * secQpb(sec);
  });

  if (loadedAudioDurationSec > 0) {
    const marker = document.createElement('button');
    marker.type = 'button';
    marker.id = 'song-start-marker';
    marker.title = 'Drag to line up where bar 1 starts in the audio';
    marker.style.left = `${bpx(leadIn)}px`;
    marker.onmousedown = (event) => {
      event.preventDefault();
      event.stopPropagation();
      beginSongStartDrag(event);
    };
    marker.onclick = (event) => {
      event.stopPropagation();
    };
    inner.appendChild(marker);
  }

  const playhead = document.createElement('div');
  playhead.id = 'playhead';
  playhead.style.left = `${bpx(currentBeat + leadIn)}px`;
  playhead.innerHTML = '<div id="playhead-label">—</div>';
  inner.appendChild(playhead);
}

function renderSidebar() {
  const list = document.getElementById('sidebar-list');
  list.innerHTML = '';

  let acc = 0;
  song.sections.forEach((sec) => {
    const color = COLORS[sec.type];
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'sidebar-chip';
    chip.dataset.id = String(sec.id);
    chip.innerHTML = `
      <span class="chip-dot" style="background:${color.fill}; color:${color.fill};"></span>
      ${sec.type}
      <span class="chip-bars">${formatBars(sec.bars)}</span>
    `;
    const sectionStart = acc;
    chip.onclick = () => seekToBeat(sectionStart);
    list.appendChild(chip);
    acc += sec.bars * secQpb(sec);
  });
}

function renderEditor() {
  const list = document.getElementById('sections-list');
  list.innerHTML = '';

  song.sections.forEach((sec, idx) => {
    const color = COLORS[sec.type];
    const row = document.createElement('div');
    row.className = 'sec-row';

    const swatch = document.createElement('div');
    swatch.className = 'sec-swatch';
    swatch.style.background = color.fill;
    row.appendChild(swatch);

    const moveBtns = document.createElement('div');
    moveBtns.className = 'move-btns';
    const up = document.createElement('button');
    up.className = 'move-btn';
    up.textContent = '▲';
    up.disabled = idx === 0;
    up.onclick = () => moveSection(idx, -1);
    const down = document.createElement('button');
    down.className = 'move-btn';
    down.textContent = '▼';
    down.disabled = idx === song.sections.length - 1;
    down.onclick = () => moveSection(idx, 1);
    moveBtns.appendChild(up);
    moveBtns.appendChild(down);
    row.appendChild(moveBtns);

    const typeSel = document.createElement('select');
    typeSel.className = 'type-sel';
    typeSel.style.color = color.text;
    TYPES.forEach((type) => {
      const option = document.createElement('option');
      option.value = type;
      option.textContent = type;
      option.selected = type === sec.type;
      typeSel.appendChild(option);
    });
    typeSel.onchange = () => {
      sec.type = typeSel.value;
      refresh();
    };
    row.appendChild(typeSel);

    const barsGroup = document.createElement('div');
    barsGroup.className = 'f-grp';
    barsGroup.innerHTML = '<span class="f-lbl">Bars</span>';
    const barsInput = document.createElement('input');
    barsInput.className = 'num-in';
    barsInput.type = 'number';
    barsInput.min = String(getSectionBarStep(sec));
    barsInput.max = String(SECTION_MAX_BARS);
    barsInput.step = String(getSectionBarStep(sec));
    barsInput.value = formatBars(sec.bars);
    barsInput.onchange = () => {
      sec.bars = normalizeSectionBars(parseFloat(barsInput.value), sec);
      barsInput.value = formatBars(sec.bars);
      refresh();
    };
    barsGroup.appendChild(barsInput);
    row.appendChild(barsGroup);

    const timeGroup = document.createElement('div');
    timeGroup.className = 'f-grp';
    timeGroup.innerHTML = '<span class="f-lbl">Time</span>';

    const numSel = document.createElement('select');
    numSel.className = 'time-sel';
    [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].forEach((n) => {
      const option = document.createElement('option');
      option.value = String(n);
      option.textContent = String(n);
      option.selected = n === sec.bpb;
      numSel.appendChild(option);
    });

    const timeSep = document.createElement('span');
    timeSep.className = 'time-sep';
    timeSep.textContent = '/';

    const denSel = document.createElement('select');
    denSel.className = 'time-sel';
    [2, 4, 8, 16].forEach((d) => {
      const option = document.createElement('option');
      option.value = String(d);
      option.textContent = String(d);
      option.selected = d === sec.den;
      denSel.appendChild(option);
    });

    const onTimeSigChange = () => {
      sec.bpb = parseInt(numSel.value, 10);
      sec.den = parseInt(denSel.value, 10);
      sec.bars = normalizeSectionBars(sec.bars, sec);
      refresh();
    };
    numSel.onchange = onTimeSigChange;
    denSel.onchange = onTimeSigChange;

    timeGroup.appendChild(numSel);
    timeGroup.appendChild(timeSep);
    timeGroup.appendChild(denSel);
    row.appendChild(timeGroup);

    const chordGroup = document.createElement('div');
    chordGroup.className = 'f-grp';
    chordGroup.style.flex = '1';
    chordGroup.innerHTML = '<span class="f-lbl">Chords</span>';
    const chordInput = document.createElement('input');
    chordInput.className = 'chord-in';
    chordInput.type = 'text';
    chordInput.placeholder = 'E  A  B  A';
    chordInput.value = sec.chords;
    chordInput.oninput = () => {
      sec.chords = chordInput.value;
      renderTimeline();
      updatePlayhead();
      updateNowPlaying();
    };
    chordGroup.appendChild(chordInput);
    row.appendChild(chordGroup);

    const remove = document.createElement('button');
    remove.className = 'rm-btn';
    remove.textContent = '✕';
    remove.onclick = () => {
      if (song.sections.length === 1) {
        return;
      }
      song.sections.splice(idx, 1);
      currentBeat = clampBeat(currentBeat);
      refresh();
    };
    row.appendChild(remove);

    list.appendChild(row);
  });
}

function moveSection(index, direction) {
  const target = index + direction;
  if (target < 0 || target >= song.sections.length) {
    return;
  }
  [song.sections[index], song.sections[target]] = [song.sections[target], song.sections[index]];
  refresh();
}

function refresh() {
  renderTimeline();
  renderSidebar();
  renderEditor();
  renderPrintView();
  updatePlayhead();
  updateNowPlaying();
}

document.getElementById('play-btn').onclick = () => {
  if (playing) {
    pause();
  } else {
    play();
  }
};

document.getElementById('stop-btn').onclick = stop;

document.getElementById('bpm-input').oninput = (event) => {
  const nextBpm = Math.max(20, Math.min(400, parseInt(event.target.value, 10) || 60));
  song.bpm = nextBpm;
  currentBeat = clampBeat(currentBeat);
  refresh();
  if (playing) {
    pause();
    play();
  }
};

document.getElementById('countoff-toggle').onchange = (event) => {
  countOffEnabled = Boolean(event.target.checked);
  if (!countOffEnabled) {
    cancelCountOff();
  }
  syncCountOffInputs();
};

document.getElementById('countoff-beats').oninput = (event) => {
  countOffBeats = clampCountOffBeats(event.target.value);
  event.target.value = String(countOffBeats);
};

// --- Tap tempo ---
const tapTimes = [];
let tapResetTimer = null;
const TAP_RESET_MS = 2000; // reset if no tap for 2 s

function applyTapTempo() {
  if (tapTimes.length < 2) return;
  const intervals = [];
  for (let i = 1; i < tapTimes.length; i++) {
    intervals.push(tapTimes[i] - tapTimes[i - 1]);
  }
  const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  const newBpm = Math.max(20, Math.min(400, Math.round(60000 / avgInterval)));
  song.bpm = newBpm;
  document.getElementById('bpm-input').value = String(newBpm);
  currentBeat = clampBeat(currentBeat);
  refresh();
  if (playing) { pause(); play(); }
}

function onTap() {
  const now = Date.now();
  const tapBtn = document.getElementById('tap-btn');

  if (tapResetTimer !== null) {
    clearTimeout(tapResetTimer);
  }

  // Reset if gap is too long
  if (tapTimes.length > 0 && now - tapTimes[tapTimes.length - 1] > TAP_RESET_MS) {
    tapTimes.length = 0;
  }

  tapTimes.push(now);
  tapBtn.classList.add('tapping');
  applyTapTempo();

  tapResetTimer = setTimeout(() => {
    tapTimes.length = 0;
    tapBtn.classList.remove('tapping');
    tapResetTimer = null;
  }, TAP_RESET_MS);
}

document.getElementById('tap-btn').onclick = onTap;

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && printViewOpen) {
    event.preventDefault();
    closePrintView();
    return;
  }

  const active = document.activeElement;
  const tag = active ? active.tagName : '';
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

  if (event.key === ' ' || event.code === 'Space') {
    if (event.repeat) {
      event.preventDefault();
      return;
    }
    event.preventDefault();
    if (playing) {
      pause();
    } else {
      play();
    }
    return;
  }

  if (event.key === 't' || event.key === 'T') {
    event.preventDefault();
    onTap();
  }
});

document.getElementById('song-title').oninput = (event) => {
  song.title = event.target.value;
};

document.getElementById('save-song-btn').onclick = saveSongToDisk;

document.getElementById('load-audio-btn').onclick = () => {
  const input = document.getElementById('load-audio-input');
  input.value = '';
  input.click();
};

document.getElementById('clear-audio-btn').onclick = clearLoadedAudio;
document.getElementById('clear-song-btn').onclick = clearSong;
document.getElementById('detect-bpm-btn').onclick = detectBpmFromLoadedAudio;

document.getElementById('load-audio-input').onchange = async (event) => {
  const file = event.target.files && event.target.files[0];
  if (!file) {
    return;
  }

  try {
    await loadAudioFile(file);
  } catch (error) {
    window.alert(`Could not load audio file: ${error.message}`);
    console.error(error);
  }
};

document.getElementById('load-song-btn').onclick = () => {
  const loadInput = document.getElementById('load-song-input');
  loadInput.value = '';
  loadInput.click();
};

document.getElementById('load-song-input').onchange = async (event) => {
  const file = event.target.files && event.target.files[0];
  if (!file) {
    return;
  }

  const text = await file.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    window.alert('Could not parse that file. Please select a valid song JSON file.');
    console.error(error);
    return;
  }

  try {
    await loadSongFromData(parsed);
  } catch (error) {
    window.alert(error.message);
    console.error(error);
  }
};

document.getElementById('load-song-url-btn').onclick = async () => {
  const defaultUrl = new URLSearchParams(window.location.search).get('song') || '';
  const userUrl = window.prompt('Enter song JSON URL', defaultUrl);
  if (!userUrl) {
    return;
  }

  try {
    await fetchSongJsonFromUrl(userUrl);
  } catch (error) {
    window.alert(error.message);
    console.error(error);
  }
};

document.getElementById('editor-toggle').onclick = () => {
  const editor = document.getElementById('editor');
  const hidden = editor.classList.toggle('hidden');
  document.getElementById('editor-toggle').classList.toggle('active', !hidden);
};

document.getElementById('print-view-btn').onclick = openPrintView;
document.getElementById('close-print-view-btn').onclick = closePrintView;
document.getElementById('print-sheet-btn').onclick = () => {
  renderPrintView();
  window.print();
};
document.getElementById('print-view-overlay').onclick = (event) => {
  if (event.target.id === 'print-view-overlay') {
    closePrintView();
  }
};

function clearSong() {
  if (!window.confirm('Start a new song? All sections, the title, and any loaded audio will be cleared.')) {
    return;
  }
  song = { title: 'New Song', bpm: 120, sections: [{ id: 1, type: 'Verse', bars: 4, bpb: 4, den: 4, chords: '' }] };
  countOffEnabled = COUNT_OFF_DEFAULT_ENABLED;
  countOffBeats = COUNT_OFF_DEFAULT_BEATS;
  nextId = 2;
  currentBeat = 0;
  startBeat = 0;
  startTime = null;
  syncSongInputs();
  clearLoadedAudio();
}

function addSection() {
  song.sections.push({ id: nextId, type: 'Verse', bars: 4, bpb: 4, den: 4, chords: '' });
  nextId += 1;
  refresh();
}

document.getElementById('add-section-btn').onclick = addSection;
document.getElementById('sidebar-add').onclick = addSection;

document.getElementById('timeline-wrap').onclick = (event) => {
  if (suppressTimelineClick) {
    suppressTimelineClick = false;
    return;
  }
  const wrap = document.getElementById('timeline-wrap');
  const rect = wrap.getBoundingClientRect();
  const x = event.clientX - rect.left + wrap.scrollLeft;
  seekToBeat((x / PX_PER_BEAT) - timelineLeadInBeats());
};

window.addEventListener('mousemove', (event) => {
  if (sectionInteraction) {
    if (Math.abs(event.clientX - sectionInteraction.startClientX) > 3) {
      suppressTimelineClick = true;
    }
    if (sectionInteraction.mode === 'move') {
      updateSectionMove(event.clientX);
    } else {
      updateSectionResize(event.clientX);
    }
    return;
  }
  if (!draggingSongStart) {
    return;
  }
  updateSongStartFromPointer(event.clientX);
});

window.addEventListener('mouseup', () => {
  if (sectionInteraction) {
    endSectionInteraction();
    return;
  }
  if (!draggingSongStart) {
    return;
  }
  draggingSongStart = false;
  document.body.style.cursor = '';
});

audioPlayer.onended = () => {
  currentBeat = clampBeat(audioTimeToBeat(audioPlayer.duration || 0));
  pause();
  updatePlayhead();
  updateNowPlaying();
};

window.addEventListener('beforeunload', cleanupAudioUrl);

setPlayButtonState();
syncSongInputs();
updateAudioStatus();
updateAudioClearState();
updateAudioOffsetUi();
updateBpmDetectionUi();
hideCountOffOverlay();
refresh();

(async () => {
  const songUrl = new URLSearchParams(window.location.search).get('song');
  if (!songUrl) {
    return;
  }

  try {
    await fetchSongJsonFromUrl(songUrl);
  } catch (error) {
    window.alert(error.message);
    console.error(error);
  }
})();
