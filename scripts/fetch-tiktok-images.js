const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// TikTok Shop 报告中涉及的产品 — 通过 Amazon 搜索页抓取图片
const products = [
  // 北美 TikTok 销量榜
  { id: "bloom-greens-powder", name: "Bloom Nutrition Greens & Superfoods Powder", search: "Bloom+Nutrition+Greens+Superfoods+Powder" },
  { id: "maryruth-multivitamin", name: "MaryRuth Organics Liquid Multivitamin", search: "MaryRuth+Liquid+Multivitamin" },
  { id: "ancient-nutrition-collagen", name: "Ancient Nutrition Collagen Powder", search: "Ancient+Nutrition+Collagen+Powder" },
  { id: "moon-juice-magnesiom", name: "Moon Juice Magnesi-Om", search: "Moon+Juice+Magnesi+Om" },
  { id: "cymbiotika-liposomal-c", name: "Cymbiotika Liposomal Vitamin C", search: "Cymbiotika+Liposomal+Vitamin+C" },
  { id: "micro-ingredients-creatine", name: "Micro Ingredients Creatine Monohydrate", search: "Micro+Ingredients+Creatine+Monohydrate" },
  { id: "arrae-clear-protein", name: "Arrae Clear Protein+", search: "Arrae+Clear+Protein" },
  { id: "leefar-cutting-drink", name: "Leefar Cutting Drink Mix", search: "Leefar+Cutting+Drink+Mix" },
  { id: "eternal-legacy-nootropic", name: "Eternal Legacy Elite Nootropic Pre-Workout", search: "Eternal+Legacy+Nootropic+Pre+Workout" },
  // 北美飙升
  { id: "armra-colostrum", name: "ARMRA Colostrum Immune Revival", search: "ARMRA+Colostrum+Immune+Revival" },
  { id: "yesnap-glp1", name: "Yesnap MOCKTALE-1 GLP-1 Support", search: "Yesnap+MOCKTALE+GLP1" },
  { id: "hiileathy-shilajit", name: "HIILEATHY Shilajit Pro Max", search: "HIILEATHY+Shilajit+Pro+Max" },
  { id: "kids-liquid-multivitamin", name: "Kids Liquid AM & PM Multivitamin", search: "Kids+Liquid+AM+PM+Multivitamin" },
  { id: "toplux-moringa", name: "Toplux Moringa Capsules", search: "Toplux+Moringa+Capsules" },
  // 北美新品
  { id: "seed-synbiotic", name: "Seed DS-01 Daily Synbiotic 2.0", search: "Seed+DS01+Daily+Synbiotic" },
  { id: "lemme-purr-gummies", name: "Kourtney x Lemme Purr Gummies", search: "Lemme+Purr+Gummies" },
  // 东南亚 TikTok
  { id: "bioaqua-collagen", name: "BIOAQUA Collagen Peptide Powder", search: "BIOAQUA+Collagen+Peptide+Powder" },
  { id: "hanrui-whitening", name: "Han Rui Whitening Pills", search: "Han+Rui+Whitening+Pills" },
  { id: "wonderlab-probiotic", name: "WonderLab Probiotic Drink", search: "WonderLab+Probiotic+Solid+Drink" },
  { id: "olly-sleep-gummies", name: "OLLY Sleep Gummies", search: "OLLY+Sleep+Gummies" },
  { id: "redoxon-vitaminc", name: "Redoxon Vitamin C Effervescent", search: "Redoxon+Vitamin+C+Effervescent" },
  // 欧洲 TikTok
  { id: "hum-daily-cleanse", name: "HUM Nutrition Daily Cleanse", search: "HUM+Nutrition+Daily+Cleanse" },
  { id: "solgar-vitamin-d3", name: "Solgar Vitamin D3 4000IU", search: "Solgar+Vitamin+D3+4000IU" },
  { id: "innonature-collagen", name: "InnoNature Beauty Collagen", search: "InnoNature+Beauty+Collagen" },
  { id: "nutripure-omega3", name: "Nutripure Omega 3 Vega", search: "Nutripure+Omega+3+Vega" },
  { id: "bulk-ashwagandha", name: "Bulk Ashwagandha KSM-66", search: "Bulk+Ashwagandha+KSM66" },
  // 欧洲飙升
  { id: "dirtea-mushroom", name: "Dirtea Adaptogenic Mushroom Complex", search: "Dirtea+Adaptogenic+Mushroom+Complex" },
  { id: "nutriplus-magnesium", name: "Nutri+ Magnesium Bisglycinate", search: "Nutri+Magnesium+Bisglycinate" },
  { id: "dlab-collagen", name: "D-Lab Collagène Marin Hydrolysé", search: "D+Lab+Collagene+Marin+Hydrolyse" },
];

(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1200, height: 800 });

  // 先加载已有图片
  const existingPath = path.join(__dirname, '..', 'output', 'product-images.json');
  let imageMap = {};
  try { imageMap = JSON.parse(fs.readFileSync(existingPath, 'utf-8')); } catch(e) {}

  for (const p of products) {
    if (imageMap[p.id]) { console.log(`⏭️ ${p.id} (已有)`); continue; }
    console.log(`🔍 ${p.id}...`);
    try {
      await page.goto(`https://www.amazon.com/s?k=${p.search}`, { 
        waitUntil: 'domcontentloaded', timeout: 15000 
      });
      await page.waitForTimeout(1200);
      
      const imgs = await page.evaluate(() => {
        const result = [];
        document.querySelectorAll('img[src*="media-amazon.com/images/I/"]').forEach(img => {
          if (img.naturalWidth > 100 && img.naturalHeight > 100) {
            result.push(img.src.split('._')[0] + '._AC_SL500_.jpg');
          }
        });
        return result.slice(0, 1);
      });
      
      if (imgs.length > 0) {
        imageMap[p.id] = imgs[0];
        console.log(`  ✅ ${imgs[0].substring(0, 70)}...`);
      } else {
        console.log(`  ⚠️ 未找到`);
      }
    } catch(e) {
      console.log(`  ❌ ${e.message}`);
    }
  }

  await browser.close();
  fs.writeFileSync(existingPath, JSON.stringify(imageMap, null, 2));
  console.log(`\n✅ 总计: ${Object.keys(imageMap).length} 张图片 -> ${existingPath}`);
})().catch(e => { console.error('Error:', e.message); process.exit(1); });
