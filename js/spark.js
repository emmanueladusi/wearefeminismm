/* Pulse sparkline — live Yes/No tally from the "We are Feminism Pre Survey".
   ------------------------------------------------------------------------
   Reads an aggregate-only endpoint (a Google Apps Script Web App linked to the
   form's responses Sheet) that returns just { yes, no } — counts, never raw
   answers. Green when Yes leads, red when No leads, neutral on a tie. Because
   only tallies cross the wire, no student's individual response is ever exposed
   client-side (the survey is for minors — this is deliberate).

   TO GO LIVE: deploy the Apps Script Web App (doGet → {yes,no}, access
   "Anyone") and paste its /exec URL into DATA_URL below. Until then the card
   rests in a neutral "collecting responses" state — it never shows invented
   numbers on the live site. */

(function () {
  // ↓↓↓ paste your deployed Apps Script /exec URL here to go live ↓↓↓
  const DATA_URL = "https://script.google.com/macros/s/AKfycbyWMFEPRY0bTCyMngvMYkUI2ontBCETN8vv4f4zTagoL9l_atxPSi7LFAlHn8leDeBBTw/exec";
  const REFRESH_MS = 2000; // re-check for new responses every 2s (redraws live when the tally changes)

  const svg = document.getElementById("sparkSvg");
  if (!svg) return;

  const $ = (id) => document.getElementById(id);
  const path = $("sparkPath");
  const dot = $("sparkDot");

  const GREEN = "#22c55e"; // Yes leads
  const RED = "#ef4444"; // No leads
  const NEUTRAL = "#8a7ea6"; // tie / awaiting data

  const svgW = 500, svgH = 120, padY = 16, POINTS = 8;
  const wave = [0, 0.35, -0.15, 0.5, 0.1, -0.3, 0.2, 0];

  // Build a natural-looking line from how lopsided the vote is (-1..1).
  function pollValues(percentYes) {
    const lean = (percentYes - 50) / 50; // -1 (all No) .. +1 (all Yes)
    const vals = [];
    for (let i = 0; i < POINTS; i++) {
      const t = i / (POINTS - 1);
      const eased = 1 - Math.pow(1 - t, 3);
      const w = i === 0 || i === POINTS - 1 ? 0 : wave[i] * 0.1;
      vals.push(0.5 + lean * 0.5 * eased + w);
    }
    vals[0] = 0.5;
    vals[POINTS - 1] = 0.5 + lean * 0.5;
    return vals;
  }

  function buildPath(values) {
    const min = Math.min(...values), max = Math.max(...values);
    const range = max - min || 1;
    const usable = svgH - padY * 2, stepX = svgW / (values.length - 1);
    const pts = values.map((v, i) => [
      i * stepX,
      svgH - padY - ((v - min) / range) * usable,
    ]);
    let d = `M ${pts[0][0]} ${pts[0][1]}`;
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], midX = (x0 + x1) / 2;
      d += ` C ${midX} ${y0}, ${midX} ${y1}, ${x1} ${y1}`;
    }
    return { d, last: pts[pts.length - 1] };
  }

  function colorFor(percentYes) {
    if (percentYes > 50) return GREEN;
    if (percentYes < 50) return RED;
    return NEUTRAL;
  }

  // Hand the latest curve/colour to the page-thread (js/thread.js), which routes
  // its one continuous line into the pulse card and TRACES the chart itself — so
  // the gold thread line flows straight into the graph and draws it. The pulse
  // hold (js/pulsepin.js) then waits until that trace is finished before it holds
  // the screen on the completed graph.
  function notifyThread() {
    if (window.__thread && window.__thread.syncSpark) window.__thread.syncSpark();
  }

  // Neutral resting state — flat line, no numbers — used until real data lands.
  function renderWaiting(animate) {
    const { d, last } = buildPath(pollValues(50));
    $("sparkPct").textContent = "…";
    path.setAttribute("d", d);
    path.style.stroke = NEUTRAL;
    path.style.opacity = "0.5";
    path.style.filter = "none";
    dot.setAttribute("cx", last[0]);
    dot.setAttribute("cy", last[1]);
    dot.style.fill = NEUTRAL;
    dot.style.color = NEUTRAL;
    $("sparkVerdict").innerHTML = "";
    notifyThread();
  }

  function render(data, animate) {
    const total = data.yes + data.no;
    if (!total) return renderWaiting(animate);

    const percentYes = (data.yes / total) * 100;
    const color = colorFor(percentYes);
    const { d, last } = buildPath(pollValues(percentYes));
    const yesMaj = percentYes > 50, tie = percentYes === 50;

    $("sparkPct").textContent = Math.round(percentYes) + "%";
    $("sparkCounts").innerHTML =
      `<b>${data.yes}</b> Yes · <b>${data.no}</b> No · ${total} responses`;

    $("sparkVerdict").style.color = color;
    $("sparkVerdict").innerHTML =
      (tie
        ? ""
        : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17L17 7"></path><path d="M7 7h10v10"></path></svg>`) +
      `<span>${tie ? "Split evenly" : yesMaj ? "Yes leads" : "No leads"}</span>`;
    const arrow = $("sparkVerdict").querySelector("svg");
    if (arrow && !yesMaj && !tie) arrow.style.transform = "rotate(90deg)";

    path.setAttribute("d", d);
    path.style.stroke = color;
    path.style.opacity = "1";
    path.style.filter = `drop-shadow(0 0 6px ${color}99)`;
    dot.setAttribute("cx", last[0]);
    dot.setAttribute("cy", last[1]);
    dot.style.fill = color;
    dot.style.color = color;

    notifyThread();
  }

  let latest = null; // last data received
  let inView = false; // is the card currently on screen?

  async function loadLive() {
    try {
      const res = await fetch(DATA_URL, { cache: "no-store" });
      const data = await res.json();
      const next = { yes: +data.yes || 0, no: +data.no || 0 };
      // did someone just respond since we last checked?
      const changed = !latest || next.yes !== latest.yes || next.no !== latest.no;
      latest = next;
      // if the count changed while the card is visible, redraw the line live so
      // you actually SEE the new response land; otherwise update silently so the
      // fresh number is ready the next time it scrolls into view.
      render(latest, changed && inView);
    } catch (e) {
      console.warn("spark: could not load live data", e);
      if (!latest) renderWaiting(false);
    }
  }

  // Track visibility so a response that lands WHILE the card is on screen
  // redraws live (see loadLive). The actual replay-on-view is driven by the
  // thread (js/thread.js), which owns the visible line now.
  new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        inView = entry.isIntersecting;
      });
    },
    { threshold: 0.4 }
  ).observe(svg);

  // Prime the initial (static) state, then start polling if we have an endpoint.
  renderWaiting(false);
  if (DATA_URL) {
    loadLive();
    setInterval(loadLive, REFRESH_MS);
  }
})();
