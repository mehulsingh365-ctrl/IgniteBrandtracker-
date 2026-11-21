/* =====================================================================
   SAMPLE DATA — illustrative only, NOT real figures.
   Same columns as the Google Sheet tabs, so you can copy the header
   rows straight into your sheet.
   ===================================================================== */

window.SAMPLE_CSV = {

insights: `week,title,detail,section,priority
W47,"Menopause skincare is Vichy's clearest opportunity","Searches for menopause skincare keep rising in France and the UK, yet Neovadiol appears in few of the top TikTok posts on the topic. A creator-led education series could close the gap before January.",Trends,High
W47,"Competitors win with dermatologists on camera","The best-performing competitor posts this week feature a dermatologist explaining a routine. Vichy's own posts are product-led visuals and engage less.",Competitors,High
W47,"Dercos conversation is positive but narrow","Hair-loss mentions of Dercos are mostly positive but focus on one product. Seasonal autumn hair-fall content is an open lane while searches peak.",Listening,Medium`,

kpis: `week,brand,platform,market,followers,avg_engagement_rate,posts,mentions,positive_pct,negative_pct
W46,Vichy,All,Europe,1240000,2.1,6,410,58,12
W46,La Roche-Posay,All,Europe,2980000,3.4,9,1180,61,10
W46,Avène,All,Europe,860000,2.6,5,290,63,8
W46,Bioderma,All,Europe,1420000,2.4,7,520,60,9
W46,CeraVe,All,Europe,3350000,4.1,8,1350,57,13
W46,Eucerin,All,Europe,1050000,2.2,5,260,59,10
W47,Vichy,All,Europe,1246500,1.9,7,455,55,18
W47,La Roche-Posay,All,Europe,2994000,3.6,10,1240,62,9
W47,Avène,All,Europe,862300,2.8,5,310,64,8
W47,Bioderma,All,Europe,1425800,2.3,6,505,59,10
W47,CeraVe,All,Europe,3372000,4.4,9,1420,58,12
W47,Eucerin,All,Europe,1053100,2.5,6,285,61,9`,

competitor_posts: `date,brand,platform,market,category,format,topic,product,likes,comments,views,followers,engagement_rate,summary,link
2026-11-12,CeraVe,TikTok,France,Skincare,Video,"Dermatologist explains the winter skin-barrier routine",Moisturising Cream,48200,1260,612000,1450000,,"A dermatologist walks through a three-step winter routine in 40 seconds with a split-screen before/after.",
2026-11-13,La Roche-Posay,Instagram,France,Skincare,Reel,"One balm, ten uses",Cicaplast Baume B5,36400,890,402000,1020000,,"Fast-cut reel showing everyday uses of one hero product; strong save and share behaviour in comments.",
2026-11-10,Avène,Instagram,France,Skincare,Carousel,"Sensitive-skin myths vs facts",Cicalfate+,12800,640,,385000,,"Educational carousel debunking five sensitive-skin myths with simple illustrations.",
2026-11-14,Vichy,TikTok,France,Skincare,Video,"Minéral 89 texture close-up",Minéral 89,9800,210,184000,520000,,"Product-led ASMR-style texture video with no voice-over.",
2026-11-11,Bioderma,TikTok,UK,Skincare,Video,"The micellar double-cleanse hack",Sensibio H2O,21500,780,298000,690000,,"Creator shows a double-cleanse routine; comments ask about the right version for oily skin.",
2026-11-12,Eucerin,Instagram,Germany,Skincare,Reel,"Night routine with a dermatologist",Hyaluron-Filler,15200,420,176000,540000,,"Dermatologist-led night routine; calm tone, clear product order.",
2026-11-13,Vichy,Instagram,France,Haircare,Reel,"Autumn hair fall: what's normal?",Dercos Aminexil,11600,530,141000,610000,,"Short explainer on seasonal shedding with a product close at the end.",
2026-11-15,La Roche-Posay,YouTube,UK,Skincare,Video,"Dermatologist reacts: retinol mistakes",Retinol B3 Serum,8900,610,214000,310000,,"Reaction format to viral retinol routines; high comment volume with follow-up questions.",
2026-11-09,CeraVe,Instagram,UK,Skincare,Carousel,"Ceramides explained in five slides",Hydrating Cleanser,27300,540,,980000,,"Simple science carousel; minimalist design, strong saves.",
2026-11-14,Vichy,Instagram,France,Skincare,Carousel,"Skin changes during menopause",Neovadiol,7400,390,,610000,,"Educational carousel on menopause skin; comments ask for routine advice.",
2026-11-10,Bioderma,Instagram,Spain,Skincare,Reel,"Very dry winter skin, sorted",Atoderm,9100,260,98000,420000,,"Seasonal reel with a family angle.",
2026-11-12,Avène,TikTok,Italy,Skincare,Video,"Where our thermal water comes from",Thermal Spring Water,14800,330,221000,460000,,"Origin-story video filmed at the spring; strong brand storytelling.",
2026-11-11,Klorane,Instagram,France,Haircare,Reel,"A simple hair-loss routine",Quinine Serum,6900,240,72000,280000,,"Step-by-step routine for thinning hair with a pharmacist voice-over.",`,

keywords: `week,keyword,language,market,category,trends_score,change_vs_prev,vichy_share_pct
W47,menopause skincare,EN,UK,Skincare,78,34,9
W47,soin ménopause,FR,France,Skincare,64,28,12
W47,skin barrier,EN,UK,Skincare,85,12,6
W47,crème barrière cutanée,FR,France,Skincare,52,18,8
W47,chute de cheveux automne,FR,France,Haircare,71,41,22
W47,hair loss serum,EN,UK,Haircare,66,15,14
W47,niacinamide,EN,Germany,Skincare,74,5,4
W47,peptide serum,EN,UK,Skincare,69,26,3
W47,sérum anti-âge,FR,France,Skincare,58,-4,18
W47,winter dry skin,EN,UK,Skincare,81,38,5
W47,crema solare,IT,Italy,Skincare,22,-35,25`,

hashtags: `week,hashtag,platform,market,views_or_posts,growth_note,relevance_to_vichy
W47,#skinbarrier,TikTok,Europe,2.1B views,"Rising with winter routines",High
W47,#menopauseskincare,TikTok,UK,310M views,"Steady growth, creator-led education",High
W47,#chutedecheveux,TikTok,France,145M views,"Seasonal autumn spike",High
W47,#dermatologist,TikTok,Europe,9.4B views,"Dermatologist-led content keeps growing",High
W47,#skincareroutine,Instagram,Europe,58M posts,"Stable and very saturated",Medium
W47,#glassskin,TikTok,Europe,4.8B views,"Plateauing",Low`,

listening: `date,platform,market,language,brand,product,topic,sentiment,summary,link
2026-11-15,TikTok,France,FR,Vichy,Minéral 89,Texture,Positive,"Users like the lightweight gel texture under make-up.",
2026-11-15,Instagram,France,FR,Vichy,Dercos,Efficacy,Positive,"Before/after posts on Dercos get supportive comments from people with thinning hair.",
2026-11-14,Instagram,France,FR,Vichy,Minéral 89,Price,Negative,"Several comments say the price went up and question value against cheaper pharmacy options.",
2026-11-14,Reddit,UK,EN,Vichy,Neovadiol,Efficacy,Positive,"A thread recommends Neovadiol for menopause dryness; users report more comfort after a few weeks.",
2026-11-13,YouTube,France,FR,Vichy,Dercos,Efficacy,Positive,"A reviewer reports less hair fall after one month of use.",
2026-11-13,TikTok,UK,EN,Vichy,Dercos,Availability,Negative,"Users say Dercos is hard to find in UK high-street stores.",
2026-11-12,Instagram,France,FR,Vichy,Liftactiv,Packaging,Neutral,"People ask whether the new packaging means a new formula.",
2026-11-12,Reddit,UK,EN,Vichy,Capital Soleil,Texture,Positive,"Users praise the non-greasy finish for daily wear.",
2026-11-11,TikTok,France,FR,Vichy,Normaderm,Efficacy,Neutral,"Mixed results for adult acne; some mention an adjustment period.",
2026-11-11,Instagram,Germany,DE,Vichy,Minéral 89,Price,Negative,"Price-comparison posts favour cheaper hyaluronic serums.",
2026-11-10,YouTube,Spain,ES,Vichy,Liftactiv,Efficacy,Positive,"A creator review highlights visible firmness after regular use.",
2026-11-10,TikTok,France,FR,Vichy,Neovadiol,Awareness,Neutral,"Comments ask which Neovadiol product suits perimenopause.",
2026-11-09,Instagram,Italy,IT,Vichy,Capital Soleil,Seasonality,Neutral,"Low conversation volume — off-season for suncare.",
2026-11-09,Reddit,UK,EN,Vichy,Minéral 89,Sensitivity,Negative,"A few users report stinging on very sensitive skin.",`,

products: `week,product,category,mentions,mentions_prev,positive_pct,negative_pct,top_theme
W47,Minéral 89,Skincare,142,128,52,24,Price
W47,Dercos,Haircare,110,82,61,11,Autumn hair fall
W47,Neovadiol,Skincare,74,49,66,7,Menopause education
W47,Liftactiv,Skincare,68,71,64,9,Efficacy
W47,Normaderm,Skincare,39,42,48,15,Adult acne
W47,Capital Soleil,Skincare,22,35,59,6,Off-season`,

calendar: `date,moment,market,opportunity
2026-11-16,Autumn hair-fall peak,Europe,"Seasonal shedding content for Dercos while searches are high."
2026-11-27,Black Friday,Europe,"Bundle Minéral 89 with Liftactiv and answer price criticism with a clear value message."
2026-12-01,Christmas gifting,Europe,"Gift sets, plus a 'skincare for mum' angle for Neovadiol."
2026-12-26,Boxing Day sales,UK,"Watch competitor discounting at pharmacy retailers."
2027-01-04,New-year skin reset,Europe,"Barrier-repair education with Minéral 89 to ride #skinbarrier growth."
2027-03-01,Suncare pre-season,Europe,"Plan Capital Soleil creator seeding before April."`
};
