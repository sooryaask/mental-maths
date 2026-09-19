// Four operations: plain whole-number addition, subtraction, multiplication and division.
// Added with unshift so this section comes first on the start page.
(() => {
  const { ri, coin, num, rat, question } = H;
  const N = "integer", I = (n) => Q.make(n);
  const mc = (q, extra) => Object.assign(q, extra);
  const sign = (n) => (n < 0 ? "−" : "+");

  // Round b to a friendly number and adjust: "a + 198" -> "a + 200 − 2"
  const roundHint = (a, b, op, unit) => {
    const R = Math.round(b / unit) * unit, d = R - b;
    if (!d || !R) return `Work left to right, carrying as you go`;
    return op === "+"
      ? `${num(a)} + ${num(R)} ${d > 0 ? "−" : "+"} ${Math.abs(d)}`
      : `${num(a)} − ${num(R)} ${d > 0 ? "+" : "−"} ${Math.abs(d)}`;
  };

  // "Smaller digit from the bigger" in every column: the classic forgot-to-borrow slip
  const noBorrow = (x, y) => {
    const X = String(x), Y = String(y).padStart(X.length, "0");
    return parseInt([...X].map((c, i) => Math.abs(+c - +Y[i])).join(""), 10);
  };

  const ops = [
    {
      id: "op-add", group: "Four operations", name: "Addition", sample: "47 + 38",
      gen(lvl) {
        if (lvl === 3 && coin(0.4)) {
          const xs = [ri(101, 999), ri(101, 999), ri(101, 999)], v = xs[0] + xs[1] + xs[2];
          return mc(question(this.id, xs.map(num).join(" + "), rat(I(v)), num(v),
            `In pairs: ${num(xs[0])} + ${num(xs[1])} = ${num(xs[0] + xs[1])}, then + ${num(xs[2])}`, N), { step: 10 });
        }
        const r = [[12, 99], [101, 999], [1001, 9999]][lvl - 1];
        const a = ri(...r), b = ri(...r);
        if (a % 10 === 0 || b % 10 === 0) return this.gen(lvl);
        return mc(question(this.id, `${num(a)} + ${num(b)}`, rat(I(a + b)), num(a + b), roundHint(a, b, "+", lvl === 1 ? 10 : 100), N),
          { step: 10, wrong: [I(a + b - 10), I(a + b + 10)] }); // dropped or doubled a carry
      },
    },
    {
      id: "op-sub", group: "Four operations", name: "Subtraction", sample: "523 − 198",
      gen(lvl) {
        const r = [[12, 99], [101, 999], [1001, 9999]][lvl - 1];
        let a = ri(...r), b = ri(...r);
        if (lvl < 3 && a < b) [a, b] = [b, a];
        if (lvl === 1 && a - b < 15) return this.gen(lvl); // tiny answers leave no room for options below them
        if (a === b || b % 10 === 0) return this.gen(lvl);
        const v = a - b, big = Math.max(a, b), small = Math.min(a, b);
        const slip = Math.sign(v) * noBorrow(big, small);
        const hint = v < 0
          ? `It comes out negative: ${num(b)} − ${num(a)} = ${num(-v)}, so the answer is −${num(-v)}`
          : roundHint(a, b, "−", lvl === 1 ? 10 : 100);
        return mc(question(this.id, `${num(a)} − ${num(b)}`, rat(I(v)), num(v), hint, N),
          { step: 10, signs: lvl === 3, wrong: [I(slip), ...(lvl === 3 ? [I(-v)] : [])] });
      },
    },
    {
      id: "op-mul", group: "Four operations", name: "Multiplication", sample: "7 × 8, 13 × 17",
      gen(lvl) {
        let a, b;
        if (lvl === 1) { a = ri(2, 12); b = ri(2, 12); }
        else if (lvl === 2) { a = ri(13, 25); b = ri(3, 12); }
        else { a = ri(13, 49); b = ri(13, 29); }
        const big = Math.max(a, b), small = Math.min(a, b);
        if (lvl > 1 && big % 10 === 0) return this.gen(lvl);
        if (coin()) [a, b] = [b, a];
        const v = a * b, t = Math.floor(big / 10) * 10, u = big % 10;
        const hint = lvl === 1
          ? `Build from a fact you know: ${small} × ${big - 1} = ${small * (big - 1)}, plus ${small}`
          : `Split ${big}: ${t} × ${small} + ${u} × ${small} = ${num(t * small)} + ${num(u * small)}`;
        return mc(question(this.id, `${a} × ${b}`, rat(I(v)), num(v), hint, N),
          { step: 10, wrong: [I(small * (big + 1)), I(small * (big - 1))] }); // neighbouring table fact
      },
    },
    {
      id: "op-div", group: "Four operations", name: "Division", sample: "72 ÷ 8",
      gen(lvl) {
        let d, q;
        if (lvl === 1) { d = ri(2, 12); q = ri(2, 12); }
        else if (lvl === 2) { d = ri(3, 9); q = ri(13, 99); }
        else { d = ri(13, 25); q = ri(12, 40); }
        const n = d * q, t = Math.floor(q / 10) * 10;
        const hint = lvl === 1 || !t || t === q
          ? `Think backwards: ${d} × ${q} = ${num(n)}`
          : `Chunk it: ${d} × ${t} = ${num(d * t)}, leaving ${num(n - d * t)} = ${d} × ${q - t}`;
        return mc(question(this.id, `${num(n)} ÷ ${d}`, rat(I(q)), num(q), hint, N),
          { wrong: [I(q + 1), I(q - 1)] });
      },
    },
  ];

  TOPICS.unshift(...ops);
})();
