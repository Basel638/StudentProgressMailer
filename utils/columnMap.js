self.SPM = self.SPM || {};

// Known header text -> normalized field name.
const HEADER_ALIASES = {
  email: "email",
  name: "name",
  "certificate status": "certificateStatus",
  "% of submissions": "percentSubmissions",
  "number of submissions": "numberOfSubmissions",
};

function normalizeHeader(text) {
  return (text || "").toString().trim().toLowerCase().replace(/\s+/g, " ");
}

function slugify(text) {
  return (text || "")
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

// Turns the header row into { colIndex: { key, label } }.
// Stops entirely the moment it hits a header containing "Bsl" (any case) -
// that column and everything after it in the row is ignored.
function buildColumnMap(headerRow) {
  const map = {};

  let totalCounter = 0;

  const cells = headerRow || [];

  for (let idx = 0; idx < cells.length; idx++) {
    const raw = cells[idx];

    const label = (raw || "").toString().trim();

    if (!label) continue;

    if (/bsl/i.test(label)) break;

    const norm = normalizeHeader(label);

    let key;

    // Known headers
    if (HEADER_ALIASES[norm]) {
      key = HEADER_ALIASES[norm];
    }

    // Ass 1
    // Ass01
    // Ass 09
    // Ass.09
    // Assignment 01
    // Ass 1: Loops
    else if (/^ass/i.test(label) && /\d+/.test(label)) {
      const number = parseInt(label.match(/\d+/)[0], 10);

      key = `assignment_${number}`;
    }

    // Total columns
    else if (norm === "total") {
      totalCounter++;

      key = `total_${totalCounter}`;
    }

    // Any unknown column
    else {
      key = slugify(label);
    }

    map[idx] = {
      key,
      label,
    };
  }

  return map;
}

SPM.buildColumnMap = buildColumnMap;
SPM.normalizeHeader = normalizeHeader;
