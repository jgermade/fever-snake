// Procedural chiptune: every world gets its own little loop, derived from its
// id (scale, root, tempo, patterns). FEVER mode speeds it up an octave higher.
import { ac, isMuted } from './audio.js';
import { rng } from './render/util.js';

const SCALES = {
  minorPenta: [0, 3, 5, 7, 10],
  majorPenta: [0, 2, 4, 7, 9],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  blues: [0, 3, 5, 6, 7, 10],
};
const LOOKAHEAD = 0.12; // seconds scheduled ahead
const STEPS = 16;

const hash = (s) => [...s].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619), 2166136261) >>> 0;
const midiHz = (m) => 440 * 2 ** ((m - 69) / 12);

/** Deterministic song description for a world (exported for tests). */
export function compose(world) {
  const r = rng(hash(world.id));
  const scaleNames = Object.keys(SCALES);
  const scale = SCALES[scaleNames[Math.floor(r() * scaleNames.length)]];
  const root = 45 + Math.floor(r() * 10); // A2..F#3
  const bpm = Math.round(Math.min(150, Math.max(88, 15000 / world.tickMs + r() * 20)));
  const note = (deg) => root + 12 * Math.floor(deg / scale.length) + scale[((deg % scale.length) + scale.length) % scale.length];
  // bass: root / fifth-ish on the beats, a pickup now and then
  const bass = Array.from({ length: STEPS }, (_, i) => (i % 4 === 0 ? note(i % 8 === 0 ? 0 : r() < 0.5 ? 4 : 3) : i % 4 === 3 && r() < 0.3 ? note(2) : null));
  // lead: a random walk on the scale, two octaves up, with rests
  let deg = Math.floor(r() * scale.length);
  const lead = Array.from({ length: STEPS * 2 }, () => {
    deg += Math.floor(r() * 5) - 2;
    deg = Math.max(0, Math.min(scale.length * 2, deg));
    return r() < 0.62 ? note(deg) + 24 : null;
  });
  const kick = Array.from({ length: STEPS }, (_, i) => i % 4 === 0 || (i === 10 && r() < 0.5));
  const hat = Array.from({ length: STEPS }, (_, i) => i % 2 === 1 || r() < 0.15);
  return { bpm, bass, lead, kick, hat, wave: world.sfx ?? 'square' };
}

let song = null;
let step = 0;
let nextTime = 0;
let timer = null;
let fever = false;
let master = null;
let noiseBuf = null;

function out() {
  const a = ac();
  if (!a) return null;
  if (!master) {
    master = a.createGain();
    master.gain.value = 0.55;
    master.connect(a.destination);
    noiseBuf = a.createBuffer(1, a.sampleRate * 0.1, a.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return a;
}

function voice(a, t, freq, { type = 'square', dur = 0.1, vol = 0.03, slide = 0 }) {
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise(a, t, vol) {
  const s = a.createBufferSource();
  const g = a.createGain();
  const f = a.createBiquadFilter();
  f.type = 'highpass';
  f.frequency.value = 7000;
  s.buffer = noiseBuf;
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
  s.connect(f).connect(g).connect(master);
  s.start(t);
}

function schedule() {
  const a = out();
  if (!a || !song) return;
  const stepDur = 60 / (song.bpm * (fever ? 1.3 : 1)) / 4;
  if (nextTime < a.currentTime) nextTime = a.currentTime + 0.02;
  while (nextTime < a.currentTime + LOOKAHEAD) {
    if (!isMuted()) {
      const i = step % STEPS;
      const t = nextTime;
      if (song.kick[i]) voice(a, t, 120, { type: 'sine', dur: 0.12, vol: 0.12, slide: 0.35 });
      if (song.hat[i]) noise(a, t, fever ? 0.05 : 0.03);
      if (song.bass[i] != null) voice(a, t, midiHz(song.bass[i]), { type: 'triangle', dur: stepDur * 1.8, vol: 0.07 });
      const l = song.lead[step % song.lead.length];
      if (l != null) voice(a, t, midiHz(l + (fever ? 12 : 0)), { type: song.wave, dur: stepDur * 0.9, vol: song.wave === 'sine' ? 0.04 : 0.022 });
    }
    nextTime += stepDur;
    step += 1;
  }
}

export const music = {
  /** Switches to the loop of `world` (keeps the beat position). */
  play(world) {
    song = compose(world);
    if (!timer) {
      timer = setInterval(schedule, 25);
      nextTime = 0;
    }
  },
  stop() {
    clearInterval(timer);
    timer = null;
  },
  setFever(on) {
    fever = on;
  },
};
