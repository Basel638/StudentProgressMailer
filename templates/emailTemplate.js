self.SPM = self.SPM || {};

const COLORS = {
  primary: "#00298D",
  white: "#FFFFFF",
  light: "#F5F7FA",
  border: "#E5E7EB",
  text: "#1F2937",
  gray: "#6B7280",
  success: "#16A34A",
  warning: "#FFC107",
  danger: "#DC2626",
};

const STYLES = {
  card: `background:${COLORS.white}; border:1px solid ${COLORS.border}; border-radius:8px; overflow:hidden; box-shadow:0 10px 30px rgba(0,32,96,.06);`,
};

function iconImg(cid) {
  return `<img src="cid:${cid}" width="24" height="24" alt="" style="display:block;margin:0 auto;border:0;outline:none;">`;
}

const ICONS = {
  user: iconImg("icon-user"),
  submission: iconImg("icon-submission"),
  rate: iconImg("icon-rate"),
  certificate: iconImg("icon-certificate"),
};

function escapeHtml(value) {
  return (value || "")
    .toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
function valueOrDash(value) {
  return value === undefined || value === null || value === "" ? "-" : value;
}

function getShortName(name) {
  if (!name) return "Student";

  return name.trim().split(/\s+/).slice(0, 2).join(" ");
}

function buildSectionTitle(title, badgeCid) {
  return `
    <tr>
      <td class="mob-px" style="padding:15px 40px 25px 40px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
          <tr>
            <td width="50%" style="vertical-align:middle;"><hr style="border:none; border-top:1px solid #cbd5e0; margin:0;"></td>
            <td style="padding:0 35px; white-space:nowrap; text-align:center; vertical-align:middle;">
              <img src="cid:${badgeCid}" width="24" height="24" alt="" style="display:inline-block; vertical-align:middle; margin-right:8px; border:0; outline:none;">
              <span class="mob-title" style="font-size:16px; font-weight:700; color:${COLORS.primary}; vertical-align:middle;">${title}</span>
            </td>
            <td width="50%" style="vertical-align:middle;"><hr style="border:none; border-top:1px solid #cbd5e0; margin:0;"></td>
          </tr>
        </table>
      </td>
    </tr>
  `;
}

function buildInfoCard(icon, title, value, isLast = false) {
  return `
    <td class="mob-card-p" style="width:25%; text-align:center; padding:20px 10px; vertical-align: top; ${!isLast ? `border-right:1px solid ${COLORS.border};` : ""}">
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
        <tr><td style="padding-bottom: 15px;">${icon}</td></tr>
        <tr><td style="font-size:11px; font-weight:700; color:${COLORS.primary}; text-transform:uppercase; height: 32px; vertical-align: top; padding-top: 5px;">${title}</td></tr>
        <tr><td style="font-size:16px; font-weight:700; color:${COLORS.text}; padding-top: 10px;">${value}</td></tr>
      </table>
    </td>
  `;
}

function buildCertificate(value) {
  const status = (value || "").trim().toLowerCase();
  const ok = status === "eligible";
  return `<span class="mob-text-xs" style="display:inline-block; padding:4px 12px; background:${ok ? COLORS.primary : COLORS.success}; color:white; font-size:14px; font-weight:bold; border-radius:4px;">${escapeHtml(value || "-")}</span>`;
}

// Max ("out of") scores for assignments/exams come from the sheet itself
// (row 8, read in sheetParser.js) and travel along on student.maxScores.
// If a student object doesn't have one for some reason, we fall back to
// an empty map instead of guessing - assignmentBadge/examScoreColor then
// just skip percent-based color grading for that item.
function getMaxScores(student) {
  const maxScores = (student && student.maxScores) || {};
  return {
    assignments: maxScores.assignments || {},
    exams: maxScores.exams || {},
  };
}

// Reads however many "assignment_N" fields actually exist on the student
// object (driven entirely by the sheet's own "Ass N" columns), instead of
// assuming a fixed count.
function getAssignmentNumbers(student) {
  return Object.keys(student || {})
    .filter((key) => /^assignment_\d+$/.test(key))
    .map((key) => parseInt(key.split("_")[1], 10))
    .sort((a, b) => a - b);
}

// Reads however many "total_N" (exam) fields actually exist on the student
// object, instead of assuming exactly two exams.
function getExamNumbers(student) {
  return Object.keys(student || {})
    .filter((key) => /^total_\d+$/.test(key))
    .map((key) => parseInt(key.split("_")[1], 10))
    .sort((a, b) => a - b);
}

// Some sheets mark an assignment as complete with a word ("done", "Done",
// "DONE", ...) instead of a numeric score. Detect that case-insensitively
// so the word survives into the email instead of being swallowed by the
// numeric parsing below and shown as a dash.
function doneStatusText(raw) {
  const text = (raw === undefined || raw === null ? "" : raw)
    .toString()
    .trim();
  const match = text.match(/done/i);
  return match ? match[0] : null;
}

function assignmentBadge(score, maxScore) {
  const done = doneStatusText(score);
  if (done) {
    return `<span class="mob-text-xs" style="font-size:13px; font-weight:700; color:${COLORS.success};">${escapeHtml(done)}</span>`;
  }

  const value = Number(score);
  if (isNaN(value))
    return `<span class="mob-text-xs" style="font-size:13px; font-weight:700; color:${COLORS.gray};">-</span>`;
  // If we don't know the max score for this assignment (e.g. the sheet's
  // row 8 didn't have one for this column), show the raw score without
  // guessing at a color grade.
  let color = COLORS.text;
  if (typeof maxScore === "number" && maxScore > 0) {
    const percent = (value / maxScore) * 100;
    color = COLORS.success;
    if (percent < 60) color = COLORS.danger;
    else if (percent < 85) color = COLORS.warning;
  }
  return `<span class="mob-text-xs" style="font-size:13px; font-weight:700; color:${color};">${value}</span>`;
}

function examScoreColor(score, maxScore) {
  if (doneStatusText(score)) return COLORS.success;
  const value = Number(score);
  if (isNaN(value)) return COLORS.gray;
  if (typeof maxScore === "number" && maxScore > 0) {
    const percent = (value / maxScore) * 100;
    if (percent >= 85) return COLORS.success;
    if (percent >= 60) return COLORS.warning;
    return COLORS.danger;
  }
  // Unknown max score - fall back to raw-score thresholds (assumes /100).
  if (value >= 85) return COLORS.success;
  if (value >= 60) return COLORS.warning;
  return COLORS.danger;
}

function buildAssignmentItem(student, index) {
  if (index === null || index === undefined)
    return `<table width="100%" cellpadding="0" cellspacing="0"><tr><td>&nbsp;</td></tr></table>`;
  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
      <tr>
        <td class="mob-card-p mob-text-xs" style="padding:15px 4px; font-size:13px; font-weight:600; color:${COLORS.text}; width:50%; text-align:left;">Ass ${String(index).padStart(2, "0")}</td>
        <td class="mob-card-p" style="padding:15px 4px; width:50%; text-align:center;">${assignmentBadge(student[`assignment_${index}`], getMaxScores(student).assignments[index])}</td>
      </tr>
    </table>
  `;
}

function buildAssignmentRow(student, left, right, bgColor) {
  return `
    <tr style="background:${bgColor};">
      <td class="mob-assign-td" style="width:50%; padding:0 20px; vertical-align:top; border-right:1px solid #EEF2F7;">${buildAssignmentItem(student, left)}</td>
      <td class="mob-assign-td" style="width:50%; padding:0 20px; vertical-align:top;">${buildAssignmentItem(student, right)}</td>
    </tr>
  `;
}

function buildStudentInfo(student) {
  return `
    ${buildSectionTitle("STUDENT INFORMATION", "badge-student")}
    <tr>
      <td class="mob-px" style="padding:0 40px 25px 40px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse; ${STYLES.card}">
          <tr>
            ${buildInfoCard(ICONS.user, "Name", escapeHtml(getShortName(student.name) || "-"))}
            ${buildInfoCard(ICONS.submission, "Number Of<br>Submissions", valueOrDash(student.numberOfSubmissions))}
            ${buildInfoCard(ICONS.rate, "Submission<br>Rate", `${valueOrDash(student.percentSubmissions)}%`)}
            ${buildInfoCard(ICONS.certificate, "Certificate<br>Status", buildCertificate(student.certificateStatus), true)}
          </tr>
        </table>
      </td>
    </tr>
  `;
}

function buildAssignmentsTable(student) {
  const assignmentNumbers = getAssignmentNumbers(student);
  const total = assignmentNumbers.length;

  if (!total) return "";

  const half = Math.ceil(total / 2);
  let rows = "";
  for (let i = 0; i < half; i++) {
    const leftNum = assignmentNumbers[i];
    const rightNum = assignmentNumbers[i + half];
    rows += buildAssignmentRow(
      student,
      leftNum,
      rightNum !== undefined ? rightNum : null,
      i % 2 === 0 ? COLORS.white : "#F7F9FC",
    );
  }
  const maxLabel = total ? assignmentNumbers[total - 1] : 0;
  const headerBar = `
    <tr style="background:${COLORS.primary};">
      <td class="mob-assign-td" style="width:50%; padding:0 20px; vertical-align:middle; border-right:1px solid rgba(255,255,255,0.2);">
        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
          <tr>
            <td class="mob-card-p mob-text-xxs" style="padding:12px 4px; font-size:11px; font-weight:700; text-transform:uppercase; color:${COLORS.white}; width:50%; text-align:left;">Assignment</td>
            <td class="mob-card-p mob-text-xxs" style="padding:12px 4px; font-size:11px; font-weight:700; text-transform:uppercase; color:${COLORS.white}; width:50%; text-align:center;">Score</td>
          </tr>
        </table>
      </td>
      <td class="mob-assign-td" style="width:50%; padding:0 20px; vertical-align:middle;">
        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
          <tr>
            <td class="mob-card-p mob-text-xxs" style="padding:12px 4px; font-size:11px; font-weight:700; text-transform:uppercase; color:${COLORS.white}; width:50%; text-align:left;">Assignment</td>
            <td class="mob-card-p mob-text-xxs" style="padding:12px 4px; font-size:11px; font-weight:700; text-transform:uppercase; color:${COLORS.white}; width:50%; text-align:center;">Score</td>
          </tr>
        </table>
      </td>
    </tr>
  `;
  return `
    ${buildSectionTitle(`ASSIGNMENTS (1 &rarr; ${maxLabel})`, "badge-assignments")}
    <tr>
      <td class="mob-px" style="padding:0 40px 25px 40px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="${STYLES.card}">${headerBar}${rows}</table>
      </td>
    </tr>
  `;
}

function buildExamCard(title, score, maxScore) {
  const hasMax = typeof maxScore === "number" && maxScore > 0;
  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="${STYLES.card}">
      <tr><td align="center" class="mob-card-p mob-text-xxs" style="padding:8px; background:${COLORS.primary}; font-size:12px; font-weight:700; text-transform:uppercase; color:${COLORS.white};">${title}</td></tr>
      <tr><td align="center" class="mob-card-p" style="padding:20px;"><span class="mob-score" style="font-size:24px; font-weight:700; color:${examScoreColor(score, hasMax ? maxScore : undefined)};">${escapeHtml(score)}</span><span class="mob-text-xs" style="font-size:14px; font-weight:500; color:${COLORS.gray};"> / ${hasMax ? maxScore : "-"}</span></td></tr>
    </table>
  `;
}

function buildExamRow(student, leftNum, rightNum) {
  const examMaxScores = getMaxScores(student).exams;
  const leftCard = buildExamCard(
    `Exam ${leftNum}`,
    valueOrDash(student[`total_${leftNum}`]),
    examMaxScores[leftNum],
  );
  const rightCard =
    rightNum !== undefined
      ? buildExamCard(
          `Exam ${rightNum}`,
          valueOrDash(student[`total_${rightNum}`]),
          examMaxScores[rightNum],
        )
      : "";
  return `
    <tr>
      <td width="50%" style="padding-right:10px; vertical-align:top;">${leftCard}</td>
      <td width="50%" style="padding-left:10px; vertical-align:top;">${rightCard}</td>
    </tr>
  `;
}

function buildExamCards(student) {
  const examNumbers = getExamNumbers(student);

  // No "Total" (exam) columns found on this sheet at all - skip the
  // section entirely instead of showing empty "Exam 1 / Exam 2" cards.
  if (!examNumbers.length) return "";

  let rows = "";
  for (let i = 0; i < examNumbers.length; i += 2) {
    rows += buildExamRow(student, examNumbers[i], examNumbers[i + 1]);
  }

  return `
    ${buildSectionTitle("EXAMS", "badge-exams")}
    <tr>
      <td class="mob-px" style="padding:0 40px 25px 40px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
          ${rows}
        </table>
      </td>
    </tr>
  `;
}

function buildFooter() {
  return `
    <tr>
      <td class="mob-px" style="padding:20px 20px; background:${COLORS.primary}; text-align:center; border-radius:0 0 8px 8px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:10px; border-collapse:collapse;">
          <tr>
            <td width="45%" style="vertical-align:middle;"><hr style="border:none; border-top:1px solid rgba(255,255,255,.3); margin:0;"></td>
            <td style="padding:0 25px; text-align:center; font-size:24px; line-height:1; color:white; vertical-align:middle;">❝</td>
            <td width="45%" style="vertical-align:middle;"><hr style="border:none; border-top:1px solid rgba(255,255,255,.3); margin:0;"></td>
          </tr>
        </table>
        <div class="mob-text-xs" style="font-size:13px; line-height:20px; color:white; font-weight:400; margin-bottom:5px;">Consistency beats motivation.<br>Keep solving. Keep building. Keep improving.</div>
        <div class="mob-text-sm" style="font-size:14px; font-weight:700; color:white; margin-bottom:12px;">Your future self will thank you.</div>
        <img src="cid:route-logo" alt="Route" style="width:130px; max-width:45%; height:auto; display:block; margin:auto; border:0; outline:none;">
        <table width="60%" cellpadding="0" cellspacing="0" style="margin:12px auto 0 auto; border-collapse:collapse;"><tr><td style="border-top:1px solid rgba(255,255,255,.3);"></td></tr></table>
      </td>
    </tr>
  `;
}

function buildHeader() {
  return `
    <tr>
      <td class="mob-px" style="background:${COLORS.primary}; padding:5px 0; text-align:center; border-radius:8px 8px 0 0;">
        <img src="cid:route-logo" alt="Route" style="width:200px; max-width:60%; height:auto; display:block; margin:auto; border:0; outline:none;">
      </td>
    </tr>
  `;
}

function buildWelcome(student) {
  return `
    <tr>
      <td class="mob-px" style="padding:25px 40px 20px 40px;">
        <div class="mob-title" style="font-size:22px; font-weight:700; color:${COLORS.primary}; margin-bottom:10px;">Hi ${escapeHtml(getShortName(student.name))} 👋</div>
        <div class="mob-text-xs" style="font-size:14px; line-height:1.5; color:${COLORS.text}; margin-bottom:8px;">We're proud of the effort you've been putting into your learning journey.<br>Every assignment you complete and every challenge you overcome brings you one step closer to becoming a professional software engineer.</div>
        <div class="mob-text-xs" style="font-size:14px; font-weight:700; color:${COLORS.primary}; margin-bottom:8px;">Keep learning, stay consistent, and never stop improving.</div>
        <div class="mob-text-xs" style="font-size:14px; color:${COLORS.text};">Here is your latest progress report.</div>
      </td>
    </tr>
  `;
}

function buildEmailForStudent(student) {
  const subject = `Route Academy | Progress Report |  ${getShortName(student.name)}`;
  const html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  @media only screen and (max-width: 600px) {
    .main-wrapper { padding: 10px !important; }
    .mob-px { padding-left: 10px !important; padding-right: 10px !important; }
    .mob-card-p { padding: 10px 2px !important; }
    .mob-text-xxs { font-size: 8px !important; }
    .mob-text-xs { font-size: 10px !important; }
    .mob-text-sm { font-size: 12px !important; }
    .mob-title { font-size: 16px !important; }
  }
</style>
</head>
<body class="main-wrapper" style="margin:0; padding:40px 20px; background:${COLORS.light}; font-family:'Segoe UI',Arial,sans-serif;">
<table align="center" width="100%" cellpadding="0" cellspacing="0" style="background:${COLORS.white}; border-radius:8px; overflow:hidden; box-shadow:0 10px 30px rgba(0,32,96,.08); border-collapse:collapse; max-width:700px; margin: 0 auto;">
<tbody>
  ${buildHeader(student)}
  ${buildWelcome(student)}
  ${buildStudentInfo(student)}
  ${buildAssignmentsTable(student)}
  ${buildExamCards(student)}
  ${buildFooter()}
</tbody>
</table>
</body>
</html>
`;
  return { subject, html };
}

SPM.buildEmailForStudent = buildEmailForStudent;
