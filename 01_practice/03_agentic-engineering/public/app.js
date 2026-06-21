"use strict";

/* ------------------------------------------------------------------ *
 * 채팅방 요약 도우미 (프런트엔드)
 * CSV 파싱·통계·기간 필터는 브라우저에서. 요약만 /api/summarize 로 보낸다.
 * ------------------------------------------------------------------ */

// 컬럼명 자동 인식용 동의어 (KakaoTalk 내보내기는 Date,User,Message).
const COLUMN_SYNONYMS = {
  date: ["date", "일시", "시간", "날짜", "거래일시", "timestamp"],
  user: ["user", "name", "이름", "보낸사람", "발신자", "닉네임", "sender"],
  message: ["message", "msg", "내용", "메시지", "text", "본문"],
};

// 요약에서 제외할 시스템/잡음 메시지 패턴.
const SYSTEM_PATTERNS = [
  /님이 (나갔|들어왔|초대|입장|퇴장)/,
  /님을 초대했습니다/,
  /채팅방 관리자가/,
  /^사진$/, /^이모티콘$/, /^동영상$/, /^삭제된 메시지/,
];

// 소프트 상한: 직렬화 길이가 이보다 크면 기간을 좁히도록 안내.
const MAX_CHARS = 300_000;

const WEEK_MS = 7 * 86400000;

let records = [];      // { date: Date, user, message }
let maxDate = null;    // 가장 최근 메시지 시각
let minDate = null;
let activePreset = "7d";

/* ---------------------------- CSV 읽기 ---------------------------- */

function decodeBuffer(buffer) {
  const bytes = new Uint8Array(buffer);
  const utf8 = new TextDecoder("utf-8").decode(bytes);
  const broken = (utf8.match(/�/g) || []).length;
  if (broken > 0) {
    try {
      return new TextDecoder("euc-kr").decode(bytes);
    } catch (e) {
      return utf8;
    }
  }
  return utf8;
}

// 따옴표 필드·필드 내 콤마/개행을 처리하는 CSV 파서.
function parseCSV(text) {
  const rows = [];
  let field = "";
  let row = [];
  let inQuotes = false;
  text = text.replace(/^﻿/, ""); // BOM 제거

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field); field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      rows.push(row); row = [];
    } else field += c;
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }

  return rows
    .map((r) => r.map((c) => c.trim()))
    .filter((r) => r.some((c) => c !== ""));
}

function normHeader(h) {
  return String(h).toLowerCase().replace(/\s/g, "");
}

// 헤더 배열에서 date/user/message 컬럼 인덱스를 찾는다. 못 찾으면 위치로 추정.
function mapColumns(header) {
  const norms = header.map(normHeader);
  const idx = { date: -1, user: -1, message: -1 };
  for (const key of Object.keys(COLUMN_SYNONYMS)) {
    for (const name of COLUMN_SYNONYMS[key]) {
      const hit = norms.findIndex((h) => h === name || h.includes(name));
      if (hit >= 0) { idx[key] = hit; break; }
    }
  }
  // 위치 기반 폴백: [날짜, 사용자, 메시지]
  if (idx.date < 0) idx.date = 0;
  if (idx.user < 0) idx.user = 1;
  if (idx.message < 0) idx.message = 2;
  return idx;
}

// "2026-04-03 02:17:46", "2026.4.3 2:17" 등을 Date로.
function parseDate(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  const m = s.match(/(\d{4})\D(\d{1,2})\D(\d{1,2})(?:\D+(\d{1,2})\D(\d{1,2})(?:\D(\d{1,2}))?)?/);
  if (m) {
    const d = new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0));
    return isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function isSystemMessage(msg) {
  if (!msg) return true;
  return SYSTEM_PATTERNS.some((re) => re.test(msg));
}

/* --------------------------- 흐름 제어 --------------------------- */

function handleText(text) {
  hideError();
  const rows = parseCSV(text);
  if (rows.length < 2) {
    showError("파일에서 데이터를 찾지 못했어요. 내용을 확인해 주세요.");
    return;
  }
  const header = rows[0];
  const idx = mapColumns(header);

  records = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const date = parseDate(r[idx.date]);
    const user = (r[idx.user] || "").trim();
    const message = (r[idx.message] || "").trim();
    if (!date || !message || isSystemMessage(message)) continue;
    records.push({ date, user: user || "(알 수 없음)", message });
  }

  if (records.length === 0) {
    showError("유효한 메시지를 찾지 못했어요. Date · User · Message 컬럼이 있는지 확인해 주세요.");
    return;
  }

  records.sort((a, b) => a.date - b.date);
  minDate = records[0].date;
  maxDate = records[records.length - 1].date;

  buildDashboard();
  document.getElementById("upload-section").hidden = true;
  document.getElementById("dashboard").hidden = false;
  document.getElementById("result-section").hidden = true;
}

/* --------------------------- 통계/대시보드 --------------------------- */

function buildDashboard() {
  const counts = {};
  for (const r of records) counts[r.user] = (counts[r.user] || 0) + 1;
  const participants = Object.keys(counts).length;
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 3);

  const cards = [
    { label: "총 메시지", value: records.length.toLocaleString() + "건", hero: true },
    { label: "분석 기간", value: `${fmtDate(minDate)} ~ ${fmtDate(maxDate)}` },
    { label: "참여자", value: participants + "명" },
    { label: "가장 활발한 사람", value: top.length ? top[0][0] : "-", sub: top.length ? top[0][1] + "건" : "" },
  ];
  document.getElementById("summary-cards").innerHTML = cards.map((c) => `
    <div class="summary-item${c.hero ? " hero" : ""}">
      <div class="label">${esc(c.label)}</div>
      <div class="value">${esc(c.value)}</div>
      ${c.sub ? `<div class="sub">${esc(c.sub)}</div>` : ""}
    </div>`).join("");

  // 기간 프리셋
  const presets = [
    { id: "today", label: "오늘" },
    { id: "3d", label: "최근 3일" },
    { id: "7d", label: "최근 7일" },
    { id: "all", label: "전체" },
  ];
  document.getElementById("period-presets").innerHTML = presets.map((p) =>
    `<button type="button" class="chip${p.id === activePreset ? " active" : ""}" data-preset="${p.id}">${p.label}</button>`
  ).join("");

  // 커스텀 날짜 기본값
  document.getElementById("range-start").value = isoDate(new Date(maxDate.getTime() - WEEK_MS));
  document.getElementById("range-end").value = isoDate(maxDate);

  updatePeriodMeta();
}

// 현재 선택된 기간의 [start, end] 범위를 구한다.
function currentRange() {
  if (activePreset === "custom") {
    const s = document.getElementById("range-start").value;
    const e = document.getElementById("range-end").value;
    const start = s ? new Date(s + "T00:00:00") : minDate;
    const end = e ? new Date(e + "T23:59:59") : maxDate;
    return [start, end];
  }
  const end = maxDate;
  let start;
  if (activePreset === "today") start = new Date(maxDate.getFullYear(), maxDate.getMonth(), maxDate.getDate());
  else if (activePreset === "3d") start = new Date(maxDate.getTime() - 3 * 86400000);
  else if (activePreset === "7d") start = new Date(maxDate.getTime() - WEEK_MS);
  else start = minDate; // all
  return [start, end];
}

function filteredRecords() {
  const [start, end] = currentRange();
  return records.filter((r) => r.date >= start && r.date <= end);
}

function serialize(recs) {
  return recs.map((r) => `[${fmtDateTime(r.date)}] ${r.user}: ${r.message}`).join("\n");
}

function updatePeriodMeta() {
  const recs = filteredRecords();
  const text = serialize(recs);
  const meta = document.getElementById("period-meta");
  const big = text.length > MAX_CHARS;
  meta.innerHTML = `
    <span>선택 구간 <strong>${recs.length.toLocaleString()}</strong>건 · 약 ${text.length.toLocaleString()}자</span>
    ${big ? `<span class="warn">⚠️ 너무 많아요. 기간을 좁혀 주세요(최대 ${MAX_CHARS.toLocaleString()}자).</span>` : ""}
  `;
  document.getElementById("summarize").disabled = recs.length === 0 || big;
}

/* --------------------------- 요약 호출 --------------------------- */

async function summarize() {
  const recs = filteredRecords();
  if (recs.length === 0) return;
  const text = serialize(recs);
  const [start, end] = currentRange();
  const users = new Set(recs.map((r) => r.user));
  const meta = `[메타] 기간: ${fmtDateTime(start)} ~ ${fmtDateTime(end)} · 메시지 ${recs.length}건 · 참여자 ${users.size}명`;

  setLoading(true);
  hideError();
  try {
    const res = await fetch("/api/summarize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, meta }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `요청 실패 (${res.status})`);
    renderSummary(data.summary, data.model);
  } catch (err) {
    showError(err.message || "요약 중 오류가 발생했어요.");
  } finally {
    setLoading(false);
  }
}

function renderSummary(md, model) {
  document.getElementById("summary-output").innerHTML = renderMarkdown(md || "");
  document.getElementById("result-model").textContent = model ? `· ${model}` : "";
  const section = document.getElementById("result-section");
  section.hidden = false;
  section.scrollIntoView({ behavior: "smooth", block: "start" });
}

/* --------------------------- 마크다운 (제한적) --------------------------- */

// ## 제목, - 불릿, - [ ] 체크박스, **굵게**, 문단만 처리하는 가벼운 렌더러.
function renderMarkdown(md) {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  let html = "";
  let listType = null; // "ul" | "check" | null

  const closeList = () => { if (listType) { html += "</ul>"; listType = null; } };
  const inline = (s) => esc(s).replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { closeList(); continue; }

    let m;
    if ((m = line.match(/^#{1,6}\s+(.*)$/))) {
      closeList();
      html += `<h3>${inline(m[1])}</h3>`;
    } else if ((m = line.match(/^[-*]\s+\[( |x|X)\]\s+(.*)$/))) {
      if (listType !== "check") { closeList(); html += '<ul class="checklist">'; listType = "check"; }
      const done = m[1].toLowerCase() === "x";
      html += `<li><input type="checkbox" disabled ${done ? "checked" : ""}/> <span>${inline(m[2])}</span></li>`;
    } else if ((m = line.match(/^[-*]\s+(.*)$/))) {
      if (listType !== "ul") { closeList(); html += "<ul>"; listType = "ul"; }
      html += `<li>${inline(m[1])}</li>`;
    } else {
      closeList();
      html += `<p>${inline(line)}</p>`;
    }
  }
  closeList();
  return html;
}

/* --------------------------- 유틸 --------------------------- */

function pad(n) { return String(n).padStart(2, "0"); }
function fmtDate(d) { return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`; }
function fmtDateTime(d) { return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`; }
function isoDate(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function showError(msg) {
  const el = document.getElementById("parse-error");
  el.textContent = msg;
  el.hidden = false;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
}
function hideError() { document.getElementById("parse-error").hidden = true; }

function setLoading(on) {
  document.getElementById("loading").hidden = !on;
  document.getElementById("summarize").disabled = on;
}

function readFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onerror = () => showError("파일을 읽지 못했어요.");
  reader.onload = (e) => handleText(decodeBuffer(e.target.result));
  reader.readAsArrayBuffer(file);
}

function resetApp() {
  records = [];
  minDate = maxDate = null;
  activePreset = "7d";
  document.getElementById("file-input").value = "";
  document.getElementById("upload-section").hidden = false;
  document.getElementById("dashboard").hidden = true;
  document.getElementById("result-section").hidden = true;
  hideError();
}

/* --------------------------- 이벤트 --------------------------- */

document.addEventListener("DOMContentLoaded", () => {
  const dropzone = document.getElementById("dropzone");
  const input = document.getElementById("file-input");

  dropzone.addEventListener("click", () => input.click());
  input.addEventListener("change", (e) => readFile(e.target.files[0]));

  ["dragenter", "dragover"].forEach((ev) =>
    dropzone.addEventListener(ev, (e) => { e.preventDefault(); dropzone.classList.add("dragover"); }));
  ["dragleave", "drop"].forEach((ev) =>
    dropzone.addEventListener(ev, (e) => { e.preventDefault(); dropzone.classList.remove("dragover"); }));
  dropzone.addEventListener("drop", (e) => readFile(e.dataTransfer.files[0]));

  document.getElementById("load-sample").addEventListener("click", loadSample);
  document.getElementById("summarize").addEventListener("click", summarize);
  document.getElementById("reset").addEventListener("click", resetApp);

  // 프리셋 칩
  document.getElementById("period-presets").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-preset]");
    if (!btn) return;
    activePreset = btn.dataset.preset;
    document.querySelectorAll("#period-presets .chip").forEach((c) =>
      c.classList.toggle("active", c.dataset.preset === activePreset));
    updatePeriodMeta();
  });

  // 커스텀 날짜 변경 → custom 모드
  ["range-start", "range-end"].forEach((id) =>
    document.getElementById(id).addEventListener("change", () => {
      activePreset = "custom";
      document.querySelectorAll("#period-presets .chip").forEach((c) => c.classList.remove("active"));
      updatePeriodMeta();
    }));
});

/* --------------------------- 샘플 데이터 --------------------------- */

function loadSample() {
  fetch("/sample_chat.csv")
    .then((r) => r.arrayBuffer())
    .then((buf) => handleText(decodeBuffer(buf)))
    .catch(() => showError("샘플을 불러오지 못했어요."));
}
