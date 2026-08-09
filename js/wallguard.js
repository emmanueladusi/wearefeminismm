/* The wall safety net, in ONE place.
   ------------------------------------------------------------------------
   Screens what goes onto the shared wall (wall.html, js/wall.js). Kept as
   its own file rather than inlined there so the patterns have exactly one
   copy: a second copy would drift, and the copy that drifts is the one that
   lets something through.

   Neither check is a block. Identifying details ask for one more press.
   Crisis words put a real helpline on screen first. Both are deliberately
   easy to walk past, because a wall that stops a girl mid-sentence is worse
   than one that pauses her. */

(function () {
  const CRISIS = /\b(kill myself|killing myself|end my life|take my (own )?life|want to die|wanna die|suicid\w*|self[- ]harm|hurt myself|cut myself|cutting myself)\b/i;

  const IDENTIFYING = [
    /[\w.+-]+@[\w-]+\.[a-z]{2,}/i,                            // email
    /\b(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}\b/,  // phone
    /(^|\s)@[a-z0-9._]{3,}/i,                                 // social handle
    /\bhttps?:\/\/\S+/i,                                      // link
    /\bmy name is\b/i,
  ];

  function screenText(text) {
    if (CRISIS.test(text)) {
      /* The numbers are links, not text. Someone reading this on a phone at
         2am should not have to memorise a shortcode and retype it into
         another app. sms: prefills the word; tel: dials. */
      return (
        "Before this goes up: if any of that is happening to you right now, please talk to someone who can help tonight. " +
        '<strong>Kids Help Phone: <a href="sms:686868&body=CONNECT">text CONNECT to 686868</a></strong>, free and confidential, any hour. ' +
        'Black youth can <a href="sms:686868&body=RISE">text RISE</a> to the same number for RiseUp. ' +
        'You can also <a href="tel:988">call or text 988</a>. ' +
        "Your words are still yours, and sending again will send them."
      );
    }
    if (IDENTIFYING.some((re) => re.test(text))) {
      return (
        "That looks like it might name someone or share a way to contact you. " +
        "Take it out if you can, then send again. Your story lands just as hard without it, and staying unidentifiable is what keeps this wall safe."
      );
    }
    return null;
  }

  /* One guarded submit, shared by every composer and reply box on the site.
     `field` is the input, `caution` the status line under it, `onPass` the
     thing that actually posts. It either warns or posts. */
  function guardedSubmit(field, caution, onPass) {
    const text = field.value.trim();
    if (!text) return;

    if (caution && caution.dataset.armed !== "true") {
      const warning = screenText(text);
      if (warning) {
        /* Unhide BEFORE writing the text. A live region that is still
           `hidden` when its content changes is outside the accessibility
           tree, so the change announces to nobody: the safety pause existed
           on screen and did not exist for a screen reader user, who pressed
           send, heard silence, and pressed send again. */
        caution.hidden = false;
        caution.innerHTML = warning;
        caution.dataset.armed = "true";   // the next send goes through unchanged
        return;
      }
    }
    if (caution) {
      caution.hidden = true;
      caution.dataset.armed = "false";
    }
    onPass(text);
  }

  /* editing after a caution re-arms the check, so a fresh problem is caught */
  function watchForEdits(field, caution) {
    if (!field || !caution) return;
    field.addEventListener("input", () => {
      if (caution.dataset.armed !== "true") return;
      caution.dataset.armed = "false";
      caution.hidden = true;
    });
  }

  window.WFGuard = {
    screenText: screenText,
    guardedSubmit: guardedSubmit,
    watchForEdits: watchForEdits,
  };
})();
