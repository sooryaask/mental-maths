// Integers, indices, surds and logs generators. See topics-a.js for the multiple-choice extras.
(() => {
  const { ri, pick, coin, num, fr, neg, rat, question, supFrac, primeFactors } = H;
  const N = "integer";
  const sq = (x) => `<span class="sq">√<span>${x}</span></span>`;
  const cb = (x) => `<span class="sq"><sup class="idx">3</sup>√<span>${x}</span></span>`;
  const mc = (q, extra) => Object.assign(q, extra);
  const I = (n) => Q.make(n);

  TOPICS.push({
    id: "mult", group: "Integers", name: "Long multiplication", sample: "47 × 23",
    gen(lvl) {
      const a = [ri(12, 99), ri(12, 99), ri(101, 999)][lvl - 1];
      const b = [ri(3, 9), ri(12, 99), ri(12, 99)][lvl - 1];
      if (a % 10 === 0 || b % 10 === 0) return this.gen(lvl);
      const t = Math.floor(b / 10) * 10, u = b % 10;
      const hint = t ? `${num(a)} × ${t} + ${num(a)} × ${u} = ${num(a * t)} + ${num(a * u)}` : `${Math.floor(a / 10) * 10} × ${b} + ${a % 10} × ${b}`;
      return mc(question(this.id, `${num(a)} × ${b}`, rat(I(a * b)), num(a * b), hint, N), { step: 10 }); // same last digit
    },
  });

  TOPICS.push({
    id: "int-div", group: "Integers", name: "Division (exact)", sample: "3276 ÷ 12",
    gen(lvl) {
      const d = [ri(3, 9), ri(11, 25), ri(12, 99)][lvl - 1];
      const q = [ri(12, 99), ri(12, 199), ri(101, 999)][lvl - 1];
      const f = primeFactors(d);
      let hint = `Short division by ${d}`;
      if (f.length > 1) {
        const a = f[0], b = d / a;
        hint = `÷ ${d} is ÷ ${a} then ÷ ${b}: ${num(d * q)} ÷ ${a} = ${num(d * q / a)}`;
      }
      // step keeps (option × divisor) ending in the same digit as the dividend
      return mc(question(this.id, `${num(d * q)} ÷ ${d}`, rat(I(q)), num(q), hint, N), { step: 10 / Q.gcd(d, 10) });
    },
  });

  TOPICS.push({
    id: "int-rem", group: "Integers", name: "Division (remainders)", sample: "347 ÷ 9",
    gen(lvl) {
      const d = [ri(3, 9), ri(11, 19), ri(12, 60)][lvl - 1];
      const n = [ri(20, 200), ri(100, 999), ri(1000, 9999)][lvl - 1];
      if (n % d === 0) return this.gen(lvl);
      const q = Math.floor(n / d), r = n % d;
      return question(this.id, `${num(n)} ÷ ${d}`, { type: "rem", q, r, d, value: Q.make(n, d) },
        `${num(q)} r ${r}`, `${d} × ${num(q)} = ${num(d * q)}, leaving ${r}`, "q r r, e.g. 38 r 5 (or a mixed number)");
    },
  });

  TOPICS.push({
    id: "powers", group: "Integers", name: "Squares, cubes & roots", sample: "17², ∛2744",
    gen(lvl) {
      const kind = lvl === 1 ? ri(0, 1) : ri(0, 3);
      if (lvl === 3 && coin(0.3)) {
        const x = Q.make(pick([11, 12, 13, 14, 15, 25, 3, 7, 9, 16]), pick([10, 100]));
        const ans = Q.pow(x, 2);
        return mc(question(this.id, `${H.dec(x)}${H.sup(2)}`, rat(ans), H.dec(ans), `Square the digits, then place the point (double the decimal places)`, "decimal"),
          { kind: "dec", wrong: [Q.mul(x, I(2)), Q.mul(ans, I(10)), Q.div(ans, I(10))] }); // doubled / point misplaced
      }
      const n = [ri(11, 20), ri(11, 30), ri(21, 60)][lvl - 1], c = [0, ri(2, 12), ri(6, 20)][lvl - 1];
      if (n % 10 === 0) return this.gen(lvl);
      const a = Math.round(n / 10) * 10, b = n - a;
      const sqHint = `(${a} ${b < 0 ? "−" : "+"} ${Math.abs(b)})² = ${a * a} ${b < 0 ? "−" : "+"} ${Math.abs(2 * a * b)} + ${b * b}`;
      if (kind === 0) return mc(question(this.id, `${n}${H.sup(2)}`, rat(I(n * n)), num(n * n), sqHint, N), { step: 10, wrong: [I(a * a + b * b)] }); // forgot the 2ab
      if (kind === 1) {
        const mirror = 10 * Math.floor(n / 10) + (10 - (n % 10)); // other root with the same last digit, e.g. 18 ↔ 12
        return mc(question(this.id, sq(num(n * n)), rat(I(n)), String(n), `Last digit and nearest known square narrow it down`, N), { step: 10, wrong: [I(mirror)] });
      }
      if (kind === 2) return mc(question(this.id, `${c}${H.sup(3)}`, rat(I(c ** 3)), num(c ** 3), `${c}² = ${c * c}, then × ${c}`, N), { step: 10 });
      return question(this.id, cb(num(c ** 3)), rat(I(c)), String(c), `Cube's last digit fixes the root's last digit`, N);
    },
  });

  TOPICS.push({
    id: "negatives", group: "Integers", name: "Negatives & BIDMAS", sample: "−6 × (−4) − 15 ÷ (−3)",
    gen(lvl) {
      const nz = (a, b) => { let x; do { x = ri(a, b); } while (!x); return x; };
      const S = { signs: true };
      const flip = (v) => ({ ...S, wrong: [Q.make(-v.n, v.d)] });
      if (lvl === 1) {
        const a = nz(-12, 12), b = nz(-12, 12), op = pick(["+", "−", "×", "÷"]);
        if (op === "÷") return mc(question(this.id, `${num(a * b)} ÷ ${neg(b)}`, rat(I(a)), num(a), `Signs: same → +, different → −`, N), flip(I(a)));
        const v = op === "+" ? a + b : op === "−" ? a - b : a * b;
        return mc(question(this.id, `${num(a)} ${op} ${neg(b)}`, rat(I(v)), num(v), op === "−" && b < 0 ? `Subtracting a negative is adding` : `Signs: same → +, different → −`, N),
          { ...S, wrong: [I(-v), ...(op === "−" ? [I(a + b)] : op === "+" ? [I(a - b)] : [])] });
      }
      if (lvl === 2) {
        const a = nz(-9, 9), b = nz(-9, 9), d = nz(-6, 6), c = nz(-9, 9);
        const v = a * b - c;
        return mc(question(this.id, `${num(a)} × ${neg(b)} − ${neg(c * d)} ÷ ${neg(d)}`, rat(I(v)), num(v),
          `× and ÷ first: ${num(a * b)} − ${neg(c)}`, N), { ...S, wrong: [I(a * b + c), I(-v)] }); // sign slip on the second term
      }
      const t = ri(0, 3), a = ri(2, 5), b = nz(-9, 9), c = nz(-6, 6);
      if (t === 0) { const p = ri(3, 5), v = (-a) ** p; return mc(question(this.id, `(−${a})${H.sup(p)}`, rat(I(v)), num(v), `Odd power keeps the sign, even power makes it positive`, N), flip(I(v))); }
      if (t === 1) { const v = -(a * a) + b; return mc(question(this.id, `−${a}${H.sup(2)} + ${neg(b)}`, rat(I(v)), num(v), `−${a}² means −(${a}²) = −${a * a}`, N), { ...S, wrong: [I(a * a + b)] }); }
      if (t === 2) { const v = (b - c) ** 2 - a * c; return mc(question(this.id, `(${num(b)} − ${neg(c)})${H.sup(2)} − ${a} × ${neg(c)}`, rat(I(v)), num(v), `Brackets: ${b - c}, squared: ${(b - c) ** 2}`, N), { ...S, wrong: [I((b + c) ** 2 - a * c), I((b - c) ** 2 + a * c)] }); }
      const v = Q.div(I(b * c - a), I(c));
      return mc(question(this.id, `(${num(b)} × ${neg(c)} − ${a}) ÷ ${neg(c)}`, rat(v), fr(v), `Numerator first: ${b * c - a}`, "integer or fraction"), flip(v));
    },
  });

  TOPICS.push({
    id: "indices", group: "Indices, surds & logs", name: "Indices", sample: "27<sup>−2/3</sup>",
    gen(lvl) {
      let r, q, p;
      if (lvl === 1) { r = I(pick([2, 3, 4, 5, 10])); q = 1; p = r.n === 2 ? ri(-3, 10) : ri(-2, 4); }
      else if (lvl === 2) { r = I(ri(2, 5)); q = pick([2, 3, 4].filter((k) => r.n ** k <= 625)); p = pick([-3, -2, -1, 1, 2, 3].filter((k) => r.n ** Math.abs(k) <= 125)); }
      else {
        r = pick([Q.make(2, 3), Q.make(3, 2), Q.make(1, 2), Q.make(2, 5), Q.make(3, 4), Q.make(1, 10), Q.make(4, 3)]);
        q = pick([2, 3]); p = pick([-3, -2, -1, 1, 2, 3]);
        if (q === 3 && (r.n > 3 || r.d > 4)) q = 2;
      }
      if (Q.gcd(p, q) !== 1) return this.gen(lvl);
      const base = Q.pow(r, q), ans = Q.pow(r, p);
      const bh = base.d === 1 ? num(base.n) : `(${fr(base)})`;
      const rs = r.d === 1 ? Q.toString(r) : `(${Q.toString(r)})`;
      const pw = p < 0 ? `1 ÷ ${rs}^${-p}` : `${rs}^${p}`;
      const hint = p === 0 ? `Anything (non-zero) to the power 0 is 1`
        : q === 1 ? (p < 0 ? `Negative power means reciprocal: ${pw}` : p === 1 ? `Power 1 leaves it unchanged` : `${p} lots of ${rs} multiplied together`)
        : `${["", "", "√", "∛", "∜"][q]}(${Q.toString(base)}) = ${Q.toString(r)}, then ${pw}`;
      return mc(question(this.id, `${bh}${supFrac(p, q)}`, rat(ans), fr(ans), hint, "integer or fraction"),
        { wrong: [Q.pow(r, -p), Q.mul(base, Q.make(p, q))] }); // ignored the minus / multiplied base by the power
    },
  });

  TOPICS.push({
    id: "surds", group: "Indices, surds & logs", name: "Surds", sample: "√72 = k√2",
    gen(lvl) {
      const m = pick([2, 3, 5, 6, 7]), a = ri(2, lvl === 1 ? 6 : 9), b = ri(2, 6);
      const K = "the integer k";
      if (lvl === 1) return mc(question(this.id, `${sq(a * a * m)} = k${sq(m)}`, rat(I(a)), `k = ${a}`, `${a * a * m} = ${a * a} × ${m}, and √${a * a} = ${a}`, K), { wrong: [I(a * a)] }); // forgot to root
      if (lvl === 2) {
        if (coin()) return mc(question(this.id, `${sq(a * a * m)} × ${sq(b * b * m)}`, rat(I(a * b * m)), num(a * b * m), `√${a * a * m} = ${a}√${m}, √${b * b * m} = ${b}√${m}; √${m} × √${m} = ${m}`, N), { wrong: [I(a * b)] });
        return mc(question(this.id, `${sq(a * a * m)} + ${sq(b * b * m)} = k${sq(m)}`, rat(I(a + b)), `k = ${a + b}`, `${a}√${m} + ${b}√${m}`, K), { wrong: [I(a * b)] });
      }
      const t = ri(0, 2);
      if (t === 0) return mc(question(this.id, `<span class="frac"><span>${a * m}</span><span>${sq(m)}</span></span> = k${sq(m)}`, rat(I(a)), `k = ${a}`, `Multiply top and bottom by √${m}: ${a * m}√${m} / ${m}`, K), { wrong: [I(a * m)] });
      if (t === 1) { const x = ri(3, 12), y = ri(2, 11); if (x === y) return this.gen(lvl); return mc(question(this.id, `(${sq(x)} + ${sq(y)})(${sq(x)} − ${sq(y)})`, rat(I(x - y)), num(x - y), `Difference of two squares: ${x} − ${y}`, N), { signs: true, wrong: [I(x + y), I(y - x)] }); }
      const c = ri(2, 7);
      return mc(question(this.id, `(${c} + ${sq(m)})(${c} − ${sq(m)})`, rat(I(c * c - m)), num(c * c - m), `Difference of two squares: ${c}² − ${m}`, N), { signs: true, wrong: [I(c * c + m), I(m - c * c)] });
    },
  });

  TOPICS.push({
    id: "logs", group: "Indices, surds & logs", name: "Logarithms", sample: "log<sub>8</sub> 32",
    gen(lvl) {
      const lg = (b, x) => `log<sub>${b}</sub> ${x}`;
      const pw = (r, k) => k >= 0 ? num(r ** k) : fr(Q.make(1, r ** -k));
      const extra = (v) => ({ signs: true, wrong: [...(v.n ? [Q.make(v.d, v.n)] : []), Q.make(-v.n, v.d)] }); // upside down / sign slip
      if (lvl === 1) {
        const b = pick([2, 3, 5, 10]), t = ri(0, b === 2 ? 7 : b === 10 ? 5 : 4);
        return mc(question(this.id, lg(b, num(b ** t)), rat(I(t)), String(t), `${b} to what power gives ${num(b ** t)}?`, N), { signs: true });
      }
      const r = pick([2, 3]), s = lvl === 2 ? pick([1, 2]) : pick([2, 3]);
      const t = ri(-4, r === 2 ? 6 : 4);
      if (!t) return this.gen(lvl);
      const baseTxt = lvl === 3 && coin(0.35) ? `(${fr(Q.make(1, r ** s))})` : num(r ** s);
      const flip = baseTxt.startsWith("(");
      if (lvl === 3 && coin(0.35) && t > 0 && t % 2) {
        const v = Q.make(flip ? -t : t, 2 * s);
        return mc(question(this.id, lg(baseTxt, sq(num(r ** t))), rat(v), fr(v), `Base = ${r}${flip ? "^−" : "^"}${s}, argument = ${r}^(${t}/2)`, "integer or fraction"), extra(v));
      }
      const v = flip ? Q.make(-t, s) : Q.make(t, s);
      return mc(question(this.id, lg(baseTxt, pw(r, t)), rat(v), fr(v), `Write both as powers of ${r}: base ${r}${flip ? "^−" : "^"}${s}, argument ${r}^${t}`, "integer or fraction"), extra(v));
    },
  });
})();
