import { CONFIG, FREE_OPEN } from "./config.js";
import { verifyLicense } from "./license.js";
import { loadState, saveState, putImage, getImage, deleteImage } from "./store.js";

const KINDS = [
  ["certificate", "Certificate"],
  ["deed", "Deed or papers"],
  ["cheque", "Cheque book"],
  ["device", "Device"],
  ["keys", "Keys"],
  ["other", "Something else"],
];

const root = document.getElementById("app");
const mem = {
  state: null,
  status: "",
  draft: null,
  draftKey: "",
  ask: null,
  urls: new Map(),
};

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => {
    if (c === "&") return "\u0026amp;";
    if (c === "<") return "\u0026lt;";
    if (c === ">") return "\u0026gt;";
    if (c === '"') return "\u0026quot;";
    return "\u0026#39;";
  });
}

function uid() {
  return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2, 10);
}

function today() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function kindLabel(kind) {
  return KINDS.find((k) => k[0] === kind)?.[1] || "Something else";
}

function paid() {
  return !!mem.state.license;
}

function openItems() {
  return mem.state.items.filter((item) => !item.closedAt);
}

function daysOut(since) {
  if (!since) return null;
  const t = Date.parse(`${since}T00:00:00`);
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.floor((Date.now() - t) / 86400000));
}

function dayPhrase(since) {
  const n = daysOut(since);
  if (n === null) return "No date";
  if (n === 0) return "Out since today";
  if (n === 1) return "Out for 1 day";
  return `Out for ${n} days`;
}

function upiLink() {
  if (!CONFIG.upiId) return "";
  const params = new URLSearchParams({
    pa: CONFIG.upiId,
    pn: CONFIG.payeeName || "Amanat",
    am: CONFIG.amount,
    cu: CONFIG.currency,
    tn: CONFIG.payNote,
  });
  return `upi://pay?${params.toString()}`;
}

function route() {
  const parts = (location.hash.replace(/^#/, "") || "/").split("/").filter(Boolean);
  return { name: parts[0] || "home", id: parts[1] || "" };
}

function go(hash) {
  if (location.hash === hash) render();
  else location.hash = hash;
}

function snapshot() {
  const form = document.getElementById("sheet");
  if (!form || !mem.draft) return;
  mem.draft = {
    ...mem.draft,
    title: form.title.value.trim(),
    kind: form.kind.value,
    holder: form.holder.value.trim(),
    since: form.since.value,
    promised: form.promised.value.trim(),
    note: form.note.value.trim(),
  };
}

function loadDraft(r) {
  const key = `${r.name}:${r.id}`;
  if (mem.draftKey === key) return;
  mem.draftKey = key;
  if (r.name === "item") {
    const item = mem.state.items.find((row) => row.id === r.id);
    mem.draft = item ? { ...item } : null;
    return;
  }
  if (r.name === "new") {
    mem.draft = {
      id: "",
      title: "",
      kind: "certificate",
      holder: "",
      since: today(),
      promised: "",
      note: "",
      photoId: "",
      closedAt: "",
      returnNote: "",
    };
  }
}

function nav(name) {
  const item = (href, id, label) =>
    `<a href="${href}" class="${name === id ? "on" : ""}">${label}</a>`;
  return `<nav class="nav">${item("#/", "home", "Out")}${item("#/closed", "closed", "Returned")}${item("#/settings", "settings", "Settings")}</nav>`;
}

function statusLine() {
  return mem.status ? `<p class="status" role="status">${esc(mem.status)}</p>` : "";
}

function askBox() {
  if (!mem.ask) return "";
  return `<section class="panel ask">
    <h2>${esc(mem.ask.title)}</h2>
    <p>${esc(mem.ask.body)}</p>
    <div class="actions">
      <button class="btn primary" type="button" data-act="ask-yes">${esc(mem.ask.yes)}</button>
      <button class="btn quiet" type="button" data-act="ask-no">Not now</button>
    </div>
  </section>`;
}

function homeView() {
  const rows = openItems().slice().sort((a, b) => (daysOut(b.since) || 0) - (daysOut(a.since) || 0));
  const cards = rows.length
    ? rows.map((item) => `<a class="card link" href="#/item/${item.id}">
        <p class="kicker">${esc(kindLabel(item.kind))}</p>
        <h2>${esc(item.title)}</h2>
        <p class="fine">${esc(item.holder || "Nobody named")} · ${esc(dayPhrase(item.since))}</p>
      </a>`).join("")
    : `<section class="panel">
        <h2>Nothing is out.</h2>
        <p>A degree at the college office. A sale deed with the broker. A laptop at the repair shop. Write down who has it. Do not keep a photo of the paper itself.</p>
      </section>`;
  return `<header class="mast">
      <p class="brand">Amanat</p>
      <p class="brand-note">Originals that are not in the house.</p>
    </header>
    <p class="kicker">Still out</p>
    <h1>${rows.length === 0 ? "All of it is home." : rows.length === 1 ? "One thing is out." : `${rows.length} things are out.`}</h1>
    ${statusLine()}
    ${askBox()}
    <div class="actions"><a class="btn primary" href="#/new">Add something</a></div>
    <div class="stack">${cards}</div>
    ${nav("home")}`;
}

function closedView() {
  const rows = mem.state.items.filter((item) => item.closedAt).sort((a, b) => String(b.closedAt).localeCompare(String(a.closedAt)));
  const cards = rows.length
    ? rows.map((item) => `<a class="card link" href="#/item/${item.id}">
        <p class="kicker">Came home ${esc(item.closedAt)}</p>
        <h2>${esc(item.title)}</h2>
        <p class="fine">Was with ${esc(item.holder || "someone unnamed")}</p>
      </a>`).join("")
    : `<section class="panel"><h2>Nothing has come home yet.</h2><p>When you get an original back, open it and mark it returned. The list of what is still out stays the point of the app.</p></section>`;
  return `<header class="mast"><p class="brand">Amanat</p></header>
    <p class="kicker">Returned</p>
    <h1>Back in the house.</h1>
    ${statusLine()}
    <div class="stack">${cards}</div>
    ${nav("closed")}`;
}

function formView(r) {
  if (r.name === "item" && !mem.draft) {
    return `<header class="mast"><p class="brand">Amanat</p></header><h1>That one is gone.</h1><a class="btn" href="#/">Back</a>${nav("home")}`;
  }
  const d = mem.draft;
  const editing = r.name === "item";
  const options = KINDS.map(([value, label]) => `<option value="${value}"${d.kind === value ? " selected" : ""}>${label}</option>`).join("");
  const photo = d.photoId
    ? `<img class="shot" alt="Receipt or handover, not the document" data-photo="${esc(d.photoId)}">`
    : "";
  const photoControl = paid()
    ? `<div class="actions">
        <label class="btn quiet file-btn">Photo of the receipt<input id="photo" type="file" accept="image/*"></label>
        ${d.photoId ? `<button class="btn quiet" type="button" data-act="clear-photo">Remove photo</button>` : ""}
      </div>
      <p class="fine">The receipt, a slip, or the counter. Not the certificate, the deed, or the cheque.</p>`
    : `<p class="fine">A photo of the receipt is part of the one-time unlock. The record itself is not.</p>`;
  const returned = d.closedAt
    ? `<section class="panel"><p class="kicker">Came home</p><h2>${esc(d.closedAt)}</h2><p>${esc(d.returnNote || "No note.")}</p>
        <button class="btn quiet" type="button" data-act="reopen">It's out again</button></section>`
    : `<div class="actions"><button class="btn" type="button" data-act="close">It came home</button></div>`;
  return `<header class="mast"><a class="brand" href="#/">Amanat</a></header>
    <p class="kicker">${editing ? esc(kindLabel(d.kind)) : "New"}</p>
    <h1>${editing ? esc(d.title || "Untitled") : "Who has it?"}</h1>
    ${statusLine()}
    ${askBox()}
    <form id="sheet" class="stack" onsubmit="return false">
      <label class="field" for="title">What is out</label>
      <input id="title" name="title" maxlength="80" required value="${esc(d.title)}" placeholder="Degree certificate, sale deed, house key">
      <label class="field" for="kind">Kind</label>
      <select id="kind" name="kind">${options}</select>
      <label class="field" for="holder">Who has it</label>
      <input id="holder" name="holder" maxlength="80" value="${esc(d.holder)}" placeholder="College office, the broker, the repair shop">
      <label class="field" for="since">Since</label>
      <input id="since" name="since" type="date" value="${esc(d.since)}">
      <label class="field" for="promised">What they said</label>
      <input id="promised" name="promised" maxlength="160" value="${esc(d.promised)}" placeholder="After verification. After the repair. Next Tuesday.">
      <label class="field" for="note">Note for yourself</label>
      <textarea id="note" name="note" maxlength="500" rows="3">${esc(d.note)}</textarea>
      ${photo}
      ${photoControl}
      <div class="actions">
        <button class="btn primary" type="button" data-act="save">${editing ? "Save" : "Keep this"}</button>
        ${editing ? `<button class="btn" type="button" data-act="print">Return note</button>` : ""}
        ${editing ? `<button class="btn danger" type="button" data-act="delete">Delete</button>` : ""}
      </div>
      ${editing ? returned : ""}
    </form>
    <div class="print-sheet" id="print-sheet"></div>
    ${nav(editing ? "home" : "home")}`;
}

function settingsView() {
  const link = upiLink();
  const pay = mem.state.license
    ? `<section class="panel"><p class="kicker">Unlocked</p><h2>${esc(mem.state.license.name)}</h2><p>This phone can keep more than ${FREE_OPEN} originals out, attach a receipt photo, and print a return note.</p></section>`
    : `<section class="panel">
        <p class="kicker">${esc(CONFIG.priceLabel)}</p>
        <h2>More than ${FREE_OPEN} out at once.</h2>
        <p>The free list holds ${FREE_OPEN} originals. The unlock adds a longer list, a photo of the receipt, and a note you can hand to the person holding it. One payment, on this phone, checked here. Nothing is sent to confirm it.</p>
        ${link ? `<a class="btn primary" href="${esc(link)}">Pay by UPI</a>` : `<p class="fine">The pay button appears after you put a UPI id in js/config.js and publish that file. Until then, you can still issue a code from the license desk.</p>`}
        <label class="field" for="code">Code</label>
        <textarea id="code" rows="3" placeholder="AMANAT1...."></textarea>
        <div class="actions"><button class="btn primary" type="button" data-act="unlock">Save code</button></div>
      </section>`;
  return `<header class="mast"><p class="brand">Amanat</p></header>
    <p class="kicker">Settings</p>
    <h1>On this phone only.</h1>
    ${statusLine()}
    ${pay}
    <section class="panel">
      <h2>A copy for yourself</h2>
      <p>The backup is a file you download. It is the way to change phones. There is no account to sign into.</p>
      <div class="actions">
        <button class="btn" type="button" data-act="export">Download backup</button>
        <label class="btn quiet file-btn">Restore<input id="restore" type="file" accept="application/json"></label>
      </div>
    </section>
    <section class="panel">
      <h2>What this is not</h2>
      <p>Not a scanner. Not a place to store the document. If a paper is sensitive, the only thing worth writing is who has it and what they promised.</p>
      <p class="fine">A person who edits the page source can ignore the lock. That is the cost of an app with no server. The code still has to be signed by the private key, which is not in the app.</p>
    </section>
    ${nav("settings")}`;
}

function render() {
  const r = route();
  if (!mem.state) return;
  if (r.name === "new" || r.name === "item") {
    const key = `${r.name}:${r.id}`;
    if (mem.draftKey === key) snapshot();
    else loadDraft(r);
  } else {
    mem.draftKey = "";
  }
  const who = r.name === "home" ? "home" : r.name;
  const body = r.name === "new" || r.name === "item"
    ? formView(r)
    : r.name === "closed"
      ? closedView()
      : r.name === "settings"
        ? settingsView()
        : homeView();
  root.innerHTML = `<div class="screen">${body}</div>`;
  document.body.dataset.route = who;
  hydrate();
}

function hydrate() {
  for (const img of root.querySelectorAll("[data-photo]")) {
    const id = img.dataset.photo;
    if (mem.urls.has(id)) {
      img.src = mem.urls.get(id);
      continue;
    }
    getImage(id).then((blob) => {
      if (!blob || !img.isConnected) return;
      const url = URL.createObjectURL(blob);
      mem.urls.set(id, url);
      img.src = url;
    }).catch(() => {});
  }
}

function itemFromDraft() {
  const d = mem.draft;
  return {
    id: d.id || uid(),
    title: d.title.slice(0, 80),
    kind: KINDS.some((k) => k[0] === d.kind) ? d.kind : "other",
    holder: d.holder.slice(0, 80),
    since: d.since,
    promised: d.promised.slice(0, 160),
    note: d.note.slice(0, 500),
    photoId: d.photoId || "",
    closedAt: d.closedAt || "",
    returnNote: d.returnNote || "",
  };
}

function fillPrint(item) {
  const sheet = document.getElementById("print-sheet");
  if (!sheet) return;
  const when = today();
  sheet.innerHTML = `<p class="kicker">Amanat</p>
    <h1>Please return this.</h1>
    <p><strong>${esc(item.title || "Untitled")}</strong> has been with ${esc(item.holder || "you")} since ${esc(item.since || "a date that was not written down")}.</p>
    ${item.promised ? `<p>What was said: ${esc(item.promised)}</p>` : ""}
    <p>Please hand it back. A photo of the document is not attached, on purpose.</p>
    <p class="sign">Date ${esc(when)}</p>
    <p class="sign">Received back by ______________________________</p>
    <p class="fine">This note was written on the phone that keeps the list. It is a reminder, not a legal demand.</p>`;
}

async function resizeImage(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("image"));
      el.src = url;
    });
    const max = 1280;
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.72));
    if (!blob) throw new Error("image");
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function blobToData(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function onClick(event) {
  const btn = event.target.closest("[data-act]");
  if (!btn) return;
  const act = btn.dataset.act;
  if (act === "ask-no") {
    mem.ask = null;
    mem.status = "";
    render();
    return;
  }
  if (act === "ask-yes") {
    const pending = mem.ask;
    mem.ask = null;
    if (pending?.act === "delete") await removeItem(pending.id);
    if (pending?.act === "close") await closeItem(pending.id);
    return;
  }
  if (act === "save") {
    snapshot();
    if (!mem.draft.title) {
      mem.status = "Name the thing that is out.";
      render();
      return;
    }
    const next = itemFromDraft();
    const exists = mem.state.items.some((item) => item.id === next.id);
    if (!exists && !next.closedAt && !paid() && openItems().length >= FREE_OPEN) {
      mem.status = `The free list holds ${FREE_OPEN}. Open Settings for the one-time unlock.`;
      render();
      return;
    }
    mem.state.items = exists
      ? mem.state.items.map((item) => (item.id === next.id ? next : item))
      : [next, ...mem.state.items];
    await saveState(mem.state);
    mem.status = "Saved on this phone.";
    mem.draftKey = "";
    go(`#/item/${next.id}`);
    return;
  }
  if (act === "delete") {
    snapshot();
    mem.ask = {
      title: "Delete this record?",
      body: "The note and the receipt photo, if there is one, leave this phone.",
      yes: "Delete",
      act: "delete",
      id: mem.draft.id,
    };
    render();
    return;
  }
  if (act === "close") {
    snapshot();
    if (!mem.draft?.id) return;
    mem.ask = {
      title: "Mark it returned?",
      body: "It leaves the out list. You can put it back if that was early.",
      yes: "It came home",
      act: "close",
      id: mem.draft.id,
    };
    render();
    return;
  }
  if (act === "reopen") {
    snapshot();
    const next = itemFromDraft();
    if (!paid() && openItems().length >= FREE_OPEN) {
      mem.status = `The free list already has ${FREE_OPEN} out.`;
      go("#/settings");
      return;
    }
    next.closedAt = "";
    next.returnNote = "";
    mem.state.items = mem.state.items.map((item) => (item.id === next.id ? next : item));
    await saveState(mem.state);
    mem.draftKey = "";
    mem.status = "It's out again.";
    go(`#/item/${next.id}`);
    return;
  }
  if (act === "clear-photo") {
    snapshot();
    if (mem.draft.photoId) {
      await deleteImage(mem.draft.photoId);
      mem.urls.delete(mem.draft.photoId);
      mem.draft.photoId = "";
    }
    mem.status = "Photo removed.";
    render();
    return;
  }
  if (act === "print") {
    snapshot();
    if (!paid()) {
      mem.status = "The return note is part of the unlock.";
      go("#/settings");
      return;
    }
    const next = itemFromDraft();
    fillPrint(next);
    render();
    fillPrint(mem.state.items.find((item) => item.id === next.id) || next);
    window.print();
    return;
  }
  if (act === "unlock") {
    const code = document.getElementById("code")?.value || "";
    const payload = await verifyLicense(code);
    if (!payload) {
      mem.status = "That code doesn't match.";
      render();
      return;
    }
    mem.state.license = { code: code.trim(), name: payload.name, at: payload.iat };
    await saveState(mem.state);
    mem.status = `Unlocked for ${payload.name}.`;
    render();
    return;
  }
  if (act === "export") await downloadBackup();
}

async function removeItem(id) {
  const item = mem.state.items.find((row) => row.id === id);
  if (item?.photoId) {
    await deleteImage(item.photoId);
    mem.urls.delete(item.photoId);
  }
  mem.state.items = mem.state.items.filter((row) => row.id !== id);
  await saveState(mem.state);
  mem.draftKey = "";
  mem.status = "Deleted.";
  go("#/");
}

async function closeItem(id) {
  snapshot();
  const next = itemFromDraft();
  if (next.id !== id) return;
  next.closedAt = today();
  mem.state.items = mem.state.items.map((item) => (item.id === id ? next : item));
  await saveState(mem.state);
  mem.draftKey = "";
  mem.status = "Marked as home.";
  go("#/closed");
}

async function downloadBackup() {
  const items = [];
  for (const item of mem.state.items) {
    let photo = "";
    if (item.photoId) {
      const blob = await getImage(item.photoId);
      if (blob) photo = await blobToData(blob);
    }
    items.push({ ...item, photo });
  }
  const payload = { app: "amanat", version: 1, items, license: mem.state.license };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "amanat-backup.json";
  a.click();
  mem.status = "Backup downloaded. Keep that file.";
  render();
}

async function onChange(event) {
  const input = event.target;
  if (input.id === "photo" && input.files?.[0]) {
    if (!paid()) {
      mem.status = "Receipt photos are part of the unlock.";
      go("#/settings");
      return;
    }
    snapshot();
    try {
      const blob = await resizeImage(input.files[0]);
      const id = uid();
      await putImage(id, blob);
      if (mem.draft.photoId) {
        await deleteImage(mem.draft.photoId);
        mem.urls.delete(mem.draft.photoId);
      }
      mem.draft.photoId = id;
      mem.status = "Photo kept on this phone.";
    } catch {
      mem.status = "That photo could not be read.";
    }
    render();
    return;
  }
  if (input.id === "restore" && input.files?.[0]) {
    await restore(input.files[0]);
  }
}

async function restore(file) {
  if (file.size > 20 * 1024 * 1024) {
    mem.status = "That file is too large.";
    render();
    return;
  }
  try {
    const data = JSON.parse(await file.text());
    if (data.app !== "amanat" || !Array.isArray(data.items)) throw new Error("shape");
    const items = [];
    for (const raw of data.items) {
      if (!raw || typeof raw.title !== "string") continue;
      const item = {
        id: typeof raw.id === "string" ? raw.id : uid(),
        title: raw.title.slice(0, 80),
        kind: KINDS.some((k) => k[0] === raw.kind) ? raw.kind : "other",
        holder: String(raw.holder || "").slice(0, 80),
        since: String(raw.since || ""),
        promised: String(raw.promised || "").slice(0, 160),
        note: String(raw.note || "").slice(0, 500),
        photoId: "",
        closedAt: String(raw.closedAt || ""),
        returnNote: String(raw.returnNote || "").slice(0, 200),
      };
      if (typeof raw.photo === "string" && /^data:image\/(jpeg|png|webp);base64,/.test(raw.photo)) {
        const blob = await (await fetch(raw.photo)).blob();
        item.photoId = uid();
        await putImage(item.photoId, blob);
      }
      items.push(item);
    }
    let license = null;
    if (data.license?.code) license = await accepted(data.license.code);
    mem.state = { version: 1, items, license: license || mem.state.license };
    if (!mem.state.license) {
      const open = items.filter((item) => !item.closedAt);
      if (open.length > FREE_OPEN) {
        mem.status = "Backup restored. Paste the unlock code to add more, or leave the extra rows as they are.";
      }
    }
    await saveState(mem.state);
    mem.draftKey = "";
    if (!mem.status) mem.status = "Backup restored on this phone.";
    render();
  } catch {
    mem.status = "That file is not an Amanat backup.";
    render();
  }
}

async function accepted(code) {
  const payload = await verifyLicense(code);
  if (!payload) return null;
  return { code: String(code).trim(), name: payload.name, at: payload.iat };
}

async function boot() {
  mem.state = await loadState();
  if (mem.state.license?.code) {
    const kept = await accepted(mem.state.license.code);
    mem.state.license = kept;
  }
  addEventListener("hashchange", () => {
    mem.ask = null;
    render();
  });
  root.addEventListener("click", (event) => {
    onClick(event).catch(() => {
      mem.status = "Something on this phone refused to save.";
      render();
    });
  });
  root.addEventListener("change", (event) => {
    onChange(event).catch(() => {
      mem.status = "That file could not be read.";
      render();
    });
  });
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(() => {});
  render();
}

boot();
