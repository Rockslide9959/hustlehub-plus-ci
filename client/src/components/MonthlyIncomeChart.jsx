import { formatPrice } from "../utils/format";
import { niceMax } from "../utils/chart";

const WIDTH = 640;
const HEIGHT = 280;
const MARGIN = { top: 16, right: 8, bottom: 32, left: 64 };
const TICK_COUNT = 4;

function formatTick(value) {
  if (value >= 1000)
    return `R${Math.round(value / 100) / 10}k`.replace(".0k", "k");
  return `R${value}`;
}

export default function MonthlyIncomeChart({ monthly = [] }) {
  const total = monthly.reduce((sum, m) => sum + m.income, 0);

  if (monthly.length === 0 || total === 0) {
    return (
      <p className="muted">
        No completed income in this tax year yet, so there is nothing to chart.
      </p>
    );
  }

  const plotWidth = WIDTH - MARGIN.left - MARGIN.right;
  const plotHeight = HEIGHT - MARGIN.top - MARGIN.bottom;
  const max = niceMax(Math.max(...monthly.map((m) => m.income)));
  const slot = plotWidth / monthly.length;
  const barWidth = slot * 0.62;
  const y = (value) => MARGIN.top + plotHeight - (value / max) * plotHeight;

  const ticks = Array.from(
    { length: TICK_COUNT + 1 },
    (_, i) => (max / TICK_COUNT) * i,
  );

  return (
    <svg
      className="chart"
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      role="img"
      aria-label={`Monthly income for the tax year, total ${formatPrice(total)}`}
    >
      {ticks.map((tick) => (
        <g key={tick}>
          <line
            className="chart-grid"
            x1={MARGIN.left}
            x2={WIDTH - MARGIN.right}
            y1={y(tick)}
            y2={y(tick)}
          />
          <text
            className="chart-axis"
            x={MARGIN.left - 8}
            y={y(tick)}
            textAnchor="end"
            dominantBaseline="middle"
          >
            {formatTick(tick)}
          </text>
        </g>
      ))}

      {monthly.map((m, i) => {
        const x = MARGIN.left + i * slot + (slot - barWidth) / 2;
        const height = (m.income / max) * plotHeight;
        return (
          <g key={`${m.month}-${m.year}`}>
            <rect
              className="chart-bar"
              x={x}
              y={y(m.income)}
              width={barWidth}
              height={height}
              rx="2"
            >
              <title>{`${m.month} ${m.year}: ${formatPrice(m.income)}`}</title>
            </rect>
            <text
              className="chart-axis"
              x={x + barWidth / 2}
              y={HEIGHT - 10}
              textAnchor="middle"
            >
              {m.month}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
