// Fractions & decimals generators. Each gen(level) returns a question object.
// Multiple-choice extras (used by mc.js): wrong = values from typical mistakes, kind "dec" = decimal answers,
// fmt = answer formatter, step = offset that keeps near-misses plausible, signs = sign slips are plausible.
const TOPICS = [];
(() => {
  const { ri, pick, coin, num, fr, mixed, dec, rec, rat, question } = H;
  const F = "fraction, e.g. 7/12";
  const properFrac = (maxD) => { const d = ri(2, maxD); return Q.make(ri(1, d - 1), d); };
  const place = (v) => [Q.mul(v, Q.make(10)), Q.div(v, Q.make(10))]; // decimal point in the wrong place
  const mc = (q, extra) => Object.assign(q, extra);

  TOPICS.push({
    id: "frac-add", group: "Fractions", name: "Add & subtract", sample: "3/4 + 5/6",
    gen(lvl) {
      const maxD = [8, 12, 15][lvl - 1];
      let a = properFrac(maxD), b = properFrac(maxD);
      while (a.d === 1 || b.d === 1 || Q.eq(a, b)) { a = properFrac(maxD); b = properFrac(maxD); }
      if (lvl === 3) { a = Q.add(a, Q.make(ri(1, 3))); b = Q.add(b, Q.make(ri(1, 2))); }
      const op = lvl === 1 ? "+" : pick(["+", "−"]), plus = op === "+";
      const ans = plus ? Q.add(a, b) : Q.sub(a, b);
      const L = Q.lcm(a.d, b.d), show = lvl === 3 ? mixed : fr;
      return mc(question(this.id, `${show(a)} ${op} ${show(b)}`, rat(ans), `${fr(ans)}${Math.abs(ans.n) > ans.d && ans.d > 1 ? ` = ${mixed(ans)}` : ""}`,
        `Common denominator ${L}: ${a.n * L / a.d}/${L} ${op} ${b.n * L / b.d}/${L}`, F + " or mixed 1 3/4"), {
        wrong: [
          plus ? Q.sub(a, b) : Q.add(a, b),                      // wrong operation
          Q.make(a.n + (plus ? 1 : -1) * b.n, a.d * b.d),        // multiplied denominators, didn't scale numerators
          ...(plus ? [Q.make(a.n + b.n, a.d + b.d)] : []),       // added tops and bottoms
        ],
      });
    },
  });

  TOPICS.push({
    id: "frac-mul", group: "Fractions", name: "Multiply & divide", sample: "4/9 × 15/8",
    gen(lvl) {
      const maxN = [9, 16, 12][lvl - 1];
      let a = Q.make(ri(1, maxN), ri(2, maxN)), b = Q.make(ri(1, maxN), ri(2, maxN));
      if (lvl === 3) { a = Q.add(a, Q.make(ri(1, 3))); b = Q.add(b, Q.make(ri(0, 2))); }
      if (b.n === 0 || a.d === 1 || b.d === 1) return this.gen(lvl);
      const op = pick(["×", "÷"]);
      const ans = op === "×" ? Q.mul(a, b) : Q.div(a, b);
      const show = lvl === 3 ? mixed : fr;
      const hint = op === "÷" ? `Flip and multiply: ${fr(a)} × ${fr(Q.make(b.d, b.n))}` : `Cancel common factors before multiplying`;
      return mc(question(this.id, `${show(a)} ${op} ${show(b)}`, rat(ans), fr(ans),
        (lvl === 3 ? "Convert mixed numbers to improper first. " : "") + hint, F), {
        wrong: op === "×" ? [Q.div(a, b)] : [Q.mul(a, b), Q.div(b, a)], // divided instead / forgot to flip / flipped the wrong one
      });
    },
  });

  TOPICS.push({
    id: "frac-simp", group: "Fractions", name: "Simplify", sample: "84/126",
    gen(lvl) {
      const maxD = [12, 20, 36][lvl - 1], maxK = [6, 12, 25][lvl - 1];
      let base; do { base = properFrac(maxD); } while (base.d === 1);
      const k = ri(2, maxK);
      return question(this.id, `Simplify ${H.frRaw(base.n * k, base.d * k)}`, rat(base, { lowest: true }), fr(base),
        `HCF is ${k}: divide top and bottom by ${k}`, "lowest terms, e.g. 2/3");
    },
  });

  TOPICS.push({
    id: "frac-dec", group: "Fractions", name: "Fraction ↔ decimal", sample: "3/8 = 0.375",
    gen(lvl) {
      if (lvl === 3 && coin(0.7)) {
        const d = pick([3, 6, 9, 11, 12, 15, 18, 22, 30, 33, 45, 7]);
        let f; do { f = Q.make(ri(1, d - 1), d); } while (Q.terminates(f));
        const { pre, rep } = Q.recurring(f), all = pre + rep;
        return mc(question(this.id, `Write ${rec(f)} as a fraction`, rat(f, { lowest: true }), fr(f),
          `Let x = the decimal; multiply by 10ⁿ to line up the repeating block and subtract`, F), {
          wrong: [
            Q.make(parseInt(all, 10), 10 ** all.length - 1),                            // whole block over 9s
            Q.make(parseInt(all, 10), (10 ** rep.length - 1) * 10 ** pre.length),       // forgot to subtract the non-repeating part
          ],
        });
      }
      const ds = [[2, 4, 5, 8, 10, 20, 25], [8, 16, 20, 25, 40, 50], [16, 32, 40, 80, 125, 200]][lvl - 1];
      let f; do { f = Q.make(ri(1, 30), pick(ds)); } while (f.d === 1 || f.n > f.d * (lvl === 1 ? 1 : 3));
      if (coin()) {
        let k = 1; while ((10 ** k) % f.d) k++;
        return mc(question(this.id, `${fr(f)} as a decimal`, rat(f), dec(f),
          f.d === 10 ** k ? `Tenths/hundredths: read it straight off` : `Scale the denominator to ${num(10 ** k)}: multiply top and bottom by ${num(10 ** k / f.d)}`, "decimal, e.g. 0.375"),
          { kind: "dec", wrong: [...place(f), Q.fromDecimal(`${f.n}.${f.d}`)] }); // 3/8 → "3.8"
      }
      const s = Q.toDecimal(f), places = (s.split(".")[1] || "").length;
      return mc(question(this.id, `${dec(f)} as a fraction`, rat(f, { lowest: true }), fr(f),
        `${dec(f)} = ${H.frRaw(Math.round(parseFloat(s) * 10 ** places), 10 ** places)}, then simplify`, "lowest terms, e.g. 3/8"),
        { wrong: place(f) });
    },
  });

  // decimal a×10^-i as a rational
  const dv = (a, i) => Q.mul(Q.make(a), Q.pow10(-i));

  TOPICS.push({
    id: "dec-mul", group: "Decimals", name: "Multiply decimals", sample: "0.3 × 0.07",
    gen(lvl) {
      const [ra, rb] = [[[1, 9], [1, 9]], [[11, 99], [2, 9]], [[11, 99], [11, 99]]][lvl - 1];
      const a = ri(...ra), b = ri(...rb);
      if (a % 10 === 0 || b % 10 === 0) return this.gen(lvl);
      const i = ri(-1, lvl === 1 ? 2 : 3), j = ri(lvl === 1 ? 0 : -2, 3);
      if (i <= 0 && j <= 0) return this.gen(lvl);
      const x = dv(a, i), y = dv(b, j), ans = Q.mul(x, y);
      return mc(question(this.id, `${dec(x)} × ${dec(y)}`, rat(ans), dec(ans),
        `${a} × ${b} = ${a * b}` + (i + j ? `, then move the point ${Math.abs(i + j)} place${Math.abs(i + j) === 1 ? "" : "s"} ${i + j > 0 ? "left" : "right"}` : ""), "decimal"),
        { kind: "dec", wrong: place(ans) });
    },
  });

  TOPICS.push({
    id: "dec-div", group: "Decimals", name: "Divide decimals", sample: "7.2 ÷ 0.03",
    gen(lvl) {
      const d = [ri(2, 9), pick([ri(2, 9), ri(11, 25)]), ri(11, 99)][lvl - 1];
      if (d % 10 === 0) return this.gen(lvl);
      const di = ri(1, lvl === 1 ? 2 : 3);
      const qi = lvl === 3 ? ri(-1, 2) : lvl === 2 ? ri(-1, 1) : ri(-1, 0);
      const q = [ri(2, 12), ri(2, 40), ri(2, 60)][lvl - 1];
      const divisor = dv(d, di), ans = dv(q, qi), dividend = Q.mul(divisor, ans);
      return mc(question(this.id, `${dec(dividend)} ÷ ${dec(divisor)}`, rat(ans), dec(ans),
        `Multiply both by ${num(10 ** di)}: ${dec(Q.mul(dividend, Q.pow10(di)))} ÷ ${d}`, "decimal"),
        { kind: "dec", wrong: place(ans) });
    },
  });

  TOPICS.push({
    id: "percent", group: "Decimals", name: "Percentages", sample: "35% of 240",
    gen(lvl) {
      const pcts = [[5, 10, 20, 25, 50, 75], [5, 12.5, 15, 35, 45, 60, 2.5], [7.5, 12.5, 17.5, 32, 64, 120, 0.5]][lvl - 1];
      const p = pick(pcts), P = Q.div(Q.fromDecimal(String(p)), Q.make(100)), one = Q.make(1);
      const y = pick([20, 40, 60, 80, 120, 160, 240, 360, 480, 640, 800]) * (lvl === 3 ? pick([1, 2, 5]) : 1);
      const kind = lvl === 1 ? 0 : ri(0, lvl === 2 ? 1 : 3);
      if (kind === 0) {
        const ans = Q.mul(P, Q.make(y));
        return mc(question(this.id, `${p}% of ${num(y)}`, rat(ans), dec(ans), `${p}% = ${dec(P)}, so ${dec(P)} × ${num(y)}`, "number"),
          { kind: "dec", wrong: place(ans) });
      }
      if (kind === 1) {
        const up = coin(), m = up ? Q.add(one, P) : Q.sub(one, P), ans = Q.mul(m, Q.make(y));
        return mc(question(this.id, `${num(y)} ${up ? "increased" : "decreased"} by ${p}%`, rat(ans), dec(ans), `Multiplier ${dec(m)}`, "number"),
          { kind: "dec", wrong: [Q.mul(P, Q.make(y)), Q.mul(up ? Q.sub(one, P) : Q.add(one, P), Q.make(y))] }); // just the change / wrong direction
      }
      if (kind === 2) {
        const up = coin(), m = up ? Q.add(one, P) : Q.sub(one, P), after = Q.mul(m, Q.make(y));
        return mc(question(this.id, `After a ${p}% ${up ? "increase" : "decrease"} it is ${dec(after)}. Original?`, rat(Q.make(y)), num(y),
          `Divide by the multiplier ${dec(m)}`, "number"),
          { kind: "dec", wrong: [Q.mul(after, up ? Q.sub(one, P) : Q.add(one, P))] }); // took the % of the new value
      }
      const part = Q.mul(P, Q.make(y)), ans = Q.fromDecimal(String(p));
      return mc(question(this.id, `${dec(part)} as a percentage of ${num(y)}`, rat(ans), `${p}%`,
        `${dec(part)} ÷ ${num(y)} × 100`, "number (no % sign needed)"),
        { kind: "dec", fmt: (v) => `${dec(v)}%`, wrong: place(ans) });
    },
  });

  TOPICS.push({
    id: "std-form", group: "Decimals", name: "Standard form", sample: "(3×10⁴)(4×10⁻⁷)",
    gen(lvl) {
      const sf = (m, e) => `${dec(m)} × 10${H.sup(e < 0 ? "−" + -e : e)}`;
      // value -> standard-form HTML, e.g. 4770 -> 4.77 × 10³
      const sfv = (v) => {
        let e = 0, m = v;
        while (Math.abs(m.n) >= 10 * m.d) { m = Q.div(m, Q.make(10)); e++; }
        while (Math.abs(m.n) < m.d) { m = Q.mul(m, Q.make(10)); e--; }
        return sf(m, e);
      };
      const m1 = Q.fromDecimal(String(lvl === 1 ? ri(1, 9) : ri(11, 99) / 10));
      const x = Q.mul(m1, Q.pow10(ri(-6, 6))), y = Q.mul(Q.make(ri(2, 9)), Q.pow10(ri(-6, 6)));
      const op = lvl === 1 ? "×" : pick(["×", "÷", ...(lvl === 3 ? ["sq"] : [])]);
      let text, ans;
      if (op === "sq") {
        const base = Q.mul(Q.fromDecimal(String(pick([1.1, 1.2, 1.5, 2, 2.5, 3, 4, 5]))), Q.pow10(ri(-4, 4)));
        text = `(${sfv(base)})${H.sup(2)}`; ans = Q.pow(base, 2);
      } else if (op === "×") {
        text = `(${sfv(x)}) × (${sfv(y)})`; ans = Q.mul(x, y);
      } else {
        text = `(${sfv(Q.mul(x, y))}) ÷ (${sfv(y)})`; ans = x;
      }
      return mc(question(this.id, text, rat(ans), sfv(ans), `Deal with the numbers and the powers of 10 separately, then adjust`, "e.g. 1.2e-3 or 1.2x10^-3"),
        { kind: "dec", fmt: sfv, wrong: place(ans) });
    },
  });
})();
