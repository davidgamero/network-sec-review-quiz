# Network Security Review Quiz

Static quiz site for reviewing *Computer Security: Principles and Practice* (Stallings & Brown, 5th Ed.). 24 chapters, 480 multiple-choice questions, with per-question score tracking persisted to `localStorage` (last 2 attempts per question).

**Live:** https://davidgamero.github.io/network-sec-review-quiz/

## Features

- 24 chapters, 20 MCQs each
- Score = mean of last 2 attempts per question; chapter score = mean across all questions (unattempted = 0)
- Practice all questions or only those previously missed
- Reset stats per-chapter or globally
- Keyboard: `1`-`4` to pick, `Enter` to submit / advance
- Pure static: HTML + vanilla JS + CSS, no build step at runtime, works on `file://`

## Run locally

```sh
open index.html
```

## Rebuild question bundle

After editing files in `questions/`:

```sh
python3 build.py
```

This regenerates `questions.json` and `questions.js` (the latter is what `index.html` loads).

## Layout

```
index.html      app shell
style.css       styles
app.js          router + quiz runtime + scoring
questions.js    window.QUESTIONS (built artifact)
questions.json  same data as JSON (built artifact)
build.py        merges questions/ch*.json -> questions.js/json
questions/      per-chapter source files (ch01.json ... ch24.json)
```

## Deploy (GitHub Pages)

Settings -> Pages -> Source: `main` branch, `/ (root)`.
