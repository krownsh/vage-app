/**
 * 30 天價格趨勢折線圖（純 SVG，無外部依賴）
 *
 * props:
 *   points: [{ date: '115.06.22', avg: 28.5 }, ...]  // 至少 2 點才繪製
 *   embedded: true → 不輸出 .trend-section 外殼（呼叫端已包好）
 *   width / height: 預設 320 / 160（embedded=true 時通常由 CSS 撐滿父層）
 *
 * 樣式對齊 docs/uiux.md §16：
 *   line   #168A3A / 3px
 *   point  r=4；active 點（高點）r=7，fill #FFC51B，stroke #111
 *   平均線 dashed #9A9A9A 2px
 *   grid   #DDE3E8 1px
 *   高點標 "高 $22.1" 上方、#FF2D2D、15px/800
 *   平均線右側 "均" #777、15px/700
 */
export default function TrendChart({ points, width = 320, height = 160, embedded = false }) {
  if (!points || points.length < 2) return null;

  // 內邊距：左 36 (Y 軸標籤)、右 24（放「均」標）、上 18（高點標）、下 30（X 軸）
  const padL = 36, padR = 24, padT = 18, padB = 30;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  // Y 軸範圍（含 5% 邊距）
  const vals = points.map((p) => p.avg);
  const rawMin = Math.min(...vals);
  const rawMax = Math.max(...vals);
  const padding5 = (rawMax - rawMin || 1) * 0.05;
  const minVal = rawMin - padding5;
  const maxVal = rawMax + padding5;
  const yRange = maxVal - minVal || 1;

  const xStep = plotW / (points.length - 1);
  const xAt = (i) => padL + i * xStep;
  const yAt = (v) => padT + plotH - ((v - minVal) / yRange) * plotH;

  // Y 軸刻度（4 條）
  const yTicks = [0, 0.33, 0.67, 1].map((p) => ({
    y: padT + (1 - p) * plotH,
    label: (minVal + p * yRange).toFixed(1),
  }));

  // X 軸標籤：第一筆、中間、最後
  const xLabels = [
    { x: xAt(0), label: points[0].date.slice(5) }, // "MM.DD"
    { x: xAt(Math.floor((points.length - 1) / 2)), label: points[Math.floor((points.length - 1) / 2)].date.slice(5) },
    { x: xAt(points.length - 1), label: points[points.length - 1].date.slice(5) },
  ];

  // 統計
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  const maxIdx = vals.indexOf(Math.max(...vals));

  // 折線 polyline
  const polyPoints = points.map((p, i) => `${xAt(i)},${yAt(p.avg)}`).join(' ');

  const svg = (
    <svg
      className="trend-svg"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMid meet"
    >
      {/* Y 軸格線 + 標籤 */}
      {yTicks.map((t, i) => (
        <g key={i}>
          <line
            x1={padL}
            y1={t.y}
            x2={padL + plotW}
            y2={t.y}
            stroke="#DDE3E8"
            strokeWidth="1"
          />
          <text
            x={padL - 6}
            y={t.y + 4}
            fontSize="11"
            fill="#777777"
            textAnchor="end"
            fontFamily="inherit"
          >
            {t.label}
          </text>
        </g>
      ))}

      {/* 平均線（虛線） */}
      <line
        x1={padL}
        y1={yAt(mean)}
        x2={padL + plotW}
        y2={yAt(mean)}
        stroke="#9A9A9A"
        strokeWidth="2"
        strokeDasharray="4,4"
      />

      {/* 平均線右側「均」標 */}
      <text
        x={padL + plotW + 4}
        y={yAt(mean) + 4}
        fontSize="13"
        fontWeight="700"
        fill="#777777"
        textAnchor="start"
        fontFamily="inherit"
      >
        均
      </text>

      {/* 折線 */}
      <polyline
        points={polyPoints}
        fill="none"
        stroke="#168A3A"
        strokeWidth="3"
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {/* 資料點 */}
      {points.map((p, i) => {
        const isMax = i === maxIdx;
        return (
          <g key={i}>
            <title>{`${p.date}: $${p.avg.toFixed(1)} 元/kg`}</title>
            <circle
              cx={xAt(i)}
              cy={yAt(p.avg)}
              r={isMax ? 7 : 4}
              fill={isMax ? '#FFC51B' : '#168A3A'}
              stroke={isMax ? '#111111' : 'none'}
              strokeWidth={isMax ? 2 : 0}
              style={{ cursor: 'pointer' }}
            />
          </g>
        );
      })}

      {/* 最高標註 */}
      <text
        x={xAt(maxIdx)}
        y={yAt(points[maxIdx].avg) - 12}
        fontSize="13"
        fontWeight="800"
        fill="#FF2D2D"
        textAnchor="middle"
        fontFamily="inherit"
      >
        高 ${points[maxIdx].avg.toFixed(1)}
      </text>

      {/* X 軸標籤 */}
      {xLabels.map((l, i) => (
        <text
          key={i}
          x={l.x}
          y={height - 10}
          fontSize="11"
          fill="#777777"
          textAnchor="middle"
          fontFamily="inherit"
        >
          {l.label}
        </text>
      ))}
    </svg>
  );

  if (embedded) return svg;

  return (
    <div className="trend-section">
      <h4 className="section-title">近 30 天趨勢</h4>
      <div className="trend-card">{svg}</div>
    </div>
  );
}