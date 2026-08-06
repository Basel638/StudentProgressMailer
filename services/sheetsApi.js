self.SPM = self.SPM || {};

async function apiFetch(url, token) {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Google Sheets API error ${res.status}: ${body}`);
  }
  return res.json();
}

// gid identifies the *tab* the user currently has open. Sheets values.get
// needs the tab's *title* instead, so we look it up from spreadsheet metadata.
async function getSheetTitleByGid(spreadsheetId, gid, token) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets(properties(sheetId,title))`;
  const data = await apiFetch(url, token);
  const sheets = data.sheets || [];
  const match = sheets.find(
    (s) => String(s.properties.sheetId) === String(gid)
  );
  if (match) return match.properties.title;
  // Fall back to the first tab if we couldn't match the gid.
  return sheets[0]?.properties?.title || null;
}

// Reads a wide, generous range as FORMATTED_VALUE so things like "Done" /
// percentages / checkboxes come back the way they're displayed in the sheet.
async function getSheetValues(spreadsheetId, sheetTitle, token, range = "A1:CZ1000") {
  const encodedRange = encodeURIComponent(`${sheetTitle}!${range}`);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodedRange}?valueRenderOption=FORMATTED_VALUE`;
  const data = await apiFetch(url, token);
  return data.values || [];
}

SPM.getSheetTitleByGid = getSheetTitleByGid;
SPM.getSheetValues = getSheetValues;
