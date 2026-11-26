/* =====================================================================
   IGNITE — key takeaways and alerts, worked out from the numbers.
   Edit the thresholds below to change when flags fire.
   ===================================================================== */

window.PulseInsights = (function () {
  const T = {
    negativeSpikePts: 5,      // negative % rise (points) that triggers an alert
    oppGrowth: 15,            // keyword growth % above which a topic is "growing"
    oppShare: 15              // Vichy share % below which Vichy is "barely present"
  };

  const avg = a => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0);
  const pct = v => `${v.toFixed(1)}%`;

  function weeks(kpis) { return [...new Set(kpis.map(k => k.week))].sort(); }

  function kpiPair(data, brand) {
    const w = weeks(data.kpis);
    const cur = data.kpis.find(k => k.brand === brand && k.week === w[w.length - 1]);
    const prev = data.kpis.find(k => k.brand === brand && k.week === w[w.length - 2]);
    return { cur, prev, week: w[w.length - 1], prevWeek: w[w.length - 2] };
  }

  function quadrant(k) {
    const growing = k.change_vs_prev > T.oppGrowth;
    const strong = k.vichy_share_pct >= T.oppShare;
    if (growing && !strong) return "Opportunity";
    if (growing && strong) return "Defend";
    if (!growing && strong) return "Maintain";
    return "Monitor";
  }

  function bestBy(rows, key, valueKey) {
    const groups = {};
    rows.forEach(r => { (groups[r[key]] = groups[r[key]] || []).push(Number(r[valueKey]) || 0); });
    // Typical value (median), so one viral post can't make a whole format or angle look best
    const median = v => { const x = [...v].sort((a, b) => a - b), m = Math.floor(x.length / 2); return x.length % 2 ? x[m] : (x[m - 1] + x[m]) / 2; };
    return Object.entries(groups).map(([name, v]) => ({ name, value: median(v), n: v.length })).sort((a, b) => (b.n >= 3) - (a.n >= 3) || b.value - a.value);
  }

  function generate(data, view) {
    const focus = window.PULSE_CONFIG.focusBrand;
    const flags = [], sowhat = {};
    const { cur, prev, week } = kpiPair(data, focus);

    // 1. Negative sentiment spike
    if (cur && prev && cur.negative_pct - prev.negative_pct >= T.negativeSpikePts) {
      const topNeg = bestCount(data.listening.filter(m => m.sentiment === "Negative"), "topic")[0];
      flags.push({ level: "alert", label: "Alert · Sentiment",
        text: `Negative mentions of ${focus} rose from ${prev.negative_pct}% to ${cur.negative_pct}%${topNeg ? `, driven mainly by ${topNeg.name.toLowerCase()} comments` : ""}.` });
    }

    // 2. Engagement vs competitors
    const curWeek = data.kpis.filter(k => k.week === week);
    const comp = curWeek.filter(k => k.brand !== focus);
    if (cur && comp.length) {
      const compAvg = avg(comp.map(k => k.avg_engagement_rate));
      const gap = ((cur.avg_engagement_rate - compAvg) / compAvg) * 100;
      const leader = [...curWeek].sort((a, b) => b.avg_engagement_rate - a.avg_engagement_rate)[0];
      sowhat.er = `${focus}'s engagement rate is <strong>${Math.abs(gap).toFixed(0)}% ${gap < 0 ? "below" : "above"}</strong> the competitor average (${pct(cur.avg_engagement_rate)} vs ${pct(compAvg)}). ${leader.brand} leads at ${pct(leader.avg_engagement_rate)}.`;
      if (gap < -10) flags.push({ level: "info", label: "Watch · Engagement", text: `${focus} engagement is ${Math.abs(gap).toFixed(0)}% below the competitor average this week.` });

      const totalMentions = curWeek.reduce((s, k) => s + k.mentions, 0);
      const ranked = [...curWeek].sort((a, b) => b.mentions - a.mentions);
      const rank = ranked.findIndex(k => k.brand === focus) + 1;
      const share = (cur.mentions / totalMentions) * 100;
      sowhat.sov = `${focus} holds <strong>${pct(share)}</strong> of the conversation and ranks #${rank} of ${ranked.length}. ${ranked[0].brand} leads with ${pct((ranked[0].mentions / totalMentions) * 100)}.`;
    }

    // 3. Top post of the week
    const posts = view.posts.filter(p => p.engagement_rate != null);
    if (posts.length) {
      const top = [...view.posts].sort((a, b) => (Number(b.likes) || 0) - (Number(a.likes) || 0))[0];
      const plats = {}; posts.forEach(p => { plats[p.platform] = (plats[p.platform] || 0) + 1; });
      const mainPlat = Object.entries(plats).sort((a, b) => b[1] - a[1])[0][0];
      const fmt = bestBy(posts.filter(p => p.brand !== focus && p.platform === mainPlat), "format", "engagement_rate")[0];
      const fmtName = n => /^reel|video|post$/i.test(n) ? n.toLowerCase() + "s" : n.toLowerCase();
      sowhat.posts = `Most liked: <strong>${top.brand}</strong>, "${top.topic}" (${top.platform}, ${Number(top.likes).toLocaleString("en-GB")} likes).${fmt ? ` On ${mainPlat}, competitor <strong>${fmtName(fmt.name)}</strong> get the best engagement (${fmt.value.toFixed(2)}% typical).` : ""}`;
      const same = posts.filter(p => p.platform === mainPlat);
      const derm = same.filter(p => /dermatolog/i.test(p.topic + " " + p.summary));
      const nonDerm = same.filter(p => !/dermatolog/i.test(p.topic + " " + p.summary));
      if (derm.length >= 2 && nonDerm.length) {
        const lift = ((avg(derm.map(p => p.engagement_rate)) / avg(nonDerm.map(p => p.engagement_rate))) - 1) * 100;
        if (lift > 10) flags.push({ level: "info", label: "Pattern · Content", text: `On ${mainPlat}, posts with a dermatologist earn ${lift.toFixed(0)}% more engagement than other posts.` });
      }
    }

    // 3b. Share of posts vs share of likes (focus brand)
    if (posts.length) {
      const total = view.posts.length;
      const likesOf = b => view.posts.filter(p => !b || p.brand === b).reduce((a, p) => a + (Number(p.likes) || 0), 0);
      const allLikes = likesOf();
      const mine = view.posts.filter(p => p.brand === focus).length;
      if (total && allLikes && mine) {
        const postShare = (mine / total) * 100, likeShare = (likesOf(focus) / allLikes) * 100;
        flags.push({ level: likeShare < postShare ? "alert" : "opportunity", label: "Watch · Share of engagement",
          text: `${focus} published ${postShare.toFixed(0)}% of all tracked posts in this period and earned ${likeShare.toFixed(0)}% of the likes.` });
      }
      const top = [...view.posts].sort((a, b) => (Number(b.likes) || 0) - (Number(a.likes) || 0))[0];
      if (top && Number(top.likes)) flags.unshift({ level: "info", label: "Most liked · " + top.platform,
        text: `${top.brand}: "${top.topic}" with ${Number(top.likes).toLocaleString("en-GB")} likes.` });
    }

    // 4. Fastest-rising keyword & opportunities
    const kws = view.keywords;
    if (kws.length) {
      const top = [...kws].sort((a, b) => b.change_vs_prev - a.change_vs_prev)[0];
      const opps = kws.filter(k => quadrant(k) === "Opportunity").sort((a, b) => b.change_vs_prev - a.change_vs_prev);
      sowhat.kw = `Rising fastest: <strong>"${top.keyword}"</strong> (+${top.change_vs_prev}% in ${top.market}).${opps.length ? ` ${opps.length} growing topic${opps.length > 1 ? "s have" : " has"} low Vichy presence. See the Opportunity map below.` : ""}`;
      if (opps[0]) flags.push({ level: "opportunity", label: "Opportunity · Search", text: `"${opps[0].keyword}" is up ${opps[0].change_vs_prev}% while Vichy holds only ${opps[0].vichy_share_pct}% of the conversation.` });
    }

    // 5. Product momentum
    const prods = view.products.filter(p => p.mentions_prev);
    if (prods.length) {
      const withChange = prods.map(p => ({ ...p, ch: ((p.mentions - p.mentions_prev) / p.mentions_prev) * 100 })).sort((a, b) => b.ch - a.ch);
      const up = withChange[0], down = withChange[withChange.length - 1];
      const mostNeg = [...prods].sort((a, b) => b.negative_pct - a.negative_pct)[0];
      sowhat.products = `<strong>${up.product}</strong> has the strongest momentum (+${up.ch.toFixed(0)}% mentions)${down.ch < 0 ? `, while ${down.product} is cooling (${down.ch.toFixed(0)}%)` : ""}. ${mostNeg.product} carries the most negative sentiment (${mostNeg.negative_pct}%, mainly ${String(mostNeg.top_theme).toLowerCase()}).`;
      flags.push({ level: "info", label: "Momentum · Product", text: `${up.product} mentions are up ${up.ch.toFixed(0)}%, the fastest-growing Vichy range this week.` });
    }

    // 6. Listening
    const ms = view.listening;
    if (ms.length) {
      const pos = ms.filter(m => m.sentiment === "Positive").length / ms.length * 100;
      const neg = ms.filter(m => m.sentiment === "Negative").length / ms.length * 100;
      const themes = bestCount(ms, "topic");
      const negThemes = bestCount(ms.filter(m => m.sentiment === "Negative"), "topic");
      sowhat.listen = `${pos.toFixed(0)}% of sampled mentions are positive and ${neg.toFixed(0)}% negative. People talk most about <strong>${themes[0].name.toLowerCase()}</strong>${negThemes[0] ? `; criticism centres on <strong>${negThemes[0].name.toLowerCase()}</strong>` : ""}.`;
    }

    return { flags: flags.slice(0, 5), sowhat };
  }

  function bestCount(rows, key) {
    const c = {};
    rows.forEach(r => { if (r[key]) c[r[key]] = (c[r[key]] || 0) + 1; });
    return Object.entries(c).map(([name, n]) => ({ name, n })).sort((a, b) => b.n - a.n);
  }

  return { generate, quadrant, kpiPair, bestBy, bestCount, weeks, T };
})();
