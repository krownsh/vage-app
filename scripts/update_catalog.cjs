const fs = require('fs');
const path = require('path');
const https = require('https');

const URL = 'https://data.moa.gov.tw/Service/OpenData/TransService.aspx?UnitId=LC7YWlenhLuP';
const OUTPUT_PATH = path.resolve(__dirname, '../public/data/crop_catalog.json');

console.log('正在從農業部下載農作物統一名稱與代碼 (LC7YWlenhLuP)...');

https.get(URL, (res) => {
  if (res.statusCode !== 200) {
    console.error(`下載失敗，HTTP 狀態碼: ${res.statusCode}`);
    process.exit(1);
  }

  let rawData = '';
  res.on('data', (chunk) => {
    rawData += chunk;
  });

  res.on('end', () => {
    try {
      console.log('下載完成，正在解析 JSON...');
      const items = JSON.parse(rawData);
      console.log(`成功載入 ${items.length} 筆作物資料。`);

      // 排除本專案不用的類別：
//   001 稻米類、004 花卉類、006 特用作物、007 加工品、010 其他作物
//   只保留 002 蔬菜、003 果樹、005 雜糧
      const EXCLUDE_PLV1 = new Set(['001', '004', '006', '007', '010']);
      const filtered = items.filter(x => !EXCLUDE_PLV1.has(x.PLV1));
      console.log(`過濾後剩餘 ${filtered.length} 筆（排除稻米/花卉/特用/加工/其他）。`);

      // 提取並儲存完整的 6 級分類結構
      const catalog = filtered.map(item => ({
        uid: item.CROP_UID || '',
        name: item.CNAME || '',
        alias: item.ALIAS_CNAME || '',
        plv1: item.PLV1 || '',
        plv1_name: item.PLV1_NAME || '',
        plv2: item.PLV2 || '',
        plv2_name: item.PLV2_NAME || '',
        plv3: item.PLV3 || '',
        plv3_name: item.PLV3_NAME || '',
        plv4: item.PLV4 || '',
        plv4_name: item.PLV4_NAME || '',
        plv5: item.PLV5 || '',
        plv5_name: item.PLV5_NAME || '',
        plv6: item.PLV6 || ''
      }));

      // 確保目錄存在
      const dir = path.dirname(OUTPUT_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(OUTPUT_PATH, JSON.stringify(catalog, null, 2), 'utf8');
      console.log(`成功將完整目錄寫入至: ${OUTPUT_PATH}`);
      console.log(`檔案大小: ${(fs.statSync(OUTPUT_PATH).size / 1024).toFixed(1)} KB`);
    } catch (e) {
      console.error('JSON 解析或寫入失敗:', e.message);
      process.exit(1);
    }
  });
}).on('error', (err) => {
  console.error('網路請求錯誤:', err.message);
  process.exit(1);
});
