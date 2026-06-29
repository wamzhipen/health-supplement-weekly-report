---
name: health-supplement-weekly
description: 【保健品外贸周报】生成保健品市场每周热销分析报告。覆盖 Amazon/TikTok/Shopee/Ozon/iHerb 电商榜单 + Google Trends 趋势 + 7 大社媒分析 + 风险预警。自动 WebFetch 抓取最新数据，输出交互式 HTML 报告 + Excel 数据表。
---

# 保健品市场每周热销分析报告

## 触发方式

用户说"更新周报"、"生成周报"、"市场报告"时触发。

## 执行流程

### 第1步：抓取最新数据

用 WebFetch 工具抓取以下 4 个数据源，将返回内容中的结构化数据（产品名/品牌/价格/评分/评论数/搜索量/增长率）写入缓存 JSON：

| 数据源 | WebFetch URL | 缓存文件 |
|--------|-------------|---------|
| Amazon Best Sellers | `https://www.amazon.com/gp/bestsellers/hpc/3764441/` | `assets/cache/amazon_bestsellers.json` |
| Amazon New Releases | `https://www.amazon.com/gp/new-releases/hpc/3764441/` | `assets/cache/amazon_newreleases.json` |
| iHerb Best Sellers | `https://www.iherb.com/catalog/topsellers` | `assets/cache/iherb_topsellers.json` |
| Google Trends | `https://www.risingtrends.co/trends/supplement-trends-2026` | `assets/cache/google_trends.json` |

**WebFetch 提示词模板**（Amazon）：
> List ALL 30 products with rank, brand, product name, price, rating, reviews. Format: `| #Rank | Product Name | Price | Rating | Reviews |`

**缓存格式**：
```json
{ "_cachedAt": 1719000000000, "data": [...] }
```

价格统一换算为 USD。如果 WebFetch 返回非 USD 货币（PHP/EUR/GBP），按当日汇率换算。

**降级策略**：如果某个源 WebFetch 失败，跳过该源。Node.js 脚本会自动回退到上次缓存或硬编码数据。

### 第2步：写入缓存

将 WebFetch 返回的数据解析后，用 Node.js 写入缓存：

```bash
cd /root/.codebuddy/skills/market-report-weekly && NODE_OPTIONS="" node -e "
const rf = require('./scripts/fetch-real-data.js');
rf.writeCache('amazon_bestsellers.json', [...products...]);
"
```

或直接用 Bash + Node 脚本一次性处理所有 4 个源。

### 第3步：生成报告

```bash
cd /root/.codebuddy/skills/market-report-weekly && NODE_OPTIONS="" node scripts/market-report-pro.js
```

输出：
- `output/market-report-W{week}-{date}.html` — 交互式 HTML 报告
- `output/market-data-W{week}-{date}.xlsx` — Excel 数据表

### 第4步：展示结果

用 `open_result_view` 打开 HTML 文件展示给用户。

## 报告内容（12个Tab）

1. 📊 平台总览 — 关键指标仪表盘
2. 🛒 Amazon 热销榜 — 三榜（销量/飙升/新品）
3. 🎵 TikTok Shop — 三区域×三榜（北美/东南亚/欧洲）
4. 🛍️ Shopee — 三区域×三榜（东南亚/拉美/欧洲）
5. 🇷🇺 Ozon — 三榜
6. 🌿 iHerb — 畅销榜
7. 📈 趋势分析 — Google Trends + 市场规模
8. 👥 社媒分析 — 7平台保健品热度
9. 🏭 竞品分析 — 品牌矩阵 + 跨平台对比
10. 💰 价格策略 — 定价建议 + 乳清蛋白专项预警
11. 📋 运营洞察 — 本周行动清单
12. 🚨 风险预警 — 原料价格 + FDA召回 + 进口政策

## 数据新鲜度

报告顶部自动显示各数据源新鲜度：
- 🟢 fresh — 24h 内抓取
- 🟡 stale — 缓存过期但仍可用
- 🟠 manual — 手动维护（TikTok/Shopee/Ozon）

## 技术说明

- Chart.js 内联到 HTML，无需 CDN
- 产品图片通过 Playwright + Amazon 搜索自动抓取（24h 缓存）
- 汇率通过 open.er-api.com 实时获取
- FDA 召回通过 WebFetch 定期抓取
- 报告文件位于 `output/` 目录

## 依赖

需要 Node.js 环境和以下 npm 包：
- playwright（产品图片抓取）
- xlsx（Excel 生成）

沙箱环境已预装，无需额外安装。
