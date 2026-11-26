/* =====================================================================
   IGNITE — CONFIG
   All data lives in the data/ folder as CSV files (free, no services needed):
   competitor_posts.csv, accounts.csv, insights.csv, calendar.csv
   (+ keywords.csv, hashtags.csv, listening.csv once those are tracked).
   ===================================================================== */

window.PULSE_CONFIG = {
  focusBrand: "Vichy",

  /* One colour per brand — used everywhere (tiles, dots, bars). */
  brandColors: {
    "Vichy": "#0E5AA7",
    "La Roche-Posay": "#7C93AB",
    "Avène": "#8A6FB0",
    "Bioderma": "#C77D3A",
    "CeraVe": "#4E9A8A",
    "Eucerin": "#B04A5A",
    "Klorane": "#7A8B3D",
    "The Ordinary": "#3A3A3A",
    "René Furterer": "#A0785A",
    "Ducray": "#5A6B8C"
  },

  /* Short "why we track them" notes for the Brands in focus section. */
  brandNotes: {
    "La Roche-Posay": "Vichy's sister brand at L'Oréal, and the one to beat on dermatologist-led content.",
    "Avène": "Pierre Fabre's thermal water brand. The closest rival to Minéral 89.",
    "Bioderma": "A pharmacy favourite that owns micellar water and sensitive skin.",
    "CeraVe": "Another L'Oréal sister brand, and the loudest voice on skin barrier with Gen Z on TikTok.",
    "Eucerin": "Beiersdorf's science-first brand, going head to head with Liftactiv on anti-ageing.",
    "Klorane": "Pierre Fabre's haircare brand, competing with Dercos on hair loss.",
    "The Ordinary": "DECIEM's science-first, affordable brand, built around ingredients like niacinamide and retinol."
  },

  popularSearches: ["Minéral 89", "Menopause", "Hair loss", "La Roche-Posay", "Skin barrier"]
};
