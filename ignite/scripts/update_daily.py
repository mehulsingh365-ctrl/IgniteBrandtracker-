"""
Daily background jobs for Ignite (free, no key). Runs on GitHub Actions once a day.

1) Brand interest: how often people open each brand's Wikipedia page (French + English),
   from the public Wikimedia pageviews API. A free, reliable sign of how much people look a
   brand up. Writes data/interest.csv (date, brand, views) and data/status/interest.json.
2) Weekly history: one row per brand per week (press articles, posts, likes, followers,
   subscribers, page views), kept forever in data/history/weekly.csv so the site can say
   "highest in 8 weeks" even after older posts and articles drop out of the other files.
"""
import csv, json, os, re, sys, time, unicodedata, urllib.parse, urllib.request
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")
UA = {"User-Agent": "IgniteBrandTracker/1.0 (https://github.com/mehulsingh365-ctrl/IgniteBrandtracker-)"}
BRANDS = ["Vichy", "La Roche-Posay", "CeraVe", "Avène", "Bioderma", "Eucerin", "Klorane", "The Ordinary"]

# Wikipedia pages to try for each brand, first match wins. The town pages are never used.
PAGES = {
    "fr": {"Vichy": ["Vichy (cosmétiques)", "Laboratoires Vichy", "Vichy Laboratoires", "Vichy (marque)"],
           "La Roche-Posay": ["La Roche-Posay (marque)", "La Roche-Posay (cosmétiques)", "La Roche-Posay (entreprise)",
                              "La Roche-Posay Laboratoire Dermatologique", "Laboratoire dermatologique de La Roche-Posay"],
           "Avène": ["Eau thermale Avène", "Avène (marque)", "Laboratoires dermatologiques Avène"],
           "Bioderma": ["Bioderma"], "CeraVe": ["CeraVe"], "Eucerin": ["Eucerin"],
           "Klorane": ["Klorane", "Klorane (marque)", "Laboratoires Klorane"],
           "The Ordinary": ["The Ordinary (marque)", "The Ordinary (cosmétiques)", "Deciem"]},
    "en": {"Vichy": ["Vichy Laboratoires", "Vichy (cosmetics)", "Vichy (brand)"],
           "La Roche-Posay": ["La Roche-Posay (company)", "La Roche-Posay (brand)", "La Roche-Posay (cosmetics)",
                              "La Roche-Posay (skincare)", "La Roche-Posay Laboratoire Dermatologique"],
           "Avène": ["Eau Thermale Avène", "Avène (brand)"],
           "Bioderma": ["Bioderma"], "CeraVe": ["CeraVe"], "Eucerin": ["Eucerin"],
           "Klorane": ["Klorane", "Klorane (brand)"],
           "The Ordinary": ["The Ordinary (brand)", "The Ordinary (skincare)", "The Ordinary (cosmetics)", "Deciem"]},
}
TOWNS = {"vichy", "la roche posay", "avene"}
SEARCH_HINT = {"fr": "marque cosmétique", "en": "skincare brand"}


def norm(t):
    t = unicodedata.normalize("NFKD", t).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", " ", t.lower()).strip()


def get_json(url):
    req = urllib.request.Request(url, headers=UA)
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return None
            time.sleep(3 * (attempt + 1))
        except Exception:
            time.sleep(3 * (attempt + 1))
    return None


def resolve(lang, brand):
    """Find the brand's own Wikipedia page (following redirects), never the town's."""
    api = f"https://{lang}.wikipedia.org/w/api.php?"
    titles = PAGES[lang].get(brand, [brand])
    q = get_json(api + urllib.parse.urlencode({"action": "query", "format": "json", "redirects": 1, "titles": "|".join(titles)}))
    if q:
        pages = [p for p in q.get("query", {}).get("pages", {}).values() if "missing" not in p]
        order = {norm(t): i for i, t in enumerate(titles)}
        redirects = {norm(r["to"]): norm(r["from"]) for r in q["query"].get("redirects", [])}
        normalized = {norm(r["to"]): norm(r["from"]) for r in q["query"].get("normalized", [])}
        def rank(p):
            n = norm(p["title"]); n = redirects.get(n, n); n = normalized.get(n, n)
            return order.get(n, 99)
        key = norm(brand).split()[-1]  # "vichy", "posay", "avene", "ordinary" ...
        pages = [p for p in pages if norm(p["title"]) not in TOWNS and (key in norm(p["title"]) or "deciem" in norm(p["title"]))]
        if pages:
            return sorted(pages, key=rank)[0]["title"]
    s = get_json(api + urllib.parse.urlencode({"action": "query", "format": "json", "list": "search", "srlimit": 5,
                                               "srsearch": f"{brand} {SEARCH_HINT[lang]}"}))
    key = norm(brand)
    for hit in (s or {}).get("query", {}).get("search", []):
        t = norm(hit["title"])
        if key in t and t not in TOWNS and not any(w in t for w in ("thermes", "station", "gare", "canton", "eglise", "chateau", "commune")):
            return hit["title"]
    return None


def pageviews(lang, title, start, end):
    t = urllib.parse.quote(title.replace(" ", "_"), safe="")
    url = (f"https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/{lang}.wikipedia/all-access/user/"
           f"{t}/daily/{start:%Y%m%d}00/{end:%Y%m%d}00")
    d = get_json(url) or {}
    return {f"{i['timestamp'][:4]}-{i['timestamp'][4:6]}-{i['timestamp'][6:8]}": i["views"] for i in d.get("items", [])}


def read_csv(path):
    if not os.path.exists(path):
        return [], []
    with open(path, newline="", encoding="utf-8") as f:
        r = csv.DictReader(f)
        return r.fieldnames or [], list(r)


def write_csv(path, fields, rows):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader(); w.writerows(rows)


def interest():
    end = date.today() - timedelta(days=1)
    start = end - timedelta(days=119)
    totals = defaultdict(int)
    used, missing = [], []
    for brand in BRANDS:
        got = False
        for lang in ("fr", "en"):
            title = resolve(lang, brand)
            if not title:
                continue
            views = pageviews(lang, title, start, end)
            if views:
                got = True
                used.append(f"{brand}: {lang}/{title}")
                for d, v in views.items():
                    totals[(d, brand)] += v
            time.sleep(1)
        if not got:
            missing.append(brand)
    rows = [{"date": d, "brand": b, "views": v} for (d, b), v in sorted(totals.items())]
    if rows:
        write_csv(os.path.join(DATA, "interest.csv"), ["date", "brand", "views"], rows)
    print("Pages used:", "; ".join(used))
    return rows, used, missing


def week_of(d):
    d = date.fromisoformat(d[:10])
    return (d - timedelta(days=d.weekday())).isoformat()


def history(interest_rows):
    path = os.path.join(DATA, "history", "weekly.csv")
    fields = ["week", "brand", "news", "posts", "likes", "youtube_subscribers", "instagram_followers", "wiki_views"]
    _, old = read_csv(path)
    keep = {(r["week"], r["brand"]): r for r in old}

    _, news = read_csv(os.path.join(DATA, "news.csv"))
    posts = []
    for p in ("instagram", "youtube"):
        posts += read_csv(os.path.join(DATA, "posts", f"{p}.csv"))[1]
    _, accounts = read_csv(os.path.join(DATA, "accounts.csv"))

    today = date.today()
    this_week = week_of(today.isoformat())
    # Recompute only recent weeks, where the source files are still complete
    weeks = [(today - timedelta(days=today.weekday() + 7 * i)).isoformat() for i in range(0, 6)]
    news_from = (today - timedelta(days=40)).isoformat()
    for wk in weeks:
        wk_end = (date.fromisoformat(wk) + timedelta(days=6)).isoformat()
        for b in BRANDS:
            row = dict(keep.get((wk, b), {"week": wk, "brand": b}))
            if wk >= news_from:
                row["news"] = sum(1 for n in news if n.get("brand") == b and week_of(n["date"]) == wk)
            bp = [p for p in posts if p.get("brand") == b and p.get("date") and week_of(p["date"]) == wk]
            row["posts"] = len(bp)
            row["likes"] = sum(int(float(p["likes"])) for p in bp if str(p.get("likes", "")).replace(".", "", 1).isdigit())
            for plat, col in (("YouTube", "youtube_subscribers"), ("Instagram", "instagram_followers")):
                acc = sorted([a for a in accounts if a["brand"] == b and a["platform"] == plat and a["date"] <= wk_end], key=lambda a: a["date"])
                if acc and acc[-1]["date"] >= wk:
                    row[col] = acc[-1]["followers"]
                else:
                    row.setdefault(col, "")
            views = [int(r["views"]) for r in interest_rows if r["brand"] == b and week_of(r["date"]) == wk]
            if views:
                row["wiki_views"] = sum(views)
            else:
                row.setdefault("wiki_views", "")
            keep[(wk, b)] = row
    # Older weeks of page views can be filled from the 120 days the API returns
    for r in interest_rows:
        wk = week_of(r["date"])
        if wk not in weeks and wk != this_week:
            row = keep.setdefault((wk, r["brand"]), {"week": wk, "brand": r["brand"]})
            if wk < min(weeks):
                row["wiki_views"] = sum(int(x["views"]) for x in interest_rows if x["brand"] == r["brand"] and week_of(x["date"]) == wk)
    rows = sorted(keep.values(), key=lambda r: (r["week"], r["brand"]))
    write_csv(path, fields, [{k: r.get(k, "") for k in fields} for r in rows])
    return len({r["week"] for r in rows})


def main():
    status_path = os.path.join(DATA, "status", "interest.json")
    try:
        rows, used, missing = interest()
    except Exception as e:
        rows, used, missing = [], [], BRANDS
        print("! interest failed:", type(e).__name__)
    if not rows:  # keep the file from the last good run
        rows = read_csv(os.path.join(DATA, "interest.csv"))[1]
    weeks = history(rows)
    msg = f"{len(BRANDS) - len(missing)} of {len(BRANDS)} brands found on Wikipedia; {weeks} weeks of history"
    if missing:
        msg += f"; no page for {', '.join(missing)}"
    with open(status_path, "w", encoding="utf-8") as f:
        json.dump({"source": "Brand interest (Wikipedia)", "engine": "cloud", "schedule": "Once a day",
                   "last_run": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
                   "ok": bool(rows), "items": len(rows), "message": msg}, f, indent=1, ensure_ascii=False)
    print(msg)


if __name__ == "__main__":
    main()
