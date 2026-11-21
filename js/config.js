/* =====================================================================
   IGNITE — CONFIG
   ---------------------------------------------------------------------
   HOW TO CONNECT YOUR GOOGLE SHEET
   1. In Google Sheets: File → Share → Publish to web.
   2. For EACH tab, choose the tab name + "Comma-separated values (.csv)",
      click Publish, and copy the link.
   3. Paste each link below between the quotes.
   Any tab left empty ("") uses the built-in sample data instead.
   When ALL tabs are connected, the "Sample data" banner disappears.
   ===================================================================== */

window.PULSE_CONFIG = {
  focusBrand: "Vichy",

  sheets: {
    insights: "",
    kpis: "",
    competitor_posts: "",
    keywords: "",
    hashtags: "",
    listening: "",
    products: "",
    calendar: ""
  },

  markets: ["All", "France", "UK", "Germany", "Spain", "Italy", "Europe"],

  /* One colour per brand — used everywhere (tiles, dots, bars). */
  brandColors: {
    "Vichy": "#0E5AA7",
    "La Roche-Posay": "#7C93AB",
    "Avène": "#8A6FB0",
    "Bioderma": "#C77D3A",
    "CeraVe": "#4E9A8A",
    "Eucerin": "#B04A5A",
    "Klorane": "#7A8B3D",
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
    "Klorane": "Pierre Fabre's haircare brand, competing with Dercos on hair loss."
  },

  popularSearches: ["Minéral 89", "Menopause", "Hair loss", "La Roche-Posay", "Skin barrier"]
};
