// Bar Fight — all DOM rendering: timeline, sidebar, editor, shortcuts panel,
// print view, playhead, and the now-playing header.
(() => {
  const BF = window.BarFight;
  const { state } = BF;
  const { COLORS, TYPES, SECTION_MAX_BARS, SECTION_KEY_SHORTCUTS, WAVEFORM_HEIGHT } = BF.constants;
  const T = BF.timing;

  function syncSongInputs() {
    const titleInput = document.getElementById('song-title');
    const bpmInput = document.getElementById('bpm-input');
    titleInput.value = state.song.title;
    bpmInput.value = String(state.song.bpm);
    BF.countoff.syncCountOffInputs();
  }

  function renderPrintView() {
    const titleEl = document.getElementById('print-song-title');
    const listEl = document.getElementById('print-sections-list');

    if (!titleEl || !listEl) {
      return;
    }

    titleEl.textContent = state.song.title || 'Untitled Song';

    listEl.innerHTML = '';
    state.song.sections.forEach((sec, index) => {
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
    state.printViewOpen = true;
  }

  function closePrintView() {
    const overlay = document.getElementById('print-view-overlay');
    if (!overlay) {
      return;
    }
    overlay.classList.remove('open');
    overlay.setAttribute('aria-hidden', 'true');
    state.printViewOpen = false;
  }

  function updatePlayhead() {
    const playhead = document.getElementById('playhead');
    const label = document.getElementById('playhead-label');
    if (!playhead || !label) {
      return;
    }

    const beat = T.displayBeat();
    const px = T.bpx(beat + T.timelineLeadInBeats());
    playhead.style.left = `${px}px`;

    const info = T.getSectionAt(beat);
    if (info) {
      const bar = Math.floor(info.beatInSec / T.secQpb(info.sec)) + 1;
      const beatInBar = Math.floor(info.beatInSec % T.secQpb(info.sec)) + 1;
      label.textContent = `${bar}.${beatInBar}`;
    } else {
      label.textContent = '—';
    }

    if (state.playing) {
      const wrap = document.getElementById('timeline-wrap');
      wrap.scrollLeft = px - wrap.clientWidth / 2;
    }
  }

  function updateNowPlaying() {
    const beat = T.displayBeat();
    const info = T.getSectionAt(beat);
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
      const tBeats = T.totalTimelineBeats() || 1;
      const progressBeat = Math.max(0, beat);
      npSectionName.textContent = '—';
      npChords.textContent = '';
      npNextName.textContent = '—';
      npBarNum.textContent = '—';
      npBarTotal.textContent = '—';
      npBeatNum.textContent = '—';
      progressFill.style.width = `${(progressBeat / tBeats) * 100}%`;
      progressLabel.textContent = `Bar — / ${T.formatBars(T.totalBars())} · ${T.fmtTime((progressBeat * 60) / state.song.bpm)} / ${T.fmtTime((tBeats * 60) / state.song.bpm)}`;
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
    const bar = Math.floor(beatInSec / T.secQpb(sec)) + 1;
    const beatInBar = Math.floor(beatInSec % T.secQpb(sec)) + 1;
    const nextSec = state.song.sections[idx + 1];

    npSectionSlab.style.background = color.fill;
    npSectionName.style.color = color.text;
    npSectionName.textContent = sec.type;
    npChords.style.color = color.text;
    npChords.textContent = sec.chords || '—';
    npBarNum.textContent = String(bar);
    npBarTotal.textContent = T.formatBars(sec.bars);
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

    const tBeats = T.totalTimelineBeats() || 1;
    const songBar = Math.min(T.getSongBarNumber(beat), T.totalBars());
    const progressBeat = Math.max(0, beat);
    progressFill.style.width = `${(progressBeat / tBeats) * 100}%`;
    progressLabel.textContent = `Bar ${T.formatBars(songBar)} / ${T.formatBars(T.totalBars())} · ${T.fmtTime((progressBeat * 60) / state.song.bpm)} / ${T.fmtTime((tBeats * 60) / state.song.bpm)}`;

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
    ruler.style.width = `${T.bpx(total) + 120}px`;

    const songAlignedBeats = Math.max(0, total - leadIn);
    for (let beat = 0; beat <= songAlignedBeats; beat += 1) {
      const visualBeat = leadIn + beat;
      const isMajor = beat % 4 === 0;
      const tick = document.createElement('div');
      tick.className = `r-tick ${isMajor ? 'major' : 'minor'}`;
      tick.style.left = `${T.bpx(visualBeat)}px`;
      ruler.appendChild(tick);

      if (isMajor) {
        const mark = document.createElement('div');
        mark.className = 'r-mark';
        mark.style.left = `${T.bpx(visualBeat)}px`;
        mark.textContent = String(Math.floor(beat / 4) + 1);
        ruler.appendChild(mark);
      }
    }
  }

  function renderWaveform(totalBeatsCount) {
    const inner = document.getElementById('timeline-inner');
    const canvas = document.createElement('canvas');
    const widthPx = Math.max(2, Math.floor(T.bpx(totalBeatsCount)));
    const heightPx = WAVEFORM_HEIGHT;
    canvas.id = 'waveform-layer';
    canvas.width = widthPx;
    canvas.height = heightPx;
    canvas.style.width = `${widthPx}px`;
    canvas.style.height = `${heightPx}px`;
    inner.appendChild(canvas);

    const drawVersion = state.waveformVersion;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgba(8, 6, 4, 0.55)';
    ctx.fillRect(0, 0, widthPx, heightPx);

    if (!state.waveformPeaks || !state.waveformPeaks.length || state.loadedAudioDurationSec <= 0) {
      const empty = document.createElement('div');
      empty.id = 'waveform-empty';
      empty.textContent = 'Load audio to display waveform';
      inner.appendChild(empty);
      return;
    }

    const audioBeats = Math.max(1, T.secondsToBeat(state.loadedAudioDurationSec));
    const audioPx = Math.max(1, Math.floor(T.bpx(audioBeats)));
    const centerY = Math.floor(heightPx / 2);
    const maxBarHeight = Math.floor(heightPx * 0.44);
    const sampleCount = state.waveformPeaks.length;

    ctx.fillStyle = 'rgba(245, 158, 11, 0.9)';
    for (let x = 0; x < audioPx; x += 1) {
      if (drawVersion !== state.waveformVersion) {
        return;
      }
      const sampleIndex = Math.min(sampleCount - 1, Math.floor((x / audioPx) * sampleCount));
      const amp = state.waveformPeaks[sampleIndex];
      const h = Math.max(1, Math.floor(amp * maxBarHeight));
      ctx.fillRect(x, centerY - h, 1, h * 2);
    }
  }

  function renderTimeline() {
    const inner = document.getElementById('timeline-inner');
    const total = T.totalVisualTimelineBeats();
    const leadIn = T.timelineLeadInBeats();
    inner.style.width = `${T.bpx(total) + 120}px`;
    inner.innerHTML = '';
    renderRuler(total, leadIn);
    renderWaveform(total);

    let acc = 0;
    state.song.sections.forEach((sec) => {
      const color = COLORS[sec.type];
      const width = T.bpx(sec.bars * T.secQpb(sec));
      const sectionStart = acc;
      const block = document.createElement('div');
      const isDragging = state.sectionInteraction && state.sectionInteraction.sectionId === sec.id;
      block.className = `tl-section inactive${isDragging ? ' dragging' : ''}`;
      block.dataset.id = String(sec.id);
      block.style.left = `${T.bpx(acc + leadIn)}px`;
      block.style.width = `${Math.max(width - 2, 20)}px`;
      block.style.background = color.fill;
      block.innerHTML = `
        <div class="tl-section-handle left" aria-hidden="true"></div>
        <div class="tl-section-body">
          <div class="tl-section-name" style="color:${color.text}">${sec.type}</div>
          <div class="tl-section-bars" style="color:${color.text}">${T.formatBars(sec.bars)} bars · ${sec.bpb}/${sec.den}</div>
          <div class="tl-section-chords" style="color:${color.text}">${sec.chords || '—'}</div>
        </div>
        <div class="tl-section-handle right" aria-hidden="true"></div>
      `;
      block.onpointerdown = (event) => {
        if (!event.isPrimary || event.button !== 0 || event.target.closest('.tl-section-handle')) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        BF.sections.beginSectionMove(event, sec.id);
      };
      block.onclick = (event) => {
        if (state.suppressTimelineClick) {
          state.suppressTimelineClick = false;
          event.stopPropagation();
          return;
        }
        event.stopPropagation();
        BF.playback.seekToBeat(sectionStart);
      };
      const leftHandle = block.querySelector('.tl-section-handle.left');
      const rightHandle = block.querySelector('.tl-section-handle.right');
      if (leftHandle) {
        leftHandle.onpointerdown = (event) => {
          if (!event.isPrimary || event.button !== 0) {
            return;
          }
          event.preventDefault();
          event.stopPropagation();
          BF.sections.beginSectionResize(event, sec.id, 'left');
        };
        leftHandle.style.display = sectionStart > 0 ? '' : 'none';
      }
      if (rightHandle) {
        rightHandle.onpointerdown = (event) => {
          if (!event.isPrimary || event.button !== 0) {
            return;
          }
          event.preventDefault();
          event.stopPropagation();
          BF.sections.beginSectionResize(event, sec.id, 'right');
        };
      }
      inner.appendChild(block);
      acc += sec.bars * T.secQpb(sec);
    });

    if (state.loadedAudioDurationSec > 0) {
      const marker = document.createElement('button');
      marker.type = 'button';
      marker.id = 'song-start-marker';
      marker.title = 'Drag to line up where bar 1 starts in the audio';
      marker.style.left = `${T.bpx(leadIn)}px`;
      marker.onpointerdown = (event) => {
        if (!event.isPrimary || event.button !== 0) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        BF.audio.beginSongStartDrag(event);
      };
      marker.onclick = (event) => {
        event.stopPropagation();
      };
      inner.appendChild(marker);
    }

    const playhead = document.createElement('div');
    playhead.id = 'playhead';
    playhead.style.left = `${T.bpx(state.currentBeat + leadIn)}px`;
    playhead.innerHTML = '<div id="playhead-label">—</div>';
    inner.appendChild(playhead);
  }

  function renderSidebar() {
    const list = document.getElementById('sidebar-list');
    list.innerHTML = '';

    let acc = 0;
    state.song.sections.forEach((sec) => {
      const color = COLORS[sec.type];
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'sidebar-chip';
      chip.dataset.id = String(sec.id);
      chip.innerHTML = `
        <span class="chip-dot" style="background:${color.fill}; color:${color.fill};"></span>
        ${sec.type}
        <span class="chip-bars">${T.formatBars(sec.bars)}</span>
      `;
      const sectionStart = acc;
      chip.onclick = () => BF.playback.seekToBeat(sectionStart);
      list.appendChild(chip);
      acc += sec.bars * T.secQpb(sec);
    });
  }

  function renderShortcutsPanel() {
    const panel = document.getElementById('shortcuts-panel');
    if (!panel) {
      return;
    }
    panel.innerHTML = '';

    const addRow = (keyLabel, label, dotColor) => {
      const row = document.createElement('div');
      row.className = 'shortcut-row';
      const key = document.createElement('span');
      key.className = 'shortcut-key';
      key.textContent = keyLabel;
      row.appendChild(key);
      if (dotColor) {
        const dot = document.createElement('span');
        dot.className = 'shortcut-dot';
        dot.style.background = dotColor;
        row.appendChild(dot);
      }
      row.appendChild(document.createTextNode(label));
      panel.appendChild(row);
    };

    const hint = document.createElement('div');
    hint.className = 'shortcut-hint';
    hint.textContent = 'Press while the song plays to drop a section at the playhead.';
    panel.appendChild(hint);

    Object.entries(SECTION_KEY_SHORTCUTS).forEach(([key, type]) => {
      addRow(key.toUpperCase(), type, COLORS[type].fill);
    });
    addRow('A', 'Repeat section', null);

    const sep = document.createElement('div');
    sep.className = 'shortcut-sep';
    panel.appendChild(sep);

    addRow('Spc', 'Play / Pause', null);
    addRow('T', 'Tap tempo', null);
  }

  function renderEditor() {
    const list = document.getElementById('sections-list');
    list.innerHTML = '';

    state.song.sections.forEach((sec, idx) => {
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
      up.onclick = () => BF.sections.moveSection(idx, -1);
      const down = document.createElement('button');
      down.className = 'move-btn';
      down.textContent = '▼';
      down.disabled = idx === state.song.sections.length - 1;
      down.onclick = () => BF.sections.moveSection(idx, 1);
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
      barsInput.min = String(T.getSectionBarStep(sec));
      barsInput.max = String(SECTION_MAX_BARS);
      barsInput.step = String(T.getSectionBarStep(sec));
      barsInput.value = T.formatBars(sec.bars);
      barsInput.onchange = () => {
        sec.bars = T.normalizeSectionBars(parseFloat(barsInput.value), sec);
        barsInput.value = T.formatBars(sec.bars);
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
        sec.bars = T.normalizeSectionBars(sec.bars, sec);
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
        if (state.song.sections.length === 1) {
          return;
        }
        state.song.sections.splice(idx, 1);
        state.currentBeat = T.clampBeat(state.currentBeat);
        refresh();
      };
      row.appendChild(remove);

      list.appendChild(row);
    });
  }

  function refresh() {
    renderTimeline();
    renderSidebar();
    renderEditor();
    renderPrintView();
    updatePlayhead();
    updateNowPlaying();
  }

  BF.ui = {
    syncSongInputs,
    renderPrintView,
    openPrintView,
    closePrintView,
    renderShortcutsPanel,
    updatePlayhead,
    updateNowPlaying,
    refresh,
  };
})();
