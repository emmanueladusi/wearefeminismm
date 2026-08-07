#!/usr/bin/env python3
"""Regenerate the <svg class="gtamap-pins"> overlay in community.html.

The pins used to be hand-written markup. This script owns them instead: edit
ORGS below, run it, and paste the result over the existing <svg class=
"gtamap-pins"> ... </svg> in community.html. It reproduced the original
five-pin markup byte for byte, so nothing about the look changed when the
directory grew.

It also checks the two things that are easy to get wrong by hand: that every
pin lands inside the GTA silhouette (the same polygon js/gtamap.js draws its
dot field from), and that no label pill collides with another label or with
another org's house.

  python3 tools/gen-map-pins.py    # prints the checks, writes pins.svg beside it
"""
import math, os
poly = [[110,600],[80,540],[98,455],[105,395],[128,335],[118,298],[175,258],[255,238],
    [330,222],[392,214],[432,258],[462,150],[545,96],[610,132],[628,232],[665,300],
    [770,332],[910,360],[884,420],[795,410],[695,430],[612,452],[556,470],[485,488],
    [400,494],[330,489],[282,479],[232,498],[182,540],[140,578]]

def inside(x, y):
    c, n, j = False, len(poly), len(poly) - 1
    for i in range(n):
        xi, yi = poly[i]; xj, yj = poly[j]
        if ((yi > y) != (yj > y)) and (x < (xj - xi) * (y - yi) / (yj - yi) + xi):
            c = not c
        j = i
    return c

def esc(s):
    return s.replace('&', '&amp;').replace("'", '&#x27;').replace('"', '&quot;')

def rnd(v):
    return int(math.floor(v + 0.5))

def lw(label):
    """Label pill width, in design units, before rounding."""
    return 24 + 8.2 * len(label)

# style A: pitched roof + door.  B: flat roof, 6 windows, door.  C: tower, 8 windows.
def mark(x, y, style):
    o = '<g class="pin__mark" style="transform-origin:%gpx %gpx">' % (x, y)
    if style == 'A':
        o += '<polygon class="pin__house-roof" points="%g,%g %g,%g %g,%g"/>' % (
            x-16, y-4, x, y-20, x+16, y-4)
        o += '<rect class="pin__house-body" x="%g" y="%g" width="24" height="18" rx="1.5"/>' % (x-12, y-4)
        o += '<rect class="pin__house-door" x="%g" y="%g" width="9" height="10" rx="1"/>' % (x-4.5, y+4)
    elif style == 'B':
        o += '<rect class="pin__house-roof" x="%g" y="%g" width="36" height="4" rx="1"/>' % (x-18, y-16)
        o += '<rect class="pin__house-body" x="%g" y="%g" width="32" height="28" rx="1.5"/>' % (x-16, y-12)
        for ry in (y-8, y+1):
            for rx in (x-12, x-3, x+6):
                o += '<rect class="pin__win" x="%g" y="%g" width="5" height="5.5"/>' % (rx, ry)
        o += '<rect class="pin__house-door" x="%g" y="%g" width="8" height="8" rx="1"/>' % (x-4, y+8)
    else:
        o += '<rect class="pin__house-roof" x="%g" y="%g" width="22" height="4" rx="1"/>' % (x-11, y-24)
        o += '<rect class="pin__house-body" x="%g" y="%g" width="18" height="36" rx="1.5"/>' % (x-9, y-20)
        for ry in (y-16, y-8, y, y+8):
            for rx in (x-6, x+1):
                o += '<rect class="pin__win" x="%g" y="%g" width="4.2" height="5"/>' % (rx, ry)
    return o + '</g>'

def arc(pts):
    d = 'M %g %g' % pts[0]
    for i in range(len(pts) - 1):
        p0 = pts[i - 1] if i else pts[0]
        p1, p2 = pts[i], pts[i + 1]
        p3 = pts[i + 2] if i + 2 < len(pts) else p2
        c1 = (p1[0] + (p2[0]-p0[0])/6, p1[1] + (p2[1]-p0[1])/6)
        c2 = (p2[0] - (p3[0]-p1[0])/6, p2[1] - (p3[1]-p1[1])/6)
        d += ' C %.1f %.1f %.1f %.1f %g %g' % (c1[0], c1[1], c2[0], c2[1], p2[0], p2[1])
    return d

def build(orgs):
    pts = [(o['x'], o['y']) for o in orgs]
    out = ('<svg class="gtamap-pins" viewBox="0 0 1000 680" '
           'xmlns="http://www.w3.org/2000/svg" aria-label="%s organizations '
           'across the Greater Toronto Area">' % orgs[0]['count_word'])
    out += '<path class="gtamap__arc" pathLength="1" d="%s" />' % arc(pts)
    out += '<g class="gtamap__pins">'
    for i, o in enumerate(orgs):
        x, y, w = o['x'], o['y'], lw(o['label'])
        out += ('<a class="pin" style="--i:%d" href="%s" target="_blank" '
                'rel="noopener" aria-label="%s">' % (i, o['url'], esc(o['label'])))
        out += '<circle class="pin__hit" cx="%g" cy="%g" r="28"/>' % (x, y)
        out += ('<circle class="pin__ping" cx="%g" cy="%g" r="17" '
                'style="transform-origin:%gpx %gpx"/>' % (x, y, x, y))
        out += mark(x, y, o['style'])
        out += ('<g class="pin__label" transform="translate(%d,%d)">'
                '<rect width="%d" height="24" rx="12"/>'
                '<text x="%d" y="16" text-anchor="middle">%s</text></g>'
                % (rnd(x - w / 2), y - 42, rnd(w), rnd(w / 2), esc(o['label'])))
        out += '</a>'
    return out + '</g></svg>'


ORGS = [
  dict(x=190, y=452, style='A', label="Nia Centre for the Arts",
       url="https://niacentre.org/offerings/for-youth/"),
  dict(x=230, y=368, style='B', label="Elspeth Heyworth Centre",
       url="https://ehcw.ca/"),
  dict(x=315, y=300, style='B', label="YWCA Girls' Centre",
       url="https://www.ywcatoronto.org/ourprograms/girlsprograms/ywcagirlscentre"),
  dict(x=525, y=205, style='A', label="Girls Rock Camp Toronto",
       url="https://www.girlsrocktoronto.org/programs"),
  dict(x=640, y=272, style='C', label="Black Women's Institute",
       url="https://bwhealthinstitute.com/"),
  dict(x=705, y=360, style='C', label="Canada Learning Code",
       url="https://www.canadalearningcode.ca/"),
  dict(x=640, y=425, style='B', label="Black Women in Motion",
       url="https://blackwomeninmotion.org/"),
  dict(x=455, y=440, style='B', label="Help A Girl Out",
       url="https://helpagirlout.org/"),
  dict(x=430, y=335, style='A', label="Black Girls Magazine",
       url="https://www.blackgirlsmagazine.ca/"),
]
for o in ORGS:
    o['count_word'] = 'Nine'

# --- checks -----------------------------------------------------------
bad = [o['label'] for o in ORGS if not inside(o['x'], o['y'])]
print('outside the GTA shape:', bad or 'none')

boxes = []
for o in ORGS:
    w = lw(o['label'])
    boxes.append((o['label'], rnd(o['x'] - w/2), o['y'] - 42, rnd(w), 24))
    # the house mark, as a box
    boxes.append((o['label'] + ' [mark]', o['x'] - 18, o['y'] - 24, 36, 42))
hits = []
for i in range(len(boxes)):
    for j in range(i + 1, len(boxes)):
        a, b = boxes[i], boxes[j]
        if a[0].split(' [')[0] == b[0].split(' [')[0]:
            continue
        if a[1] < b[1] + b[3] and b[1] < a[1] + a[3] and \
           a[2] < b[2] + b[4] and b[2] < a[2] + a[4]:
            hits.append((a[0], b[0]))
print('overlaps:', hits or 'none')

open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'pins.svg'), 'w').write(build(ORGS))
print('written to tools/pins.svg — paste it over the <svg class="gtamap-pins">'
      ' block in community.html')
