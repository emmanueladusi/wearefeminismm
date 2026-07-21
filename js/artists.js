/* The soundtrack shuffle (Home) — three artist cards on stage, six artists
   in the wings. Every few seconds one card fades down, takes the next
   artist from the pool (skipping anyone already on screen), and fades back
   up, so the section slowly cycles through everybody without ever showing
   more than three at once.

   Runs only while the section is on screen and the tab is visible.
   Reduced motion / accessible mode: no shuffling, the first three stay. */

(function () {
  const list = document.querySelector(".artists");
  if (!list) return;

  const reduce =
    window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
    document.documentElement.hasAttribute("data-a11y");

  const POOL = [
    {
      img: "img/artists/aretha.jpg",
      name: "Aretha Franklin",
      note: "The Queen of Soul, whose demand for respect became an anthem for women and the civil rights movement alike.",
    },
    {
      img: "img/artists/beyonce.jpg",
      name: "Beyoncé",
      note: "Puts a plain definition of feminism on the world's biggest stages, and centers Black women while she does it.",
    },
    {
      img: "img/artists/lizzo.jpg",
      name: "Lizzo",
      note: "Turns self-love and taking up space, unapologetically, into pop you can't sit still to.",
    },
    {
      img: "img/artists/alicia.jpg",
      name: "Alicia Keys",
      note: "A fifteen-time Grammy winner who writes about the quiet, everyday strength of women.",
    },
    {
      img: "img/artists/janelle.jpg",
      name: "Janelle Monáe",
      note: "Claims Black womanhood and queerness out loud, in her music and on screen, without apology.",
    },
    {
      img: "img/artists/whitney.jpg",
      name: "Whitney Houston",
      note: "The Voice: the most awarded female artist of her era, who made power and tenderness sound like the same thing.",
    },
  ];

  const slots = [...list.querySelectorAll(".artist")];
  if (!slots.length || reduce) return;

  // decode everyone up front so a swap never flashes an empty frame
  POOL.forEach((a) => { const i = new Image(); i.src = a.img; });

  const SWAP_MS = 4200;  // beat between swaps
  const FADE_MS = 470;   // matches the .artist transition in css

  let onStage = [0, 1, 2];     // pool index shown in each slot
  let nextPool = 3;            // next artist waiting in the wings
  let nextSlot = 0;            // round-robin through the three slots

  function swap() {
    const slot = slots[nextSlot];
    const artist = POOL[nextPool];
    slot.classList.add("artist--swap");
    setTimeout(() => {
      const img = slot.querySelector(".artist__photo img");
      img.src = artist.img;
      img.alt = artist.name;
      slot.querySelector(".artist__name").textContent = artist.name;
      slot.querySelector(".artist__note").textContent = artist.note;
      slot.classList.remove("artist--swap");
    }, FADE_MS);

    onStage[nextSlot] = nextPool;
    do { nextPool = (nextPool + 1) % POOL.length; } while (onStage.includes(nextPool));
    nextSlot = (nextSlot + 1) % slots.length;
  }

  let timer = null;
  const start = () => { if (!timer) timer = setInterval(swap, SWAP_MS); };
  const stop = () => { clearInterval(timer); timer = null; };

  if ("IntersectionObserver" in window) {
    new IntersectionObserver(
      (es) => es.forEach((e) => (e.isIntersecting ? start() : stop())),
      { rootMargin: "0px 0px -8% 0px" }
    ).observe(list);
  } else {
    start();
  }
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) { stop(); return; }
    const r = list.getBoundingClientRect();
    if (r.top < window.innerHeight && r.bottom > 0) start();
  });
})();
