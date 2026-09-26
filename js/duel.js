// Head-to-head duels: invite codes, live opponent progress and chess-style Elo ratings.
// Shares the Firebase connection leaderboard.js sets up. With no config the duel buttons
// stay hidden and the rest of the site is untouched.
//
// A duel is a time trial: both players answer the SAME questions (generated locally from a
// shared seed, so no question ever crosses the network) and the lowest total time wins.
// A wrong answer or a skip adds a five-second penalty instead of stopping the run.
const DUEL = (() => {
  const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no O/0/I/1 to read out loud
  const N = 20;            // questions per duel
  const PENALTY_MS = 5000; // added for each wrong answer or skip
  const START = 1200;      // a new player's rating
  const IDLE_MS = 45000;   // opponent silent this long once you've finished: forfeit
  const MAX_MS = 300000;   // hard cap on one duel
  const ROOM_MS = 6 * 3600 * 1000; // how long an unused invite code stays open

  let db = null, uid = null, FV = null;

  const configured = () => LB.configured();
  async function init() {
    if (!db) { await LB.init(); ({ db, uid, FV } = LB.handle()); }
    return uid;
  }
  const matches = () => db.collection("matches");
  const lower = (s) => String(s).toLowerCase();
  const pairKey = (a, b) => [lower(a), lower(b)].sort().join("|");

  /* ---------- Elo ---------- */
  // Chess-style: K is 40 while a rating is still provisional, then 24. One duel can
  // therefore never move a rating by more than 40 points, which the rules also enforce.
  const kFor = (duels) => (duels < 10 ? 40 : 24);
  function elo(mine, theirs, score, duels) {
    const expected = 1 / (1 + Math.pow(10, (theirs - mine) / 400));
    return Math.round(mine + kFor(duels) * (score - expected));
  }

  const blankRating = (name) => ({ name, rating: START, duels: 0, wins: 0, losses: 0 });
  async function ratingOf(name) {
    await init();
    const snap = await db.collection("ratings").doc(lower(name)).get();
    return snap.exists ? snap.data() : blankRating(name);
  }

  // Live top-25 ratings board. Same contract as LB.watch: cb gets {rows} or {error}.
  function watchRatings(cb) {
    let off = null, dead = false;
    init().then(() => {
      if (dead) return;
      off = db.collection("ratings").orderBy("rating", "desc").limit(25).onSnapshot(
        (s) => cb({ rows: s.docs.map((d) => d.data()) }),
        (e) => { console.error(e); cb({ error: "unavailable" }); });
    }, (e) => !dead && cb({ error: e.message }));
    return () => { dead = true; if (off) off(); };
  }

  // Wins for `a` against `b`. Equality on one field only, so no composite index is needed.
  async function headToHead(a, b) {
    await init();
    const s = await db.collection("duels").where("pair", "==", pairKey(a, b)).limit(100).get();
    const out = { a: 0, b: 0, drawn: 0 };
    s.docs.forEach((d) => {
      const w = d.data().winner;
      if (!w) out.drawn++; else if (lower(w) === lower(a)) out.a++; else out.b++;
    });
    return out;
  }

  /* ---------- Rooms ---------- */
  const newCode = () => Array.from({ length: 4 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join("");

  async function create({ name, sections, level, style }) {
    await init();
    const me = await ratingOf(name);
    for (let tries = 0; tries < 8; tries++) {
      const id = newCode(), ref = matches().doc(id);
      if ((await ref.get()).exists) continue; // taken; pick another
      await ref.set({
        host: uid, hostName: name, hostRating: me.rating,
        guestUid: null, guestName: null, guestRating: null,
        seed: Math.floor(Math.random() * 2147483647),
        sections, level, style, n: N,
        state: "open",
        createdAt: FV.serverTimestamp(),
        expiresAt: new Date(Date.now() + ROOM_MS),
      });
      return id;
    }
    throw new Error("no-code");
  }

  // Throws no-match / own-match / full so the lobby can say something specific.
  async function join(code, name) {
    await init();
    const ref = matches().doc(String(code).toUpperCase());
    const snap = await ref.get();
    if (!snap.exists) throw new Error("no-match");
    const m = snap.data();
    if (lower(m.hostName) === lower(name)) throw new Error("own-match");
    if (m.state !== "open") throw new Error("full");
    const me = await ratingOf(name);
    // startedAt is server time: the rules check no finish time is shorter than the race so far
    const patch = { guestUid: uid, guestName: name, guestRating: me.rating, state: "live", startedAt: FV.serverTimestamp() };
    await ref.update(patch);
    return { id: ref.id, ...m, ...patch };
  }

  function watch(code, cb) {
    let off = null, dead = false;
    init().then(() => {
      if (dead) return;
      off = matches().doc(code).onSnapshot(
        (s) => s.exists && cb(s.data()),
        (e) => { console.error(e); cb(null, "unavailable"); });
    }, (e) => !dead && cb(null, e.message));
    return () => { dead = true; if (off) off(); };
  }

  // Both players' progress docs, keyed by lowercase name.
  function watchPlayers(code, cb) {
    let off = null, dead = false;
    init().then(() => {
      if (dead) return;
      off = matches().doc(code).collection("players").onSnapshot(
        (s) => cb(Object.fromEntries(s.docs.map((d) => [d.id, d.data()]))),
        (e) => { console.error(e); cb({}); });
    }, () => !dead && cb({}));
    return () => { dead = true; if (off) off(); };
  }

  // Fire-and-forget: a dropped progress ping must never interrupt the run. `seen` is server
  // time so the rules can check a walkout claim. Resolves (never rejects) once the write lands.
  function progress(code, name, patch) {
    if (!db) return Promise.resolve();
    return matches().doc(code).collection("players").doc(lower(name))
      .set({ name, uid, at: Date.now(), seen: FV.serverTimestamp(), ...patch }, { merge: true })
      .catch((e) => console.error("duel progress", e));
  }

  /* ---------- Settling ---------- */
  // A finished run always beats an unfinished one, so a walkout is a loss.
  function outcome(pa, pb) {
    const fa = !!(pa && pa.finished), fb = !!(pb && pb.finished);
    if (fa !== fb) return fa ? 1 : 0;
    if (!fa) return 0.5;
    if (pa.finalMs === pb.finalMs) return 0.5;
    return pa.finalMs < pb.finalMs ? 1 : 0;
  }

  // Applies one player's delta once. Both clients try; the applied/{code} marker makes the
  // second a no-op, so a result still lands if the loser closes their tab.
  async function applyRating(code, name, delta, score) {
    const ref = db.collection("ratings").doc(lower(name));
    const mark = ref.collection("applied").doc(code);
    await db.runTransaction(async (tx) => {
      const [snap, done] = await Promise.all([tx.get(ref), tx.get(mark)]);
      if (done.exists) return; // already counted
      const cur = snap.exists ? snap.data() : blankRating(name);
      tx.set(ref, {
        name,
        rating: cur.rating + delta,
        duels: (cur.duels || 0) + 1,
        wins: (cur.wins || 0) + (score === 1 ? 1 : 0),
        losses: (cur.losses || 0) + (score === 0 ? 1 : 0),
        lastDuel: code,
        updatedAt: FV.serverTimestamp(),
      });
      tx.set(mark, {});
    });
  }

  // Writes the immutable result, then both rating updates. Ratings are snapshotted into the
  // match doc at join time, so both clients compute the same numbers whoever settles first.
  async function settle(code, m, players) {
    await init();
    const a = m.hostName, b = m.guestName;
    const pa = players[lower(a)], pb = players[lower(b)];
    const sa = outcome(pa, pb), sb = 1 - sa;
    const [ra, rb] = await Promise.all([ratingOf(a), ratingOf(b)]);
    const aAfter = elo(m.hostRating, m.guestRating, sa, ra.duels);
    const bAfter = elo(m.guestRating, m.hostRating, sb, rb.duels);
    const result = {
      a, b, pair: pairKey(a, b),
      aMs: (pa && pa.finalMs) || null, bMs: (pb && pb.finalMs) || null,
      aCorrect: (pa && pa.correct) || 0, bCorrect: (pb && pb.correct) || 0,
      aBefore: m.hostRating, bBefore: m.guestRating,
      aAfter, bAfter,
      winner: sa === 1 ? a : sa === 0 ? b : null,
      at: FV.serverTimestamp(),
    };
    // Create-only: if the opponent settled first, their record is the authoritative one and
    // both clients go on to show and apply exactly the same numbers.
    const ref = db.collection("duels").doc(code);
    let final = result;
    try {
      await ref.set(result);
    } catch (e) {
      if (e.code !== "permission-denied") throw e;
      const existing = await ref.get();
      if (!existing.exists) throw e;
      final = existing.data();
    }
    // Apply each delta to that player's *current* rating, so the ±40 cap in the rules holds
    // even if someone duelled elsewhere between joining and finishing.
    const scoreFor = (name) => (!final.winner ? 0.5 : lower(final.winner) === lower(name) ? 1 : 0);
    await Promise.all([
      applyRating(code, final.a, final.aAfter - final.aBefore, scoreFor(final.a)),
      applyRating(code, final.b, final.bAfter - final.bBefore, scoreFor(final.b)),
    ]).catch((e) => console.error("duel ratings", e));
    return final;
  }

  return {
    N, PENALTY_MS, IDLE_MS, MAX_MS, START,
    configured, init, elo, ratingOf, watchRatings, headToHead,
    create, join, watch, watchPlayers, progress, settle, outcome,
  };
})();
