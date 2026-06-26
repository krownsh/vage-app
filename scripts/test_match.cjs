// test_match.cjs - 驗證作物比對邏輯
// 由於 src/utils/cropIndex.js 是 ESM，這裡將核心邏輯 inline 進來做驗證
const catalog = require('../public/data/crop_catalog.json');

// ---- Inline: MARKET_ALIAS (北農別名對照) ----
const MARKET_ALIAS = {
  '包心白': '結球白菜', '包白': '結球白菜',
  '皇宮菜': '落葵', '格菱': '落葵',
  '蔥': '青蔥', '蔥頭': '洋蔥', '洋蔥頭': '洋蔥',
  '地瓜': '甘薯', '芋頭': '芋',
  '木瓜': '番木瓜', '香瓜': '甜瓜', '洋香瓜': '甜瓜', '哈密瓜': '甜瓜',
  '扁蒲': '葫蘆', '蕹菜': '蕹菜', '空心菜': '蕹菜',
  '過貓': '蕨類', '蕨菜': '蕨類',
};

// ---- Inline: normalizeName ----
function normalizeName(name) {
  if (!name) return '';
  let s = name.trim();
  s = s.replace(/(進口|本土|其他|其它)/g, '');
  s = s.replace(/小果/g, '小');
  s = s.replace(/[（(][^）)]*[）)]/g, '');
  s = s.replace(/[（()）]/g, '');
  s = s.replace(/-+$/, '').trim();
  return s;
}

// ---- Inline: splitMarketName ----
function splitMarketName(marketName) {
  const std = normalizeName(marketName);
  const parts = std.split(/[-–/]/);
  const main = parts[0] ? parts[0].trim() : '';
  const sub = parts[1] ? parts[1].trim() : '';
  return { main, sub, originalStd: std };
}

// ---- Inline: buildCropIndex ----
function buildCropIndex(catalog) {
  const cnameMap = new Map();
  const plv3Map = new Map();

  for (const item of catalog) {
    if (!item.name) continue;
    const stdCname = normalizeName(item.name);
    if (stdCname) cnameMap.set(stdCname, item);
    if (item.plv3_name) {
      const stdPlv3 = normalizeName(item.plv3_name);
      if (stdPlv3 && !plv3Map.has(stdPlv3)) plv3Map.set(stdPlv3, item);
    }
  }

  return { cnameMap, plv3Map };
}

// ---- Inline: lookupCrop ----
function lookupCrop(marketName, index) {
  if (!marketName || !index) return null;
  const { cnameMap, plv3Map } = index;
  const { main, originalStd } = splitMarketName(marketName);

  // 第一級：完整名稱 CNAME 精確比對
  if (cnameMap.has(originalStd)) return cnameMap.get(originalStd);

  // 第二級：主品項比對 PLV3_NAME
  if (main && plv3Map.has(main)) return plv3Map.get(main);

  // 第三級：別名表轉換後再比對
  const aliasMain = MARKET_ALIAS[main];
  if (aliasMain && plv3Map.has(aliasMain)) return plv3Map.get(aliasMain);

  // 第四級：模糊搜尋 CNAME
  if (main) {
    for (const [cname, item] of cnameMap.entries()) {
      if (cname === main || item.plv3_name === main) return item;
    }
  }
  return null;
}

// ---- 執行測試 ----
console.log('--- 🌽 作物反向比對驗證 ---\n');

const index = buildCropIndex(catalog);

const testRecords = [
  '玫瑰-紫霧',
  '玫瑰-山中傳奇',
  '甘藍-改良尖',
  '甘藍-初秋',
  '辣椒-朝天椒',
  '萵苣-廣東菜',
  '甜椒-青椒',
  '玉米-玉米筍',
  '落花生-生',
  '包心白-成功白',
  '皇宮菜-大葉',
  '其他',
];

let ok = 0, fail = 0;
testRecords.forEach(name => {
  const info = lookupCrop(name, index);
  const { main, sub } = splitMarketName(name);
  const status = info ? '✅' : '❌';
  if (info) ok++; else fail++;
  console.log(`${status} ${name}`);
  console.log(`   分割: "${main}" / "${sub}"`);
  if (info) {
    console.log(`   對應: ${info.plv1_name} > ${info.plv2_name} > PLV3=${info.plv3_name}`);
  } else {
    console.log(`   ❌ 無法對應`);
  }
  console.log();
});

console.log(`==============================`);
console.log(`結果：${ok} 成功 / ${fail} 失敗 / 共 ${testRecords.length} 筆`);
