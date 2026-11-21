"""
Refreshes YouTube posts in data/competitor_posts.csv using the official
YouTube Data API v3 (free key). Runs on GitHub Actions every 2 hours.

- Updates views / likes / comments for every YouTube row already in the file.
- Adds new uploads from the last 7 days for each channel in scripts/channels.json.
Needs the repository secret YOUTUBE_API_KEY.
"""
import csv, json, os, re, sys, urllib.parse, urllib.request
from datetime import datetime, timedelta, timezone

API = "https://www.googleapis.com/youtube/v3/"
KEY = os.environ.get("YOUTUBE_API_KEY")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CSV_PATH = os.path.join(ROOT, "data", "competitor_posts.csv")
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


def main():
    if not KEY:
        sys.exit("YOUTUBE_API_KEY is not set")
    with open(CSV_PATH, newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    known = {video_id(r["link"]) for r in rows if r["platform"] == "YouTube"}

    # 1) New uploads from the last 7 days
    channels = json.load(open(os.path.join(ROOT, "scripts", "channels.json"), encoding="utf-8"))
    since = datetime.now(timezone.utc) - timedelta(days=7)
    for brand, handle in channels.items():
        if brand.startswith("_"):
            continue
        ch = call("channels", part="contentDetails,statistics", forHandle=handle).get("items", [])
        if not ch:
            print(f"! channel not found: {brand} {handle}")
            continue
        subs = ch[0]["statistics"].get("subscriberCount", "")
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

    with open(CSV_PATH, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=FIELDS, extrasaction="ignore")
        w.writeheader()
        w.writerows(rows)
    print(f"Updated {len(stats)} YouTube posts, {len(rows)} rows total.")


if __name__ == "__main__":
    main()
