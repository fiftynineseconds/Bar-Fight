// Bar Fight — timing math. All positions are in quarter-note beats
// (BPM = quarter notes/min); these helpers convert between bars, beats,
// seconds, pixels, and section positions.
(() => {
  const BF = window.BarFight;
  const { state } = BF;
  const { PX_PER_BEAT, SECTION_MAX_BARS } = BF.constants;

  // Quarter-note beats per bar for a section's time signature.
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

  function fmtTime(seconds) {
    const sec = Math.max(0, Math.floor(seconds));
    const m = Math.floor(sec / 60);
    const s = String(sec % 60).padStart(2, '0');
    return `${m}:${s}`;
  }

  function bpx(beats) {
    return beats * PX_PER_BEAT;
  }

  function beatToSeconds(beat) {
    return (beat * 60) / state.song.bpm;
  }

  function secondsToBeat(seconds) {
    return (seconds * state.song.bpm) / 60;
  }

  function beatToAudioTime(beat) {
    return beatToSeconds(beat) + state.audioStartOffsetSec;
  }

  function audioTimeToBeat(seconds) {
    return secondsToBeat(seconds - state.audioStartOffsetSec);
  }

  function availableAudioDurationSec() {
    return Math.max(0, state.loadedAudioDurationSec - state.audioStartOffsetSec);
  }

  function timelineLeadInBeats() {
    if (state.loadedAudioDurationSec <= 0) {
      return 0;
    }
    return secondsToBeat(state.audioStartOffsetSec);
  }

  function clampAudioStartOffset(seconds) {
    if (state.loadedAudioDurationSec <= 0) {
      return Math.max(0, seconds);
    }
    const maxOffset = Math.max(0, state.loadedAudioDurationSec - 0.01);
    return Math.max(0, Math.min(seconds, maxOffset));
  }

  function totalBeats() {
    return state.song.sections.reduce((sum, sec) => sum + sec.bars * secQpb(sec), 0);
  }

  function totalBars() {
    return Math.round(state.song.sections.reduce((sum, sec) => sum + sec.bars, 0) * 1000) / 1000;
  }

  function totalTimelineBeats() {
    const songBeats = totalBeats();
    if (state.loadedAudioDurationSec <= 0) {
      return songBeats;
    }
    return Math.max(songBeats, secondsToBeat(availableAudioDurationSec()));
  }

  function totalVisualTimelineBeats() {
    return totalTimelineBeats() + timelineLeadInBeats();
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
    return Math.max(minBeat, Math.min(state.currentBeat, total - 0.0001));
  }

  function getSectionAt(beat) {
    if (beat < 0) {
      return null;
    }
    let acc = 0;
    for (let i = 0; i < state.song.sections.length; i += 1) {
      const sec = state.song.sections[i];
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
    for (let i = 0; i < state.song.sections.length; i += 1) {
      const sec = state.song.sections[i];
      const secBeats = sec.bars * secQpb(sec);
      if (clamped < accBeats + secBeats || i === state.song.sections.length - 1) {
        return accBars + Math.floor((clamped - accBeats) / secQpb(sec)) + 1;
      }
      accBeats += secBeats;
      accBars += sec.bars;
    }
    return 1;
  }

  function getSectionIndexById(sectionId) {
    return state.song.sections.findIndex((sec) => sec.id === sectionId);
  }

  function getSectionStartBeatByIndex(index) {
    let acc = 0;
    for (let i = 0; i < index; i += 1) {
      acc += state.song.sections[i].bars * secQpb(state.song.sections[i]);
    }
    return acc;
  }

  BF.timing = {
    secQpb,
    roundToStep,
    getSectionBarStep,
    normalizeSectionBars,
    formatBars,
    fmtTime,
    bpx,
    beatToSeconds,
    secondsToBeat,
    beatToAudioTime,
    audioTimeToBeat,
    availableAudioDurationSec,
    timelineLeadInBeats,
    clampAudioStartOffset,
    totalBeats,
    totalBars,
    totalTimelineBeats,
    totalVisualTimelineBeats,
    clampBeat,
    displayBeat,
    getSectionAt,
    getSongBarNumber,
    getSectionIndexById,
    getSectionStartBeatByIndex,
  };
})();
