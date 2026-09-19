// Algebra: differentiation and indefinite integration of powers of x (integer powers only).
(() => {
  const { ri, pick, coin, num, fr, rat, question } = H;
  const mc = (q, extra) => Object.assign(q, extra);
  const I = (n) => Q.make(n);
  const K = "the number k (integer or fraction, e.g. 4/3)";
  const nz = (a, b) => { let v; do { v = ri(a, b); } while (!v); return v; };
  const sg = (n) => (n < 0 ? "−" + -n : String(n));
  const par = (n) => (n < 0 ? `(−${-n})` : String(n));
  const xp = (n) => (n === 0 ? "" : n === 1 ? "<i>x</i>" : `<i>x</i>${H.sup(sg(n))}`);
  // One term with an integer coefficient: 4x⁵, −x², 3x⁻²; later terms get " + " / " − "
  const term = (a, n, first) => {
    const sign = a < 0 ? (first ? "−" : " − ") : first ? "" : " + ";
    const c = Math.abs(a) === 1 && n !== 0 ? "" : num(Math.abs(a));
    return sign + c + xp(n);
  };
  const poly = (ts) => ts.map(([a, n], i) => term(a, n, i === 0)).join("") || "0";
  const ddx = `<span class="frac"><span>d</span><span>d<i>x</i></span></span>`;

  TOPICS.push({
    id: "diff", group: "Algebra", name: "Differentiation", sample: "d/dx(4x⁵), f′(2)",
    gen(lvl) {
      if (lvl === 1 || coin(lvl === 2 ? 0.5 : 0.3)) {
        const a = lvl === 1 ? ri(2, 9) : nz(-9, 9);
        const n = lvl === 1 ? ri(2, 7) : pick([-4, -3, -2, -1, 2, 3, 4, 5, 6]);
        const k = a * n;
        return mc(question(this.id, `${ddx}(${term(a, n, true)}) = k${xp(n - 1)}`, rat(I(k)), `k = ${num(k)}`,
          `Multiply by the power, then take 1 off the power: ${num(a)} × ${par(n)} = ${num(k)}`, K),
          { signs: true, wrong: [I(a * (n - 1)), I(a), I(-k)] }); // multiplied by the new power / forgot to multiply / sign slip
      }
      // Differentiate a short polynomial, then evaluate at a point
      const powers = lvl === 2 ? [4, 3, 2, 1] : [4, 3, 2, 1, -1, -2];
      const chosen = [];
      while (chosen.length < (lvl === 2 ? 2 : 3)) { const p = pick(powers); if (!chosen.includes(p)) chosen.push(p); }
      chosen.sort((a, b) => b - a);
      const ts = chosen.map((n) => [lvl === 2 ? ri(1, 5) * (coin(0.3) ? -1 : 1) : nz(-5, 5), n]);
      if (lvl === 3 && coin()) ts.push([nz(-9, 9), 0]); // a constant, which differentiates to 0
      // Negative powers at x = ±3 or −2 give ninths and 27ths; keep those to x = ±1 or 2
      const hasNeg = ts.some(([, n]) => n < 0);
      const x0 = pick(lvl === 2 ? [1, 2, 3, -1] : hasNeg ? [-1, 1, 2] : [-2, -1, 1, 2, 3]);
      const sum = (f) => ts.reduce((acc, [a, n]) => Q.add(acc, f(a, n)), I(0));
      const v = sum((a, n) => (n ? Q.mul(I(a * n), Q.pow(I(x0), n - 1)) : I(0)));
      const keptPower = sum((a, n) => Q.mul(I(a * n), Q.pow(I(x0), n)));
      const notDifferentiated = sum((a, n) => Q.mul(I(a), Q.pow(I(x0), n)));
      const d = ts.filter(([, n]) => n).map(([a, n]) => [a * n, n - 1]);
      return mc(question(this.id, `f(<i>x</i>) = ${poly(ts)}. &nbsp;Find f′(${sg(x0)})`, rat(v), fr(v),
        `f′(<i>x</i>) = ${poly(d)}, then put <i>x</i> = ${sg(x0)}`, "integer or fraction"),
        { signs: true, wrong: [keptPower, notDifferentiated] });
    },
  });

  TOPICS.push({
    id: "integ", group: "Algebra", name: "Integration", sample: "∫ 6x⁻³ dx",
    gen(lvl) {
      if (lvl === 3 && coin()) {
        // Expand a square, then integrate term by term
        const p = ri(1, 3), q = nz(-5, 5), k = p * q;
        const inner = `${p === 1 ? "" : p}<i>x</i> ${q < 0 ? "−" : "+"} ${Math.abs(q)}`;
        const c3 = Q.make(p * p, 3), lead = c3.d === 1 ? (c3.n === 1 ? "" : num(c3.n)) : fr(c3);
        return mc(question(this.id, `∫ (${inner})${H.sup(2)} d<i>x</i> = ${lead}<i>x</i>${H.sup(3)} + k<i>x</i>${H.sup(2)} + ${q * q}<i>x</i> + c`,
          rat(I(k)), `k = ${num(k)}`,
          `Expand first: ${poly([[p * p, 2], [2 * p * q, 1], [q * q, 0]])}; then ${num(2 * p * q)}<i>x</i> integrates to ${num(k)}<i>x</i>${H.sup(2)}`, K),
          { signs: true, wrong: [I(2 * k), I(q * q), I(-k)] }); // forgot to halve / mixed up terms / sign slip
      }
      let n, a;
      if (lvl === 1) { n = ri(1, 5); a = (n + 1) * ri(1, 6); } // whole-number answers
      else { n = pick([-5, -4, -3, -2, 2, 3, 4, 5, 6]); a = nz(-9, 9); } // fractions and negative powers
      const k = Q.make(a, n + 1);
      return mc(question(this.id, `∫ ${term(a, n, true)} d<i>x</i> = k${xp(n + 1)} + c`, rat(k), `k = ${fr(k)}`,
        `Add 1 to the power (${sg(n)} → ${sg(n + 1)}), then divide by the new power: ${num(a)} ÷ ${par(n + 1)}`, K),
        { signs: true, wrong: [Q.make(a, n), I(a * (n + 1)), Q.make(-a, n + 1)] }); // divided by the old power / multiplied / sign slip
    },
  });
})();
