/*
  GERBANG PIN admin.html — JavaScript murni.
  ⚠️ Ini penghalang untuk pengunjung iseng, BUKAN pengamanan sungguhan: situs statis
  tidak punya server untuk memeriksa PIN. Yang dilindungi pun hanya tampilan admin —
  admin.html memang tidak bisa mengubah situs online.
  PIN disimpan sebagai hash PBKDF2 di admin-config.js; PIN aslinya tidak pernah ditulis.
*/
window.AdminGate = (() => {
  const SESSION_KEY = "khairul-admin-unlocked";
  const FAIL_KEY = "khairul-admin-fails";
  const MIN_LEN = 6;
  const cfg = window.ADMIN_CONFIG || {};
  const iterations = Number(cfg.iterations) || 150000;
  const hasCrypto = !!(window.crypto && crypto.subtle && window.isSecureContext !== false);
  const configured = /^[0-9a-f]{64}$/.test(cfg.pinHash || "") && /^[0-9a-f]{32}$/.test(cfg.salt || "");
  const root = document.documentElement;

  let unlocked = false, onUnlock = null, overlay = null, changing = false;

  const store = {
    get(s, k) { try { return s.getItem(k); } catch { return null; } },
    set(s, k, v) { try { s.setItem(k, v); } catch { /* abaikan */ } },
    del(s, k) { try { s.removeItem(k); } catch { /* abaikan */ } }
  };

  const toHex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
  const fromHex = h => new Uint8Array(h.match(/../g).map(x => parseInt(x, 16)));

  async function derive(pin, saltHex, iter) {
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveBits"]);
    return toHex(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: fromHex(saltHex), iterations: iter }, key, 256));
  }

  // Bandingkan tanpa berhenti di karakter pertama yang berbeda.
  function sameHex(a, b) {
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return diff === 0;
  }

  // Penanda sesi terikat ke hash saat ini: ganti PIN = semua sesi lama ikut terkunci.
  const sessionToken = hash => `v1:${hash.slice(0, 24)}`;

  // ---------- Batas percobaan (per peramban) ----------
  function fails() { try { return JSON.parse(store.get(localStorage, FAIL_KEY)) || { n: 0, until: 0 }; } catch { return { n: 0, until: 0 }; } }
  function recordFail() {
    const f = fails(); f.n += 1;
    if (f.n >= 5) f.until = Date.now() + Math.min(15 * 60, 30 * 2 ** (f.n - 5)) * 1000; // 30 dtk, 60, 120 … maks 15 mnt
    store.set(localStorage, FAIL_KEY, JSON.stringify(f));
    return f;
  }
  const lockedFor = () => Math.max(0, Math.ceil((fails().until - Date.now()) / 1000));

  // ---------- Tampilan ----------
  function el(tag, props, ...kids) {
    const e = document.createElement(tag);
    Object.entries(props || {}).forEach(([k, v]) => {
      if (v == null || v === false) return;
      if (k === "class") e.className = v;
      else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? "" : v);
    });
    kids.flat().forEach(c => c != null && e.append(c));
    return e;
  }

  function show(mode) {
    if (overlay) overlay.remove();
    const setup = mode === "setup" || mode === "change";
    const pin = el("input", { type: "password", class: "input", id: "gate-pin", autocomplete: setup ? "new-password" : "current-password", inputmode: "numeric", "aria-label": setup ? "PIN baru" : "PIN", placeholder: setup ? `PIN baru (min. ${MIN_LEN} karakter)` : "Masukkan PIN" });
    const pin2 = setup ? el("input", { type: "password", class: "input", id: "gate-pin2", autocomplete: "new-password", inputmode: "numeric", "aria-label": "Ulangi PIN", placeholder: "Ulangi PIN" }) : null;
    const err = el("p", { class: "gate-error", role: "alert" });
    const btn = el("button", { type: "submit", class: "btn btn-light" }, setup ? "Simpan PIN" : "Buka admin");
    const title = mode === "change" ? "Ganti PIN admin" : setup ? "Buat PIN admin" : "Admin terkunci";
    const note = setup
      ? "PIN disimpan sebagai hash di admin-config.js. Setelah klik Simpan, pilih/timpa berkas admin-config.js di folder portofolio, lalu unggah berkas itu ke hosting."
      : "Masukkan PIN untuk mengelola isi portofolio.";
    const form = el("form", { class: "gate-card", novalidate: true },
      el("div", { class: "adm-brand" }, "KHAIRUL", el("span", null, "."), " ", el("small", null, "ADMIN")),
      el("h1", null, title), el("p", { class: "muted" }, note),
      pin, pin2, err, btn,
      mode === "change" ? el("button", { type: "button", class: "btn", onclick: () => { changing = false; overlay.remove(); overlay = null; } }, "Batal") : null,
      !setup ? el("p", { class: "hint" }, "Lupa PIN? Kosongkan \"pinHash\" di admin-config.js lalu buka ulang halaman ini.") : null);

    if (!hasCrypto) {
      form.replaceChildren(form.firstChild, el("h1", null, "Tidak bisa membuka admin"),
        el("p", { class: "muted" }, "Peramban menonaktifkan fitur kriptografi di alamat ini. Buka admin lewat https://, localhost, atau langsung dari berkas di komputer."));
    }

    form.addEventListener("submit", async e => {
      e.preventDefault();
      err.textContent = "";
      btn.disabled = true;
      try { setup ? await doSetup(pin.value, pin2.value, err) : await doLogin(pin.value, err); }
      finally { btn.disabled = false; }
      if (overlay) pin.focus();
    });

    overlay = el("div", { class: "gate", role: "dialog", "aria-modal": "true", "aria-label": title }, form);
    document.body.append(overlay);
    tickLock(err, btn);
    pin.focus();
  }

  function tickLock(err, btn) {
    const s = lockedFor();
    if (!s || !overlay) { if (btn) btn.disabled = false; return; }
    btn.disabled = true;
    err.textContent = `Terlalu banyak percobaan. Coba lagi dalam ${s} detik.`;
    setTimeout(() => tickLock(err, btn), 1000);
  }

  async function doLogin(value, err) {
    if (lockedFor()) return;
    const hash = await derive(value, cfg.salt, iterations);
    if (!sameHex(hash, cfg.pinHash)) {
      const f = recordFail();
      err.textContent = f.n >= 5 ? "PIN salah." : `PIN salah. Sisa ${5 - f.n} percobaan sebelum dijeda.`;
      tickLock(err, overlay.querySelector("button[type=submit]"));
      overlay.querySelector("#gate-pin").select();
      return;
    }
    store.del(localStorage, FAIL_KEY);
    store.set(sessionStorage, SESSION_KEY, sessionToken(cfg.pinHash));
    open();
  }

  async function doSetup(a, b, err) {
    if (a.length < MIN_LEN) { err.textContent = `PIN minimal ${MIN_LEN} karakter.`; return; }
    if (/^(\d)\1+$/.test(a) || "0123456789012345".includes(a) || "9876543210987654".includes(a)) { err.textContent = "PIN terlalu mudah ditebak (angka berulang/berurutan)."; return; }
    if (a !== b) { err.textContent = "Kedua PIN tidak sama."; return; }
    const salt = toHex(crypto.getRandomValues(new Uint8Array(16)));
    const hash = await derive(a, salt, 150000);
    const text = `/*
  KONFIGURASI PIN admin.html — dibuat & ditimpa otomatis oleh admin.html.
  Hanya berisi hash (PBKDF2-SHA256); PIN aslinya tidak pernah tersimpan.
  Lupa PIN? Kosongkan nilai "pinHash" di bawah ini, lalu buka admin.html
  untuk membuat PIN baru.
  Dibuat: ${new Date().toLocaleString("id-ID")}
*/
window.ADMIN_CONFIG = {
  "salt": "${salt}",
  "iterations": 150000,
  "pinHash": "${hash}"
};
`;
    const saved = await saveConfig(text);
    if (saved === "cancel") {
      // Dialog bisa batal sendiri (peramban tertanam / izin ditolak): beri jalan unduh.
      err.textContent = "Penyimpanan dibatalkan — PIN belum berlaku. ";
      err.append(el("button", { type: "button", class: "btn btn-sm", onclick: () => finishSetup(salt, hash, (download(text), "download")) }, "Unduh admin-config.js saja"));
      return;
    }
    finishSetup(salt, hash, saved);
  }

  function finishSetup(salt, hash, saved) {
    Object.assign(cfg, { salt, iterations: 150000, pinHash: hash });
    store.set(sessionStorage, SESSION_KEY, sessionToken(hash));
    changing = false;
    open();
    window.dispatchEvent(new CustomEvent("admingate:saved", { detail: saved }));
  }

  // Tulis admin-config.js langsung (Chrome/Edge) atau unduh sebagai cadangan.
  async function saveConfig(text) {
    if ("showSaveFilePicker" in window) {
      try {
        const h = await window.showSaveFilePicker({ id: "khairul-portfolio", suggestedName: "admin-config.js", types: [{ description: "Konfigurasi admin (JavaScript)", accept: { "text/javascript": [".js"] } }] });
        const w = await h.createWritable(); await w.write(text); await w.close();
        return h.name === "admin-config.js" ? "file" : "wrong-name";
      } catch (e) {
        if (e && e.name === "AbortError") return "cancel";
      }
    }
    download(text);
    return "download";
  }

  function download(text) {
    const url = URL.createObjectURL(new Blob([text], { type: "text/javascript;charset=utf-8" }));
    const a = el("a", { href: url, download: "admin-config.js" });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  function open() {
    unlocked = true;
    root.classList.remove("gate-locked");
    if (overlay) { overlay.remove(); overlay = null; }
    if (onUnlock) { const f = onUnlock; onUnlock = null; f(); }
  }

  // ---------- Mulai ----------
  if (configured && store.get(sessionStorage, SESSION_KEY) === sessionToken(cfg.pinHash)) {
    unlocked = true;
    root.classList.remove("gate-locked");
  } else {
    show(configured ? "login" : "setup");
  }

  return {
    whenUnlocked(fn) { if (unlocked) fn(); else onUnlock = fn; },
    lock() { store.del(sessionStorage, SESSION_KEY); location.reload(); },
    changePin() { if (!changing) { changing = true; show("change"); } },
    isConfigured: () => /^[0-9a-f]{64}$/.test(cfg.pinHash || "")
  };
})();
