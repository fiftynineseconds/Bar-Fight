// Bar Fight — event wiring and startup. Loads last; connects the DOM to the
// modules and kicks off the initial render (plus ?song= auto-load).
(() => {
  const BF = window.BarFight;
  const { state } = BF;
  const { SECTION_KEY_SHORTCUTS } = BF.constants;
  const T = BF.timing;

  // --- Transport ---

  document.getElementById('play-btn').onclick = () => {
    if (state.playing) {
      BF.playback.pause();
    } else {
      BF.playback.play();
    }
  };

  document.getElementById('stop-btn').onclick = BF.playback.stop;

  // --- Tempo ---

  document.getElementById('bpm-input').oninput = (event) => {
    const nextBpm = Math.max(20, Math.min(400, parseInt(event.target.value, 10) || 60));
    state.song.bpm = nextBpm;
    state.currentBeat = T.clampBeat(state.currentBeat);
    BF.ui.refresh();
    if (state.playing) {
      BF.playback.pause();
      BF.playback.play();
    }
  };

  // Tap tempo
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
    state.song.bpm = newBpm;
    document.getElementById('bpm-input').value = String(newBpm);
    state.currentBeat = T.clampBeat(state.currentBeat);
    BF.ui.refresh();
    if (state.playing) {
      BF.playback.pause();
      BF.playback.play();
    }
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

  // --- Count-off ---

  document.getElementById('countoff-toggle').onchange = (event) => {
    state.countOffEnabled = Boolean(event.target.checked);
    if (!state.countOffEnabled) {
      BF.countoff.cancelCountOff();
    }
    BF.countoff.syncCountOffInputs();
  };

  document.getElementById('countoff-beats').oninput = (event) => {
    state.countOffBeats = BF.countoff.clampCountOffBeats(event.target.value);
    event.target.value = String(state.countOffBeats);
  };

  // --- Keyboard ---

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && state.printViewOpen) {
      event.preventDefault();
      BF.ui.closePrintView();
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
      if (state.playing) {
        BF.playback.pause();
      } else {
        BF.playback.play();
      }
      return;
    }

    if (event.key === 't' || event.key === 'T') {
      event.preventDefault();
      onTap();
      return;
    }

    // Section shortcuts must not swallow browser combos like Ctrl+S or Ctrl+C
    if (event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }

    const key = event.key.toLowerCase();
    if (key === 'a' || SECTION_KEY_SHORTCUTS[key]) {
      event.preventDefault();
      if (event.repeat) {
        return;
      }
      BF.sections.addSectionAtPlayhead(key === 'a' ? null : SECTION_KEY_SHORTCUTS[key]);
    }
  });

  // --- Song fields ---

  document.getElementById('song-title').oninput = (event) => {
    state.song.title = event.target.value;
  };

  document.getElementById('save-song-btn').onclick = BF.songIO.saveSongToDisk;

  // --- Audio ---

  document.getElementById('load-audio-btn').onclick = () => {
    const input = document.getElementById('load-audio-input');
    input.value = '';
    input.click();
  };

  document.getElementById('clear-audio-btn').onclick = BF.audio.clearLoadedAudio;
  document.getElementById('clear-song-btn').onclick = BF.sections.clearSong;
  document.getElementById('detect-bpm-btn').onclick = BF.audio.detectBpmFromLoadedAudio;

  document.getElementById('load-audio-input').onchange = async (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) {
      return;
    }

    try {
      await BF.audio.loadAudioFile(file);
    } catch (error) {
      window.alert(`Could not load audio file: ${error.message}`);
      console.error(error);
    }
  };

  // --- Song load ---

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
      await BF.songIO.loadSongFromData(parsed);
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
      await BF.songIO.fetchSongJsonFromUrl(userUrl);
    } catch (error) {
      window.alert(error.message);
      console.error(error);
    }
  };

  // --- Panels ---

  document.getElementById('shortcuts-toggle').onclick = () => {
    const panel = document.getElementById('shortcuts-panel');
    panel.hidden = !panel.hidden;
    document.getElementById('shortcuts-toggle').classList.toggle('active', !panel.hidden);
  };

  document.getElementById('editor-toggle').onclick = () => {
    const editor = document.getElementById('editor');
    const hidden = editor.classList.toggle('hidden');
    document.getElementById('editor-toggle').classList.toggle('active', !hidden);
  };

  document.getElementById('print-view-btn').onclick = BF.ui.openPrintView;
  document.getElementById('close-print-view-btn').onclick = BF.ui.closePrintView;
  document.getElementById('print-sheet-btn').onclick = () => {
    BF.ui.renderPrintView();
    window.print();
  };
  document.getElementById('print-view-overlay').onclick = (event) => {
    if (event.target.id === 'print-view-overlay') {
      BF.ui.closePrintView();
    }
  };

  // --- Sections ---

  document.getElementById('add-section-btn').onclick = BF.sections.addSection;
  document.getElementById('sidebar-add').onclick = BF.sections.addSection;

  // --- Timeline pointer interactions ---

  document.getElementById('timeline-wrap').onclick = (event) => {
    if (state.suppressTimelineClick) {
      state.suppressTimelineClick = false;
      return;
    }
    BF.playback.seekToBeat(BF.sections.clientXToTimelineBeat(event.clientX));
  };

  window.addEventListener('pointermove', (event) => {
    if (state.sectionInteraction) {
      if (state.sectionInteraction.pointerId != null && event.pointerId !== state.sectionInteraction.pointerId) {
        return;
      }
      event.preventDefault();
      if (Math.abs(event.clientX - state.sectionInteraction.startClientX) > 3) {
        state.suppressTimelineClick = true;
      }
      if (state.sectionInteraction.mode === 'move') {
        BF.sections.updateSectionMove(event.clientX);
      } else {
        BF.sections.updateSectionResize(event.clientX);
      }
      return;
    }
    if (!state.draggingSongStart) {
      return;
    }
    if (state.activeSongStartPointerId != null && event.pointerId !== state.activeSongStartPointerId) {
      return;
    }
    event.preventDefault();
    BF.audio.updateSongStartFromPointer(event.clientX);
  });

  window.addEventListener('pointerup', (event) => {
    if (state.sectionInteraction) {
      if (state.sectionInteraction.pointerId != null && event.pointerId !== state.sectionInteraction.pointerId) {
        return;
      }
      BF.sections.endSectionInteraction();
      return;
    }
    if (!state.draggingSongStart) {
      return;
    }
    if (state.activeSongStartPointerId != null && event.pointerId !== state.activeSongStartPointerId) {
      return;
    }
    state.draggingSongStart = false;
    state.activeSongStartPointerId = null;
    document.body.style.cursor = '';
  });

  window.addEventListener('pointercancel', (event) => {
    if (state.sectionInteraction && (state.sectionInteraction.pointerId == null || event.pointerId === state.sectionInteraction.pointerId)) {
      BF.sections.endSectionInteraction();
    }
    if (state.draggingSongStart && (state.activeSongStartPointerId == null || event.pointerId === state.activeSongStartPointerId)) {
      state.draggingSongStart = false;
      state.activeSongStartPointerId = null;
      document.body.style.cursor = '';
    }
  });

  // --- Audio element ---

  state.audioPlayer.onended = () => {
    state.currentBeat = T.clampBeat(T.audioTimeToBeat(state.audioPlayer.duration || 0));
    BF.playback.pause();
    BF.ui.updatePlayhead();
    BF.ui.updateNowPlaying();
  };

  window.addEventListener('beforeunload', BF.audio.cleanupAudioUrl);

  // --- Startup ---

  BF.playback.setPlayButtonState();
  BF.ui.renderShortcutsPanel();
  BF.ui.syncSongInputs();
  BF.audio.updateAudioStatus();
  BF.audio.updateAudioClearState();
  BF.audio.updateBpmDetectionUi();
  BF.countoff.hideCountOffOverlay();
  BF.ui.refresh();

  (async () => {
    const songUrl = new URLSearchParams(window.location.search).get('song');
    if (!songUrl) {
      return;
    }

    try {
      await BF.songIO.fetchSongJsonFromUrl(songUrl);
    } catch (error) {
      window.alert(error.message);
      console.error(error);
    }
  })();
})();
