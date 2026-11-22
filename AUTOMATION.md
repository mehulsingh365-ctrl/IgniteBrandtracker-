# Ignite — automatic updates

| What | How | When |
|---|---|---|
| YouTube stats + new uploads | GitHub Action `youtube-refresh.yml` (official YouTube API, free) | Every 2 hours |
| Instagram + TikTok posts, listening, insights | Claude scheduled task, using the logged-in Claude desktop browser | ~09:00 and ~18:00 Paris time |
| Website | Vercel redeploys automatically on every push to GitHub | Within ~1 minute of each update |

## One-time setup for the YouTube Action
1. Google Cloud Console → create a project → enable "YouTube Data API v3" → Credentials → Create API key.
2. GitHub repo → Settings → Secrets and variables → Actions → New repository secret:
   name `YOUTUBE_API_KEY`, value = your key.
3. GitHub repo → Actions tab → "Refresh YouTube data" → Run workflow (to test once).

## Requirements for the Claude runs
- Computer awake, Claude desktop app open.
- Logged in to Instagram and TikTok in the Claude browser; instagram.com, tiktok.com and youtube.com set to "Always allow".
- Runs only view public brand pages. They never like, follow, comment or post.

## Data files (in `data/`)
`competitor_posts.csv`, `kpis.csv`, `keywords.csv`, `hashtags.csv`, `listening.csv`, `products.csv`,
`calendar.csv`, `insights.csv`, `accounts.csv`. Any tab without a file shows "Not tracked yet" on the site.
There is no sample data.
