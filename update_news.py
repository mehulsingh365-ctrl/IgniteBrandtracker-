"""
Collects recent press articles about Vichy and its competitors from Google News
RSS feeds (free, public, no key). Runs on GitHub Actions every 2 hours.

Writes data/news.csv (last 45 days, de-duplicated) and data/status/news.json.
"""
import csv, json, os, re, sys, unicodedata, urllib.parse, urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "data", "news.csv")
STATUS = os.path.join(ROOT, "data", "status", "news.json")
QUERIES = os.path.join(ROOT, "scripts", "news_queries.json")
FIELDS = ["date", "time", "brand", "language", "title", "source", "link"]
EDITIONS = [("en", "hl=en-GB&gl=GB&ceid=GB:en"), ("fr", "hl=fr&gl=FR&ceid=FR:fr")]
PARIS = timezone(timedelta(hours=1))
KEEP_DAYS = 45


def fetch(query, edition):
    url = f"https://news.google.com/rss/search?q={urllib.parse.quote(query + ' when:30d')}&{edition}"
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (IgniteTracker; +https://github.com)"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read()


def parse(xml_bytes):
    items = []
    root = ET.fromstring(xml_bytes)
    for it in root.iter("item"):
        title = (it.findtext("title") or "").strip()
        link = (it.findtext("link") or "").strip()
        src_el = it.find("source")
        source = (src_el.text or "").strip() if src_el is not None else ""
        # Google appends " - Source" to titles; remove it
        if source and title.endswith(" - " + source):
            title = title[: -len(" - " + source)]
        try:
            dt = parsedate_to_datetime(it.findtext("pubDate")).astimezone(PARIS)
        except Exception:
            continue
        items.append({"dt": dt, "title": title, "source": source, "link": link})
    return items


def norm(t):
    t = unicodedata.normalize("NFKD", t).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", " ", t.lower()).strip()


# words that must appear in the headline for it to count for that brand
BRAND_WORDS = {"Vichy": ["vichy"], "La Roche-Posay": ["roche posay", "larocheposay"], "Avène": ["avene"],
               "Bioderma": ["bioderma"], "CeraVe": ["cerave"], "Eucerin": ["eucerin"], "Klorane": ["klorane"]}


def write_status(ok, items, message):
    with open(STATUS, "w", encoding="utf-8") as f:
        json.dump({"source": "News", "engine": "cloud", "schedule": "Every 2 hours",
                   "last_run": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
                   "ok": ok, "items": items, "message": message}, f, indent=1, ensure_ascii=False)


def main():
    queries = json.load(open(QUERIES, encoding="utf-8"))
    existing = []
    if os.path.exists(OUT):
        with open(OUT, newline="", encoding="utf-8") as f:
            existing = list(csv.DictReader(f))
    seen = {norm(r["title"]) + "|" + r["brand"] for r in existing}
    added, errors = 0, 0
    for brand, qs in queries.items():
        if brand.startswith("_"):
            continue
        for q in qs:
            for lang, edition in EDITIONS:
                try:
                    items = parse(fetch(q, edition))
                except Exception as e:
                    errors += 1
                    print(f"! {brand} / {q} / {lang}: {type(e).__name__}")
                    continue
                for it in items:
                    key = norm(it["title"]) + "|" + brand
                    if key in seen:
                        continue
                    # keep only articles that actually name the brand
                    words = BRAND_WORDS.get(brand, [norm(brand)])
                    if not any(w in norm(it["title"]) for w in words):
                        continue
                    seen.add(key)
                    existing.append({"date": it["dt"].date().isoformat(), "time": it["dt"].strftime("%H:%M"),
                                     "brand": brand, "language": lang, "title": it["title"],
                                     "source": it["source"], "link": it["link"]})
                    added += 1
    cutoff = (datetime.now(PARIS) - timedelta(days=KEEP_DAYS)).date().isoformat()
    rows = sorted([r for r in existing if r["date"] >= cutoff], key=lambda r: (r["date"], r["time"]), reverse=True)
    with open(OUT, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=FIELDS)
        w.writeheader()
        w.writerows(rows)
    ok = errors == 0 or added > 0 or len(rows) > 0
    write_status(ok, len(rows), f"{added} new articles" + (f", {errors} searches failed" if errors else ""))
    print(f"Added {added}, kept {len(rows)}, errors {errors}")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        write_status(False, 0, f"Failed: {type(e).__name__}")
        raise
