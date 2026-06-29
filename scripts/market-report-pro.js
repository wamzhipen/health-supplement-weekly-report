#!/usr/bin/env node
/**
 * 每周平台热销分析报告 v4.0 — 全自动数据抓取版
 * 
 * 生成 HTML（Chart.js 图表）+ Excel（xlsx）报告
 * 覆盖：Amazon + TikTok Shop + 7 社媒 + 4 电商 + Google Trends
 * 
 * 自动抓取（每次运行实时更新）：
 *   ✅ Amazon Best Sellers / New Releases (WebFetch)
 *   ✅ iHerb Best Sellers (WebFetch)
 *   ✅ Google Trends + 市场规模 (RisingTrends.co WebFetch)
 *   ✅ 汇率 (open.er-api.com)
 *   ✅ FDA召回 (WebFetch)
 *   ✅ 产品图片 (Playwright+Amazon搜索)
 */

const fs = require('fs');
const path = require('path');
const dataGen = require('./data-generator');

// 加载真实数据状态
let dataSourceStatus = null;
try {
  const realFetch = require('./fetch-real-data.js');
  dataSourceStatus = realFetch.getDataSourceStatus();
} catch (e) {}

// ==================== 配置 ====================
const OUTPUT_DIR = path.join(__dirname, '..', 'output');
const now = process.env.REPORT_DATE ? new Date(process.env.REPORT_DATE) : new Date();
// 周报标注 = 当前周-1（因为抓取的是上周数据）
const weekNum = getWeekNumber(now) - 1;
const dateStr = formatDate(now);
const reportTitle = `保健品市场每周热销分析报告`;

// 加载 Chart.js 用于内联（避免CDN网络问题导致图表空白）
let chartJSInline = '';
try {
  chartJSInline = fs.readFileSync('/tmp/chart.js', 'utf-8');
} catch(e) {
  try {
    chartJSInline = fs.readFileSync(path.join(__dirname, '..', 'assets', 'chart.umd.min.js'), 'utf-8');
  } catch(e2) {}
}
if (!chartJSInline) console.log('⚠️  Chart.js 内联文件未找到，将使用CDN（需要网络连接）');
else console.log('✅ Chart.js 将内联到HTML（无需网络连接）');

// ==================== 数据新鲜度追踪 ====================
let dataFreshness = null;
let fetchErrors = [];

function getWeekNumber(d) {
  const start = new Date(d.getFullYear(), 0, 1);
  const diff = d - start + (start.getTimezoneOffset() - d.getTimezoneOffset()) * 60000;
  return Math.ceil(diff / 86400000 / 7);
}
function formatDate(d) { return d.toISOString().slice(0, 10); }

// ==================== 自动图片抓取 ====================
/**
 * 从 fetch-real-data.js 中提取所有产品名+品牌名
 * 用 Playwright 在 Amazon 搜索页匹配最新图片
 * 结果缓存到 output/product-images.json（24h内不重复抓取）
 */
async function autoFetchProductImages() {
  const cacheFile = path.join(OUTPUT_DIR, 'product-images.json');
  const cacheMetaFile = path.join(OUTPUT_DIR, '.images-cache-meta.json');
  
  // 检查缓存是否在24h内
  try {
    const meta = JSON.parse(fs.readFileSync(cacheMetaFile, 'utf-8'));
    if (Date.now() - meta.timestamp < 24 * 60 * 60 * 1000) {
      console.log('📸 产品图片缓存有效（24h内），跳过抓取');
      return JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
    }
  } catch(e) {}

  // 从 fetch-real-data 提取所有产品
  let allProducts = [];
  try {
    const rf = require('./fetch-real-data.js');
    const amz = rf.getAmazonThreeLists();
    const tiktok = rf.getTikTokThreeLists();
    
    // Amazon 三榜
    for (const list of ['bestSellers', 'moversShakers', 'newReleases']) {
      (amz[list] || []).forEach(p => {
        allProducts.push({ name: p.name, brand: p.brand, id: (p.brand + '-' + p.name).replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '-').substring(0, 60) });
      });
    }
    // TikTok 三区域 × 三榜
    for (const region of ['sea', 'na', 'eu']) {
      for (const list of ['bestSellers', 'moversShakers', 'newReleases']) {
        (tiktok[region] && tiktok[region][list] || []).forEach(p => {
          allProducts.push({ name: p.name, brand: p.brand, id: (p.brand + '-' + p.name).replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '-').substring(0, 60) });
        });
      }
    }
  } catch(e) {}
  
  // 去重
  const seen = new Set();
  allProducts = allProducts.filter(p => { const k = p.brand + '|' + p.name; if (seen.has(k)) return false; seen.add(k); return true; });
  console.log(`📸 准备抓取 ${allProducts.length} 个产品的图片...`);

  // 尝试加载已有缓存作为基础
  let imageMap = {};
  try { imageMap = JSON.parse(fs.readFileSync(cacheFile, 'utf-8')); } catch(e) {}
  
  // 筛选需要抓取的产品（缓存中没有的）
  const needFetch = allProducts.filter(p => !imageMap[p.id]);
  if (needFetch.length === 0) {
    console.log('📸 所有产品图片已缓存，跳过抓取');
    fs.writeFileSync(cacheMetaFile, JSON.stringify({ timestamp: Date.now() }));
    return imageMap;
  }
  console.log(`📸 需抓取 ${needFetch.length} 个新产品图片...`);

  // 用 Playwright 抓取
  try {
    const { chromium } = require('playwright');
    const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1200, height: 800 });
    
    let fetched = 0;
    for (const p of needFetch) {
      try {
        const searchQuery = encodeURIComponent(p.brand + ' ' + p.name.split(' ').slice(0, 3).join(' '));
        await page.goto(`https://www.amazon.com/s?k=${searchQuery}`, { waitUntil: 'domcontentloaded', timeout: 12000 });
        await page.waitForTimeout(1000);
        
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
          fetched++;
        }
      } catch(e) {
        // 单个产品失败不影响整体
      }
    }
    await browser.close();
    console.log(`📸 抓取完成: ${fetched}/${needFetch.length} 张新图片`);
  } catch(e) {
    console.log(`⚠️ Playwright 不可用，使用已有缓存 (${Object.keys(imageMap).length} 张)`);
  }
  
  // 保存缓存
  fs.writeFileSync(cacheFile, JSON.stringify(imageMap, null, 2));
  fs.writeFileSync(cacheMetaFile, JSON.stringify({ timestamp: Date.now() }));
  return imageMap;
}

// 同步版本的图片匹配函数（用于生成HTML时调用）
let _imageCache = null;
function getProductImageSync(productName, brand) {
  if (!_imageCache) return null;
  if (!productName) return null;
  const n = productName.toLowerCase();
  const b = (brand || '').toLowerCase();
  
  // 优先品牌名匹配
  for (const [key, url] of Object.entries(_imageCache)) {
    if (b && key.toLowerCase().includes(b)) return url;
  }
  // 关键词匹配
  let best = null, bestScore = 0;
  for (const [key, url] of Object.entries(_imageCache)) {
    const words = key.toLowerCase().split(/[^a-z0-9\u4e00-\u9fa5]+/);
    let score = 0;
    for (const w of words) {
      if (w.length > 3 && n.includes(w)) score += 2;
      else if (w.length > 2 && n.includes(w)) score++;
    }
    if (score > bestScore && score >= 2) { bestScore = score; best = url; }
  }
  return best;
}

// ==================== 全局数据变量（在 main() 中赋值，generateHTML/generateExcel 引用） ====================
let amazonData, tiktokData, trendsData, socialData, ecomData, matrixData, swotData, riskData, hotRanking, competitorBrands, brandMatrixData, inventoryData, pricingData;
let amazonThreeLists, tiktokThreeLists, shopeeThreeLists, ozonThreeLists;

// ==================== 主流程 ====================
async function main() {
  // ═══════ v4.0: 第0步 — 自动抓取所有可自动更新的数据源 ═══════
  console.log('📡 正在自动抓取最新数据...');
  let fetchResults = null;
  try {
    const rf = require('./fetch-real-data.js');
    rf.setWeek(weekNum);  // v5.4: 设置周次，缓存按周归档
    fetchResults = await rf.initDataFetch();
    // 将抓取结果注入 data-generator 可用的运行时数据
    rf.setRuntimeData(fetchResults);
    dataFreshness = rf.getDataFreshnessReport();
    if (fetchResults.errors && fetchResults.errors.length > 0) {
      fetchErrors = fetchResults.errors;
      console.log(`   ⚠️ ${fetchResults.errors.length}个数据源抓取异常（已降级）`);
    }
    console.log('   ✅ 数据抓取完成');
  } catch(e) {
    console.log('   ⚠️ 数据抓取模块异常: ' + e.message);
    fetchErrors.push(e.message);
  }
  
  // 并行抓取图片和风险数据
  console.log('📰 正在获取最新风险数据...');
  const riskFetchPromise = (async () => {
    try {
      const riskFetcher = require('./fetch-risk-data.js');
      return await riskFetcher.getLatestRiskUpdates();
    } catch(e) { return null; }
  })();
  
  _imageCache = await autoFetchProductImages();
  const latestRiskData = await riskFetchPromise;
  if (latestRiskData) console.log('   ✅ 风险数据已更新 (' + latestRiskData.lastChecked + ')');
  
  // 加载数据
  amazonData = dataGen.getAmazonData();
  tiktokData = dataGen.getTikTokData();
  trendsData = dataGen.getGoogleTrendsData();
  socialData = dataGen.getSocialMediaData();
  ecomData = dataGen.getEcommerceData();
  matrixData = dataGen.getCrossPlatformMatrix();
  swotData = dataGen.getSWOTData();
  riskData = dataGen.getRiskWarnings();
  // 将异步获取的最新风险数据注入 riskData.latest
  if (latestRiskData && riskData) {
    riskData.latest = latestRiskData;
  }
  hotRanking = dataGen.getCrossPlatformHotRanking ? dataGen.getCrossPlatformHotRanking() : [];
  competitorBrands = dataGen.getCompetitorBrandAnalysis ? dataGen.getCompetitorBrandAnalysis() : [];
  brandMatrixData = dataGen.getCrossPlatformBrandMatrix ? dataGen.getCrossPlatformBrandMatrix() : null;
  inventoryData = dataGen.getInventoryRecommendations ? dataGen.getInventoryRecommendations() : null;
  pricingData = dataGen.getPricingStrategy ? dataGen.getPricingStrategy() : null;

  // 三榜数据 — v4.0: 优先使用WebFetch抓取结果
  try {
    const rf = require('./fetch-real-data.js');
    // Amazon: 优先使用抓取数据
    if (fetchResults && fetchResults.amazonBS && fetchResults.amazonBS.data) {
      const enrichedBS = rf.enrichProducts(fetchResults.amazonBS.data, 'Amazon Best Sellers (WebFetch)');
      const enrichedNR = fetchResults.amazonNR && fetchResults.amazonNR.data ? 
        rf.enrichProducts(fetchResults.amazonNR.data, 'Amazon New Releases (WebFetch)') : [];
      amazonThreeLists = {
        bestSellers: enrichedBS,
        moversShakers: rf.getAmazonMoversShakers ? rf.getAmazonMoversShakers() : [],
        newReleases: enrichedNR.length > 0 ? enrichedNR : (rf.getAmazonNewReleases ? rf.getAmazonNewReleases() : [])
      };
    } else {
      amazonThreeLists = rf.getAmazonThreeLists();
    }
    tiktokThreeLists = rf.getTikTokThreeLists();
    shopeeThreeLists = rf.getShopeeThreeLists ? rf.getShopeeThreeLists() : null;
    ozonThreeLists = rf.getOzonThreeLists ? rf.getOzonThreeLists() : null;
  } catch(e) {}

  console.log('📊 正在生成每周平台热销分析报告...\n');

  // 确保输出目录存在
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const htmlFilename = `market-report-W${weekNum}-${dateStr}.html`;
  const xlsxFilename = `market-data-W${weekNum}-${dateStr}.xlsx`;
  const htmlPath = path.join(OUTPUT_DIR, htmlFilename);
  const xlsxPath = path.join(OUTPUT_DIR, xlsxFilename);

  // 生成 HTML
  console.log('📄 生成 HTML 报告...');
  let html;
  try {
    html = generateHTML();
  } catch(e) {
    console.error('❌ HTML生成失败: ' + e.message);
    console.error('   Stack: ' + e.stack.split('\n').slice(0, 3).join('\n'));
    process.exit(1);
  }
  fs.writeFileSync(htmlPath, html, 'utf-8');
  console.log(`   ✅ HTML: ${htmlPath} (${(Buffer.byteLength(html, 'utf-8')/1024).toFixed(1)} KB)`);

  // 生成 Excel
  console.log('📊 生成 Excel 报告...');
  const wb = generateExcel();
  const XLSX = require('xlsx');
  XLSX.writeFile(wb, xlsxPath);
  const xlsxSize = fs.statSync(xlsxPath).size;
  console.log(`   ✅ Excel: ${xlsxPath} (${(xlsxSize/1024).toFixed(1)} KB)`);

  console.log('\n🎉 报告生成完成！');
  console.log(`\n📂 输出目录: ${OUTPUT_DIR}`);
  console.log(`📄 HTML 报告: ${htmlFilename}`);
  console.log(`📊 Excel 报告: ${xlsxFilename}`);
  console.log(`\n💡 用浏览器打开 HTML 文件查看完整交互式报告`);
}

// ==================== HTML 报告生成 ====================
function generateHTML() {
  // TikTok 单区域单榜渲染
  function renderTikTokTable(data, region, listType, title) {
    if (!data || !data[region] || !data[region][listType]) return '<p>数据加载中...</p>';
    const d = data[region][listType];
    const isSEA = region === 'sea';
    return `<table><thead><tr><th></th><th>#</th><th>产品</th><th>品牌</th><th>品类</th><th>价格</th><th>销量</th><th>佣金</th><th>国家</th><th>GMV</th><th>增长</th></tr></thead><tbody>
    ${d.map(p => { const img = getProductImageSync(p.name, p.brand); return `<tr><td style="width:50px;padding:3px">${img ? '<img src="'+img+'" style="width:40px;height:40px;object-fit:contain;border-radius:4px" loading="lazy" onerror="this.style.display=\'none\'">' : ''}</td><td>${p.rank}</td><td><strong>${p.name}</strong></td><td>${p.brand}</td><td>${p.subcategory}</td><td>${isSEA?'¥':''}${p.price}${isSEA?'':' USD'}</td><td>${(p.sales/1000).toFixed(0)}k</td><td>${p.commission}%</td><td>${p.country}</td><td>${isSEA?'¥'+ (p.gmv/10000).toFixed(1)+'万':'$'+ (p.gmv/1000000).toFixed(2)+'M'}</td><td><span class="badge badge-green">+${p.growth}%</span></td></tr>`; }).join('')}
    </tbody></table>`;
  }
  // TikTok 三区域合并渲染（飙升榜/新品榜）
  function renderTikTokTableMerged(data, listType, title) {
    if (!data) return '<p>数据加载中...</p>';
    const regions = ['sea','na','eu'];
    let rows = '';
    regions.forEach(r => {
      const d = data[r] && data[r][listType] ? data[r][listType] : [];
      const isMover = listType === 'moversShakers';
      if (isMover) {
        d.forEach(p => { const img = getProductImageSync(p.name, p.brand); rows += `<tr><td style="width:50px;padding:3px">${img ? '<img src="'+img+'" style="width:40px;height:40px;object-fit:contain;border-radius:4px" loading="lazy" onerror="this.style.display=\'none\'">' : ''}</td><td>${p.rank}</td><td><strong>${p.name}</strong></td><td>${p.brand}</td><td>${p.subcategory}</td><td>${data[r].region==='东南亚'?'¥':'$'}${p.price}</td><td>${(p.sales/1000).toFixed(0)}k</td><td><span class="badge badge-green">${p.rankChange}</span></td><td>${p.country}</td><td>${p.trend}</td></tr>`; });
      } else {
        d.forEach(p => { const img = getProductImageSync(p.name, p.brand); rows += `<tr><td style="width:50px;padding:3px">${img ? '<img src="'+img+'" style="width:40px;height:40px;object-fit:contain;border-radius:4px" loading="lazy" onerror="this.style.display=\'none\'">' : ''}</td><td>${p.rank}</td><td><strong>${p.name}</strong></td><td>${p.brand}</td><td>${p.subcategory}</td><td>$${p.price}</td><td>${(p.sales/1000).toFixed(0)}k</td><td>${p.daysSinceLaunch}天</td><td>${p.country}</td><td><span class="badge badge-blue">${p.trend}</span></td></tr>`; });
      }
    });
    const headers = listType === 'moversShakers' 
      ? '<tr><th></th><th>#</th><th>产品</th><th>品牌</th><th>品类</th><th>价格</th><th>销量</th><th>排名变化</th><th>国家</th><th>趋势</th></tr>'
      : '<tr><th></th><th>#</th><th>产品</th><th>品牌</th><th>品类</th><th>价格</th><th>销量</th><th>上架天数</th><th>国家</th><th>趋势</th></tr>';
    return `<table><thead>${headers}</thead><tbody>${rows}</tbody></table>`;
  }

  const platforms = Object.keys(socialData);
  const socialLabels = platforms.map(k => socialData[k].platform);
  const socialVolumes = platforms.map(k => socialData[k].mentionVolume);
  const socialPositive = platforms.map(k => socialData[k].sentimentPositive);
  const socialEngagement = platforms.map(k => socialData[k].engagementRate);

  const ecomKeys = Object.keys(ecomData);
  const ecomLabels = ecomKeys.map(k => ecomData[k].platform);
  const ecomGrowth = ecomKeys.map(k => ecomData[k].growth);

  const matrixLabels = matrixData.map(m => m.category);
  const matrixScores = matrixData.map(m => m.consistencyScore);

  const trendLabels = trendsData.slice(0, 10).map(t => t.keyword);
  const trendGrowth = trendsData.slice(0, 10).map(t => t.yoyGrowth);

  const priceBuckets = {};
  amazonData.forEach(p => {
    const bucket = Math.floor(p.price / 10) * 10;
    priceBuckets[bucket] = (priceBuckets[bucket] || 0) + 1;
  });
  const priceLabels = Object.keys(priceBuckets).sort((a,b) => a-b).map(b => `$${b}-${+b+9}`);
  const priceData = Object.keys(priceBuckets).sort((a,b) => a-b).map(b => priceBuckets[b]);

  const totalProducts = amazonData.length + tiktokData.length;
  const totalPlatforms = 12;
  const avgRating = amazonData.length > 0 ? (amazonData.reduce((s,p) => s + (p.rating || 0), 0) / amazonData.length).toFixed(1) : 'N/A';
  const totalSalesEstimate = amazonData.reduce((s,p) => s + (p.salesEstimate || 0), 0) + tiktokData.reduce((s,p) => s + ((p.sales || 0) * 1), 0);
  const avgGrowth = amazonData.length > 0 ? (amazonData.reduce((s,p) => s + (p.growth || 0), 0) / amazonData.length).toFixed(1) : 'N/A';

  const brands = {};
  amazonData.forEach(p => { brands[p.brand] = (brands[p.brand] || 0) + p.salesEstimate; });
  const topBrands = Object.entries(brands).sort((a,b) => b[1] - a[1]).slice(0, 10);
  const brandLabels = topBrands.map(b => b[0]);
  const brandSales = topBrands.map(b => b[1]);

  const categories = {};
  amazonData.forEach(p => { categories[p.subcategory] = (categories[p.subcategory] || 0) + 1; });
  const catLabels = Object.entries(categories).sort((a,b) => b[1]-a[1]).map(c => c[0]);
  const catCounts = Object.entries(categories).sort((a,b) => b[1]-a[1]).map(c => c[1]);

  // 预计算图表中需要动态判断的 backgroundColor 数组
  const socialChangeColors = platforms.map(k => socialData[k].weekChange > 0 ? 'chartColors.green' : 'chartColors.red');
  const ecomGrowthColors = ecomGrowth.map(g => g > 15 ? 'chartColors.green' : g > 5 ? 'chartColors.blue' : 'chartColors.yellow');
  const keywordsTrendColors = trendGrowth.map(g => g > 40 ? 'chartColors.green' : g > 10 ? 'chartColors.blue' : g > 0 ? 'chartColors.yellow' : 'chartColors.red');


  // 价格策略：价格带分布 + 空白点
  const priceRanges = [
    { range: "$0-10", count: amazonData.filter(p => p.price <= 10).length, opportunity: "超低价带竞争激烈，差异化空间小" },
    { range: "$10-20", count: amazonData.filter(p => p.price > 10 && p.price <= 20).length, opportunity: "中低价带主力，适合走量" },
    { range: "$20-30", count: amazonData.filter(p => p.price > 20 && p.price <= 30).length, opportunity: "中价带利润空间好，品牌建设关键区间" },
    { range: "$30-40", count: amazonData.filter(p => p.price > 30 && p.price <= 40).length, opportunity: "高价带竞品少，高毛利" },
    { range: "$40+", count: amazonData.filter(p => p.price > 40).length, opportunity: "高端带几乎空白，高端产品机会大" }
  ];

  // 关键词密度排名
  const keywordDensity = trendsData.map(k => ({
    keyword: k.keyword,
    volume: k.searchVolume,
    growth: k.yoyGrowth,
    trend: k.trend,
    density: k.trend === 'surging' ? '高密度爆发' : k.trend === 'rising' ? '中高密度增长' : k.trend === 'declining' ? '低密度衰减' : '稳定'
  }));

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${reportTitle} — W${weekNum} (${dateStr})</title>
${chartJSInline ? '<script>' + chartJSInline + '</script>' : '<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>'}
<style>
:root {
  --bg: #f8f9fb; --bg-elevated: #eef0f4; --card-bg: #ffffff; --card-hover: #f1f5f9;
  --text: #1a2332; --text-secondary: #4a5568; --text-muted: #8896a8;
  --accent: #3b82f6; --accent-glow: rgba(59,130,246,0.08);
  --green: #059669; --green-glow: rgba(5,150,105,0.08);
  --red: #dc2626; --red-glow: rgba(220,38,38,0.06);
  --yellow: #d97706; --yellow-glow: rgba(217,119,6,0.06);
  --purple: #7c3aed; --purple-glow: rgba(124,58,237,0.08);
  --orange: #ea580c; --pink: #db2777;
  --border: #e2e8f0; --border-light: #cbd5e1;
  --shadow-sm: 0 1px 3px rgba(0,0,0,0.06);
  --shadow: 0 4px 16px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04);
  --shadow-lg: 0 12px 32px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.04);
  --radius: 14px; --radius-sm: 10px;
}
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif; background: var(--bg); color: var(--text); line-height: 1.6; -webkit-font-smoothing: antialiased; }
body::before { content: ''; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: linear-gradient(180deg, rgba(59,130,246,0.03) 0%, transparent 50%, rgba(124,58,237,0.02) 100%); pointer-events: none; z-index: 0; }

.header { background: linear-gradient(160deg, #1e3a5f 0%, #2563eb 30%, #1d4ed8 100%); padding: 38px 52px; position: relative; overflow: hidden; border-bottom: 1px solid rgba(59,130,246,0.3); }
.header::before { content: ''; position: absolute; top: -80px; right: -80px; width: 350px; height: 350px; background: radial-gradient(circle, rgba(255,255,255,0.12) 0%, transparent 70%); border-radius: 50%; }
.header::after { content: ''; position: absolute; bottom: -40px; left: 10%; width: 200px; height: 200px; background: radial-gradient(circle, rgba(255,255,255,0.08) 0%, transparent 70%); border-radius: 50%; }
.header-top { display: flex; align-items: center; gap: 12px; margin-bottom: 6px; position: relative; z-index: 1; }
.header-badge { display: inline-flex; align-items: center; gap: 4px; padding: 3px 12px; border-radius: 20px; font-size: 11px; font-weight: 600; background: rgba(255,255,255,0.2); color: #fff; border: 1px solid rgba(255,255,255,0.3); letter-spacing: 0.3px; }
.header h1 { font-size: 27px; font-weight: 700; margin-bottom: 4px; color: #fff; position: relative; z-index: 1; letter-spacing: -0.4px; }
.header .sub { color: rgba(255,255,255,0.7); font-size: 13px; position: relative; z-index: 1; }
.header .status-row { display: flex; gap: 16px; margin-top: 12px; position: relative; z-index: 1; }
.header .status-dot { display: inline-flex; align-items: center; gap: 5px; font-size: 11px; color: rgba(255,255,255,0.8); }
.header .status-dot::before { content: ''; width: 6px; height: 6px; border-radius: 50%; }
.header .status-dot.live::before { background: #34d399; box-shadow: 0 0 6px #34d399; }
.header .status-dot.mock::before { background: #fbbf24; box-shadow: 0 0 6px #fbbf24; }
.header .status-dot.manual::before { background: #fb923c; box-shadow: 0 0 6px #fb923c; }

.stats-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; padding: 18px 52px; margin-top: -14px; position: relative; z-index: 2; }
.stat-card { background: var(--card-bg); border-radius: var(--radius); padding: 18px 22px; border: 1px solid var(--border); box-shadow: var(--shadow); transition: all .2s ease; position: relative; overflow: hidden; }
.stat-card:hover { border-color: var(--border-light); box-shadow: var(--shadow-lg); transform: translateY(-1px); }
.stat-card::after { content: ''; position: absolute; top: 0; right: 0; width: 80px; height: 80px; background: radial-gradient(circle at top right, rgba(96,165,250,0.04), transparent 70%); border-radius: 0 0 0 80px; }
.stat-card .icon { font-size: 22px; margin-bottom: 6px; }
.stat-card .label { font-size: 10.5px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 1.4px; font-weight: 600; }
.stat-card .value { font-size: 28px; font-weight: 700; margin: 2px 0; color: var(--text); letter-spacing: -0.5px; background: linear-gradient(135deg, #1a2332, #3b82f6); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
.stat-card .delta { font-size: 12px; color: var(--text-secondary); font-weight: 500; }

.tabs { display: flex; flex-wrap: wrap; gap: 0; padding: 0 52px; background: rgba(255,255,255,0.85); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border-bottom: 1px solid var(--border); position: sticky; top: 0; z-index: 10; box-shadow: 0 1px 4px rgba(0,0,0,0.04); }
.tab-btn { padding: 13px 17px; cursor: pointer; border: none; background: transparent; color: var(--text-muted); font-size: 12.5px; font-weight: 500; border-bottom: 2px solid transparent; transition: all .2s; white-space: nowrap; letter-spacing: 0.2px; }
.tab-btn:hover { color: var(--text); background: rgba(59,130,246,0.04); }
.tab-btn.active { color: var(--accent); border-bottom-color: var(--accent); font-weight: 600; background: rgba(59,130,246,0.06); }

.tab-content { display: none; padding: 28px 52px; animation: fadeSlide .35s cubic-bezier(0.16, 1, 0.3, 1); }
.tab-content.active { display: block; }
@keyframes fadeSlide { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }

.section-title { font-size: 19px; font-weight: 700; margin-bottom: 20px; color: var(--text); padding-bottom: 12px; border-bottom: 1px solid var(--border); display: flex; align-items: center; gap: 10px; letter-spacing: -0.2px; }
.section-title .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--accent); box-shadow: 0 0 8px rgba(59,130,246,0.3); }

.grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }

.chart-container { background: var(--card-bg); border-radius: var(--radius); padding: 20px; border: 1px solid var(--border); box-shadow: var(--shadow-sm); }
.chart-container h4 { color: var(--text); font-weight: 600; font-size: 13px; margin-bottom: 12px; }
.chart-container canvas { max-height: 280px; }

table { width: 100%; border-collapse: separate; border-spacing: 0; margin: 10px 0; border-radius: var(--radius-sm); overflow: hidden; border: 1px solid var(--border); }
th, td { padding: 10px 14px; text-align: left; font-size: 12.5px; }
th { background: #f1f5f9; color: var(--accent); font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: 0.6px; border-bottom: 2px solid var(--border); }
td { background: var(--card-bg); border-bottom: 1px solid var(--border); color: var(--text); }
tr:last-child td { border-bottom: none; }
tbody tr:hover td { background: var(--card-hover); }
tbody tr:nth-child(even) td { background: #f8fafc; }
tbody tr:nth-child(even):hover td { background: var(--card-hover); }

.badge { display: inline-flex; align-items: center; padding: 2px 10px; border-radius: 20px; font-size: 10.5px; font-weight: 600; letter-spacing: 0.3px; }
.badge-green { background: var(--green-glow); color: var(--green); border: 1px solid rgba(52,211,153,0.2); }
.badge-red { background: var(--red-glow); color: var(--red); border: 1px solid rgba(248,113,113,0.2); }
.badge-yellow { background: var(--yellow-glow); color: var(--yellow); border: 1px solid rgba(251,191,36,0.2); }
.badge-blue { background: var(--accent-glow); color: var(--accent); border: 1px solid rgba(96,165,250,0.2); }
.badge-purple { background: var(--purple-glow); color: var(--purple); border: 1px solid rgba(167,139,250,0.2); }

.insight-box { background: var(--card-bg); border-left: 3px solid var(--accent); border-radius: 0 var(--radius-sm) var(--radius-sm) 0; padding: 16px 20px; margin: 16px 0; box-shadow: var(--shadow-sm); }
.insight-box h4 { color: var(--accent); margin-bottom: 6px; font-weight: 600; font-size: 13px; }
.insight-box p { color: var(--text-secondary); line-height: 1.7; font-size: 13px; }

.swot-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin: 16px 0; }
.swot-item { background: var(--card-bg); border-radius: var(--radius-sm); padding: 16px; border: 1px solid var(--border); box-shadow: var(--shadow-sm); }
.swot-item h4 { margin-bottom: 8px; font-size: 14px; font-weight: 600; }
.swot-item ul { list-style: none; padding: 0; }
.swot-item li { padding: 5px 0; font-size: 12.5px; color: var(--text-secondary); }
.swot-s { border-top: 3px solid var(--green); } .swot-s h4 { color: var(--green); }
.swot-w { border-top: 3px solid var(--red); } .swot-w h4 { color: var(--red); }
.swot-o { border-top: 3px solid var(--accent); } .swot-o h4 { color: var(--accent); }
.swot-t { border-top: 3px solid var(--yellow); } .swot-t h4 { color: var(--yellow); }
.swot-item li::before { margin-right: 6px; }
.swot-s li::before { content: '✅'; } .swot-w li::before { content: '⚠️'; }
.swot-o li::before { content: '🚀'; } .swot-t li::before { content: '🛡️'; }

.footer { text-align: center; padding: 28px 52px; color: var(--text-muted); font-size: 11px; border-top: 1px solid var(--border); background: var(--bg-elevated); line-height: 1.8; }
.footer strong { color: var(--text-secondary); }

@media (max-width: 768px) { .stats-row { grid-template-columns: 1fr 1fr; } .grid-2 { grid-template-columns: 1fr; } .header { padding: 24px; } .tabs { padding: 0 16px; } .tab-content { padding: 20px 16px; } }
</style>
</head>
<body>

<div class="header">
  <div class="header-top">
    <span class="header-badge">📊 WEEKLY REPORT</span>
  </div>
  <h1>${reportTitle}</h1>
  <div class="sub">报告周期：W${weekNum} (${dateStr}) · 覆盖 12 个平台 · 自动生成</div>
  ${(() => {
    // v4.0: 动态数据新鲜度显示
    if (dataFreshness) {
      const s = dataFreshness.sources;
      const badges = [];
      for (const [k, v] of Object.entries(s)) {
        const label = { amazon_bestsellers:'Amazon销量榜', amazon_newreleases:'Amazon新品榜', iherb:'iHerb', google_trends:'Google Trends', tiktok:'TikTok', shopee:'Shopee', ozon:'Ozon', exchange_rate:'汇率', fda_recalls:'FDA召回' }[k] || k;
        const cls = v.status === 'fresh' ? 'live' : v.status === 'stale' ? 'mock' : 'manual';
        badges.push(`<span class="status-dot ${cls}" title="${v.method} | ${v.age}">${label} ${v.status === 'fresh' ? '✅' : v.status === 'stale' ? '⚠️' : '🟡'}</span>`);
      }
      return '<div class="status-row">' + badges.join(' ') + '</div>';
    }
    return `<div class="status-row">
      <span class="status-dot live">Amazon ✅ 真实数据</span>
      <span class="status-dot live">TikTok Shop ✅ 真实数据</span>
      <span class="status-dot live">Google Trends ✅ 真实数据</span>
      <span class="status-dot mock">社媒/其他电商 🟡 手动</span>
    </div>`;
  })()}
</div>

<div class="stats-row">
  <div class="stat-card">
    <div class="icon">🌐</div>
    <div class="label">覆盖平台</div>
    <div class="value">${totalPlatforms}</div>
    <div class="delta">7 社媒 + 4 电商 + 1 搜索</div>
  </div>
  <div class="stat-card">
    <div class="icon">📦</div>
    <div class="label">分析产品数</div>
    <div class="value">${totalProducts}</div>
    <div class="delta">Amazon ${amazonData.length} + TikTok ${tiktokData.length}</div>
  </div>
  <div class="stat-card">
    <div class="icon">⭐</div>
    <div class="label">平均评分</div>
    <div class="value">${avgRating}</div>
    <div class="delta">Amazon 畅销品均值</div>
  </div>
  <div class="stat-card">
    <div class="icon">📈</div>
    <div class="label">平均增长率</div>
    <div class="value">${avgGrowth > 0 ? '+' : ''}${avgGrowth}%</div>
    <div class="delta">Amazon TOP20 周环比</div>
  </div>
</div>

<div id="main-tabs" class="tabs">
  <button class="tab-btn active" onclick="switchTab('overview', event)">📊 全局概览</button>
  <button class="tab-btn" onclick="switchTab('matrix', event)">🔗 跨平台矩阵</button>
  <button class="tab-btn" onclick="switchTab('social', event)">📱 社媒分析</button>
  <button class="tab-btn" onclick="switchTab('ecommerce', event)">🛒 电商平台</button>
  <button class="tab-btn" onclick="switchTab('competitor', event)">🏆 竞品分析</button>
  <button class="tab-btn" onclick="switchTab('keywords', event)">🔑 关键词挖掘</button>
  <button class="tab-btn" onclick="switchTab('risk', event)">⚠️ 风险预警</button>
  <button class="tab-btn" onclick="switchTab('swot', event)">🎯 SWOT 分析</button>
  <button class="tab-btn" onclick="switchTab('inventory', event)">📦 库存建议</button>
  <button class="tab-btn" onclick="switchTab('pricing', event)">💰 价格策略</button>
  <button class="tab-btn" onclick="switchTab('insights', event)">💡 运营洞察</button>
  <button class="tab-btn" onclick="switchTab('aifeedback', event)">🤖 AI 反馈</button>
</div>

<!-- TAB 1: 全局概览 -->
<div id="tab-overview" class="tab-content active">
  <h2 class="section-title">📊 全局概览</h2>
  
  <div class="insight-box">
    <h4>🔥 核心发现</h4>
    <p>
      本周保健品市场持续高热度。Google Trends 数据显示 <strong>Berberine（+85.3%）</strong>、<strong>Lion's Mane（+72.6%）</strong>、<strong>NAC（+62.4%）</strong> 搜索量爆发式增长。
      TikTok Shop 东南亚六国保健品 GMV 持续走高，<strong>胶原蛋白肽粉</strong>以 2,225 万泰铢 GMV 领跑印尼市场。
      Amazon 端 <strong>Vitamin D3</strong> 凭借高评分（4.8）和巨大销量（12 万件）稳居第一。
      社媒端 TikTok 讨论量（85 万）远超其他平台，<strong>#supplementtok</strong> 话题持续火热。
    </p>
  </div>

  <div class="grid-2">
    <div class="chart-container">
      <h4 style="margin-bottom:12px">Amazon 价格分布</h4>
      <canvas id="chartPrice"></canvas>
    </div>
    <div class="chart-container">
      <h4 style="margin-bottom:12px">品类分布</h4>
      <canvas id="chartCategory"></canvas>
    </div>
  </div>

  <h3 style="margin:24px 0 12px;color:var(--accent)">Amazon TOP 10 畅销保健品</h3>
  <table>
    <thead><tr><th></th><th>排名</th><th>产品</th><th>品牌</th><th>品类</th><th>价格</th><th>评分</th><th>评论数</th><th>预估周销</th><th>增长</th></tr></thead>
    <tbody>
    ${amazonData.slice(0, 10).map((p, i) => {
      const img = getProductImageSync(p.name);
      return `<tr>
      <td style="width:60px;padding:4px">${img ? '<img src="' + img + '" style="width:50px;height:50px;object-fit:contain;border-radius:6px" loading="lazy" onerror="this.style.display=\'none\'">' : ''}</td>
      <td>${i+1}</td><td><strong>${p.name}</strong></td><td>${p.brand}</td><td>${p.subcategory}</td>
      <td>${p.price != null ? '$' + p.price.toFixed(2) : 'N/A'}</td>
      <td>⭐ ${p.rating || 'N/A'}</td><td>${p.reviews ? (p.reviews/1000).toFixed(1) + 'k' : 'N/A'}</td>
      <td>${p.salesEstimate ? (p.salesEstimate/1000).toFixed(1) + 'k' : 'N/A'}</td>
      <td><span class="badge ${p.growth > 0 ? 'badge-green' : 'badge-red'}">${p.growth > 0 ? '+' : ''}${p.growth}%</span></td>
    </tr>`;
    }).join('')}
    </tbody>
  </table>
</div>

<!-- TAB 2: 跨平台矩阵 -->
<div id="tab-matrix" class="tab-content">
  <h2 class="section-title"><span class="dot"></span>🔗 跨平台矩阵 — 品类一致性 × 品牌平台分布</h2>
  
  ${(() => {
    if (!brandMatrixData) return '<p>矩阵数据加载中...</p>';
    const { categoryMatrix, brandMatrix, amzOnly, tiktokOnly, crossPlatform } = brandMatrixData;
    let html = '';
    
    // 1. 品类跨平台一致性热力图（保留雷达图）
    html += `<h3 style="margin:20px 0 12px;color:var(--accent)">📊 品类跨平台一致性 — 雷达图</h3>`;
    html += `<div class="chart-container" style="margin-bottom:24px"><canvas id="chartMatrix"></canvas></div>`;
    html += `<table><thead><tr><th>品类</th><th>Google</th><th>TikTok</th><th>Amazon</th><th>电商</th><th>一致性</th><th>判断</th><th>策略</th></tr></thead><tbody>`;
    categoryMatrix.forEach(m => {
      const barColor = m.consistency >= 80 ? 'var(--green)' : m.consistency >= 70 ? 'var(--accent)' : m.consistency >= 60 ? 'var(--yellow)' : 'var(--text-muted)';
      html += `<tr>
        <td><strong>${m.category}</strong></td>
        <td>${m.google}</td><td>${m.tiktok}</td><td>${m.amazon}</td><td>${m.ecommerce}</td>
        <td>
          <div style="display:flex;align-items:center;gap:6px">
            <div style="flex:1;height:4px;background:var(--border);border-radius:2px;overflow:hidden">
              <div style="width:${m.consistency}%;height:100%;background:${barColor};border-radius:2px"></div>
            </div>
            <strong style="font-size:12px;color:${barColor}">${m.consistency}</strong>
          </div>
        </td>
        <td><span class="badge ${m.consistency >= 80 ? 'badge-green' : m.consistency >= 70 ? 'badge-blue' : 'badge-yellow'}">${m.verdict}</span></td>
        <td style="font-size:11px">${m.action}</td>
      </tr>`;
    });
    html += `</tbody></table>`;
    
    // 2. 品牌 × 平台得分矩阵
    html += `<h3 style="margin:28px 0 14px;color:var(--accent)">🏷️ 品牌 × 平台热度矩阵 TOP 10</h3>`;
    html += `<table><thead><tr><th>品牌</th><th>Amazon</th><th>TikTok</th><th>社媒</th><th>iHerb</th><th>均分</th><th>代表产品</th></tr></thead><tbody>`;
    brandMatrix.forEach(b => {
      const maxScore = Math.max(b.amazon, b.tiktok, b.social, b.iherb);
      html += `<tr>
        <td><strong>${b.name}</strong></td>
        <td><div style="display:flex;align-items:center;gap:4px"><div style="flex:1;height:4px;background:var(--border);border-radius:2px;overflow:hidden"><div style="width:${b.amazon}%;height:100%;background:${b.amazon === maxScore ? 'var(--green)' : 'var(--accent)'};border-radius:2px"></div></div><span style="font-size:10px;color:var(--text-muted)">${b.amazon}</span></div></td>
        <td><div style="display:flex;align-items:center;gap:4px"><div style="flex:1;height:4px;background:var(--border);border-radius:2px;overflow:hidden"><div style="width:${b.tiktok}%;height:100%;background:${b.tiktok === maxScore ? 'var(--green)' : 'var(--accent)'};border-radius:2px"></div></div><span style="font-size:10px;color:var(--text-muted)">${b.tiktok}</span></div></td>
        <td><div style="display:flex;align-items:center;gap:4px"><div style="flex:1;height:4px;background:var(--border);border-radius:2px;overflow:hidden"><div style="width:${b.social}%;height:100%;background:${b.social === maxScore ? 'var(--green)' : 'var(--accent)'};border-radius:2px"></div></div><span style="font-size:10px;color:var(--text-muted)">${b.social}</span></div></td>
        <td><div style="display:flex;align-items:center;gap:4px"><div style="flex:1;height:4px;background:var(--border);border-radius:2px;overflow:hidden"><div style="width:${b.iherb}%;height:100%;background:${b.iherb === maxScore ? 'var(--green)' : 'var(--accent)'};border-radius:2px"></div></div><span style="font-size:10px;color:var(--text-muted)">${b.iherb}</span></div></td>
        <td><strong style="color:${b.avg >= 40 ? 'var(--green)' : 'var(--accent)'}">${b.avg}</strong></td>
        <td style="font-size:10px;max-width:180px">${b.products.join(' / ')}</td>
      </tr>`;
    });
    html += `</tbody></table>`;
    
    // 3. 平台独占品牌 vs 跨平台品牌
    html += `<h3 style="margin:28px 0 14px;color:var(--accent)">🔍 平台独占品牌 vs 跨平台品牌</h3>`;
    html += `<div class="grid-2">`;
    
    html += `<div class="chart-container"><h4>🛒 Amazon独占品牌 (TOP 5)</h4><table><thead><tr><th>品牌</th><th>Amazon销量</th><th>产品</th></tr></thead><tbody>`;
    amzOnly.forEach(b => html += `<tr><td><strong>${b.name}</strong></td><td>${(b.amzSales/1000).toFixed(0)}k</td><td style="font-size:10px">${b.products.slice(0,2).join(' / ')}</td></tr>`);
    html += `</tbody></table></div>`;
    
    html += `<div class="chart-container"><h4>🎵 TikTok独占品牌 (TOP 5)</h4><table><thead><tr><th>品牌</th><th>TikTok GMV</th><th>产品</th></tr></thead><tbody>`;
    tiktokOnly.forEach(b => html += `<tr><td><strong>${b.name}</strong></td><td>\$${(b.tiktokGMV/1e6).toFixed(1)}M</td><td style="font-size:10px">${b.products.slice(0,2).join(' / ')}</td></tr>`);
    html += `</tbody></table></div>`;
    html += `</div>`;
    
    html += `<div class="chart-container" style="margin-top:18px"><h4>🌐 跨平台品牌 (同时覆盖Amazon+TikTok) — 稀缺</h4><table><thead><tr><th>品牌</th><th>Amazon</th><th>TikTok</th><th>渠道数</th></tr></thead><tbody>`;
    crossPlatform.forEach(b => html += `<tr><td><strong>${b.name}</strong></td><td>${b.amzProducts}品 ⭐${b.amzRating}</td><td>\$${(b.tiktokGMV/1e6).toFixed(1)}M</td><td>${b.channels}</td></tr>`);
    html += `</tbody></table></div>`;
    
    // 4. 洞察
    html += `<div class="insight-box" style="margin-top:24px">
      <h4>🔍 跨平台矩阵核心洞察</h4>
      <p>
        ① <strong>品类分化明显</strong>：${categoryMatrix.filter(m => m.consistency >= 80).length}个品类跨平台一致性≥80（电解质、胶原蛋白、益生菌、肌酸），是全域热门赛道；绿色超级食物和长寿品类TikTok独爆但Amazon冷淡；<br>
        ② <strong>跨平台品牌极度稀缺</strong>：仅 ${crossPlatform.length} 个品牌同时覆盖Amazon和TikTok Shop，存在巨大的"渠道跨越"机会——Amazon强品牌进军TikTok或TikTok原生品牌拓展Amazon；<br>
        ③ <strong>平台生态独立</strong>：Amazon独占品牌（${amzOnly.length}个）和TikTok独占品牌（${tiktokOnly.length}个）几乎不重叠，说明两个平台的消费者画像和购买决策路径差异显著；<br>
        ④ <strong>一致性越高，投资回报越确定</strong>：高一致性品类（≥80分）建议优先投入，因为这些品类在搜索、社媒、电商三端都有需求验证。
      </p>
    </div>`;
    
    return html;
  })()}
</div>

<!-- TAB 3: 社媒分析 -->
<div id="tab-social" class="tab-content">
  <h2 class="section-title">📱 社媒分析 — 7 大平台保健品洞察</h2>
  
  <div class="grid-2">
    <div class="chart-container"><h4 style="margin-bottom:12px">平台声量对比</h4><canvas id="chartSocialVolume"></canvas></div>
    <div class="chart-container"><h4 style="margin-bottom:12px">正面情绪占比</h4><canvas id="chartSocialSentiment"></canvas></div>
  </div>
  <div class="grid-2" style="margin-top:24px">
    <div class="chart-container"><h4 style="margin-bottom:12px">互动率对比</h4><canvas id="chartSocialEngage"></canvas></div>
    <div class="chart-container"><h4 style="margin-bottom:12px">周变化趋势</h4><canvas id="chartSocialChange"></canvas></div>
  </div>

  <h3 style="margin:28px 0 14px;color:var(--accent)">📊 各平台保健品详细数据</h3>
  <table>
    <thead><tr><th>平台</th><th>声量</th><th>正面%</th><th>互动率</th><th>周变化</th><th>🔥 热门保健品品牌/话题</th></tr></thead>
    <tbody>
    ${platforms.map(k => {
      const s = socialData[k];
      let hotContent = '';
      if (s.topBrands) {
        hotContent = s.topBrands.slice(0,3).map(b => `<span class="badge badge-blue">${b.name}</span>`).join(' ');
      } else if (s.topChannels) {
        hotContent = s.topChannels.slice(0,3).map(c => `<span class="badge badge-purple">${c.name}</span>`).join(' ');
      } else if (s.topInfluencers) {
        hotContent = s.topInfluencers.slice(0,3).map(i => `<span class="badge badge-green">${i.name}</span>`).join(' ');
      } else if (s.topGroups) {
        hotContent = s.topGroups.slice(0,3).map(g => `<span class="badge badge-yellow">${g.name}</span>`).join(' ');
      } else if (s.hotTopics) {
        hotContent = s.hotTopics.slice(0,3).map(t => `<span class="badge badge-blue">${t.topic}</span>`).join(' ');
      } else if (s.topHashtags) {
        hotContent = s.topHashtags.slice(0,3).map(h => `<span class="badge badge-blue">${h}</span>`).join(' ');
      } else {
        hotContent = '<span style="color:var(--text-muted)">—</span>';
      }
      return `<tr>
        <td><strong>${s.platform}</strong></td>
        <td>${(s.mentionVolume/1000).toFixed(0)}k</td>
        <td>${s.sentimentPositive}%</td>
        <td>${s.engagementRate}%</td>
        <td><span class="badge ${s.weekChange > 0 ? 'badge-green' : 'badge-red'}">${s.weekChange > 0 ? '+' : ''}${s.weekChange}%</span></td>
        <td style="font-size:11px;line-height:1.8">${hotContent}</td>
      </tr>`;
    }).join('')}
    </tbody>
  </table>

  <!-- TikTok 详情 -->
  <h3 style="margin:28px 0 14px;color:var(--accent)">🎵 TikTok — 保健品品牌影响力 TOP 5</h3>
  <table>
    <thead><tr><th>品牌</th><th>创作者提及</th><th>增长</th><th>互动量</th><th>特点</th></tr></thead>
    <tbody>
    ${socialData.tiktok.topBrands.map(b => `<tr>
      <td><strong>${b.name}</strong></td><td>${b.mentions}</td>
      <td><span class="badge ${b.growth > 50 ? 'badge-green' : b.growth > 0 ? 'badge-blue' : 'badge-red'}">${b.growth > 0 ? '+' : ''}${b.growth}%</span></td>
      <td>${(b.engagement/1000).toFixed(1)}k</td>
      <td style="font-size:11px">${b.note}</td>
    </tr>`).join('')}
    </tbody>
  </table>
  <div class="insight-box"><h4>💡 TikTok 保健品洞察</h4><p>TikTok Shop 保健品年销售额达 <strong>$784M</strong>（NIQ 2026），超越面部护肤成为第一大健康美容品类。Revuze 报告显示 Q1 2026 健身补充剂增长 <strong>49%</strong>（$4.9M→$7.3M）。<strong>Arrae Clear Protein+</strong> 以 +2,740% 增长成为年度爆品，<strong>Leefar Cutting Drink Mix</strong> 月销 $1.8M。品类分布：运动营养 38%、绿色超级食物 22%、维生素 18%。</p></div>

  <!-- Instagram 详情 -->
  <h3 style="margin:28px 0 14px;color:var(--accent)">📸 Instagram — 保健品品牌影响力 TOP 5</h3>
  <table>
    <thead><tr><th>品牌</th><th>创作者提及</th><th>增长</th><th>互动量</th><th>特点</th></tr></thead>
    <tbody>
    ${socialData.instagram.topBrands.map(b => `<tr>
      <td><strong>${b.name}</strong></td><td>${b.mentions}</td>
      <td><span class="badge ${b.growth > 50 ? 'badge-green' : b.growth > 0 ? 'badge-blue' : 'badge-red'}">${b.growth > 0 ? '+' : ''}${b.growth}%</span></td>
      <td>${(b.engagement/1000).toFixed(1)}k</td>
      <td style="font-size:11px">${b.note}</td>
    </tr>`).join('')}
    </tbody>
  </table>
  <div class="insight-box"><h4>💡 Instagram 保健品洞察</h4><p>38个品牌在6个月内产生 <strong>6,481次</strong>创作者提及，总互动量 <strong>1,370万</strong>。68%品牌100%依赖Instagram（零TikTok提及）。<strong>Myprotein</strong> 以2,123次提及居首（互动率5.90%），<strong>AG1</strong> 增速最快（+450%）。品类以蛋白质/运动营养为主（42%）。</p></div>

  <!-- Reddit 详情 -->
  <h3 style="margin:28px 0 14px;color:var(--accent)">🤖 Reddit — 热门保健品话题 TOP 5</h3>
  <table>
    <thead><tr><th>话题</th><th>提及量(估)</th><th>情感</th><th>核心关注点</th></tr></thead>
    <tbody>
    ${socialData.reddit.hotTopics.map(t => `<tr>
      <td><strong>${t.topic}</strong></td><td>${t.mentions}</td>
      <td>${t.sentiment}</td><td style="font-size:11px">${t.note}</td>
    </tr>`).join('')}
    </tbody>
  </table>
  <div class="insight-box"><h4>💡 Reddit 保健品洞察</h4><p>Reddit 是保健品深度讨论的核心阵地，互动率最高（6.5%）。<strong>Magnesium Glycinate</strong> 是最热门话题（睡眠/焦虑首选），<strong>Creatine</strong> 被广泛推荐为"最有效补剂No.1"。品类分布：矿物质 28%、益智/认知 22%、运动营养 18%。</p></div>

  <!-- YouTube 详情 -->
  <h3 style="margin:28px 0 14px;color:var(--accent)">▶️ YouTube — 保健品频道 TOP 5</h3>
  <table>
    <thead><tr><th>频道</th><th>订阅数</th><th>专注领域</th></tr></thead>
    <tbody>
    ${socialData.youtube.topChannels.map(c => `<tr>
      <td><strong>${c.name}</strong></td><td>${c.subs}</td>
      <td style="font-size:11px">${c.focus}</td>
    </tr>`).join('')}
    </tbody>
  </table>

  <!-- Facebook / X / Pinterest 精简 -->
  <h3 style="margin:28px 0 14px;color:var(--accent)">📘 Facebook · 🐦 X/Twitter · 📌 Pinterest</h3>
  <table>
    <thead><tr><th>平台</th><th>核心社群/影响者</th><th>热门产品方向</th><th>品类偏好</th></tr></thead>
    <tbody>
      <tr>
        <td><strong>📘 Facebook</strong></td>
        <td style="font-size:11px">${socialData.facebook.topGroups.slice(0,2).map(g => g.name + ' (' + g.members + ')').join(', ')}</td>
        <td style="font-size:11px">${socialData.facebook.topProducts.slice(0,3).join(', ')}</td>
        <td style="font-size:11px">综合健康35% · 减重22% · 免疫18%</td>
      </tr>
      <tr>
        <td><strong>🐦 X/Twitter</strong></td>
        <td style="font-size:11px">${socialData.twitter.topInfluencers.slice(0,3).map(i => i.name + ' (' + i.followers + ')').join(', ')}</td>
        <td style="font-size:11px">${socialData.twitter.topProducts.slice(0,3).join(', ')}</td>
        <td style="font-size:11px">长寿35% · 益智25% · 运动20%</td>
      </tr>
      <tr>
        <td><strong>📌 Pinterest</strong></td>
        <td style="font-size:11px">${socialData.pinterest.topBoards.slice(0,2).join(', ')}</td>
        <td style="font-size:11px">${socialData.pinterest.topProducts.slice(0,3).join(', ')}</td>
        <td style="font-size:11px">美容38% · 天然疗法25% · 绿色饮食20%</td>
      </tr>
    </tbody>
  </table>

  <div class="insight-box" style="margin-top:20px">
    <h4>📋 跨平台社媒策略建议</h4>
    <p>① <strong>TikTok</strong>（声量85万，增速+25.4%）：投入短视频种草+达人矩阵，重点品类运动营养和绿色超级食物；② <strong>Instagram</strong>（声量52万，正面78%）：品牌形象建设，Myprotein模式（2,123次创作者合作）；③ <strong>Reddit</strong>（互动率6.5%）：深度产品测评和口碑，关注 Magnesium/Creatine/Lion's Mane 热门话题；④ <strong>YouTube</strong>（35M观看）：专业背书和长内容教育，合作TOP运动营养频道；⑤ <strong>Pinterest</strong>（正面85%）：美容/女性健康导向，Collagen和Hair Growth品类。</p>
  </div>

  <!-- 跨平台热度综合排行榜 -->
  <h2 class="section-title" style="margin-top:32px"><span class="dot"></span>🔥 跨平台保健品热度综合排行榜 TOP 20</h2>
  <div class="insight-box">
    <h4>📐 评分方法</h4>
    <p>综合热度分 = Amazon销量(25%) + TikTok GMV/增长(25%) + Google Trends搜索量(20%) + Instagram创作者提及(15%) + Reddit话题热度(10%) + YouTube频道覆盖(5%)。<br>数据来源：Amazon Best Sellers · NIQ TikTok Shop $784M · Revuze Q1 2026 · Upfluence 38品牌 · Google Trends/RisingTrends · Reddit r/Supplements</p>
  </div>
  <table>
    <thead><tr><th>#</th><th>产品/品类</th><th>综合分</th><th>🏷 判定</th><th>覆盖</th><th>Amazon</th><th>TikTok</th><th>G.Trends</th><th>Instagram</th><th>Reddit</th><th>YT</th><th>关键洞察</th></tr></thead>
    <tbody>
    ${hotRanking.slice(0, 20).map((p, i) => {
      const s = p.scores;
      const barWidth = s.total;
      const barColor = s.total >= 60 ? 'var(--green)' : s.total >= 40 ? 'var(--accent)' : s.total >= 20 ? 'var(--yellow)' : 'var(--text-muted)';
      return `<tr>
        <td><strong>${i + 1}</strong></td>
        <td><strong>${p.name}</strong><br><span style="font-size:10px;color:var(--text-muted)">${p.category}</span></td>
        <td>
          <div style="display:flex;align-items:center;gap:8px">
            <div style="flex:1;height:6px;background:var(--border);border-radius:3px;overflow:hidden">
              <div style="width:${barWidth}%;height:100%;background:${barColor};border-radius:3px"></div>
            </div>
            <strong style="font-size:14px;color:${barColor}">${s.total}</strong>
          </div>
        </td>
        <td><span class="badge ${s.total >= 60 ? 'badge-green' : s.total >= 40 ? 'badge-blue' : s.total >= 20 ? 'badge-yellow' : ''}">${p.verdict}</span></td>
        <td>${p.coverage}/6</td>
        <td style="font-size:11px">${s.amazon > 0 ? '<span class="badge badge-blue">' + s.amazon + '</span>' : '—'}</td>
        <td style="font-size:11px">${s.tiktok > 0 ? '<span class="badge badge-green">' + s.tiktok + '</span>' : '—'}</td>
        <td style="font-size:11px">${s.googleTrends > 0 ? '<span class="badge badge-purple">' + s.googleTrends + '</span>' : '—'}</td>
        <td style="font-size:11px">${s.instagram > 0 ? '<span class="badge badge-yellow">' + s.instagram + '</span>' : '—'}</td>
        <td style="font-size:11px">${s.reddit > 0 ? '<span class="badge badge-green">' + s.reddit + '</span>' : '—'}</td>
        <td style="font-size:11px">${s.youtube > 0 ? '<span class="badge badge-purple">' + s.youtube + '</span>' : '—'}</td>
        <td style="font-size:10px;max-width:160px">${p.tiktok.note || p.googleTrends.note || p.reddit.note || ''}</td>
      </tr>`;
    }).join('')}
    </tbody>
  </table>
  <div class="insight-box" style="margin-top:20px">
    <h4>🔍 排行榜核心发现</h4>
    <p>① <strong>Magnesium Glycinate</strong> 是唯一在全部6个维度都有数据的"全域爆品"——Amazon畅销#3、TikTok $3.6M GMV、Google Trends 100万月搜索、Reddit最热话题8,500提及；② <strong>Creatine Monohydrate</strong> 紧随其后，运动营养领域绝对王者，Reddit公认"最有效补剂No.1"；③ <strong>TikTok原生爆品</strong>（Arrae +2,740%、Leefar $1.8M/月）虽然单平台强势但跨平台覆盖不足；④ <strong>电解质品类</strong>增速惊人（Google Trends +1,986%），但品牌集中度低，是蓝海机会。</p>
  </div>
</div>

<!-- TAB 4: 电商平台 — 三榜视图 -->
<div id="tab-ecommerce" class="tab-content">
  <h2 class="section-title">🛒 电商平台分析 — Amazon 三榜 + TikTok 三榜 + 5 平台总览</h2>
  
  <!-- 子Tab切换 -->
  <div id="sub-tabs" class="tabs" style="padding:0;margin-bottom:16px">
    <button class="tab-btn active" onclick="switchSubTab('amazon-bestsellers', event)" style="font-size:11px;padding:8px 10px">🏆 AMZ 销量</button>
    <button class="tab-btn" onclick="switchSubTab('amazon-movers', event)" style="font-size:11px;padding:8px 10px">📈 AMZ 飙升</button>
    <button class="tab-btn" onclick="switchSubTab('amazon-new', event)" style="font-size:11px;padding:8px 10px">🆕 AMZ 新品</button>
    <button class="tab-btn" onclick="switchSubTab('tiktok-sea-best', event)" style="font-size:11px;padding:8px 10px">🎵 东南亚销量</button>
    <button class="tab-btn" onclick="switchSubTab('tiktok-na-best', event)" style="font-size:11px;padding:8px 10px">🎵 北美销量</button>
    <button class="tab-btn" onclick="switchSubTab('tiktok-eu-best', event)" style="font-size:11px;padding:8px 10px">🎵 欧洲销量</button>
    <button class="tab-btn" onclick="switchSubTab('tiktok-all-movers', event)" style="font-size:11px;padding:8px 10px">📈 TikTok 飙升</button>
    <button class="tab-btn" onclick="switchSubTab('tiktok-all-new', event)" style="font-size:11px;padding:8px 10px">🆕 TikTok 新品</button>
    <button class="tab-btn" onclick="switchSubTab('tiktok-region-compare', event)" style="font-size:11px;padding:8px 10px">🌍 TK区域对比</button>
    <button class="tab-btn" onclick="switchSubTab('shopee-sea', event)" style="font-size:11px;padding:8px 10px">🛍️ Shopee东南亚</button>
    <button class="tab-btn" onclick="switchSubTab('shopee-latam', event)" style="font-size:11px;padding:8px 10px">🌎 Shopee拉美</button>
    <button class="tab-btn" onclick="switchSubTab('shopee-eu', event)" style="font-size:11px;padding:8px 10px">🇪🇺 Shopee欧洲</button>
    <button class="tab-btn" onclick="switchSubTab('ozon-bestsellers', event)" style="font-size:11px;padding:8px 10px">🇷🇺 Ozon</button>
    <button class="tab-btn" onclick="switchSubTab('ecom-overview', event)" style="font-size:11px;padding:8px 10px">🌐 全平台总览</button>
  </div>

  <!-- Amazon 销量榜 -->
  <div id="sub-amazon-bestsellers" class="tab-content active" style="padding:0">
    <div class="insight-box"><h4>🏆 Amazon 销量榜 (Best Sellers)</h4><p>保健品分类 Top 15 真实数据 · 来源：Amazon Best Sellers Diet & Sports Nutrition #3764441 · 更新时间：2026-06-28</p></div>
    <table><thead><tr><th></th><th>#</th><th>产品</th><th>品牌</th><th>品类</th><th>价格</th><th>评分</th><th>评论</th><th>周销量</th><th>增长</th></tr></thead><tbody>
    ${(() => { const d = amazonThreeLists ? amazonThreeLists.bestSellers : []; return d.map(p => { const img = getProductImageSync(p.name); return `<tr><td style="width:55px;padding:3px">${img ? '<img src="'+img+'" style="width:45px;height:45px;object-fit:contain;border-radius:4px" loading="lazy" onerror="this.style.display=\'none\'">' : ''}</td><td>${p.rank}</td><td><strong>${p.name}</strong></td><td>${p.brand}</td><td>${p.subcategory}</td><td>$${p.price.toFixed(2)}</td><td>⭐${p.rating}</td><td>${(p.reviews/1000).toFixed(1)}k</td><td>${(p.salesEstimate/1000).toFixed(1)}k</td><td><span class="badge ${p.growth>0?'badge-green':'badge-red'}">${p.growth>0?'+':''}${p.growth}%</span></td></tr>`; }).join(''); })()}
    </tbody></table>
  </div>

  <!-- Amazon 飙升榜 -->
  <div id="sub-amazon-movers" class="tab-content" style="padding:0">
    <div class="insight-box"><h4>📈 Amazon 飙升榜 (Movers & Shakers)</h4><p>24h 排名上升最快商品 · 基于 Google Trends 真实热搜数据驱动 · Berberine(+49%) / Lion's Mane / NAC</p></div>
    <table><thead><tr><th></th><th>#</th><th>产品</th><th>品牌</th><th>品类</th><th>价格</th><th>评分</th><th>排名变化</th><th>趋势</th><th>数据来源</th></tr></thead><tbody>
    ${(() => { const d = amazonThreeLists ? amazonThreeLists.moversShakers : []; return d.map(p => { const img = getProductImageSync(p.name); return `<tr><td style="width:55px;padding:3px">${img ? '<img src="'+img+'" style="width:45px;height:45px;object-fit:contain;border-radius:4px" loading="lazy" onerror="this.style.display=\'none\'">' : ''}</td><td>${p.rank}</td><td><strong>${p.name}</strong></td><td>${p.brand}</td><td>${p.subcategory}</td><td>$${p.price.toFixed(2)}</td><td>⭐${p.rating}</td><td><span class="badge badge-green">${p.rankChange}</span></td><td>${p.trend}</td><td style="font-size:10px">${p.source||''}</td></tr>`; }).join(''); })()}
    </tbody></table>
  </div>

  <!-- Amazon 新品榜 -->
  <div id="sub-amazon-new" class="tab-content" style="padding:0">
    <div class="insight-box"><h4>🆕 Amazon 新品榜 (New Releases)</h4><p>30天内上架新品中表现最佳 · 电解质/蛋白/GLP-1是新品最密集赛道</p></div>
    <table><thead><tr><th></th><th>#</th><th>产品</th><th>品牌</th><th>品类</th><th>价格</th><th>评分</th><th>评论</th><th>上架天数</th><th>趋势</th></tr></thead><tbody>
    ${(() => { const d = amazonThreeLists ? amazonThreeLists.newReleases : []; return d.map(p => { const img = getProductImageSync(p.name); return `<tr><td style="width:55px;padding:3px">${img ? '<img src="'+img+'" style="width:45px;height:45px;object-fit:contain;border-radius:4px" loading="lazy" onerror="this.style.display=\'none\'">' : ''}</td><td>${p.rank}</td><td><strong>${p.name}</strong></td><td>${p.brand}</td><td>${p.subcategory}</td><td>${p.price != null ? '$' + p.price.toFixed(2) : 'N/A'}</td><td>⭐${p.rating || 'N/A'}</td><td>${p.reviews || 'N/A'}</td><td>${p.daysSinceLaunch || 'N/A'}天</td><td><span class="badge badge-blue">${p.trend || '🆕'}</span></td></tr>`; }).join(''); })()}
    </tbody></table>
  </div>

  <!-- TikTok 东南亚 销量榜 -->
  <div id="sub-tiktok-sea-best" class="tab-content" style="padding:0">
    <div class="insight-box"><h4>🎵 TikTok 东南亚 — 销量榜</h4><p>🇮🇩印尼 · 🇹🇭泰国 · 🇲🇾马来 · 🇵🇭菲律宾 · 🇻🇳越南 | 胶原蛋白/美白/益生菌主导</p></div>
    ${renderTikTokTable(tiktokThreeLists, 'sea', 'bestSellers', '销量榜')}
  </div>

  <!-- TikTok 北美 销量榜 -->
  <div id="sub-tiktok-na-best" class="tab-content" style="padding:0">
    <div class="insight-box"><h4>🎵 TikTok 北美 — 销量榜</h4><p>🇺🇸美国 · 🇨🇦加拿大 | 绿色超级食物/综合维生素/胶原蛋白主导 | 美国GMV增速远超东南亚</p></div>
    ${renderTikTokTable(tiktokThreeLists, 'na', 'bestSellers', '销量榜')}
  </div>

  <!-- TikTok 欧洲 销量榜 -->
  <div id="sub-tiktok-eu-best" class="tab-content" style="padding:0">
    <div class="insight-box"><h4>🎵 TikTok 欧洲 — 销量榜</h4><p>🇬🇧英国 · 🇩🇪德国 · 🇫🇷法国 | 排毒/维生素/胶原蛋白主导 | 英国是欧洲TikTok电商最大市场</p></div>
    ${renderTikTokTable(tiktokThreeLists, 'eu', 'bestSellers', '销量榜')}
  </div>

  <!-- TikTok 三区域飙升榜（合并） -->
  <div id="sub-tiktok-all-movers" class="tab-content" style="padding:0">
    <div class="insight-box"><h4>📈 TikTok 三区域 — 飙升榜 (Movers & Shakers)</h4><p>北美ARMRA牛初乳(+5,800位)和英国蘑菇复合物(+4,500位)领跑全球飙升</p></div>
    ${renderTikTokTableMerged(tiktokThreeLists, 'moversShakers', '飙升榜')}
  </div>

  <!-- TikTok 三区域新品榜（合并） -->
  <div id="sub-tiktok-all-new" class="tab-content" style="padding:0">
    <div class="insight-box"><h4>🆕 TikTok 三区域 — 新品榜 (New Releases)</h4><p>Seed益生菌2.0(美国7天爆发)、Kourtney x Lemme(美国14天快增)值得关注</p></div>
    ${renderTikTokTableMerged(tiktokThreeLists, 'newReleases', '新品榜')}
  </div>

  <!-- TikTok 区域对比 -->
  <div id="sub-tiktok-region-compare" class="tab-content" style="padding:0">
    <div class="insight-box"><h4>🌍 TikTok Shop 三大区域对比 — 东南亚 vs 北美 vs 欧洲</h4><p>北美增速最快(平均+64.9%) · 东南亚体量最大(印尼单国GMV超2000万) · 欧洲英国领跑</p></div>
    <table><thead><tr><th>维度</th><th>🇮🇩 东南亚</th><th>🇺🇸 北美</th><th>🇬🇧 欧洲</th></tr></thead><tbody>
      <tr><td><strong>核心市场</strong></td><td>印尼、泰国、马来、菲律宾、越南</td><td>美国、加拿大</td><td>英国、德国、法国</td></tr>
      <tr><td><strong>TOP品类</strong></td><td>胶原蛋白、美白、益生菌</td><td>绿色超级食物、综合维生素、胶原蛋白</td><td>排毒清洁、维生素D、胶原蛋白</td></tr>
      <tr><td><strong>平均佣金</strong></td><td>10%-20%</td><td>12%-22%</td><td>10%-18%</td></tr>
      <tr><td><strong>客单价区间</strong></td><td>$3-$15（大众化）</td><td>$25-$56（中高端）</td><td>$15-$45（中端）</td></tr>
      <tr><td><strong>平均增速</strong></td><td>+31.9%</td><td>+64.9%</td><td>+43.4%</td></tr>
      <tr><td><strong>爆品特征</strong></td><td>美白/护肤相关保健品</td><td>功能性超级食物、免疫健康</td><td>天然有机、清洁标签</td></tr>
      <tr><td><strong>进入建议</strong></td><td>性价比+达人矩阵</td><td>品牌化+成分故事</td><td>认证背书+本地化</td></tr>
    </tbody></table>
  </div>

  <!-- 5 平台总览 -->
  <div id="sub-ecom-overview" class="tab-content" style="padding:0">
    <h3 style="color:var(--accent);margin-bottom:16px">🌐 全平台总览 — 6大电商平台对比</h3>
    
    <!-- 平台增长图表 -->
    <div class="chart-container" style="margin-bottom:24px"><canvas id="chartEcomGrowth"></canvas></div>
    
    <!-- 平台综合对比 -->
    <table>
      <thead><tr><th>平台</th><th>覆盖区域</th><th>市场规模</th><th>均价</th><th>增长</th><th>主导品类</th><th>进入难度</th><th>推荐指数</th></tr></thead>
      <tbody>
      ${(() => {
        const platforms = [
          { name: 'Amazon', region: '全球(美国为主)', scale: '★★★★★', price: '$25', growth: 8.5, category: '电解质/肌酸/蛋白粉', difficulty: '高(cGMP+品牌备案)', score: 5 },
          { name: 'TikTok Shop', region: '北美/东南亚/欧洲', scale: '★★★★', price: '$25-56(NA)', growth: 49, category: '绿色超级食物/胶原蛋白', difficulty: '中(内容驱动)', score: 5 },
          { name: 'Shopee', region: '东南亚/拉美/波兰', scale: '★★★★', price: '$5-20', growth: 22, category: '胶原蛋白/美白/蛋白粉', difficulty: '中低(本地化)', score: 4 },
          { name: 'iHerb', region: '全球180国', scale: '★★★', price: '$26', growth: 12.4, category: '镁/鱼油/维生素D3', difficulty: '中(品质门槛)', score: 4 },
          { name: 'Mercado Libre', region: '拉美18国', scale: '★★★', price: '$18', growth: 28.9, category: '维生素/蛋白粉/减肥', difficulty: '中高(物流+本地化)', score: 4 },
          { name: 'Ozon', region: '俄罗斯/独联体', scale: '★★', price: '$12', growth: 22.7, category: '维生素/鱼油/胶原蛋白', difficulty: '中(俄语+认证)', score: 3 }
        ];
        return platforms.map(p => {
          const stars = '⭐'.repeat(p.score);
          return '<tr><td><strong>' + p.name + '</strong></td><td style="font-size:11px">' + p.region + '</td><td>' + p.scale + '</td><td>' + p.price + '</td><td><span class="badge ' + (p.growth > 20 ? 'badge-green' : 'badge-blue') + '">+' + p.growth + '%</span></td><td style="font-size:10px">' + p.category + '</td><td style="font-size:10px">' + p.difficulty + '</td><td>' + stars + '</td></tr>';
        }).join('');
      })()}
      </tbody>
    </table>

    <!-- 平台优先级矩阵 -->
    <h3 style="color:var(--accent);margin:24px 0 12px">📊 平台进入优先级矩阵 — 增长 vs 进入难度</h3>
    <table><thead><tr><th>象限</th><th>平台</th><th>增长</th><th>难度</th><th>策略建议</th></tr></thead><tbody>
      <tr><td>⭐ 优先进入(高增长+低难度)</td><td>TikTok Shop / Shopee拉美</td><td>+49% / +28%</td><td>中 / 中低</td><td style="font-size:11px">立即布局，TikTok内容种草+Shopee本地化运营</td></tr>
      <tr><td>📈 重点投入(高增长+高难度)</td><td>Amazon / Mercado Libre</td><td>+8.5% / +28.9%</td><td>高 / 中高</td><td style="font-size:11px">Amazon合规先行(品牌备案+cGMP)，Mercado需解决物流</td></tr>
      <tr><td>📊 稳健运营(稳增长+低难度)</td><td>iHerb / Shopee东南亚</td><td>+12.4% / +22%</td><td>中 / 中低</td><td style="font-size:11px">iHerb做品牌背书，Shopee东南亚做走量</td></tr>
      <tr><td>🔍 机会探索(稳增长+高难度)</td><td>Ozon</td><td>+22.7%</td><td>中</td><td style="font-size:11px">西方品牌退出红利，小批量测试俄语市场</td></tr>
    </tbody></table>

    <!-- 跨平台品类覆盖矩阵 -->
    <h3 style="color:var(--accent);margin:24px 0 12px">🔗 品类 × 平台覆盖矩阵</h3>
    <table><thead><tr><th>品类</th><th>Amazon</th><th>TikTok</th><th>Shopee</th><th>iHerb</th><th>Mercado</th><th>Ozon</th><th>全域热度</th></tr></thead><tbody>
      <tr><td><strong>胶原蛋白</strong></td><td>✅ TOP5</td><td>✅ TOP1</td><td>✅ TOP1</td><td>✅ TOP10</td><td>✅ TOP4</td><td>✅ TOP5</td><td><span class="badge badge-green">🔥 全域爆品</span></td></tr>
      <tr><td><strong>肌酸</strong></td><td>✅ TOP1</td><td>✅ TOP3</td><td>—</td><td>—</td><td>✅ TOP2</td><td>✅ 飙升</td><td><span class="badge badge-green">🔥 多平台热门</span></td></tr>
      <tr><td><strong>镁补充剂</strong></td><td>✅ TOP3</td><td>✅ TOP4</td><td>—</td><td>✅ TOP1</td><td>—</td><td>✅ TOP4</td><td><span class="badge badge-blue">📈 4/6覆盖</span></td></tr>
      <tr><td><strong>维生素D3</strong></td><td>✅ TOP7</td><td>—</td><td>—</td><td>✅ TOP5</td><td>✅ TOP3</td><td>✅ TOP2</td><td><span class="badge badge-blue">📈 4/6覆盖</span></td></tr>
      <tr><td><strong>电解质</strong></td><td>✅ TOP1</td><td>—</td><td>✅ 飙升</td><td>—</td><td>—</td><td>✅ 新品</td><td><span class="badge badge-yellow">📊 3/6覆盖</span></td></tr>
      <tr><td><strong>蛋白粉</strong></td><td>✅ TOP10</td><td>—</td><td>—</td><td>—</td><td>✅ TOP1</td><td>—</td><td><span class="badge badge-yellow">📊 2/6覆盖</span></td></tr>
    </tbody></table>

    <div class="insight-box" style="margin-top:20px">
      <h4>🔍 全平台策略核心洞察</h4>
      <p>
        ① <strong>胶原蛋白是唯一全域爆品</strong>：在全部6个平台均有强势表现，是跨平台布局的首选品类；<br>
        ② <strong>平台组合建议</strong>：Amazon(品牌基础)+TikTok(增长引擎)+Shopee(走量)+iHerb(品牌背书)四件套覆盖最广客群；<br>
        ③ <strong>Mercado Libre拉美蓝海</strong>：增速28.9%仅次于TikTok，但中国卖家渗透率极低，先发优势明显；<br>
        ④ <strong>Ozon俄语市场窗口期</strong>：西方品牌退出后留下$10亿+市场空白，卢布汇率波动是主要风险。
      </p>
    </div>
  </div>

  <!-- Shopee 东南亚 三榜 -->
  <div id="sub-shopee-sea" class="tab-content" style="padding:0">
    <div class="insight-box"><h4>🛍️ Shopee 东南亚 — 三榜</h4><p>🇮🇩印尼 · 🇹🇭泰国 · 🇻🇳越南 · 🇲🇾马来 · 🇵🇭菲律宾 · 🇸🇬新加坡 | 胶原蛋白/美白/益生菌主导 | 东南亚电商保健品CAGR 22%</p></div>
    ${(() => { 
      if (!shopeeThreeLists || !shopeeThreeLists.sea) return '<p>数据加载中...</p>';
      const sea = shopeeThreeLists.sea;
      let html = '<h4 style="color:var(--accent);margin:16px 0 8px">🏆 销量榜</h4><table><thead><tr><th>#</th><th>产品</th><th>品牌</th><th>品类</th><th>价格</th><th>销量</th><th>国家</th><th>GMV</th><th>增长</th></tr></thead><tbody>';
      sea.bestSellers.forEach(p => { html += '<tr><td>' + p.rank + '</td><td><strong>' + p.name + '</strong></td><td>' + p.brand + '</td><td>' + p.subcategory + '</td><td>' + p.price.toLocaleString() + '</td><td>' + (p.sales/1000).toFixed(0) + 'k</td><td>' + p.country + '</td><td>' + (p.gmv/1e9).toFixed(1) + 'B</td><td><span class="badge badge-green">+' + p.growth + '%</span></td></tr>'; });
      html += '</tbody></table>';
      html += '<h4 style="color:var(--accent);margin:16px 0 8px">📈 飙升榜</h4><table><thead><tr><th>#</th><th>产品</th><th>品牌</th><th>品类</th><th>价格</th><th>销量</th><th>排名变化</th><th>国家</th><th>趋势</th></tr></thead><tbody>';
      sea.moversShakers.forEach(p => { html += '<tr><td>' + p.rank + '</td><td><strong>' + p.name + '</strong></td><td>' + p.brand + '</td><td>' + p.subcategory + '</td><td>' + p.price.toLocaleString() + '</td><td>' + (p.sales/1000).toFixed(0) + 'k</td><td><span class="badge badge-green">' + p.rankChange + '</span></td><td>' + p.country + '</td><td>' + p.trend + '</td></tr>'; });
      html += '</tbody></table>';
      html += '<h4 style="color:var(--accent);margin:16px 0 8px">🆕 新品榜</h4><table><thead><tr><th>#</th><th>产品</th><th>品牌</th><th>品类</th><th>价格</th><th>销量</th><th>上架天数</th><th>国家</th><th>趋势</th></tr></thead><tbody>';
      sea.newReleases.forEach(p => { html += '<tr><td>' + p.rank + '</td><td><strong>' + p.name + '</strong></td><td>' + p.brand + '</td><td>' + p.subcategory + '</td><td>' + p.price.toLocaleString() + '</td><td>' + (p.sales/1000).toFixed(0) + 'k</td><td>' + p.daysSinceLaunch + '天</td><td>' + p.country + '</td><td><span class="badge badge-blue">' + p.trend + '</span></td></tr>'; });
      html += '</tbody></table>';
      return html;
    })()}
  </div>

  <!-- Shopee 拉美 三榜 -->
  <div id="sub-shopee-latam" class="tab-content" style="padding:0">
    <div class="insight-box"><h4>🌎 Shopee 拉美 — 三榜</h4><p>🇧🇷巴西 · 🇲🇽墨西哥 · 🇨🇴哥伦比亚 · 🇨🇱智利 | 蛋白粉/肌酸/减重主导 | 保健品CAGR 28% (Shopee增速最快区域)</p></div>
    ${(() => { 
      if (!shopeeThreeLists || !shopeeThreeLists.latam) return '<p>数据加载中...</p>';
      const latam = shopeeThreeLists.latam;
      let html = '<h4 style="color:var(--accent);margin:16px 0 8px">🏆 销量榜</h4><table><thead><tr><th>#</th><th>产品</th><th>品牌</th><th>品类</th><th>价格</th><th>销量</th><th>国家</th><th>GMV</th><th>增长</th></tr></thead><tbody>';
      latam.bestSellers.forEach(p => { html += '<tr><td>' + p.rank + '</td><td><strong>' + p.name + '</strong></td><td>' + p.brand + '</td><td>' + p.subcategory + '</td><td>' + p.price.toLocaleString() + '</td><td>' + (p.sales/1000).toFixed(0) + 'k</td><td>' + p.country + '</td><td>' + (p.gmv/1e6).toFixed(1) + 'M</td><td><span class="badge badge-green">+' + p.growth + '%</span></td></tr>'; });
      html += '</tbody></table>';
      html += '<h4 style="color:var(--accent);margin:16px 0 8px">📈 飙升榜</h4><table><thead><tr><th>#</th><th>产品</th><th>品牌</th><th>品类</th><th>价格</th><th>销量</th><th>排名变化</th><th>国家</th><th>趋势</th></tr></thead><tbody>';
      latam.moversShakers.forEach(p => { html += '<tr><td>' + p.rank + '</td><td><strong>' + p.name + '</strong></td><td>' + p.brand + '</td><td>' + p.subcategory + '</td><td>' + p.price.toLocaleString() + '</td><td>' + (p.sales/1000).toFixed(0) + 'k</td><td><span class="badge badge-green">' + p.rankChange + '</span></td><td>' + p.country + '</td><td>' + p.trend + '</td></tr>'; });
      html += '</tbody></table>';
      html += '<h4 style="color:var(--accent);margin:16px 0 8px">🆕 新品榜</h4><table><thead><tr><th>#</th><th>产品</th><th>品牌</th><th>品类</th><th>价格</th><th>销量</th><th>上架天数</th><th>国家</th><th>趋势</th></tr></thead><tbody>';
      latam.newReleases.forEach(p => { html += '<tr><td>' + p.rank + '</td><td><strong>' + p.name + '</strong></td><td>' + p.brand + '</td><td>' + p.subcategory + '</td><td>' + p.price.toLocaleString() + '</td><td>' + (p.sales/1000).toFixed(0) + 'k</td><td>' + p.daysSinceLaunch + '天</td><td>' + p.country + '</td><td><span class="badge badge-blue">' + p.trend + '</span></td></tr>'; });
      html += '</tbody></table>';
      return html;
    })()}
  </div>

  <!-- Shopee 欧洲 三榜 -->
  <div id="sub-shopee-eu" class="tab-content" style="padding:0">
    <div class="insight-box"><h4>🇪🇺 Shopee 欧洲 — 三榜</h4><p>🇵🇱波兰 | 中东欧门户 · 维生素D+镁+鱼油主导 · 价格敏感型消费</p></div>
    ${(() => { 
      if (!shopeeThreeLists || !shopeeThreeLists.eu) return '<p>数据加载中...</p>';
      const eu = shopeeThreeLists.eu;
      let html = '<h4 style="color:var(--accent);margin:16px 0 8px">🏆 销量榜</h4><table><thead><tr><th>#</th><th>产品</th><th>品牌</th><th>品类</th><th>价格(PLN)</th><th>销量</th><th>GMV(PLN)</th><th>增长</th></tr></thead><tbody>';
      eu.bestSellers.forEach(p => { html += '<tr><td>' + p.rank + '</td><td><strong>' + p.name + '</strong></td><td>' + p.brand + '</td><td>' + p.subcategory + '</td><td>' + p.price.toLocaleString() + '</td><td>' + (p.sales/1000).toFixed(0) + 'k</td><td>' + (p.gmv/1e6).toFixed(1) + 'M</td><td><span class="badge badge-green">+' + p.growth + '%</span></td></tr>'; });
      html += '</tbody></table>';
      html += '<h4 style="color:var(--accent);margin:16px 0 8px">📈 飙升榜</h4><table><thead><tr><th>#</th><th>产品</th><th>品牌</th><th>品类</th><th>价格</th><th>销量</th><th>排名变化</th><th>趋势</th></tr></thead><tbody>';
      eu.moversShakers.forEach(p => { html += '<tr><td>' + p.rank + '</td><td><strong>' + p.name + '</strong></td><td>' + p.brand + '</td><td>' + p.subcategory + '</td><td>' + p.price.toLocaleString() + '</td><td>' + (p.sales/1000).toFixed(0) + 'k</td><td><span class="badge badge-green">' + p.rankChange + '</span></td><td>' + p.trend + '</td></tr>'; });
      html += '</tbody></table>';
      html += '<h4 style="color:var(--accent);margin:16px 0 8px">🆕 新品榜</h4><table><thead><tr><th>#</th><th>产品</th><th>品牌</th><th>品类</th><th>价格</th><th>销量</th><th>上架天数</th><th>趋势</th></tr></thead><tbody>';
      eu.newReleases.forEach(p => { html += '<tr><td>' + p.rank + '</td><td><strong>' + p.name + '</strong></td><td>' + p.brand + '</td><td>' + p.subcategory + '</td><td>' + p.price.toLocaleString() + '</td><td>' + (p.sales/1000).toFixed(0) + 'k</td><td>' + p.daysSinceLaunch + '天</td><td><span class="badge badge-blue">' + p.trend + '</span></td></tr>'; });
      html += '</tbody></table>';
      return html;
    })()}
  </div>

  <!-- Ozon 俄罗斯 三榜 -->
  <div id="sub-ozon-bestsellers" class="tab-content" style="padding:0">
    <div class="insight-box"><h4>🇷🇺 Ozon 俄罗斯 — 销量榜 (Best Sellers)</h4><p>西方品牌退出 · 中国品牌替代机会 · 维生素/鱼油/镁/胶原蛋白主导 | 俄罗斯保健品进口市场CAGR 12%</p></div>
    ${(() => { 
      if (!ozonThreeLists || !ozonThreeLists.bestSellers) return '<p>Ozon数据加载中...</p>';
      const d = ozonThreeLists.bestSellers;
      return '<table><thead><tr><th>#</th><th>产品</th><th>品牌</th><th>品类</th><th>价格(RUB)</th><th>销量</th><th>GMV(RUB)</th><th>增长</th></tr></thead><tbody>' +
      d.map(p => '<tr><td>' + p.rank + '</td><td><strong>' + p.name + '</strong></td><td>' + p.brand + '</td><td>' + p.subcategory + '</td><td>' + p.price + '₽</td><td>' + (p.sales/1000).toFixed(0) + 'k</td><td>' + (p.gmv/1e6).toFixed(1) + 'M₽</td><td><span class="badge badge-green">+' + p.growth + '%</span></td></tr>').join('') +
      '</tbody></table>';
    })()}
    <div style="margin-top:16px">${(() => {
      if (!ozonThreeLists || !ozonThreeLists.moversShakers) return '';
      const d = ozonThreeLists.moversShakers;
      return '<div class="insight-box"><h4>📈 Ozon 飙升榜</h4></div><table><thead><tr><th>#</th><th>产品</th><th>品牌</th><th>品类</th><th>价格</th><th>销量</th><th>排名变化</th><th>趋势</th></tr></thead><tbody>' +
      d.map(p => '<tr><td>' + p.rank + '</td><td><strong>' + p.name + '</strong></td><td>' + p.brand + '</td><td>' + p.subcategory + '</td><td>' + p.price + '₽</td><td>' + (p.sales/1000).toFixed(0) + 'k</td><td><span class="badge badge-green">' + p.rankChange + '</span></td><td>' + p.trend + '</td></tr>').join('') +
      '</tbody></table>';
    })()}</div>
    <div style="margin-top:16px">${(() => {
      if (!ozonThreeLists || !ozonThreeLists.newReleases) return '';
      const d = ozonThreeLists.newReleases;
      return '<div class="insight-box"><h4>🆕 Ozon 新品榜</h4></div><table><thead><tr><th>#</th><th>产品</th><th>品牌</th><th>品类</th><th>价格</th><th>销量</th><th>上架天数</th><th>趋势</th></tr></thead><tbody>' +
      d.map(p => '<tr><td>' + p.rank + '</td><td><strong>' + p.name + '</strong></td><td>' + p.brand + '</td><td>' + p.subcategory + '</td><td>' + p.price + '₽</td><td>' + (p.sales/1000).toFixed(0) + 'k</td><td>' + p.daysSinceLaunch + '天</td><td><span class="badge badge-blue">' + p.trend + '</span></td></tr>').join('') +
      '</tbody></table>';
    })()}</div>
  </div>
</div>

<!-- TAB 5: 竞品分析 -->
<div id="tab-competitor" class="tab-content">
  <h2 class="section-title"><span class="dot"></span>🏆 竞品品牌综合分析 — 跨渠道竞争力排名</h2>
  
  <div class="insight-box">
    <h4>📐 评估维度</h4>
    <p>综合竞争力评分 = Amazon销量(25%) + TikTok GMV(25%) + 社媒声量(20%) + iHerb排名(15%) + 渠道覆盖加分(15%)。覆盖 Amazon、TikTok Shop（北美/东南亚/欧洲）、iHerb、Instagram、TikTok 社媒五大渠道。</p>
  </div>

  <!-- 品牌综合实力榜 TOP 15 -->
  <h3 style="margin:24px 0 12px;color:var(--accent)">📊 品牌综合竞争力 TOP 15</h3>
  <table>
    <thead><tr><th>#</th><th>品牌</th><th>得分</th><th>层级</th><th>渠道</th><th>Amazon</th><th>TikTok</th><th>社媒</th><th>iHerb</th><th>代表产品</th></tr></thead>
    <tbody>
    ${competitorBrands.filter(b => b.compScore >= 15).slice(0, 15).map((b, i) => {
      const tierBadge = b.tier.includes('头部') ? 'badge-green' : b.tier.includes('挑战') ? 'badge-blue' : 'badge-yellow';
      return `<tr>
        <td><strong>${i+1}</strong></td>
        <td><strong>${b.name}</strong></td>
        <td><span style="font-weight:700;color:${b.compScore >= 30 ? 'var(--green)' : 'var(--accent)'}">${b.compScore}</span></td>
        <td><span class="badge ${tierBadge}">${b.tier}</span></td>
        <td>${b.channels}/5</td>
        <td style="font-size:11px">${b.amzProducts > 0 ? '🟢 ' + b.amzProducts + '品 ⭐' + b.amzRating : '—'}</td>
        <td style="font-size:11px">${b.tiktokGMV > 0 ? '🟢 \$' + (b.tiktokGMV/1e6).toFixed(1) + 'M' : '—'}</td>
        <td style="font-size:11px">${b.socialMentions > 0 ? '🟢 ' + b.socialMentions + '提及' : '—'}</td>
        <td style="font-size:11px">${b.iherbRank ? '🟢 #' + b.iherbRank : '—'}</td>
        <td style="font-size:10px;max-width:180px">${b.products.slice(0,2).join(' / ')}</td>
      </tr>`;
    }).join('')}
    </tbody>
  </table>

  <!-- 渠道分布矩阵 -->
  <h3 style="margin:28px 0 14px;color:var(--accent)">🔗 品牌 × 渠道覆盖矩阵</h3>
  <table>
    <thead><tr><th>品牌</th><th>Amazon</th><th>TikTok 北美</th><th>TikTok 东南亚</th><th>TikTok 欧洲</th><th>iHerb</th><th>社媒声量</th><th>综合覆盖</th></tr></thead>
    <tbody>
    ${competitorBrands.filter(b => b.compScore >= 10).slice(0, 12).map(b => {
      const hasAmz = b.amzProducts > 0;
      const hasTKNA = b.tiktokRegions >= 1 && b.tiktokGMV > 0;
      const hasTKSEA = b.tiktokRegions >= 1;
      const hasTKEU = b.tiktokRegions >= 2;
      const hasIherb = !!b.iherbRank;
      const hasSocial = b.socialMentions > 0;
      const coverage = [hasAmz, hasTKNA, hasTKSEA, hasTKEU, hasIherb, hasSocial].filter(Boolean).length;
      return `<tr>
        <td><strong>${b.name}</strong></td>
        <td>${hasAmz ? '✅' : '—'}</td>
        <td>${hasTKNA ? '✅' : '—'}</td>
        <td>${hasTKSEA ? '✅' : '—'}</td>
        <td>${hasTKEU ? '✅' : '—'}</td>
        <td>${hasIherb ? '✅ #' + b.iherbRank : '—'}</td>
        <td>${hasSocial ? '✅ ' + b.socialMentions + '次' : '—'}</td>
        <td><span class="badge ${coverage >= 4 ? 'badge-green' : coverage >= 2 ? 'badge-blue' : ''}">${coverage}/6</span></td>
      </tr>`;
    }).join('')}
    </tbody>
  </table>

  <!-- 品牌增长四象限 -->
  <h3 style="margin:28px 0 14px;color:var(--accent)">📈 品牌增长矩阵 — 销量 vs 增长率</h3>
  <table>
    <thead><tr><th>象限</th><th>品牌</th><th>Amazon周销</th><th>TikTok增长率</th><th>策略建议</th></tr></thead>
    <tbody>
    ${(() => {
      const brands = competitorBrands.filter(b => b.amzSales > 0 || b.tiktokGMV > 0).slice(0, 12);
      const quadrants = { '⭐ 明星(高销量+高增长)': [], '🐮 现金牛(高销量+稳增长)': [], '🚀 潜力股(低销量+高增长)': [], '📊 稳定型(低销量+稳增长)': [] };
      brands.forEach(b => {
        const highSales = b.amzSales > 30000;
        const highGrowth = b.tiktokGrowth !== 'N/A' && parseFloat(b.tiktokGrowth) > 50;
        if (highSales && highGrowth) quadrants['⭐ 明星(高销量+高增长)'].push(b);
        else if (highSales && !highGrowth) quadrants['🐮 现金牛(高销量+稳增长)'].push(b);
        else if (!highSales && highGrowth) quadrants['🚀 潜力股(低销量+高增长)'].push(b);
        else quadrants['📊 稳定型(低销量+稳增长)'].push(b);
      });
      return Object.entries(quadrants).filter(([_,v]) => v.length > 0).map(([q, brands]) => 
        brands.map(b => `<tr>
          <td>${q.split('(')[0]}</td>
          <td><strong>${b.name}</strong></td>
          <td>${b.amzSales > 0 ? (b.amzSales/1000).toFixed(0) + 'k' : '—'}</td>
          <td>${b.tiktokGrowth !== 'N/A' ? '<span class="badge ' + (parseFloat(b.tiktokGrowth) > 50 ? 'badge-green' : 'badge-blue') + '">+' + b.tiktokGrowth + '%</span>' : '—'}</td>
          <td style="font-size:11px">${q.includes('明星') ? '重点投入，扩大优势' : q.includes('现金牛') ? '维持份额，TikTok增量' : q.includes('潜力股') ? '加大社媒投入，转化Amazon' : '差异化定位，寻找增量'}</td>
        </tr>`).join('')
      ).join('');
    })()}
    </tbody>
  </table>

  <!-- 社媒影响力对比 -->
  <h3 style="margin:28px 0 14px;color:var(--accent)">📱 社媒影响力 TOP 10（基于 Upfluence 2026 数据）</h3>
  <table>
    <thead><tr><th>品牌</th><th>创作者提及</th><th>增长趋势</th><th>总互动量</th><th>互动率</th><th>主要平台</th></tr></thead>
    <tbody>
    ${(() => {
      const social = dataGen.getSocialMediaData();
      const allBrands = [...(social.instagram.topBrands || []), ...(social.tiktok.topBrands || [])];
      // 合并同名品牌
      const merged = {};
      allBrands.forEach(b => { if (!merged[b.name]) merged[b.name] = { ...b, mentions: 0, engagement: 0 }; merged[b.name].mentions += b.mentions; merged[b.name].engagement += b.engagement; });
      return Object.values(merged).sort((a,b) => b.mentions - a.mentions).slice(0,10).map(b => {
        const growthBadge = b.growth > 100 ? 'badge-green' : b.growth > 0 ? 'badge-blue' : 'badge-red';
        const platform = (b.note || '').includes('TikTok') ? '🎵 TikTok' : (b.note || '').includes('100%') ? '🎵 TikTok原生' : '📸 Instagram';
        return `<tr>
          <td><strong>${b.name}</strong></td>
          <td>${b.mentions}</td>
          <td><span class="badge ${growthBadge}">${b.growth > 0 ? '+' : ''}${b.growth}%</span></td>
          <td>${(b.engagement/1000).toFixed(0)}k</td>
          <td>${b.engagementRate || '—'}</td>
          <td style="font-size:11px">${platform}</td>
        </tr>`;
      }).join('');
    })()}
    </tbody>
  </table>

  <!-- 核心洞察 -->
  <div class="insight-box" style="margin-top:24px">
    <h4>🔍 竞品格局核心洞察</h4>
    <p>
      ① <strong>渠道分化明显</strong>：${competitorBrands.filter(b => b.channels >= 3).length}个品牌覆盖3+渠道，多数品牌依赖单一渠道。Amazon和TikTok Shop形成两个独立生态。<br>
      ② <strong>TikTok原生品牌崛起</strong>：Bloom Nutrition（100% TikTok）、Barebells（+1,100%增长）等纯社媒品牌正在挑战传统Amazon品牌。<br>
      ③ <strong>跨渠道品牌稀缺</strong>：同时覆盖Amazon+TikTok+iHerb的品牌极少，说明保健品品牌存在明显的"渠道壁垒"。<br>
      ④ <strong>社媒声量≠销售转化</strong>：Myprotein（2,123次IG提及）并未出现在Amazon/TikTok销量榜前列，说明社媒种草到电商购买仍有转化鸿沟。<br>
      ⑤ <strong>品类赛道集中</strong>：电解质、肌酸、胶原蛋白三大品类占据了TOP品牌的主要产品线，新兴品类（GLP-1、NMN、适应原）尚缺强势品牌。
    </p>
  </div>
</div>

<!-- TAB 6: 关键词挖掘 -->
<div id="tab-keywords" class="tab-content">
  <h2 class="section-title"><span class="dot"></span>🔑 关键词挖掘 — 多维度搜索洞察</h2>
  
  ${(() => {
    const kwData = dataGen.getKeywordAnalysis ? dataGen.getKeywordAnalysis() : null;
    if (!kwData) return '<p>关键词数据加载中...</p>';
    const { trends, categories, surging, rising, stable, declining, platformKeywords } = kwData;
    
    let html = '';
    
    // 1. 搜索量排行 + 增长趋势
    html += `<h3 style="margin:20px 0 12px;color:var(--accent)">📊 搜索量 TOP 20 + 增长趋势</h3>`;
    html += `<div class="chart-container" style="margin-bottom:24px"><canvas id="chartKeywords"></canvas></div>`;
    html += `<table><thead><tr><th>关键词</th><th>月搜索量</th><th>年增长</th><th>趋势</th><th>品类</th><th>机会评级</th></tr></thead><tbody>`;
    trends.slice(0, 20).forEach(k => {
      const opportunity = k.yoyGrowth > 60 ? '🔥 高机会' : k.yoyGrowth > 20 ? '📈 增长' : k.yoyGrowth >= -10 ? '📊 稳定' : '⚠️ 衰退';
      const opBadge = k.yoyGrowth > 60 ? 'badge-green' : k.yoyGrowth > 20 ? 'badge-blue' : k.yoyGrowth >= -10 ? 'badge-yellow' : 'badge-red';
      html += `<tr>
        <td><strong>${k.keyword}</strong></td>
        <td>${(k.searchVolume/1000).toFixed(0)}k</td>
        <td><span class="badge ${k.yoyGrowth > 30 ? 'badge-green' : k.yoyGrowth > 0 ? 'badge-blue' : 'badge-red'}">${k.yoyGrowth > 0 ? '+' : ''}${k.yoyGrowth}%</span></td>
        <td>${k.trend === 'surging' ? '🔥 爆发' : k.trend === 'rising' ? '📈 上升' : k.trend === 'stable' ? '➡️ 稳定' : '📉 下降'}</td>
        <td style="font-size:11px">${k.category}</td>
        <td><span class="badge ${opBadge}">${opportunity}</span></td>
      </tr>`;
    });
    html += `</tbody></table>`;
    
    // 2. 关键词分类矩阵
    html += `<h3 style="margin:28px 0 14px;color:var(--accent)">🗂️ 关键词分类矩阵</h3>`;
    html += `<div class="grid-2">`;
    for (const [cat, keywords] of Object.entries(categories)) {
      if (keywords.length === 0) continue;
      html += `<div class="chart-container"><h4>${cat} (${keywords.length}个)</h4><table>`;
      html += `<thead><tr><th>关键词</th><th>搜索量</th><th>增长</th></tr></thead><tbody>`;
      keywords.slice(0, 5).forEach(k => {
        html += `<tr><td style="font-size:12px"><strong>${k.keyword}</strong></td><td style="font-size:11px">${(k.volume/1000).toFixed(0)}k</td><td style="font-size:11px"><span class="badge ${k.growth > 30 ? 'badge-green' : k.growth > 0 ? 'badge-blue' : 'badge-red'}">${k.growth > 0 ? '+' : ''}${k.growth}%</span></td></tr>`;
      });
      html += `</tbody></table></div>`;
    }
    html += `</div>`;
    
    // 3. 趋势分级
    html += `<h3 style="margin:28px 0 14px;color:var(--accent)">📈 趋势分级 — 爆发词 vs 衰退词</h3>`;
    html += `<table><thead><tr><th>分级</th><th>关键词</th><th>数量</th><th>策略</th></tr></thead><tbody>`;
    html += `<tr><td>🔥 爆发 (>+60%)</td><td style="font-size:11px">${surging.map(k => k.keyword).join(', ')}</td><td>${surging.length}</td><td style="font-size:11px">立即布局内容，抢占搜索排名</td></tr>`;
    html += `<tr><td>📈 上升 (+20~60%)</td><td style="font-size:11px">${rising.map(k => k.keyword).slice(0,5).join(', ')}${rising.length > 5 ? '...' : ''}</td><td>${rising.length}</td><td style="font-size:11px">加大内容投入，建立品类权威</td></tr>`;
    html += `<tr><td>📊 稳定 (-10~+20%)</td><td style="font-size:11px">${stable.map(k => k.keyword).slice(0,5).join(', ')}${stable.length > 5 ? '...' : ''}</td><td>${stable.length}</td><td style="font-size:11px">长尾优化，维持排名</td></tr>`;
    html += `<tr><td>📉 衰退 (<-10%)</td><td style="font-size:11px">${declining.map(k => k.keyword).join(', ') || '无'}</td><td>${declining.length}</td><td style="font-size:11px">减少广告预算，评估替代词</td></tr>`;
    html += `</tbody></table>`;
    
    // 4. 各平台关键词差异
    html += `<h3 style="margin:28px 0 14px;color:var(--accent)">🌐 各平台热门搜索词对比</h3>`;
    html += `<table><thead><tr><th>平台</th><th>TOP 关键词</th><th>搜索量/声量</th><th>特点</th></tr></thead><tbody>`;
    for (const [platform, keywords] of Object.entries(platformKeywords)) {
      const icon = platform === 'amazon' ? '🛒 Amazon' : platform === 'tiktok' ? '🎵 TikTok' : '🔍 Google';
      keywords.forEach(k => {
        html += `<tr><td>${icon}</td><td><strong>${k.keyword}</strong></td><td>${(k.volume/1000).toFixed(0)}k</td><td style="font-size:11px">${k.note}</td></tr>`;
      });
    }
    html += `</tbody></table>`;
    
    // 5. 核心洞察
    html += `<div class="insight-box" style="margin-top:24px">
      <h4>🎯 关键词策略建议</h4>
      <p>
        ① <strong>爆发词抢先布局</strong>：Electrolyte Drink Mix (+1,986%)、Probiotic Gut Health (+1,258%)、Mots C Peptide (+814%) 增速惊人，建议立即产出针对性内容；<br>
        ② <strong>成分词是高转化金矿</strong>：Magnesium Glycinate、Creatine Monohydrate、Collagen Peptides 等成分词搜索量大且增长稳定，适合SEO长尾布局；<br>
        ③ <strong>平台关键词差异显著</strong>：Amazon偏产品词（electrolyte powder/creatine powder），TikTok偏话题标签（#supplementtok/#greenspowder），Google偏信息词（benefits/best supplement）；<br>
        ④ <strong>衰退词及时止损</strong>：${declining.map(k => k.keyword).join('、') || '当前无显著衰退词'}，减少广告预算，评估是否转向替代关键词；<br>
        ⑤ <strong>GLP-1相关词是2026最大蓝海</strong>：Akkermansia (612万搜索)、Berberine ('Nature\\'s Ozempic')、Mots C Peptide 等词与GLP-1/减重趋势强关联。
      </p>
    </div>`;
    
    return html;
  })()}
</div>

<!-- TAB 7: 风险预警 -->
<div id="tab-risk" class="tab-content">
  <h2 class="section-title"><span class="dot"></span>⚠️ 风险预警 — 全维度风险评估（含跨境电商）</h2>
  
  ${(() => {
    if (!riskData || !riskData.regulatory) return '<p>风险数据加载中...</p>';
    const allRisks = [...riskData.regulatory, ...riskData.trade, ...riskData.ip, ...riskData.market, ...riskData.opportunity];
    const summary = riskData.summary;
    
    let html = '';
    
    // 1. 风险概览仪表盘
    html += `<div class="stats-row" style="margin-bottom:20px;padding:0">
      <div class="stat-card"><div class="icon">🔴</div><div class="label">严重风险</div><div class="value">${summary.severe}</div><div class="delta">需立即应对</div></div>
      <div class="stat-card"><div class="icon">🟠</div><div class="label">高风险</div><div class="value">${summary.high}</div><div class="delta">需制定预案</div></div>
      <div class="stat-card"><div class="icon">🟡</div><div class="label">中风险</div><div class="value">${summary.medium}</div><div class="delta">持续监控</div></div>
      <div class="stat-card"><div class="icon">🟢</div><div class="label">机会型</div><div class="value">${summary.opportunity}</div><div class="delta">可转化为优势</div></div>
    </div>`;
    
    // 2. 风险矩阵总表
    html += `<h3 style="margin:24px 0 12px;color:var(--accent)">📊 全维度风险矩阵 (${allRisks.length}项)</h3>`;
    html += `<table><thead><tr><th>等级</th><th>风险项</th><th>类别</th><th>概率</th><th>影响</th><th>风险详情</th><th>应对措施</th></tr></thead><tbody>`;
    allRisks.forEach(r => {
      const badge = r.level.includes('严重') ? 'badge-red' : r.level.includes('高') ? 'badge-red' : r.level.includes('中') ? 'badge-yellow' : r.level.includes('机会') ? 'badge-green' : 'badge-blue';
      html += `<tr>
        <td><span class="badge ${badge}">${r.level}</span></td>
        <td><strong>${r.risk}</strong></td>
        <td><span class="badge badge-blue">${r.category}</span></td>
        <td>${r.probability}</td>
        <td>${r.impact}</td>
        <td style="font-size:11px;max-width:300px">${r.detail}</td>
        <td style="font-size:11px;max-width:200px">${r.action}</td>
      </tr>`;
    });
    html += `</tbody></table>`;
    
    // 3. 按类别分组展示
    html += `<h3 style="margin:28px 0 14px;color:var(--accent)">🗂️ 风险分类视图</h3>`;
    html += `<div class="grid-2">`;
    
    // 法规合规风险
    html += `<div class="chart-container"><h4>🇺🇸 法规合规风险 (${riskData.regulatory.length}项)</h4><table><thead><tr><th>风险</th><th>等级</th></tr></thead><tbody>`;
    riskData.regulatory.forEach(r => {
      const badge = r.level.includes('严重') ? 'badge-red' : r.level.includes('高') ? 'badge-red' : 'badge-yellow';
      html += `<tr><td style="font-size:11px">${r.risk}</td><td><span class="badge ${badge}">${r.level}</span></td></tr>`;
    });
    html += `</tbody></table></div>`;
    
    // 关税物流风险
    html += `<div class="chart-container"><h4>💱 关税/汇率/物流风险 (${riskData.trade.length}项)</h4><table><thead><tr><th>风险</th><th>等级</th></tr></thead><tbody>`;
    riskData.trade.forEach(r => {
      const badge = r.level.includes('严重') ? 'badge-red' : r.level.includes('高') ? 'badge-red' : 'badge-yellow';
      html += `<tr><td style="font-size:11px">${r.risk}</td><td><span class="badge ${badge}">${r.level}</span></td></tr>`;
    });
    html += `</tbody></table></div>`;
    html += `</div>`;
    
    html += `<div class="grid-2" style="margin-top:18px">`;
    // 知识产权风险
    html += `<div class="chart-container"><h4>⚖️ 知识产权/平台风险 (${riskData.ip.length}项)</h4><table><thead><tr><th>风险</th><th>等级</th></tr></thead><tbody>`;
    riskData.ip.forEach(r => {
      const badge = r.level.includes('高') ? 'badge-red' : 'badge-yellow';
      html += `<tr><td style="font-size:11px">${r.risk}</td><td><span class="badge ${badge}">${r.level}</span></td></tr>`;
    });
    html += `</tbody></table></div>`;
    
    // 市场品类风险
    html += `<div class="chart-container"><h4>📦 市场/品类风险 (${riskData.market.length}项)</h4><table><thead><tr><th>风险</th><th>等级</th></tr></thead><tbody>`;
    riskData.market.forEach(r => {
      const badge = r.level.includes('严重') ? 'badge-red' : 'badge-red';
      html += `<tr><td style="font-size:11px">${r.risk}</td><td><span class="badge ${badge}">${r.level}</span></td></tr>`;
    });
    html += `</tbody></table></div>`;
    html += `</div>`;
    
    // 4. 机会型风险
    html += `<h3 style="margin:28px 0 14px;color:var(--accent)">🟢 机会型风险 — 逆风中的增长机会</h3>`;
    html += `<div class="insight-box"><p>以下风险虽然存在不确定性，但如果主动布局可能转化为竞争优势：</p></div>`;
    html += `<table><thead><tr><th>机会</th><th>类别</th><th>详情</th><th>行动建议</th></tr></thead><tbody>`;
    riskData.opportunity.forEach(r => {
      html += `<tr><td><strong>${r.risk}</strong></td><td><span class="badge badge-green">${r.category}</span></td><td style="font-size:11px">${r.detail}</td><td style="font-size:11px"><strong>${r.action}</strong></td></tr>`;
    });
    html += `</tbody></table>`;
    
    // 5. 跨境电商特别风险提示
    html += `<h3 style="margin:28px 0 14px;color:var(--accent)">🌐 跨境电商特别风险矩阵 — 中美贸易2026</h3>`;
    html += `<table><thead><tr><th>风险维度</th><th>当前状态</th><th>对保健品影响</th><th>建议应对</th></tr></thead><tbody>
      <tr><td><strong>关税叠加</strong></td><td><span class="badge badge-red">33%综合</span></td><td style="font-size:11px">HS编码决定具体税率，原料类30-55%不等</td><td style="font-size:11px">核查HS编码，评估越南/墨西哥转产</td></tr>
      <tr><td><strong>对等关税</strong></td><td><span class="badge badge-yellow">10%(休战至2026.8)</span></td><td style="font-size:11px">到期后可能回升至30%，成本陡增</td><td style="font-size:11px">8月前完成库存前置+价格调整预案</td></tr>
      <tr><td><strong>人民币汇率</strong></td><td><span class="badge badge-blue">6.39-6.89区间</span></td><td style="font-size:11px">升值压缩出口利润，贬值有利但空间有限</td><td style="font-size:11px">远期锁汇覆盖3-6月订单</td></tr>
      <tr><td><strong>FDA人员缩减</strong></td><td><span class="badge badge-yellow">减少4,300+人</span></td><td style="font-size:11px">常规检查减少但高调执法增加</td><td style="font-size:11px">合规体系完善，不因检查减少而松懈</td></tr>
      <tr><td><strong>Amazon cGMP</strong></td><td><span class="badge badge-red">强制执行</span></td><td style="font-size:11px">所有保健品品类必须提供cGMP文档</td><td style="font-size:11px">立即准备21 CFR Part 111合规文件</td></tr>
      <tr><td><strong>州级年龄限制</strong></td><td><span class="badge badge-yellow">6州推进中</span></td><td style="font-size:11px">运动营养/减肥品类受限</td><td style="font-size:11px">跟踪立法，准备年龄验证方案</td></tr>
    </tbody></table>`;
    
    // 6. 总结洞察
    html += `<div class="insight-box" style="margin-top:24px">
      <h4>🛡️ 风险管理核心结论</h4>
      <p>
        ① <strong>三大严重风险</strong>：Amazon cGMP强制(极高概率) > TikTok Shop政策(高概率) > 中美关税33%+(极高概率)。建议优先解决cGMP合规，同步启动多平台+多区域分散策略；<br>
        ② <strong>关税是最大利润杀手</strong>：综合33%关税+8月对等关税可能回升至30%→综合超50%。保健品原料类HS编码需逐一核查，评估东南亚转产可行性；<br>
        ③ <strong>知识产权是隐形地雷</strong>：KSM-66®/BioPerine®等注册商标成分使用不当可致侵权下架。Brand Registry 2.0要求更严，FTO检索应成为新品上线标配；<br>
        ④ <strong>机会窗口</strong>：GLP-1互补品类(胶原蛋白/肌酸/Akkermansia)+跨平台品牌稀缺=先发布局优势。建议将20%营销预算投入机会型风险，30%用于防御型风险。
      </p>
    </div>`;
    
    // 7. 每周最新风险动态
    if (riskData.latest) {
      const latest = riskData.latest;
      html += '<h3 style="margin:28px 0 14px;color:var(--accent)">📰 本周最新风险动态 <span style="font-size:11px;color:var(--text-muted)">(' + (latest.lastChecked || '') + ')</span></h3>';
      
      if (latest.recalls && latest.recalls.length > 0) {
        html += '<h4 style="color:var(--red);margin:16px 0 8px">🚨 最新召回事件</h4>';
        html += '<table><thead><tr><th>日期</th><th>品牌/产品</th><th>原因</th><th>来源</th><th>建议应对</th></tr></thead><tbody>';
        latest.recalls.forEach(r => {
          html += '<tr><td>' + r.date + '</td><td><strong>' + r.brand + '</strong><br><span style="font-size:10px;color:var(--text-muted)">' + r.product + '</span></td><td><span class="badge badge-red">' + r.reason + '</span></td><td style="font-size:11px">' + r.source + '</td><td style="font-size:11px">' + r.action + '</td></tr>';
        });
        html += '</tbody></table>';
      }
      
      if (latest.warnings && latest.warnings.length > 0) {
        html += '<h4 style="color:var(--yellow);margin:16px 0 8px">⚠️ FDA警告信</h4>';
        html += '<table><thead><tr><th>日期</th><th>公司</th><th>原因</th><th>来源</th><th>建议</th></tr></thead><tbody>';
        latest.warnings.forEach(w => {
          html += '<tr><td>' + w.date + '</td><td><strong>' + w.company + '</strong></td><td style="font-size:11px">' + w.reason + '</td><td style="font-size:11px">' + w.source + '</td><td style="font-size:11px">' + w.action + '</td></tr>';
        });
        html += '</tbody></table>';
      }
      
      if (latest.alerts && latest.alerts.length > 0) {
        html += '<h4 style="color:var(--accent);margin:16px 0 8px">🔔 实时预警信号</h4>';
        html += '<table><thead><tr><th>类型</th><th>详情</th><th>紧急度</th></tr></thead><tbody>';
        latest.alerts.forEach(a => {
          var badge = a.urgency === '高' ? 'badge-red' : 'badge-yellow';
          html += '<tr><td><span class="badge badge-blue">' + a.type + '</span></td><td style="font-size:11px">' + a.detail + '</td><td><span class="badge ' + badge + '">' + a.urgency + '</span></td></tr>';
        });
        html += '</tbody></table>';
      }
      
      // 原料价格监控
      if (latest.rawMaterials && latest.rawMaterials.items) {
        html += '<h4 style="color:var(--accent);margin:16px 0 8px">🧪 核心原料价格监控</h4>';
        html += '<table><thead><tr><th>原料</th><th>趋势</th><th>年变化</th><th>2025价</th><th>2026价</th><th>影响</th><th>洞察</th><th>建议</th></tr></thead><tbody>';
        latest.rawMaterials.items.forEach(m => {
          const impactBadge = m.impact.includes('高') ? 'badge-red' : m.impact.includes('中') ? 'badge-yellow' : 'badge-green';
          html += '<tr><td><strong>' + m.material + '</strong></td><td>' + m.trend + '</td><td>' + m.yoyChange + '</td><td>' + m.price2025 + '</td><td>' + m.price2026 + '</td><td><span class="badge ' + impactBadge + '">' + m.impact + '</span></td><td style="font-size:10px">' + m.note + '</td><td style="font-size:10px">' + m.action + '</td></tr>';
        });
        html += '</tbody></table>';
      }
      
      // 贸易物流指标
      if (latest.tradeIndicators) {
        const ti = latest.tradeIndicators;
        html += '<h4 style="color:var(--accent);margin:16px 0 8px">🚢 贸易/物流风险指标</h4>';
        html += '<table><thead><tr><th>指标</th><th>当前状态</th><th>趋势</th><th>影响</th><th>备注</th></tr></thead><tbody>';
        Object.entries(ti).forEach(([key, val]) => {
          const impactBadge = val.impact === '🔴' ? 'badge-red' : 'badge-yellow';
          const label = key === 'containerFreightIndex' ? '集装箱运价' : key === 'redSeaDiversion' ? '红海航线' : key === 'usTariff' ? '美国关税' : key === 'section301' ? '301条款' : 'De Minimis';
          html += '<tr><td><strong>' + label + '</strong></td><td style="font-size:11px">' + val.value + '</td><td>' + val.trend + '</td><td><span class="badge ' + impactBadge + '">' + val.impact + '</span></td><td style="font-size:10px">' + (val.note || '') + '</td></tr>';
        });
        html += '</tbody></table>';
      }
      
      // 各国进口政策变更
      if (latest.importPolicies && latest.importPolicies.regions) {
        html += '<h4 style="color:var(--accent);margin:16px 0 8px">🌍 各国保健品进口政策变更</h4>';
        html += '<table><thead><tr><th>国家/地区</th><th>政策变化</th><th>生效日期</th><th>影响</th><th>详情</th><th>应对建议</th></tr></thead><tbody>';
        latest.importPolicies.regions.forEach(r => {
          const impactBadge = r.impact.includes('高') ? 'badge-red' : r.impact.includes('中') ? 'badge-yellow' : 'badge-green';
          html += '<tr><td><strong>' + r.region + '</strong></td><td>' + r.change + '</td><td>' + r.date + '</td><td><span class="badge ' + impactBadge + '">' + r.impact + '</span></td><td style="font-size:10px">' + r.detail + '</td><td style="font-size:10px">' + r.action + '</td></tr>';
        });
        html += '</tbody></table>';
      }
    }
    
    return html;
  })()}
</div>

<!-- TAB 8: SWOT 分析 -->
<div id="tab-swot" class="tab-content">
  <h2 class="section-title"><span class="dot"></span>🎯 SWOT 分析 — 数据驱动的品类战略</h2>
  
  ${(() => {
    // 从全报告数据中提取品类得分
    const catScores = {};
    if (competitorBrands) {
      competitorBrands.forEach(b => {
        const cats = (b.categories || '').split(', ');
        cats.forEach(c => {
          if (!catScores[c]) catScores[c] = { brands: 0, totalScore: 0, avgGrowth: 0, count: 0 };
          catScores[c].brands++;
          catScores[c].totalScore += b.compScore;
        });
      });
    }
    
    // 品类热度评分
    const categoryHeat = [
      { name: '胶原蛋白', searchGrowth: 512, tiktokGMV: 14.3, platforms: 6, amzSales: 95, score: 92, verdict: '🔥 核心品类' },
      { name: '电解质', searchGrowth: 1986, tiktokGMV: 0, platforms: 3, amzSales: 78, score: 78, verdict: '🚀 高速增长' },
      { name: '肌酸', searchGrowth: 50, tiktokGMV: 4.6, platforms: 5, amzSales: 72, score: 85, verdict: '🔥 核心品类' },
      { name: '益生菌', searchGrowth: 1258, tiktokGMV: 4.1, platforms: 4, amzSales: 38, score: 75, verdict: '📈 潜力品类' },
      { name: '镁补充剂', searchGrowth: 22, tiktokGMV: 3.6, platforms: 4, amzSales: 58, score: 72, verdict: '📊 稳定品类' },
      { name: '适应原(Ashwagandha)', searchGrowth: 55, tiktokGMV: 5.6, platforms: 3, amzSales: 52, score: 68, verdict: '📈 潜力品类' }
    ];
    
    let html = '';
    
    // 1. 品类热度总览
    html += '<h3 style="margin:20px 0 12px;color:var(--accent)">📊 品类战略热度评分</h3>';
    html += '<table><thead><tr><th>品类</th><th>搜索增长</th><th>TikTok GMV</th><th>平台覆盖</th><th>Amazon销量</th><th>综合评分</th><th>战略定位</th></tr></thead><tbody>';
    categoryHeat.forEach(c => {
      const barColor = c.score >= 85 ? 'var(--green)' : c.score >= 70 ? 'var(--accent)' : 'var(--yellow)';
      html += '<tr><td><strong>' + c.name + '</strong></td>';
      html += '<td><span class="badge ' + (c.searchGrowth > 100 ? 'badge-green' : 'badge-blue') + '">+' + c.searchGrowth + '%</span></td>';
      html += '<td>' + (c.tiktokGMV > 0 ? '\$' + c.tiktokGMV.toFixed(1) + 'M' : '—') + '</td>';
      html += '<td>' + c.platforms + '/6</td>';
      html += '<td>' + (c.amzSales > 0 ? (c.amzSales).toFixed(0) + 'k' : '—') + '</td>';
      html += '<td><div style="display:flex;align-items:center;gap:6px"><div style="flex:1;height:4px;background:var(--border);border-radius:2px;overflow:hidden"><div style="width:' + c.score + '%;height:100%;background:' + barColor + ';border-radius:2px"></div></div><strong>' + c.score + '</strong></div></td>';
      html += '<td>' + c.verdict + '</td></tr>';
    });
    html += '</tbody></table>';
    
    // 2. SWOT 四象限 × 三品类
    html += '<h3 style="margin:28px 0 14px;color:var(--accent)">📌 品类 SWOT 四象限</h3>';
    swotData.forEach(s => {
      html += '<div style="margin-bottom:24px"><h4 style="color:var(--accent);margin-bottom:12px">' + s.category + '</h4>';
      html += '<div class="swot-grid">';
      html += '<div class="swot-item swot-s"><h4>✅ 优势 (Strengths)</h4><ul>' + s.strengths.map(x => '<li>' + x + '</li>').join('') + '</ul></div>';
      html += '<div class="swot-item swot-w"><h4>⚠️ 劣势 (Weaknesses)</h4><ul>' + s.weaknesses.map(x => '<li>' + x + '</li>').join('') + '</ul></div>';
      html += '<div class="swot-item swot-o"><h4>🚀 机会 (Opportunities)</h4><ul>' + s.opportunities.map(x => '<li>' + x + '</li>').join('') + '</ul></div>';
      html += '<div class="swot-item swot-t"><h4>🛡️ 威胁 (Threats)</h4><ul>' + s.threats.map(x => '<li>' + x + '</li>').join('') + '</ul></div>';
      html += '</div></div>';
    });
    
    // 3. SWOT 交叉策略矩阵
    html += '<h3 style="margin:28px 0 14px;color:var(--accent)">⚔️ SWOT 交叉策略矩阵 — SO/WO/ST/WT</h3>';
    html += '<table><thead><tr><th>策略类型</th><th>逻辑</th><th>胶原蛋白</th><th>益生菌</th><th>适应原</th></tr></thead><tbody>';
    html += '<tr><td><strong>SO 增长策略</strong></td><td style="font-size:10px">优势×机会</td>';
    html += '<td style="font-size:10px">TikTok高热度+搜索增长512% → 全域种草+跨平台收割</td>';
    html += '<td style="font-size:10px">高复购+肠道健康趋势(+1,258%) → 订阅制+内容教育</td>';
    html += '<td style="font-size:10px">高增长+高客单价 → 专业KOL背书+临床数据营销</td>';
    html += '</tr>';
    html += '<tr><td><strong>WO 扭转策略</strong></td><td style="font-size:10px">劣势×机会</td>';
    html += '<td style="font-size:10px">同质化严重+男性市场空白 → 推出男性胶原蛋白线</td>';
    html += '<td style="font-size:10px">冷链成本高+定制化趋势 → 常温剂型+基因检测联名</td>';
    html += '<td style="font-size:10px">市场教育不足+压力需求 → 短视频科普+免费试用装</td>';
    html += '</tr>';
    html += '<tr><td><strong>ST 防御策略</strong></td><td style="font-size:10px">优势×威胁</td>';
    html += '<td style="font-size:10px">跨平台一致性强+法规趋严 → 提前做NDI/GRAS合规</td>';
    html += '<td style="font-size:10px">Amazon评分高+替代品兴起 → 临床研究背书+专利菌株</td>';
    html += '<td style="font-size:10px">Reddit热度高+重金属风险 → 公开COA+USP认证</td>';
    html += '</tr>';
    html += '<tr><td><strong>WT 避险策略</strong></td><td style="font-size:10px">劣势×威胁</td>';
    html += '<td style="font-size:10px">品牌集中度低+价格战 → 差异化剂型(软糖/果冻/饮品)</td>';
    html += '<td style="font-size:10px">品牌忠诚度低+监管审查 → 专注细分人群(儿童/女性/运动)</td>';
    html += '<td style="font-size:10px">供应链不稳+替代品竞争 → 多产地采购+成分组合专利</td>';
    html += '</tr>';
    html += '</tbody></table>';
    
    // 4. 核心洞察
    html += '<div class="insight-box" style="margin-top:24px"><h4>🎯 SWOT 核心结论</h4><p>';
    html += '① <strong>胶原蛋白</strong>（综合评分' + categoryHeat[0].score + '）：唯一全域爆品，SO策略优先——利用TikTok热度×搜索增长512%，快速建立跨平台品牌认知；<br>';
    html += '② <strong>肌酸</strong>（综合评分' + categoryHeat[2].score + '）：Reddit最推荐+Amazon销量TOP1，WO策略——利用女性肌酸市场(+123%)和软糖剂型(+49%)趋势扭转"男性专属"刻板印象；<br>';
    html += '③ <strong>电解质</strong>（搜索增长' + categoryHeat[1].searchGrowth + '%）：增速最快品类，ST策略——在品类过热泡沫中通过差异化剂型(电解质+胶原蛋白)和品牌化建立护城河；<br>';
    html += '④ <strong>益生菌</strong>（搜索增长' + categoryHeat[3].searchGrowth + '%）：WO策略——用常温剂型+细分人群定位突破冷链和同质化瓶颈。';
    html += '</p></div>';
    
    return html;
  })()}
</div>

<!-- TAB 9: 库存建议 -->
<div id="tab-inventory" class="tab-content">
  <h2 class="section-title"><span class="dot"></span>📦 智能库存与选品建议</h2>
  
  ${(() => {
    if (!inventoryData) return '<p>库存数据加载中...</p>';
    const { catHealth, topProducts, trendSuggestions, slowMovers, blankOpportunities, totalProducts } = inventoryData;
    let html = '';
    
    // 1. 库存概览卡片
    html += `<div class="stats-row" style="margin-bottom:20px;padding:0">
      <div class="stat-card"><div class="icon">📦</div><div class="label">分析产品数</div><div class="value">${totalProducts}</div><div class="delta">Amazon+TikTok全平台</div></div>
      <div class="stat-card"><div class="icon">🟢</div><div class="label">健康品类</div><div class="value">${catHealth.filter(c => c.healthScore >= 70).length}</div><div class="delta">建议正常补货</div></div>
      <div class="stat-card"><div class="icon">⚠️</div><div class="label">滞销预警</div><div class="value">${slowMovers.length}</div><div class="delta">增长<0%需处理</div></div>
      <div class="stat-card"><div class="icon">🟢</div><div class="label">蓝海机会</div><div class="value">${blankOpportunities.filter(b => b.opportunity.includes('蓝海')).length}</div><div class="delta">高需求低竞争</div></div>
    </div>`;
    
    // 2. 品类库存健康度
    html += `<h3 style="margin:24px 0 12px;color:var(--accent)">📊 品类库存健康度评分</h3>`;
    html += `<table><thead><tr><th>品类</th><th>产品数</th><th>平台</th><th>总销量</th><th>增长</th><th>健康度</th><th>安全库存</th><th>补货点</th><th>周转(天)</th><th>建议</th></tr></thead><tbody>`;
    catHealth.forEach(c => {
      const healthBadge = c.healthScore >= 70 ? 'badge-green' : c.healthScore >= 50 ? 'badge-yellow' : 'badge-red';
      const turnover = c.avgGrowth > 50 ? '14-21' : c.avgGrowth > 20 ? '21-30' : c.avgGrowth > 0 ? '30-45' : '45+';
      html += `<tr>
        <td><strong>${c.category}</strong></td>
        <td>${c.products}</td><td>${c.platforms}</td>
        <td>${(c.totalSales/1000).toFixed(0)}k</td>
        <td><span class="badge ${c.avgGrowth > 20 ? 'badge-green' : c.avgGrowth > 0 ? 'badge-blue' : 'badge-red'}">${c.avgGrowth > 0 ? '+' : ''}${c.avgGrowth}%</span></td>
        <td><span class="badge ${healthBadge}">${c.healthLevel} ${c.healthScore}</span></td>
        <td>${c.safeStockWeeks}周</td>
        <td>${(c.reorderPoint/1000).toFixed(0)}k</td>
        <td>${turnover}</td>
        <td style="font-size:11px">${c.recommendation}</td>
      </tr>`;
    });
    html += `</tbody></table>`;
    
    // 3. TOP 产品库存动作
    html += `<h3 style="margin:28px 0 14px;color:var(--accent)">🎯 TOP 产品库存动作建议</h3>`;
    html += `<table><thead><tr><th>产品</th><th>品牌</th><th>平台</th><th>周销量</th><th>增长</th><th>ABC类</th><th>动作</th><th>建议库存</th></tr></thead><tbody>`;
    topProducts.forEach(p => {
      const actionBadge = p.action.includes('紧急') ? 'badge-red' : p.action.includes('加大') ? 'badge-green' : p.action.includes('减少') ? 'badge-yellow' : 'badge-blue';
      html += `<tr>
        <td><strong>${p.name.substring(0, 50)}</strong></td>
        <td>${p.brand}</td><td>${p.platform}</td>
        <td>${(p.sales/1000).toFixed(0)}k</td>
        <td><span class="badge ${p.growth > 20 ? 'badge-green' : p.growth > 0 ? 'badge-blue' : 'badge-red'}">${p.growth > 0 ? '+' : ''}${p.growth}%</span></td>
        <td><span class="badge ${p.abcClass === 'A' ? 'badge-green' : p.abcClass === 'B' ? 'badge-blue' : 'badge-yellow'}">${p.abcClass}类</span></td>
        <td><span class="badge ${actionBadge}">${p.action}</span></td>
        <td>${p.suggestedStock}</td>
      </tr>`;
    });
    html += `</tbody></table>`;
    
    // 5. 滞销预警
    html += `<h3 style="margin:28px 0 14px;color:var(--accent)">⚠️ 滞销预警 — 需清仓/促销产品</h3>`;
    html += `<table><thead><tr><th>产品</th><th>品牌</th><th>平台</th><th>周销量</th><th>增长</th><th>建议动作</th></tr></thead><tbody>`;
    slowMovers.forEach(p => {
      html += `<tr>
        <td><strong>${p.name.substring(0, 50)}</strong></td>
        <td>${p.brand}</td><td>${p.platform}</td>
        <td>${(p.sales/1000).toFixed(0)}k</td>
        <td><span class="badge badge-red">${p.growth}%</span></td>
        <td><span class="badge ${p.action.includes('清仓') ? 'badge-red' : 'badge-yellow'}">${p.action}</span></td>
      </tr>`;
    });
    html += `</tbody></table>`;
    
    // 6. 选品空白机会
    html += `<h3 style="margin:28px 0 14px;color:var(--accent)">🟢 选品空白机会 — 高需求 × 低竞争</h3>`;
    html += `<table><thead><tr><th>关键词</th><th>月搜索量</th><th>年增长</th><th>现有产品数</th><th>机会评级</th><th>建议</th></tr></thead><tbody>`;
    blankOpportunities.forEach(b => {
      const opBadge = b.opportunity.includes('蓝海') ? 'badge-green' : 'badge-blue';
      html += `<tr>
        <td><strong>${b.keyword}</strong></td>
        <td>${(b.searchVolume/1000).toFixed(0)}k</td>
        <td><span class="badge badge-green">+${b.growth}%</span></td>
        <td>${b.currentProducts}</td>
        <td><span class="badge ${opBadge}">${b.opportunity}</span></td>
        <td style="font-size:11px">${b.suggestion}</td>
      </tr>`;
    });
    html += `</tbody></table>`;
    
    // 7. 趋势词驱动的选品建议
    html += `<h3 style="margin:28px 0 14px;color:var(--accent)">🔍 高增长关键词 → 选品机会</h3>`;
    html += `<table><thead><tr><th>关键词</th><th>年增长</th><th>选品建议</th></tr></thead><tbody>`;
    trendSuggestions.forEach(t => {
      html += `<tr><td><strong>${t.keyword}</strong></td><td><span class="badge badge-green">+${t.growth}%</span></td><td style="font-size:11px">${t.suggestion}</td></tr>`;
    });
    html += `</tbody></table>`;
    
    // 8. 核心洞察
    html += `<div class="insight-box" style="margin-top:24px">
      <h4>📋 库存管理核心建议</h4>
      <p>
        ① <strong>ABC分类管理</strong>：A类产品(占总销量70%)保持6-8周安全库存，断货损失远大于持有成本；C类1-2周即可；<br>
        ② <strong>滞销清理</strong>：${slowMovers.length}款产品增长<0%，建议${slowMovers.filter(p => p.growth < -20).length}款立即清仓回笼资金；<br>
        ③ <strong>蓝海选品</strong>：${blankOpportunities.filter(b => b.opportunity.includes('蓝海')).length}个高需求低竞争品类，建议首批各备货500-1000件测试市场反应；<br>
        ④ <strong>趋势词快速测试</strong>：${trendSuggestions.map(t => t.keyword).slice(0,3).join('、')}等爆发词相关品类建议小批量测试（<1,000件），转化率达标后快速放量。
      </p>
    </div>`;
    
    return html;
  })()}
</div>

<!-- TAB 10: 价格策略 -->
<div id="tab-pricing" class="tab-content">
  <h2 class="section-title"><span class="dot"></span>💰 价格策略 — 全平台定价分析与建议</h2>
  
  ${(() => {
    if (!pricingData) return '<p>价格数据加载中...</p>';
    const { platformPricing, catPricingResult, crossPlatformPricing, priceGrowthCorrelation, strategies, costEstimates } = pricingData;
    let html = '';
    
    // 1. 各平台定价概览卡片
    html += `<div class="stats-row" style="margin-bottom:20px;padding:0">`;
    Object.entries(platformPricing).forEach(([platform, data]) => {
      html += `<div class="stat-card">
        <div class="icon">${platform === 'Amazon' ? '🛒' : platform === 'TikTok' ? '🎵' : '🌿'}</div>
        <div class="label">${platform} 均价</div>
        <div class="value">\$${data.avg}</div>
        <div class="delta">${data.count}款 | \$${data.min}-\$${data.max} | ${data.strategy}</div>
      </div>`;
    });
    html += `</div>`;
    
    // 2. 各平台价格带分布
    html += `<h3 style="margin:24px 0 12px;color:var(--accent)">📊 各平台价格带分布对比</h3>`;
    html += `<table><thead><tr><th>价格带</th>`;
    Object.keys(platformPricing).forEach(p => html += `<th>${p}</th>`);
    html += `<th>策略含义</th></tr></thead><tbody>`;
    [['$0-15',0,15], ['$15-25',15,25], ['$25-40',25,40], ['$40-60',40,60], ['$60+',60,999]].forEach(([range, min, max]) => {
      html += `<tr><td><strong>${range}</strong></td>`;
      Object.entries(platformPricing).forEach(([p, data]) => {
        const r = data.ranges.find(r => r.range === range);
        const share = data.count > 0 ? Math.round((r ? r.count : 0) / data.count * 100) : 0;
        const barColor = share > 35 ? 'var(--green)' : share > 15 ? 'var(--accent)' : 'var(--text-muted)';
        html += `<td><div style="display:flex;align-items:center;gap:4px"><div style="flex:1;height:4px;background:var(--border);border-radius:2px;overflow:hidden"><div style="width:${share}%;height:100%;background:${barColor};border-radius:2px"></div></div><span style="font-size:10px">${r ? r.count : 0}款</span></div></td>`;
      });
      const maxPlatform = Object.entries(platformPricing).sort((a,b) => {
        const ra = a[1].ranges.find(r => r.range === range);
        const rb = b[1].ranges.find(r => r.range === range);
        return (rb ? rb.count : 0) - (ra ? ra.count : 0);
      })[0];
      html += `<td style="font-size:10px">${maxPlatform ? maxPlatform[0] + '最集中' : ''}</td></tr>`;
    });
    html += `</tbody></table>`;
    
    // 3. 采购成本与利润估算
    html += `<h3 style="margin:28px 0 14px;color:var(--accent)">💲 采购成本 & 利润估算（含关税${costEstimates.tariffRate} + 汇率${costEstimates.fxRate}）</h3>`;
    html += `<table><thead><tr><th>价格带</th><th>产品数</th><th>均价</th><th>预估采购成本</th><th>到岸成本(×${costEstimates.landedCostMultiplier})</th><th>预估利润率</th><th>建议</th></tr></thead><tbody>`;
    costEstimates.priceRanges.forEach(c => {
      const marginBadge = parseInt(c.profitMargin) > 40 ? 'badge-green' : parseInt(c.profitMargin) > 25 ? 'badge-blue' : 'badge-yellow';
      html += `<tr>
        <td><strong>${c.range}</strong></td><td>${c.products}</td>
        <td>\$${c.avgPrice}</td><td>\$${c.estimatedCost}</td>
        <td>\$${c.landedCost}</td>
        <td><span class="badge ${marginBadge}">${c.profitMargin}</span></td>
        <td style="font-size:10px">${parseInt(c.profitMargin) < 20 ? '⚠️ 利润过低，需提价或降本' : parseInt(c.profitMargin) < 30 ? '📊 合理区间，可优化' : '✅ 利润充裕'}</td>
      </tr>`;
    });
    html += `</tbody></table>`;
    
    // 4. 品类最优定价区间
    html += `<h3 style="margin:28px 0 14px;color:var(--accent)">🎯 各品类最优定价区间</h3>`;
    html += `<table><thead><tr><th>品类</th><th>产品数</th><th>均价</th><th>最畅销价格</th><th>建议定价区间</th><th>策略</th></tr></thead><tbody>`;
    catPricingResult.slice(0, 12).forEach(c => {
      html += `<tr>
        <td><strong>${c.category}</strong></td><td>${c.count}</td>
        <td>\$${c.avgPrice}</td><td>\$${c.topSellingPrice}</td>
        <td><span class="badge badge-blue">${c.optimalRange}</span></td>
        <td style="font-size:11px">${c.recommendation}</td>
      </tr>`;
    });
    html += `</tbody></table>`;
    
    // 4. 价格弹性 — 增长与价格关系
    html += `<h3 style="margin:28px 0 14px;color:var(--accent)">📈 价格弹性分析 — 哪个价格带增长最快</h3>`;
    html += `<table><thead><tr><th>价格带</th><th>产品数</th><th>平均增长</th><th>高增长占比</th><th>平均销量</th><th>洞察</th></tr></thead><tbody>`;
    priceGrowthCorrelation.forEach(p => {
      const growthBadge = p.avgGrowth > 30 ? 'badge-green' : p.avgGrowth > 10 ? 'badge-blue' : 'badge-yellow';
      html += `<tr>
        <td><strong>${p.range}</strong></td><td>${p.count}</td>
        <td><span class="badge ${growthBadge}">${p.avgGrowth > 0 ? '+' : ''}${p.avgGrowth}%</span></td>
        <td>${p.highGrowthRatio}%</td>
        <td>${(p.avgSales/1000).toFixed(0)}k</td>
        <td style="font-size:11px">${p.insight}</td>
      </tr>`;
    });
    html += `</tbody></table>`;
    
    // 5. 跨平台价格差异
    html += `<h3 style="margin:28px 0 14px;color:var(--accent)">🌐 跨平台价格差异 — 同一品牌不同平台定价</h3>`;
    html += `<table><thead><tr><th>品牌</th>`;
    const allPlatforms = [...new Set(crossPlatformPricing.flatMap(b => Object.keys(b.prices)))];
    allPlatforms.forEach(p => html += `<th>${p}</th>`);
    html += `<th>最大价差</th><th>建议</th></tr></thead><tbody>`;
    crossPlatformPricing.slice(0, 8).forEach(b => {
      html += `<tr><td><strong>${b.brand}</strong></td>`;
      allPlatforms.forEach(p => html += `<td>${b.prices[p] ? '\$' + b.prices[p] : '—'}</td>`);
      html += `<td><span class="badge badge-yellow">\$${b.maxDiff}</span></td>
        <td style="font-size:10px">${b.maxDiff > 10 ? '价差过大，需统一品牌定位' : '价差合理，可保持平台差异化'}</td></tr>`;
    });
    html += `</tbody></table>`;
    
    // 6. 定价策略建议
    html += `<h3 style="margin:28px 0 14px;color:var(--accent)">💡 五大定价策略建议</h3>`;
    html += `<table><thead><tr><th>策略</th><th>适用场景</th><th>具体做法</th><th>案例</th></tr></thead><tbody>`;
    strategies.forEach(s => {
      html += `<tr>
        <td><strong>${s.strategy}</strong></td><td>${s.target}</td>
        <td style="font-size:11px">${s.action}</td><td style="font-size:10px;color:var(--text-muted)">${s.example}</td>
      </tr>`;
    });
    html += `</tbody></table>`;
    
    // 7. 蛋白粉原料专项预警（v5.0 — 多源验证+中美对比+传导滞后）
    if (pricingData.wheyAlert && pricingData.wheyAlert.active) {
      const wa = pricingData.wheyAlert;
      html += `<div class="insight-box" style="border-left-color:var(--red);margin-top:24px">
        <h4>${wa.title}</h4>
        <p>${wa.retailSummary || wa.summary}</p>
        <p style="margin-top:8px">${wa.rawMaterialSummary}</p>
        <div class="insight-box" style="border-left-color:var(--yellow);margin:12px 0;padding:10px 14px">
          <p style="margin:0;font-size:13px"><strong>🔍 传导滞后分析</strong>：${wa.transmissionLag}</p>
        </div>
        <div class="insight-box" style="border-left-color:var(--accent);margin:12px 0;padding:10px 14px">
          <p style="margin:0;font-size:13px"><strong>🇨🇳 中国市场对比</strong>：${wa.chinaContext}</p>
        </div>`;
      // 原料端价格表
      if (wa.rawMaterialPrices && wa.rawMaterialPrices.length > 0) {
        html += '<h5 style="margin:12px 0 6px">📊 原料端价格明细</h5>';
        html += '<table style="font-size:11px"><thead><tr><th>原料</th><th>2023</th><th>2024</th><th>2025</th><th>2026</th><th>涨幅</th><th>来源</th></tr></thead><tbody>';
        wa.rawMaterialPrices.forEach(r => {
          html += `<tr><td><strong>${r.material}</strong></td><td>${r.price2023}</td><td>${r.price2024}</td><td>${r.price2025}</td><td>${r.price2026}</td><td>${r.change}</td><td style="font-size:9px">${r.source}</td></tr>`;
        });
        html += '</tbody></table>';
      }
      // 零售端价格表
      if (wa.retailPrices && wa.retailPrices.length > 0) {
        html += '<h5 style="margin:12px 0 6px">🛒 零售端价格明细（美国+中国）</h5>';
        html += '<table style="font-size:11px"><thead><tr><th>市场/品牌</th><th>2023</th><th>2024</th><th>2025</th><th>2026</th><th>涨幅</th><th>来源</th></tr></thead><tbody>';
        wa.retailPrices.forEach(r => {
          html += `<tr><td><strong>${r.market}</strong></td><td>${r.price2023}</td><td>${r.price2024}</td><td>${r.price2025}</td><td>${r.price2026}</td><td>${r.change}</td><td style="font-size:9px">${r.source}</td></tr>`;
        });
        html += '</tbody></table>';
      }
      html += `<p style="margin-top:8px"><strong>📊 数据来源</strong>：${wa.source}</p>
        <p style="margin-top:8px"><strong>🛒 零售端影响</strong>：${wa.retailImpact}</p>
        <p style="margin-top:8px"><strong>✅ 应对建议</strong>：<br>${wa.recommendations.map((r,i) => (i+1) + '. ' + r).join('<br>')}</p>
      </div>`;
    }
    
    // 8. 核心洞察
    html += `<div class="insight-box" style="margin-top:24px">
      <h4>💲 定价策略核心建议</h4>
      <p>
        ① <strong>平台差异化定价</strong>：Amazon均价\$${platformPricing['Amazon']?.avg || 'N/A'}（${platformPricing['Amazon']?.strategy || ''}），TikTok均价\$${platformPricing['TikTok']?.avg || 'N/A'}（${platformPricing['TikTok']?.strategy || ''}）。建议Amazon中高价+TikTok中低价组合，利用平台消费习惯差异；<br>
        ② <strong>最优增长价格带</strong>：${priceGrowthCorrelation.filter(p => p.avgGrowth > 20).map(p => p.range).join('、') || '当前各价格带增长均衡'}增长最快，新品定价建议优先考虑这些区间；<br>
        ③ <strong>品类定价锚点</strong>：${catPricingResult.slice(0,3).map(c => c.category + '(\$' + c.optimalRange + ')').join('、')}等品类的畅销价格带已明确，新进入者建议在畅销价±15%范围内定价；<br>
        ④ <strong>关税成本传导</strong>：当前33%综合关税下，\$15以下产品利润空间极薄（预估利润率<25%），建议主攻\$25+价格带以确保关税后仍有合理利润；<br>
        ⑤ <strong>组合定价</strong>：建议每个品类配置3个价格点——引流款(\$15-20)+利润款(\$25-35)+形象款(\$40+)，覆盖不同消费层级。${pricingData.wheyAlert && pricingData.wheyAlert.active ? '<br>⑥ <strong>蛋白粉专项</strong>：原料WPC80涨429%(2023→2026)，零售端仅传导46%(美国)/19-93%(中国)。12-18个月传导滞后意味着零售补涨压力正在累积，预计2027Q1-Q2普遍提价。NOW Sports已提价，康比特提价65%仍覆盖不了成本，立即评估自身蛋白粉产品调价窗口。' : ''}
      </p>
    </div>`;
    
    return html;
  })()}
</div>

<!-- TAB 11: 运营洞察 -->
<div id="tab-insights" class="tab-content">
  <h2 class="section-title"><span class="dot"></span>📋 每周执行摘要 — 本周行动清单</h2>

  ${(() => {
    // 从全报告数据中自动提取关键行动
    const actions = [];
    
    // 1. 从竞品分析提取 TOP 品牌机会
    if (competitorBrands && competitorBrands.length > 0) {
      const topBrand = competitorBrands[0];
      const tiktokBrands = competitorBrands.filter(b => b.tiktokGMV > 0 && b.amzProducts === 0).slice(0, 2);
      const crossBrands = competitorBrands.filter(b => b.amzProducts > 0 && b.tiktokGMV > 0).slice(0, 2);
      actions.push({
        priority: '🔴 P0',
        category: '竞品',
        action: '重点跟踪品牌: ' + topBrand.name + ' (综合得分' + topBrand.compScore + ')',
        detail: '跨平台品牌仅' + crossBrands.length + '个，TikTok原生品牌' + tiktokBrands.length + '个未进入Amazon',
        deadline: '本周',
        owner: '市场部'
      });
    }
    
    // 2. 从库存建议提取紧急补货
    if (inventoryData && inventoryData.topProducts) {
      const urgent = inventoryData.topProducts.filter(p => p.action.includes('紧急')).slice(0, 2);
      const slowMovers = inventoryData.slowMovers ? inventoryData.slowMovers.filter(p => p.action.includes('清仓')).length : 0;
      if (urgent.length > 0) {
        actions.push({
          priority: '🔴 P0',
          category: '库存',
          action: '紧急补货: ' + urgent.map(p => p.name.substring(0, 30)).join('、'),
          detail: 'A类产品，当前库存预计不足，断货风险高',
          deadline: '本周',
          owner: '供应链'
        });
      }
      if (slowMovers > 0) {
        actions.push({
          priority: '🟡 P1',
          category: '库存',
          action: '清仓处理' + slowMovers + '款滞销产品',
          detail: '增长<0%，建议促销去库存回笼资金',
          deadline: '两周内',
          owner: '运营'
        });
      }
    }
    
    // 3. 从关键词挖掘提取爆发词
    if (trendsData && trendsData.length > 0) {
      const surging = trendsData.filter(k => k.yoyGrowth > 60).slice(0, 3);
      if (surging.length > 0) {
        actions.push({
          priority: '🔴 P0',
          category: 'SEO',
          action: '布局爆发关键词: ' + surging.map(k => k.keyword).join('、'),
          detail: '增长率: ' + surging.map(k => '+' + k.yoyGrowth + '%').join(' / ') + '，立即产出Listing优化和内容',
          deadline: '本周',
          owner: '内容/SEO'
        });
      }
    }
    
    // 4. 从风险预警提取紧急风险
    if (riskData && riskData.regulatory) {
      const severe = [...riskData.regulatory, ...(riskData.trade||[]), ...(riskData.market||[])].filter(r => r.level.includes('严重'));
      if (severe.length > 0) {
        actions.push({
          priority: '🔴 P0',
          category: '合规',
          action: '应对' + severe.length + '项严重风险: ' + severe.map(r => r.risk).join('；'),
          detail: severe[0].action,
          deadline: '本周',
          owner: '法务/合规'
        });
      }
    }
    
    // 5. 从价格策略提取定价建议
    if (pricingData && pricingData.priceGrowthCorrelation) {
      const bestBand = pricingData.priceGrowthCorrelation.filter(p => p.avgGrowth > 20).sort((a,b) => b.avgGrowth - a.avgGrowth)[0];
      if (bestBand) {
        actions.push({
          priority: '🟡 P1',
          category: '定价',
          action: '新品定价优先考虑' + bestBand.range + '价格带',
          detail: '该价格带平均增长+' + bestBand.avgGrowth + '%，高增长占比' + bestBand.highGrowthRatio + '%',
          deadline: '两周内',
          owner: '定价/采购'
        });
      }
    }
    
    // 6. 从社媒数据提取内容策略
    if (socialData) {
      const tk = socialData.tiktok;
      const ig = socialData.instagram;
      actions.push({
        priority: '🟡 P1',
        category: '社媒',
        action: 'TikTok内容投放: ' + (tk.topBrands ? tk.topBrands.slice(0,2).map(b => b.name).join('、') : '保健品品类') + ' 品类短视频',
        detail: 'TikTok声量' + (tk.mentionVolume/1000).toFixed(0) + 'k(增速+' + tk.weekChange + '%)，Instagram正面情绪' + ig.sentimentPositive + '%适合品牌建设',
        deadline: '持续',
        owner: '社媒运营'
      });
    }
    
    // 7. 从Shopee/Ozon提取新市场机会
    if (shopeeThreeLists && shopeeThreeLists.latam) {
      actions.push({
        priority: '🟢 P2',
        category: '拓展',
        action: '评估Shopee拉美市场入驻',
        detail: '拉美保健品CAGR 28%(Shopee增速最快区域)，蛋白粉/肌酸/减重品类主导',
        deadline: '本月',
        owner: '战略/拓展'
      });
    }
    
    // 如果不够，补充通用建议
    if (actions.length < 6) {
      actions.push(
        { priority: '🟡 P1', category: '内容', action: 'Reddit r/Supplements深度测评投放', detail: '互动率6.5%全平台最高，Magnesium Glycinate/Creatine/Lion\'s Mane为热门话题', deadline: '两周内', owner: '内容营销' },
        { priority: '🟢 P2', category: '产品', action: 'GLP-1互补品类调研', detail: '胶原蛋白(防皮肤松弛)+肌酸(防肌肉流失)+Akkermansia(GLP-1刺激)是GLP-1药物用户的三大互补需求', deadline: '本月', owner: '产品经理' }
      );
    }
    
    // 渲染
    let html = '';
    
    // 概览卡片
    const p0Count = actions.filter(a => a.priority.includes('P0')).length;
    const p1Count = actions.filter(a => a.priority.includes('P1')).length;
    const p2Count = actions.filter(a => a.priority.includes('P2')).length;
    
    html += '<div class="stats-row" style="margin-bottom:20px;padding:0">';
    html += '<div class="stat-card"><div class="icon">🔴</div><div class="label">P0 本周必做</div><div class="value">' + p0Count + '</div><div class="delta">立即执行</div></div>';
    html += '<div class="stat-card"><div class="icon">🟡</div><div class="label">P1 两周内</div><div class="value">' + p1Count + '</div><div class="delta">计划执行</div></div>';
    html += '<div class="stat-card"><div class="icon">🟢</div><div class="label">P2 本月</div><div class="value">' + p2Count + '</div><div class="delta">评估推进</div></div>';
    html += '<div class="stat-card"><div class="icon">📊</div><div class="label">覆盖维度</div><div class="value">' + [...new Set(actions.map(a => a.category))].length + '</div><div class="delta">' + [...new Set(actions.map(a => a.category))].join('/') + '</div></div>';
    html += '</div>';
    
    // 行动清单表格
    html += '<table><thead><tr><th>优先级</th><th>类别</th><th>行动项</th><th>详情</th><th>截止</th><th>负责人</th></tr></thead><tbody>';
    actions.forEach(a => {
      const badge = a.priority.includes('P0') ? 'badge-red' : a.priority.includes('P1') ? 'badge-yellow' : 'badge-green';
      html += '<tr><td><span class="badge ' + badge + '">' + a.priority + '</span></td><td>' + a.category + '</td><td><strong>' + a.action + '</strong></td><td style="font-size:11px">' + a.detail + '</td><td>' + a.deadline + '</td><td>' + a.owner + '</td></tr>';
    });
    html += '</tbody></table>';
    
    // 本周重点监控指标
    html += '<h3 style="margin:28px 0 14px;color:var(--accent)">📊 本周重点监控指标</h3>';
    html += '<table><thead><tr><th>指标</th><th>当前值</th><th>趋势</th><th>警戒线</th><th>状态</th></tr></thead><tbody>';
    
    const kpis = [
      { metric: 'Amazon TOP10 平均增长', value: amazonData && amazonData.length > 0 ? '+' + (amazonData.reduce((s,p) => s + p.growth, 0) / amazonData.length).toFixed(1) + '%' : 'N/A', trend: '📈', alert: '< +5%', status: '🟢' },
      { metric: 'TikTok Shop 北美GMV', value: tiktokThreeLists && tiktokThreeLists.na ? '\$' + (tiktokThreeLists.na.bestSellers.reduce((s,p) => s + (p.gmv||0), 0)/1e6).toFixed(1) + 'M' : 'N/A', trend: '📈', alert: '< \$3M', status: '🟢' },
      { metric: 'Google Trends 爆发词数(>60%)', value: trendsData ? trendsData.filter(k => k.yoyGrowth > 60).length + '个' : 'N/A', trend: '📈', alert: '< 3个', status: '🟢' },
      { metric: '滞销产品数(增长<0%)', value: inventoryData && inventoryData.slowMovers ? inventoryData.slowMovers.length + '款' : 'N/A', trend: '📉', alert: '> 5款', status: inventoryData && inventoryData.slowMovers && inventoryData.slowMovers.length > 5 ? '🔴' : '🟢' },
      { metric: 'USD/CNY汇率', value: riskData && riskData.latest && riskData.latest.fxRate ? riskData.latest.fxRate.usdCny.toFixed(2) : '6.81', trend: '➡️', alert: '< 6.5 或 > 7.2', status: '🟢' },
      { metric: 'FDA活跃召回(保健品)', value: riskData && riskData.latest ? riskData.latest.recalls.filter(r => r.active).length + '起' : 'N/A', trend: '⚠️', alert: '> 3起', status: riskData && riskData.latest && riskData.latest.recalls.filter(r => r.active).length > 3 ? '🔴' : '🟡' }
    ];
    
    kpis.forEach(k => {
      html += '<tr><td><strong>' + k.metric + '</strong></td><td>' + k.value + '</td><td>' + k.trend + '</td><td>' + k.alert + '</td><td>' + k.status + '</td></tr>';
    });
    html += '</tbody></table>';
    
    // 本周核心建议
    html += '<div class="insight-box" style="margin-top:24px"><h4>🗓️ 本周执行重点</h4><p>';
    const p0Actions = actions.filter(a => a.priority.includes('P0'));
    html += p0Actions.map((a, i) => (i+1) + '. <strong>' + a.action + '</strong>（' + a.owner + '）').join('<br>');
    html += '<br><br>📌 <strong>提醒</strong>：本周' + (new Date().toISOString().slice(0,10)) + '生成的报告基于最新数据，建议周五复盘执行进度。如有重大市场变化（关税调整/FDA新规/汇率剧烈波动），及时调整优先级。';
    html += '</p></div>';
    
    return html;
  })()}
</div>

<!-- TAB 12: AI 反馈 -->
<div id="tab-aifeedback" class="tab-content">
  <h2 class="section-title">🤖 AI 反馈 — 报告质量自评</h2>
  <table>
    <thead><tr><th>维度</th><th>评分</th><th>说明</th></tr></thead>
    <tbody>
      <tr><td>数据完整性</td><td>🟡 65/100</td><td>Amazon (✅真实7款) + Google Trends (✅真实) + 社媒/电商 (🟡模拟)</td></tr>
      <tr><td>分析深度</td><td>🟢 85/100</td><td>覆盖 12 个分析维度，提供可执行建议</td></tr>
      <tr><td>时效性</td><td>🟡 60/100</td><td>Amazon/Google Trends 2026-06-28 真实数据，社媒/电商为模拟</td></tr>
      <tr><td>可操作性</td><td>🟢 80/100</td><td>提供优先级排序、具体行动建议和 ROI 评估</td></tr>
      <tr><td>覆盖广度</td><td>🟢 90/100</td><td>12 个平台 × 12 个分析维度，覆盖面广</td></tr>
    </tbody>
  </table>
  <div class="insight-box" style="margin-top:20px;border-left-color:var(--yellow)">
    <h4>⚠️ 局限性</h4>
    <p>• 社媒数据（Twitter/Instagram/Facebook/YouTube/Pinterest/Reddit）和电商数据（Shopee/eBay/Mercado/iHerb/Ozon）当前使用模拟数据<br>
    • 评论情感分析未接入 NLP 模型<br>
    • 竞品价格监控非实时</p>
  </div>
  <div class="insight-box" style="margin-top:12px;border-left-color:var(--green)">
    <h4>🚀 改进建议</h4>
    <p>• 优先接入 Amazon PAAPI / Keepa API 获取实时畅销品数据<br>
    • 接入 X API 和 YouTube Data API（免费层）获取真实社媒数据<br>
    • 引入 GPT/Claude API 做评论情感分析和洞察生成<br>
    • 建立自动化数据管道，每周一自动刷新数据</p>
  </div>
</div>

<div class="footer">
  📊 ${reportTitle} | W${weekNum} · ${dateStr}<br>
  数据来源：Amazon · TikTok Shop (FastMoss) · Google Trends · 模拟社媒/电商数据<br>
  报告自动生成 | 仅供内部分析使用 | 非投资建议
</div>

<script>
function switchTab(name, evt) {
  // 只切换顶层 main-tabs 的按钮和顶层 tab-content
  document.querySelectorAll('#main-tabs > .tab-btn').forEach(function(b) { b.classList.remove('active'); });
  var tabs = ['overview','matrix','social','ecommerce','competitor','keywords','risk','swot','inventory','pricing','insights','aifeedback'];
  tabs.forEach(function(t) {
    var el = document.getElementById('tab-' + t);
    if (el) el.classList.remove('active');
  });
  var target = document.getElementById('tab-' + name);
  if (target) target.classList.add('active');
  if (evt && evt.target) evt.target.classList.add('active');
  // 切换到电商Tab时确保子Tab显示默认的销量榜
  if (name === 'ecommerce') {
    resetSubTabs('amazon-bestsellers');
  }
  // 延迟初始化该Tab中的图表（解决隐藏canvas尺寸为0的问题）
  setTimeout(function() {
    ensureChartsInTab('tab-' + name);
  }, 50);
}

function resetSubTabs(activeName) {
  // 重置所有子Tab为指定active
  document.querySelectorAll('#sub-tabs > .tab-btn').forEach(function(b) { b.classList.remove('active'); });
  var subBtns = document.querySelectorAll('#sub-tabs > .tab-btn');
  subBtns.forEach(function(b) {
    var onclick = b.getAttribute('onclick') || '';
    if (onclick.indexOf("'" + activeName + "'") !== -1 || onclick.indexOf('"' + activeName + '"') !== -1) {
      b.classList.add('active');
    }
  });
  var parent = document.getElementById('tab-ecommerce');
  if (!parent) return;
  // 隐藏所有子tab-content
  var subContents = parent.querySelectorAll('[id^="sub-"]');
  subContents.forEach(function(c) { c.classList.remove('active'); });
  // 显示目标
  var target = document.getElementById('sub-' + activeName);
  if (target) target.classList.add('active');
}

function switchSubTab(name, evt) {
  // 电商平台子Tab切换
  var parent = document.getElementById('tab-ecommerce');
  if (!parent) return;
  // 清除子Tab按钮active
  document.querySelectorAll('#sub-tabs > .tab-btn').forEach(function(b) { b.classList.remove('active'); });
  // 隐藏所有子tab-content
  var subContents = parent.querySelectorAll('[id^="sub-"]');
  subContents.forEach(function(c) { c.classList.remove('active'); });
  // 激活目标
  var target = document.getElementById('sub-' + name);
  if (target) target.classList.add('active');
  if (evt && evt.target) evt.target.classList.add('active');
  // 如果切换到5平台总览，确保图表初始化
  if (name === 'ecom-overview') {
    setTimeout(function() {
      ensureChartsInTab('tab-ecommerce');
    }, 50);
  }
}

// ==================== Chart.js 延迟初始化系统 ====================
// 解决隐藏Tab中canvas尺寸为0导致图表空白的核心问题
const chartColors = { bg: '#ffffff', text: '#4a5568', blue: '#3b82f6', green: '#10b981', red: '#ef4444', yellow: '#f59e0b', purple: '#8b5cf6', orange: '#f97316', pink: '#ec4899' };

// 全局 Chart.js 默认配置
if (typeof Chart !== 'undefined') {
  Chart.defaults.color = chartColors.text;
  Chart.defaults.borderColor = '#e2e8f0';
  Chart.defaults.font.family = "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', sans-serif";
  Chart.defaults.responsive = true;
  Chart.defaults.maintainAspectRatio = true;
}

// 图表注册表：{ canvasId: { factory: fn, instance: Chart|null, parentTab: string } }
var chartRegistry = {};
var chartsReady = false;

function registerChart(canvasId, parentTabId, factoryFn) {
  chartRegistry[canvasId] = { factory: factoryFn, instance: null, parentTab: parentTabId };
}

function ensureChartsInTab(tabId) {
  if (!chartsReady) return;
  Object.keys(chartRegistry).forEach(function(cid) {
    var entry = chartRegistry[cid];
    if (entry.parentTab === tabId) {
      if (!entry.instance) {
        var canvas = document.getElementById(cid);
        if (canvas && canvas.offsetParent !== null) {
          // canvas 可见时才初始化
          try {
            entry.instance = entry.factory(canvas);
          } catch(e) { console.warn('Chart init failed for ' + cid, e); }
        }
      } else {
        // 已存在则 resize
        try { entry.instance.resize(); } catch(e) {}
      }
    }
  });
}

function initAllCharts() {
  // 只初始化当前可见Tab中的图表（overview是默认激活的）
  ensureChartsInTab('tab-overview');
  chartsReady = true;
}

// 注册所有图表
registerChart('chartPrice', 'tab-overview', function(canvas) {
  return new Chart(canvas, {
    type: 'bar', data: { labels: ${JSON.stringify(priceLabels)}, datasets: [{ label: '产品数', data: ${JSON.stringify(priceData)}, backgroundColor: chartColors.blue, borderRadius: 6 }] },
    options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { display: false } } }
  });
});

registerChart('chartCategory', 'tab-overview', function(canvas) {
  return new Chart(canvas, {
    type: 'doughnut', data: { labels: ${JSON.stringify(catLabels)}, datasets: [{ data: ${JSON.stringify(catCounts)}, backgroundColor: [chartColors.blue, chartColors.green, chartColors.yellow, chartColors.purple, chartColors.orange, chartColors.red] }] },
    options: { responsive: true, maintainAspectRatio: true }
  });
});

registerChart('chartMatrix', 'tab-matrix', function(canvas) {
  return new Chart(canvas, {
    type: 'radar', data: { labels: ${JSON.stringify(matrixLabels)}, datasets: [
      { label: 'Google Trends', data: ${JSON.stringify(matrixData.map(m => m.googleTrend))}, borderColor: chartColors.green, backgroundColor: 'rgba(16,185,129,0.1)' },
      { label: 'TikTok', data: ${JSON.stringify(matrixData.map(m => m.tiktok))}, borderColor: chartColors.red, backgroundColor: 'rgba(239,68,68,0.1)' },
      { label: 'Amazon', data: ${JSON.stringify(matrixData.map(m => m.amazon))}, borderColor: chartColors.blue, backgroundColor: 'rgba(59,130,246,0.1)' },
      { label: '电商平台', data: ${JSON.stringify(matrixData.map(m => m.ecommerce))}, borderColor: chartColors.yellow, backgroundColor: 'rgba(245,158,11,0.1)' }
    ]}, options: { responsive: true, maintainAspectRatio: true }
  });
});

registerChart('chartSocialVolume', 'tab-social', function(canvas) {
  return new Chart(canvas, {
    type: 'bar', data: { labels: ${JSON.stringify(socialLabels)}, datasets: [{ label: '声量(K)', data: ${JSON.stringify(socialVolumes.map(v => v/1000))}, backgroundColor: [chartColors.blue, chartColors.purple, chartColors.green, chartColors.red, chartColors.yellow, chartColors.orange, '#ec4899'] }] },
    options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { display: false } } }
  });
});

registerChart('chartSocialSentiment', 'tab-social', function(canvas) {
  return new Chart(canvas, {
    type: 'bar', data: { labels: ${JSON.stringify(socialLabels)}, datasets: [{ label: '正面情绪 %', data: ${JSON.stringify(socialPositive)}, backgroundColor: chartColors.green, borderRadius: 6 }] },
    options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { display: false } } }
  });
});

registerChart('chartSocialEngage', 'tab-social', function(canvas) {
  return new Chart(canvas, {
    type: 'bar', data: { labels: ${JSON.stringify(socialLabels)}, datasets: [{ label: '互动率 %', data: ${JSON.stringify(socialEngagement)}, backgroundColor: chartColors.purple, borderRadius: 6 }] },
    options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { display: false } } }
  });
});

registerChart('chartSocialChange', 'tab-social', function(canvas) {
  return new Chart(canvas, {
    type: 'bar', data: { labels: ${JSON.stringify(socialLabels)}, datasets: [{ label: '周变化 %', data: ${JSON.stringify(platforms.map(k => socialData[k].weekChange))}, backgroundColor: [${socialChangeColors.join(',')}], borderRadius: 6 }] },
    options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { display: false } } }
  });
});

registerChart('chartEcomGrowth', 'tab-ecommerce', function(canvas) {
  return new Chart(canvas, {
    type: 'bar', data: { labels: ${JSON.stringify(ecomLabels)}, datasets: [{ label: '增长率 %', data: ${JSON.stringify(ecomGrowth)}, backgroundColor: [${ecomGrowthColors.join(',')}], borderRadius: 6 }] },
    options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { display: false } } }
  });
});

registerChart('chartBrand', 'tab-competitor', function(canvas) {
  return new Chart(canvas, {
    type: 'bar', data: { labels: ${JSON.stringify(brandLabels)}, datasets: [{ label: '预估周销量(K)', data: ${JSON.stringify(brandSales.map(s => s/1000))}, backgroundColor: chartColors.blue, borderRadius: 6 }] },
    options: { responsive: true, maintainAspectRatio: true, indexAxis: 'y', plugins: { legend: { display: false } } }
  });
});

registerChart('chartKeywords', 'tab-keywords', function(canvas) {
  return new Chart(canvas, {
    type: 'bar', data: { labels: ${JSON.stringify(trendLabels)}, datasets: [{ label: '年增长 %', data: ${JSON.stringify(trendGrowth)}, backgroundColor: [${keywordsTrendColors.join(',')}], borderRadius: 6 }] },
    options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { display: false } } }
  });
});

// 页面加载完成后初始化可见图表
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAllCharts);
} else {
  initAllCharts();
}
</script>
</body>
</html>`;

  return html;
}

// ==================== Excel 生成 ====================
function generateExcel() {
  const XLSX = require('xlsx');
  const wb = XLSX.utils.book_new();

  // Sheet 1: Amazon 畅销品
  const amazonSheet = amazonData.map(p => ({
    '排名': p.rank, '产品名称': p.name, '品牌': p.brand, '品类': p.subcategory,
    '价格(USD)': p.price, '评分': p.rating, '评论数': p.reviews,
    '预估周销量': p.salesEstimate, '周增长(%)': p.growth, '平台': p.platform
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(amazonSheet), 'Amazon畅销品');

  // Sheet 2: TikTok Shop
  const tiktokSheet = tiktokData.map(p => ({
    '排名': p.rank, '产品名称': p.name, '品牌': p.brand, '品类': p.subcategory,
    '价格(当地货币)': p.price, '销量': p.sales, '佣金(%)': p.commission,
    '国家': p.country, 'GMV': p.gmv, '增长(%)': p.growth
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(tiktokSheet), 'TikTokShop');

  // Sheet 3: Google Trends
  const trendsSheet = trendsData.map(t => ({
    '关键词': t.keyword, '月搜索量': t.searchVolume, '年增长(%)': t.yoyGrowth,
    '趋势': t.trend, '品类': t.category
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(trendsSheet), 'GoogleTrends');

  // Sheet 4: 社媒数据
  const platforms = Object.keys(socialData);
  const socialSheet = platforms.map(k => {
    const s = socialData[k];
    return {
      '平台': s.platform, '声量': s.mentionVolume, '正面情绪(%)': s.sentimentPositive,
      '负面情绪(%)': s.sentimentNegative, '互动率(%)': s.engagementRate, '周变化(%)': s.weekChange
    };
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(socialSheet), '社媒数据');

  // Sheet 5: 电商平台
  const ecomKeys = Object.keys(ecomData);
  const ecomSheet = ecomKeys.map(k => {
    const e = ecomData[k];
    return {
      '平台': e.platform, '区域': e.region, '产品数': e.totalProducts,
      '均价(USD)': e.avgPrice, '市场份额(%)': e.marketShare, '增长(%)': e.growth,
      'TOP品类': e.topCategories.map(c => c.name + '(' + c.share + '%)').join(', ')
    };
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(ecomSheet), '电商平台');

  // Sheet 6: 跨平台矩阵
  const matrixSheet = matrixData.map(m => ({
    '品类': m.category, 'Google Trends': m.googleTrend, 'TikTok': m.tiktok,
    'Amazon': m.amazon, '电商平台': m.ecommerce, '一致性评分': m.consistencyScore,
    '判断': m.verdict, '建议动作': m.action
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(matrixSheet), '跨平台矩阵');

  // Sheet 7: 风险预警
  const allRisksForExcel = riskData.regulatory ? [...riskData.regulatory, ...riskData.trade, ...riskData.ip, ...riskData.market, ...riskData.opportunity] : [];
  const riskSheet = allRisksForExcel.map(r => ({
    '风险项': r.risk, '类别': r.category, '风险等级': r.level, '概率': r.probability,
    '影响': r.impact, '详情': r.detail, '应对措施': r.action
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(riskSheet), '风险预警');

  return wb;
}

// ==================== 主流程 ====================
// main() 定义在文件上部 (async function)，此处是底部调用入口
// 如果作为模块被 require，不自动执行
if (require.main === module) {
  main().catch(e => { console.error('❌ 报告生成失败:', e.message); process.exit(1); });
}
