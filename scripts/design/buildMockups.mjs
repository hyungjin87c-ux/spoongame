/**
 * 화면 시안 HTML을 만든다 (SPEC-003 DS6, designer). 가짜 데이터(한 인물 「이서연」의 데이터는 화면 사이에서 일치한다), 정적 HTML.
 * 실행: npx vite-node scripts/design/buildMockups.mjs   → docs/design/mockups/*.html  (faceLayers.ts를 읽으므로 vite-node)
 * 스크린샷: npx vite-node scripts/design/shootMockups.mjs
 * 순서: buildBrand → buildIcons → buildMockups → shootMockups (자산이 바뀌면 처음부터)
 *
 * 시안은 src/styles/tokens.css 와 docs/design/mockups/ds.css 만 쓴다. 화면 구현은 이 구조·클래스를 기준으로 옮긴다.
 * 문구는 docs/design/copy.md 가 기준이다(80억 분의 1 고유 문구와 겹치지 않게 자체 작성, REV-003-D-1 R-123·R-124).
 * 통계 값은 src/data/koreaStats.json(usable: true)에서 읽는다 — 시안에 가짜 수치를 적지 않는다(R-133).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { AGE_GROUPS, faceSvg } from '../../src/assets/faces/faceLayers.ts';
import { startBandOf } from '../../src/core/ending.ts';
import { standingLabel } from '../../src/data/birthText.ts';
import { ENDING_HEADINGS, JOURNEY_NOTE, MOVEMENT_TEXT, REBIRTH_LABEL, REBIRTH_NOTE, bandLabel, choiceCountText, deathLineText, journeyText } from '../../src/data/endingText.ts';
import { formatIndicatorValue, getCarouselIndicators } from '../../src/data/koreaStatsAccess.ts';
import { deathEntryText } from '../../src/data/lifeText.ts';
import { DEFAULT_KEY, GRADES, ROOT, esc, face, gradeChip, gradeText, headerLogo, icon, impact, logo, MOCK_TAG, meter, page, reelSpoon, spoon, spoonLineup } from './mockLib.mjs';

const OUT = ROOT + 'docs/design/mockups/';
const write = (name, html) => writeFileSync(OUT + name, html, 'utf-8');
const STATS = JSON.parse(readFileSync(ROOT + 'src/data/koreaStats.json', 'utf-8'));
const indicator = (id) => {
  const s = STATS.indicators.find((i) => i.id === id);
  if (!s || !s.usable) throw new Error(`koreaStats.json: ${id} 가 없거나 usable이 아니다`);
  return s;
};
/** 수저 구간 글자의 단일 출처(R-170): bandLabel(startBandOf(era, wealth)). 시안은 이 함수 출력만 적는다 — 「약 N%」(standingLabel)는 외모·체중·엔딩 도착 자리 전용 */
const band = (era, wealth) => bandLabel(startBandOf(era, wealth));

// ---------- 가짜 인물 데이터 (화면 사이에서 일치) ----------
const N_POP = '51,284';
/** 엔딩 도착 자리(시안용 가짜 값) — 화면 글자·읽기용 설명 모두 standingLabel(END_STANDING) 출력으로 적는다(R-191(d)) */
const END_STANDING = { kind: 'top', percent: 38, within: false };
const HERO = {
  name: '이서연', gender: '여성', birth: '2026년 1월', birthYear: 2026, era: 'present', region: '경기도 화성시', regionShort: '경기', grade: 1,
  motherAge: 29, motherJob: '판매직', fatherAge: 32, fatherJob: '운송업', housing: '월세 · 다세대주택', weight: '3.3kg', weightRank: '상위 약 38%',
  order: '첫째', parenting: '엄격', looks: '상위 약 46%', // 외모 원점수는 어디에도 적지 않는다(R-135①)
  endRank: standingLabel(END_STANDING), // 「상위 약 38%」
};
HERO.gradeRange = band(HERO.era, HERO.grade); // 「하위 25% 안쪽」 — 룰렛 결과·출생신고·프로필·엔딩 출발선이 모두 이 값
/** 같은 해 태어난 네 사람 — 지역과 수저를 고정관념과 어긋나게 섞고, 계층 상징 지명(강남·해운대 등)과 특정 구 묶음의 통념(이른바 노도강 등)을 피한다(R-125, REV-003-D-2 관찰) */
const PEERS = [
  ['김도윤', '대전광역시 서구', '남', 1],
  ['박서윤', '부산광역시 연제구', '여', 2],
  ['최민재', '전남광주통합특별시 순천시', '남', 4],
  ['정하린', '경상북도 안동시', '여', 3],
];
const CREDIT = '지금 세상·다가올 세상 이름 출처: 대한민국 법원 전자가족관계등록시스템 통계서비스 「상위 출생신고 이름 현황」(등록일 기준 잠정치, 2026-10-13 조회)';

// ---------- 공통 조각 ----------
const radioCard = ({ title, desc, selected, name, meta = '' }) => `<label class="radio-card${selected ? ' is-selected' : ''}">
  <input type="radio" name="${name}" ${selected ? 'checked' : ''}>
  <span class="radio-card__mark">${icon('check')}</span>
  <span class="radio-card__body"><span class="radio-card__head"><span class="radio-card__title">${title}</span>${meta ? `<span class="radio-card__meta">${meta}</span>` : ''}</span><span class="radio-card__desc">${desc}</span></span>
  ${selected ? '<span class="sr-only">선택됨</span>' : ''}
</label>`;

function lineChart(values, years, unit) {
  const W = 320, H = 156, L = 10, R = 40, T = 26, B = 26;
  const min = Math.min(...values), max = Math.max(...values);
  const x = (i) => L + ((W - L - R) * i) / (values.length - 1);
  const y = (v) => T + ((H - T - B) * (max - v)) / (max - min);
  const pts = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const last = values.length - 1;
  const grid = [0, 0.5, 1].map((k) => `<line class="grid" x1="${L}" x2="${W - R}" y1="${(T + (H - T - B) * k).toFixed(1)}" y2="${(T + (H - T - B) * k).toFixed(1)}"/>`).join('');
  const dots = values.map((v, i) => `<circle class="dot${i === last ? ' dot--last' : ''}" cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="${i === last ? 4.5 : 3}"/>`).join('');
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${years[0]}년부터 ${years[last]}년까지 합계출산율 추이 그래프. 처음 ${values[0].toFixed(2)}${unit}, 마지막 ${values[last].toFixed(2)}${unit}">
  ${grid}<line class="axis" x1="${L}" x2="${W - R}" y1="${H - B}" y2="${H - B}"/>
  <polyline class="line" points="${pts}"/>${dots}
  <text x="${L}" y="${H - 8}">${years[0]}</text><text x="${W - R}" y="${H - 8}" text-anchor="end">${years[last]}</text>
  <text x="${(x(0) + 8).toFixed(1)}" y="${(y(values[0]) - 8).toFixed(1)}" text-anchor="start">${values[0].toFixed(2)}</text>
  <text x="${W - R + 6}" y="${(y(values[last]) + 4).toFixed(1)}" font-weight="700" style="fill:var(--c-text)">${values[last].toFixed(2)}</text>
</svg>`;
}

/**
 * 첫 화면 통계 캐러셀 — 실제 값. 지표 목록·순서·수(N)는 구현과 같은 접근자 src/data/koreaStatsAccess.ts#getCarouselIndicators(CAROUSEL_ORDER)에서 읽는다
 * (2026-10-15 기준 14개 — 문서·컴포넌트판도 이 값). 큰 숫자 표기는 formatIndicatorValue. 자동 넘김 간격은 SPEC SC5 7초.
 */
const CAROUSEL = getCarouselIndicators();
const CAROUSEL_TOTAL = CAROUSEL.length;
const CAROUSEL_SEC = 7;
function carousel() {
  const tfr = CAROUSEL.find((i) => i.id === 'tfr') ?? indicator('tfr');
  const total = CAROUSEL_TOTAL;
  const series = tfr.series.filter((p) => p.year >= 2014);
  const values = series.map((p) => p.value);
  const years = series.map((p) => p.year);
  const idx = CAROUSEL.findIndex((i) => i.id === 'tfr') + 1;
  const fv = formatIndicatorValue(tfr);
  return `<section class="card carousel" aria-roledescription="캐러셀" aria-label="한국 사회 통계">
  <div class="carousel__head"><h2 class="card__title">한국 사회 통계</h2><span class="t-xs t-faint">${CAROUSEL_SEC}초마다 다음 지표</span></div>
  <article class="slide" aria-live="off">
    <h3 class="t-h3">${esc(tfr.title)}</h3>
    <p class="slide__value">${esc(fv.value)}<small>${esc(fv.unit)} · ${fv.year}년</small></p>
    ${lineChart(values, years, tfr.unit)}
    <p class="t-sm t-muted">${esc(tfr.definition)}</p>
    <p class="slide__meta">출처: ${esc(tfr.source.org)}, ${esc(tfr.source.table)} (${tfr.source.accessedOn} 조회)</p>
  </article>
  <div class="carousel__ctrl">
    <button class="btn btn--secondary btn--icon" type="button" aria-label="이전 지표">${icon('prev')}</button>
    <span class="carousel__count num" aria-live="polite">${idx} / ${total}</span>
    <button class="btn btn--secondary btn--icon" type="button" aria-label="다음 지표">${icon('forward')}</button>
    <button class="btn btn--secondary btn--icon" type="button" aria-label="자동 넘김 일시정지">${icon('pause')}</button>
  </div>
</section>`;
}

// ---------- 1. 첫 화면 ----------
function titlePage(key, state = 'new') {
  const hero = `<header class="hero">
    ${logo(key, 'stacked')}${logo(key, 'row')}
    <p class="hero__tag">태어난 집에 따라 달라지는, <span class="nowrap">한국인의 한 번의 인생</span></p>
    ${spoonLineup()}
    <p class="hero__pop"><strong>${N_POP}명</strong>이 이 시뮬레이션 속에서 각자의 삶을 살고 있어요.</p>
    <p class="hero__note">이 기기 안에서 계산한 가상의 사람들이에요. 실제로 게임하는 사람 수가 아니에요.</p>
  </header>`;
  const world = `<fieldset><legend class="group-title">태어날 세상</legend>
    <div class="choices choices--1" role="radiogroup" aria-label="태어날 세상">
      ${radioCard({ name: 'era', title: '지난 세상', meta: '1950~1989년생', desc: '모두가 가난했고, 모두가 바빴던 시절' })}
      ${radioCard({ name: 'era', title: '지금 세상', meta: '올해(2026) 태어나는 아이', desc: '우리가 지금 살고 있는 시간', selected: true })}
      ${radioCard({ name: 'era', title: '다가올 세상', meta: '2030~2060년생', desc: '아직 오지 않은 시간. 격차는 더 벌어졌다고들 합니다' })}
    </div></fieldset>`;
  const length = `<fieldset><legend class="group-title">인생 길이</legend>
    <div class="choices choices--2" role="radiogroup" aria-label="인생 길이">
      ${radioCard({ name: 'len', title: '약 30분', desc: '가볍게 한 판', selected: true })}
      ${radioCard({ name: 'len', title: '약 1시간', desc: '결정을 더 많이' })}
    </div>
    <p class="t-sm t-muted" style="margin-top:var(--sp-2)">평균 수명까지 살아 보는 데 걸리는 시간이에요. 도중에 나가도 진행은 이 기기에 남습니다.</p></fieldset>`;
  const bar =
    state === 'continue'
      ? `<div class="bottom-bar"><button class="btn btn--primary btn--lg" type="button">이어서 살기</button><button class="btn btn--ghost btn--sm" type="button">새로 태어나기</button></div>`
      : `<div class="bottom-bar"><button class="btn btn--primary btn--lg" type="button">태어나기</button></div>`;
  const body = `<main class="title">
  <div class="title__main">${hero}${world}${length}</div>
  <aside class="title__side">${carousel()}</aside>
</main>
<footer class="title-foot"><p>${CREDIT}</p><p>통계 기준 연도·출처는 카드마다 적혀 있습니다. 시안 · 가상 인구 수는 가짜 값</p><p class="num">v0.2.0 (a1b2c3d)</p></footer>
<div class="page-end-space"></div>
${bar}`;
  return page({ title: `수저 게임 · 시안 · 첫 화면`, body });
}

// ---------- 2. 룰렛 ----------
/** 지금 세상 = 2026년 현행 16개 시·도(광주·전남은 전남광주통합특별시로 합산, 마스터 결정). 비율은 2025년 시도별 출생아 수(koreaStats.json birth-by-sido) */
const SIDO_16 = [
  ['서울', ['서울']], ['부산', ['부산']], ['대구', ['대구']], ['인천', ['인천']], ['대전', ['대전']], ['울산', ['울산']], ['세종', ['세종']], ['경기', ['경기']],
  ['강원', ['강원']], ['충북', ['충북']], ['충남', ['충남']], ['전북', ['전북']], ['전남광주', ['광주', '전남']], ['경북', ['경북']], ['경남', ['경남']], ['제주', ['제주']],
];
function oddsRegions() {
  const rows = indicator('birth-by-sido').rows;
  const births = SIDO_16.map(([name, parts]) => [name, parts.reduce((a, p) => a + rows.find((r) => r.sido === p).births, 0)]);
  const total = births.reduce((a, b) => a + b[1], 0);
  // 소수 첫째 자리까지, 합이 100.0이 되도록 가장 큰 나머지 방식
  const raw = births.map(([n, b]) => [n, (b / total) * 1000]);
  const floors = raw.map(([n, v]) => [n, Math.floor(v), v - Math.floor(v)]);
  let rest = 1000 - floors.reduce((a, r) => a + r[1], 0);
  for (const r of [...floors].sort((a, b) => b[2] - a[2])) if (rest-- > 0) r[1] += 1;
  return floors.map(([n, v]) => [n, v / 10]);
}

/**
 * state: 'spin' 회전 중 / 'stop' 결과 / 'reduced' 움직임 줄이기(= 결과 상태 그대로 + 안내 한 줄, 회전 화면을 거치지 않는다 — R-171).
 * 릴 순서는 확률표 순서로 하나다(수저: 흙→동→은→금→다이아 순환, 지역: 서울·부산·…·제주). 결과(흙수저·경기)가 창 가운데 오도록 같은 다섯 칸을 모든 상태에서 보인다.
 */
function roulettePage(state) {
  const spinning = state === 'spin';
  const reduced = state === 'reduced';
  const spoonRows = [4, 5, 1, 2, 3]; // 확률표 순서(1→5)의 순환에서 결과 1(흙)이 가운데
  const spoonItems = spoonRows.map((n, i) => `<li class="reel__item${!spinning && i === 2 ? ' is-result' : ''}">${reelSpoon(n)}</li>`).join('');
  const regionOrder = SIDO_16.map(([n]) => n);
  const at = regionOrder.indexOf(HERO.regionShort);
  const regionRows = [-2, -1, 0, 1, 2].map((k) => regionOrder[(at + k + regionOrder.length) % regionOrder.length]); // 울산·세종·[경기]·강원·충북
  const regionItems = regionRows.map((n, i) => `<li class="reel__item${!spinning && i === 2 ? ' is-result' : ''}">${esc(n)}</li>`).join('');
  const odds = [[1, 25], [2, 30], [3, 28], [4, 14], [5, 3]];
  const spoonOdds = `<table><caption class="sr-only">수저별 확률</caption><tbody>${odds.map(([n, p]) => `<tr><th scope="row">${GRADES[n].name}</th><td>${p}%</td></tr>`).join('')}</tbody></table>
    <p class="odds__note">게임의 설계값이에요(통계가 아님).</p>`;
  const src = indicator('birth-by-sido').source;
  const regionOdds = `<table><caption class="sr-only">지역별 확률</caption><tbody>${oddsRegions().map(([n, p]) => `<tr><th scope="row">${esc(n)}</th><td>${p.toFixed(1)}%</td></tr>`).join('')}</tbody></table>
    <p class="odds__note">2025년 시·도별 출생아 수 비율(${esc(src.org)}, 2025년 출생 통계). 광주·전남은 통합(2026)에 맞춰 합산. 이름은 줄여 적었어요.</p>`;
  // 결과 부제: 「{수저}({구간}) · {시·도 줄임}」 — 구간은 bandLabel 출력(R-170)
  const result = `<span class="nowrap">${esc(gradeText(HERO.grade, HERO.gradeRange))}</span> · <span class="nowrap">${esc(HERO.regionShort)}</span>`;
  const body = `<header class="site-head">${headerLogo()}<span class="site-head__name">출생</span></header>
<main class="roulette">
  <div class="roulette__lead">
    <h1 class="t-title">${spinning ? '태어날 집과 땅을 고르는 중' : '태어날 곳이 정해졌습니다'}</h1>
    <p class="t-muted" ${spinning ? '' : 'role="status"'}>${spinning ? '어느 집, 어느 땅에 태어날지는 고를 수 없어요. 확률대로 돌아갑니다.' : result}</p>
    ${reduced ? '<p class="motion-note t-sm t-muted">움직임 줄이기가 켜져 있어 돌림판을 돌리지 않고 결과만 보여 드려요.</p>' : ''}
  </div>
  <div class="reels">
    <div class="reel-col"><h2 class="reel-col__title">수저</h2>
      <div class="reel${spinning ? ' is-spinning' : ''}" aria-hidden="${spinning}"><div class="reel__window"></div><ul class="reel__list" style="padding-top:4px">${spoonItems}</ul></div>
      <div class="odds">${spoonOdds}</div></div>
    <div class="reel-col"><h2 class="reel-col__title">태어나는 지역</h2>
      <div class="reel${spinning ? ' is-spinning' : ''}" aria-hidden="${spinning}"><div class="reel__window"></div><ul class="reel__list" style="padding-top:4px">${regionItems}</ul></div>
      <div class="odds odds--cols">${regionOdds}</div></div>
  </div>
  ${spinning ? '' : '<p class="t-xs t-faint" style="text-align:center">돌림판은 연출이고, 결과는 돌기 전에 정해진 값이에요.</p>'}
</main>
<div class="page-end-space"></div>
<div class="bottom-bar">${spinning ? '<button class="btn btn--secondary btn--lg" type="button">건너뛰기</button>' : '<button class="btn btn--primary btn--lg" type="button">출생신고 보기</button>'}</div>`;
  return page({ title: `수저 게임 · 시안 · 룰렛 (${spinning ? '회전 중' : reduced ? '움직임 줄이기 — 결과만' : '결과'})`, body, motion: reduced ? 'reduce' : '' });
}

// ---------- 3. 출생신고 ----------
const birthSentence = () => `${HERO.birth}, ${HERO.region}의 형편이 빠듯한 가정에서 ${HERO.weight} 여자아이로 태어났습니다. ${HERO.order}입니다. <span class="nowrap">(${HERO.weight}은 ${HERO.weightRank})</span>`;

function birthPage() {
  const grid = `<dl class="doc__grid">
    <div><dt>성별</dt><dd>${HERO.gender}</dd></div>
    <div><dt>출생 연월</dt><dd>${HERO.birth}</dd></div>
    <div><dt>태어난 곳</dt><dd>${HERO.region}</dd></div>
    <div class="wide"><dt>집안 형편</dt><dd class="grade-line">${gradeChip(HERO.grade, { lg: true, range: HERO.gradeRange })}</dd></div>
    <div><dt>어머니</dt><dd>${HERO.motherAge}세 · ${HERO.motherJob}</dd></div>
    <div><dt>아버지</dt><dd>${HERO.fatherAge}세 · ${HERO.fatherJob}</dd></div>
    <div><dt>사는 집</dt><dd>${HERO.housing}</dd></div>
    <div><dt>출생 체중</dt><dd>${HERO.weight} <span class="t-sm t-muted" style="font-weight:400">(${HERO.weightRank})</span></dd></div>
    <div><dt>형제 순서</dt><dd>${HERO.order}</dd></div>
    <div><dt>외모</dt><dd>${HERO.looks} <span class="t-sm t-muted" style="font-weight:400">또래 사이에서</span></dd></div>
    <div class="wide"><dt>교육방식</dt><dd>${HERO.parenting} <span class="t-sm t-muted" style="font-weight:400">집에는 지켜야 할 규칙이 많았고, 부모님은 엄했습니다.</span></dd></div>
  </dl>`;
  const people = `<ul class="people">${PEERS.map(([n, s, g, grade]) => `<li><div><div class="name">${n}</div><div class="sub">${s} · ${g}</div></div>${gradeChip(grade)}</li>`).join('')}</ul>`;
  const compare = `<table class="table"><caption class="sr-only">올해 태어난 아이 평균과 이 아이의 비교</caption>
    <thead><tr><th scope="col">항목</th><th scope="col" class="num">올해 출생아 평균</th><th scope="col" class="num">이 아이</th></tr></thead>
    <tbody>
      <tr><th scope="row">기대수명<br><span class="t-xs t-faint">출처 자리</span></th><td class="num">84.0세</td><td class="num"><strong>81.2세</strong></td></tr>
      <tr><th scope="row">사교육 참여율<br><span class="t-xs t-faint">출처 자리</span></th><td class="num">78%</td><td class="num"><strong>61%</strong></td></tr>
      <tr><th scope="row">대학 진학률<br><span class="t-xs t-faint">출처 자리</span></th><td class="num">73%</td><td class="num"><strong>58%</strong></td></tr>
    </tbody></table>
    <p class="t-xs t-faint" style="margin-top:var(--sp-2)">출처가 확인된 행만 넣습니다. 이 표의 숫자는 시안용 가짜 값입니다.</p>`;
  const body = `<header class="site-head">${headerLogo()}<span class="site-head__name">출생</span></header>
<main class="doc-page">
  <article class="doc" aria-labelledby="doc-title">
    <div class="doc__band"><h1 id="doc-title">출생 신고</h1><span>수저 게임 · 가상의 서류</span></div>
    <div class="stamp" aria-hidden="true">접수</div>
    <div class="doc__body">
      <div><p class="label">이름</p><p class="doc__name">${HERO.name}</p></div>
      <p class="doc__sentence">${birthSentence()}</p>
      ${grid}
    </div>
  </article>
  <section class="card" aria-labelledby="peers-t"><div class="card__head"><h2 id="peers-t" class="card__title">같은 해 태어난 사람들</h2></div>${people}
    <p class="t-sm t-muted" style="margin-top:var(--sp-2)">네 사람도 같은 세상에서 나이를 먹습니다. 대시보드 오른쪽 칸에서 요즘 모습을 볼 수 있습니다.</p></section>
  <section class="card" aria-labelledby="cmp-t"><div class="card__head"><h2 id="cmp-t" class="card__title">다른 집 아이들과 견주면</h2></div>${compare}</section>
  ${MOCK_TAG}
</main>
<div class="page-end-space"></div>
<div class="bottom-bar"><button class="btn btn--primary btn--lg" type="button">살아가기</button></div>`;
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
  const rows = PEERS.map(([n, s, g], i) => `<li><div><div class="name">${n}</div><div class="sub">${s} · ${g}</div></div><span class="t-sm t-muted">${labels[i]}</span></li>`).join('');
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
    logRow(0, birthSentence()) +
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
      ${tl(0, `${HERO.birth}, ${HERO.region}의 형편이 빠듯한 가정에서 ${HERO.weight} 여자아이로 태어났습니다.`)}
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
  <section><h2>캐러셀 조작 줄(자동 넘김 ${CAROUSEL_SEC}초, 지표 ${CAROUSEL_TOTAL}개) · 점(5개 이하일 때만)</h2><div class="carousel__ctrl" style="max-width:320px"><button class="btn btn--secondary btn--icon" type="button" aria-label="이전 지표">${icon('prev')}</button><span class="carousel__count num">3 / ${CAROUSEL_TOTAL}</span><button class="btn btn--secondary btn--icon" type="button" aria-label="다음 지표">${icon('forward')}</button><button class="btn btn--secondary btn--icon" type="button" aria-label="자동 넘김 일시정지">${icon('pause')}</button></div>
    <div class="dots" style="max-width:320px;margin-top:var(--sp-3)">${Array.from({ length: 5 }, (_, i) => `<button type="button" aria-label="${i + 1}/5" ${i === 3 ? 'aria-current="true"' : ''}><i></i></button>`).join('')}</div></section>
  <section><h2>하단 고정 버튼 (본문을 가리지 않게 아래 여백을 둔다)</h2><div class="card" style="position:relative;height:150px;overflow:hidden"><p class="t-muted">본문…</p><div class="bottom-bar" style="position:absolute"><button class="btn btn--primary btn--lg" type="button">태어나기</button></div></div></section>
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
