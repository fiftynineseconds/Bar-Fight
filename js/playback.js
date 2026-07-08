// Bar Fight — transport: play/pause/stop, the rAF tick loop, seeking.
// Without audio the playhead is clocked by wall time at the song BPM;
// with audio loaded, the audio element is the clock.
(() => {
  const BF = window.BarFight;
  const { state } = BF;
  const { ICON_PLAY, ICON_PAUSE } = BF.constants;
  const T = BF.timing;

  function setPlayButtonState() {
    const playBtn = document.getElementById('play-btn');
    const active = state.playing || state.countOffRunning;
    playBtn.innerHTML = active ? ICON_PAUSE : ICON_PLAY;
    playBtn.title = active ? 'Pause' : 'Play';
  }

  function tick(timestamp) {
    let total = T.totalTimelineBeats();
    let beat = state.currentBeat;

    if (state.loadedAudioDurationSec > 0) {
      beat = T.audioTimeToBeat(state.audioPlayer.currentTime || 0);
    } else {
      if (state.startTime == null) {
        state.startTime = timestamp;
      }
      const bps = state.song.bpm / 60;
      beat = state.startBeat + ((timestamp - state.startTime) / 1000) * bps;
    }

    // Live building without audio: grow the last section so playback never runs out of runway
    if (beat >= total && state.liveBuildActive && state.loadedAudioDurationSec <= 0) {
      const last = state.song.sections[state.song.sections.length - 1];
      const grown = T.normalizeSectionBars(last.bars + 1, last);
      if (grown > last.bars) {
        last.bars = grown;
        total = T.totalTimelineBeats();
        BF.ui.refresh();
      }
    }

    if (beat >= total) {
      state.currentBeat = total;
      pause();
      if (state.loadedAudioDurationSec > 0) {
        state.audioPlayer.currentTime = Math.min(state.audioPlayer.duration || 0, T.beatToAudioTime(total));
      }
      BF.ui.updatePlayhead();
      BF.ui.updateNowPlaying();
      return;
    }

    state.currentBeat = beat;
    BF.ui.updatePlayhead();
    BF.ui.updateNowPlaying();
    state.rafId = requestAnimationFrame(tick);
  }

  async function play() {
    if (state.countOffRunning) {
      BF.countoff.cancelCountOff();
      return;
    }

    if (state.countOffEnabled) {
      const countCompleted = await BF.countoff.runVisualCountOff();
      if (!countCompleted || state.playing) {
        return;
      }
    }

    if (state.currentBeat >= T.totalTimelineBeats()) {
      state.currentBeat = state.loadedAudioDurationSec > 0 ? -T.timelineLeadInBeats() : 0;
    }

    if (state.loadedAudioDurationSec > 0) {
      const nextTime = Math.min(state.loadedAudioDurationSec, Math.max(0, T.beatToAudioTime(state.currentBeat)));
      state.audioPlayer.currentTime = nextTime;
      try {
        await state.audioPlayer.play();
      } catch (error) {
        window.alert('Could not start audio playback. Try loading another file.');
        console.error(error);
        return;
      }
    }

    state.playing = true;
    state.startBeat = state.currentBeat;
    state.startTime = null;
    setPlayButtonState();
    state.rafId = requestAnimationFrame(tick);
  }

  function pause() {
    BF.countoff.cancelCountOff();
    state.playing = false;
    state.liveBuildActive = false;
    if (state.loadedAudioDurationSec > 0) {
      state.audioPlayer.pause();
    }
    if (state.rafId != null) {
      cancelAnimationFrame(state.rafId);
      state.rafId = null;
    }
    setPlayButtonState();
  }

  function stop() {
    pause();
    state.currentBeat = state.loadedAudioDurationSec > 0 ? -T.timelineLeadInBeats() : 0;
    if (state.loadedAudioDurationSec > 0) {
      state.audioPlayer.currentTime = 0;
    }
    BF.ui.updatePlayhead();
    BF.ui.updateNowPlaying();
  }

  function seekToBeat(beat) {
    state.currentBeat = T.clampBeat(beat);
    if (state.loadedAudioDurationSec > 0) {
      state.audioPlayer.currentTime = Math.min(state.loadedAudioDurationSec, Math.max(0, T.beatToAudioTime(state.currentBeat)));
    }
    state.startBeat = state.currentBeat;
    state.startTime = null;
    BF.ui.updatePlayhead();
    BF.ui.updateNowPlaying();
  }

  BF.playback = {
    setPlayButtonState,
    play,
    pause,
    stop,
    seekToBeat,
  };
})();
