#!/usr/bin/env python3
"""Independently verify generated crossword grids.

Deliberately does NOT import the generator: it re-derives everything from the
emitted data, so a bug in the packer cannot vouch for itself.
"""
import json
import re
import sys
from collections import defaultdict

raw = open(sys.argv[1]).read()
# Anchor on the assignment, not the first "[" — the header comment documents
# the entry shape and contains brackets of its own.
body = raw.split("window.CROSSWORDS =", 1)[1]
data = json.loads(body[body.index("["): body.rindex("]") + 1])

fail = 0


def bad(p, msg):
    global fail
    fail += 1
    print(f"  FAIL puzzle {p}: {msg}")


for pi, pz in enumerate(data, 1):
    h, w, entries = pz["h"], pz["w"], pz["entries"]
    cells = {}
    for e in entries:
        a, r, x, d = e["a"], e["r"], e["x"], e["d"]
        if not a.isalpha() or not a.isupper():
            bad(pi, f"{a} is not plain uppercase letters")
        dr, dc = (0, 1) if d == "A" else (1, 0)
        for i, ch in enumerate(a):
            rr, cc = r + dr * i, x + dc * i
            if not (0 <= rr < h and 0 <= cc < w):
                bad(pi, f"{a} runs outside the {h}x{w} grid at ({rr},{cc})")
                break
            if rr in range(h) and (rr, cc) in cells and cells[(rr, cc)] != ch:
                bad(pi, f"{a} conflicts at ({rr},{cc}): "
                        f"{cells[(rr,cc)]} vs {ch}")
            cells[(rr, cc)] = ch

    # No answer may sit immediately before/after another in its own direction,
    # which would read as one longer un-clued word.
    for e in entries:
        a, r, x, d = e["a"], e["r"], e["x"], e["d"]
        dr, dc = (0, 1) if d == "A" else (1, 0)
        before = (r - dr, x - dc)
        after = (r + dr * len(a), x + dc * len(a))
        if before in cells:
            bad(pi, f"{a} is preceded by a letter at {before}")
        if after in cells:
            bad(pi, f"{a} is followed by a letter at {after}")

    # Every maximal run of 2+ letters must be a clued answer, or the grid shows
    # a word the player is asked to spell with no clue for it.
    clued = {(e["r"], e["x"], e["d"]) for e in entries}
    for r in range(h):
        c = 0
        while c < w:
            if (r, c) in cells:
                s = c
                while (r, c) in cells:
                    c += 1
                if c - s >= 2 and (r, s, "A") not in clued:
                    run = "".join(cells[(r, i)] for i in range(s, c))
                    bad(pi, f"un-clued across run '{run}' at row {r} col {s}")
            else:
                c += 1
    for c in range(w):
        r = 0
        while r < h:
            if (r, c) in cells:
                s = r
                while (r, c) in cells:
                    r += 1
                if r - s >= 2 and (s, c, "D") not in clued:
                    run = "".join(cells[(i, c)] for i in range(s, r))
                    bad(pi, f"un-clued down run '{run}' at row {s} col {c}")
            else:
                r += 1

    # Numbering must match a fresh scan-order pass.
    starts = sorted({(e["r"], e["x"]) for e in entries})
    order = [p for p in sorted(starts, key=lambda p: (p[0], p[1]))]
    expect = {p: i + 1 for i, p in enumerate(order)}
    for e in entries:
        if expect[(e["r"], e["x"])] != e["n"]:
            bad(pi, f"{e['a']} numbered {e['n']}, scan order says "
                    f"{expect[(e['r'], e['x'])]}")

    # The whole thing must be one connected shape, or it is two puzzles.
    if cells:
        seen, stack = set(), [next(iter(cells))]
        while stack:
            cur = stack.pop()
            if cur in seen:
                continue
            seen.add(cur)
            r, c = cur
            for nb in ((r+1, c), (r-1, c), (r, c+1), (r, c-1)):
                if nb in cells and nb not in seen:
                    stack.append(nb)
        if len(seen) != len(cells):
            bad(pi, f"grid is not connected ({len(seen)} of {len(cells)})")

    # Clue hygiene: the site forbids em dashes, and a clue must not contain its
    # own answer.
    for e in entries:
        if "—" in e["c"]:
            bad(pi, f"{e['a']} clue contains an em dash")
        if re.search(re.escape(e["a"]), e["c"], re.I):
            bad(pi, f"{e['a']} clue gives away the answer: {e['c']}")

    dens = len(cells) / (h * w)
    cross = sum(1 for v in defaultdict(int, {
        k: sum(1 for e in entries
               if (e["d"] == "A" and e["r"] == k[0] and e["x"] <= k[1] < e["x"] + len(e["a"]))
               or (e["d"] == "D" and e["x"] == k[1] and e["r"] <= k[0] < e["r"] + len(e["a"])))
        for k in cells}).values() if v > 1)
    print(f"  puzzle {pi}: {len(entries)} answers, {h}x{w}, "
          f"{len(cells)} cells, {cross} crossings, density {dens:.2f}")

print("ALL GRIDS VALID" if not fail else f"{fail} PROBLEM(S)")
sys.exit(1 if fail else 0)
