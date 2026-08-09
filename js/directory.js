/* Community directory — search + one row of tap-to-filter chips.

   The structured fields come from each organization's own public description.
   Where a detail could not be confirmed the value is the string "Not listed",
   which is rendered as-is. Nothing here is guessed.

   themes[] groups the nine organizations into a handful of things a student
   might actually be looking for. Each theme on an org is taken straight from
   that org's own stated programming, never inferred: Nia says arts and
   mentorship, so it carries both. An org with one theme carries one.

   Why chips and not dropdowns: with nine organizations, a <select> of nine
   program types meant every choice returned exactly one result, and the age
   and cost menus hid seven orgs apiece behind values they had never published.
   People filtered, the page emptied, and nothing explained why. Every chip now
   prints the number of organizations behind it, recounted against whatever
   else is active, and a chip that would return nothing is disabled. You can
   see the result of a tap before you make it, so the empty state is only ever
   reachable by typing a word nobody matches.

   Location and age are no longer filters. Both are printed on every card, but
   neither partitions nine GTA-wide organizations in a way that helps: filtering
   to "Toronto" would have hidden the three orgs that serve the whole GTA from a
   student in Brampton, and seven of nine never published an age range at all.

   lastVerified is the date the link and description were last checked by hand.

   No dependencies. If this file fails to load the markup still ships the full
   nine as a <noscript> list in community.html. */

(function () {
  const grid = document.getElementById("dirGrid");
  if (!grid) return;

  const ORGS = [
    {
      name: "Nia Centre for the Arts",
      desc: "Toronto's Black arts centre. Free youth mentorship, creative workshops and studio programming.",
      location: "Toronto",
      age: "14 to 29",
      type: "Arts and mentorship",
      themes: ["Arts and writing", "Mentorship"],
      cost: "Free",
      status: "Running",
      accent: "#8a3a1c",
      size: "wide",
      url: "https://niacentre.org/offerings/for-youth/",
      lastVerified: "27 July 2026",
    },
    {
      name: "YWCA Toronto · Girls' Centre",
      desc: "Leadership, empowerment and after-school programs built for and by girls.",
      location: "Toronto",
      age: "Not listed",
      type: "Leadership and after-school",
      themes: ["Leadership"],
      cost: "Not listed",
      status: "Running",
      accent: "#12514c",
      size: "tall",
      url: "https://www.ywcatoronto.org/ourprograms/girlsprograms/ywcagirlscentre",
      lastVerified: "27 July 2026",
    },
    {
      name: "Girls Rock Camp Toronto",
      desc: "Music, self-expression and self-esteem for girls, trans and gender non-conforming youth.",
      location: "Toronto",
      age: "Not listed",
      type: "Music and arts",
      themes: ["Arts and writing"],
      cost: "Not listed",
      status: "Not listed",
      accent: "#84275a",
      size: "std",
      url: "https://www.girlsrocktoronto.org/programs",
      lastVerified: "27 July 2026",
    },
    {
      name: "Canada Learning Code",
      desc: "Coding and technology workshops with a focus on women, girls and underrepresented youth.",
      location: "GTA-wide",
      age: "Not listed",
      type: "Coding and tech",
      themes: ["Tech and jobs"],
      cost: "Not listed",
      status: "Running",
      accent: "#2c3572",
      size: "std",
      url: "https://www.canadalearningcode.ca/",
      lastVerified: "27 July 2026",
    },
    {
      name: "Help A Girl Out",
      desc: "Menstrual equity: free products and education workshops in schools and youth centres.",
      location: "Toronto",
      age: "Not listed",
      type: "Menstrual equity and education",
      themes: ["Health"],
      cost: "Free",
      status: "Running",
      accent: "#8d1f33",
      size: "wide",
      url: "https://helpagirlout.org/",
      lastVerified: "27 July 2026",
    },
    {
      name: "Black Women's Institute for Health",
      desc: "A national, Black-led organization on the health of Black women and girls: therapy, mentorship circles, workshops and research, run out of North York.",
      location: "Toronto",
      age: "Not listed",
      type: "Health and mentorship",
      themes: ["Health", "Mentorship"],
      cost: "Not listed",
      status: "Running",
      accent: "#2a5220",
      size: "std",
      url: "https://bwhealthinstitute.com/",
      lastVerified: "7 August 2026",
    },
    {
      name: "Black Women in Motion",
      desc: "Survivor-led and grassroots. Wellness, education, employment and peer-education programs for Black women, girls and gender-diverse survivors of gender-based violence.",
      location: "Toronto",
      age: "Not listed",
      type: "Wellness and employment",
      themes: ["Health", "Tech and jobs", "Support"],
      cost: "Not listed",
      status: "Running",
      accent: "#512c79",
      size: "wide",
      url: "https://blackwomeninmotion.org/",
      lastVerified: "7 August 2026",
    },
    {
      name: "Black Girls Magazine",
      desc: "A print magazine written by Black girls across the GTA, published twice a year, with a teen edition and summer writing and art workshops.",
      location: "GTA-wide",
      age: "8 and up",
      type: "Writing and publishing",
      themes: ["Arts and writing"],
      cost: "Not listed",
      status: "Running",
      accent: "#6d4a0a",
      size: "std",
      url: "https://www.blackgirlsmagazine.ca/",
      lastVerified: "7 August 2026",
    },
    {
      name: "Elspeth Heyworth Centre for Women",
      desc: "Settlement, counselling, employment and anti-human-trafficking support for immigrant and newcomer women, seniors, youth and families. Finch Avenue West, plus Vaughan and Bradford.",
      location: "GTA-wide",
      age: "Not listed",
      type: "Settlement and support",
      themes: ["Support", "Tech and jobs"],
      cost: "Not listed",
      status: "Running",
      accent: "#21456a",
      size: "tall",
      url: "https://ehcw.ca/",
      lastVerified: "7 August 2026",
    },
  ];

  /* Chip order is deliberate: the biggest groups first, so the row reads as a
     shelf that gets more specific left to right rather than an alphabet.
     Labels are short because on a 375px phone every extra word costs a whole
     wrapped row, and the row has to stay glanceable to do its job. */
  const THEMES = [
    "Arts and writing",
    "Health",
    "Tech and jobs",
    "Support",
    "Mentorship",
    "Leadership",
  ];

  const q = document.getElementById("dirQ");
  const themeRow = document.getElementById("themeRow");
  const freeBtn = document.getElementById("freeOnly");
  const countEl = document.getElementById("dirCount");
  const emptyEl = document.getElementById("dirEmpty");
  const emptyMsg = document.getElementById("dirEmptyMsg");
  const clearBtn = document.getElementById("dirClear");

  let theme = "";      // "" means every theme
  let freeOnly = false;

  const esc = (s) =>
    String(s).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
    );

  /* ---------------- matching ----------------
     Split so the chip counts and the result list ask the same question, and
     a count can never disagree with what a tap actually produces. */

  function matchesText(o, term) {
    if (!term) return true;
    return (o.name + " " + o.desc + " " + o.type + " " + o.themes.join(" ") + " " + o.location)
      .toLowerCase()
      .includes(term);
  }
  const matchesFree = (o, free) => !free || o.cost === "Free";
  const matchesTheme = (o, t) => !t || o.themes.indexOf(t) !== -1;

  function select(term, t, free) {
    return ORGS.filter(
      (o) => matchesText(o, term) && matchesTheme(o, t) && matchesFree(o, free)
    );
  }

  /* ---------------- chips ---------------- */

  function chip(label, value, pressed) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "chip";
    b.dataset.theme = value;
    b.setAttribute("aria-pressed", pressed ? "true" : "false");
    b.innerHTML =
      '<span class="chip__label">' + esc(label) + "</span>" +
      '<span class="chip__n" aria-hidden="true"></span>' +
      '<span class="visually-hidden chip__sr"></span>';
    b.addEventListener("click", () => {
      theme = b.dataset.theme;
      apply();
      b.focus();
    });
    return b;
  }

  if (themeRow) {
    themeRow.appendChild(chip("All", "", true));
    THEMES.forEach((t) => themeRow.appendChild(chip(t, t, false)));
  }

  if (freeBtn) {
    freeBtn.addEventListener("click", () => {
      freeOnly = !freeOnly;
      apply();
    });
  }

  /* A chip's number is what you would get if you tapped it, counted against
     the search box and the Free toggle but not against the other chips. That
     is the whole promise of the row: no tap can surprise you. */
  function paintChips(term) {
    if (!themeRow) return;
    [...themeRow.querySelectorAll(".chip")].forEach((b) => {
      const val = b.dataset.theme;
      const n = select(term, val, freeOnly).length;
      const active = val === theme;
      b.setAttribute("aria-pressed", active ? "true" : "false");
      b.querySelector(".chip__n").textContent = n;
      b.querySelector(".chip__sr").textContent =
        n === 1 ? ", 1 organization" : ", " + n + " organizations";
      // never disable the chip you are standing on, or you cannot tap away
      b.disabled = n === 0 && !active;
      b.classList.toggle("is-empty", n === 0);
    });

    /* Free is the one chip you can tap twice, and the second tap removes the
       filter rather than reapplying it. A count there would be a promise the
       tap breaks, so once it is on the badge becomes a clear-me cross. What
       you are actually seeing is stated right below in "2 of 9". */
    if (freeBtn) {
      const n = select(term, theme, true).length;
      freeBtn.setAttribute("aria-pressed", freeOnly ? "true" : "false");
      freeBtn.classList.toggle("chip--clear", freeOnly);
      freeBtn.querySelector(".chip__n").textContent = freeOnly ? "✕" : n;
      freeBtn.querySelector(".chip__sr").textContent = freeOnly
        ? ", on. Select to show every cost again."
        : n === 1 ? ", 1 organization" : ", " + n + " organizations";
      freeBtn.disabled = n === 0 && !freeOnly;
      freeBtn.classList.toggle("is-empty", n === 0 && !freeOnly);
    }
  }

  /* ---------------- the wall ----------------
     Nine equal bordered boxes in a tidy 3x3 read as a spreadsheet, and the
     organizations are the most interesting thing on this page. So each one is
     a printed poster instead: its colour floods the whole tile, its name is
     set large, and the tiles are deliberately uneven so the grid never falls
     into a rhythm.

     The colour is IDENTITY, not decoration, and so is the number: both come
     from the org's own entry, so Help A Girl Out is 05 in crimson whether it
     is the fifth tile on screen or the only one left after a filter.

     Every ink is a deep one chosen so cream type clears 4.5:1 on it (worst is
     5.88:1, on the ochre). That is also why the wall looks the same in light
     and dark mode: each tile brings its own background, so it never depends on
     the page behind it. Colour is never the only signal either, so nobody has
     to tell teal from green to use the page. */

  const num = (i) => (i + 1 < 10 ? "0" : "") + (i + 1);

  function card(o) {
    const i = ORGS.indexOf(o);
    const facts = [esc(o.location)];
    if (o.age !== "Not listed") facts.push("Ages " + esc(o.age));
    if (o.cost === "Free") facts.push('<b class="orgtile__free">Free</b>');

    /* The link wraps only the name, so the heading stays a heading and the
       accessible name stays short; CSS then stretches that one link across
       the whole tile, which is what makes the poster clickable. */
    return (
      '<li class="orgtile orgtile--' + o.size + '" style="--org:' + o.accent + '">' +
      '<span class="orgtile__num" aria-hidden="true">' + num(i) + "</span>" +
      '<h3 class="orgtile__name"><a class="orgtile__link" href="' + esc(o.url) +
      '" target="_blank" rel="noopener">' + esc(o.name) +
      '<span class="visually-hidden"> (opens in a new tab)</span></a></h3>' +
      '<p class="orgtile__desc">' + esc(o.desc) + "</p>" +
      '<p class="orgtile__meta">' + facts.join('<span aria-hidden="true"> · </span>') + "</p>" +
      '<span class="orgtile__go" aria-hidden="true">Visit their site →</span>' +
      // provenance stays on the tile: the masthead claims every one was
      // checked by hand, and this is the receipt for that claim
      '<span class="orgtile__checked">Link checked ' + esc(o.lastVerified) + "</span>" +
      "</li>"
    );
  }

  /* ---------------- render ---------------- */

  function apply() {
    const term = (q && q.value || "").trim().toLowerCase();
    const out = select(term, theme, freeOnly);

    paintChips(term);
    grid.innerHTML = out.map(card).join("");

    // say the filtered state in words, not just a number
    if (countEl) {
      // "1 of 9 organizations" — the noun agrees with the nine, not the one
      countEl.innerHTML =
        out.length !== ORGS.length
          ? "<b>" + out.length + "</b> of " + ORGS.length + " organizations"
          : "All <b>" + ORGS.length + "</b> organizations";
    }

    const active = !!(term || theme || freeOnly);
    if (clearBtn) clearBtn.hidden = !active;

    if (emptyEl) {
      emptyEl.hidden = out.length !== 0;
      // name every thing that is narrowing, so nobody blames the wrong one
      if (emptyMsg && out.length === 0) {
        const narrowing = [];
        if (term) narrowing.push("“" + term + "”");
        if (theme) narrowing.push(theme.toLowerCase());
        if (freeOnly) narrowing.push("free only");
        emptyMsg.textContent =
          narrowing.length > 1
            ? "Nothing matches " + narrowing.slice(0, -1).join(", ") +
              " and " + narrowing[narrowing.length - 1] + " together."
            : "Nothing matches " + (narrowing[0] || "those filters") + ".";
      }
    }
  }

  function clearAll() {
    if (q) q.value = "";
    theme = "";
    freeOnly = false;
    apply();
    if (q) q.focus();
  }

  if (q) {
    q.addEventListener("input", apply);
    q.addEventListener("search", apply);
  }
  if (clearBtn) clearBtn.addEventListener("click", clearAll);
  document.querySelectorAll("[data-clear-all]").forEach((b) =>
    b.addEventListener("click", clearAll)
  );

  apply();
})();
