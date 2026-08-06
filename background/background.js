// Runs in the extension's background service worker, which keeps running
// independently of the popup. Sending happens HERE (not in popup.js) so a
// closed/blurred popup can no longer cut a batch send short partway through.
importScripts(
  "../services/sheetsAuth.js",
  "../services/gmailApi.js",
  "../utils/columnMap.js",
  "../utils/sheetParser.js",
  "../assets/logoBase64.js",
  "../assets/iconsBase64.js",
  "../assets/emailAssets.js",
  "../templates/emailTemplate.js",
);

console.log("Background Service Started");

// In-memory snapshot of the most recent/active send job, so a popup that
// gets reopened mid-send (or was closed when the job finished) can ask
// "GET_SEND_STATUS" and pick the state back up instead of showing nothing.
let currentJob = null;

const SEND_DELAY_MS = 250; // small gap between sends to stay under Gmail's per-user rate limits

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isAuthError(err) {
  const msg = String(err?.message || err);
  return msg.includes("401") || /invalid[_ ]?credentials/i.test(msg);
}

function isRateLimitError(err) {
  const msg = String(err?.message || err);
  return msg.includes("429") || /rate.?limit/i.test(msg);
}

// Sends one email, transparently refreshing the auth token and retrying
// once if the token turned out to be expired/invalid, and backing off
// once if Gmail returns a rate-limit error.
async function sendOneEmail(student, fromEmail, token) {
  const { subject, html } = SPM.buildEmailForStudent(student);
  const assets = SPM.buildEmailAssets();

  try {
    return await SPM.sendEmail(token, student.email, subject, html, assets, fromEmail);
  } catch (err) {
    if (isAuthError(err)) {
      await SPM.clearAuthToken(token);
      const freshToken = await SPM.getAuthToken(true);
      currentJob.token = freshToken;
      return await SPM.sendEmail(freshToken, student.email, subject, html, assets, fromEmail);
    }
    if (isRateLimitError(err)) {
      await sleep(2000);
      return await SPM.sendEmail(token, student.email, subject, html, assets, fromEmail);
    }
    throw err;
  }
}

function broadcastProgress() {
  if (!currentJob) return;
  // No listener (popup closed) just rejects silently - that's fine, the
  // job keeps running in the background regardless.
  chrome.runtime.sendMessage({ action: "SEND_PROGRESS", job: publicJob() }).catch(() => {});
}

function publicJob() {
  if (!currentJob) return null;
  const { students, token, ...rest } = currentJob;
  return rest;
}

async function runSendJob(students, fromEmail) {
  const token = await SPM.getAuthToken(true);

  currentJob = {
    total: students.length,
    sent: 0,
    failed: 0,
    done: false,
    token,
  };
  broadcastProgress();

  for (const student of students) {
    try {
      await sendOneEmail(student, fromEmail, currentJob.token);
      currentJob.sent++;
    } catch (err) {
      console.error("Failed to send to", student.email, err);
      currentJob.failed++;
    }
    broadcastProgress();
    await sleep(SEND_DELAY_MS);
  }

  currentJob.done = true;
  broadcastProgress();
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.action === "SEND_EMAILS") {
    if (currentJob && !currentJob.done) {
      sendResponse({ ok: false, error: "A send job is already running." });
      return; // synchronous response, no need to keep channel open
    }
    runSendJob(message.students, message.fromEmail || "");
    sendResponse({ ok: true, job: null });
    return;
  }

  if (message?.action === "GET_SEND_STATUS") {
    sendResponse({ job: publicJob() });
    return;
  }
});
