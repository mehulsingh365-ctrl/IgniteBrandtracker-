/* =====================================================================
   DATA LOADER — reads published Google Sheet CSVs, falls back to sample.
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

  // Load order: 1) Google Sheet link in config.js  2) data/<tab>.csv in this repo
  // (updated automatically by the scheduled runs)  3) built-in sample data.
  async function loadTab(name, url) {
    try {
      const rows = await fetchCSV(`data/${name}.csv`);
      if (rows.length && !url) return { rows, live: true };
    } catch (e) { /* no repo file for this tab yet */ }
    if (url) {
      try {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) throw new Error(res.status);
        const rows = parseCSV(await res.text());
        if (rows.length) return { rows, live: true };
      } catch (e) {
        console.warn(`[Ignite] Could not load "${name}" from the sheet, using sample data.`, e);
      }
    }
    return { rows: parseCSV(window.SAMPLE_CSV[name] || ""), live: false };
  }

  window.loadPulseData = async function () {
    const tabs = Object.keys(window.SAMPLE_CSV);
    const results = await Promise.all(tabs.map(t => loadTab(t, window.PULSE_CONFIG.sheets[t])));
    const data = {}; let liveCount = 0;
    tabs.forEach((t, i) => { data[t] = results[i].rows; if (results[i].live) liveCount++; });

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

    data._meta = { liveCount, totalTabs: tabs.length, isSample: liveCount < tabs.length, isAllSample: liveCount === 0 };
    return data;
  };
})();
