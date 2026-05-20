"use client";

// ---------------------------------------------------------------------------
// Pure-SVG chart primitives for the Accounting dashboard.
// No external dependencies — all layout is calculated inline.
// ---------------------------------------------------------------------------

// ─── Types ──────────────────────────────────────────────────────────────────

export type ChartPoint = { label: string; value: number };
export type ChartSlice = { label: string; value: number; color: string };

// ─── Helpers ────────────────────────────────────────────────────────────────

function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

// ─── Line Chart ─────────────────────────────────────────────────────────────
// Shows a trend line with dot markers and axis labels.

export function LineChart({
  data,
  height = 160,
  color = "#236c8f",
}: {
  data: ChartPoint[];
  height?: number;
  color?: string;
}) {
  if (!data.length) return <EmptyChart height={height} />;

  const W = 520;
  const H = height;
  const padTop = 12;
  const padBottom = 28;
  const padLeft = 56;
  const padRight = 16;

  const innerW = W - padLeft - padRight;
  const innerH = H - padTop - padBottom;

  const values = data.map((d) => d.value);
  const maxVal = Math.max(...values, 1);
  const minVal = 0;

  function x(i: number) {
    return padLeft + (i / Math.max(data.length - 1, 1)) * innerW;
  }
  function y(v: number) {
    return padTop + innerH - ((v - minVal) / (maxVal - minVal)) * innerH;
  }

  const points = data.map((d, i) => `${x(i)},${y(d.value)}`).join(" ");

  // Y-axis guide lines at 0%, 50%, 100%
  const guides = [0, 0.5, 1].map((pct) => ({
    yPos: padTop + innerH * (1 - pct),
    label: money(minVal + (maxVal - minVal) * pct),
  }));

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      aria-label="Revenue trend line chart"
    >
      {/* Horizontal guide lines */}
      {guides.map((g) => (
        <g key={g.label}>
          <line
            x1={padLeft}
            y1={g.yPos}
            x2={W - padRight}
            y2={g.yPos}
            stroke="#e5dfd4"
            strokeWidth="1"
          />
          <text
            x={padLeft - 6}
            y={g.yPos}
            textAnchor="end"
            dominantBaseline="middle"
            fontSize="10"
            fill="#9a9a9a"
          >
            {g.label}
          </text>
        </g>
      ))}

      {/* Area fill */}
      <polygon
        points={[
          `${x(0)},${padTop + innerH}`,
          ...data.map((d, i) => `${x(i)},${y(d.value)}`),
          `${x(data.length - 1)},${padTop + innerH}`,
        ].join(" ")}
        fill={color}
        fillOpacity="0.08"
      />

      {/* Trend line */}
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {/* Dots + x-axis labels */}
      {data.map((d, i) => (
        <g key={i}>
          <circle
            cx={x(i)}
            cy={y(d.value)}
            r="4"
            fill="white"
            stroke={color}
            strokeWidth="2"
          />
          <text
            x={x(i)}
            y={H - 6}
            textAnchor="middle"
            fontSize="10"
            fill="#697178"
          >
            {d.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

// ─── Bar Chart ───────────────────────────────────────────────────────────────
// Vertical bars with value labels on top.

export function BarChart({
  data,
  height = 160,
  color = "#236c8f",
}: {
  data: ChartPoint[];
  height?: number;
  color?: string;
}) {
  if (!data.length) return <EmptyChart height={height} />;

  const W = 520;
  const H = height;
  const padTop = 20;
  const padBottom = 32;
  const padLeft = 8;
  const padRight = 8;

  const innerW = W - padLeft - padRight;
  const innerH = H - padTop - padBottom;

  const maxVal = Math.max(...data.map((d) => d.value), 1);
  const barCount = data.length;
  const totalGap = innerW * 0.25;
  const barW = (innerW - totalGap) / barCount;
  const gapW = totalGap / Math.max(barCount - 1, 1);

  function barX(i: number) {
    return padLeft + i * (barW + gapW);
  }
  function barH(v: number) {
    return clamp((v / maxVal) * innerH, 2, innerH);
  }
  function barY(v: number) {
    return padTop + innerH - barH(v);
  }

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      aria-label="Artist revenue bar chart"
    >
      {/* Base line */}
      <line
        x1={padLeft}
        y1={padTop + innerH}
        x2={W - padRight}
        y2={padTop + innerH}
        stroke="#e5dfd4"
        strokeWidth="1.5"
      />

      {data.map((d, i) => {
        const bx = barX(i);
        const bh = barH(d.value);
        const by = barY(d.value);
        const isZero = d.value === 0;
        return (
          <g key={i}>
            <rect
              x={bx}
              y={by}
              width={barW}
              height={bh}
              rx="3"
              fill={isZero ? "#e5dfd4" : color}
              fillOpacity={isZero ? 1 : 0.85}
            />
            {/* Value on top */}
            {!isZero && (
              <text
                x={bx + barW / 2}
                y={by - 4}
                textAnchor="middle"
                fontSize="9"
                fill={color}
                fontWeight="bold"
              >
                {money(d.value)}
              </text>
            )}
            {/* Label below */}
            <text
              x={bx + barW / 2}
              y={H - 10}
              textAnchor="middle"
              fontSize="10"
              fill="#697178"
            >
              {d.label.length > 10 ? d.label.slice(0, 9) + "…" : d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ─── Donut Chart ─────────────────────────────────────────────────────────────
// Compact pie/donut with a legend.

export function DonutChart({
  data,
  size = 140,
}: {
  data: ChartSlice[];
  size?: number;
}) {
  const nonZero = data.filter((d) => d.value > 0);
  if (!nonZero.length) return <EmptyChart height={size} label="No data" />;

  const total = nonZero.reduce((s, d) => s + d.value, 0);
  const cx = size / 2;
  const cy = size / 2;
  const R = size / 2 - 8;
  const r = R * 0.6; // inner radius for donut

  // Build arc paths (accumulate start angles via reduce to avoid post-render mutation)
  function arcPath(startA: number, endA: number) {
    const x1 = cx + R * Math.cos(startA);
    const y1 = cy + R * Math.sin(startA);
    const x2 = cx + R * Math.cos(endA);
    const y2 = cy + R * Math.sin(endA);
    const ix1 = cx + r * Math.cos(endA);
    const iy1 = cy + r * Math.sin(endA);
    const ix2 = cx + r * Math.cos(startA);
    const iy2 = cy + r * Math.sin(startA);
    const large = endA - startA > Math.PI ? 1 : 0;
    return `M ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2} L ${ix1} ${iy1} A ${r} ${r} 0 ${large} 0 ${ix2} ${iy2} Z`;
  }

  type SliceWithPath = ChartSlice & { path: string; labelA: number };
  const startAngle = -Math.PI / 2;
  const slices = nonZero.reduce<{ list: SliceWithPath[]; cum: number }>(
    ({ list, cum }, d) => {
      const angle = (d.value / total) * 2 * Math.PI;
      const path = arcPath(cum, cum + angle);
      const labelA = cum + angle / 2;
      return {
        list: [...list, { ...d, path, labelA }],
        cum: cum + angle,
      };
    },
    { list: [], cum: startAngle },
  ).list;

  return (
    <div className="flex flex-wrap items-center gap-5">
      <svg
        viewBox={`0 0 ${size} ${size}`}
        width={size}
        height={size}
        aria-label="Revenue breakdown donut chart"
        className="shrink-0"
      >
        {slices.map((s, i) => (
          <path key={i} d={s.path} fill={s.color} strokeWidth="1.5" stroke="white" />
        ))}
        {/* Center label */}
        <text x={cx} y={cy - 6} textAnchor="middle" fontSize="11" fill="#697178">
          Total
        </text>
        <text x={cx} y={cy + 8} textAnchor="middle" fontSize="12" fontWeight="bold" fill="#1f2428">
          {money(total)}
        </text>
      </svg>

      {/* Legend */}
      <ul className="space-y-2 text-sm">
        {slices.map((s) => (
          <li key={s.label} className="flex items-center gap-2">
            <span
              className="inline-block h-3 w-3 shrink-0 rounded-sm"
              style={{ background: s.color }}
            />
            <span className="text-[#697178]">{s.label}</span>
            <span className="ml-auto font-bold text-[#1f2428]">{money(s.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Horizontal bar (simple breakdown) ──────────────────────────────────────

export function StackedBar({
  data,
  height = 20,
}: {
  data: ChartSlice[];
  height?: number;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return null;

  return (
    <div style={{ height }} className="flex w-full overflow-hidden rounded-md">
      {data.map((d) => {
        const pct = (d.value / total) * 100;
        if (pct < 0.5) return null;
        return (
          <div
            key={d.label}
            style={{ width: `${pct}%`, background: d.color }}
            title={`${d.label}: ${money(d.value)} (${pct.toFixed(1)}%)`}
          />
        );
      })}
    </div>
  );
}

// ─── Empty state ─────────────────────────────────────────────────────────────

function EmptyChart({ height = 160, label = "No data yet" }: { height?: number; label?: string }) {
  return (
    <div
      className="flex items-center justify-center rounded-md border border-dashed border-[#d9d3c7] text-sm text-[#697178]"
      style={{ height }}
    >
      {label}
    </div>
  );
}
