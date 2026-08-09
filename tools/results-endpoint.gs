/**
 * wearefeminismm — post-survey aggregate endpoint
 * =============================================================================
 * Paste this into Apps Script, deploy it as a Web App, and paste the resulting
 * /exec URL into DATA_URL at the top of js/results.js. That is the only thing
 * the website needs. It never needs access to the form, the sheet, or any
 * account.
 *
 * WHY AN ENDPOINT AND NOT A PUBLISHED SHEET: this returns tallies and nothing
 * else. Publishing the responses sheet to the web would put every individual
 * response row on the open internet. The survey is answered by minors, and
 * "anonymous" is not the same as "safe to publish" — a free-text answer can
 * identify someone even when no name field exists. Only counts cross the wire,
 * which is the same rule the pulse survey endpoint follows.
 *
 * -----------------------------------------------------------------------------
 * SETUP
 * 1. Open the RESPONSES SPREADSHEET for the form (not the form itself).
 * 2. Copy its ID from the URL:
 *      docs.google.com/spreadsheets/d/<-- THIS BIT -->/edit
 *    and paste it into SHEET_ID below.
 * 3. Extensions ▸ Apps Script. Delete whatever is there, paste this whole file.
 * 4. Check TAB_NAME matches the response tab's name at the bottom of the sheet.
 * 5. Run ▸ doGet once, and grant the permission prompt (it is asking to read
 *    your own spreadsheet).
 * 6. Deploy ▸ New deployment ▸ type "Web app".
 *      Execute as:      Me
 *      Who has access:  Anyone            <-- must be "Anyone", not "Anyone with Google account"
 * 7. Copy the /exec URL. Paste it into DATA_URL in js/results.js.
 *
 * TO TEST: open the /exec URL in a browser. You should see JSON with three
 * statements and their counts, and no student's individual answers anywhere.
 * -----------------------------------------------------------------------------
 */

var SHEET_ID = 'PASTE_THE_RESPONSES_SPREADSHEET_ID_HERE';
var TAB_NAME = 'Form Responses 1';

/* Each entry matches ONE column of the grid question. The match is a
   lower-cased substring test against the sheet's header row, so it keeps
   working if the full header is long or gets lightly reworded. Keep these in
   the same order as the statements in js/results.js. */
var STATEMENTS = [
  'no longer think learning about feminism is boring',
  'know about the different waves',
  'taught more broadly in schools'
];

/* The scale as the form writes it into the sheet. If your form says
   "Disagree" where this says "No", fix it HERE to match the sheet exactly,
   or those responses will be counted as zero. */
var SCALE = ['Strongly Disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly Agree'];

function doGet() {
  var out = { statements: [], on: '' };

  try {
    var sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(TAB_NAME);
    if (!sheet) throw new Error('No tab named "' + TAB_NAME + '"');

    var values = sheet.getDataRange().getValues();
    if (values.length < 2) return json(out);          // headers only, no responses yet

    var headers = values.shift().map(function (h) {
      return String(h).toLowerCase();
    });

    out.statements = STATEMENTS.map(function (needle) {
      var col = headers.indexOf(needle.toLowerCase());
      if (col === -1) {
        col = indexOfContaining(headers, needle.toLowerCase());
      }

      var counts = {};
      SCALE.forEach(function (k) { counts[k] = 0; });

      if (col !== -1) {
        values.forEach(function (row) {
          var answer = String(row[col] || '').trim();
          if (!answer) return;                        // skipped this row: not counted
          // tolerate case and stray spacing coming out of the sheet
          var key = matchScale(answer);
          if (key) counts[key]++;
        });
      }

      return { statement: needle, counts: counts, found: col !== -1 };
    });

    out.on = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'd MMMM yyyy');
  } catch (err) {
    out.error = String(err);
  }

  return json(out);
}

function indexOfContaining(headers, needle) {
  for (var i = 0; i < headers.length; i++) {
    if (headers[i].indexOf(needle) !== -1) return i;
  }
  return -1;
}

function matchScale(answer) {
  var a = answer.toLowerCase().replace(/\s+/g, ' ');
  for (var i = 0; i < SCALE.length; i++) {
    if (SCALE[i].toLowerCase() === a) return SCALE[i];
  }
  return null;   // an unrecognised value is dropped rather than guessed at
}

function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
