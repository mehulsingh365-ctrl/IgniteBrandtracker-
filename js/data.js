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

  async function fetchCSV(url) {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(res.status);
    return parseCSV(await res.text());
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

  const TABS = ["competitor_posts", "accounts", "insights", "calendar", "keywords", "hashtags", "listening"];
  window.loadPulseData = async function () {
    const results = await Promise.all(TABS.map(t => loadTab(t)));
    const data = { kpis: [], products: [] };
    TABS.forEach((t, i) => { data[t] = results[i].rows; });

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

    const dates = data.competitor_posts.map(p => p.date).concat(data.accounts.map(a => a.date)).filter(Boolean).sort();
    data._meta = {
      lastUpdated: dates[dates.length - 1] || "",
      firstPost: data.competitor_posts.map(p => p.date).filter(Boolean).sort()[0] || "",
      brands: [...new Set(data.competitor_posts.map(p => p.brand))],
      platforms: [...new Set(data.competitor_posts.map(p => p.platform))]
    };
    return data;
  };
})();
