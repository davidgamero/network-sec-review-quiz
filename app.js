(function () {
  "use strict";

  const STORAGE_KEY = "csec-quiz-v1";
  const DATA = window.QUESTIONS;
  if (!DATA) {
    document.getElementById("app").innerHTML =
      "<p>Failed to load questions.js. Run <code>python3 build.py</code> first.</p>";
    return;
  }

  const chaptersById = new Map(DATA.chapters.map((c) => [c.chapter, c]));
  const questionsById = new Map();
  for (const c of DATA.chapters) for (const q of c.questions) questionsById.set(q.id, q);
  document.getElementById("q-count").textContent = questionsById.size;

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
  function chapterScore(ch) {
    let total = 0;
    let attempted = 0;
    for (const q of ch.questions) {
      const sc = questionScore(q.id);
      if (sc !== null) attempted++;
      total += sc === null ? 0 : sc;
    }
    return {
      score: total / ch.questions.length,
      attempted,
      total: ch.questions.length,
    };
  }
  function overallScore() {
    let total = 0;
    let attempted = 0;
    let totalQs = 0;
    for (const ch of DATA.chapters) {
      for (const q of ch.questions) {
        totalQs++;
        const sc = questionScore(q.id);
        if (sc !== null) {
          attempted++;
          total += sc;
        }
      }
    }
    return { score: total / totalQs, attempted, total: totalQs };
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
    const overall = overallScore();
    const rows = DATA.chapters
      .map((ch) => {
        const s = chapterScore(ch);
        const barWidth = pct(s.score);
        return `<a class="chapter-card" href="#/chapter/${ch.chapter}">
          <div class="ch-title">
            <div class="ch-num">Chapter ${ch.chapter}</div>
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
      <div class="chapter-list">${rows}</div>
    `;
  }

  function renderChapter(ch) {
    const s = chapterScore(ch);
    const state = loadState();
    state.lastChapter = ch.chapter;
    saveState(state);
    const wrongCount = ch.questions.filter((q) => {
      const sc = questionScore(q.id);
      return sc !== null && sc < 1;
    }).length;
    const items = ch.questions
      .map((q) => {
        const arr = (state.attempts[q.id] || []);
        const dots = [0, 1]
          .map((i) => {
            const v = arr[i];
            if (v === undefined) return '<span class="dot empty"></span>';
            return `<span class="dot ${v ? "good" : "bad"}"></span>`;
          })
          .join("");
        return `<li>
          <span class="qid">${q.id}</span>
          <span class="qstem">${escapeHtml(q.stem)}</span>
          <span class="qstats">${dots}</span>
        </li>`;
      })
      .join("");
    app.innerHTML = `
      <a href="#/" class="back">&larr; All chapters</a>
      <h1>Chapter ${ch.chapter}: ${escapeHtml(ch.title)}</h1>
      <div class="summary-row">
        <div class="stat"><div class="stat-label">Score</div><div class="stat-val">${pct(s.score)}</div></div>
        <div class="stat"><div class="stat-label">Attempted</div><div class="stat-val">${s.attempted}/${s.total}</div></div>
        <div class="stat"><div class="stat-label">Need work</div><div class="stat-val">${wrongCount}</div></div>
      </div>
      <div>
        <button class="btn" data-action="quiz-all">Start quiz (${ch.questions.length})</button>
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
      saveState(st);
      route();
    };
  }

  let quizSession = null;

  function renderQuiz(ch, mode) {
    let pool = ch.questions.slice();
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
    app.innerHTML = `
      <a href="#/chapter/${sess.ch.chapter}" class="back">&larr; Exit quiz</a>
      <div class="q-card">
        <div class="q-meta">${q.id} &middot; Chapter ${sess.ch.chapter}</div>
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
    app.innerHTML = `
      <a href="#/chapter/${sess.ch.chapter}" class="back">&larr; Back to chapter</a>
      <div class="summary-card">
        <h1>Quiz complete</h1>
        <div class="muted">Chapter ${sess.ch.chapter}: ${escapeHtml(sess.ch.title)}</div>
        <div class="big-score ${cls}">${correct}/${total}</div>
        <div class="muted">${pct(score)}</div>
        <div style="margin-top:18px">
          <button class="btn" id="again-btn">Quiz again</button>
          <button class="btn secondary" id="back-btn">Back to chapter</button>
        </div>
      </div>
      ${wrongList ? `<h2 style="margin-top:24px;margin-bottom:8px;">Missed (${total - correct})</h2><ul class="q-list">${wrongList}</ul>` : ""}
    `;
    document.getElementById("again-btn").onclick = () => {
      renderQuiz(sess.ch, sess.mode);
    };
    document.getElementById("back-btn").onclick = () => {
      location.hash = `#/chapter/${sess.ch.chapter}`;
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
