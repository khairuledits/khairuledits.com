document.addEventListener("DOMContentLoaded", () => {
  const util = window.PortfolioUtil;
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];

  // Mode pratinjau: index.html?preview=1 memakai draf dari admin.html (localStorage
  // peramban ini saja). Pengunjung biasa selalu melihat isi portfolio-data.js.
  const isPreview = new URLSearchParams(location.search).has("preview");
  const draft = isPreview ? util.readDraft() : null;
  const data = (draft && draft.data) || window.PORTFOLIO || {};
  const identity = data.identity || {};
  const social = data.social || {};

  if (isPreview) {
    const bar = document.createElement("div");
    bar.className = "preview-bar";
    bar.textContent = draft
      ? `MODE PRATINJAU — draf ${new Date(draft.savedAt).toLocaleString("id-ID")} (belum tentu tersimpan ke berkas)`
      : "MODE PRATINJAU — tidak ada draf, menampilkan isi portfolio-data.js";
    document.body.appendChild(bar);
  }

  const categories = ["All", ...((data.categories && data.categories.length) ? data.categories : util.DEFAULT_CATEGORIES)];
  const waUrl = () => `https://wa.me/${String(social.whatsappNumber || "").replace(/\D/g, "")}?text=${encodeURIComponent(social.whatsappMessage || "")}`;

  // Mengisi elemen dengan baris-baris teks (dipisah <br>) tanpa innerHTML.
  function setLines(el, lines) {
    if (!el || !Array.isArray(lines) || !lines.length) return;
    el.textContent = "";
    lines.forEach((line, i) => {
      if (i) el.appendChild(document.createElement("br"));
      el.appendChild(document.createTextNode(line));
    });
  }

  function setText(sel, value) {
    const el = $(sel);
    if (el && value) el.textContent = value;
  }

  function instagramHandle(url) {
    try { const h = new URL(url).pathname.split("/").filter(Boolean)[0]; return h ? `@${h} ↗` : ""; }
    catch { return ""; }
  }

  // Tautan eksternal
  $$("[data-wa]").forEach(a => { a.href = waUrl(); a.target = "_blank"; a.rel = "noopener"; });
  $$("[data-instagram]").forEach(a => { a.href = social.instagram || "#"; });
  $$("[data-personal]").forEach(a => {
    a.href = social.personalInstagram || "#";
    a.hidden = !social.personalInstagram;
    const h = instagramHandle(social.personalInstagram);
    if (h) a.textContent = h;
  });
  const igLine = $(".social-line [data-instagram]");
  if (igLine && instagramHandle(social.instagram)) igLine.textContent = instagramHandle(social.instagram);
  $$("[data-email]").forEach(a => {
    if (!social.email) return;
    a.href = `mailto:${social.email}`;
    a.textContent = `${social.email} ↗`;
    a.hidden = false;
  });

  const yearEl = $("#year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // Hero: kata pertama nama tampil terang, sisanya abu-abu (gaya desain asli).
  const heroName = $("#hero-name");
  if (heroName && identity.displayName) {
    const words = identity.displayName.trim().split(/\s+/);
    heroName.textContent = words[0];
    if (words.length > 1) {
      heroName.appendChild(document.createElement("br"));
      const span = document.createElement("span");
      span.textContent = words.slice(1).join(" ") + ".";
      heroName.appendChild(span);
    }
  }
  // Tagline: dua kata terakhir dimiringkan (gaya desain asli).
  const tagline = $("#hero-tagline");
  if (tagline && identity.tagline) {
    const words = identity.tagline.trim().split(/\s+/);
    const tail = words.length > 2 ? words.splice(-2).join(" ") : "";
    tagline.textContent = words.join(" ") + " ";
    if (tail) { const em = document.createElement("em"); em.textContent = tail; tagline.appendChild(em); }
  }
  setText("#hero-title", identity.title && identity.title.toUpperCase());
  setText("#footer-title", identity.title && identity.title.toUpperCase());
  setText("#hero-desc", identity.shortDescription);
  setText("#about-intro", identity.aboutIntro);
  setText("#about-description", identity.aboutDescription);
  setLines($("#focus-list"), identity.focus);
  setLines($("#tools-list"), identity.tools);

  const portrait = $("#portrait");
  if (portrait && identity.portraitUrl) {
    const img = document.createElement("img");
    img.src = identity.portraitUrl;
    img.alt = `Portrait ${identity.name || ""}`.trim();
    img.onerror = () => img.remove();
    portrait.appendChild(img);
  }

  // Modal video
  const modal = $("#video-modal"), player = $("#modal-player"), caption = $("#modal-caption");

  // YouTube menolak embed tanpa Referer (Error 153). Halaman yang dibuka langsung
  // dari berkas (file://) tidak punya alamat situs, jadi embed PASTI gagal di sana.
  const isLocalFile = location.protocol === "file:";

  function openVideo(url, title, project) {
    if (!modal || !player || !caption) return;
    const embed = util.youtubeEmbed(url);
    if (!embed.url) { alert("URL video tidak valid atau gagal dimuat."); return; }
    const portrait = project ? util.isPortrait(project) : embed.isVertical;
    const watchUrl = util.youtubeWatchUrl(url);
    player.classList.toggle("is-portrait", portrait);
    player.style.aspectRatio = portrait ? "9 / 16" : "16 / 9";

    if (isLocalFile) {
      // Cadangan: tampilkan sampul + tombol buka di YouTube, bukan pemutar yang pasti error.
      const box = document.createElement("div");
      box.className = "player-fallback";
      const thumbUrl = (project && project.thumbnail) || util.youtubeThumbnail(url);
      if (thumbUrl) box.style.backgroundImage = `url("${thumbUrl.replace(/"/g, "%22")}")`;
      const msg = document.createElement("p");
      msg.textContent = "Pemutar YouTube tidak bisa berjalan saat halaman dibuka langsung dari berkas (file://). Buka lewat hosting atau server lokal, atau tonton di YouTube.";
      const a = document.createElement("a");
      a.className = "button button-light"; a.href = watchUrl; a.target = "_blank"; a.rel = "noopener";
      a.innerHTML = "Tonton di YouTube <span>↗</span>";
      box.append(msg, a);
      player.replaceChildren(box);
    } else {
      const iframe = document.createElement("iframe");
      iframe.src = embed.url;
      iframe.title = title || "Video";
      iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
      iframe.referrerPolicy = "strict-origin-when-cross-origin"; // wajib: tanpa Referer → Error 153
      iframe.allowFullscreen = true;
      player.replaceChildren(iframe);
    }
    caption.textContent = title || "";
    // Peran, software, dan deskripsi proyek di bawah judul (bila diisi).
    if (project) {
      const meta = [project.role, project.software].filter(Boolean).join(" · ");
      if (meta) { const m = document.createElement("span"); m.className = "modal-meta"; m.textContent = meta; caption.appendChild(m); }
      if (project.description) { const d = document.createElement("p"); d.className = "modal-desc"; d.textContent = project.description; caption.appendChild(d); }
    }
    // Jalan keluar bila pemilik video menonaktifkan embed.
    if (watchUrl && !isLocalFile) {
      const yt = document.createElement("a");
      yt.className = "modal-yt"; yt.href = watchUrl; yt.target = "_blank"; yt.rel = "noopener";
      yt.textContent = "Video tidak berputar? Tonton di YouTube ↗";
      caption.appendChild(yt);
    }
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    const closeBtn = $("#modal-close");
    if (closeBtn) closeBtn.focus();
  }

  function closeVideo() {
    if (!modal || !player) return;
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
    player.replaceChildren();
    document.body.style.overflow = "";
  }

  const modalCloseBtn = $("#modal-close");
  if (modalCloseBtn) modalCloseBtn.addEventListener("click", closeVideo);
  if (modal) modal.addEventListener("click", e => { if (e.target === modal) closeVideo(); });
  document.addEventListener("keydown", e => { if (e.key === "Escape") closeVideo(); });

  const showreelPlayBtn = $("#showreel-play");
  if (showreelPlayBtn) {
    showreelPlayBtn.addEventListener("click", () => {
      if (identity.showreelUrl) openVideo(identity.showreelUrl, `${identity.displayName || "Khairul"} — Showreel`);
      else { const sec = $("#projects"); if (sec) sec.scrollIntoView({ behavior: "smooth" }); }
    });
  }

  // Grid proyek
  const projects = (data.projects || []).filter(p => p && p.title && p.videoUrl && !p.hidden);
  const grid = $("#project-grid"), filterBox = $("#filters");
  let activeCategory = "All";

  if (filterBox) {
    categories.forEach(cat => {
      const b = document.createElement("button");
      b.className = "filter-btn" + (cat === "All" ? " active" : "");
      b.textContent = cat;
      b.type = "button";
      b.addEventListener("click", () => {
        activeCategory = cat;
        $$(".filter-btn", filterBox).forEach(x => x.classList.toggle("active", x === b));
        renderProjects();
      });
      filterBox.appendChild(b);
    });
  }

  function renderProjects() {
    if (!grid) return;
    grid.innerHTML = "";
    const shown = projects.filter(p => activeCategory === "All" || p.category === activeCategory);
    const empty = $("#empty-projects");
    if (empty) empty.hidden = shown.length > 0;

    shown.forEach((p, index) => {
      const card = document.createElement("article");
      card.className = "project-card reveal visible" + (util.isPortrait(p) ? " is-portrait" : "");
      card.tabIndex = 0;

      const thumb = document.createElement("div");
      thumb.className = "project-thumb";
      const fallback = document.createElement("div");
      fallback.className = "thumb-fallback";
      fallback.textContent = String(index + 1).padStart(2, "0");
      thumb.appendChild(fallback);

      // Thumbnail kosong → ambil otomatis dari YouTube.
      const thumbUrl = p.thumbnail || util.youtubeThumbnail(p.videoUrl);
      if (thumbUrl) {
        const img = document.createElement("img");
        img.src = thumbUrl;
        img.alt = `Thumbnail ${p.title}`;
        img.loading = "lazy";
        img.onerror = () => img.remove();
        thumb.appendChild(img);
      }
      const play = document.createElement("span");
      play.className = "thumb-play";
      play.textContent = "▶";
      thumb.appendChild(play);
      card.append(thumb);

      const meta = document.createElement("div");
      meta.className = "project-meta";
      const c = document.createElement("span"); c.textContent = p.category || "";
      const y = document.createElement("span"); y.textContent = p.year || "";
      meta.append(c, y);
      card.append(meta);

      const bottom = document.createElement("div");
      bottom.className = "project-bottom";
      const title = document.createElement("h3");
      title.className = "project-title";
      title.textContent = p.title;
      const arrow = document.createElement("span");
      arrow.className = "project-arrow";
      arrow.textContent = "↗";
      bottom.append(title, arrow);
      card.append(bottom);

      const open = () => openVideo(p.videoUrl, p.title, p);
      card.addEventListener("click", open);
      card.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } });
      grid.appendChild(card);
    });
  }
  renderProjects();

  // Layanan
  const servicesGrid = $("#services-grid");
  if (servicesGrid) {
    (data.services || []).forEach(s => {
      const el = document.createElement("article");
      el.className = "service-card reveal visible";
      const num = document.createElement("span"); num.className = "service-number"; num.textContent = s.number || "";
      const icon = document.createElement("span"); icon.className = "service-icon"; icon.setAttribute("aria-hidden", "true"); icon.textContent = s.icon || "";
      const h3 = document.createElement("h3"); h3.textContent = s.title || "";
      const desc = document.createElement("p"); desc.textContent = s.description || "";
      const link = document.createElement("a");
      link.href = waUrl(); link.target = "_blank"; link.rel = "noopener";
      link.innerHTML = "Discuss Your Project <span>↗</span>";
      el.append(num, icon, h3, desc, link);
      servicesGrid.appendChild(el);
    });
  }

  // Testimoni (carousel) — bagian tampil hanya bila ada isinya.
  const testimonials = (data.testimonials || []).filter(t => t && t.quote && t.name);
  const tSection = $("#testimonials"), track = $("#testimonial-track");
  if (tSection && track && testimonials.length) {
    tSection.hidden = false;
    testimonials.forEach(t => {
      const card = document.createElement("article");
      card.className = "testimonial-card";
      const q = document.createElement("blockquote"); q.textContent = `“${t.quote}”`;
      const who = document.createElement("small"); who.textContent = [t.name, t.role].filter(Boolean).join(" — ").toUpperCase();
      card.append(q, who);
      track.appendChild(card);
    });
    let pos = 0;
    const perView = () => (window.matchMedia("(max-width: 650px)").matches ? 1 : 2);
    const move = step => {
      const max = Math.max(0, testimonials.length - perView());
      pos = Math.min(max, Math.max(0, pos + step));
      const card = track.children[0];
      const gap = parseFloat(getComputedStyle(track).gap) || 0;
      track.style.transform = `translateX(-${pos * (card.getBoundingClientRect().width + gap)}px)`;
    };
    const prev = $("#testimonial-prev"), next = $("#testimonial-next");
    if (prev) prev.addEventListener("click", () => move(-1));
    if (next) next.addEventListener("click", () => move(1));
    window.addEventListener("resize", () => move(0));
  }

  // Navigasi ponsel
  const toggle = $(".menu-toggle"), nav = $(".nav");
  if (toggle && nav) {
    toggle.addEventListener("click", () => {
      const open = nav.classList.toggle("open");
      toggle.setAttribute("aria-expanded", String(open));
    });
    $$(".nav a").forEach(a => a.addEventListener("click", () => {
      nav.classList.remove("open");
      toggle.setAttribute("aria-expanded", "false");
    }));
  }

  // Header saat menggulir
  const header = $(".site-header");
  if (header) {
    const onScroll = () => header.classList.toggle("scrolled", window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  if ("IntersectionObserver" in window && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.classList.add("visible"); observer.unobserve(entry.target); }
    }), { threshold: .12 });
    $$(".reveal").forEach(el => observer.observe(el));
  } else {
    $$(".reveal").forEach(el => el.classList.add("visible"));
  }

  if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
    const dot = $(".cursor-dot"), ring = $(".cursor-ring");
    if (dot && ring) {
      let x = 0, y = 0, rx = 0, ry = 0;
      window.addEventListener("mousemove", e => { x = e.clientX; y = e.clientY; dot.style.opacity = ring.style.opacity = "1"; dot.style.left = x + "px"; dot.style.top = y + "px"; });
      const animate = () => { rx += (x - rx) * .18; ry += (y - ry) * .18; ring.style.left = rx + "px"; ring.style.top = ry + "px"; requestAnimationFrame(animate); }; animate();
      $$("a,button,.project-card").forEach(el => {
        el.addEventListener("mouseenter", () => ring.classList.add("hover"));
        el.addEventListener("mouseleave", () => ring.classList.remove("hover"));
      });
    }
  }

  window.addEventListener("load", () => {
    const loader = $(".loader");
    if (loader) setTimeout(() => loader.classList.add("done"), 350);
  });
});
