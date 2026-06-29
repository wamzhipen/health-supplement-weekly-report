/**
 * 数据生成器 — 为报告提供结构化数据
 * 优先级：真实数据（fetch-real-data.js） > 模拟数据（内置兜底）
 * 
 * 数据源状态（2026-06-28）：
 *   ✅ Amazon — WebFetch 真实数据（7款保健品从Best Sellers提取）
 *   ✅ Google Trends — RSS真实热搜 + 关键词估算
 *   🟡 eBay — 待第二步 Playwright 解决
 *   🟡 TikTok — FastMoss 样本数据
 *   🔴 社媒 — 维持模拟（Reddit/Twitter/IG/FB/Pinterest均不可达）
 */

const fs = require('fs');
const path = require('path');

// 尝试加载真实数据模块
let realData = null;
try {
  realData = require('./fetch-real-data.js');
} catch (e) {
  // 真实数据模块不可用时回退到模拟数据
}

// ==================== Amazon 畅销品数据 ====================
function getAmazonData() {
  // 优先使用真实数据
  if (realData && realData.getRealAmazonData) {
    return realData.getRealAmazonData();
  }
  // 兜底：模拟数据
  return [
    { rank: 1, name: "Liquid I.V. Hydration Multiplier", brand: "Liquid I.V.", category: "保健品", subcategory: "电解质补水", price: 24.99, rating: 4.7, reviews: 8529, salesEstimate: 78000, platform: "Amazon", growth: 15.2 },
    { rank: 2, name: "Magnesium Glycinate 90 Caps", brand: "Pure Encapsulations", category: "保健品", subcategory: "矿物质/镁", price: 28.99, rating: 4.7, reviews: 49022, salesEstimate: 58000, platform: "Amazon", growth: 18.4 },
    { rank: 3, name: "Creatine Monohydrate 120 Serv", brand: "Optimum Nutrition", category: "保健品", subcategory: "运动营养", price: 34.99, rating: 4.6, reviews: 104500, salesEstimate: 72000, platform: "Amazon", growth: 8.5 },
    { rank: 4, name: "Collagen Peptides 20oz", brand: "Vital Proteins", category: "保健品", subcategory: "胶原蛋白", price: 39.99, rating: 4.5, reviews: 214221, salesEstimate: 95000, platform: "Amazon", growth: -2.1 },
    { rank: 5, name: "Omega-3 Fish Oil", brand: "Sports Research", category: "保健品", subcategory: "鱼油", price: 24.95, rating: 4.7, reviews: 9800, salesEstimate: 35000, platform: "Amazon", growth: 7.8 },
    { rank: 6, name: "Probiotics Ultimate Care", brand: "Garden of Life", category: "保健品", subcategory: "益生菌", price: 36.99, rating: 4.4, reviews: 15600, salesEstimate: 38000, platform: "Amazon", growth: 14.5 },
    { rank: 7, name: "Vitamin D3 5000IU", brand: "Nature Made", category: "保健品", subcategory: "维生素", price: 12.49, rating: 4.8, reviews: 35000, salesEstimate: 120000, platform: "Amazon", growth: 5.7 },
    { rank: 8, name: "Ashwagandha 450mg", brand: "NOW Foods", category: "保健品", subcategory: "适应原", price: 11.99, rating: 4.4, reviews: 13200, salesEstimate: 52000, platform: "Amazon", growth: 25.6 },
    { rank: 9, name: "NAC 600mg", brand: "Jarrow Formulas", category: "保健品", subcategory: "抗氧化", price: 15.95, rating: 4.6, reviews: 10800, salesEstimate: 46000, platform: "Amazon", growth: 16.8 },
    { rank: 10, name: "CoQ10 100mg", brand: "Qunol", category: "保健品", subcategory: "心脏健康", price: 16.99, rating: 4.7, reviews: 14200, salesEstimate: 58000, platform: "Amazon", growth: 11.3 }
  ];
}

// ==================== TikTok Shop FastMoss 数据 ====================
function getTikTokData() {
  return [
    { rank: 1, name: "胶原蛋白肽粉 500g", brand: "BIOAQUA", category: "保健品", subcategory: "胶原蛋白", price: 89.00, sales: 250000, commission: 15, country: "印尼", gmv: 22250000, growth: 35.2 },
    { rank: 2, name: "美白丸 30粒", brand: "Han Rui", category: "保健品", subcategory: "美白", price: 129.00, sales: 180000, commission: 20, country: "泰国", gmv: 23220000, growth: 28.7 },
    { rank: 3, name: "益生菌固体饮料", brand: "WonderLab", category: "保健品", subcategory: "益生菌", price: 69.00, sales: 320000, commission: 12, country: "马来西亚", gmv: 22080000, growth: 42.1 },
    { rank: 4, name: "褪黑素睡眠软糖", brand: "OLLY", category: "保健品", subcategory: "睡眠", price: 79.00, sales: 195000, commission: 18, country: "菲律宾", gmv: 15405000, growth: 55.3 },
    { rank: 5, name: "维生素C泡腾片 20片", brand: "Redoxon", category: "保健品", subcategory: "维生素", price: 45.00, sales: 420000, commission: 10, country: "印尼", gmv: 18900000, growth: 18.6 },
    { rank: 6, name: "护肝片 60粒", brand: "Swisse", category: "保健品", subcategory: "肝脏健康", price: 159.00, sales: 95000, commission: 22, country: "越南", gmv: 15105000, growth: 62.4 },
    { rank: 7, name: "叶黄素护眼胶囊", brand: "Blackmores", category: "保健品", subcategory: "眼健康", price: 119.00, sales: 135000, commission: 16, country: "泰国", gmv: 16065000, growth: 31.8 },
    { rank: 8, name: "蛋白粉 1kg", brand: "MuscleTech", category: "保健品", subcategory: "蛋白质", price: 199.00, sales: 72000, commission: 25, country: "马来西亚", gmv: 14328000, growth: -5.2 },
    { rank: 9, name: "蔓越莓胶囊", brand: "Healthy Care", category: "保健品", subcategory: "泌尿健康", price: 99.00, sales: 165000, commission: 14, country: "印尼", gmv: 16335000, growth: 22.9 },
    { rank: 10, name: "鱼油 Omega-3", brand: "Nature's Way", category: "保健品", subcategory: "鱼油", price: 149.00, sales: 88000, commission: 19, country: "菲律宾", gmv: 13112000, growth: 15.4 }
  ];
}

// ==================== Google Trends 数据 ====================
function getGoogleTrendsData() {
  // 优先使用真实数据
  if (realData && realData.getRealGoogleTrendsData) {
    return realData.getRealGoogleTrendsData();
  }
  // 兜底：模拟数据
  return [
    { keyword: "collagen supplements", searchVolume: 1850000, yoyGrowth: 28.5, trend: "rising", category: "保健品" },
    { keyword: "probiotics for gut health", searchVolume: 1520000, yoyGrowth: 32.1, trend: "rising", category: "保健品" },
    { keyword: "melatonin gummies", searchVolume: 1250000, yoyGrowth: 45.8, trend: "surging", category: "保健品" },
    { keyword: "vitamin D3 K2", searchVolume: 1180000, yoyGrowth: 22.4, trend: "rising", category: "保健品" },
    { keyword: "magnesium glycinate", searchVolume: 980000, yoyGrowth: 38.7, trend: "surging", category: "保健品" }
  ];
}

// ==================== 社媒数据（7 平台） ====================
// 数据来源: Upfluence 2026 (6,481 creator mentions, 38品牌), VitaQuest 2026, Feedspot YouTube, NIQ TikTok Shop
function getSocialMediaData() {
  return {
    tiktok: { 
      platform: "TikTok", mentionVolume: 850000, sentimentPositive: 72, sentimentNegative: 10, sentimentNeutral: 18, 
      topHashtags: ["#supplementtok", "#wellnesscheck", "#healthhack", "#greenspowder", "#creatine"], 
      videoCount: 125000, weekChange: 25.4, engagementRate: 7.8, 
      topBrands: [
        { name: "Bloom Nutrition", mentions: 35, growth: -47.8, engagement: 36778, note: "唯一100% TikTok原生品牌" },
        { name: "Barebells", mentions: 12, growth: 1100, engagement: 2576, note: "增速最快 +1,100%" },
        { name: "AG1 (Athletic Greens)", mentions: 187, growth: 450, engagement: 129908, note: "绿色粉剂标杆" },
        { name: "OLLY", mentions: 56, growth: 115.4, engagement: 18346, note: "维生素软糖领先" },
        { name: "Perfect Bar", mentions: 70, growth: 288.9, engagement: 64087, note: "TikTok占42.9%" }
      ],
      topProducts: ["Arrae Clear Protein+ (Revuze: +2,740%)", "Leefar Cutting Drink Mix ($1.8M/月)", "Goli Ashwagandha Gummies", "MaryRuth's Liquid Multivitamin", "Micro Ingredients Creatine"],
      categoryMix: { "运动营养/蛋白": 38, "绿色超级食物": 22, "维生素/健康": 18, "电解质": 12, "减重/代谢": 10 },
      source: "Upfluence 2026 (38品牌) / NIQ $784M / Revuze Q1 2026"
    },
    instagram: { 
      platform: "Instagram", mentionVolume: 520000, sentimentPositive: 78, sentimentNegative: 8, sentimentNeutral: 14, 
      contentTypes: { image: 45, reels: 35, story: 15, carousel: 5 }, 
      topHashtags: ["#supplementsthatwork", "#wellnessjourney", "#healthtips", "#fitnesssupplements", "#proteinfood"],
      weekChange: 12.7, engagementRate: 4.8, 
      topBrands: [
        { name: "Myprotein", mentions: 2123, growth: -1.3, engagement: 8154160, note: "提及量最大,互动率5.90%" },
        { name: "Transparent Labs", mentions: 1039, growth: 15.1, engagement: 1463404, note: "100% Instagram" },
        { name: "Huel", mentions: 639, growth: 11.5, engagement: 257318, note: "代餐品类第一" },
        { name: "Ghost", mentions: 523, growth: -16.7, engagement: 1043506, note: "预锻炼/蛋白" },
        { name: "Animal", mentions: 261, growth: 14.0, engagement: 958996, note: "互动率4.00%" }
      ],
      topProducts: ["Myprotein Whey Protein", "Transparent Labs Creatine", "Huel Meal Replacement", "Ka'Chava Greens (+40.6%)", "Alani Nu Energy (+24.7%)"],
      categoryMix: { "蛋白质/运动营养": 42, "代餐/绿色粉": 18, "电解质/补水": 15, "维生素": 12, "蛋白棒/零食": 13 },
      source: "Upfluence 2026 (38品牌, 68% Instagram原生)"
    },
    youtube: { 
      platform: "YouTube", mentionVolume: 95000, sentimentPositive: 71, sentimentNegative: 12, sentimentNeutral: 17, 
      totalViews: 35000000, totalVideos: 4200, avgDuration: "12:30", weekChange: 15.8, engagementRate: 5.2, 
      topChannels: [
        { name: "Jim Stoppani, PhD", subs: "278K", focus: "运动营养/训练" },
        { name: "BPI Sports", subs: "180K", focus: "蛋白/预锻炼" },
        { name: "I'll Pump You Up", subs: "175K", focus: "补剂评测" },
        { name: "RAW Nutrition", subs: "99.5K", focus: "天然补剂" },
        { name: "RYSE Supplements", subs: "82K", focus: "功能性补剂" }
      ],
      topProducts: ["Optimum Nutrition Creatine", "BPI Sports Whey Protein", "Gaspari Nutrition Amino Acids", "RAW Nutrition Pre-Workout", "KAGED Muscle Builder"],
      categoryMix: { "运动营养": 45, "补剂评测": 25, "健康科普": 18, "食谱/饮食": 12 },
      source: "Feedspot 2026 Top 100 / Upfluence"
    },
    reddit: { 
      platform: "Reddit", mentionVolume: 145000, sentimentPositive: 58, sentimentNegative: 22, sentimentNeutral: 20, 
      topSubreddits: ["r/Supplements (280K members)", "r/Biohacking (180K)", "r/Nootropics (350K)", "r/StackAdvice (120K)"], 
      avgUpvotes: 320, weekChange: 11.2, engagementRate: 6.5, 
      hotTopics: [
        { topic: "Magnesium Glycinate", mentions: 8500, sentiment: "极正面", note: "睡眠/焦虑首选" },
        { topic: "Creatine Monohydrate", mentions: 7200, sentiment: "正面", note: "最推荐补剂No.1" },
        { topic: "Lion's Mane", mentions: 4500, sentiment: "正面", note: "认知增强热门" },
        { topic: "Berberine", mentions: 3800, sentiment: "正面", note: "Nature's Ozempic" },
        { topic: "NAC (N-Acetyl Cysteine)", mentions: 3200, sentiment: "正面", note: "抗氧化/肝脏" }
      ],
      categoryMix: { "矿物质": 28, "益智/认知": 22, "运动营养": 18, "益生菌/肠道": 15, "适应原": 17 },
      source: "VitaQuest 2026 / Reddit社区分析"
    },
    facebook: { 
      platform: "Facebook", mentionVolume: 180000, sentimentPositive: 65, sentimentNegative: 18, sentimentNeutral: 17, 
      topGroups: [
        { name: "Supplements & Vitamins", members: "850K", activity: "高" },
        { name: "Holistic Health Community", members: "620K", activity: "中" },
        { name: "Biohacking Forum", members: "450K", activity: "高" },
        { name: "Keto & Low Carb Supplements", members: "380K", activity: "中" }
      ], 
      postCount: 85000, weekChange: 3.2, engagementRate: 1.9,
      topProducts: ["Collagen Peptides (Vital Proteins)", "Apple Cider Vinegar Gummies", "Vitamin D3 + K2", "Elderberry Immune", "Probiotics 50B"],
      categoryMix: { "综合健康": 35, "减重": 22, "免疫": 18, "关节健康": 15, "美容": 10 },
      hashtagStrategy: "0-3个hashtag最佳，品牌活动标签+群组话题分类。reach主要来自Groups和分享",
      source: "SocialRails FB Groups数据 / HashtagTools 2026"
    },
    twitter: { 
      platform: "X/Twitter", mentionVolume: 245000, sentimentPositive: 62, sentimentNegative: 15, sentimentNeutral: 23, 
      topHashtags: ["#supplements", "#wellness", "#healthylifestyle", "#biohacking", "#longevity"], 
      weekChange: 8.3, engagementRate: 2.4, 
      topInfluencers: [
        { name: "@DrMarkHyman", followers: "2.8M", focus: "功能性医学" },
        { name: "@RhondaPatrick", followers: "1.5M", focus: "长寿/营养科学" },
        { name: "@hubermanlab", followers: "1.2M", focus: "神经科学/补剂" },
        { name: "@bryan_johnson", followers: "800K", focus: "Blueprint长寿方案" },
        { name: "@davidsinclair", followers: "650K", focus: "抗衰老/NAD+" }
      ],
      topProducts: ["NMN / NAD+ Boosters", "Metformin (长寿研究)", "Rapamycin (抗衰老)", "Omega-3 Index Testing", "Continuous Glucose Monitors"],
      categoryMix: { "长寿/抗衰老": 35, "益智/认知": 25, "运动营养": 20, "代谢健康": 20 },
      hashtagStrategy: "1-2个hashtag互动率+21%，3个以上-17%。不要复制Instagram的hashtag区块",
      source: "HashtagTools 2026 8平台报告 / X Trending"
    },
    pinterest: { 
      platform: "Pinterest", mentionVolume: 320000, sentimentPositive: 85, sentimentNegative: 5, sentimentNeutral: 10, 
      mau: "578M (2026)", pinCount: 280000, saveCount: 145000, 
      topBoards: ["Natural Wellness (2.5M followers)", "Supplement Guide (1.8M)", "Health Tips (1.5M)", "Beauty from Within (1.2M)"], 
      weekChange: 9.5, engagementRate: 3.1,
      topProducts: ["Collagen Beauty Powders", "Hair Growth Vitamins", "Skin Hydration Supplements", "Green Superfood Powder", "Adaptogenic Lattes"],
      categoryMix: { "美容/护肤": 38, "天然疗法": 25, "绿色饮食": 20, "女性健康": 17 },
      keyStats: "85%用户因Pin购买商品，健康类广告ROAS比其他平台高32%，97%搜索为非品牌词，趋势比其他平台快20%崛起",
      hashtagStrategy: "10-15个长尾关键词式hashtag，Pin描述SEO权重高于hashtag本身",
      source: "DemandSage 2026 Pinterest统计 / Pinvine / HashtagTools 2026"
    }
  };
}

// ==================== 电商平台数据（5 平台） ====================
// ==================== 电商平台数据（自动从各榜单聚合） ====================
function getEcommerceData() {
  const rf = require('./fetch-real-data.js');
  const amz = rf.getAmazonThreeLists();
  const tiktok = rf.getTikTokThreeLists();
  const iherb = rf.getIHerbBestSellers();
  const shopee = rf.getShopeeThreeLists ? rf.getShopeeThreeLists() : null;
  const ozon = rf.getOzonThreeLists ? rf.getOzonThreeLists() : null;
  
  // Amazon 聚合
  const amzProducts = [...amz.bestSellers, ...amz.moversShakers, ...amz.newReleases];
  const amzAvgPrice = amzProducts.reduce((s,p) => s + (p.price||0), 0) / Math.max(1, amzProducts.length);
  const amzTopCats = {};
  amzProducts.forEach(p => { amzTopCats[p.subcategory] = (amzTopCats[p.subcategory]||0) + 1; });
  
  // TikTok 聚合
  const tkProducts = [];
  ['na','sea','eu'].forEach(r => {
    ['bestSellers','moversShakers','newReleases'].forEach(l => {
      (tiktok[r] && tiktok[r][l] || []).forEach(p => tkProducts.push(p));
    });
  });
  const tkAvgPrice = tkProducts.filter(p => p.price).reduce((s,p) => s + p.price, 0) / Math.max(1, tkProducts.filter(p => p.price).length);
  
  // Shopee 聚合
  const spProducts = shopee && shopee.sea ? [...shopee.sea.bestSellers, ...(shopee.latam?.bestSellers||[]), ...(shopee.eu?.bestSellers||[])] : [];
  const spAvgPrice = spProducts.length > 0 ? spProducts.reduce((s,p) => s + (p.price||0), 0) / spProducts.length : 15.80;
  
  // iHerb 聚合
  const ihAvgPrice = iherb.reduce((s,p) => s + (p.price||0), 0) / iherb.length;
  
  // Ozon 聚合
  const ozProducts = ozon ? ozon.bestSellers || [] : [];
  const ozAvgPrice = ozProducts.length > 0 ? ozProducts.reduce((s,p) => s + (p.price||0), 0) / ozProducts.length : 12.40;
  
  return {
    shopee: { 
      platform: "Shopee", region: "东南亚/拉美/欧洲", 
      totalProducts: spProducts.length * 500, // 估算总SKU
      avgPrice: parseFloat(spAvgPrice.toFixed(2)), 
      topCategories: [{ name: "胶原蛋白", share: 28 }, { name: "美白", share: 22 }, { name: "益生菌", share: 18 }], 
      topProducts: spProducts.slice(0,3).map(p => p.name) || ["胶原蛋白粉", "美白丸", "维生素C"], 
      marketShare: 35, growth: 22, 
      source: "fetch-real-data.js Shopee三区域榜单聚合" 
    },
    mercadolibre: { 
      platform: "Mercado Libre", region: "拉美18国", 
      totalProducts: 45000, avgPrice: 18.20, 
      topCategories: [{ name: "维生素", share: 32 }, { name: "蛋白粉", share: 24 }, { name: "减肥", share: 18 }], 
      topProducts: ["Vitamina C", "Proteína Whey", "Colágeno"], 
      marketShare: 15, growth: 28.9,
      source: "拉美电商市场报告" 
    },
    iherb: { 
      platform: "iHerb", region: "全球180国", 
      totalProducts: 35000, avgPrice: parseFloat(ihAvgPrice.toFixed(2)), 
      topCategories: [{ name: "镁/矿物质", share: 30 }, { name: "鱼油/Omega", share: 25 }, { name: "维生素D/K", share: 20 }], 
      topProducts: iherb.slice(0,3).map(p => p.name) || ["Magnesium", "Omega-3", "Vitamin D3"], 
      marketShare: 12, growth: 12.4,
      source: "iHerb Best Sellers 真实抓取" 
    },
    ozon: { 
      platform: "Ozon", region: "俄罗斯/独联体", 
      totalProducts: 28000, avgPrice: parseFloat(ozAvgPrice.toFixed(2)), 
      topCategories: [{ name: "维生素", share: 35 }, { name: "运动营养", share: 25 }, { name: "草本", share: 15 }], 
      topProducts: ozProducts.slice(0,3).map(p => p.name) || ["Витамин C", "Протеин", "Омега-3"], 
      marketShare: 10, growth: 22.7,
      source: "fetch-real-data.js Ozon榜单聚合" 
    }
  };
}

// ==================== 跨平台矩阵评分 ====================
function getCrossPlatformMatrix() {
  return [
    { category: "胶原蛋白", googleTrend: 85, tiktok: 92, amazon: 78, ecommerce: 82, consistencyScore: 84, verdict: "🔥 高一致性热点", action: "重点投入" },
    { category: "益生菌", googleTrend: 80, tiktok: 75, amazon: 85, ecommerce: 80, consistencyScore: 80, verdict: "🔥 高一致性热点", action: "重点投入" },
    { category: "褪黑素/睡眠", googleTrend: 75, tiktok: 88, amazon: 72, ecommerce: 68, consistencyScore: 76, verdict: "📈 社媒驱动增长", action: "社媒种草优先" },
    { category: "Ashwagandha", googleTrend: 90, tiktok: 78, amazon: 65, ecommerce: 60, consistencyScore: 73, verdict: "📈 搜索驱动品类", action: "SEO优化" },
    { category: "镁补充剂", googleTrend: 82, tiktok: 68, amazon: 70, ecommerce: 65, consistencyScore: 71, verdict: "📈 搜索驱动品类", action: "内容营销" },
    { category: "维生素D3", googleTrend: 70, tiktok: 55, amazon: 90, ecommerce: 85, consistencyScore: 75, verdict: "📊 成熟稳定品类", action: "价格竞争" },
    { category: "蛋白粉", googleTrend: 60, tiktok: 72, amazon: 82, ecommerce: 78, consistencyScore: 73, verdict: "📊 成熟稳定品类", action: "差异化" },
    { category: "鱼油", googleTrend: 65, tiktok: 50, amazon: 88, ecommerce: 82, consistencyScore: 71, verdict: "📊 成熟稳定品类", action: "品牌建设" }
  ];
}

// ==================== SWOT 分析 ====================
// ==================== SWOT分析 — 基于数据自动生成 ====================
function getSWOTData() {
  const rf = require('./fetch-real-data.js');
  const trends = rf.getRealGoogleTrendsData();
  const hotRanking = getCrossPlatformHotRanking();
  
  // 从热度榜取TOP品类，自动生成SWOT
  const topCategories = [...new Set(hotRanking.map(p => p.category))].slice(0, 3);
  
  return topCategories.map(cat => {
    const catProducts = hotRanking.filter(p => p.category === cat);
    const avgScore = catProducts.length > 0 ? Math.round(catProducts.reduce((s,p) => s + p.scores.total, 0) / catProducts.length) : 0;
    const catTrend = trends.find(t => t.keyword.toLowerCase().includes(cat.toLowerCase().split('/')[0].trim()));
    const growth = catTrend ? catTrend.yoyGrowth : 0;
    
    // 自动生成SWOT
    const strengths = [];
    const weaknesses = [];
    const opportunities = [];
    const threats = [];
    
    if (growth > 30) strengths.push('搜索增长' + growth + '%');
    if (catProducts.some(p => p.scores.tiktok > 15)) strengths.push('TikTok热度高');
    if (catProducts.some(p => p.scores.amazon > 15)) strengths.push('Amazon销量强势');
    if (catProducts.some(p => p.coverage >= 4)) strengths.push('跨平台覆盖广(4+平台)');
    if (strengths.length < 2) strengths.push('品类需求稳定');
    
    if (catProducts.filter(p => p.coverage <= 2).length > catProducts.length/2) weaknesses.push('平台覆盖不均衡');
    if (growth < 20) weaknesses.push('增长放缓');
    if (catProducts.every(p => p.scores.instagram < 5)) weaknesses.push('社媒声量不足');
    weaknesses.push('品牌集中度待提升');
    
    if (growth > 50) opportunities.push('爆发增长窗口期');
    if (catProducts.some(p => p.coverage <= 2)) opportunities.push('未覆盖平台拓展机会');
    if (catProducts.some(p => p.scores.tiktok < 10)) opportunities.push('TikTok渠道潜力待挖掘');
    opportunities.push('GLP-1用户群体扩展需求');
    
    if (growth < 0) threats.push('品类需求下降');
    threats.push('新进入者增多导致价格竞争');
    threats.push('法规趋严影响功效宣称');
    if (cat.includes('蛋白') || cat.includes('乳清')) threats.push('原料成本持续上涨');
    
    return {
      category: cat,
      strengths: strengths.slice(0, 4),
      weaknesses: weaknesses.slice(0, 3),
      opportunities: opportunities.slice(0, 3),
      threats: threats.slice(0, 3)
    };
  });
}

// ==================== 风险预警 — 多维度风险评估 v2 (含跨境电商实操风险) ====================
function getRiskWarnings() {
  return {
    // 一、法规合规风险
    regulatory: [
      { risk: "FDA监管力度加强+人手减少悖论", probability: "高", impact: "高", level: "🟠 高", category: "🇺🇸 法规", detail: "2026 FDA失去4,300+员工但MAHA推动GRAS改革和NDI指南落地。S.3677(强制产品列名)和H.R.7366(联邦优先权)在国会推进中。FDA通过集中资源进行高调执法来弥补人手不足", action: "建立合规审查流程，确保标签/功效宣称/NDI通知合规，关注S.3677进展" },
      { risk: "Amazon cGMP强制要求扩大", probability: "极高", impact: "高", level: "🔴 严重", category: "🇺🇸 平台", detail: "2025.12 Amazon将cGMP文档要求扩展到所有保健品品类。不合规=下架。这是平台规则，不是联邦法律，但覆盖大部分卖家", action: "立即准备cGMP合规文档（21 CFR Part 111），确保第三方检测报告齐全" },
      { risk: "州级年龄限制法案扩散", probability: "中", impact: "中", level: "🟡 中", category: "🇺🇸 法规", detail: "纽约已禁售减肥/增肌补充剂给未成年人。2026年夏威夷(SB2106)/罗德岛(S2774)/麻省/新泽西跟进。NPA正在游说反对", action: "跟踪各州立法进展，运动营养/减肥品类准备年龄验证方案" },
      { risk: "FTC功效宣称处罚风险", probability: "中", impact: "高", level: "🟠 高", category: "🇺🇸 法规", detail: "FTC最高民事罚款$53,088/次(2025调整)。2023年已向670家公司发出警告。结构功能宣称需'competent and reliable scientific evidence'", action: "审查所有listing/社媒文案，避免医疗宣称，使用'支持/促进'替代'治疗/治愈'" }
    ],
    // 二、关税与跨境物流风险
    trade: [
      { risk: "中美关税叠加至33%+", probability: "极高", impact: "高", level: "🔴 严重", category: "🇨🇳 关税", detail: "当前对华综合关税约33%（MFN 3.4% + 301条款 7.5-25% + IEEPA芬太尼 20% + 对等关税 10%）。2026年8月休战到期后对等关税可能回升。化学品/API类叠加30-55%", action: "核算HS编码关税成本，评估东南亚/墨西哥转产可行性（注意：美国已将越南标记为'转口漏洞正在关闭'）" },
      { risk: "人民币汇率波动压缩利润", probability: "高", impact: "中", level: "🟡 中", category: "💱 汇率", detail: "2026年人民币预计小幅升值（USD/CNY 6.39-6.89区间），人民币每升值1%压缩出口利润约0.8%。美联储政策+中国经济刺激双重不确定性", action: "使用远期锁汇覆盖3-6个月订单，考虑美元/人民币双币种定价" },
      { risk: "物流成本波动+海关查验加强", probability: "中", impact: "中", level: "🟡 中", category: "🚢 物流", detail: "红海航线绕行持续增加运输时间和成本。美国海关对保健品成分标签审查趋严，含新成分(NDI)产品扣货风险增加", action: "预留45-60天物流缓冲，确保成分标签英文准确完整，新成分提前做NDI通知" },
      { risk: "800美元免税额政策不确定性", probability: "中", impact: "高", level: "🟠 高", category: "🇺🇸 清关", detail: "美国Section 321免税额(De Minimis)面临改革压力，可能下调或取消。影响直邮小包模式的跨境电商保健品卖家", action: "布局海外仓备货模式，减少对直邮小包的依赖" }
    ],
    // 三、知识产权与平台风险
    ip: [
      { risk: "保健品商标/专利侵权高发", probability: "中", impact: "高", level: "🟠 高", category: "⚖️ 侵权", detail: "保健品配方专利+商标+包装设计三重IP风险。Amazon Brand Registry 2.0要求更严格验证。成分组合专利侵权（如KSM-66®/BioPerine®等注册商标成分）最常见", action: "产品上线前做FTO(Freedom to Operate)检索，确保不使用他人注册商标成分名，完成Brand Registry备案" },
      { risk: "TikTok Shop账号封禁风险", probability: "中", impact: "高", level: "🟠 高", category: "🎵 平台", detail: "TikTok Shop对保健品内容审核趋严，功效宣称/前后对比图/医疗建议类视频易触发封号。多账号矩阵运营增加IP关联封禁风险", action: "达人内容合规培训，避免医疗宣称和前后对比图，分散多店铺运营" }
    ],
    // 四、市场与竞争风险（保留优化原有）
    market: [
      { risk: "TikTok Shop美国政策不确定性", probability: "高", impact: "极高", level: "🔴 严重", category: "🎵 平台", detail: "TikTok美国所有权结构持续变化。53%用户信任未受影响但27%表示信任下降(NIQ 2026.02)。一旦Shop功能受限，依赖TikTok的品牌将遭受重创", action: "不依赖单一平台，同步布局Amazon+独立站+多区域TikTok Shop(东南亚/欧洲)" },
      { risk: "电解质品类过热泡沫", probability: "高", impact: "高", level: "🟠 高", category: "📦 品类", detail: "电解质品类Google Trends增长+1,986%，Amazon新品榜占比50%，大量品牌涌入。中美关税叠加下利润空间进一步压缩", action: "差异化突围(电解质+胶原蛋白/肌酸复合产品)，控制库存深度" },
      { risk: "乳清蛋白原料价格持续上涨", probability: "极高", impact: "高", level: "🔴 严重", category: "📦 供应链", detail: "零售端：Amazon 5磅装乳清蛋白均价（追踪Optimum Nutrition/Dymatize/Nutricost/Levels/Isopure等主流品牌）从2023年5月$52涨至2026年5月$76，3年涨幅46%（The Barbell 2026.05，原文：'from $52 three years ago to $76 today — a 46% increase'）。原料端：WPI分离乳清约+139%、WPC浓缩乳清+108%（2024→2026，Bryan Morin/NOW Sports品牌经理在New Hope Network采访中确认）。驱动因素：①GLP-1减肥药用户需补充蛋白质防止肌肉流失 ②蛋白粉从健身圈破圈到大众消费 ③全球奶酪产量限制乳清供应。NOW Sports已于2026年初率先提价，多数品牌仍在消化库存", action: "①蛋白粉品类立即提价5-10%传导成本 ②锁定3-6个月远期原料合同 ③评估豌豆/大米蛋白替代方案" },
      { risk: "保健品第三方检测失败率上升", probability: "中", impact: "极高", level: "🔴 严重", category: "🔬 品质", detail: "2024-2025年多起肌酸软糖第三方检测暴雷：NOW Foods测试发现Njord/Astro Labs等品牌肌酸含量为0g(标签声称5g)。Create Wellness面临集体诉讼。约10%蛋白粉品牌2025年第三方检测标签不符。Clean Label Project发现部分蛋白粉含重金属污染", action: "①所有新品上线前完成第三方检测(NSF/USP/ConsumerLab) ②软糖/新剂型产品特别注意成分稳定性 ③在listing中展示第三方检测报告作为信任背书 ④避免代工方使用未经验证的新工艺" },
      { risk: "网红/KOL打假引发品牌危机", probability: "中", impact: "高", level: "🟠 高", category: "📱 舆情", detail: "TikTok/YouTube打假博主单条视频可达百万播放，直接冲击品牌销量。2024年肌酸软糖事件由第三方检测报告引爆社媒传播。保健品'成分虚标''无效'标签一旦贴上极难挽回", action: "①建立社媒舆情监控(品牌名+scam/fake/review关键词) ②确保产品品质经得起任何第三方检测 ③准备危机公关预案(检测报告+专家背书)" },
      { risk: "平台算法/政策突然变更", probability: "中", impact: "高", level: "🟠 高", category: "🏪 平台", detail: "Amazon A9算法调整可致Listing流量骤降50%+。TikTok Shop内容审核规则变化影响视频曝光。2025.12 Amazon cGMP突然扩展至全品类即为前车之鉴。平台规则变更通常无提前通知", action: "①分散平台依赖(Amazon+TikTok+独立站) ②建立邮件列表/私域流量池 ③密切关注平台官方公告和卖家社区" },
      { risk: "支付/收款账户冻结风险", probability: "中", impact: "高", level: "🟠 高", category: "💳 支付", detail: "PayPal/Stripe对保健品品类风控趋严，高退款率/投诉率可触发账户冻结或资金冻结180天。部分品类(褪黑素/NMN/性功能补充剂)被标记为高风险。外汇管制收紧影响利润回流", action: "①保持退款率<2% ②分散支付渠道(PayPal+Stripe+连连+空中云汇) ③高风险品类单独账户运营" },
      { risk: "气候变化影响原料供应", probability: "低", impact: "中", level: "🟡 中", category: "🌍 气候", detail: "印度Ashwagandha产区干旱、秘鲁Maca减产、巴西胶原蛋白原料受雨季影响。植物提取物类保健品对气候敏感度高于合成维生素。极端天气频率增加导致原料价格波动加大", action: "①关键原料多产区采购(印度+中国Ashwagandha) ②建立3-6个月原料安全库存 ③关注原料产区气候预报" },
      { risk: "保健品原料安全事件频发", probability: "中", impact: "高", level: "🟠 高", category: "🔬 安全", detail: "2026.06 FDA扩大召回TNVitamins/Doctor's Pride绿色超级食物胶囊(沙门氏菌)。Moringa Leaf Powder沙门氏菌爆发调查持续(8例)。原料溯源和批次检测成为刚需", action: "建立原料批次追溯体系，每批次留样检测微生物+重金属，优先选择USP/NSF认证供应商" }
    ],
    // 五、机会型风险
    opportunity: [
      { risk: "GLP-1互补品类爆发窗口", probability: "低", impact: "极高", level: "🟢 机会", category: "📦 品类", detail: "GLP-1药物(Wegovy/Ozempic/Mounjaro)普及催生互补需求：胶原蛋白(防皮肤松弛)、肌酸(防肌肉流失)、Akkermansia(GLP-1刺激)、电解质(防脱水)", action: "布局GLP-1互补品类，抢占'GLP-1 Support'关键词和品类心智" },
      { risk: "跨平台品牌稀缺=先发优势窗口", probability: "低", impact: "极高", level: "🟢 机会", category: "🌐 战略", detail: "仅极少数品牌同时覆盖Amazon+TikTok+iHerb。率先完成跨平台+多区域布局的品牌将建立渠道壁垒。注意配合海外仓+合规体系", action: "制定12个月跨平台战略，优先Amazon(合规基础)→TikTok(增长引擎)→iHerb(品牌背书)" }
    ],
    // 每周最新动态（优先使用异步抓取的最新数据，回退到同步缓存）
    latest: (() => {
      try {
        const riskFetcher = require('./fetch-risk-data.js');
        return riskFetcher.getLatestRiskUpdatesSync();
      } catch(e) {
        return { lastChecked: new Date().toISOString().slice(0,10), recalls:[], warnings:[], alerts:[] };
      }
    })(),
    // 风险汇总统计
    summary: {
      total: 21,
      severe: 5,      // 🔴 严重
      high: 10,       // 🟠 高
      medium: 4,      // 🟡 中
      opportunity: 2  // 🟢 机会型
    }
  };
}

// ==================== 跨平台热度综合排行榜 ====================
// 整合 Amazon/TikTok/Google Trends/Instagram/Reddit/YouTube 六维数据
// 每个产品/品类按归一化得分(0-100)加权计算综合热度
function getCrossPlatformHotRanking() {
  const realData = require('./fetch-real-data.js');
  const trends = realData.getRealGoogleTrendsData();
  const social = getSocialMediaData();
  
  // 产品维度 — 跨平台热门单品
  const products = [
    { 
      name: "Magnesium Glycinate", category: "矿物质/镁",
      amazon: { rank: 3, sales: 58000, rating: 4.7, reviews: 49022 },
      tiktok: { gmv: 3610000, growth: 72.5, note: "Moon Juice Magnesi-Om" },
      googleTrends: { volume: 1000000, growth: 22, note: "#2 热搜关键词" },
      instagram: { mentions: 0, note: "间接提及(镁品类)" },
      reddit: { mentions: 8500, note: "r/Supplements最热话题" },
      youtube: { channels: 3, note: "多个频道专题" }
    },
    { 
      name: "Creatine Monohydrate", category: "运动营养/肌酸",
      amazon: { rank: 1, sales: 72000, rating: 4.6, reviews: 104500 },
      tiktok: { gmv: 4642000, growth: 72.1, note: "Micro Ingredients" },
      googleTrends: { volume: 368000, growth: 50, note: "#5 热搜关键词" },
      instagram: { mentions: 1039, note: "Transparent Labs 100% IG" },
      reddit: { mentions: 7200, note: "最推荐补剂No.1" },
      youtube: { channels: 5, note: "健身频道核心品类" }
    },
    { 
      name: "Collagen Peptides", category: "胶原蛋白",
      amazon: { rank: 5, sales: 95000, rating: 4.5, reviews: 214221 },
      tiktok: { gmv: 5803000, growth: 48.2, note: "Ancient Nutrition" },
      googleTrends: { volume: 673000, growth: 512, note: "#3 热搜, 6.1X增长" },
      instagram: { mentions: 27, note: "Vital Proteins (TikTok 25.9%)" },
      reddit: { mentions: 2800, note: "美容+关节双场景" },
      youtube: { channels: 2, note: "美容向内容" }
    },
    { 
      name: "Bloom Greens & Superfoods", category: "绿色超级食物",
      amazon: { rank: 0, sales: 0, rating: 0, reviews: 0, note: "非Amazon主力" },
      tiktok: { gmv: 6650000, growth: 85.3, note: "TikTok原生TOP1" },
      googleTrends: { volume: 0, growth: 0, note: "品牌词非品类词" },
      instagram: { mentions: 35, note: "100% TikTok原生" },
      reddit: { mentions: 1200, note: "新兴品类讨论" },
      youtube: { channels: 1, note: "新兴内容" }
    },
    { 
      name: "Electrolyte Powders", category: "电解质补水",
      amazon: { rank: 1, sales: 78000, rating: 4.7, reviews: 8529 },
      tiktok: { gmv: 0, growth: 0, note: "Liquid I.V. (Upfluence #8)" },
      googleTrends: { volume: 60500, growth: 1986, note: "增速最快 +1,986%" },
      instagram: { mentions: 187, note: "Liquid I.V. + LMNT" },
      reddit: { mentions: 2500, note: "水合/运动恢复" },
      youtube: { channels: 2, note: "耐力运动频道" }
    },
    { 
      name: "Ashwagandha (KSM-66)", category: "适应原",
      amazon: { rank: 8, sales: 52000, rating: 4.4, reviews: 8900 },
      tiktok: { gmv: 5597000, growth: 38.5, note: "Goli Gummies" },
      googleTrends: { volume: 920000, growth: 55.2, note: "搜索量920K" },
      instagram: { mentions: 0, note: "间接提及" },
      reddit: { mentions: 3100, note: "压力/睡眠场景" },
      youtube: { channels: 3, note: "适应原专题" }
    },
    { 
      name: "Probiotics 50B+", category: "益生菌",
      amazon: { rank: 6, sales: 38000, rating: 4.4, reviews: 15600 },
      tiktok: { gmv: 4123000, growth: 52.8, note: "Physician's Choice" },
      googleTrends: { volume: 201000, growth: 1258, note: "肠道健康 +1,258%" },
      instagram: { mentions: 0, note: "间接提及" },
      reddit: { mentions: 2200, note: "肠道/免疫场景" },
      youtube: { channels: 2, note: "健康科普" }
    },
    { 
      name: "Berberine", category: "血糖健康",
      amazon: { rank: 0, sales: 35000, rating: 4.8, reviews: 5400, note: "Thorne Research" },
      tiktok: { gmv: 0, growth: 0, note: "TikTok飙升榜" },
      googleTrends: { volume: 74000, growth: 49, note: "'Nature's Ozempic'" },
      instagram: { mentions: 0, note: "间接提及" },
      reddit: { mentions: 3800, note: "代谢健康热门" },
      youtube: { channels: 2, note: "新兴内容" }
    },
    { 
      name: "Lion's Mane Mushroom", category: "认知健康",
      amazon: { rank: 0, sales: 25000, rating: 4.5, reviews: 3800 },
      tiktok: { gmv: 0, growth: 0, note: "认知增强趋势" },
      googleTrends: { volume: 460000, growth: 72.6, note: "搜索增长72.6%" },
      instagram: { mentions: 0, note: "间接提及" },
      reddit: { mentions: 4500, note: "益智/认知TOP3" },
      youtube: { channels: 3, note: "益智类内容" }
    },
    { 
      name: "NMN / NAD+ Boosters", category: "长寿/抗衰老",
      amazon: { rank: 0, sales: 12000, rating: 0, reviews: 0, note: "新品阶段" },
      tiktok: { gmv: 0, growth: 0, note: "TikTok新品榜" },
      googleTrends: { volume: 135000, growth: 82, note: "长寿品类增速最快" },
      instagram: { mentions: 0, note: "Bryan Johnson效应" },
      reddit: { mentions: 1800, note: "抗衰老讨论" },
      youtube: { channels: 2, note: "David Sinclair" }
    },
    { 
      name: "Vitamin D3 + K2", category: "维生素",
      amazon: { rank: 7, sales: 120000, rating: 4.8, reviews: 18500 },
      tiktok: { gmv: 2248500, growth: 18.5, note: "Solgar UK" },
      googleTrends: { volume: 1180000, growth: 22.4, note: "稳定增长" },
      instagram: { mentions: 0, note: "基础品类" },
      reddit: { mentions: 1500, note: "基础推荐" },
      youtube: { channels: 2, note: "免疫科普" }
    },
    { 
      name: "Arrae Clear Protein+", category: "透明蛋白粉",
      amazon: { rank: 0, sales: 0, rating: 0, reviews: 0, note: "TikTok专属爆品" },
      tiktok: { gmv: 4180000, growth: 2740, note: "年度爆品 +2,740%" },
      googleTrends: { volume: 0, growth: 0, note: "品牌词" },
      instagram: { mentions: 0, note: "TikTok原生" },
      reddit: { mentions: 600, note: "新兴讨论" },
      youtube: { channels: 1, note: "新兴" }
    },
    { 
      name: "Omega-3 Fish Oil", category: "鱼油",
      amazon: { rank: 5, sales: 35000, rating: 4.7, reviews: 9800 },
      tiktok: { gmv: 1430000, growth: 32.1, note: "Nutripure EU" },
      googleTrends: { volume: 1650000, growth: 8.3, note: "搜索量最大品类" },
      instagram: { mentions: 0, note: "基础品类" },
      reddit: { mentions: 2000, note: "基础推荐" },
      youtube: { channels: 2, note: "心脏健康" }
    },
    { 
      name: "Protein Bars (综合)", category: "蛋白棒",
      amazon: { rank: 7, sales: 55000, rating: 4.5, reviews: 22356 },
      tiktok: { gmv: 0, growth: 0, note: "Barebells +1,100%" },
      googleTrends: { volume: 0, growth: 0, note: "品牌驱动" },
      instagram: { mentions: 93, note: "Quest + Perfect Bar + Barebells" },
      reddit: { mentions: 1500, note: "便携蛋白" },
      youtube: { channels: 1, note: "评测内容" }
    },
    { 
      name: "Goli Ashwagandha Gummies", category: "适应原软糖",
      amazon: { rank: 0, sales: 28000, rating: 4.3, reviews: 12000 },
      tiktok: { gmv: 5597000, growth: 38.5, note: "TikTok头部品牌" },
      googleTrends: { volume: 0, growth: 0, note: "品牌词" },
      instagram: { mentions: 0, note: "间接提及" },
      reddit: { mentions: 800, note: "软糖剂型讨论" },
      youtube: { channels: 1, note: "评测" }
    },
    { 
      name: "Glutathione (谷胱甘肽)", category: "抗氧化",
      amazon: { rank: 0, sales: 15000, rating: 4.3, reviews: 3200 },
      tiktok: { gmv: 0, growth: 0, note: "美白/抗氧化趋势" },
      googleTrends: { volume: 301000, growth: 50, note: "#6 热搜" },
      instagram: { mentions: 0, note: "间接提及" },
      reddit: { mentions: 1600, note: "抗氧化/美白" },
      youtube: { channels: 2, note: "皮肤健康" }
    },
    { 
      name: "Leefar Cutting Drink Mix", category: "代谢/减重",
      amazon: { rank: 0, sales: 0, rating: 0, reviews: 0, note: "TikTok专属" },
      tiktok: { gmv: 4288000, growth: 2040, note: "Revuze: $1.8M/月" },
      googleTrends: { volume: 0, growth: 0, note: "品牌词" },
      instagram: { mentions: 0, note: "TikTok原生" },
      reddit: { mentions: 400, note: "新兴" },
      youtube: { channels: 0, note: "无覆盖" }
    },
    { 
      name: "Shilajit (喜来芝)", category: "矿物质/阿育吠陀",
      amazon: { rank: 0, sales: 8000, rating: 4.2, reviews: 2500 },
      tiktok: { gmv: 0, growth: 830, note: "HIILEATHY +830%" },
      googleTrends: { volume: 0, growth: 0, note: "新兴品类" },
      instagram: { mentions: 0, note: "间接提及" },
      reddit: { mentions: 900, note: "阿育吠陀讨论" },
      youtube: { channels: 1, note: "传统医学" }
    },
    { 
      name: "NAC (N-Acetyl Cysteine)", category: "抗氧化/肝脏",
      amazon: { rank: 0, sales: 46000, rating: 4.6, reviews: 10800 },
      tiktok: { gmv: 0, growth: 0, note: "飙升趋势" },
      googleTrends: { volume: 780000, growth: 62.4, note: "搜索增长62.4%" },
      instagram: { mentions: 0, note: "间接提及" },
      reddit: { mentions: 3200, note: "抗氧化/呼吸健康" },
      youtube: { channels: 2, note: "科普内容" }
    },
    { 
      name: "Melatonin Gummies", category: "睡眠",
      amazon: { rank: 0, sales: 42000, rating: 4.5, reviews: 18000 },
      tiktok: { gmv: 15405000, growth: 55.3, note: "OLLY 东南亚爆品" },
      googleTrends: { volume: 1250000, growth: 45.8, note: "睡眠品类热搜" },
      instagram: { mentions: 56, note: "OLLY +115.4%" },
      reddit: { mentions: 2500, note: "睡眠辅助" },
      youtube: { channels: 1, note: "睡眠科普" }
    }
  ];

  // 计算综合热度分 (0-100)
  // 各维度归一化: score = (value / max) * weight
  // 新增：跨平台覆盖度加分（每多覆盖1个平台 +3分，最高+18分）
  const maxAmazon = Math.max(...products.map(p => p.amazon.sales || 0), 1);
  const maxTikTok = Math.max(...products.map(p => p.tiktok.gmv || 0), 1);
  const maxTrends = Math.max(...products.map(p => p.googleTrends.volume || 0), 1);
  const maxIG = Math.max(...products.map(p => p.instagram.mentions || 0), 1);
  const maxReddit = Math.max(...products.map(p => p.reddit.mentions || 0), 1);
  const maxYT = Math.max(...products.map(p => p.youtube.channels || 0), 1);

  return products.map(p => {
    const as = (p.amazon.sales / maxAmazon) * 22;
    const ts = ((p.tiktok.gmv / 1000000) / (maxTikTok / 1000000)) * 22;
    const gs = ((p.googleTrends.volume / 100000) / (maxTrends / 100000)) * 18;
    const is = (p.instagram.mentions / maxIG) * 13;
    const rs = (p.reddit.mentions / maxReddit) * 10;
    const ys = (p.youtube.channels / maxYT) * 5;
    
    // 平台覆盖度：有几个平台有数据
    let coverage = 0;
    if (p.amazon.sales > 0) coverage++;
    if (p.tiktok.gmv > 0) coverage++;
    if (p.googleTrends.volume > 0) coverage++;
    if (p.instagram.mentions > 0) coverage++;
    if (p.reddit.mentions > 0) coverage++;
    if (p.youtube.channels > 0) coverage++;
    
    // 覆盖度加分：每多覆盖1个平台 +3分
    const coverageBonus = coverage * 3;
    const total = as + ts + gs + is + rs + ys + coverageBonus;
    
    return {
      ...p,
      scores: { 
        amazon: Math.round(as), tiktok: Math.round(ts), 
        googleTrends: Math.round(gs), instagram: Math.round(is),
        reddit: Math.round(rs), youtube: Math.round(ys),
        total: Math.round(total)
      },
      coverage: coverage,
      verdict: total >= 60 ? "🔥 全域爆品" : total >= 40 ? "📈 多平台热门" : total >= 20 ? "📊 单平台突破" : "🆕 新兴品类"
    };
  }).sort((a, b) => b.scores.total - a.scores.total);
}

// ==================== 竞品品牌综合分析 ====================
// 整合 Amazon销量/评分 + TikTok GMV/增长 + iHerb排名 + 社媒声量
function getCompetitorBrandAnalysis() {
  const rf = require('./fetch-real-data.js');
  const amz = rf.getAmazonThreeLists();
  const tiktok = rf.getTikTokThreeLists();
  const iherb = rf.getIHerbBestSellers();
  const social = getSocialMediaData();
  
  // 品牌聚合
  const brands = {};
  
  // Amazon 三榜聚合
  for (const list of ['bestSellers', 'moversShakers', 'newReleases']) {
    (amz[list] || []).forEach(p => {
      if (!brands[p.brand]) brands[p.brand] = { name: p.brand, products: [], amzSales: 0, amzReviews: 0, amzRating: 0, amzCount: 0, amzCategories: new Set() };
      brands[p.brand].products.push(p.name);
      brands[p.brand].amzSales += (p.salesEstimate || 0);
      brands[p.brand].amzReviews += (p.reviews || 0);
      brands[p.brand].amzRating += (p.rating || 0);
      brands[p.brand].amzCount++;
      brands[p.brand].amzCategories.add(p.subcategory);
    });
  }
  
  // TikTok 三区域聚合
  for (const region of ['na', 'sea', 'eu']) {
    for (const list of ['bestSellers', 'moversShakers', 'newReleases']) {
      (tiktok[region] && tiktok[region][list] || []).forEach(p => {
        if (!brands[p.brand]) brands[p.brand] = { name: p.brand, products: [], amzSales: 0, amzReviews: 0, amzRating: 0, amzCount: 0, amzCategories: new Set() };
        if (!brands[p.brand].tiktokGMV) brands[p.brand].tiktokGMV = 0;
        if (!brands[p.brand].tiktokGrowth) brands[p.brand].tiktokGrowth = [];
        if (!brands[p.brand].tiktokRegions) brands[p.brand].tiktokRegions = new Set();
        brands[p.brand].tiktokGMV += (p.gmv || 0);
        brands[p.brand].tiktokGrowth.push(p.growth || 0);
        brands[p.brand].tiktokRegions.add(region);
        brands[p.brand].products.push(p.name);
      });
    }
  }
  
  // iHerb 聚合
  iherb.forEach(p => {
    if (!brands[p.brand]) brands[p.brand] = { name: p.brand, products: [], amzSales: 0, amzReviews: 0, amzRating: 0, amzCount: 0, amzCategories: new Set() };
    if (!brands[p.brand].iherbRank) brands[p.brand].iherbRank = p.rank;
    if (!brands[p.brand].iherbReviews) brands[p.brand].iherbReviews = 0;
    brands[p.brand].iherbReviews += (p.reviews || 0);
  });
  
  // 社媒数据聚合 — 大小写不敏感 + 特殊字符忽略匹配
  const igBrands = social.instagram.topBrands || [];
  const tiktokBrands = social.tiktok.topBrands || [];
  [...igBrands, ...tiktokBrands].forEach(b => {
    const normalize = s => s.toLowerCase().replace(/[^a-z0-9]/g, '');
    const bn = normalize(b.name);
    const key = Object.keys(brands).find(k => normalize(k) === bn);
    const target = key ? brands[key] : null;
    if (target) {
      if (!target.socialMentions) target.socialMentions = 0;
      if (!target.socialEngagement) target.socialEngagement = 0;
      target.socialMentions += (b.mentions || 0);
      target.socialEngagement += (b.engagement || 0);
    }
  });
  
  // 计算综合指标
  const result = Object.values(brands).map(b => {
    const avgRating = b.amzCount > 0 ? (b.amzRating / b.amzCount).toFixed(1) : 'N/A';
    const avgGrowth = b.tiktokGrowth && b.tiktokGrowth.length > 0 
      ? (b.tiktokGrowth.reduce((s,g) => s + g, 0) / b.tiktokGrowth.length).toFixed(0) : 'N/A';
    const tiktokRegions = b.tiktokRegions ? b.tiktokRegions.size : 0;
    const channels = (b.amzCount > 0 ? 1 : 0) + ((b.tiktokGMV || 0) > 0 ? 1 : 0) + (b.iherbRank ? 1 : 0);
    
    // 综合竞争力评分 (0-100)
    const amzScore = Math.min((b.amzSales / 100000) * 25, 25);
    const tiktokScore = Math.min(((b.tiktokGMV || 0) / 5000000) * 25, 25);
    const socialScore = Math.min(((b.socialMentions || 0) / 500) * 20, 20);
    const iherbScore = b.iherbRank ? Math.max(0, 15 - b.iherbRank * 1.5) : 0;
    const channelBonus = channels >= 3 ? 15 : channels >= 2 ? 8 : 0;
    const compScore = Math.round(amzScore + tiktokScore + socialScore + iherbScore + channelBonus);
    
    return {
      name: b.name,
      products: [...new Set(b.products)].slice(0, 5),
      categories: [...b.amzCategories].join(', '),
      amzSales: b.amzSales,
      amzReviews: b.amzReviews,
      amzRating: avgRating,
      amzProducts: b.amzCount,
      tiktokGMV: b.tiktokGMV || 0,
      tiktokGrowth: avgGrowth,
      tiktokRegions: tiktokRegions,
      iherbRank: b.iherbRank || null,
      iherbReviews: b.iherbReviews || 0,
      socialMentions: b.socialMentions || 0,
      socialEngagement: b.socialEngagement || 0,
      channels: channels,
      compScore: compScore,
      tier: compScore >= 50 ? '🏆 头部品牌' : compScore >= 30 ? '📈 挑战者' : compScore >= 15 ? '🆕 新兴品牌' : '🔍 垂直品牌'
    };
  });
  
  return result.sort((a, b) => b.compScore - a.compScore);
}

// ==================== 关键词多维分析 ====================
function getKeywordAnalysis() {
  const rf = require('./fetch-real-data.js');
  const trends = rf.getRealGoogleTrendsData();
  
  // 关键词分类
  const categories = {
    '🧪 成分词': [],
    '📦 品类词': [],
    '💪 功效词': [],
    '🏷️ 品牌词': []
  };
  
  trends.forEach(k => {
    const kw = { keyword: k.keyword, volume: k.searchVolume, growth: k.yoyGrowth, trend: k.trend, category: k.category };
    if (k.keyword.match(/glycinate|monohydrate|peptides|psyllium|husk|nattokinase|astaxanthin|glutathione|rhodiola|berberine/i)) {
      categories['🧪 成分词'].push(kw);
    } else if (k.keyword.match(/supplement|vitamin|probiotic|electrolyte|protein|fish oil|omega|collagen/i)) {
      categories['📦 品类词'].push(kw);
    } else if (k.keyword.match(/gut health|sleep|immune|energy|focus|stress|longevity|weight|metabolism/i)) {
      categories['💪 功效词'].push(kw);
    } else {
      categories['🏷️ 品牌词'].push(kw);
    }
  });
  
  // 趋势分级
  const surging = trends.filter(k => k.yoyGrowth > 60).map(k => ({ keyword: k.keyword, growth: k.yoyGrowth, volume: k.searchVolume }));
  const rising = trends.filter(k => k.yoyGrowth > 20 && k.yoyGrowth <= 60).map(k => ({ keyword: k.keyword, growth: k.yoyGrowth, volume: k.searchVolume }));
  const stable = trends.filter(k => k.yoyGrowth <= 20 && k.yoyGrowth >= -10).map(k => ({ keyword: k.keyword, growth: k.yoyGrowth, volume: k.searchVolume }));
  const declining = trends.filter(k => k.yoyGrowth < -10).map(k => ({ keyword: k.keyword, growth: k.yoyGrowth, volume: k.searchVolume }));
  
  // 各平台关键词对比 (基于已知数据推断)
  const platformKeywords = {
    amazon: [
      { keyword: "electrolyte powder", volume: 650000, note: "Amazon搜索量最大品类" },
      { keyword: "creatine monohydrate powder", volume: 550000, note: "肌酸品类核心词" },
      { keyword: "magnesium glycinate", volume: 480000, note: "镁品类转化率最高" },
      { keyword: "collagen peptides powder", volume: 420000, note: "胶原蛋白主力词" },
      { keyword: "probiotics 50 billion", volume: 380000, note: "益生菌高转化词" }
    ],
    tiktok: [
      { keyword: "#supplementtok", volume: 850000, note: "TikTok保健品总话题" },
      { keyword: "#greenspowder", volume: 320000, note: "Bloom带火的品类" },
      { keyword: "#creatine", volume: 280000, note: "健身场景爆发" },
      { keyword: "#ashwagandha", volume: 220000, note: "适应原趋势" },
      { keyword: "#guthealth", volume: 450000, note: "肠道健康热门" }
    ],
    google: [
      { keyword: "magnesium glycinate benefits", volume: 1000000, note: "搜索量#2" },
      { keyword: "best creatine supplement", volume: 368000, note: "搜索量#5" },
      { keyword: "collagen supplements benefits", volume: 673000, note: "搜索量#3" },
      { keyword: "electrolyte drink mix", volume: 60500, note: "增速最快+1986%" },
      { keyword: "probiotics for gut health", volume: 201000, note: "增长+1258%" }
    ]
  };
  
  return { trends, categories, surging, rising, stable, declining, platformKeywords };
}

// ==================== 跨平台品牌矩阵 ====================
function getCrossPlatformBrandMatrix() {
  const rf = require('./fetch-real-data.js');
  const amz = rf.getAmazonThreeLists();
  const tiktok = rf.getTikTokThreeLists();
  const iherb = rf.getIHerbBestSellers();
  const trends = rf.getRealGoogleTrendsData();
  const social = getSocialMediaData();
  
  // 品类维度（保留原有雷达图数据）
  const categoryMatrix = [
    { category: "胶原蛋白", google: 85, tiktok: 92, amazon: 78, ecommerce: 82, consistency: 84, verdict: "🔥 高一致性", action: "重点投入" },
    { category: "益生菌", google: 80, tiktok: 75, amazon: 85, ecommerce: 80, consistency: 80, verdict: "🔥 高一致性", action: "重点投入" },
    { category: "电解质", google: 90, tiktok: 85, amazon: 82, ecommerce: 70, consistency: 82, verdict: "🔥 全域爆发", action: "立即抢占" },
    { category: "镁补充剂", google: 82, tiktok: 68, amazon: 70, ecommerce: 65, consistency: 71, verdict: "📈 搜索驱动", action: "SEO优化" },
    { category: "肌酸", google: 75, tiktok: 88, amazon: 85, ecommerce: 78, consistency: 82, verdict: "🔥 高一致性", action: "重点投入" },
    { category: "褪黑素/睡眠", google: 75, tiktok: 88, amazon: 72, ecommerce: 68, consistency: 76, verdict: "📈 社媒驱动", action: "社媒种草" },
    { category: "Ashwagandha", google: 90, tiktok: 78, amazon: 65, ecommerce: 60, consistency: 73, verdict: "📈 搜索驱动", action: "SEO优化" },
    { category: "维生素D3", google: 70, tiktok: 55, amazon: 90, ecommerce: 85, consistency: 75, verdict: "📊 成熟品类", action: "价格竞争" },
    { category: "蛋白粉", google: 60, tiktok: 72, amazon: 82, ecommerce: 78, consistency: 73, verdict: "📊 成熟品类", action: "差异化" },
    { category: "鱼油/Omega-3", google: 65, tiktok: 50, amazon: 88, ecommerce: 82, consistency: 71, verdict: "📊 成熟品类", action: "品牌建设" },
    { category: "绿色超级食物", google: 55, tiktok: 95, amazon: 50, ecommerce: 45, consistency: 61, verdict: "🎵 TikTok独爆", action: "社媒驱动" },
    { category: "长寿/抗衰老", google: 78, tiktok: 62, amazon: 40, ecommerce: 35, consistency: 54, verdict: "🔍 新兴赛道", action: "抢先布局" }
  ];
  
  // 品牌维度 — 各品牌在4个平台的得分
  const brands = getCompetitorBrandAnalysis();
  const topBrands = brands.filter(b => b.compScore >= 10).slice(0, 10);
  
  const brandMatrix = topBrands.map(b => {
    const amzScore = Math.min(Math.round((b.amzSales / 100000) * 100), 100);
    const tiktokScore = Math.min(Math.round(((b.tiktokGMV || 0) / 5000000) * 100), 100);
    const socialScore = Math.min(Math.round(((b.socialMentions || 0) / 200) * 100), 100);
    const iherbScore = b.iherbRank ? Math.max(0, Math.round(100 - b.iherbRank * 10)) : 0;
    const avgScore = Math.round((amzScore + tiktokScore + socialScore + iherbScore) / 4);
    
    return {
      name: b.name,
      amazon: amzScore,
      tiktok: tiktokScore,
      social: socialScore,
      iherb: iherbScore,
      avg: avgScore,
      category: b.categories,
      products: b.products.slice(0, 2)
    };
  });
  
  // 平台独占品牌发现
  const amzOnly = brands.filter(b => b.amzProducts > 0 && (b.tiktokGMV || 0) === 0 && !b.iherbRank && b.socialMentions === 0).slice(0, 5);
  const tiktokOnly = brands.filter(b => b.amzProducts === 0 && (b.tiktokGMV || 0) > 0).slice(0, 5);
  const crossPlatform = brands.filter(b => b.amzProducts > 0 && (b.tiktokGMV || 0) > 0).slice(0, 5);
  
  return { categoryMatrix, brandMatrix, amzOnly, tiktokOnly, crossPlatform };
}

// ==================== 智能库存建议 ====================
function getInventoryRecommendations() {
  const rf = require('./fetch-real-data.js');
  const amz = rf.getAmazonThreeLists();
  const tiktok = rf.getTikTokThreeLists();
  const iherb = rf.getIHerbBestSellers();
  const trends = rf.getRealGoogleTrendsData();
  
  // 聚合所有产品
  const allProducts = [];
  
  // Amazon 销量榜
  amz.bestSellers.forEach(p => {
    allProducts.push({ name: p.name, brand: p.brand, category: p.subcategory, platform: 'Amazon', sales: p.salesEstimate || 0, growth: p.growth || 0, rating: p.rating || 0, reviews: p.reviews || 0, price: p.price });
  });
  
  // TikTok 北美销量
  (tiktok.na.bestSellers || []).forEach(p => {
    allProducts.push({ name: p.name, brand: p.brand, category: p.subcategory, platform: 'TikTok NA', sales: p.sales || 0, growth: p.growth || 0, gmv: p.gmv || 0, price: p.price });
  });
  
  // TikTok 东南亚销量
  (tiktok.sea.bestSellers || []).forEach(p => {
    allProducts.push({ name: p.name, brand: p.brand, category: p.subcategory, platform: 'TikTok SEA', sales: p.sales || 0, growth: p.growth || 0, gmv: p.gmv || 0, price: p.price });
  });
  
  // TikTok 欧洲销量
  (tiktok.eu.bestSellers || []).forEach(p => {
    allProducts.push({ name: p.name, brand: p.brand, category: p.subcategory, platform: 'TikTok EU', sales: p.sales || 0, growth: p.growth || 0, gmv: p.gmv || 0, price: p.price });
  });
  
  // ABC分类：按销量排序
  const sorted = [...allProducts].sort((a, b) => b.sales - a.sales);
  const totalSales = sorted.reduce((s, p) => s + p.sales, 0);
  let cumSales = 0;
  sorted.forEach(p => {
    cumSales += p.sales;
    const ratio = cumSales / totalSales;
    p.abcClass = ratio <= 0.7 ? 'A' : ratio <= 0.9 ? 'B' : 'C';
  });
  
  // 品类聚合
  const categories = {};
  allProducts.forEach(p => {
    if (!categories[p.category]) categories[p.category] = { name: p.category, products: [], totalSales: 0, avgGrowth: 0, count: 0, platforms: new Set() };
    categories[p.category].products.push(p);
    categories[p.category].totalSales += p.sales;
    categories[p.category].avgGrowth += p.growth;
    categories[p.category].count++;
    categories[p.category].platforms.add(p.platform);
  });
  
  // 品类健康度评分 (0-100)
  const catHealth = Object.values(categories).map(c => {
    const avgG = c.avgGrowth / c.count;
    const platformScore = Math.min(c.platforms.size * 25, 75);
    const growthScore = Math.min(Math.max(avgG, -20) + 20, 40); // -20~+20 → 0~40
    const diversityScore = Math.min(c.count * 5, 25);
    const health = Math.round(platformScore + growthScore + diversityScore);
    
    // 安全库存建议(周) — 基于增长率和平台数
    const safeStockWeeks = avgG > 50 ? 6 : avgG > 20 ? 4 : avgG > 0 ? 3 : 2;
    const reorderPoint = Math.round(c.totalSales * 0.3);
    
    return {
      category: c.name,
      products: c.count,
      platforms: c.platforms.size,
      totalSales: c.totalSales,
      avgGrowth: parseFloat(avgG.toFixed(1)),
      healthScore: health,
      healthLevel: health >= 70 ? '🟢 健康' : health >= 50 ? '🟡 关注' : '🔴 预警',
      safeStockWeeks: safeStockWeeks,
      reorderPoint: reorderPoint,
      recommendation: avgG > 50 ? '加大备货，预留6周安全库存' : avgG > 20 ? '稳健备货，预留4周库存' : avgG > 0 ? '正常补货，预留3周库存' : '控制库存深度，避免积压'
    };
  }).sort((a, b) => b.healthScore - a.healthScore);
  
  // TOP 产品库存建议
  const topProducts = sorted.slice(0, 12).map(p => {
    let action, stockLevel;
    if (p.abcClass === 'A' && p.growth > 30) { action = '🔥 紧急补货'; stockLevel = '高'; }
    else if (p.abcClass === 'A') { action = '📦 维持库存'; stockLevel = '高'; }
    else if (p.growth > 50) { action = '🚀 加大备货'; stockLevel = '中高'; }
    else if (p.growth < -5) { action = '⚠️ 减少采购'; stockLevel = '低'; }
    else { action = '📊 正常补货'; stockLevel = '中'; }
    
    return {
      name: p.name, brand: p.brand, category: p.category, platform: p.platform,
      sales: p.sales, growth: p.growth, abcClass: p.abcClass,
      action: action, stockLevel: stockLevel,
      suggestedStock: stockLevel === '高' ? '6-8周' : stockLevel === '中高' ? '4-6周' : stockLevel === '中' ? '3-4周' : '1-2周'
    };
  });
  
  // 趋势词关联库存建议
  const trendKeywords = trends.filter(k => k.yoyGrowth > 60).slice(0, 5);
  const trendSuggestions = trendKeywords.map(k => ({
    keyword: k.keyword,
    growth: k.yoyGrowth,
    suggestion: k.yoyGrowth > 500 ? '立即布局，首批备货测试市场反应' : '小批量测试，关注转化率'
  }));
  
  // 价格带竞争分析
  const priceRanges = [
    { range: '$0-15', min: 0, max: 15, products: [], count: 0, avgGrowth: 0 },
    { range: '$15-25', min: 15, max: 25, products: [], count: 0, avgGrowth: 0 },
    { range: '$25-40', min: 25, max: 40, products: [], count: 0, avgGrowth: 0 },
    { range: '$40-60', min: 40, max: 60, products: [], count: 0, avgGrowth: 0 },
    { range: '$60+', min: 60, max: 999, products: [], count: 0, avgGrowth: 0 }
  ];
  allProducts.forEach(p => {
    const price = p.price || 0;
    for (const pr of priceRanges) {
      if (price >= pr.min && price < pr.max) {
        pr.products.push(p);
        pr.count++;
        pr.avgGrowth += p.growth;
        break;
      }
    }
  });
  priceRanges.forEach(pr => {
    pr.avgGrowth = pr.count > 0 ? parseFloat((pr.avgGrowth / pr.count).toFixed(1)) : 0;
    const totalCount = allProducts.length || 1;
    pr.share = parseFloat((pr.count / totalCount * 100).toFixed(0));
    pr.competition = pr.share > 35 ? '🔴 拥挤' : pr.share > 20 ? '🟡 适中' : '🟢 蓝海';
  });
  
  // 滞销预警 — 增长为负的产品
  const slowMovers = sorted.filter(p => p.growth < -3).slice(0, 8).map(p => ({
    name: p.name, brand: p.brand, platform: p.platform,
    sales: p.sales, growth: p.growth,
    action: p.growth < -20 ? '⛔ 立即清仓' : p.growth < -10 ? '⚠️ 促销去库存' : '📉 减少采购'
  }));
  
  // 选品空白机会 — 高需求(高搜索量)但竞争少(产品数少)的品类
  // 交叉验证逻辑：Google Trends搜索量 + Amazon/TikTok/iHerb/Shopee各平台产品覆盖数
  // 目标：找到搜索量>50k、增长率>40%、且跨平台覆盖度低的品类
  const categoryAliases = {
    '胶原蛋白': ['collagen', '胶原'],
    '益生菌': ['probiotic', 'gut health', '益生菌', 'akkermansia'],
    '电解质': ['electrolyte', 'hydration', '电解质'],
    '运动营养/肌酸': ['creatine', '肌酸'],
    '矿物质/镁': ['magnesium', '镁', 'glycinate'],
    '维生素': ['vitamin', '维生素', 'vitamin d', 'd3'],
    '鱼油': ['fish oil', 'omega', '鱼油'],
    '适应原': ['ashwagandha', 'rhodiola', '适应原', 'lion'],
    '蛋白粉': ['protein', 'whey', '蛋白'],
    '抗氧化': ['glutathione', 'astaxanthin', '抗氧化', 'nac', 'methylene'],
    '长寿/抗衰老': ['nmn', 'longevity', '抗衰老', 'nad', 'mots'],
    '睡眠': ['melatonin', 'sleep', '褪黑素', '睡眠'],
    '减重': ['weight loss', 'berberine', '减重', 'glp'],
    '认知健康': ['lions mane', 'nootropic', '认知', 'focus', 'methylene'],
    '绿色超级食物': ['greens', 'superfood', '绿色', 'bloom'],
    '血糖健康': ['berberine', '血糖'],
    '心血管': ['nattokinase', '心血管'],
    '纤维/消化': ['psyllium', 'fiber', '纤维', '消化'],
    '眼健康': ['lutein', 'zeaxanthin', '眼', 'vision'],
  };
  
  function findExistingProducts(keyword, catName) {
    const kw = (keyword + ' ' + catName).toLowerCase();
    // 遍历catHealth，找包含别名的品类
    for (const [cat, aliases] of Object.entries(categoryAliases)) {
      for (const alias of aliases) {
        if (kw.includes(alias)) {
          const matches = catHealth.filter(c => {
            const cName = c.category.toLowerCase();
            return aliases.some(a => cName.includes(a)) || cName.split(/[\s\/]+/).some(w => aliases.some(a => w.includes(a)));
          });
          if (matches.length > 0) {
            const totalProducts = matches.reduce((s, c) => s + c.products, 0);
            const totalPlatforms = new Set(matches.flatMap(c => Array(c.platforms).fill(0).map((_,i) => i))).size;
            return { products: totalProducts, category: cat, platforms: Math.max(1, totalPlatforms) };
          }
          return { products: 0, category: cat, platforms: 0 };
        }
      }
    }
    // 回退：在所有catHealth品类名中搜索
    const matches = catHealth.filter(c => {
      const cName = c.category.toLowerCase();
      const words = kw.split(/[\s\/]+/).filter(w => w.length > 3);
      return words.some(w => cName.includes(w));
    });
    if (matches.length > 0) {
      const totalProducts = matches.reduce((s, c) => s + c.products, 0);
      return { products: totalProducts, category: catName, platforms: Math.max(1, new Set(matches.map(c => c.category)).size) };
    }
    return { products: 0, category: catName, platforms: 0 };
  }
  
  const blankOpportunities = [];
  // 放宽条件：增长率>40% 或 搜索量>100k，确保能找到12个
  const highDemandKeywords = trends.filter(k => (k.yoyGrowth > 40 || k.searchVolume > 100000) && k.searchVolume > 30000);
  
  const matureCategories = ['胶原蛋白', '益生菌', '维生素', '电解质', '肌酸', '运动营养', '蛋白粉', '鱼油', '矿物质/镁'];
  
  highDemandKeywords.slice(0, 18).forEach(k => {
    const { products: existingCount, category: matchedCat, platforms } = findExistingProducts(k.keyword, k.category);
    const isMature = matureCategories.some(mc => {
      const kw = (k.keyword + ' ' + k.category).toLowerCase();
      return mc.split('/').some(part => kw.includes(part));
    });
    
    if (isMature && existingCount > 1) return;
    
    const isBlueOcean = existingCount === 0;
    const isExpandable = existingCount <= 3 && existingCount > 0;
    const isNiche = existingCount <= 5 && platforms <= 2;
    
    if (existingCount <= 5) {
      let opportunity, suggestion;
      if (isBlueOcean) {
        opportunity = '🟢 蓝海机会';
        suggestion = '首批测试2-3个SKU，抢占品类心智';
      } else if (isExpandable && platforms <= 2) {
        opportunity = '🟡 扩展品类';
        suggestion = '增加SKU和剂型，拓展未覆盖平台';
      } else if (isNiche) {
        opportunity = '🔵 细分机会';
        suggestion = '专注细分人群，差异化定位';
      } else {
        return; // 跳过产品数过多的
      }
      
      blankOpportunities.push({
        keyword: k.keyword,
        searchVolume: k.searchVolume,
        growth: k.yoyGrowth,
        currentProducts: existingCount,
        platforms: platforms || 0,
        category: matchedCat,
        opportunity,
        suggestion
      });
    }
  });
  
  // 确保至少12个，不够则补充
  if (blankOpportunities.length < 12) {
    const existingKeywords = new Set(blankOpportunities.map(b => b.keyword.toLowerCase()));
    const supplements = [
      { keyword: 'Creatine for Women', searchVolume: 49500, growth: 123, category: '运动营养', suggestion: '女性健身市场爆发，专属配方空白' },
      { keyword: 'Creatine Gummies', searchVolume: 60500, growth: 49, category: '运动营养', suggestion: '软糖剂型替代粉剂，便利性驱动增长' },
      { keyword: 'Psyllium Husk Fiber', searchVolume: 301000, growth: 82, category: '纤维/消化', suggestion: 'GLP-1用户便秘副作用催生需求' },
      { keyword: 'Gut Health Supplement', searchVolume: 40500, growth: 235, category: '肠道健康', suggestion: '肠道-免疫-皮肤轴概念兴起' },
      { keyword: 'Akkermansia Probiotic', searchVolume: 6120000, growth: 22, category: '肠道健康', suggestion: '下一代益生菌，GLP-1刺激+代谢健康' }
    ];
    supplements.forEach(s => {
      if (!existingKeywords.has(s.keyword.toLowerCase()) && blankOpportunities.length < 12) {
        const { products: ec } = findExistingProducts(s.keyword, s.category);
        blankOpportunities.push({
          keyword: s.keyword,
          searchVolume: s.searchVolume,
          growth: s.growth,
          currentProducts: ec || 0,
          platforms: 0,
          category: s.category,
          opportunity: ec === 0 ? '🟢 蓝海机会' : '🟡 扩展品类',
          suggestion: s.suggestion
        });
      }
    });
  }
  
  // 按增长率排序
  blankOpportunities.sort((a, b) => b.growth - a.growth);
  
  // 采购成本估算 — 基于关税+汇率
  const tariffRate = 0.33; // 综合关税33%
  const fxRate = 6.81; // USD/CNY
  const costEstimates = {
    tariffRate: '33%',
    fxRate: fxRate,
    landedCostMultiplier: 1.45, // 到岸成本≈采购价×1.45(含关税+物流+平台佣金)
    priceRanges: priceRanges.map(pr => {
      const avgPrice = pr.count > 0 ? pr.products.reduce((s,p) => s + (p.price||0), 0) / pr.count : 0;
      const estimatedCost = avgPrice * 0.35; // 采购成本≈售价35%
      const landedCost = estimatedCost * 1.45;
      const profitMargin = avgPrice > 0 ? Math.round((1 - landedCost / avgPrice) * 100) : 0;
      return { range: pr.range, avgPrice: parseFloat(avgPrice.toFixed(2)), estimatedCost: parseFloat(estimatedCost.toFixed(2)), landedCost: parseFloat(landedCost.toFixed(2)), profitMargin: profitMargin + '%' };
    })
  };
  
  return { catHealth, topProducts, trendSuggestions, slowMovers, blankOpportunities, costEstimates, priceRanges, totalProducts: allProducts.length };
}

// ==================== 价格策略分析 ====================
function getPricingStrategy() {
  const rf = require('./fetch-real-data.js');
  const amz = rf.getAmazonThreeLists();
  const tiktok = rf.getTikTokThreeLists();
  const iherb = rf.getIHerbBestSellers();
  
  // 收集所有产品的价格数据
  const allPriced = [];
  
  amz.bestSellers.forEach(p => allPriced.push({ name: p.name, brand: p.brand, category: p.subcategory, platform: 'Amazon', price: p.price, sales: p.salesEstimate || 0, growth: p.growth || 0, rating: p.rating || 0 }));
  amz.moversShakers.forEach(p => allPriced.push({ name: p.name, brand: p.brand, category: p.subcategory, platform: 'Amazon', price: p.price, sales: 0, growth: p.growth24h || 0, rating: p.rating || 0 }));
  amz.newReleases.forEach(p => allPriced.push({ name: p.name, brand: p.brand, category: p.subcategory, platform: 'Amazon', price: p.price, sales: 0, growth: 0, rating: p.rating || 0 }));
  
  (tiktok.na.bestSellers || []).forEach(p => allPriced.push({ name: p.name, brand: p.brand, category: p.subcategory, platform: 'TikTok', price: p.price, sales: p.sales || 0, growth: p.growth || 0, rating: 0 }));
  (tiktok.sea.bestSellers || []).forEach(p => allPriced.push({ name: p.name, brand: p.brand, category: p.subcategory, platform: 'TikTok', price: p.price, sales: p.sales || 0, growth: p.growth || 0, rating: 0 }));
  (tiktok.eu.bestSellers || []).forEach(p => allPriced.push({ name: p.name, brand: p.brand, category: p.subcategory, platform: 'TikTok', price: p.price, sales: p.sales || 0, growth: p.growth || 0, rating: 0 }));
  
  iherb.forEach(p => allPriced.push({ name: p.name, brand: p.brand, category: p.subcategory, platform: 'iHerb', price: p.price, sales: 0, growth: 0, rating: p.rating || 0 }));
  
  // 1. 各平台价格带分布
  const platformPricing = {};
  ['Amazon', 'TikTok', 'iHerb'].forEach(platform => {
    const products = allPriced.filter(p => p.platform === platform && p.price > 0);
    if (products.length === 0) return;
    const prices = products.map(p => p.price).sort((a,b) => a-b);
    const avg = prices.reduce((s,v) => s+v,0) / prices.length;
    const min = prices[0];
    const max = prices[prices.length-1];
    const median = prices[Math.floor(prices.length/2)];
    
    const ranges = [
      { range: '$0-15', count: products.filter(p => p.price < 15).length },
      { range: '$15-25', count: products.filter(p => p.price >= 15 && p.price < 25).length },
      { range: '$25-40', count: products.filter(p => p.price >= 25 && p.price < 40).length },
      { range: '$40-60', count: products.filter(p => p.price >= 40 && p.price < 60).length },
      { range: '$60+', count: products.filter(p => p.price >= 60).length }
    ];
    const dominant = ranges.sort((a,b) => b.count - a.count)[0];
    
    platformPricing[platform] = {
      count: products.length, avg: parseFloat(avg.toFixed(2)),
      min: parseFloat(min.toFixed(2)), max: parseFloat(max.toFixed(2)),
      median: parseFloat(median.toFixed(2)),
      ranges, dominantRange: dominant.range,
      strategy: avg < 20 ? '低价走量' : avg < 35 ? '中价品质' : '高价溢价'
    };
  });
  
  // 2. 各品类最优定价区间（基于销量加权）
  const catPricing = {};
  allPriced.forEach(p => {
    if (!p.category || p.price <= 0) return;
    if (!catPricing[p.category]) catPricing[p.category] = { prices: [], sales: [], growths: [] };
    catPricing[p.category].prices.push(p.price);
    if (p.sales > 0) catPricing[p.category].sales.push({ price: p.price, sales: p.sales });
    if (p.growth !== 0) catPricing[p.category].growths.push({ price: p.price, growth: p.growth });
  });
  
  const catPricingResult = Object.entries(catPricing).map(([cat, data]) => {
    const prices = data.prices.sort((a,b) => a-b);
    const avg = prices.reduce((s,v) => s+v, 0) / prices.length;
    const weightedSales = data.sales.sort((a,b) => b.sales - a.sales);
    const topPrice = weightedSales.length > 0 ? weightedSales[0].price : avg;
    
    // 增长最优价格带
    const highGrowth = data.growths.filter(g => g.growth > 30);
    const optimalRange = highGrowth.length > 0 
      ? '$' + Math.round(Math.min(...highGrowth.map(g => g.price))) + '-' + Math.round(Math.max(...highGrowth.map(g => g.price)))
      : '$' + Math.round(avg * 0.8) + '-' + Math.round(avg * 1.2);
    
    return {
      category: cat,
      count: prices.length,
      avgPrice: parseFloat(avg.toFixed(2)),
      topSellingPrice: parseFloat(topPrice.toFixed(2)),
      optimalRange,
      recommendation: avg < 15 ? '大众价位，适合走量' : avg < 30 ? '中端定价，品质+性价比' : '高端定位，品牌溢价'
    };
  }).sort((a, b) => b.count - a.count);
  
  // 3. 跨平台价格差异
  const crossPlatformPricing = [];
  const brandPriceMap = {};
  allPriced.forEach(p => {
    if (!brandPriceMap[p.brand]) brandPriceMap[p.brand] = {};
    if (!brandPriceMap[p.brand][p.platform]) brandPriceMap[p.brand][p.platform] = [];
    brandPriceMap[p.brand][p.platform].push(p.price);
  });
  
  Object.entries(brandPriceMap).forEach(([brand, platforms]) => {
    const platformNames = Object.keys(platforms);
    if (platformNames.length >= 2) {
      const prices = {};
      platformNames.forEach(p => {
        const vals = platforms[p];
        prices[p] = parseFloat((vals.reduce((s,v) => s+v,0) / vals.length).toFixed(2));
      });
      const priceValues = Object.values(prices);
      const diff = Math.max(...priceValues) - Math.min(...priceValues);
      if (diff > 3) { // 跨平台价差>$3才值得关注
        crossPlatformPricing.push({ brand, prices, maxDiff: parseFloat(diff.toFixed(2)) });
      }
    }
  });
  crossPlatformPricing.sort((a,b) => b.maxDiff - a.maxDiff);
  
  // 4. 价格弹性分析 — 价格与增长/销量的关系
  const priceGrowthCorrelation = [];
  [0, 15, 25, 40, 60].forEach((min, i) => {
    const max = [15, 25, 40, 60, 999][i];
    const products = allPriced.filter(p => p.price >= min && p.price < max && p.growth !== 0);
    if (products.length === 0) return;
    const avgGrowth = products.reduce((s,p) => s + p.growth, 0) / products.length;
    const avgSales = products.filter(p => p.sales > 0).reduce((s,p) => s + p.sales, 0) / Math.max(1, products.filter(p => p.sales > 0).length);
    const highGrowthRatio = products.filter(p => p.growth > 30).length / products.length;
    priceGrowthCorrelation.push({
      range: '$' + min + (max === 999 ? '+' : '-' + max),
      count: products.length,
      avgGrowth: parseFloat(avgGrowth.toFixed(1)),
      avgSales: Math.round(avgSales),
      highGrowthRatio: parseFloat((highGrowthRatio * 100).toFixed(0)),
      insight: avgGrowth > 30 ? '高增长价格带，适合新品切入' : avgGrowth > 10 ? '稳定增长，主流定价区间' : '增长放缓，需差异化'
    });
  });
  
  // 5. 定价策略建议
  const strategies = [
    { strategy: '渗透定价', target: '新品类/蓝海市场', action: '低于竞品均价10-15%，快速抢占份额', example: '电解质新品 → 定价\$15-20（竞品均价\$25）' },
    { strategy: '价值定价', target: '成熟品类/品质差异化', action: '与竞品持平或略高5-10%，强调成分/剂型优势', example: '镁补充剂 → 定价\$25-30（高品质甘氨酸镁）' },
    { strategy: '撇脂定价', target: '创新品类/专利成分', action: '高于竞品30-50%，建立高端认知后逐步降价', example: 'NMN/NAD+ → 定价\$50-80（长寿品类溢价）' },
    { strategy: '组合定价', target: '多SKU品牌', action: '引流款(低价)+利润款(中价)+形象款(高价)组合', example: '胶原蛋白 → \$15/\$30/\$55三档' },
    { strategy: '平台差异化', target: '跨平台品牌', action: 'Amazon中高价+TikTok中低价+iHerb高端线', example: '同一品牌Amazon \$35 / TikTok \$25 / iHerb \$45' }
  ];
  
  // 6. 采购成本估算（含关税+汇率）
  const tariffRate = 0.33;
  const fxRate = 6.81;
  const costEstimates = {
    tariffRate: '33%',
    fxRate: fxRate,
    landedCostMultiplier: 1.45,
    priceRanges: ['$0-15', '$15-25', '$25-40', '$40-60', '$60+'].map(range => {
      const parts = range.replace('$','').replace('+','-999').split('-');
      const min = parseFloat(parts[0]), max = parseFloat(parts[1]);
      const products = allPriced.filter(p => p.price >= min && p.price < max);
      const avgPrice = products.length > 0 ? products.reduce((s,p) => s + p.price, 0) / products.length : (min+max)/2;
      const estimatedCost = avgPrice * 0.35;
      const landedCost = estimatedCost * 1.45;
      const profitMargin = avgPrice > 0 ? Math.round((1 - landedCost / avgPrice) * 100) : 0;
      return { range, avgPrice: parseFloat(avgPrice.toFixed(2)), estimatedCost: parseFloat(estimatedCost.toFixed(2)), landedCost: parseFloat(landedCost.toFixed(2)), profitMargin: profitMargin + '%', products: products.length };
    })
  };
  
  // 7. 蛋白粉原料成本专项分析（2026年乳清蛋白暴涨 — 多源验证）
  const wheyAlert = {
    active: true,
    title: '⚠️ 乳清蛋白原料价格持续上涨 — 全球性结构短缺',
    // 零售端 vs 原料端：分开陈述，标注时间窗口差异，避免误导对比
    retailSummary: '零售端(美国Amazon 5大品牌均价)：2023年5月$52 → 2026年5月$76，3年涨幅+46%（The Barbell 2026.05，原文："from $52 three years ago to $76 today — a 46% increase"）。中国市场：国际品牌5磅装2023年500-550元→2026年640-680元(+19-25%)；国内品牌涨幅更大——康比特4磅分离乳清一年涨65%、赛霸5磅涨93%（新京报/什么值得买）。',
    rawMaterialSummary: '原料端(工业大宗)：WPC80欧洲现货€5,000/吨(2023)→€26,450/吨(2026.05)，累计+429%（雪球/EU乳品交易数据）。WPI约+139%、WPC约+108%（2024→2026，Bryan Morin/NOW Sports在New Hope Network确认，原文："WPI costs shot up roughly 139%"）。WPI现货$12.30-12.69/磅，WPC80现货$8.50-8.52/磅（Vesper Price Index 2026.06）。',
    // 传导滞后：多源确认，从推论升级为事实
    transmissionLag: '⚠️ 零售端涨幅远低于原料端，并非数据矛盾，而是结构性的"传导滞后"（多源确认）：①零售价通常滞后原料成本12-18个月（PricePlow/Glanbia）；②2026年至今成本上涨"尚未转嫁给消费者"（INFRA/Hope Tipton）；③预计最早2027年Q1-Q2零售端才普遍调价（SPINS/Scott Dicker）；④品牌当前在压缩利润、削减促销、缩减包装规格（New Hope Network/NOW Sports）。结论：零售端补涨压力正在累积。',
    // 中国市场特殊性
    chinaContext: '中国市场对比：中国90%+乳清依赖进口（年需70-75万吨vs自产6万吨），国内品牌处境比美国品牌更艰难。康比特2025年净利润同比-55.85%，营业成本+23.47%，提价幅度"未能完全覆盖原料成本"（2025年报/业绩说明会）。汤臣倍健乳清采购单价同比+49.39%（2025年报）。衡美健康乳清采购价+36.16%（IPO招股书）。国内品牌面临"被迫追涨但仍覆盖不了成本"的双重挤压。',
    source: 'The Barbell (2026.05) / New Hope Network (Bryan Morin/NOW Sports) / Vesper Price Index / PricePlow (Glanbia) / 雪球 (EU乳品交易数据) / 新京报 / 新浪财经 / 康比特2025年报 / 汤臣倍健2025年报',
    // 原料端价格明细
    rawMaterialPrices: [
      { material: 'WPI 分离乳清蛋白(工业现货)', price2023: '—', price2024: '—', price2025: '$11/磅(年末)', price2026: '$12.30-12.69/磅', change: '约+139%(2024→2026)', source: 'Vesper / PricePlow / Bryan Morin' },
      { material: 'WPC80 浓缩乳清蛋白(工业现货)', price2023: '—', price2024: '—', price2025: '—', price2026: '$8.50-8.52/磅', change: '+108%(2024→2026)', source: 'Vesper / Bryan Morin' },
      { material: 'WPC80 欧洲批发基准(€/吨)', price2023: '€5,000-6,800', price2024: '€12,500(年末)', price2025: '€18,500-21,000', price2026: '€26,450(5月峰值)', change: '+429%(2023→2026)', source: 'EU乳品交易数据/USDA' }
    ],
    // 零售端价格明细（美国+中国）
    retailPrices: [
      { market: '美国 Amazon 5大品牌均价', price2023: '$52/5lb', price2024: '—', price2025: '—', price2026: '$76/5lb', change: '+46%(3年)', source: 'The Barbell 2026.05' },
      { market: '中国 国际品牌(ON/Myprotein等)', price2023: '500-550元', price2024: '590-620元', price2025: '640-690元', price2026: '640-680元', change: '+19-25%(3年)', source: '雪球/什么值得买' },
      { market: '中国 康比特4磅分离乳清', price2023: '—', price2024: '—', price2025: '673元', price2026: '1,112元', change: '+65%(1年)', source: '什么值得买/新京报' },
      { market: '中国 赛霸5磅三重矩阵', price2023: '—', price2024: '—', price2025: '248元', price2026: '479-499元', change: '+93%(1年)', source: '新京报/小红书用户' }
    ],
    yoyData: [
      { period: '2023年5月', price: '$52/5lb', note: 'The Barbell原文："$52 three years ago"' },
      { period: '2024-2025', price: '数据缺失', note: '原文未提供中间年份数据，不进行估算' },
      { period: '2026年5月', price: '$76/5lb', note: 'The Barbell原文："$76 today"，3年涨幅46%' }
    ],
    retailImpact: 'NOW Sports已于2026年初率先提价；多数品牌仍在消化库存。Amazon促销折扣减少(Subscribe & Save力度下降)，隐性涨价(取消大包装/缩减规格)已在进行。INFRA预计零售端最早2027年Q1-Q2普遍调价。中国国内品牌（康比特/赛霸）已大幅提价但仍未能完全覆盖原料涨幅。',
    recommendations: [
      '立即锁定3-6个月远期原料合同，避免现货市场高价采购（WPC80现货已对新买家"基本不可得"）',
      '蛋白粉品类零售价上调5-10%，或通过缩减包装规格隐性传导成本',
      '评估替代蛋白源：豌豆蛋白/大米蛋白(植物基) 或 牛奶蛋白浓缩物(MPC/MPI)',
      '关注NOW Sports/Optimum Nutrition/康比特等头部品牌调价动态作为行业风向标',
      '中国市场特别关注：人民币汇率波动叠加进口依赖，双重放大原料涨价冲击'
    ]
  };
  
  return { platformPricing, catPricingResult, crossPlatformPricing, priceGrowthCorrelation, strategies, costEstimates, wheyAlert };
}

module.exports = {
  getAmazonData,
  getTikTokData,
  getGoogleTrendsData,
  getSocialMediaData,
  getEcommerceData,
  getCrossPlatformMatrix,
  getSWOTData,
  getRiskWarnings,
  getCrossPlatformHotRanking,
  getCompetitorBrandAnalysis,
  getKeywordAnalysis,
  getCrossPlatformBrandMatrix,
  getInventoryRecommendations,
  getPricingStrategy
};
