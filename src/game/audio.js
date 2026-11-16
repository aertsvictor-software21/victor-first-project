// Kleine WebAudio-synth: vrolijke, korte geluidjes zonder externe bestanden.
export class Audio {
  constructor() {
    this.ctx = null;
    this.volume = 0.5;
    this.listener = null; // () => Vector3 (positie speler)
  }
  ensure() {
    if (!this.ctx) {
      try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; }
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }
  setVolume(v) { this.volume = v; if (this.master) this.master.gain.value = v; }

  tone(freq, dur, { type = 'sine', vol = 0.3, slide = 0, delay = 0 } = {}) {
    const c = this.ctx; if (!c) return;
    const t = c.currentTime + delay;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.02);
  }
  noise(dur, { vol = 0.3, freq = 800 } = {}) {
    const c = this.ctx; if (!c) return;
    const len = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2;
    const src = c.createBufferSource(); src.buffer = buf;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq;
    const g = c.createGain(); g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start();
  }

  play(name, src) {
    if (!this.ctx) return;
    let vol = 1;
    if (src && src.pos && this.listener) {
      const d = src.pos.distanceTo(this.listener());
      vol = src.isPlayer ? 1 : Math.max(0, 1 - d / 35);
      if (vol <= 0.02) return;
    }
    switch (name) {
      case 'fire_blaster': this.tone(880, 0.06, { type: 'triangle', vol: 0.12 * vol, slide: 0.6 }); break;
      case 'fire_bouncer': this.tone(260, 0.14, { type: 'square', vol: 0.08 * vol, slide: 1.8 }); break;
      case 'fire_rocket': this.noise(0.25, { vol: 0.2 * vol, freq: 1600 }); this.tone(180, 0.2, { type: 'sawtooth', vol: 0.05 * vol, slide: 2 }); break;
      case 'boom': this.noise(0.45, { vol: 0.45 * vol, freq: 700 }); this.tone(120, 0.3, { vol: 0.3 * vol, slide: 0.4 }); break;
      case 'hit': this.tone(1500, 0.05, { type: 'square', vol: 0.06 }); break;
      case 'ko': [660, 880, 1320].forEach((f, i) => this.tone(f, 0.12, { type: 'triangle', vol: 0.15, delay: i * 0.07 })); break;
      case 'jump': if (src?.isPlayer) this.tone(420, 0.12, { type: 'sine', vol: 0.12, slide: 1.8 }); break;
      case 'pad': this.tone(300, 0.3, { type: 'sine', vol: 0.18 * vol, slide: 3 }); break;
      case 'dash': if (src?.isPlayer) this.noise(0.15, { vol: 0.15, freq: 3000 }); break;
      case 'special': this.tone(200, 0.35, { type: 'sawtooth', vol: 0.1 * vol, slide: 3 }); this.noise(0.3, { vol: 0.25 * vol, freq: 900 }); break;
      case 'heal': [523, 659, 784].forEach((f, i) => this.tone(f, 0.15, { vol: 0.12, delay: i * 0.06 })); break;
      case 'click': this.tone(700, 0.05, { type: 'triangle', vol: 0.08 }); break;
      case 'win': [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.25, { type: 'triangle', vol: 0.15, delay: i * 0.12 })); break;
    }
  }
}
