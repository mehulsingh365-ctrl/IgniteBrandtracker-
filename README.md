# Ignite

Independent, static website (HTML/CSS/JS, no build step, no API keys).

## Files
- `index.html` — page structure
- `css/style.css` — design
- `js/config.js` — **the only file you normally edit**: Google Sheet links, brand colours, brand notes
- `js/sample-data.js` — sample data (illustrative only) + the exact column headers for each sheet tab
- `js/data.js` — loads your sheet (falls back to sample data)
- `js/insights.js` — rule-based insight engine (thresholds at the top)
- `js/app.js` — rendering and interactions

## Data notes
- `data/competitor_posts.csv` has a `time` column (HH:MM, Paris time). It powers the posting timeline and the "When competitors post" grid.
- The period bar (Last 7 / 30 / 90 days, All time, or custom dates) filters posts, the timeline, "What's working" and listening.

## Connect your Google Sheet
1. Create a Google Sheet with 8 tabs named: insights, kpis, competitor_posts, keywords, hashtags, listening, products, calendar.
2. Copy the header row of each tab from `js/sample-data.js`.
3. File → Share → Publish to web → pick each tab → CSV → Publish → copy link.
4. Paste each link into `js/config.js`. The "Sample data" banner disappears when all 8 are live.

## Preview locally
Run `python3 -m http.server` in this folder and open http://localhost:8000
(Opening index.html directly also works with sample data.)

## Deploy on Vercel
Push this folder to a GitHub repo → Vercel → Add New Project → import the repo →
Framework preset: "Other" → Deploy. Every edit to the Google Sheet shows on the site on refresh.

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
