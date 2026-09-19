// Multiple-choice options built so the right answer can't be spotted by its shape.
// The four options form a 2×2 grid {v, W, slip(v), slip(W)}: W is a typical mistake (or a generic
// one), and the same small slip is applied to both. Every digit pattern, magnitude and sign then
// appears twice, and the correct answer is a random corner rather than the "middle" option.
const MC = (() => {
  const { pick, coin } = H;
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  // Unit of the least significant non-zero digit: 1.265 -> 0.001, 130 -> 10
  function unit(x) {
    const s = (Q.toDecimal(x) || "0").replace("-", "");
    if (s.includes(".")) return Q.pow10(-s.split(".")[1].length);
    return Q.pow10(s === "0" ? 0 : s.length - s.replace(/0+$/, "").length);
  }

  // A small slip (sg = direction, k = size), applied identically to each corner
  function slip(q, x, sg, k) {
    if (q.kind === "dec") return Q.add(x, Q.mul(Q.make(sg * k), unit(x)));
    if (x.d === 1) return Q.add(x, Q.make(sg * k * (q.step || 1)));
    for (let j = k; j < k + 6; j++) {
      const n = x.n + sg * j;
      if (n && Math.sign(n) === Math.sign(x.n) && Q.gcd(n, x.d) === 1) return Q.make(n, x.d); // lowest terms, like the real answer
    }
    // Numerator can't move that way (e.g. 1/8 downwards): move the denominator instead
    for (let j = k; j < k + 6; j++) {
      const d = x.d - sg * Math.sign(x.n) * j;
      if (d > 1 && Q.gcd(x.n, d) === 1) return Q.make(x.n, d);
    }
    return null;
  }

  // Mirror a mistake to the other side of the answer, so mistakes that are always too big
  // (like a² for a) don't leave the answer as the smallest option
  function reflect(q, v, W) {
    if (!v.n) return Q.make(-W.n, W.d); // answer is 0: mirror through zero
    const G = W.n ? Q.div(Q.mul(v, v), W) : null;
    const ratio = Q.div(W, v), r = ratio.d === 1 ? ratio.n : ratio.n === 1 ? ratio.d : 0;
    if (q.kind === "dec" && r && /^10+$/.test(String(r))) return G; // ×10 slip mirrors to ÷10
    const A = Q.sub(Q.mul(Q.make(2), v), W);
    return valid(q, v, A) ? A : G;
  }

  // Larger slip for topics without a listed mistake
  function genericWrong(q, v) {
    const sg = coin() ? 1 : -1;
    if (q.kind === "dec") return Q.mul(v, Q.pow10(sg));
    if (v.d === 1) return Q.add(v, Q.make(sg * (q.step || 1) * pick([4, 5, 6, 7, 9])));
    for (let j = 1; j < 8; j++) {
      const d = v.d + sg * j;
      if (d > 1 && Q.gcd(v.n, d) === 1) return Q.make(v.n, d);
    }
    return null;
  }

  function valid(q, v, c) {
    if (!c || !Number.isSafeInteger(c.n) || !Number.isSafeInteger(c.d) || Q.eq(c, v)) return false;
    if (q.kind === "dec" && !Q.terminates(c)) return false;
    if (!q.signs && Math.sign(c.n) !== Math.sign(v.n)) return false;
    return true;
  }

  function remOptions(q) {
    const { q: n, r, d } = q.answer;
    const n2 = n + (coin() || n < 2 ? 1 : -1);
    const r2 = pick([r + 1, r - 1, r + 2, r - 2].filter((x) => x > 0 && x < d));
    const opts = [[n, r], [n2, r], [n, r2], [n2, r2]];
    return shuffle(opts.map(([a, b], i) => ({ html: `${H.num(a)} r ${b}`, correct: i === 0 })));
  }

  function build(q) {
    if (q.answer.type === "rem") return remOptions(q);
    const v = q.answer.value, fmt = q.fmt || (q.kind === "dec" ? H.dec : H.fr);
    const wrongs = (q.wrong || []).filter((w) => valid(q, v, w));
    // Decide up front where the answer should rank (smallest…largest) so no position is favoured
    const target = Math.floor(Math.random() * 4), val = (c) => c.n / c.d;
    const rankOf = (set) => set.filter((c) => val(c) < val(v)).length;
    for (let tries = 0; tries < 40; tries++) {
      let W = wrongs.length && tries < 25 ? pick(wrongs) : genericWrong(q, v);
      if (!valid(q, v, W)) continue;
      if (coin()) {
        const R = reflect(q, v, W);
        if (valid(q, v, R) && (R.d === 1 || W.d !== 1)) W = R; // never turn a whole-number option into a fraction
      }
      const sg = coin() ? 1 : -1;
      for (const k of shuffle([1, 1, 2, 3])) {
        const set = [v, W, slip(q, v, sg, k), slip(q, W, sg, k)];
        if (!set.slice(2).every((c) => valid(q, v, c))) continue;
        const html = set.map(fmt);
        if (new Set(html).size < 4) continue;
        if (tries < 30 && rankOf(set) !== target) continue;
        return shuffle(html.map((h, i) => ({ html: h, correct: i === 0 })));
      }
    }
    // Fallback: correct answer plus any distinct plausible values
    const out = [v], seen = new Set([fmt(v)]);
    const cands = [...wrongs];
    for (const sg of [1, -1]) for (const k of [1, 2, 3, 5, 10]) cands.push(slip(q, v, sg, k));
    for (const c of shuffle(cands)) {
      if (out.length === 4) break;
      if (!valid(q, v, c) || seen.has(fmt(c))) continue;
      seen.add(fmt(c)); out.push(c);
    }
    return shuffle(out.map((c, i) => ({ html: fmt(c), correct: i === 0 })));
  }

  return { build };
})();
