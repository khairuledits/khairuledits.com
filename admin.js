/*
  ADMIN PORTFOLIO — JavaScript murni, tanpa server.
  - Isi awal dibaca dari portfolio-data.js (window.PORTFOLIO).
  - Setiap perubahan otomatis disimpan sebagai DRAF di localStorage peramban ini.
  - "Simpan ke berkas" menulis langsung ke portfolio-data.js (Chrome/Edge,
    File System Access API). Peramban lain: berkas diunduh untuk ditimpakan.
  - Seluruh admin baru dijalankan setelah gerbang PIN (admin-gate.js) terbuka.
*/
window.AdminGate.whenUnlocked(() => {
  const U = window.PortfolioUtil;
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const clone = o => JSON.parse(JSON.stringify(o));
  const arr = v => (Array.isArray(v) ? v.filter(x => x && typeof x === "object") : []);
  const str = v => (v == null ? "" : String(v));

  // Pembuat elemen kecil — semua teks lewat textContent, tidak ada innerHTML dari data.
  function h(tag, props, ...kids) {
    const e = document.createElement(tag);
    Object.entries(props || {}).forEach(([k, v]) => {
      if (v == null || v === false) return;
      if (k === "class") e.className = v;
      else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
      else if (k === "value" || k === "checked" || k === "disabled") e[k] = v;
      else e.setAttribute(k, v === true ? "" : v);
    });
    kids.flat().forEach(c => { if (c != null && c !== false) e.append(c instanceof Node ? c : String(c)); });
    return e;
  }

  // ---------- Normalisasi data (menerima format lama maupun baru) ----------
  function normalize(src) {
    const d = clone(src || {});
    const lines = v => (Array.isArray(v) ? v : str(v).split("\n")).map(s => str(s).trim()).filter(Boolean);
    const id = d.identity || {}, so = d.social || {};
    const out = {
      identity: {
        name: str(id.name), displayName: str(id.displayName), title: str(id.title), tagline: str(id.tagline),
        shortDescription: str(id.shortDescription), aboutIntro: str(id.aboutIntro), aboutDescription: str(id.aboutDescription),
        portraitUrl: str(id.portraitUrl), showreelUrl: str(id.showreelUrl), focus: lines(id.focus), tools: lines(id.tools)
      },
      social: {
        instagram: str(so.instagram), personalInstagram: str(so.personalInstagram),
        whatsappNumber: str(so.whatsappNumber).replace(/\D/g, ""), whatsappMessage: str(so.whatsappMessage), email: str(so.email)
      },
      categories: (Array.isArray(d.categories) && d.categories.length ? d.categories : U.DEFAULT_CATEGORIES).map(c => str(c).trim()).filter(Boolean),
      projects: arr(d.projects).map(p => ({
        title: str(p.title), category: str(p.category), year: str(p.year), videoUrl: str(p.videoUrl), thumbnail: str(p.thumbnail),
        description: str(p.description), role: str(p.role), software: str(p.software),
        orientation: ["portrait", "landscape"].includes(p.orientation) ? p.orientation : "", hidden: !!p.hidden
      })),
      testimonials: arr(d.testimonials).map(t => ({ name: str(t.name), role: str(t.role), quote: str(t.quote), consent: t.consent !== false })),
      services: arr(d.services).map(s => ({ number: str(s.number), icon: str(s.icon), title: str(s.title), description: str(s.description) }))
    };
    out.categories = [...new Set(out.categories)];
    out.projects.forEach(p => { if (p.category && !out.categories.includes(p.category)) out.categories.push(p.category); });
    return out;
  }

  // ---------- Keadaan ----------
  const hasFileData = !!window.PORTFOLIO;
  let fileSnapshot = JSON.stringify(normalize(window.PORTFOLIO)); // isi berkas terakhir yang diketahui
  let state;
  let fileHandle = null;
  let activeTab = (location.hash.slice(1) || "projects");
  let projectSearch = "";

  const draft = U.readDraft();
  if (draft && JSON.stringify(normalize(draft.data)) !== fileSnapshot) {
    state = normalize(draft.data);
    notice(`Melanjutkan draf ${new Date(draft.savedAt).toLocaleString("id-ID")} yang belum disimpan ke berkas.`, "Buang draf", discardDraft);
  } else {
    state = normalize(window.PORTFOLIO);
  }
  if (!hasFileData) notice("portfolio-data.js tidak terbaca (berkas hilang atau ada galat sintaks). Admin dimulai dari data kosong — gunakan Impor bila punya cadangan.");

  function commit() {
    U.writeDraft(state);
    updateStatus();
    updateCounts();
  }

  const isDirty = () => JSON.stringify(normalize(state)) !== fileSnapshot;

  function updateStatus() {
    const s = $("#status");
    s.textContent = isDirty() ? "● Ada perubahan yang belum disimpan ke berkas" : "✓ Sama dengan portfolio-data.js";
    s.classList.toggle("dirty", isDirty());
  }

  function updateCounts() {
    $$("[data-count]").forEach(e => { e.textContent = state[e.dataset.count].length; });
  }

  // ---------- Notifikasi ----------
  let toastTimer;
  function toast(msg, kind = "") {
    const t = $("#toast");
    t.textContent = msg;
    t.className = `adm-toast show ${kind}`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.className = "adm-toast"; }, 4200);
  }

  function notice(msg, actionLabel, action) {
    const n = $("#notice");
    n.hidden = false;
    n.append(h("div", { class: "notice-row" }, h("span", null, msg),
      actionLabel ? h("button", { type: "button", class: "btn btn-sm", onclick: action }, actionLabel) : null,
      h("button", { type: "button", class: "icon-btn", "aria-label": "Tutup", onclick: e => { e.target.closest(".notice-row").remove(); if (!n.children.length) n.hidden = true; } }, "×")));
  }

  // ---------- Skema daftar ----------
  const SCHEMA = {
    projects: {
      title: "Proyek", singular: "proyek",
      note: "Proyek tampil di situs bila judul dan URL video terisi dan tidak disembunyikan. Urutan di sini = urutan di situs.",
      fields: [
        { key: "title", label: "Judul", required: true, max: 120 },
        { key: "category", label: "Kategori", type: "select", required: true, options: () => state.categories },
        { key: "year", label: "Tahun", placeholder: String(new Date().getFullYear()), inputmode: "numeric", validate: v => (!v || /^\d{4}$/.test(v) ? "" : "Isi 4 digit tahun, mis. 2026.") },
        { key: "videoUrl", label: "URL video YouTube", type: "url", required: true, placeholder: "https://youtube.com/shorts/…", hint: "Format watch, youtu.be, atau Shorts. Shorts otomatis diputar vertikal.", validate: v => (U.parseYoutube(v).id ? "" : "Bukan URL YouTube yang dikenali.") },
        { key: "orientation", label: "Bentuk kartu & pemutar", type: "select", options: () => ["", "portrait", "landscape"],
          optionLabels: { "": "Otomatis (Shorts = portrait 9:16)", portrait: "Portrait 9:16 (tegak)", landscape: "Landscape 16:9 (mendatar)" },
          hint: "Pilih Portrait untuk video tegak yang diunggah sebagai video biasa (bukan Shorts)." },
        { key: "thumbnail", label: "Thumbnail", placeholder: "Kosongkan = otomatis dari YouTube", hint: "URL gambar langsung (JPG/PNG/WebP) atau path seperti images/proyek.webp." },
        { key: "description", label: "Deskripsi", type: "textarea" },
        { key: "role", label: "Peran", placeholder: "Video Editor" },
        { key: "software", label: "Software", placeholder: "CapCut" },
        { key: "hidden", label: "Sembunyikan dari situs (simpan sebagai draf)", type: "checkbox" }
      ],
      blank: () => ({ title: "", category: state.categories[0] || "", year: String(new Date().getFullYear()), videoUrl: "", thumbnail: "", description: "", role: "", software: "", orientation: "", hidden: false }),
      summary: p => ({
        title: p.title || "(tanpa judul)",
        sub: [p.category, p.year, p.role, U.isPortrait(p) ? "Portrait 9:16" : "Landscape 16:9"].filter(Boolean).join(" · "),
        thumb: p.thumbnail || U.youtubeThumbnail(p.videoUrl),
        badges: [p.hidden && "Tersembunyi", !U.parseYoutube(p.videoUrl).id && "URL video tidak valid", p.category && !state.categories.includes(p.category) && "Kategori tidak ada"].filter(Boolean)
      })
    },
    services: {
      title: "Layanan", singular: "layanan",
      note: "Kartu di bagian Services & focus. Tombol tiap kartu mengarah ke WhatsApp.",
      fields: [
        { key: "number", label: "Nomor", placeholder: "Kosongkan = otomatis", max: 4 },
        { key: "icon", label: "Ikon (satu simbol)", placeholder: "▤", max: 4, hint: "Contoh: ▤ ◉ ▧ ✳ ◆ ✦" },
        { key: "title", label: "Judul layanan", required: true, max: 80 },
        { key: "description", label: "Deskripsi", type: "textarea", required: true }
      ],
      blank: () => ({ number: "", icon: "✦", title: "", description: "" }),
      summary: s => ({ title: s.title || "(tanpa judul)", sub: s.description, lead: [s.number, s.icon].filter(Boolean).join(" ") }),
      beforeSave: () => state.services.forEach((s, i) => { if (!s.number) s.number = String(i + 1).padStart(2, "0"); })
    },
    testimonials: {
      title: "Testimoni", singular: "testimoni",
      note: "Bagian testimoni di situs muncul otomatis begitu ada minimal satu testimoni.",
      fields: [
        { key: "name", label: "Nama klien", required: true, max: 80 },
        { key: "role", label: "Proyek / jabatan", max: 120 },
        { key: "quote", label: "Ulasan", type: "textarea", required: true },
        { key: "consent", label: "Klien sudah mengizinkan ulasan ini ditampilkan", type: "checkbox", validate: v => (v ? "" : "Wajib dicentang — jangan tampilkan testimoni tanpa izin klien.") }
      ],
      blank: () => ({ name: "", role: "", quote: "", consent: false }),
      summary: t => ({ title: t.name || "(tanpa nama)", sub: t.quote, lead: "“" })
    }
  };

  // ---------- Render ----------
  function render() {
    $$("#tabs button").forEach(b => b.classList.toggle("active", b.dataset.tab === activeTab));
    const panel = $("#panel");
    panel.replaceChildren();
    if (SCHEMA[activeTab]) panel.append(renderList(activeTab));
    else if (activeTab === "categories") panel.append(renderCategories());
    else if (activeTab === "identity") panel.append(renderIdentity());
    else if (activeTab === "social") panel.append(renderSocial());
    updateCounts();
    updateStatus();
  }

  function sectionHead(title, note, ...actions) {
    return h("div", { class: "panel-head" }, h("div", null, h("h1", null, title), note ? h("p", { class: "muted" }, note) : null), h("div", { class: "panel-head-actions" }, actions));
  }

  function move(list, i, step) {
    const j = i + step;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    commit(); render();
  }

  function renderList(type) {
    const sc = SCHEMA[type], list = state[type];
    const wrap = h("section", null, sectionHead(sc.title, sc.note,
      type === "services" && list.length ? h("button", { type: "button", class: "btn", onclick: () => { list.forEach((s, i) => { s.number = String(i + 1).padStart(2, "0"); }); commit(); render(); toast("Nomor layanan diurutkan ulang."); } }, "Nomori ulang") : null,
      h("button", { type: "button", class: "btn btn-light", onclick: () => openForm(type, -1) }, `+ Tambah ${sc.singular}`)));

    let indices = list.map((_, i) => i);
    if (type === "projects") {
      const q = projectSearch.toLowerCase();
      const search = h("input", { type: "search", class: "input", placeholder: "Cari judul atau kategori…", value: projectSearch, "aria-label": "Cari proyek" });
      search.addEventListener("input", () => {
        projectSearch = search.value;
        const pos = search.selectionStart;
        render();
        const s = $("#panel input[type=search]"); s.focus(); s.setSelectionRange(pos, pos);
      });
      wrap.append(h("div", { class: "toolbar" }, search));
      if (q) indices = indices.filter(i => `${list[i].title} ${list[i].category}`.toLowerCase().includes(q));
    }
    const filtering = type === "projects" && !!projectSearch;

    if (!list.length) {
      wrap.append(h("div", { class: "empty" }, `Belum ada ${sc.singular}.`, h("button", { type: "button", class: "btn btn-light", onclick: () => openForm(type, -1) }, `+ Tambah ${sc.singular} pertama`)));
      return wrap;
    }
    if (!indices.length) { wrap.append(h("div", { class: "empty" }, "Tidak ada yang cocok dengan pencarian.")); return wrap; }

    const ul = h("ol", { class: "item-list" });
    indices.forEach(i => {
      const item = list[i], s = sc.summary(item);
      const visual = s.thumb !== undefined
        ? h("div", { class: "item-thumb" }, h("span", null, String(i + 1).padStart(2, "0")), s.thumb ? h("img", { src: s.thumb, alt: "", loading: "lazy", onerror: e => e.target.remove() }) : null)
        : h("div", { class: "item-lead" }, s.lead || String(i + 1));
      ul.append(h("li", { class: `item${item.hidden ? " is-hidden" : ""}` },
        visual,
        h("div", { class: "item-body" },
          h("strong", null, s.title),
          s.sub ? h("span", { class: "muted clamp" }, s.sub) : null,
          s.badges && s.badges.length ? h("div", { class: "badges" }, s.badges.map(b => h("span", { class: "badge" }, b))) : null),
        h("div", { class: "item-actions" },
          h("button", { type: "button", class: "icon-btn", title: "Naikkan", "aria-label": "Naikkan", disabled: filtering || i === 0, onclick: () => move(list, i, -1) }, "↑"),
          h("button", { type: "button", class: "icon-btn", title: "Turunkan", "aria-label": "Turunkan", disabled: filtering || i === list.length - 1, onclick: () => move(list, i, 1) }, "↓"),
          type === "projects" ? h("button", { type: "button", class: "icon-btn", title: item.hidden ? "Tampilkan di situs" : "Sembunyikan dari situs", "aria-label": item.hidden ? "Tampilkan" : "Sembunyikan", onclick: () => { item.hidden = !item.hidden; commit(); render(); } }, item.hidden ? "◌" : "◉") : null,
          type === "projects" ? h("button", { type: "button", class: "icon-btn", title: "Duplikat", "aria-label": "Duplikat", onclick: () => { list.splice(i + 1, 0, { ...clone(item), title: `${item.title} (salinan)`, hidden: true }); commit(); render(); toast("Salinan dibuat dan disembunyikan — ubah lalu tampilkan."); } }, "⧉") : null,
          h("button", { type: "button", class: "btn btn-sm", onclick: () => openForm(type, i) }, "Ubah"),
          h("button", { type: "button", class: "icon-btn danger", title: "Hapus", "aria-label": "Hapus", onclick: () => {
            if (!confirm(`Hapus ${sc.singular} "${s.title}"?`)) return;
            list.splice(i, 1); commit(); render(); toast(`${sc.title} dihapus. Belum permanen sampai disimpan ke berkas.`);
          } }, "🗑"))));
    });
    wrap.append(ul);
    return wrap;
  }

  // ---------- Form tambah/ubah (dialog) ----------
  const dialog = $("#dialog");
  let formCtx = null;

  function buildField(f, value) {
    const id = `f-${f.key}`;
    let input;
    if (f.type === "textarea") input = h("textarea", { id, class: "input", rows: 4, placeholder: f.placeholder, value });
    else if (f.type === "select") {
      const opts = f.options();
      input = h("select", { id, class: "input" }, opts.map(o => h("option", { value: o }, (f.optionLabels && f.optionLabels[o]) || o)));
      if (value && !opts.includes(value)) input.prepend(h("option", { value }, `${value} (tidak ada di daftar kategori)`));
      input.value = opts.includes(value) || value ? value : (opts[0] || "");
    } else if (f.type === "checkbox") input = h("input", { id, type: "checkbox", checked: !!value });
    else input = h("input", { id, class: "input", type: f.type === "url" ? "url" : "text", placeholder: f.placeholder, maxlength: f.max, inputmode: f.inputmode, value });
    input.dataset.key = f.key;
    const err = h("p", { class: "field-error", id: `${id}-err` });
    if (f.type === "checkbox") return h("div", { class: "field field-check" }, h("label", { for: id }, input, h("span", null, f.label)), err);
    return h("div", { class: "field" }, h("label", { for: id }, f.label, f.required ? h("em", null, " *") : null), input, f.hint ? h("p", { class: "hint" }, f.hint) : null, err);
  }

  function openForm(type, index) {
    const sc = SCHEMA[type];
    const item = index >= 0 ? state[type][index] : sc.blank();
    formCtx = { type, index };
    $("#dialog-title").textContent = `${index >= 0 ? "Ubah" : "Tambah"} ${sc.singular}`;
    const body = $("#dialog-body");
    body.replaceChildren(...sc.fields.map(f => buildField(f, item[f.key])));
    if (type === "projects") attachProjectPreview(body);
    dialog.showModal();
    const first = body.querySelector("input:not([type=checkbox]), textarea, select");
    if (first) first.focus();
  }

  function attachProjectPreview(body) {
    const video = $("#f-videoUrl", body), thumb = $("#f-thumbnail", body);
    const img = h("img", { alt: "Pratinjau thumbnail" });
    const info = h("span", { class: "muted" });
    const fill = h("button", { type: "button", class: "btn btn-sm", onclick: () => { thumb.value = U.youtubeThumbnail(video.value); update(); } }, "Pakai thumbnail YouTube");
    const box = h("div", { class: "thumb-preview" }, h("div", { class: "thumb-frame" }, img), h("div", null, info, fill));
    thumb.closest(".field").after(box);
    function update() {
      const yt = U.parseYoutube(video.value);
      const src = thumb.value.trim() || U.youtubeThumbnail(video.value);
      img.hidden = !src;
      if (src) { img.src = src; img.onerror = () => { img.hidden = true; info.textContent = "Gambar thumbnail gagal dimuat — periksa URL/path."; }; }
      info.textContent = yt.id ? `ID video ${yt.id} · ${yt.isVertical ? "Shorts (vertikal)" : "video biasa (horizontal)"}` : "Tempel URL YouTube untuk melihat pratinjau.";
      fill.disabled = !yt.id;
    }
    video.addEventListener("input", update);
    thumb.addEventListener("input", update);
    update();
  }

  function readForm() {
    const sc = SCHEMA[formCtx.type], values = {};
    let firstBad = null;
    sc.fields.forEach(f => {
      const input = $(`#f-${f.key}`);
      const v = f.type === "checkbox" ? input.checked : input.value.trim();
      values[f.key] = v;
      let msg = "";
      if (f.required && f.type !== "checkbox" && !v) msg = "Wajib diisi.";
      else if (f.validate) msg = f.validate(v) || "";
      $(`#f-${f.key}-err`).textContent = msg;
      input.setAttribute("aria-invalid", msg ? "true" : "false");
      if (msg && !firstBad) firstBad = input;
    });
    if (formCtx.type === "projects") {
      const dupe = state.projects.findIndex((p, i) => i !== formCtx.index && U.parseYoutube(p.videoUrl).id && U.parseYoutube(p.videoUrl).id === U.parseYoutube(values.videoUrl).id);
      if (dupe >= 0 && !firstBad && !confirm(`Video ini sudah dipakai proyek "${state.projects[dupe].title}". Tetap simpan?`)) return null;
    }
    if (firstBad) { firstBad.focus(); return null; }
    return values;
  }

  $("#dialog-form").addEventListener("submit", e => {
    e.preventDefault();
    if (!formCtx) return;
    const values = readForm();
    if (!values) return;
    const { type, index } = formCtx, sc = SCHEMA[type];
    if (index >= 0) Object.assign(state[type][index], values);
    else state[type].push(values);
    if (sc.beforeSave) sc.beforeSave();
    commit();
    dialog.close();
    render();
    toast(`${sc.title} ${index >= 0 ? "diperbarui" : "ditambahkan"}. Klik "Simpan ke berkas" agar tampil untuk pengunjung.`);
  });
  [$("#dialog-cancel"), $("#dialog-x")].forEach(b => b.addEventListener("click", () => dialog.close()));
  dialog.addEventListener("close", () => { formCtx = null; });

  // ---------- Kategori ----------
  function usage(cat) { return state.projects.filter(p => p.category === cat).length; }

  function categoryError(name, except) {
    if (!name) return "Nama kategori wajib diisi.";
    if (name.toLowerCase() === "all") return "\"All\" dipakai untuk tombol semua proyek.";
    if (state.categories.some(c => c !== except && c.toLowerCase() === name.toLowerCase())) return "Kategori itu sudah ada.";
    return "";
  }

  function renderCategories() {
    const wrap = h("section", null, sectionHead("Kategori", "Menjadi tombol filter di bagian Projects (diawali tombol All). Urutan di sini = urutan tombol."));
    const input = h("input", { class: "input", placeholder: "Nama kategori baru", maxlength: 40, "aria-label": "Nama kategori baru" });
    const err = h("p", { class: "field-error" });
    const add = () => {
      const name = input.value.trim(), msg = categoryError(name);
      err.textContent = msg;
      if (msg) { input.focus(); return; }
      state.categories.push(name); commit(); render(); toast(`Kategori "${name}" ditambahkan.`);
    };
    input.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); add(); } });
    wrap.append(h("div", { class: "toolbar" }, input, h("button", { type: "button", class: "btn btn-light", onclick: add }, "+ Tambah")), err);

    const ul = h("ol", { class: "item-list" });
    state.categories.forEach((cat, i) => {
      const n = usage(cat);
      ul.append(h("li", { class: "item" },
        h("div", { class: "item-lead" }, String(i + 1)),
        h("div", { class: "item-body" }, h("strong", null, cat), h("span", { class: "muted" }, n ? `${n} proyek` : "Belum dipakai")),
        h("div", { class: "item-actions" },
          h("button", { type: "button", class: "icon-btn", "aria-label": "Naikkan", title: "Naikkan", disabled: i === 0, onclick: () => move(state.categories, i, -1) }, "↑"),
          h("button", { type: "button", class: "icon-btn", "aria-label": "Turunkan", title: "Turunkan", disabled: i === state.categories.length - 1, onclick: () => move(state.categories, i, 1) }, "↓"),
          h("button", { type: "button", class: "btn btn-sm", onclick: () => renameCategory(i) }, "Ganti nama"),
          h("button", { type: "button", class: "icon-btn danger", "aria-label": "Hapus", title: n ? `Masih dipakai ${n} proyek — pindahkan dulu proyeknya` : "Hapus", disabled: n > 0, onclick: () => {
            if (!confirm(`Hapus kategori "${cat}"?`)) return;
            state.categories.splice(i, 1); commit(); render();
          } }, "🗑"))));
    });
    wrap.append(ul);
    return wrap;
  }

  function renameCategory(i) {
    const old = state.categories[i];
    const name = (prompt(`Nama baru untuk kategori "${old}":`, old) || "").trim();
    if (!name || name === old) return;
    const msg = categoryError(name, old);
    if (msg) { toast(msg, "error"); return; }
    state.categories[i] = name;
    let n = 0;
    state.projects.forEach(p => { if (p.category === old) { p.category = name; n++; } });
    commit(); render();
    toast(`Kategori diganti${n ? `; ${n} proyek ikut diperbarui` : ""}.`);
  }

  // ---------- Identitas & kontak (form langsung) ----------
  function boundForm(obj, fields, onChange) {
    return h("div", { class: "form-grid" }, fields.map(f => {
      const isLines = f.type === "lines";
      const value = isLines ? obj[f.key].join("\n") : obj[f.key];
      const el = buildField({ ...f, type: isLines ? "textarea" : f.type }, value);
      const input = el.querySelector("input, textarea");
      if (isLines) input.rows = 3;
      if (f.wide) el.classList.add("wide");
      input.addEventListener("input", () => {
        obj[f.key] = isLines ? input.value.split("\n").map(s => s.trim()).filter(Boolean) : input.value;
        const msg = f.validate ? f.validate(input.value.trim()) : "";
        el.querySelector(".field-error").textContent = msg;
        commit();
        if (onChange) onChange(f.key);
      });
      return el;
    }));
  }

  const optionalUrl = v => (!v || /^(https?:\/\/|\.{0,2}\/|[\w-]+\/)/i.test(v) ? "" : "Isi URL lengkap (https://…) atau path relatif (images/…).");

  function renderIdentity() {
    const ident = state.identity;
    const portrait = h("img", { alt: "Pratinjau foto", class: "portrait-preview" });
    const showPortrait = () => { portrait.hidden = !ident.portraitUrl; if (ident.portraitUrl) portrait.src = ident.portraitUrl; };
    portrait.onerror = () => { portrait.hidden = true; };
    const form = boundForm(ident, [
      { key: "name", label: "Nama lengkap" },
      { key: "displayName", label: "Nama tampilan (hero)", hint: "Kata pertama tampil terang, sisanya abu-abu." },
      { key: "title", label: "Profesi / judul" },
      { key: "tagline", label: "Tagline", hint: "Dua kata terakhir tampil miring." },
      { key: "shortDescription", label: "Deskripsi singkat (hero)", type: "textarea", wide: true },
      { key: "aboutIntro", label: "About — paragraf pembuka", type: "textarea", wide: true },
      { key: "aboutDescription", label: "About — paragraf lanjutan", type: "textarea", wide: true },
      { key: "focus", label: "Focus (satu per baris)", type: "lines" },
      { key: "tools", label: "Tools (satu per baris)", type: "lines" },
      { key: "portraitUrl", label: "Foto portrait", placeholder: "images/portrait.webp", hint: "URL gambar atau path relatif dari folder portofolio.", validate: optionalUrl },
      { key: "showreelUrl", label: "URL showreel YouTube", type: "url", hint: "Kosong = tombol play menggulir ke Projects.", validate: v => (!v || U.parseYoutube(v).id ? "" : "Bukan URL YouTube yang dikenali.") }
    ], key => { if (key === "portraitUrl") showPortrait(); });
    showPortrait();
    return h("section", null, sectionHead("Identitas", "Teks hero, About, Focus, Tools, foto, dan showreel. Perubahan tersimpan otomatis sebagai draf."), form, h("div", { class: "field" }, portrait));
  }

  function renderSocial() {
    const so = state.social;
    const waLink = h("a", { target: "_blank", rel: "noopener", class: "text-link" });
    const showWa = () => {
      const num = so.whatsappNumber.replace(/\D/g, "");
      waLink.href = `https://wa.me/${num}?text=${encodeURIComponent(so.whatsappMessage)}`;
      waLink.textContent = num ? `Uji tautan WhatsApp (wa.me/${num}) ↗` : "Nomor WhatsApp belum diisi";
    };
    const form = boundForm(so, [
      { key: "instagram", label: "Instagram utama", type: "url", validate: optionalUrl },
      { key: "personalInstagram", label: "Instagram personal", type: "url", validate: optionalUrl, hint: "Kosongkan untuk menyembunyikan." },
      { key: "whatsappNumber", label: "Nomor WhatsApp", inputmode: "numeric", placeholder: "62812xxxxxxx", hint: "Format internasional, angka saja (0812… → 62812…).", validate: v => (!v || /^[1-9]\d{7,14}$/.test(v.replace(/\D/g, "")) ? (/^0/.test(v) ? "Awali dengan kode negara 62, bukan 0." : "") : "Nomor tidak valid.") },
      { key: "email", label: "Email", type: "url", validate: v => (!v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? "" : "Alamat email tidak valid."), hint: "Kosongkan untuk menyembunyikan." },
      { key: "whatsappMessage", label: "Pesan otomatis WhatsApp", type: "textarea", wide: true }
    ], showWa);
    $$("input[data-key=email]", form).forEach(i => { i.type = "email"; });
    showWa();
    return h("section", null, sectionHead("Kontak", "Dipakai semua tombol WhatsApp, tautan Instagram, dan email di situs."), form, h("p", null, waLink));
  }

  // ---------- Simpan / unduh / impor ----------
  function serialize(data) {
    const clean = normalize(data);
    clean.social.whatsappNumber = clean.social.whatsappNumber.replace(/\D/g, "");
    return `/*
  PUSAT DATA PORTFOLIO
  Kelola isi lewat admin.html (tambah/ubah/hapus proyek, kategori, layanan,
  testimoni, identitas, kontak), lalu klik "Simpan ke berkas".
  Berkas ini tetap boleh disunting manual; formatnya JSON di dalam JavaScript.
  Terakhir disimpan dari admin.html: ${new Date().toLocaleString("id-ID")}
*/
window.PORTFOLIO = ${JSON.stringify(clean, null, 2)};
`;
  }

  // Simpan handle berkas di IndexedDB supaya kunjungan berikutnya tidak perlu memilih ulang.
  const idb = {
    db: null,
    open() {
      if (this.db) return Promise.resolve(this.db);
      return new Promise((res, rej) => {
        const r = indexedDB.open("khairul-portfolio-admin", 1);
        r.onupgradeneeded = () => r.result.createObjectStore("kv");
        r.onsuccess = () => { this.db = r.result; res(r.result); };
        r.onerror = () => rej(r.error);
      });
    },
    async get(k) { const db = await this.open(); return new Promise(res => { const q = db.transaction("kv").objectStore("kv").get(k); q.onsuccess = () => res(q.result); q.onerror = () => res(undefined); }); },
    async set(k, v) { const db = await this.open(); return new Promise(res => { const t = db.transaction("kv", "readwrite"); t.objectStore("kv").put(v, k); t.oncomplete = () => res(); t.onerror = () => res(); }); }
  };

  function download(text) {
    const url = URL.createObjectURL(new Blob([text], { type: "text/javascript;charset=utf-8" }));
    const a = h("a", { href: url, download: "portfolio-data.js" });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  async function saveToFile() {
    const text = serialize(state);
    if (!("showSaveFilePicker" in window)) {
      download(text);
      toast("Peramban ini tidak bisa menulis berkas langsung. portfolio-data.js diunduh — timpakan ke folder portofolio.");
      return;
    }
    try {
      let handle = fileHandle;
      if (!handle) { try { handle = await idb.get("dataFile"); } catch { handle = null; } }
      if (handle && (await handle.requestPermission({ mode: "readwrite" })) !== "granted") handle = null;
      if (!handle) {
        handle = await window.showSaveFilePicker({
          id: "khairul-portfolio", suggestedName: "portfolio-data.js",
          types: [{ description: "Data portfolio (JavaScript)", accept: { "text/javascript": [".js"] } }]
        });
      }
      const w = await handle.createWritable();
      await w.write(text);
      await w.close();
      fileHandle = handle;
      try { await idb.set("dataFile", handle); } catch { /* handle tidak bisa disimpan: cukup untuk sesi ini */ }
      fileSnapshot = JSON.stringify(normalize(state));
      U.writeDraft(state);
      updateStatus();
      toast(handle.name === "portfolio-data.js"
        ? "Tersimpan ke portfolio-data.js. Unggah berkas ini ke hosting agar pengunjung melihatnya."
        : `Tersimpan ke "${handle.name}" — situs hanya membaca portfolio-data.js.`, handle.name === "portfolio-data.js" ? "ok" : "error");
    } catch (e) {
      if (e && e.name === "AbortError") { toast("Penyimpanan dibatalkan. Bila dialog simpan tidak muncul, pakai menu ⋯ → Unduh portfolio-data.js."); return; }
      console.error(e);
      download(text);
      toast("Gagal menulis berkas langsung; portfolio-data.js diunduh sebagai gantinya.", "error");
    }
  }

  function parseDataFile(text) {
    // Format baru: JSON di dalam window.PORTFOLIO = {...}; atau berkas .json murni.
    try {
      const start = text.indexOf("{"), end = text.lastIndexOf("}");
      if (start >= 0 && end > start) return JSON.parse(text.slice(start, end + 1));
    } catch { /* lanjut ke format lama */ }
    // Format lama: objek JavaScript biasa (kunci tanpa kutip, komentar). Dijalankan
    // dengan objek window tiruan — hanya untuk berkas portfolio milik sendiri.
    const fake = {};
    new Function("window", `"use strict";\n${text}\n;`)(fake);
    if (!fake.PORTFOLIO) throw new Error("Berkas tidak berisi window.PORTFOLIO.");
    return fake.PORTFOLIO;
  }

  $("#file-import").addEventListener("change", async e => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    try {
      const data = normalize(parseDataFile(await file.text()));
      if (!confirm(`Ganti seluruh isi admin dengan isi "${file.name}" (${data.projects.length} proyek, ${data.services.length} layanan, ${data.testimonials.length} testimoni)?`)) return;
      state = data; commit(); render();
      toast(`"${file.name}" diimpor sebagai draf. Klik "Simpan ke berkas" untuk menerapkan.`, "ok");
    } catch (err) {
      console.error(err);
      toast(`Berkas tidak bisa dibaca: ${err.message}`, "error");
    }
  });

  function discardDraft() {
    if (isDirty() && !confirm("Buang semua perubahan yang belum disimpan ke berkas?")) return;
    U.clearDraft();
    location.reload();
  }

  // ---------- Tombol atas ----------
  const closeMenu = () => { $(".adm-more").open = false; };
  $("#btn-save").addEventListener("click", saveToFile);
  $("#btn-download").addEventListener("click", () => { closeMenu(); download(serialize(state)); toast("portfolio-data.js diunduh. Timpakan ke folder portofolio."); });
  $("#btn-import").addEventListener("click", () => { closeMenu(); $("#file-import").click(); });
  $("#btn-discard").addEventListener("click", () => { closeMenu(); discardDraft(); });
  $("#btn-change-pin").addEventListener("click", () => { closeMenu(); window.AdminGate.changePin(); });
  $("#btn-lock").addEventListener("click", () => { closeMenu(); window.AdminGate.lock(); });
  window.addEventListener("admingate:saved", e => {
    const msg = {
      file: ["PIN baru tersimpan ke admin-config.js. Unggah berkas itu ke hosting.", "ok"],
      download: ["admin-config.js diunduh — timpakan ke folder portofolio, lalu unggah ke hosting.", ""],
      "wrong-name": ["PIN tersimpan ke berkas dengan nama lain — admin hanya membaca admin-config.js.", "error"]
    }[e.detail];
    if (msg) toast(msg[0], msg[1]);
  });  $("#btn-preview").addEventListener("click", () => { U.writeDraft(state); window.open("index.html?preview=1", "_blank", "noopener"); });
  document.addEventListener("click", e => { if (!e.target.closest(".adm-more")) closeMenu(); });

  $("#tabs").addEventListener("click", e => {
    const b = e.target.closest("button[data-tab]");
    if (!b) return;
    activeTab = b.dataset.tab;
    history.replaceState(null, "", `#${activeTab}`);
    render();
  });

  // Ctrl/Cmd + S = simpan ke berkas
  document.addEventListener("keydown", e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s" && !dialog.open) { e.preventDefault(); saveToFile(); }
  });

  if (!["projects", "categories", "services", "testimonials", "identity", "social"].includes(activeTab)) activeTab = "projects";
  render();
});
