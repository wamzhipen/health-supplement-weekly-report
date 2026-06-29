#!/usr/bin/env node
/**
 * Playwright 数据采集器
 * 使用 Chromium 爬取 Amazon + eBay + 京东 真实数据
 * 
 * 沙箱验证用 — 本地部署时用你本机的 Chrome 效果更好
 */

const { chromium } = require('playwright');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

const CACHE_DIR = path.join(__dirname, '..', 'output', 'cache');

async function scrapeAmazon() {
  console.log('🛒 正在爬取 Amazon Best Sellers (保健品)...');
  const browser = await chromium.launch({ 
    headless: true,
    executablePath: '/usr/bin/chromium'
  });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    locale: 'en-US'
  });
  const page = await context.newPage();
  
  try {
    await page.goto('https://www.amazon.com/Best-Sellers-Health-Household/zgbs/hpc/3760901', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });
    
    // 等待产品列表加载
    await page.waitForSelector('.p13n-sc-truncate, .zg-item, [data-index]', { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(3000);
    
    const html = await page.content();
    const $ = cheerio.load(html);
    
    const products = [];
    
    // 提取产品信息
    $('.p13n-sc-uncoverable-faceout, .zg-item-immersion, [role="listitem"]').each((i, el) => {
      if (i >= 15) return false;
      
      const $el = $(el);
      const nameEl = $el.find('.p13n-sc-truncate, .p13n-sc-line-clamp-1, .zg-text-center-align .a-link-normal');
      const priceEl = $el.find('.p13n-sc-price, .a-price .a-offscreen, ._cDEzb_p13n-sc-price_3mJ9Z');
      const ratingEl = $el.find('.a-icon-alt, .a-icon-star-small');
      const reviewsEl = $el.find('.a-size-small, .a-link-normal .a-size-base');
      
      const name = nameEl.first().text().trim();
      const priceText = priceEl.first().text().trim().replace(/[^0-9.]/g, '');
      const ratingText = ratingEl.first().text().trim().match(/(\d+\.?\d*)/);
      const reviewsText = reviewsEl.first().text().trim().replace(/[^0-9]/g, '');
      
      if (name && name.length > 5) {
        products.push({
          rank: i + 1,
          name: name,
          price: parseFloat(priceText) || 0,
          rating: ratingText ? parseFloat(ratingText[1]) : 0,
          reviews: parseInt(reviewsText) || 0
        });
      }
    });
    
    console.log(`   ✅ 提取到 ${products.length} 个保健品`);
    fs.writeFileSync(path.join(CACHE_DIR, 'amazon_playwright.json'), JSON.stringify(products, null, 2));
    
    return products;
  } catch (e) {
    console.error(`   ❌ Amazon 爬取失败: ${e.message}`);
    return [];
  } finally {
    await browser.close();
  }
}

async function scrapeEBay() {
  console.log('🛒 正在爬取 eBay 保健品畅销榜...');
  const browser = await chromium.launch({ 
    headless: true,
    executablePath: '/usr/bin/chromium'
  });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    locale: 'en-US'
  });
  const page = await context.newPage();
  
  try {
    await page.goto('https://www.ebay.com/sch/i.html?_nkw=dietary+supplements&_sop=12', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });
    
    await page.waitForSelector('.s-item, .srp-results li', { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(3000);
    
    const html = await page.content();
    const $ = cheerio.load(html);
    
    const products = [];
    $('.s-item').each((i, el) => {
      if (i >= 10) return false;
      const $el = $(el);
      const name = $el.find('.s-item__title').text().trim();
      const price = $el.find('.s-item__price').text().trim();
      const sold = $el.find('.s-item__quantitySold, .s-item__hotness').text().trim();
      
      if (name && !name.includes('Shop on eBay') && name.length > 3) {
        products.push({ rank: i + 1, name, price, sold });
      }
    });
    
    console.log(`   ✅ 提取到 ${products.length} 个 eBay 商品`);
    fs.writeFileSync(path.join(CACHE_DIR, 'ebay_playwright.json'), JSON.stringify(products, null, 2));
    
    return products;
  } catch (e) {
    console.error(`   ❌ eBay 爬取失败: ${e.message}`);
    return [];
  } finally {
    await browser.close();
  }
}

// 主流程
(async () => {
  console.log('🔧 Playwright 数据采集器启动\n');
  
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
  
  const amazonProducts = await scrapeAmazon();
  const ebayProducts = await scrapeEBay();
  
  console.log('\n📊 采集汇总:');
  console.log(`   Amazon: ${amazonProducts.length} 个保健品`);
  console.log(`   eBay:   ${ebayProducts.length} 个商品`);
  console.log(`\n📂 缓存目录: ${CACHE_DIR}`);
})();
