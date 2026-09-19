// Wrong-answer sound. Plays sounds/wrong.mp3 if it exists; otherwise a synthesised sad trombone.
// Browsers only allow sound after a tap or key press, which answering always is.
const Sound = (() => {
  const KEY = "nocalc:sound";
  let on = true, missing = false, ctx = null, clip = null;
  try { on = JSON.parse(localStorage.getItem(KEY) ?? "true"); } catch {}
  try {
    clip = new Audio("sounds/wrong.mp3");
    clip.preload = "auto";
    clip.addEventListener("error", () => { missing = true; });
  } catch { missing = true; }

  // Four falling notes, the last one wobbling: wah, wah, wah, wahhh
  function trombone() {
    try {
      ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state === "suspended") ctx.resume();
      const t0 = ctx.currentTime + 0.02;
      const out = ctx.createGain(), lp = ctx.createBiquadFilter();
      out.gain.value = 0.2;
      lp.type = "lowpass"; lp.frequency.value = 1500;
      lp.connect(out).connect(ctx.destination);
      [[392, 0], [370, 0.3], [349, 0.6], [330, 0.9]].forEach(([f, t], i) => {
        const last = i === 3, dur = last ? 0.95 : 0.26, s = t0 + t;
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = "sawtooth";
        o.frequency.setValueAtTime(f, s);
        if (last) {
          const lfo = ctx.createOscillator(), depth = ctx.createGain();
          lfo.frequency.value = 6; depth.gain.value = 9;
          lfo.connect(depth).connect(o.frequency);
          lfo.start(s); lfo.stop(s + dur);
        }
        g.gain.setValueAtTime(0, s);
        g.gain.linearRampToValueAtTime(1, s + 0.03);
        g.gain.setValueAtTime(1, s + dur - 0.08);
        g.gain.linearRampToValueAtTime(0, s + dur);
        o.connect(g).connect(lp);
        o.start(s); o.stop(s + dur + 0.02);
      });
    } catch {}
  }

  function wrong() {
    if (!on) return;
    if (missing || !clip) return trombone();
    clip.currentTime = 0; // restart if it's still playing from the last mistake
    const p = clip.play();
    if (p && p.catch) p.catch(() => { if (clip.error) missing = true; trombone(); });
  }

  function toggle() {
    on = !on;
    try { localStorage.setItem(KEY, JSON.stringify(on)); } catch {}
    return on;
  }

  return { wrong, toggle, isOn: () => on };
})();
