import type { BarChartModel, BarsChartModel, ChartLabel, Dash, LegendRect, LineChartModel, LineSeriesModel, SlideChart, SlideTable, StackChartModel } from '../core/carousel';

/**
 * 통계 슬라이드의 그래프 (SC2·SC7: 차트 라이브러리 없이 SVG 직접). 좌표는 core/carousel.ts(전망·격차·폭염·아기 슬라이드는 core/slideForms.ts)가 계산하고 여기서는 그리기만 한다.
 * 색에만 의존하지 않는다: 보조 계열은 선 모양(실선·긴 점선·점선)과 점 모양(원·네모·마름모)도 다르고, 값은 글자로 병기한다. 전망(QI4)은 놋쇠 긴 점선 + 경계 세로선·「확정 | 전망」 글자 + 범례 「전망」 +
 * 막대는 빗금(`#hatch`)으로 구분하고, 아기 슬라이드의 65세 이상 칸은 점무늬(`#dots`)다 — 두 무늬 모두 아이콘 스프라이트(`Sprite`)의 `<pattern>`이고 빗금은 「전망」 전용이다(R-477).
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
  // 점: 기본은 20개 이하면 모두·넘으면 마지막만. 전망 그래프는 확정 구간 점 없음(`none`)·전망 구간 마지막 점만(`last`)
  const showDots = s.marks === undefined && s.points.length <= 20;
  return (
    <g data-series={s.key}>
      {s.segments.map((seg, i) => (seg.length >= 2 ? <polyline key={i} className={cls} points={seg.map((p) => `${p.x},${p.y}`).join(' ')} /> : null))}
      {s.marks === 'none' ? null : showDots ? s.points.map((p) => <Marker key={p.year} shape={s.dash} x={p.x} y={p.y} last={p === s.last} />) : <Marker shape={s.dash} x={s.last.x} y={s.last.y} last />}
    </g>
  );
}

/** 글자 하나: 굵은 값 `val`, 띠 끝 글자 `range-label`, 경계 위 글자 `split-label` — 모양은 CSS(`title.css` 「QI4 전망 차트」) */
function LabelText({ l }: { l: ChartLabel }) {
  const cls = l.bold ? 'val' : l.tone === 'range' ? 'range-label' : l.tone === 'split' ? 'split-label' : undefined;
  return (
    <text className={cls} x={l.x} y={l.y} textAnchor={l.anchor}>
      {l.text}
    </text>
  );
}

export function LineChart({ chart, label }: { chart: LineChartModel; label: string }) {
  const { split, band } = chart;
  return (
    <svg className="chart" viewBox={`0 0 ${chart.width} ${chart.height}`} role="img" aria-label={label} focusable="false">
      {chart.grid.map((y) => (
        <line key={y} className="grid" x1={chart.plotLeft} x2={chart.plotRight} y1={y} y2={y} />
      ))}
      <line className="axis" x1={chart.plotLeft} x2={chart.plotRight} y1={chart.axisY} y2={chart.axisY} />
      {band === null ? null : (
        <>
          <path className="band" d={band.path} />
          <polyline className="line--range" points={band.edges[0]} />
          <polyline className="line--range" points={band.edges[1]} />
        </>
      )}
      {chart.series.map((s) => (
        <Series key={s.key} s={s} />
      ))}
      {split === null ? null : (
        <>
          <line className="split" x1={split.x} x2={split.x} y1={split.top} y2={split.bottom} />
          <LabelText l={split.left} />
          <LabelText l={split.right} />
          <line className="tick" x1={split.x} x2={split.x} y1={split.bottom} y2={split.tickTo} />
        </>
      )}
      {chart.xLabels.map((l) => (
        <text key={l.text} x={l.x} y={l.y} textAnchor={l.anchor}>
          {l.text}
        </text>
      ))}
      {chart.labels.map((l, i) => (
        <LabelText key={i} l={l} />
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
 * 가로 막대 몇 개 (QI4): 폭염일수 막대 셋(현재 = 실선 채움, 전망 둘 = 놋쇠 빗금)과 연령별 격차 두 구간 막대(같은 채움 — 라벨 글자가 구분한다, 값 굵게).
 * 행 높이가 15px인 시·도 막대(`BarChart`)와 달리 행이 높고 막대가 굵다(막대가 셋·둘뿐이라) — 좌표는 모델이 정한다.
 */
export function BarsChart({ chart, label }: { chart: BarsChartModel; label: string }) {
  return (
    <svg className="chart" viewBox={`0 0 ${chart.width} ${chart.height}`} role="img" aria-label={label} focusable="false">
      {chart.header === null ? null : <LabelText l={chart.header} />}
      {chart.rows.map((r) => (
        <g key={r.fullLabel}>
          <text className="bar-label" x={chart.labelX} y={r.textY}>
            {r.label}
          </text>
          <rect className={`chart-bar${r.proj ? ' chart-bar--proj' : ''}`} x={chart.barX} y={r.barY} width={r.barWidth} height={chart.barHeight} rx={2} />
          <text className={r.bold ? 'bar-value val' : 'bar-value'} x={round1(chart.barX + r.barWidth + (r.bold ? 6 : 4))} y={r.textY}>
            {r.text}
          </text>
        </g>
      ))}
    </svg>
  );
}

const round1 = (n: number): number => Math.round(n * 10) / 10;

/**
 * 아기 슬라이드의 가로 누적 막대 (D5-68): 행 = 아기가 0·10·20·30·40세가 되는 해, 칸 셋 = 0~14세(빈 칸) · 15~64세(채움, 안에 값) · 65세 이상(점무늬 `#dots` — 놋쇠 빗금은 「전망」 전용, R-477),
 * 오른쪽에 65세 이상 값(굵게), 위 오른쪽에 「모두 전망(중위 추계)」. 0~14세 칸은 좁아 글자를 넣지 않고 범례·표·읽기 이름이 값을 말한다.
 */
export function StackChart({ chart, label }: { chart: StackChartModel; label: string }) {
  return (
    <svg className="chart" viewBox={`0 0 ${chart.width} ${chart.height}`} role="img" aria-label={label} focusable="false">
      <LabelText l={chart.header} />
      {chart.rows.map((r) => (
        <g key={r.year} data-row={r.year}>
          <text className="bar-label row-label" x={chart.labelX} y={r.textY}>
            <tspan className="val">{r.ageText}</tspan> {r.yearText}
          </text>
          <rect className="chart-seg chart-seg--young" x={r.young.x} y={r.y} width={r.young.width} height={chart.barHeight} />
          <rect className="chart-seg chart-seg--work" x={r.work.x} y={r.y} width={r.work.width} height={chart.barHeight} />
          <text className="seg-text" x={round1(r.work.x + r.work.width / 2)} y={r.textY} textAnchor="middle">
            {r.work.text}
          </text>
          <rect className="chart-seg chart-seg--old" x={r.old.x} y={r.y} width={r.old.width} height={chart.barHeight} />
          <text className="bar-value val" x={r.valueX} y={r.textY}>
            {r.valueText}
          </text>
        </g>
      ))}
    </svg>
  );
}

/** 슬라이드의 그래프 하나 — 모델의 종류(`kind`)에 맞는 그림 */
export function SlideChartView({ chart, label }: { chart: SlideChart; label: string }) {
  if (chart.kind === 'line') return <LineChart chart={chart} label={label} />;
  if (chart.kind === 'bar') return <BarChart chart={chart} label={label} />;
  if (chart.kind === 'bars') return <BarsChart chart={chart} label={label} />;
  return <StackChart chart={chart} label={label} />;
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

/** 그래프 밖에 숨겨 두는 표(sr-only, QI4): 격차 2011~2024 시계열 · 폭염 권역 6곳 · 아기 5행 — 그래프가 보이지 않는 값 전부를 보조기기가 읽는다 */
export function SrTable({ table }: { table: SlideTable }) {
  return (
    <div className="sr-only" data-testid="chart-table">
      <table>
        <caption>{table.caption}</caption>
        <thead>
          <tr>
            {table.head.map((h, i) => (
              <th key={i} scope="col">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((r) => (
            <tr key={r.head}>
              <th scope="row">{r.head}</th>
              {r.cells.map((c, i) => (
                <td key={i}>{c}</td>
              ))}
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

/** 범례의 네모 견본 (D5-64): 띠 · 채움 막대 · 전망 빗금 · 빈 칸 · 채움 칸 · 점무늬 칸 */
export function SwatchRect({ kind }: { kind: LegendRect }) {
  return (
    <svg viewBox="0 0 28 10" aria-hidden="true" focusable="false">
      <rect className={`swatch-rect--${kind}`} x={1} y={1} width={26} height={8} rx={1} />
    </svg>
  );
}
