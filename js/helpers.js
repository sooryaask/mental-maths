// Shared helpers for question generators and rendering.
const H = (() => {
  // Duels seed this stream so both players generate identical questions from one shared
  // number. Unseeded it is Math.random, so solo drills behave exactly as they always have.
  let rnd = Math.random;
  const seed = (s) => {
    let a = s >>> 0;
    rnd = () => { // mulberry32
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  const unseed = () => { rnd = Math.random; };

  const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const coin = (p = 0.5) => rnd() < p;

  // Group large integers with thin spaces: 12 345
  const num = (n) => {
    const s = String(Math.abs(n));
    const g = s.length > 4 ? s.replace(/\B(?=(\d{3})+(?!\d))/g, " ") : s;
    return (n < 0 ? "−" : "") + g;
  };

  // Stacked fraction HTML for a rational (integers render plainly)
  const fr = (r) => {
    if (r.d === 1) return num(r.n);
    return `${r.n < 0 ? "−" : ""}<span class="frac"><span>${num(Math.abs(r.n))}</span><span>${num(r.d)}</span></span>`;
  };
  // Raw (possibly unsimplified) fraction n/d
  const frRaw = (n, d) => fr({ n, d });

  // Mixed-number HTML: 7/3 -> 2⅓ (stacked)
  const mixed = (r) => {
    const a = Math.abs(r.n), w = Math.floor(a / r.d), rem = a % r.d;
    if (!w || !rem) return fr(r);
    return `${r.n < 0 ? "−" : ""}${w}<span class="frac"><span>${rem}</span><span>${r.d}</span></span>`;
  };

  // Decimal HTML for a terminating rational (or fraction fallback)
  const dec = (r) => {
    const s = Q.toDecimal(r);
    return s === null ? fr(r) : s.replace("-", "−");
  };

  const rec = (r) => {
    const { neg, int, pre, rep } = Q.recurring(r);
    return `${neg ? "−" : ""}${int}.${pre}<span class="rec">${rep}</span>`;
  };

  const sup = (x) => `<sup>${x}</sup>`;
  const supFrac = (p, q) => q === 1 ? sup(p < 0 ? "−" + -p : p) : `<sup class="sfrac">${p < 0 ? "−" : ""}${Math.abs(p)}/${q}</sup>`;
  const neg = (n) => n < 0 ? `(−${-n})` : String(n);

  // Answer builders
  const rat = (value, extra = {}) => ({ type: "rat", value, ...extra });

  // Wrap into a question object
  const question = (topic, text, answer, show, hint, format) =>
    ({ topic, text, answer, show, hint, format, key: text });

  const primeFactors = (n) => {
    const out = [];
    for (let p = 2; p * p <= n; p++) while (n % p === 0) { out.push(p); n /= p; }
    if (n > 1) out.push(n);
    return out;
  };

  return { seed, unseed, ri, pick, coin, num, fr, frRaw, mixed, dec, rec, sup, supFrac, neg, rat, question, primeFactors };
})();
