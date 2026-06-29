#!/usr/bin/env node
/**
 * 每周平台热销分析报告 — 本地版安装脚本
 * 一键安装所有依赖
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('📦 正在安装依赖...\n');

// 1. npm 依赖
console.log('1/2 安装 npm 包 (xlsx, playwright, cheerio)...');
try {
  execSync('npm install --registry https://registry.npmmirror.com', { 
    cwd: __dirname + '/..', 
    stdio: 'inherit',
    timeout: 120000 
  });
} catch (e) {
  console.error('npm install 失败，请检查网络连接');
  process.exit(1);
}

// 2. 检查 Playwright 浏览器
console.log('\n2/2 检查 Playwright 浏览器...');
try {
  const { chromium } = require('playwright');
  // 尝试使用系统 Chrome
  const chromePaths = process.platform === 'win32' 
    ? ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
       'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
       process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe']
    : [];
  
  let found = false;
  for (const p of chromePaths) {
    if (fs.existsSync(p)) {
      console.log(`   ✅ 找到系统 Chrome: ${p}`);
      found = true;
      break;
    }
  }
  
  if (!found) {
    console.log('   ⚠️ 未找到系统 Chrome，尝试下载 Playwright 浏览器...');
    try {
      execSync('npx playwright install chromium', { stdio: 'inherit', timeout: 180000 });
    } catch (e) {
      console.log('   ⚠️ 浏览器下载失败，Playwright 爬虫功能将不可用（报告核心功能不受影响）');
    }
  }
} catch (e) {
  console.log('   ⚠️ Playwright 不可用，爬虫功能将跳过');
}

console.log('\n✅ 安装完成！运行 node scripts/market-report-pro.js 生成报告');
