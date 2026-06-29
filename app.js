const PX_PER_BEAT = 40;

const ICON_PLAY = '<svg width="11" height="13" viewBox="0 0 11 13" fill="currentColor" aria-hidden="true"><path d="M1.5 1.5l8 5-8 5z"></path></svg>';
const ICON_PAUSE = '<svg width="11" height="13" viewBox="0 0 11 13" fill="currentColor" aria-hidden="true"><rect x="1" y="1" width="3" height="11" rx="1"></rect><rect x="7" y="1" width="3" height="11" rx="1"></rect></svg>';

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

let song = {
  title: 'New Song',
  bpm: 120,
  sections: [
    { id: 1, type: 'Intro', bars: 4, bpb: 4, chords: 'E  A  B  A' },
    { id: 2, type: 'Verse', bars: 8, bpb: 4, chords: 'E  A  E  B' },
    { id: 3, type: 'Chorus', bars: 8, bpb: 4, chords: 'A  E  B  A' },
    { id: 4, type: 'Verse', bars: 8, bpb: 4, chords: 'E  A  E  B' },
    { id: 5, type: 'Chorus', bars: 8, bpb: 4, chords: 'A  E  B  A' },
    { id: 6, type: 'Bridge', bars: 4, bpb: 4, chords: 'C#m  A  B  B' },
    { id: 7, type: 'Solo', bars: 8, bpb: 4, chords: 'E  A  E  B' },
    { id: 8, type: 'Chorus', bars: 8, bpb: 4, chords: 'A  E  B  A' },
    { id: 9, type: 'Outro', bars: 4, bpb: 4, chords: 'E  E  E  E' },
  ],
};

let nextId = 100;
let playing = false;
let currentBeat = 0;
let startTime = null;
let startBeat = 0;
let rafId = null;

function totalBeats() {
  return song.sections.reduce((sum, sec) => sum + sec.bars * sec.bpb, 0);
}

function totalBars() {
  return song.sections.reduce((sum, sec) => sum + sec.bars, 0);
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

function clampBeat(beat) {
  return Math.max(0, Math.min(beat, totalBeats()));
}

function displayBeat() {
  const total = totalBeats();
  if (total <= 0) {
    return 0;
  }
  return Math.min(currentBeat, total - 0.0001);
}

function getSectionAt(beat) {
  let acc = 0;
  for (let i = 0; i < song.sections.length; i += 1) {
    const sec = song.sections[i];
    const secBeats = sec.bars * sec.bpb;
    if (beat < acc + secBeats) {
      return { sec, idx: i, beatInSec: beat - acc, secStart: acc };
    }
    acc += secBeats;
  }
  return null;
}

function getSongBarNumber(beat) {
  const clamped = clampBeat(beat);
  let accBeats = 0;
  let accBars = 0;
  for (let i = 0; i < song.sections.length; i += 1) {
    const sec = song.sections[i];
    const secBeats = sec.bars * sec.bpb;
    if (clamped < accBeats + secBeats || i === song.sections.length - 1) {
      return accBars + Math.floor((clamped - accBeats) / sec.bpb) + 1;
    }
    accBeats += secBeats;
    accBars += sec.bars;
  }
  return 1;
}

function setPlayButtonState() {
  const playBtn = document.getElementById('play-btn');
  playBtn.innerHTML = playing ? ICON_PAUSE : ICON_PLAY;
  playBtn.title = playing ? 'Pause' : 'Play';
}

function tick(timestamp) {
  if (startTime == null) {
    startTime = timestamp;
  }

  const bps = song.bpm / 60;
  const beat = startBeat + ((timestamp - startTime) / 1000) * bps;
  const total = totalBeats();

  if (beat >= total) {
    currentBeat = total;
    playing = false;
    setPlayButtonState();
    updatePlayhead();
    updateNowPlaying();
    return;
  }

  currentBeat = beat;
  updatePlayhead();
  updateNowPlaying();
  rafId = requestAnimationFrame(tick);
}

function play() {
  if (currentBeat >= totalBeats()) {
    currentBeat = 0;
  }
  playing = true;
  startBeat = currentBeat;
  startTime = null;
  setPlayButtonState();
  rafId = requestAnimationFrame(tick);
}

function pause() {
  playing = false;
  if (rafId != null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
  setPlayButtonState();
}

function stop() {
  pause();
  currentBeat = 0;
  updatePlayhead();
  updateNowPlaying();
}

function seekToBeat(beat) {
  currentBeat = clampBeat(beat);
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
  const px = bpx(beat);
  playhead.style.left = `${px}px`;

  const info = getSectionAt(beat);
  if (info) {
    const bar = Math.floor(info.beatInSec / info.sec.bpb) + 1;
    const beatInBar = Math.floor(info.beatInSec % info.sec.bpb) + 1;
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
    npSectionName.textContent = '—';
    npChords.textContent = '';
    npNextName.textContent = '—';
    npBarNum.textContent = '—';
    npBarTotal.textContent = '—';
    npBeatNum.textContent = '—';
    progressFill.style.width = '0%';
    progressLabel.textContent = 'Bar 1 / 1 · 0:00 / 0:00';
    return;
  }

  const { sec, idx, beatInSec } = info;
  const color = COLORS[sec.type];
  const bar = Math.floor(beatInSec / sec.bpb) + 1;
  const beatInBar = Math.floor(beatInSec % sec.bpb) + 1;
  const nextSec = song.sections[idx + 1];

  npSectionSlab.style.background = color.fill;
  npSectionName.style.color = color.text;
  npSectionName.textContent = sec.type;
  npChords.style.color = color.text;
  npChords.textContent = sec.chords || '—';
  npBarNum.textContent = String(bar);
  npBarTotal.textContent = String(sec.bars);
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

  const tBeats = totalBeats() || 1;
  const songBar = Math.min(getSongBarNumber(beat), totalBars());
  progressFill.style.width = `${(beat / tBeats) * 100}%`;
  progressLabel.textContent = `Bar ${songBar} / ${totalBars()} · ${fmtTime((beat * 60) / song.bpm)} / ${fmtTime((tBeats * 60) / song.bpm)}`;

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

function renderRuler(total) {
  const ruler = document.getElementById('ruler');
  ruler.innerHTML = '';
  ruler.style.width = `${bpx(total) + 120}px`;

  for (let beat = 0; beat <= total; beat += 1) {
    const isMajor = beat % 4 === 0;
    const tick = document.createElement('div');
    tick.className = `r-tick ${isMajor ? 'major' : 'minor'}`;
    tick.style.left = `${bpx(beat)}px`;
    ruler.appendChild(tick);

    if (isMajor) {
      const mark = document.createElement('div');
      mark.className = 'r-mark';
      mark.style.left = `${bpx(beat)}px`;
      mark.textContent = String(Math.floor(beat / 4) + 1);
      ruler.appendChild(mark);
    }
  }
}

function renderTimeline() {
  const inner = document.getElementById('timeline-inner');
  const total = totalBeats();
  inner.style.width = `${bpx(total) + 120}px`;
  inner.innerHTML = '';
  renderRuler(total);

  let acc = 0;
  song.sections.forEach((sec) => {
    const color = COLORS[sec.type];
    const width = bpx(sec.bars * sec.bpb);
    const sectionStart = acc;
    const block = document.createElement('div');
    block.className = 'tl-section inactive';
    block.dataset.id = String(sec.id);
    block.style.left = `${bpx(acc)}px`;
    block.style.width = `${Math.max(width - 2, 20)}px`;
    block.style.background = color.fill;
    block.innerHTML = `
      <div class="tl-section-name" style="color:${color.text}">${sec.type}</div>
      <div class="tl-section-bars" style="color:${color.text}">${sec.bars} bars · ${sec.bpb}/4</div>
      <div class="tl-section-chords" style="color:${color.text}">${sec.chords || '—'}</div>
    `;
    block.onclick = (event) => {
      event.stopPropagation();
      seekToBeat(sectionStart);
    };
    inner.appendChild(block);
    acc += sec.bars * sec.bpb;
  });

  const playhead = document.createElement('div');
  playhead.id = 'playhead';
  playhead.style.left = `${bpx(currentBeat)}px`;
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
      <span class="chip-bars">${sec.bars}</span>
    `;
    const sectionStart = acc;
    chip.onclick = () => seekToBeat(sectionStart);
    list.appendChild(chip);
    acc += sec.bars * sec.bpb;
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
    barsInput.min = '1';
    barsInput.max = '64';
    barsInput.value = String(sec.bars);
    barsInput.onchange = () => {
      sec.bars = Math.max(1, parseInt(barsInput.value, 10) || 1);
      refresh();
    };
    barsGroup.appendChild(barsInput);
    row.appendChild(barsGroup);

    const timeGroup = document.createElement('div');
    timeGroup.className = 'f-grp';
    timeGroup.innerHTML = '<span class="f-lbl">Time</span>';
    const timeSel = document.createElement('select');
    timeSel.className = 'time-sel';
    [2, 3, 4, 5, 6, 7, 8].forEach((beatsPerBar) => {
      const option = document.createElement('option');
      option.value = String(beatsPerBar);
      option.textContent = `${beatsPerBar}/4`;
      option.selected = beatsPerBar === sec.bpb;
      timeSel.appendChild(option);
    });
    timeSel.onchange = () => {
      sec.bpb = parseInt(timeSel.value, 10);
      refresh();
    };
    timeGroup.appendChild(timeSel);
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
  if (playing) {
    pause();
    play();
  }
  updateNowPlaying();
};

document.getElementById('song-title').oninput = (event) => {
  song.title = event.target.value;
};

document.getElementById('editor-toggle').onclick = () => {
  const editor = document.getElementById('editor');
  const hidden = editor.classList.toggle('hidden');
  document.getElementById('editor-toggle').classList.toggle('active', !hidden);
};

function addSection() {
  song.sections.push({ id: nextId, type: 'Verse', bars: 4, bpb: 4, chords: '' });
  nextId += 1;
  refresh();
}

document.getElementById('add-section-btn').onclick = addSection;
document.getElementById('sidebar-add').onclick = addSection;

document.getElementById('timeline-wrap').onclick = (event) => {
  const wrap = document.getElementById('timeline-wrap');
  const rect = wrap.getBoundingClientRect();
  const x = event.clientX - rect.left + wrap.scrollLeft;
  seekToBeat(x / PX_PER_BEAT);
};

setPlayButtonState();
refresh();
