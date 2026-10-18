/**
 * 화면 시안 HTML을 만든다 (SPEC-003 DS6, designer). 가짜 데이터(한 인물 「이서연」의 데이터는 화면 사이에서 일치한다), 정적 HTML.
 * 실행: npx vite-node scripts/design/buildMockups.mjs   → docs/design/mockups/*.html  (faceLayers.ts·Reel.tsx를 읽으므로 vite-node)
 * 스크린샷: npx vite-node scripts/design/shootMockups.mjs
 * 순서: buildBrand → buildIcons → buildMockups → shootMockups (자산이 바뀌면 처음부터)
 *
 * 시안은 src/styles/tokens.css 와 docs/design/mockups/ds.css 만 쓴다. 화면 구현은 이 구조·클래스를 기준으로 옮긴다.
 * 문구는 docs/design/copy.md 가 기준이다(80억 분의 1 고유 문구와 겹치지 않게 자체 작성, REV-003-D-1 R-123·R-124).
 * 통계 값은 src/data/koreaStats.json(usable: true)에서 읽는다 — 시안에 가짜 수치를 적지 않는다(R-133).
 * 구현이 끝난 화면(첫 화면 M2, 룰렛·출생신고 M3)은 **구현과 같은 모델·같은 문구 함수**로 그린다 — 시안 주인공의 저장 상태(Character·BirthReport)를 두고
 * core·data의 순수 함수(buildRoulette·birthSentence·peersOf·buildComparison·REPORT_NOTES …)가 글자를 만든다(손으로 적은 문장이 없다). 구현과 남은 차이는 docs/design/diff-003.md.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AGE_GROUPS, faceSvg } from '../../src/assets/faces/faceLayers.ts';
import { generateBirthFromSeed, looksStanding } from '../../src/core/birth.ts';
import { birthSentence, isValidBirthReport, reportPlaceLabel, weightStanding } from '../../src/core/birthReport.ts';
import { AUTO_ADVANCE_MS, LINE_H_STACKED, LINE_W, buildCarousel, valueWidthEm } from '../../src/core/carousel.ts';
import { finalWealthStanding, movementOf, standingScore, startBandOf } from '../../src/core/ending.ts';
import { formatMan } from '../../src/core/format.ts';
import { glueSegments, splitPair } from '../../src/core/glue.ts';
import { peersOf } from '../../src/core/peers.ts';
import { ROULETTE_TIMING, buildRoulette, reelPosition } from '../../src/core/roulette.ts';
import { BGM_VOLUME_MAX, BGM_VOLUME_MIN, DEFAULT_BGM, ERAS, LIFE_LENGTHS, isLifeLengthSelectable } from '../../src/core/types.ts';
import { ASSETS_AMOUNTS_SHIPPED, DASH_TEXT, SYSTEM_TITLE, SYSTEM_TITLE_CHARS, statusHelpText, titleCharsFor } from '../../src/data/dashText.ts';
import { STAGE_ENTRY_TEXT } from '../../src/data/lifeTable.ts';
import { buildComparison, compareShown, lifeGapLine } from '../../src/data/birthCompare.ts';
import { OCCUPATION_LABEL } from '../../src/data/birthReportTable.ts';
import { BIRTH_TEXT, GRADE_NAME, REPORT_NOTES, ROULETTE_TEXT, ROULETTE_TITLE_CHARS, formatKg, genderLabel, housingText, orderText, parentingDocText, regionOddsNote, yearMonthText } from '../../src/data/birthReportText.ts';
import { PARENTING_LABEL, standingLabel } from '../../src/data/birthText.ts';
import { ERA_CONFIG } from '../../src/data/birthTable.ts';
import { ENDING_HEADINGS, ENDING_HEAD_LABEL, FINAL_NET_TEXT, JOURNEY_BAR_LEGEND, JOURNEY_NOTE, MOVEMENT_TEXT, REBIRTH_LABEL, REBIRTH_NOTE, bandLabel, choiceCountText, deathLineText, endingSpanText, journeyBarLabel, journeyText, stageHeadingText } from '../../src/data/endingText.ts';
import { deathEntryText } from '../../src/data/lifeText.ts';
import { KeepStanding } from '../../src/ui/KeepStanding.tsx';
import { getCarouselIndicators, getRegionFootnote, getUsableIndicator } from '../../src/data/koreaStatsAccess.ts';
import { placeLabel } from '../../src/data/regionNames.ts';
import { LIFE_LENGTH_TEXT, NOT_READY_TEXT, TITLE_TEXT, eraMetaText, footerStatsText, heroTagKeepParts } from '../../src/data/titleText.ts';
import { restCells, spinCells, spinCycles } from '../../src/ui/Reel.tsx';
import { AssetsCard, StatusCard } from '../../src/ui/dash/Cards.tsx';
import { FinalNetLine } from '../../src/ui/dash/FinalNet.tsx';
import { ImpactHint, ImpactLine } from '../../src/ui/dash/Impact.tsx';
import { IMPACT_HINT, IMPACT_LABEL, IMPACT_SR, impactSrText } from '../../src/data/impactText.ts';
import { DEFAULT_KEY, GRADES, ROOT, esc, face, fitPair, gradeChip, gradeLine, gradeText, headerLogo, icon, logo, MOCK_TAG, meter, page, reelSpoon, spoon, spoonLineup } from './mockLib.mjs';

const OUT = ROOT + 'docs/design/mockups/';
/** `--only=<파일이름>`이면 그 시안만 쓴다(다른 시안은 건드리지 않는다 — 한 시안만 다시 만들 때, 예: `--only=economy-m5.html`) */
const ONLY = process.argv.find((a) => a.startsWith('--only='))?.slice('--only='.length) ?? null;
const write = (name, html) => {
  if (ONLY === null || ONLY === name) writeFileSync(OUT + name, html, 'utf-8');
};
const NAMES_META = JSON.parse(readFileSync(ROOT + 'src/data/names.json', 'utf-8')).meta;
/** 수저 구간 글자의 단일 출처(R-170): bandLabel(startBandOf(era, wealth)). 시안은 이 함수 출력만 적는다 — 「약 N%」(standingLabel)는 외모·체중·엔딩 도착 자리 전용 */
const band = (era, wealth) => bandLabel(startBandOf(era, wealth));

// ---------- 가짜 인물 데이터 (화면 사이에서 일치) ----------
/** 가상 인구(시안용 고정값 — 구현은 core/population.ts#tryVirtualPopulation이 이 기기의 시각으로 계산한다). 첫 화면·대시보드 인생 기록 고정 줄이 같은 값을 쓴다 */
const N_POP = '51,284';
/**
 * 시안 주인공의 **저장 상태**(구현 core/types.ts#Character·BirthReport와 같은 모양, 2026-10-16 M3 맞춤). 룰렛·출생신고 시안은 이 상태를 구현의 순수 함수에 넣어 그린다 —
 * 지역·시군구·체중 격자는 저장 검증(core/birthReport.ts#isValidBirthReport)을 통과해야 한다(2026년 경기도의 시군구는 일반구 단위라 「화성시 병점구」).
 * 값의 뜻: 2026년 1월 경기도 화성시 병점구, 흙수저, 어머니 29세 판매직·아버지 32세 기계 조작직, 임차, 3.3kg 첫째, 엄격한 교육방식, 외모는 「상위 약 46%」가 나오는 점수(원점수는 어디에도 적지 않는다, R-135①).
 * 또래 시드 61 = peersOf(61, 2026, 1, '이서연')가 R-125 조건(지역 4곳 서로 다름·서울 1명 이하·계층 상징 지명 없음·금수저 이상 1명은 수도권 밖·흙·동 1명 이상·남녀 섞임·「전남광주통합특별시」 1명)을 만족하는 **첫 시드**(결정적 탐색, 생성기가 다시 확인한다).
 */
const HERO_STATE = {
  era: 'present',
  character: { name: '이서연', gender: 'female', birthYear: 2026, parentWealth: 1, parenting: 'strict', looks: 52 },
  report: { month: 1, region: '경기', sigunguSido: '경기', sigungu: '화성시 병점구', mother: { age: 29, job: 'sales' }, father: { age: 32, job: 'machine' }, housing: 'rent', birthWeightKg: 3.3, birthOrder: 1 },
  peerSeed: 61,
};
if (!isValidBirthReport(HERO_STATE.report, HERO_STATE.character.birthYear, HERO_STATE.character.gender)) throw new Error('시안 주인공의 출생신고 상세가 저장 검증을 통과하지 못한다');
/** 다른 화면(대시보드·카드·엔딩 시안)이 쓰는 주인공 글자 — 모두 저장 상태에서 구현 함수로 만든 값이다 */
const HERO = (() => {
  const { era, character: c, report } = HERO_STATE;
  return {
    name: c.name,
    gender: genderLabel(c.gender),
    birth: yearMonthText(c.birthYear, report.month),
    birthYear: c.birthYear,
    era,
    region: reportPlaceLabel(report, era), // 「경기도 화성시 병점구」
    regionShort: report.region,
    grade: c.parentWealth,
    gradeRange: band(era, c.parentWealth), // 「하위 25% 안쪽」 — 룰렛 결과·출생신고·프로필·엔딩 출발선이 모두 이 값
    motherAge: report.mother.age,
    motherJob: OCCUPATION_LABEL[report.mother.job],
    fatherAge: report.father.age,
    fatherJob: OCCUPATION_LABEL[report.father.job],
    weight: formatKg(report.birthWeightKg),
    weightRank: standingLabel(weightStanding(report.birthWeightKg, c.gender)),
    order: orderText(report.birthOrder),
    parenting: PARENTING_LABEL[c.parenting],
    looks: standingLabel(looksStanding(c.looks)), // 「상위 약 46%」 — 외모 원점수는 어디에도 적지 않는다(R-135①)
    sentence: birthSentence(c, report, era), // BR3 한 줄 서술문 = 인생 기록 0세 첫 줄
  };
})();
/**
 * 같은 해 태어난 네 사람 — 구현과 같은 함수(core/peers.ts#peersOf)의 출력. 시드 61은 지역과 수저를 고정관념과 어긋나게 섞고 계층 상징 지명(강남·해운대 등)과
 * 특정 구 묶음의 통념(이른바 노도강 등)을 피하는 조건(R-125, REV-003-D-2 관찰)을 만족하는 첫 시드다 — 아래가 그 조건을 다시 확인한다(데이터·함수가 바뀌어 어긋나면 실패해서 드러난다).
 */
const PEER_BAN = new Set(['강남구', '서초구', '송파구', '해운대구', '노원구', '도봉구', '강북구', '용산구', '성남시 분당구', '과천시']);
const PEER_LIST = peersOf(HERO_STATE.peerSeed, HERO_STATE.character.birthYear, HERO_STATE.report.month, HERO_STATE.character.name);
{
  const ok =
    new Set(PEER_LIST.map((p) => p.region)).size === 4 &&
    PEER_LIST.filter((p) => p.region === '서울').length <= 1 &&
    !PEER_LIST.some((p) => PEER_BAN.has(p.sigungu)) &&
    PEER_LIST.some((p) => p.wealth >= 4 && p.region !== '서울' && p.region !== '경기') &&
    PEER_LIST.some((p) => p.wealth <= 2) &&
    new Set(PEER_LIST.map((p) => p.gender)).size === 2 &&
    PEER_LIST.filter((p) => p.region === '전남광주').length === 1;
  if (!ok) throw new Error(`또래 시드 ${HERO_STATE.peerSeed}가 R-125 조건을 만족하지 않는다: ${JSON.stringify(PEER_LIST)}`);
}
/** 대시보드 시안이 쓰는 또래 글자: [이름, 장소(정식 시·도 + 시군구), 성별, 수저] */
const PEERS = PEER_LIST.map((p) => [p.name, placeLabel(p, HERO_STATE.era), genderLabel(p.gender), p.wealth]);
// ---------- 공통 조각 ----------
/**
 * 라디오 카드. disabled = 고를 수 없는 카드(「약 1시간」 — 준비 중): 라디오 그룹 안에 그대로 두고 점선 테두리·옅은 글자·「준비 중」 표식(meta)으로 드러낸다 —
 * 색에만 의존하지 않고, meta 글자는 카드의 접근 가능한 이름에 들어간다(구현 TitleScreen#RadioCard과 같은 구조, REV-003-M2-1 R-202).
 */
const radioCard = ({ title, desc, selected, name, meta = '', disabled = false }) => `<label class="radio-card${selected ? ' is-selected' : ''}${disabled ? ' is-disabled' : ''}">
  <input type="radio" name="${name}" ${selected ? 'checked' : ''}${disabled ? ' disabled' : ''}>
  <span class="radio-card__mark">${icon('check')}</span>
  <span class="radio-card__body"><span class="radio-card__head"><span class="radio-card__title">${title}</span>${meta ? `<span class="radio-card__meta">${meta}</span>` : ''}</span><span class="radio-card__desc">${desc}</span></span>
  ${selected ? '<span class="sr-only">선택됨</span>' : ''}
</label>`;

/**
 * 줄바꿈 묶음(QM2-5·QM2-10, core/glue.ts — 구현의 ui/Glue.tsx와 같은 마크업): 「A · B」 사슬·괄호 낱말은 .keep-phrase(inline-block), 숫자+단위·날짜는 .nowrap.
 * 글자는 그대로고 감싸는 표시만 더한다.
 */
const glueHtml = (text) => renderGlue(glueSegments(text));
function renderGlue(segments) {
  return segments.map((s) => (s.kind === 'plain' ? esc(s.text) : s.kind === 'nowrap' ? `<span class="nowrap">${esc(s.text)}</span>` : `<span class="keep-phrase">${renderGlue(s.parts)}</span>`)).join('');
}
/**
 * 짧은 쌍 「A · B」(QM2-10 규칙 3, 구현의 ui/Pair.tsx): 한 줄에 들어가면 「A · B」, 칸이 좁거나 글자가 커서 넘치면 기호를 감추고 두 줄(ds.css의 컨테이너 쿼리 — basis 14em·meta 16.5em).
 * 두 항목 사이 공백 하나는 기호 조각 밖에 둔다(R-242). 쌍이 아니면 일반 묶음.
 */
function pairHtml(text, kind) {
  const pair = splitPair(text);
  if (pair === null) return glueHtml(text);
  return `<span class="pair pair--${kind}"><span class="pair__item">${glueHtml(pair[0])}</span> <span class="pair__sep">· </span><span class="pair__item">${glueHtml(pair[1])}</span></span>`;
}

// ---------- 통계 그래프 (구현의 ui/StatsChart.tsx와 같은 마크업, 좌표는 core/carousel.ts 모델) ----------
const r1 = (v) => Math.round(v * 10) / 10;
function marker(shape, x, y, last) {
  const cls = `dot${shape === 'solid' ? '' : ` dot--${shape}`}${last ? ' dot--last' : ''}`;
  const r = last ? 4.5 : 3;
  if (shape === 'dashed') return `<rect class="${cls}" x="${r1(x - r)}" y="${r1(y - r)}" width="${r * 2}" height="${r * 2}"/>`;
  if (shape === 'dotted') return `<polygon class="${cls}" points="${x},${r1(y - r - 1)} ${r1(x + r + 1)},${y} ${x},${r1(y + r + 1)} ${r1(x - r - 1)},${y}"/>`;
  return `<circle class="${cls}" cx="${x}" cy="${y}" r="${r}"/>`;
}
function lineChartSvg(chart, label) {
  const grid = chart.grid.map((y) => `<line class="grid" x1="${chart.plotLeft}" x2="${chart.plotRight}" y1="${y}" y2="${y}"/>`).join('');
  const series = chart.series
    .map((s) => {
      const cls = `line${s.dash === 'solid' ? '' : ` line--${s.dash}`}`;
      const lines = s.segments.filter((seg) => seg.length >= 2).map((seg) => `<polyline class="${cls}" points="${seg.map((p) => `${p.x},${p.y}`).join(' ')}"/>`).join('');
      const dots = s.points.length <= 20 ? s.points.map((p) => marker(s.dash, p.x, p.y, p === s.last)).join('') : marker(s.dash, s.last.x, s.last.y, true);
      return `<g data-series="${s.key}">${lines}${dots}</g>`;
    })
    .join('');
  const text = (l, cls = '') => `<text${cls ? ` class="${cls}"` : ''} x="${l.x}" y="${l.y}" text-anchor="${l.anchor}">${esc(l.text)}</text>`;
  return `<svg class="chart" viewBox="0 0 ${chart.width} ${chart.height}" role="img" aria-label="${esc(label)}" focusable="false">${grid}<line class="axis" x1="${chart.plotLeft}" x2="${chart.plotRight}" y1="${chart.axisY}" y2="${chart.axisY}"/>${series}${chart.xLabels.map((l) => text(l)).join('')}${chart.labels.map((l) => text(l, l.bold ? 'val' : '')).join('')}</svg>`;
}
function barChartSvg(chart, label) {
  const rows = chart.rows
    .map(
      (r) =>
        `<g><text class="bar-label" x="${chart.labelWidth}" y="${r.y + chart.rowHeight - 3}">${esc(r.label)}</text><rect class="chart-bar" x="${chart.barX}" y="${r.y + 2}" width="${r.barWidth}" height="${chart.rowHeight - 5}" rx="2"/><text class="bar-value" x="${r1(chart.barX + r.barWidth + 4)}" y="${r.y + chart.rowHeight - 3}">${esc(r.text)}</text></g>`,
    )
    .join('');
  return `<svg class="chart" viewBox="0 0 ${chart.width} ${chart.height}" role="img" aria-label="${esc(label)}" focusable="false">${rows}</svg>`;
}
/** 막대 그래프의 모든 값을 읽기 전용 표로(R-207) */
const barTable = (chart, caption) =>
  `<div class="sr-only"><table><caption>${esc(caption)}</caption><thead><tr><th scope="col">항목</th><th scope="col">값</th></tr></thead><tbody>${chart.rows.map((r) => `<tr><th scope="row">${esc(r.fullLabel)}</th><td>${esc(r.valueWithUnit)}</td></tr>`).join('')}</tbody></table></div>`;
const swatch = (dash) => `<svg viewBox="0 0 28 10" aria-hidden="true" focusable="false"><line class="swatch-line${dash === 'solid' ? '' : ` swatch-line--${dash}`}" x1="1" x2="27" y1="5" y2="5"/></svg>`;

/**
 * 첫 화면 통계 캐러셀 — **구현과 같은 모델**(src/core/carousel.ts#buildCarousel: 값 줄·단위 낱말·기준 줄·조혼인율 줄·범례·출처·「통계 기준」 줄·그래프 좌표)을 그대로 그린다.
 * 지표 목록·순서·수(N)는 접근자 getCarouselIndicators에서 오고(2026-10-15 기준 14개) 자동 넘김 간격은 SPEC SC5 7초(AUTO_ADVANCE_MS).
 * 구조(구현 ui/StatsCarousel.tsx와 같다): 조작 줄(이전 · 「{i} / {N}」 · 다음 · 자동 넘김 일시정지)은 **카드 머리**(R-200 — 슬라이드 높이가 달라도 같은 자리, 하단 띠에 가려지지 않는다),
 * 14장을 모두 `.slides`에 겹쳐 두고 보이는 하나만 `.is-active`(좁은 화면은 카드 높이 = 가장 큰 슬라이드, 넓은 화면은 보이는 슬라이드만큼). 시안 주소 끝 `?slide=<id>`로 보이는 슬라이드를 고른다(예 `suicide-rate`·`marriage-count`).
 * 그래프 좌표는 좁은 화면 기준(폭 320·높이 232)으로 한 번 만들고 SVG가 칸 폭에 맞춰 비율로 늘어난다 — 구현은 화면에 그려지는 폭으로 좌표를 다시 만든다(R-206).
 */
const CAROUSEL_DATA = buildCarousel(undefined, { width: LINE_W, lineHeight: LINE_H_STACKED });
const CAROUSEL_TOTAL = CAROUSEL_DATA.slides.length;
const CAROUSEL_SEC = AUTO_ADVANCE_MS / 1000;
if (CAROUSEL_TOTAL !== getCarouselIndicators().length) throw new Error(`캐러셀 슬라이드 수(${CAROUSEL_TOTAL})가 접근자 지표 수와 다르다`);
/** 큰 값 줄의 글자 크기를 칸 폭에 맞추는 변수(ds.css .slide__value, CM11·QM2-5): 값 글자 폭(em)·단위 글자 수 */
const valueSizing = (values, unitText) => `--value-em:${Math.max(...values.map(valueWidthEm), 1)};--unit-chars:${Math.max(unitText.length, 1)}`;
function slideHtml(s, i, n, active) {
  const unit = s.unitText !== '' ? `<small class="slide__unit">${esc(s.unitText)}</small>` : '';
  let value = '';
  if (s.headlines.length > 1) {
    value = `<p class="slide__value slide__value--multi" style="${valueSizing(s.headlines.map((h) => h.value), s.unitText)}">${s.headlines
      .map((h) => `<span class="slide__hv"><small class="slide__label">${esc(h.label)}</small><span class="slide__num"><span>${esc(h.value)}</span>${unit}</span></span>`)
      .join('')}</p>`;
  } else if (s.valueText !== null) {
    value = `<p class="slide__value" style="${valueSizing([s.valueText], s.unitText)}"><span>${esc(s.valueText)}</span>${unit}</p>`;
  }
  // 큰 값 바로 아래 줄: 제목에 이름이 든 보조 계열의 값(조혼인율) — 글자만, 기준 줄 앞(QM2-11, 마스터 결정 R-230)
  const side = s.sideValues.map((v) => `<p class="slide__side">${glueHtml(v.text)}</p>`).join('');
  const chart = s.chart.kind === 'line' ? lineChartSvg(s.chart, s.chartLabel) : barChartSvg(s.chart, s.chartLabel) + barTable(s.chart, `${s.title} — 큰 값부터`);
  const legend = s.legend.length >= 2 ? `<ul class="legend" aria-label="그래프 범례와 최근 값">${s.legend.map((l) => `<li>${swatch(l.dash)}<span>${glueHtml(l.label)} <strong>${esc(l.valueText)}</strong></span></li>`).join('')}</ul>` : '';
  const note = s.seriesNote !== null ? `<p class="slide__meta">${glueHtml(s.seriesNote)}</p>` : '';
  const help = s.safety !== null ? `<aside class="slide__help" aria-label="${esc(s.safety.name)}"><p>${esc(TITLE_TEXT.helpLead)}</p><p><strong>${esc(s.safety.name)}</strong> <a href="tel:${esc(s.safety.number)}">${esc(s.safety.number)}</a> (${esc(s.safety.hours)})</p></aside>` : '';
  return `<article class="slide${active ? ' is-active' : ''}" data-slide-id="${s.id}" aria-roledescription="슬라이드" aria-label="${i + 1}/${n} ${esc(s.title)}">
      <h3 class="t-h3">${glueHtml(s.title)}</h3>
      ${s.caption !== null ? `<p class="slide__caption">${glueHtml(s.caption)}</p>` : ''}
      ${value}${side}
      <p class="slide__basis">${pairHtml(s.basisText, 'basis')}</p>
      ${chart}${legend}${note}
      <p class="t-sm t-muted">${glueHtml(s.definition)}</p>
      ${help}
      <p class="slide__meta">출처: ${glueHtml(s.sourceText)}</p>
      <p class="slide__meta">${pairHtml(s.basisLine, 'meta')}</p>
    </article>`;
}
function carousel() {
  const n = CAROUSEL_TOTAL;
  return `<section class="card carousel" aria-roledescription="캐러셀" aria-label="${esc(TITLE_TEXT.carouselRegionLabel)}">
  <div class="carousel__head">
    <div class="carousel__heading"><h2 class="card__title">${esc(TITLE_TEXT.carouselTitle)}</h2><span class="carousel__note">${esc(TITLE_TEXT.carouselAutoNote(CAROUSEL_SEC))}</span></div>
    <div class="carousel__ctrl">
      <button class="btn btn--secondary btn--icon" type="button" aria-label="${esc(TITLE_TEXT.carouselPrev)}">${icon('prev')}</button>
      <span class="carousel__status num" aria-hidden="true">1 / ${n}</span>
      <button class="btn btn--secondary btn--icon" type="button" aria-label="${esc(TITLE_TEXT.carouselNext)}">${icon('forward')}</button>
      <button class="btn btn--secondary btn--icon carousel__pause" type="button" aria-label="${esc(TITLE_TEXT.carouselPause)}">${icon('pause')}</button>
    </div>
  </div>
  <div class="carousel__viewport" role="group" tabindex="0" aria-label="${esc(TITLE_TEXT.carouselViewport)}">
    <div class="slides">
    ${CAROUSEL_DATA.slides.map((s, i) => slideHtml(s, i, n, i === 0)).join('\n    ')}
    </div>
  </div>
</section>
<script>(function(){var id=new URLSearchParams(location.search).get('slide');if(!id)return;var all=document.querySelectorAll('.slide');var at=-1;all.forEach(function(s,k){var on=s.getAttribute('data-slide-id')===id;s.classList.toggle('is-active',on);if(on)at=k;});if(at<0){all[0].classList.add('is-active');return;}var st=document.querySelector('.carousel__status');if(st)st.textContent=(at+1)+' / '+all.length;})();</script>`;
}

// ---------- 1. 첫 화면 ----------
/**
 * state: 'new' 새 판(「태어나기」) / 'continue' 진행 중인 판이 있을 때(「이어서 살기」 + 보조 「새로 태어나기」). 이어하기 시안은 주소 끝 `?state=confirm`으로 확인 단계(안내문 + 「이전 판 지우고 태어나기」 / 「돌아가기」)를 보인다.
 * 구조는 구현 src/screens/TitleScreen.tsx와 같다(R-220): 한 격자 .title에 본문(main) → 통계 카드(aside) → 푸터(footer)가 차례로, 넓은 화면은 왼쪽 열 본문·푸터 / 오른쪽 열 카드(두 줄에 걸쳐 따라다닌다).
 * 문구는 구현과 같은 곳(src/data/titleText.ts·birthTable.ts#ERA_CONFIG·names.json meta.attribution)에서 읽는다 — 시안과 화면의 글자가 어긋나지 않는다. 지금 세상 카드의 작은 글씨만 M3 목표값(올해(2026) 출생 고정, SPEC Q1)으로 적는다.
 */
function titlePage(key, state = 'new') {
  const tag = heroTagKeepParts();
  const hero = `<header class="hero">
    <h1><span class="sr-only">수저 게임</span>${logo(key, 'stacked')}${logo(key, 'row')}</h1>
    <p class="hero__tag">${esc(TITLE_TEXT.heroTagLead)}<span class="keep-phrase">${esc(tag[0])}${tag[1] === '' ? '' : `<span class="nowrap">${esc(tag[1])}</span>`}${esc(tag[2])}</span></p>
    ${spoonLineup()}
    <p class="hero__pop"><strong>${N_POP}${TITLE_TEXT.populationUnit}</strong>${esc(TITLE_TEXT.populationSuffix)}</p>
    <p class="hero__note">${esc(TITLE_TEXT.populationNote)}</p>
  </header>`;
  const eraMeta = (e) => eraMetaText(e, e === 'present' ? { min: 2026, max: 2026 } : ERA_CONFIG[e].birthYears);
  const world = `<fieldset><legend class="group-title">${esc(TITLE_TEXT.eraGroup)}</legend>
    <div class="choices choices--1" role="radiogroup" aria-label="${esc(TITLE_TEXT.eraGroup)}">
      ${ERAS.map((e) => radioCard({ name: 'era', title: ERA_CONFIG[e].label, meta: eraMeta(e), desc: ERA_CONFIG[e].blurb, selected: e === 'present' })).join('\n      ')}
    </div></fieldset>`;
  const length = `<fieldset><legend class="group-title">${esc(TITLE_TEXT.lifeLengthGroup)}</legend>
    <div class="choices choices--2" role="radiogroup" aria-label="${esc(TITLE_TEXT.lifeLengthGroup)}">
      ${LIFE_LENGTHS.map((l) => radioCard({ name: 'len', title: LIFE_LENGTH_TEXT[l].title, desc: LIFE_LENGTH_TEXT[l].desc, selected: l === 'short30', disabled: !isLifeLengthSelectable(l), meta: isLifeLengthSelectable(l) ? '' : NOT_READY_TEXT })).join('\n      ')}
    </div>
    <p class="t-sm t-muted" style="margin-top:var(--sp-2)">${esc(TITLE_TEXT.lifeLengthHint)}</p></fieldset>`;
  // 하단 띠 — 확인 단계(R-204): 맨 아래(방금 누른 「새로 태어나기」 자리)는 안전한 「돌아가기」(기본·큰 버튼, 먼저 포커스), 그 위 줄이 이전 판을 지우는 확인(보조)
  const barNew = `<button class="btn btn--primary btn--lg" type="button">${esc(TITLE_TEXT.begin)}</button>`;
  const barContinue = `<button class="btn btn--primary btn--lg" type="button">${esc(TITLE_TEXT.resume)}</button><button class="btn btn--ghost btn--sm" type="button">${esc(TITLE_TEXT.beginNew)}</button>`;
  const barConfirm = `<p class="bottom-bar__ask" role="alert">${esc(TITLE_TEXT.confirmNewTitle)}</p><div class="bottom-bar__stack"><button class="btn btn--secondary" type="button">${esc(TITLE_TEXT.confirmNewYes)}</button><button class="btn btn--primary btn--lg" type="button">${esc(TITLE_TEXT.confirmNewNo)}</button></div>`;
  const bar =
    state === 'continue'
      ? `<div class="bottom-bar">${barContinue}</div>
<template id="bar-confirm">${barConfirm}</template>
<script>(function(){if(new URLSearchParams(location.search).get('state')!=='confirm')return;var bar=document.querySelector('.bottom-bar');bar.replaceChildren(document.getElementById('bar-confirm').content.cloneNode(true));})();</script>`
      : `<div class="bottom-bar">${barNew}</div>`;
  const foot = `<footer class="title-foot">
  <p class="credit"><a href="${esc(NAMES_META.attribution.url)}" target="_blank" rel="noopener noreferrer">${glueHtml(NAMES_META.attribution.text)}</a></p>
  <p>${glueHtml(footerStatsText(CAROUSEL_DATA.orgs))}</p>
  <p>${glueHtml(TITLE_TEXT.populationInfo)}</p>
  <p class="num">v0.1.0 (a1b2c3d)</p>
</footer>`;
  const body = `<div class="title">
  <main class="title__main">${hero}${world}${length}</main>
  <aside class="title__side">${carousel()}</aside>
  ${foot}
</div>
<div class="page-end-space"></div>
${bar}`;
  return page({ title: `수저 게임 · 시안 · 첫 화면${state === 'continue' ? ' (이어하기)' : ''}`, body });
}

// ---------- 2. 룰렛 — 구현(src/screens/RouletteScreen.tsx·ui/Reel.tsx)과 같은 모델 core/roulette.ts#buildRoulette ----------
/** 회전 중 시안이 고정해 둔 프레임의 시각(ms): 가속이 끝나고 가장 빠른 구간 — 구현의 .is-fast(흐림 + 줄무늬)가 켜진 모습 */
const SPIN_FRAME_MS = 2000;
/** 릴 창 위에 보이는 칸 수(ui/Reel.tsx#SLOT_BEFORE — 릴 높이 = 5칸, 가운데가 창) */
const SLOT_BEFORE = 2;
/**
 * 릴 하나(구현 ui/Reel.tsx의 마크업). 멈춘 릴 = restCells(결과 칸을 가운데, 앞뒤 두 칸), 회전 중 = spinCells(여러 바퀴 목록)를 reelPosition(SPIN_FRAME_MS)만큼 밀어 올린 한 프레임.
 * 수저 릴은 왕복 순서(core/roulette.ts#WEALTH_REEL_ORDER: 흙 동 은 금 다이아몬드 금 은 동, R-274)라 멈춘 창의 위아래가 늘 이웃 단계(흙수저 결과: 은 · 동 · [흙] · 동 · 은)다.
 * 릴은 두 상태 모두 aria-hidden(RL6 — 결과는 상태 문장이 읽는다). 칸 높이는 CSS 변수 --reel-item-h(rem).
 */
function reelHtml(items, resultIndex, stopMs, spinning) {
  const n = items.length;
  if (spinning) {
    const total = spinCycles(n) * n;
    const pos = reelPosition(SPIN_FRAME_MS, total, stopMs);
    const cells = spinCells(n, resultIndex, total);
    return `<div class="reel is-spinning is-fast" aria-hidden="true" data-state="spinning"><div class="reel__window"></div><ul class="reel__list" style="transform:translate3d(0, calc(var(--reel-item-h) * ${-r1(pos)}), 0)">${cells.map((i) => `<li class="reel__item">${items[i]}</li>`).join('')}</ul></div>`;
  }
  const cells = restCells(n, resultIndex);
  return `<div class="reel" aria-hidden="true" data-state="stopped"><div class="reel__window"></div><ul class="reel__list">${cells.map((i, e) => `<li class="reel__item${e === SLOT_BEFORE ? ' is-result' : ''}">${items[i]}</li>`).join('')}</ul></div>`;
}

/**
 * state: 'spin' 회전 중 / 'stop' 결과 / 'reduced' 움직임 줄이기(= 결과 상태 그대로 + 안내 한 줄, 회전 화면을 거치지 않는다 — R-171).
 * 확률표·릴 순서·멈출 자리는 모두 buildRoulette(지금 세상·시안 주인공의 저장 상태)에서 읽는다: 수저 = ERA_CONFIG 설계값(정수 %, 합 100), 지역 = 2025년 시·도 출생아 비율(소수 1자리, 합 100.0),
 * 지역 릴·확률표 순서 = REGION_ORDER, 수저 릴 = 왕복 순서. 문구는 data/birthReportText.ts#ROULETTE_TEXT·regionOddsNote(지금 세상 = 통계 파생, 지난·다가올 세상 = 설계값 문구).
 * 제목(h1)은 구현 RouletteScreen과 같이 `--title-chars`(ROULETTE_TITLE_CHARS = 가장 긴 낱말 글자 수 + 1)를 인라인으로 넘겨 ds.css의 글자 크기 상한(줄 폭 ÷ 칸 수)이 폭 320 · 글자 200%에서도 「정해졌습니다」를 한 줄에 둔다(QM3-2).
 */
function roulettePage(state) {
  const spinning = state === 'spin';
  const reduced = state === 'reduced';
  const { era, character: c, report } = HERO_STATE;
  const view = buildRoulette(era, c, report);
  const stats = getUsableIndicator('birth-by-sido');
  const note = regionOddsNote(view.basis, era, { org: stats?.source.org ?? '', year: stats?.latest.year ?? 0 });
  const wealthItems = view.wealthReel.map((w) => reelSpoon(w));
  const regionItems = view.regionOdds.map((o) => esc(o.name));
  const spoonOdds = `<table><caption class="sr-only">${esc(ROULETTE_TEXT.wealthOddsCaption)}</caption><tbody>${view.wealthOdds.map((o) => `<tr><th scope="row">${esc(GRADE_NAME[o.wealth])}</th><td>${o.percent}%</td></tr>`).join('')}</tbody></table>
    <p class="odds__note">${esc(ROULETTE_TEXT.wealthOddsNote)}</p>`;
  const regionOdds = `<table><caption class="sr-only">${esc(ROULETTE_TEXT.regionOddsCaption)}</caption><tbody>${view.regionOdds.map((o) => `<tr><th scope="row">${esc(o.name)}</th><td>${o.percent.toFixed(1)}%</td></tr>`).join('')}</tbody></table>
    <p class="odds__note">${glueHtml(note)}</p>`;
  // 결과 부제: 「{수저}({구간}) · {시·도 줄임}」 — 구간은 bandLabel 출력(R-170), 짧은 쌍은 FitPair(한 줄에 안 들어가면 기호 없이 두 줄)
  const result = fitPair(gradeText(c.parentWealth, band(era, c.parentWealth)), view.regionOdds[view.regionIndex].name);
  const body = `<div class="page roulette-page${spinning ? ' is-spinning' : ''}" data-state="${spinning ? 'spinning' : 'result'}">
<header class="site-head">${headerLogo()}<span class="site-head__name">${esc(ROULETTE_TEXT.headName)}</span></header>
<main class="roulette">
  <div class="roulette__lead">
    <h1 class="t-title" style="--title-chars:${ROULETTE_TITLE_CHARS}">${esc(spinning ? ROULETTE_TEXT.spinTitle : ROULETTE_TEXT.doneTitle)}</h1>
    <p class="t-muted" role="status">${spinning ? esc(ROULETTE_TEXT.spinNote) : result}</p>
    ${reduced ? `<p class="motion-note t-sm t-muted">${esc(ROULETTE_TEXT.motionNote)}</p>` : ''}
  </div>
  <div class="reels">
    <div class="reel-col"><h2 class="reel-col__title">${esc(ROULETTE_TEXT.wealthTitle)}</h2>
      ${reelHtml(wealthItems, view.wealthReelIndex, ROULETTE_TIMING.wealthStopMs, spinning)}
      <div class="odds">${spoonOdds}</div></div>
    <div class="reel-col"><h2 class="reel-col__title">${esc(ROULETTE_TEXT.regionTitle)}</h2>
      ${reelHtml(regionItems, view.regionIndex, ROULETTE_TIMING.regionStopMs, spinning)}
      <div class="odds odds--cols">${regionOdds}</div></div>
  </div>
  <p class="t-xs t-faint roulette__after"${spinning ? ' aria-hidden="true"' : ''}>${esc(ROULETTE_TEXT.afterNote)}</p>
</main>
<div class="page-end-space"></div>
<div class="bottom-bar">${spinning ? `<button class="btn btn--secondary btn--lg" type="button">${esc(ROULETTE_TEXT.skip)}</button>` : `<button class="btn btn--primary btn--lg" type="button">${esc(ROULETTE_TEXT.toBirth)}</button>`}</div>
</div>`;
  return page({ title: `수저 게임 · 시안 · 룰렛 (${spinning ? '회전 중' : reduced ? '움직임 줄이기 — 결과만' : '결과'})`, body, motion: reduced ? 'reduce' : '' });
}

// ---------- 3. 출생신고 — 구현(src/screens/BirthScreen.tsx)과 같은 모델·같은 문구 함수 ----------
/**
 * 지난·다가올 세상 출생신고 시안의 인물: 구현의 출생 생성기(core/birth.ts#generateBirthFromSeed) 출력(인물·출생신고 상세·또래 시드)을 그대로 쓴다 — 손으로 만든 값이 없다.
 * 시드는 보여 줄 조건을 만족하는 첫 시드다(결정적 탐색): 지난 세상 12 = 흙수저·셋째 이상·일반구가 있는 장소(1961년생 「경기도 용인시 처인구」, 또래 장소에 「경기도 인천 미추홀구」 같은 지난 세상 표기),
 * 다가올 세상 229 = 다이아몬드수저(가장 긴 수저 이름 칩)·「전남광주통합특별시」(9글자 낱말 — 넓은 화면 격자의 두 칸, R-281). 아래가 조건을 다시 확인한다.
 */
const ERA_SEEDS = { past: 12, future: 229 };
function eraModel(era) {
  const r = generateBirthFromSeed(ERA_SEEDS[era], era);
  const ok = era === 'past' ? r.character.parentWealth === 1 && r.report.birthOrder >= 3 : r.character.parentWealth === 5 && r.report.region === '전남광주';
  if (!ok) throw new Error(`${era} 세상 시안 시드 ${ERA_SEEDS[era]}의 출생 결과가 보여 줄 조건과 다르다: ${JSON.stringify(r.character)} ${JSON.stringify(r.report)}`);
  return { era, character: r.character, report: r.report, peerSeed: r.peerSeed };
}

/**
 * 출생신고 본문(main) 하나. 구조·클래스는 구현과 같다: 서류(.doc — 띠 + 「가상의 서류」 FitPair, 본문 기준 도장, 큰 이름, 서술문(끝 괄호는 .keep-phrase), 격자 11칸 — 「태어난 곳」 두 칸(.span-2), 집안 형편·교육방식 한 줄(.wide);
 * 열 수는 본문 컨테이너 폭(rem)이 정한다 — 칸이 11.5rem 미만이면 1열, QM3-1) → 같은 해 태어난 사람들(.people — 이름 옆 「여성/남성」, 칩은 좁은 폭에서 이름 아래, R-269; 안내는 첫 문장 하나 — 둘째 문장은 M4의 또래 칸이 배포될 때 켠다, QM3-3) →
 * 비교 카드(.card--cmp 컨테이너 — 내용 폭 35rem 미만이면 표가 한 행씩 쌓인다; 지금 세상만, R-263: 행 3개 + 합쇼체 안내(QM3-4) + 기대수명 한 줄 서술, R-260·R-261) → 하단 표기(.doc-notes 4~5줄).
 * 글자는 전부 구현 함수의 출력이다: birthSentence·reportPlaceLabel·bandLabel(startBandOf)·standingLabel(looksStanding/weightStanding)·peersOf·placeLabel·buildComparison·lifeGapLine·REPORT_NOTES·getRegionFootnote.
 */
function birthMain({ era, character: c, report, peerSeed }) {
  if (!isValidBirthReport(report, c.birthYear, c.gender)) throw new Error(`${era} 세상 시안의 출생신고 상세가 저장 검증을 통과하지 못한다`);
  const sentence = birthSentence(c, report, era);
  const sm = /^(.*?)(\([^()]*\))$/.exec(sentence); // 구현 BirthScreen#Sentence: 끝의 「(3.3kg은 상위 약 N%)」를 .keep-phrase로 묶는다
  const sentenceHtml = sm === null ? esc(sentence) : `${esc(sm[1])}<span class="keep-phrase">${esc(sm[2])}</span>`;
  const place = reportPlaceLabel(report, era);
  const range = band(era, c.parentWealth);
  const looks = standingLabel(looksStanding(c.looks));
  const weight = formatKg(report.birthWeightKg);
  const weightRank = standingLabel(weightStanding(report.birthWeightKg, c.gender));
  const peers = peersOf(peerSeed, c.birthYear, report.month, c.name);
  const showCompare = compareShown(era);
  const rows = showCompare ? buildComparison(c.parentWealth) : [];
  const gap = showCompare ? lifeGapLine() : null;
  const L = BIRTH_TEXT.gridLabels;
  const field = (label, value, cls = '') => `<div${cls === '' ? '' : ` class="${cls}"`}><dt>${esc(label)}</dt><dd>${value}</dd></div>`;
  const grid = `<dl class="doc__grid">
    ${field(L.gender, esc(genderLabel(c.gender)))}
    ${field(L.month, esc(yearMonthText(c.birthYear, report.month)))}
    ${field(L.place, esc(place), 'span-2')}
    ${field(L.wealth, gradeLine(c.parentWealth, range, { lg: true }), 'wide')}
    ${field(L.mother, fitPair(`${report.mother.age}세`, OCCUPATION_LABEL[report.mother.job]))}
    ${field(L.father, fitPair(`${report.father.age}세`, OCCUPATION_LABEL[report.father.job]))}
    ${field(L.housing, esc(housingText(report.housing)))}
    ${field(L.weight, `${esc(weight)} <span class="cell-sub">(${esc(weightRank)})</span>`)}
    ${field(L.order, esc(orderText(report.birthOrder)))}
    ${field(L.looks, `${esc(looks)} <span class="cell-sub">${esc(BIRTH_TEXT.looksSub)}</span>`)}
    ${field(L.parenting, `${esc(PARENTING_LABEL[c.parenting])} <span class="cell-sub">${esc(parentingDocText(c.parenting, c.parentWealth))}</span>`, 'wide')}
  </dl>`;
  const people = `<ul class="people">${peers
    .map(
      (p) =>
        `<li><div class="people__who"><div class="people__line"><span class="name">${esc(p.name)}</span> <span class="sub">${esc(genderLabel(p.gender))}</span></div><div class="sub">${esc(placeLabel(p, era))}</div></div>${gradeChip(p.wealth)}</li>`,
    )
    .join('')}</ul>`;
  const compare =
    !showCompare || rows.length === 0
      ? ''
      : `<section class="card card--cmp" aria-labelledby="cmp-t"><div class="card__head"><h2 id="cmp-t" class="card__title">${esc(BIRTH_TEXT.compareTitle)}</h2></div>
    <table class="table table--cmp" role="table"><caption class="sr-only">${esc(BIRTH_TEXT.compareCaption)}</caption>
      <thead role="rowgroup"><tr role="row"><th scope="col" role="columnheader">${esc(BIRTH_TEXT.compareColItem)}</th><th scope="col" role="columnheader" class="num">${esc(BIRTH_TEXT.compareColAll)}</th><th scope="col" role="columnheader" class="num">${esc(BIRTH_TEXT.compareColThis)}</th></tr></thead>
      <tbody role="rowgroup">${rows
        .map(
          (r) =>
            `<tr role="row" data-row-id="${r.id}"><th scope="row" role="rowheader">${esc(r.label)}<span class="cmp__source t-xs t-faint">${glueHtml(r.source)}</span></th><td role="cell" class="num" data-label="${esc(BIRTH_TEXT.compareColAll)}">${esc(r.average)}</td><td role="cell" class="num" data-label="${esc(BIRTH_TEXT.compareColThis)}"><strong>${esc(r.child)}</strong><span class="cmp__note t-xs t-faint">${esc(r.childNote)}</span></td></tr>`,
        )
        .join('')}</tbody></table>
    <p class="t-xs t-faint card__note">${glueHtml(BIRTH_TEXT.compareNote)}</p>
    ${gap === null ? '' : `<p class="t-sm card__note">${glueHtml(gap.text)}</p>\n    <p class="t-xs t-faint">${glueHtml(gap.source)}</p>`}</section>`;
  const notes = `<div class="doc-notes t-xs t-faint">
    <p>${glueHtml(era === 'past' ? REPORT_NOTES.regionPast : getRegionFootnote())}</p>
    <p>${glueHtml(REPORT_NOTES.stats)}</p>
    <p>${glueHtml(REPORT_NOTES.housing)}</p>
    <p>${glueHtml(REPORT_NOTES.design)}</p>
    ${era === 'present' ? '' : `<p>${glueHtml(era === 'past' ? REPORT_NOTES.eraPast : REPORT_NOTES.eraFuture)}</p>`}
  </div>`;
  return `<main class="doc-page" data-era="${era}">
  <article class="doc" aria-labelledby="doc-title">
    <div class="doc__band"><h1 id="doc-title">${esc(BIRTH_TEXT.docTitle)}</h1><span class="doc__tag">${fitPair(BIRTH_TEXT.docTag[0], BIRTH_TEXT.docTag[1])}</span></div>
    <div class="doc__body">
      <div class="stamp" aria-hidden="true">${esc(BIRTH_TEXT.stamp)}</div>
      <div><p class="label">${esc(BIRTH_TEXT.nameLabel)}</p><p class="doc__name">${esc(c.name)}</p></div>
      <p class="doc__sentence">${sentenceHtml}</p>
      ${grid}
    </div>
  </article>
  <section class="card" aria-labelledby="peers-t"><div class="card__head"><h2 id="peers-t" class="card__title">${esc(BIRTH_TEXT.peersTitle)}</h2></div>${people}
    <p class="t-sm t-muted card__note">${glueHtml(BIRTH_TEXT.peersNote)}</p></section>
  ${compare}
  ${notes}
  ${MOCK_TAG}
</main>`;
}

/**
 * 출생신고 시안 한 장에 세 시대를 담는다: 기본은 지금 세상(시안 주인공), 주소 끝 `?era=past` / `?era=future`는 <template>에 둔 지난·다가올 세상 본문으로 바꿔 끼운다(첫 화면의 `?state=confirm`과 같은 방식).
 * 지난·다가올 세상은 비교 카드가 없고(R-263) 하단 표기가 한 줄 더 많다(시대 보정, 지난 세상은 지역 표기도 다르다 — R-264).
 */
function birthPage() {
  const header = `<header class="site-head">${headerLogo()}<span class="site-head__name">${esc(BIRTH_TEXT.headName)}</span></header>`;
  const bar = `<div class="bottom-bar"><button class="btn btn--primary btn--lg" type="button">${esc(BIRTH_TEXT.next)}</button></div>`;
  const body = `<div class="page birth-page">
${header}
${birthMain(HERO_STATE)}
<div class="page-end-space"></div>
${bar}
</div>
<template id="era-past">${birthMain(eraModel('past'))}</template>
<template id="era-future">${birthMain(eraModel('future'))}</template>
<script>(function(){var era=new URLSearchParams(location.search).get('era');if(era!=='past'&&era!=='future')return;var t=document.getElementById('era-'+era);var main=document.querySelector('main.doc-page');if(!t||!main)return;main.replaceWith(t.content.cloneNode(true));document.title+=era==='past'?' (지난 세상)':' (다가올 세상)';})();</script>`;
  return page({ title: '수저 게임 · 시안 · 출생신고', body });
}

// ---------- 4. 대시보드 ----------
/**
 * 도구 줄 버튼. id는 시안 스크립트(다크 켜짐 표시)용. pressed = 켜짐(aria-pressed).
 * soon = M7c 전의 「생각 남기기」(R-326 마스터 결정, 구현 LifeScreen#LifeTools·M4 r2와 같은 마크업): **지속 비활성**(aria-disabled + data-unavailable — ds.css 점선·옅은 글자, R-337)이고
 * 눈에 보이는 「준비 중」 알약(.tool-soon, DASH_TEXT.toolSoon)이 이름 뒤에 붙어 접근 가능한 이름이 「생각 남기기 준비 중」이다. 누르면 아무 일도 없다 — 없는 기능이 동작하는 것처럼 보이지 않게(QM3-3).
 * 예전의 「눌러서 안내 한 줄이 나오는 보통 버튼」(「생각 남기기는 준비 중입니다.」)은 폐기했다(diff-003.md D-17).
 */
const toolBtn = (id, iconName, label, pressed = false, soon = false) =>
  soon
    ? `<button class="btn btn--tool" type="button" data-tool="${id}" aria-disabled="true" data-unavailable="true">${icon(iconName)}<span>${label}</span> <span class="tool-soon">${esc(DASH_TEXT.toolSoon)}</span></button>`
    : `<button class="btn btn--tool" type="button" data-tool="${id}" ${pressed ? 'aria-pressed="true"' : 'aria-pressed="false"'}>${icon(iconName)}<span>${label}</span><span class="sr-only">${pressed ? '켜짐' : ''}</span></button>`;

/**
 * 대시보드 헤더 + 도구 줄. 문구는 구현 상수 DASH_TEXT(src/data/dashText.ts)에서 읽는다(copy.md 대시보드 행과 같은 글자, 2026-10-17 M4 구현 뒤 맞춤).
 * pending(선택지 대기 = 카드 시안의 시트가 떠 있을 때)이면 「다음 결정으로」가 **지속 비활성**: aria-disabled + data-unavailable(ds.css — 옅은 글자 + 점선, 불투명도 아님; design-system.md 6절 「버튼」).
 * 「생각 남기기」는 M7c 전까지 같은 지속 비활성 + 「준비 중」 알약이다(toolBtn soon, R-326) — noteReady는 M7c 목표 시안(note.html, 자유 기록 카드가 떠 있는 모습)에서만 true.
 * 도구 줄 아래 한 줄(볼륨·나가기 확인 단계)은 dashboardPage()가 `?state=tools|exit`로 끼운다.
 */
function dashHead({ age, year, progress, paused, pending = false, noteReady = false }) {
  const T = DASH_TEXT;
  return `<header class="dash-head"><div class="dash-head__inner">
    <div class="dash-head__top">${headerLogo()}
      <div class="who"><span class="who__name">${HERO.name}</span><span class="who__age"><b>${age}</b>${T.ageSuffix}</span></div></div>
    <div class="year-row"><span class="num">${year}${T.yearSuffix}</span>
      <div class="year-progress" role="progressbar" aria-label="${T.yearProgressLabel}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progress}"${paused ? ` aria-valuetext="${progress}%, ${T.progressPausedValue}"` : ''}><div class="year-progress__fill" style="width:${progress}%"></div></div>
      <span class="year-row__pct num">${progress}%</span></div>
  </div></header>
  <div class="toolbar"><div class="toolbar__inner">
    <div class="controls-fixed" role="group" aria-label="${T.controlsGroup}" data-testid="bottom-bar">
      <div class="controls__speed">
        <button class="btn btn--sm" type="button">${icon(paused ? 'play' : 'pause', 'icon--sm')}<span>${paused ? T.play : T.pause}</span></button>
        <button class="btn btn--sm" type="button" aria-pressed="true">1${T.speedUnit}</button><button class="btn btn--sm" type="button">2${T.speedUnit}</button><button class="btn btn--sm" type="button">4${T.speedUnit}</button><button class="btn btn--sm" type="button">8${T.speedUnit}</button>
      </div>
      <div class="controls__more">
        <button class="btn btn--sm btn--secondary" type="button"${pending ? ' aria-disabled="true" data-unavailable="true"' : ''}>${icon('next', 'icon--sm')}<span>${T.skip}</span></button>
        <button class="btn btn--sm btn--secondary" type="button" aria-pressed="false">${icon('auto', 'icon--sm')}<span>${T.autoOff}</span></button>
      </div>
    </div>
    <div class="controls__tools" role="group" aria-label="${T.toolsGroup}">
      ${toolBtn('bgm', 'music', T.toolBgm)}${toolBtn('note', 'pencil', T.toolNote, false, !noteReady)}${toolBtn('dark', 'moon', T.toolDark)}${toolBtn('feedback', 'message', T.toolFeedback)}${toolBtn('exit', 'exit', T.toolExit)}
    </div>
  </div></div>`;
}

/**
 * 도구 줄 아래 한 줄의 상태(M4 구현 LifeScreen.tsx와 같은 마크업, 2026-10-17 — r2 R-326 뒤 맞춤): `?state=tools` = BGM 켜짐(aria-pressed + 「켜짐」) → 볼륨 줄 「BGM 볼륨」 + range + 「N%」 /
 * `?state=exit` = 나가기 확인 단계(안내문 → 「첫 화면으로 나가기」(보조) → 맨 아래 「돌아가기」(기본·먼저 포커스) — 첫 화면 확인 단계 R-204·QM2-6과 같은 배치). 문구는 DASH_TEXT(copy.md 대시보드 행).
 * 「생각 남기기」의 안내 줄(「…준비 중입니다.」, 예전 .tool-note)은 없다 — 준비 중임은 버튼 안의 「준비 중」 알약이 늘 보인다(toolBtn soon, R-326).
 */
function toolbarStates() {
  const T = DASH_TEXT;
  const tools = `<label class="volume"><span>${esc(T.bgmVolume)}</span><input type="range" min="${BGM_VOLUME_MIN}" max="${BGM_VOLUME_MAX}" step="5" value="${DEFAULT_BGM.volume}" aria-valuetext="${DEFAULT_BGM.volume}%"><output>${DEFAULT_BGM.volume}%</output></label>`;
  const exit = `<div class="exit-ask" role="group" aria-labelledby="exit-ask-t"><p class="exit-ask__title" id="exit-ask-t" role="alert">${esc(T.exitAsk)}</p><p class="t-sm t-muted">${esc(T.exitAskSub)}</p>
<div class="exit-ask__actions"><button class="btn btn--secondary" type="button">${esc(T.exitYes)}</button><button class="btn btn--primary" type="button">${esc(T.exitNo)}</button></div></div>`;
  return `<template id="state-tools">${tools}</template>
<template id="state-exit">${exit}</template>
<script>(function(){var s=new URLSearchParams(location.search).get('state');if(s!=='tools'&&s!=='exit')return;var t=document.getElementById('state-'+s),inner=document.querySelector('.toolbar__inner');if(!t||!inner)return;inner.appendChild(t.content.cloneNode(true));if(s==='tools'){var b=document.querySelector('[data-tool="bgm"]');if(b){b.setAttribute('aria-pressed','true');var sr=b.querySelector('.sr-only');if(sr)sr.textContent='${T.toolOn}';}}})();</script>`;
}

function profileCard({ ageGroup, edu }) {
  return `<section class="card profile" aria-label="프로필">
  <div class="profile__top">${face(ageGroup, 'female', 3, `${HERO.name}의 얼굴 (${AGE_GROUPS.find((g) => g.id === ageGroup).label} 여성)`, 'face--lg')}
    <div><p class="profile__name">${HERO.name}</p><p class="t-sm t-muted">${HERO.gender}</p></div></div>
  <dl class="facts">
    <dt>출생</dt><dd>${HERO.birth}</dd>
    <dt>거주</dt><dd>${HERO.region}</dd>
    <dt>출신 가정</dt><dd><span class="grade-line">${gradeChip(HERO.grade, { range: HERO.gradeRange })}</span></dd>
    <dt>학력</dt><dd>${edu}</dd>
    <dt>외모</dt><dd>${HERO.looks} <small>또래 사이에서</small></dd>
  </dl></section>`;
}

/** 상태 카드 = 구현 StatusCard 출력(M5 2b부터 도움말 제목 「상태와 자산의 뜻 보기」 + 시대별 단위 문장 + 가구 기준 한 문장, copy.md 4-5절 — 손으로 적은 문장 없음, 2026-10-18 r3). 접이식은 닫힌 채(펼친 모습은 economy-m5.html?state=assets) */
const statusCard = (v) => html(StatusCard, { stats: { health: v[0], happiness: v[1], education: v[2], relationships: v[3] }, era: 'present' });

/** 자산 현황 = 구현 AssetsCard 출력(copy.md 4-5절, 2026-10-18 r3 — 옛 M4 초안의 「올해 가치 기준」 태그·`.neg` ▼ 접두·「마이너스는 빚이」 주석은 D-32로 폐기). 20세 미만은 문장만(수저 칩 없음 — C4·R-136 허용 목록, R-170 마스터 결정) */
const assetsCardOf = (age) => (age < 20 ? html(AssetsCard, { age, era: 'present', assets: null }) : econAssets('present', age, { net: -1200, income: 3200, debt: 4800 }));

const logRow = (age, text, extra = '', cls = '') => `<li class="log__row ${cls}"><span class="log__age">${age}세</span><span class="log__text">${text}${extra ? ` <em>${extra}</em>` : ''}</span></li>`;
// 「나의 기록 · {주제}」 같은 짧은 쌍은 줄바꿈 묶음(Glue)으로 — 「·」가 줄 끝·첫머리에 혼자 남지 않는다(QM2-5·QM2-10, 11-4절)
const logNote = (age, topic, text) => `<li class="log__row log__row--note"><span class="log__age">${age}세</span><span class="log__text"><span class="log__note-label">${icon('pencil', 'icon--sm')}${glueHtml(`나의 기록 · ${topic}`)}</span><br>${esc(text)}</span></li>`;

/**
 * 인생 기록(DB12·DB14). 고정 줄 「이 세상의 가상 인구 {N}명 · {이름}도 그중 한 사람」은 내용 길이가 판마다 다른 짧은 쌍이라 FitPair(한 줄에 안 들어가면 기호 없이 두 줄, 11-7절 — 구현 ui/FitPair.tsx).
 * 머리 보조 「시간순 · 위로 스크롤하면 지난 기록」·「새 기록 N개 · 맨 아래로」는 Glue 묶음.
 */
function logCard(rowsHtml, newCount) {
  return `<section class="card log" aria-label="인생 기록"><div class="card__head" style="margin-bottom:var(--sp-2)"><h2 class="card__title">인생 기록</h2><span class="t-xs t-faint">${glueHtml('시간순 · 위로 스크롤하면 지난 기록')}</span></div>
  <p class="log__pin">${fitPair(`이 세상의 가상 인구 ${N_POP}명`, `${HERO.name}도 그중 한 사람`)}</p>
  <ol class="log__list" aria-live="polite" aria-relevant="additions">${rowsHtml}</ol>
  ${newCount ? `<button class="btn btn--secondary btn--sm log__jump" type="button">${glueHtml(`새 기록 ${newCount}개 · 맨 아래로`)}</button>` : ''}</section>`;
}

/** 식구(DB13): 부모 나이는 출생신고(어머니 29·아버지 32, 2026년)에서 해마다 오른다. 「{직업} · {상태}」는 내용 길이가 판마다 다른 짧은 쌍이라 FitPair(좁은 열·큰 글자에서 기호 없이 두 줄 — 「·」가 가장자리에 남지 않는다, 11-7절) */
const familyCard = (age) => `<section class="card family" aria-label="식구"><h2 class="card__title" style="margin-bottom:var(--sp-3)">식구</h2>
  <dl class="family-list">
    <dt>어머니</dt><dd>${HERO.motherAge + age}세<small>${fitPair(HERO.motherJob, '건강함')}</small></dd>
    <dt>아버지</dt><dd>${HERO.fatherAge + age}세<small>${fitPair(HERO.fatherJob, '건강함')}</small></dd>
    <dt>형제자매</dt><dd>${age >= 20 ? `남동생 ${age - 3}세 <small>3세 아래</small>` : '남동생 <small>이제 막 태어남</small>'}</dd>
    ${age >= 20 ? '<dt>배우자</dt><dd>없음</dd><dt>자녀</dt><dd>없음</dd>' : ''}
  </dl></section>`;

/**
 * 또래 카드(VP4, copy.md 「대시보드 · 또래 카드」): 한 줄의 구조는 출생신고 또래 목록(M3 구현 .people, R-269)과 같다 — 이름 옆 「여성/남성」, 장소는 다음 줄, **수저 칩**(gradeChip — M4 착수 결정 1 마스터: 수저 이름 허용 자리에 VP4 추가, 구현 ui/dash/Cards.tsx와 같은 순서) —
 * 그 아래 상태 라벨(.people__now). 라벨은 나이 × 수저 규칙표(설계값)에서 나오므로 카드 끝에 「통계가 아님」을 적는다. 문구는 DASH_TEXT.
 */
function peersCard(labels) {
  const rows = PEERS.map(([n, s, g, w], i) => `<li><div class="people__who"><div class="people__line"><span class="name">${esc(n)}</span> <span class="sub">${esc(g)}</span></div><div class="sub">${esc(s)}</div></div>${gradeChip(w)}<span class="people__now">${labels[i]}</span></li>`).join('');
  return `<section class="card peers-now" aria-labelledby="peers-now-t"><div class="card__head" style="margin-bottom:var(--sp-1)"><h2 id="peers-now-t" class="card__title">${esc(DASH_TEXT.peersTitle)}</h2><span class="card__sub">${esc(DASH_TEXT.peersSub)}</span></div><ul class="people">${rows}</ul><p class="t-xs t-faint">${esc(DASH_TEXT.peersNote)}</p></section>`;
}

function infantSheet() {
  return `<div class="overlay" role="dialog" aria-modal="true" aria-labelledby="dc-title"><div class="sheet">
    <div class="sheet__head"><span class="sheet__kind">중대 결정</span><div class="row"><span class="sheet__age">2029년 · 3세</span><button class="btn btn--ghost btn--sm" type="button">카드 접기 ▾</button></div></div>
    <div class="sheet__body">
      <div class="stack--sm stack"><h2 id="dc-title" class="t-title" style="font-size:var(--fs-2xl)">동생을 맞이했습니다</h2>
      <p>${HERO.name}은 동생을 처음 봤습니다. 부모님의 애정이 줄어든 것처럼 느껴집니다.</p></div>
      <div class="cite"><p class="cite__text">동생이 태어난 뒤 첫째가 관심을 끌려는 행동이나 이전 행동으로 돌아가는 모습을 보이는 일은 흔한 것으로 알려져 있습니다. <span class="t-faint" style="color:inherit;opacity:.8">(시안용 문구)</span></p><p class="cite__src">기관·저자(연도), 자료 이름 · 구현 때 근거 행에서 채움</p></div>
      <div class="choices-list" role="group" aria-label="선택지">
        ${choiceBtn(1, '엄마가 동생을 살피면 운다', 'relationships:down:1,happiness:up:1')}
        ${choiceBtn(2, '동생을 예뻐해 준다', 'relationships:up:2,happiness:down:1')}
        ${choiceBtn(3, '동생의 장난감을 빼앗는다', 'relationships:down:2,happiness:up:1')}
      </div>
      ${sheetHint()}
      <p class="sheet__hint">자동 모드가 꺼져 있습니다. 직접 고를 때까지 시간은 멈춥니다.</p>
    </div></div></div>`;
}

function adultSheet() {
  return `<div class="overlay" role="dialog" aria-modal="true" aria-labelledby="dc-title"><div class="sheet">
    <div class="sheet__head"><span class="sheet__kind">중대 결정</span><div class="row"><span class="sheet__age">2057년 · 31세</span><button class="btn btn--ghost btn--sm" type="button">카드 접기 ▾</button></div></div>
    <div class="sheet__body">
      <div class="stack--sm stack"><h2 id="dc-title" class="t-title" style="font-size:var(--fs-2xl)">마음이 가는 사람이 생겼습니다</h2>
      <p>${HERO.name}은 같은 일터의 동료와 가까워졌습니다. 상대도 싫지 않은 눈치입니다. 통장에는 갚아야 할 대출이 남아 있습니다.</p></div>
      <div class="cite"><p class="cite__text">청년 가구의 상당수가 소득과 주거 비용 때문에 연애와 결혼을 미룬다고 답한 조사가 있습니다. <span style="opacity:.8">(시안용 문구)</span></p><p class="cite__src">기관·저자(연도), 자료 이름 · 구현 때 근거 행에서 채움</p></div>
      <div class="choices-list" role="group" aria-label="선택지">
        ${choiceBtn(1, '연애를 시작한다', 'assets:down:2,relationships:up:2,happiness:up:1')}
        ${choiceBtn(2, '썸으로 남긴다', 'relationships:up:1,happiness:down:1')}
        ${choiceBtn(3, '마음을 접는다', 'assets:up:1,happiness:down:2')}
      </div>
      ${sheetHint()}
    </div></div></div>`;
}

function noteSheet() {
  return `<div class="overlay" role="dialog" aria-modal="true" aria-labelledby="nc-title"><div class="sheet">
    <div class="sheet__head"><span class="sheet__kind sheet__kind--note">생각 남기기</span><span class="sheet__age">2031년 · 5세</span></div>
    <div class="sheet__body">
      <h2 id="nc-title" class="t-h2">${HERO.name}이 다섯 살이던 때를 떠올려 보면, 기억나는 장면이나 느낌이 있습니까?</h2>
      <div class="cite"><p class="cite__text">영유아기의 경험은 성인기의 건강과 관계에도 영향을 준다고 알려져 있습니다. <span style="opacity:.8">(시안용 문구)</span></p><p class="cite__src">기관·저자(연도), 자료 이름</p></div>
      <div class="field"><label class="sr-only" for="note">기록</label>
        <textarea id="note" class="field__input" maxlength="140" rows="3">할머니 집 마루에서 수박을 먹던 여름. 매미 소리가 시끄러웠습니다.</textarea>
        <div class="field__hint"><span>실명·연락처 같은 개인정보는 적지 마십시오. 이 기기에만 저장됩니다.</span><span class="num">34/140</span></div></div>
      <div class="stack--sm stack">
        <button class="note-choice note-choice--primary" type="button"><span class="note-choice__top"><span class="choice__no">1</span>적어두고 살기</span><span class="note-choice__sub">인생 기록에 한 줄로 더해집니다.</span></button>
        <button class="note-choice" type="button"><span class="note-choice__top"><span class="choice__no">2</span>마음속에 담고 살기</span><span class="note-choice__sub">아무것도 저장하지 않고 넘어갑니다.</span></button>
      </div>
      <div class="sheet__foot"><button class="btn btn--ghost btn--sm" type="button">자동 기록 카드 끄기</button></div>
    </div></div></div>`;
}

function dashboardPage(kind, overlay = '', infantAge = 3, { noteReady = false } = {}) {
  const infant = kind === 'infant';
  const age = infant ? infantAge : 31;
  // 카드 시안(시트가 떠 있음) = 선택지 대기: 시간은 멈추고 「다음 결정으로」는 지속 비활성이다(구현 LifeScreen#isSkipBlocked). noteReady = M7c 목표 시안(note.html)에서만 「생각 남기기」가 보통 버튼
  const head = dashHead({ age, year: HERO.birthYear + age, progress: infant ? 62 : 38, paused: overlay !== '', pending: overlay !== '', noteReady });
  const rowsInfant =
    logRow(0, esc(HERO.sentence)) + // 인생 기록 0세 첫 줄 = 출생신고 서술문(BR3, core/birthReport.ts#birthSentence)
    logRow(0, '기본 예방접종을 받았습니다.') +
    logRow(1, '첫 걸음마를 뗐습니다. 온 가족이 박수를 쳤습니다.') +
    logRow(1, '첫 단어를 말했습니다. ‘엄마’라는 뜻의 말이었습니다.') +
    logRow(2, '엄마와 즐거운 시간을 보냈습니다.') +
    logRow(3, '동생을 맞이했습니다.', '', 'log__row--latest');
  // 단계 줄도 다른 줄처럼 「N세 + 문장」(연표 한 줄 = 기록 한 줄, 문장은 구현 상수 STAGE_ENTRY_TEXT — 어체는 M7e) — 글자 색·2px 아래선으로만 구분(M4 구현에 맞춤 2026-10-17)
  const rowsAdult =
    logRow(20, esc(STAGE_ENTRY_TEXT.youth), '', 'log__row--stage') +
    logRow(24, '학자금 대출을 갚기 시작했습니다.', '(선택: 대출을 유지한다)') +
    logRow(27, '계약직으로 첫 직장에 들어갔습니다.') +
    logRow(29, '가까워진 사람과 만남을 시작했습니다.', '(선택: 연애를 시작한다)') +
    logNote(29, '청년기 연애담', '퇴근길에 같이 걷던 저녁이 오래 남았다.') +
    logRow(30, '보증금을 올려 달라는 연락을 받아 월세 집으로 옮겼습니다.') +
    logRow(31, '일하던 곳과 계약이 한 해 더 이어졌습니다.', '', 'log__row--latest');
  const body = `${head}
<main class="dash"${overlay ? ' aria-hidden="true"' : ''}>
  <div class="col">
    ${profileCard({ ageGroup: infant ? 'toddler' : 'young', edu: infant ? '취학 전' : '대학교 졸업' })}
    ${statusCard(infant ? [82, 70, 38, 61] : [74, 58, 66, 62])}
    ${assetsCardOf(age)}
  </div>
  <div class="col">${logCard(infant ? rowsInfant : rowsAdult, infant ? 0 : 2)}</div>
  <div class="col">
    ${familyCard(age)}
    ${peersCard(infant ? ['어린 시절', '어린 시절', '어린 시절', '어린 시절'] : ['일하는 사람', '구직 중', '일하는 사람', '돌봄'])}
    ${MOCK_TAG}
  </div>
</main>
<div class="page-end-space"></div>
${overlay}
${overlay ? '' : toolbarStates()}`;
  // 본문 끝 여백은 고정 진행 줄의 실제 높이(--bar-h)를 따르는 .page-end-space — 150px 같은 고정값을 두지 않는다(11-1절, 2026-10-17)
  return page({ title: `수저 게임 · 시안 · 대시보드 (${infant ? '영유아 시점' : '성인 시점'})`, body, bodyClass: 'is-dash' });
}

// ---------- 4-1. 밀린 화면·오류 화면 (DS1 공통 헤더 — QA-003-M2 보완 마스터 결정 2·QM3-6, M4) ----------
/**
 * 게임명은 공통 헤더(.site-head = 구현 ui/Brand.tsx#SiteHead: 헤더 로고 40px + 화면 이름)가 맡고, h1은 화면의 메시지다. 문구는 구현 상수 `SYSTEM_TITLE`(src/data/dashText.ts — SupersededScreen·ErrorBoundary가 같은 상수를 그린다) 그대로.
 * h1은 구현처럼 `--title-chars`(= `SYSTEM_TITLE_CHARS`, 가장 긴 낱말 「바뀌었습니다.」 7글자 + 1)를 인라인으로 넘겨 ds.css의 글자 크기 상한(카드 `.system .card`가 컨테이너, 바닥 --fs-md)이 폭 320 · 글자 200%에서도 낱말을 끊지 않는다(R-321·QM3-2, M4 r2 뒤 맞춤).
 * `system.html`(밀린 화면) / `system.html?state=error`(오류 화면). 헤더 이름은 copy.md 「밀린 화면」「오류 화면」 행.
 */
function systemPage() {
  const h1 = (text) => `<h1 style="--title-chars:${SYSTEM_TITLE_CHARS}">${esc(text)}</h1>`;
  const superseded = `<header class="site-head">${headerLogo()}<span class="site-head__name">저장 안내</span></header>
<main class="system" data-state="superseded">
  <section class="card">
    ${h1(SYSTEM_TITLE.superseded)}
    <p class="t-muted">다른 탭이나 창에서 진행했거나, 저장이 직접 지워지거나 바뀌었을 수 있습니다. 이 화면은 최신이 아닐 수 있습니다. 이어서 하려면 아래 버튼을 누르세요. 저장된 가장 최근 내용을 이어받습니다.</p>
    <button class="btn btn--primary" type="button">이 탭에서 이어하기</button>
    <p class="t-sm t-muted">저장된 게임이 없거나 읽을 수 없으면 새 게임이 시작됩니다.</p>
  </section>
  ${MOCK_TAG}
</main>`;
  const error = `<header class="site-head">${headerLogo()}<span class="site-head__name">오류</span></header>
<main class="system" data-state="error">
  <section class="card">
    ${h1(SYSTEM_TITLE.error)}
    <button class="btn btn--primary" type="button">저장 지우고 새로 시작</button>
  </section>
  ${MOCK_TAG}
</main>`;
  const body = `${superseded}
<template id="state-error">${error}</template>
<script>(function(){if(new URLSearchParams(location.search).get('state')!=='error')return;var t=document.getElementById('state-error');if(!t)return;var head=document.querySelector('header.site-head'),main=document.querySelector('main.system');var frag=t.content.cloneNode(true);var nh=frag.querySelector('header.site-head'),nm=frag.querySelector('main.system');if(head&&nh)head.replaceWith(nh);if(main&&nm)main.replaceWith(nm);document.title='수저 게임 · 시안 · 오류 화면';})();</script>`;
  return page({ title: '수저 게임 · 시안 · 밀린 화면', body, bodyClass: 'is-system' });
}

// ---------- 5. 엔딩 — M7e 새 디자인 (출발선 막대 · 출발선 수저 칩 · 「생애 기록」 머리: REV-003-M4-1 R-327; developer M7e-3 구현 뒤 designer가 함수 import로 되돌림, 2026-10-18) ----------
/**
 * 글자는 모두 구현 함수의 출력이다(R-191 — 시안이 문장을 따로 가지지 않는다): deathLineText·choiceCountText·journeyText·MOVEMENT_TEXT·bandLabel·standingLabel·journeyBarLabel·JOURNEY_BAR_LEGEND·ENDING_HEAD_LABEL·endingSpanText(endingText.ts),
 * deathEntryText(lifeText.ts), STAGE_ENTRY_TEXT(lifeTable.ts), KeepStanding(ui/KeepStanding.tsx — 순위 표현의 줄바꿈 보호). 숫자(구간 low·high, 도착 자리, 방향)도 구현 함수(startBandOf·finalWealthStanding·movementOf·standingScore)가 만든다 — 손으로 적은 값·문장이 없다.
 * 시안 전용 제안 문안 블록은 developer가 copy.md 5절을 반영한 뒤 지웠다(tests/designAssets.test.ts가 다시 생기지 않음을 잠근다).
 *
 * 화면 구조(구현 EndingScreen.tsx M7e-3과 같은 뼈대):
 *  ① 머리: 얼굴 96px + `.ending__who`(라벨 「{세상} · 생애 기록」 → h1 「{이름}의 인생」(--title-chars 상한) → 「{출생 연월} ~ {사망 연도}년 · {나이}세」). 짧은 쌍은 Glue(「·」가 줄 가장자리에 남지 않는다)
 *  ② 출발선 카드: 막대(`.journey__bar` role="img" — 선 위에 **출발선 구간 띠**(low~high%) + 가운데 50% 눈금 + **마지막 자리 마름모**(standingScore%)) + 범례(출발선 = 수저 칩 + 「({구간})」, 마지막 = 자리 글자) + 문장 셋.
 *     막대의 읽기용 설명은 journeyBarLabel(R-191(d)). 스무 살 전은 띠만(마름모·마지막 줄·방향 문장 없음).
 *  ③ 최종 스탯 카드의 「최종 순자산」 줄은 **금액만**(자리 글자는 출발선 카드로 일원화 — copy.md 4-6·5-2 ①), 외모는 「또래 사이에서 {standingLabel}」 순서(5-1 looksSub).
 * 상태(`?state=`): 기본 = 지금 세상 흙수저 84세 / zero = 최종 순자산 0원(QA-003-M5 O04 — 동률 불리 규칙 C의 출력) / past = 지난 세상 인물(birth.html?era=past와 같은 생성기 출력, 음수 + 「지금 가치로 환산」) / early = 스무 살 전(동수저 — 중앙 구간 문구) / down = 은수저 「뒤쪽 자리」.
 */
/** 순위 표현의 줄바꿈 보호 — 구현 컴포넌트 KeepStanding의 출력 그대로(`<span class="nowrap">` 조각) */
const keepStandingHtml = (text) => html(KeepStanding, { text });
const ageGroupIdOf = (age) => AGE_GROUPS.reduce((id, g) => (age >= g.minAge ? g.id : id), AGE_GROUPS[0].id);
/** 지금 세상에서 그 재력 단계가 나오는 첫 시드(결정적 탐색, 손으로 만든 값 없음): early = 동수저(중앙 구간 「하위 25% 선과 상위 45% 선 사이」), down = 은수저(「상위 17~45% 사이」 — 마름모가 띠 왼쪽 밖에 오는 「뒤쪽」) */
const presentSeedOfWealth = (wealth) => {
  for (let seed = 1; seed < 500; seed++) if (generateBirthFromSeed(seed, 'present').character.parentWealth === wealth) return seed;
  throw new Error(`지금 세상 ${wealth}단계 시드를 찾지 못했다`);
};
const EARLY_SEED = presentSeedOfWealth(2);
const DOWN_SEED = presentSeedOfWealth(3);

/**
 * 엔딩 상태 하나의 본문(main). review = { start, end|null, movement|null } 는 구현 함수로 만든다: start = startBandOf(era, 재력), end = finalWealthStanding(era, 순자산), movement = movementOf(start, end).
 * entries = 연표 (구현 core/ending.ts#buildTimeline과 같은 단계 묶음 — 단계 제목은 stageHeadingText 출력).
 */
function endingMain({ era, c, month, death, net, choiceCount, entries, note = '' }) {
  const start = startBandOf(era, c.parentWealth);
  const early = net === null;
  const end = early ? null : finalWealthStanding(era, net);
  const movement = early ? null : movementOf(start, end);
  const journey = early ? { kind: 'early', start } : { kind: 'compared', start, end, movement };
  const title = `${c.name}${DASH_TEXT.endingTitleSuffix}`;
  const barLabel = journeyBarLabel(journey);
  const deathYear = c.birthYear + death.age;
  const stageOf = (age) => (age < 7 ? 'infant' : age < 20 ? 'school' : age < 40 ? 'youth' : age < 65 ? 'middle' : 'senior');
  const groups = [];
  for (const e of entries) {
    const st = stageOf(e.age);
    if (groups.length === 0 || groups[groups.length - 1].stage !== st) groups.push({ stage: st, entries: [] });
    groups[groups.length - 1].entries.push(e);
  }
  // 연표 한 줄 = 구현 EndingScreen#TimelineItem과 같은 마크업(나이 · [제목] · [선택: 이름] · 문장). 사망 줄은 굵게(data-kind="death"), 선택 줄은 왼쪽 쪽빛 선(.is-choice), 「나의 기록」 줄은 M7c 목표(.is-note)
  const li = (e) =>
    `<li class="${e.kind === 'choice' ? 'is-choice' : e.kind === 'note' ? 'is-note' : ''}" data-kind="${e.kind}"><span class="log__age">${e.age}세</span><span>${e.title ? `<strong>${e.kind === 'note' ? glueHtml(e.title) : esc(e.title)}</strong>` : ''}${e.choice ? `<span class="tl-picked">${esc(DASH_TEXT.logChoicePrefix)}${esc(e.choice)}</span>` : ''}<span class="tl-text">${esc(e.text)}</span></span></li>`;
  const timeline = groups.map((g) => `<div class="tl-group"><h3>${glueHtml(stageHeadingText(g.stage))}</h3><ol class="timeline">${g.entries.map(li).join('')}</ol></div>`).join('');
  const finalNet = early
    ? `<dl class="final-net final-net--early"><dt>${esc(FINAL_NET_TEXT.label)}</dt><dd class="final-net__none">${esc(FINAL_NET_TEXT.early)}</dd></dl>`
    : `<dl class="final-net"><dt>${esc(FINAL_NET_TEXT.label)}</dt><dd><span class="final-net__value nowrap">${esc(formatMan(net))}</span>${era === 'present' ? '' : `<span class="tag">${esc(FINAL_NET_TEXT.basis)}</span>`}</dd></dl>`;
  return `<main class="ending" data-state-era="${era}">
  <div class="ending__head">${face(ageGroupIdOf(death.age), c.gender, 3, `${c.name}의 얼굴`, 'face--lg')}
    <div class="ending__who"><p class="label">${glueHtml(`${ERA_CONFIG[era].label} · ${ENDING_HEAD_LABEL}`)}</p><h1 class="t-title" style="--title-chars:${titleCharsFor(title)}">${esc(title)}</h1><p class="t-muted">${glueHtml(endingSpanText(c.birthYear, month, deathYear, death.age))}</p></div></div>
  <section class="card stack--sm stack" aria-label="${esc(DASH_TEXT.endingSummaryLabel)}"><p>${esc(deathLineText(death))}</p><p class="t-muted">${esc(choiceCountText(choiceCount))}</p></section>
  <section class="card" aria-labelledby="ending-journey-title"><h2 id="ending-journey-title" class="card__title card__title--gap">${esc(ENDING_HEADINGS.journey)}</h2>
    <div class="journey">
      <div class="journey__bar" role="img" aria-label="${esc(barLabel)}">
        <div class="journey__track"><span class="journey__band" style="--from:${start.low}%;--to:${start.high}%"></span><span class="journey__mid"></span>${early ? '' : `<span class="journey__end" style="--at:${standingScore(end)}%"></span>`}</div>
        <div class="journey__axis" aria-hidden="true"><span>${esc(JOURNEY_BAR_LEGEND.axisLow)}</span><span>${esc(JOURNEY_BAR_LEGEND.axisHigh)}</span></div></div>
      <dl class="journey__legend">
        <div><dt><i class="journey__key journey__key--band" aria-hidden="true"></i>${esc(JOURNEY_BAR_LEGEND.start)}</dt><dd class="grade-line">${gradeChip(c.parentWealth)}<span class="grade-line__range">${glueHtml(`(${bandLabel(start)})`)}</span></dd></div>${early ? '' : `
        <div><dt><i class="journey__key journey__key--end" aria-hidden="true"></i>${esc(JOURNEY_BAR_LEGEND.end)}</dt><dd>${keepStandingHtml(standingLabel(end))}</dd></div>`}
      </dl>
      <p>${keepStandingHtml(journeyText(journey))}</p>${early ? '' : `
      <p>${esc(MOVEMENT_TEXT[movement])}</p><p class="t-xs t-faint">${glueHtml(JOURNEY_NOTE)}</p>`}${note ? `
      ${note}` : ''}
    </div></section>
  <section class="card stack stack--sm ending-stats" aria-labelledby="ending-stats-title"><h2 id="ending-stats-title" class="card__title">${esc(ENDING_HEADINGS.stats)}</h2>${meter('health', 41)}${meter('happy', 72)}${meter('knowledge', 66)}${meter('relation', 80)}${finalNet}
    <dl class="facts"><dt>${esc(DASH_TEXT.profileLooks)}</dt><dd><small>${esc(BIRTH_TEXT.looksSub)}</small> ${keepStandingHtml(standingLabel(looksStanding(c.looks)))}</dd></dl></section>
  <section class="card" aria-labelledby="ending-timeline-title"><h2 id="ending-timeline-title" class="card__title card__title--gap">${esc(ENDING_HEADINGS.timeline)}</h2>${timeline}</section>
  <section class="card"><p class="t-sm t-muted">이 판의 플레이 시간 <strong class="num" style="color:var(--c-text)">27:46</strong> <span class="t-xs t-faint">(일시정지 제외, 이 기기에만 저장)</span></p><p class="mock-tag">시안 주석 · 플레이 시간 줄은 M8(인생 길이 모드) 범위</p></section>
  <section class="rebirth"><button class="btn btn--primary btn--lg btn--block" type="button">${esc(REBIRTH_LABEL)}</button><p class="t-sm t-muted">${esc(REBIRTH_NOTE)}</p></section>
  ${MOCK_TAG}
</main>`;
}

function endingPage() {
  const c = HERO_STATE.character;
  const month = HERO_STATE.report.month;
  const birthRow = { age: 0, kind: 'event', text: HERO.sentence };
  // 기본: 지금 세상 흙수저, 84세 노환, 27번 선택, 최종 순자산 2억 4,000만 원(중앙값 위 — 자리·방향은 함수가 정한다: 「앞선 자리」)
  const main = endingMain({
    era: 'present',
    c,
    month,
    death: { age: 84, cause: '노환' },
    net: 24000,
    choiceCount: 27,
    entries: [
      birthRow,
      // 「나의 기록」 줄(M7c 목표): 제목(짧은 쌍은 Glue)과 글이 세로로 쌓인 두 칸 — 구현 TimelineItem과 같은 구조(강제 줄바꿈 <br> 없음, R-300)
      { age: 5, kind: 'note', title: '나의 기록 · 영유아기 기억', text: '할머니 집 마루에서 수박을 먹던 여름. 매미 소리가 시끄러웠습니다.' },
      { age: 19, kind: 'choice', title: '대학 진학', choice: '학자금 대출을 받아 진학한다', text: '학자금 대출을 받아 대학에 들어갔습니다.' },
      { age: 20, kind: 'stage', text: STAGE_ENTRY_TEXT.youth },
      { age: 29, kind: 'note', title: '나의 기록 · 청년기 연애담', text: '퇴근길에 같이 걷던 저녁이 오래 남았다.' },
      { age: 40, kind: 'stage', text: STAGE_ENTRY_TEXT.middle },
      { age: 52, kind: 'choice', title: '가게', choice: '작은 가게를 연다', text: '작은 가게를 열었습니다.' },
      { age: 65, kind: 'stage', text: STAGE_ENTRY_TEXT.senior },
      { age: 84, kind: 'death', text: deathEntryText('노환') },
    ],
  });
  // zero: 최종 순자산 0원 — 노년 안전망으로 0원에 머문 판(QA-003-M5 O04). 자리는 동률 불리 규칙(마스터 결정 C)의 함수 출력 그대로
  const zeroEnd = finalWealthStanding('present', 0);
  const zero = endingMain({
    era: 'present',
    c,
    month,
    death: { age: 81, cause: '노환' },
    net: 0,
    choiceCount: 24,
    entries: [birthRow, { age: 20, kind: 'stage', text: STAGE_ENTRY_TEXT.youth }, { age: 40, kind: 'stage', text: STAGE_ENTRY_TEXT.middle }, { age: 65, kind: 'stage', text: STAGE_ENTRY_TEXT.senior }, { age: 81, kind: 'death', text: deathEntryText('노환') }],
    note: `<p class="mock-tag">시안 주석 · 0원의 자리 「${esc(standingLabel(zeroEnd))}」는 동률 불리 규칙(마스터 결정 C — 하위는 미만 비율, M7e-3 구현)의 함수 출력입니다. 자리는 이 카드 한 곳에서만 말하고 방향 문장은 중립형입니다.</p>`,
  });
  // past: 지난 세상 인물(birth.html?era=past와 같은 생성기 출력 — 1961년생 흙수저), 음수 순자산 + 「지금 가치로 환산」
  const past = eraModel('past');
  const pastMain = endingMain({
    era: 'past',
    c: past.character,
    month: past.report.month,
    death: { age: 76, cause: '오랜 병환' },
    net: -1200,
    choiceCount: 22,
    entries: [
      { age: 0, kind: 'event', text: birthSentence(past.character, past.report, 'past') },
      { age: 20, kind: 'stage', text: STAGE_ENTRY_TEXT.youth },
      { age: 40, kind: 'stage', text: STAGE_ENTRY_TEXT.middle },
      { age: 65, kind: 'stage', text: STAGE_ENTRY_TEXT.senior },
      { age: 76, kind: 'death', text: deathEntryText('오랜 병환') },
    ],
  });
  // early: 스무 살 전(17세 사고) — 지금 세상 동수저(중앙 구간 「하위 25% 선과 상위 45% 선 사이」), 띠만 있는 막대·금액 없는 최종 순자산 줄
  const earlyBirth = generateBirthFromSeed(EARLY_SEED, 'present');
  const earlyMain = endingMain({
    era: 'present',
    c: earlyBirth.character,
    month: earlyBirth.report.month,
    death: { age: 17, cause: '사고' },
    net: null,
    choiceCount: 3,
    entries: [{ age: 0, kind: 'event', text: birthSentence(earlyBirth.character, earlyBirth.report, 'present') }, { age: 17, kind: 'death', text: deathEntryText('사고') }],
  });
  // down: 지금 세상 은수저(「상위 17~45% 사이」) 70세 병세 악화, 순자산 −500만 원 → 마름모가 띠 왼쪽 밖(「뒤쪽 자리」)
  const downBirth = generateBirthFromSeed(DOWN_SEED, 'present');
  const downMain = endingMain({
    era: 'present',
    c: downBirth.character,
    month: downBirth.report.month,
    death: { age: 70, cause: '병세 악화' },
    net: -500,
    choiceCount: 19,
    entries: [
      { age: 0, kind: 'event', text: birthSentence(downBirth.character, downBirth.report, 'present') },
      { age: 20, kind: 'stage', text: STAGE_ENTRY_TEXT.youth },
      { age: 40, kind: 'stage', text: STAGE_ENTRY_TEXT.middle },
      { age: 65, kind: 'stage', text: STAGE_ENTRY_TEXT.senior },
      { age: 70, kind: 'death', text: deathEntryText('병세 악화') },
    ],
  });
  const head = `<header class="site-head">${headerLogo()}<span class="site-head__name">엔딩</span></header>`;
  const body = `${head}
${main}
<template id="state-zero">${zero}</template>
<template id="state-past">${pastMain}</template>
<template id="state-early">${earlyMain}</template>
<template id="state-down">${downMain}</template>
<script>(function(){var s=new URLSearchParams(location.search).get('state');if(!s)return;var t=document.getElementById('state-'+s);if(!t)return;var main=document.querySelector('main.ending');var nm=t.content.cloneNode(true).querySelector('main.ending');if(main&&nm)main.replaceWith(nm);document.title='수저 게임 · 시안 · 엔딩 ('+s+')';})();</script>
<div class="page-end-space" style="height:40px"></div>`;
  return page({ title: '수저 게임 · 시안 · 엔딩', body });
}

// ---------- 5-1. M5 경제 모델: 영향 줄 · 자산 카드 · 최종 순자산 (economy-m5.html, D-35) ----------
/**
 * M5 시안(SPEC-003 EC5·DB11, docs/design/copy.md 4절): `?state=`로 상태를 고른다 — choice(기본, 47세 보증 결정) · choice-young(13세, 첫 항목 「집안 살림」) · impact-samples(영향 줄 견본 + 문장 42개) ·
 * assets(지금 세상, 음수 순자산) · assets-past(지난 세상, 「지금 가치로 환산」 태그) · assets-big(폭 점검 극단값) · ending · ending-past(음수 + 태그) · ending-early(스무 살 전).
 * 2026-10-18 M5 2b 구현 뒤 손으로 쓰던 파일을 이 생성기로 옮겼다(D-35): 영향 줄·안내 한 줄·자산 카드·상태 도움말·최종 순자산 줄은 **구현의 React 컴포넌트·문구 함수가 만든 마크업 그대로**다
 * (ImpactLine·ImpactHint·AssetsCard·StatusCard·FinalNetLine·IMPACT_SR) — 손으로 적은 문장이 없다. 상태 고르기·엔딩 머리 바꾸기만 시안 전용 스크립트다.
 */
const impactItems = (spec) =>
  spec.split(',').map((part) => {
    const [key, direction, steps] = part.split(':');
    return { key, direction, steps: Number(steps), sr: `${key}.${direction}.${steps}` };
  });
const html = (component, props) => renderToStaticMarkup(createElement(component, props));
const choiceBtn = (n, label, spec, extra = '') =>
  `<button class="choice" type="button"${extra}><span class="choice__no" aria-hidden="true">${n}</span><span class="choice__body"><span class="choice__label">${esc(label)}</span>${html(ImpactLine, { items: impactItems(spec) })}</span></button>`;
/** M7b 시트 시안의 안내 한 줄(copy.md 4-4, r2 마스터 결정 3): 구현 IMPACT_HINT 글자 그대로 — 첫 문장 + 기호 설명(aria-hidden) + 스크린리더 대체 글자. 시트는 가운데 정렬 `.sheet__hint` */
const sheetHint = () => `<p class="sheet__hint">${esc(IMPACT_HINT.lead(HERO.name))} <span aria-hidden="true">${esc(IMPACT_HINT.symbols)}</span><span class="sr-only">${esc(IMPACT_HINT.symbolsSr)}</span></p>`;
const choiceCard = (title, text, buttons) =>
  `<section class="card choice-panel" aria-labelledby="choice-title">
      <span class="choice-panel__kind">${esc(DASH_TEXT.choiceKind)}</span>
      <h2 id="choice-title" class="choice-panel__title">${esc(title)}</h2>
      <p>${esc(text)}</p>
      <div class="choices-list" role="group" aria-label="${esc(DASH_TEXT.choiceGroup)}">
        ${buttons.join('\n        ')}
      </div>
      ${html(ImpactHint, { name: HERO.name })}
    </section>`;
/** 상태 카드(구현 StatusCard — 접이식 도움말은 시안에서 펼쳐 보인다) */
const econStatus = (era, v) => {
  const card = html(StatusCard, { stats: { health: v[0], happiness: v[1], education: v[2], relationships: v[3] }, era });
  return card.replace('<details class="disclosure">', '<details class="disclosure" open>');
};
const econAssets = (era, age, assets) => html(AssetsCard, { age, era, assets: { incomeAdj: 0, dwelling: 'rent', ...assets } });
const econEnding = ({ era, birth, net, tail }) => {
  const title = `${HERO.name}${DASH_TEXT.endingTitleSuffix}`;
  return `<div class="ending__head"><div class="ending__who"><p class="label">${glueHtml(`${ERA_CONFIG[era].label} · ${ENDING_HEAD_LABEL}`)}</p><h1 class="t-title" style="--title-chars:${titleCharsFor(title)}">${esc(title)}</h1><p class="t-muted">${glueHtml(birth)}</p></div></div>
  <section class="card stack stack--sm ending-stats" aria-labelledby="ending-stats-title"><h2 id="ending-stats-title" class="card__title">${esc(ENDING_HEADINGS.stats)}</h2>
    ${meter('health', tail[0])}${meter('happy', tail[1])}${meter('knowledge', tail[2])}${meter('relation', tail[3])}
    ${html(FinalNetLine, { era, net })}
    <dl class="facts"><dt>${esc(DASH_TEXT.profileLooks)}</dt><dd><small>${esc(BIRTH_TEXT.looksSub)}</small> ${tail[4]}</dd></dl>
  </section>`;
};
function economyPage() {
  const T = DASH_TEXT;
  const tpl = (id, attrs, inner) => `<template id="s-${id}"${attrs}>\n${inner}\n</template>`;
  const col = (...parts) => `<div class="col">\n${parts.join('\n')}\n</div>`;
  const tag = (text) => `<p class="mock-tag">${text}</p>`;
  const logPlain = (rows) => `<section class="card log" aria-label="${esc(T.logTitle)}"><h2 class="card__title" style="margin-bottom:var(--sp-2)">${esc(T.logTitle)}</h2><ol class="log__list" role="region" aria-label="${esc(T.logTitle)}" tabindex="0">${rows}</ol></section>`;
  const srList = Object.entries(IMPACT_SR)
    .map(([key, sentence]) => {
      const [k, dir, n] = key.split('.');
      return `<li>${esc(IMPACT_LABEL[k])} ${(dir === 'up' ? '▲' : '▼').repeat(Number(n))} → ${esc(sentence)}</li>`;
    })
    .join('');
  const states = [
    tpl(
      'choice',
      ` data-name="${HERO.name}" data-age="47" data-year="2073"`,
      col(
        choiceCard('보증을 서 달라는 부탁', '가까운 지인이 급하게 돈이 필요하다며 보증을 서 달라고 했다. 거절하기 어려운 사이였다.', [
          choiceBtn(1, '믿고 보증을 선다', 'assets:down:3,debt:up:2,relationships:up:1,happiness:down:2'),
          choiceBtn(2, '빌려줄 만큼만 빌려준다', 'assets:down:2,relationships:up:1'),
          choiceBtn(3, '어렵다고 거절한다', 'assets:up:1,relationships:down:2'),
        ]),
        logPlain(logRow(44, '아이가 중학교에 들어갔습니다.') + logRow(46, '회사에서 맡는 일이 바뀌었습니다.') + logRow(47, '가까운 지인에게 연락이 왔습니다.', '', 'log__row--latest')),
        tag('시안 · 가짜 데이터. 영향 칸 수는 economy-model.md 5-D 변환표에서 읽은 예시이고, 구현에서는 previewChoice 출력이 정본입니다. 첫 선택지의 「부채 ▲▲」는 자산이 모자라 자동 대출이 생기는 사람의 모습이고(EC4), 빚이 늘어나는 해로운 변화라 붉은색입니다(r2).'),
      ),
    ),
    tpl(
      'choice-young',
      ` data-name="${HERO.name}" data-age="13" data-year="2039"`,
      col(
        choiceCard('성적표를 받은 저녁', '성적표를 받은 날 저녁, 식탁에서 공부 이야기가 나왔다. 이번 학기부터 어떻게 할지 정해야 했다.', [
          choiceBtn(1, '방과 후에 따로 배운다', 'family:down:1,happiness:down:2,education:up:2'),
          choiceBtn(2, '혼자 공부한다', 'happiness:up:1,education:up:2'),
        ]),
        tag('시안 · 가짜 데이터. 20세 미만이라 첫 항목 이름이 「집안 살림」입니다. 이 가정 형편(1단계)에서는 자금 조건이 붙은 셋째 선택지(과외)가 보이지 않습니다(EC4, 따로 안내하지 않는다).'),
      ),
    ),
    tpl(
      'impact-samples',
      ` data-name="${HERO.name}" data-age="47" data-year="2073"`,
      col(
        `<section class="card stack stack--sm" aria-label="영향 줄 견본">
      <h2 class="card__title">영향 줄 견본: 항목 1개, 3개, 20세 미만 부채, 6개, 부채 줄어듦, 예비 비활성</h2>
      <p class="t-sm t-muted">같은 줄에서 이웃한 항목 사이에만 「·」가 보이고, 줄이 접히면 첫머리의 기호는 가려진다. 항목(이름 + 기호)은 한 덩어리라 낱말이 끊기지 않는다. 색은 이로운 쪽은 초록, 해로운 쪽은 붉은색으로 돕는 보조 표시라 부채만 ▲가 붉다.</p>
      <div class="choices-list" role="group" aria-label="견본 선택지">
        ${choiceBtn(1, '항목 하나', 'happiness:up:1')}
        ${choiceBtn(2, '항목 셋 (20세 미만)', 'family:down:3,happiness:down:1,education:up:3')}
        ${choiceBtn(3, '20세 미만 대학 진학 (집안 살림과 부채가 함께)', 'family:down:1,debt:up:2,education:up:3')}
        ${choiceBtn(4, '항목 여섯 (가장 긴 경우)', 'assets:down:3,debt:up:3,relationships:down:1,happiness:down:2,health:down:1,education:up:1')}
        ${choiceBtn(5, '부채가 줄어드는 경우', 'assets:down:1,debt:down:2,happiness:up:1')}
        ${choiceBtn(6, '(예비) 지속 비활성 선택지', 'assets:down:2,debt:up:1,happiness:up:1', ' aria-disabled="true" data-unavailable="true"')}
      </div>
    </section>`,
        `<section class="card stack stack--sm" aria-label="스크린리더 문장 견본">
      <h2 class="card__title">읽기 전용 문장 (항목 × 방향 × 칸 수)</h2>
      <p class="t-sm t-muted">눈에 보이는 「자산 ▼▼▼」 대신 스크린리더는 아래 문장을 듣는다. 전체 줄 = 항목 문장을 공백 한 칸으로 이은 것: 「${esc(impactSrText(impactItems('assets:down:3,debt:up:2,relationships:up:1,happiness:down:2')))}」</p>
      <ul class="t-sm" id="sr-samples">${srList}</ul>
    </section>`,
        tag('시안 · 가짜 데이터'),
      ),
    ),
    tpl(
      'assets',
      ` data-name="${HERO.name}" data-age="31" data-year="2057"`,
      col(econStatus('present', [74, 58, 52, 61]), econAssets('present', 31, { net: -1200, income: 3200, debt: 4800 }), tag('시안 · 가짜 데이터. 지금 세상(태그 없음, 단위와 기준은 상태 도움말이 밝힌다). 음수 순자산은 부호 「−」만 쓰고 「빚」으로 바꿔 쓰지 않는다.')),
    ),
    tpl(
      'assets-past',
      ` data-name="${HERO.name}" data-age="51" data-year="2006"`,
      col(econStatus('past', [63, 66, 47, 70]), econAssets('past', 51, { net: 23500, income: 4100, debt: 0 }), tag('시안 · 가짜 데이터. 지난 세상(1955년생): 태그 「지금 가치로 환산」이 금액 묶음 머리에 늘 보이고, 도움말의 단위 문장도 「지금 가치로 환산한」으로 바뀐다. 부채 없음은 「0원」.')),
    ),
    tpl(
      'assets-big',
      ` data-name="${HERO.name}" data-age="64" data-year="2090"`,
      col(econAssets('present', 64, { net: -199999, income: 12000, debt: 324500 }), tag('시안 · 가짜 데이터. 폭 점검용 극단값(3-1절 범위의 끝 −20억). 글자 200% × 폭 320에서 금액 글자 크기가 sm까지 내려가 한 덩어리가 칸에 든다.')),
    ),
    tpl(
      'ending',
      ` data-main-class="ending" data-chrome="ending"`,
      `${econEnding({ era: 'present', birth: '2026년 1월 ~ 2110년 · 84세', net: 12345, tail: [41, 72, 55, 63, '상위 약 32%'] })}
  ${tag('시안 · 가짜 데이터. 엔딩에서 M5가 바꾸는 것은 이 「최종 순자산」 한 줄(M4 「재산」 미터 자리)뿐이다. 나머지 엔딩 디자인은 M7e.')}`,
    ),
    tpl(
      'ending-past',
      ` data-main-class="ending" data-chrome="ending"`,
      `${econEnding({ era: 'past', birth: '1955년 3월 ~ 2031년 · 76세', net: -1200, tail: [22, 48, 39, 57, '하위 약 41%'] })}
  ${tag('시안 · 가짜 데이터. 지난 세상, 음수: 부호 「−」와 태그 「지금 가치로 환산」. 자리 글자는 M7e-3부터 이 줄에 없다(출발선 카드 한 곳).')}`,
    ),
    tpl(
      'ending-early',
      ` data-main-class="ending" data-chrome="ending"`,
      `${econEnding({ era: 'present', birth: '2026년 1월 ~ 2043년 · 17세', net: null, tail: [18, 54, 46, 60, '가운데쯤'] })}
  ${tag('시안 · 가짜 데이터. 스무 살 전에 끝난 인생: 금액도 자리도 말하지 않는다.')}`,
    ),
  ].join('\n\n');
  const script = `<script>
/* 시안 전용: ?state= 로 고른 본문을 <main>에 끼운다(구현은 React 화면). 엔딩 상태는 대시보드 머리·도구 줄 대신 공통 헤더(.site-head)를 둔다. */
(function () {
  var q = new URLSearchParams(location.search); var s = q.get('state') || 'choice';
  var t = document.getElementById('s-' + s) || document.getElementById('s-choice');
  var main = document.getElementById('m5-main');
  main.appendChild(t.content.cloneNode(true));
  main.className = t.getAttribute('data-main-class') || 'dash';
  document.documentElement.setAttribute('data-state', s);
  var head = document.querySelector('.dash-head'), bar = document.querySelector('.toolbar');
  if (t.getAttribute('data-chrome') === 'ending') {
    head.style.display = 'none'; bar.style.display = 'none'; document.querySelector('.page-end-space').style.display = 'none';
    var logo = head.querySelector('svg.logo').cloneNode(true);
    var sh = document.createElement('header'); sh.className = 'site-head'; sh.appendChild(logo);
    var nm = document.createElement('span'); nm.className = 'site-head__name'; nm.textContent = '엔딩'; sh.appendChild(nm);
    main.parentNode.insertBefore(sh, main);
    document.body.classList.remove('is-dash');
  } else {
    head.querySelector('.who__name').textContent = t.getAttribute('data-name');
    head.querySelector('.who__age b').textContent = t.getAttribute('data-age');
    head.querySelector('.year-row .num').textContent = t.getAttribute('data-year') + '년';
  }
})();
</script>`;
  const body = `${dashHead({ age: 31, year: 2057, progress: 38, paused: true, pending: true })}
<main class="dash" id="m5-main"></main>
<div class="page-end-space"></div>

<!-- ===== 상태별 본문 (?state=choice | choice-young | impact-samples | assets | assets-past | assets-big | ending | ending-past | ending-early). 기본은 choice. 영향 줄·카드는 구현 컴포넌트가 만든 마크업이다 ===== -->
${states}

${script}`;
  return page({ title: '수저 게임 · 시안 · M5 경제 모델 (영향 줄 · 자산 카드 · 최종 순자산)', body, bodyClass: 'is-dash' });
}

// ---------- 6. 컴포넌트 갤러리 ----------
const TOKENS = {
  '바탕·면': ['--c-bg', '--c-surface', '--c-surface-2', '--c-border', '--c-border-strong'],
  '글자': ['--c-text', '--c-text-2', '--c-text-3'],
  '브랜드': ['--c-brand', '--c-brand-soft', '--c-accent', '--c-accent-soft', '--c-focus'],
  '상태': ['--c-up', '--c-down', '--c-notice-bg', '--c-stat-health', '--c-stat-happy', '--c-stat-knowledge', '--c-stat-relation'],
  '수저 5단계': ['--c-grade-1', '--c-grade-2', '--c-grade-3', '--c-grade-4', '--c-grade-5'],
};
function componentsPage() {
  const sw = Object.entries(TOKENS)
    .map(([g, list]) => `<section><h2>${g}</h2><div class="swatches">${list.map((t) => `<div class="swatch"><i style="background:var(${t})"></i><span>${t}</span></div>`).join('')}</div></section>`)
    .join('');
  const body = `<main class="board">
  <header><h1 class="t-title">디자인 시스템 · 컴포넌트</h1><p class="t-muted">토큰: src/styles/tokens.css · 스타일: docs/design/mockups/ds.css · 주소 끝에 ?theme=dark</p></header>
  ${sw}
  <section><h2>글자</h2><div class="stack--sm stack"><p class="t-display">수저 게임 52</p><p class="t-title">화면 제목 28px</p><p class="t-h2">카드 제목 22px</p><p>본문 16px — 한 번의 인생을, 끝까지 살아 보는 이야기입니다.</p><p class="t-sm t-muted">보조 설명 14px — 영향 표기와 도움말</p><p class="t-xs t-faint">출처·주석 12px (이보다 작게 쓰지 않습니다)</p></div></section>
  <section><h2>로고</h2><div class="row row--wrap" style="gap:var(--sp-6);align-items:flex-end">${logo(DEFAULT_KEY, 'row')}<span style="--logo-h:40px">${headerLogo()}</span></div>
    <p class="t-sm t-muted" style="margin-top:var(--sp-2)">왼쪽: 가로 로고(정식 심볼, 첫 화면 데스크톱 108px). 오른쪽: 헤더용 로고(단순화 심볼, 모든 화면 헤더 40px — 워드마크 글자 높이 약 23px).</p></section>
  <section id="buttons"><h2>버튼</h2><div class="row row--wrap"><button class="btn btn--primary" type="button">기본</button><button class="btn btn--secondary" type="button">보조</button><button class="btn btn--ghost" type="button">테두리</button><button class="btn" type="button" aria-pressed="true">1배 (눌림)</button><button class="btn" type="button">2배</button><button class="btn btn--primary" type="button" aria-disabled="true">입력 가드 0.4초</button><button class="btn btn--secondary" type="button" aria-disabled="true" data-unavailable="true">${icon('next', 'icon--sm')}<span>${esc(DASH_TEXT.skip)}</span></button><button class="btn btn--primary btn--lg" type="button">크게</button><button class="btn btn--secondary btn--icon" type="button" aria-label="이전">${icon('prev')}</button></div>
    <p class="t-sm t-muted" style="margin-top:var(--sp-2)">눌림 상태는 색 반전 + 굵은 아래 막대 + aria-pressed로 알립니다. 터치 대상은 44×44px 이상. 비활성은 둘: 진입 직후 0.4초 입력 가드(과도 상태)는 0.55 흐림, <strong>지속 비활성</strong>(「다음 결정으로」 — 자동 모드 내내·선택지 대기 중, 「생각 남기기」 — M7c 전)은 옅은 글자(--c-text-3) + 점선 테두리로 글자 4.5:1을 지킵니다(라디오 카드 「준비 중」과 같은 모양, 2026-10-17 — 구현 R-337).</p></section>
  <section id="tools"><h2>도구 줄 (모바일) — BGM 켜짐·다크모드 켜짐 상태, 「생각 남기기」 준비 중(M7c 전)</h2><div class="controls__tools controls__tools--stack" style="max-width:360px">${toolBtn('bgm', 'music', DASH_TEXT.toolBgm, true)}${toolBtn('note', 'pencil', DASH_TEXT.toolNote, false, true)}<button class="btn btn--tool" type="button" aria-pressed="true">${icon('sun')}<span>${esc(DASH_TEXT.toolDark)}</span><span class="sr-only">켜짐</span></button>${toolBtn('feedback', 'message', DASH_TEXT.toolFeedback)}${toolBtn('exit', 'exit', DASH_TEXT.toolExit)}</div>
    <p class="t-sm t-muted" style="margin-top:var(--sp-2)">켜짐 = aria-pressed="true" + 색 반전 + 아래 막대 + 아이콘 교체(다크모드: 달 → 해) + 읽기 전용 「켜짐」. 이름은 낱말 단위로 두 줄까지 줄바꿈. 「생각 남기기」는 M7c까지 지속 비활성(점선·옅은 글자) + 버튼 안 <strong>「준비 중」 알약</strong>(.tool-soon — 라디오 카드 「약 1시간」의 메타 알약과 같은 모양, R-326): 눌러도 아무 일이 없고 접근 가능한 이름은 「생각 남기기 준비 중」. 알약만큼(약 19px) 도구 줄이 높아지는 것은 받아들였다.</p></section>
  <section><h2>수저 5단계 — 재질 색 + 이름 + 점 (아이콘은 칩 변형 실루엣)</h2><div class="row row--wrap">${[1, 2, 3, 4, 5].map((n) => gradeChip(n)).join('')}</div><div class="row row--wrap" style="margin-top:var(--sp-3)">${[1, 2, 3, 4, 5].map((n) => gradeChip(n, { lg: true })).join('')}</div>
    <div class="row row--wrap" style="margin-top:var(--sp-3)">${gradeChip(1, { range: band('present', 1) })}${gradeChip(2, { range: band('present', 2) })}</div>
    <p class="t-sm t-muted" style="margin-top:var(--sp-2)">칩(≤ 24px)은 무늬 없는 실루엣 + 이름 + 점. 구간 글자는 <code>bandLabel(startBandOf(era, wealth))</code> 출력을 칩 뒤 괄호에 — 글로 적으면 「${esc(gradeText(1, band('present', 1)))}」(R-170).</p>
    <div style="margin-top:var(--sp-4);max-width:460px">${spoonLineup()}</div>
    <p class="t-sm t-muted" style="margin-top:var(--sp-2)">32px 이상(첫 화면 띠 32×52)은 큰 변형 <code>sp-N-lg</code>: 닫힌 채움 표식만 — 흙: 담긴 흙 더미 / 동: 표식 없음(무광) / 은: 테두리를 따르는 가는 광택(밝은 채움) / 금: 작은 하이라이트 점(밝은 채움) / 다이아몬드: 마름모 커팅. 선 무늬는 어느 크기에도 없습니다(R-121 마스터 결정). 은·금의 광택은 구멍이 아니라 흰빛 채움이라 다크 테마에서도 광택으로 보입니다.</p>
    <div class="row row--wrap" style="margin-top:var(--sp-4);gap:var(--sp-5);align-items:flex-end;color:#000;background:#fff;padding:var(--sp-3);border:1px solid var(--c-border);border-radius:var(--r-md)">${[1, 2, 3, 4, 5].map((n) => `<span style="display:inline-flex;flex-direction:column;align-items:center;gap:6px;font-size:12px"><svg class="spoon" style="width:40px;height:64px" aria-hidden="true"><use href="#sp-${n}-lg"/></svg><svg class="spoon" aria-hidden="true"><use href="#sp-${n}"/></svg>${['', '흙', '동', '은', '금', '다이아'][n]}</span>`).join('')}<span class="t-xs" style="color:#000">단색(강제 색상·인쇄): 큰 변형 64px 채움 + 밝은 표식 / 칩 변형 24px도 채운 실루엣(외곽선 아님 — R-190). 아이콘만 단독으로 쓰지 않습니다</span></div>
    <p class="t-sm t-muted" style="margin-top:var(--sp-2)">실제 픽셀 크기(DPR 1) 시트: <code>screens/003/spoon-sizes-dpr1.png</code>.</p></section>
  <section><h2>선택 카드 / 라디오</h2><div class="choices choices--2">${radioCard({ name: 'x', title: '선택됨', desc: '두꺼운 테두리 + 체크 + 옅은 면', selected: true })}${radioCard({ name: 'x', title: '선택 안 됨', desc: '얇은 테두리, 체크 없음' })}</div></section>
  <section><h2>상태 바 · 진행률</h2><div class="card stack--sm stack" style="max-width:420px">${meter('health', 82)}${meter('happy', 70)}${meter('knowledge', 38)}${meter('relation', 61)}<div class="year-row"><span class="num">2029년</span><div class="year-progress"><div class="year-progress__fill" style="width:62%"></div></div><span class="year-row__pct num">62%</span></div></div></section>
  <section><h2>영향 표기</h2><p class="t-sm t-muted">구현 ImpactLine 출력(M5, copy.md 4절): 항목은 한 덩어리, 「·」는 CSS, 색은 이로움(초록)·해로움(붉음) — 부채만 ▲가 붉다.</p><div class="stack--sm stack">${html(ImpactLine, { items: impactItems('assets:down:2,happiness:up:1') })}${html(ImpactLine, { items: impactItems('relationships:up:3,health:down:1,education:up:2') })}${html(ImpactLine, { items: impactItems('assets:down:3,debt:up:2,happiness:down:1') })}${html(ImpactLine, { items: impactItems('family:down:1,education:up:2') })}</div></section>
  <section><h2>표 · 입력 · 토글</h2><div class="row row--wrap" style="align-items:flex-start;gap:var(--sp-6)">
    <div style="min-width:280px;flex:1"><table class="table"><thead><tr><th>항목</th><th class="num">올해 출생아 평균</th><th class="num">이 아이</th></tr></thead><tbody><tr><th scope="row">기대수명</th><td class="num">84.0세</td><td class="num"><strong>81.2세</strong></td></tr><tr><th scope="row">대학 진학률</th><td class="num">73%</td><td class="num"><strong>58%</strong></td></tr></tbody></table></div>
    <div style="min-width:240px;flex:1" class="stack--sm stack"><div class="field"><label class="label" for="c1">기록</label><textarea id="c1" class="field__input" rows="2">입력란은 2px 강한 테두리</textarea><div class="field__hint"><span>안내 문구</span><span class="num">13/140</span></div></div>
      <span class="toggle is-on"><span class="toggle__track"><span class="toggle__thumb">${icon('check')}</span></span><span class="toggle__state">켬</span><span>BGM</span></span>
      <span class="toggle"><span class="toggle__track"><span class="toggle__thumb">${icon('check')}</span></span><span class="toggle__state">끔</span><span>자동 모드</span></span></div></div></section>
  <section><h2>캐러셀 카드 머리(자동 넘김 ${CAROUSEL_SEC}초, 지표 ${CAROUSEL_TOTAL}개) · 점(5개 이하일 때만)</h2><div class="carousel__head" style="max-width:420px"><div class="carousel__heading"><span class="card__title">한국 사회 통계</span><span class="carousel__note">${CAROUSEL_SEC}초마다 다음 지표</span></div><div class="carousel__ctrl"><button class="btn btn--secondary btn--icon" type="button" aria-label="이전 지표">${icon('prev')}</button><span class="carousel__status num" aria-hidden="true">3 / ${CAROUSEL_TOTAL}</span><button class="btn btn--secondary btn--icon" type="button" aria-label="다음 지표">${icon('forward')}</button><button class="btn btn--secondary btn--icon carousel__pause" type="button" aria-label="자동 넘김 일시정지">${icon('pause')}</button></div></div>
    <p class="t-sm t-muted" style="margin-top:var(--sp-2)">조작 줄은 카드 머리에 있다(R-200) — 슬라이드 높이가 달라도 같은 자리, 하단 띠에 가려지지 않는다. 좁으면 조작 줄이 아래로 내려와 가로 전체를 쓴다. 값 줄과 기준 줄은 나눈다: 「27.8<small>명</small>」 / 「인구 10만 명당 · 2025년 기준」(QM2-4), 짧은 쌍은 칸이 좁으면 두 줄(QM2-10).</p>
    <div class="dots" style="max-width:320px;margin-top:var(--sp-3)">${Array.from({ length: 5 }, (_, i) => `<button type="button" aria-label="${i + 1}/5" ${i === 3 ? 'aria-current="true"' : ''}><i></i></button>`).join('')}</div></section>
  <section><h2>하단 고정 띠 (높이를 --bar-h로 알리고 본문 끝 여백·scroll-padding이 따른다 — CM10·QM2-12)</h2><div class="card" style="position:relative;height:150px;overflow:hidden"><p class="t-muted">본문…</p><div class="bottom-bar" style="position:absolute"><button class="btn btn--primary btn--lg" type="button">태어나기</button></div></div>
    <div class="card" style="position:relative;height:200px;overflow:hidden;margin-top:var(--sp-3)"><p class="t-muted">확인 단계 — 맨 아래는 안전한 「돌아가기」(기본), 그 위가 이전 판을 지우는 확인(보조)</p><div class="bottom-bar" style="position:absolute"><p class="bottom-bar__ask" role="alert">이전 판이 사라집니다. 새로 태어날까요?</p><div class="bottom-bar__stack"><button class="btn btn--secondary" type="button">이전 판 지우고 태어나기</button><button class="btn btn--primary btn--lg" type="button">돌아가기</button></div></div></div></section>
  <section><h2>인용 박스 · 프로필 얼굴</h2><div class="row row--wrap" style="align-items:flex-start;gap:var(--sp-6)"><div class="cite" style="max-width:420px"><p class="cite__text">통계·연구 요약 문장(100자 이하).</p><p class="cite__src">기관·저자(연도), 자료 이름</p></div>${face('young', 'male', 4, '청년 남성 얼굴 예시', 'face--lg')}${face('middle', 'female', 2, '중년 여성 얼굴 예시', 'face--lg')}</div></section>
</main>`;
  return page({ title: '수저 게임 · 디자인 시스템 · 컴포넌트', body });
}

// ---------- 7. 심볼 확정판 ----------
function symbolsPage() {
  const asset = (rel) => `../../../src/assets/${rel}`;
  const k = DEFAULT_KEY;
  const ladder = [180, 96, 64, 48].map((px) => `<figure><img src="${asset(`symbol-${k}.svg`)}" height="${px}" alt=""><figcaption>${px}</figcaption></figure>`).join('');
  const smallLadder = [64, 48, 40, 32, 28, 24, 16].map((px) => `<figure><img src="${asset(`brand/${k}/symbol-small.svg`)}" height="${px}" alt=""><figcaption>${px}</figcaption></figure>`).join('');
  const fav = [32, 24, 16].map((px) => `<figure><img src="${asset(`brand/${k}/favicon.svg`)}" width="${px}" height="${px}" alt=""><figcaption>파비콘 ${px}</figcaption></figure>`).join('');
  const body = `<main class="board" style="max-width:1100px"><header><h1 class="t-title">수저 게임 · 심볼 확정판 — A안 「담긴 땅」</h1>
  <p class="t-muted">형진 님 선택(2026-10-15). 비스듬히 선 숟가락의 머리 안에 한반도가 비어 있습니다(음각) — 태어날 때 쥐는 숟가락 안에 이 땅의 인생이 들어 있다는 뜻. 한반도 윤곽은 하나의 실루엣이며 분단선·국경선·행정 경계가 없습니다. 색은 쪽빛 한 가지(다크는 크림색, 단색판은 현재 글자색).</p></header>
  <div class="sym-grid sym-grid--2">
    <article class="sym-card"><h3>정식 심볼 (≥ 48px: 첫 화면·앱 아이콘·터치 아이콘)</h3>
      <img src="${asset(`symbol-${k}.svg`)}" height="260" alt="수저 게임 심볼 A안 정식">
      <p class="t-sm concept">머리 안 지도의 높이 = 머리 높이의 74%(기준 70% 이상). 제주·울릉도·독도를 실제 위치에, 면적은 제주 > 울릉도 > 독도(제주가 울릉도의 2배 이상)로 둡니다. 96px부터 제주가, 180px부터 세 섬이 보입니다.</p>
      <div class="ladder">${ladder}</div>
      <div class="ladder"><figure><img class="tile" src="${asset(`brand/${k}/app-icon.svg`)}" width="96" height="96" alt=""><figcaption>앱 아이콘 96</figcaption></figure><figure><img class="tile" src="${asset(`brand/${k}/apple-touch-icon.png`)}" width="60" height="60" alt=""><figcaption>터치 아이콘 60</figcaption></figure></div>
      <img src="${asset(`logo-${k}.svg`)}" height="108" alt="수저 게임 가로 로고 (첫 화면 데스크톱 108px)">
      <img src="${asset(`brand/${k}/logo-stacked.svg`)}" height="200" alt="수저 게임 세로 로고 (첫 화면 모바일)">
      <div class="row-dark"><img src="${asset(`brand/${k}/symbol-dark.svg`)}" height="72" alt=""><img src="${asset(`brand/${k}/logo-dark.svg`)}" height="44" alt=""></div>
      <div class="row-mono"><img src="${asset(`brand/${k}/symbol-mono.svg`)}" height="64" alt=""><span class="t-xs">단색(강제 색상·인쇄): 현재 글자색</span></div></article>
    <article class="sym-card"><h3>단순화 심볼 (≤ 40px: 모든 화면 헤더·파비콘)</h3>
      <img src="${asset(`brand/${k}/symbol-small.svg`)}" height="160" alt="수저 게임 심볼 A안 단순화">
      <p class="t-sm concept">지도 윤곽을 14점으로 줄이고 섬을 생략했습니다(세 섬 모두 1px 미만이라 얼룩으로만 보임 — 영토 표현의 의도가 아니며 정식 심볼에는 세 섬이 있습니다). 머리를 키우고 자루를 조금 굵게 해 28px에서도 금 간 숟가락·번개·열쇠로 읽히지 않습니다.</p>
      <div class="ladder">${smallLadder}</div>
      <div class="ladder">${fav}</div>
      <img src="${asset(`brand/${k}/logo-header.svg`)}" height="40" alt="수저 게임 헤더 로고 40px">
      <p class="t-xs t-faint">헤더 로고 40px — 워드마크 글자 높이 약 23px(기준 ≥ 22px)</p>
      <img src="${asset(`brand/${k}/logo-header.svg`)}" height="28" alt="수저 게임 헤더 로고 28px (참고: 쓰지 않는 크기)">
      <p class="t-xs t-faint">(참고) 28px에서도 읽히지만 헤더 최소 높이는 40px입니다</p>
      <div class="row-dark"><img src="${asset(`brand/${k}/logo-header-dark.svg`)}" height="40" alt=""></div>
      <div class="row-mono"><img src="${asset(`brand/${k}/symbol-small-mono.svg`)}" height="40" alt=""><img src="${asset(`brand/${k}/logo-header-mono.svg`)}" height="40" alt=""><span class="t-xs">단색</span></div>
      <dl class="checks"><dt>금지</dt><dd>한반도 실루엣을 숟가락 없이 단독으로 쓰지 않는다(한반도기 구성과 겹침). 하늘색·연파랑 계열로 칠하지 않는다. 기울이거나 늘이거나 색을 바꾸지 않는다(토큰 --c-logo만).</dd><dt>고르지 않은 안</dt><dd>B 「상 위에」·C 「상차림」은 docs/design/archive/brand-bc/ 에만 남아 있고 구현 코드는 참조하지 않는다.</dd></dl></article>
  </div></main>`;
  return page({ title: '수저 게임 · 심볼 확정판', body });
}

// ---------- 8. 얼굴 시트 ----------
function faceSheetPage(all) {
  const tiers = all ? [1, 2, 3, 4, 5] : [1, 3, 5];
  const tierLabel = { 1: '하위 10%', 2: '하위 10~30%', 3: '가운데 40%', 4: '상위 10~30%', 5: '상위 10%' };
  const css = `.face-sheet{grid-template-columns:5.2rem repeat(${2 * tiers.length},minmax(0,1fr))}@media (max-width:959px){.face-sheet{grid-template-columns:3.2rem repeat(${2 * tiers.length},minmax(0,1fr))}}`;
  // 1행: 빈 칸 + 「여성」「남성」(각 tiers 칸 병합). 2행: 빈 칸(행 머리 자리) + 단계 이름 ×2
  let cells = `<div></div>${['여성', '남성'].map((g) => `<div class="span3" style="grid-column:span ${tiers.length}">${g}</div>`).join('')}<div></div>`;
  for (let col = 0; col < 2; col++) for (const t of tiers) cells += `<div class="colhead">${tierLabel[t]}</div>`;
  for (const ag of AGE_GROUPS) {
    const range = { infant: '0~2세', toddler: '3~6세', child: '7~12세', teen: '13~19세', young: '20~39세', middle: '40~59세', senior: '60~74세', elder: '75세~' }[ag.id];
    cells += `<div class="rowhead">${ag.label}<br><span class="t-xs t-faint" style="font-weight:400">${range}</span></div>`;
    for (const g of ['female', 'male']) for (const t of tiers) cells += `<div class="face">${faceSvg({ ageGroup: ag.id, gender: g, tier: t }, { label: `${ag.label} ${g === 'female' ? '여성' : '남성'} 외모 ${t}단계` })}</div>`;
  }
  const body = `<style>${css}</style><main class="board" style="max-width:${all ? 1240 : 1100}px"><header><h1 class="t-title">캐릭터 얼굴 시트 · ${all ? '80조합 전체' : '48면 (연령대 8 × 성별 2 × 외모 상·중·하)'}</h1>
  <p class="t-muted">외모 단계가 높을수록 머리숱(실루엣 부피)이 풍성하고 이목구비 선이 굵고 진합니다. 머리색·채움 농도, 눈·코·입의 자리와 부품, 표정, 피부색은 모든 단계에서 같고, 주름·흰머리는 연령대만 정합니다.</p></header>
  <div class="face-sheet" role="img" aria-label="연령대별·성별·외모 단계별 얼굴 그림 모음">${cells}</div></main>`;
  return page({ title: `수저 게임 · 얼굴 시트 ${all ? '80조합' : '48면'}`, body });
}

// ---------- 9. 수저 아이콘 실제 크기 시트 (DPR 1로 찍는다: scripts/design/shootSpoonSizes.mjs) ----------
/**
 * 16·20·24px = 칩 변형 sp-N만(쓰는 크기), 32·48px = 큰 변형 sp-N-lg(쓰는 크기) + 참고로 실루엣. 마지막 두 줄은 실제 칩 24px·큰 칩 32px(아이콘 + 이름 + 점).
 * 칩 변형 줄은 실제 칩과 같은 CSS 경로(.grade svg.spoon)를 타도록 테두리·바탕을 뺀 .grade 껍데기(.grade--bare)에 넣고, 큰 변형 줄은 첫 화면 띠와 같은 .spoon-fig에 넣는다 —
 * 강제 색상·단색에서 칩 밖 아이콘 줄과 칩 안이 다르게 보이지 않게(REV-003-D-3 R-190). ?mono=1 이면 단색(검정 글자·흰 바탕). 다크는 ?theme=dark, 강제 색상은 Playwright 에뮬레이션.
 */
function spoonSizesPage() {
  const sizes = [16, 20, 24, 32, 48];
  const w = (h) => Math.round((h * 20) / 32 * 100) / 100;
  const sp = (n, h, lg) => `<svg class="spoon sheet-sp${lg ? ' spoon--lg' : ''}" style="width:${w(h)}px;height:${h}px" aria-hidden="true"><use href="#sp-${n}${lg ? '-lg' : ''}"/></svg>`;
  const five = (h, lg) =>
    `<span class="five">${[1, 2, 3, 4, 5].map((n) => (lg ? `<span class="spoon-fig grade--${n} fig">${sp(n, h, lg)}</span>` : `<span class="grade grade--${n} grade--bare fig">${sp(n, h, lg)}</span>`)).join('')}</span>`;
  const rows = sizes
    .map((h) => {
      const lg = h >= 32;
      return `<tr><th><b>${h}px</b><br><span class="t-xs t-faint">${lg ? '큰 변형 sp-N-lg' : '칩 변형 sp-N'}</span></th><td>${five(h, lg)}</td><td>${lg ? five(h, false) : ''}</td></tr>`;
    })
    .join('');
  const chips = `<tr><th><b>칩 24px</b><br><span class="t-xs t-faint">실제 조합</span></th><td colspan="2"><span class="chips">${[1, 2, 3, 4, 5].map((n) => gradeChip(n)).join('')}</span></td></tr>
    <tr><th><b>큰 칩 32px</b><br><span class="t-xs t-faint">실제 조합(출생신고)</span></th><td colspan="2"><span class="chips">${[1, 2, 3, 4, 5].map((n) => gradeChip(n, { lg: true })).join('')}</span></td></tr>`;
  const head = `<style>
    .sheet{padding:10px 12px;display:inline-block}
    .sheet table{border-collapse:collapse}.sheet th{text-align:left;padding:5px 10px 5px 0;font-size:12px;line-height:1.3;font-weight:400;white-space:nowrap;vertical-align:middle}.sheet td{padding:5px 14px 5px 0;vertical-align:middle}
    .sheet thead th{color:var(--c-text-2)}
    .five{display:inline-flex;gap:10px;align-items:flex-end}.fig{display:inline-flex;color:var(--grade-solid)}
    .sheet .grade--bare{padding:0;border:0;border-radius:0;background:none;gap:0;line-height:0}
    .sheet .spoon-fig{gap:0;padding:0}
    .chips{display:inline-flex;flex-wrap:wrap;gap:6px;max-width:560px}
    .sheet-sp{display:block}
    body.mono{background:#fff;color:#000}body.mono .fig{color:#000}
    body.mono .grade{border-color:#000;background:#fff;color:#000}body.mono .grade svg.spoon{color:#000}body.mono .grade__dots i{border-color:#000}body.mono .grade__dots i.on{background:#000}
    body.mono .t-faint,body.mono thead th{color:#000}
  </style><script>if(new URLSearchParams(location.search).get('mono')==='1')document.addEventListener('DOMContentLoaded',function(){document.body.classList.add('mono')});</script>`;
  const body = `<div class="sheet"><table><thead><tr><th>높이</th><th>쓰는 변형</th><th>참고: 같은 크기의 실루엣(sp-N)</th></tr></thead><tbody>${rows}${chips}</tbody></table></div>`;
  return page({ title: '수저 게임 · 수저 아이콘 실제 크기 시트', body, head });
}

// ---------- 출력 ----------
write('title-a.html', titlePage(DEFAULT_KEY));
write('title-continue.html', titlePage(DEFAULT_KEY, 'continue'));
write('roulette-spin.html', roulettePage('spin'));
write('roulette-result.html', roulettePage('stop'));
write('roulette-result-reduced.html', roulettePage('reduced'));
write('spoon-sizes.html', spoonSizesPage());
write('birth.html', birthPage());
write('dashboard-infant.html', dashboardPage('infant'));
write('dashboard-adult.html', dashboardPage('adult'));
write('system.html', systemPage());
write('decision-infant.html', dashboardPage('infant', infantSheet()));
write('decision-adult.html', dashboardPage('adult', adultSheet()));
write('note.html', dashboardPage('infant', noteSheet(), 5, { noteReady: true })); // M7c 목표 모습: 자유 기록 카드가 떠 있으므로 도구 줄의 「생각 남기기」는 보통 버튼
write('ending.html', endingPage());
write('components.html', componentsPage());
write('economy-m5.html', economyPage());
write('symbols.html', symbolsPage());
write('faces.html', faceSheetPage(false));
write('faces-all.html', faceSheetPage(true));
console.log('mockups written');
