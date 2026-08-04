#!/usr/bin/env python3
"""Fold Gallery.html into learn.html, replacing everything under the sparkline.

The gallery is a standalone document: it owns :root, it restyles bare body/a/
button/img, and it redefines ten of the site's core design tokens (--serif,
--sans, --ink, --paper, --gold, --violet ...). Dropped into learn.html as-is it
would restyle the nav, hero, sparkline and footer above it. So every selector
in its stylesheet is rewritten to sit under one wrapper, #wfgallery.

Re-runnable: always rebuilds from learn-classic.html (the preserved original)
plus Gallery.html, so it never compounds on its own output.
"""
import re, sys, os

SCOPE = '#wfgallery'
SITE = '/Users/emmanuel/Downloads/wearefeminism_v11'


def split_top(s, sep=','):
    """Split on sep, ignoring separators inside (), [] or quotes."""
    parts, buf, depth, quote = [], '', 0, None
    for ch in s:
        if quote:
            buf += ch
            if ch == quote:
                quote = None
            continue
        if ch in '"\'':
            quote = ch; buf += ch; continue
        if ch in '([':
            depth += 1
        elif ch in ')]':
            depth -= 1
        if ch == sep and depth == 0:
            parts.append(buf); buf = ''
        else:
            buf += ch
    parts.append(buf)
    return parts


LEAD = re.compile(r'^(:root|html|body)((?:[.#\[:][^\s>+~,]*)*)')


def scope_selector(prelude):
    out = []
    for part in split_top(prelude):
        p = part.strip()
        if not p:
            continue
        # A rule is usually preceded by its comment, and the comment sits in
        # the prelude. Lift it off before deciding what the selector starts
        # with, or ":root" reads as "/*...*/ :root" — a descendant selector
        # that can never match, since :root is always <html>.
        lead_c = ''
        while True:
            cm = re.match(r'(/\*__C\d+__\*/)\s*', p)
            if not cm:
                break
            lead_c += cm.group(1) + '\n'
            p = p[cm.end():]
        if not p:
            continue
        m = LEAD.match(p)
        if m:
            lead, comp = m.group(1), m.group(2) or ''
            rest = p[m.end():].strip()
            if lead == ':root':
                # :root only ever carries custom properties here; they move to
                # the wrapper so they stop overriding the site's tokens.
                new = SCOPE + comp + (' ' + rest if rest else '')
            elif not comp and not rest:
                # bare html{} / body{} -> the wrapper is the gallery's "page"
                new = SCOPE
            else:
                # html[data-bg=x] / body.touchmode keep their compound, because
                # the gallery's JS still sets those on <html> and <body>. The
                # scope is inserted after them, not before.
                new = lead + comp + ' ' + SCOPE + (' ' + rest if rest else '')
        else:
            new = SCOPE + ' ' + p
        out.append(lead_c + new)
    return ',\n'.join(out)


NESTING_AT = ('@media', '@supports', '@layer', '@container')


def scope_css(css):
    res, i, n = '', 0, len(css)
    while i < n:
        j = css.find('{', i)
        if j == -1:
            res += css[i:]
            break
        prelude = css[i:j]
        depth, k = 1, j + 1
        while k < n and depth:
            if css[k] == '{':
                depth += 1
            elif css[k] == '}':
                depth -= 1
            k += 1
        body = css[j + 1:k - 1]
        # Same trap as in scope_selector, one level up: an @media preceded by
        # its comment does not start with "@", so it was being treated as a
        # selector and given the scope as a PREFIX — "#wfgallery @media{...}"
        # is invalid, and a browser drops the whole block.
        lead_c, head = '', prelude
        while True:
            cm = re.match(r'\s*(/\*__C\d+__\*/)', head)
            if not cm:
                break
            lead_c += cm.group(1) + '\n'
            head = head[cm.end():]
        st = head.strip()
        if st.startswith('@'):
            # "@media(max-width:760px)" has no space after the name, so the
            # name has to be matched, not split on whitespace.
            at = '@' + re.match(r'@([a-zA-Z-]+)', st).group(1).lower()
            if at in NESTING_AT:
                res += lead_c + head + '{' + scope_css(body) + '}'
            else:                      # keyframes, font-face: leave alone
                res += lead_c + head + '{' + body + '}'
        else:
            res += scope_selector(prelude) + '{' + body + '}'
        i = k
    return res


def main():
    gal = open(os.path.join(SITE, 'Gallery.html')).read()
    learn = open(os.path.join(SITE, 'learn-classic.html')).read()

    css = re.findall(r'<style[^>]*>(.*?)</style>', gal, re.S)[0]
    js = re.findall(r'<script[^>]*>(.*?)</script>', gal, re.S)[0]
    body = re.search(r'<body[^>]*>(.*)</body>', gal, re.S).group(1)

    # The prototype-context strip is prototype-only copy. It must be removed
    # by a BALANCED scan, not a lazy regex: .ctx wraps a nested .ctx__card, so
    # /<div class="ctx">.*?<\/div>/ stops at the inner close and leaves a
    # stray </div> behind — which silently closed #wfgallery immediately after
    # the <noscript>, dumping the whole gallery back out into <body> and
    # defeating every scoped rule.
    marker = '<!-- ============ context strip'
    st = body.find(marker)
    if st != -1:
        dv = body.index('<div', st)
        depth, i = 0, dv
        for m in re.finditer(r'<(/?)div\b', body[dv:]):
            depth += -1 if m.group(1) else 1
            if depth == 0:
                i = dv + m.end()
                break
        body = body[:st] + body[body.index('>', i) + 1:]

    # the no-JS fallback pointed at learn.html, which is now this page; the
    # written content it promises lives on the preserved copy
    body = body.replace('the current <a href="learn.html">Learn page</a>',
                        'the <a href="learn-classic.html">full written page</a>')
    body = re.sub(r'<script[^>]*>.*?</script>', '', body, flags=re.S)

    # Comments are lifted out before scoping and put back after. One of them
    # quotes a CSS rule, braces and all, which the brace scanner would
    # otherwise read as a real block and lose its place for everything after.
    comments = []

    def _stash(m):
        comments.append(m.group(0))
        return '/*__C%d__*/' % (len(comments) - 1)

    css_nc = re.sub(r'/\*.*?\*/', _stash, css, flags=re.S)
    scoped = scope_css(css_nc)
    scoped = re.sub(r'/\*__C(\d+)__\*/', lambda m: comments[int(m.group(1))],
                    scoped)

    # --- head: the gallery's webfonts, which learn.html does not load -------
    fonts = '\n'.join(re.findall(
        r'<link[^>]*fonts\.(?:googleapis|gstatic)\.com[^>]*>', gal))
    learn = learn.replace(
        '<link rel="stylesheet" href="css/styles.css?v=220" />',
        '<link rel="stylesheet" href="css/styles.css?v=221" />\n'
        '  <!-- webfonts the gallery needs; the rest of Learn is unaffected -->\n  '
        + fonts +
        '\n  <style id="wfgallery-css">\n' + scoped + '\n  </style>')

    # The entrance becomes the anchor the hero's two CTAs used to point at.
    # Both #whatis and #timeline are gone, so without this they scroll nowhere.
    body = body.replace('<section class="entrance"',
                        '<section class="entrance" id="exhibition"', 1)
    learn = learn.replace('href="#whatis"', 'href="#exhibition"')
    learn = learn.replace('href="#timeline"', 'href="#exhibition"')

    # --- body: replace #whatis through the end of #resources ---------------
    start = learn.index('<!-- ===== Learn: three lenses on feminism.')
    end = learn.index('<!-- ===== Footer ===== -->')
    block = (
        '<!-- ===== The exhibition. Replaces the three-lens section, the\n'
        '       timeline and the resources list: same content, one source\n'
        '       object, walked instead of scrolled. Everything above this\n'
        '       line (nav, refract hero, pulse sparkline) is untouched.\n'
        '       The previous version of this page is kept whole at\n'
        '       learn-classic.html. ===== -->\n'
        '  <div id="wfgallery">\n' + body.strip() + '\n  </div>\n\n'
        '  <script>\n' + js + '\n  </script>\n\n  ')
    learn = learn[:start] + block + learn[end:]

    # tlstage.js turns the timeline's four chapters into one stage. This page
    # no longer has a timeline, so it has nothing to enhance here. The file
    # still ships and still runs on learn-classic.html, which does.
    learn = re.sub(r'[ \t]*<!--[^>]*tlstage\.js.*?-->\s*', '', learn, flags=re.S)
    learn = re.sub(r'[ \t]*<script src="js/tlstage\.js[^"]*"></script>\n?', '',
                   learn)

    open(os.path.join(SITE, 'learn.html'), 'w').write(learn)
    print('scoped rules :', scoped.count('{'))
    print('learn.html   :', len(learn), 'bytes')


if __name__ == '__main__':
    main()
