// Online leaderboard backed by Firebase (Firestore + anonymous sign-in).
// Optional: with no config in firebase-config.js, or offline, the drills work the same
// and the page says the leaderboard isn't available.
const LB = (() => {
  const SDK = "https://www.gstatic.com/firebasejs/10.12.2/";
  let ready = null, db = null, uid = null, FV = null;

  const configured = () => typeof FIREBASE_CONFIG !== "undefined" && !!(FIREBASE_CONFIG && FIREBASE_CONFIG.apiKey);
  const load = (src) => new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src; s.onload = resolve; s.onerror = () => reject(new Error("offline"));
    document.head.appendChild(s);
  });
  const scores = (board) => db.collection("boards").doc(board).collection("scores");

  // Load the SDK and sign in anonymously. The anonymous account persists in this
  // browser and is what owns a claimed username.
  function init() {
    if (!ready) {
      ready = (async () => {
        if (!configured()) throw new Error("not-configured");
        if (!window.firebase) {
          await load(SDK + "firebase-app-compat.js");
          await Promise.all([load(SDK + "firebase-auth-compat.js"), load(SDK + "firebase-firestore-compat.js")]);
        }
        if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
        const auth = firebase.auth();
        const user = await new Promise((res) => { const off = auth.onAuthStateChanged((u) => { off(); res(u); }); });
        uid = (user || (await auth.signInAnonymously()).user).uid;
        db = firebase.firestore();
        FV = firebase.firestore.FieldValue;
      })();
      ready.catch((e) => { console.error("Leaderboard unavailable:", e); ready = null; }); // allow a retry later
    }
    return ready;
  }

  // Claim a name (first come, first served), or confirm this browser already owns it.
  // Throws Error("taken") when someone else has it.
  async function claim(display) {
    await init();
    const ref = db.collection("usernames").doc(display.toLowerCase());
    const snap = await ref.get();
    if (snap.exists) {
      if (snap.data().uid === uid) return snap.data().display;
      throw new Error("taken");
    }
    try {
      await ref.set({ uid, display, createdAt: FV.serverTimestamp() });
    } catch (e) {
      if (e.code === "permission-denied") throw new Error("taken"); // claimed a moment ago by someone else
      throw e;
    }
    return display;
  }

  // One entry per name per board; only an improvement replaces it.
  // Set: most correct, then fastest. Sprint: most correct, then fewest wrong.
  async function submit(board, entry) {
    await init();
    const rank = entry.mode === "set"
      ? (entry.total - entry.correct) * 1e7 + entry.timeMs
      : (10000 - entry.correct) * 1e7 + (entry.total - entry.correct);
    const ref = scores(board).doc(entry.name.toLowerCase());
    const prev = await ref.get();
    if (prev.exists && prev.data().rank <= rank) return { improved: false, best: prev.data() };
    await ref.set({ ...entry, uid, rank, at: FV.serverTimestamp() });
    return { improved: true };
  }

  // Live top 25 for a board. cb gets {rows} or {error}. Returns an unsubscribe function.
  function watch(board, cb) {
    let off = null, dead = false;
    init().then(() => {
      if (dead) return;
      off = scores(board).orderBy("rank").limit(25).onSnapshot(
        (s) => cb({ rows: s.docs.map((d) => d.data()) }),
        (e) => { console.error(e); cb({ error: "unavailable" }); });
    }, (e) => !dead && cb({ error: e.message }));
    return () => { dead = true; if (off) off(); };
  }

  // handle() lets duel.js share this connection instead of signing in a second time.
  return { configured, init, claim, submit, watch, handle: () => ({ db, uid, FV }) };
})();
