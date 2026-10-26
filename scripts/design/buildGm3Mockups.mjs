/**
 * SPEC-004 GM3 시안 생성기 (designer 2026-10-27, 게이트 ③ — 형진 님 확인용). 정적 HTML 4장을 docs/design/mockups/gm3/에 만든다.
 * 실행: node node_modules/vite-node/vite-node.mjs scripts/design/buildGm3Mockups.mjs   (mockLib가 faceLayers.ts를 읽어 vite-node가 필요하다)
 *   title-004.html     첫 화면 세대 선택 — title-005.html(SPEC-005 r3 일러스트 시안)을 읽어 큰 슬롯·부제·시도 선택·내 출신 시도 설정만 바꾼다(한 장면). ?gen=<id>|random · region=pick · pick=<시도> · origin=set · open=origin · lived=a,b · fold=open · state=new|saved · theme=dark
 *   roulette-004.html  세대 뽑기 단계 → 3릴(연도 → 지역 → 수저). ?state=draw|spinning|result · region=picked · theme=dark · motion=reduce
 *   dashboard-004.html 인생 기록의 연표 줄 4종 + 자산 카드 당시 화폐. ?state=then|now|projection|none
 *   ending-004.html    세대 표기·전망 구간·최종 순자산 전환·비교 카드. ?state=future|2010
 * 글자는 copy.md 16절의 확정 문구(GM3_TEXT) — 구현이 상수를 만들면 import로 되돌린다. 연표 문장은 설계 문서의 예시 뜻만 썼다(사실 수치 0, 실명 0). 금액은 economy-model.md 16-8 ② 예시 배율(2000년 0.5416 · 2010년 0.7407)로 계산한 값.
 * 외부 요청 0, 가짜 데이터(시안 표식).
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { ROOT, esc, face, fitPair, gradeChip, headerLogo, icon, meter, page, reelSpoon } from './mockLib.mjs';

const OUT = `${ROOT}docs/design/mockups/gm3/`;
mkdirSync(OUT, { recursive: true });

// ---------- 확정 문구 (copy.md 16절과 같은 글자) ----------
const GM3_TEXT = {
  tagLead: '다른 세대, 다른 삶, ',
  tagKeep: '같은 대한민국',
  question: '어느 세대로 살아보고 싶으세요?',
  lead: '다른 세대의 시간을 살아 보며 서로의 사정을 이해해 봐요.',
  randomTitle: '랜덤 세대',
  randomDesc: '일곱 세대 가운데 하나를 같은 확률로 뽑아요',
  lived: '살아봄',
  foldSummary: '세대 범위는 자료마다 조금씩 달라요',
  foldBody: '이 게임은 위 범위를 써요. 1960~1963년생은 베이비붐 세대와 86세대 어느 쪽으로도 살아볼 수 있어요. 출생 연도는 고른 세대의 범위 안에서 룰렛이 뽑아요.',
  regionTitle: '태어나는 시도',
  regionRoulette: '룰렛에 맡기기',
  regionPick: '직접 고르기',
  regionHint: '룰렛은 그해 시·도별 출생아 비율대로 돌아요.',
  regionPickHint: '지금의 시·도 이름으로 골라요. 출생신고에는 그 해의 행정구역 이름이 적혀요.',
  regionNone: (names) => `이 세대가 태어난 해에는 ${names}가 없었어요.`,
  originChip: (s) => `내 출신 시도 · ${s}`,
  originTitle: '내가 실제로 태어난 시도',
  originNone: '밝히지 않음',
  originClear: '지우기',
  originDesc: '이 기기에만 남고 밖으로 나가지 않아요. 인생이 끝난 뒤 「같은 사건, 다른 자리」를 견주는 데만 써요.',
  drawTitle: '어느 세대로 살아볼지 뽑는 중',
  drawNote: '일곱 세대 가운데 하나를 같은 확률로 뽑아요.',
  drawOdds: '일곱 세대가 같은 확률이에요(인구 비례가 아님).',
  spinTitle: '태어날 해와 집과 땅을 고르는 중',
  spinNote: '어느 해, 어느 집, 어느 땅에 태어날지는 고를 수 없어요. 확률대로 돌아가요.',
  spinNotePicked: '태어나는 시도는 직접 골랐어요. 어느 해, 어느 집에 태어날지는 확률대로 돌아가요.',
  doneTitle: '태어날 때와 곳이 정해졌습니다',
  genAmong: (from, to) => `${from}~${to}년생 가운데`,
  yearTitle: '태어나는 해',
  regionReelTitle: '태어나는 지역',
  wealthTitle: '수저',
  yearOddsNote: '그해 출생아 수에 비례해요(국가데이터처 출생 통계).',
  yearOddsUniform: '균등 — 그해 자료가 없어요.',
  pickedRegion: '직접 고른 시도',
  afterNote: '돌림판은 연출이고, 결과는 돌기 전에 정해진 값이에요.',
  skip: '건너뛰기',
  seeReport: '출생신고 보기',
  tl: { year: '그해', bg: '배경', local: '지역 소식', proj: '전망' },
  projIntro: '여기서부터는 실제가 아니라 공식 전망을 바탕으로 한 이야기입니다.',
  scenario: (s) => `${s} 시나리오`,
  tagThen: '당시 화폐',
  tagNow: '2026년 가치',
  toNow: '지금 가치로 보기',
  toThen: '당시 화폐로 보기',
  basisThen: (y) => `${y}년의 물가로 환산한 금액입니다.`,
  basisNow: '2026년 가치로 환산한 금액입니다.',
  basisNone: '그해의 물가 자료가 없어 2026년 가치로 보입니다.',
  viewingThen: '(지금은 당시 화폐로 보는 중)',
  viewingNow: '(지금은 2026년 가치로 보는 중)',
  helpMoney: '자산은 2025년까지는 그해의 화폐로, 2026년부터는 2026년 가치로 보입니다. 「지금 가치로 보기」를 누르면 2026년 가치로 바꿔 볼 수 있습니다.',
  endingGen: (gen, year) => `${gen} · ${year}년생`,
  endingBorn: (place) => `${place}에서 태어남`,
  endingProj: (s) => `2026년부터는 공식 전망(${s} 시나리오)을 바탕으로 한 이야기입니다.`,
  projSplit: '2026년부터는 공식 전망',
  compareTitle: '같은 사건, 다른 자리',
  compareClose: '같은 일도 어디에서 지내는지에 따라 다르게 전해졌습니다.',
  compareSame: '당신의 출신 시도와 같은 곳에서 태어났습니다.',
};

// ---------- 세대 7종 (generations.md 2절·5절 — 이름·범위는 형진 님 표, 소개는 사건 셋 병렬) ----------
const NOW = 2026;
const GENS = [
  { id: 'industrial', name: '산업화 세대 · 전후 세대', short: '산업화·전후 세대', from: 1940, to: 1954, intro: '한국전쟁, 전후 복구, 산업화의 시기를 지나온 세대' },
  { id: 'boomer', name: '베이비붐 세대', from: 1955, to: 1963, intro: '과밀 학급, 고교 평준화, 산업화의 시기를 지나온 세대' },
  { id: 'g86', name: '86세대', from: 1960, to: 1969, intro: '직선제 개헌, 3저 호황, 신도시의 시기를 지나온 세대' },
  { id: 'genx', name: 'X세대', from: 1970, to: 1980, intro: '노래방, PC통신, 외환위기의 시기를 지나온 세대' },
  { id: 'millennial', name: '밀레니얼 세대', from: 1981, to: 1996, intro: '개인 홈페이지, 스마트폰, 글로벌 금융위기의 시기를 지나온 세대' },
  { id: 'genz', name: 'Z세대', from: 1997, to: 2012, intro: '스마트폰, 숏폼 영상, 코로나19의 시기를 지나온 세대' },
  { id: 'alpha', name: '알파 세대', from: 2013, to: 2020, intro: '대화형 인공지능, 학령인구 감소, 고교학점제의 시기에 자라는 세대', note: '2026년부터는 공식 전망을 바탕으로 한 이야기예요' },
];
const SIDO_NOW = ['서울', '부산', '대구', '인천', '대전', '울산', '세종', '경기', '강원', '충북', '충남', '전북', '전남광주', '경북', '경남', '제주'];
const SIDO_1972 = ['서울', '부산', '경기', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주'];
const FORMAL = { 세종: '세종특별자치시', 울산: '울산광역시' };

const GM3_SPRITE = `<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><defs>
<symbol id="i-year" viewBox="0 0 24 24"><rect x="4" y="6" width="16" height="14" rx="2"/><path d="M4 10.5h16M8.5 4v4M15.5 4v4"/><circle cx="12" cy="15.5" r="1.7" fill="currentColor" stroke="none"/></symbol>
<symbol id="i-paper" viewBox="0 0 24 24"><path d="M5 4.5h14v15H5z"/><path d="M8.5 8.5h7M8.5 12h7M8.5 15.5h4"/></symbol>
<symbol id="i-talk" viewBox="0 0 24 24"><path d="M3.5 5h11v8H8.5l-3 2.5V13h-2z"/><path d="M15.5 9.5H20v7h-1.8v2.5L15.4 16.5H13v-2"/></symbol>
<symbol id="i-proj" viewBox="0 0 24 24"><path d="M3 17l5-6 4 3 4-5"/><path d="M16 9h3.5v3.5" stroke-dasharray="2.5 1.8"/><path d="M3 20h18" stroke-dasharray="2 2"/></symbol>
<symbol id="i-shuffle" viewBox="0 0 24 24"><path d="M4 7h3.5l7 10H20"/><path d="M4 17h3.5l2-2.9M13.5 9.9l1-1.4H20"/><path d="M17.5 4.5 20 7l-2.5 2.5M17.5 14.5 20 17l-2.5 2.5"/></symbol>
</defs></svg>`;
const TL_ICON = { year: 'year', bg: 'paper', local: 'talk', proj: 'proj' };
const projChip = () => `<span class="chip chip--proj">${icon('proj')}전망</span>`;

function must(html, from, to, label) {
  if (!html.includes(from)) throw new Error(`title-005.html에서 못 찾음: ${label}`);
  return html.replace(from, to);
}

// ============================================================ ① 첫 화면 ============================================================
function genCard(g, selected) {
  const ages = `올해 ${NOW - g.to}~${NOW - g.from}세`;
  return `<label class="radio-card radio-card--compact radio-card--gen${selected ? ' is-selected' : ''}">
  <input type="radio" name="gen" value="${g.id}"${selected ? ' checked' : ''}>
  <span class="radio-card__mark">${icon('check')}</span>
  <span class="radio-card__body"><span class="radio-card__head"><span class="radio-card__titleline"><span class="radio-card__title">${g.name}</span><span class="radio-card__lived" hidden>${icon('check')}${GM3_TEXT.lived}</span></span><span class="radio-card__meta"><span class="pair pair--gen"><span class="pair__item">${g.from}~${g.to}년생</span> <span class="pair__sep">· </span><span class="pair__item">${ages}</span></span></span></span><span class="radio-card__desc">${g.intro}</span>${g.note ? `<span class="radio-card__note">${g.note}</span>` : ''}</span>
  <span class="sr-only sel">${selected ? '선택됨' : ''}</span>
</label>`;
}
function genSlot() {
  return `<fieldset class="slot slot--big slot--gen8"><legend class="group-title">${GM3_TEXT.question}</legend>
      <p class="slot__lead">${GM3_TEXT.lead}</p>
      <div class="choices choices--grid" role="radiogroup" aria-label="태어날 세대">
      ${GENS.map((g) => genCard(g, g.id === 'genx')).join('\n      ')}
      <button type="button" class="radio-card radio-card--compact radio-card--action" data-gen="random"><span class="radio-card__mark radio-card__mark--square">${icon('shuffle')}</span><span class="radio-card__body"><span class="radio-card__head"><span class="radio-card__title">${GM3_TEXT.randomTitle}</span></span><span class="radio-card__desc">${GM3_TEXT.randomDesc}</span></span></button>
      </div>
      <details class="disclosure slot__fold"><summary>${GM3_TEXT.foldSummary}</summary><p>${GM3_TEXT.foldBody}</p></details></fieldset>`;
}
function regionSlot() {
  const chip = (s, { disabled = false, origin = false } = {}) =>
    `<label class="chip-opt${disabled ? ' is-disabled' : ''}${origin ? ' chip-opt--origin' : ''}"${disabled ? ' aria-disabled="true"' : ''}${origin ? ' hidden' : ''}><input type="radio" name="sido" value="${s}"${disabled ? ' disabled' : ''}>${icon('check')}<span>${origin ? GM3_TEXT.originChip(s) : s}</span></label>`;
  // X세대(1970~1980)의 어느 해에도 없던 시·도: 세종(2012 출범) — 목록은 DC7 연혁 표가 정한다(시안은 SPEC RG2 (b)의 예시만)
  const none = ['세종'];
  return `      <fieldset class="slot slot--small slot--region">
        <legend class="group-title group-title--inline">${GM3_TEXT.regionTitle}</legend>
        <div class="seg" role="radiogroup" aria-label="태어나는 시도를 정하는 방법">
          <label class="seg__opt is-selected"><input type="radio" name="regmode" value="roulette" checked>${icon('check')}<span>${GM3_TEXT.regionRoulette}</span><span class="sr-only">선택됨</span></label>
          <label class="seg__opt"><input type="radio" name="regmode" value="pick">${icon('check')}<span>${GM3_TEXT.regionPick}</span></label>
        </div>
        <p class="seg__hint seg__hint--roulette">${GM3_TEXT.regionHint}</p>
        <div class="chipset" role="radiogroup" aria-label="태어나는 시도" hidden>${chip('부산', { origin: true })}${SIDO_NOW.map((s) => chip(s, { disabled: none.includes(s) })).join('')}</div>
        <p class="seg__hint chipset__note" hidden>${GM3_TEXT.regionPickHint} ${GM3_TEXT.regionNone(none.map((s) => FORMAL[s]).join(', '))}</p>
      </fieldset>`;
}
function originSetting() {
  return `        <details class="disclosure origin" id="origin"><summary>${GM3_TEXT.originTitle} <span class="tag origin__cur">${GM3_TEXT.originNone}</span></summary>
          <div class="origin__body"><label><span class="sr-only">${GM3_TEXT.originTitle}</span><select class="origin__select"><option>${GM3_TEXT.originNone}</option>${SIDO_NOW.map((s) => `<option>${s}</option>`).join('')}</select></label><button type="button" class="btn btn--ghost btn--sm">${GM3_TEXT.originClear}</button><p class="origin__desc">${GM3_TEXT.originDesc}</p></div>
        </details>`;
}
const TITLE_STATE_JS = `(function(){var q=new URLSearchParams(location.search);var r=document.documentElement;
var gen=q.get('gen')||'genx';r.setAttribute('data-gen',gen);
document.querySelectorAll('input[name=gen]').forEach(function(i){var on=i.value===gen;i.checked=on;var c=i.closest('.radio-card');c.classList.toggle('is-selected',on);var sr=c.querySelector('.sr-only.sel');if(sr)sr.textContent=on?'선택됨':'';});
var rb=document.querySelector('[data-gen=random]');if(rb){rb.classList.toggle('is-selected',gen==='random');rb.setAttribute('aria-pressed',gen==='random'?'true':'false');}
document.querySelectorAll('input[name=gen]').forEach(function(i){i.addEventListener('change',function(){if(rb){rb.classList.remove('is-selected');rb.setAttribute('aria-pressed','false');}});});
if(rb)rb.addEventListener('click',function(){document.querySelectorAll('input[name=gen]').forEach(function(j){j.checked=false;j.closest('.radio-card').classList.remove('is-selected');});rb.classList.add('is-selected');rb.setAttribute('aria-pressed','true');});
var region=q.get('region')==='pick'?'pick':'roulette';r.setAttribute('data-region',region);
function paintRegion(){var pick=r.getAttribute('data-region')==='pick';document.querySelectorAll('.chipset,.chipset__note').forEach(function(e){e.hidden=!pick;});var hint=document.querySelector('.seg__hint--roulette');if(hint)hint.hidden=pick;document.querySelectorAll('input[name=regmode]').forEach(function(i){var on=(i.value==='pick')===pick;i.checked=on;i.closest('.seg__opt').classList.toggle('is-selected',on);});}
document.querySelectorAll('input[name=regmode]').forEach(function(i){i.addEventListener('change',function(){r.setAttribute('data-region',i.value);paintRegion();});});
paintRegion();
var origin=q.get('origin')==='set'?'set':'none';r.setAttribute('data-origin',origin);
if(origin==='set'){var cur=document.querySelector('.origin__cur');if(cur)cur.textContent='부산';var sel=document.querySelector('.origin__select');if(sel)sel.value='부산';var oc=document.querySelector('.chip-opt--origin');if(oc)oc.hidden=false;}
if(q.get('open')==='origin'){var det=document.getElementById('origin');if(det)det.open=true;}
var pick=q.get('pick')||(region==='pick'?'부산':'');
function paintSido(){document.querySelectorAll('input[name=sido]').forEach(function(j){j.closest('.chip-opt').classList.toggle('is-selected',j.checked&&!j.disabled);});}
document.querySelectorAll('input[name=sido]').forEach(function(i){if(i.value===pick&&!i.disabled&&!i.closest('.chip-opt').hidden)i.checked=true;i.addEventListener('change',paintSido);});paintSido();
(q.get('lived')||'').split(',').filter(Boolean).forEach(function(id){var c=document.querySelector('input[name=gen][value="'+id+'"]');if(c){var p=c.closest('.radio-card').querySelector('.radio-card__lived');if(p)p.hidden=false;}});
if(q.get('fold')==='open'){var f=document.querySelector('.slot__fold');if(f)f.open=true;}
})();`;

function buildTitle() {
  let html = readFileSync(`${ROOT}docs/design/mockups/title-005.html`, 'utf-8');
  html = must(html, '<title>수저 게임 · 시안 · 첫 화면(SPEC-005 QI2)</title>', '<title>수저 게임 · 시안 · 첫 화면 세대 선택(SPEC-004 GM3)</title>', 'title');
  html = must(html, '<link rel="stylesheet" href="../../../src/styles/tokens.css">', '<link rel="stylesheet" href="../../../../src/styles/tokens.css">', 'tokens');
  html = must(html, '<link rel="stylesheet" href="ds.css">', '<link rel="stylesheet" href="../ds.css">', 'ds');
  html = must(html, '<link rel="stylesheet" href="title-005.css">', '<link rel="stylesheet" href="../title-005.css">\n<link rel="stylesheet" href="gm3.css">', 'title-005.css');
  html = html.replaceAll('../../../src/assets/home/', '../../../../src/assets/home/');
  html = must(html, `r.setAttribute('data-slot',q.get('slot')==='gen8'?'gen8':'era3')`, `r.setAttribute('data-slot','gen8')`, 'slot default');
  html = must(html, `r.setAttribute('data-hero',q.get('hero')==='illust'?'illust':'picto')`, `r.setAttribute('data-hero','illust')`, 'hero default');
  html = must(html, `r.setAttribute('data-seen',q.get('seen')==='1'?'1':'0')`, `r.setAttribute('data-seen',q.get('seen')==='0'?'0':'1')`, 'seen default');
  html = html.replace(/<p class="hero__tag">[\s\S]*?<\/p>/, `<p class="hero__tag">${GM3_TEXT.tagLead}<span class="nowrap">${GM3_TEXT.tagKeep}</span></p>`);
  const era3 = html.match(/<fieldset class="slot slot--big slot--era3">[\s\S]*?<\/fieldset>\n/);
  if (!era3) throw new Error('era3 slot');
  html = html.replace(era3[0], '');
  const gen8 = html.match(/<fieldset class="slot slot--big slot--gen8">[\s\S]*?<\/fieldset>/);
  if (!gen8) throw new Error('gen8 slot');
  html = html.replace(gen8[0], genSlot());
  html = must(html, '      <div class="slot slot--setting">', `${regionSlot()}\n      <div class="slot slot--setting">`, 'setting slot');
  html = must(html, '        </button>\n      </div>\n    </div>\n  </main>', `        </button>\n${originSetting()}\n      </div>\n    </div>\n  </main>`, 'origin insert');
  html = must(html, '</body>', `<script>${TITLE_STATE_JS}</script>\n</body>`, 'state script');
  writeFileSync(`${OUT}title-004.html`, html);
}

// ============================================================ ② 룰렛 ============================================================
const WEALTH_REEL_ORDER = [1, 2, 3, 4, 5, 4, 3, 2];
const X_WEIGHTS = [33, 31, 24, 10, 2];
const YEARS_X = Array.from({ length: 11 }, (_, i) => 1970 + i);
const YEAR_ODDS = [9.6, 10.1, 9.9, 9.8, 9.3, 8.8, 8.3, 8.3, 8.1, 8.9, 8.9]; // 시안 값 — 합 100.0
const REGION_ODDS_1972 = [22.0, 7.8, 10.5, 5.8, 4.6, 8.6, 7.4, 11.6, 13.2, 7.3, 1.2]; // 시안 값 — 합 100.0
const sum1 = (a) => Math.round(a.reduce((s, v) => s + v, 0) * 10) / 10;
if (sum1(YEAR_ODDS) !== 100 || sum1(REGION_ODDS_1972) !== 100 || X_WEIGHTS.reduce((s, v) => s + v, 0) !== 100) throw new Error('확률표 합이 100이 아니다');

function reel(cells, { spinning, resultIdx, cls = '', picked = false, pos = 17.4, ariaHidden = true }) {
  const n = cells.length;
  let items;
  if (spinning) {
    const reps = Math.ceil(40 / n) + 1;
    items = Array.from({ length: reps * n }, (_, k) => cells[k % n]);
    return `<div class="reel is-spinning is-fast ${cls}" aria-hidden="${ariaHidden}" data-state="spinning"><div class="reel__window"></div><ul class="reel__list" style="transform:translate3d(0, calc(var(--reel-item-h) * -${pos}), 0)">${items.map((c) => `<li class="reel__item${c.cls ? ` ${c.cls}` : ''}">${c.html}</li>`).join('')}</ul></div>`;
  }
  const idx = Array.from({ length: 5 }, (_, e) => (((resultIdx + e - 2) % n) + n) % n);
  return `<div class="reel${picked ? ' is-picked' : ''} ${cls}" aria-hidden="${ariaHidden}" data-state="${picked ? 'still' : 'done'}"><div class="reel__window"></div><ul class="reel__list">${idx.map((i, e) => `<li class="reel__item${cells[i].cls ? ` ${cells[i].cls}` : ''}${e === 2 ? ' is-result' : ''}">${cells[i].html}</li>`).join('')}</ul></div>`;
}
const oddsTable = (caption, rows, note, cls = '') =>
  `<div class="odds ${cls}"><table><caption class="sr-only">${caption}</caption><tbody>${rows.map(([k, v]) => `<tr><th scope="row">${k}</th><td>${v}</td></tr>`).join('')}</tbody></table>${note ? `<p class="odds__note">${note}</p>` : ''}</div>`;

function rouletteMain(state, picked) {
  const gx = GENS[3];
  const genLine = `<p class="roulette__gen"><span class="gen-tag">${gx.name}</span><span>${GM3_TEXT.genAmong(gx.from, gx.to)}</span></p>`;
  if (state === 'draw') {
    const cells = GENS.map((g) => ({ html: `<span>${g.short || g.name}</span><small>${g.from}~${g.to}</small>`, cls: 'reel__item--gen' }));
    return `<div class="page roulette-page is-spinning" data-state="draw">
${headerLogoRow()}
<main class="roulette">
  <div class="roulette__lead"><h1 class="t-title" style="--title-chars:5">${GM3_TEXT.drawTitle}</h1><p class="t-muted" role="status">${GM3_TEXT.drawNote}</p></div>
  <div class="reels"><div class="reel-col reel-col--gen">${reel(cells, { spinning: false, resultIdx: 3, cls: 'reel--gen' })}
    ${oddsTable('세대별 확률', GENS.map((g) => [g.name, '1/7']), GM3_TEXT.drawOdds, 'odds--gen')}</div></div>
  <p class="t-xs t-faint roulette__after" aria-hidden="true">${GM3_TEXT.afterNote}</p>
</main>
<div class="page-end-space"></div>
<div class="bottom-bar"><button class="btn btn--secondary btn--lg" type="button">${GM3_TEXT.skip}</button></div>
</div>`;
  }
  const spinning = state !== 'result';
  const yearCells = YEARS_X.map((y) => ({ html: String(y), cls: 'reel__item--year' }));
  const regionCells = SIDO_1972.map((s) => ({ html: s }));
  const spoonCells = WEALTH_REEL_ORDER.map((n) => ({ html: reelSpoon(n) }));
  const yearReel = reel(yearCells, { spinning, resultIdx: 2, pos: 17.4 });
  const regionReel = picked ? reel(regionCells, { spinning: false, resultIdx: 1, picked: true }) : reel(regionCells, { spinning, resultIdx: 1, pos: 21.5 });
  const spoonReel = reel(spoonCells, { spinning, resultIdx: 1, pos: 19.6 });
  const yearOdds = oddsTable('연도별 확률', YEARS_X.map((y, i) => [`${y}년`, `${YEAR_ODDS[i].toFixed(1)}%`]), GM3_TEXT.yearOddsNote, 'odds--year');
  const regionOdds = picked
    ? `<p class="odds__picked">${GM3_TEXT.pickedRegion}</p>`
    : oddsTable('지역별 확률', SIDO_1972.map((s, i) => [s, `${REGION_ODDS_1972[i].toFixed(1)}%`]), `<span class="nowrap">1972년</span> <span class="keep-phrase">시·도별</span> 출생아 수 비율. 그 해의 시·도 목록이에요. 이름은 줄여 적었어요.`, 'odds--cols');
  const spoonOdds = oddsTable('수저별 확률', [1, 2, 3, 4, 5].map((n) => [['흙수저', '동수저', '은수저', '금수저', '다이아몬드<wbr>수저'][n - 1], `${X_WEIGHTS[n - 1]}%`]), '게임의 설계값이에요(통계가 아님).');
  const status = spinning
    ? `<p class="t-muted" role="status">${picked ? GM3_TEXT.spinNotePicked : GM3_TEXT.spinNote}</p>`
    : `<p class="roulette__result" role="status">${fitPair('1972년', '부산')}<span class="grade-line">${gradeChip(2, { range: '하위 33%와 상위 36% 사이' })}</span></p>`;
  return `<div class="page roulette-page${spinning ? ' is-spinning' : ''}" data-state="${spinning ? 'spinning' : 'done'}">
${headerLogoRow()}
<main class="roulette">
  <div class="roulette__lead"><h1 class="t-title" style="--title-chars:${spinning ? 4 : 7}">${spinning ? GM3_TEXT.spinTitle : GM3_TEXT.doneTitle}</h1>${genLine}${status}</div>
  <div class="reels reels--3">
    <div class="reel-col"><h2 class="reel-col__title">${GM3_TEXT.yearTitle}</h2>${yearReel}${yearOdds}</div>
    <div class="reel-col"><h2 class="reel-col__title">${GM3_TEXT.regionReelTitle}</h2>${regionReel}${regionOdds}</div>
    <div class="reel-col"><h2 class="reel-col__title">${GM3_TEXT.wealthTitle}</h2>${spoonReel}${spoonOdds}</div>
  </div>
  <p class="t-xs t-faint roulette__after" aria-hidden="true">${GM3_TEXT.afterNote}</p>
</main>
<div class="page-end-space"></div>
<div class="bottom-bar"><button class="btn ${spinning ? 'btn--secondary' : 'btn--primary'} btn--lg" type="button">${spinning ? GM3_TEXT.skip : GM3_TEXT.seeReport}</button></div>
</div>`;
}
const headerLogoRow = () => `<header class="site-head">${headerLogo()}<span class="site-head__name">출생</span></header>`;

function buildRoulette() {
  const body = `${GM3_SPRITE}
${rouletteMain('spinning', false)}
<template id="state-draw">${rouletteMain('draw', false)}</template>
<template id="state-result">${rouletteMain('result', false)}</template>
<template id="state-spinning-picked">${rouletteMain('spinning', true)}</template>
<template id="state-result-picked">${rouletteMain('result', true)}</template>
<p class="mock-tag" style="margin:0 var(--gutter) var(--sp-3)">시안 · 가짜 데이터 — 확률표 수치는 시안 값</p>
<script>(function(){var q=new URLSearchParams(location.search);var s=q.get('state')||'spinning';var picked=q.get('region')==='picked';var id='state-'+s+(picked&&s!=='draw'?'-picked':'');var t=document.getElementById(id);if(!t)return;var cur=document.querySelector('.page');cur.replaceWith(t.content.cloneNode(true));})();</script>`;
  const html = page({ title: '수저 게임 · 시안 · 룰렛 연도 릴(SPEC-004 GM3)', body, head: '<link rel="stylesheet" href="gm3.css">' })
    .replace('href="../../../src/styles/tokens.css"', 'href="../../../../src/styles/tokens.css"')
    .replace('href="ds.css"', 'href="../ds.css"');
  writeFileSync(`${OUT}roulette-004.html`, html);
}

// ============================================================ ③ 대시보드 ============================================================
const won = (man) => {
  if (man === 0) return '0원';
  const abs = Math.abs(man);
  const eok = Math.floor(abs / 10000);
  const rest = abs % 10000;
  const body = eok > 0 ? `${eok}억${rest > 0 ? ` ${rest.toLocaleString('ko-KR')}만` : ''} 원` : `${rest.toLocaleString('ko-KR')}만 원`;
  return (man < 0 ? '−' : '') + body;
};
const conv = (man, ratio) => (man < 0 ? -1 : 1) * Math.round(Math.abs(man) * ratio);

/** 자산 카드 (EY10·EY11·EY12). mode: then|now|future|none */
function assetsCard({ mode, year, net, income, debt }) {
  const ratio = mode === 'then' ? { 2000: 0.5416, 2010: 0.7407 }[year] : 1;
  const v = (m) => won(conv(m, ratio));
  const tag = mode === 'then' ? GM3_TEXT.tagThen : GM3_TEXT.tagNow;
  let view = '';
  if (mode === 'then') view = `<div class="assets__view"><button type="button" class="btn btn--ghost btn--sm" aria-describedby="assets-basis">${GM3_TEXT.toNow}<span class="sr-only"> ${GM3_TEXT.viewingThen}</span></button><p class="assets__basis">${GM3_TEXT.basisThen(year)}</p></div>`;
  else if (mode === 'now') view = `<div class="assets__view"><button type="button" class="btn btn--ghost btn--sm" aria-describedby="assets-basis">${GM3_TEXT.toThen}<span class="sr-only"> ${GM3_TEXT.viewingNow}</span></button><p class="assets__basis">${GM3_TEXT.basisNow}</p></div>`;
  else if (mode === 'none') view = `<div class="assets__view"><p class="assets__basis">${GM3_TEXT.basisNone}</p></div>`;
  return `<section class="card card--assets" aria-labelledby="assets-title" data-testid="assets-card"><div class="card__head"><h2 id="assets-title" class="card__title">자산 현황</h2><span class="tag" id="assets-basis" data-testid="assets-basis">${tag}</span></div><dl class="assets" data-testid="assets" aria-describedby="assets-basis"><div class="assets__row"><dt>순자산</dt><dd class="nowrap">${v(net)}</dd></div><div class="assets__row"><dt>연 소득</dt><dd class="nowrap">${v(income)}</dd></div><div class="assets__row"><dt>부채</dt><dd class="nowrap">${v(debt)}</dd></div></dl>${view}<p class="assets__note">순자산은 가진 것에서 부채를 뺀 값입니다. 0보다 작으면 부채가 가진 것보다 많다는 뜻입니다.</p></section>`;
}
const tlLabel = (kind) => `<span class="log__tl">${icon(TL_ICON[kind])}<span>${GM3_TEXT.tl[kind]}</span></span>`;
/** 인생 기록 한 줄. kind: '' | stage | tl(year|bg|local|proj) | intro */
function logRow({ age, year, kind = '', tl, text, latest = false, scenario }) {
  const ageCell = `<span class="log__age">${age}세${year ? `<small class="log__year">${year}</small>` : ''}</span>`;
  if (kind === 'intro') return `<li class="log__row log__row--proj-intro" data-kind="projection-intro">${ageCell}<span class="log__text"><span class="log__tl">${projChip()}<span class="log__scn">${GM3_TEXT.scenario(scenario)}</span></span><span class="log__sent">${text}</span></span></li>`;
  if (tl) return `<li class="log__row log__row--tl${latest ? ' log__row--latest' : ''}" data-kind="timeline" data-tl="${tl}">${ageCell}<span class="log__text">${tlLabel(tl)}<span class="log__sent">${text}</span></span></li>`;
  return `<li class="log__row${kind === 'stage' ? ' log__row--stage' : ''}${latest ? ' log__row--latest' : ''}">${ageCell}<span class="log__text">${text}</span></li>`;
}
const PEOPLE = {
  smin: { name: '김성민', gender: 'male', born: 1972, place: '부산직할시 동래구', placeNow: '부산광역시 동래구', grade: 2, range: '하위 33%와 상위 36% 사이', gen: 'X세대' },
  ysu: { name: '박영수', gender: 'male', born: 1940, place: '경상북도 안동군', placeNow: '경상북도 안동시', grade: 1, range: '하위 40% 안쪽', gen: '산업화 세대 · 전후 세대' },
};
// 1972년생 X세대 김성민의 기록(최신순). 연표 문장은 설계 문서 예시(timeline-schema.md 2-4·SPEC 부록 A H-C05·RG6)의 뜻만 — 실제 사건 문장은 DC1·reviewer 판독 뒤 확정
const ROWS_2000 = [
  { age: 28, text: '일하던 곳과 계약이 한 해 더 이어졌습니다.', latest: true },
  { age: 27, text: '보증금을 올려 달라는 연락을 받아 월세 집으로 옮겼습니다.' },
  { age: 26, text: '계약직으로 첫 직장에 들어갔습니다.' },
  { age: 25, year: 1997, tl: 'year', text: '졸업했지만 채용 공고가 사라졌습니다.' },
  { age: 24, text: '군 복무를 마치고 학교로 돌아왔습니다.' },
  { age: 20, kind: 'stage', text: '스무 살이 되었습니다. 이제부터는 집안 형편이 아니라 내가 가진 것으로 살아갑니다.' },
  { age: 19, year: 1991, tl: 'year', text: '시험이 끝난 날 친구들과 처음 노래방에 갔습니다.' },
  { age: 15, year: 1987, tl: 'bg', text: '이 해 헌법이 바뀌어 대통령을 국민이 직접 뽑게 되었습니다.' },
  { age: 8, year: 1980, tl: 'local', text: '그해 5월 광주에서 있었던 일을 라디오 뉴스로 전해 들었습니다.' },
  { age: 8, text: '학교에 들어갔습니다.' },
  { age: 0, text: '1972년 5월, 부산직할시 동래구의 형편이 보통인 가정에서 3.2kg 남자아이로 태어났습니다. 둘째입니다.' },
];
const ROWS_2031 = [
  { age: 59, year: 2031, tl: 'proj', text: '정년을 두고 회사 안에서 이야기가 오갈 수도 있습니다.', latest: true },
  { age: 58, text: '큰아이가 집을 떠나 혼자 살기 시작했습니다.' },
  { age: 57, year: 2029, tl: 'proj', text: '돌봄이 필요한 식구가 생길 수도 있습니다.' },
  { age: 55, text: '건강검진에서 쉬어 가라는 말을 들었습니다. <em>(선택: 일을 줄인다)</em>' },
  { age: 54, year: 2026, kind: 'intro', scenario: '기준', text: GM3_TEXT.projIntro },
  { age: 53, text: '주변에서 일터를 떠나는 사람이 부쩍 늘었습니다.' },
  { age: 50, text: '집에서 일하는 날이 늘었습니다. <em>(선택: 경계를 흐리게 둔다)</em>' },
  { age: 40, kind: 'stage', text: '어느덧 마흔이 되었습니다.' },
  { age: 25, year: 1997, tl: 'year', text: '졸업했지만 채용 공고가 사라졌습니다.' },
];
const ROWS_1963 = [
  { age: 23, text: '공장에서 일자리를 얻어 도시로 나왔습니다.', latest: true },
  { age: 20, kind: 'stage', text: '스무 살이 되었습니다. 이제부터는 집안 형편이 아니라 내가 가진 것으로 살아갑니다.' },
  { age: 13, year: 1953, tl: 'bg', text: '이 해 전쟁이 멈추고 휴전이 이루어졌습니다.' },
  { age: 0, text: '1940년 3월, 경상북도 안동군의 형편이 어려운 가정에서 2.9kg 남자아이로 태어났습니다. 셋째입니다.' },
];

function dashboard(state) {
  const p = state === 'none' ? PEOPLE.ysu : PEOPLE.smin;
  const year = state === 'projection' ? 2031 : state === 'none' ? 1963 : 2000;
  const age = year - p.born;
  const rows = state === 'projection' ? ROWS_2031 : state === 'none' ? ROWS_1963 : ROWS_2000;
  const ageGroup = age >= 55 ? 'middle' : 'young';
  const assets = state === 'none' ? assetsCard({ mode: 'none', year, net: 300, income: 900, debt: 0 }) : state === 'projection' ? assetsCard({ mode: 'future', year, net: 18400, income: 4100, debt: 6200 }) : assetsCard({ mode: state, year, net: -1200, income: 3200, debt: 4800 });
  const family = state === 'projection'
    ? `<dt>어머니</dt><dd>86세<small>${fitPair('은퇴', '돌봄 필요')}</small></dd><dt>아버지</dt><dd>세상을 떠남<small>2027년</small></dd><dt>배우자</dt><dd>56세<small>${fitPair('사무직', '건강함')}</small></dd><dt>자녀</dt><dd>딸 27세, 아들 24세</dd>`
    : state === 'none'
      ? `<dt>어머니</dt><dd>50세<small>${fitPair('농업', '건강함')}</small></dd><dt>아버지</dt><dd>54세<small>${fitPair('농업', '허리가 아픔')}</small></dd><dt>형제자매</dt><dd>형 27세, 누나 25세, 남동생 19세</dd><dt>배우자</dt><dd>없음</dd>`
      : `<dt>어머니</dt><dd>55세<small>${fitPair('판매직', '건강함')}</small></dd><dt>아버지</dt><dd>58세<small>${fitPair('기계 조작직', '건강함')}</small></dd><dt>형제자매</dt><dd>누나 31세 <small>3세 위</small></dd><dt>배우자</dt><dd>없음</dd><dt>자녀</dt><dd>없음</dd>`;
  const peers = state === 'none'
    ? [['이영자', '여성', '전라남도 나주군', 1, '농사일'], ['김철수', '남성', '서울특별시 영등포구', 3, '일하는 사람'], ['박순자', '여성', '경상남도 밀양군', 1, '집안일'], ['정기호', '남성', '강원도 삼척군', 2, '일하는 사람']]
    : [['이정훈', '남성', '서울특별시 관악구', 1, state === 'projection' ? '일하는 사람' : '구직 중'], ['박미경', '여성', '전라남도 순천시', 2, '일하는 사람'], ['최성호', '남성', '대구광역시 북구', 4, '일하는 사람'], ['김은주', '여성', '경상남도 진주시', 1, state === 'projection' ? '돌봄' : '일하는 사람']];
  // 연도와 「전망」 칩은 한 칸(.year-row__year) — .year-row의 둘째 자식(진행률 바)이 늘어나는 구조를 지킨다
  const headYear = `<span class="year-row__year"><span class="num">${year}년</span>${state === 'projection' ? projChip() : ''}</span>`;
  return `<header class="dash-head"><div class="dash-head__inner">
    <div class="dash-head__top">${headerLogo()}<div class="who"><h1 class="who__name">${p.name}</h1><span class="who__age"><b>${age}</b>세</span></div></div>
    <div class="year-row">${headYear}<div class="year-progress" role="progressbar" aria-label="올해 진행률" aria-valuemin="0" aria-valuemax="100" aria-valuenow="38"><div class="year-progress__fill" style="width:38%"></div></div><span class="year-row__pct num">38%</span></div>
  </div></header>
  <div class="toolbar"><div class="toolbar__inner">
    <div class="controls-fixed" role="group" aria-label="진행 조작" data-testid="bottom-bar">
      <div class="controls__speed"><button class="btn btn--sm" type="button">${icon('pause', 'icon--sm')}<span>일시정지</span></button><button class="btn btn--sm" type="button" aria-pressed="true">1배</button><button class="btn btn--sm" type="button">2배</button><button class="btn btn--sm" type="button">4배</button><button class="btn btn--sm" type="button">8배</button></div>
      <div class="controls__more"><button class="btn btn--sm btn--secondary" type="button">${icon('next', 'icon--sm')}<span>다음 결정으로</span></button><button class="btn btn--sm btn--secondary" type="button" aria-pressed="false">${icon('auto', 'icon--sm')}<span>자동 모드 꺼짐</span></button></div>
    </div>
    <div class="controls__tools" role="group" aria-label="도구"><button class="btn btn--tool" type="button" data-tool="bgm" aria-pressed="false">${icon('music')}<span>BGM</span><span class="sr-only"></span></button><button class="btn btn--tool" type="button" data-tool="note" aria-haspopup="dialog">${icon('pencil')}<span>생각 남기기</span></button><button class="btn btn--tool" type="button" data-tool="dark" aria-pressed="false">${icon('moon')}<span>다크 모드</span><span class="sr-only"></span></button><button class="btn btn--tool" type="button" data-tool="feedback" aria-pressed="false">${icon('message')}<span>의견 보내기</span><span class="sr-only"></span></button><button class="btn btn--tool" type="button" data-tool="exit" aria-pressed="false">${icon('exit')}<span>나가기</span><span class="sr-only"></span></button></div>
  </div></div>
<main class="dash">
  <div class="col">
    <section class="card profile" aria-label="프로필">
  <div class="profile__top">${face(ageGroup, p.gender, 3, `${p.name}의 얼굴`, 'face--lg')}<div><p class="profile__name">${p.name}</p><p class="t-sm t-muted">남성</p></div></div>
  <dl class="facts">
    <dt>출생</dt><dd>${p.born}년 ${p === PEOPLE.ysu ? 3 : 5}월</dd>
    <dt>세대</dt><dd>${p.gen}</dd>
    <dt>거주</dt><dd>${state === 'projection' ? '경기도 용인시 수지구' : state === 'none' ? '경상북도 대구시' : p.placeNow}</dd>
    <dt>출신 가정</dt><dd><span class="grade-line">${gradeChip(p.grade, { range: p.range })}</span></dd>
    <dt>학력</dt><dd>${state === 'none' ? '초등학교 졸업' : '대학교 졸업'}</dd>
    <dt>외모</dt><dd>상위 약 52% <small>또래 사이에서</small></dd>
  </dl></section>
    <section class="card stack stack--sm" aria-label="상태" data-testid="stats"><div class="card__head card__head--flush"><h2 class="card__title">상태</h2></div>${meter('health', state === 'none' ? 70 : state === 'projection' ? 58 : 74)}${meter('happy', 58)}${meter('knowledge', state === 'none' ? 38 : 66)}${meter('relation', 62)}<details class="disclosure"><summary>상태와 자산의 뜻 보기</summary><p>0에서 100 사이의 값입니다. 건강은 몸의 상태, 행복은 마음의 만족, 지식은 배우고 익힌 정도, 관계는 <span class="keep-phrase">가족·친구와의</span> 유대입니다. ${GM3_TEXT.helpMoney} 순자산, 연 소득, 부채는 내 가구 기준이며 결혼한 뒤에는 배우자와 자녀의 몫까지 합한 값입니다. 선택지 아래 표시는 <span class="keep-phrase">그 선택만으로</span> 생기는 변화이고, 해마다의 소득과 생활비는 따로 더해집니다.</p></details></section>
    ${assets}
  </div>
  <div class="col col--center"><section class="card log" aria-label="인생 기록"><div class="card__head" style="margin-bottom:var(--sp-2)"><h2 class="card__title">인생 기록</h2><span class="t-xs t-faint"><span class="keep-phrase">최신순 · 아래로</span> 스크롤하면 지난 기록</span></div>
  <p class="log__pin">${fitPair('이 세상의 가상 인구 51,284명', `${p.name}도 그중 한 사람`)}</p>
  <div class="log__list" role="region" aria-label="인생 기록" tabindex="0"><ol class="log__rows" aria-live="polite" aria-relevant="additions">${rows.map(logRow).join('')}</ol></div></section></div>
  <div class="col">
    <section class="card family" aria-label="식구"><h2 class="card__title" style="margin-bottom:var(--sp-3)">식구</h2><dl class="family-list">${family}</dl></section>
    <section class="card peers-now" aria-labelledby="peers-now-t"><div class="card__head" style="margin-bottom:var(--sp-1)"><h2 id="peers-now-t" class="card__title">같은 해 태어난 사람들</h2><span class="card__sub">요즘 모습</span></div><ul class="people">${peers.map(([n, g, pl, gr, now]) => `<li><div class="people__who"><div class="people__line"><span class="name">${n}</span> <span class="sub">${g}</span></div><div class="sub">${pl}</div></div>${gradeChip(gr)}<span class="people__now">${now}</span></li>`).join('')}</ul><p class="t-xs t-faint">나이와 수저에 따라 정한 설계값입니다(통계가 아님).</p></section>
    <p class="mock-tag">시안 · 가짜 데이터 — 연표 문장은 설계 문서 예시, 확정 전</p>
  </div>
</main>
<div class="page-end-space"></div>`;
}
function buildDashboard() {
  const body = `${GM3_SPRITE}
${dashboard('then')}
${['now', 'projection', 'none'].map((s) => `<template id="state-${s}">${dashboard(s)}</template>`).join('\n')}
<script>(function(){var s=new URLSearchParams(location.search).get('state');if(!s||s==='then')return;var t=document.getElementById('state-'+s);if(!t)return;['.dash-head','.toolbar','main.dash','.page-end-space'].forEach(function(sel){var el=document.querySelector(sel);if(el)el.remove();});document.body.appendChild(t.content.cloneNode(true));})();</script>`;
  const html = page({ title: '수저 게임 · 시안 · 인생 기록 연표 줄·자산 카드 당시 화폐(SPEC-004 GM3)', body, bodyClass: 'is-dash', head: '<link rel="stylesheet" href="gm3.css">' })
    .replace('href="../../../src/styles/tokens.css"', 'href="../../../../src/styles/tokens.css"')
    .replace('href="ds.css"', 'href="../ds.css"');
  writeFileSync(`${OUT}dashboard-004.html`, html);
}

// ============================================================ ④ 엔딩 ============================================================
function tlItem({ age, year, tl, text, kind = 'event', cls = '' }) {
  const ageCell = `<span class="log__age">${age}세${year ? `<small class="log__year">${year}</small>` : ''}</span>`;
  if (tl) return `<li class="is-tl" data-kind="timeline" data-tl="${tl}">${ageCell}<span>${tlLabel(tl)}<span class="tl-text">${text}</span></span></li>`;
  return `<li class="${cls}" data-kind="${kind}">${ageCell}<span>${text}</span></li>`;
}
const splitRow = () => `<li class="timeline__split" aria-label="${GM3_TEXT.projSplit}">${projChip()}<span>${GM3_TEXT.projSplit} · 기준 시나리오</span></li>`;

function ending(state) {
  const future = state !== '2010';
  const p = future ? PEOPLE.smin : PEOPLE.ysu;
  const deathYear = future ? 2041 : 2010;
  const deathAge = deathYear - p.born;
  const originSet = future; // 비교 카드는 내 출신 시도 설정이 있을 때만(RG4)
  const finalNet = future
    ? `<dl class="final-net"><dt>최종 순자산</dt><dd><span class="final-net__value nowrap">${won(18400)}</span><span class="final-net__view"><span class="tag" id="final-basis">${GM3_TEXT.tagNow}</span></span></dd></dl>`
    : `<dl class="final-net"><dt>최종 순자산</dt><dd><span class="final-net__value nowrap">${won(conv(12345, 0.7407))}</span><span class="final-net__view"><span class="tag" id="final-basis">${GM3_TEXT.tagThen}</span><button type="button" class="btn btn--ghost btn--sm" aria-describedby="final-basis">${GM3_TEXT.toNow}<span class="sr-only"> ${GM3_TEXT.viewingThen}</span></button></span><span class="final-net__basis">${GM3_TEXT.basisThen(2010)}</span></dd></dl>`;
  const groups = future
    ? [
        ['영유아 · 0~6세', [tlItem({ age: 0, text: '1972년 5월, 부산직할시 동래구의 형편이 보통인 가정에서 3.2kg 남자아이로 태어났습니다. 둘째입니다.' })]],
        ['학창 · 7~19세', [tlItem({ age: 8, year: 1980, tl: 'local', text: '그해 5월 광주에서 있었던 일을 라디오 뉴스로 전해 들었습니다.' }), tlItem({ age: 15, year: 1987, tl: 'bg', text: '이 해 헌법이 바뀌어 대통령을 국민이 직접 뽑게 되었습니다.' }), tlItem({ age: 19, year: 1991, tl: 'year', text: '시험이 끝난 날 친구들과 처음 노래방에 갔습니다.' })]],
        ['청년 · 20~39세', [tlItem({ age: 20, kind: 'stage', text: '스무 살이 되었습니다. 이제부터는 집안 형편이 아니라 내가 가진 것으로 살아갑니다.' }), tlItem({ age: 25, year: 1997, tl: 'year', text: '졸업했지만 채용 공고가 사라졌습니다.' }), `<li class="is-choice" data-kind="choice"><span class="log__age">31세</span><span><strong>살 곳을 구하는 일</strong><span class="tl-picked">선택: 보증금이 낮은 월세방을 구한다</span><span class="tl-text">보증금이 낮은 월세방을 구했습니다.</span></span></li>`]],
        ['중년 · 40~64세', [tlItem({ age: 40, kind: 'stage', text: '어느덧 마흔이 되었습니다.' }), tlItem({ age: 53, text: '주변에서 일터를 떠나는 사람이 부쩍 늘었습니다.' }), splitRow(), tlItem({ age: 57, year: 2029, tl: 'proj', text: '돌봄이 필요한 식구가 생길 수도 있습니다.' }), tlItem({ age: 59, year: 2031, tl: 'proj', text: '정년을 두고 회사 안에서 이야기가 오갈 수도 있습니다.' })]],
        ['노년 · 65세~', [tlItem({ age: 65, kind: 'stage', text: '예순다섯이 되었습니다. 일에서 한 걸음 물러설 나이입니다.' }), tlItem({ age: 67, year: 2039, tl: 'proj', text: '연금을 받기 시작하는 나이가 지금과 다를 수도 있습니다.' }), tlItem({ age: 69, kind: 'death', text: '세상을 떠났습니다. 원인은 오랜 병이었습니다.' })]],
      ]
    : [
        ['영유아 · 0~6세', [tlItem({ age: 0, text: '1940년 3월, 경상북도 안동군의 형편이 어려운 가정에서 2.9kg 남자아이로 태어났습니다. 셋째입니다.' })]],
        ['학창 · 7~19세', [tlItem({ age: 10, year: 1950, tl: 'bg', text: '이 해 전쟁이 시작되었습니다.' }), tlItem({ age: 13, year: 1953, tl: 'bg', text: '이 해 전쟁이 멈추고 휴전이 이루어졌습니다.' })]],
        ['청년 · 20~39세', [tlItem({ age: 20, kind: 'stage', text: '스무 살이 되었습니다. 이제부터는 집안 형편이 아니라 내가 가진 것으로 살아갑니다.' }), tlItem({ age: 23, text: '공장에서 일자리를 얻어 도시로 나왔습니다.' }), tlItem({ age: 33, year: 1973, tl: 'year', text: '기름값이 올라 가게마다 값표가 바뀐다는 말을 들었습니다.' })]],
        ['중년 · 40~64세', [tlItem({ age: 40, kind: 'stage', text: '어느덧 마흔이 되었습니다.' }), tlItem({ age: 57, year: 1997, tl: 'year', text: '회사에서 명예퇴직을 권유받았습니다.' })]],
        ['노년 · 65세~', [tlItem({ age: 65, kind: 'stage', text: '예순다섯이 되었습니다. 일에서 한 걸음 물러설 나이입니다.' }), tlItem({ age: 70, kind: 'death', text: '세상을 떠났습니다. 원인은 노환이었습니다.' })]],
      ];
  const compare = originSet
    ? `<section class="card same-event" aria-labelledby="compare-title"><h2 id="compare-title" class="card__title card__title--gap">${GM3_TEXT.compareTitle}</h2>
    <ul class="same-event__list"><li class="same-event__item"><span class="log__age">8세<small class="log__year">1980</small></span><span><span class="tl-text">그해 5월 광주에서 있었던 일</span><span class="same-event__facts"><span>직접 영향 시도 <b>광주</b></span><span>이 판(부산) <b>라디오 뉴스로 전해 들었습니다</b></span><span>내 출신 시도(서울) <b>그 밖 지역</b></span></span></span></li></ul>
    <p class="same-event__close">${GM3_TEXT.compareClose}</p><p class="t-xs t-faint">내 출신 시도는 설정에서 고른 값이고 <span class="keep-phrase">이 기기</span> 밖으로 나가지 않습니다. 관계는 공공 기록의 지리 사실이며, 그곳 사람들의 체감을 말하지 않습니다.</p></section>`
    : '';
  return `<main class="ending" data-state="${state}">
  <div class="ending__head">${face(deathAge >= 65 ? 'senior' : 'middle', p.gender, 3, `${p.name}의 얼굴`, 'face--lg')}
    <div class="ending__who"><p class="label">생애 기록</p><h1 class="t-title" style="--title-chars:5">${p.name}의 인생</h1><p class="t-muted"><span class="nowrap">${p.born}년 ${p === PEOPLE.ysu ? 3 : 5}월</span> ~ <span class="keep-phrase"><span class="nowrap">${deathYear}년</span> · <span class="nowrap">${deathAge}세</span></span></p>
    <div class="ending__meta"><span><b>${GM3_TEXT.endingGen(p.gen, p.born)}</b></span><span>${GM3_TEXT.endingBorn(p.place)}</span>${future ? `<span>${projChip()}${GM3_TEXT.endingProj('기준')}</span>` : ''}</div></div></div>
  <section class="card stack--sm stack" aria-label="사망과 선택"><p>${deathAge}세에 세상을 떠났습니다. 원인은 ${future ? '오랜 병' : '노환'}이었습니다.</p><p class="t-muted">살아오며 ${future ? 24 : 21}번의 선택을 했습니다.</p></section>
  <section class="card" aria-labelledby="ending-journey-title"><h2 id="ending-journey-title" class="card__title card__title--gap">출발선에서 마지막까지</h2>
    <div class="journey">
      <div class="journey__bar" role="img" aria-label="${future ? '출발선 하위 33%와 상위 36% 사이, 마지막 상위 약 41%.' : '출발선 하위 40% 안쪽, 마지막 하위 약 46%.'}">
        <div class="journey__track"><span class="journey__band" style="${future ? '--from:33%;--to:64%' : '--from:0%;--to:40%'}"></span><span class="journey__mid"></span><span class="journey__end" style="--at:${future ? 59 : 46}%"></span></div>
        <div class="journey__axis" aria-hidden="true"><span>하위</span><span>상위</span></div></div>
      <dl class="journey__legend">
        <div><dt><i class="journey__key journey__key--band" aria-hidden="true"></i>출발선</dt><dd class="grade-line">${gradeChip(p.grade, { range: p.range })}</dd></div>
        <div><dt><i class="journey__key journey__key--end" aria-hidden="true"></i>마지막</dt><dd><span class="nowrap">${future ? '상위 약 41%' : '하위 약 46%'}</span></dd></div>
      </dl>
      <p>${future ? '<span class="nowrap">하위 33%와</span> <span class="nowrap">상위 36%</span> 사이의 집에서 태어나, <span class="nowrap">상위 약 41%의</span> 형편으로 생을 마쳤습니다.' : '<span class="nowrap">하위 40%</span> <span class="nowrap">안쪽의</span> 집에서 태어나, <span class="nowrap">하위 약 46%의</span> 형편으로 생을 마쳤습니다.'}</p>
      <p>${future ? '출발선과 비슷한 자리입니다.' : '출발선과 비슷한 자리입니다.'}</p><p class="t-xs t-faint">재산은 어릴 때는 집안 형편이고 스무 살부터는 내가 가진 것이라, 숫자를 빼서 견주지 않고 같은 세대 안의 자리로 견주었습니다.</p>
    </div></section>
  <section class="card stack stack--sm ending-stats" aria-labelledby="ending-stats-title"><h2 id="ending-stats-title" class="card__title">최종 스탯</h2>${meter('health', 41)}${meter('happy', 66)}${meter('knowledge', future ? 66 : 44)}${meter('relation', 72)}${finalNet}</section>
  ${compare}
  <section class="card" aria-labelledby="ending-timeline-title"><h2 id="ending-timeline-title" class="card__title card__title--gap">생애 연표</h2>${groups.map(([h, items]) => `<div class="tl-group"><h3>${h}</h3><ol class="timeline">${items.join('')}</ol></div>`).join('')}</section>
  <section class="rebirth"><button class="btn btn--primary btn--lg btn--block" type="button">다시 태어나기</button><p class="t-sm t-muted">첫 화면의 세대 선택으로 돌아갑니다. 다시 태어나면 <span class="keep-phrase">이 인생의</span> 기록은 사라집니다.</p></section>
  <p class="mock-tag">시안 · 가짜 데이터 — 연표 문장은 설계 문서 예시, 확정 전</p>
</main>`;
}
function buildEnding() {
  const body = `${GM3_SPRITE}
${ending('future')}
<template id="state-2010">${ending('2010')}</template>
<script>(function(){var s=new URLSearchParams(location.search).get('state');var t=document.getElementById('state-'+s);if(!t)return;document.querySelector('main.ending').replaceWith(t.content.cloneNode(true));})();</script>`;
  const html = page({ title: '수저 게임 · 시안 · 엔딩 세대 표기·최종 순자산(SPEC-004 GM3)', body, head: '<link rel="stylesheet" href="gm3.css">' })
    .replace('href="../../../src/styles/tokens.css"', 'href="../../../../src/styles/tokens.css"')
    .replace('href="ds.css"', 'href="../ds.css"');
  writeFileSync(`${OUT}ending-004.html`, html);
}

buildTitle();
buildRoulette();
buildDashboard();
buildEnding();
console.log('gm3 mockups →', OUT.replace(ROOT, ''), ['title-004', 'roulette-004', 'dashboard-004', 'ending-004'].join(' · '));
