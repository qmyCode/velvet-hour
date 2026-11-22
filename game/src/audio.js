// Every sound in Velvet Hour is synthesised with WebAudio — no audio files. A low hush of
// room tone runs under everything; footsteps are short filtered-noise taps whose volume and
// stereo pan follow the nearest guard, so a player can hear where a guard is before seeing
// him; a thrown coin clinks twice; a raised alarm stings once and settles into a pulse.
// The context is created lazily on the first user gesture, as browsers require.

export function createAudio() {
  let ctx = null;
  let master = null;
  let hushGain = null;

  function unlock() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.55;
    master.connect(ctx.destination);
    startHush();
  }

  function noiseBuffer(seconds) {
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  function startHush() {
    const source = ctx.createBufferSource();
    source.buffer = noiseBuffer(2);
    source.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 220;
    hushGain = ctx.createGain();
    hushGain.gain.value = 0.016;
    source.connect(filter).connect(hushGain).connect(master);
    source.start();
  }

  /** One footstep tap. `pan` -1..1 and `volume` 0..1 place it; `soft` makes it a sneak step. */
  function step(pan, volume, soft) {
    if (!ctx || volume <= 0.01) return;
    const t = ctx.currentTime;
    const source = ctx.createBufferSource();
    source.buffer = noiseBuffer(0.09);
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = soft ? 500 : 750;
    filter.Q.value = 1.1;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume * (soft ? 0.10 : 0.20), t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
    const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (panner) {
      panner.pan.value = Math.max(-1, Math.min(1, pan));
      source.connect(filter).connect(gain).connect(panner).connect(master);
    } else {
      source.connect(filter).connect(gain).connect(master);
    }
    source.start(t);
    source.stop(t + 0.1);
  }

  /** The bright double clink of a coin landing on stone. */
  function clink(pan) {
    if (!ctx) return;
    const t = ctx.currentTime;
    for (const [offset, freq] of [[0, 2637], [0.07, 3520]]) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.16, t + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, t + offset + 0.22);
      const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      if (panner) {
        panner.pan.value = Math.max(-1, Math.min(1, pan));
        osc.connect(gain).connect(panner).connect(master);
      } else {
        osc.connect(gain).connect(master);
      }
      osc.start(t + offset);
      osc.stop(t + offset + 0.25);
    }
  }

  /** The alarm sting: a hard saw sweep down, then gone — the vault has woken. */
  function sting() {
    if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(660, t);
    osc.frequency.exponentialRampToValueAtTime(196, t + 0.5);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.12, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
    osc.connect(gain).connect(master);
    osc.start(t);
    osc.stop(t + 0.6);
  }

  /** A soft high shimmer when the Star is taken. */
  function chime() {
    if (!ctx) return;
    const t = ctx.currentTime;
    for (const [offset, freq] of [[0, 1568], [0.09, 2093], [0.18, 2637]]) {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.10, t + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, t + offset + 0.4);
      osc.connect(gain).connect(master);
      osc.start(t + offset);
      osc.stop(t + offset + 0.45);
    }
  }

  return { unlock, step, clink, sting, chime };
}
