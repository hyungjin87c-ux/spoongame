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
import { LINE_H_STACKED, LINE_W, buildCarousel, valueWidthEm } from '../../src/core/carousel.ts';
import { citationFor, citationText, splitSourceLine } from '../../src/core/citations.ts';
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
import { ENDING_HEADINGS, ENDING_HEAD_LABEL, FINAL_NET_TEXT, JOURNEY_BAR_LEGEND, JOURNEY_NOTE, MOVEMENT_TEXT, PLAYTIME_TEXT, REBIRTH_LABEL, REBIRTH_NOTE, bandLabel, breakdownParts, choiceCountText, deathLineText, endingSpanText, journeyBarLabel, journeyText, stageHeadingText } from '../../src/data/endingText.ts';
import { displaySeconds, isCleanRun, readPlay } from '../../src/core/playClock.ts';
import { PlayTime } from '../../src/ui/PlayTime.tsx';
import { deathEntryText } from '../../src/data/lifeText.ts';
import { NOTE_TEXT } from '../../src/data/noteSheetText.ts';
import { NOTE_CARDS, NOTE_MANUAL } from '../../src/data/noteCards.ts';
import { fillNoteName } from '../../src/core/notes.ts';
import { NOTE_LIMITS } from '../../src/core/noteText.ts';
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

/**
 * M8 플레이 시간 블록(docs/design/copy.md 8절)은 **구현 상수·부품을 그대로** 읽는다(R-191 — 2026-10-19 선행 때의 임시 블록 `M8_TEXT`는 developer가 `PLAYTIME_TEXT`·`TITLE_TEXT.lifeLengthHint`를 copy.md 8-1 그대로 넣은 뒤 지웠다, diff-003.md D-96):
 * 글자 = `src/data/endingText.ts#PLAYTIME_TEXT`(분해 문장은 `breakdownParts`가 시간 부품 앞뒤 조각으로), 값 = `src/core/playClock.ts#displaySeconds`(버킷별 초 버림 뒤 합)·`isCleanRun`,
 * 시간 부품 = `src/ui/PlayTime.tsx`(눈에 보이는 mm:ss aria-hidden + 낭독 「{m}분 {s}초」 sr-only + datetime PT — React 서버 렌더는 속성 이름을 `dateTime`으로 내고 브라우저 DOM에서는 `datetime`과 같은 속성이다). tests/designAssets.test.ts가 상수 = copy.md 8절, 생성기에 글자 사본 없음을 잠근다.
 * 시안의 플레이 기록은 저장 상태의 모양(core/types.ts#PlayTime — ms 일곱 + 횟수 둘)으로 두고 `readPlay`(저장 검증)를 통과해야 한다 — HERO_STATE가 Character·BirthReport 모양을 지키는 것과 같은 규칙.
 */
/** 시안용 플레이 기록: 연출(hold)·결정 읽기(decide)는 초 단위 모델값(content-M8 2-6절) → ms, 나머지 버킷·횟수는 0. extra로 깨끗하지 않은 판(offSpeed·auto·skips)을 만든다 */
function playRecord(holdSec, decideSec, extra = {}) {
  const rec = { hold: holdSec * 1000, decide: decideSec * 1000, fold: 0, note: 0, idle: 0, offSpeed: 0, auto: 0, skips: 0, resumes: 0, ...extra };
  if (readPlay(rec) === undefined) throw new Error(`시안 플레이 기록이 저장 검증을 통과하지 못한다: ${JSON.stringify(rec)}`);
  return rec;
}
/** 시간 값 하나 — 구현 부품 PlayTime의 출력 그대로(세 자리가 같은 부품). 바로 뒤에 조사를 두지 않는다(design-system.md 11-4) */
const playTimeHtml = (seconds, props = {}) => renderToStaticMarkup(createElement(PlayTime, { seconds, ...props }));
/**
 * 엔딩 「사망과 선택」 카드 끝의 플레이 시간 블록 — 구현 EndingScreen.tsx#PlayTimeBlock과 같은 마크업(copy.md 8-3 DOM, data-testid까지). play = core/types.ts#PlayTime 또는 null(없으면 블록 자체가 없다 — M8 이전 저장, content-M8 5-3절).
 * 표시값 = displaySeconds(버킷별 초 버림 뒤 합)라 보조 문장의 두 부분(각각 버림)을 더하면 늘 표시값과 같다. 깨끗하지 않은 판(isCleanRun 거짓 — 배속·자동 모드·「다음 결정으로」 중 하나라도 쓴 판)에만 notClean 문장이 든다.
 */
function playtimeHtml(play) {
  if (play === null) return '';
  const t = PLAYTIME_TEXT;
  const [lead, mid, tail] = breakdownParts();
  // 글자 조각은 Glue 묶음을 거친다(구현 D-98 — 관형사 「이 기기에만」이 줄 끝에 홀로 남지 않게, design-system.md 11-4; 규칙 D-97이 들어오기 전에는 출력이 맨 글자와 같다)
  const breakdown = `${glueHtml(lead)}${playTimeHtml(Math.floor(play.hold / 1000), { testId: 'ending-playtime-hold' })}${glueHtml(mid)}${playTimeHtml(Math.floor(play.decide / 1000), { testId: 'ending-playtime-decide' })}${glueHtml(tail)}`;
  const sentences = [breakdown, glueHtml(t.excluded), ...(isCleanRun(play) ? [] : [glueHtml(t.notClean)]), glueHtml(t.device)];
  return `<div class="playtime" data-testid="ending-playtime"><dl class="playtime__row"><dt>${esc(t.label)}</dt><dd>${playTimeHtml(displaySeconds(play), { className: 'playtime__value', testId: 'ending-playtime-value' })}</dd></dl><p class="t-xs t-faint playtime__note" data-testid="ending-playtime-note">${sentences.join(' ')}</p></div>`;
}

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
 * 지표 목록·순서·수(N)는 접근자 getCarouselIndicators에서 온다(2026-10-15 기준 14개). SPEC-005 QI3(SH1~SH7, copy.md 9절, R-445)부터 구조는 구현 ui/StatsCarousel.tsx의 새 구조다:
 * 눈에 보이는 머리글(「한국 사회 통계」·「7초마다 다음 지표」)은 없고 영역 이름은 `h2.sr-only`(TITLE_TEXT.carouselHeading), 조작 줄(이전 · 「{i} / {N}」 · 다음 · 자동 넘김 일시정지)은 카드 **오른쪽 위**,
 * 슬라이드 위에서부터 표제어(h3 .slide__insight) → 공식 통계명(기준) 한 줄(.slide__official) → 값 줄 → 분모 기준 줄(.slide__basis, 없으면 요소 없음) → 그래프 → 정의 → 출처. 자동 넘김 간격은 9초(AUTO_ADVANCE_MS)지만 화면에 쓰지 않는다 — 상태는 일시정지 버튼의 아이콘·이름이 말한다(SH6).
 * 이전 구조 설명(SPEC-003): 조작 줄(이전 · 「{i} / {N}」 · 다음 · 자동 넘김 일시정지)은 **카드 머리**(R-200 — 슬라이드 높이가 달라도 같은 자리, 하단 띠에 가려지지 않는다),
 * 14장을 모두 `.slides`에 겹쳐 두고 보이는 하나만 `.is-active`(좁은 화면은 카드 높이 = 가장 큰 슬라이드, 넓은 화면은 보이는 슬라이드만큼). 시안 주소 끝 `?slide=<id>`로 보이는 슬라이드를 고른다(예 `suicide-rate`·`marriage-count`).
 * 그래프 좌표는 좁은 화면 기준(폭 320·높이 232)으로 한 번 만들고 SVG가 칸 폭에 맞춰 비율로 늘어난다 — 구현은 화면에 그려지는 폭으로 좌표를 다시 만든다(R-206).
 */
const CAROUSEL_DATA = buildCarousel(undefined, { width: LINE_W, lineHeight: LINE_H_STACKED });
const CAROUSEL_TOTAL = CAROUSEL_DATA.slides.length;
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
  // SH1: 표제어(h3) → 공식 통계명(기준) 한 줄 → (캡션) → 값 → 분모 기준 줄(있을 때만) — 구현 StatsCarousel#SlideView와 같은 순서·이름
  return `<article class="slide${active ? ' is-active' : ''}" data-slide-id="${s.id}" aria-roledescription="슬라이드" aria-label="${i + 1}/${n} ${esc(s.insight)}, ${esc(s.officialText)}">
      <h3 class="slide__insight">${glueHtml(s.insight)}</h3>
      <p class="slide__official">${glueHtml(s.officialText)}</p>
      ${s.caption !== null ? `<p class="slide__caption">${glueHtml(s.caption)}</p>` : ''}
      ${value}${side}
      ${s.basisText !== null ? `<p class="slide__basis">${glueHtml(s.basisText)}</p>` : ''}
      ${chart}${legend}${note}
      <p class="t-sm t-muted">${glueHtml(s.definition)}</p>
      ${help}
      <p class="slide__meta">출처: ${glueHtml(s.sourceText)}</p>
      <p class="slide__meta">${pairHtml(s.basisLine, 'meta')}</p>
    </article>`;
}
function carousel() {
  const n = CAROUSEL_TOTAL;
  // 구현 StatsCarousel과 같은 머리: 눈에 보이는 머리글 없음(h2.sr-only) + 오른쪽 위 소형 조작 줄(.carousel__nav — 이전 · 위치 · 다음 · 일시정지, SH4·SH5·SH6)
  const navBtn = (name, label) => `<button class="nav-btn" type="button" aria-label="${esc(label)}"><span class="nav-btn__box">${icon(name)}</span></button>`;
  return `<section class="card carousel carousel--005" aria-roledescription="캐러셀" aria-label="${esc(TITLE_TEXT.carouselRegionLabel)}">
  <h2 class="sr-only">${esc(TITLE_TEXT.carouselHeading)}</h2>
  <div class="carousel__nav">
    ${navBtn('prev', TITLE_TEXT.carouselPrev)}
    <span class="carousel__status num" aria-hidden="true">1 / ${n}</span>
    ${navBtn('forward', TITLE_TEXT.carouselNext)}
    <button class="nav-btn carousel__pause" type="button" aria-label="${esc(TITLE_TEXT.carouselPause)}"><span class="nav-btn__box">${icon('pause')}</span></button>
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
    <p class="hero__note">${glueHtml(TITLE_TEXT.populationNote)}</p>
  </header>`; // 가상 인구 주석도 Glue(구현 TitleScreen.tsx:266, D-98) — 「이 기기」가 줄 끝에서 갈리지 않는다
  const eraMeta = (e) => eraMetaText(e, e === 'present' ? { min: 2026, max: 2026 } : ERA_CONFIG[e].birthYears);
  const world = `<fieldset><legend class="group-title">${esc(TITLE_TEXT.eraGroup)}</legend>
    <div class="choices choices--1" role="radiogroup" aria-label="${esc(TITLE_TEXT.eraGroup)}">
      ${ERAS.map((e) => radioCard({ name: 'era', title: ERA_CONFIG[e].label, meta: eraMeta(e), desc: ERA_CONFIG[e].blurb, selected: e === 'present' })).join('\n      ')}
    </div></fieldset>`;
  // HS2(SPEC-005 QI3, copy.md 9-4): 인생 길이는 작은 분절 컨트롤(라디오 둘) + 한 줄 안내 — 구현 TitleScreen#SegOption과 같은 마크업. 「약 1시간」은 비활성 + 「준비 중」(LD-4)
  const segOpt = (l) => {
    const selectable = isLifeLengthSelectable(l);
    const selected = l === 'short30';
    return `<label class="seg__opt${selected ? ' is-selected' : ''}${selectable ? '' : ' is-disabled'}"><input type="radio" name="lifeLength" ${selected ? 'checked' : ''}${selectable ? '' : ' disabled'}>${icon('check')}<span>${esc(LIFE_LENGTH_TEXT[l].title)}</span>${selectable ? '' : `<span class="seg__meta">${esc(NOT_READY_TEXT)}</span>`}${selected ? '<span class="sr-only">선택됨</span>' : ''}</label>`;
  };
  const length = `<fieldset class="slot slot--small"><legend class="group-title group-title--inline">${esc(TITLE_TEXT.lifeLengthGroup)}</legend>
    <div class="seg" role="radiogroup" aria-label="${esc(TITLE_TEXT.lifeLengthGroup)}">
      ${LIFE_LENGTHS.map(segOpt).join('\n      ')}
    </div>
    <p class="seg__hint">${glueHtml(TITLE_TEXT.lifeLengthHint)}</p></fieldset>`; // FS5 설명은 구현 상수 그대로(M8 D-92 — LD-1: 기록 쓰는 시간이 빠진다는 한 문장 + 어체 통일, copy.md 8-1 ①; 선행 때의 임시 블록은 developer 반영 뒤 지웠다, D-96). Glue 묶음(관형사 「이 기기에」 — design-system.md 11-4, D-97·D-98)은 구현 glue.ts의 규칙(r2, 2026-10-20)을 import로 그대로 쓴다
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
  // SPEC-005 QI3(R-445): 새 통계 카드·분절 컨트롤의 모양은 designer 시안 CSS(title-005.css)에 있다 — ds.css 위에 더한다
  return page({ title: `수저 게임 · 시안 · 첫 화면${state === 'continue' ? ' (이어하기)' : ''}`, body, head: '<link rel="stylesheet" href="title-005.css">' });
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
 * dialog = 누르면 모달 시트가 열리는 버튼(「생각 남기기」 — 구현 LifeScreen 「생각 남기기」 버튼과 같은 `aria-haspopup="dialog"`, aria-pressed 없음; M7c D-75).
 * M4 r2~M7b의 「생각 남기기」 지속 비활성 + 「준비 중」 알약(R-326 — 생성기의 soon 인자, 구현의 표식 상수, ds.css의 알약 규칙)은 M7c UI 단계에서 구현과 함께 지웠다(2026-10-19 후속) — 기록은 copy.md 2절 M4 r2 행·diff-003.md D-75.
 */
const toolBtn = (id, iconName, label, pressed = false, { dialog = false } = {}) =>
  dialog
    ? `<button class="btn btn--tool" type="button" data-tool="${id}" aria-haspopup="dialog">${icon(iconName)}<span>${label}</span></button>`
    : `<button class="btn btn--tool" type="button" data-tool="${id}" ${pressed ? 'aria-pressed="true"' : 'aria-pressed="false"'}>${icon(iconName)}<span>${label}</span><span class="sr-only">${pressed ? '켜짐' : ''}</span></button>`;

/**
 * 대시보드 헤더 + 도구 줄. 문구는 구현 상수 DASH_TEXT(src/data/dashText.ts)에서 읽는다(copy.md 대시보드 행과 같은 글자, 2026-10-17 M4 구현 뒤 맞춤).
 * pending(선택지 대기 = 카드 시안의 시트가 떠 있을 때)이면 「다음 결정으로」가 **지속 비활성**: aria-disabled + data-unavailable(ds.css — 옅은 글자 + 점선, 불투명도 아님; design-system.md 6절 「버튼」).
 * 「생각 남기기」는 M7c부터 모든 대시보드 시안에서 보통 버튼(`aria-haspopup="dialog"`)이다 — 결정 시트가 떠 있는 동안은 도구 줄 전체가 `inert`라 누를 수 없다(구현과 같다).
 * 도구 줄 아래 한 줄(볼륨·나가기 확인 단계)은 dashboardPage()가 `?state=tools|exit`로 끼운다.
 */
/**
 * 대시보드 헤더 + 도구 줄. pending = 선택지 대기(「다음 결정으로」 지속 비활성 — 구현 LifeScreen#isSkipBlocked), paused = **사용자가 누른 일시정지**만(구현 `game.paused` — 선택지 대기 중에도 버튼 이름은 「일시정지」다;
 * M7b 전 카드 시안은 대기를 일시정지로 그렸는데 구현과 달라 바로잡았다, 2026-10-19), auto = 자동 모드 켜짐(「자동 모드 켜짐」 aria-pressed), inert = 모달 시트가 떠 있는 동안 헤더·도구 줄을 `inert`로(M7b M-6 — Tab이 시트 안에서만 돈다).
 */
function dashHead({ age, year, progress, paused, pending = false, auto = false, inert = false }) {
  const T = DASH_TEXT;
  const inertAttr = inert ? ' inert' : '';
  return `<header class="dash-head"${inertAttr}><div class="dash-head__inner">
    <div class="dash-head__top">${headerLogo()}
      <div class="who"><span class="who__name">${HERO.name}</span><span class="who__age"><b>${age}</b>${T.ageSuffix}</span></div></div>
    <div class="year-row"><span class="num">${year}${T.yearSuffix}</span>
      <div class="year-progress" role="progressbar" aria-label="${T.yearProgressLabel}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progress}"${paused ? ` aria-valuetext="${progress}%, ${T.progressPausedValue}"` : ''}><div class="year-progress__fill" style="width:${progress}%"></div></div>
      <span class="year-row__pct num">${progress}%</span></div>
  </div></header>
  <div class="toolbar"${inertAttr}><div class="toolbar__inner">
    <div class="controls-fixed" role="group" aria-label="${T.controlsGroup}" data-testid="bottom-bar">
      <div class="controls__speed">
        <button class="btn btn--sm" type="button">${icon(paused ? 'play' : 'pause', 'icon--sm')}<span>${paused ? T.play : T.pause}</span></button>
        <button class="btn btn--sm" type="button" aria-pressed="true">1${T.speedUnit}</button><button class="btn btn--sm" type="button">2${T.speedUnit}</button><button class="btn btn--sm" type="button">4${T.speedUnit}</button><button class="btn btn--sm" type="button">8${T.speedUnit}</button>
      </div>
      <div class="controls__more">
        <button class="btn btn--sm btn--secondary" type="button"${pending || auto ? ' aria-disabled="true" data-unavailable="true"' : ''}>${icon('next', 'icon--sm')}<span>${T.skip}</span></button>
        <button class="btn btn--sm btn--secondary" type="button" aria-pressed="${auto ? 'true' : 'false'}">${icon('auto', 'icon--sm')}<span>${auto ? T.autoOn : T.autoOff}</span></button>
      </div>
    </div>
    <div class="controls__tools" role="group" aria-label="${T.toolsGroup}">
      ${toolBtn('bgm', 'music', T.toolBgm)}${toolBtn('note', 'pencil', T.toolNote, false, { dialog: true })}${toolBtn('dark', 'moon', T.toolDark)}${toolBtn('feedback', 'message', T.toolFeedback)}${toolBtn('exit', 'exit', T.toolExit)}
    </div>
  </div></div>`;
}

/**
 * 도구 줄 아래 한 줄의 상태(M4 구현 LifeScreen.tsx와 같은 마크업, 2026-10-17 — r2 R-326 뒤 맞춤): `?state=tools` = BGM 켜짐(aria-pressed + 「켜짐」) → 볼륨 줄 「BGM 볼륨」 + range + 「N%」 /
 * `?state=exit` = 나가기 확인 단계(안내문 → 「첫 화면으로 나가기」(보조) → 맨 아래 「돌아가기」(기본·먼저 포커스) — 첫 화면 확인 단계 R-204·QM2-6과 같은 배치). 문구는 DASH_TEXT(copy.md 대시보드 행).
 * 「생각 남기기」의 안내 줄(「…준비 중입니다.」, 예전 .tool-note)은 없다 — M7c부터는 보통 버튼이라 누르면 기록 시트가 열린다(note.html).
 */
function toolbarStates() {
  const T = DASH_TEXT;
  const tools = `<label class="volume"><span>${esc(T.bgmVolume)}</span><input type="range" min="${BGM_VOLUME_MIN}" max="${BGM_VOLUME_MAX}" step="5" value="${DEFAULT_BGM.volume}" aria-valuetext="${DEFAULT_BGM.volume}%"><output>${DEFAULT_BGM.volume}%</output></label>`;
  const exit = `<div class="exit-ask" role="group" aria-labelledby="exit-ask-t"><p class="exit-ask__title" id="exit-ask-t" role="alert">${esc(T.exitAsk)}</p><p class="t-sm t-muted">${glueHtml(T.exitAskSub)}</p>
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
/**
 * 「나의 기록」 줄(M7c FR4·FR5 — 구현 NoteText, copy.md 7-4·design-system 6절 「인생 기록 줄」): 라벨 「나의 기록 · {주제}」는 주제 길이가 카드마다 다른 짧은 쌍이라 **FitPair**(좁거나 글자가 크면 기호 없이 두 줄 — Glue 묶음은 한 줄보다 길면 안에서 「·」 뒤에 갈릴 수 있다, 11-4절)
 * + 가운뎃점 aria-hidden(낭독 「나의 기록 영유아기 기억」, R-403 ⑤). 사용자 글은 <bdi dir="auto" data-user-text>(방향 격리 H5 ②, 낱말 끊김 감사 제외 D4) — React 텍스트 자식 그대로(D1), 줄바꿈은 pre-line(3줄까지). <br>·Glue·FitPair를 사용자 글에 쓰지 않는다(D5)
 */
const noteLabel = (topic) => `<span class="log__note-label">${icon('pencil', 'icon--sm')}${fitPair('나의 기록', topic, { hideSeparator: true })}</span>`;
const logNote = (age, topic, text, cls = '') => `<li class="log__row log__row--note${cls ? ` ${cls}` : ''}" data-kind="note"><span class="log__age">${age}세</span><span class="log__text">${noteLabel(topic)}<bdi class="note-text" dir="auto" data-user-text>${esc(text)}</bdi></span></li>`;

/**
 * 인생 기록(DB12·DB14). 고정 줄 「이 세상의 가상 인구 {N}명 · {이름}도 그중 한 사람」은 내용 길이가 판마다 다른 짧은 쌍이라 FitPair(한 줄에 안 들어가면 기호 없이 두 줄, 11-7절 — 구현 ui/FitPair.tsx).
 * 머리 보조 「시간순 · 위로 스크롤하면 지난 기록」·「새 기록 N개 · 맨 아래로」는 Glue 묶음.
 */
function logCard(rowsHtml, newCount) {
  return `<section class="card log" aria-label="인생 기록"><div class="card__head" style="margin-bottom:var(--sp-2)"><h2 class="card__title">인생 기록</h2><span class="t-xs t-faint">${glueHtml('시간순 · 위로 스크롤하면 지난 기록')}</span></div>
  <p class="log__pin">${fitPair(`이 세상의 가상 인구 ${N_POP}명`, `${HERO.name}도 그중 한 사람`)}</p>
  <div class="log__list" role="region" aria-label="${esc(DASH_TEXT.logTitle)}" tabindex="0"><ol class="log__rows" aria-live="polite" aria-relevant="additions">${rowsHtml}</ol></div>
  ${newCount ? `<button class="btn btn--secondary btn--sm log__jump" type="button">${glueHtml(`새 기록 ${newCount}개 · 맨 아래로`)}</button>` : ''}</section>`;
}

/** 식구(DB13): 부모 나이는 출생신고(어머니 29·아버지 32, 2026년)에서 해마다 오른다. 「{직업} · {상태}」는 내용 길이가 판마다 다른 짧은 쌍이라 FitPair(좁은 열·큰 글자에서 기호 없이 두 줄 — 「·」가 가장자리에 남지 않는다, 11-7절) */
const familyCard = (age) => `<section class="card family" aria-label="식구"><h2 class="card__title" style="margin-bottom:var(--sp-3)">식구</h2>
  <dl class="family-list">
    <dt>어머니</dt><dd>${HERO.motherAge + age}세<small>${fitPair(HERO.motherJob, '건강함')}</small></dd>
    <dt>아버지</dt><dd>${HERO.fatherAge + age}세<small>${fitPair(HERO.fatherJob, '건강함')}</small></dd>
    <dt>형제자매</dt><dd>${age - 3 >= 1 ? `남동생 ${age - 3}세 <small>3세 아래</small>` : '남동생 <small>이제 막 태어남</small>'}</dd>
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

// ---------- 4-1. M7b 중대 결정 카드 (decision-infant.html · decision-adult.html — SPEC-003 MD1·MD2·EV6, docs/data/content-M7b.md 10절, copy.md 6절, design-system.md 6절 「중대 결정 카드」) ----------
/**
 * 카드 글자는 **실제 이벤트 JSON**(제목·상황·선택지 라벨)과 **실제 인용**에서 가져온다. 영향 줄의 칸 수만 시안용 예시(구현은 previewChoice가 정본, 시안 표식이 밝힌다).
 * 2026-10-19 developer M7b 1·2단계 반영 뒤(R-191 되돌림): 문구는 src/data/dashText.ts#DASH_TEXT(foldCard·reopenDecision·foldNote·autoNoteOn/Off·citeKindLabel), 카드 ↔ 인용 연결은 이벤트 JSON의 `citation`을
 * 구현의 순수 함수 `citationFor(event, era, 게임 속 연도)`가 읽고(연결이 없거나 그 세상·그 해에 보이지 않으면 null → 박스 없음), 표시 문자열·출처 줄은 `citationText`·`splitSourceLine`(src/core/citations.ts)이 만든다.
 * 생성기에는 문구·규칙의 흉내가 없다 — 구현이 바뀌면 재생성만으로 시안이 따라온다(tests/designAssets.test.ts가 잠근다).
 */
const CITATIONS = JSON.parse(readFileSync(ROOT + 'src/data/citations.json', 'utf-8')).citations;
const EVENT_BY_ID = new Map(
  ['infant', 'school', 'youth', 'middle', 'senior'].flatMap((stage) => {
    const json = JSON.parse(readFileSync(ROOT + `src/data/events/${stage}.json`, 'utf-8'));
    return (json.events ?? json).map((ev) => [ev.id, ev]);
  }),
);
const eventOf = (id) => {
  const ev = EVENT_BY_ID.get(id);
  if (!ev) throw new Error(`이벤트 ${id}가 없다`);
  return ev;
};
const citeOf = (id) => {
  const c = CITATIONS.find((x) => x.id === id);
  if (!c) throw new Error(`인용 ${id}가 없다`);
  return c;
};
/** 인용 한 건을 (카드 연결과 무관하게) 그 세상의 표시 꼴로 — 컴포넌트판 표본용. 카드는 citationFor가 이벤트의 연결을 읽는다 */
function citeViewOf(id, era) {
  const c = citeOf(id);
  const { head, title } = splitSourceLine(c.source, c.kind);
  return { id: c.id, kind: c.kind, text: citationText(c, era), sourceWho: head, sourceTitle: title };
}
/** 인용 박스(구현 ui/dash/CitationBox.tsx와 같은 DOM): 종류 라벨 → 요약(Glue — 「돌봄(늘봄학교)에」 같은 괄호 사슬·「52.2%」 숫자+단위를 묶는다; 가운뎃점 사슬은 developer r2부터 데이터에 두지 않는다 — tests/citationText.test.ts 8글자 상한) → 출처 한 줄(「누가(연도),」는 한 묶음, 자료 이름은 Glue). 인용이 없는 카드는 이 함수를 부르지 않는다(빈 박스 0) */
function citeBox(view) {
  if (view.text.length > 100) throw new Error(`${view.id}: 표시 문자열 ${view.text.length}자 > 100`);
  return `<div class="cite" data-testid="cite" data-citation="${view.id}"><p class="cite__kind">${esc(DASH_TEXT.citeKindLabel[view.kind])}</p><p class="cite__text" data-testid="cite-text">${glueHtml(view.text)}</p><p class="cite__src" data-testid="cite-src"><span class="keep-phrase">${esc(view.sourceWho)}</span> ${glueHtml(view.sourceTitle)}</p></div>`;
}
/** 카드 안쪽(두 틀 공통, copy.md 6-2 DOM). choices = [[선택지 id, 영향 칸 예시], …] — 보이는 선택지 2~3개(구현 pending.choiceIds). 인용은 이벤트 JSON의 연결을 citationFor로 읽는다(시안 주인공 = 지금 세상) */
function decisionInner({ ev, year, age, era = 'present', choices, auto }) {
  const T = DASH_TEXT;
  const buttons = choices
    .map(([cid, spec], i) => {
      const c = ev.choices.find((x) => x.id === cid);
      if (!c) throw new Error(`${ev.id}: 선택지 ${cid}가 없다`);
      return choiceBtn(i + 1, c.label, spec);
    })
    .join('\n        ');
  const anyImpact = choices.some(([, spec]) => spec);
  const cite = citationFor(ev, era, year);
  return `<div class="decision__head"><span class="decision__kind">${esc(T.choiceKind)}</span><div class="row"><span class="decision__when">${fitPair(`${year}${T.yearSuffix}`, `${age}${T.ageSuffix}`)}</span><button class="btn btn--ghost btn--sm decision__fold" type="button" data-testid="decision-fold-btn">${esc(T.foldCard)} <span aria-hidden="true">${esc(T.foldMark)}</span></button></div></div>
    <div class="decision__body">
      <h2 id="dc-title" class="decision__title" tabindex="-1" style="--title-chars:${titleCharsFor(ev.title)}" data-testid="choice-title">${esc(ev.title)}</h2>
      <p class="decision__text" data-testid="choice-text">${esc(ev.text)}</p>
      ${cite ? citeBox(cite) : ''}
      <div class="choices-list" role="group" aria-label="${esc(T.choiceGroup)}">
        ${buttons}
      </div>
      ${anyImpact ? html(ImpactHint, { name: HERO.name }).replace('class="choice-panel__hint"', 'class="decision__hint"') : ''}
      <p class="decision__auto" data-testid="auto-note">${esc(auto ? T.autoNoteOn : T.autoNoteOff)}</p>
    </div>`;
}
/** ① 모달 시트(자동 모드 꺼짐): role=dialog는 시트에, 스크림(.overlay)은 장식. 바깥은 dashboardBody가 inert로 둔다 */
const decisionSheet = (o) => `<div class="overlay"><div class="sheet decision decision--sheet" role="dialog" aria-modal="true" aria-labelledby="dc-title" data-testid="decision-sheet">${decisionInner({ ...o, auto: false })}</div></div>`;
/** ② 비모달 인라인 카드(자동 모드 켜짐): 대시보드 가운데 열 맨 위의 카드 */
const decisionInline = (o) => `<section class="card decision decision--inline" aria-labelledby="dc-title" data-testid="decision-inline">${decisionInner({ ...o, auto: true })}</section>`;
/** ③ 접힌 띠: 카드가 있던 자리. 「결정 다시 열기」의 접근 가능한 이름 = 「결정 다시 열기 {제목}」(aria-labelledby 두 id) */
const foldBand = (ev) =>
  `<section class="card fold" aria-labelledby="dc-fold-title" data-testid="decision-fold"><span class="fold__kind">${esc(DASH_TEXT.choiceKind)}</span><span class="fold__title" id="dc-fold-title">${esc(ev.title)}</span><span class="fold__note">${esc(DASH_TEXT.foldNote)}</span><button class="btn btn--secondary btn--sm fold__open" type="button" id="dc-fold-open" aria-labelledby="dc-fold-open dc-fold-title" data-testid="decision-reopen">${esc(DASH_TEXT.reopenDecision)}</button></section>`;

/**
 * 시안 카드 둘(영유아 시점 — 시안 주인공은 첫째라 「동생이 생겼다」가 뜬다). 인용은 적지 않는다 — 이벤트 JSON의 연결(citationFor)이 정한다:
 * 「동생이 생겼다」 = 연구 c-033(저자 5명 「Teti 외」 + 긴 영문 원제 — 2026-10-19 마스터 결정, 전에는 c-032) / 「유치원 고르기」 = 통계 c-061(기관 둘 「교육부, 한국교육개발원」 + 자료 이름의 「 — 」 → 「: 」 — 출처 줄 기호 변환 표본)
 */
const INFANT_CARDS = {
  sibling: { ev: eventOf('infant-new-sibling'), age: 3, choices: [['help', 'relationships:up:2,happiness:down:1'], ['sulk', 'relationships:down:1,happiness:up:1'], ['notice', 'relationships:down:2,happiness:up:1']] },
  kinder: { ev: eventOf('infant-kindergarten'), age: 4, choices: [['near', 'relationships:up:1'], ['famous', 'family:down:2,education:up:2'], ['home', 'family:up:1,relationships:up:1,education:down:1']] },
};
/** 성인 시점 — 연애 카드는 인용 없음(content-M7b 1-2절 D: 맞는 통계 없음 → citationFor가 null), 주거 카드는 통계 c-015 */
const ADULT_CARDS = {
  romance: { ev: eventOf('youth-workplace-romance'), age: 31, choices: [['ask', 'relationships:up:2,happiness:up:1'], ['keep', 'happiness:down:1']] },
  housing: { ev: eventOf('youth-housing'), age: 31, choices: [['rent', 'assets:down:1,happiness:down:1'], ['parents', 'assets:up:1,relationships:down:1'], ['loan', 'assets:up:2,debt:up:3']] },
};

// ---------- M7c 자유 기록 「생각 남기기」 시트 (2026-10-19 designer 선행 — SPEC-003 FR1~FR9 · docs/data/content-M7c.md 1-4·5·6절 · 문구 copy.md 7절 · design-system.md 6절 「자유 기록 카드 시트」) ----------
/**
 * 문구·질문은 **구현에서 읽는다**(2026-10-19 후속 — developer UI 단계 뒤 R-191 되돌림, M7e·M7b와 같은 수순): 시트 문구는 `src/data/noteSheetText.ts#NOTE_TEXT`(copy.md 7-2 ①~⑫와 글자까지 같다 — tests/noteSheet.test.tsx가 대조),
 * 질문 7종·변형·수동 질문과 연표 라벨 주제는 `src/data/notes.json`(`NOTE_CARDS`·`NOTE_MANUAL`, copy.md 7-1 최종 문구), 이름 채움은 구현 함수 `fillNoteName`(core/notes.ts — 구현 `noteQuestion`이 쓰는 것).
 * 생성기에는 문구의 흉내가 없다(선행 때의 임시 문구 블록은 지웠다) — tests/designAssets.test.ts가 「임시 블록 없음 + import」를 잠근다. 「1. 적어두고 살기」「2. 마음속에 담고 살기」는 형진 님 원문 그대로(copy.md 1절).
 */
const noteCardOf = (id) => {
  const c = NOTE_CARDS.find((x) => x.id === id);
  if (!c) throw new Error(`기록 카드 ${id}가 없다`);
  return c;
};
/** 시안이 쓰는 카드 넷 + 수동: 연표 라벨 주제(「나의 기록 · {주제}」)와 질문은 notes.json의 값 그대로 */
const NOTE_CARD = { infant: noteCardOf('note-infant-memory'), teen: noteCardOf('note-teen-envy'), firstLove: noteCardOf('note-first-love'), romance: noteCardOf('note-youth-romance') };
const NOTE_TOPIC = { infant: NOTE_CARD.infant.topic, teen: NOTE_CARD.teen.topic, firstLove: NOTE_CARD.firstLove.topic, romance: NOTE_CARD.romance.topic, manual: NOTE_MANUAL.topic };
/** 기본 변형의 질문에 시안 주인공 이름을 채운다(구현 noteQuestion과 같은 fillNoteName — 변형 판정은 저장 상태가 필요해 시안은 기본 문장만 보인다) */
const noteQuestionOf = (card, name) => fillNoteName(card === null ? NOTE_MANUAL.prompt : card.prompt, name);
const NOTE_MAX = NOTE_LIMITS.graphemes;
/**
 * 「나의 기록」 줄 **표본 데이터**(시안의 가짜 데이터 — HERO의 인생 기록 줄과 같은 자리. 구현 문구의 사본이 아니라 import할 원본이 없다; QA 입력 공격의 대표 입력 content-M7c 3-8절 A3·A10·A16·A9와 같은 종류를 고른 것이고,
 * 구현 e2e는 자기 고정값(`e2e/m7cSheets.ts#LONG_NOTE_TEXTS`·`m7c-input-attack.spec.ts`)을 따로 둔다). 보이지 않는 글자·그림 문자는 코드 포인트로 적는다(문서 규칙)
 */
const NOTE_SAMPLES = {
  short: '할머니 집 마루에서 수박을 먹던 여름. 매미 소리가 시끄러웠습니다.',
  lines: '첫째 줄은 짧게.\n둘째 줄은 조금 더 길게 적어 두었습니다.\n셋째 줄까지만 보입니다.',
  url: `https://example.com/notes/${'abcdefghij'.repeat(14)}`.slice(0, 140), // 140글자 — 공백 없는 라틴 글(A16)
  hangul140: '가나다라마바사아자차카타파하'.repeat(10), // 140글자 — 띄어쓰기 없는 한글(D4: word-break normal이 아니면 낱말 하나로 취급된다)
  rtl: 'שלום עולם — مرحبا بالعالم', // 히브리 「שלום עולם」 · 아랍 「مرحبا بالعالم」(둘 다 「안녕, 세상」) — 라벨·나이의 순서가 안 바뀐다(A10)
  emoji: '\u{1F468}\u200D\u{1F469}\u200D\u{1F467} \u{1F1F0}\u{1F1F7} \u{1F44D}\u{1F3FD} 1\uFE0F\u20E3 \u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}', // 가족 ZWJ · 깃발 · 피부색 · 키캡 · 하위 지역 깃발(A3) — 그래핌 5
  latest: '오늘은 여기까지 적어 둡니다.',
};
const noteOverlay = (inner, cls = '', style = '') =>
  `<div class="overlay"${style}><div class="sheet sheet--note${cls ? ` ${cls}` : ''}" role="dialog" aria-modal="true" aria-labelledby="nc-kind nc-title" data-testid="note-sheet">${inner}</div></div>`;
/**
 * 시트 한 장(copy.md 7-2 DOM). state: '' 기본 / empty 빈 입력 안내(aria-invalid + 알림 줄 연결, 포커스 입력란) / confirm 확인 단계(두 버튼 자리에, 입력란 readonly) / off 끄기 누른 뒤(「켜기」 + 알림) / limit 40개 안내(안내 + 「닫기」만)
 * / compact = 가상 키보드가 올라온 상태의 표본(`--vv-h` 340px = K3 보장 높이, 인용·보조 설명 숨김). 구현의 compact 판정은 「포커스가 입력 영역(입력란·두 버튼·끄기 칸·확인 단계) 안에 있고 보이는 높이에 시트 전체가 들어가지 않을 때」(2026-10-19 마스터 지시,
 *   design-system.md 11-10 — 고정 문턱 520px 없음)이고 정적 시안은 그 결과 모양 하나를 고정해 보인다.
 * 대화상자 이름 = 「생각 남기기」 + 질문(aria-labelledby 두 id) — 질문이 길어도 종류가 먼저 읽힌다. 머리 「{연도}년 · {나이}세」는 FitPair hideSeparator(낭독 「2031년 5세」, R-403 ⑤).
 */
function noteSheet({ year, age, question, cite = null, text = '', state = '' }) {
  const compact = state === 'compact';
  const confirm = state === 'confirm';
  const empty = state === 'empty';
  const off = state === 'off';
  const T = NOTE_TEXT;
  const head = `<div class="sheet__head"><span class="sheet__kind sheet__kind--note" id="nc-kind">${esc(T.kind)}</span><span class="sheet__age">${fitPair(`${year}년`, `${age}세`, { hideSeparator: true })}</span></div>`;
  if (state === 'limit') {
    return noteOverlay(
      `${head}<div class="sheet__body"><h2 id="nc-title" class="sheet__title" tabindex="-1" style="--title-chars:${titleCharsFor(T.limitTitle)}">${esc(T.limitTitle)}</h2><p class="sheet__sub">${esc(T.limitSub)}</p><div class="sheet__foot"><button class="btn btn--primary" type="button" data-testid="note-close">${esc(T.close)}</button></div></div>`,
      'sheet--limit',
    );
  }
  const n = [...text].length; // 시안 표본은 결합 문자가 없어 코드 포인트 수 = 그래핌 수(구현은 Intl.Segmenter)
  const describedBy = ['note-hint', 'note-count-sr', empty ? 'note-msg' : ''].filter(Boolean).join(' ');
  const field = `<div class="field"><label class="sr-only" for="note-input">${esc(T.inputLabel)}</label>
        <textarea id="note-input" class="field__input" rows="3" dir="auto" autocomplete="off" spellcheck="false" maxlength="4000" data-user-text data-testid="note-input" aria-describedby="${describedBy}"${empty ? ' aria-invalid="true"' : ''}${confirm ? ' readonly' : ''}>${esc(text)}</textarea>
        <div class="field__hint"><span id="note-hint">${glueHtml(T.hint)}</span><span class="field__count" aria-hidden="true">${T.count(n, NOTE_MAX)}</span><span id="note-count-sr" class="sr-only">${esc(T.countSr(n, NOTE_MAX))}</span></div>
        <p id="note-msg" class="field__msg${empty ? ' field__msg--error' : ''}" role="status" aria-live="polite" data-testid="note-msg">${empty ? esc(T.emptyError) : ''}</p></div>`;
  const choices = confirm
    ? `<div class="note-confirm" role="group" aria-labelledby="nc-confirm-t" data-testid="note-confirm"><p id="nc-confirm-t" class="note-confirm__title" role="alert">${esc(T.confirmTitle)}</p><p class="note-confirm__sub">${esc(T.confirmSub)}</p><div class="note-confirm__actions"><button class="btn btn--secondary" type="button" data-testid="note-discard">${esc(T.confirmDiscard)}</button><button class="btn btn--primary" type="button" data-testid="note-back">${esc(T.confirmBack)}</button></div></div>`
    : `<div class="note-choices"><button class="note-choice note-choice--primary" type="button" data-testid="note-keep"><span class="note-choice__top"><span class="choice__no" aria-hidden="true">1</span>${esc(T.keep)}</span><span class="note-choice__sub">${esc(T.keepSub)}</span></button><button class="note-choice" type="button" data-testid="note-skip"><span class="note-choice__top"><span class="choice__no" aria-hidden="true">2</span>${esc(T.skip)}</span><span class="note-choice__sub">${esc(T.skipSub)}</span></button></div>`;
  const foot = confirm ? '' : `<div class="sheet__foot">${off ? `<p class="sheet__notice" role="status" data-testid="note-cards-notice">${glueHtml(T.cardsOffNotice)}</p>` : ''}<button class="btn btn--ghost btn--sm" type="button" data-testid="note-cards-toggle">${esc(off ? T.cardsOn : T.cardsOff)}</button></div>`;
  const body = `<div class="sheet__body"><h2 id="nc-title" class="sheet__title" tabindex="-1" style="--title-chars:${titleCharsFor(question)}">${esc(question)}</h2>${cite ? citeBox(cite) : ''}${field}${choices}${foot}</div>`;
  return noteOverlay(head + body, compact ? 'sheet--compact' : '', compact ? ' style="--vv-h:min(340px, 100dvh);--vv-top:0px"' : '');
}
/**
 * note.html — 한 장에 상태 아홉(`?state=`, decision-*과 같은 <template> 치환). 기본·typing·empty·confirm·off·compact·past = 5세 ① 영유아기 기억(연구 인용 c-102 — r4 QI13에서 c-037을 갈아 끼웠다 — 카드 연결은 notes.json의 `citation`, 표시는 구현 함수 citationText), manual·limit = 31세 수동 시트(인용 없음).
 * past: ① 지난 세상 표본 — c-102의 `eras`에 past·`eraPrefix.past` 「지금의 연구로는」이 citations.json에 들어왔으므로(D-79 닫힘) 실제 데이터로 그린다(옛 시안용 패치 사본은 지웠다).
 */
function notePage() {
  const name = HERO.name;
  const infantCite = (era) => {
    if (NOTE_CARD.infant.citation !== 'c-102') throw new Error(`기록 카드 ①의 인용 연결이 c-102이 아니다: ${NOTE_CARD.infant.citation}`);
    return citeViewOf(NOTE_CARD.infant.citation, era);
  };
  const infantSheet = (opts) => noteSheet({ year: HERO.birthYear + 5, age: 5, question: noteQuestionOf(NOTE_CARD.infant, name), cite: infantCite('present'), ...opts });
  const adultSheet = (opts) => noteSheet({ year: HERO.birthYear + 31, age: 31, question: noteQuestionOf(null, name), cite: null, ...opts });
  const infant = (sheet, extra = '', opts = {}) => dashboardBody('infant', sheet + extra, 5, opts);
  const adult = (sheet) => dashboardBody('adult', sheet, 3);
  const pastYear = eraModel('past').character.birthYear + 5;
  // compact 표본의 키보드 자리 글(시안 전용, inert·aria-hidden): 구현의 compact 판정 조건을 한 줄로 적어 둔다 — 보는 사람이 「340px 고정」으로 읽지 않게(2026-10-19 후속, D-83)
  const keyboard = '<div class="mock-keyboard" aria-hidden="true" inert style="--vv-h:min(340px, 100dvh)">가상 키보드 자리 — 시안 표시(실기기에서는 키보드가 이 영역을 덮는다). compact = 입력 영역에 포커스가 있고 보이는 높이에 시트 전체가 들어가지 않을 때 · 여기서는 보이는 높이 340px(보장 하한) · 질문은 한 줄로 시트 위에 고정(D-88)</div>';
  const pastTag = `<p class="mock-tag">시안 · 가짜 데이터 — 지난 세상 표본: 시트와 헤더 연도만 ${pastYear}년, 스크림 뒤 대시보드는 지금 세상 주인공 그대로</p>`;
  return statesPage('수저 게임 · 시안 · 생각 남기기 (자유 기록 카드)', {
    '': infant(infantSheet({})),
    typing: infant(infantSheet({ text: NOTE_SAMPLES.short })),
    empty: infant(infantSheet({ state: 'empty' })),
    confirm: infant(infantSheet({ text: NOTE_SAMPLES.short, state: 'confirm' })),
    off: infant(infantSheet({ state: 'off' })),
    compact: infant(infantSheet({ text: NOTE_SAMPLES.short, state: 'compact' }), keyboard),
    manual: adult(adultSheet({})),
    limit: adult(adultSheet({ state: 'limit' })),
    past: infant(infantSheet({ year: pastYear, cite: infantCite('past') }), '', { yearOverride: pastYear, tagNote: pastTag }),
  });
}
/** 엔딩 연표 한 줄(구현 EndingScreen#TimelineItem과 같은 마크업). 「나의 기록」 줄은 인생 기록 줄과 같은 부품(NoteText): 제목 자리에 라벨(FitPair hideSeparator), 문장 자리에 사용자 글(<bdi data-user-text>) */
const timelineLi = (e) =>
  e.kind === 'note'
    ? `<li class="is-note" data-kind="note"><span class="log__age">${e.age}세</span><span>${noteLabel(e.topic)}<bdi class="tl-text note-text" dir="auto" data-user-text>${esc(e.text)}</bdi></span></li>`
    : `<li class="${e.kind === 'choice' ? 'is-choice' : ''}" data-kind="${e.kind}"><span class="log__age">${e.age}세</span><span>${e.title ? `<strong>${esc(e.title)}</strong>` : ''}${e.choice ? `<span class="tl-picked">${esc(DASH_TEXT.logChoicePrefix)}${esc(e.choice)}</span>` : ''}<span class="tl-text">${esc(e.text)}</span></span></li>`;
/**
 * note-rows.html — 「나의 기록」 줄 표본 한 장(copy.md 7-4): 인생 기록 카드(짧은 글·3줄·긴 URL·띄어쓰기 없는 한글 140자·히브리/아랍 글·그림 문자·최신 줄)와 엔딩 연표의 note 행. 기록 목록의 높이 상한은 표본을 다 보이려고 이 장에서만 푼다 —
 * 그래서 목록이 안에서 스크롤하지 않으므로 role=region·tabindex=0(스크롤 상자를 Tab 정지점으로 올리는 구현 LogCard의 이유)도 두지 않는다(스크롤하지 않는 목록은 Tab 정지점이 아니다; 두면 화면보다 큰 포커스 대상이 되어 CM10 감사에 걸린다).
 * 사용자 글(data-user-text)은 어디서든 끊길 수 있는 글이라 낱말 끊김 감사에서 뺀다 — 라벨·나이·우리 문구는 감사 대상 그대로.
 */
function noteRowsPage() {
  const T = NOTE_TOPIC;
  const S = NOTE_SAMPLES;
  const rows =
    logRow(4, '동생이 걷기 시작했습니다.') +
    logNote(5, T.infant, S.short) +
    logRow(12, '반 친구들과 축구를 하다 무릎이 까졌습니다.') +
    logNote(13, T.teen, S.lines) +
    logNote(16, T.firstLove, S.url) +
    logNote(29, T.romance, S.hangul140) +
    logNote(31, T.manual, S.rtl) +
    logNote(31, T.manual, S.emoji) +
    logRow(32, '일하던 곳과 계약이 한 해 더 이어졌습니다.') +
    logNote(33, T.manual, S.latest, 'log__row--latest');
  const log = `<section class="card log" aria-label="인생 기록"><div class="card__head" style="margin-bottom:var(--sp-2)"><h2 class="card__title">${esc(DASH_TEXT.logTitle)}</h2><span class="t-xs t-faint">${glueHtml(DASH_TEXT.logHint)}</span></div>
  <div class="log__list" style="max-height:none;overflow:visible"><ol class="log__rows">${rows}</ol></div>
  <button type="button" class="btn btn--secondary btn--sm log__jump" data-testid="log-jump">${glueHtml(DASH_TEXT.logJump(1))}</button></section>`;
  const group = (stage, items) => `<div class="tl-group"><h3>${glueHtml(stageHeadingText(stage))}</h3><ol class="timeline">${items.map(timelineLi).join('')}</ol></div>`;
  const ending = `<section class="card" aria-labelledby="ending-timeline-title"><h2 id="ending-timeline-title" class="card__title card__title--gap">${esc(ENDING_HEADINGS.timeline)}</h2>${group('infant', [
    { age: 4, kind: 'event', text: '동생이 걷기 시작했습니다.' },
    { age: 5, kind: 'note', topic: T.infant, text: S.short },
  ])}${group('school', [
    { age: 13, kind: 'note', topic: T.teen, text: S.lines },
    { age: 16, kind: 'note', topic: T.firstLove, text: S.url },
    { age: 19, kind: 'choice', title: '대학 진학', choice: '학자금 대출을 받아 진학한다', text: '학자금 대출을 받아 대학에 들어갔습니다.' },
  ])}${group('youth', [
    { age: 29, kind: 'note', topic: T.romance, text: S.hangul140 },
    { age: 31, kind: 'note', topic: T.manual, text: S.rtl },
    { age: 31, kind: 'note', topic: T.manual, text: S.emoji },
  ])}</section>`;
  return page({ title: '수저 게임 · 시안 · 나의 기록 줄 표본', body: `<main class="ending">${log}${ending}${MOCK_TAG}</main>`, bodyClass: 'is-dash' });
}

/**
 * 대시보드 본문(헤더 + 도구 줄 + 세 열 + 본문 끝 여백 [+ 시트]). overlay = 모달 시트(M7b 수동 카드·M7c 자유 기록 카드) — 있으면 바깥(헤더·도구 줄·main·여백)이 `inert`.
 * center = 가운데 열 맨 위에 두는 비모달 카드(M7b 자동 모드의 인라인 카드·접힌 띠 — 1열에서는 헤더·진행 줄 바로 아래, ds.css .col--center). auto = 자동 모드 켜짐.
 * 선택지 대기(overlay 또는 center)는 「다음 결정으로」 지속 비활성이고 **일시정지가 아니다**(구현: 시계만 멈춘다, 버튼 이름 「일시정지」 그대로 — 2026-10-19 바로잡음). 「생각 남기기」는 모든 대시보드에서 보통 버튼(M7c D-75).
 */
function dashboardBody(kind, overlay = '', infantAge = 3, { center = '', auto = false, tools = true, yearOverride = null, tagNote = '' } = {}) {
  const infant = kind === 'infant';
  const age = infant ? infantAge : 31;
  const modal = overlay !== '';
  const pending = modal || center !== '';
  // yearOverride·tagNote: M7c note.html의 지난 세상 표본(?state=past) — 시트와 헤더 연도만 그 세상, 뒤 대시보드(스크림 뒤)는 지금 세상 주인공 그대로이고 그 사실을 시안 표식에 적는다
  const head = dashHead({ age, year: yearOverride ?? HERO.birthYear + age, progress: infant ? 62 : 38, paused: false, pending, auto, inert: modal });
  const inertAttr = modal ? ' inert' : '';
  const rowsInfant =
    logRow(0, esc(HERO.sentence)) + // 인생 기록 0세 첫 줄 = 출생신고 서술문(BR3, core/birthReport.ts#birthSentence)
    logRow(0, '기본 예방접종을 받았습니다.') +
    logRow(1, '첫 걸음마를 뗐습니다. 온 가족이 박수를 쳤습니다.') +
    logRow(1, '첫 단어를 말했습니다. ‘엄마’라는 뜻의 말이었습니다.') +
    logRow(2, '엄마와 즐거운 시간을 보냈습니다.') +
    logRow(3, '동생을 맞이했습니다.', '', age === 3 ? 'log__row--latest' : '') +
    (age >= 4 ? logRow(4, '동생이 걷기 시작했습니다.', '', 'log__row--latest') : '');
  // 단계 줄도 다른 줄처럼 「N세 + 문장」(연표 한 줄 = 기록 한 줄, 문장은 구현 상수 STAGE_ENTRY_TEXT — 어체는 M7e) — 글자 색·2px 아래선으로만 구분(M4 구현에 맞춤 2026-10-17)
  const rowsAdult =
    logRow(20, esc(STAGE_ENTRY_TEXT.youth), '', 'log__row--stage') +
    logRow(24, '학자금 대출을 갚기 시작했습니다.', '(선택: 대출을 유지한다)') +
    logRow(27, '계약직으로 첫 직장에 들어갔습니다.') +
    logRow(29, '가까워진 사람과 만남을 시작했습니다.', '(선택: 연애를 시작한다)') +
    logNote(29, NOTE_TOPIC.romance, '퇴근길에 같이 걷던 저녁이 오래 남았다.') +
    logRow(30, '보증금을 올려 달라는 연락을 받아 월세 집으로 옮겼습니다.') +
    logRow(31, '일하던 곳과 계약이 한 해 더 이어졌습니다.', '', 'log__row--latest');
  // 본문 끝 여백은 고정 진행 줄의 실제 높이(--bar-h)를 따르는 .page-end-space — 150px 같은 고정값을 두지 않는다(11-1절, 2026-10-17)
  return `${head}
<main class="dash"${inertAttr}>
  <div class="col">
    ${profileCard({ ageGroup: infant ? 'toddler' : 'young', edu: infant ? '취학 전' : '대학교 졸업' })}
    ${statusCard(infant ? [82, 70, 38, 61] : [74, 58, 66, 62])}
    ${assetsCardOf(age)}
  </div>
  <div class="col col--center">${center}${logCard(infant ? rowsInfant : rowsAdult, infant ? 0 : 2)}</div>
  <div class="col">
    ${familyCard(age)}
    ${peersCard(infant ? ['어린 시절', '어린 시절', '어린 시절', '어린 시절'] : ['일하는 사람', '구직 중', '일하는 사람', '돌봄'])}
    ${tagNote || MOCK_TAG}
  </div>
</main>
<div class="page-end-space"${inertAttr}></div>
${overlay}
${overlay || !tools ? '' : toolbarStates()}`;
}
function dashboardPage(kind, overlay = '', infantAge = 3, opts = {}) {
  const infant = kind === 'infant';
  return page({ title: `수저 게임 · 시안 · 대시보드 (${infant ? '영유아 시점' : '성인 시점'})`, body: dashboardBody(kind, overlay, infantAge, opts), bodyClass: 'is-dash' });
}
/**
 * M7b 카드 시안 한 장에 상태 여럿(`?state=`): 기본 = 수동 모달 시트. 나머지 상태의 본문 전체를 <template>에 두고 주소 질의에 따라 #mock-root를 통째로 바꿔 끼운다(엔딩 시안 `?state=`와 같은 방식 —
 * 상태마다 헤더의 자동 모드 버튼·inert·가운데 열이 다르기 때문). 치환은 파싱 중 동기 실행이라 page()의 DOMContentLoaded 흉내(띠 높이·FitPair·다크 토글)가 새 요소를 본다.
 */
function statesPage(title, states) {
  const entries = Object.entries(states);
  const [, main] = entries[0];
  const templates = entries
    .slice(1)
    .map(([name, bodyHtml]) => `<template id="state-${name}">${bodyHtml}</template>`)
    .join('\n');
  const body = `<div id="mock-root">${main}</div>
${templates}
<script>(function(){var s=new URLSearchParams(location.search).get('state');if(!s)return;var t=document.getElementById('state-'+s);if(!t)return;var root=document.getElementById('mock-root');root.replaceChildren(t.content.cloneNode(true));document.title+=' ('+s+')';})();</script>`;
  return page({ title, body, bodyClass: 'is-dash' });
}
const decisionPage = (kind, states) => statesPage(`수저 게임 · 시안 · 중대 결정 카드 (${kind === 'infant' ? '영유아 시점' : '성인 시점'})`, states);
/** 카드 하나의 (year, era) — 시안 주인공은 지금 세상 2026년생 */
const cardAt = (card) => ({ ...card, year: HERO.birthYear + card.age, era: 'present' });
/** decision-infant.html: 기본 = 「동생이 생겼다」 + 연구 c-033(저자 5명 → 「Teti 외」, 긴 영문 원제) 수동 시트 / kinder = 「유치원 고르기」 + 통계 c-061(기관 둘 쉼표 나열 · 자료 이름 쌍점) 수동 시트 / auto = 「동생이 생겼다」의 자동 모드 인라인 틀(full 샷으로 카드 전체 — 긴 표본) */
function decisionInfantPage() {
  const sib = cardAt(INFANT_CARDS.sibling);
  const kinder = cardAt(INFANT_CARDS.kinder);
  return decisionPage('infant', {
    default: dashboardBody('infant', decisionSheet(sib), sib.age, { tools: false }),
    kinder: dashboardBody('infant', decisionSheet(kinder), kinder.age, { tools: false }),
    auto: dashboardBody('infant', '', sib.age, { center: decisionInline(sib), auto: true, tools: false }),
  });
}
/** decision-adult.html: 기본 = 「같은 팀의 사람」(인용 없음 — 빈 박스 0) 수동 시트 / stat = 「살 곳을 구하는 일」 + 통계 c-015 수동 시트 / collapsed = 접힌 띠(수동) / auto = 자동 모드 인라인 카드(통계 인용) / auto-collapsed = 자동 모드에서 접힌 띠 */
function decisionAdultPage() {
  const romance = cardAt(ADULT_CARDS.romance);
  const housing = cardAt(ADULT_CARDS.housing);
  return decisionPage('adult', {
    default: dashboardBody('adult', decisionSheet(romance), 31, { tools: false }),
    stat: dashboardBody('adult', decisionSheet(housing), 31, { tools: false }),
    collapsed: dashboardBody('adult', '', 31, { center: foldBand(romance.ev), tools: false }),
    auto: dashboardBody('adult', '', 31, { center: decisionInline(housing), auto: true, tools: false }),
    'auto-collapsed': dashboardBody('adult', '', 31, { center: foldBand(housing.ev), auto: true, tools: false }),
  });
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
 *  ④ (M8, 2026-10-19) 「사망과 선택」 카드 끝의 **플레이 시간 블록**(copy.md 8절): 「이 판의 플레이 시간 mm:ss」 한 줄 + 보조 문장(세월이 흐른 시간·결정을 읽고 고른 시간 분해, 제외 범위, 깨끗하지 않은 판 표시, 이 기기에만). 값은 M8 시간 모델(content-M8 2-6절, k = 1.2 · 지금·다가올 r 26초 · 지난 22초)로 그 판의 사망 나이·선택 수에서 계산한 모델값이다.
 *     추가 상태: play-fast = 배속·「다음 결정으로」를 쓴 판(깨끗하지 않은 판 문장) / play-long = 한 시간을 넘긴 판(61:05 — mm:ss 표기 점검용, 1차 30분 모드에서는 나오기 어렵고 2차 1시간 모드의 값) / play-none = `play` 없는 판(M8 이전 저장 — 블록 없음).
 *     글자·값·시간 부품은 구현(`PLAYTIME_TEXT`·`displaySeconds`·`isCleanRun`·`PlayTime`) 그대로이고 플레이 기록은 저장 모양(`playRecord`, `readPlay` 통과) — 2026-10-19 후속 D-96.
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
function endingMain({ era, c, month, death, net, choiceCount, entries, note = '', play = null, playNote = '' }) {
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
  // 연표 한 줄 = 구현 EndingScreen#TimelineItem과 같은 마크업(나이 · [제목] · [선택: 이름] · 문장). 사망 줄은 굵게(data-kind="death"), 선택 줄은 왼쪽 쪽빛 선(.is-choice).
  // 「나의 기록」 줄(.is-note, M7c FR9)은 인생 기록 줄과 **같은 부품**(NoteText — 라벨 FitPair hideSeparator + <bdi data-user-text>, D3): 제목 자리에 라벨, 문장 자리에 사용자 글
  const li = timelineLi;
  const timeline = groups.map((g) => `<div class="tl-group"><h3>${glueHtml(stageHeadingText(g.stage))}</h3><ol class="timeline">${g.entries.map(li).join('')}</ol></div>`).join('');
  const finalNet = early
    ? `<dl class="final-net final-net--early"><dt>${esc(FINAL_NET_TEXT.label)}</dt><dd class="final-net__none">${esc(FINAL_NET_TEXT.early)}</dd></dl>`
    : `<dl class="final-net"><dt>${esc(FINAL_NET_TEXT.label)}</dt><dd><span class="final-net__value nowrap">${esc(formatMan(net))}</span>${era === 'present' ? '' : `<span class="tag">${esc(FINAL_NET_TEXT.basis)}</span>`}</dd></dl>`;
  return `<main class="ending" data-state-era="${era}">
  <div class="ending__head">${face(ageGroupIdOf(death.age), c.gender, 3, `${c.name}의 얼굴`, 'face--lg')}
    <div class="ending__who"><p class="label">${glueHtml(`${ERA_CONFIG[era].label} · ${ENDING_HEAD_LABEL}`)}</p><h1 class="t-title" style="--title-chars:${titleCharsFor(title)}">${esc(title)}</h1><p class="t-muted">${glueHtml(endingSpanText(c.birthYear, month, deathYear, death.age))}</p></div></div>
  <section class="card stack--sm stack" aria-label="${esc(DASH_TEXT.endingSummaryLabel)}"><p>${esc(deathLineText(death))}</p><p class="t-muted">${esc(choiceCountText(choiceCount))}</p>${playtimeHtml(play)}${playNote}</section>
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
  <section class="rebirth"><button class="btn btn--primary btn--lg btn--block" type="button">${esc(REBIRTH_LABEL)}</button><p class="t-sm t-muted">${glueHtml(REBIRTH_NOTE)}</p></section>
  ${MOCK_TAG}
</main>`;
}

function endingPage() {
  const c = HERO_STATE.character;
  const month = HERO_STATE.report.month;
  const birthRow = { age: 0, kind: 'event', text: HERO.sentence };
  // 기본: 지금 세상 흙수저, 84세 노환, 27번 선택, 최종 순자산 2억 4,000만 원(중앙값 위 — 자리·방향은 함수가 정한다: 「앞선 자리」)
  // 플레이 시간(M8)은 그 판의 모델값(content-M8 2-6절 공식, 1배속 수동·k = 1.2): 연출 = 1.2 × ((사망 나이 − 선택 수) × 9.0 + 13 × 선택 수 + 11)초, 결정 읽기 = 선택 수 × 26초(지금·다가올 세상; 지난 세상은 9.3·22초) — 84세·27번 = 17:30 + 11:42 = 29:12
  const mainArgs = {
    era: 'present',
    c,
    month,
    death: { age: 84, cause: '노환' },
    net: 24000,
    choiceCount: 27,
    play: playRecord(1050, 702),
    entries: [
      birthRow,
      // 「나의 기록」 줄(M7c FR9): 라벨(FitPair hideSeparator)과 글(<bdi data-user-text>)이 세로로 쌓인 두 칸 — 인생 기록 줄과 같은 부품(NoteText, 강제 줄바꿈 <br> 없음, R-300). 주제는 content-M7c 1-3절 라벨
      { age: 5, kind: 'note', topic: NOTE_TOPIC.infant, text: NOTE_SAMPLES.short },
      { age: 19, kind: 'choice', title: '대학 진학', choice: '학자금 대출을 받아 진학한다', text: '학자금 대출을 받아 대학에 들어갔습니다.' },
      { age: 20, kind: 'stage', text: STAGE_ENTRY_TEXT.youth },
      { age: 29, kind: 'note', topic: NOTE_TOPIC.romance, text: '퇴근길에 같이 걷던 저녁이 오래 남았다.' },
      { age: 40, kind: 'stage', text: STAGE_ENTRY_TEXT.middle },
      { age: 52, kind: 'choice', title: '가게', choice: '작은 가게를 연다', text: '작은 가게를 열었습니다.' },
      { age: 65, kind: 'stage', text: STAGE_ENTRY_TEXT.senior },
      { age: 84, kind: 'death', text: deathEntryText('노환') },
    ],
  };
  const main = endingMain(mainArgs);
  // zero: 최종 순자산 0원 — 노년 안전망으로 0원에 머문 판(QA-003-M5 O04). 자리는 동률 불리 규칙(마스터 결정 C)의 함수 출력 그대로. 플레이 시간 81세·24번 = 16:43 + 10:24
  const zeroEnd = finalWealthStanding('present', 0);
  const zero = endingMain({
    era: 'present',
    c,
    month,
    death: { age: 81, cause: '노환' },
    net: 0,
    choiceCount: 24,
    play: playRecord(1003, 624),
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
    play: playRecord(959, 484), // 지난 세상(서술 비율이 높아 조용한 해 가중 9.3초, 인용이 드물어 r 22초): 76세·22번 = 15:59 + 08:04 = 24:03
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
    play: playRecord(180, 91), // 17세·3번 = 03:00 + 01:31 = 04:31 (영유아 해는 서술·여러 줄 해가 많아 모델 평균보다 조금 길게)
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
    play: playRecord(860, 494), // 70세·19번 = 14:20 + 08:14 = 22:34
    entries: [
      { age: 0, kind: 'event', text: birthSentence(downBirth.character, downBirth.report, 'present') },
      { age: 20, kind: 'stage', text: STAGE_ENTRY_TEXT.youth },
      { age: 40, kind: 'stage', text: STAGE_ENTRY_TEXT.middle },
      { age: 65, kind: 'stage', text: STAGE_ENTRY_TEXT.senior },
      { age: 70, kind: 'death', text: deathEntryText('병세 악화') },
    ],
  });
  // M8 플레이 시간 상태 셋(기본 판과 같은 인생, 플레이 기록만 다르다 — copy.md 8-3)
  // play-fast: 8배속 + 「다음 결정으로」를 쓴 판 — 연출이 거의 없고(03:12, 전부 1배속이 아닌 시간이라 offSpeed = hold) 결정 읽기만 남아(09:40) 12:52, 건너뛰기 6번. 깨끗하지 않은 판(isCleanRun 거짓)이라 보조 문장에 한 문장이 더 든다
  const playFast = endingMain({
    ...mainArgs,
    play: playRecord(192, 580, { offSpeed: 192 * 1000, skips: 6 }),
    playNote: '<p class="mock-tag">시안 주석 · 배속·「다음 결정으로」를 쓴 판 — 깨끗하지 않은 판의 보조 문장(content-M8 5-2 offSpeed·auto·skips)</p>',
  });
  // play-long: 한 시간을 넘긴 판 — mm:ss 표기 상한 없음(61:05, 낭독 「61분 5초」)의 점검용. 1차 30분 모드(k = 1.2)에서는 읽기 상한(42초)으로도 36분 안팎이라 나오기 어렵고 2차 1시간 모드의 값이다
  const playLong = endingMain({
    ...mainArgs,
    play: playRecord(2000, 1665),
    playNote: '<p class="mock-tag">시안 주석 · 한 시간을 넘긴 판의 표기 점검(분은 두 자리 이상, 시 단위로 바꾸지 않는다 — 2차 1시간 모드의 값)</p>',
  });
  // play-none: `play`가 없는 판(M8 이전에 시작한 저장) — 블록을 그리지 않는다(content-M8 5-3절)
  const playNone = endingMain({
    ...mainArgs,
    play: null,
    playNote: '<p class="mock-tag">시안 주석 · M8 이전 저장(play 없음) — 플레이 시간 블록을 그리지 않는다</p>',
  });
  const head = `<header class="site-head">${headerLogo()}<span class="site-head__name">엔딩</span></header>`;
  const body = `${head}
${main}
<template id="state-zero">${zero}</template>
<template id="state-past">${pastMain}</template>
<template id="state-early">${earlyMain}</template>
<template id="state-down">${downMain}</template>
<template id="state-play-fast">${playFast}</template>
<template id="state-play-long">${playLong}</template>
<template id="state-play-none">${playNone}</template>
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
    <p class="t-sm t-muted" style="margin-top:var(--sp-2)">눌림 상태는 색 반전 + 굵은 아래 막대 + aria-pressed로 알립니다. 터치 대상은 44×44px 이상. 비활성은 둘: 진입 직후 0.4초 입력 가드(과도 상태)는 0.55 흐림, <strong>지속 비활성</strong>(「다음 결정으로」 — 자동 모드 내내·선택지 대기 중)은 옅은 글자(--c-text-3) + 점선 테두리로 글자 4.5:1을 지킵니다(라디오 카드 「준비 중」과 같은 모양, 2026-10-17 — 구현 R-337). 「생각 남기기」가 같은 모양이던 것은 M4 r2~M7b까지이고(R-326) M7c부터 보통 버튼입니다.</p></section>
  <section id="tools"><h2>도구 줄 (모바일) — BGM 켜짐·다크모드 켜짐 상태, 「생각 남기기」는 시트를 여는 보통 버튼(M7c)</h2><div class="controls__tools controls__tools--stack" style="max-width:360px">${toolBtn('bgm', 'music', DASH_TEXT.toolBgm, true)}${toolBtn('note', 'pencil', DASH_TEXT.toolNote, false, { dialog: true })}<button class="btn btn--tool" type="button" aria-pressed="true">${icon('sun')}<span>${esc(DASH_TEXT.toolDark)}</span><span class="sr-only">켜짐</span></button>${toolBtn('feedback', 'message', DASH_TEXT.toolFeedback)}${toolBtn('exit', 'exit', DASH_TEXT.toolExit)}</div>
    <p class="t-sm t-muted" style="margin-top:var(--sp-2)">켜짐 = aria-pressed="true" + 색 반전 + 아래 막대 + 아이콘 교체(다크모드: 달 → 해) + 읽기 전용 「켜짐」. 이름은 낱말 단위로 두 줄까지 줄바꿈. 「생각 남기기」는 M7c부터 <strong>보통 버튼</strong>(aria-haspopup="dialog" — 누르면 기록 시트 note.html이 열린다, 결정 시트가 떠 있는 동안은 도구 줄 전체가 inert). M4 r2~M7b의 지속 비활성 + 「준비 중」 알약(R-326)은 구현과 함께 지웠다.</p></section>
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
  <section><h2>캐러셀 조작 줄(오른쪽 위 소형, 지표 ${CAROUSEL_TOTAL}개) · 점(5개 이하일 때만)</h2><div class="carousel carousel--005" style="max-width:420px"><div class="carousel__nav"><button class="nav-btn" type="button" aria-label="이전 지표"><span class="nav-btn__box">${icon('prev')}</span></button><span class="carousel__status num" aria-hidden="true">3 / ${CAROUSEL_TOTAL}</span><button class="nav-btn" type="button" aria-label="다음 지표"><span class="nav-btn__box">${icon('forward')}</span></button><button class="nav-btn carousel__pause" type="button" aria-label="자동 넘김 일시정지"><span class="nav-btn__box">${icon('pause')}</span></button></div></div>
    <p class="t-sm t-muted" style="margin-top:var(--sp-2)">눈에 보이는 머리글은 없고(SH4) 조작 줄이 카드 오른쪽 위에 있다(SH5) — 자동 넘김의 상태는 일시정지 버튼의 아이콘·이름이 말한다(SH6). 값 줄과 분모 기준 줄은 나눈다: 「27.8<small>명</small>」 / 「인구 10만 명당」(QM2-4), 공식 통계명(기준 연도)은 표제어 아래 줄(SH3).</p>
    <div class="dots" style="max-width:320px;margin-top:var(--sp-3)">${Array.from({ length: 5 }, (_, i) => `<button type="button" aria-label="${i + 1}/5" ${i === 3 ? 'aria-current="true"' : ''}><i></i></button>`).join('')}</div></section>
  <section><h2>하단 고정 띠 (높이를 --bar-h로 알리고 본문 끝 여백·scroll-padding이 따른다 — CM10·QM2-12)</h2><div class="card" style="position:relative;height:150px;overflow:hidden"><p class="t-muted">본문…</p><div class="bottom-bar" style="position:absolute"><button class="btn btn--primary btn--lg" type="button">태어나기</button></div></div>
    <div class="card" style="position:relative;height:200px;overflow:hidden;margin-top:var(--sp-3)"><p class="t-muted">확인 단계 — 맨 아래는 안전한 「돌아가기」(기본), 그 위가 이전 판을 지우는 확인(보조)</p><div class="bottom-bar" style="position:absolute"><p class="bottom-bar__ask" role="alert">이전 판이 사라집니다. 새로 태어날까요?</p><div class="bottom-bar__stack"><button class="btn btn--secondary" type="button">이전 판 지우고 태어나기</button><button class="btn btn--primary btn--lg" type="button">돌아가기</button></div></div></div></section>
  <section id="cite"><h2>인용 박스 (M7b — 종류 라벨 → 시대 머리말 + 요약 ≤ 100자 → 출처 한 줄, copy.md 6-3)</h2>
    <p class="t-sm t-muted">실제 인용(src/data/citations.json)을 구현 함수(src/core/citations.ts)로 그린 표본 다섯: 통계(지금 세상) · 연구 1저자 · 지난 세상의 시대 무관 연구(「지금의 연구로는」 — 머리말 포함 ${citeViewOf('c-032', 'past').text.length}자, 100자 경계) · 다가올 세상(「지금 기준으로는」) + 저자 5명 「Teti 외」 + 긴 영문 원제 · 기관 둘의 통계(「국가데이터처, 교육부」 쉼표 나열, 자료 이름 「초중고사교육비조사: …」 — 요약은 developer r2 문장 「방과후학교와 돌봄(늘봄학교)에」(가운뎃점 사슬 없음), 「돌봄(늘봄학교)에」·「52.2%」가 Glue 묶음). 링크·DOI·URL은 어디에도 없다(EV6).</p>
    <div class="stack--sm stack" style="max-width:480px">${citeBox(citeViewOf('c-006', 'present'))}${citeBox(citeViewOf('c-032', 'present'))}${citeBox(citeViewOf('c-032', 'past'))}${citeBox(citeViewOf('c-033', 'future'))}${citeBox(citeViewOf('c-063', 'present'))}</div>
    <p class="t-sm t-muted" style="margin-top:var(--sp-3)">출처 줄 변환 예(splitSourceLine — 통계는 기관 그대로, 기관이 둘 이상이면 쉼표 나열, 자료 이름의 띄어 쓴 줄표 「 — 」는 쌍점 「: 」(QM2-10); 연구는 저자 성만: 1명 / 2명 「A·B」 / 3명 이상 「첫 저자 외」, 원제는 줄표도 그대로; 열람 연도는 「N년 열람」, 기관이 괄호로 끝나면 연도 앞 한 칸):</p>
    <ul class="t-xs t-faint" style="list-style:disc;padding-left:1.2em;max-width:720px">${['c-006', 'c-063', 'c-074', 'c-032', 'c-036', 'c-033', 'c-035', 'c-039'].map((id) => { const c = citeOf(id); const src = splitSourceLine(c.source, c.kind); const titleChanged = src.title !== c.source.title; return `<li><code>${esc(c.source.org)}</code>${titleChanged ? ` · <code>${esc(c.source.title)}</code>` : ''} → <span class="keep-phrase">${esc(src.head)}</span> ${esc(src.title)}</li>`; }).join('')}</ul></section>
  <section><h2>프로필 얼굴</h2><div class="row row--wrap" style="align-items:flex-start;gap:var(--sp-6)">${face('young', 'male', 4, '청년 남성 얼굴 예시', 'face--lg')}${face('middle', 'female', 2, '중년 여성 얼굴 예시', 'face--lg')}</div></section>
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
write('decision-infant.html', decisionInfantPage()); // M7b: ?state=kinder|auto
write('decision-adult.html', decisionAdultPage()); // M7b: ?state=stat|collapsed|auto|auto-collapsed
write('note.html', notePage()); // M7c 자유 기록 「생각 남기기」 시트: ?state=typing|empty|confirm|off|compact|manual|limit|past (도구 줄의 「생각 남기기」는 보통 버튼)
write('note-rows.html', noteRowsPage()); // M7c 「나의 기록」 줄 표본(인생 기록 + 엔딩 연표): 긴 URL·띄어쓰기 없는 한글 140자·히브리/아랍 글·그림 문자·3줄·최신 줄
write('ending.html', endingPage());
write('components.html', componentsPage());
write('economy-m5.html', economyPage());
write('symbols.html', symbolsPage());
write('faces.html', faceSheetPage(false));
write('faces-all.html', faceSheetPage(true));
console.log('mockups written');
