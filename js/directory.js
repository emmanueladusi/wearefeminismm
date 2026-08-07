/* Community directory — search, filter, list/map toggle.

   The structured fields come from each organization's own public description.
   Where a detail could not be confirmed the value is the string "Not listed",
   which is rendered as-is. Nothing here is guessed.

   lastVerified is the date the link and description were last checked by hand.

   No dependencies: filtering is a plain array filter, and the whole thing
   degrades to the full list if this file fails to load (the markup ships with
   an empty list and this script fills it, so the noscript path is the
   directory's own <noscript> block in community.html). */

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
      cost: "Free",
      status: "Running",
      url: "https://niacentre.org/offerings/for-youth/",
      lastVerified: "27 July 2026",
    },
    {
      name: "YWCA Toronto · Girls' Centre",
      desc: "Leadership, empowerment and after-school programs built for and by girls.",
      location: "Toronto",
      age: "Not listed",
      type: "Leadership and after-school",
      cost: "Not listed",
      status: "Running",
      url: "https://www.ywcatoronto.org/ourprograms/girlsprograms/ywcagirlscentre",
      lastVerified: "27 July 2026",
    },
    {
      name: "Girls Rock Camp Toronto",
      desc: "Music, self-expression and self-esteem for girls, trans and gender non-conforming youth.",
      location: "Toronto",
      age: "Not listed",
      type: "Music and arts",
      cost: "Not listed",
      status: "Not listed",
      url: "https://www.girlsrocktoronto.org/programs",
      lastVerified: "27 July 2026",
    },
    {
      name: "Canada Learning Code",
      desc: "Coding and technology workshops with a focus on women, girls and underrepresented youth.",
      location: "GTA-wide",
      age: "Not listed",
      type: "Coding and tech",
      cost: "Not listed",
      status: "Running",
      url: "https://www.canadalearningcode.ca/",
      lastVerified: "27 July 2026",
    },
    {
      name: "Help A Girl Out",
      desc: "Menstrual equity: free products and education workshops in schools and youth centres.",
      location: "Toronto",
      age: "Not listed",
      type: "Menstrual equity and education",
      cost: "Free",
      status: "Running",
      url: "https://helpagirlout.org/",
      lastVerified: "27 July 2026",
    },
    {
      name: "Black Women's Institute for Health",
      desc: "A national, Black-led organization on the health of Black women and girls: therapy, mentorship circles, workshops and research, run out of North York.",
      location: "Toronto",
      age: "Not listed",
      type: "Health and mentorship",
      cost: "Not listed",
      status: "Running",
      url: "https://bwhealthinstitute.com/",
      lastVerified: "7 August 2026",
    },
    {
      name: "Black Women in Motion",
      desc: "Survivor-led and grassroots. Wellness, education, employment and peer-education programs for Black women, girls and gender-diverse survivors of gender-based violence.",
      location: "Toronto",
      age: "Not listed",
      type: "Wellness and employment",
      cost: "Not listed",
      status: "Running",
      url: "https://blackwomeninmotion.org/",
      lastVerified: "7 August 2026",
    },
    {
      name: "Black Girls Magazine",
      desc: "A print magazine written by Black girls across the GTA, published twice a year, with a teen edition and summer writing and art workshops.",
      location: "GTA-wide",
      age: "8 and up",
      type: "Writing and publishing",
      cost: "Not listed",
      status: "Running",
      url: "https://www.blackgirlsmagazine.ca/",
      lastVerified: "7 August 2026",
    },
    {
      name: "Elspeth Heyworth Centre for Women",
      desc: "Settlement, counselling, employment and anti-human-trafficking support for immigrant and newcomer women, seniors, youth and families. Finch Avenue West, plus Vaughan and Bradford.",
      location: "GTA-wide",
      age: "Not listed",
      type: "Settlement and support",
      cost: "Not listed",
      status: "Running",
      url: "https://ehcw.ca/",
      lastVerified: "7 August 2026",
    },
  ];

  const q = document.getElementById("dirQ");
  const fLoc = document.getElementById("fLoc");
  const fAge = document.getElementById("fAge");
  const fType = document.getElementById("fType");
  const fCost = document.getElementById("fCost");
  const countEl = document.getElementById("dirCount");
  const emptyEl = document.getElementById("dirEmpty");
  const clearBtn = document.getElementById("dirClear");
  const viewList = document.getElementById("viewList");
  const viewMap = document.getElementById("viewMap");
  const mapView = document.getElementById("mapView");

  const esc = (s) =>
    String(s).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
    );

  // build the option lists from the data, so a new org cannot fall out of sync
  function fill(sel, values) {
    if (!sel) return;
    [...new Set(values)]
      .filter((v) => v && v !== "Not listed")
      .sort()
      .forEach((v) => {
        const o = document.createElement("option");
        o.value = v;
        o.textContent = v;
        sel.appendChild(o);
      });
  }
  fill(fLoc, ORGS.map((o) => o.location));
  fill(fAge, ORGS.map((o) => o.age));
  fill(fType, ORGS.map((o) => o.type));
  fill(fCost, ORGS.map((o) => o.cost));

  function card(o) {
    const costTag =
      o.cost === "Not listed"
        ? '<span class="tag">Cost not listed</span>'
        : '<span class="tag tag--cost">' + esc(o.cost) + "</span>";
    return (
      '<li class="orgcard">' +
      '<div class="orgcard__top"><span class="tag">' + esc(o.location) + "</span>" +
      '<span class="tag">' + esc(o.type) + "</span>" + costTag + "</div>" +
      '<h3 class="orgcard__name">' + esc(o.name) + "</h3>" +
      '<p class="orgcard__desc">' + esc(o.desc) + "</p>" +
      '<dl class="orgcard__facts">' +
      "<dt>Ages</dt><dd>" + esc(o.age) + "</dd>" +
      "<dt>Status</dt><dd>" + esc(o.status) + "</dd>" +
      "</dl>" +
      '<a class="orgcard__go ext" href="' + esc(o.url) + '" target="_blank" rel="noopener">' +
      "Visit " + esc(o.name) +
      '<span class="visually-hidden"> (opens in a new tab)</span></a>' +
      '<p class="orgcard__verified">Last verified ' + esc(o.lastVerified) + "</p>" +
      "</li>"
    );
  }

  function apply() {
    const term = (q && q.value || "").trim().toLowerCase();
    const out = ORGS.filter((o) => {
      if (fLoc && fLoc.value && o.location !== fLoc.value) return false;
      if (fAge && fAge.value && o.age !== fAge.value) return false;
      if (fType && fType.value && o.type !== fType.value) return false;
      if (fCost && fCost.value && o.cost !== fCost.value) return false;
      if (!term) return true;
      return (o.name + " " + o.desc + " " + o.type + " " + o.location)
        .toLowerCase()
        .includes(term);
    });

    grid.innerHTML = out.map(card).join("");
    if (countEl) {
      countEl.innerHTML =
        "<b>" + out.length + "</b> " +
        (out.length === 1 ? "organization" : "organizations") +
        (out.length !== ORGS.length ? " of " + ORGS.length : "");
    }
    if (emptyEl) emptyEl.hidden = out.length !== 0;
  }

  function clearAll() {
    if (q) q.value = "";
    [fLoc, fAge, fType, fCost].forEach((s) => { if (s) s.value = ""; });
    apply();
    if (q) q.focus();
  }

  [q, fLoc, fAge, fType, fCost].forEach((el) => {
    if (!el) return;
    el.addEventListener("input", apply);
    el.addEventListener("change", apply);
  });
  if (clearBtn) clearBtn.addEventListener("click", clearAll);
  document.querySelectorAll("[data-clear-all]").forEach((b) =>
    b.addEventListener("click", clearAll)
  );

  /* list / map toggle — the map is a visual alternative, never the only route
     to the information, so the list stays reachable at every width */
  function setView(isMap) {
    if (!mapView) return;
    mapView.hidden = !isMap;
    grid.hidden = isMap;
    if (emptyEl && isMap) emptyEl.hidden = true;
    else apply();
    if (viewMap) viewMap.setAttribute("aria-pressed", isMap ? "true" : "false");
    if (viewList) viewList.setAttribute("aria-pressed", isMap ? "false" : "true");
  }
  if (viewMap) viewMap.addEventListener("click", () => setView(true));
  if (viewList) viewList.addEventListener("click", () => setView(false));

  apply();
})();
