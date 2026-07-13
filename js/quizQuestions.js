/* Know Your Feminism — quiz content.
   ------------------------------------------------------------------
   Swap or expand this array WITHOUT touching game logic (js/quiz.js).
   Questions are shown in the order below (a gentle learning arc); the
   ANSWER OPTIONS are shuffled each play, so the right answer is never
   in the same spot twice.

   Each entry:
     topic       — OPTIONAL cosmetic label above the question
                   ("The basics" | "History" | "Core ideas" | ...).
     q           — the question text
     options     — array of answer strings (2–4 works; 4 is ideal)
     answer      — index into `options` of the correct choice (0-based)
     explanation — shown right after answering AND on the end-screen
                   review: the WHY. Teaching, never scolding.

   Tone: this is a minors' site — encouraging, plain-spoken, accurate.
   Facts here are drawn from the Learn page (waves, Black feminism,
   intersectionality) so the quiz reinforces what the site teaches. */

window.QUIZ_QUESTIONS = [
  {
    topic: "The basics",
    q: "At its core, what does feminism stand for?",
    options: [
      "The belief that women should have power over men",
      "The belief in the social, political, and economic equality of all genders",
      "The belief that women and men are exactly the same in every way",
      "A movement that only helps women",
    ],
    answer: 1,
    explanation:
      "Feminism is about equal rights and opportunities across genders — not one group ruling another, and not pretending everyone is identical. Equality, not superiority.",
  },
  {
    topic: "The basics",
    q: "The writer bell hooks defined feminism as a movement to end what?",
    options: [
      "Sexism, sexist exploitation, and oppression",
      "Men",
      "Traditional families",
      "Gender itself",
    ],
    answer: 0,
    explanation:
      "In “Feminism Is for Everybody,” bell hooks framed feminism around ending sexism and oppression — a goal that lifts everyone, which is why she said it's for everybody.",
  },
  {
    topic: "The basics",
    q: "Can someone be a feminist no matter their gender?",
    options: [
      "No — you have to be a woman",
      "Yes — anyone who supports gender equality and acts on it can be a feminist",
      "Only if they belong to an official organization",
      "No — you have to dislike men",
    ],
    answer: 1,
    explanation:
      "Identifying as a feminist means you believe in equality across genders and are willing to stand up for it. People of any gender can — and do.",
  },
  {
    topic: "History",
    q: "The “first wave” of feminism (1800s–early 1900s) fought mainly for what?",
    options: [
      "Equal pay and workplace rights",
      "Representation in social media",
      "The right to vote and basic legal rights",
      "Reproductive rights",
    ],
    answer: 2,
    explanation:
      "The first wave centered on suffrage — winning women the right to vote — and other basic legal rights like owning property. Later waves built on that foundation.",
  },
  {
    topic: "History",
    q: "The “second wave” (1960s–1980s) widened the fight to include things like…",
    options: [
      "Only the right to vote",
      "The workplace, the family, and reproductive rights",
      "Nothing new — it repeated the first wave",
      "Space exploration",
    ],
    answer: 1,
    explanation:
      "The second wave pushed past voting into everyday life: equal pay, opportunities at work, rights within the family, and control over one's own body.",
  },
  {
    topic: "Core ideas",
    q: "Who introduced the term “intersectionality”?",
    options: ["Gloria Steinem", "Kimberlé Crenshaw", "Audre Lorde", "Susan B. Anthony"],
    answer: 1,
    explanation:
      "Legal scholar Kimberlé Crenshaw coined “intersectionality” in 1989 to describe how race and gender overlap — and how ignoring that overlap leaves some people unseen.",
  },
  {
    topic: "Core ideas",
    q: "Which best describes intersectionality?",
    options: [
      "Ranking which group has it the worst",
      "The idea that everyone's experience is basically the same",
      "How overlapping identities — like race, gender, and class — combine to shape a person's experience",
      "A specific type of protest march",
    ],
    answer: 2,
    explanation:
      "Intersectionality isn't a contest. It's the recognition that identities stack and interact, so a person's experience can't be explained by any single label alone.",
  },
  {
    topic: "Core ideas",
    q: "Black feminism emphasizes that, for Black women…",
    options: [
      "Only race matters, not gender",
      "Racism and sexism are experienced together and can't be neatly separated",
      "Feminism should leave race out of it",
      "Gender is the only thing worth talking about",
    ],
    answer: 1,
    explanation:
      "Thinkers like the Combahee River Collective argued that Black women face racism and sexism at the same time — so a feminism that ignores race leaves them behind.",
  },
  {
    topic: "Core ideas",
    q: "How is “equity” different from “equality”?",
    options: [
      "They mean exactly the same thing",
      "Equity means giving everyone the identical thing, no matter their situation",
      "Equity accounts for people's different starting points so outcomes can be fair",
      "Equity only applies to money",
    ],
    answer: 2,
    explanation:
      "Equality gives everyone the same thing; equity adjusts for different needs and starting points so people can actually reach the same place. Fair isn't always identical.",
  },
];
