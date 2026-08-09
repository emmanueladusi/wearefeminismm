/**
 * wearefeminismm — shared wall endpoint
 * =============================================================================
 * Storage and moderation for the public wall (wall.html + js/wall.js).
 *
 * DESIGN RULES THIS ENFORCES, not just supports:
 *  1. Nothing is public until a human approves it. doPost writes every post
 *     with status "pending". doGet only ever returns rows marked "approved".
 *     There is no code path that publishes a post automatically.
 *  2. No identity is stored. No name, no login, no IP, no email. A post has a
 *     random id and a device token, and the token exists ONLY so the writer
 *     can delete their own post and cannot support the same post twice.
 *  3. Reports pull a post straight back out of public view. A reported post
 *     returns to "pending" immediately, before any human looks at it.
 *  4. The private reflection wall on voice.html is untouched by all of this.
 *     It never had a server and still does not.
 *
 * -----------------------------------------------------------------------------
 * SETUP
 * 1. Make a NEW spreadsheet (do not reuse a survey sheet). Copy its ID from
 *    the URL: docs.google.com/spreadsheets/d/<-- THIS BIT -->/edit
 * 2. Paste it into SHEET_ID below.
 * 3. Extensions ▸ Apps Script, paste this whole file, save.
 * 4. Run ▸ setup   (creates the two tabs with their headers). Grant the prompt.
 * 5. Deploy ▸ New deployment ▸ Web app.
 *      Execute as:     Me
 *      Who has access: Anyone        <-- must be "Anyone"
 * 6. Paste the /exec URL into DATA_URL at the top of js/wall.js.
 *
 * HOW YOU MODERATE
 *   Open the Posts tab. Every new row arrives as "pending".
 *   Type "approved" in the status column to publish it.
 *   Type "removed"  to reject it. Nothing else is needed, and a removed row
 *   stays in the sheet so you have a record.
 *
 * A NOTE ON POST: browsers refuse a cross-origin POST with a JSON content
 * type unless the server answers a preflight, and Apps Script cannot. So the
 * client sends text/plain, which counts as a "simple request" and skips the
 * preflight. The body is still JSON; only the header is a lie of convenience.
 * -----------------------------------------------------------------------------
 */

var SHEET_ID = 'PASTE_A_NEW_SPREADSHEET_ID_HERE';
var POSTS = 'Posts';
var VOTES = 'Support';

var MAX_LEN = 1200;          // longest post we accept
var REPORTS_TO_HIDE = 1;     // one report is enough to pull a post from view
var RATE_LIMIT_SECONDS = 20; // per device, between posts

function setup() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  if (!ss.getSheetByName(POSTS)) {
    ss.insertSheet(POSTS).appendRow(
      ['id', 'parentId', 'createdAt', 'body', 'status', 'support', 'reports', 'device', 'note']);
  }
  if (!ss.getSheetByName(VOTES)) {
    ss.insertSheet(VOTES).appendRow(['postId', 'device', 'at']);
  }
  return 'ready';
}

/* ------------------------------- read -------------------------------- */

function doGet(e) {
  try {
    var rows = sheet(POSTS).getDataRange().getValues();
    rows.shift();

    var out = [];
    rows.forEach(function (r) {
      if (String(r[4]).toLowerCase() !== 'approved') return;   // the gate
      out.push({
        id: String(r[0]),
        parentId: String(r[1] || ''),
        at: r[2] ? new Date(r[2]).toISOString() : '',
        body: String(r[3]),
        support: Number(r[5]) || 0
        // NOTE: the device column is never returned. It is not the client's.
      });
    });
    return json({ ok: true, posts: out });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
}

/* ------------------------------- write ------------------------------- */

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(8000);
    var req = JSON.parse(e.postData.contents || '{}');
    var device = String(req.device || '').slice(0, 64);
    if (!device) return json({ ok: false, error: 'no device token' });

    if (req.action === 'post')    return addPost(req, device);
    if (req.action === 'support') return addSupport(req, device);
    if (req.action === 'report')  return addReport(req);
    if (req.action === 'remove')  return removeOwn(req, device);
    return json({ ok: false, error: 'unknown action' });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  } finally {
    try { lock.releaseLock(); } catch (ignored) {}
  }
}

function addPost(req, device) {
  var body = String(req.body || '').trim();
  if (!body) return json({ ok: false, error: 'empty' });
  if (body.length > MAX_LEN) return json({ ok: false, error: 'too long' });

  var sh = sheet(POSTS);
  var rows = sh.getDataRange().getValues();

  // one post per device per RATE_LIMIT_SECONDS, so a bad afternoon cannot
  // become two hundred rows in your moderation queue
  var now = new Date();
  for (var i = rows.length - 1; i > 0; i--) {
    if (String(rows[i][7]) !== device) continue;
    var age = (now - new Date(rows[i][2])) / 1000;
    if (age < RATE_LIMIT_SECONDS) {
      return json({ ok: false, error: 'slow down', retryIn: Math.ceil(RATE_LIMIT_SECONDS - age) });
    }
    break;
  }

  var parentId = String(req.parentId || '');
  if (parentId && !findRow(rows, parentId)) return json({ ok: false, error: 'no such post' });

  var id = Utilities.getUuid().slice(0, 8);
  sh.appendRow([id, parentId, now, body, 'pending', 0, 0, device, '']);
  // deliberately returns the pending post so the writer sees their own words
  // waiting, rather than a form that appears to have swallowed them
  return json({ ok: true, pending: true, post: { id: id, parentId: parentId, at: now.toISOString(), body: body, support: 0 } });
}

function addSupport(req, device) {
  var id = String(req.id || '');
  var votes = sheet(VOTES);
  var seen = votes.getDataRange().getValues();
  for (var i = 1; i < seen.length; i++) {
    if (String(seen[i][0]) === id && String(seen[i][1]) === device) {
      return json({ ok: false, error: 'already' });   // one per device, silently
    }
  }
  var sh = sheet(POSTS);
  var rows = sh.getDataRange().getValues();
  var r = findRow(rows, id);
  if (!r) return json({ ok: false, error: 'no such post' });

  var next = (Number(rows[r][5]) || 0) + 1;
  sh.getRange(r + 1, 6).setValue(next);
  votes.appendRow([id, device, new Date()]);
  return json({ ok: true, support: next });
}

function addReport(req) {
  var sh = sheet(POSTS);
  var rows = sh.getDataRange().getValues();
  var r = findRow(rows, String(req.id || ''));
  if (!r) return json({ ok: false, error: 'no such post' });

  var n = (Number(rows[r][6]) || 0) + 1;
  sh.getRange(r + 1, 7).setValue(n);
  // out of sight first, judged second
  if (n >= REPORTS_TO_HIDE) sh.getRange(r + 1, 5).setValue('pending');
  return json({ ok: true });
}

function removeOwn(req, device) {
  var sh = sheet(POSTS);
  var rows = sh.getDataRange().getValues();
  var r = findRow(rows, String(req.id || ''));
  if (!r) return json({ ok: false, error: 'no such post' });
  if (String(rows[r][7]) !== device) return json({ ok: false, error: 'not yours' });
  sh.getRange(r + 1, 5).setValue('removed');
  return json({ ok: true });
}

/* ------------------------------ helpers ------------------------------ */

function sheet(name) {
  var sh = SpreadsheetApp.openById(SHEET_ID).getSheetByName(name);
  if (!sh) throw new Error('Missing tab "' + name + '". Run setup() once.');
  return sh;
}

function findRow(rows, id) {
  for (var i = 1; i < rows.length; i++) if (String(rows[i][0]) === id) return i;
  return 0;
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
