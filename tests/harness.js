// Test harness: boots the real app (index.html + its scripts) inside jsdom.
//
// Design rules (see FEATURES.md "Architecture constraints"):
// - The harness discovers `<script src>` tags in index.html and evaluates those
//   files in order, so the refactor can split app.js into any number of classic
//   scripts without touching the tests.
// - Tests interact with the app only through the DOM (clicks, keys, inputs) and
//   the already-public `window.BpmDetector`. Internal function names are not a
//   contract.
// - Time (setTimeout, Date.now, performance.now, requestAnimationFrame) is
//   driven by a deterministic fake clock.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM, VirtualConsole } from 'jsdom';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function readIndexHtml() {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const srcs = [];
  const stripped = html.replace(/<script\s+[^>]*src\s*=\s*["']([^"']+)["'][^>]*>\s*<\/script>/gi, (match, src) => {
    srcs.push(src);
    return '';
  });
  return { stripped, srcs };
}

function createClock(window) {
  let now = 10_000;
  let nextId = 1;
  const timers = new Map();
  const rafCallbacks = new Map();

  window.setTimeout = (fn, delay = 0, ...args) => {
    const id = nextId++;
    timers.set(id, { due: now + Math.max(0, Number(delay) || 0), fn, args });
    return id;
  };
  window.clearTimeout = (id) => { timers.delete(id); };
  window.requestAnimationFrame = (fn) => {
    const id = nextId++;
    rafCallbacks.set(id, fn);
    return id;
  };
  window.cancelAnimationFrame = (id) => { rafCallbacks.delete(id); };
  window.Date.now = () => now;
  window.performance.now = () => now;

  const flush = async () => {
    // Let pending promise chains settle (macrotask boundary drains microtasks).
    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));
  };

  return {
    get now() { return now; },
    flush,
    // Advance the clock, firing due timeouts in order.
    async tick(ms) {
      const target = now + ms;
      for (;;) {
        let earliest = null;
        for (const [id, timer] of timers) {
          if (timer.due <= target && (earliest === null || timer.due < earliest.timer.due)) {
            earliest = { id, timer };
          }
        }
        if (!earliest) break;
        now = Math.max(now, earliest.timer.due);
        timers.delete(earliest.id);
        earliest.timer.fn(...earliest.timer.args);
        await flush();
      }
      now = target;
      await flush();
    },
    // Advance the clock and fire pending requestAnimationFrame callbacks once.
    async frame(ms = 16) {
      now += ms;
      const callbacks = [...rafCallbacks.values()];
      rafCallbacks.clear();
      for (const fn of callbacks) fn(now);
      await flush();
    },
    // Run frames until `condition()` is true or `maxFrames` elapse.
    async frames(count, ms = 100) {
      for (let i = 0; i < count; i += 1) await this.frame(ms);
    },
  };
}

class FakeAudio {
  constructor() {
    this.preload = '';
    this.currentTime = 0;
    this.duration = NaN;
    this.paused = true;
    this.onended = null;
    this._src = '';
    FakeAudio.instances.push(this);
  }
  get src() { return this._src; }
  set src(value) { this._src = String(value); }
  removeAttribute(name) { if (name === 'src') this._src = ''; }
  load() {}
  play() { this.paused = false; return Promise.resolve(); }
  pause() { this.paused = true; }
  addEventListener() {}
  removeEventListener() {}
}
FakeAudio.instances = [];

const CANVAS_2D_STUB = {
  fillStyle: '',
  strokeStyle: '',
  fillRect() {},
  clearRect() {},
  beginPath() {},
  moveTo() {},
  lineTo() {},
  stroke() {},
};

// A minimal AudioBuffer stand-in for the stubbed AudioContext.decodeAudioData.
export function makeFakeAudioBuffer({ durationSec = 10, sampleRate = 1000, channelData = null } = {}) {
  const length = Math.floor(durationSec * sampleRate);
  const data = channelData || new Float32Array(length);
  return {
    duration: durationSec,
    sampleRate,
    length: data.length,
    numberOfChannels: 1,
    getChannelData: () => data,
  };
}

export function jsonResponse(obj, { status = 200 } = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => JSON.parse(JSON.stringify(obj)),
    blob: async () => { throw new Error('not a blob response'); },
  };
}

export function blobResponse(blob, { status = 200 } = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => { throw new Error('not a json response'); },
    blob: async () => blob,
  };
}

export function errorResponse(status) {
  return {
    ok: false,
    status,
    json: async () => { throw new Error('error response'); },
    blob: async () => { throw new Error('error response'); },
  };
}

export async function loadApp(options = {}) {
  const {
    url = 'http://localhost/',
    fetch: fetchStub = undefined,
    promptResult = null,
    confirmResult = true,
    decodedAudioBuffer = makeFakeAudioBuffer(),
  } = options;

  const { stripped, srcs } = readIndexHtml();

  const virtualConsole = new VirtualConsole();
  const jsdomErrors = [];
  virtualConsole.on('jsdomError', (err) => { jsdomErrors.push(err); });

  const dom = new JSDOM(stripped, {
    url,
    runScripts: 'dangerously',
    virtualConsole,
  });
  const { window } = dom;
  const clock = createClock(window);

  const app = {
    dom,
    window,
    document: window.document,
    clock,
    jsdomErrors,
    alerts: [],
    confirms: [],
    prompts: [],
    prints: 0,
    // Blobs handed to URL.createObjectURL, most recent last.
    objectUrls: [],
    // { download, href } captured from programmatic anchor clicks (file saves).
    saves: [],
    audioInstances: FakeAudio.instances,
    get audioEl() { return FakeAudio.instances[FakeAudio.instances.length - 1]; },

    $(selector) { return window.document.querySelector(selector); },
    $$(selector) { return [...window.document.querySelectorAll(selector)]; },
    byId(id) { return window.document.getElementById(id); },

    click(target, init = {}) {
      const el = typeof target === 'string' ? this.$(target) : target;
      el.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true, button: 0, ...init }));
      return clock.flush();
    },
    pointer(type, target, init = {}) {
      const el = typeof target === 'string' ? this.$(target) : target;
      const event = new window.MouseEvent(type, { bubbles: true, cancelable: true, button: 0, ...init });
      Object.defineProperty(event, 'isPrimary', { value: true });
      Object.defineProperty(event, 'pointerId', { value: init.pointerId ?? 1 });
      el.dispatchEvent(event);
    },
    key(key, init = {}) {
      const event = new window.KeyboardEvent('keydown', {
        key,
        code: key === ' ' ? 'Space' : undefined,
        bubbles: true,
        cancelable: true,
        ...init,
      });
      window.document.dispatchEvent(event);
      return clock.flush();
    },
    setInput(target, value, eventType = 'input') {
      const el = typeof target === 'string' ? this.$(target) : target;
      el.value = String(value);
      el.dispatchEvent(new window.Event(eventType, { bubbles: true }));
      return clock.flush();
    },
    setSelect(target, value) {
      const el = typeof target === 'string' ? this.$(target) : target;
      el.value = String(value);
      el.dispatchEvent(new window.Event('change', { bubbles: true }));
      return clock.flush();
    },
    async chooseFile(inputId, file) {
      const input = this.byId(inputId);
      Object.defineProperty(input, 'files', { value: [file], configurable: true });
      input.dispatchEvent(new window.Event('change', { bubbles: true }));
      await clock.flush();
    },
    // Convenience: the count-off is on by default; many playback tests want it off.
    async disableCountOff() {
      const toggle = this.byId('countoff-toggle');
      if (toggle.checked) {
        toggle.checked = false;
        toggle.dispatchEvent(new window.Event('change', { bubbles: true }));
        await clock.flush();
      }
    },
    playheadLeftPx() {
      return parseFloat(this.byId('playhead').style.left);
    },
    sidebarTypes() {
      return this.$$('.sidebar-chip').map((chip) => chip.textContent.trim().split(/\s+/)[0]);
    },
    timelineSections() {
      return this.$$('.tl-section').map((el) => ({
        el,
        left: parseFloat(el.style.left),
        width: parseFloat(el.style.width),
        name: el.querySelector('.tl-section-name').textContent,
        bars: el.querySelector('.tl-section-bars').textContent,
        chords: el.querySelector('.tl-section-chords').textContent,
      }));
    },
    editorRows() {
      return this.$$('#sections-list .sec-row').map((row) => ({
        row,
        type: row.querySelector('.type-sel').value,
        bars: row.querySelector('.num-in').value,
        bpb: row.querySelectorAll('.time-sel')[0].value,
        den: row.querySelectorAll('.time-sel')[1].value,
        chords: row.querySelector('.chord-in').value,
      }));
    },
    isPlaying() {
      return this.byId('play-btn').title === 'Pause';
    },
    // Flush the event loop until `predicate()` is true (for async app flows
    // like FileReader or fetch chains that are not on the fake clock).
    async waitUntil(predicate, tries = 200) {
      for (let i = 0; i < tries; i += 1) {
        if (predicate()) return;
        await clock.flush();
      }
      throw new Error('waitUntil timed out');
    },
    close() { window.close(); },
  };

  // --- Polyfills / instrumentation, installed before app scripts run ---

  // jsdom's Blob/File lack arrayBuffer()/text(); back-fill via FileReader.
  if (!window.Blob.prototype.arrayBuffer) {
    window.Blob.prototype.arrayBuffer = function arrayBuffer() {
      return new Promise((resolve, reject) => {
        const reader = new window.FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsArrayBuffer(this);
      });
    };
  }
  if (!window.Blob.prototype.text) {
    window.Blob.prototype.text = function text() {
      return new Promise((resolve, reject) => {
        const reader = new window.FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsText(this);
      });
    };
  }

  // jsdom has no onpointerdown/... IDL attributes, so the app's
  // `el.onpointerdown = fn` assignments would silently register nothing.
  for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel']) {
    const prop = `on${type}`;
    if (!(prop in window.HTMLElement.prototype)) {
      const key = Symbol(prop);
      Object.defineProperty(window.HTMLElement.prototype, prop, {
        configurable: true,
        get() { return this[key] || null; },
        set(fn) {
          if (this[key]) this.removeEventListener(type, this[key]);
          this[key] = fn || null;
          if (fn) this.addEventListener(type, fn);
        },
      });
    }
  }

  FakeAudio.instances.length = 0;
  window.Audio = FakeAudio;

  window.HTMLCanvasElement.prototype.getContext = function getContext() {
    return { ...CANVAS_2D_STUB };
  };

  window.AudioContext = class StubAudioContext {
    async decodeAudioData() { return decodedAudioBuffer; }
  };

  window.alert = (msg) => { app.alerts.push(String(msg)); };
  window.confirm = (msg) => {
    app.confirms.push(String(msg));
    return typeof confirmResult === 'function' ? confirmResult(msg) : confirmResult;
  };
  window.prompt = (msg, def) => {
    app.prompts.push({ msg: String(msg), def });
    return typeof promptResult === 'function' ? promptResult(msg, def) : promptResult;
  };
  window.print = () => { app.prints += 1; };

  let objectUrlCounter = 0;
  window.URL.createObjectURL = (blob) => {
    app.objectUrls.push(blob);
    objectUrlCounter += 1;
    return `blob:fake-${objectUrlCounter}`;
  };
  window.URL.revokeObjectURL = () => {};

  window.HTMLAnchorElement.prototype.click = function anchorClick() {
    app.saves.push({ download: this.download, href: this.href });
  };

  if (fetchStub) {
    window.fetch = (...args) => Promise.resolve(fetchStub(...args));
  }

  // --- Execute the app's scripts in document order ---
  for (const src of srcs) {
    const file = path.join(ROOT, src.replace(/^\.\//, '').replace(/\//g, path.sep));
    const code = fs.readFileSync(file, 'utf8');
    window.eval(`${code}\n//# sourceURL=${src}`);
  }
  await clock.flush();

  return app;
}
