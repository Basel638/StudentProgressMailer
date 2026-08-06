document.addEventListener("DOMContentLoaded", async () => {
  const infoEl = document.getElementById("sheetInfo");
  const listEl = document.getElementById("studentsList");
  const searchInput = document.getElementById("searchInput");
  const fromEmailInput = document.getElementById("fromEmailInput");
  const selectAllCheckbox = document.getElementById("selectAllCheckbox");

  let allStudents = [];

  // Restore the last-used "send from" address, and remember it whenever
  // the user changes it.
  chrome.storage.local.get(["fromEmail"], (result) => {
    if (result.fromEmail) fromEmailInput.value = result.fromEmail;
  });

  fromEmailInput.addEventListener("change", () => {
    chrome.storage.local.set({ fromEmail: fromEmailInput.value.trim() });
  });

  function setStatus(html, isError = false) {
    infoEl.innerHTML = `<b>${isError ? "⚠️ Error" : "Status"}</b><br>${html}`;
  }

  function renderStudents(students) {
    listEl.innerHTML = "";

    if (!students.length) {
      listEl.innerHTML = "<p>No students found.</p>";
      updateSelectedCount();
      return;
    }

    students.forEach((student) => {
      const row = document.createElement("div");

      row.className = "student";

      row.innerHTML = `
        <input
          type="checkbox"
          data-email="${student.email}"
        >

        <div>

          <div>

            <b>${student.name || "(No Name)"}</b>

            ${
              student.group
                ? `<small style="color:#888;"> — ${student.group}</small>`
                : ""
            }

          </div>

          <div style="font-size:12px;color:#666;">

            ${student.email}

            ·

            Submissions:
            ${student.numberOfSubmissions || 0}

            (${student.percentSubmissions || "0"}%)

          </div>

        </div>
      `;

      listEl.appendChild(row);
    });

    updateSelectedCount();
  }

  function updateSelectAllState() {
    const checkboxes = Array.from(
      listEl.querySelectorAll('input[type="checkbox"]'),
    );

    if (!checkboxes.length) {
      selectAllCheckbox.checked = false;
      selectAllCheckbox.indeterminate = false;
      return;
    }

    const checkedCount = checkboxes.filter((cb) => cb.checked).length;

    selectAllCheckbox.checked = checkedCount === checkboxes.length;
    selectAllCheckbox.indeterminate =
      checkedCount > 0 && checkedCount < checkboxes.length;
  }

  function updateSelectedCount() {
    document.getElementById("selectedCount").textContent =
      listEl.querySelectorAll('input[type="checkbox"]:checked').length;

    updateSelectAllState();
  }

  listEl.addEventListener("change", updateSelectedCount);

  // Selects/deselects every currently-visible (e.g. search-filtered)
  // student checkbox at once.
  selectAllCheckbox.addEventListener("change", () => {
    const checked = selectAllCheckbox.checked;

    listEl.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
      cb.checked = checked;
    });

    selectAllCheckbox.indeterminate = false;

    updateSelectedCount();
  });

  searchInput.addEventListener("input", () => {
    const q = searchInput.value.trim().toLowerCase();

    renderStudents(
      allStudents.filter(
        (student) =>
          (student.name || "").toLowerCase().includes(q) ||
          (student.email || "").toLowerCase().includes(q),
      ),
    );
  });

  function sendMessagePromise(tabId) {
    return new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(
        tabId,
        { action: "GET_PAGE_INFO" },
        (response) => {
          if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
          else resolve(response);
        },
      );
    });
  }

  async function getPageInfo(tabId) {
    try {
      return await sendMessagePromise(tabId);
    } catch {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ["content/content.js"],
      });

      return await sendMessagePromise(tabId);
    }
  }

  function getSelectedStudents() {
    const emails = Array.from(
      listEl.querySelectorAll('input[type="checkbox"]:checked'),
    ).map((cb) => cb.dataset.email);

    return allStudents.filter((student) => emails.includes(student.email));
  }

  function showPreviewModal(students) {
    const overlay = document.createElement("div");
    overlay.className = "spm-overlay";

    const modal = document.createElement("div");
    modal.className = "spm-modal";

    const header = document.createElement("div");
    header.className = "spm-modal-header";

    header.innerHTML = `<b>Preview (${students.length})</b>`;

    const closeBtn = document.createElement("button");

    closeBtn.className = "spm-close";
    closeBtn.textContent = "✕";

    closeBtn.onclick = () => overlay.remove();

    header.appendChild(closeBtn);

    modal.appendChild(header);

    const body = document.createElement("div");

    body.className = "spm-modal-body";

    students.forEach((student) => {
      const { subject, html } = SPM.buildEmailForStudent(student);

      const card = document.createElement("div");

      card.className = "spm-preview-card";

      card.innerHTML = `

        <div style="font-size:12px;color:#666;margin-bottom:5px;">

          To:
          ${student.email}

        </div>

        <div style="font-weight:bold;margin-bottom:8px;">

          ${subject}

        </div>

        <iframe class="spm-preview-frame"></iframe>

      `;

      card.querySelector("iframe").srcdoc = SPM.resolveCidForPreview(html);

      body.appendChild(card);
    });

    modal.appendChild(body);

    overlay.appendChild(modal);

    overlay.onclick = (e) => {
      if (e.target === overlay) overlay.remove();
    };

    document.body.appendChild(overlay);
  }

  document.getElementById("previewBtn").onclick = () => {
    const selected = getSelectedStudents();

    if (!selected.length) return alert("Select at least one student.");

    showPreviewModal(selected);
  };

  const sendBtn = document.getElementById("sendBtn");

  // The actual sending runs in the background service worker (background.js),
  // not here. That way, closing or losing focus on this popup - which Chrome
  // tears down and stops running JS in - can no longer cut a batch send short
  // after just the first student. This popup only shows progress; it sends
  // one "start" message and then just listens.
  function renderJobProgress(job) {
    if (!job) return;

    if (!job.done) {
      sendBtn.disabled = true;
      sendBtn.textContent = `Sending... (${job.sent + job.failed}/${job.total})`;
    } else {
      sendBtn.disabled = false;
      sendBtn.textContent = "Send";
      setStatus(
        `Sent ${job.sent} email(s)${job.failed ? `, ${job.failed} failed` : ""}`,
        job.failed > 0,
      );
    }
  }

  chrome.runtime.onMessage.addListener((message) => {
    if (message?.action === "SEND_PROGRESS") renderJobProgress(message.job);
  });

  // If the popup was closed mid-send and reopened, pick the in-progress
  // (or just-finished) job status back up instead of showing nothing.
  chrome.runtime.sendMessage({ action: "GET_SEND_STATUS" }, (response) => {
    if (chrome.runtime.lastError) return;
    if (response?.job) renderJobProgress(response.job);
  });

  sendBtn.onclick = () => {
    const students = getSelectedStudents();

    if (!students.length) return alert("Select at least one student.");

    if (!confirm(`Send progress emails to ${students.length} student(s)?`))
      return;

    const fromEmail = fromEmailInput.value.trim();

    sendBtn.disabled = true;
    sendBtn.textContent = `Sending... (0/${students.length})`;

    chrome.runtime.sendMessage(
      { action: "SEND_EMAILS", students, fromEmail },
      (response) => {
        if (chrome.runtime.lastError) {
          sendBtn.disabled = false;
          sendBtn.textContent = "Send";
          setStatus(chrome.runtime.lastError.message, true);
          return;
        }
        if (response && response.ok === false) {
          sendBtn.disabled = false;
          sendBtn.textContent = "Send";
          setStatus(response.error, true);
        }
      },
    );
  };

  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    const pageInfo = await getPageInfo(tab.id);

    if (!pageInfo?.spreadsheetId) {
      setStatus("Open a Google Sheet first.", true);

      return;
    }

    setStatus(`Sheet: ${pageInfo.title}<br>Loading...`);

    const token = await SPM.getAuthToken(true);

    const sheetTitle = await SPM.getSheetTitleByGid(
      pageInfo.spreadsheetId,
      pageInfo.gid,
      token,
    );

    const values = await SPM.getSheetValues(
      pageInfo.spreadsheetId,
      sheetTitle,
      token,
    );

    const { students } = SPM.parseSheetRows(values);

    allStudents = students;

    setStatus(
      `Sheet: ${pageInfo.title}<br>Tab: ${sheetTitle}<br>Loaded ${students.length} students.`,
    );

    renderStudents(allStudents);
  } catch (err) {
    console.error(err);

    setStatus(err.message || String(err), true);
  }
});
