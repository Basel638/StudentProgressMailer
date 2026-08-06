self.SPM = self.SPM || {};

/*=================================================
  Gmail strips <svg> tags and blocks "data:" image
  URIs in sent mail for security reasons. The only
  reliable way to embed images in a real sent email
  is as inline attachments referenced by Content-ID
  (cid:) inside a multipart/related MIME message.

  This module is the single source of truth mapping
  cid name -> base64 PNG data, used by:
    - templates/emailTemplate.js  (writes <img src="cid:...">)
    - services/gmailApi.js        (attaches the actual bytes)
    - popup/popup.js              (swaps cid: -> data: for the
                                    in-popup iframe preview, since
                                    cid: only resolves inside a real
                                    multipart email, not an iframe)
==================================================*/

function buildEmailAssets() {
  return [
    { cid: "route-logo", mimeType: "image/png", base64: SPM.ROUTE_LOGO },
    { cid: "icon-user", mimeType: "image/png", base64: SPM.ICON_PNG.user },
    {
      cid: "icon-submission",
      mimeType: "image/png",
      base64: SPM.ICON_PNG.submission,
    },
    { cid: "icon-rate", mimeType: "image/png", base64: SPM.ICON_PNG.rate },
    {
      cid: "icon-certificate",
      mimeType: "image/png",
      base64: SPM.ICON_PNG.certificate,
    },
    {
      cid: "badge-student",
      mimeType: "image/png",
      base64: SPM.BADGE_PNG.student,
    },
    {
      cid: "badge-assignments",
      mimeType: "image/png",
      base64: SPM.BADGE_PNG.assignments,
    },
    {
      cid: "badge-exams",
      mimeType: "image/png",
      base64: SPM.BADGE_PNG.exams,
    },
  ];
}

// Swaps every `cid:name` reference in the HTML for the matching
// `data:<mime>;base64,<data>` URI. Used ONLY for the popup preview
// iframe, which can't resolve cid: references the way a real mail
// client can.
function resolveCidForPreview(html) {
  let out = html;
  buildEmailAssets().forEach((asset) => {
    const dataUri = `data:${asset.mimeType};base64,${asset.base64.replace(/\s+/g, "")}`;
    out = out.split(`cid:${asset.cid}`).join(dataUri);
  });
  return out;
}

SPM.buildEmailAssets = buildEmailAssets;
SPM.resolveCidForPreview = resolveCidForPreview;
