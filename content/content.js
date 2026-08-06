console.log("Student Progress Mailer Loaded");

// Pull the spreadsheet ID and active sheet (gid) straight out of the URL,
// e.g. https://docs.google.com/spreadsheets/d/<ID>/edit#gid=<GID>
function extractSheetInfo(url) {
  const idMatch = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  const gidMatch = url.match(/[#&]gid=([0-9]+)/);
  return {
    spreadsheetId: idMatch ? idMatch[1] : null,
    gid: gidMatch ? gidMatch[1] : "0",
  };
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case "GET_PAGE_INFO": {
      const { spreadsheetId, gid } = extractSheetInfo(window.location.href);
      sendResponse({
        title: document.title,
        url: window.location.href,
        hostname: window.location.hostname,
        spreadsheetId,
        gid,
      });
      break;
    }
  }
  // keep the message channel open for the async-looking response above
  return true;
});
