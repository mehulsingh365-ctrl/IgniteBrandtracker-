/* =====================================================================
   IGNITE — Ask, campaign starters and team notes.
   Uses Claude through the page's "sample" capability when the site is
   opened from its shared Claude link. Elsewhere (e.g. Vercel) the Ask box
   falls back to search, and the Ideas button explains why.
   ===================================================================== */

(function () {
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const SUGGESTIONS = [
    "What worked best for competitors this week?",
    "How is Vichy doing vs La Roche-Posay?",
    "What are people complaining about?",
    "Which trend should we jump on first?",
    "What should Vichy post on TikTok next week?"
  ];

  let sampleFn = null;          // resolved claude "sample" function, or null
  let history = [];             // [{role, content}]
  let busy = false;
  let controller = null;

  /* ---------- tiny, safe markdown ---------- */
  function md(text) {
    const lines = esc(text).split(/\n/);
    let html = "", inList = false;
    const inline = t => t
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    for (const raw of lines) {
      const l = raw.trim();
      if (/^[-•*]\s+/.test(l)) {
        if (!inList) { html += "<ul>"; inList = true; }
        html += `<li>${inline(l.replace(/^[-•*]\s+/, ""))}</li>`;
        continue;
      }
      if (inList) { html += "</ul>"; inList = false; }
      if (!l) continue;
      if (/^#{1,4}\s/.test(l)) html += `<h4>${inline(l.replace(/^#{1,4}\s/, ""))}</h4>`;
      else html += `<p>${inline(l)}</p>`;
    }
    if (inList) html += "</ul>";
    return html;
  }

  /* ---------- data context for Claude ---------- */
  function context() {
    const D = window.PulseApp.data();
    const meta = D._meta;
    const pick = (rows, keys) => rows.map(r => Object.fromEntries(keys.map(k => [k, r[k]])));
    const posts = D.competitor_posts.map(p => ({
      date: p.date, time_paris: p.time, brand: p.brand, platform: p.platform, format: p.format, on_camera: window.PulseApp.creatorType(p),
      topic: p.topic, product: p.product, likes: p.likes, comments: p.comments, views: p.views,
      engagement_rate_pct: p.engagement_rate == null ? "n/a" : Number(p.engagement_rate).toFixed(2), engagement_basis: p.views ? "per view" : "per follower",
      summary: p.summary, link: p.link
    }));
    return JSON.stringify({
      note: `All data is real and public, collected up to ${meta.lastUpdated}. Sections with no data are simply not tracked yet.`,
      competitor_posts: posts,
      accounts_followers: D.accounts,
      news_articles: (D.news || []).slice(0, 60),
      data_status: D.status,
      analyst_insights: pick(D.insights, ["date", "title", "detail"]),
      calendar: D.calendar,
      keywords: D.keywords, hashtags: D.hashtags,
      listening: pick(D.listening, ["date", "platform", "product", "topic", "sentiment", "summary"])
    });
  }

  const SYSTEM = `You are Ignite, the competitor tracker used by the marketing team of the skincare and haircare brand Vichy (France & Europe). You answer like a senior brand and social media strategist talking to colleagues. Competitors tracked: La Roche-Posay, Avène, Bioderma, CeraVe, Eucerin, Klorane.
Rules:
- Answer ONLY from the data below. Never invent numbers, posts or facts. If the data can't answer, say so and suggest what data to add.
- Write for busy marketers: plain words, short sentences, confident and warm. Start with a one-sentence answer, then 2–5 short bullets. Keep it under 180 words unless asked for more.
- Sound human. No buzzwords or filler ("unlock", "leverage", "elevate", "delve", "game-changer", "in today's landscape"), no emojis, no em dashes, and never describe yourself as an AI.
- When you mention a post, name the brand and topic and add its link as [View post](url) if a link exists.
- Engagement on Instagram is likes per follower; on TikTok and YouTube it is per view. Never rank them against each other.
- End with one short line starting "Next question to ask:" suggesting a useful follow-up.`;

  /* ---------- panel ---------- */
  function openPanel() {
    $("askPanel").classList.add("is-open"); $("askPanel").setAttribute("aria-hidden", "false");
    $("askBackdrop").hidden = false;
    setTimeout(() => $("askInput2").focus(), 50);
  }
  function closePanel() {
    if (controller) controller.abort();
    $("askPanel").classList.remove("is-open"); $("askPanel").setAttribute("aria-hidden", "true");
    $("askBackdrop").hidden = true;
  }

  function bubble(role, html) {
    const el = document.createElement("div");
    el.className = `msg msg--${role}`;
    el.innerHTML = html;
    $("askThread").appendChild(el);
    $("askThread").scrollTop = $("askThread").scrollHeight;
    return el;
  }

  async function ask(question) {
    question = String(question || "").trim();
    if (!question || busy) return;
    if (!sampleFn) {   // no Claude here → fall back to search
      document.dispatchEvent(new CustomEvent("pulse:search", { detail: question }));
      return;
    }
    openPanel();
    if (!$("askThread").children.length) {
      bubble("intro", `<p>Ask about competitors, posts, trends or what people say about Vichy. Answers use this week's data only.</p>`);
    }
    bubble("user", `<p>${esc(question)}</p>`);
    const out = bubble("bot", `<p class="muted">Looking through this week's data…</p>`);
    history.push({ role: "user", content: history.length ? question : `${SYSTEM}\n\nDATA (JSON):\n${context()}\n\nQUESTION: ${question}` });
    busy = true; controller = new AbortController();
    try {
      const res = await sampleFn(history, {
        signal: controller.signal, cache: false, modelTier: "default",
        onText: ({ text }) => { out.innerHTML = md(text.replace(/^.*Next question to ask:.*$/im, "")); $("askThread").scrollTop = $("askThread").scrollHeight; }
      });
      out.innerHTML = md(res.text.replace(/^.*Next question to ask:.*$/im, "").trim());
      history.push({ role: "assistant", content: res.text });
      const next = (res.text.match(/Next question to ask:\s*(.+)$/im) || [])[1];
      if (next) {
        const b = document.createElement("button");
        b.className = "chip-btn chip-btn--next"; b.textContent = next.replace(/[*_]/g, "").trim();
        b.addEventListener("click", () => ask(b.textContent));
        out.appendChild(b);
      }
    } catch (err) {
      history.pop();
      const msg = err && err.code === "rate_limited" ? "Lots of questions in a short time. Give it a minute and try again."
        : err && err.code === "not_granted" ? "Ask isn't switched on for you here. You can still use search."
        : err && err.name === "AbortError" ? "Stopped." : "We couldn't get an answer just now. Please try again.";
      out.innerHTML = `<p class="muted">${msg}</p>`;
    } finally { busy = false; controller = null; }
  }

  /* ---------- campaign starters ---------- */
  async function ideas() {
    const grid = $("ideasGrid"), btn = $("ideasBtn");
    if (!sampleFn) {
      grid.innerHTML = `<div class="empty">Campaign starters are available in the team link.</div>`;
      return;
    }
    btn.disabled = true; btn.textContent = "Working on it…";
    grid.innerHTML = [1, 2, 3].map(() => `<div class="idea idea--loading"><span></span><span></span><span></span></div>`).join("");
    const prompt = `${SYSTEM}

DATA (JSON):
${context()}

TASK: Suggest 3 creative campaign starters for Vichy based ONLY on patterns in this data (what competitors do well, gaps, trends, audience conversations, upcoming calendar moments).
Return ONLY a JSON array of 3 objects with these keys:
"title" (max 6 words), "insight" (1 sentence, cite the data), "idea" (2 sentences), "format" (e.g. "TikTok series with a dermatologist"), "hook" (an example opening line), "product" (a Vichy range), "inspired_by" (brand + post topic from the data, or "Trend: ..."), "link" (post url from the data or "").`;
    try {
      const res = await sampleFn(prompt, { cache: false, modelTier: "complex" });
      const json = JSON.parse((res.text.match(/\[[\s\S]*\]/) || ["[]"])[0]);
      grid.innerHTML = json.slice(0, 3).map((i, n) => `
        <article class="idea">
          <span class="idea__n">0${n + 1}</span>
          <h3>${esc(i.title)}</h3>
          <p class="idea__label">The insight</p><p>${esc(i.insight)}</p>
          <p class="idea__label">The idea</p><p>${esc(i.idea)}</p>
          <div class="idea__meta">
            <div><span>Format</span>${esc(i.format)}</div>
            <div><span>Product</span>${esc(i.product)}</div>
          </div>
          <blockquote>“${esc(i.hook)}”</blockquote>
          <p class="idea__src">Inspired by: ${/^https?:\/\//.test(i.link || "") ? `<a href="${esc(i.link)}" target="_blank" rel="noopener">${esc(i.inspired_by)}</a>` : esc(i.inspired_by)}</p>
          <button class="card__btn" data-note-idea>Add a team note</button>
        </article>`).join("") || `<div class="empty">No ideas came through. Please try again.</div>`;
    } catch (err) {
      grid.innerHTML = `<div class="empty">${err && err.code === "rate_limited" ? "Give it a minute and try again." : "We couldn't get ideas just now. Please try again."}</div>`;
    } finally { btn.disabled = false; btn.textContent = "Get new ideas"; }
  }

  /* ---------- team notes (shared comments) ---------- */
  let commentsApi = null;
  async function note(element) {
    if (commentsApi && commentsApi.openComposer) {
      try { await commentsApi.openComposer({ element }); return; } catch (e) { /* fall through */ }
    }
    const tip = $("tooltip");
    tip.textContent = "Team notes are available in the team link.";
    tip.hidden = false; tip.style.left = "50%"; tip.style.top = "80px";
    setTimeout(() => (tip.hidden = true), 2500);
  }

  /* ---------- environment: Claude team link vs. public website ---------- */
  function setEnv(inClaude, canAsk) {
    document.body.classList.toggle("is-claude", inClaude);
    document.body.classList.toggle("is-web", !inClaude);
    document.body.classList.toggle("has-ask", !!canAsk);
    if (!canAsk) {
      $("askInput").placeholder = "Search a brand, product or topic";
      $("askOpenBtn").textContent = "Search";
      const hb = document.querySelector("#askForm button"); if (hb) hb.textContent = "Search";
      $("askChips").innerHTML = ["La Roche-Posay", "Minéral 89", "Dercos", "Dermatologist", "Winter"].map(q => `<button type="button" class="chip-btn chip-btn--light">${q}</button>`).join("");
    }
    document.dispatchEvent(new CustomEvent("pulse:env", { detail: { claude: inClaude } }));
  }

  /* ---------- init ---------- */
  function init() {
    $("askChips").innerHTML = SUGGESTIONS.map(q => `<button type="button" class="chip-btn chip-btn--light">${esc(q)}</button>`).join("");
    $("askChips").addEventListener("click", e => { const b = e.target.closest("button"); if (b) ask(b.textContent); });
    $("askForm").addEventListener("submit", e => { e.preventDefault(); ask($("askInput").value); $("askInput").value = ""; });
    $("askForm2").addEventListener("submit", e => { e.preventDefault(); ask($("askInput2").value); $("askInput2").value = ""; });
    $("askOpenBtn").addEventListener("click", () => { if (sampleFn) { openPanel(); if (!$("askThread").children.length) bubble("intro", `<p>Ask anything about this week's competitor activity. For example:</p>` + SUGGESTIONS.slice(0, 3).map(q => `<button class="chip-btn" data-q="${esc(q)}">${esc(q)}</button>`).join("")); } else $("searchBtn").click(); });
    $("askThread").addEventListener("click", e => { const b = e.target.closest("[data-q]"); if (b) ask(b.dataset.q); });
    $("askClose").addEventListener("click", closePanel);
    $("askBackdrop").addEventListener("click", closePanel);
    document.addEventListener("keydown", e => { if (e.key === "Escape") closePanel(); });
    $("ideasBtn").addEventListener("click", ideas);
    $("ideasGrid").addEventListener("click", e => { const b = e.target.closest("[data-note-idea]"); if (b) note(b.closest(".idea")); });

    // Light up Claude features when available (the runtime may inject window.claude a moment later)
    let tries = 0;
    (function waitForClaude() {
      if (!(window.claude && typeof window.claude.use === "function")) {
        if (++tries < 24) return setTimeout(waitForClaude, 250);
        setEnv(false);
        return;
      }
      window.claude.use("sample").then(fn => {
        sampleFn = fn || null;
        setEnv(true, !!sampleFn);
      }).catch(() => setEnv(true, false));
      window.claude.use("comments").then(c => { commentsApi = c || null; }).catch(() => {});
    })();
  }

  window.PulseAsk = { ask, note, ideas };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
