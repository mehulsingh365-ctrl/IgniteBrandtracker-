"""
Refreshes YouTube posts in data/posts/youtube.csv using the official
YouTube Data API v3 (free key). Runs on GitHub Actions about every hour.

- Updates views / likes / comments for every YouTube row already in the file.
- Adds new uploads from the last 7 days for each channel in scripts/channels.json.
Needs the repository secret YOUTUBE_API_KEY.
"""
import csv, json, os, re, sys, urllib.parse, urllib.request
from datetime import datetime, timedelta, timezone

API = "https://www.googleapis.com/youtube/v3/"
KEY = os.environ.get("YOUTUBE_API_KEY")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CSV_PATH = os.path.join(ROOT, "data", "posts", "youtube.csv")
STATUS_PATH = os.path.join(ROOT, "data", "status", "youtube.json")
ACCOUNTS_PATH = os.path.join(ROOT, "data", "accounts.csv")
FIELDS = ["date", "time", "brand", "platform", "market", "category", "format", "topic", "product",
          "likes", "comments", "views", "followers", "engagement_rate", "summary", "link"]


def call(endpoint, **params):
    params["key"] = KEY
    url = API + endpoint + "?" + urllib.parse.urlencode(params)
    with urllib.request.urlopen(url, timeout=30) as r:
        return json.load(r)


def video_id(link):
    m = re.search(r"(?:v=|youtu\.be/|shorts/|embed/)([\w-]{11})", link or "")
    return m.group(1) if m else None


def write_status(ok, items, message):
    status = {"source": "YouTube", "engine": "cloud", "schedule": "Every hour",
              "last_run": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
              "ok": ok, "items": items, "message": message}
    with open(STATUS_PATH, "w", encoding="utf-8") as f:
        json.dump(status, f, indent=1, ensure_ascii=False)


def main():
    if not KEY:
        write_status(False, 0, "YouTube key missing")
        sys.exit("YOUTUBE_API_KEY is not set")
    with open(CSV_PATH, newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    known = {video_id(r["link"]) for r in rows if r["platform"] == "YouTube"}

    # 1) New uploads from the last 7 days
    channels = json.load(open(os.path.join(ROOT, "scripts", "channels.json"), encoding="utf-8"))
    since = datetime.now(timezone.utc) - timedelta(days=7)
    today = datetime.now(timezone(timedelta(hours=1))).date().isoformat()
    with open(ACCOUNTS_PATH, newline="", encoding="utf-8") as f:
        areader = csv.DictReader(f); afields = areader.fieldnames; accounts = list(areader)
    found, missing = [], []
    for brand, handles in channels.items():
        if brand.startswith("_"):
            continue
        # A list of handles: try each one and keep the channel with the most subscribers
        best, best_handle = None, None
        for handle in (handles if isinstance(handles, list) else [handles]):
            try:
                items = call("channels", part="contentDetails,statistics,snippet", forHandle=handle).get("items", [])
            except Exception as e:
                print(f"! {brand} {handle}: {type(e).__name__}"); items = []
            if items and (best is None or int(items[0]["statistics"].get("subscriberCount", 0) or 0) > int(best["statistics"].get("subscriberCount", 0) or 0)):
                best, best_handle = items[0], handle
        if not best:
            print(f"! channel not found: {brand}")
            missing.append(brand)
            continue
        ch = [best]
        found.append(brand)
        subs = ch[0]["statistics"].get("subscriberCount", "")
        if subs and not ch[0]["statistics"].get("hiddenSubscriberCount"):
            h = ch[0].get("snippet", {}).get("customUrl") or best_handle
            h = h if h.startswith("@") else "@" + h
            accounts = [a for a in accounts if not (a["date"] == today and a["brand"] == brand and a["platform"] == "YouTube")]
            accounts.append({"date": today, "brand": brand, "platform": "YouTube", "handle": h,
                             "followers": subs, "url": f"https://www.youtube.com/{h}"})
        uploads = ch[0]["contentDetails"]["relatedPlaylists"]["uploads"]
        items = call("playlistItems", part="snippet", playlistId=uploads, maxResults=10).get("items", [])
        for it in items:
            sn = it["snippet"]
            vid = sn["resourceId"]["videoId"]
            published = datetime.fromisoformat(sn["publishedAt"].replace("Z", "+00:00"))
            if vid in known or published < since:
                continue
            title = sn["title"]
            rows.append({
                "date": published.astimezone(timezone(timedelta(hours=1))).date().isoformat(), "time": published.astimezone(timezone(timedelta(hours=1))).strftime("%H:%M"), "brand": brand, "platform": "YouTube",
                "market": "Global", "category": "Haircare" if re.search(r"dercos|hair|scalp|dandruff", title, re.I) else "Skincare",
                "format": "Video", "topic": title, "product": "", "likes": "", "comments": "", "views": "",
                "followers": subs, "engagement_rate": "", "summary": f"New YouTube upload: {title}",
                "link": f"https://www.youtube.com/watch?v={vid}",
            })
            known.add(vid)
            print(f"+ {brand}: {title}")

    # 2) Refresh stats for every YouTube row
    ids = [video_id(r["link"]) for r in rows if r["platform"] == "YouTube" and video_id(r["link"])]
    stats = {}
    for i in range(0, len(ids), 50):
        for it in call("videos", part="statistics", id=",".join(ids[i:i + 50])).get("items", []):
            stats[it["id"]] = it["statistics"]
    for r in rows:
        s = stats.get(video_id(r["link"]) or "")
        if s:
            r["views"] = s.get("viewCount", r["views"])
            r["likes"] = s.get("likeCount", r["likes"])
            r["comments"] = s.get("commentCount", r["comments"])
            r["engagement_rate"] = ""  # recalculated by the website

    with open(ACCOUNTS_PATH, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=afields)
        w.writeheader(); w.writerows(accounts)
    with open(CSV_PATH, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=FIELDS, extrasaction="ignore")
        w.writeheader()
        w.writerows(rows)
    new = sum(1 for r in rows if r["summary"].startswith("New YouTube upload"))
    write_status(bool(found), len(rows), f"Refreshed {len(stats)} videos from {len(found)} brands" + (f"; no YouTube channel tracked yet for {', '.join(missing)}" if missing else ""))
    print(f"Updated {len(stats)} YouTube posts, {len(rows)} rows total.")


if __name__ == "__main__":
    try:
        main()
    except SystemExit:
        raise
    except Exception as e:  # record the failure so the site's Data status panel shows it
        write_status(False, 0, f"Failed: {type(e).__name__}")
        raise
