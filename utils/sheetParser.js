self.SPM = self.SPM || {};

// Ass 1..Ass N and the exam Total columns live on this exact sheet row
// (1-based, matching the row numbers you see in Google Sheets). Their
// positions are always read from here, regardless of which row the
// "Email" header ends up being detected on - that's what was causing
// assignment/exam data to go missing for some students.
const ASSIGNMENTS_HEADER_ROW = 7;

// The max ("out of") score for every "Ass N" and "Total" (exam) column
// lives on this exact sheet row, right under the header row. Read from
// here instead of a hardcoded table, so it always matches whatever the
// sheet actually says.
const MAX_SCORES_ROW = 8;

// Locates the header row by finding the row that has a cell exactly
// equal to "Email".
function findHeaderRowIndex(rows) {
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] || [];
    if (row.some((cell) => SPM.normalizeHeader(cell) === "email")) {
      return i;
    }
  }
  return -1;
}

function isEmailValue(value) {
  return /\S+@\S+\.\S+/.test((value || "").toString().trim());
}

function rowText(row) {
  return (row || [])
    .filter((c) => c && c.toString().trim())
    .join(" ")
    .trim();
}

// Rows like "No. of Submitted" / "% of Submitted"
// are summary rows, not student rows.
function isSummaryRow(text) {
  return (
    /no\.?\s*of\s*submitted/i.test(text) || /%\s*of\s*submitted/i.test(text)
  );
}

// Only these fields are allowed to be copied into the student object.
function isAllowedField(key) {
  if (
    key === "email" ||
    key === "name" ||
    key === "certificateStatus" ||
    key === "percentSubmissions" ||
    key === "numberOfSubmissions"
  ) {
    return true;
  }

  // assignment_1 ... assignment_N (no upper limit - however many "Ass N"
  // columns exist in the sheet are kept)
  if (/^assignment_\d+$/.test(key)) {
    const number = parseInt(key.split("_")[1], 10);
    return number >= 1;
  }

  // total_1, total_2, ... (exam totals)
  if (/^total_\d+$/.test(key)) {
    return true;
  }

  return false;
}

function isAssignmentOrTotalKey(key) {
  return /^assignment_\d+$/.test(key) || /^total_\d+$/.test(key);
}

// Re-maps the assignment_N / total_N entries so they always come from
// ASSIGNMENTS_HEADER_ROW (sheet row 7), instead of whatever row the
// "Email" column happened to be found on. Everything else in colMap
// (email, name, certificate status, etc.) is left untouched.
function applyFixedAssignmentsHeaderRow(colMap, rows) {
  const fixedRowIdx = ASSIGNMENTS_HEADER_ROW - 1;
  const fixedRow = rows[fixedRowIdx];

  // Sheet is shorter than row 7 - nothing to fix, keep the dynamic map.
  if (!fixedRow) return colMap;

  const fixedColMap = SPM.buildColumnMap(fixedRow);

  const merged = {};

  // Keep everything that isn't an assignment/total column as-is.
  Object.entries(colMap).forEach(([idx, info]) => {
    if (!isAssignmentOrTotalKey(info.key)) {
      merged[idx] = info;
    }
  });

  // Overlay the assignment/total columns read strictly from row 7.
  Object.entries(fixedColMap).forEach(([idx, info]) => {
    if (isAssignmentOrTotalKey(info.key)) {
      merged[idx] = info;
    }
  });

  return merged;
}

// Reads the max/"out of" score for each assignment_N and total_N (exam)
// column directly from MAX_SCORES_ROW, using the same column positions as
// colMap. Cells can be a plain number ("6") or something like "Out of 6" -
// either way the first number found in the cell is used.
function extractMaxScores(colMap, rows) {
  const rowIdx = MAX_SCORES_ROW - 1;
  const scoreRow = rows[rowIdx] || [];

  const maxScores = { assignments: {}, exams: {} };

  Object.entries(colMap).forEach(([idx, info]) => {
    const raw = (scoreRow[Number(idx)] || "").toString().trim();

    if (!raw) return;

    const match = raw.match(/[\d.]+/);

    if (!match) return;

    const value = parseFloat(match[0]);

    if (isNaN(value)) return;

    const assignmentMatch = info.key.match(/^assignment_(\d+)$/);

    if (assignmentMatch) {
      maxScores.assignments[parseInt(assignmentMatch[1], 10)] = value;
      return;
    }

    const examMatch = info.key.match(/^total_(\d+)$/);

    if (examMatch) {
      maxScores.exams[parseInt(examMatch[1], 10)] = value;
    }
  });

  return maxScores;
}

function parseSheetRows(rows) {
  const headerIdx = findHeaderRowIndex(rows);

  if (headerIdx === -1) {
    throw new Error("Couldn't find a header row with an 'Email' column.");
  }

  const headerRow = rows[headerIdx];

  let colMap = SPM.buildColumnMap(headerRow);

  colMap = applyFixedAssignmentsHeaderRow(colMap, rows);

  const maxScores = extractMaxScores(colMap, rows);

  let emailColIdx = -1;

  Object.entries(colMap).forEach(([idx, info]) => {
    if (info.key === "email") {
      emailColIdx = Number(idx);
    }
  });

  if (emailColIdx === -1) {
    throw new Error(
      "Found a header row, but couldn't locate the 'Email' column.",
    );
  }

  const students = [];

  let groupBuffer = [];

  let currentGroup = "";

  const firstDataRowIdx =
    Math.max(headerIdx, ASSIGNMENTS_HEADER_ROW - 1, MAX_SCORES_ROW - 1) + 1;

  for (let i = firstDataRowIdx; i < rows.length; i++) {
    const row = rows[i] || [];

    const emailCell = row[emailColIdx];

    const text = rowText(row);

    if (isEmailValue(emailCell)) {
      if (groupBuffer.length) {
        currentGroup = groupBuffer.join(" ").replace(/\s+/g, " ").trim();
        groupBuffer = [];
      }

      const student = {
        group: currentGroup,
        sheetRow: i + 1,
        maxScores,
      };

      Object.entries(colMap).forEach(([idx, info]) => {
        if (!isAllowedField(info.key)) return;

        student[info.key] = (row[Number(idx)] || "").toString().trim();
      });

      students.push(student);
    } else if (!text) {
      groupBuffer = [];
    } else if (isSummaryRow(text)) {
      groupBuffer = [];
    } else {
      groupBuffer.push(text);
    }
  }

  return {
    headerRow,
    colMap,
    students,
    maxScores,
  };
}

SPM.parseSheetRows = parseSheetRows;
