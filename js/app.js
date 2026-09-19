// UI, sessions, marking and stats.
(() => {
  const $ = (id) => document.getElementById(id);
  const store = {
    get(k, d) { try { return JSON.parse(localStorage.getItem("nocalc:" + k)) ?? d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem("nocalc:" + k, JSON.stringify(v)); } catch {} },
  };
  const byId = Object.fromEntries(TOPICS.map((t) => [t.id, t]));

  // The four sections players choose from; each bundles several question types
  const SECTIONS = [
    { id: "muldiv", name: "Multiplication and division", short: "multiplication & division",
      defaults: { level: 1, style: "type", mode: "sprint", len: 60 }, // ticking it sets up a 1-minute typed warm-up sprint
      sample: "7 × 8 · 72 ÷ 8 · 12 × 11 · 132 ÷ 11", note: "Warm-up: times tables up to 12 × 12 and their divisions. Standard and Hard add bigger numbers, remainders, fractions, decimals and percentages",
      easy: ["op-mul", "op-div"], // Warm-up is times tables only (both use 2–12 at level 1)
      topics: ["op-mul", "op-div", "mult", "int-div", "int-rem", "frac-mul", "frac-simp", "frac-dec", "dec-mul", "dec-div", "percent"] },
    { id: "sil", name: "Surds/Indices/Logs", short: "surds, indices & logs",
      sample: "√72 = k√2 · 27<sup>−2/3</sup> · log<sub>8</sub> 32", note: "Plus squares, cubes, roots and standard form",
      topics: ["surds", "indices", "logs", "powers", "std-form"] },
    { id: "addsub", name: "Addition/subtraction", short: "addition & subtraction",
      sample: "523 − 198 · 3/4 + 5/6 · −6 − (−4)", note: "Whole numbers, fractions, negatives and BIDMAS",
      topics: ["op-add", "op-sub", "frac-add", "negatives"] },
    { id: "calc", name: "Basic GCSE/A-level Algebra", short: "algebra",
      sub: "Indefinite integrals and differentiation with integer powers",
      sample: "d/dx (4x<sup>5</sup>) · ∫ 6x<sup>−3</sup> dx · f′(2)", note: "",
      topics: ["diff", "integ"] },
  ];
  const secById = Object.fromEntries(SECTIONS.map((x) => [x.id, x]));
  const LEVELS = [[1, "Warm-up", "GCSE+"], [2, "Standard", "A-level"], [3, "Hard", "TMUA / STEP"]];
  const MODES = [["sprint", "Sprint", "beat the clock"], ["set", "Set", "fixed count"], ["zen", "Zen", "no limit"]];
  const LENS = { sprint: [[30, "30 sec"], [60, "1 min"]], set: [[10, "10"], [20, "20"], [40, "40"]], zen: [] };
  const STYLES = [["mc", "Multiple choice", "tap A–D"], ["type", "Type it", "exact answer"]];

  const settings = Object.assign({ sections: ["muldiv"], level: 1, style: "type", mode: "sprint", len: { sprint: 60, set: 20 } }, store.get("settings", {}));
  delete settings.topics; // replaced by sections
  settings.sections = (settings.sections || []).filter((id) => secById[id]);
  if (!LENS.sprint.some(([v]) => v === settings.len.sprint)) settings.len.sprint = 60;
  const save = () => store.set("settings", settings);
  const online = LB.configured();
  let myName = store.get("name", "");

  /* ---------- Leaderboard boards ---------- */
  // Everyone on a board did the same kind of paper: same sections, level, mode, length and answer style
  function boardFor(st) {
    const sorted = [...st.sections].sort();
    const topics = sorted.length === SECTIONS.length ? "all" : sorted.join("+");
    const len = st.len[st.mode];
    const fields = { mode: st.mode, len, level: st.level, style: st.style, topics };
    const lenLabel = st.mode === "sprint" ? (len < 60 ? `${len} sec` : `${len / 60} min`) : `${len} questions`;
    const secLabel = topics === "all" ? "all sections" : sorted.map((id) => secById[id].short).join(" + ");
    const label = `${MODES.find((m) => m[0] === st.mode)[1]} · ${lenLabel} · ${LEVELS[st.level - 1][1]} · ${st.style === "mc" ? "multiple choice" : "typed"} · ${secLabel}`;
    return { key: `${st.mode}-${len}-${st.level}-${st.style}-${topics}`, fields, label };
  }
  const fmtMs = (ms) => { const s = ms / 1000; return s < 60 ? `${s.toFixed(1)}s` : `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, "0")}`; };

  function renderBoard(el, res) {
    if (res.error) {
      el.innerHTML = `<p class="note">${res.error === "not-configured" ? "The leaderboard isn't set up on this copy of the site." : "Couldn't load the leaderboard. Check your connection and reload."}</p>`;
      return -1;
    }
    if (!res.rows.length) { el.innerHTML = `<p class="note">No scores on this board yet. Finish a run to be first.</p>`; return -1; }
    const me = myName.toLowerCase(), set = res.rows[0].mode === "set";
    el.innerHTML = `<table class="lb"><thead><tr><th>#</th><th>Candidate</th><th>Correct</th><th>${set ? "Time" : "Accuracy"}</th></tr></thead><tbody>${res.rows.map((r, i) =>
      `<tr class="${r.name.toLowerCase() === me ? "me" : ""}"><td>${i + 1}</td><td>${escapeHtml(r.name)}</td><td>${r.correct}/${r.total}</td><td>${set ? fmtMs(r.timeMs) : Math.round((100 * r.correct) / Math.max(1, r.total)) + "%"}</td></tr>`).join("")}</tbody></table>`;
    return res.rows.findIndex((r) => r.name.toLowerCase() === me);
  }

  let setupWatch = null, setupKey = "";
  function watchSetupBoard() {
    $("board-block").hidden = !online;
    if (!online) return;
    if (settings.mode === "zen") {
      if (setupWatch) setupWatch(); setupWatch = null; setupKey = "";
      $("board-label").textContent = "";
      $("board").innerHTML = `<p class="note">Zen runs aren't ranked. Pick Sprint or Set to compete.</p>`;
      return;
    }
    const b = boardFor(settings);
    $("board-label").textContent = b.label;
    if (b.key === setupKey) return;
    if (setupWatch) setupWatch();
    setupKey = b.key;
    $("board").innerHTML = `<p class="note">Loading…</p>`;
    setupWatch = LB.watch(b.key, (res) => renderBoard($("board"), res));
  }

  /* ---------- Candidate name ---------- */
  function renderCandidate() {
    const el = $("candidate");
    el.hidden = !online;
    el.innerHTML = myName
      ? `Candidate<b>${escapeHtml(myName)}</b>· <button class="link" id="change-name">change</button>`
      : `Practising without a name · <button class="link" id="change-name">add a name to join the leaderboard</button>`;
    $("change-name").onclick = showName;
  }
  function showName() {
    show("name");
    $("name-input").value = myName;
    $("name-msg").textContent = "";
    $("name-input").focus();
  }
  function toSetup() { show("setup"); renderCandidate(); watchSetupBoard(); watchRatingBoard(); }
  $("name-form").onsubmit = async (e) => {
    e.preventDefault();
    const v = $("name-input").value.trim();
    if (!/^[A-Za-z0-9_]{3,16}$/.test(v)) { $("name-msg").textContent = "Use 3–16 letters, numbers or underscores (no spaces)."; return; }
    $("name-msg").textContent = "Checking the name…";
    $("name-go").disabled = true;
    try {
      myName = await LB.claim(v);
      store.set("name", myName);
      if (pendingDuel) { const next = pendingDuel; pendingDuel = ""; toDuel(next === "lobby" ? "" : next); }
      else toSetup();
    } catch (err) {
      $("name-msg").textContent = err.message === "taken"
        ? `“${v}” is already taken. Try another name.`
        : "Couldn't reach the leaderboard. Check your connection and try again.";
    } finally {
      $("name-go").disabled = false;
    }
  };
  $("name-skip").onclick = () => { pendingDuel = ""; toSetup(); };
  let stats = store.get("stats", {}); // topicId -> { n, ok, ms }
  let bests = store.get("bests", {}); // "sprint-120-2" -> score

  /* ---------- Setup screen ---------- */
  const secStats = (sec) => sec.topics.reduce((a, id) => { const t = stats[id]; if (t) { a.n += t.n; a.ok += t.ok; } return a; }, { n: 0, ok: 0 });
  function renderSections() {
    $("topic-grid").innerHTML = SECTIONS.map((sec) => {
      const t = secStats(sec), acc = t.n ? Math.round((100 * t.ok) / t.n) : null, on = settings.sections.includes(sec.id);
      return `<button class="topic sec ${on ? "on" : ""}" data-sec="${sec.id}" aria-pressed="${on}">
        <span class="t-name">${sec.name}</span>${sec.sub ? `<span class="t-sub">${sec.sub}</span>` : ""}
        <span class="t-sample">${sec.sample}</span>${sec.note ? `<span class="t-note">${sec.note}</span>` : ""}
        ${acc !== null ? `<span class="t-acc">${acc}%</span>` : ""}
        <div class="mastery"><i style="width:${acc ?? 0}%"></i></div></button>`;
    }).join("");
    const n = settings.sections.length;
    $("start").disabled = !n;
    $("start-note").textContent = n ? `${n} section${n > 1 ? "s" : ""} selected` : "Pick at least one section";
  }
  $("topic-grid").addEventListener("click", (e) => {
    const b = e.target.closest("[data-sec]"); if (!b) return;
    const id = b.dataset.sec, i = settings.sections.indexOf(id);
    i >= 0 ? settings.sections.splice(i, 1) : settings.sections.push(id);
    const d = i < 0 && secById[id].defaults;
    if (d) { Object.assign(settings, { level: d.level, style: d.style, mode: d.mode }); settings.len[d.mode] = d.len; }
    save(); renderSections(); renderSettings(); watchSetupBoard();
  });

  function seg(el, items, current, onPick) {
    el.innerHTML = items.map(([v, label, sub]) => `<button data-v="${v}" class="${v == current ? "on" : ""}">${label}${sub ? `<small>${sub}</small>` : ""}</button>`).join("");
    el.onclick = (e) => { const b = e.target.closest("button"); if (b) onPick(b.dataset.v); };
  }
  function renderSettings() {
    seg($("seg-level"), LEVELS, settings.level, (v) => { settings.level = +v; save(); renderSettings(); });
    seg($("seg-style"), STYLES, settings.style, (v) => { settings.style = v; save(); renderSettings(); });
    seg($("seg-mode"), MODES, settings.mode, (v) => { settings.mode = v; save(); renderSettings(); });
    const lens = LENS[settings.mode];
    $("len-label").parentElement.hidden = !lens.length;
    $("len-label").textContent = settings.mode === "sprint" ? "5. Time" : "5. Questions";
    if (lens.length) seg($("seg-len"), lens, settings.len[settings.mode], (v) => { settings.len[settings.mode] = +v; save(); renderSettings(); });
    if (!$("setup").hidden) watchSetupBoard();
  }

  function renderHistory() {
    const entries = Object.entries(bests).sort();
    const answered = Object.values(stats).reduce((a, s) => a + s.n, 0);
    $("history-block").hidden = !answered;
    $("history").innerHTML = `<div class="pb"><b>${answered}</b><span>questions answered</span></div>` +
      entries.map(([k, v]) => { const [, t, l, st] = k.split("-"); return `<div class="pb"><b>${v}</b><span>best · ${t < 60 ? t + " sec" : t / 60 + " min"} sprint · ${LEVELS[l - 1][1].toLowerCase()} · ${st === "mc" ? "multiple choice" : "typed"}</span></div>`; }).join("");
  }
  $("reset-stats").onclick = () => {
    if (!confirm("Clear all stats and personal bests?")) return;
    stats = {}; bests = {}; store.set("stats", stats); store.set("bests", bests); renderSections(); renderHistory();
  };

  /* ---------- Session ---------- */
  let S = null, tick = null, resWatch = null;

  const show = (id) => {
    ["name", "setup", "duel-lobby", "drill", "results"].forEach((v) => ($(v).hidden = v !== id));
    $("made-by").hidden = id === "drill";
    if (id !== "results" && resWatch) { resWatch(); resWatch = null; }
    if (id === "setup" || id === "name") duelStop();
  };

  function start(queue = null, duel = null) {
    S = {
      board: !queue && settings.mode !== "zen" ? boardFor(settings) : null, mode: queue ? "set" : settings.mode,
      level: duel ? duel.level : settings.level, style: duel ? duel.style : settings.style, len: queue ? queue.length : settings.len[settings.mode],
      queue, duel, penaltyMs: 0, items: [], score: 0, streak: 0, best: 0, t0: performance.now(), cur: null, waiting: false, lastKey: "" };
    show("drill");
    $("duel-live").hidden = !duel;
    clearInterval(tick); tick = setInterval(updateClock, 200);
    next();
  }

  // Pick a section first, then a question type inside it, so big sections don't crowd out small ones
  function pickQuestion(sections, level, lastKey) {
    for (let tries = 0; tries < 20; tries++) {
      const sec = secById[H.pick(sections)];
      const pool = level === 1 && sec.easy ? sec.easy : sec.topics;
      const q = byId[H.pick(pool)].gen(level);
      if (q.key !== lastKey) return q;
    }
    return byId[secById[sections[0]].topics[0]].gen(level);
  }
  const generate = () => pickQuestion(settings.sections, S.level, S.lastKey);

  // A duel's whole paper is generated up front from the shared seed, then the RNG is handed
  // back to Math.random. Generating lazily would let MC.build's own shuffling interleave and
  // pull the two players' question streams apart.
  function buildQueue(seed, sections, level, n) {
    H.seed(seed);
    try {
      const out = [];
      let lastKey = "";
      for (let i = 0; i < n; i++) {
        const q = pickQuestion(sections, level, lastKey);
        lastKey = q.key;
        out.push(q);
      }
      return out;
    } finally {
      H.unseed(); // even if a generator throws, solo drills must stay random
    }
  }

  function next() {
    if (S.mode === "set" && S.items.length >= S.len) return finish(true);
    const q = S.queue ? S.queue[S.items.length] : generate();
    S.cur = { ...q, t: performance.now() }; S.lastKey = q.key; S.waiting = false;
    $("qnum").textContent = "Q" + (S.items.length + 1);
    $("qtopic").textContent = `${byId[q.topic].group} · ${byId[q.topic].name}`;
    const qt = $("qtext"); qt.innerHTML = q.text; qt.style.animation = "none"; qt.offsetWidth; qt.style.animation = "";
    $("format").textContent = q.format;
    $("feedback").hidden = true; $("mark").textContent = ""; $("mark").className = "mark";
    $("drill").classList.toggle("mc", S.style === "mc");
    S.cur.options = S.style === "mc" ? MC.build(q) : null;
    if (S.cur.options) {
      $("choices").innerHTML = S.cur.options.map((o, i) =>
        `<button type="button" data-i="${i}"><span class="ck">${"ABCD"[i]}</span><span class="cv">${o.html}</span></button>`).join("");
      if (document.activeElement) document.activeElement.blur();
    } else {
      $("answer").value = ""; $("answer").readOnly = false; $("answer").focus();
    }
    updateClock();
  }

  function check(q, raw) {
    const a = q.answer, s = raw.trim().toLowerCase();
    if (a.type === "rem") {
      const m = s.match(/^(\d+)\s*(?:r|rem|remainder)\s*(\d+)$/);
      if (m) return { ok: +m[1] === a.q && +m[2] === a.r };
    }
    const p = Q.parse(raw);
    if (!p) return { ok: false, invalid: true };
    if (!Q.eq(p.value, a.value)) return { ok: false };
    if (a.lowest && p.form === "frac" && Q.gcd(p.raw[0], p.raw[1]) !== 1) return { ok: false, note: "Equal, but not in lowest terms." };
    if (p.form === "frac" && Q.gcd(p.raw[0], p.raw[1]) !== 1) return { ok: true, note: `Correct — simplifies to ${Q.toString(p.value)}` };
    return { ok: true };
  }

  function submit(skipped = false) {
    if (!S) return;
    if (S.waiting) return next();
    const mcMode = S.style === "mc";
    if (mcMode && !skipped) return;
    const raw = mcMode ? "" : $("answer").value;
    if (!skipped && !raw.trim()) return;
    const res = skipped ? { ok: false } : check(S.cur, raw);
    if (res.invalid) { flash(); $("format").textContent = "Couldn't read that — " + S.cur.format; return; }
    record(res.ok, skipped ? "—" : raw, false, res.note);
  }

  function choose(i) {
    if (!S || S.waiting || !S.cur.options) return;
    const o = S.cur.options[i];
    if (!o) return;
    if (!o.correct) $("choices").children[i].classList.add("wrong");
    record(o.correct, o.html, true);
  }

  // Log the attempt, update score and stats, then show feedback or move on
  function record(ok, raw, isHtml, note) {
    const cur = S.cur, ms = performance.now() - cur.t;
    S.items.push({ q: cur, raw, isHtml, ok, ms });
    const st = (stats[cur.topic] ||= { n: 0, ok: 0, ms: 0 });
    st.n++; st.ms += ms; if (ok) st.ok++;
    store.set("stats", stats);
    S.waiting = true;
    $("answer").readOnly = true;
    if (cur.options) [...$("choices").children].forEach((b, j) => { b.disabled = true; if (cur.options[j].correct) b.classList.add("right"); });
    const advance = (delay) => setTimeout(() => S && S.cur === cur && next(), delay);
    if (ok) {
      S.score++; S.streak++; S.best = Math.max(S.best, S.streak);
      $("mark").textContent = "✓"; $("mark").className = "mark ok";
      if (note) { feedback(note, "", true); advance(900); } else advance(cur.options ? 350 : 180);
    } else {
      S.streak = 0;
      if (raw !== "—") Sound.wrong(); // wrong answers only, not skips
      $("mark").textContent = "✗"; $("mark").className = "mark bad";
      if (!cur.options) flash();
      if (S.duel) {
        // A race can't wait on a button press: take the penalty, show the answer, move on
        S.penaltyMs += DUEL.PENALTY_MS;
        feedback(`Answer: <b>${cur.show}</b> <span class="pen">+${DUEL.PENALTY_MS / 1000}s</span>`, cur.hint, true);
        advance(900);
      } else {
        feedback(`${note ? note + " " : ""}Answer: <b>${cur.show}</b>`, cur.hint);
      }
    }
    if (S.duel) pushProgress();
    updateClock();
  }

  const duelMs = (s) => Math.round(performance.now() - s.t0 + s.penaltyMs);
  function pushProgress() {
    DUEL.progress(S.duel.code, S.duel.me, {
      idx: S.items.length, correct: S.score, wrong: S.items.length - S.score,
      elapsedMs: duelMs(S), finished: false,
    });
  }

  function feedback(ans, hint, soft = false) {
    const f = $("feedback");
    f.className = "feedback" + (soft ? " soft" : "");
    f.innerHTML = `<div class="fb-ans">${ans}</div>${hint ? `<div class="fb-hint">${hint}</div>` : ""}${soft ? "" : `<button type="button" class="fb-next" id="fb-next">Next <span class="kbd">Enter</span></button>`}`;
    f.hidden = false;
  }
  function flash() { const f = $("answer-form"); f.classList.remove("shake"); f.offsetWidth; f.classList.add("shake"); }

  function updateClock() {
    if (!S) return;
    const el = (performance.now() - S.t0) / 1000;
    if (S.duel && el * 1000 > DUEL.MAX_MS) return finish(false); // hard cap: nobody waits forever
    let frac, label;
    if (S.mode === "sprint") {
      const left = Math.max(0, S.len - el);
      frac = el / S.len; label = fmt(left);
      $("meter-fill").classList.toggle("low", left < 10);
      if (left <= 0) return finish(true);
    } else if (S.mode === "set") {
      frac = S.items.length / S.len;
      label = `${S.items.length}/${S.len} · ${fmt(S.duel ? el + S.penaltyMs / 1000 : el)}`; // duels show the penalty in the clock
    }
    else { frac = 0; label = fmt(el); }
    $("meter-fill").style.width = Math.min(100, frac * 100) + "%";
    $("clock").textContent = label;
    $("score").textContent = S.score;
    $("streak").textContent = S.streak >= 3 ? `${S.streak}×` : "";
  }
  const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

  // completed: the sprint clock ran out or every question in the set was answered
  function finish(completed = false) {
    clearInterval(tick);
    const s = S; S = null;
    const n = s.items.length, ok = s.score, time = (performance.now() - s.t0) / 1000;
    const avg = n ? s.items.reduce((a, i) => a + i.ms, 0) / n / 1000 : 0;
    let pb = false;
    if (s.mode === "sprint" && !s.queue) {
      const k = `sprint-${s.len}-${s.level}-${s.style}`;
      if (ok > (bests[k] || 0)) { pb = !!bests[k] || ok > 0; bests[k] = ok; store.set("bests", bests); }
    }
    $("res-kicker").textContent = `${MODES.find((m) => m[0] === s.mode)[1]} · ${LEVELS[s.level - 1][1]} · ${fmt(time)}`;
    const acc = n ? Math.round((100 * ok) / n) : 0;
    $("res-title").innerHTML = pb ? `New best: <span style="color:var(--red)">${ok}</span>` : n === 0 ? "Nothing answered" : acc === 100 ? "Full marks." : acc >= 80 ? "Solid." : acc >= 50 ? "Getting there." : "Keep drilling.";
    $("res-stats").innerHTML = [[`${ok}/${n}`, "correct"], [`${acc}%`, "accuracy"], [`${avg.toFixed(1)}s`, "per question"], [s.best, "best streak"]]
      .map(([b, l]) => `<div><b>${b}</b><span>${l}</span></div>`).join("");

    const per = {};
    s.items.forEach((i) => { const p = (per[i.q.topic] ||= { n: 0, ok: 0, ms: 0 }); p.n++; p.ms += i.ms; if (i.ok) p.ok++; });
    $("res-topics").innerHTML = Object.entries(per).sort((a, b) => a[1].ok / a[1].n - b[1].ok / b[1].n).map(([id, p]) => {
      const a = Math.round((100 * p.ok) / p.n);
      return `<div class="rt"><span>${byId[id].name}</span><span class="bar"><i class="${a < 50 ? "poor" : a < 80 ? "meh" : ""}" style="width:${a}%"></i></span><span>${p.ok}/${p.n}</span><span>${(p.ms / p.n / 1000).toFixed(1)}s</span></div>`;
    }).join("");

    const wrong = s.items.filter((i) => !i.ok);
    $("res-mistakes-block").hidden = !wrong.length;
    $("res-mistakes").innerHTML = wrong.map((i) => `<li>${i.q.text} = <span class="yours">${i.isHtml ? i.raw : escapeHtml(i.raw)}</span><span class="right">${i.q.show}</span><span class="h">${i.q.hint}</span></li>`).join("");
    $("redo").hidden = !wrong.length;
    $("redo").onclick = () => start(wrong.map((i) => i.q));
    $("again").innerHTML = s.duel ? "New duel" : `Again <span class="kbd">Enter</span>`;
    $("again").onclick = s.duel ? () => toDuel() : () => start();
    show("results");
    renderSections(); renderHistory();
    $("res-duel-block").hidden = !s.duel;
    if (s.duel) return finishDuel(s, completed, ok, n, time);
    showResultBoard(s, completed, ok, n, time);
  }

  async function showResultBoard(s, completed, correct, total, timeS) {
    $("res-board-block").hidden = !online || !s.board;
    if (!online || !s.board) return;
    const msg = $("res-board-msg");
    $("res-board-label").textContent = s.board.label;
    $("res-board").innerHTML = "";
    let posted = false;
    const watchBoard = () => {
      resWatch = LB.watch(s.board.key, (res) => {
        const i = renderBoard($("res-board"), res);
        if (posted && i >= 0) msg.innerHTML = `Score posted. You're <b>#${i + 1}</b> on this board.`;
      });
    };
    if (!myName) { msg.textContent = "Add a name on the start page to get on the leaderboard."; return watchBoard(); }
    if (!completed) { msg.textContent = "Only finished runs are ranked, so this one wasn't posted."; return watchBoard(); }
    msg.textContent = "Posting your score…";
    try {
      const r = await LB.submit(s.board.key, {
        name: myName, ...s.board.fields, correct, total,
        timeMs: s.mode === "sprint" ? s.len * 1000 : Math.round(timeS * 1000),
      });
      posted = r.improved;
      msg.innerHTML = r.improved ? "Score posted."
        : `Not a new best. Your best on this board is still <b>${r.best.correct}/${r.best.total}${r.best.mode === "set" ? ` in ${fmtMs(r.best.timeMs)}` : ""}</b>.`;
    } catch (err) {
      console.error(err);
      msg.textContent = "Couldn't post your score. Check your connection; your result is still saved on this device.";
    }
    if (!$("results").hidden) watchBoard();
  }
  const escapeHtml = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  /* ---------- Duels ---------- */
  // Both players build the same paper locally from the room's seed, then race it. Only
  // progress numbers cross the network — never a question or an answer.
  const duelWatch = { match: null, players: null, timer: null };
  let room = null, pendingDuel = "";

  function duelStop() {
    if (duelWatch.match) duelWatch.match();
    if (duelWatch.players) duelWatch.players();
    if (duelWatch.timer) clearInterval(duelWatch.timer);
    duelWatch.match = duelWatch.players = duelWatch.timer = null;
  }

  function needName(next) {
    pendingDuel = next;
    showName();
    $("name-msg").textContent = "Duels need a name, so your rating can follow you.";
  }

  function toDuel(code = "") {
    duelStop();
    room = null;
    show("duel-lobby");
    $("duel-choose").hidden = false;
    $("duel-room").hidden = true;
    $("duel-join-msg").textContent = "";
    $("duel-setup-note").textContent =
      `${DUEL.N} questions · ${LEVELS[settings.level - 1][1].toLowerCase()} · ${settings.style === "mc" ? "multiple choice" : "typed"} · your chosen sections`;
    renderDuelMe();
    if (code) { $("duel-code-input").value = code; joinCode(code); }
  }

  async function renderDuelMe() {
    if (!myName) { $("duel-me").textContent = "Practising without a name — add one to duel."; return; }
    $("duel-me").innerHTML = `Candidate<b>${escapeHtml(myName)}</b>`;
    try {
      const r = await DUEL.ratingOf(myName);
      $("duel-me").innerHTML += `· rating <b>${r.rating}</b> · ${r.wins || 0}W ${r.losses || 0}L`;
    } catch { /* rating is decoration; the lobby still works without it */ }
  }

  function enterRoom(code) {
    duelStop();
    room = { code, started: false };
    $("duel-choose").hidden = true;
    $("duel-room").hidden = false;
    $("duel-code").textContent = code;
    $("duel-copy").textContent = "copy invite link";
    $("duel-versus").innerHTML = "";
    $("duel-status").textContent = "Opening the room…";
    duelWatch.match = DUEL.watch(code, (m, err) => {
      if (err || !m) { $("duel-status").textContent = "Lost contact with the room. Go back and try again."; return; }
      renderVersus(m);
      if (m.state === "live" && m.guestName && room && !room.started) { room.started = true; beginDuel(m, code); }
    });
  }

  function renderVersus(m) {
    const side = (name, rating) => name
      ? `<div class="vs-side"><b>${escapeHtml(name)}</b><span class="note">rating ${rating}</span></div>`
      : `<div class="vs-side"><b>…</b><span class="note">empty seat</span></div>`;
    $("duel-versus").innerHTML = side(m.hostName, m.hostRating) + `<div class="vs-mid">vs</div>` + side(m.guestName, m.guestRating);
    $("duel-status").textContent = m.guestName ? "Both in. Starting…" : "Waiting for an opponent to join…";
  }

  function beginDuel(m, code) {
    const opp = m.hostName.toLowerCase() === myName.toLowerCase() ? m.guestName : m.hostName;
    const sections = (m.sections || []).filter((id) => secById[id]);
    if (!sections.length) { $("duel-status").textContent = "This room uses sections this copy of the site doesn't have."; return; }
    let queue;
    try {
      queue = buildQueue(m.seed, sections, m.level, m.n);
    } catch (e) {
      console.error(e);
      $("duel-status").textContent = "Couldn't build this duel's questions.";
      return;
    }
    const d = { code, me: myName, opp, match: m, level: m.level, style: m.style };
    countdown(3, () => { duelStop(); start(queue, d); watchOpponent(d); });
  }

  function countdown(from, done) {
    const el = $("countdown"), num = $("countdown-n");
    let n = from;
    el.hidden = false;
    const step = () => {
      num.textContent = n > 0 ? n : "Go";
      num.style.animation = "none"; num.offsetWidth; num.style.animation = "";
      if (n > 0) { n--; setTimeout(step, 700); }
      else setTimeout(() => { el.hidden = true; done(); }, 450);
    };
    step();
  }

  function watchOpponent(d) {
    renderOpp(null, d);
    duelWatch.players = DUEL.watchPlayers(d.code, (players) => renderOpp(players[d.opp.toLowerCase()], d));
  }
  function renderOpp(o, d) {
    $("duel-opp-name").textContent = d.opp;
    const idx = o ? o.idx || 0 : 0;
    $("duel-opp-fill").style.width = Math.min(100, (idx / d.match.n) * 100) + "%";
    $("duel-opp-stat").textContent = !o ? "waiting…"
      : o.finished ? `finished · ${fmtMs(o.finalMs || o.elapsedMs || 0)}`
      : `${idx}/${d.match.n} · ${o.correct || 0} ✓`;
  }

  // Report my time, then wait for theirs. If they go quiet for IDLE_MS they forfeit.
  function finishDuel(s, completed, correct, total, timeS) {
    duelStop();
    const d = s.duel, el = $("res-duel");
    const myMs = Math.round(timeS * 1000 + s.penaltyMs);
    const mine = { name: d.me, idx: total, correct, wrong: total - correct, elapsedMs: myMs, finished: completed, finalMs: completed ? myMs : null };
    $("res-kicker").textContent = `Duel · room ${d.code} · vs ${d.opp}`;
    $("res-title").textContent = completed ? "Race run" : "You left the race";
    $("res-duel-label").textContent = `${d.match.n} questions · +${DUEL.PENALTY_MS / 1000}s per miss`;
    el.innerHTML = `<p class="note">Sending your time…</p>`;
    DUEL.progress(d.code, d.me, mine);

    let settled = false, latest = {}, lastSeen = Date.now(), sig = "";
    const done = async (players) => {
      if (settled) return;
      settled = true;
      duelStop();
      el.innerHTML = `<p class="note">Working out the result…</p>`;
      try {
        // My own numbers are authoritative for me: my final write may still be in flight.
        renderDuelResult(await DUEL.settle(d.code, d.match, { ...players, [d.me.toLowerCase()]: mine }), d);
      } catch (e) {
        console.error(e);
        el.innerHTML = `<p class="note">Couldn't record the result. Your run is still saved on this device.</p>`;
      }
    };
    duelWatch.players = DUEL.watchPlayers(d.code, (players) => {
      latest = players;
      const o = players[d.opp.toLowerCase()];
      const now = o ? `${o.idx}|${o.finished}` : "";
      if (now !== sig) { sig = now; lastSeen = Date.now(); }
      if (!settled) {
        el.innerHTML = o && o.finished
          ? `<p class="note">Both finished. Working out the result…</p>`
          : `<p class="note">${completed ? `Your time: <b>${fmtMs(myMs)}</b>. ` : ""}${escapeHtml(d.opp)} is on ${o ? `${o.idx || 0}/${d.match.n}` : "question 1"}…</p>`;
      }
      if (o && o.finished) done(players);
    });
    duelWatch.timer = setInterval(() => {
      if (settled) return;
      if (Date.now() - lastSeen > DUEL.IDLE_MS) done(latest);
    }, 1000);
  }

  function renderDuelResult(r, d) {
    const A = { name: r.a, ms: r.aMs, correct: r.aCorrect, before: r.aBefore, after: r.aAfter };
    const B = { name: r.b, ms: r.bMs, correct: r.bCorrect, before: r.bBefore, after: r.bAfter };
    const iAmA = r.a.toLowerCase() === d.me.toLowerCase();
    const me = iAmA ? A : B, op = iAmA ? B : A;
    const won = r.winner && r.winner.toLowerCase() === d.me.toLowerCase();
    $("res-title").innerHTML = !r.winner ? "Dead heat." : won ? `<span class="win">Won.</span>` : `<span class="lose">Lost.</span>`;
    const row = (p, isMe) => {
      const delta = p.after - p.before;
      return `<div class="vs-row${isMe ? " me" : ""}">
        <span class="vs-who">${escapeHtml(p.name)}${isMe ? " · you" : ""}</span>
        <span class="vs-time">${p.ms == null ? "did not finish" : fmtMs(p.ms)}</span>
        <span class="vs-correct">${p.correct}/${d.match.n} ✓</span>
        <span class="vs-elo">${p.before} → <b>${p.after}</b> <i class="${delta >= 0 ? "up" : "down"}">${delta >= 0 ? "+" : "−"}${Math.abs(delta)}</i></span>
      </div>`;
    };
    $("res-duel").innerHTML = row(me, true) + row(op, false) + `<p class="note" id="res-h2h"></p>`;
    DUEL.headToHead(d.me, d.opp).then((h) => {
      const box = $("res-h2h");
      if (box) box.innerHTML = `Against ${escapeHtml(d.opp)}: <b>${h.a}–${h.b}</b>${h.drawn ? ` (${h.drawn} drawn)` : ""}.`;
    }).catch(() => {});
    renderDuelMe();
  }

  let ratingWatch = null;
  function watchRatingBoard() {
    $("rating-block").hidden = !online;
    $("to-duel").hidden = !online;
    if (!online || ratingWatch) return;
    $("rating-board").innerHTML = `<p class="note">Loading…</p>`;
    ratingWatch = DUEL.watchRatings((res) => {
      const el = $("rating-board");
      if (res.error) { el.innerHTML = `<p class="note">Couldn't load duel ratings.</p>`; return; }
      if (!res.rows.length) { el.innerHTML = `<p class="note">No duels played yet. Challenge someone.</p>`; return; }
      const me = myName.toLowerCase();
      el.innerHTML = `<table class="lb"><thead><tr><th>#</th><th>Candidate</th><th>Rating</th><th>W–L</th></tr></thead><tbody>${res.rows.map((r, i) =>
        `<tr class="${r.name.toLowerCase() === me ? "me" : ""}"><td>${i + 1}</td><td>${escapeHtml(r.name)}</td><td>${r.rating}</td><td>${r.wins || 0}–${r.losses || 0}</td></tr>`).join("")}</tbody></table>`;
    });
  }

  async function joinCode(raw) {
    const code = String(raw).trim().toUpperCase();
    if (!myName) return needName(code);
    if (!/^[A-Z0-9]{4}$/.test(code)) { $("duel-join-msg").textContent = "Room codes are four letters or numbers."; return; }
    $("duel-join-msg").textContent = "Joining…";
    $("duel-join").disabled = true;
    try {
      await DUEL.join(code, myName);
      enterRoom(code);
    } catch (err) {
      $("duel-join-msg").textContent = {
        "no-match": "No room with that code. Check it and try again.",
        "own-match": "That's your own room — send the code to someone else.",
        full: "That duel has already started.",
      }[err.message] || (err.code === "permission-denied"
        ? "Duels aren't switched on yet: publish the updated firestore.rules in the Firebase console."
        : "Couldn't reach the room. Check your connection.");
    } finally {
      $("duel-join").disabled = false;
    }
  }

  $("to-duel").onclick = () => (myName ? toDuel() : needName("lobby"));
  $("duel-back").onclick = toSetup;
  $("duel-cancel").onclick = toSetup;
  $("duel-join-form").onsubmit = (e) => { e.preventDefault(); joinCode($("duel-code-input").value); };
  $("duel-create").onclick = async () => {
    if (!myName) return needName("lobby");
    if (!settings.sections.length) { $("duel-setup-note").textContent = "Pick at least one section on the start page first."; return; }
    $("duel-create").disabled = true;
    $("duel-setup-note").textContent = "Creating a room…";
    try {
      enterRoom(await DUEL.create({ name: myName, sections: [...settings.sections], level: settings.level, style: settings.style }));
    } catch (e) {
      console.error(e);
      $("duel-setup-note").textContent = e.code === "permission-denied"
        ? "Duels aren't switched on yet: publish the updated firestore.rules in the Firebase console."
        : "Couldn't create a room. Check your connection and try again.";
    } finally {
      $("duel-create").disabled = false;
    }
  };
  $("duel-copy").onclick = async () => {
    if (!room) return;
    const url = `${location.origin}${location.pathname}?duel=${room.code}`;
    try {
      await navigator.clipboard.writeText(url);
      $("duel-copy").textContent = "link copied";
      setTimeout(() => ($("duel-copy").textContent = "copy invite link"), 1600);
    } catch {
      prompt("Copy this invite link:", url);
    }
  };

  /* ---------- Wiring ---------- */
  $("start").onclick = () => settings.sections.length && start();
  const renderSound = () => {
    $("sound-toggle").textContent = Sound.isOn() ? "sound on" : "sound off";
    $("sound-toggle").setAttribute("aria-pressed", Sound.isOn());
  };
  $("sound-toggle").onclick = () => {
    Sound.toggle(); renderSound();
    if (S && !S.cur.options && !S.waiting) $("answer").focus(); // keep typing mode typing
  };
  renderSound();
  $("again").onclick = () => start();
  $("back").onclick = toSetup;
  $("quit").onclick = () => S && (S.items.length ? finish() : (clearInterval(tick), (S = null), toSetup()));
  // iOS number keypads have no Enter key, so typed mode needs on-screen Check and Skip
  $("answer-actions").addEventListener("mousedown", (e) => e.target.closest("button") && e.preventDefault());
  $("check").onclick = () => { submit(); $("answer").focus(); };
  $("skip-inline").onclick = () => { S && S.waiting ? next() : submit(true); $("answer").focus(); };
  $("answer-form").onsubmit = (e) => { e.preventDefault(); submit(); };
  // Typed mode: accept a correct answer the moment it's typed; wrong answers still need Enter
  $("answer").addEventListener("input", () => {
    if (!S || S.waiting || S.cur.options) return;
    const raw = $("answer").value;
    if (raw.trim() && check(S.cur, raw).ok) submit();
  });
  $("choices").addEventListener("click", (e) => { const b = e.target.closest("button[data-i]"); if (b) choose(+b.dataset.i); });
  $("feedback").addEventListener("click", (e) => { if (e.target.closest("#fb-next") && S && S.waiting) next(); });
  // Keep focus (and the phone keyboard) on the answer box when tapping helper keys
  $("keys").addEventListener("mousedown", (e) => e.target.closest("button") && e.preventDefault());
  $("keys").addEventListener("click", (e) => {
    const k = e.target.closest("[data-k]"); if (!k || !S || S.waiting) return;
    const inp = $("answer"); inp.value += k.dataset.k; inp.focus();
  });
  document.addEventListener("keydown", (e) => {
    if (!$("drill").hidden) {
      if (e.key === "Escape") { e.preventDefault(); S && S.waiting ? next() : submit(true); }
      else if (S && S.style === "mc") {
        if (e.key === "Enter") { e.preventDefault(); if (S.waiting) next(); }
        else if (e.key.length === 1 && !e.metaKey && !e.ctrlKey) {
          const i = Math.max("1234".indexOf(e.key), "abcd".indexOf(e.key.toLowerCase()));
          if (i >= 0) choose(i);
        }
      }
      return;
    }
    if (e.key === "Enter" && document.activeElement.tagName !== "BUTTON") {
      if (!$("setup").hidden && settings.sections.length) start();
      else if (!$("results").hidden) $("again").click(); // solo run, or a fresh duel
    }
  });

  renderSections(); renderSettings(); renderHistory();
  // An invite link (?duel=K7Q2) drops you straight into that room, once there's a name
  const linkCode = (new URLSearchParams(location.search).get("duel") || "").trim().toUpperCase();
  // Step 1: ask for a name before anything else when the leaderboard is available
  if (online && !myName) (linkCode ? needName(linkCode) : showName());
  else if (online && linkCode) toDuel(linkCode);
  else toSetup();
})();
