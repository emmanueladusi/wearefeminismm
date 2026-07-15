/* Spot the Bias — card content.
   ------------------------------------------------------------------
   Swap or expand this array WITHOUT touching game logic (js/bias.js).
   Each entry:
     text        — the post / headline / caption / comment to judge
     isBiased    — true if it carries bias or stereotyping, false if fair
     explanation — shown on the end screen: WHY it was or wasn't biased
                   (reflective and teaching, never scolding)
     kind        — OPTIONAL cosmetic label: "Headline" | "Caption" |
                   "Comment" | "Post". Defaults to "Post" if omitted.

   ⚠️  PLACEHOLDER CONTENT — replace / expand with the real card set
       (the game auto-scales to however many you provide). Deliberately
       kept at the level of SUBTLE stereotyping — never slurs, never
       graphic harassment — per the site's safety posture for minors. */

window.BIAS_CARDS = [
  {
    /* PLACEHOLDER */
    kind: "Comment",
    text: "She's surprisingly good at coding, for a girl.",
    isBiased: true,
    explanation:
      "The word “surprisingly” treats a girl being skilled at coding as unexpected. That's a stereotype: it quietly assumes technical talent isn't normal for girls.",
  },
  {
    /* PLACEHOLDER */
    kind: "Headline",
    text: "Student team ships new app update two weeks ahead of schedule.",
    isBiased: false,
    explanation:
      "This just reports what a team did. There's no judgement based on anyone's gender, race, or identity, so it's fair.",
  },
  {
    /* PLACEHOLDER */
    kind: "Caption",
    text: "Women leaders bring a softer, more emotional touch to the job.",
    isBiased: true,
    explanation:
      "It sounds like a compliment, but it still boxes every woman into one emotional role. “Positive” stereotypes are bias too: they decide who someone is before you meet them.",
  },
  {
    /* PLACEHOLDER */
    kind: "Headline",
    text: "Local students organized a media-literacy workshop this week.",
    isBiased: false,
    explanation:
      "A neutral report of an event. It describes what happened without assuming anything about the people involved.",
  },
];
