self.SPM = self.SPM || {};

// Base64url-encode, handling UTF-8 (Arabic names, etc.) correctly.
function base64UrlEncode(str) {
  const utf8 = unescape(encodeURIComponent(str));
  const b64 = btoa(utf8);
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function encodeSubject(subject) {
  return `=?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`;
}

// Splits a base64 string into 76-char lines, as required by the
// quoted-printable/base64 MIME transfer encoding spec.
function chunkBase64(b64) {
  const clean = b64.replace(/\s+/g, "");
  return clean.match(/.{1,76}/g).join("\r\n");
}

// Builds a multipart/related MIME message: an HTML part plus one
// inline image part per attachment, each referenced from the HTML
// via cid:<attachment.cid>. This is the format real mail clients
// (Gmail included) actually render inline images from — unlike
// data: URIs or raw <svg>, which Gmail strips/blocks on receipt.
function buildMimeMessage(to, subject, html, attachments = [], from = "") {
  const boundary = `spm_boundary_${Date.now()}_${Math.random().toString(36).slice(2)}`;

  const parts = [
    `To: ${to}`,
    ...(from ? [`From: ${from}`] : []),
    "MIME-Version: 1.0",
    `Subject: ${encodeSubject(subject)}`,
    `Content-Type: multipart/related; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: 7bit",
    "",
    html,
    "",
  ];

  attachments.forEach((att) => {
    parts.push(
      `--${boundary}`,
      `Content-Type: ${att.mimeType}`,
      "Content-Transfer-Encoding: base64",
      `Content-ID: <${att.cid}>`,
      `Content-Disposition: inline; filename="${att.cid}.png"`,
      "",
      chunkBase64(att.base64),
      "",
    );
  });

  parts.push(`--${boundary}--`, "");

  return parts.join("\r\n");
}

async function sendEmail(token, to, subject, html, attachments = [], from = "") {
  const raw = base64UrlEncode(
    buildMimeMessage(to, subject, html, attachments, from),
  );

  const res = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw }),
    }
  );

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Gmail API error ${res.status}: ${body}`);
  }
  return res.json();
}

SPM.sendEmail = sendEmail;
