// ============================================================================
// Procedural sound. No audio files: every effect is synthesised on the fly,
// which keeps the repo tiny and lets us retune a sound by changing a number.
// The AudioContext is created on the first user gesture (browsers block it
// otherwise) and every call is wrapped so audio can never break the game.
// ============================================================================

const KEY = 'cheapmate.muted.v1';

class Sfx {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = this._loadMuted();
    this.enabled = true;
  }

  _loadMuted() { try { return localStorage.getItem(KEY) === '1'; } catch (e) { return false; } }
  setMuted(m) {
    this.muted = m;
    try { localStorage.setItem(KEY, m ? '1' : '0'); } catch (e) {}
    if (this.master) this.master.gain.value = m ? 0 : 0.9;
  }
  toggle() { this.setMuted(!this.muted); return this.muted; }

  // Called from the first click/keypress anywhere in the page.
  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) { this.enabled = false; return; }
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.9;
      this.master.connect(this.ctx.destination);
    } catch (e) { this.enabled = false; }
  }

  get t() { return this.ctx ? this.ctx.currentTime : 0; }

  // --- building blocks ----------------------------------------------------
  tone(freq, { dur = 0.12, type = 'sine', gain = 0.2, at = 0, attack = 0.005, decay = null, slideTo = null } = {}) {
    if (!this.ctx || this.muted) return;
    const t0 = this.t + at;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + (decay || dur));
    o.connect(g); g.connect(this.master);
    o.start(t0); o.stop(t0 + (decay || dur) + 0.02);
  }

  noise({ dur = 0.1, gain = 0.2, at = 0, freq = 1200, q = 1, type = 'bandpass' } = {}) {
    if (!this.ctx || this.muted) return;
    const t0 = this.t + at;
    const n = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const f = this.ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t0); src.stop(t0 + dur + 0.02);
  }

  // --- the actual sounds --------------------------------------------------
  play(name) {
    if (!this.enabled) return;
    this.unlock();
    if (!this.ctx || this.muted) return;
    try { (this[name] || (() => {})).call(this); } catch (e) { /* never break the game for a beep */ }
  }

  uiClick()  { this.tone(880, { dur: .05, type: 'square', gain: .06 }); }
  uiHover()  { this.tone(1400, { dur: .03, type: 'sine', gain: .025 }); }
  place()    { this.tone(200, { dur: .11, type: 'triangle', gain: .3, slideTo: 130 });
               this.noise({ dur: .05, gain: .12, freq: 900 }); }
  sell()     { this.tone(400, { dur: .1, type: 'triangle', gain: .16, slideTo: 700 }); }
  error()    { this.tone(150, { dur: .17, type: 'sawtooth', gain: .14, slideTo: 90 }); }

  move()     { this.noise({ dur: .045, gain: .16, freq: 1500, q: .8 });
               this.tone(320, { dur: .05, type: 'triangle', gain: .1 }); }
  capture()  { this.noise({ dur: .13, gain: .32, freq: 500, q: .5 });
               this.tone(140, { dur: .12, type: 'sawtooth', gain: .18, slideTo: 70 }); }
  check()    { this.tone(1250, { dur: .09, type: 'square', gain: .13 });
               this.tone(1600, { dur: .09, type: 'square', gain: .1, at: .07 }); }

  coin()     { this.tone(1320, { dur: .07, type: 'square', gain: .13 });
               this.tone(1980, { dur: .13, type: 'square', gain: .11, at: .06 }); }
  buy()      { [660, 880, 1320].forEach((f, i) =>
                 this.tone(f, { dur: .12, type: 'square', gain: .13, at: i * .055 })); }
  upgrade()  { [523, 659, 784, 1047, 1319].forEach((f, i) =>
                 this.tone(f, { dur: .2, type: 'triangle', gain: .16, at: i * .07 })); }

  mate()     { [523, 659, 784, 1047].forEach((f, i) =>
                 this.tone(f, { dur: .5, type: 'triangle', gain: .2, at: i * .1 }));
               this.tone(1568, { dur: .8, type: 'sine', gain: .18, at: .42 });
               this.noise({ dur: .5, gain: .1, freq: 2600, at: .4 }); }
  defeat()   { [392, 330, 262, 196].forEach((f, i) =>
                 this.tone(f, { dur: .42, type: 'sawtooth', gain: .16, at: i * .15 })); }
  heartbreak(){ this.tone(300, { dur: .5, type: 'triangle', gain: .25, slideTo: 70 });
                this.noise({ dur: .22, gain: .15, freq: 300 }); }

  achievement(){ [784, 1047, 1319, 1568, 2093].forEach((f, i) =>
                  this.tone(f, { dur: .3, type: 'sine', gain: .14, at: i * .06 }));
                 this.noise({ dur: .35, gain: .06, freq: 4200, at: .1 }); }

  bossIn()   { this.tone(55, { dur: 1.5, type: 'sawtooth', gain: .3 });
               this.tone(82.5, { dur: 1.5, type: 'sawtooth', gain: .18 });
               this.noise({ dur: 1.2, gain: .1, freq: 200, at: .1, type: 'lowpass' });
               this.tone(110, { dur: .5, type: 'square', gain: .2, at: .9, slideTo: 55 }); }
  primeHum() { this.tone(48, { dur: 2.6, type: 'sawtooth', gain: .16 });
               this.tone(49.5, { dur: 2.6, type: 'sawtooth', gain: .14 }); }
  glitch()   { for (let i = 0; i < 5; i++)
                 this.noise({ dur: .04, gain: .18, freq: 400 + Math.random() * 3000, at: i * .05 }); }
  whoosh()   { this.noise({ dur: .45, gain: .16, freq: 700, q: .4, type: 'lowpass' }); }
  typewriter(){ this.noise({ dur: .022, gain: .07, freq: 2600, q: 1.4 }); }
}

export const sfx = new Sfx();

// First gesture anywhere unlocks audio.
['pointerdown', 'keydown'].forEach(ev =>
  window.addEventListener(ev, () => sfx.unlock(), { once: true, passive: true }));
