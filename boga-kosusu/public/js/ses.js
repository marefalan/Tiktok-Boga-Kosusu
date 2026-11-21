// Ses: muzik/ klasöründeki şarkılar sırayla çalar. Klasör boşsa oyun kendi country ritmini üretir.
// sfx(): boğa homurtusu, kement ıslığı, tribün alkışı. pulse(): bas seviyesi (0..1).

export function createAudio({ muted = false } = {}) {
  let ctx = null, analyser = null, master = null, sfxBus = null, data = null;
  let el = null, list = [], idx = 0, bpm = 112;
  let synthTimer = null, nextBeat = 0, step = 0;
  let level = 0;

  function ensure() {
    if (ctx) return ctx;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = muted ? 0 : 0.85;
    sfxBus = ctx.createGain(); sfxBus.gain.value = 0.9; sfxBus.connect(master);
    analyser = ctx.createAnalyser(); analyser.fftSize = 512;
    data = new Uint8Array(analyser.frequencyBinCount);
    master.connect(analyser); analyser.connect(ctx.destination);
    return ctx;
  }

  function stopAll() {
    if (el) { el.pause(); el.src = ''; el = null; }
    clearInterval(synthTimer); synthTimer = null;
  }

  function playTrack() {
    if (!list.length) return startSynth();
    el = new Audio(list[idx % list.length]);
    const node = ctx.createMediaElementSource(el);
    node.connect(master);
    el.onended = () => { idx++; stopAll(); playTrack(); };
    el.onerror = () => { idx++; stopAll(); setTimeout(playTrack, 500); };
    el.play().catch(() => {});
  }

  // ---------- sentez yardımcıları ----------
  function noise(dur) {
    const b = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const s = ctx.createBufferSource(); s.buffer = b; return s;
  }
  function env(g, t, peak, a, d) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }
  function kick(t) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.15);
    env(g, t, 0.8, 0.005, 0.28);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.32);
  }
  function brush(t, v = 0.28) {
    const n = noise(0.25), f = ctx.createBiquadFilter(), g = ctx.createGain();
    f.type = 'bandpass'; f.frequency.value = 2600; f.Q.value = 0.6;
    env(g, t, v, 0.01, 0.16);
    n.connect(f); f.connect(g); g.connect(master); n.start(t);
  }
  function pluck(t, freq, v, dur, type = 'triangle', cutoff = 1800) {
    const o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    o.type = type; o.frequency.value = freq;
    f.type = 'lowpass'; f.frequency.setValueAtTime(cutoff, t); f.frequency.exponentialRampToValueAtTime(300, t + dur);
    env(g, t, v, 0.004, dur);
    o.connect(f); f.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.05);
  }

  // G - C - D - G, her akor bir ölçü (8 sekizlik)
  const CHORDS = [
    { root: 98, fifth: 146.8, notes: [196, 246.9, 293.7, 392] },
    { root: 130.8, fifth: 196, notes: [261.6, 329.6, 392, 523.3] },
    { root: 146.8, fifth: 220, notes: [293.7, 370, 440, 587.3] },
    { root: 98, fifth: 146.8, notes: [196, 246.9, 293.7, 392] },
  ];
  const ROLL = [0, 1, 2, 3, 2, 1, 3, 2]; // banjo benzeri arpej

  function startSynth() {
    nextBeat = ctx.currentTime + 0.05; step = 0;
    synthTimer = setInterval(() => {
      const eighth = 60 / bpm / 2;
      while (nextBeat < ctx.currentTime + 0.12) {
        const s = step % 32, ch = CHORDS[Math.floor(s / 8)], e = s % 8;
        // hafif shuffle
        const t = nextBeat + (e % 2 ? eighth * 0.12 : 0);
        if (e === 0 || e === 4) kick(t);
        if (e === 2 || e === 6) brush(t, 0.3);
        if (e % 2) brush(t, 0.08);
        if (e === 0) pluck(t, ch.root, 0.35, 0.35, 'triangle', 600);
        if (e === 4) pluck(t, ch.fifth, 0.3, 0.35, 'triangle', 600);
        pluck(t, ch.notes[ROLL[e]], 0.07, 0.22, 'square', 2400);
        nextBeat += eighth; step++;
      }
    }, 25);
  }

  // ---------- efektler ----------
  const SFX = {
    snort() {
      const t = ctx.currentTime, n = noise(0.6), f = ctx.createBiquadFilter(), g = ctx.createGain();
      f.type = 'lowpass'; f.frequency.setValueAtTime(900, t); f.frequency.exponentialRampToValueAtTime(200, t + 0.5);
      env(g, t, 0.5, 0.03, 0.5);
      n.connect(f); f.connect(g); g.connect(sfxBus); n.start(t);
    },
    whoosh() {
      const t = ctx.currentTime, n = noise(0.5), f = ctx.createBiquadFilter(), g = ctx.createGain();
      f.type = 'bandpass'; f.Q.value = 2; f.frequency.setValueAtTime(600, t); f.frequency.exponentialRampToValueAtTime(3500, t + 0.35);
      env(g, t, 0.35, 0.05, 0.35);
      n.connect(f); f.connect(g); g.connect(sfxBus); n.start(t);
    },
    cheer(big = false) {
      const t = ctx.currentTime, dur = big ? 2.4 : 1.4, n = noise(dur + 0.2), f = ctx.createBiquadFilter(), g = ctx.createGain();
      f.type = 'bandpass'; f.frequency.value = 1400; f.Q.value = 0.4;
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(big ? 0.4 : 0.25, t + 0.25); g.gain.linearRampToValueAtTime(0.0001, t + dur);
      n.connect(f); f.connect(g); g.connect(sfxBus); n.start(t);
    },
    thud() {
      const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.setValueAtTime(90, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.2);
      env(g, t, 0.7, 0.005, 0.3);
      o.connect(g); g.connect(sfxBus); o.start(t); o.stop(t + 0.35);
    },
    bell() {
      const t = ctx.currentTime;
      [1, 2.4, 3.9].forEach((m, i) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.frequency.value = 880 * m; env(g, t, 0.18 / (i + 1), 0.005, 1.2);
        o.connect(g); g.connect(sfxBus); o.start(t); o.stop(t + 1.3);
      });
    },
  };

  return {
    start(tracks) {
      ensure();
      list = tracks || []; idx = 0;
      stopAll();
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      playTrack();
    },
    resume() { ensure(); return ctx.resume(); },
    get blocked() { return !ctx || ctx.state !== 'running'; },
    setBpm(v) { bpm = v; },
    next() { if (list.length > 1) { idx++; stopAll(); playTrack(); } },
    sfx(name, arg) { if (ctx && ctx.state === 'running' && SFX[name]) SFX[name](arg); },
    pulse() {
      if (!analyser) return 0;
      analyser.getByteFrequencyData(data);
      let s = 0; for (let i = 1; i < 10; i++) s += data[i];
      level = Math.max(s / (9 * 255), level * 0.9);
      return level;
    },
  };
}
