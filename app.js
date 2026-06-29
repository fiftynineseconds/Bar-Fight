const PX_PER_BEAT = 40;

const COLORS = {
  Intro:        { bg: '#1a2a1a', border: '#4ade80', text: '#4ade80' },
  Verse:        { bg: '#1a1a2e', border: '#818cf8', text: '#818cf8' },
  'Pre-Chorus': { bg: '#1e1a2a', border: '#a78bfa', text: '#a78bfa' },
  Chorus:       { bg: '#2a1a1a', border: '#f87171', text: '#f87171' },
  Bridge:       { bg: '#2a1e10', border: '#fb923c', text: '#fb923c' },
  Solo:         { bg: '#1a2a2a', border: '#22d3ee', text: '#22d3ee' },
  Outro:        { bg: '#2a2a1a', border: '#facc15', text: '#facc15' },
  Break:        { bg: '#1e1e1e', border: '#6b7280', text: '#9ca3af' },
};
const TYPES = Object.keys(COLORS);

let song = {
  title: 'New Song',
  bpm: 120,
  sections: [
    { id: 1, type: 'Intro',  bars: 4, bpb: 4, chords: 'E  A  B  A' },
    { id: 2, type: 'Verse',  bars: 8, bpb: 4, chords: 'E  A  E  B' },
    { id: 3, type: 'Chorus', bars: 8, bpb: 4, chords: 'A  E  B  A' },
    { id: 4, type: 'Verse',  bars: 8, bpb: 4, chords: 'E  A  E  B' },
    { id: 5, type: 'Chorus', bars: 8, bpb: 4, chords: 'A  E  B  A' },
    { id: 6, type: 'Bridge', bars: 4, bpb: 4, chords: 'C#m  A  B  B' },
    { id: 7, type: 'Solo',   bars: 8, bpb: 4, chords: 'E  A  E  B' },
    { id: 8, type: 'Chorus', bars: 8, bpb: 4, chords: 'A  E  B  A' },
    { id: 9, type: 'Outro',  bars: 4, bpb: 4, chords: 'E  E  E  E' },
  ]
};

let nextId = 100;
let playing = false;
let currentBeat = 0;
let startTime = null;
let startBeat = 0;
let rafId = null;

// ── helpers ───────────────────────────────────────────────────────────────────

function totalBeats() {
  return song.sections.reduce((s, sec) => s + sec.bars * sec.bpb, 0);
}

function bpx(beats) { return beats * PX_PER_BEAT; }

function getSectionAt(beat) {
  let acc = 0;
  for (let i = 0; i < song.sections.length; i++) {
    const sec = song.sections[i];
    const sb = sec.bars * sec.bpb;
    if (beat < acc + sb) return { sec, idx: i, beatInSec: beat - acc, secStart: acc };
    acc += sb;
  }
  return null;
}

// ── playback ──────────────────────────────────────────────────────────────────

function tick(ts) {
  if (!startTime) startTime = ts;
  const bps = song.bpm / 60;
  const beat = startBeat + (ts - startTime) / 1000 * bps;
  const total = totalBeats();
  if (beat >= total) {
    currentBeat = total;
    playing = false;
    document.getElementById('play-btn').textContent = '▶ Play';
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
  if (currentBeat >= totalBeats()) { currentBeat = 0; }
  playing = true;
  startBeat = currentBeat;
  startTime = null;
  document.getElementById('play-btn').textContent = '⏸ Pause';
  rafId = requestAnimationFrame(tick);
}

function pause() {
  playing = false;
  if (rafId) cancelAnimationFrame(rafId);
  document.getElementById('play-btn').textContent = '▶ Play';
}

function stop() {
  pause();
  currentBeat = 0;
  updatePlayhead();
  updateNowPlaying();
}

// ── DOM updates ───────────────────────────────────────────────────────────────

function updatePlayhead() {
  const ph = document.getElementById('playhead');
  const px = bpx(currentBeat);
  ph.style.left = px + 'px';

  // auto-scroll to keep playhead centered
  const wrap = document.getElementById('timeline-wrap');
  const half = wrap.clientWidth / 2;
  if (playing) wrap.scrollLeft = px - half;
}

function updateNowPlaying() {
  const info = getSectionAt(currentBeat);
  const npSection = document.getElementById('np-section');
  const npChords  = document.getElementById('np-chords');
  const npNext    = document.getElementById('np-next');
  const npBarNum  = document.getElementById('np-bar-num');
  const npBarTot  = document.getElementById('np-bar-total');
  const npBeatNum = document.getElementById('np-beat-num');
  const nowPlaying = document.getElementById('now-playing');

  if (!info) {
    npSection.textContent = '—';
    npChords.textContent = '';
    npNext.textContent = '';
    return;
  }

  const { sec, idx, beatInSec } = info;
  const c = COLORS[sec.type];
  const bar = Math.floor(beatInSec / sec.bpb) + 1;
  const beatInBar = Math.floor(beatInSec % sec.bpb) + 1;
  const nextSec = song.sections[idx + 1];

  npSection.textContent = sec.type;
  npSection.style.color = c.text;
  npChords.textContent = sec.chords;
  npChords.style.color = c.text;
  npBarNum.textContent = bar;
  npBarTot.textContent = sec.bars;
  npBeatNum.textContent = beatInBar;
  nowPlaying.style.background = c.bg;
  nowPlaying.style.borderBottomColor = c.border;
  npNext.textContent = nextSec ? 'Next: ' + nextSec.type : '';
  npNext.style.color = nextSec ? COLORS[nextSec.type].text : '';

  // highlight active section block on timeline
  document.querySelectorAll('.tl-section').forEach(el => {
    const id = parseInt(el.dataset.id);
    const active = id === sec.id;
    const sc = song.sections.find(s => s.id === id);
    if (!sc) return;
    const cc = COLORS[sc.type];
    el.style.background = active ? cc.bg : '#111113';
    el.style.borderColor = active ? cc.border : '#2a2a3a';
  });
}

// ── timeline render ───────────────────────────────────────────────────────────

function renderTimeline() {
  const inner = document.getElementById('timeline-inner');
  const total = totalBeats();
  inner.style.width = (bpx(total) + 120) + 'px';
  inner.innerHTML = '';

  // beat grid lines
  for (let i = 0; i <= total; i++) {
    const isBar = i % (song.sections[0]?.bpb ?? 4) === 0;
    const line = document.createElement('div');
    line.className = 'beat-line';
    line.style.left = bpx(i) + 'px';
    line.style.background = isBar ? '#1e1e2e' : '#161618';
    inner.appendChild(line);
  }

  // section blocks
  let acc = 0;
  song.sections.forEach(sec => {
    const c = COLORS[sec.type];
    const w = bpx(sec.bars * sec.bpb);
    const div = document.createElement('div');
    div.className = 'tl-section';
    div.dataset.id = sec.id;
    div.style.left = bpx(acc) + 'px';
    div.style.width = (w - 2) + 'px';
    div.style.background = '#111113';
    div.style.border = `1px solid #2a2a3a`;
    div.style.borderTop = `3px solid ${c.border}`;
    div.innerHTML = `
      <div class="tl-section-name" style="color:${c.text}">${sec.type}</div>
      <div class="tl-section-bars">${sec.bars} bars</div>
      <div class="tl-section-chords">${sec.chords}</div>
    `;
    inner.appendChild(div);
    acc += sec.bars * sec.bpb;
  });

  // playhead
  const ph = document.createElement('div');
  ph.id = 'playhead';
  ph.style.left = bpx(currentBeat) + 'px';
  ph.innerHTML = '<div id="playhead-dot"></div>';
  inner.appendChild(ph);
}

// ── editor render ─────────────────────────────────────────────────────────────

function renderEditor() {
  const list = document.getElementById('sections-list');
  list.innerHTML = '';

  song.sections.forEach((sec, idx) => {
    const c = COLORS[sec.type];
    const row = document.createElement('div');
    row.className = 'sec-row';
    row.style.borderLeft = `3px solid ${c.border}`;

    // move buttons
    const moveBtns = document.createElement('div');
    moveBtns.className = 'move-btns';
    const up = document.createElement('button');
    up.textContent = '▲'; up.disabled = idx === 0;
    up.onclick = () => { moveSection(idx, -1); };
    const dn = document.createElement('button');
    dn.textContent = '▼'; dn.disabled = idx === song.sections.length - 1;
    dn.onclick = () => { moveSection(idx, 1); };
    moveBtns.appendChild(up); moveBtns.appendChild(dn);
    row.appendChild(moveBtns);

    // type selector
    const typeSel = document.createElement('select');
    typeSel.style.width = '110px';
    typeSel.style.color = c.text;
    typeSel.style.background = c.bg;
    TYPES.forEach(t => {
      const opt = document.createElement('option');
      opt.value = t; opt.textContent = t;
      if (t === sec.type) opt.selected = true;
      typeSel.appendChild(opt);
    });
    typeSel.onchange = () => { sec.type = typeSel.value; refresh(); };
    row.appendChild(typeSel);

    // bars
    row.appendChild(makeLabel('Bars'));
    const barsIn = document.createElement('input');
    barsIn.type = 'number'; barsIn.min = 1; barsIn.max = 64; barsIn.value = sec.bars;
    barsIn.onchange = () => { sec.bars = parseInt(barsIn.value) || 1; refresh(); };
    row.appendChild(barsIn);

    // time signature
    row.appendChild(makeLabel('Time'));
    const timeSel = document.createElement('select');
    timeSel.className = 'time-sel';
    [2,3,4,5,6,7,8].forEach(n => {
      const opt = document.createElement('option');
      opt.value = n; opt.textContent = n + '/4';
      if (n === sec.bpb) opt.selected = true;
      timeSel.appendChild(opt);
    });
    timeSel.onchange = () => { sec.bpb = parseInt(timeSel.value); refresh(); };
    row.appendChild(timeSel);

    // chords
    row.appendChild(makeLabel('Chords'));
    const chordsIn = document.createElement('input');
    chordsIn.className = 'chord-input';
    chordsIn.value = sec.chords;
    chordsIn.placeholder = 'E  A  B  A';
    chordsIn.oninput = () => { sec.chords = chordsIn.value; updateNowPlaying(); };
    row.appendChild(chordsIn);

    // remove
    const rm = document.createElement('button');
    rm.className = 'remove-btn'; rm.textContent = '✕';
    rm.onclick = () => { song.sections.splice(idx, 1); refresh(); };
    row.appendChild(rm);

    list.appendChild(row);
  });
}

function makeLabel(txt) {
  const s = document.createElement('span');
  s.className = 'label'; s.textContent = txt;
  return s;
}

function moveSection(idx, dir) {
  const target = idx + dir;
  if (target < 0 || target >= song.sections.length) return;
  [song.sections[idx], song.sections[target]] = [song.sections[target], song.sections[idx]];
  refresh();
}

function refresh() {
  renderTimeline();
  renderEditor();
  updateNowPlaying();
}

// ── events ────────────────────────────────────────────────────────────────────

document.getElementById('play-btn').onclick = () => { playing ? pause() : play(); };
document.getElementById('stop-btn').onclick = stop;

document.getElementById('bpm-input').oninput = e => {
  song.bpm = parseInt(e.target.value) || 60;
  if (playing) { pause(); play(); } // restart to pick up new bpm
};

document.getElementById('song-title').oninput = e => { song.title = e.target.value; };

document.getElementById('editor-toggle').onclick = () => {
  const ed = document.getElementById('editor');
  const hint = document.getElementById('hint');
  const visible = ed.classList.toggle('visible');
  hint.style.display = visible ? 'none' : 'flex';
  document.getElementById('editor-toggle').textContent = visible ? 'Hide Editor' : 'Edit Sections';
  document.getElementById('editor-toggle').className = visible ? 'btn purple' : 'btn';
};

document.getElementById('add-section-btn').onclick = () => {
  song.sections.push({ id: nextId++, type: 'Verse', bars: 4, bpb: 4, chords: '' });
  refresh();
};

document.getElementById('timeline-wrap').onclick = e => {
  const wrap = document.getElementById('timeline-wrap');
  const rect = wrap.getBoundingClientRect();
  const x = e.clientX - rect.left + wrap.scrollLeft;
  const beat = Math.max(0, Math.min(x / PX_PER_BEAT, totalBeats()));
  currentBeat = beat;
  startBeat = beat;
  startTime = null;
  updatePlayhead();
  updateNowPlaying();
};

// ── init ──────────────────────────────────────────────────────────────────────

refresh();
