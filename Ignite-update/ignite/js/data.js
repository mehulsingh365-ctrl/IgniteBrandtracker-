/* =====================================================================
   DATA LOADER — reads the CSV files in data/. No sample data, ever.
   ===================================================================== */

(function () {
  // Small CSV parser (handles quotes, commas and line breaks inside quotes)
  function parseCSV(text) {
    const rows = [];
    let row = [], field = "", inQuotes = false;
    text = text.replace(/^﻿/, "");
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (inQuotes) {
        if (c === '"') {
          if (text[i + 1] === '"') { field += '"'; i++; }
          else inQuotes = false;
        } else field += c;
      } else if (c === '"') inQuotes = true;
      else if (c === ",") { row.push(field); field = ""; }
      else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        row.push(field); rows.push(row); row = []; field = "";
      } else field += c;
    }
    if (field !== "" || row.length) { row.push(field); rows.push(row); }

    const clean = rows.filter(r => r.some(v => v.trim() !== ""));
    if (!clean.length) return [];
    const headers = clean[0].map(h => h.trim().toLowerCase());
    return clean.slice(1).map(r => {
      const obj = {};
      headers.forEach((h, idx) => {
        const raw = (r[idx] ?? "").trim();
        const num = raw.replace(/[%\s]/g, "").replace(/,(?=\d{3}\b)/g, "");
        obj[h] = raw !== "" && /^[-+]?\d*\.?\d+$/.test(num) && !/^0\d/.test(num) ? Number(num) : raw;
      });
      return obj;
    });
  }

  // Data is read straight from the GitHub repository, so every automatic update shows up
  // within a few minutes, with no new Vercel deployment needed. If GitHub can't be reached,
  // the copy that came with this site is used instead.
  const REMOTE = "https://raw.githubusercontent.com/mehulsingh365-ctrl/IgniteBrandtracker-/main/ignite/";
  async function fetchText(path) {
    const bust = "?t=" + Math.floor(Date.now() / 60000);
    try {
      const r = await fetch(REMOTE + path + bust, { cache: "no-store" });
      if (r.ok) return await r.text();
    } catch (e) { /* fall back to the local copy */ }
    const res = await fetch(path, { cache: "no-store" });
    if (!res.ok) throw new Error(res.status);
    return await res.text();
  }

  async function fetchCSV(url) {
    return parseCSV(await fetchText(url));
  }

  // Every tab is read from data/<tab>.csv in this site. There is no sample fallback:
  // a missing or empty file means "no data yet", and the page says so.
  async function loadTab(name) {
    try {
      const rows = await fetchCSV(`data/${name}.csv`);
      return { rows, live: rows.length > 0 };
    } catch (e) {
      return { rows: [], live: false };
    }
  }

  // Each update engine writes its own files, so they can run at the same time:
  //   posts/<platform>.csv  ← Instagram/TikTok (browser run), YouTube (cloud, every 2h)
  //   news.csv              ← Google News (cloud, every 2h)
  //   status/<source>.json  ← when each source last updated, and whether it worked
  const TABS = ["accounts", "insights", "calendar", "keywords", "hashtags", "listening", "news"];
  const PLATFORMS = ["instagram", "tiktok", "youtube", "linkedin"];
  const SOURCES = ["instagram", "tiktok", "youtube", "news", "reddit", "trends", "linkedin"];

  async function loadJSON(url) {
    try { return JSON.parse(await fetchText(url)); } catch (e) { return null; }
  }

  window.loadPulseData = async function () {
    const [tabs, posts, status] = await Promise.all([
      Promise.all(TABS.map(t => loadTab(t))),
      Promise.all(PLATFORMS.map(p => loadTab(`posts/${p}`))),
      Promise.all(SOURCES.map(s => loadJSON(`data/status/${s}.json`)))
    ]);
    const data = { kpis: [], products: [] };
    TABS.forEach((t, i) => { data[t] = tabs[i].rows; });
    data.competitor_posts = posts.flatMap(r => r.rows);
    data.status = {};
    SOURCES.forEach((s, i) => { if (status[i]) data.status[s] = status[i]; });

    // Derived fields
    data.competitor_posts.forEach(p => {
      // Video posts: engagement per view. Photos/carousels (no public views): per follower.
      if (p.engagement_rate === "" || p.engagement_rate == null) {
        const eng = Number(p.likes || 0) + Number(p.comments || 0);
        const noEng = (p.likes === "" || p.likes == null) && (p.comments === "" || p.comments == null);
        p.engagement_rate = noEng ? null : p.views ? (eng / p.views) * 100 : p.followers ? (eng / p.followers) * 100 : null;
        p.er_basis = p.views ? "views" : "followers";
      }
    });

    const dates = data.competitor_posts.map(p => p.date).concat(data.accounts.map(a => a.date), data.news.map(n => n.date)).filter(Boolean).sort();
    data._meta = {
      lastUpdated: dates[dates.length - 1] || "",
      firstPost: data.competitor_posts.map(p => p.date).filter(Boolean).sort()[0] || "",
      brands: [...new Set(data.competitor_posts.map(p => p.brand))],
      platforms: [...new Set(data.competitor_posts.map(p => p.platform))],
      lastRun: Object.values(data.status).map(s => s.last_run).filter(Boolean).sort().pop() || ""
    };
    return data;
  };
})();
