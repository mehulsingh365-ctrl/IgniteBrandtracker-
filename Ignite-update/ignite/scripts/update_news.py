"""
Collects recent press articles about Vichy and its competitors from Google News
RSS feeds (free, public, no key). Runs on GitHub Actions about every hour.

Writes data/news.csv (last 45 days, de-duplicated) and data/status/news.json.
"""
import csv, json, os, re, sys, time, unicodedata, urllib.parse, urllib.request
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
START = time.time()


def fetch(query, edition):
    """One Google News search. Waits between searches and retries, because Google
    refuses searches that come too fast."""
    url = f"https://news.google.com/rss/search?q={urllib.parse.quote(query + ' when:30d')}&{edition}"
    req = urllib.request.Request(url, headers={
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        "Accept-Language": "en-GB,en;q=0.9,fr;q=0.8"})
    last = None
    for wait in (0, 20, 60):
        if wait and time.time() - START > 600:  # keep the whole run under ~10 minutes
            break
        time.sleep(wait + 3)
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                return r.read()
        except Exception as e:
            last = e
    raise last


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

# Vichy and La Roche-Posay are also French towns. For these two brands a headline must
# also mention skincare, a product line or the company, so town news is left out.
SKINCARE_WORDS = ["skin", "skincare", "beauty", "beaute", "peau", "soin", "soins", "creme", "cream", "serum",
                  "sunscreen", "spf", "solaire", "sun care", "moisturi", "hydrat", "acne", "anti aging", "anti age",
                  "wrinkle", "rides", "derm", "routine", "cosmet", "pharmac", "products", "produit", "launch",
                  "lancement", "brand", "marque", "campaign", "campagne", "oreal", "shampoo", "shampooing",
                  "hair", "cheveux", "makeup", "maquillage", "review", "test", "deal", "black friday", "sale",
                  "promo", "advent", "calendrier", "gift", "cadeau", "influenc", "tiktok", "instagram",
                  "mineral 89", "liftactiv", "dercos", "normaderm", "neovadiol", "capital soleil", "dermablend",
                  "racing team", "sailing", "ac75", "america s cup", "living lab", "health", "gaming", "streamer",
                  "sponsor", "partner", "partenaire", "partenariat", "foundation", "fondation", "patients", "cancer",
                  "anthelios", "effaclar", "cicaplast", "lipikar", "toleriane", "hyalu b5", "mela b3", "vitamin c"]
NEEDS_CONTEXT = {"Vichy", "La Roche-Posay"}


def relevant(brand, title):
    t = norm(title)
    if not any(w in t for w in BRAND_WORDS.get(brand, [norm(brand)])):
        return False
    if brand in NEEDS_CONTEXT:
        return any(w in t for w in SKINCARE_WORDS)
    return True


def write_status(ok, items, message):
    with open(STATUS, "w", encoding="utf-8") as f:
        json.dump({"source": "News", "engine": "cloud", "schedule": "Every hour",
                   "last_run": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
                   "ok": ok, "items": items, "message": message}, f, indent=1, ensure_ascii=False)


def main():
    queries = json.load(open(QUERIES, encoding="utf-8"))
    existing = []
    if os.path.exists(OUT):
        with open(OUT, newline="", encoding="utf-8") as f:
            existing = list(csv.DictReader(f))
    # re-check what is already saved, so older town news is cleared too
    existing = [r for r in existing if relevant(r["brand"], r["title"])]
    seen = {norm(r["title"]) + "|" + r["brand"] for r in existing}
    added, errors, tried = 0, 0, 0
    for brand, qs in queries.items():
        if brand.startswith("_"):
            continue
        for q in qs:
            for lang, edition in EDITIONS:
                tried += 1
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
                    if not relevant(brand, it["title"]):
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
    ok = errors < tried  # fails only if no search at all got through
    msg = f"{added} new articles" + (f", {errors} of {tried} searches failed" if errors else "")
    if not ok:
        msg = f"Google News refused all {tried} searches; showing articles saved earlier"
    write_status(ok, len(rows), msg)
    print(f"Added {added}, kept {len(rows)}, errors {errors}")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        write_status(False, 0, f"Failed: {type(e).__name__}")
        raise
