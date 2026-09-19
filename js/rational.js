// Exact rational arithmetic + answer parsing. Values stay small, so plain Numbers are safe.
const Q = (() => {
  const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a || 1; };
  const lcm = (a, b) => Math.abs((a / gcd(a, b)) * b);

  function make(n, d = 1) {
    if (d === 0) throw new Error("zero denominator");
    if (d < 0) { n = -n; d = -d; }
    const g = gcd(n, d);
    return { n: n / g, d: d / g };
  }
  // Scale to the lcm / cross-cancel first so intermediates stay within safe integers
  const add = (a, b) => { const L = lcm(a.d, b.d); return make(a.n * (L / a.d) + b.n * (L / b.d), L); };
  const sub = (a, b) => add(a, { n: -b.n, d: b.d });
  const mul = (a, b) => { const g1 = gcd(a.n, b.d), g2 = gcd(b.n, a.d); return make((a.n / g1) * (b.n / g2), (a.d / g2) * (b.d / g1)); };
  const div = (a, b) => mul(a, make(b.d, b.n));
  const eq = (a, b) => a.n === b.n && a.d === b.d;
  const pow = (a, k) => k >= 0 ? make(a.n ** k, a.d ** k) : make(a.d ** -k, a.n ** -k);
  const pow10 = (k) => k >= 0 ? make(10 ** k, 1) : make(1, 10 ** -k);

  // "0.125" -> 1/8 exactly
  function fromDecimal(s) {
    const neg = s.startsWith("-");
    if (neg) s = s.slice(1);
    const [w, f = ""] = s.split(".");
    const n = parseInt((w || "0") + f, 10);
    return make(neg ? -n : n, 10 ** f.length);
  }

  // Is the denominator only 2s and 5s (i.e. terminating decimal)?
  function terminates(r) {
    let d = r.d;
    while (d % 2 === 0) d /= 2;
    while (d % 5 === 0) d /= 5;
    return d === 1;
  }

  function toDecimal(r) {
    if (!terminates(r)) return null;
    const neg = r.n < 0;
    let n = Math.abs(r.n), out = String(Math.floor(n / r.d)), rem = n % r.d;
    if (rem) {
      out += ".";
      while (rem) { rem *= 10; out += Math.floor(rem / r.d); rem %= r.d; }
    }
    return (neg ? "-" : "") + out;
  }

  // Recurring decimal pieces: 1/6 -> { int: "0", pre: "1", rep: "6" }
  function recurring(r) {
    const neg = r.n < 0;
    let n = Math.abs(r.n);
    const int = Math.floor(n / r.d);
    let rem = n % r.d, digits = "";
    const seen = new Map();
    while (rem && !seen.has(rem)) {
      seen.set(rem, digits.length);
      rem *= 10;
      digits += Math.floor(rem / r.d);
      rem %= r.d;
    }
    if (!rem) return { neg, int: String(int), pre: digits, rep: "" };
    const at = seen.get(rem);
    return { neg, int: String(int), pre: digits.slice(0, at), rep: digits.slice(at) };
  }

  const toString = (r) => r.d === 1 ? String(r.n) : `${r.n}/${r.d}`;

  // Parse a typed answer. Accepts: 12, -3.75, .5, 7/12, -7/12, 1 3/4, 2e8, 3.4x10^-5, 3.4*10^5
  // Returns { value, form } where form is "int" | "dec" | "frac" | "mixed" | "sci", or null.
  function parse(raw) {
    let s = String(raw).trim().toLowerCase()
      .replace(/[−–—]/g, "-").replace(/×/g, "x").replace(/,/g, "")
      .replace(/\s*\/\s*/g, "/").replace(/\s+/g, " ");
    if (!s) return null;
    let m;
    const num = String.raw`-?(?:\d+\.?\d*|\.\d+)`;
    if ((m = s.match(new RegExp(`^(${num})\\s*(?:e|[x*]\\s*10\\s*\\^)\\s*\\(?(-?\\d+)\\)?$`)))) {
      return { value: mul(fromDecimal(m[1]), pow10(parseInt(m[2], 10))), form: "sci" };
    }
    if ((m = s.match(/^10\s*\^\s*\(?(-?\d+)\)?$/))) return { value: pow10(parseInt(m[1], 10)), form: "sci" };
    if ((m = s.match(/^(-?)(\d+) (\d+)\/(\d+)$/))) {
      const d = parseInt(m[4], 10);
      if (!d) return null;
      const v = make(parseInt(m[2], 10) * d + parseInt(m[3], 10), d);
      return { value: m[1] ? make(-v.n, v.d) : v, form: "mixed" };
    }
    if ((m = s.match(/^(-?\d+)\/(-?\d+)$/))) {
      const d = parseInt(m[2], 10);
      if (!d) return null;
      return { value: make(parseInt(m[1], 10), d), form: "frac", raw: [parseInt(m[1], 10), d] };
    }
    if ((m = s.match(/^-?\d+$/))) return { value: make(parseInt(s, 10), 1), form: "int" };
    if ((m = s.match(new RegExp(`^${num}$`)))) return { value: fromDecimal(s), form: "dec" };
    return null;
  }

  return { gcd, lcm, make, add, sub, mul, div, eq, pow, pow10, fromDecimal, terminates, toDecimal, recurring, toString, parse };
})();
