// Bar Fight — shared constants: layout metrics, section palette, shortcuts.
(() => {
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

  window.BarFight = window.BarFight || {};
  window.BarFight.constants = {
    PX_PER_BEAT: 40,
    SECTION_RESIZE_BEAT_STEP: 1,
    SECTION_MAX_BARS: 64,
    NEW_SECTION_BARS: 2,
    // Live-build shortcuts: press while the song plays to drop a section at the playhead.
    // "a" (handled separately) repeats the current section's type. "t" is tap tempo.
    SECTION_KEY_SHORTCUTS: {
      c: 'Chorus',
      v: 'Verse',
      b: 'Bridge',
      i: 'Intro',
      s: 'Solo',
      o: 'Outro',
      p: 'Pre-Chorus',
      k: 'Break',
    },
    ICON_PLAY: '<svg width="11" height="13" viewBox="0 0 11 13" fill="currentColor" aria-hidden="true"><path d="M1.5 1.5l8 5-8 5z"></path></svg>',
    ICON_PAUSE: '<svg width="11" height="13" viewBox="0 0 11 13" fill="currentColor" aria-hidden="true"><rect x="1" y="1" width="3" height="11" rx="1"></rect><rect x="7" y="1" width="3" height="11" rx="1"></rect></svg>',
    WAVEFORM_HEIGHT: 194,
    COLORS,
    TYPES: Object.keys(COLORS),
    COUNT_OFF_DEFAULT_ENABLED: true,
    COUNT_OFF_DEFAULT_BEATS: 4,
    COUNT_OFF_MIN_BEATS: 1,
    COUNT_OFF_MAX_BEATS: 16,
  };
})();
