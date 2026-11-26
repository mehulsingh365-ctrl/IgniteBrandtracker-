/* =====================================================================
   IGNITE — APP (rendering & interactions)
   ===================================================================== */

(function () {
  const CFG = window.PULSE_CONFIG;
  const FOCUS = CFG.focusBrand;
  const $ = id => document.getElementById(id);
  const state = { market: "All", category: "All", platform: "All", sentiment: "All", view: null, creator: "All",
    period: "30", from: "", to: "", sort: "newest", showAll: false, newsBrand: "All" };
  const PLATFORMS = ["All", "Instagram", "YouTube"];  // TikTok has its own live section below
  const CREATORS = ["All", "Dermatologist", "Creator", "Brand"];
  const creatorType = p => p.creator_type || (/dermatolog|\bderms?\b|doctor|\bdr\.?\s/i.test(p.topic + " " + p.summary) ? "Dermatologist" : /@[\w.]+|creator|influencer|testimonial|her daughter|real[- ]people/i.test(p.topic + " " + p.summary) ? "Creator" : "Brand");
  try { state.view = localStorage.getItem("bp_view") || null; } catch (e) {}
  let DATA = null;

  /* ---------- helpers ---------- */
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const color = b => CFG.brandColors[b] || "#444";
  const fmt = n => {
    n = Number(n) || 0;
    if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 1 : 2).replace(/\.?0+$/, "") + "M";
    if (n >= 1e3) return (n / 1e3).toFixed(n >= 1e5 ? 0 : 1).replace(/\.0$/, "") + "K";
    return String(Math.round(n));
  };
  const pct = (v, d = 1) => (v == null || v === "" || isNaN(v)) ? "—" : `${Number(v).toFixed(d)}%`;
  const dateFmt = (d, opts) => { const x = new Date(d + "T12:00:00"); return isNaN(x) ? d : x.toLocaleDateString("en-GB", opts || { day: "numeric", month: "short" }); };
  const isUrl = u => /^https?:\/\//i.test(String(u || ""));

  const productCategory = name => {
    const p = DATA.products.find(x => x.product === name);
    if (p) return p.category;
    return /dercos/i.test(name) ? "Haircare" : "Skincare";
  };
  const matchMarket = r => state.market === "All" || !r.market || r.market === state.market || r.market === "Europe" || r.market === "Global";
  const matchCategory = r => state.category === "All" || (r.category || productCategory(r.product)) === state.category;

  /* ---------- period (date range) ---------- */
  const PERIODS = [["7", "Last 7 days"], ["30", "Last 30 days"], ["90", "Last 90 days"], ["all", "All time"]];
  const localISO = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  function range() {
    if (state.period === "all") return null;
    if (state.period === "custom") return { from: state.from || "", to: state.to || "" };
    const f = new Date(); f.setDate(f.getDate() - (Number(state.period) - 1));
    return { from: localISO(f), to: localISO(new Date()) };
  }
  const matchDate = r => { const R = range(); if (!R || !r.date) return true; return (!R.from || r.date >= R.from) && (!R.to || r.date <= R.to); };
  const relTime = iso => {
    if (!iso) return "not yet";
    const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
    if (isNaN(mins)) return "not yet";
    if (mins < 2) return "just now";
    if (mins < 60) return `${mins} min ago`;
    const h = Math.round(mins / 60);
    if (h < 24) return `${h} h ago`;
    const d = Math.round(h / 24);
    return `${d} day${d > 1 ? "s" : ""} ago`;
  };
  const fresh = keys => keys.map(k => DATA.status[k]).filter(st => st && st.last_run)
    .map(st => `${esc(st.source)} ${relTime(st.last_run)}`).join(" · ");
  const allDates = () => DATA.competitor_posts.map(p => p.date).concat(DATA.listening.map(m => m.date)).filter(Boolean).sort();
  const longDate = d => dateFmt(d, { day: "numeric", month: "short", year: "numeric" });

  function view() {
    return {
      posts: DATA.competitor_posts.filter(r => matchMarket(r) && matchCategory(r) && matchDate(r)),
      keywords: DATA.keywords.filter(r => matchMarket(r) && matchCategory(r)),
      hashtags: DATA.hashtags.filter(matchMarket),
      listening: DATA.listening.filter(r => matchMarket(r) && matchCategory(r) && matchDate(r)),
      products: DATA.products.filter(matchCategory),
      news: (() => { const seen = new Set(); return DATA.news.filter(matchDate).filter(n => {
        const k = `${n.brand}|${n.source}|${n.date}|${String(n.title).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().split(" ").slice(0, 4).join(" ")}`;
        if (seen.has(k)) return false; seen.add(k); return true; }); })()
    };
  }

  function delta(cur, prev, unit = "%", invert = false) {
    if (prev == null || prev === "" || cur == null) return `<span class="delta delta--flat">—</span>`;
    const diff = unit === "pts" ? cur - prev : ((cur - prev) / prev) * 100;
    const good = invert ? diff < 0 : diff > 0;
    const cls = Math.abs(diff) < 0.05 ? "flat" : good ? "up" : "down";
    const arrow = diff > 0 ? "▲" : diff < 0 ? "▼" : "";
    const val = unit === "pts" ? `${Math.abs(diff).toFixed(1)} pts` : `${Math.abs(diff).toFixed(1)}%`;
    return `<span class="delta delta--${cls}">${arrow} ${val}</span> <span class="muted small">vs last week</span>`;
  }

  function spark(values, c) {
    if (values.length < 2) return "";
    const w = 160, h = 28, min = Math.min(...values), max = Math.max(...values), r = max - min || 1;
    const pts = values.map((v, i) => `${(i / (values.length - 1)) * w},${h - 3 - ((v - min) / r) * (h - 6)}`).join(" ");
    return `<svg class="spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><polyline points="${pts}" fill="none" stroke="${c}" stroke-width="1.5"/></svg>`;
  }

  /* ---------- render: chrome ---------- */
  function renderChrome() {
    const meta = DATA._meta;
    const updated = meta.lastUpdated ? longDate(meta.lastUpdated) : "";
    const n = DATA.competitor_posts.length;
    $("announceText").textContent = n
      ? `Updated ${relTime(meta.lastRun) !== "not yet" ? relTime(meta.lastRun) : updated} · ${n} real posts from ${meta.brands.length} brands${DATA.news.length ? ` · ${DATA.news.length} news articles` : ""}`
      : "No data yet";
    $("heroLabel").textContent = updated ? `Updated ${updated}` : "";
    $("footerUpdated").textContent = updated ? `Last updated ${updated}.` : "";
    const lead = (window.PulseTrends ? PulseTrends.compute(DATA) : [])[0];
    if (lead) { $("heroTitle").textContent = lead.title; $("heroText").textContent = `${lead.evidence} What to do: ${lead.action}`; }
    else { $("heroTitle").textContent = "Not enough recent data for trends yet"; $("heroText").textContent = ""; }
  }

  function renderFilters() {
    // Mobile filter (inside mobile menu)
    const mm = $("mobileMenu");
    if (!$("mCategory")) {
      const wrap = document.createElement("div");
      wrap.style.cssText = "display:flex;gap:16px;padding:14px var(--pad);border-top:1px solid var(--line)";
      wrap.innerHTML = `<label class="select"><select id="mCategory" aria-label="Category">${$("categorySelect").innerHTML}</select></label>`;
      mm.prepend(wrap);
    }
    $("mCategory").value = state.category;

    // Period bar
    $("periodPresets").innerHTML = PERIODS.map(([k, l]) => `<button type="button" data-period="${k}" aria-pressed="${state.period === k}">${l}</button>`).join("")
      + (state.period === "custom" ? `<button type="button" aria-pressed="true" disabled>Custom</button>` : "");
    const R = range(), ds = allDates();
    $("dateFrom").value = R ? R.from : (ds[0] || "");
    $("dateTo").value = R ? R.to : (ds[ds.length - 1] || "");
    const v = view();
    const label = R ? `${R.from ? longDate(R.from) : "Start"} – ${R.to ? longDate(R.to) : "today"}` : "All time";
    $("periodSummary").innerHTML = `Showing <strong>${label}</strong> · ${v.posts.length} post${v.posts.length === 1 ? "" : "s"} ${DATA.listening.length ? ` · ${v.listening.length} mention${v.listening.length === 1 ? "" : "s"}` : ""}`
      + (ds.length ? ` <span class="muted">· Latest data: ${longDate(ds[ds.length - 1])}</span>` : "");
  }

  /* ---------- embeds: turn a post URL into the official platform embed ---------- */
  function embedInfo(url) {
    url = String(url || "").trim();
    if (!isUrl(url)) return null;
    let m;
    // YouTube: watch?v=, youtu.be/, /shorts/, /embed/
    if ((m = url.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([\w-]{11})/i))) {
      const vertical = /\/shorts\//i.test(url);
      return { type: "youtube", vertical,
        src: `https://www.youtube-nocookie.com/embed/${m[1]}?rel=0&modestbranding=1`,
        thumb: `https://i.ytimg.com/vi/${m[1]}/hqdefault.jpg` };
    }
    // Instagram: /p/CODE, /reel/CODE, /tv/CODE
    if ((m = url.match(/instagram\.com\/(?:[\w.]+\/)?(?:p|reel|reels|tv)\/([\w-]+)/i))) {
      return { type: "instagram", vertical: true, src: `https://www.instagram.com/p/${m[1]}/embed/` };
    }
    // TikTok: /@user/video/ID (short vm.tiktok.com links can't be resolved — use the full link)
    if ((m = url.match(/tiktok\.com\/(?:@[\w.-]+\/(?:video|photo)\/|embed\/v2\/|player\/v1\/)(\d+)/i))) {
      return { type: "tiktok", vertical: true, src: `https://www.tiktok.com/player/v1/${m[1]}?description=1&music_info=0&rel=0` };
    }
    // LinkedIn: /posts/...-activity-123..., /feed/update/urn:li:activity:123 or urn:li:share:123
    if ((m = url.match(/linkedin\.com\/.*?(activity|share|ugcPost)[-:](\d{15,25})/i))) {
      const kind = m[1].toLowerCase() === "ugcpost" ? "ugcPost" : m[1].toLowerCase();
      return { type: "linkedin", vertical: false, src: `https://www.linkedin.com/embed/feed/update/urn:li:${kind}:${m[2]}` };
    }
    return null;
  }

  function embedFrame(e, title) {
    return `<div class="embed embed--${e.type}${e.vertical ? " embed--vertical" : ""}">
      <iframe src="${esc(e.src)}" title="${esc(title)}" loading="lazy" allowfullscreen
        allow="autoplay; encrypted-media; picture-in-picture; clipboard-write" referrerpolicy="strict-origin-when-cross-origin"></iframe>
    </div>`;
  }

  /* ---------- render: posts ---------- */
  function renderPosts(v) {
    const platforms = [...new Set([...PLATFORMS, ...DATA.competitor_posts.map(p => p.platform)])];
    $("creatorChips").innerHTML = `<span class="chip-row__label">On camera:</span>` + CREATORS.map(c => `<button data-creator="${c}" aria-pressed="${c === state.creator}">${c === "All" ? "Everyone" : c === "Creator" ? "Creators & real people" : c === "Brand" ? "Brand-made" : "Dermatologists"}</button>`).join("");
    $("platformTabs").innerHTML = platforms.map(p => `<button role="tab" data-platform="${esc(p)}" aria-selected="${p === state.platform}">${p === "All" ? "All platforms" : esc(p)}</button>`).join("");

    const filtered = v.posts.filter(p => (state.platform === "All" || p.platform === state.platform) && (state.creator === "All" || creatorType(p) === state.creator));
    const sorted = [...filtered].sort(
      state.sort === "newest" ? (a, b) => `${b.date} ${b.time || ""}`.localeCompare(`${a.date} ${a.time || ""}`)
      : state.sort === "engagement" ? (a, b) => (b.engagement_rate ?? -1) - (a.engagement_rate ?? -1)
      : (a, b) => (Number(b.likes) || 0) - (Number(a.likes) || 0));
    const posts = state.showAll ? sorted : sorted.slice(0, 8);
    $("sortSelect").value = state.sort;
    const more = $("showAllBtn");
    more.hidden = sorted.length <= 8;
    more.textContent = state.showAll ? "Show fewer" : `Show all ${sorted.length} posts`;
    renderTimeline(filtered);
    const topIdx = state.sort === "newest" ? -1 : 0;

    const linked = posts.filter(p => embedInfo(p.link)).length;
    $("viewToggle").innerHTML = `
      <button data-view="tiles" aria-pressed="${state.view === "tiles"}">Tiles</button>
      <button data-view="creatives" aria-pressed="${state.view === "creatives"}">Creatives${linked ? ` (${linked})` : ""}</button>`;
    $("creativeNote").hidden = !(state.view === "creatives" && linked < posts.length);
    $("creativeNote").textContent = linked
      ? `${posts.length - linked} of ${posts.length} posts don't have a link yet. Add it in the "link" column to show the post here.`
      : `No post links yet. Add each post's Instagram, TikTok, YouTube or LinkedIn link in the "link" column and the posts will show here.`;

    $("postGrid").classList.toggle("is-creatives", state.view === "creatives");
    $("postGrid").innerHTML = posts.length ? posts.map((p, i) => {
      const e = embedInfo(p.link);
      const live = state.view === "creatives" && e;
      const thumb = e && e.thumb ? `background-image:linear-gradient(180deg,rgba(0,0,0,.25),rgba(0,0,0,.55)),url('${e.thumb}');background-size:cover;background-position:center;` : "";
      return `
      <article class="card${live ? " card--live" : ""}" data-post="${DATA.competitor_posts.indexOf(p)}" tabindex="0" aria-label="${esc(p.brand)}: ${esc(p.topic)}">
        <div class="card__media">
          ${i === topIdx ? `<span class="badge-top">Top post</span>` : ""}
          ${live ? embedFrame(e, `${p.brand} — ${p.topic}`) : `
          <div class="card__tile${e && e.type === "tiktok" ? " js-oembed" : ""}" data-link="${esc(p.link)}" style="background-color:${color(p.brand)};${thumb}">
            <div class="card__top"><span>${i === topIdx ? "" : esc(p.platform)}</span><span>${esc(p.format)}</span></div>
            <div class="card__topic">${esc(p.topic)}</div>
            <div class="card__top"><span class="card__product">${esc(p.product)}</span><span class="card__rank">${e ? "▶ " : ""}${state.sort !== "newest" ? `No.${i + 1}` : ""}</span></div>
          </div>
          <div class="card__hover">
            <div><b>${fmt(p.likes)}</b><span>Likes</span></div>
            <div><b>${p.comments !== "" && p.comments != null ? fmt(p.comments) : "—"}</b><span>Comments</span></div>
            <div><b>${p.views ? fmt(p.views) : "—"}</b><span>Views</span></div>
          </div>`}
        </div>
        <div class="card__info">
          <div class="card__brand"><i class="dot" style="background:${color(p.brand)}"></i>${esc(p.brand)}${p.brand === FOCUS ? ' <span class="chip">Focus</span>' : ""}</div>
          <div class="card__metric">${p.likes !== "" && p.likes != null ? `${fmt(p.likes)} <small>likes</small>` : `<small>Likes not recorded</small>`}${p.engagement_rate != null ? ` <small class="card__er">· ${pct(p.engagement_rate, 2)} eng. ${p.er_basis === "views" ? "per view" : "per follower"}</small>` : ""}</div>
          <div class="card__note">${esc(p.platform)} · ${dateFmt(p.date)}${p.time ? ` · ${esc(p.time)}` : ""}${p.views ? ` · ${fmt(p.views)} views` : ""}</div>
          <div class="card__tags"><span class="tag-soft">${creatorType(p)}</span><span class="tag-soft">${esc(p.format)}</span></div>
          <button class="card__btn" data-quick="${DATA.competitor_posts.indexOf(p)}">Quick view</button>
        </div>
      </article>`; }).join("")
      : `<div class="empty">${state.platform === "LinkedIn" ? "No LinkedIn posts yet. They'll appear after the next update. Expect company news, partnerships and employer branding." : !v.posts.length ? `No posts in this period. The latest post we have is from ${longDate(DATA.competitor_posts.map(p => p.date).sort().pop() || "")}. Try a longer period.` : "Nothing matches these filters. Try All platforms or Everyone."}</div>`;
    if (state.view !== "creatives") loadThumbs();
  }

  /* ---------- real thumbnails: YouTube (direct) and TikTok (official oEmbed) ---------- */
  const thumbCache = {};
  function loadThumbs() {
    document.querySelectorAll(".card__tile.js-oembed").forEach(async tile => {
      const link = tile.dataset.link;
      try {
        if (!(link in thumbCache)) {
          const r = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(link)}`);
          thumbCache[link] = r.ok ? (await r.json()).thumbnail_url || "" : "";
        }
        if (thumbCache[link]) {
          tile.style.backgroundImage = `linear-gradient(180deg,rgba(0,0,0,.25),rgba(0,0,0,.55)),url('${thumbCache[link]}')`;
          tile.style.backgroundSize = "cover"; tile.style.backgroundPosition = "center";
          tile.classList.add("has-thumb");
        }
      } catch (e) { thumbCache[link] = ""; }
    });
  }

  /* ---------- posting timeline ---------- */
  function renderTimeline(list) {
    const el = $("postTimeline");
    const dated = list.filter(p => p.date);
    if (!dated.length) { el.innerHTML = `<div class="empty">No posts to plot for this period.</div>`; $("timelineNote").textContent = ""; return; }
    const R = range();
    const sortedDates = dated.map(p => p.date).sort();
    const from = (R && R.from) || sortedDates[0], to = (R && R.to) || sortedDates[sortedDates.length - 1];
    const d0 = new Date(from + "T00:00:00"), d1 = new Date(to + "T00:00:00");
    const days = Math.max(1, Math.round((d1 - d0) / 864e5) + 1);
    const brands = [...new Set(dated.map(p => p.brand))].sort((a, b) => (b === FOCUS) - (a === FOCUS) || dated.filter(p => p.brand === b).length - dated.filter(p => p.brand === a).length);
    const ers = dated.map(p => p.engagement_rate || 0), maxEr = Math.max(...ers) || 1;
    const pos = p => {
      const di = Math.round((new Date(p.date + "T00:00:00") - d0) / 864e5);
      const [h, m] = String(p.time || "12:00").split(":").map(Number);
      return ((di + ((h || 0) * 60 + (m || 0)) / 1440) / days) * 100;
    };
    const ticks = [];
    const step = Math.max(1, Math.ceil(days / 7));
    for (let i = 0; i < days; i += step) { const d = new Date(d0); d.setDate(d.getDate() + i); ticks.push({ left: (i / days) * 100, label: d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }) }); }
    const weekends = [];
    for (let i = 0; i < days; i++) { const d = new Date(d0); d.setDate(d.getDate() + i); if (d.getDay() === 0 || d.getDay() === 6) weekends.push(`<span class="tl-weekend" style="left:${(i / days) * 100}%;width:${100 / days}%"></span>`); }
    el.innerHTML = `<div class="tlc">
      ${brands.map(b => {
        const ps = dated.filter(p => p.brand === b);
        return `<div class="tlc__row">
          <span class="tlc__brand"><i class="dot" style="background:${color(b)}"></i>${esc(b)} <span class="muted">${ps.length}</span></span>
          <div class="tlc__track">${weekends.join("")}${ps.map(p => {
            const size = 9 + Math.round(((p.engagement_rate || 0) / maxEr) * 13);
            const tip = `${p.brand} · ${dateFmt(p.date, { weekday: "short", day: "numeric", month: "short" })}${p.time ? " " + p.time : ""} · ${p.platform}\n${p.topic}\n${pct(p.engagement_rate, 2)} engagement`;
            return `<button class="tlc__dot" data-post="${DATA.competitor_posts.indexOf(p)}" data-tip="${esc(tip)}" aria-label="${esc(tip)}" style="left:${pos(p)}%;width:${size}px;height:${size}px;background:${color(b)}"></button>`;
          }).join("")}</div>
        </div>`;
      }).join("")}
      <div class="tlc__axis"><span></span><div class="tlc__ticks">${ticks.map(t => `<span style="left:${t.left}%">${t.label}</span>`).join("")}</div></div>
    </div>`;
    $("timelineNote").textContent = `${dated.length} post${dated.length === 1 ? "" : "s"} across ${days} day${days === 1 ? "" : "s"} · weekends shaded`;
  }

  /* ---------- render: brief ---------- */
  function renderBrief() {
    const trends = window.PulseTrends ? PulseTrends.compute(DATA) : [];
    const link = t => t.link ? ` <a class="brief__link" href="${esc(t.link)}" target="_blank" rel="noopener">See it</a>` : "";
    $("insightList").innerHTML = trends.length ? trends.slice(0, 3).map(t => `
      <li><div><p class="brief__meta brief__meta--top">${esc(t.tag)} · ${esc(t.window)}</p><h3>${esc(t.title)}</h3><p>${esc(t.evidence)}${link(t)}</p>
      <p class="brief__action"><strong>What to do:</strong> ${esc(t.action)}</p></div></li>`).join("")
      : `<li><div><h3>Not enough recent data yet</h3><p>Trends appear once there are posts or articles from the last two weeks.</p></div></li>`;
    $("flagList").innerHTML = trends.slice(3, 8).map(t => `
      <div class="flag flag--${t.level || "info"}"><p class="eyebrow">${esc(t.tag)} · ${esc(t.window)}</p><p><strong>${esc(t.title)}</strong></p>
      <p>${esc(t.evidence)}${link(t)}</p><p class="flag__action">What to do: ${esc(t.action)}</p></div>`).join("");
  }

  /* ---------- render: health ---------- */
  function renderHealth(insight) {
    const v = view();
    const posts = v.posts;
    const R = range();
    $("healthPeriod").textContent = R ? `${R.from ? longDate(R.from) : ""} – ${R.to ? longDate(R.to) : ""}` : "All time";

    // Latest follower count per brand and platform
    const latest = {};
    DATA.accounts.forEach(a => { const k = `${a.brand}|${a.platform}`; if (!latest[k] || a.date > latest[k].date) latest[k] = a; });
    const prevOf = a => DATA.accounts.filter(x => x.brand === a.brand && x.platform === a.platform && x.date < a.date).sort((x, y) => y.date.localeCompare(x.date))[0];
    const fol = (b, plat) => latest[`${b}|${plat}`];
    const brands = [...new Set([...DATA.accounts.map(a => a.brand), ...posts.map(p => p.brand)])];

    const likes = {}, count = {};
    posts.forEach(p => { count[p.brand] = (count[p.brand] || 0) + 1; if (p.likes !== "" && p.likes != null) likes[p.brand] = (likes[p.brand] || 0) + Number(p.likes); });
    const totalLikes = Object.values(likes).reduce((a, b) => a + b, 0);
    const share = b => totalLikes ? ((likes[b] || 0) / totalLikes) * 100 : 0;
    const withLikes = b => posts.filter(p => p.brand === b && p.likes !== "" && p.likes != null).length;
    const avgLikes = b => withLikes(b) ? (likes[b] || 0) / withLikes(b) : 0;

    if (!posts.length && !DATA.accounts.length) {
      $("kpiRow").innerHTML = `<div class="empty">No posts in this period. Try a longer period.</div>`;
      ["sovChart", "erChart", "audienceTable", "sovSowhat", "erSowhat"].forEach(id => $(id).innerHTML = "");
      return;
    }

    // KPI tiles (Vichy)
    const ig = fol(FOCUS, "Instagram");
    const totalFol = ig ? ig.followers : 0;
    const igPrev = ig && prevOf(ig);
    const ranked = brands.map(b => ({ b, s: share(b) })).sort((a, b) => b.s - a.s);
    const rank = ranked.findIndex(x => x.b === FOCUS) + 1;
    const compBrands = brands.filter(b => b !== FOCUS && withLikes(b));
    const compAvg = compBrands.length ? compBrands.reduce((a, b) => a + avgLikes(b), 0) / compBrands.length : 0;
    const mostActive = brands.filter(b => b !== FOCUS).sort((a, b) => (count[b] || 0) - (count[a] || 0))[0];
    const tiles = [
      { label: "Instagram followers", tip: "Vichy's followers on Instagram, from the public profile. TikTok followers are shown live in the TikTok section.", val: fmt(totalFol),
        sub: `${ig ? `Checked ${dateFmt(ig.date)}` : "—"}${igPrev && Number(ig.followers) < 100000 ? ` · ${delta(ig.followers, igPrev.followers)}` : ""}` },
      { label: "Posts published", tip: "Vichy posts in the selected period, across the platforms we track.", val: String(count[FOCUS] || 0),
        sub: mostActive ? `Most active competitor: ${esc(mostActive)} (${count[mostActive] || 0})` : "" },
      { label: "Average likes per post", tip: "Total likes divided by number of posts in the selected period.", val: fmt(avgLikes(FOCUS)),
        sub: `Competitor average: ${fmt(compAvg)}` },
      { label: "Share of engagement", tip: "Vichy's share of all likes on the tracked brands' posts in the selected period.", val: pct(share(FOCUS)),
        sub: rank ? `Rank #${rank} of ${ranked.length}` : "" }
    ];
    $("kpiRow").innerHTML = tiles.map(t => `
      <div class="kpi"><div class="kpi__label">${t.label} <button class="info" data-tip="${esc(t.tip)}">i</button></div>
      <div class="kpi__value">${t.val}</div><div class="kpi__sub">${t.sub}</div></div>`).join("");

    // Share of engagement bars
    const sov = ranked.filter(x => (likes[x.b] || 0) > 0).map(x => ({ brand: x.b, v: x.s }));
    $("sovChart").innerHTML = sov.length ? bars(sov, x => pct(x)) : `<div class="empty">No likes recorded in this period.</div>`;
    const leader = sov[0];
    $("sovSowhat").innerHTML = leader ? `${leader.brand === FOCUS ? "Vichy leads" : `<strong>${esc(leader.brand)}</strong> leads`} with ${pct(leader.v)} of all likes. Vichy has <strong>${pct(share(FOCUS))}</strong> from ${count[FOCUS] || 0} posts (rank #${rank}).` : "";

    // Instagram engagement rate (likes / followers)
    const igEr = brands.map(b => {
      const ps = posts.filter(p => p.brand === b && p.platform === "Instagram" && p.engagement_rate != null);
      return ps.length ? { brand: b, v: ps.reduce((a, p) => a + p.engagement_rate, 0) / ps.length, n: ps.length } : null;
    }).filter(Boolean).sort((a, b) => b.v - a.v);
    $("erChart").innerHTML = igEr.length ? bars(igEr, x => pct(x, 2)) : `<div class="empty">No Instagram posts in this period.</div>`;
    const vEr = igEr.find(x => x.brand === FOCUS);
    const others = igEr.filter(x => x.brand !== FOCUS);
    const median = others.length ? [...others].sort((a, b) => a.v - b.v)[Math.floor(others.length / 2)].v : null;
    $("erSowhat").innerHTML = igEr.length ? `<strong>${esc(igEr[0].brand)}</strong> gets the strongest reaction per follower (${pct(igEr[0].v, 2)}).${vEr && median != null ? ` Vichy is at ${pct(vEr.v, 2)}, ${vEr.v >= median ? "above" : "below"} the typical competitor (${pct(median, 2)}).` : ""}` : "";

    // Brand interest (Wikipedia page views, last 30 days vs the 30 before)
    renderInterest();

    // Audience table
    const plats = [...new Set(DATA.accounts.map(a => a.platform))];
    const totalF = b => plats.reduce((s2, pl) => s2 + (fol(b, pl)?.followers || 0), 0);
    const rows = brands.filter(b => plats.some(pl => fol(b, pl))).sort((a, b) => (b === FOCUS) - (a === FOCUS) || totalF(b) - totalF(a));
    $("audienceTable").innerHTML = rows.length ? `<table class="atable"><thead><tr><th>Brand</th>${plats.map(pl => `<th>${esc(pl)}</th>`).join("")}<th>Posts in period</th></tr></thead><tbody>${
      rows.map(b => `<tr class="${b === FOCUS ? "is-focus" : ""}"><td><i class="dot" style="background:${color(b)}"></i>${esc(b)}</td>${plats.map(pl => { const a = fol(b, pl); return `<td>${a ? `<a href="${esc(a.url)}" target="_blank" rel="noopener">${fmt(a.followers)}</a><small>${esc(a.handle)}</small>` : "—"}</td>`; }).join("")}<td>${count[b] || 0}</td></tr>`).join("")
    }</tbody></table>` : `<div class="empty">No follower data yet.</div>`;

    const checked = plats.map(pl => { const ds = DATA.accounts.filter(a => a.platform === pl).map(a => a.date).sort(); return `${pl} ${dateFmt(ds[ds.length - 1])}`; }).join(", ");
    $("healthSource").textContent = `Source: public posts and profiles on ${DATA._meta.platforms.join(", ")}; brand interest from Wikimedia page view statistics. Likes are counted as shown on each post. Followers and subscribers checked: ${checked}.`;
  }

  function renderInterest() {
    const el = $("interestChart"); if (!el) return;
    const rows = DATA.interest || [];
    if (!rows.length) { el.innerHTML = `<div class="empty">Starts with the first daily update.</div>`; $("interestSowhat").innerHTML = ""; return; }
    const last = rows.map(r => r.date).sort().pop();
    const day = d => new Date(d + "T00:00:00").getTime();
    const sum = (b, from, to) => rows.filter(r => r.brand === b && day(r.date) > day(last) - from * 864e5 && day(r.date) <= day(last) - to * 864e5).reduce((a, r) => a + Number(r.views || 0), 0);
    const brands = [...new Set(rows.map(r => r.brand))];
    const data = brands.map(b => ({ brand: b, v: sum(b, 30, 0), prev: sum(b, 60, 30) })).sort((a, b) => b.v - a.v);
    el.innerHTML = bars(data, x => fmt(x));
    const ch = x => x.prev ? Math.round((x.v / x.prev - 1) * 100) : null;
    const mover = [...data].filter(x => ch(x) !== null && x.v >= 300).sort((a, b) => Math.abs(ch(b)) - Math.abs(ch(a)))[0];
    const me = data.find(x => x.brand === FOCUS);
    $("interestSowhat").innerHTML = `<strong>${esc(data[0].brand)}</strong> is looked up most (${fmt(data[0].v)} page views in 30 days).${me ? ` Vichy: ${fmt(me.v)}${ch(me) !== null ? ` (${ch(me) >= 0 ? "+" : ""}${ch(me)}% vs the 30 days before)` : ""}.` : ""}${mover && mover.brand !== FOCUS ? ` Biggest change: ${esc(mover.brand)} ${ch(mover) >= 0 ? "+" : ""}${ch(mover)}%.` : ""} <span class="muted">Data up to ${dateFmt(last)}.</span>`;
  }

  function bars(rows, label) {
    const max = Math.max(...rows.map(r => r.v)) || 1;
    return rows.map(r => `
      <div class="bar ${r.brand === FOCUS ? "bar--hl" : ""}">
        <span class="bar__name"><i class="dot" style="background:${color(r.brand)}"></i>${esc(r.brand)}</span>
        <span class="bar__track"><span class="bar__fill" style="width:${(r.v / max) * 100}%;background:${r.brand === FOCUS ? color(r.brand) : "#b9b9b9"}"></span></span>
        <span class="bar__val">${label(r.v)}</span>
      </div>`).join("");
  }

  /* ---------- render: trends ---------- */
  function renderTrends(v, insight) {
    const none = !DATA.keywords.length && !DATA.hashtags.length;
    $("trendsNotice").hidden = !none; $("trendsBody").hidden = none;
    if (none) return;
    const kws = [...v.keywords].sort((a, b) => b.change_vs_prev - a.change_vs_prev).slice(0, 8);
    $("keywordList").innerHTML = kws.length ? kws.map((k, i) => `
      <div class="rank"><span class="rank__n">${i + 1}</span>
        <div><div class="rank__name">${esc(k.keyword)}${PulseInsights.quadrant(k) === "Opportunity" ? ' <span class="chip chip--opp" data-tip="Growing fast, and Vichy is barely part of the conversation.">Opportunity</span>' : ""}</div><div class="rank__meta">${esc(k.market)} · ${esc(k.language)} · ${esc(k.category)} · Score ${k.trends_score}${k.vichy_share_pct !== "" && k.vichy_share_pct != null ? ` · Vichy share ${k.vichy_share_pct}%` : ""}</div></div>
        <span class="rank__val ${k.change_vs_prev >= 0 ? "delta--up" : "delta--down"}">${k.change_vs_prev >= 0 ? "▲" : "▼"} ${Math.abs(k.change_vs_prev)}%</span></div>`).join("")
      : `<div class="empty">No keywords for this market yet.</div>`;
    $("kwSowhat").innerHTML = insight.sowhat.kw || "";

    $("hashtagList").innerHTML = v.hashtags.length ? v.hashtags.map(h => `
      <div class="rank"><div><div class="rank__name">${esc(h.hashtag)} <span class="chip chip--${esc(h.relevance_to_vichy)}">${esc(h.relevance_to_vichy)} relevance</span></div>
        <div class="rank__meta">${esc(h.platform)} · ${esc(h.market)} · ${esc(h.growth_note)}</div></div>
        <span class="rank__val">${esc(h.views_or_posts)}</span></div>`).join("")
      : `<div class="empty">No hashtags for this market yet.</div>`;
  }

  /* ---------- render: listening ---------- */
  function renderListening(v, insight) {
    const ms = v.listening;
    const none = !DATA.listening.length;
    $("listeningNotice").hidden = !none; $("listeningBody").hidden = none; $("sentimentTabs").hidden = none;
    if (none) return;
    $("sentimentTabs").innerHTML = ["All", "Positive", "Neutral", "Negative"].map(s => `<button role="tab" data-sentiment="${s}" aria-selected="${s === state.sentiment}">${s}</button>`).join("");

    const plats = [...new Set(ms.map(m => m.platform))];
    const sc = { Positive: "var(--pos)", Neutral: "var(--neu)", Negative: "var(--neg)" };
    $("sentimentChart").innerHTML = plats.length ? plats.map(p => {
      const rows = ms.filter(m => m.platform === p);
      return `<div class="sent-row"><span>${esc(p)} <span class="muted">(${rows.length})</span></span><div class="sent-bar">${
        ["Positive", "Neutral", "Negative"].map(s => `<span style="width:${(rows.filter(m => m.sentiment === s).length / rows.length) * 100}%;background:${sc[s]}" title="${s}"></span>`).join("")}</div></div>`;
    }).join("") + `<div class="sent-legend"><span><i style="background:var(--pos)"></i>Positive</span><span><i style="background:var(--neu)"></i>Neutral</span><span><i style="background:var(--neg)"></i>Negative</span></div>`
      : `<div class="empty">No mentions for this market yet.</div>`;

    $("themeList").innerHTML = PulseInsights.bestCount(ms, "topic").slice(0, 5).map((t, i) => `
      <div class="rank"><span class="rank__n">${i + 1}</span><div class="rank__name">${esc(t.name)}</div><span class="rank__val">${t.n} mention${t.n > 1 ? "s" : ""}</span></div>`).join("");
    $("listenSowhat").innerHTML = insight.sowhat.listen || "";

    const feed = ms.filter(m => state.sentiment === "All" || m.sentiment === state.sentiment).sort((a, b) => String(b.date).localeCompare(a.date));
    $("mentionFeed").innerHTML = feed.length ? feed.map(m => `
      <div class="mention mention--${esc(m.sentiment)}">
        <div class="mention__meta"><span class="s-${esc(m.sentiment)}">${esc(m.sentiment)}</span><span>${esc(m.platform)}</span><span>${esc(m.market)}</span><span>${esc(m.product)}</span><span>${esc(m.topic)}</span><span>${dateFmt(m.date)}</span></div>
        <p>${esc(m.summary)}</p>
        ${isUrl(m.link) ? `<a class="link-arrow small" style="margin-top:10px" href="${esc(m.link)}" target="_blank" rel="noopener">Source</a>` : ""}
      </div>`).join("") : `<div class="empty">No ${state.sentiment.toLowerCase()} mentions here yet.</div>`;
  }

  /* ---------- render: what's working ---------- */
  function workingScope(v) {
    const counts = {};
    v.posts.forEach(p => { counts[p.platform] = (counts[p.platform] || 0) + 1; });
    const plat = state.platform !== "All" && counts[state.platform] ? state.platform
      : Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
    return { plat, posts: v.posts.filter(p => p.platform === plat) };
  }
  function renderWorking(v) {
    const scope = workingScope(v);
    $("workingScope").textContent = scope.plat ? `Based on ${scope.posts.length} ${scope.plat} posts. Pick a platform in Competitor posts to switch.` : "";
    renderHeatmap(scope.posts);
    v = { ...v, posts: scope.posts };
    const comp = v.posts.filter(p => p.brand !== FOCUS && p.engagement_rate != null);
    if (!comp.length) { $("whatsWorking").innerHTML = ""; return; }
    const byFormat = PulseInsights.bestBy(comp, "format", "engagement_rate");
    const byCreator = PulseInsights.bestBy(comp.map(p => ({ ...p, _creator: creatorType(p) })), "_creator", "engagement_rate");
    const simpleBars = rows => { const max = Math.max(...rows.map(r => r.value)) || 1; return rows.map((r, i) => `
      <div class="bar ${i === 0 ? "bar--hl" : ""}"><span class="bar__name">${esc(r.name)} <span class="muted">(${r.n})</span></span>
      <span class="bar__track"><span class="bar__fill" style="width:${(r.value / max) * 100}%;background:${i === 0 ? "var(--accent)" : "#c9c9c9"}"></span></span>
      <span class="bar__val">${pct(r.value, 2)}</span></div>`).join("") + `<p class="muted small">Typical (middle) value per post.</p>`; };
    $("formatChart").innerHTML = simpleBars(byFormat);
    $("creatorChart").innerHTML = simpleBars(byCreator);
    const fmtBest = byFormat[0];
    const byBrand = {}; v.posts.filter(p => p.brand !== FOCUS).forEach(p => { byBrand[p.brand] = (byBrand[p.brand] || 0) + 1; });
    const active = Object.entries(byBrand).sort((a, b) => b[1] - a[1])[0] || ["—", 0];
    renderThemes(scope.posts);
    // Winning angle = who's on camera with the best typical engagement, only with at least 3 posts
    const angleBest = byCreator.find(a => a.n >= 3);
    const angleName = { Brand: "Brand-made content", Creator: "Creators and real customers", Dermatologist: "Dermatologist on camera" };
    const few = n => n < 5 ? " · small sample" : "";
    $("whatsWorking").innerHTML = `
      <div><h4>Best format</h4><p>${esc(fmtBest.name)}<small>${pct(fmtBest.value, 2)} typical engagement · ${fmtBest.n} post${fmtBest.n > 1 ? "s" : ""}${few(fmtBest.n)}</small></p></div>
      <div><h4>Most active competitor${scope.plat ? ` on ${esc(scope.plat)}` : ""}</h4><p>${esc(active[0])}<small>${active[1]} post${active[1] > 1 ? "s" : ""} in this period</small></p></div>
      <div><h4>Winning angle</h4><p>${angleBest ? esc(angleName[angleBest.name] || angleBest.name) : "Not enough posts yet"}<small>${angleBest ? `${pct(angleBest.value, 2)} typical engagement · ${angleBest.n} posts${few(angleBest.n)}` : "Needs at least 3 posts of one kind"}</small></p></div>`;
  }

  /* ---------- themes: what brands talk about, and what gets likes ---------- */
  function renderThemes(list) {
    const el = $("themeTable"); if (!el) return;
    if (!window.PulseTrends) { el.innerHTML = ""; return; }
    const median = v => { const s = [...v].sort((a, b) => a - b), m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
    const rows = PulseTrends.THEMES.filter(t => t.name !== "Product launches").map(t => {
      const ps = list.filter(p => PulseTrends.themesOf(`${p.topic} ${p.summary} ${p.product}`).includes(t));
      const liked = ps.filter(p => p.likes !== "" && p.likes != null).map(p => Number(p.likes));
      const brands = {}; ps.forEach(p => { brands[p.brand] = (brands[p.brand] || 0) + 1; });
      return { t, n: ps.length, med: liked.length ? median(liked) : 0, top: Object.entries(brands).sort((a, b) => b[1] - a[1]).slice(0, 2), mine: ps.filter(p => p.brand === FOCUS).length };
    }).filter(r => r.n >= 2).sort((a, b) => b.med - a.med);
    el.innerHTML = rows.length ? `<table class="atable"><thead><tr><th>Theme</th><th>Posts</th><th>Typical likes</th><th>Who posts it most</th><th>Vichy posts</th></tr></thead><tbody>${
      rows.map(r => `<tr><td>${esc(r.t.name)}</td><td>${r.n}</td><td>${fmt(r.med)}</td><td>${r.top.map(([b, k]) => `${esc(b)} (${k})`).join(", ")}</td><td>${r.mine}</td></tr>`).join("")}</tbody></table>`
      : `<div class="empty">Not enough posts in this period to compare themes. Try a longer period.</div>`;
    const best = rows[0], gap = rows.find(r => r.mine === 0 && r.n >= 3);
    $("themeSowhat").innerHTML = best ? `<strong>${esc(best.t.name)}</strong> gets the most likes per post (${fmt(best.med)} typical).${gap ? ` Vichy has no posts on <strong>${esc(gap.t.name.toLowerCase())}</strong>, which competitors used ${gap.n} times. ${esc(gap.t.action)}` : ""}` : "";
  }

  /* ---------- when brands post (day x time heatmap) ---------- */
  function renderHeatmap(list) {
    const el = $("timeHeatmap"); if (!el) return;
    const timed = list.filter(p => p.date && p.time);
    if (!timed.length) { el.innerHTML = `<div class="empty">No posting times for this period yet.</div>`; $("timeSowhat").innerHTML = ""; return; }
    const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const SLOTS = [["Morning", 6, 12], ["Afternoon", 12, 18], ["Evening", 18, 24], ["Night", 0, 6]];
    const cell = {};
    timed.forEach(p => {
      const d = (new Date(p.date + "T12:00:00").getDay() + 6) % 7;
      const h = Number(String(p.time).split(":")[0]);
      const s = SLOTS.findIndex(([, a, b]) => h >= a && h < b);
      const k = `${d}-${s}`; (cell[k] = cell[k] || []).push(p);
    });
    const max = Math.max(...Object.values(cell).map(a => a.length));
    el.innerHTML = `<div class="hm">
      <span></span>${DAYS.map(d => `<span class="hm__day">${d}</span>`).join("")}
      ${SLOTS.map(([name, a, b], si) => `<span class="hm__slot">${name}<small>${String(a).padStart(2, "0")}–${String(b).padStart(2, "0")}h</small></span>` + DAYS.map((d, di) => {
        const ps = cell[`${di}-${si}`] || [];
        if (!ps.length) return `<span class="hm__cell"></span>`;
        const withEr = ps.filter(p => p.engagement_rate != null);
        const er = withEr.length ? withEr.reduce((s2, p) => s2 + p.engagement_rate, 0) / withEr.length : null;
        const alpha = 0.15 + (ps.length / max) * 0.85;
        const tip = `${d} ${name.toLowerCase()}: ${ps.length} post${ps.length > 1 ? "s" : ""}, ${pct(er, 2)} avg engagement\n` + [...new Set(ps.map(p => p.brand))].join(", ");
        return `<span class="hm__cell is-on" data-tip="${esc(tip)}" style="background:rgba(14,90,167,${alpha.toFixed(2)});color:${alpha > 0.55 ? "#fff" : "var(--ink)"}"><b>${ps.length}</b><small>${pct(er, er != null && er < 1 ? 2 : 1)}</small></span>`;
      }).join("")).join("")}
    </div>`;
    const entries = Object.entries(cell).map(([k, ps]) => { const [di, si] = k.split("-").map(Number); const w = ps.filter(p => p.engagement_rate != null); return { label: `${DAYS[di]} ${SLOTS[si][0].toLowerCase()}`, n: ps.length, m: w.length, er: w.length ? w.reduce((a, p) => a + p.engagement_rate, 0) / w.length : 0 }; });
    const busiest = [...entries].sort((a, b) => b.n - a.n)[0];
    const best = entries.filter(e => e.m >= 3).sort((a, b) => b.er - a.er)[0];
    $("timeSowhat").innerHTML = `Most posts go out on <strong>${busiest.label}</strong> (${busiest.n}).` + (best ? ` The best engagement comes on <strong>${best.label}</strong> (${pct(best.er, 2)} on average across ${best.m} posts).` : "");
  }

  /* ---------- render: news ---------- */
  function renderNews(v) {
    const none = !DATA.news.length;
    $("newsNotice").hidden = !none; $("newsBody").hidden = none;
    if (none) { $("newsSowhat").innerHTML = ""; $("newsSource").textContent = ""; return; }
    const items = v.news;
    const counts = {}; items.forEach(n => { counts[n.brand] = (counts[n.brand] || 0) + 1; });
    const total = items.length;
    const rows = Object.entries(counts).map(([brand, c]) => ({ brand, v: (c / total) * 100, c })).sort((a, b) => b.v - a.v);
    $("pressChart").innerHTML = rows.length ? bars(rows, x => pct(x, 0)) : `<div class="empty">No articles in this period.</div>`;
    const leader = rows[0], mine = rows.find(r => r.brand === FOCUS);
    $("newsSowhat").innerHTML = leader ? `<strong>${esc(leader.brand)}</strong> got the most press coverage: ${leader.c} of ${total} articles (${pct(leader.v, 0)}). ${mine ? `Vichy had ${mine.c} (${pct(mine.v, 0)}).` : "We found no Vichy articles in our news sources for this period."}` : "";
    const brands = ["All", ...rows.map(r => r.brand)];
    if (!brands.includes(state.newsBrand)) state.newsBrand = "All";
    $("newsChips").innerHTML = brands.map(b => `<button data-newsbrand="${esc(b)}" aria-pressed="${b === state.newsBrand}">${b === "All" ? "All brands" : esc(b)}</button>`).join("");
    const list = items.filter(n => state.newsBrand === "All" || n.brand === state.newsBrand)
      .sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`)).slice(0, 25);
    $("newsList").innerHTML = list.length ? list.map(n => `
      <a class="news__item" href="${esc(n.link)}" target="_blank" rel="noopener">
        <span class="news__meta"><i class="dot" style="background:${color(n.brand)}"></i>${esc(n.brand)} · ${esc(n.source || "News")} · ${dateFmt(n.date)}${n.time ? ` ${esc(n.time)}` : ""}${n.language === "fr" ? " · FR" : ""}</span>
        <span class="news__title">${esc(n.title)}</span>
      </a>`).join("") : `<div class="empty">No articles for this brand in this period.</div>`;
    $("newsSource").textContent = `Source: Google News, Bing News and beauty trade press (Cosmetics Business, CosmeticsDesign-Europe, WWD, Premium Beauty News), in English and French. Headlines link to the original article. Collected automatically about every hour. An article counts for a brand when it names the brand.`;
  }

  /* ---------- render: data status ---------- */
  const SOURCE_ORDER = ["youtube", "news", "interest", "instagram", "tiktok"];
  function renderStatus() {
    const el = $("statusTable"); if (!el) return;
    const lateAfter = st => (/hour/.test(st.schedule) ? 6 : /Twice/.test(st.schedule) ? 30 : 50) * 3600000;  // "Once a day" → late after 50 h
    const ENGINE = { cloud: "Automatic · runs on GitHub, no computer needed", manual: "Updated by hand", embed: "Shown live by TikTok on this page" };
    const rows = SOURCE_ORDER.map(k => DATA.status[k]).filter(Boolean).map(st => {
      const age = st.last_run ? Date.now() - new Date(st.last_run).getTime() : null;
      const state = st.engine === "embed" ? ["ok", "Live"] : st.engine === "manual" ? (st.last_run ? ["off", "Manual"] : ["off", "Not collected"])
        : st.ok === false ? ["bad", "Failed"] : !st.last_run ? ["off", "Not started"] : age > lateAfter(st) ? ["late", "Late"] : ["ok", "Working"];
      return `<tr>
        <td><strong>${esc(st.source)}</strong><small>${ENGINE[st.engine] || "Updated by hand"}</small></td>
        <td>${esc(st.schedule)}</td>
        <td>${st.engine === "embed" ? "Always current" : st.last_run ? `${relTime(st.last_run)}<small>${new Date(st.last_run).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</small>` : "—"}</td>
        <td><span class="status status--${state[0]}">${state[1]}</span><small>${esc(st.message || "")}</small></td>
        <td>${st.items ? Number(st.items).toLocaleString("en-GB") : "—"}</td>
      </tr>`;
    }).join("");
    el.innerHTML = rows ? `<table class="atable stable"><thead><tr><th>Source</th><th>How often</th><th>Last update</th><th>Status</th><th>Items</th></tr></thead><tbody>${rows}</tbody></table>` : `<div class="empty">No status yet.</div>`;
  }

  /* ---------- render: calendar ---------- */
  function renderCalendar() {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const items = DATA.calendar.filter(matchMarket).sort((a, b) => String(a.date).localeCompare(b.date)).slice(0, 10);
    $("timeline").innerHTML = items.length ? items.map(c => {
      const d = new Date(c.date + "T00:00:00");
      const days = Math.round((d - today) / 864e5);
      const soon = days >= 0 && days <= 14 ? `<span class="tl__soon">${days === 0 ? "Today" : `In ${days} day${days > 1 ? "s" : ""}`}</span>` : "";
      return `<div class="tl"><div class="tl__date">${isNaN(d) ? "" : d.getDate()}</div>
        <div class="tl__month">${isNaN(d) ? esc(c.date) : d.toLocaleDateString("en-GB", { month: "long", year: "numeric" })} · ${esc(c.market)}</div>
        <h3>${esc(c.moment)}</h3><p>${esc(c.opportunity)}</p>${soon}</div>`;
    }).join("") : `<div class="empty">Nothing planned for this market yet.</div>`;
  }

  /* ---------- drawer ---------- */
  function openDrawer(idx) {
    const p = DATA.competitor_posts[idx];
    if (!p) return;
    const brandPosts = DATA.competitor_posts.filter(x => x.brand === p.brand);
    const brandAvg = brandPosts.reduce((s, x) => s + x.engagement_rate, 0) / brandPosts.length;
    const allAvg = DATA.competitor_posts.reduce((s, x) => s + x.engagement_rate, 0) / DATA.competitor_posts.length;
    const vsAll = ((p.engagement_rate / allAvg) - 1) * 100;
    $("drawerEyebrow").textContent = `${p.brand} · ${p.platform}`;
    const e = embedInfo(p.link);
    $("drawerBody").innerHTML = `
      ${e ? `${embedFrame(e, `${p.brand} — ${p.topic}`)}<h3 style="margin:18px 0 10px">${esc(p.topic)}</h3>` : `
      <div class="drawer__tile" style="background:${color(p.brand)}">
        <span class="card__top" style="margin-bottom:auto"><span>${esc(p.platform)}</span><span>${esc(p.format)}</span></span>
        <h3>${esc(p.topic)}</h3>
      </div>`}
      <p class="eyebrow">${dateFmt(p.date, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}${p.time ? ` · ${esc(p.time)} (Paris)` : ""} · ${esc(p.product)}</p>
      <p>${esc(p.summary)}</p>
      <table>
        <tr><td>Engagement rate</td><td><strong>${pct(p.engagement_rate, 2)}</strong></td></tr>
        <tr><td>Likes</td><td>${Number(p.likes).toLocaleString("en-GB")}</td></tr>
        <tr><td>Comments</td><td>${p.comments !== "" && p.comments != null ? Number(p.comments).toLocaleString("en-GB") : "Not collected"}</td></tr>
        <tr><td>Views</td><td>${p.views ? Number(p.views).toLocaleString("en-GB") : "Not public"}</td></tr>
        <tr><td>Account followers</td><td>${Number(p.followers).toLocaleString("en-GB")}</td></tr>
      </table>
      <div class="why"><strong>How it compares:</strong> ${Math.abs(vsAll).toFixed(0)}% ${vsAll >= 0 ? "above" : "below"} the average tracked post, and ${p.engagement_rate >= brandAvg ? "above" : "below"} ${esc(p.brand)}'s own average (${pct(brandAvg, 2)}).</div>
      <div class="drawer__actions">
        ${isUrl(p.link) ? `<a class="btn" href="${esc(p.link)}" target="_blank" rel="noopener">View original post</a>` : `<span class="btn" aria-disabled="true">Link coming soon</span>`}
        <button class="btn btn--ghost" data-askabout="${idx}">Ask about this post</button>
        <button class="btn btn--ghost" data-note="drawerBody">Add a team note</button>
      </div>`;
    $("drawer").classList.add("is-open"); $("drawer").setAttribute("aria-hidden", "false");
    $("drawerBackdrop").hidden = false;
    $("drawerClose").focus();
  }
  function closeDrawer() {
    $("drawer").classList.remove("is-open"); $("drawer").setAttribute("aria-hidden", "true");
    setTimeout(() => { if (!$("drawer").classList.contains("is-open")) $("drawerBody").innerHTML = ""; }, 400); // stops video playback
    $("drawerBackdrop").hidden = true;
  }

  /* ---------- search ---------- */
  function openSearch(q = "") {
    $("search").hidden = false;
    $("searchPopular").innerHTML = `Popular: ` + CFG.popularSearches.map(s => `<button data-pop="${esc(s)}">${esc(s)}</button>`).join("");
    $("searchInput").value = q; runSearch(q);
    setTimeout(() => $("searchInput").focus(), 30);
  }
  function runSearch(q) {
    q = q.trim().toLowerCase();
    if (!q) { $("searchResults").innerHTML = ""; return; }
    const hit = o => Object.values(o).some(v => String(v).toLowerCase().includes(q));
    const res = [
      ...DATA.competitor_posts.filter(hit).map(p => ({ type: "Post", title: `${p.brand}: ${p.topic}`, meta: `${p.platform} · ${pct(p.engagement_rate, 2)} engagement`, post: DATA.competitor_posts.indexOf(p) })),
      ...DATA.listening.filter(hit).map(m => ({ type: "Mention", title: m.summary, meta: `${m.sentiment} · ${m.platform} · ${m.product}`, href: "#listening" })),
      ...DATA.keywords.filter(hit).map(k => ({ type: "Keyword", title: k.keyword, meta: `${k.market} · ${k.change_vs_prev > 0 ? "+" : ""}${k.change_vs_prev}%`, href: "#trends" })),
      ...DATA.products.filter(hit).map(p => ({ type: "Product", title: p.product, meta: `${p.mentions} mentions · ${p.positive_pct}% positive`, href: "#products" }))
    ];
    $("searchResults").innerHTML = res.length ? res.map(r => `
      <div class="rank" ${r.post != null ? `data-post-open="${r.post}"` : `data-href="${r.href}"`}><span class="rank__meta">${r.type}</span>
        <div><div class="rank__name">${esc(r.title)}</div><div class="rank__meta">${esc(r.meta)}</div></div><span>→</span></div>`).join("")
      : `<p class="muted">No results for "${esc(q)}".</p>`;
  }
  function closeSearch() { $("search").hidden = true; }

  /* ---------- render: TikTok live feeds ---------- */
  const TT = { "Vichy": "vichylaboratoires", "La Roche-Posay": "larocheposay", "CeraVe": "cerave", "Avène": "avene",
               "Bioderma": "biodermafrance", "Eucerin": "eucerin", "Klorane": "klorane", "The Ordinary": "theordinary" };
  let ttBrand = null;
  function renderTikTok(brand) {
    const chips = $("ttChips"), box = $("ttEmbed"); if (!chips || !box) return;
    if (!brand && ttBrand) return;            // already showing; don't reload on every data refresh
    ttBrand = brand || FOCUS;
    chips.innerHTML = Object.keys(TT).map(b => `<button type="button" data-tt="${esc(b)}" aria-pressed="${b === ttBrand}">${esc(b)}</button>`).join("");
    const h = TT[ttBrand];
    box.innerHTML = `<blockquote class="tiktok-embed" cite="https://www.tiktok.com/@${h}" data-unique-id="${h}" data-embed-type="creator" style="max-width:780px;min-width:288px;margin:0">
      <section><a target="_blank" rel="noopener" href="https://www.tiktok.com/@${h}?refer=creator_embed">@${h} on TikTok</a></section></blockquote>`;
    const old = document.getElementById("tt-embed-js"); if (old) old.remove();
    const sc = document.createElement("script"); sc.id = "tt-embed-js"; sc.async = true; sc.src = "https://www.tiktok.com/embed.js";
    document.body.appendChild(sc);
  }
  document.addEventListener("click", e => { const b = e.target.closest("[data-tt]"); if (b) renderTikTok(b.dataset.tt); });

  /* ---------- render all ---------- */
  function render() {
    const v = view();
    const insight = PulseInsights.generate(DATA, v);
    renderFilters(); renderPosts(v); renderBrief(insight); renderHealth(insight);
    renderWorking(v); renderCalendar(); renderNews(v); renderStatus();
    $("postsFresh").textContent = fresh(["instagram", "youtube"]) ? `Updated: ${fresh(["instagram", "youtube"])}` : "";
    $("healthFresh").textContent = fresh(["instagram"]) ? `Followers updated: ${fresh(["instagram"])}` : "";
    $("newsFresh").textContent = fresh(["news"]) ? `Updated ${relTime(DATA.status.news.last_run)}` : "";
    const ps = $("postsSowhat"); ps.innerHTML = insight.sowhat.posts || "";
    const pd = DATA.competitor_posts.map(p => p.date).filter(Boolean).sort();
    const igRows = DATA.competitor_posts.filter(p => p.platform === "Instagram");
    const igStatus = DATA.status.instagram;
    $("postsSource").textContent = pd.length ? `Source: public brand posts on ${DATA._meta.platforms.join(", ")}, ${longDate(pd[0])} – ${longDate(pd[pd.length - 1])}.${igRows.length && igStatus && igStatus.engine !== "cloud" ? ` Instagram: the latest ${igRows.length} public posts across the ${new Set(igRows.map(p => p.brand)).size} brands (about 12 per brand), with likes as shown on ${dateFmt(String(igStatus.last_run).slice(0, 10))}; they update once Instagram is connected.` : ""} YouTube refreshes every hour. Times in Paris time.` : "";
    $("briefSource").textContent = `Worked out automatically from the live data each time the page loads (last data update ${relTime(DATA._meta.lastRun)}). Fixed rules, no AI: every number comes from the sources named on each trend.`;
    renderTikTok();
  }

  /* ---------- events ---------- */
  function bind() {
    const setMarket = m => { state.market = m; render(); };
    const setCategory = c => { state.category = c; render(); };
    $("categorySelect").addEventListener("change", e => setCategory(e.target.value));

    document.addEventListener("change", e => {
      if (e.target.id === "mCategory") { $("categorySelect").value = e.target.value; setCategory(e.target.value); }
    });

    document.addEventListener("click", e => {
      const t = e.target.closest("[data-newsbrand],[data-period],[data-creator],[data-askabout],[data-note],[data-view],[data-platform],[data-sentiment],[data-market],[data-quick],[data-post],[data-searchbtn],[data-pop],[data-post-open],[data-href]");
      if (!t) return;
      if (t.dataset.newsbrand) { state.newsBrand = t.dataset.newsbrand; renderNews(view()); return; }
      if (t.dataset.period) { state.period = t.dataset.period; state.showAll = false; render(); return; }
      if (t.dataset.creator) { state.creator = t.dataset.creator; renderPosts(view()); return; }
      if (t.dataset.askabout != null) { const p = DATA.competitor_posts[+t.dataset.askabout]; closeDrawer(); window.PulseAsk && window.PulseAsk.ask(`Why did this ${p.brand} ${p.platform} post ("${p.topic}") perform the way it did, and what can Vichy learn from it?`); return; }
      if (t.dataset.note) { window.PulseAsk && window.PulseAsk.note($(t.dataset.note)); return; }
      if (t.dataset.view) { state.view = t.dataset.view; try { localStorage.setItem("bp_view", state.view); } catch (err) {} renderPosts(view()); }
      else if (t.dataset.platform) { state.platform = t.dataset.platform; renderPosts(view()); renderWorking(view()); }
      else if (t.dataset.sentiment) { state.sentiment = t.dataset.sentiment; renderListening(view(), PulseInsights.generate(DATA, view())); }
      else if (t.dataset.quick != null) { e.stopPropagation(); openDrawer(+t.dataset.quick); }
      else if (t.dataset.post != null) openDrawer(+t.dataset.post);
      else if (t.dataset.searchbtn) { e.preventDefault(); openSearch(t.dataset.searchbtn); }
      else if (t.dataset.pop) { $("searchInput").value = t.dataset.pop; runSearch(t.dataset.pop); }
      else if (t.dataset.postOpen != null) { closeSearch(); openDrawer(+t.dataset.postOpen); }
      else if (t.dataset.href) { closeSearch(); location.hash = t.dataset.href.slice(1); }
    });

    document.addEventListener("keydown", e => {
      if (e.key === "Escape") { closeDrawer(); closeSearch(); }
      if (e.key === "Enter" && e.target.classList?.contains("card") && e.target.dataset.post != null) openDrawer(+e.target.dataset.post);
    });

    document.addEventListener("pulse:search", e => openSearch(e.detail || ""));
    const setCustom = () => {
      let f = $("dateFrom").value, t2 = $("dateTo").value;
      if (f && t2 && f > t2) [f, t2] = [t2, f];
      state.period = "custom"; state.from = f; state.to = t2; state.showAll = false; render();
    };
    $("dateFrom").addEventListener("change", setCustom);
    $("dateTo").addEventListener("change", setCustom);
    const setHH = () => document.documentElement.style.setProperty("--hh", document.querySelector(".header").offsetHeight + "px");
    setHH(); window.addEventListener("resize", setHH);
    $("sortSelect").addEventListener("change", e => { state.sort = e.target.value; renderPosts(view()); });
    $("showAllBtn").addEventListener("click", () => { state.showAll = !state.showAll; renderPosts(view()); if (!state.showAll) $("posts").scrollIntoView(); });
    // Live site shows real posts by default; the Claude preview (which blocks outside content) shows tiles.
    document.addEventListener("pulse:env", e => { if (!state.view) { state.view = e.detail.claude ? "tiles" : "creatives"; renderPosts(view()); } });
    $("drawerClose").addEventListener("click", closeDrawer);
    $("drawerBackdrop").addEventListener("click", closeDrawer);
    $("searchBtn").addEventListener("click", () => openSearch());
    $("searchClose").addEventListener("click", closeSearch);
    $("searchInput").addEventListener("input", e => runSearch(e.target.value));
    $("menuBtn").addEventListener("click", () => { $("mobileMenu").hidden = !$("mobileMenu").hidden; });
    $("mobileMenu").addEventListener("click", e => { if (e.target.tagName === "A") $("mobileMenu").hidden = true; });

    // Tooltips
    const tip = $("tooltip");
    document.addEventListener("mouseover", e => {
      const i = e.target.closest("[data-tip]");
      if (!i) return;
      tip.textContent = i.dataset.tip; tip.hidden = false;
      const r = i.getBoundingClientRect();
      tip.style.left = Math.min(window.innerWidth - 280, r.left) + "px";
      tip.style.top = r.bottom + 8 + "px";
    });
    document.addEventListener("mouseout", e => { if (e.target.closest("[data-tip]")) tip.hidden = true; });
    document.addEventListener("click", e => {
      const i = e.target.closest("[data-tip]");
      if (i) { e.preventDefault(); tip.textContent = i.dataset.tip; tip.hidden = !tip.hidden; const r = i.getBoundingClientRect(); tip.style.left = Math.min(window.innerWidth - 280, r.left) + "px"; tip.style.top = r.bottom + 8 + "px"; }
    });
  }

  /* ---------- init ---------- */
  window.PulseApp = { data: () => DATA, view: () => view(), state, creatorType, openDrawer };
  // Check for new data every 10 minutes (and when the tab comes back into view).
  async function refreshData() {
    try {
      const d = await window.loadPulseData();
      const changed = JSON.stringify(d.status) !== JSON.stringify(DATA.status) || d.competitor_posts.length !== DATA.competitor_posts.length || d.news.length !== DATA.news.length;
      DATA = d;
      renderChrome(); render();
      if (changed) console.info("[Ignite] New data loaded");
    } catch (e) { /* keep showing what we have */ }
  }
  setInterval(refreshData, 10 * 60 * 1000);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") refreshData(); });

  window.loadPulseData().then(d => {
    DATA = d;
    renderChrome();
    bind();
    render();
  }).catch(err => {
    console.error(err);
    $("heroTitle").textContent = "We couldn't load this week's data. Please refresh the page.";
  });
})();
