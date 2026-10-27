import { useMemo, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import { buildGenChart, genChartOfficial, genChartSourceText, manText, nearestPoint, type GenChartPoint, type GenChartSource } from '../core/genChart';
import { valueWidthEm } from '../core/slideKit';
import type { GenerationChoice } from '../core/types';
import { GEN_CHART_TEXT } from '../data/genChartText';
import { Glue } from './Glue';
import { useIsoLayoutEffect } from './hooks';

/**
 * 캐러셀의 첫 장 「세대 그래프」 (SPEC-004 GS11, diff-004.md D4-71·D4-72, design-system.md 17-12-3·17-13): 다른 장과 같은 슬라이드 문법 —
 * 물음 표제어 → 세대 줄(공식 통계명 자리, `aria-live=polite`) → 큰 값(한 해 평균) → 그림(1940~2020 선, 고른 세대 구간만 강조) → 숫자 둘(올해 나이 · 태어난 해의 기대수명) → 「표로 보기」 → 출처.
 * 왼쪽 세대 목록이 손잡이다: 고른 세대가 바뀌면 같은 모델 함수로 그림·숫자·표·읽기 이름을 다시 만든다(`core/genChart.ts`). 세대 줄 하나만 알리고 그림 읽기 이름의 변경은 알리지 않는다.
 * 그림은 화면에 그려지는 폭으로 좌표를 만든다(다른 장의 선 그래프와 같은 방식 — 글자가 어느 폭에서나 같은 크기). 가리킴: 플롯 위에서 가장 가까운 해의 세로 가는 선 + 점 + 「1988년 · 63만 명」.
 * 값은 모두 표(「표로 보기」)에도 있어 가리킴이 없어도 읽힌다.
 */

/** 첫 장의 슬라이드 id (data-slide-id) */
export const GEN_SLIDE_ID = 'gen-births';

/** 큰 값 줄의 글자 크기를 칸 폭에 맞추는 CSS 변수 (title.css .slide__value와 같은 규칙) */
function valueSizing(valueText: string, unitText: string): CSSProperties {
  return { '--value-em': Math.max(valueWidthEm(valueText), 1), '--unit-chars': Math.max(unitText.length, 1) } as CSSProperties;
}

export function GenSlide({ choice, source, active, index, count }: { choice: GenerationChoice; source: GenChartSource; active: boolean; index: number; count: number }) {
  const ref = useRef<HTMLElement>(null);
  const [width, setWidth] = useState(320);
  const [hover, setHover] = useState<GenChartPoint | null>(null);
  // 그려지는 폭을 첫 그림 전에 한 번, 이후 크기가 바뀔 때마다 잰다
  useIsoLayoutEffect(() => {
    const el = ref.current;
    if (el === null) return;
    const measure = () => setWidth(el.clientWidth);
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const m = useMemo(() => buildGenChart(choice, source, width), [choice, source, width]);
  const src = useMemo(() => genChartSourceText(source), [source]);
  const official = genChartOfficial(source);

  const onMove = (e: PointerEvent<SVGRectElement>) => {
    const svg = e.currentTarget.ownerSVGElement;
    if (svg === null) return;
    const box = svg.getBoundingClientRect();
    if (box.width === 0) return;
    setHover(nearestPoint(m, ((e.clientX - box.left) * m.width) / box.width));
  };

  return (
    <article
      ref={ref}
      className={`slide slide--gen${active ? ' is-active' : ''}`}
      data-testid="stat-slide"
      data-slide-id={GEN_SLIDE_ID}
      data-gen={choice}
      aria-roledescription="슬라이드"
      aria-label={`${index + 1}/${count} ${GEN_CHART_TEXT.insight}, ${official}`}
    >
      <h3 className="slide__insight">
        <Glue text={GEN_CHART_TEXT.insight} />
      </h3>
      <p className="slide__official gen-chart__gen" aria-live="polite" data-testid="gen-chart-gen">
        {/* 짧은 쌍 「이름 · 범위」(ui/Pair.tsx와 같은 마크업·같은 컨테이너 쿼리 .pair--meta): 한 줄에 못 들어가는 칸에서는 기호를 감추고 둘을 따로 줄로 둔다 — 「·」가 줄 끝에 혼자 서지 않는다 */}
        <span className="pair pair--meta pair--gen">
          <span className="pair__item">
            <b>{m.gen.name}</b>
          </span>{' '}
          <span className="pair__sep">· </span>
          <span className="pair__item">{m.gen.range}</span>
        </span>
      </p>
      <p className="slide__value gen-chart__big" style={valueSizing(m.big?.value ?? '—', m.big?.unit ?? '')} data-testid="gen-chart-big">
        {m.big === null ? (
          <>
            <span className="gen-chart__dash" aria-hidden="true">
              —
            </span>
            <span className="sr-only">{GEN_CHART_TEXT.noData}</span>
          </>
        ) : (
          <>
            <span>{m.big.value}</span>
            <small className="slide__unit">{m.big.unit}</small>
          </>
        )}
      </p>
      <p className="gen-chart__bigsub">
        <Glue text={m.bigSub} />
      </p>
      <svg className="chart gchart gen-chart__plot" viewBox={`0 0 ${m.width} ${m.height}`} role="img" aria-label={m.readName} focusable="false" data-testid="gen-chart-plot">
        {m.grid.map((y, i) => (
          <line key={`g${i}`} className="grid" x1={m.L} x2={m.R} y1={y} y2={y} />
        ))}
        {m.band === null ? null : <rect className="gchart__band" x={m.band.x} y={m.band.y} width={m.band.width} height={m.band.height} data-testid="gen-chart-band" />}
        {m.yTicks.map((t) => (
          <text key={`y${t.text}`} className="gchart__tick" x={m.L - 6} y={t.y} textAnchor="end">
            {t.text}
          </text>
        ))}
        <line className="axis" x1={m.L} x2={m.R} y1={m.B} y2={m.B} />
        {m.xTicks.map((t) => (
          <text key={`x${t.text}`} className="gchart__tick" x={t.x} y={m.B + 16} textAnchor={t.anchor}>
            {t.text}
          </text>
        ))}
        <text className="gchart__none" x={m.none.x} y={m.none.y} textAnchor="middle" data-testid="gen-chart-none">
          {m.none.text}
        </text>
        <polyline className="gchart__line gchart__line--rest" points={m.rest} />
        {m.span === null ? null : <polyline className="gchart__line gchart__line--span" points={m.span} data-testid="gen-chart-span" />}
        {m.peak === null ? null : (
          <>
            <circle className="gchart__dot" cx={m.peak.x} cy={m.peak.y} r={4} />
            <text className="gchart__peak" x={m.peak.labelX} y={m.peak.labelY} textAnchor="middle" data-testid="gen-chart-peak">
              {m.peak.text}
            </text>
          </>
        )}
        <rect className="gchart__hit" x={m.L} y={m.T} width={m.R - m.L} height={m.B - m.T} onPointerMove={onMove} onPointerLeave={() => setHover(null)} onPointerCancel={() => setHover(null)} />
        {hover === null ? null : (
          <>
            <line className="gchart__cursor" x1={hover.x} x2={hover.x} y1={m.T - 2} y2={m.B} />
            <circle className="gchart__cursor-dot" cx={hover.x} cy={hover.y} r={4} />
            <text className="gchart__cursor-text" x={Math.min(Math.max(hover.x, m.L + 70), m.R - 70)} y={m.T - 4} textAnchor="middle" data-testid="gen-chart-hover">
              {GEN_CHART_TEXT.hover(hover.year, manText(hover.value))}
            </text>
          </>
        )}
      </svg>
      <dl className="gen-chart__nums gen-chart__nums--2" data-testid="gen-chart-nums">
        <div>
          <dt>{GEN_CHART_TEXT.kAge}</dt>
          <dd>
            <span className="gen-chart__val">{m.age}</span>
          </dd>
        </div>
        <div>
          <dt>{GEN_CHART_TEXT.kLife}</dt>
          <dd>
            {m.life === null ? (
              <>
                <span className="gen-chart__val gen-chart__dash" aria-hidden="true">
                  —
                </span>
                <span className="sr-only">{GEN_CHART_TEXT.noData}</span>
                <small>{m.lifeNone}</small>
              </>
            ) : (
              <>
                <span className="gen-chart__val">{m.life.value}</span>
                <small>{m.life.sub}</small>
              </>
            )}
          </dd>
        </div>
      </dl>
      <details className="disclosure gen-chart__table" data-testid="gen-chart-table">
        <summary>{GEN_CHART_TEXT.tableSummary}</summary>
        <table>
          <caption className="sr-only">{m.tableCaption}</caption>
          <thead>
            <tr>
              <th scope="col">{GEN_CHART_TEXT.thYear}</th>
              <th scope="col">{GEN_CHART_TEXT.thBirths}</th>
            </tr>
          </thead>
          <tbody>
            {m.table.map((r) => (
              <tr key={r.label}>
                <th scope="row">{r.label}</th>
                <td>
                  {r.value === null ? (
                    <>
                      <span className="sr-only">{GEN_CHART_TEXT.noData}</span>
                      <span className="gen-chart__dash" aria-hidden="true">
                        —
                      </span>
                    </>
                  ) : (
                    r.value
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
      <p className="slide__meta" data-testid="gen-chart-source">
        <Glue text={`${src.lead} ${src.tail}`} />
      </p>
    </article>
  );
}
