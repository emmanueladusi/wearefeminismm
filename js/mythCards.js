/* Myth or Real? — card content.
   ------------------------------------------------------------------
   Swap or expand this array WITHOUT touching game logic (js/myth.js).
   Each entry:
     text    — the statement to judge
     isMyth  — true if it's a common MYTH, false if it's REAL / a fact
     truth   — the teaching payoff, shown after the swipe and on the
               end-screen review (plain-spoken, never scolding)
     kind    — OPTIONAL cosmetic label (defaults to "Myth or real?")

   Content is age-appropriate and accurate — debunking the misconceptions
   students actually hear, and confirming facts worth knowing. Deck order
   is shuffled each play. Keep a rough balance of myths and reals. */

window.MYTH_CARDS = [
  {
    text: "Feminism means women should be better than men.",
    isMyth: true,
    truth: "Feminism is about equality between genders — fairness, not flipping the hierarchy. Nobody comes out on top.",
  },
  {
    text: "You have to hate men to call yourself a feminist.",
    isMyth: true,
    truth: "Feminism is against sexism, not against men. Plenty of men are feminists — the enemy is unfair treatment, not a gender.",
  },
  {
    text: "Feminism also fights the pressure on boys to “man up” and hide their feelings.",
    isMyth: false,
    truth: "Real. Because feminism challenges rigid gender roles, it pushes back on the expectations that box in boys and men too.",
  },
  {
    text: "We already have full equality, so feminism is outdated.",
    isMyth: true,
    truth: "Gaps in pay, safety, and representation still exist around the world. The work has come far — but it isn't finished.",
  },
  {
    text: "Black women can face racism and sexism at the very same time.",
    isMyth: false,
    truth: "Real. That overlap is what “intersectionality” describes — the two can't be neatly separated in someone's experience.",
  },
  {
    text: "You can't be into makeup, dresses, or “girly” things and be a real feminist.",
    isMyth: true,
    truth: "Feminism is about choice. Wearing whatever you want — heels or hoodies — is exactly the point.",
  },
  {
    text: "Anyone, of any gender, can be a feminist.",
    isMyth: false,
    truth: "Real. If you believe in equality across genders and act on it, you're a feminist — full stop.",
  },
  {
    text: "Feminism only benefits women.",
    isMyth: true,
    truth: "By loosening rigid gender roles, feminism helps everyone — including men's mental health and freedom to be themselves.",
  },
  {
    text: "In Canada, most women couldn't vote in federal elections until 1918 — and Indigenous and some racialized women waited decades longer.",
    isMyth: false,
    truth: "Real. Suffrage didn't arrive for everyone at once — a clear example of how race and gender stack together.",
  },
  {
    text: "You can be religious, traditional, and a feminist all at once.",
    isMyth: false,
    truth: "Real. Feminism is a big tent — it's about equality, not one single lifestyle or belief.",
  },
];
