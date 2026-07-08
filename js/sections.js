// Bar Fight — section operations: add, reorder, live-build at the playhead,
// timeline drag interactions (move / resize), and clearing the song.
(() => {
  const BF = window.BarFight;
  const { state } = BF;
  const {
    PX_PER_BEAT,
    SECTION_RESIZE_BEAT_STEP,
    NEW_SECTION_BARS,
    COUNT_OFF_DEFAULT_ENABLED,
    COUNT_OFF_DEFAULT_BEATS,
  } = BF.constants;
  const T = BF.timing;

  function clientXToTimelineBeat(clientX) {
    const wrap = document.getElementById('timeline-wrap');
    const rect = wrap.getBoundingClientRect();
    const x = clientX - rect.left + wrap.scrollLeft;
    return (x / PX_PER_BEAT) - T.timelineLeadInBeats();
  }

  function moveSectionToIndex(fromIndex, toIndex) {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= state.song.sections.length || toIndex >= state.song.sections.length) {
      return;
    }
    const [moved] = state.song.sections.splice(fromIndex, 1);
    state.song.sections.splice(toIndex, 0, moved);
  }

  function moveSection(index, direction) {
    const target = index + direction;
    if (target < 0 || target >= state.song.sections.length) {
      return;
    }
    [state.song.sections[index], state.song.sections[target]] = [state.song.sections[target], state.song.sections[index]];
    BF.ui.refresh();
  }

  function addSection() {
    state.song.sections.push({ id: state.nextId, type: 'Verse', bars: 4, bpb: 4, den: 4, chords: '' });
    state.nextId += 1;
    BF.ui.refresh();
  }

  function addSectionAtPlayhead(requestedType) {
    const beat = state.currentBeat;
    if (beat < 0 || state.song.sections.length === 0) {
      return;
    }

    const info = T.getSectionAt(beat);
    let template;
    let insertIndex;

    if (info) {
      const { sec, idx, beatInSec } = info;
      const boundaryBars = Math.round(beatInSec / T.secQpb(sec));
      template = sec;
      if (boundaryBars <= 0) {
        // Playhead snaps to this section's start: slot the new section in front of it
        insertIndex = idx;
      } else {
        sec.bars = T.normalizeSectionBars(boundaryBars, sec);
        insertIndex = idx + 1;
      }
    } else {
      // Playhead is past the last section: stretch it to meet the new one
      const lastIndex = state.song.sections.length - 1;
      const last = state.song.sections[lastIndex];
      const barsToPlayhead = Math.round((beat - T.getSectionStartBeatByIndex(lastIndex)) / T.secQpb(last));
      last.bars = T.normalizeSectionBars(Math.max(last.bars, barsToPlayhead), last);
      template = last;
      insertIndex = state.song.sections.length;
    }

    state.song.sections.splice(insertIndex, 0, {
      id: state.nextId,
      type: requestedType || template.type,
      bars: NEW_SECTION_BARS,
      bpb: template.bpb,
      den: template.den,
      chords: '',
    });
    state.nextId += 1;

    if (state.playing) {
      state.liveBuildActive = true;
    }
    state.currentBeat = T.clampBeat(state.currentBeat);
    BF.ui.refresh();
  }

  function clearSong() {
    if (!window.confirm('Start a new song? All sections, the title, and any loaded audio will be cleared.')) {
      return;
    }
    state.song = { title: 'New Song', bpm: 120, sections: [{ id: 1, type: 'Verse', bars: 4, bpb: 4, den: 4, chords: '' }] };
    state.countOffEnabled = COUNT_OFF_DEFAULT_ENABLED;
    state.countOffBeats = COUNT_OFF_DEFAULT_BEATS;
    state.nextId = 2;
    state.currentBeat = 0;
    state.startBeat = 0;
    state.startTime = null;
    state.expectedAudioFileName = '';
    BF.ui.syncSongInputs();
    BF.audio.clearLoadedAudio();
  }

  function beginSectionMove(event, sectionId) {
    const index = T.getSectionIndexById(sectionId);
    if (index < 0) {
      return;
    }
    state.sectionInteraction = {
      mode: 'move',
      sectionId,
      startClientX: event.clientX,
      pointerId: event.pointerId ?? null,
    };
    document.body.style.cursor = 'grabbing';
    BF.ui.refresh();
  }

  function beginSectionResize(event, sectionId, side) {
    const index = T.getSectionIndexById(sectionId);
    if (index < 0) {
      return;
    }

    const targetIndex = side === 'left' ? index - 1 : index;
    if (targetIndex < 0 || targetIndex >= state.song.sections.length) {
      return;
    }

    const targetSection = state.song.sections[targetIndex];
    const boundaryBeat = T.getSectionStartBeatByIndex(side === 'left' ? index : index + 1);
    state.sectionInteraction = {
      mode: side === 'left' ? 'resize-left' : 'resize-right',
      sectionId,
      startClientX: event.clientX,
      pointerId: event.pointerId ?? null,
      targetIndex,
      startBars: targetSection.bars,
      boundaryBeat,
      beatsPerBar: T.secQpb(targetSection),
    };
    document.body.style.cursor = 'ew-resize';
    BF.ui.refresh();
  }

  function updateSectionMove(clientX) {
    const { sectionId } = state.sectionInteraction;
    const currentIndex = T.getSectionIndexById(sectionId);
    if (currentIndex < 0) {
      return;
    }
    const pointerBeat = clientXToTimelineBeat(clientX);

    let acc = 0;
    const others = state.song.sections
      .map((sec, index) => {
        const start = acc;
        const beats = sec.bars * T.secQpb(sec);
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
      state.currentBeat = T.clampBeat(state.currentBeat);
      BF.ui.refresh();
    }
  }

  function updateSectionResize(clientX) {
    const { targetIndex, startBars, boundaryBeat, beatsPerBar } = state.sectionInteraction;
    const targetSection = state.song.sections[targetIndex];
    if (!targetSection) {
      return;
    }

    const pointerBeat = clientXToTimelineBeat(clientX);
    const deltaBeats = T.roundToStep(pointerBeat - boundaryBeat, SECTION_RESIZE_BEAT_STEP);
    const nextBars = T.normalizeSectionBars(startBars + (deltaBeats / beatsPerBar), targetSection);
    if (nextBars !== targetSection.bars) {
      targetSection.bars = nextBars;
      state.currentBeat = T.clampBeat(state.currentBeat);
      BF.ui.refresh();
    }
  }

  function endSectionInteraction() {
    if (!state.sectionInteraction) {
      return;
    }
    state.sectionInteraction = null;
    document.body.style.cursor = '';
    BF.ui.refresh();
  }

  BF.sections = {
    clientXToTimelineBeat,
    moveSection,
    addSection,
    addSectionAtPlayhead,
    clearSong,
    beginSectionMove,
    beginSectionResize,
    updateSectionMove,
    updateSectionResize,
    endSectionInteraction,
  };
})();
