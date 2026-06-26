export function shareCropInfo(crop, city, cityPrice, avg, badge) {
  const labels = { cheap: '划算', normal: '正常', expensive: '偏貴' };
  const date = new Date().toLocaleDateString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const text = `【${crop.cropName}】今日行情 $${cityPrice.toFixed(1)}元/公斤（${city}）— ${labels[badge]}，均價 $${avg.toFixed(1)}元\n📅 ${date} 菜價行情（農業部資料）`;

  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(() => {
      // 複製成功，回傳提示文案
      return text;
    });
  }
  return text;
}
