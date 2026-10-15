import type { BarChartModel, Dash, LineChartModel, LineSeriesModel } from '../core/carousel';

/**
 * 통계 슬라이드의 그래프 (SC2·SC7: 차트 라이브러리 없이 SVG 직접). 좌표는 core/carousel.ts가 계산하고 여기서는 그리기만 한다.
 * 색에만 의존하지 않는다: 보조 계열은 선 모양(실선·긴 점선·점선)과 점 모양(원·네모·마름모)도 다르고, 값은 글자로 병기한다.
 * 좌표계의 폭은 화면에 그려지는 폭과 같게 만들어 오므로(core/carousel.ts#chartSizeFor, R-206) viewBox 한 칸 = 1px이고 글자는 어느 폭에서나 같은 크기다.
 */

function Marker({ shape, x, y, last }: { shape: Dash; x: number; y: number; last: boolean }) {
  const cls = `dot${shape === 'solid' ? '' : ` dot--${shape}`}${last ? ' dot--last' : ''}`;
  const r = last ? 4.5 : 3;
  if (shape === 'dashed') return <rect className={cls} x={x - r} y={y - r} width={r * 2} height={r * 2} />;
  if (shape === 'dotted') return <polygon className={cls} points={`${x},${y - r - 1} ${x + r + 1},${y} ${x},${y + r + 1} ${x - r - 1},${y}`} />;
  return <circle className={cls} cx={x} cy={y} r={r} />;
}

function Series({ s }: { s: LineSeriesModel }) {
  const cls = `line${s.dash === 'solid' ? '' : ` line--${s.dash}`}`;
  const showDots = s.points.length <= 20;
  return (
    <g data-series={s.key}>
      {s.segments.map((seg, i) => (seg.length >= 2 ? <polyline key={i} className={cls} points={seg.map((p) => `${p.x},${p.y}`).join(' ')} /> : null))}
      {showDots ? s.points.map((p) => <Marker key={p.year} shape={s.dash} x={p.x} y={p.y} last={p === s.last} />) : <Marker shape={s.dash} x={s.last.x} y={s.last.y} last />}
    </g>
  );
}

export function LineChart({ chart, label }: { chart: LineChartModel; label: string }) {
  return (
    <svg className="chart" viewBox={`0 0 ${chart.width} ${chart.height}`} role="img" aria-label={label} focusable="false">
      {chart.grid.map((y) => (
        <line key={y} className="grid" x1={chart.plotLeft} x2={chart.plotRight} y1={y} y2={y} />
      ))}
      <line className="axis" x1={chart.plotLeft} x2={chart.plotRight} y1={chart.axisY} y2={chart.axisY} />
      {chart.series.map((s) => (
        <Series key={s.key} s={s} />
      ))}
      {chart.xLabels.map((l) => (
        <text key={l.text} x={l.x} y={l.y} textAnchor={l.anchor}>
          {l.text}
        </text>
      ))}
      {chart.labels.map((l, i) => (
        <text key={i} className={l.bold ? 'val' : undefined} x={l.x} y={l.y} textAnchor={l.anchor}>
          {l.text}
        </text>
      ))}
    </svg>
  );
}

export function BarChart({ chart, label }: { chart: BarChartModel; label: string }) {
  return (
    <svg className="chart" viewBox={`0 0 ${chart.width} ${chart.height}`} role="img" aria-label={label} focusable="false">
      {chart.rows.map((r) => (
        <g key={r.fullLabel}>
          <text className="bar-label" x={chart.labelWidth} y={r.y + chart.rowHeight - 3}>
            {r.label}
          </text>
          {/* 클래스 이름은 chart-bar: 옛 인생 화면의 상태 막대(.bar, 높이 6px)와 이름이 겹쳐 그 규칙이 그래프 막대를 가늘게 만들었다(R-215) */}
          <rect className="chart-bar" x={chart.barX} y={r.y + 2} width={r.barWidth} height={chart.rowHeight - 5} rx={2} />
          <text className="bar-value" x={chart.barX + r.barWidth + 4} y={r.y + chart.rowHeight - 3}>
            {r.text}
          </text>
        </g>
      ))}
    </svg>
  );
}

/**
 * 막대 그래프의 모든 값을 표로 — 화면에서는 숨기고(sr-only) 보조기기에는 읽힌다(R-207). 그래프(`role="img"`)의 대체 텍스트는 가장 큰·작은 값만 요약하므로
 * 16개 시·도의 값 전부는 이 표에서 찾는다. 표는 그래프와 같은 순서(큰 값부터)다.
 */
export function BarTable({ chart, caption }: { chart: BarChartModel; caption: string }) {
  return (
    <div className="sr-only" data-testid="chart-table">
      <table>
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">항목</th>
            <th scope="col">값</th>
          </tr>
        </thead>
        <tbody>
          {chart.rows.map((r) => (
            <tr key={r.fullLabel}>
              <th scope="row">{r.fullLabel}</th>
              <td>{r.valueWithUnit}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** 범례의 선 모양 견본 */
export function Swatch({ dash }: { dash: Dash }) {
  return (
    <svg viewBox="0 0 28 10" aria-hidden="true" focusable="false">
      <line className={`swatch-line${dash === 'solid' ? '' : ` swatch-line--${dash}`}`} x1={1} x2={27} y1={5} y2={5} />
    </svg>
  );
}
