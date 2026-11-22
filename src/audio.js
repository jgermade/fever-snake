// Tiny WebAudio synth for sound effects. No audio files needed.

let ctx = null;
let muted = false;
try {
  muted = localStorage.getItem('fever-snake.muted') === '1';
} catch {
  /* storage unavailable */
}

function ac() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone(freq, { at = 0, dur = 0.1, type = 'square', vol = 0.08, slide = 0 } = {}) {
  const a = ac();
  if (!a || muted) return;
  const t = a.currentTime + at;
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gain).connect(a.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

export const sfx = {
  unlock() {
    ac();
  },
  get muted() {
    return muted;
  },
  toggleMute() {
    muted = !muted;
    try {
      localStorage.setItem('fever-snake.muted', muted ? '1' : '0');
    } catch {
      /* ignore */
    }
    return muted;
  },
  eat(type = 'square', combo = 0) {
    const base = 520 * Math.pow(1.06, combo);
    tone(base, { dur: 0.07, type });
    tone(base * 1.5, { at: 0.06, dur: 0.09, type });
  },
  turn() {
    tone(180, { dur: 0.025, type: 'triangle', vol: 0.03 });
  },
  die() {
    tone(330, { dur: 0.5, type: 'sawtooth', vol: 0.1, slide: -280 });
    tone(110, { at: 0.1, dur: 0.6, type: 'square', vol: 0.06, slide: -60 });
  },
  warp() {
    [262, 330, 392, 523, 659, 784].forEach((f, i) => tone(f, { at: i * 0.07, dur: 0.16, type: 'triangle', vol: 0.07 }));
  },
  start() {
    tone(392, { dur: 0.08 });
    tone(523, { at: 0.08, dur: 0.12 });
  },
};
