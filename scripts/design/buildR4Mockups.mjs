/**
 * SPEC-005 r4(v0.2.1 작은 UX 묶음 A) 시안 HTML을 만든다 — designer 2026-10-26. 결정 카드 한 장면(질문 줄 UX10 · 「잠시 덮어 두기」 UX11 · 시트 하단 자동 고르기 버튼과 인라인 카드의 끄는 버튼 UX12 · 인용 박스 풀이 줄 UX14)과 한 줄 도구 줄(UX9).
 * 실행: node node_modules/vite-node/vite-node.mjs scripts/design/buildR4Mockups.mjs   → docs/design/mockups/r4/decision-r4.html · toolbar-r4.html   (buildMockups.mjs와 같이 TS 모듈을 읽으므로 vite-node)
 * 스크린샷·측정: node scripts/design/shootR4.mjs   → docs/design/screens/005/r4-*.png
 *
 * 하위 폴더 r4/에 두는 이유는 qi5·qi6와 같다(tests/designAssets.test.ts의 평면 glob — 기존 시안 decision-adult.html의 단언(이전 이름 등)을 건드리지 않는다). CSS는 docs/design/mockups/ds.css(「r4 …」 두 블록)만 쓴다.
 * 카드 글자는 **실제 이벤트 JSON**(제목·상황·선택지 라벨)과 **실제 인용**(citationFor — 구현 순수 함수)에서, 기존 문구는 **구현 상수**(DASH_TEXT·VEIL_TEXT·HEAVY_KIND_TEXT)에서 읽는다(R-191 — 손글 사본 0).
 * r4에서 새로 정한 문구(copy.md 15절)도 이제 **구현 상수**(DASH_TEXT.choiceAsk·foldCard·autoOnBtn·autoOnSub·autoOffBtn·autoOffSub·citeInsightLabel)에서 읽는다 — 구현 반영(2026-10-26 developer, diff-005.md D5-82·D5-90) 전의 임시 블록 r4 임시 문구는 지웠다(M8·M7c 선행 시안과 같은 절차, tests/designAssets.test.ts가 「임시 블록 0」을 단언한다).
 * 풀이는 **실제 데이터**(src/data/citationInsights.ts#insightFor — copy.md 15-5 확정 32문장)에서 읽는다. 영향 줄 칸 수는 시안 예시(구현 previewChoice가 정본).
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { citationFor } from '../../src/core/citations.ts';
import { glueSegments } from '../../src/core/glue.ts';
import { insightFor } from '../../src/data/citationInsights.ts';
import { DASH_TEXT, titleCharsFor } from '../../src/data/dashText.ts';
import { HEAVY_KIND_TEXT, VEIL_TEXT } from '../../src/data/gentleText.ts';
import { StatusCard } from '../../src/ui/dash/Cards.tsx';
import { ImpactHint, ImpactLine } from '../../src/ui/dash/Impact.tsx';
import { AGE_GROUPS } from '../../src/assets/faces/faceLayers.ts';
import { ROOT, MOCK_TAG, esc, face, fitPair, gradeChip, headerLogo, icon, page } from './mockLib.mjs';

// ---------- r4 새 문구 (copy.md 15절 확정 — 구현 상수 DASH_TEXT·insightFor를 읽는다: 임시 블록 r4 임시 문구는 구현 반영 뒤 지웠다, D5-90·R-191) ----------
// ---------- 데이터 ----------
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
/** 시안 주인공(buildMockups.mjs HERO와 같은 사람 — 이서연, 2026년생, 지금 세상, 흙수저) */
const HERO = { name: '이서연', birthYear: 2026, grade: 1, gradeRange: '하위 25% 안쪽' };
const html = (component, props) => renderToStaticMarkup(createElement(component, props));
const renderGlue = (segments) => segments.map((s) => (s.kind === 'plain' ? esc(s.text) : s.kind === 'nowrap' ? `<span class="nowrap">${esc(s.text)}</span>` : `<span class="keep-phrase">${renderGlue(s.parts)}</span>`)).join('');
const glueHtml = (text) => renderGlue(glueSegments(text));
const impactItems = (spec) =>
  spec.split(',').filter(Boolean).map((part) => {
    const [key, direction, steps] = part.split(':');
    return { key, direction, steps: Number(steps), sr: `${key}.${direction}.${steps}` };
  });
const choiceBtn = (n, label, spec) => `<button class="choice" type="button" data-testid="choice-${n}"><span class="choice__no" aria-hidden="true">${n}</span><span class="choice__body"><span class="choice__label">${esc(label)}</span>${html(ImpactLine, { items: impactItems(spec) })}</span></button>`;

// ---------- 카드 ----------
/** 인용 박스(구현 CitationBox와 같은 DOM) + r4 풀이 묶음(본인이 고르는 카드에만 — M23) */
function citeBox(view, { insight = null } = {}) {
  if (view.text.length > 100) throw new Error(`${view.id}: 표시 문자열 ${view.text.length}자 > 100`);
  const ins = insight ? `<div class="cite__insight" data-testid="cite-insight"><p class="cite__insight-label">${esc(DASH_TEXT.citeInsightLabel)}</p><p class="cite__insight-text">${glueHtml(insight)}</p></div>` : '';
  return `<div class="cite" data-testid="cite" data-citation="${view.id}"><p class="cite__kind">${esc(DASH_TEXT.citeKindLabel[view.kind])}</p><p class="cite__text" data-testid="cite-text">${glueHtml(view.text)}</p><p class="cite__src" data-testid="cite-src"><span class="keep-phrase">${esc(view.sourceWho)}</span> ${glueHtml(view.sourceTitle)}</p>${ins}</div>`;
}
const head = ({ year, age }) =>
  `<div class="decision__head"><span class="decision__kind">${esc(DASH_TEXT.choiceKind)}</span><div class="row"><span class="decision__when" data-testid="decision-when">${fitPair(`${year}${DASH_TEXT.yearSuffix}`, `${age}${DASH_TEXT.ageSuffix}`, { hideSeparator: true })}</span><button class="btn btn--ghost btn--sm decision__fold" type="button" data-testid="decision-fold-btn">${esc(DASH_TEXT.foldCard)} <span aria-hidden="true">${esc(DASH_TEXT.foldMark)}</span></button></div></div>`;
/** 카드 맨 끝: 자동 모드 안내(M-13 그대로) + r4 버튼 + 보조 한 줄. 가린 카드에는 안내 문장만(M22) */
function autoSet(auto, { veiled = false } = {}) {
  const note = `<p class="decision__auto" data-testid="auto-note">${esc(auto ? DASH_TEXT.autoNoteOn : DASH_TEXT.autoNoteOff)}</p>`;
  if (veiled) return note;
  const btn = auto ? DASH_TEXT.autoOffBtn : DASH_TEXT.autoOnBtn;
  const sub = auto ? DASH_TEXT.autoOffSub : DASH_TEXT.autoOnSub;
  return `<div class="decision__autoset" data-testid="auto-set">${note}<button class="btn btn--ghost btn--sm decision__autobtn" type="button" data-testid="${auto ? 'auto-off-btn' : 'auto-on-btn'}" aria-describedby="dc-autosub">${esc(btn)}</button><p class="decision__autosub" id="dc-autosub">${glueHtml(sub)}</p></div>`;
}
/** 본인이 고르는 카드 안쪽(두 틀 공통): 머리 → 제목 → 상황 → 인용(+풀이) → [질문 → 선택지] → 영향 안내 → 자동 묶음 */
function decisionInner({ ev, year, age, choices, auto }) {
  const cite = citationFor(ev, 'present', year);
  const buttons = choices.map(([cid, spec], i) => {
    const c = ev.choices.find((x) => x.id === cid);
    if (!c) throw new Error(`${ev.id}: 선택지 ${cid}가 없다`);
    return choiceBtn(i + 1, c.label, spec);
  });
  return `${head({ year, age })}
    <div class="decision__body">
      <h2 id="dc-title" class="decision__title" tabindex="-1" style="--title-chars:${titleCharsFor(ev.title)}" data-testid="choice-title">${esc(ev.title)}</h2>
      <p class="decision__text" data-testid="choice-text">${esc(ev.text)}</p>
      ${cite ? citeBox(cite, { insight: insightFor(cite.id) }) : ''}
      <div class="choices-list" role="group" aria-labelledby="dc-ask">
        <p class="decision__ask" id="dc-ask" data-testid="choice-ask">${esc(DASH_TEXT.choiceAsk)}</p>
        ${buttons.join('\n        ')}
      </div>
      ${html(ImpactHint, { name: HERO.name })}
      ${autoSet(auto)}
    </div>`;
}
/** 가린 카드 안쪽(QI6 HV4 ② 그대로 — 질문·풀이·자동 묶음 없음, 자동 안내 문장만) */
function veiledInner({ ev, year, age, auto }) {
  const kindName = HEAVY_KIND_TEXT[ev.heavy.kind];
  return `${head({ year, age })}
    <div class="decision__body">
      <h2 id="dc-title" class="decision__title" tabindex="-1" style="--title-chars:${titleCharsFor(VEIL_TEXT.cardLead, kindName)}" data-testid="choice-title">${fitPair(VEIL_TEXT.cardLead, kindName, { hideSeparator: true })}</h2>
      <p class="decision__text veil__note" data-testid="veil-note">${esc(VEIL_TEXT.decisionNote)}</p>
      <div class="veil__actions"><button class="btn btn--primary" type="button" data-testid="veil-open">${esc(VEIL_TEXT.readCard)}</button><button class="btn btn--secondary" type="button" data-testid="veil-auto">${esc(VEIL_TEXT.autoPick)}</button></div>
      ${autoSet(auto, { veiled: true })}
    </div>`;
}
const sheet = (inner, { veiled = false } = {}) => `<div class="overlay" data-testid="decision-overlay"><div class="sheet decision decision--sheet" role="dialog" aria-modal="true" aria-labelledby="dc-title" data-testid="choice-panel" data-mode="sheet"${veiled ? ' data-veiled="true"' : ''}>${inner}</div></div>`;
const inline = (inner) => `<section class="card decision decision--inline" aria-labelledby="dc-title" data-testid="choice-panel" data-mode="inline">${inner}</section>`;
const foldBand = (ev) =>
  `<section class="card fold" aria-labelledby="dc-fold-title" data-testid="decision-fold"><span class="fold__kind">${esc(DASH_TEXT.choiceKind)}</span><span class="fold__title" id="dc-fold-title">${esc(ev.title)}</span><span class="fold__note">${esc(DASH_TEXT.foldNote)}</span><button class="btn btn--secondary btn--sm fold__open" type="button" id="dc-fold-open" aria-labelledby="dc-fold-open dc-fold-title" data-testid="decision-reopen">${esc(DASH_TEXT.reopenDecision)}</button></section>`;

// ---------- 대시보드 뼈대(buildMockups.mjs dashHead·dashboardBody의 축약 — 머리·도구 줄·세 열) ----------
const toolBtn = (key, ic, label, { pressed = null, dialog = false } = {}) =>
  `<button class="btn btn--tool" type="button" data-tool="${key}" data-testid="tool-${key}"${dialog ? ' aria-haspopup="dialog"' : ''}${pressed === null ? '' : ` aria-pressed="${pressed ? 'true' : 'false'}"`}>${icon(ic)}<span>${esc(label)}</span>${pressed === null ? '' : `<span class="sr-only">${pressed ? esc(DASH_TEXT.toolOn) : ''}</span>`}</button>`;
function dashHead({ age, year, progress, pending, auto, inert, bgm = false, exit = false }) {
  const T = DASH_TEXT;
  const i = inert ? ' inert' : '';
  const volume = bgm ? `<label class="volume" data-testid="bgm-volume"><span>${esc(T.bgmVolume)}</span><input type="range" min="0" max="100" step="5" value="30" aria-valuetext="30%" data-testid="bgm-volume-input"><output>30%</output></label>` : '';
  const exitAsk = exit
    ? `<div class="exit-ask" role="group" aria-labelledby="exit-ask-t" data-testid="exit-ask"><p class="exit-ask__title" id="exit-ask-t" role="alert">${esc(T.exitAsk)}</p><p class="t-sm t-muted">${glueHtml(T.exitAskSub)}</p><div class="exit-ask__actions"><button class="btn btn--secondary" type="button">${esc(T.exitYes)}</button><button class="btn btn--primary" type="button">${esc(T.exitNo)}</button></div></div>`
    : '';
  return `<header class="dash-head"${i}><div class="dash-head__inner">
    <div class="dash-head__top">${headerLogo()}
      <div class="who"><h1 class="who__name" tabindex="-1" data-testid="life-name">${HERO.name}</h1><span class="who__age" data-testid="life-age"><b>${age}</b>${T.ageSuffix}</span></div></div>
    <div class="year-row"><span class="num">${year}${T.yearSuffix}</span>
      <div class="year-progress" role="progressbar" aria-label="${T.yearProgressLabel}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progress}"><div class="year-progress__fill" style="width:${progress}%"></div></div>
      <span class="year-row__pct num">${progress}%</span></div>
  </div></header>
  <div class="toolbar"${i}><div class="toolbar__inner">
    <div class="controls-fixed" role="group" aria-label="${T.controlsGroup}" data-testid="controls">
      <div class="controls__speed">
        <button class="btn btn--sm" type="button" data-testid="pause">${icon('pause', 'icon--sm')}<span>${T.pause}</span></button>
        <button class="btn btn--sm" type="button" aria-pressed="true" data-speed="1">1${T.speedUnit}</button><button class="btn btn--sm" type="button" data-speed="2">2${T.speedUnit}</button><button class="btn btn--sm" type="button" data-speed="4">4${T.speedUnit}</button><button class="btn btn--sm" type="button" data-speed="8">8${T.speedUnit}</button>
      </div>
      <div class="controls__more">
        <button class="btn btn--sm btn--secondary" type="button" data-testid="skip"${pending || auto ? ' aria-disabled="true" data-unavailable="true"' : ''}>${icon('next', 'icon--sm')}<span>${T.skip}</span></button>
        <button class="btn btn--sm btn--secondary" type="button" data-testid="auto" aria-pressed="${auto ? 'true' : 'false'}">${icon('auto', 'icon--sm')}<span>${auto ? T.autoOn : T.autoOff}</span></button>
      </div>
    </div>
    <div class="controls__tools" role="group" aria-label="${T.toolsGroup}" data-testid="tools">
      ${toolBtn('bgm', 'music', T.toolBgm, { pressed: bgm })}${toolBtn('note', 'pencil', T.toolNote, { dialog: true })}${toolBtn('dark', 'moon', T.toolDark, { pressed: false })}<a class="btn btn--tool" href="#" data-testid="tool-feedback" data-tool="feedback">${icon('message')}<span>${esc(T.toolFeedback)}</span><span class="sr-only">${esc(T.feedbackNewTab)}</span></a>${toolBtn('exit', 'exit', T.toolExit)}
    </div>
    ${volume}${exitAsk}
  </div></div>`;
}
const logRow = (age, text, extra = '', cls = '') => `<li class="log__row ${cls}"><span class="log__age">${age}세</span><span class="log__text">${esc(text)}${extra ? ` <em>${esc(extra)}</em>` : ''}</span></li>`;
/* 기록 줄은 기존 시안(decision-adult·veil.html)의 문장을 그대로 쓴 채움글 — ≥ 960px의 기록 영역 최소 높이(420px)를 채울 만큼 둔다(비어 보이지 않게) */
const ROWS = {
  31: logRow(31, '일하던 곳과 계약이 한 해 더 이어졌습니다.', '', 'log__row--latest') + logRow(30, '보증금을 올려 달라는 연락을 받아 월세 집으로 옮겼습니다.') + logRow(29, '가까워진 사람과 만남을 시작했습니다.', '(선택: 연애를 시작한다)') + logRow(27, '계약직으로 첫 직장에 들어갔습니다.') + logRow(24, '학자금 대출을 갚기 시작했습니다.', '(선택: 대출을 유지한다)') + logRow(22, '대학을 졸업했습니다.') + logRow(20, '스무 살이 되었습니다. 이제부터는 집안 형편이 아니라 내가 가진 것으로 살아갑니다.', '', 'log__row--stage') + logRow(19, '수능을 치렀습니다.') + logRow(17, '아르바이트로 처음 돈을 벌었습니다.', '(선택: 주말에 일한다)') + logRow(13, '중학교에 들어갔습니다.', '', 'log__row--stage'),
  55: logRow(54, '검진 결과를 보고 걷는 날을 늘렸습니다.', '', 'log__row--latest') + logRow(52, '동창 모임에 오랜만에 나갔습니다.') + logRow(50, '집에서 일하는 날이 늘었습니다.', '(선택: 경계를 흐리게 둔다)') + logRow(47, '아이가 대학에 들어갔습니다.') + logRow(45, '부모님 집의 보일러를 바꿔 드렸습니다.') + logRow(43, '승진 제안을 받았습니다.', '(선택: 받아들인다)') + logRow(40, '어느덧 마흔이 되었습니다.', '', 'log__row--stage') + logRow(38, '둘째 생각을 접었습니다.', '(선택: 둘이서 살기로 한다)') + logRow(36, '작은 집을 마련했습니다.', '(선택: 빚을 내서라도 집을 마련한다)'),
};
const logCard = (age) => `<section class="card log" aria-label="${esc(DASH_TEXT.logTitle)}"><div class="card__head card__head--tight"><h2 class="card__title">${esc(DASH_TEXT.logTitle)}</h2><span class="t-xs t-faint">${glueHtml(DASH_TEXT.logHint)}</span></div>
  <div class="log__list" role="region" aria-label="${esc(DASH_TEXT.logTitle)}" tabindex="0"><ol class="log__rows" aria-live="polite" aria-relevant="additions">${ROWS[age]}</ol></div></section>`;
const profileCard = (age) => `<section class="card profile" aria-label="${esc(DASH_TEXT.profileLabel)}">
  <div class="profile__top">${face(age < 40 ? 'young' : 'middle', 'female', 3, `${HERO.name}의 얼굴 (${AGE_GROUPS.find((g) => g.id === (age < 40 ? 'young' : 'middle')).label} 여성)`, 'face--lg')}
    <div><p class="profile__name">${HERO.name}</p><p class="t-sm t-muted">여성</p></div></div>
  <dl class="facts">
    <dt>${esc(DASH_TEXT.profileBorn)}</dt><dd>2026년 1월</dd>
    <dt>${esc(DASH_TEXT.profileLive)}</dt><dd>경기도 화성시 병점구</dd>
    <dt>${esc(DASH_TEXT.profileHome)}</dt><dd><span class="grade-line">${gradeChip(HERO.grade, { range: HERO.gradeRange })}</span></dd>
    <dt>${esc(DASH_TEXT.profileEdu)}</dt><dd>대학교 졸업</dd>
    <dt>${esc(DASH_TEXT.profileLooks)}</dt><dd>상위 약 46% <small>또래 사이에서</small></dd>
  </dl></section>`;
const statusCard = (v) => html(StatusCard, { stats: { health: v[0], happiness: v[1], education: v[2], relationships: v[3] }, era: 'present' });
const familyCard = (age) => `<section class="card family" aria-label="${esc(DASH_TEXT.familyTitle)}"><h2 class="card__title card__title--gap">${esc(DASH_TEXT.familyTitle)}</h2>
  <dl class="family-list">
    <dt>${esc(DASH_TEXT.familyMother)}</dt><dd>${29 + age}세<small>${fitPair('판매직', '건강함')}</small></dd>
    <dt>${esc(DASH_TEXT.familyFather)}</dt><dd>${32 + age}세<small>${fitPair('기계 조작직', '건강함')}</small></dd>
    <dt>${esc(DASH_TEXT.familySiblings)}</dt><dd>남동생 ${age - 3}세 <small>3세 아래</small></dd>
    <dt>${esc(DASH_TEXT.familySpouse)}</dt><dd>${age >= 40 ? '있음' : esc(DASH_TEXT.familyNone)}</dd><dt>${esc(DASH_TEXT.familyChild)}</dt><dd>${age >= 40 ? '1명' : esc(DASH_TEXT.familyNone)}</dd>
  </dl></section>`;
/** 한 상태의 본문 전체. overlay = 모달 시트(바깥 inert), center = 가운데 열 맨 위(인라인 카드·접힌 띠) */
function body({ age, auto = false, overlay = '', center = '', bgm = false, exit = false, tag = '' }) {
  const modal = overlay !== '';
  const i = modal ? ' inert' : '';
  const year = HERO.birthYear + age;
  return `${dashHead({ age, year, progress: age === 31 ? 38 : 61, pending: true, auto, inert: modal, bgm, exit })}
<main class="dash"${i}>
  <div class="col col--left">${profileCard(age)}${statusCard(age === 31 ? [74, 58, 66, 62] : [46, 51, 58, 62])}</div>
  <div class="col col--center">${center}${logCard(age)}</div>
  <div class="col col--right">${familyCard(age)}<p class="mock-tag">${esc(tag || '시안 · 가짜 데이터')}</p></div>
</main>
<div class="page-end-space"${i}></div>
${overlay}`;
}
function statesPage(title, states) {
  const entries = Object.entries(states);
  const [, main] = entries[0];
  const templates = entries.slice(1).map(([name, bodyHtml]) => `<template id="state-${name}">${bodyHtml}</template>`).join('\n');
  const bodyHtml = `<div id="mock-root">${main}</div>
${templates}
<script>(function(){var s=new URLSearchParams(location.search).get('state');if(!s)return;var t=document.getElementById('state-'+s);if(!t)return;var root=document.getElementById('mock-root');root.replaceChildren(t.content.cloneNode(true));document.title+=' ('+s+')';})();</script>`;
  // 하위 폴더라 토큰·ds.css 경로를 한 단계 더 올린다(qi6/veil.html과 같다)
  return page({ title, body: bodyHtml, bodyClass: 'is-dash' }).replace('href="../../../src/styles/tokens.css"', 'href="../../../../src/styles/tokens.css"').replace('href="ds.css"', 'href="../ds.css"');
}

// ---------- 상태 ----------
const housing = { ev: eventOf('youth-housing'), age: 31, year: 2057, choices: [['rent', 'assets:down:1,happiness:up:1'], ['parents', 'assets:up:1,relationships:up:1,happiness:down:1'], ['loan', 'assets:down:2,debt:up:3,happiness:up:3']] };
const layoff = { ev: eventOf('middle-layoff'), age: 55, year: 2081, choices: [['hold', 'assets:up:1,health:down:2,happiness:down:2,relationships:up:1'], ['leave', 'assets:up:2,happiness:down:1'], ['open', 'assets:down:3,health:down:2,happiness:up:1']] };
if (!layoff.ev.heavy) throw new Error('middle-layoff 에 heavy 표지가 없다(가린 카드 표본)');
const decisionPage = statesPage('수저 게임 · 시안 · 중대 결정 카드 r4 (질문 줄 · 잠시 덮어 두기 · 자동 고르기 버튼 · 풀이 줄)', {
  sheet: body({ age: 31, overlay: sheet(decisionInner({ ...housing, auto: false })), tag: '시안 · 가짜 데이터 — r4: 질문 줄 · 「잠시 덮어 두기」 · 풀이(예시) · 시트 하단 자동 고르기 버튼' }),
  inline: body({ age: 31, auto: true, center: inline(decisionInner({ ...housing, auto: true })), tag: '시안 · 가짜 데이터 — r4: 자동 모드 켜짐(인라인 카드) · 하단 「이후 결정을 직접 고르기」' }),
  fold: body({ age: 31, center: foldBand(housing.ev), tag: '시안 · 가짜 데이터 — r4: 「잠시 덮어 두기」 뒤의 접힌 띠(글자 그대로) + 한 줄 도구 줄' }),
  veiled: body({ age: 55, overlay: sheet(veiledInner({ ...layoff, auto: false }), { veiled: true }), tag: '시안 · 가짜 데이터 — 설정 「무거운 장면 가리기」 켜짐: 가린 카드에는 질문·풀이·자동 고르기 버튼이 없다(M22)' }),
  opened: body({ age: 55, overlay: sheet(decisionInner({ ...layoff, auto: false })), tag: '시안 · 가짜 데이터 — 같은 카드를 「펼쳐서 읽기」로 연 뒤: 질문 줄 · 풀이(예시) · 자동 고르기 버튼이 보인다' }),
});
const toolbarPage = statesPage('수저 게임 · 시안 · 도구 줄 한 줄 r4 (≥ 960px)', {
  default: body({ age: 31, center: foldBand(housing.ev), tag: '시안 · 가짜 데이터 — r4 QI9: 폭 ≥ 960px에서 12개 버튼 한 줄(내용 폭이 문턱 이상일 때)' }),
  bgm: body({ age: 31, center: foldBand(housing.ev), bgm: true, tag: '시안 · 가짜 데이터 — BGM 켜짐: 볼륨 줄은 12개 버튼 아래 별도 줄' }),
  exit: body({ age: 31, center: foldBand(housing.ev), exit: true, tag: '시안 · 가짜 데이터 — 나가기 확인 상자: 12개 버튼 아래 별도 줄' }),
  auto: body({ age: 31, auto: true, center: foldBand(housing.ev), tag: '시안 · 가짜 데이터 — 자동 모드 켜짐(「자동 모드 켜짐」 반전색)' }),
});
const OUT = ROOT + 'docs/design/mockups/r4/';
mkdirSync(OUT, { recursive: true });
writeFileSync(OUT + 'decision-r4.html', decisionPage);
writeFileSync(OUT + 'toolbar-r4.html', toolbarPage);
console.log('wrote', OUT + 'decision-r4.html', OUT + 'toolbar-r4.html');
console.log('풀이 글자 수(시안에 쓴 인용):', Object.fromEntries(['c-015', 'c-083'].map((id) => [id, [...(insightFor(id) ?? '')].length])));
