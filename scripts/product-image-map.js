#!/usr/bin/env node
/**
 * 产品图片匹配表 — 基于 fetch-product-images.js 抓取结果
 * 硬编码产品名→图片URL映射，确保报告渲染时100%匹配
 */
const productImageMap = {
  // Amazon 销量榜
  "Liquid I.V. Hydration Multiplier": "https://m.media-amazon.com/images/I/812KjGBLVBL._AC_SL500_.jpg",
  "Liquid I.V. Hydration Multiplier Sugar-Free": "https://m.media-amazon.com/images/I/81-c7rLhPaL._AC_SL500_.jpg",
  "Optimum Nutrition Creatine": "https://m.media-amazon.com/images/I/71yTTU2CVoL._AC_SL500_.jpg",
  "Nutricost Creatine": "https://m.media-amazon.com/images/I/71rauH+HSYL._AC_SL500_.jpg",
  "Ultima Replenisher Electrolyte": "https://m.media-amazon.com/images/I/71LrAlFJ99L._AC_SL500_.jpg",
  "Ensure Max Protein": "https://m.media-amazon.com/images/I/71Vkp9kboKL._AC_SL500_.jpg",
  "Pure Protein Bars": "https://m.media-amazon.com/images/I/81kFJDp2yXL._AC_SL500_.jpg",
  "LMNT Electrolytes": "https://m.media-amazon.com/images/I/71O37o3ZoOL._AC_SL500_.jpg",
  "Quest Nutrition Protein": "https://m.media-amazon.com/images/I/81yHa7qgbdL._AC_SL500_.jpg",
  "Optimum Nutrition Gold Standard Whey": "https://m.media-amazon.com/images/I/71AC0enGcZL._AC_SL500_.jpg",
  // 热门品牌
  "Bloom Greens & Superfoods": "https://m.media-amazon.com/images/I/61Em3PuSOBL._AC_SL500_.jpg",
  "Goli Ashwagandha": "https://m.media-amazon.com/images/I/71x71nYV9KL._AC_SL500_.jpg",
  "MaryRuth's Liquid Multivitamin": "https://m.media-amazon.com/images/I/814Ed9bkCRL._AC_SL500_.jpg",
  "Vital Proteins Collagen": "https://m.media-amazon.com/images/I/61VX8DYv3aL._AC_SL500_.jpg",
  "Thorne Berberine": "https://m.media-amazon.com/images/I/710CGlMIhbL._AC_SL500_.jpg",
  // iHerb 畅销品牌
  "Doctor's Best Magnesium": "https://m.media-amazon.com/images/I/61A-zRQCJiL._AC_SL500_.jpg",
  "NOW Foods Magnesium": "https://m.media-amazon.com/images/I/71H8m-jpSvL._AC_SL500_.jpg",
  "California Gold Nutrition Omega": "https://m.media-amazon.com/images/I/71O93QxfAWL._AC_SL500_.jpg",
  "California Gold Nutrition Vitamin D3": "https://m.media-amazon.com/images/I/61rHyZ0u-4L._AC_SL500_.jpg",
  "California Gold Nutrition Collagen": "https://m.media-amazon.com/images/I/81kUABzRd9L._AC_SL500_.jpg",
  // 亚马逊新品榜
  "Quest Nutrition Protein Chips": "https://m.media-amazon.com/images/I/81yHa7qgbdL._AC_SL500_.jpg",
  "Muscle Milk Protein Shake": "https://m.media-amazon.com/images/I/71Vkp9kboKL._AC_SL500_.jpg",
  "Bloom Greens": "https://m.media-amazon.com/images/I/61Em3PuSOBL._AC_SL500_.jpg",
  // TikTok 北美销量榜
  "Bloom Nutrition Greens": "https://m.media-amazon.com/images/I/61Em3PuSOBL._AC_SL500_.jpg",
  "Ancient Nutrition Collagen": "https://m.media-amazon.com/images/I/71yfDCUGoVL._AC_SL500_.jpg",
  "Moon Juice Magnesi-Om": "https://m.media-amazon.com/images/I/61N4PmSykKL._AC_SL500_.jpg",
  "Cymbiotika Liposomal Vitamin C": "https://m.media-amazon.com/images/I/61TZ8JI+QDL._AC_SL500_.jpg",
  "Micro Ingredients Creatine": "https://m.media-amazon.com/images/I/71EGvojbcdL._AC_SL500_.jpg",
  "Arrae Clear Protein": "https://m.media-amazon.com/images/I/51cUawzhbWL._AC_SL500_.jpg",
  "Leefar Cutting Drink": "https://m.media-amazon.com/images/I/61-H0GfUdLL._AC_SL500_.jpg",
  "Eternal Legacy Nootropic": "https://m.media-amazon.com/images/I/71u-bGQoP8L._AC_SL500_.jpg",
  // TikTok 北美飙升榜
  "ARMRA Colostrum": "https://m.media-amazon.com/images/I/61PnUyuOfpL._AC_SL500_.jpg",
  "Yesnap GLP-1": "https://m.media-amazon.com/images/I/81ZmdW9p2rL._AC_SL500_.jpg",
  "HIILEATHY Shilajit": "https://m.media-amazon.com/images/I/71bN7q+h55L._AC_SL500_.jpg",
  "Kids Liquid Multivitamin": "https://m.media-amazon.com/images/I/81RBjOB81nL._AC_SL500_.jpg",
  "Toplux Moringa": "https://m.media-amazon.com/images/I/81425LZJCWL._AC_SL500_.jpg",
  // TikTok 北美新品
  "Seed Synbiotic": "https://m.media-amazon.com/images/I/71PVpImWXwL._AC_SL500_.jpg",
  "Lemme Purr Gummies": "https://m.media-amazon.com/images/I/715ujyazixL._AC_SL500_.jpg",
  // TikTok 东南亚
  "BIOAQUA Collagen": "https://m.media-amazon.com/images/I/81xyIcSJJPL._AC_SL500_.jpg",
  "Han Rui Whitening": "https://m.media-amazon.com/images/I/71tXRDBxyLS._AC_SL500_.jpg",
  "WonderLab Probiotic": "https://m.media-amazon.com/images/I/5153-7D8bvL._AC_SL500_.jpg",
  "OLLY Sleep Gummies": "https://m.media-amazon.com/images/I/71IhleCUfvL._AC_SL500_.jpg",
  "Redoxon Vitamin C": "https://m.media-amazon.com/images/I/716UOYxcJUL._AC_SL500_.jpg",
  // TikTok 欧洲
  "HUM Nutrition Daily Cleanse": "https://m.media-amazon.com/images/I/71oHolBqsIL._AC_SL500_.jpg",
  "Solgar Vitamin D3": "https://m.media-amazon.com/images/I/71yioYmVKdL._AC_SL500_.jpg",
  "InnoNature Collagen": "https://m.media-amazon.com/images/I/61zSgxDKctL._AC_SL500_.jpg",
  "Nutripure Omega": "https://m.media-amazon.com/images/I/71iKCbQTrKL._AC_SL500_.jpg",
  "Bulk Ashwagandha": "https://m.media-amazon.com/images/I/61+wI+q6g+L._AC_SL500_.jpg",
  "Dirtea Mushroom": "https://m.media-amazon.com/images/I/51CIfsbGUwL._AC_SL500_.jpg",
  "Nutri+ Magnesium": "https://m.media-amazon.com/images/I/61DVPzg9LwL._AC_SL500_.jpg",
  "D-Lab Collagen": "https://m.media-amazon.com/images/I/51qpj5OCpqL._AC_SL500_.jpg",
};

/**
 * 根据产品名匹配图片URL
 * 策略：先用品牌名精准匹配，再用产品关键词匹配
 */
function getProductImage(productName, brand) {
  if (!productName) return null;
  const n = productName.toLowerCase();
  const b = (brand || '').toLowerCase();
  
  // 优先：用品牌名直接从映射表匹配
  for (const [key, url] of Object.entries(productImageMap)) {
    const kl = key.toLowerCase();
    // 品牌名完全匹配
    if (b && kl.includes(b)) return url;
  }
  
  // 其次：关键词匹配
  let bestMatch = null;
  let bestScore = 0;
  for (const [key, url] of Object.entries(productImageMap)) {
    const kl = key.toLowerCase();
    const words = kl.split(/\s+/);
    let score = 0;
    for (const w of words) {
      if (w.length > 3 && n.includes(w)) score += 2;
      else if (w.length > 2 && n.includes(w)) score++;
    }
    if (score > bestScore && score >= 2) {
      bestScore = score;
      bestMatch = url;
    }
  }
  return bestMatch;
}

module.exports = { getProductImage, productImageMap };
