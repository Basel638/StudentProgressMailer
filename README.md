# Route Student Progress Report

## Why data was showing as 0

The original `content.js` never actually read the spreadsheet — it only
grabbed the page title/URL. This update adds real Google Sheets API
integration and a header-driven parser, so it now reads your columns
(Email, Name, WhatsApp, CodeForces Handle, Comments, Certificate Status,
% Of Submissions, Number of submissions, Ass 1-8, Q1-4, etc.) by matching
the header row text, not fixed column letters. It also detects your
"Group N : ..." rows and tags each student with their group, and skips
the "No. of Submitted" / "% of Submitted" summary rows.

## Required one-time setup: OAuth Client ID

Reading a Google Sheet through the API requires the user to sign in with
Google and grant permission. That needs an OAuth Client ID from Google
Cloud Console — there's no way around this step, it's a one-time setup:

1. **Load the unpacked extension first** so you know its ID:
   - Go to `chrome://extensions`, enable Developer Mode, click
     "Load unpacked", select the `StudentProgressMailer` folder.
   - Copy the "ID" shown under the extension (a 32-character string).

2. **Create OAuth credentials in Google Cloud Console**
   (https://console.cloud.google.com/apis/credentials):
   - Create a new project (or pick an existing one).
   - Enable the **Google Sheets API** (APIs & Services → Library).
   - Configure the OAuth consent screen (External is fine for testing;
     add your own Google account as a test user).
   - Go to Credentials → Create Credentials → OAuth Client ID.
   - Application type: **Chrome Extension**.
   - Paste the extension ID from step 1 into "Item ID".
   - Copy the generated Client ID (ends in `.apps.googleusercontent.com`).

3. **Paste the Client ID into `manifest.json`**, replacing
   `YOUR_OAUTH_CLIENT_ID.apps.googleusercontent.com`.

4. Go back to `chrome://extensions` and click the reload icon on the
   extension to pick up the manifest change.

5. Open any Google Sheet, click the extension icon. The first time,
   Chrome will show a Google sign-in/consent popup — approve it, and the
   student list should populate from your sheet.

## Notes

- Your sheet doesn't need a fixed column layout: any column is matched by
  its header text (case/spacing-insensitive), so reordering or adding
  columns won't break it. Only the "Email" header is required to exist —
  that's how the reader finds row 8 (your header row) automatically.
- If you rename a header to something not in `utils/columnMap.js`, it
  still comes through (under an auto-generated key based on the label)
  instead of being dropped — but assignments/quizzes should keep the
  "Ass N" / "QN" naming to map correctly.
