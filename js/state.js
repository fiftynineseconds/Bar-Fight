// Bar Fight — the single mutable app state shared by all modules.
(() => {
  const { COUNT_OFF_DEFAULT_ENABLED, COUNT_OFF_DEFAULT_BEATS } = window.BarFight.constants;

  const audioPlayer = new Audio();
  audioPlayer.preload = 'auto';

  window.BarFight.state = {
    song: {
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
    },
    nextId: 100,

    // Playback
    playing: false,
    liveBuildActive: false,
    currentBeat: 0,
    startTime: null,
    startBeat: 0,
    rafId: null,

    // Audio
    audioPlayer,
    audioCtx: null,
    audioObjectUrl: null,
    loadedAudioName: '',
    loadedAudioDurationSec: 0,
    loadedAudioBuffer: null,
    loadedAudioBlob: null,
    loadedAudioSourceUrl: '',
    expectedAudioFileName: '',
    audioStartOffsetSec: 0,
    waveformPeaks: null,
    waveformVersion: 0,
    detectingBpm: false,

    // Pointer interactions
    draggingSongStart: false,
    activeSongStartPointerId: null,
    sectionInteraction: null,
    suppressTimelineClick: false,

    // Overlays
    printViewOpen: false,

    // Count-off
    countOffEnabled: COUNT_OFF_DEFAULT_ENABLED,
    countOffBeats: COUNT_OFF_DEFAULT_BEATS,
    countOffAbortController: null,
    countOffRunning: false,
  };
})();
