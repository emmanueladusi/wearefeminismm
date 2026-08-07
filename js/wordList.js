/* The Word — puzzle content.
   ------------------------------------------------------------------
   Add or edit words here WITHOUT touching game logic (js/wordle.js).
   The game reads whatever lengths exist in this file and picks a different
   one each day, so adding an eight-letter word puts more eight-letter days
   into the rotation on its own.

   Each entry:
     w    — the answer, LETTERS ONLY, 4 to 8 long, any case (it is upper-cased)
     m    — what it means, shown the moment the round ends, win or lose.
            The puzzle is the hook; this is the thing they leave with.

   EVERY WORD HERE IS FEMINIST VOCABULARY, not a general virtue word. An
   earlier draft leaned on things like FREEDOM, RESPECT and JUSTICE, which
   could sit on any website about anything. These are terms a reader will
   actually meet in this subject, and several of them tie straight to what
   the Learn page already teaches (the waves, Black feminism, unpaid labour).

   House style, matching the rest of the site:
     · plain-spoken, short, accurate
     · Canadian spelling and Canadian facts where a country is implied
     · no em dashes anywhere in site copy

   ⚠️  EMMANUEL: read every meaning before shipping. These are claims on a
       minors' education site and they should be yours, in your words. Any
       date worth double-checking against sources.html is marked (check).

   Thirty-one entries is about a month before anything repeats. A hundred
   turns it from a rotation into a habit. */

window.WORD_LIST = [

  /* ---- 4 ---- */
  { w: "vote", m: "The right the first wave organized around. Some women in Canada won it federally in 1918, but Indigenous people were not fully included until 1960. (check)" },
  { w: "wage", m: "What work pays. The gender wage gap is the measure of how much less women take home over a working year." },

  /* ---- 5 ---- */
  { w: "waves", m: "How people group the movement over time. First wave the vote, second wave work and the law, third and fourth wave identity, race and the internet." },
  { w: "women", m: "Not one group with one experience. Which is the whole reason intersectionality had to be named." },
  { w: "quota", m: "A set number of seats kept for a group. Argued about constantly, and used where a gap will not close on its own." },
  { w: "glass", m: "As in glass ceiling. The barrier you cannot see until you hit it, stopping women rising past a certain level." },
  { w: "voice", m: "Having a say, and being believed when you use it. A lot of this movement is about who gets listened to." },
  { w: "trans", m: "Someone whose gender is not the one they were assigned at birth. A feminism that leaves them out is not doing the job." },

  /* ---- 6 ---- */
  { w: "sexism", m: "Treating someone worse because of their gender. Usually quiet and everyday rather than loud." },
  { w: "gender", m: "The social side of being a man, a woman, both or neither. Not the same thing as biological sex." },
  { w: "equity", m: "Giving people what they each need to reach the same place. Fair is not always identical." },
  { w: "parity", m: "Equal numbers. Usually said about how many women sit in a parliament, a boardroom or a newsroom." },
  { w: "unpaid", m: "The cooking, cleaning and caring that keeps a household running. No wage, still mostly done by women, and left out of most economics." },
  { w: "bodily", m: "As in bodily autonomy. The principle that decisions about your body belong to you." },
  { w: "sister", m: "The root of sisterhood, the idea that women's struggles are connected. Black feminists pushed back where it was used to paper over race and class." },
  { w: "labour", m: "Work. Women's labour organizing won some of the earliest protections anyone got at work." },
  { w: "allies", m: "People who are not in a group but back it anyway. Useful when they listen, less so when they take over." },
  { w: "stigma", m: "The shame attached to something that does not deserve it. Periods, single mothers and abortion all carry it." },
  { w: "agency", m: "The power to make your own choices about your own life, rather than having them made for you." },

  /* ---- 7 ---- */
  { w: "consent", m: "A clear yes, freely given, that can be taken back at any point." },
  { w: "ceiling", m: "As in glass ceiling, named in the 1980s for the invisible limit on how far a woman could be promoted. (check)" },
  { w: "bloomer", m: "Named for Amelia Bloomer, who campaigned in the 1850s for clothing women could actually move in. Dress reform was a real fight. (check)" },
  { w: "pioneer", m: "Someone who went first, usually without a map and against a lot of resistance." },

  /* ---- 8 ---- */
  { w: "feminism", m: "The belief that all genders deserve equal rights, and the work of making that true in practice." },
  { w: "feminist", m: "Anyone who holds that belief and acts on it. Any gender, no membership card required." },
  { w: "suffrage", m: "The right to vote, and the name of the campaign to win it. Suffragists petitioned, suffragettes broke things." },
  { w: "misogyny", m: "Hatred or contempt for women. Sexism is the system; this is the hostility inside it." },
  { w: "womanist", m: "Alice Walker's word, made because feminism was too often written by and for white women. Black women's experience at the centre, not the margin." },
  { w: "herstory", m: "History retold with women in it. Not a real etymology, but a fair complaint: most of the record was written about men." },
  { w: "maternal", m: "To do with mothers. Maternal mortality, how many women die in childbirth, is one of the sharpest measures of how a country treats them." },
  { w: "allyship", m: "Backing a group you are not part of, as something you keep doing rather than something you announce." },
];
