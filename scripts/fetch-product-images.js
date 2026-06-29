const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// 报告中涉及的主要产品 — 用于提取图片
const products = [
  // Amazon 销量榜 TOP 10
  { id: "liquid-iv-firecracker", name: "Liquid I.V. Hydration Multiplier Popsicle Firecracker", brand: "Liquid I.V.", search: "Liquid+I.V.+Hydration+Multiplier+Popsicle+Firecracker" },
  { id: "liquid-iv-sugarfree", name: "Liquid I.V. Sugar-Free Lemon Lime", brand: "Liquid I.V.", search: "Liquid+I.V.+Sugar+Free+Lemon+Lime" },
  { id: "on-creatine", name: "Optimum Nutrition Micronized Creatine Monohydrate", brand: "Optimum Nutrition", search: "Optimum+Nutrition+Micronized+Creatine+Monohydrate+Powder" },
  { id: "nutricost-creatine", name: "Nutricost Creatine Monohydrate 500G", brand: "Nutricost", search: "Nutricost+Creatine+Monohydrate+500G" },
  { id: "ultima-electrolyte", name: "Ultima Replenisher Electrolyte Powder", brand: "Ultima Replenisher", search: "Ultima+Replenisher+Electrolyte+Powder+Variety" },
  { id: "ensure-max-protein", name: "Ensure Max Protein Milk Chocolate", brand: "Ensure", search: "Ensure+Max+Protein+Shake+Chocolate" },
  { id: "pure-protein-bars", name: "Pure Protein Chocolate Peanut Butter Bars", brand: "Pure Protein", search: "Pure+Protein+Chocolate+Peanut+Butter+Bars" },
  { id: "lmnt-electrolyte", name: "LMNT Zero Sugar Electrolytes Watermelon", brand: "LMNT", search: "LMNT+Zero+Sugar+Electrolytes+Watermelon" },
  { id: "quest-bars", name: "Quest Nutrition Protein Bars Variety", brand: "Quest Nutrition", search: "Quest+Nutrition+Protein+Bars+Variety+Pack" },
  { id: "on-whey", name: "Optimum Nutrition Gold Standard Whey", brand: "Optimum Nutrition", search: "Optimum+Nutrition+Gold+Standard+Whey+Protein" },
  // 热门品牌
  { id: "bloom-greens", name: "Bloom Nutrition Greens Superfoods", brand: "Bloom Nutrition", search: "Bloom+Nutrition+Greens+Superfoods+Powder" },
  { id: "goli-ashwagandha", name: "Goli Ashwagandha Gummies", brand: "Goli Nutrition", search: "Goli+Ashwagandha+Gummies" },
  { id: "maryruth-multivitamin", name: "MaryRuth's Liquid Multivitamin", brand: "MaryRuth Organics", search: "MaryRuth+Liquid+Multivitamin" },
  { id: "vital-proteins-collagen", name: "Vital Proteins Collagen Peptides", brand: "Vital Proteins", search: "Vital+Proteins+Collagen+Peptides" },
  { id: "thorne-berberine", name: "Thorne Berberine 500mg", brand: "Thorne Research", search: "Thorne+Berberine+500mg" },
  // iHerb TOP 品牌
  { id: "doctors-best-magnesium", name: "Doctor's Best Magnesium Glycinate", brand: "Doctor's Best", search: "Doctors+Best+Magnesium+Glycinate+240" },
  { id: "now-magnesium", name: "NOW Foods Magnesium Glycinate", brand: "NOW Foods", search: "NOW+Foods+Magnesium+Glycinate+180" },
  { id: "cgn-omega", name: "California Gold Nutrition Omega 800", brand: "California Gold Nutrition", search: "California+Gold+Nutrition+Omega+800+Fish+Oil" },
  { id: "cgn-vitamin-d", name: "California Gold Nutrition Vitamin D3 K2", brand: "California Gold Nutrition", search: "California+Gold+Nutrition+Vitamin+D3+K2" },
  { id: "cgn-collagen", name: "California Gold Nutrition CollagenUP", brand: "California Gold Nutrition", search: "California+Gold+Nutrition+CollagenUP+Marine" },
];

(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1200, height: 800 });

  const imageMap = {}; // id -> imageUrl

  for (const p of products) {
    console.log(`🔍 ${p.id}...`);
    try {
      await page.goto(`https://www.amazon.com/s?k=${p.search}`, { 
        waitUntil: 'domcontentloaded', timeout: 15000 
      });
      await page.waitForTimeout(1500);
      
      const imgs = await page.evaluate(() => {
        const result = [];
        document.querySelectorAll('img[src*="media-amazon.com/images/I/"]').forEach(img => {
          if (img.naturalWidth > 100 && img.naturalHeight > 100) {
            // 提取干净的图片ID，替换为高清尺寸
            const baseUrl = img.src.split('._')[0];
            result.push(baseUrl + '._AC_SL500_.jpg');
          }
        });
        return result.slice(0, 1); // 只要第一张
      });
      
      if (imgs.length > 0) {
        imageMap[p.id] = imgs[0];
        console.log(`  ✅ ${imgs[0].substring(0, 80)}...`);
      } else {
        console.log(`  ⚠️ 未找到图片`);
      }
    } catch(e) {
      console.log(`  ❌ ${e.message}`);
    }
  }

  await browser.close();

  // 保存结果
  const outPath = path.join(__dirname, '..', 'output', 'product-images.json');
  fs.writeFileSync(outPath, JSON.stringify(imageMap, null, 2));
  console.log(`\n✅ 已保存 ${Object.keys(imageMap).length}/${products.length} 张产品图片 -> ${outPath}`);
})().catch(e => { console.error('Error:', e.message); process.exit(1); });
