#!/usr/bin/env python3
"""
Freeform crossword generator for wearefeminismm.

Packs answers into an interlocking grid, scores the result, and emits the best
puzzles as a JS data file. Freeform (not symmetric American style) because the
answer set is fixed vocabulary from the site rather than a filler dictionary,
so demanding symmetry would mean inventing words the site never taught.

Run:  python3 gen_crossword.py words.json out.js
"""

import json
import random
import sys
from collections import defaultdict

GRID = 13          # max grid extent we allow while packing
TARGET_WORDS = 11  # aim per puzzle
ATTEMPTS = 4000    # random restarts per puzzle
PUZZLES = 8        # how many distinct puzzles to emit


class Grid:
    def __init__(self):
        self.cells = {}          # (r, c) -> letter
        self.placed = []         # list of (answer, r, c, dir)
        self.used = set()

    def clone(self):
        g = Grid()
        g.cells = dict(self.cells)
        g.placed = list(self.placed)
        g.used = set(self.used)
        return g

    def fits(self, word, r, c, d):
        """Can `word` go at (r,c) running d='A' (across) or 'D' (down)?"""
        dr, dc = (0, 1) if d == "A" else (1, 0)
        n = len(word)

        # The cell immediately before and after the word must be empty, or we
        # would silently extend a neighbouring answer into a longer non-word.
        before = (r - dr, c - dc)
        after = (r + dr * n, c + dc * n)
        if before in self.cells or after in self.cells:
            return None

        crossings = 0
        for i, ch in enumerate(word):
            rr, cc = r + dr * i, c + dc * i
            cur = self.cells.get((rr, cc))
            if cur is not None:
                if cur != ch:
                    return None
                crossings += 1
                continue
            # A brand-new cell must not touch anything on its flanks, or two
            # words end up running side by side spelling nonsense across.
            if d == "A":
                if (rr - 1, cc) in self.cells or (rr + 1, cc) in self.cells:
                    return None
            else:
                if (rr, cc - 1) in self.cells or (rr, cc + 1) in self.cells:
                    return None
        if crossings == 0 and self.cells:
            return None  # every word after the first must interlock
        return crossings

    def place(self, word, r, c, d):
        dr, dc = (0, 1) if d == "A" else (1, 0)
        for i, ch in enumerate(word):
            self.cells[(r + dr * i, c + dc * i)] = ch
        self.placed.append((word, r, c, d))
        self.used.add(word)

    def extent(self):
        if not self.cells:
            return 0, 0
        rs = [p[0] for p in self.cells]
        cs = [p[1] for p in self.cells]
        return max(rs) - min(rs) + 1, max(cs) - min(cs) + 1

    def score(self):
        """Prefer many words, many crossings, and a compact near-square box."""
        h, w = self.extent()
        if h == 0:
            return -1e9
        area = h * w
        crossings = 0
        seen = defaultdict(int)
        for word, r, c, d in self.placed:
            dr, dc = (0, 1) if d == "A" else (1, 0)
            for i in range(len(word)):
                seen[(r + dr * i, c + dc * i)] += 1
        crossings = sum(1 for v in seen.values() if v > 1)
        density = len(self.cells) / area
        squareness = min(h, w) / max(h, w)
        return (len(self.placed) * 100) + (crossings * 45) + (density * 120) + (squareness * 60)


def build(words, rng):
    """One random packing attempt."""
    pool = list(words)
    rng.shuffle(pool)
    # Long words first give the grid a spine to hang everything else off.
    pool.sort(key=lambda w: -len(w))
    # ...but jitter the head so repeated attempts don't all start identically.
    head = pool[: min(4, len(pool))]
    rng.shuffle(head)
    pool[: len(head)] = head

    g = Grid()
    g.place(pool[0], 0, 0, "A")

    for word in pool[1:]:
        if len(g.placed) >= TARGET_WORDS:
            break
        if word in g.used:
            continue
        best = None
        for pword, pr, pc, pd in g.placed:
            pdr, pdc = (0, 1) if pd == "A" else (1, 0)
            nd = "D" if pd == "A" else "A"
            ndr, ndc = (0, 1) if nd == "A" else (1, 0)
            for i, pch in enumerate(pword):
                for j, nch in enumerate(word):
                    if pch != nch:
                        continue
                    ar, ac = pr + pdr * i, pc + pdc * i
                    r, c = ar - ndr * j, ac - ndc * j
                    cross = g.fits(word, r, c, nd)
                    if cross is None:
                        continue
                    trial = g.clone()
                    trial.place(word, r, c, nd)
                    h, w = trial.extent()
                    if h > GRID or w > GRID:
                        continue
                    s = trial.score()
                    if best is None or s > best[0]:
                        best = (s, r, c, nd)
        if best:
            g.place(word, best[1], best[2], best[3])
    return g


def normalize(g):
    """Shift to origin and emit a dense description."""
    rs = [p[0] for p in g.cells]
    cs = [p[1] for p in g.cells]
    r0, c0 = min(rs), min(cs)
    h, w = g.extent()

    placed = [(word, r - r0, c - c0, d) for word, r, c, d in g.placed]
    # Number cells the way a crossword does: scan order, a number wherever an
    # answer starts.
    starts = {}
    for word, r, c, d in placed:
        starts.setdefault((r, c), []).append((d, word))
    num = {}
    n = 1
    for r in range(h):
        for c in range(w):
            if (r, c) in starts:
                num[(r, c)] = n
                n += 1

    entries = []
    for word, r, c, d in placed:
        # NOTE: column is "x", not "c". "c" is the clue, and naming both the
        # same silently overwrote every column with a sentence.
        entries.append({"a": word, "r": r, "x": c, "d": d, "n": num[(r, c)]})
    entries.sort(key=lambda e: (e["n"], e["d"]))
    return {"h": h, "w": w, "entries": entries}


def main():
    src, dst = sys.argv[1], sys.argv[2]
    data = json.load(open(src))

    # Dedupe by answer, keep the first (best-ranked) clue for each.
    byword = {}
    for e in data:
        a = e["a"].strip().upper()
        if not a.isalpha() or not (3 <= len(a) <= 11):
            continue
        if a not in byword:
            byword[a] = e
    words = list(byword.keys())
    print(f"{len(words)} usable answers", file=sys.stderr)

    puzzles = []
    used_sets = []
    rng = random.Random(20260808)

    for p in range(PUZZLES):
        best = None
        for _ in range(ATTEMPTS):
            g = build(words, rng)
            if len(g.placed) < 6:
                continue
            # Push each puzzle to use different answers from the ones before.
            overlap = max(
                (len(g.used & prev) / max(1, len(g.used)) for prev in used_sets),
                default=0,
            )
            s = g.score() - overlap * 400
            if best is None or s > best[0]:
                best = (s, g)
        if not best:
            break
        g = best[1]
        used_sets.append(set(g.used))
        pz = normalize(g)
        for e in pz["entries"]:
            src_e = byword[e["a"]]
            e["c"] = src_e["c"]
            e["cat"] = src_e.get("cat", "")
        puzzles.append(pz)
        h, w = pz["h"], pz["w"]
        print(f"  puzzle {p+1}: {len(pz['entries'])} answers, {h}x{w}", file=sys.stderr)

    out = json.dumps(puzzles, ensure_ascii=False, indent=0, separators=(",", ":"))
    with open(dst, "w") as f:
        f.write(
            "/* The Crossword — puzzle data.\n"
            "   GENERATED, do not hand-edit. Grids are packed by\n"
            "   tools/gen_crossword.py from answers and clues drawn from this\n"
            "   site's own Learn content, so every answer is something a reader\n"
            "   could have met on the way here.\n\n"
            "   Each puzzle: {h, w, entries:[{a,c,r,x,d,n,cat}]} where a is the\n"
            "   answer, c the clue, r/x the zero-based row and column of its\n"
            "   first letter, d is 'A'cross or 'D'own, and n the printed number. */\n"
            "window.CROSSWORDS = "
        )
        f.write(out)
        f.write(";\n")
    print(f"wrote {dst}", file=sys.stderr)


if __name__ == "__main__":
    main()
