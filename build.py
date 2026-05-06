#!/usr/bin/env python3
"""Merge per-chapter question JSONs into questions.js for the static site."""

import json, glob, os, sys, datetime, re

CHAPTER_TITLES = {
    1: "Overview",
    2: "Cryptographic Tools",
    3: "User Authentication",
    4: "Access Control",
    5: "Database and Data Center Security",
    6: "Malicious Software",
    7: "Denial-of-Service Attacks",
    8: "Intrusion Detection",
    9: "Firewalls and Intrusion Prevention Systems",
    10: "Buffer Overflow",
    11: "Software Security",
    12: "Operating System Security",
    13: "Cloud and IoT Security",
    14: "IT Security Management and Risk Assessment",
    15: "IT Security Controls, Plans, and Procedures",
    16: "Physical and Infrastructure Security",
    17: "Human Resources Security",
    18: "Security Auditing",
    19: "Legal and Ethical Aspects",
    20: "Symmetric Encryption and Message Confidentiality",
    21: "Public-Key Cryptography and Message Authentication",
    22: "Internet Security Protocols and Standards",
    23: "Internet Authentication Applications",
    24: "Wireless Network Security",
}


def normalize(q, ch):
    stem = q.get("stem") or q.get("question")
    choices = q.get("choices") or q.get("options")
    correct = q.get("correct")
    if correct is None:
        ans = q.get("answer")
        if isinstance(ans, int):
            correct = ans
        elif isinstance(ans, str):
            s = ans.strip()
            if len(s) == 1 and s.upper() in "ABCD":
                correct = "ABCD".index(s.upper())
            else:
                matches = [i for i, c in enumerate(choices) if c.strip() == s]
                if not matches:
                    matches = [i for i, c in enumerate(choices) if s in c or c in s]
                if not matches:
                    raise ValueError(f"Cannot map answer {s!r} in {q.get('id')}")
                correct = matches[0]
    explanation = q.get("explanation", "")
    qid = q.get("id") or f"ch{ch}-q{q.get('n', '??')}"
    if not (isinstance(correct, int) and 0 <= correct <= 3):
        raise ValueError(f"Bad correct index in {qid}: {correct!r}")
    if not (isinstance(choices, list) and len(choices) == 4):
        raise ValueError(f"Bad choices in {qid}")
    if not stem:
        raise ValueError(f"Missing stem in {qid}")
    return {
        "id": qid,
        "stem": stem,
        "choices": choices,
        "correct": correct,
        "explanation": explanation,
    }


def main():
    here = os.path.dirname(os.path.abspath(__file__))
    files = sorted(glob.glob(os.path.join(here, "questions", "ch*.json")))
    chapters = []
    all_ids = []
    for f in files:
        d = json.load(open(f))
        ch = d["chapter"]
        title = d.get("title") or CHAPTER_TITLES.get(ch, "")
        questions = [normalize(q, ch) for q in d["questions"]]
        for q in questions:
            all_ids.append(q["id"])
        chapters.append({"chapter": ch, "title": title, "questions": questions})
    chapters.sort(key=lambda c: c["chapter"])

    dupes = {i for i in all_ids if all_ids.count(i) > 1}
    if dupes:
        print("Duplicate IDs:", dupes, file=sys.stderr)
        sys.exit(1)

    payload = {
        "version": 1,
        "generated_at": datetime.datetime.utcnow().isoformat() + "Z",
        "chapters": chapters,
    }
    out_json = os.path.join(here, "questions.json")
    out_js = os.path.join(here, "questions.js")
    with open(out_json, "w") as fp:
        json.dump(payload, fp, indent=2)
    with open(out_js, "w") as fp:
        fp.write("window.QUESTIONS = ")
        json.dump(payload, fp)
        fp.write(";\n")
    print(f"Built {len(chapters)} chapters, {len(all_ids)} questions")
    print(f"  -> {out_json}")
    print(f"  -> {out_js}")


if __name__ == "__main__":
    main()
