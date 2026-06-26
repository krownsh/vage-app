/**
 * 從 LLM 回應中萃取出 JSON 資料
 * response_format: json_object 模式下，LLM 回 { "items": [...] }
 */
export function extractJson(content) {
  if (!content) return [];

  let text = content.trim();

  // 去掉 markdown code block
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) text = codeBlockMatch[1].trim();

  // 嘗試直接解析
  try {
    const parsed = JSON.parse(text);
    // 從物件中找陣列
    for (const key of ['items', 'results', 'data', 'weights', 'crops']) {
      if (Array.isArray(parsed[key])) return parsed[key];
    }
    // 如果 parsed 本身就是陣列
    if (Array.isArray(parsed)) return parsed;
    // 如果只有一筆記錄在根層
    if (parsed.name && typeof parsed.avgWeightKg === 'number') return [parsed];
    return [];
  } catch {
    // 找不到有效 JSON
    return [];
  }
}
