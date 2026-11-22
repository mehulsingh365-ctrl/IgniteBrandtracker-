# Ignite

Independent, static website (HTML/CSS/JS, no build step, no API keys).

## Files
- `index.html` — page structure
- `css/style.css` — design
- `js/config.js` — brand colours and notes
- `js/data.js` — loads the CSV files in data/
- `js/insights.js` — rule-based insight engine (thresholds at the top)
- `js/app.js` — rendering and interactions

## Data notes
- `data/competitor_posts.csv` has a `time` column (HH:MM, Paris time). It powers the posting timeline and the "When competitors post" grid.
- The period bar (Last 7 / 30 / 90 days, All time, or custom dates) filters posts, the timeline, "What's working" and listening.

## Data files (data/)
- `competitor_posts.csv` — every tracked post (date, time, brand, platform, likes, comments, views, followers, link)
- `accounts.csv` — followers per brand and platform, one row per check (adding new dated rows builds history)
- `insights.csv` — the 3 written takeaways shown in the brief
- `calendar.csv` — upcoming moments
- `keywords.csv`, `hashtags.csv`, `listening.csv` — added when trends and listening tracking start
There is no sample data: if a file is missing, that section shows "Not tracked yet".

## Preview locally
Run `python3 -m http.server` in this folder and open http://localhost:8000
(Opening index.html directly won't load the data files; use the local server.)

## Deploy on Vercel
Push this folder to a GitHub repo → Vercel → Add New Project → import the repo →
Framework preset: "Other" → Deploy. Every push to GitHub updates the live site within about a minute.

## Showing the real creatives
Paste each post's public URL into the `link` column of `competitor_posts`. Supported:
- Instagram: `https://www.instagram.com/p/…` or `/reel/…`
- TikTok: `https://www.tiktok.com/@account/video/1234…` (open the post in a browser and copy the full URL — short `vm.tiktok.com` links don't work)
- YouTube: `watch?v=…`, `youtu.be/…` or `/shorts/…`

The site uses each platform's official embed player — nothing is downloaded or re-hosted.
"Quick view" always shows the creative; the Tiles / Creatives switch shows them across the whole grid.
YouTube posts also get their real thumbnail on the tile. Embeds don't load inside the Claude preview —
check them on localhost or Vercel.

## Team version (private Claude link)
The team home is the private Claude artifact link. Share it from the artifact page (Share → add people).
Features that need Claude — "Ask Ignite", "Campaign starters" and "Add a team note" — work in that link.
On any other host (e.g. Vercel), Ask falls back to search and the rest of the site works normally.
`js/ask.js` holds the Ask logic, the suggested questions and the assistant's rules.
