/*
  Utilitas bersama untuk index.html (script.js) dan admin.html (admin.js).
  Tidak memerlukan server — cukup dimuat dengan <script src="shared.js">.
*/
window.PortfolioUtil = (() => {
  // Kunci localStorage untuk draf dari admin.html (dibaca index.html?preview=1).
  const DRAFT_KEY = "khairul-portfolio-draft";

  const DEFAULT_CATEGORIES = ["Talking Head", "Short Film", "Cinematic Video", "Social Media Content", "Event Documentation"];

  // Mengambil ID video dan menandai apakah formatnya Shorts (vertikal).
  function parseYoutube(url) {
    if (!url) return { id: "", isVertical: false };
    try {
      let raw = String(url).trim();
      if (!/^https?:\/\//i.test(raw)) raw = "https://" + raw;
      const u = new URL(raw);
      const host = u.hostname.replace(/^www\.|^m\./, "");
      const parts = u.pathname.split("/").filter(Boolean);
      let id = "", isVertical = false;
      if (host === "youtu.be") id = parts[0] || "";
      else if (host.endsWith("youtube.com") || host.endsWith("youtube-nocookie.com")) {
        if (u.pathname === "/watch") id = u.searchParams.get("v") || "";
        else if (parts[0] === "shorts") { id = parts[1] || ""; isVertical = true; }
        else if (parts[0] === "embed" || parts[0] === "live") id = parts[1] || "";
      }
      return /^[\w-]{6,}$/.test(id) ? { id, isVertical } : { id: "", isVertical: false };
    } catch { return { id: "", isVertical: false }; }
  }

  function youtubeEmbed(url) {
    const { id, isVertical } = parseYoutube(url);
    return { url: id ? `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0` : "", isVertical };
  }

  function youtubeThumbnail(url) {
    const { id } = parseYoutube(url);
    return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : "";
  }

  // Tautan biasa ke YouTube — cadangan bila embed ditolak (mis. dibuka dari file://).
  function youtubeWatchUrl(url) {
    const { id, isVertical } = parseYoutube(url);
    if (!id) return "";
    return isVertical ? `https://www.youtube.com/shorts/${id}` : `https://www.youtube.com/watch?v=${id}`;
  }

  // Orientasi proyek: "portrait" / "landscape" dipilih di admin; kosong = otomatis
  // (URL Shorts dianggap portrait 9:16, selainnya landscape 16:9).
  function isPortrait(project) {
    if (!project) return false;
    if (project.orientation === "portrait") return true;
    if (project.orientation === "landscape") return false;
    return parseYoutube(project.videoUrl).isVertical;
  }

  // Draf disimpan sebagai { savedAt, data }.
  function readDraft() {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed && parsed.data ? parsed : null;
    } catch { return null; }
  }

  function writeDraft(data) {
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ savedAt: new Date().toISOString(), data })); return true; }
    catch { return false; }
  }

  function clearDraft() {
    try { localStorage.removeItem(DRAFT_KEY); } catch { /* abaikan */ }
  }

  return { DRAFT_KEY, DEFAULT_CATEGORIES, parseYoutube, youtubeEmbed, youtubeThumbnail, youtubeWatchUrl, isPortrait, readDraft, writeDraft, clearDraft };
})();
