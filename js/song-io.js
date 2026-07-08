// Bar Fight — song JSON: validation, save to disk, load from disk or URL.
(() => {
  const BF = window.BarFight;
  const { state } = BF;
  const { TYPES, COUNT_OFF_DEFAULT_ENABLED } = BF.constants;
  const T = BF.timing;

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
    const countOffEnabled = typeof rawCountOff.enabled === 'boolean' ? rawCountOff.enabled : COUNT_OFF_DEFAULT_ENABLED;
    const countOffBeats = BF.countoff.clampCountOffBeats(rawCountOff.beats);
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
      const bars = T.normalizeSectionBars(parsedBars, { bpb, den });

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
      countOffEnabled,
      countOffBeats,
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
    BF.playback.pause();
    state.currentBeat = 0;
    state.startBeat = 0;
    state.startTime = null;
    state.song = {
      title: nextSong.title,
      bpm: nextSong.bpm,
      sections: nextSong.sections,
    };
    state.countOffEnabled = nextSong.countOffEnabled;
    state.countOffBeats = nextSong.countOffBeats;
    BF.countoff.cancelCountOff();

    BF.audio.clearLoadedAudio();
    state.expectedAudioFileName = nextSong.audioFileName;

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
        await BF.audio.loadAudioFile(embeddedFile);
      } catch (error) {
        throw new Error(`Could not load embedded audio: ${error.message}`);
      }
    } else if (nextSong.audioUrl) {
      const resolvedAudioUrl = resolveUrlWithBase(nextSong.audioUrl, sourceUrl);
      try {
        await BF.audio.loadAudioFromUrl(resolvedAudioUrl, nextSong.audioFileName);
      } catch (error) {
        throw new Error(`Could not load audio from URL: ${error.message}`);
      }
    }

    BF.audio.setAudioStartOffset(nextSong.audioStartOffset, { keepPlayback: false });
    state.nextId = state.song.sections.reduce((maxId, section) => Math.max(maxId, section.id), 0) + 1;
    BF.ui.syncSongInputs();
    BF.ui.refresh();
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
    const cleanedTitle = state.song.title
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    return `${cleanedTitle || 'song'}.json`;
  }

  async function saveSongToDisk() {
    try {
      const payload = {
        title: state.song.title,
        bpm: state.song.bpm,
        sections: state.song.sections,
        countOff: {
          enabled: state.countOffEnabled,
          beats: state.countOffBeats,
        },
        audio: {
          startOffsetSec: Math.round(state.audioStartOffsetSec * 1000) / 1000,
          fileName: state.loadedAudioName || state.expectedAudioFileName || '',
          url: state.loadedAudioSourceUrl || '',
        },
      };

      if (state.loadedAudioBlob) {
        payload.audio.embedded = {
          fileName: state.loadedAudioName || state.expectedAudioFileName || 'embedded-audio',
          mimeType: state.loadedAudioBlob.type || '',
          dataUrl: await blobToDataUrl(state.loadedAudioBlob),
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

  BF.songIO = {
    sanitizeSong,
    loadSongFromData,
    fetchSongJsonFromUrl,
    saveSongToDisk,
  };
})();
