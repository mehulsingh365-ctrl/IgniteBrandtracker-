/* =====================================================================
   IGNITE — TRENDS & WHAT TO DO
   Reads the live data (press articles, brand posts, YouTube uploads,
   follower counts, calendar) every time the page loads, finds what changed
   recently, and turns each finding into a suggested action for Vichy.
   Fixed rules only: no AI, no guessing. Every number comes from the data.
   ===================================================================== */

window.PulseTrends = (function () {
  const FOCUS = "Vichy";
  const DAY = 86400000;

  // Themes we look for in headlines and post captions, and how Vichy could answer each one.
  const THEMES = [
    { name: "Sun protection", words: ["sunscreen", "spf", "solaire", "anthelios", "capital soleil", " uv", "sun care", "sun protection", "bemt"],
      action: "Bring Capital Soleil into the conversation: an expert explainer on everyday SPF, or a reply to the new filters in the news." },
    { name: "Acne and oily skin", words: ["acne", "blemish", "imperfection", "effaclar", "normaderm", "oily skin", "pores", "breakout"],
      action: "Use Normaderm: a dermatologist answering common acne questions works well as a short video." },
    { name: "Sensitive skin and the skin barrier", words: ["sensitive", "sensible", "barrier", "barriere", "eczema", "atopic", "atopique", "cicaplast", "toleriane", "lipikar", "irritat", "dry skin", "peau seche", "reactive"],
      action: "Answer with Minéral 89: barrier care and winter dryness, explained simply by a dermatologist." },
    { name: "Anti-ageing", words: ["anti aging", "anti-aging", "anti age", "anti-age", "wrinkle", "rides", "retinol", "collagen", "liftactiv", "neovadiol", "mature skin", "peau mature", "ageing", "aging"],
      action: "Put Liftactiv or Neovadiol forward with proof: before and after results, or a dermatologist's routine for mature skin." },
    { name: "Vitamin C and glow", words: ["vitamin c", "vitamine c", "glow", "eclat", "radiance", "brighten"],
      action: "Lean on Liftactiv Vitamin C: a 'winter glow' angle fits this season." },
    { name: "Hydration and serums", words: ["hyaluronic", "hyaluronique", "hydrat", "moisturi", "mineral 89", "serum", "hyalu"],
      action: "Show Minéral 89 in a simple routine: texture shots and 'one step' messages do well." },
    { name: "Hair and scalp", words: ["hair", "cheveux", "scalp", "cuir chevelu", "dandruff", "pellicule", "shampoo", "shampooing", "dercos"],
      action: "Use Dercos: scalp care content is a gap most skincare brands leave open." },
    { name: "Gifting and promotions", words: ["black friday", "cyber monday", "gift", "cadeau", "christmas", "noel", "advent", "calendrier", "promo", "deal", "discount", "soldes", "holiday", "sale "],
      action: "Make Vichy's gift sets easy to find: one clear gifting post per week until Christmas, with where to buy." },
    { name: "Dermatologists and science", words: ["dermatolog", "science", "study", "etude", "clinical", "clinique", "research", "recherche", "laborator", "living lab"],
      action: "Lead with Vichy's own science: a dermatologist on camera or a study result, kept short and concrete." },
    { name: "Product launches", words: ["launch", "lance ", "lancement", "new ", "nouveau", "nouvelle", "introduc", "unveil", "debut"],
      action: "Watch the launch closely: if it targets a Vichy range, prepare a comparison or a reminder of Vichy's own hero product." },
    { name: "Partnerships and events", words: ["partner", "partenariat", "sponsor", "racing", "sailing", "ambassador", "ambassadeur", "festival", "event", "campaign", "campagne", "collab", "dune", "film", "cinema"],
      action: "Check whether Vichy has a partnership or event story to tell now; competitors are getting coverage from theirs." },
    { name: "Reviews and creators", words: ["review", "tested", "we tried", "i tried", "holy grail", "influenc", "viral", "dupe", "best ", "favourite", "favorite"],
      action: "Seed Vichy products with reviewers: 'tested' and 'best of' lists are where competitors are being named." }
  ];

  const norm = s => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[’']/g, " ");
  const themesOf = text => { const t = " " + norm(text) + " "; return THEMES.filter(th => th.words.some(w => t.includes(w))); };
  const ts = r => new Date(`${r.date}T${(r.time || "12:00").slice(0, 5)}:00`).getTime();
  const n = v => Number(v) || 0;
  const fmt = v => v >= 1e6 ? (v / 1e6).toFixed(1).replace(/\.0$/, "") + "M" : v >= 1e4 ? Math.round(v / 1e3) + "K" : v >= 1e3 ? (v / 1e3).toFixed(1).replace(/\.0$/, "") + "K" : String(Math.round(v));
  const plural = (k, w) => `${k} ${w}${k === 1 ? "" : "s"}`;
  const pctChange = (cur, prev) => prev ? Math.round(((cur - prev) / prev) * 100) : null;

  function windowOf(rows, fromDaysAgo, toDaysAgo, now) {
    const a = now - fromDaysAgo * DAY, b = now - toDaysAgo * DAY;
    return rows.filter(r => { const t = ts(r); return t > a && t <= b; });
  }

  function compute(DATA) {
    const now = Date.now();
    const out = [];
    const news = (DATA.news || []).filter(r => r.date);
    const posts = (DATA.competitor_posts || []).filter(r => r.date);

    // 1. Upcoming marketing moment
    const upcoming = (DATA.calendar || []).map(c => ({ ...c, days: Math.ceil((new Date(c.date + "T00:00:00").getTime() - now) / DAY) }))
      .filter(c => c.days >= 0 && c.days <= 14).sort((a, b) => a.days - b.days)[0];
    if (upcoming) {
      const gifting = THEMES.find(t => t.name === "Gifting and promotions");
      const promoPosts = windowOf(posts, 7, 0, now).filter(p => themesOf(`${p.topic} ${p.summary} ${p.product}`).includes(gifting));
      const promoNews = windowOf(news, 7, 0, now).filter(r => themesOf(r.title).includes(gifting));
      const brands = [...new Set(promoPosts.map(p => p.brand))];
      out.push({ score: 90 - upcoming.days, tag: "Coming up", window: upcoming.days === 0 ? "Today" : `In ${plural(upcoming.days, "day")}`,
        title: `${upcoming.moment} is ${upcoming.days === 0 ? "today" : upcoming.days === 1 ? "tomorrow" : `in ${upcoming.days} days`}`,
        evidence: `In the last 7 days: ${plural(promoPosts.length, "gifting or promo post")}${brands.length ? ` (${brands.join(", ")})` : ""} and ${plural(promoNews.length, "press article")} on gifting and deals.`,
        action: gifting.action, source: "Calendar, posts and press" });
    }

    // 2. Press themes that are rising
    const nCur = windowOf(news, 7, 0, now), nPrev = windowOf(news, 14, 7, now);
    if (nCur.length >= 3) {
      const count = rows => { const c = {}; rows.forEach(r => themesOf(r.title).forEach(t => { c[t.name] = (c[t.name] || 0) + 1; })); return c; };
      const cc = count(nCur), cp = count(nPrev);
      const ranked = THEMES.map(t => ({ t, cur: cc[t.name] || 0, prev: cp[t.name] || 0 }))
        .filter(x => x.cur >= 2 && x.cur >= x.prev && x.t.name !== "Product launches").sort((a, b) => (b.cur - b.prev) - (a.cur - a.prev) || b.cur - a.cur);
      ranked.slice(0, 2).forEach((x, i) => {
        const ex = nCur.filter(r => themesOf(r.title).includes(x.t)).sort((a, b) => ts(b) - ts(a));
        const brands = [...new Set(ex.map(r => r.brand))];
        out.push({ score: 70 + Math.min(x.cur - x.prev, 10) * 2 - i * 8, tag: "In the press", window: "Last 7 days",
          title: `${x.t.name} ${x.cur > x.prev ? "is rising" : "is a steady topic"} in the press`,
          evidence: `${plural(x.cur, "article")} this week${x.prev || x.cur > x.prev ? ` vs ${x.prev} the week before` : ""}, mostly about ${brands.slice(0, 3).join(", ")}. Latest: "${ex[0].title}" (${ex[0].source}).`,
          action: x.t.action, link: ex[0].link, source: "Google News" });
      });
    }

    // 3. Share of press coverage, and Vichy's place in it
    const n30 = windowOf(news, 30, 0, now);
    if (n30.length >= 5) {
      const by = {}; n30.forEach(r => { by[r.brand] = (by[r.brand] || 0) + 1; });
      const ranked = Object.entries(by).sort((a, b) => b[1] - a[1]);
      const mine = by[FOCUS] || 0, lead = ranked[0];
      const leadCur = windowOf(news, 7, 0, now).filter(r => r.brand === lead[0]).length;
      const leadPrev = windowOf(news, 14, 7, now).filter(r => r.brand === lead[0]).length;
      out.push({ score: mine === 0 ? 85 : 60, tag: "Share of voice", window: "Last 30 days", level: mine === 0 ? "alert" : "",
        title: mine === 0 ? `Vichy has no press coverage in 30 days; ${lead[0]} has ${lead[1]} articles` : `${lead[0]} leads press coverage; Vichy has ${Math.round(mine / n30.length * 100)}%`,
        evidence: `${ranked.map(([b, k]) => `${b} ${k}`).join(" · ")}. ${lead[0]}: ${leadCur} articles this week vs ${leadPrev} the week before.`,
        action: mine === 0 ? "Give journalists a reason to write about Vichy: a product story, a dermatologist expert comment or a seasonal angle (winter skin, gifting)." : `Look at what ${lead[0]} is being covered for and decide whether Vichy has a matching story.`,
        source: "Google News" });
    }

    // 4. Best competitor post recently, and what to copy from it
    const p14 = windowOf(posts, 14, 0, now).filter(p => n(p.likes) > 0);
    if (p14.length) {
      const comp = p14.filter(p => p.brand !== FOCUS).sort((a, b) => n(b.likes) - n(a.likes));
      const top = comp[0];
      if (top) {
        const same = p14.filter(p => p.platform === top.platform && p.brand === top.brand);
        const avg = same.reduce((s, p) => s + n(p.likes), 0) / same.length;
        const ratio = avg ? n(top.likes) / avg : 0;
        const th = themesOf(`${top.topic} ${top.summary}`).filter(t => t.name !== "Product launches")[0];
        out.push({ score: 72, tag: "What worked", window: "Last 14 days",
          title: `${top.brand}'s best post: "${top.topic}"`,
          evidence: `${fmt(n(top.likes))} likes on ${top.platform} (${String(top.format || "post").toLowerCase()})${ratio >= 1.3 ? `, ${ratio.toFixed(1)}× ${top.brand}'s usual` : ""}${n(top.views) ? `, ${fmt(n(top.views))} views` : ""}.`,
          action: `Borrow the idea, not the post: a Vichy ${String(top.format || "post").toLowerCase()} on ${th ? th.name.toLowerCase() : "the same subject"}${th ? `. ${th.action}` : "."}`,
          link: top.link, source: top.platform });
      }
    }

    // 5. Which format gets the most likes on Instagram
    const ig = windowOf(posts, 30, 0, now).filter(p => p.platform === "Instagram" && p.likes !== "" && p.likes != null);
    if (ig.length >= 8) {
      const g = {}; ig.forEach(p => { const f = p.format || "Post"; (g[f] = g[f] || []).push(n(p.likes)); });
      const median = v => { const s = [...v].sort((a, b) => a - b), m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
      const fm = Object.entries(g).filter(([, v]) => v.length >= 3).map(([f, v]) => ({ f, avg: median(v), k: v.length })).sort((a, b) => b.avg - a.avg);
      if (fm.length >= 2) {
        const mine = ig.filter(p => p.brand === FOCUS);
        const mineBest = mine.filter(p => p.format === fm[0].f).length;
        out.push({ score: 58, tag: "Format", window: "Last 30 days",
          title: `On Instagram, ${fm[0].f.toLowerCase()}s get the most likes`,
          evidence: `${fm.map(x => `${x.f}: ${fmt(x.avg)} likes for a typical post (${x.k} posts)`).join(" · ")}. Vichy used this format for ${mineBest} of its ${mine.length} posts.`,
          action: mine.length && mineBest / mine.length < 0.5 ? `Shift more of Vichy's Instagram posts to ${fm[0].f.toLowerCase()}s.` : `Keep ${fm[0].f.toLowerCase()}s at the centre of Vichy's Instagram plan.`,
          source: "Instagram" });
      }
    }

    // 6. Who is posting the most right now
    const p7 = windowOf(posts, 7, 0, now), p7prev = windowOf(posts, 14, 7, now);
    if (p7.length >= 5) {
      const c = {}; p7.forEach(p => { c[p.brand] = (c[p.brand] || 0) + 1; });
      const ranked = Object.entries(c).sort((a, b) => b[1] - a[1]);
      const mine = c[FOCUS] || 0, minePrev = p7prev.filter(p => p.brand === FOCUS).length;
      out.push({ score: 50, tag: "Activity", window: "Last 7 days",
        title: ranked[0][0] === FOCUS ? "Vichy is the most active brand this week" : `${ranked[0][0]} is posting the most this week`,
        evidence: `${ranked.map(([b, k]) => `${b} ${k}`).join(" · ")}. Vichy: ${mine} this week vs ${minePrev} the week before.`,
        action: ranked[0][0] === FOCUS ? "Volume is there; now check that Vichy's posts earn their share of likes (see Brand health)." : `See what ${ranked[0][0]} is pushing; a busy week usually means a launch or campaign.`,
        source: "Instagram and YouTube" });
    }

    // 7. Fastest-growing YouTube video
    const yt = windowOf(posts, 21, 0, now).filter(p => p.platform === "YouTube" && n(p.views) > 0);
    if (yt.length) {
      const v = yt.map(p => ({ p, perDay: n(p.views) / Math.max(1, (now - ts(p)) / DAY) })).sort((a, b) => b.perDay - a.perDay)[0];
      out.push({ score: 45, tag: "YouTube", window: "Last 21 days",
        title: `Fastest-growing video: ${v.p.brand}, "${v.p.topic}"`,
        evidence: `${fmt(n(v.p.views))} views since ${v.p.date}, about ${fmt(v.perDay)} a day.`,
        action: (themesOf(v.p.topic)[0] || { action: "Note the title style: questions and myth-busting tend to pull views on YouTube." }).action,
        link: v.p.link, source: "YouTube" });
    }

    // 8. Follower growth
    const acc = DATA.accounts || [];
    const grow = [...new Set(acc.map(a => `${a.brand}|${a.platform}`))].map(k => {
      const rows = acc.filter(a => `${a.brand}|${a.platform}` === k).sort((a, b) => a.date.localeCompare(b.date));
      const last = rows[rows.length - 1], first = rows.find(r => (ts(last) - ts(r)) <= 31 * DAY && r !== last);
      return first && n(first.followers) ? { b: last.brand, pl: last.platform, ch: pctChange(n(last.followers), n(first.followers)), from: first.date, to: last.date } : null;
    }).filter(x => x && x.ch !== null).sort((a, b) => b.ch - a.ch);
    if (grow.length >= 2) {
      const mine = grow.find(x => x.b === FOCUS);
      out.push({ score: 48, tag: "Audience", window: `Since ${grow[0].from}`,
        title: `${grow[0].b} is growing fastest on ${grow[0].pl} (${grow[0].ch >= 0 ? "+" : ""}${grow[0].ch}%)`,
        evidence: grow.slice(0, 4).map(x => `${x.b} ${x.ch >= 0 ? "+" : ""}${x.ch}%`).join(" · ") + (mine ? `. Vichy: ${mine.ch >= 0 ? "+" : ""}${mine.ch}%.` : "."),
        action: `Look at ${grow[0].b}'s recent posts below for what is pulling new followers in.`, source: "Profiles" });
    }

    // 9. Brand interest: who people are looking up more (Wikipedia page views)
    const wi = DATA.interest || [];
    if (wi.length) {
      const lastDay = wi.map(r => r.date).sort().pop();
      const end = new Date(lastDay + "T12:00:00").getTime();
      const sumW = (b, from, to) => wi.filter(r => r.brand === b).filter(r => { const t = new Date(r.date + "T12:00:00").getTime(); return t > end - from * DAY && t <= end - to * DAY; }).reduce((a, r) => a + n(r.views), 0);
      const rows = [...new Set(wi.map(r => r.brand))].map(b => ({ b, cur: sumW(b, 7, 0), prev: sumW(b, 14, 7) }))
        .filter(x => x.prev >= 100).map(x => ({ ...x, ch: pctChange(x.cur, x.prev) }));
      const mover = [...rows].sort((a, b) => Math.abs(b.ch) - Math.abs(a.ch))[0];
      const me = rows.find(x => x.b === FOCUS);
      if (mover && Math.abs(mover.ch) >= 15) {
        out.push({ score: 62 + Math.min(Math.abs(mover.ch), 60) / 3, tag: "Brand interest", window: "Last 7 days",
          title: `People are looking up ${mover.b} ${mover.ch > 0 ? "more" : "less"} (${mover.ch > 0 ? "+" : ""}${mover.ch}%)`,
          evidence: `${fmt(mover.cur)} Wikipedia page views this week vs ${fmt(mover.prev)} the week before.${me && me !== mover ? ` Vichy: ${me.ch >= 0 ? "+" : ""}${me.ch}%.` : ""} A jump usually follows a campaign, a launch or press coverage.`,
          action: mover.b === FOCUS ? (mover.ch > 0 ? "Interest in Vichy is up: make sure this week's posts and product pages catch it." : "Interest in Vichy is down: a visible campaign moment or press story would help.") : `Check ${mover.b}'s posts and press from this week (above and in the news) to see what caused it.`,
          source: "Wikipedia page views" });
      }
    }

    // 10. Records from the weekly history (needs at least 4 weeks saved)
    const hist = DATA.history || [];
    const weeks = [...new Set(hist.map(r => r.week))].sort();
    if (weeks.length >= 5) {
      const lastFull = weeks[weeks.length - 2];   // the current week is still running
      const metrics = [["news", "press articles"], ["wiki_views", "Wikipedia page views"], ["likes", "likes on its posts"]];
      const records = [];
      metrics.forEach(([key, label]) => {
        [...new Set(hist.map(r => r.brand))].forEach(b => {
          const series = weeks.slice(0, -1).map(w => hist.find(r => r.week === w && r.brand === b)).filter(r => r && r[key] !== "" && r[key] != null);
          if (series.length < 4) return;
          const v = n(series[series.length - 1][key]);
          const before = series.slice(0, -1).map(r => n(r[key]));
          if (series[series.length - 1].week === lastFull && v > 0 && v > Math.max(...before)) records.push({ b, key, label, v, weeks: series.length });
        });
      });
      const rec = records.find(r => r.b === FOCUS) || records.sort((a, b) => b.weeks - a.weeks)[0];
      if (rec) out.push({ score: rec.b === FOCUS ? 80 : 56, tag: "Record", window: `Week of ${lastFull}`,
        title: `${rec.b}: most ${rec.label} in ${rec.weeks} weeks`,
        evidence: `${fmt(rec.v)} ${rec.label} last week, the highest of the ${rec.weeks} weeks Ignite has saved.`,
        action: rec.b === FOCUS ? "Find out what drove it and repeat it while attention is high." : `Look at ${rec.b}'s activity last week: something is working for them.`,
        source: "Ignite weekly history" });
    }

    return out.sort((a, b) => b.score - a.score);
  }

  return { compute, THEMES, themesOf };
})();
