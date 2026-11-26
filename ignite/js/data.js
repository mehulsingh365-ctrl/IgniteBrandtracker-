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
  const TABS = ["accounts", "insights", "calendar", "keywords", "hashtags", "listening", "news", "interest"];
  const PLATFORMS = ["instagram", "youtube"];  // TikTok is shown as live TikTok feeds instead
  const SOURCES = ["youtube", "news", "instagram", "tiktok", "interest"];

  async function loadJSON(url) {
    try { return JSON.parse(await fetchText(url)); } catch (e) { return null; }
  }

  /* Marketing calendar: the yearly moments are worked out for this year and next, so the
     calendar never runs empty. Lines in data/calendar.csv are added on top (and win on the same day). */
  function buildCalendar(extra) {
    const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const easter = y => { const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25),
      g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7,
      m = Math.floor((a + 11 * h + 22 * l) / 451), mo = Math.floor((h + l - 7 * m + 114) / 31), da = ((h + l - 7 * m + 114) % 31) + 1; return new Date(y, mo - 1, da); };
    const nth = (y, m, wd, n) => { const d = new Date(y, m, 1); d.setDate(1 + ((wd - d.getDay() + 7) % 7) + 7 * (n - 1)); return d; };
    const last = (y, m, wd) => { const d = new Date(y, m + 1, 0); d.setDate(d.getDate() - ((d.getDay() - wd + 7) % 7)); return d; };
    const add = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
    const out = [];
    const today = new Date(); today.setHours(0, 0, 0, 0);
    [today.getFullYear(), today.getFullYear() + 1].forEach(y => {
      const pent = add(easter(y), 49);
      let mfr = last(y, 4, 0); if (iso(mfr) === iso(pent)) mfr = add(mfr, 7);
      const thanks = nth(y, 10, 4, 4);
      [
        [new Date(y, 0, 1), "New year", "Europe", "Skin reset and winter-barrier content usually rises in January."],
        [nth(y, 0, 3, 2), "Winter sales start (soldes d'hiver)", "France", "Pharmacies and retailers discount; watch which competitors join in and how hard."],
        [new Date(y, 1, 14), "Valentine's Day", "Europe", "Gifting and self-care content: duo sets and 'treat yourself' angles."],
        [new Date(y, 2, 8), "International Women's Day", "Global", "Purpose-led content: women in science and dermatology."],
        [add(easter(y), -21), "Mother's Day (UK)", "UK", "UK gifting peak for skincare sets."],
        [mfr, "Mother's Day (France)", "France", "French gifting peak: skincare sets and pharmacy promotions."],
        [new Date(y, 5, 1), "Sun-care season starts", "Europe", "SPF content peaks from June to August: daily protection, holidays and after-sun."],
        [nth(y, 5, 0, 3), "Father's Day (France)", "France", "Men's skincare and shaving content."],
        [last(y, 5, 3), "Summer sales start (soldes d'été)", "France", "Promotions across pharmacy and beauty retail."],
        [new Date(y, 8, 1), "Back to school (la rentrée)", "France", "Post-summer skin repair and new-routine content."],
        [new Date(y, 9, 1), "Pink October (Octobre rose)", "Europe", "Breast cancer awareness: brands run donation and support campaigns."],
        [new Date(y, 10, 11), "Singles' Day", "Global", "Online promotions, especially on marketplaces."],
        [add(thanks, 1), "Black Friday", "Europe", "Heavy promotion week: watch who discounts and how hard."],
        [add(thanks, 4), "Cyber Monday", "Europe", "Last big promotion before Christmas: bundles vs. discounts."],
        [new Date(y, 11, 1), "Advent and gift-guide season", "Europe", "Gift guides and advent calendars peak until Christmas."],
        [new Date(y, 11, 25), "Christmas", "Europe", "Gifting content peaks in the two weeks before."],
        [new Date(y, 11, 26), "Boxing Day sales", "UK", "UK pharmacy and beauty retailers discount heavily."]
      ].forEach(([d, moment, market, opportunity]) => out.push({ date: iso(d), moment, market, opportunity, auto: true }));
    });
    const keyOf = c => `${c.date}|${String(c.moment).toLowerCase().slice(0, 12)}`;
    const extraKeys = new Set((extra || []).map(keyOf));
    const from = iso(add(today, -7)), to = iso(add(today, 365));
    return [...(extra || []), ...out.filter(c => !extraKeys.has(keyOf(c)) && !(extra || []).some(e => e.date === c.date))]
      .filter(c => c.date >= from && c.date <= to).sort((a, b) => a.date.localeCompare(b.date));
  }

  window.loadPulseData = async function () {
    const [tabs, posts, status, hist] = await Promise.all([
      Promise.all(TABS.map(t => loadTab(t))),
      Promise.all(PLATFORMS.map(p => loadTab(`posts/${p}`))),
      Promise.all(SOURCES.map(s => loadJSON(`data/status/${s}.json`))),
      loadTab("history/weekly")
    ]);
    const data = { kpis: [], products: [] };
    TABS.forEach((t, i) => { data[t] = tabs[i].rows; });
    data.history = hist.rows;
    data.accounts = data.accounts.filter(a => a.platform !== "TikTok");  // TikTok counts are shown live by TikTok
    // Google News feed links ("/rss/articles/") are meant for feed readers and can show a
    // "We're sorry" page in a browser. The normal web link opens the article itself.
    data.news.forEach(n => { if (n.link) n.link = n.link.replace("news.google.com/rss/articles/", "news.google.com/articles/"); });
    data.calendar = buildCalendar(data.calendar);
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
