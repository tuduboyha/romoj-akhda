"use strict";

const gateEl = document.getElementById("gate");
const adminKeyInput = document.getElementById("adminKey");
const unlockBtn = document.getElementById("unlockBtn");
const gateErrorEl = document.getElementById("gateError");

const uploadSection = document.getElementById("uploadSection");
const fileInput = document.getElementById("fileInput");
const uploadBtn = document.getElementById("uploadBtn");
const uploadLog = document.getElementById("uploadLog");

const listSection = document.getElementById("listSection");
const listStatusEl = document.getElementById("listStatus");
const trackListEl = document.getElementById("trackList");

function formatSize(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}

function getKey() {
  return sessionStorage.getItem("adminUploadKey") || "";
}

function unlock(key) {
  sessionStorage.setItem("adminUploadKey", key);
  gateEl.hidden = true;
  uploadSection.hidden = false;
  listSection.hidden = false;
  loadTracks();
}

unlockBtn.addEventListener("click", () => {
  const key = adminKeyInput.value.trim();
  if (!key) return;
  gateErrorEl.textContent = "";
  unlock(key);
});

adminKeyInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") unlockBtn.click();
});

fileInput.addEventListener("change", () => {
  uploadBtn.disabled = fileInput.files.length === 0;
});

uploadBtn.addEventListener("click", async () => {
  const files = Array.from(fileInput.files);
  if (!files.length) return;

  uploadBtn.disabled = true;
  uploadLog.innerHTML = "";

  const form = new FormData();
  files.forEach((f) => form.append("files", f));

  try {
    const res = await fetch("api/upload", {
      method: "POST",
      headers: { "X-Admin-Key": getKey() },
      body: form,
    });

    if (res.status === 401) {
      gateEl.hidden = false;
      uploadSection.hidden = true;
      listSection.hidden = true;
      gateErrorEl.textContent = "Wrong password.";
      sessionStorage.removeItem("adminUploadKey");
      return;
    }

    const data = await res.json();
    (data.results || []).forEach((r) => {
      const li = document.createElement("li");
      li.className = r.ok ? "ok" : "fail";
      li.textContent = r.ok ? `✓ ${r.name}` : `✗ ${r.name} — ${r.error}`;
      uploadLog.appendChild(li);
    });
    loadTracks();
  } catch (err) {
    const li = document.createElement("li");
    li.className = "fail";
    li.textContent = `Upload failed: ${err.message}`;
    uploadLog.appendChild(li);
  } finally {
    fileInput.value = "";
    uploadBtn.disabled = true;
  }
});

async function loadTracks() {
  listStatusEl.textContent = "Loading…";
  trackListEl.innerHTML = "";
  try {
    const res = await fetch("api/tracks");
    const data = await res.json();
    const tracks = data.tracks || [];
    listStatusEl.textContent = `${tracks.length} track${tracks.length === 1 ? "" : "s"}`;
    tracks.forEach((t) => {
      const li = document.createElement("li");
      li.innerHTML = `<span class="name">${t.name}</span><span class="size">${formatSize(t.size)}</span>`;
      trackListEl.appendChild(li);
    });
  } catch {
    listStatusEl.textContent = "Couldn't load track list.";
  }
}

if (getKey()) unlock(getKey());
