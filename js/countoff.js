// Bar Fight — visual count-off before playback.
(() => {
  const BF = window.BarFight;
  const { state } = BF;
  const { COUNT_OFF_DEFAULT_BEATS, COUNT_OFF_MIN_BEATS, COUNT_OFF_MAX_BEATS } = BF.constants;

  function clampCountOffBeats(value) {
    const parsed = parseInt(value, 10);
    if (!Number.isFinite(parsed)) {
      return COUNT_OFF_DEFAULT_BEATS;
    }
    return Math.max(COUNT_OFF_MIN_BEATS, Math.min(COUNT_OFF_MAX_BEATS, parsed));
  }

  function syncCountOffInputs() {
    const toggle = document.getElementById('countoff-toggle');
    const beatsInput = document.getElementById('countoff-beats');
    if (!toggle || !beatsInput) {
      return;
    }
    toggle.checked = state.countOffEnabled;
    beatsInput.value = String(state.countOffBeats);
    beatsInput.disabled = !state.countOffEnabled;
  }

  function hideCountOffOverlay() {
    const overlay = document.getElementById('countoff-overlay');
    if (!overlay) {
      return;
    }
    overlay.classList.remove('show', 'pulse');
    overlay.setAttribute('aria-hidden', 'true');
  }

  function updateCountOffOverlay(value) {
    const overlay = document.getElementById('countoff-overlay');
    const valueEl = document.getElementById('countoff-value');
    if (!overlay || !valueEl) {
      return;
    }
    valueEl.textContent = String(value);
    overlay.classList.add('show');
    overlay.setAttribute('aria-hidden', 'false');
    overlay.classList.remove('pulse');
    void overlay.offsetWidth;
    overlay.classList.add('pulse');
  }

  function cancelCountOff() {
    if (state.countOffAbortController) {
      state.countOffAbortController.abort();
      state.countOffAbortController = null;
    }
    state.countOffRunning = false;
    hideCountOffOverlay();
    BF.playback.setPlayButtonState();
  }

  function sleepWithAbort(ms, signal) {
    return new Promise((resolve, reject) => {
      const timer = window.setTimeout(() => {
        signal.removeEventListener('abort', onAbort);
        resolve();
      }, ms);

      function onAbort() {
        window.clearTimeout(timer);
        reject(new DOMException('Count-off canceled', 'AbortError'));
      }

      signal.addEventListener('abort', onAbort, { once: true });
    });
  }

  // Resolves true when the count-off completed (or was disabled),
  // false when it was canceled.
  async function runVisualCountOff() {
    if (!state.countOffEnabled || state.countOffBeats <= 0) {
      return true;
    }

    cancelCountOff();
    const controller = new AbortController();
    state.countOffAbortController = controller;
    state.countOffRunning = true;
    BF.playback.setPlayButtonState();

    const msPerBeat = (60 / Math.max(1, state.song.bpm)) * 1000;
    try {
      for (let beat = state.countOffBeats; beat >= 1; beat -= 1) {
        if (controller.signal.aborted) {
          throw new DOMException('Count-off canceled', 'AbortError');
        }
        updateCountOffOverlay(beat);
        await sleepWithAbort(msPerBeat, controller.signal);
      }
      hideCountOffOverlay();
      state.countOffRunning = false;
      state.countOffAbortController = null;
      BF.playback.setPlayButtonState();
      return true;
    } catch (error) {
      hideCountOffOverlay();
      state.countOffRunning = false;
      state.countOffAbortController = null;
      BF.playback.setPlayButtonState();
      if (error && error.name === 'AbortError') {
        return false;
      }
      throw error;
    }
  }

  BF.countoff = {
    clampCountOffBeats,
    syncCountOffInputs,
    hideCountOffOverlay,
    cancelCountOff,
    runVisualCountOff,
  };
})();
