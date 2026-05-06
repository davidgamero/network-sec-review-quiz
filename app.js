(function () {
  "use strict";

  const STORAGE_KEY = "csec-quiz-v1";
  const DIFFICULTY_KEY = "csec-difficulty";
  const DATA = window.QUESTIONS;
  if (!DATA) {
    document.getElementById("app").innerHTML =
      "<p>Failed to load questions.js. Run <code>python3 build.py</code> first.</p>";
    return;
  }

  for (const c of DATA.chapters) {
    if (!c.hardQuestions) c.hardQuestions = [];
  }

  const chaptersById = new Map(DATA.chapters.map((c) => [c.chapter, c]));
  const questionsById = new Map();
  for (const c of DATA.chapters) {
    for (const q of c.questions) questionsById.set(q.id, q);
    for (const q of c.hardQuestions) questionsById.set(q.id, q);
  }
  const totalQs =
    DATA.chapters.reduce((n, c) => n + c.questions.length + c.hardQuestions.length, 0);
  document.getElementById("q-count").textContent = totalQs;

  function getDifficulty() {
    const v = localStorage.getItem(DIFFICULTY_KEY);
    return v === "hard" || v === "both" ? v : "normal";
  }
  function setDifficulty(v) {
    localStorage.setItem(DIFFICULTY_KEY, v);
  }
  function chapterPool(ch, difficulty) {
    const d = difficulty || getDifficulty();
    if (d === "hard") return ch.hardQuestions.slice();
    if (d === "both") return ch.questions.concat(ch.hardQuestions);
    return ch.questions.slice();
  }
  function chapterHasHard(ch) {
    return ch.hardQuestions && ch.hardQuestions.length > 0;
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { attempts: {}, lastChapter: null };
      const s = JSON.parse(raw);
      if (!s.attempts) s.attempts = {};
      return s;
    } catch (e) {
      return { attempts: {}, lastChapter: null };
    }
  }
  function saveState(s) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  }
  function recordAttempt(qid, correct) {
    const s = loadState();
    const arr = s.attempts[qid] || [];
    arr.push(correct ? 1 : 0);
    while (arr.length > 2) arr.shift();
    s.attempts[qid] = arr;
    saveState(s);
  }
  function questionScore(qid) {
    const s = loadState();
    const arr = s.attempts[qid];
    if (!arr || arr.length === 0) return null;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  }
  function poolStats(pool) {
    if (pool.length === 0) return { score: 0, attempted: 0, total: 0 };
    let total = 0;
    let attempted = 0;
    for (const q of pool) {
      const sc = questionScore(q.id);
      if (sc !== null) {
        attempted++;
        total += sc;
      }
    }
    return { score: total / pool.length, attempted, total: pool.length };
  }
  function chapterScore(ch, difficulty) {
    return poolStats(chapterPool(ch, difficulty));
  }
  function overallScore(difficulty) {
    let pool = [];
    for (const ch of DATA.chapters) pool = pool.concat(chapterPool(ch, difficulty));
    return poolStats(pool);
  }

  function pct(x) {
    return Math.round(x * 100) + "%";
  }
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  const app = document.getElementById("app");

  function route() {
    const hash = location.hash || "#/";
    const parts = hash.replace(/^#\/?/, "").split("/").filter(Boolean);
    if (parts.length === 0) return renderHome();
    if (parts[0] === "final") return renderFinal(parts[1] || "all");
    if (parts[0] === "chapter" && parts[1]) {
      const ch = chaptersById.get(parseInt(parts[1], 10));
      if (!ch) return renderHome();
      if (parts[2] === "quiz") return renderQuiz(ch, parts[3] || "all");
      return renderChapter(ch);
    }
    renderHome();
  }
  window.addEventListener("hashchange", route);

  function renderHome() {
    const difficulty = getDifficulty();
    const overall = overallScore();
    const finalStats = finalScore();
    const filterPref = localStorage.getItem("csec-filter-final");
    const finalOnly = filterPref === null ? true : filterPref === "1";
    const visible = DATA.chapters.filter(
      (ch) => !finalOnly || (ch.chapter >= 12 && ch.chapter <= 24)
    );
    const totalNormal = DATA.chapters.reduce((n, c) => n + c.questions.length, 0);
    const totalHard = DATA.chapters.reduce((n, c) => n + c.hardQuestions.length, 0);
    const diffLabels = {
      normal: `Normal (${totalNormal})`,
      hard: `Hard (${totalHard})`,
      both: `Both (${totalNormal + totalHard})`,
    };
    const diffOptions = ["normal", "hard", "both"]
      .map(
        (d) =>
          `<button class="diff-btn ${d === difficulty ? "active" : ""}" data-diff="${d}">${diffLabels[d]}</button>`
      )
      .join("");
    const rows = visible
      .map((ch) => {
        const s = chapterScore(ch);
        const barWidth = pct(s.score);
        const hardBadge = chapterHasHard(ch)
          ? `<span class="badge">+${ch.hardQuestions.length} hard</span>`
          : "";
        return `<a class="chapter-card" href="#/chapter/${ch.chapter}">
          <div class="ch-title">
            <div class="ch-num">Chapter ${ch.chapter} ${hardBadge}</div>
            <div class="ch-name">${escapeHtml(ch.title)}</div>
          </div>
          <div class="ch-stats">
            <span class="score-bar"><div style="width:${barWidth}"></div></span>
            <span class="score-num">${pct(s.score)}</span>
            <div class="muted">${s.attempted}/${s.total} attempted</div>
          </div>
        </a>`;
      })
      .join("");
    app.innerHTML = `
      <h1>Choose a chapter</h1>
      <div class="summary-row">
        <div class="stat"><div class="stat-label">Overall</div><div class="stat-val">${pct(overall.score)}</div></div>
        <div class="stat"><div class="stat-label">Attempted</div><div class="stat-val">${overall.attempted}/${overall.total}</div></div>
        <div class="stat"><div class="stat-label">Chapters</div><div class="stat-val">${DATA.chapters.length}</div></div>
      </div>
      <div class="diff-row">
        <span class="diff-label">Difficulty:</span>
        <div class="diff-group">${diffOptions}</div>
      </div>
      <a class="chapter-card final-card" href="#/final">
        <div class="ch-title">
          <div class="ch-num">Final Exam Prep</div>
          <div class="ch-name">Mixed questions from Chapters 12&ndash;24</div>
        </div>
        <div class="ch-stats">
          <span class="score-bar"><div style="width:${pct(finalStats.score)}"></div></span>
          <span class="score-num">${pct(finalStats.score)}</span>
          <div class="muted">${finalStats.attempted}/${finalStats.total} attempted</div>
        </div>
      </a>
      <label class="filter-row">
        <input type="checkbox" id="filter-final" ${finalOnly ? "checked" : ""}>
        Only show final-exam chapters (12&ndash;24)
        <span class="muted">&middot; ${visible.length} of ${DATA.chapters.length} shown</span>
      </label>
      <div class="chapter-list">${rows}</div>
    `;
    document.getElementById("filter-final").onchange = (e) => {
      localStorage.setItem("csec-filter-final", e.target.checked ? "1" : "0");
      renderHome();
    };
    app.querySelectorAll(".diff-btn").forEach((btn) => {
      btn.onclick = () => {
        setDifficulty(btn.dataset.diff);
        renderHome();
      };
    });
  }

  function finalQuestions(difficulty) {
    const out = [];
    for (const ch of DATA.chapters) {
      if (ch.chapter >= 12 && ch.chapter <= 24) {
        for (const q of chapterPool(ch, difficulty)) out.push(q);
      }
    }
    return out;
  }
  function finalScore(difficulty) {
    return poolStats(finalQuestions(difficulty));
  }

  function renderFinal(mode) {
    const difficulty = getDifficulty();
    const all = finalQuestions(difficulty);
    const stats = poolStats(all);
    if (mode === "all" || mode === "wrong" || mode === "sample50") {
      let pool = all.slice();
      if (mode === "wrong") {
        pool = pool.filter((q) => {
          const sc = questionScore(q.id);
          return sc !== null && sc < 1;
        });
      } else if (mode === "sample50") {
        pool = shuffle(pool).slice(0, Math.min(50, pool.length));
      }
      if (pool.length === 0) {
        app.innerHTML = `<a href="#/final" class="back">&larr; Back</a><p>No questions to practice.</p>`;
        return;
      }
      const synthetic = {
        chapter: "Final",
        title: `Final Exam (Ch 12-24, ${difficulty})`,
        questions: pool,
        _isFinal: true,
      };
      quizSession = {
        ch: synthetic,
        mode,
        order: shuffle(pool),
        idx: 0,
        results: [],
      };
      renderQuizCard();
      return;
    }
    const wrongCount = all.filter((q) => {
      const sc = questionScore(q.id);
      return sc !== null && sc < 1;
    }).length;
    app.innerHTML = `
      <a href="#/" class="back">&larr; All chapters</a>
      <h1>Final Exam Prep</h1>
      <p class="muted">Mixed questions from Chapters 12 through 24 (${all.length} total, difficulty: <strong>${difficulty}</strong>). Stats are shared with the per-chapter views.</p>
      <div class="summary-row">
        <div class="stat"><div class="stat-label">Score</div><div class="stat-val">${pct(stats.score)}</div></div>
        <div class="stat"><div class="stat-label">Attempted</div><div class="stat-val">${stats.attempted}/${stats.total}</div></div>
        <div class="stat"><div class="stat-label">Need work</div><div class="stat-val">${wrongCount}</div></div>
      </div>
      <div>
        <button class="btn" data-action="all">Full exam (${all.length})</button>
        <button class="btn secondary" data-action="sample50">Random ${Math.min(50, all.length)}</button>
        <button class="btn secondary" data-action="wrong" ${wrongCount === 0 ? "disabled" : ""}>Practice wrong only (${wrongCount})</button>
      </div>
      <p class="muted" style="margin-top:14px;">Change difficulty (normal/hard/both) on the home screen.</p>
    `;
    app.querySelector('[data-action="all"]').onclick = () => {
      location.hash = "#/final/all";
    };
    app.querySelector('[data-action="sample50"]').onclick = () => {
      location.hash = "#/final/sample50";
    };
    const wb = app.querySelector('[data-action="wrong"]');
    if (wb) wb.onclick = () => { location.hash = "#/final/wrong"; };
  }

  function renderChapter(ch) {
    const difficulty = getDifficulty();
    const pool = chapterPool(ch, difficulty);
    const s = poolStats(pool);
    const state = loadState();
    state.lastChapter = ch.chapter;
    saveState(state);
    const wrongCount = pool.filter((q) => {
      const sc = questionScore(q.id);
      return sc !== null && sc < 1;
    }).length;
    const items = pool
      .map((q) => {
        const arr = (state.attempts[q.id] || []);
        const dots = [0, 1]
          .map((i) => {
            const v = arr[i];
            if (v === undefined) return '<span class="dot empty"></span>';
            return `<span class="dot ${v ? "good" : "bad"}"></span>`;
          })
          .join("");
        const tag = q.difficulty === "hard" ? '<span class="badge hard">hard</span>' : "";
        return `<li>
          <span class="qid">${q.id} ${tag}</span>
          <span class="qstem">${escapeHtml(q.stem)}</span>
          <span class="qstats">${dots}</span>
        </li>`;
      })
      .join("");
    app.innerHTML = `
      <a href="#/" class="back">&larr; All chapters</a>
      <h1>Chapter ${ch.chapter}: ${escapeHtml(ch.title)}</h1>
      <p class="muted">Difficulty: <strong>${difficulty}</strong> &middot; ${pool.length} questions</p>
      <div class="summary-row">
        <div class="stat"><div class="stat-label">Score</div><div class="stat-val">${pct(s.score)}</div></div>
        <div class="stat"><div class="stat-label">Attempted</div><div class="stat-val">${s.attempted}/${s.total}</div></div>
        <div class="stat"><div class="stat-label">Need work</div><div class="stat-val">${wrongCount}</div></div>
      </div>
      <div>
        <button class="btn" data-action="quiz-all" ${pool.length === 0 ? "disabled" : ""}>Start quiz (${pool.length})</button>
        <button class="btn secondary" data-action="quiz-wrong" ${wrongCount === 0 ? "disabled" : ""}>Practice wrong only (${wrongCount})</button>
        <button class="btn secondary" data-action="reset-chapter">Reset chapter stats</button>
      </div>
      <h2 style="margin-top:24px;margin-bottom:8px;">Questions</h2>
      <ul class="q-list">${items}</ul>
    `;
    app.querySelector('[data-action="quiz-all"]').onclick = () => {
      location.hash = `#/chapter/${ch.chapter}/quiz/all`;
    };
    const wrongBtn = app.querySelector('[data-action="quiz-wrong"]');
    if (wrongBtn) wrongBtn.onclick = () => {
      location.hash = `#/chapter/${ch.chapter}/quiz/wrong`;
    };
    app.querySelector('[data-action="reset-chapter"]').onclick = () => {
      if (!confirm(`Reset stats for Chapter ${ch.chapter}?`)) return;
      const st = loadState();
      for (const q of ch.questions) delete st.attempts[q.id];
      for (const q of ch.hardQuestions) delete st.attempts[q.id];
      saveState(st);
      route();
    };
  }

  let quizSession = null;

  function renderQuiz(ch, mode) {
    let pool = chapterPool(ch).slice();
    if (mode === "wrong") {
      pool = pool.filter((q) => {
        const sc = questionScore(q.id);
        return sc !== null && sc < 1;
      });
    }
    if (pool.length === 0) {
      app.innerHTML = `<a href="#/chapter/${ch.chapter}" class="back">&larr; Back</a>
        <p>No questions to practice.</p>`;
      return;
    }
    quizSession = {
      ch,
      mode,
      order: shuffle(pool),
      idx: 0,
      results: [],
    };
    renderQuizCard();
  }

  function renderQuizCard() {
    const sess = quizSession;
    if (!sess) return;
    if (sess.idx >= sess.order.length) return renderQuizSummary();
    const q = sess.order[sess.idx];
    const choices = q.choices
      .map(
        (c, i) =>
          `<div class="choice" data-i="${i}"><span class="key">${i + 1}.</span>${escapeHtml(c)}</div>`
      )
      .join("");
    const backHash = sess.ch._isFinal ? "#/final" : `#/chapter/${sess.ch.chapter}`;
    const metaLabel = sess.ch._isFinal ? "Final Exam" : `Chapter ${sess.ch.chapter}`;
    app.innerHTML = `
      <a href="${backHash}" class="back">&larr; Exit quiz</a>
      <div class="q-card">
        <div class="q-meta">${q.id} &middot; ${metaLabel}</div>
        <div class="q-stem">${escapeHtml(q.stem)}</div>
        <div class="choices">${choices}</div>
        <div class="feedback" id="feedback" style="display:none"></div>
        <div class="controls">
          <button class="btn" id="submit-btn" disabled>Submit</button>
          <button class="btn secondary" id="next-btn" style="display:none">Next</button>
          <span class="progress">${sess.idx + 1} / ${sess.order.length}</span>
        </div>
      </div>
    `;
    let selected = null;
    let locked = false;
    const choiceEls = app.querySelectorAll(".choice");
    const submitBtn = document.getElementById("submit-btn");
    const nextBtn = document.getElementById("next-btn");
    const fb = document.getElementById("feedback");

    function pick(i) {
      if (locked) return;
      selected = i;
      choiceEls.forEach((el, j) => el.classList.toggle("selected", j === i));
      submitBtn.disabled = false;
    }
    function submit() {
      if (locked || selected === null) return;
      locked = true;
      const correct = selected === q.correct;
      recordAttempt(q.id, correct);
      sess.results.push({ qid: q.id, correct });
      choiceEls.forEach((el, j) => {
        el.classList.add("locked");
        el.classList.remove("selected");
        if (j === q.correct) el.classList.add("correct");
        else if (j === selected) el.classList.add("wrong");
      });
      fb.style.display = "block";
      fb.className = "feedback " + (correct ? "correct" : "wrong");
      fb.innerHTML =
        `<div class="label ${correct ? "correct" : "wrong"}">${correct ? "Correct" : "Incorrect"}</div>` +
        (q.explanation ? `<div>${escapeHtml(q.explanation)}</div>` : "");
      submitBtn.style.display = "none";
      nextBtn.style.display = "inline-block";
      nextBtn.focus();
    }
    function next() {
      sess.idx++;
      renderQuizCard();
    }
    choiceEls.forEach((el) => {
      el.onclick = () => pick(parseInt(el.dataset.i, 10));
    });
    submitBtn.onclick = submit;
    nextBtn.onclick = next;
    keyHandler = (e) => {
      if (["1", "2", "3", "4"].includes(e.key)) {
        pick(parseInt(e.key, 10) - 1);
      } else if (e.key === "Enter") {
        if (!locked && selected !== null) submit();
        else if (locked) next();
      }
    };
  }

  function renderQuizSummary() {
    const sess = quizSession;
    const correct = sess.results.filter((r) => r.correct).length;
    const total = sess.results.length;
    const score = correct / total;
    const cls = score >= 0.8 ? "good" : score >= 0.6 ? "warn" : "bad";
    const wrongList = sess.results
      .filter((r) => !r.correct)
      .map((r) => {
        const q = questionsById.get(r.qid);
        return `<li><span class="qid">${r.qid}</span><span class="qstem">${escapeHtml(q.stem)}</span></li>`;
      })
      .join("");
    const backHash = sess.ch._isFinal ? "#/final" : `#/chapter/${sess.ch.chapter}`;
    const heading = sess.ch._isFinal
      ? escapeHtml(sess.ch.title)
      : `Chapter ${sess.ch.chapter}: ${escapeHtml(sess.ch.title)}`;
    app.innerHTML = `
      <a href="${backHash}" class="back">&larr; Back</a>
      <div class="summary-card">
        <h1>Quiz complete</h1>
        <div class="muted">${heading}</div>
        <div class="big-score ${cls}">${correct}/${total}</div>
        <div class="muted">${pct(score)}</div>
        <div style="margin-top:18px">
          <button class="btn" id="again-btn">Quiz again</button>
          <button class="btn secondary" id="back-btn">Back</button>
        </div>
      </div>
      ${wrongList ? `<h2 style="margin-top:24px;margin-bottom:8px;">Missed (${total - correct})</h2><ul class="q-list">${wrongList}</ul>` : ""}
    `;
    document.getElementById("again-btn").onclick = () => {
      if (sess.ch._isFinal) {
        location.hash = `#/final/${sess.mode}`;
      } else {
        renderQuiz(sess.ch, sess.mode);
      }
    };
    document.getElementById("back-btn").onclick = () => {
      location.hash = backHash;
    };
    quizSession = null;
  }

  let keyHandler = null;
  document.addEventListener("keydown", (e) => {
    if (keyHandler) keyHandler(e);
  });

  document.getElementById("reset-all-btn").onclick = () => {
    if (!confirm("Reset ALL stats across every chapter? This cannot be undone.")) return;
    localStorage.removeItem(STORAGE_KEY);
    route();
  };

  route();
})();
