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
import { AGE_GROUPS, faceSvg } from '../../src/assets/faces/faceLayers.ts';
import { generateBirthFromSeed, looksStanding } from '../../src/core/birth.ts';
import { birthSentence, isValidBirthReport, reportPlaceLabel, weightStanding } from '../../src/core/birthReport.ts';
import { AUTO_ADVANCE_MS, LINE_H_STACKED, LINE_W, buildCarousel, valueWidthEm } from '../../src/core/carousel.ts';
import { startBandOf } from '../../src/core/ending.ts';
import { glueSegments, splitPair } from '../../src/core/glue.ts';
import { peersOf } from '../../src/core/peers.ts';
import { ROULETTE_TIMING, buildRoulette, reelPosition } from '../../src/core/roulette.ts';
import { ERAS, LIFE_LENGTHS, isLifeLengthSelectable } from '../../src/core/types.ts';
import { buildComparison, compareShown, lifeGapLine } from '../../src/data/birthCompare.ts';
import { OCCUPATION_LABEL } from '../../src/data/birthReportTable.ts';
import { BIRTH_TEXT, GRADE_NAME, REPORT_NOTES, ROULETTE_TEXT, ROULETTE_TITLE_CHARS, formatKg, genderLabel, housingText, orderText, parentingDocText, regionOddsNote, yearMonthText } from '../../src/data/birthReportText.ts';
import { PARENTING_LABEL, standingLabel } from '../../src/data/birthText.ts';
import { ERA_CONFIG } from '../../src/data/birthTable.ts';
import { ENDING_HEADINGS, JOURNEY_NOTE, MOVEMENT_TEXT, REBIRTH_LABEL, REBIRTH_NOTE, bandLabel, choiceCountText, deathLineText, journeyText } from '../../src/data/endingText.ts';
import { getCarouselIndicators, getRegionFootnote, getUsableIndicator } from '../../src/data/koreaStatsAccess.ts';
import { deathEntryText } from '../../src/data/lifeText.ts';
import { placeLabel } from '../../src/data/regionNames.ts';
import { LIFE_LENGTH_TEXT, NOT_READY_TEXT, TITLE_TEXT, eraMetaText, footerStatsText, heroTagKeepParts } from '../../src/data/titleText.ts';
import { restCells, spinCells, spinCycles } from '../../src/ui/Reel.tsx';
import { DEFAULT_KEY, GRADES, ROOT, esc, face, fitPair, gradeChip, gradeLine, gradeText, headerLogo, icon, impact, logo, MOCK_TAG, meter, page, reelSpoon, spoon, spoonLineup } from './mockLib.mjs';

const OUT = ROOT + 'docs/design/mockups/';
const write = (name, html) => writeFileSync(OUT + name, html, 'utf-8');
const NAMES_META = JSON.parse(readFileSync(ROOT + 'src/data/names.json', 'utf-8')).meta;
/** 수저 구간 글자의 단일 출처(R-170): bandLabel(startBandOf(era, wealth)). 시안은 이 함수 출력만 적는다 — 「약 N%」(standingLabel)는 외모·체중·엔딩 도착 자리 전용 */
const band = (era, wealth) => bandLabel(startBandOf(era, wealth));

// ---------- 가짜 인물 데이터 (화면 사이에서 일치) ----------
/** 가상 인구(시안용 고정값 — 구현은 core/population.ts#tryVirtualPopulation이 이 기기의 시각으로 계산한다). 첫 화면·대시보드 인생 기록 고정 줄이 같은 값을 쓴다 */
const N_POP = '51,284';
/** 엔딩 도착 자리(시안용 가짜 값) — 화면 글자·읽기용 설명 모두 standingLabel(END_STANDING) 출력으로 적는다(R-191(d)) */
const END_STANDING = { kind: 'top', percent: 38, within: false };
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
    endRank: standingLabel(END_STANDING), // 「상위 약 38%」
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
/** 도구 줄 버튼. id는 시안 스크립트(다크 켜짐 표시)용. pressed = 켜짐(aria-pressed) */
const toolBtn = (id, iconName, label, pressed = false) => `<button class="btn btn--tool" type="button" data-tool="${id}" ${pressed ? 'aria-pressed="true"' : 'aria-pressed="false"'}>${icon(iconName)}<span>${label}</span><span class="sr-only">${pressed ? '켜짐' : ''}</span></button>`;

function dashHead({ age, year, progress, paused }) {
  return `<header class="dash-head"><div class="dash-head__inner">
    <div class="dash-head__top">${headerLogo()}
      <div class="who"><span class="who__name">${HERO.name}</span><span class="who__age"><b>${age}</b>세</span></div></div>
    <div class="year-row"><span class="num">${year}년</span>
      <div class="year-progress" role="progressbar" aria-label="올해 진행률" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progress}"><div class="year-progress__fill" style="width:${progress}%"></div></div>
      <span class="year-row__pct num">${progress}%</span></div>
  </div></header>
  <div class="toolbar"><div class="toolbar__inner">
    <div class="controls-fixed">
      <div class="controls__speed">
        <button class="btn btn--sm" type="button" ${paused ? 'aria-pressed="true"' : ''}>${icon(paused ? 'play' : 'pause', 'icon--sm')}<span>${paused ? '다시 진행' : '일시정지'}</span></button>
        <button class="btn btn--sm" type="button" aria-pressed="true">1배</button><button class="btn btn--sm" type="button">2배</button><button class="btn btn--sm" type="button">4배</button><button class="btn btn--sm" type="button">8배</button>
      </div>
      <div class="controls__more">
        <button class="btn btn--sm btn--secondary" type="button">${icon('next', 'icon--sm')}<span>다음 결정으로</span></button>
        <button class="btn btn--sm btn--secondary" type="button" aria-pressed="false">${icon('auto', 'icon--sm')}<span>자동 모드 꺼짐</span></button>
      </div>
    </div>
    <div class="controls__tools">
      ${toolBtn('bgm', 'music', 'BGM')}${toolBtn('note', 'pencil', '생각 남기기')}${toolBtn('dark', 'moon', '다크 모드')}${toolBtn('feedback', 'message', '의견 보내기')}${toolBtn('exit', 'exit', '나가기')}
    </div>
  </div></div>`;
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

const statusCard = (v) => `<section class="card stack--sm stack" aria-label="상태"><div class="card__head" style="margin:0"><h2 class="card__title">상태</h2></div>
  ${meter('health', v[0])}${meter('happy', v[1])}${meter('knowledge', v[2])}${meter('relation', v[3])}
  <details class="disclosure"><summary>상태 네 가지의 뜻 보기</summary><p>0에서 100 사이의 값입니다. 건강은 몸의 상태, 행복은 마음의 만족, 지식은 배우고 익힌 정도, 관계는 가족·친구와의 유대입니다. 자산은 올해 가치 기준의 원 단위입니다.</p></details></section>`;

/** 20세 미만 자산 현황: 문장만. 수저 칩은 두지 않는다(출신 가정은 프로필 카드에만 — C4·R-136 허용 목록, REV-003-D-2 R-170 마스터 결정) */
const assetsInfant = `<section class="card" aria-label="자산 현황"><h2 class="card__title" style="margin-bottom:var(--sp-2)">자산 현황</h2>
  <p class="t-sm t-muted">자산은 스무 살부터 셉니다. 지금은 집안 형편을 따릅니다.</p></section>`;

const assetsAdult = `<section class="card" aria-label="자산 현황"><div class="card__head" style="margin-bottom:var(--sp-3)"><h2 class="card__title">자산 현황</h2><span class="tag">올해 가치 기준</span></div>
  <dl class="assets"><div class="assets__row"><dt>순자산</dt><dd class="neg">−1,200만 원</dd></div><div class="assets__row"><dt>연 소득</dt><dd>3,200만 원</dd></div><div class="assets__row"><dt>부채</dt><dd>4,800만 원</dd></div></dl>
  <p class="t-xs t-faint" style="margin-top:var(--sp-2)">순자산 = 가진 것 − 부채. 마이너스는 빚이 더 많다는 뜻입니다.</p></section>`;

const logRow = (age, text, extra = '', cls = '') => `<li class="log__row ${cls}"><span class="log__age">${age}세</span><span class="log__text">${text}${extra ? ` <em>${extra}</em>` : ''}</span></li>`;
const logNote = (age, topic, text) => `<li class="log__row log__row--note"><span class="log__age">${age}세</span><span class="log__text"><span class="log__note-label">${icon('pencil', 'icon--sm')}나의 기록 · ${topic}</span><br>${esc(text)}</span></li>`;

function logCard(rowsHtml, newCount) {
  return `<section class="card log" aria-label="인생 기록"><div class="card__head" style="margin-bottom:var(--sp-2)"><h2 class="card__title">인생 기록</h2><span class="t-xs t-faint">시간순 · 위로 스크롤하면 지난 기록</span></div>
  <p class="log__pin">이 세상의 가상 인구 <strong class="num">${N_POP}명</strong> · ${HERO.name}도 그중 한 사람</p>
  <ol class="log__list" aria-live="polite" aria-relevant="additions">${rowsHtml}</ol>
  ${newCount ? `<button class="btn btn--secondary btn--sm log__jump" type="button">새 기록 ${newCount}개 · 맨 아래로</button>` : ''}</section>`;
}

/** 식구: 부모 나이는 출생신고(어머니 29·아버지 32, 2026년)에서 해마다 오른다 */
const familyCard = (age) => `<section class="card family" aria-label="식구"><h2 class="card__title" style="margin-bottom:var(--sp-3)">식구</h2>
  <dl class="family-list">
    <dt>어머니</dt><dd>${HERO.motherAge + age}세<small>${HERO.motherJob} · 건강함</small></dd>
    <dt>아버지</dt><dd>${HERO.fatherAge + age}세<small>${HERO.fatherJob} · 건강함</small></dd>
    <dt>형제자매</dt><dd>${age >= 20 ? `남동생 ${age - 3}세 <small>3세 아래</small>` : '남동생 <small>이제 막 태어남</small>'}</dd>
    ${age >= 20 ? '<dt>배우자</dt><dd>없음</dd><dt>자녀</dt><dd>없음</dd>' : ''}
  </dl></section>`;

function peersCard(labels) {
  // 또래 한 줄의 구조는 출생신고(M3 구현)와 같다: 이름 옆 「여성/남성」, 장소는 다음 줄(R-269). 「요즘 모습」 라벨 자리는 M4 몫
  const rows = PEERS.map(([n, s, g], i) => `<li><div class="people__who"><div class="people__line"><span class="name">${esc(n)}</span> <span class="sub">${esc(g)}</span></div><div class="sub">${esc(s)}</div></div><span class="t-sm t-muted">${labels[i]}</span></li>`).join('');
  return `<section class="card" aria-label="같은 해 태어난 사람들"><div class="card__head" style="margin-bottom:var(--sp-1)"><h2 class="card__title">같은 해 태어난 사람들</h2><span class="t-xs t-faint" style="flex-basis:100%">요즘 모습</span></div><ul class="people">${rows}</ul><p class="t-xs t-faint">나이와 수저에 따라 정한 설계값입니다(통계가 아님).</p></section>`;
}

function infantSheet() {
  return `<div class="overlay" role="dialog" aria-modal="true" aria-labelledby="dc-title"><div class="sheet">
    <div class="sheet__head"><span class="sheet__kind">중대 결정</span><div class="row"><span class="sheet__age">2029년 · 3세</span><button class="btn btn--ghost btn--sm" type="button">카드 접기 ▾</button></div></div>
    <div class="sheet__body">
      <div class="stack--sm stack"><h2 id="dc-title" class="t-title" style="font-size:var(--fs-2xl)">동생을 맞이했습니다</h2>
      <p>${HERO.name}은 동생을 처음 봤습니다. 부모님의 애정이 줄어든 것처럼 느껴집니다.</p></div>
      <div class="cite"><p class="cite__text">동생이 태어난 뒤 첫째가 관심을 끌려는 행동이나 이전 행동으로 돌아가는 모습을 보이는 일은 흔한 것으로 알려져 있습니다. <span class="t-faint" style="color:inherit;opacity:.8">(시안용 문구)</span></p><p class="cite__src">기관·저자(연도), 자료 이름 · 구현 때 근거 행에서 채움</p></div>
      <div class="choices-list" role="group" aria-label="선택지">
        <button class="choice" type="button"><span class="choice__no">1</span><span class="choice__body"><span class="choice__label">엄마가 동생을 살피면 운다</span>${impact([['관계', 'down', 1], ['행복', 'up', 1]])}</span></button>
        <button class="choice" type="button"><span class="choice__no">2</span><span class="choice__body"><span class="choice__label">동생을 예뻐해 준다</span>${impact([['관계', 'up', 2], ['행복', 'down', 1]])}</span></button>
        <button class="choice" type="button"><span class="choice__no">3</span><span class="choice__body"><span class="choice__label">동생의 장난감을 빼앗는다</span>${impact([['행복', 'up', 1], ['관계', 'down', 2]])}</span></button>
      </div>
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
        <button class="choice" type="button"><span class="choice__no">1</span><span class="choice__body"><span class="choice__label">연애를 시작한다</span>${impact([['자산', 'down', 2], ['관계', 'up', 2], ['행복', 'up', 1]])}</span></button>
        <button class="choice" type="button"><span class="choice__no">2</span><span class="choice__body"><span class="choice__label">썸으로 남긴다</span>${impact([['관계', 'up', 1], ['행복', 'down', 1]])}</span></button>
        <button class="choice" type="button"><span class="choice__no">3</span><span class="choice__body"><span class="choice__label">마음을 접는다</span>${impact([['자산', 'up', 1], ['행복', 'down', 2]])}</span></button>
      </div>
      <p class="sheet__hint">선택지 아래 글씨는 지금 ${HERO.name}에게 일어날 변화입니다.</p>
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

function dashboardPage(kind, overlay = '', infantAge = 3) {
  const infant = kind === 'infant';
  const age = infant ? infantAge : 31;
  const head = dashHead({ age, year: HERO.birthYear + age, progress: infant ? 62 : 38, paused: overlay !== '' });
  const rowsInfant =
    logRow(0, esc(HERO.sentence)) + // 인생 기록 0세 첫 줄 = 출생신고 서술문(BR3, core/birthReport.ts#birthSentence)
    logRow(0, '기본 예방접종을 받았습니다.') +
    logRow(1, '첫 걸음마를 뗐습니다. 온 가족이 박수를 쳤습니다.') +
    logRow(1, '첫 단어를 말했습니다. ‘엄마’라는 뜻의 말이었습니다.') +
    logRow(2, '엄마와 즐거운 시간을 보냈습니다.') +
    logRow(3, '동생을 맞이했습니다.', '', 'log__row--latest');
  const rowsAdult =
    `<li class="log__row log__row--stage"><span class="log__text">20대 · 청년기</span></li>` +
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
    ${infant ? assetsInfant : assetsAdult}
  </div>
  <div class="col">${logCard(infant ? rowsInfant : rowsAdult, infant ? 0 : 2)}</div>
  <div class="col">
    ${familyCard(age)}
    ${peersCard(infant ? ['어린 시절', '어린 시절', '어린 시절', '어린 시절'] : ['일하는 사람', '구직 중', '일하는 사람', '돌봄'])}
    ${MOCK_TAG}
  </div>
</main>
<div style="height:150px"></div>
${overlay}`;
  return page({ title: `수저 게임 · 시안 · 대시보드 (${infant ? '영유아 시점' : '성인 시점'})`, body, bodyClass: 'is-dash' });
}

// ---------- 5. 엔딩 ----------
/**
 * 회고 문장(사망·선택 수·출발선 대비·방향·주석)과 연표 사망 줄은 src/data/endingText.ts·lifeText.ts의 함수 출력 그대로다(R-091·R-170) — 디자인에서 다른 말로 바꾸지 않는다.
 * 어체는 SPEC-003 C1·M7e에 따라 합쇼체로 바뀌며, 그때 화면은 함수 출력을 따른다(지금 시안은 M7e 전 현행 출력 = 해라체, R-191). 다시 태어나기 안내는 REBIRTH_NOTE(FR9).
 * 출발선 = band(era, grade)(지금 세상 1단계 「하위 25% 안쪽」), 도착 = standingLabel(END_STANDING)(「상위 약 38%」, 시안용 가짜 값).
 * 출발선 막대의 읽기용 설명(aria-label)도 같은 함수 출력(bandLabel·standingLabel·MOVEMENT_TEXT)의 조합이다 — 손으로 적지 않는다(R-191(d)).
 */
function endingPage() {
  const tl = (age, text, cls = '') => `<li class="${cls}"><span class="log__age">${age}세</span><span>${text}</span></li>`;
  const start = startBandOf(HERO.era, HERO.grade);
  const end = END_STANDING;
  const movement = 'up';
  const journey = journeyText({ kind: 'compared', start, end, movement });
  const barLabel = `출발선 ${bandLabel(start)}, 마지막 ${standingLabel(end)}. ${MOVEMENT_TEXT[movement]}`;
  const body = `<header class="site-head">${headerLogo()}<span class="site-head__name">엔딩</span></header>
<main class="ending">
  <div class="ending__head">${face('elder', 'female', 3, `${HERO.name}의 얼굴 (노년 여성)`, 'face--lg')}
    <div><p class="label">생애 기록</p><h1 class="t-title">${HERO.name}의 인생</h1><p class="t-muted">${HERO.birth} ~ 2110년 · 84세</p></div></div>
  <section class="card stack--sm stack"><p>${esc(deathLineText({ age: 84, cause: '노환' }))}</p><p class="t-muted">${esc(choiceCountText(27))}</p>
    <p class="mock-tag">시안 주석 · 회고 문장과 연표의 사망 줄은 endingText.ts·lifeText.ts의 현행 출력(M7e 전, 해라체)입니다. 합쇼체 전환(C1·M7e) 뒤 화면은 바뀐 함수 출력을 그대로 따릅니다.</p></section>
  <section class="card" aria-labelledby="j-t"><h2 id="j-t" class="card__title" style="margin-bottom:var(--sp-3)">${esc(ENDING_HEADINGS.journey)}</h2>
    <div class="journey"><div class="journey__bar" role="img" aria-label="${esc(barLabel)}">
      <div class="journey__line"></div>
      <div class="journey__pin" style="left:12%"><i></i></div><div class="journey__pin journey__pin--end" style="left:62%"><i></i></div></div>
      <div class="journey__legend"><span><span>○ 출발선</span><span class="grade-line">${gradeChip(HERO.grade, { range: HERO.gradeRange })}</span></span><span><span>◆ 마지막</span><span>${esc(HERO.endRank)}</span></span></div>
      <p>${esc(journey)}</p>
      <p>${esc(MOVEMENT_TEXT[movement])}</p>
      <p class="t-xs t-faint">${esc(JOURNEY_NOTE)}</p>
      <p class="mock-tag">시안 주석 · 출발선 영역에만 수저 이름을 씁니다(엔딩 허용, 연표에는 쓰지 않음). 자리·수치는 가짜 값입니다.</p></div></section>
  <section class="card stack--sm stack" aria-label="${esc(ENDING_HEADINGS.stats)}"><h2 class="card__title">${esc(ENDING_HEADINGS.stats)}</h2>${meter('health', 41)}${meter('happy', 72)}${meter('knowledge', 66)}${meter('relation', 80)}</section>
  <section class="card" aria-labelledby="t-t"><h2 id="t-t" class="card__title" style="margin-bottom:var(--sp-2)">${esc(ENDING_HEADINGS.timeline)}</h2>
    <ol class="timeline">
      ${tl(0, esc(HERO.sentence))}
      ${tl(5, '<strong>나의 기록 · 영유아기 기억</strong><br>할머니 집 마루에서 수박을 먹던 여름. 매미 소리가 시끄러웠습니다.', 'is-note')}
      ${tl(19, '학자금 대출을 받아 대학에 들어갔습니다.', 'is-choice')}
      ${tl(29, '<strong>나의 기록 · 청년기 연애담</strong><br>퇴근길에 같이 걷던 저녁이 오래 남았다.', 'is-note')}
      ${tl(52, '작은 가게를 열었습니다.', 'is-choice')}
      ${tl(84, esc(deathEntryText('노환')))}
    </ol></section>
  <section class="card"><p class="t-sm t-muted">이 판의 플레이 시간 <strong class="num" style="color:var(--c-text)">27:46</strong> <span class="t-xs t-faint">(일시정지 제외, 이 기기에만 저장)</span></p></section>
  <div class="stack--sm stack" style="align-items:stretch"><button class="btn btn--primary btn--lg btn--block" type="button">${esc(REBIRTH_LABEL)}</button>
    <p class="t-sm t-muted" style="text-align:center">${esc(REBIRTH_NOTE)}</p></div>
  ${MOCK_TAG}
</main><div class="page-end-space" style="height:40px"></div>`;
  return page({ title: '수저 게임 · 시안 · 엔딩', body });
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
  <section><h2>버튼</h2><div class="row row--wrap"><button class="btn btn--primary" type="button">기본</button><button class="btn btn--secondary" type="button">보조</button><button class="btn btn--ghost" type="button">테두리</button><button class="btn" type="button" aria-pressed="true">1배 (눌림)</button><button class="btn" type="button">2배</button><button class="btn btn--primary" type="button" aria-disabled="true">비활성</button><button class="btn btn--primary btn--lg" type="button">크게</button><button class="btn btn--secondary btn--icon" type="button" aria-label="이전">${icon('prev')}</button></div>
    <p class="t-sm t-muted" style="margin-top:var(--sp-2)">눌림 상태는 색 반전 + 굵은 아래 막대 + aria-pressed로 알립니다. 터치 대상은 44×44px 이상.</p></section>
  <section><h2>도구 줄 (모바일) — BGM 켜짐·다크모드 켜짐 상태</h2><div class="controls__tools controls__tools--stack" style="max-width:360px">${toolBtn('bgm', 'music', 'BGM', true)}${toolBtn('note', 'pencil', '생각 남기기')}<button class="btn btn--tool" type="button" aria-pressed="true">${icon('sun')}<span>다크 모드</span><span class="sr-only">켜짐</span></button>${toolBtn('feedback', 'message', '의견 보내기')}${toolBtn('exit', 'exit', '나가기')}</div>
    <p class="t-sm t-muted" style="margin-top:var(--sp-2)">켜짐 = aria-pressed="true" + 색 반전 + 아래 막대 + 아이콘 교체(다크모드: 달 → 해) + 읽기 전용 「켜짐」. 이름은 낱말 단위로 두 줄까지 줄바꿈.</p></section>
  <section><h2>수저 5단계 — 재질 색 + 이름 + 점 (아이콘은 칩 변형 실루엣)</h2><div class="row row--wrap">${[1, 2, 3, 4, 5].map((n) => gradeChip(n)).join('')}</div><div class="row row--wrap" style="margin-top:var(--sp-3)">${[1, 2, 3, 4, 5].map((n) => gradeChip(n, { lg: true })).join('')}</div>
    <div class="row row--wrap" style="margin-top:var(--sp-3)">${gradeChip(1, { range: band('present', 1) })}${gradeChip(2, { range: band('present', 2) })}</div>
    <p class="t-sm t-muted" style="margin-top:var(--sp-2)">칩(≤ 24px)은 무늬 없는 실루엣 + 이름 + 점. 구간 글자는 <code>bandLabel(startBandOf(era, wealth))</code> 출력을 칩 뒤 괄호에 — 글로 적으면 「${esc(gradeText(1, band('present', 1)))}」(R-170).</p>
    <div style="margin-top:var(--sp-4);max-width:460px">${spoonLineup()}</div>
    <p class="t-sm t-muted" style="margin-top:var(--sp-2)">32px 이상(첫 화면 띠 32×52)은 큰 변형 <code>sp-N-lg</code>: 닫힌 채움 표식만 — 흙: 담긴 흙 더미 / 동: 표식 없음(무광) / 은: 테두리를 따르는 가는 광택(밝은 채움) / 금: 작은 하이라이트 점(밝은 채움) / 다이아몬드: 마름모 커팅. 선 무늬는 어느 크기에도 없습니다(R-121 마스터 결정). 은·금의 광택은 구멍이 아니라 흰빛 채움이라 다크 테마에서도 광택으로 보입니다.</p>
    <div class="row row--wrap" style="margin-top:var(--sp-4);gap:var(--sp-5);align-items:flex-end;color:#000;background:#fff;padding:var(--sp-3);border:1px solid var(--c-border);border-radius:var(--r-md)">${[1, 2, 3, 4, 5].map((n) => `<span style="display:inline-flex;flex-direction:column;align-items:center;gap:6px;font-size:12px"><svg class="spoon" style="width:40px;height:64px" aria-hidden="true"><use href="#sp-${n}-lg"/></svg><svg class="spoon" aria-hidden="true"><use href="#sp-${n}"/></svg>${['', '흙', '동', '은', '금', '다이아'][n]}</span>`).join('')}<span class="t-xs" style="color:#000">단색(강제 색상·인쇄): 큰 변형 64px 채움 + 밝은 표식 / 칩 변형 24px도 채운 실루엣(외곽선 아님 — R-190). 아이콘만 단독으로 쓰지 않습니다</span></div>
    <p class="t-sm t-muted" style="margin-top:var(--sp-2)">실제 픽셀 크기(DPR 1) 시트: <code>screens/003/spoon-sizes-dpr1.png</code>.</p></section>
  <section><h2>선택 카드 / 라디오</h2><div class="choices choices--2">${radioCard({ name: 'x', title: '선택됨', desc: '두꺼운 테두리 + 체크 + 옅은 면', selected: true })}${radioCard({ name: 'x', title: '선택 안 됨', desc: '얇은 테두리, 체크 없음' })}</div></section>
  <section><h2>상태 바 · 진행률</h2><div class="card stack--sm stack" style="max-width:420px">${meter('health', 82)}${meter('happy', 70)}${meter('knowledge', 38)}${meter('relation', 61)}<div class="year-row"><span class="num">2029년</span><div class="year-progress"><div class="year-progress__fill" style="width:62%"></div></div><span class="year-row__pct num">62%</span></div></div></section>
  <section><h2>영향 표기</h2><div class="stack--sm stack">${impact([['자산', 'down', 2], ['행복', 'up', 1]])}${impact([['관계', 'up', 3], ['건강', 'down', 1], ['지식', 'up', 2]])}</div></section>
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
write('decision-infant.html', dashboardPage('infant', infantSheet()));
write('decision-adult.html', dashboardPage('adult', adultSheet()));
write('note.html', dashboardPage('infant', noteSheet(), 5));
write('ending.html', endingPage());
write('components.html', componentsPage());
write('symbols.html', symbolsPage());
write('faces.html', faceSheetPage(false));
write('faces-all.html', faceSheetPage(true));
console.log('mockups written');
