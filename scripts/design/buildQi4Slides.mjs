/**
 * SPEC-005 QI4 — 첫 화면 캐러셀 시안의 격차 슬라이드 두 장(`elderly-poverty` 실제 값 · `income-gap-by-age`)과 전망 슬라이드 다섯 장을
 * `src/data/koreaStats.json`의 값으로 만들어 `docs/design/mockups/title-005.html`의 표식 블록 두 곳에 넣는다 (designer 2026-10-21, r2 = REV-005-QI4-1 반영).
 *
 * 실행: node scripts/design/buildQi4Slides.mjs
 *   - 값은 전부 데이터 파일에서 읽는다(손으로 적은 수치 0). 문구(표제어·공식 통계명·캡션·보조 줄 틀·한 줄)는 아래 `COPY`가 정본과 같은 글자다(docs/design/copy.md 14절).
 *     보조 줄·캡션 틀에 든 숫자 토막은 같은 지표 `definition`의 정의 상수(「20%」)뿐이고 나머지 숫자는 데이터 값이다(R-486).
 *   - 표식: `<!-- QI4:gap:begin -->…<!-- QI4:gap:end -->`(4·5번 자리), `<!-- QI4:proj:begin -->…<!-- QI4:proj:end -->`(16~20번 자리).
 *     처음 실행 때는 옛 시안의 `poverty-by-age` 한 장과 `proj-*` 다섯 장을 찾아 표식으로 바꾼다. 다시 실행하면 표식 사이만 바뀐다.
 *   - 모든 슬라이드의 `aria-label` 「n/N」을 순서대로 다시 매기고 조작 줄의 「1 / N」도 맞춘다(N = 20).
 *   - 출처 줄은 20장 모두 「출처: {기관 나열}의 {표 이름} ({조회일} 조회)」 — 기관 묶음과 표 이름을 조사 「의」로 가른다(R-487, 손 시안 13장은 이 줄만 후처리).
 *   - 그래프 좌표계는 구현(`src/core/carousel.ts`)과 같은 320×232(PAD 8/66/24/30)이고, 전망용 요소(경계 세로선·연도 눈금·고위~저위 띠·누적 막대)는 이 시안이 처음 정한다(design-system.md 15절).
 *   - 격차 슬라이드(#5)의 주 그래프는 마지막 해 두 구간 막대(R-476 마스터 권고). 2011~2024 두 계열은 sr-only 표에 전부 담고, 「모든 해에 66세 이상이 더 크다」 판정은 여기서 계산한다(깨지면 생성기가 멈춘다).
 *   - `src/`는 읽기만 한다.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const HTML_PATH = ROOT + 'docs/design/mockups/title-005.html';
const stats = JSON.parse(readFileSync(ROOT + 'src/data/koreaStats.json', 'utf8'));
const UPDATED_ON = stats.meta.updatedOn;
const TOTAL = 20;

const byId = (id) => {
  const i = stats.indicators.find((x) => x.id === id);
  if (i === undefined) throw new Error(`koreaStats.json에 지표가 없다: ${id}`);
  return i;
};

// ---------- 문구 정본(copy.md 14절과 같은 글자) ----------
const PROJ_NOTE = '전망은 예측이 아니라 공식 추계입니다. 가정이 달라지면 값도 달라집니다.';
const COPY = {
  'elderly-poverty': { insight: '노년의 살림살이는 어떨까?', officialName: '66세 이상 상대적 빈곤율' },
  'income-gap-by-age': {
    insight: '나이들수록 또래들과 경제력 차이가 극심해져요',
    officialName: '연령계층별 소득 5분위배율',
    caption: '같은 나이대 안에서 소득 상위 20%가 하위 20%의 몇 배인지(균등화 처분가능소득)',
    // R-476 보조 줄 틀(합쇼체) — 구간 이름·연도는 데이터에서 채운다. (b) 「모든 해」 판정은 아래 gapBarSlide가 계산한다.
    sideAllYears: (y0, y1, main, extra) => `${y0}~${y1}년 모든 해에 ${main}의 격차가 ${extra}보다 큽니다.`,
    sideBands: (lo, hi) => `같은 나이대 안의 소득 격차는 ${lo}와 ${hi} 두 구간으로 공표됩니다. 더 잘게 나눈 나이 구간의 값은 없습니다.`,
  },
  'projection-population-total': { insight: '앞으로 인구는 어떻게 달라질까?', officialName: '장래인구추계 총인구', scenario: '중위 추계', actualWord: '확정' },
  'projection-aging-share': { insight: '앞으로 인구 가운데 어르신은 얼마나 될까?', officialName: '장래인구추계 65세 이상 인구 구성비', scenario: '중위 추계', actualWord: '확정' },
  'projection-one-person-households': { insight: '앞으로 혼자 사는 집은 얼마나 늘까?', officialName: '장래가구추계 1인 가구 비율', scenario: null, actualWord: '추계 앞 구간' },
  'heat-projection': { insight: '앞으로 폭염은 한 해에 며칠이나 될까?', officialName: '남한상세 기후변화 전망 폭염일수', scenario: '저탄소·고탄소', releasedOn: '2021-12-23', baseLabel: '2000~2019년' },
  'projection-newborn-age-structure': { insight: '지금 태어나는 아기라면?', officialName: '장래인구추계 인구 구조·부양비', scenario: '중위 추계' },
};

// ---------- 글자·숫자 도우미(구현과 같은 규칙) ----------
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
/** 숫자가 든 토막(「36,222,293명」「2000~2019년」「65세」)은 줄 중간에서 끊기지 않게 nowrap — 구현의 Glue가 맡는 자리(화면 글자에만, 속성에는 쓰지 않는다) */
const glue = (s) =>
  esc(s).replace(/[A-Za-z_]*\d[\w,.~%-]*(?:년|월|일|세|명|배|가구|분위)?/g, (m) => {
    const tail = /[.,]$/.exec(m)?.[0] ?? '';
    const core = tail ? m.slice(0, -1) : m;
    return `<span class="nowrap">${core}</span>${tail}`;
  });
function fmt(value, decimals) {
  const d = Math.max(0, Math.floor(decimals));
  const scaled = Math.round(Math.abs(value) * 10 ** d + 1e-9) / 10 ** d;
  const [int, frac] = scaled.toFixed(d).split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return (value < 0 && scaled !== 0 ? '-' : '') + (frac === undefined ? grouped : `${grouped}.${frac}`);
}
const withUnit = (v, unit, d) => `${fmt(v, d)}${unit}`;
/** 1천만 이상은 그래프 안에서만 만 단위로 줄여 적는다(값 줄·범례·대체 글은 원문 자릿수 그대로) — 3,622만 */
const manLabel = (v) => `${fmt(Math.round(v / 10000), 0)}만`;
function valueEm(text) {
  let em = 0;
  for (const ch of text) em += ch >= '0' && ch <= '9' ? 0.62 : ch === ',' || ch === '.' ? 0.32 : 1;
  return Math.round(em * 100) / 100;
}
/** 기관 나열(데이터 「A·B·C」)은 쉼표 나열(design-system.md 11-4 1항) */
const orgsText = (org) => org.split(/[·,/]/).map((x) => x.trim()).filter(Boolean).join(', ');
const round1 = (n) => Math.round(n * 10) / 10;
/** 계열 이름 「66세 이상(은퇴연령인구)」에서 괄호 앞 짧은 이름 「66세 이상」 — 막대 라벨·보조 줄용(긴 이름은 정의 줄·sr-only 표에) */
const shortLabel = (label) => label.replace(/\s*\(.*\)\s*$/, '');

// ---------- 선 그래프 좌표(구현 PAD 그대로) ----------
const W = 320;
const H = 232;
const PAD = { left: 8, right: 66, top: 24, bottom: 30 };
const LABEL_GAP = 13;
const CHART_FONT = 13;
const plotW = W - PAD.left - PAD.right;
const plotH = H - PAD.top - PAD.bottom;
const AXIS_Y = round1(PAD.top + plotH);
const GRID = [0, 0.5, 1].map((t) => round1(PAD.top + t * plotH));

function scaleOf(allPts) {
  const minYear = Math.min(...allPts.map((p) => p.year));
  const maxYear = Math.max(...allPts.map((p) => p.year));
  let lo = Math.min(...allPts.map((p) => p.value));
  let hi = Math.max(...allPts.map((p) => p.value));
  if (hi === lo) {
    lo -= 1;
    hi += 1;
  }
  const pad = (hi - lo) * 0.08;
  lo -= pad;
  hi += pad;
  return {
    minYear,
    maxYear,
    xOf: (year) => round1(PAD.left + ((year - minYear) / (maxYear - minYear)) * plotW),
    yOf: (value) => round1(PAD.top + (1 - (value - lo) / (hi - lo)) * plotH),
  };
}
/** 마지막 값 글자들이 세로로 겹치지 않게 벌린다(순서 유지) */
function spreadY(ys, gap, lo, hi) {
  const idx = ys.map((y, i) => [y, i]).sort((a, b) => a[0] - b[0]);
  const out = idx.map(([y]) => y);
  for (let k = 1; k < out.length; k++) if (out[k] - out[k - 1] < gap) out[k] = out[k - 1] + gap;
  for (let k = out.length - 1; k >= 0; k--) if (out[k] > hi) out[k] = hi;
  for (let k = 1; k < out.length; k++) if (out[k] - out[k - 1] < gap) out[k] = out[k - 1] + gap;
  for (let k = out.length - 1; k >= 1; k--) if (out[k] - out[k - 1] < gap) out[k - 1] = out[k] - gap;
  if (out[0] < lo) out[0] = lo;
  const res = new Array(ys.length);
  idx.forEach(([, i], k) => (res[i] = round1(out[k])));
  return res;
}
const marker = (shape, x, y, last) => {
  const cls = `dot${shape === 'solid' ? '' : ` dot--${shape}`}${last ? ' dot--last' : ''}`;
  const r = last ? 4.5 : 3;
  if (shape === 'dashed') return `<rect class="${cls}" x="${round1(x - r)}" y="${round1(y - r)}" width="${r * 2}" height="${r * 2}"/>`;
  return `<circle class="${cls}" cx="${x}" cy="${y}" r="${r}"/>`;
};
const text = (x, y, s, anchor = 'start', cls = '') => `<text${cls ? ` class="${cls}"` : ''} x="${x}" y="${y}" text-anchor="${anchor}">${esc(s)}</text>`;
const frame = () => GRID.map((y) => `<line class="grid" x1="${PAD.left}" x2="${W - PAD.right}" y1="${y}" y2="${y}"/>`).join('') + `<line class="axis" x1="${PAD.left}" x2="${W - PAD.right}" y1="${AXIS_Y}" y2="${AXIS_Y}"/>`;
const svgOpen = (h, label) => `<svg class="chart" viewBox="0 0 ${W} ${h}" role="img" aria-label="${esc(label)}" focusable="false">`;
const swatchLine = (cls) => `<svg viewBox="0 0 28 10" aria-hidden="true" focusable="false"><line class="swatch-line${cls ? ` ${cls}` : ''}" x1="1" x2="27" y1="5" y2="5"/></svg>`;
const swatchRect = (cls) => `<svg viewBox="0 0 28 10" aria-hidden="true" focusable="false"><rect class="${cls}" x="1" y="1" width="26" height="8" rx="1"/></svg>`;
const legendUl = (items, name = '그래프 범례와 최근 값') => `<ul class="legend" aria-label="${name}">${items.map((i) => `<li>${i.swatch}<span>${glue(i.label)}${i.value !== undefined ? ` <strong>${esc(i.value)}</strong>` : ''}</span></li>`).join('')}</ul>`;

/** 선분이 직사각형(여백 포함)과 만나는가 — Liang–Barsky 자르기 */
function segHitsRect(a, b, r) {
  let t0 = 0;
  let t1 = 1;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  for (const [p, q] of [[-dx, a.x - r.x0], [dx, r.x1 - a.x], [-dy, a.y - r.y0], [dy, r.y1 - a.y]]) {
    if (p === 0) {
      if (q < 0) return false;
      continue;
    }
    const t = q / p;
    if (p < 0) t0 = Math.max(t0, t);
    else t1 = Math.min(t1, t);
    if (t0 > t1) return false;
  }
  return true;
}
/**
 * 첫 값 글자 자리(구현 placeFirstLabels의 규칙 — design-system.md 15-2, R-487):
 * 후보를 차례로 두고 글자 상자(13px 글자 폭·높이 10, 여백 2)가 어느 계열의 선분과도 만나지 않는 첫 자리를 고른다.
 *   ① 점 위(x, y−8) ② 점 아래(x, y+18) ③ 축 바로 위 오른쪽(x+12, 축−4 — 축 가까이에서 오르는 선의 아래쪽 빈 삼각형)
 *   ④ 위 눈금 아래 오른쪽(x+12, 위+12 — 위쪽에서 내려오는 선의 위쪽 빈 삼각형). 모두 만나면 ①.
 * 상자는 그림 영역 안(위 PAD.top+2 ~ 축−2)에만 둔다(연도 글자·경계 글자와 겹치지 않는다).
 */
function firstLabel(pts, allSeries, cls = '') {
  const p = pts[0];
  const w = valueEm(p.text) * CHART_FONT;
  const cands = [
    [p.x, p.y - 8],
    [p.x, p.y + 18],
    [p.x + 12, AXIS_Y - 4],
    [p.x + 12, PAD.top + 12],
  ];
  const segs = allSeries.flatMap((s) => s.slice(1).map((q, k) => [s[k], q]));
  for (const [x, y] of cands) {
    const box = { x0: x - 2, x1: x + w + 2, y0: y - 10 - 2, y1: y + 2 };
    if (box.y0 < PAD.top + 2 || box.y1 > AXIS_Y - 2) continue;
    if (segs.some(([a, b]) => segHitsRect(a, b, box))) continue;
    return text(x, round1(y), p.text, 'start', cls);
  }
  return text(p.x, round1(p.y - 8), p.text, 'start', cls);
}

// ---------- 공통 슬라이드 틀 ----------
function slideHtml(o) {
  const n = o.index;
  const label = o.proj ? `${n}/${TOTAL} 전망, ${o.insight}, ${o.officialText}` : `${n}/${TOTAL} ${o.insight}, ${o.officialText}`;
  const chips = o.proj ? `<p class="slide__chips"><span class="chip chip--proj"><svg class="icon" aria-hidden="true" focusable="false"><use href="#i-proj"/></svg>전망</span></p>` : '';
  const values = o.values.length > 1
    ? `<p class="slide__value slide__value--multi" style="--value-em:${Math.max(...o.values.map((v) => valueEm(v.value)))};--unit-chars:${Math.max(o.unit.length, 1)}">${o.values.map((v) => `<span class="slide__hv"><small class="slide__label">${glue(v.label)}</small><span class="slide__num"><span>${esc(v.value)}</span><small class="slide__unit">${esc(o.unit)}</small></span></span>`).join('')}</p>`
    : `<p class="slide__value" style="--value-em:${valueEm(o.values[0].value)};--unit-chars:${Math.max(o.unit.length, 1)}"><span>${esc(o.values[0].value)}</span><small class="slide__unit">${esc(o.unit)}</small></p>`;
  return [
    `    <article class="slide${o.proj ? ' slide--proj' : ''}" data-slide-id="${o.id}" aria-roledescription="슬라이드" aria-label="${esc(label)}">`,
    `      ${chips}<h3 class="slide__insight">${esc(o.insight)}</h3>`,
    `      <p class="slide__official">${glue(o.officialText)}</p>`,
    o.caption ? `      <p class="slide__caption">${glue(o.caption)}</p>` : null,
    `      ${values}`,
    ...(o.sides ?? []).map((s) => `      <p class="slide__side">${typeof s === 'string' ? glue(s) : s.html}</p>`),
    `      ${o.chart}`,
    o.table ?? null,
    o.legend ?? null,
    `      <p class="t-sm t-muted">${glue(o.definition)}</p>`,
    o.proj ? `      <p class="slide__projnote">${esc(PROJ_NOTE)}</p>` : null,
    `      <p class="slide__meta">출처: ${glue(o.source)}</p>`,
    `      <p class="slide__meta"><span class="pair pair--meta"><span class="pair__item">${glue(o.basis)}</span> <span class="pair__sep">· </span><span class="pair__item">마지막 갱신 <span class="nowrap">${esc(UPDATED_ON)}</span></span></span></p>`,
    `    </article>`,
  ].filter((l) => l !== null).join('\n');
}
/** 출처 줄: 기관 묶음(쉼표 나열) + 「의」 + 표 이름 — 쉼표만 쓰면 「KOSIS …」가 넷째 기관처럼 읽힌다(R-487) */
const sourceOf = (ind) => `${orgsText(ind.source.org)}의 ${ind.source.table} (${ind.source.accessedOn} 조회)`;
const yearPts = (series) => series.filter((p) => Number.isInteger(p.year) && Number.isFinite(p.value)).sort((a, b) => a.year - b.year);

// ---------- (A) 보통 선 그래프: elderly-poverty (구현 buildLineChart와 같은 모양) ----------
function plainLineSlide(ind, index, extra) {
  const c = COPY[ind.id];
  const unit = ind.unit ?? ind.latestUnit;
  const defs = [{ key: 'main', label: ind.seriesLabel ?? ind.title, pts: yearPts(ind.series), dash: 'solid' }];
  for (const [n, e] of (ind.extraSeries ?? []).entries()) defs.push({ key: `extra-${n}`, label: e.label, pts: yearPts(e.series), dash: 'dashed' });
  const sc = scaleOf(defs.flatMap((d) => d.pts));
  const series = defs.map((d) => ({ ...d, pts: d.pts.map((p) => ({ ...p, x: sc.xOf(p.year), y: sc.yOf(p.value), text: fmt(p.value, ind.decimals) })) }));
  const lastYs = spreadY(series.map((s) => s.pts[s.pts.length - 1].y + 4), LABEL_GAP, PAD.top, H - PAD.bottom);
  let body = frame();
  for (const s of series) {
    const cls = `line${s.dash === 'solid' ? '' : ` line--${s.dash}`}`;
    body += `<g data-series="${s.key}"><polyline class="${cls}" points="${s.pts.map((p) => `${p.x},${p.y}`).join(' ')}"/>${s.pts.map((p, k) => marker(s.dash, p.x, p.y, k === s.pts.length - 1)).join('')}</g>`;
  }
  body += text(sc.xOf(sc.minYear), H - 8, String(sc.minYear)) + text(sc.xOf(sc.maxYear), H - 8, String(sc.maxYear), 'end');
  const allPts = series.map((s) => s.pts);
  series.forEach((s, n) => {
    const last = s.pts[s.pts.length - 1];
    body += text(last.x + 8, lastYs[n], last.text, 'start', 'val') + firstLabel(s.pts, allPts);
  });
  const parts = series.map((s) => `${s.label} 처음 ${withUnit(s.pts[0].value, unit, ind.decimals)}(${s.pts[0].year}년), 마지막 ${withUnit(s.pts[s.pts.length - 1].value, unit, ind.decimals)}(${s.pts[s.pts.length - 1].year}년)`);
  const chartLabel = `${sc.minYear}년부터 ${sc.maxYear}년까지 ${ind.title} 추이 그래프. ${parts.join('. ')}`;
  const legend = legendUl(series.map((s) => ({ swatch: swatchLine(s.dash === 'solid' ? '' : `swatch-line--${s.dash}`), label: s.label, value: withUnit(s.pts[s.pts.length - 1].value, unit, ind.decimals) })));
  return {
    html: slideHtml({
      id: ind.id,
      index,
      proj: false,
      insight: c.insight,
      officialText: `${c.officialName}(${ind.latest.year}년)`,
      caption: extra?.caption ?? null,
      values: extra?.values ?? [{ value: fmt(ind.latest.value, ind.decimals) }],
      unit: ind.latestUnit,
      sides: extra?.sides ?? [],
      chart: svgOpen(H, chartLabel) + body + '</svg>',
      legend: `      ${legend}`,
      definition: ind.definition,
      source: sourceOf(ind),
      basis: `통계 기준: ${ind.latest.year}년`,
    }),
    log: [`${ind.id}: 큰 값 ${extra?.values ? extra.values.map((v) => `${v.label} ${v.value}${ind.latestUnit}`).join(' · ') : withUnit(ind.latest.value, ind.latestUnit, ind.decimals)}(${ind.latest.year}) · ${parts.join(' · ')}`],
  };
}

// ---------- (A′) 격차 슬라이드 income-gap-by-age: 마지막 해 두 구간 막대 + 보조 줄 둘 + 2011~2024 sr-only 표 (R-476, 마스터 권고) ----------
function gapBarSlide(ind, index) {
  const c = COPY[ind.id];
  const d = ind.decimals;
  const unit = ind.unit ?? ind.latestUnit;
  const main = { label: ind.seriesLabel, pts: yearPts(ind.series) };
  const extra = { label: ind.extraSeries[0].label, pts: yearPts(ind.extraSeries[0].series) };
  const lastM = main.pts[main.pts.length - 1];
  const lastE = extra.pts[extra.pts.length - 1];
  if (lastM.year !== lastE.year) throw new Error(`${ind.id}: 두 계열의 마지막 해가 다르다(${lastM.year} ≠ ${lastE.year})`);
  // (b) 「모든 해」 판정 — 두 계열이 함께 있는 해마다 본 계열 > 보조 계열. 깨지면 보조 줄 문장이 거짓이 되므로 멈춘다.
  const byYear = new Map(extra.pts.map((p) => [p.year, p.value]));
  const paired = main.pts.filter((p) => byYear.has(p.year));
  const failing = paired.filter((p) => !(p.value > byYear.get(p.year)));
  if (paired.length < 2 || failing.length > 0) throw new Error(`${ind.id}: 「모든 해에 ${shortLabel(main.label)}이 더 크다」가 성립하지 않는다 — ${failing.map((p) => p.year).join(', ') || '겹치는 해 부족'}`);
  const y0 = paired[0].year;
  const y1 = paired[paired.length - 1].year;
  // 막대(폭염 막대와 같은 행 높이 26) — 두 구간 같은 채움(한 측정값·두 범주, 라벨 글자가 구분한다). 위 오른쪽 「{마지막 해}년」.
  const bars = [
    { label: shortLabel(main.label), value: lastM.value },
    { label: shortLabel(extra.label), value: lastE.value },
  ];
  const rowH = 26;
  const top = 22;
  const labelX = 70;
  const barX = 78;
  const maxBar = 176;
  const max = Math.max(...bars.map((b) => b.value));
  const h = top + bars.length * rowH + 4;
  let body = text(W - 2, 14, `${lastM.year}년`, 'end', 'split-label');
  bars.forEach((b, k) => {
    const y = top + k * rowH + 4;
    const w = round1((b.value / max) * maxBar);
    body += `<g><text class="bar-label" x="${labelX}" y="${y + 13}">${esc(b.label)}</text><rect class="chart-bar" x="${barX}" y="${y}" width="${w}" height="18" rx="2"/><text class="bar-value val" x="${round1(barX + w + 6)}" y="${y + 13}">${esc(withUnit(b.value, unit, d))}</text></g>`;
  });
  const chartLabel = `${lastM.year}년 ${ind.title} 막대 그래프. ${main.label} ${withUnit(lastM.value, unit, d)}, ${extra.label} ${withUnit(lastE.value, unit, d)}. ${y0}~${y1}년 값은 아래 표`;
  const table = `      <div class="sr-only"><table><caption>${esc(ind.title)} — ${y0}~${y1}년</caption><thead><tr><th scope="col">연도</th><th scope="col">${esc(main.label)}</th><th scope="col">${esc(extra.label)}</th></tr></thead><tbody>${paired.map((p) => `<tr><th scope="row">${p.year}년</th><td>${withUnit(p.value, unit, d)}</td><td>${withUnit(byYear.get(p.year), unit, d)}</td></tr>`).join('')}</tbody></table></div>`;
  const sides = [c.sideAllYears(y0, y1, shortLabel(main.label), shortLabel(extra.label)), c.sideBands(shortLabel(extra.label), shortLabel(main.label))];
  return {
    html: slideHtml({
      id: ind.id,
      index,
      proj: false,
      insight: c.insight,
      officialText: `${c.officialName}(${ind.latest.year}년)`,
      caption: c.caption,
      values: [
        { label: shortLabel(main.label), value: fmt(lastM.value, d) },
        { label: shortLabel(extra.label), value: fmt(lastE.value, d) },
      ],
      unit: ind.latestUnit,
      sides,
      chart: svgOpen(h, chartLabel) + body + '</svg>',
      table,
      definition: ind.definition,
      source: sourceOf(ind),
      basis: `통계 기준: ${ind.latest.year}년`,
    }),
    log: [`${ind.id}: 큰 값 ${shortLabel(main.label)} ${withUnit(lastM.value, unit, d)} · ${shortLabel(extra.label)} ${withUnit(lastE.value, unit, d)}(${lastM.year}) · 모든 해 판정 ${y0}~${y1} ${paired.length}개 해 통과(처음 ${withUnit(paired[0].value, unit, d)}/${withUnit(byYear.get(y0), unit, d)}) · 보조 줄: 「${sides[0]}」「${sides[1]}」`],
  };
}

// ---------- (B) 전망 선 그래프: 확정/앞선 구간 실선 → 경계 세로선 + 연도 눈금 → 중위 긴 점선 + 고위~저위 띠 ----------
/** 데이터 `official` 「고위 추계(최대인구 추계: …)」에서 뜻 낱말 「최대인구」 — 고위가 띠 아래에 오는 #17을 설명한다(R-483 a). 없으면 빈 글자 */
const meaningOf = (scenario) => /\((최대인구|최소인구) 추계/.exec(scenario.official ?? '')?.[1] ?? '';
const withMeaning = (scenario) => (meaningOf(scenario) ? `${scenario.label}(${meaningOf(scenario)})` : scenario.label);
function projectionLineSlide(ind, index) {
  const c = COPY[ind.id];
  const unit = ind.unit ?? ind.latestUnit;
  const d = ind.decimals;
  const p = ind.projection;
  const actual = yearPts(ind.actual);
  const scen = Object.fromEntries(p.scenarios.map((s) => [s.key, { ...s, pts: yearPts(s.series) }]));
  const mid = scen[p.defaultScenario];
  const high = scen.high;
  const low = scen.low;
  const all = [...actual, ...p.scenarios.flatMap((s) => yearPts(s.series))];
  const sc = scaleOf(all);
  const xy = (pts) => pts.map((q) => ({ ...q, x: sc.xOf(q.year), y: sc.yOf(q.value) }));
  const A = xy(actual);
  const M = xy(mid.pts);
  const lastA = A[A.length - 1];
  const lastM = M[M.length - 1];
  const big = (v) => (Math.abs(v) >= 1e7 ? manLabel(v) : fmt(v, d));
  const splitX = sc.xOf(p.actualThrough);
  let body = frame();
  // 고위~저위 띠(옅은 면 + 가는 점선 가장자리 + 끝 글자 「고위」「저위」) — 색에만 기대지 않는다
  let rangeLabels = [];
  let Hp = [];
  let Lp = [];
  if (high !== undefined && low !== undefined) {
    Hp = xy(high.pts);
    Lp = xy(low.pts);
    body += `<path class="band" d="M${Hp.map((q) => `${q.x},${q.y}`).join('L')}L${[...Lp].reverse().map((q) => `${q.x},${q.y}`).join('L')}Z"/>`;
    body += `<polyline class="line--range" points="${Hp.map((q) => `${q.x},${q.y}`).join(' ')}"/><polyline class="line--range" points="${Lp.map((q) => `${q.x},${q.y}`).join(' ')}"/>`;
    rangeLabels = [
      { y: Hp[Hp.length - 1].y + 4, text: '고위', cls: 'range-label' },
      { y: Lp[Lp.length - 1].y + 4, text: '저위', cls: 'range-label' },
    ];
  }
  // 확정(앞선) 구간 실선 → 경계점에서 중위 긴 점선
  body += `<g data-series="actual"><polyline class="line" points="${A.map((q) => `${q.x},${q.y}`).join(' ')}"/></g>`;
  const projPts = lastA.year < M[0].year ? [lastA, ...M] : M; // 가구추계: 2021 → 2022 사이도 점선
  body += `<g data-series="projection"><polyline class="line line--proj" points="${projPts.map((q) => `${q.x},${q.y}`).join(' ')}"/><circle class="dot dot--last dot--proj" cx="${lastM.x}" cy="${lastM.y}" r="4.5"/></g>`;
  // 경계: 세로 점선 + 위쪽 글자 「확정 | 전망」(가구추계 「추계 앞 구간 | 전망」) + 축 아래 연도 눈금(경계 연도 라벨)
  body += `<line class="split" x1="${splitX}" x2="${splitX}" y1="18" y2="${AXIS_Y}"/>`;
  body += text(splitX - 4, 16, c.actualWord, 'end', 'split-label') + text(splitX + 4, 16, '전망', 'start', 'split-label');
  body += `<line class="tick" x1="${splitX}" x2="${splitX}" y1="${AXIS_Y}" y2="${AXIS_Y + 5}"/>`;
  body += text(sc.xOf(sc.minYear), H - 8, String(sc.minYear)) + text(splitX, H - 8, String(p.actualThrough), 'middle') + text(sc.xOf(sc.maxYear), H - 8, String(sc.maxYear), 'end');
  // 값 글자: 처음(확정 첫 해 — 선과 겹치지 않는 후보 자리, R-487) · 마지막(중위 끝) 굵게 · 띠 끝 「고위」「저위」 — 세로로 겹치지 않게 벌린다
  const endLabels = [{ y: lastM.y + 4, text: big(lastM.value), cls: 'val' }, ...rangeLabels];
  const ys = spreadY(endLabels.map((l) => l.y), LABEL_GAP, PAD.top, H - PAD.bottom);
  endLabels.forEach((l, k) => (body += text(lastM.x + 8, ys[k], l.text, 'start', l.cls)));
  const firstPts = A.map((q) => ({ ...q, text: big(q.value) }));
  body += firstLabel(firstPts, [A, projPts, Hp, Lp].filter((s) => s.length > 1));
  const scenNote = mid.level === 'single' ? '' : `(${mid.label.replace(' 추계', '')})`;
  const legend = legendUl([
    { swatch: swatchLine(''), label: `${c.actualWord} ${actual[0].year}~${p.actualThrough}`, value: withUnit(lastA.value, unit, d) },
    { swatch: swatchLine('swatch-line--proj'), label: `전망 ${M[0].year === p.actualThrough ? p.actualThrough + 1 : M[0].year}~${p.horizon}${scenNote}`, value: withUnit(lastM.value, unit, d) },
    ...(high !== undefined ? [{ swatch: swatchRect('swatch-rect--band'), label: `고위${meaningOf(high) ? `(${meaningOf(high)})` : ''}~저위${meaningOf(low) ? `(${meaningOf(low)})` : ''} 추계 범위` }] : []),
  ]);
  const hv = high !== undefined ? withUnit(high.pts[high.pts.length - 1].value, unit, d) : '';
  const lv = low !== undefined ? withUnit(low.pts[low.pts.length - 1].value, unit, d) : '';
  const rangeText = high !== undefined ? `(고위 ${meaningOf(high) ? `${meaningOf(high)} 추계 ` : ''}${hv}, 저위 ${meaningOf(low) ? `${meaningOf(low)} 추계 ` : ''}${lv})` : '';
  const actualWordText = c.actualWord === '확정' ? '확정인구(실선)' : '같은 표의 추계 앞 구간(실선)';
  const chartLabel = `${actual[0].year}년부터 ${p.horizon}년까지 ${c.officialName} 그래프. ${actual[0].year}~${p.actualThrough}년은 ${actualWordText}, ${p.actualThrough + 1}~${p.horizon}년은 전망(점선${high !== undefined ? ', 고위~저위 범위는 띠' : ''}). ${actual[0].year}년 ${withUnit(actual[0].value, unit, d)}, ${p.actualThrough}년 ${withUnit(lastA.value, unit, d)}, ${p.horizon}년 ${mid.level === 'single' ? '' : '중위 '}${withUnit(lastM.value, unit, d)}${rangeText}`;
  const sides = [];
  // 쉼표 나열(11-4: 데이터로 채우는 나열) — 「·」 짝으로 두면 좁은 칸에서 기호가 줄 끝에 남거나 둘째 항목이 중간에서 갈린다(새 .pair 문턱을 재는 대신 문장으로).
  // 「고위 추계(최대인구) {값}」「저위 추계(최소인구) {값}」은 각각 keep-phrase(관형사 묶음, 11-4)로 묶어 「저위 / 추계 …」처럼 낱말 사이에서 갈리지 않게 한다(360 시안 측정).
  // 괄호의 「최대인구」「최소인구」는 데이터 `official`의 낱말 — 고위(최대인구)가 65세 이상 구성비에서는 아래에 오는 이유가 읽힌다(R-483 a).
  if (high !== undefined) {
    sides.push({ html: `<span class="nowrap">${p.horizon}년</span> <span class="keep-phrase">${glue(withMeaning(high))} <span class="nowrap">${esc(hv)}</span></span>, <span class="keep-phrase">${glue(withMeaning(low))} <span class="nowrap">${esc(lv)}</span></span>` });
  } else {
    // 시나리오가 하나(가구추계)면 고위·저위 줄 대신 앞 구간의 출발값·경계값 — 1280 스크롤 0에서 출발값이 보인다(R-483 b, 「실측」 낱말 없음 — 결정 3)
    sides.push(`${c.actualWord} ${actual[0].year}년 ${withUnit(actual[0].value, unit, d)}, ${p.actualThrough}년 ${withUnit(lastA.value, unit, d)}`);
  }
  if (ind.id === 'projection-aging-share') {
    const r = ind.related.find((x) => x.key === 'population65plus');
    const rl = yearPts(r.scenarios.find((s) => s.key === 'median').series).slice(-1)[0];
    sides.push(`65세 이상 인구는 ${rl.year}년 ${withUnit(rl.value, r.unit, r.decimals)}(중위 추계)`);
  }
  const released = p.releasedOn;
  const official = `${c.officialName}(${released.slice(0, 4)}년 발표, ${p.baseYear}년 기준${c.scenario ? `, ${c.scenario}` : ''})`;
  return {
    html: slideHtml({
      id: ind.id,
      index,
      proj: true,
      insight: c.insight,
      officialText: official,
      caption: ind.latestLabel,
      values: [{ value: fmt(ind.latest.value, d) }],
      unit: ind.latestUnit,
      sides,
      chart: svgOpen(H, chartLabel) + body + '</svg>',
      legend: `      ${legend}`,
      definition: ind.definition,
      source: sourceOf(ind),
      basis: `발표: ${released}`,
    }),
    log: [`${ind.id}: 큰 값 ${withUnit(ind.latest.value, ind.latestUnit, d)}(${ind.latest.year}, ${mid.label}) · ${c.actualWord} ${actual[0].year}~${p.actualThrough} 끝 ${withUnit(lastA.value, unit, d)} · 전망 끝 ${withUnit(lastM.value, unit, d)}${rangeText} · 경계 x=${splitX} · 보조 줄 ${sides.length}개`],
  };
}

// ---------- (C) 폭염일수: 기존 표 지표 → 수도권 막대 셋(현재 실선 막대 · 전망 빗금) + 권역 6곳 표(sr-only) ----------
function heatSlide(ind, index) {
  const c = COPY[ind.id];
  const col = Object.fromEntries(ind.columns.map((k) => [k.key, k]));
  const region = ind.rows.find((r) => ind.latestLabel.startsWith(r.label)) ?? ind.rows[0];
  // 열 이름 「21세기 후반기(2081~2100년) …」 → 캡션에는 안쪽 괄호를 풀어 「21세기 후반기 2081~2100년」(데이터 latestLabel과 같은 꼴 — 괄호 겹침 없음, R-487)
  const pm = /(21세기 후반기)\((\d{4}~\d{4}년)\)/.exec(col.lateLow.label);
  const period = `${pm[1]} ${pm[2]}`;
  const scenarioOf = (k) => /(저탄소|고탄소) 시나리오 (SSP[\d.-]+)/.exec(col[k].label);
  const bars = [
    { label: `현재 ${/\((\d{4}~\d{4}년)\)/.exec(col.present.label)[1]}`, value: region.present, proj: false },
    { label: `${scenarioOf('lateLow')[1]} ${scenarioOf('lateLow')[2]}`, value: region.lateLow, proj: true },
    { label: `${scenarioOf('lateHigh')[1]} ${scenarioOf('lateHigh')[2]}`, value: region.lateHigh, proj: true },
  ];
  const d = ind.decimals;
  const rowH = 26;
  const labelX = 122;
  const barX = 128;
  const maxBar = 144;
  const max = Math.max(...bars.map((b) => b.value));
  const h = bars.length * rowH + 8;
  let body = '';
  bars.forEach((b, k) => {
    const y = k * rowH + 10;
    const w = round1((b.value / max) * maxBar);
    body += `<g><text class="bar-label" x="${labelX}" y="${y + 11}">${esc(b.label)}</text><rect class="chart-bar${b.proj ? ' chart-bar--proj' : ''}" x="${barX}" y="${y}" width="${w}" height="14" rx="2"/><text class="bar-value" x="${round1(barX + w + 4)}" y="${y + 11}">${esc(withUnit(b.value, '일', d))}</text></g>`;
  });
  const chartLabel = `${region.label} 연 폭염일수 막대 그래프. ${bars.map((b) => `${b.label} ${withUnit(b.value, '일', d)}`).join(', ')}(빗금은 전망). 권역 6곳의 값은 아래 표`;
  const table = `      <div class="sr-only"><table><caption>${esc(ind.title)} — 권역별</caption><thead><tr>${ind.columns.map((k) => `<th scope="col">${esc(k.label)}</th>`).join('')}</tr></thead><tbody>${ind.rows.map((r) => `<tr><th scope="row">${esc(r.label)}</th><td>${withUnit(r.present, '일', d)}</td><td>${withUnit(r.lateLow, '일', d)}</td><td>${withUnit(r.lateHigh, '일', d)}</td></tr>`).join('')}</tbody></table></div>`;
  const legend = legendUl([{ swatch: swatchRect('swatch-rect--bar'), label: '현재' }, { swatch: swatchRect('swatch-rect--proj'), label: '전망(빗금)' }], '막대 범례');
  const official = `${c.officialName}(${c.releasedOn.slice(0, 4)}년 발표, ${c.baseLabel} 기준, ${c.scenario})`;
  return {
    html: slideHtml({
      id: ind.id,
      index,
      proj: true,
      insight: c.insight,
      officialText: official,
      caption: `${region.label} 연 폭염일수(${period} 평균)`,
      values: [
        { label: `${scenarioOf('lateLow')[1]} 시나리오`, value: fmt(region.lateLow, d) },
        { label: `${scenarioOf('lateHigh')[1]} 시나리오`, value: fmt(region.lateHigh, d) },
      ],
      unit: '일',
      sides: [`현재(${/\((\d{4}~\d{4}년)\)/.exec(col.present.label)[1]})는 ${withUnit(region.present, '일', d)}`],
      chart: svgOpen(h, chartLabel) + body + '</svg>',
      table,
      legend: `      ${legend}`,
      definition: ind.definition,
      source: sourceOf(ind),
      basis: `발표: ${c.releasedOn}`,
    }),
    log: [`${ind.id}: ${region.label} 현재 ${region.present}일 · 저탄소 ${region.lateLow}일 · 고탄소 ${region.lateHigh}일(${period}) · 표 ${ind.rows.length}권역`],
  };
}

// ---------- (D) 지금 태어나는 아기라면? — 0·10·20·30·40세가 되는 해의 연령 3구간 누적 막대(중위) ----------
/**
 * 캡션 = 데이터 `latestLabel`. 지금 글자 「2056년(2026년에 태어난 아기가 30세가 되는 해) 65세 이상 인구 구성비(중위 추계)」는 괄호 묶음이 둘이라(R-487)
 * 「2026년에 태어난 아기가 30세가 되는 2056년, 65세 이상 인구 구성비(중위 추계)」로 고쳐 적는 것을 제안한다(diff-005.md D5-74 — 데이터 글자 정정, 값 불변).
 * 데이터가 아직 옛 꼴이면 같은 낱말을 그 꼴로 다시 늘어놓고(새 낱말 0), 이미 고쳐졌으면 그대로 쓴다.
 */
function newbornCaption(latestLabel) {
  const m = /^(\d{4}년)\((\d{4}년에 태어난 아기가 \d+세가 되는) 해\) (.+)$/.exec(latestLabel);
  return m ? `${m[2]} ${m[1]}, ${m[3]}` : latestLabel;
}
function newbornSlide(ind, index) {
  const c = COPY[ind.id];
  const p = ind.projection;
  const mid = p.scenarios.find((s) => s.key === p.defaultScenario);
  const rows = [...mid.rows].sort((a, b) => a.age - b.age);
  const d = ind.decimals;
  const rowH = 26;
  const top = 22;
  const labelX = 62;
  const barX = 70;
  const barW = 192;
  const h = top + rows.length * rowH + 4;
  let body = text(W - 2, 14, `모두 전망(${mid.label})`, 'end', 'split-label');
  rows.forEach((r, k) => {
    const y = top + k * rowH;
    const wY = round1((r.share0to14 / 100) * barW);
    const wW = round1((r.share15to64 / 100) * barW);
    const wO = round1(barW - wY - wW);
    body += `<g data-row="${r.year}"><text class="bar-label row-label" x="${labelX}" y="${y + 17}"><tspan class="val">${r.age}세</tspan> ${r.year}</text>`;
    body += `<rect class="chart-seg chart-seg--young" x="${barX}" y="${y + 4}" width="${wY}" height="18"/>`;
    body += `<rect class="chart-seg chart-seg--work" x="${round1(barX + wY)}" y="${y + 4}" width="${wW}" height="18"/>`;
    body += `<text class="seg-text" x="${round1(barX + wY + wW / 2)}" y="${y + 17}" text-anchor="middle">${fmt(r.share15to64, d)}%</text>`;
    // 65세 이상 칸 = 점무늬(#dots, 중립 잉크색) — 놋쇠 빗금 #hatch는 「전망」 전용이라 쓰지 않는다(R-477)
    body += `<rect class="chart-seg chart-seg--old" x="${round1(barX + wY + wW)}" y="${y + 4}" width="${wO}" height="18"/>`;
    body += `<text class="bar-value val" x="${barX + barW + 6}" y="${y + 17}">${fmt(r.share65plus, d)}%</text></g>`;
  });
  const birthYear = ind.cohort?.birthYear ?? rows.find((r) => r.age === 0)?.year;
  const chartLabel = `${birthYear}년에 태어난 아기가 ${rows.map((r) => r.age).join('·')}세가 되는 해의 연령 3구간 인구 구성비 누적 막대 그래프(${mid.label}). ${rows.map((r) => `${r.year}년(${r.age}세) 0~14세 ${fmt(r.share0to14, d)}%, 15~64세 ${fmt(r.share15to64, d)}%, 65세 이상 ${fmt(r.share65plus, d)}%, 총부양비 ${fmt(r.totalDependency, d)}`).join('. ')}`;
  const table = `      <div class="sr-only"><table><caption>${esc(ind.title)} — 연령 3구간 구성비와 부양비(${esc(mid.label)})</caption><thead><tr><th scope="col">나이(연도)</th><th scope="col">0~14세</th><th scope="col">15~64세</th><th scope="col">65세 이상</th><th scope="col">총부양비</th></tr></thead><tbody>${rows.map((r) => `<tr><th scope="row">${r.age}세(${r.year}년)</th><td>${fmt(r.share0to14, d)}%</td><td>${fmt(r.share15to64, d)}%</td><td>${fmt(r.share65plus, d)}%</td><td>${fmt(r.totalDependency, d)}</td></tr>`).join('')}</tbody></table></div>`;
  const legend = legendUl([{ swatch: swatchRect('swatch-rect--young'), label: '0~14세' }, { swatch: swatchRect('swatch-rect--work'), label: '15~64세' }, { swatch: swatchRect('swatch-rect--old'), label: '65세 이상(점무늬)' }], '막대 범례');
  const r0 = rows[0];
  const r30 = rows.find((r) => r.age === 30);
  const official = `${c.officialName}(${p.releasedOn.slice(0, 4)}년 발표, ${p.baseYear}년 기준, ${c.scenario})`;
  return {
    html: slideHtml({
      id: ind.id,
      index,
      proj: true,
      insight: c.insight,
      officialText: official,
      caption: newbornCaption(ind.latestLabel),
      values: [{ value: fmt(ind.latest.value, d) }],
      unit: ind.latestUnit,
      sides: [`15~64세 100명당 0~14세와 65세 이상 인구(총부양비): ${r0.year}년 ${fmt(r0.totalDependency, d)}명, ${r30.year}년 ${fmt(r30.totalDependency, d)}명`],
      chart: svgOpen(h, chartLabel) + body + '</svg>',
      table,
      legend: `      ${legend}`,
      definition: ind.definition,
      source: sourceOf(ind),
      basis: `발표: ${p.releasedOn}`,
    }),
    log: [`${ind.id}: 큰 값 ${fmt(ind.latest.value, d)}%(${ind.latest.year}, 30세) · 캡션 「${newbornCaption(ind.latestLabel)}」 · 행 ${rows.map((r) => `${r.age}세 ${r.year} ${r.share0to14}/${r.share15to64}/${r.share65plus} 부양비 ${r.totalDependency}`).join(' | ')}`],
  };
}

// ---------- 조립 ----------
const gap = [plainLineSlide(byId('elderly-poverty'), 4), gapBarSlide(byId('income-gap-by-age'), 5)];
const proj = [
  projectionLineSlide(byId('projection-population-total'), 16),
  projectionLineSlide(byId('projection-aging-share'), 17),
  projectionLineSlide(byId('projection-one-person-households'), 18),
  heatSlide(byId('heat-projection'), 19),
  newbornSlide(byId('projection-newborn-age-structure'), 20),
];

let html = readFileSync(HTML_PATH, 'utf8');
// 출처 줄 「{기관}의 {표}」(R-487): 손 시안 13장의 「출처: {기관}, {표}」도 같은 꼴로 — 생성 블록을 넣기 전에 돌리고, 기관 자리(첫 쉼표 앞)에 「의 」가 이미 있으면 건너뛴다(두 번 실행해도 같다).
// 손 시안은 기관이 하나뿐이라 첫 쉼표가 기관의 끝이다(기관 둘 이상인 생성 슬라이드는 sourceOf가 직접 쓴다).
let srcFixed = 0;
const genRanges = ['gap', 'proj'].map((tag) => [html.indexOf(`<!-- QI4:${tag}:begin -->`), html.indexOf(`<!-- QI4:${tag}:end -->`)]).filter(([b]) => b >= 0);
html = html.replace(/<p class="slide__meta">출처: [\s\S]*?<\/p>/g, (para, offset) => {
  if (genRanges.some(([b, e]) => offset > b && offset < e)) return para; // 생성 블록(곧 다시 그린다)은 건너뛴다
  const head = para.slice('<p class="slide__meta">출처: '.length);
  const plainHead = head.slice(0, head.includes('<') ? head.indexOf('<') : undefined);
  if (plainHead.includes('의 ')) return para; // 이미 「{기관}의 」 꼴
  // 기관이 「A·B」로 묶인 손 시안(사교육비 — keep-phrase 묶음 안에 쉼표)은 쉼표 나열(11-4 1항) + 「의」
  const kp = /^(<p class="slide__meta">출처: )<span class="keep-phrase">([^<]*?),<\/span> /.exec(para);
  if (kp !== null) {
    srcFixed++;
    return `${kp[1]}${esc(orgsText(kp[2]))}의 ${para.slice(kp[0].length)}`;
  }
  const at = para.indexOf(', ');
  if (at < 0 || para.slice(0, at).includes('의 ')) return para;
  srcFixed++;
  return `${para.slice(0, at)}의 ${para.slice(at + 2)}`;
});
function replaceBlock(src, tag, firstId, lastId, content) {
  const begin = `<!-- QI4:${tag}:begin -->`;
  const end = `<!-- QI4:${tag}:end -->`;
  const wrapped = `${begin}\n${content}\n    ${end}`;
  const b = src.indexOf(begin);
  if (b >= 0) {
    const e = src.indexOf(end, b);
    if (e < 0) throw new Error(`표식 짝이 없다: ${tag}`);
    return src.slice(0, b) + wrapped + src.slice(e + end.length);
  }
  const startRe = new RegExp(`[ \\t]*<article class="slide[^"]*" data-slide-id="${firstId}"`);
  const sm = startRe.exec(src);
  if (sm === null) throw new Error(`옛 슬라이드를 찾지 못했다: ${firstId}`);
  const lastStart = src.indexOf(`data-slide-id="${lastId}"`, sm.index);
  if (lastStart < 0) throw new Error(`옛 슬라이드를 찾지 못했다: ${lastId}`);
  const closeAt = src.indexOf('</article>', lastStart) + '</article>'.length;
  return src.slice(0, sm.index) + '    ' + wrapped + src.slice(closeAt);
}
html = replaceBlock(html, 'gap', 'poverty-by-age', 'poverty-by-age', gap.map((g) => g.html).join('\n'));
html = replaceBlock(html, 'proj', 'proj-population', 'proj-single-household', proj.map((g) => g.html).join('\n'));
// 번호 다시 매기기: 문서 순서대로 n/N
let n = 0;
html = html.replace(/(<article class="slide[^"]*" data-slide-id="[^"]+" aria-roledescription="슬라이드" aria-label=")\d+\/\d+ /g, (m, head) => `${head}${++n}/${TOTAL} `);
if (n !== TOTAL) throw new Error(`슬라이드 수가 ${n}장이다(기대 ${TOTAL})`);
html = html.replace(/<span class="carousel__status num" aria-hidden="true">1 \/ \d+<\/span>/, `<span class="carousel__status num" aria-hidden="true">1 / ${TOTAL}</span>`);
writeFileSync(HTML_PATH, html);

console.log(`title-005.html: 슬라이드 ${n}장(격차 ${gap.length} · 전망 ${proj.length} 생성, 나머지 ${n - gap.length - proj.length}장은 손 시안 그대로 — 출처 줄 「의」 후처리 ${srcFixed}장), 마지막 갱신 ${UPDATED_ON}`);
for (const s of [...gap, ...proj]) console.log(' -', s.log.join('\n   '));
