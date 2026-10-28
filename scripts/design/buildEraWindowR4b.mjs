/**
 * SPEC-009 「시대의 창」 r4b — 세 곳 보강 전·후 비교 시트 (designer 2026-10-28).
 *
 * 형진 님 결정(2026-10-28 「세 곳 더 현실적으로 후 승인」): r4 27장 가운데 ① 1961 새벽 거리의 탱크(멀리서 바라보는 출근길 시민) ② 1958 보릿고개(빈 밥상과 나물 캐는 아이들)
 * ③ 계층 변주 아래쪽(1970년대 셋방 · 1980년대 반지하 — 습기 자국·곰팡이 얼룩·쌓인 이불·창 밖 행인의 발)만 고친다. 나머지 24장은 승인(표기는 마스터).
 * 고친 그림은 r4 장면 파일(`eraR4Scenes50/60/Band.mjs`)에 바로 들어가 있고 조각 `pieces/era-r4/*.svg`는 `buildEraWindowR4.mjs`가 다시 쓴다. 이 시트는 보강 **전**(`eraR4bBefore.mjs` 사본)과 **후**를 나란히 둔다.
 *
 * 실행: node scripts/design/buildEraWindowR4.mjs && node scripts/design/buildEraWindowR4b.mjs
 * 산출: docs/design/mockups/family/era-window-r4b.html · era-window-r4b-budget.json. 의존성 없음(Node 내장만). `src/`는 읽지 않는다.
 */
import { gzipSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ERA_DEFS_R3, FIG_DEFS, tokenCss, toClass, decadeOf, toneLayer, toneCssA } from './eraR4Lib.mjs';
import { SCENES } from './eraR4Scenes.mjs';
import { BEFORE } from './eraR4bBefore.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const OUT = ROOT + 'docs/design/mockups/family/';
const write = (f, s) => writeFileSync(OUT + f, s.replace(/\r\n/g, '\n'), 'utf8');
const TONE_ID = 'a';
const gz = (s) => gzipSync(Buffer.from(s, 'utf8')).length;
const DEFS = ERA_DEFS_R3 + FIG_DEFS;

/** 보강한 세 곳(네 장) — 순서는 형진 님 결정 순 */
const FIX = [
  { id: 'era-1961-dawn-tank', place: '① 1961 새벽 거리의 탱크', ask: '멀리서 탱크를 바라보는 출근길 시민을 넣는다(얼굴 식별 없음, 먼 인물·뒷모습).',
    changed: ['오른쪽 앞 보도(연석 띠)에 출근길 시민 셋 — 가방 멘 남자(모자)·보따리 인 여자(머릿수건)·도시락 든 사람, 모두 뒷모습으로 탱크 쪽을 본다', '그 옆에 세워 둔 자전거 한 대', '멀리 왼쪽 상가 앞 보도에 멈춰 선 두 사람(먼 인물)', '앞줄 군인 열을 안쪽으로 당겨 시민과 사이를 띄웠다(접촉 0)'],
    kept: '탱크 포신은 위로, 군인은 뒷모습·철모, 글자·상징 0, 한 줄 그대로.' },
  { id: 'era-1958-barley-spring', place: '② 1958 보릿고개', ask: '들판에 더해 보리밥도 모자란 빈 밥상과 나물 캐는 아이들까지 생활 안쪽을 그린다. 굶주림을 희화화하거나 몸을 과장하지 않는다.',
    changed: ['왼쪽에 초가 툇마루의 모퉁이 — 할머니와 아이가 앉은 작은 밥상, 안이 보이는 빈 그릇 둘과 나물죽 한 그릇, 숟가락, 댓돌의 고무신', '앞 들에 호미로 나물 캐는 아이 둘(쪼그림·바구니)과 바가지 든 아이', '들에서 바구니를 들고 돌아오는 어머니(머릿수건)', '멀리 나물 캐는 여인과 둑길의 지게꾼은 남김', '한 줄을 그림에 맞춰 「보릿고개에는 나물로 끼니를 이었습니다.」(21자)로 — 이전 「봄이면 보리가 익기를 기다렸습니다.」'],
    kept: '몸은 다른 장면과 같은 비례(마르게 과장 0), 얼굴 0, 글자 0.' },
  { id: 'era-1970s-low-kerosene-room', place: '③ 계층 변주 아래 — 1970년대 셋방', ask: '그 집의 현실을 더한다. 조롱·낙인·불결 강조는 없고, 정돈하려 애쓴 살림이라는 결은 유지.',
    changed: ['부엌 벽 — 창 밑으로 물 흐른 습기 자국 한 줄, 바닥 가까운 옅은 얼룩 셋', '방 벽 — 벽지 폭 이음새 셋과 덧바른 자리 한 곳', '이불을 세 채로 높이 개어 쌓고 베개·보따리', '문지방 옆 연탄 두 장, 가지런한 신발'],
    kept: '곤로·찬장·상·숙제하는 아이·옷걸이는 그대로. 자국은 모두 불투명도 0.3 안팎.' },
  { id: 'era-1980s-low-banjiha-room', place: '③ 계층 변주 아래 — 1980년대 반지하', ask: '반지하 벽의 습기 자국, 곰팡이 얼룩, 좁은 방에 쌓인 이불, 창 밖 행인의 발 등.',
    changed: ['창턱 아래 물 흐른 습기 자국 셋, 벽 아래 번진 자국', '오른쪽 위 구석의 곰팡이 얼룩(작은 점 아홉, 불투명도 0.24)', '이불 네 채 + 베개로 더 높이, 보따리 하나', '창 밖 — 아이의 다리 한 쌍을 더해 셋, 골목 바닥의 하수구', '창턱의 화분 하나, 문가의 가지런한 신발 두 켤레'],
    kept: '연탄난로·책 더미·밥상의 아이·개는 그대로. 얼룩은 구석 하나뿐이고 바닥·이불·상은 깨끗하다.' },
];
const byId = Object.fromEntries(SCENES.map((q) => [q.id, q]));
for (const x of FIX) { if (!byId[x.id]) throw new Error(`장면 없음: ${x.id}`); if (!BEFORE[x.id]) throw new Error(`전 사본 없음: ${x.id}`); }

const svgOf = (markup, year) => `<svg viewBox="0 0 40 32" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">${toClass(markup + toneLayer(TONE_ID, year))}</svg>`;
const pic = (markup, q, size, cls = '') => `<div class="ew__pic ${cls}" data-dec="${decadeOf(q.year)}" data-size="${size}">${svgOf(markup, q.year)}</div>`;
const rows = FIX.map((x) => {
  const q = byId[x.id];
  const after = toClass(q.draw() + toneLayer(TONE_ID, q.year));
  const before = toClass(BEFORE[x.id].draw() + toneLayer(TONE_ID, q.year));
  if (/[A-Za-z가-힣0-9]/.test(after.replace(/<[^>]+>/g, ''))) throw new Error(`그림 안 글자: ${x.id}`);
  return { id: x.id, place: x.place, year: q.year, name: q.name, line: q.line, lineChars: q.line.length, heavy: !!q.heavy, band: q.band || null, gzBefore: gz(before), gzAfter: gz(after), limit: q.heavy ? 3500 : 2500, draws: q.draws, ft3: q.ft3, changed: x.changed, kept: x.kept, ask: x.ask };
});
write('era-window-r4b-budget.json', JSON.stringify({ measuredAt: '2026-10-28', round: 'r4b', note: '세 곳 보강(네 장) 전·후 gzip(그림 안쪽 마크업 + 톤 겹, class·use). 예산 장당 ≤ 2.5KB(무거운 장면 ≤ 3.5KB). 27장 전체 실측은 era-window-r4-budget.json(다시 잼).', rows }, null, 2) + '\n');

const section = (x) => {
  const q = byId[x.id]; const r = rows.find((k) => k.id === x.id);
  return `<section class="fx" data-era="${x.id}" data-heavy="${!!q.heavy}" data-band="${q.band || ''}">
<h2>${x.place}</h2>
<p class="ew__note"><b>요청</b> ${x.ask}</p>
<div class="fx__row">
<figure class="ew__fig fx__before">${pic(BEFORE[x.id].draw(), q, 'pc')}<figcaption class="ew__cap"><span class="ew__year">전 — r4(커밋 db20523)</span><span class="fx__draws">${BEFORE[x.id].draws}</span></figcaption></figure>
<figure class="ew__fig fx__after">${pic(q.draw(), q, 'pc')}<figcaption class="ew__cap"><span class="ew__year">후 — r4b</span><span class="fx__draws">${q.draws}</span></figcaption></figure>
<figure class="ew__fig fx__zoom">${pic(q.draw(), q, 'zoom')}<figcaption class="ew__cap"><span class="ew__year">후 — 크게 보기 350×280(확인용)</span></figcaption></figure>
<div class="fx__text">
<p class="fx__name">${q.name}${q.band ? ' <span class="ew__band">수저 구간 · 아래 둘(흙수저 쪽)</span>' : ''}${q.heavy ? ' <span class="ew__heavy">무거운 장면 · 가리기 설정 대상(기본 꺼짐)</span>' : ''}</p>
<p><b>고친 것</b></p><ul>${x.changed.map((c) => `<li>${c}</li>`).join('')}</ul>
<p><b>지킨 것</b> ${x.kept}</p>
<p class="ew__ft3">${q.ft3}</p>
<p class="ew__note">한 줄 「${q.line}」(${q.line.length}자) · gzip 전 ${r.gzBefore.toLocaleString('ko-KR')}B → 후 <strong>${r.gzAfter.toLocaleString('ko-KR')}B</strong>(상한 ${r.limit.toLocaleString('ko-KR')}B${r.gzAfter > r.limit ? ' · 초과' : ' 안'})</p>
</div>
</div>
</section>`;
};

const html = `<!doctype html>
<html lang="ko" data-paper="1">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>수저 게임 · 시안 · 시대의 창 r4b — 세 곳 보강 전·후(SPEC-009)</title>
<!-- 시안(정적 HTML) — SPEC-009 시대의 창 r4b. 형진 님 결정(2026-10-28 「세 곳 더 현실적으로 후 승인」)으로 r4 27장 가운데 네 장만 고친 전·후 비교. 생성 scripts/design/buildEraWindowR4b.mjs · ?theme=dark 다크. 외부 자원 0. 그림은 모두 새로 구성(사진 모사 없음, 얼굴 식별 없음). -->
<link rel="stylesheet" href="../../../../src/styles/tokens.css">
<link rel="stylesheet" href="../ds.css">
<link rel="stylesheet" href="../gm3/gm3.css">
<link rel="stylesheet" href="family.css">
<script>(function(){var q=new URLSearchParams(location.search);var t=q.get('theme');if(t==='dark'||t==='light')document.documentElement.setAttribute('data-theme',t);if(q.get('motion')==='reduce')document.documentElement.setAttribute('data-motion','reduce');})();</script>
<style>
.ew { max-width: 1120px; margin: 0 auto; padding: var(--sp-6) var(--gutter) var(--sp-10); }
.ew h1 { font-size: var(--fs-2xl); line-height: var(--lh-snug); margin: 0 0 var(--sp-2); }
.ew h2 { font-size: var(--fs-xl); margin: var(--sp-8) 0 var(--sp-2); }
.ew__lead, .ew__note { margin: 0 0 var(--sp-4); color: var(--c-text-2); max-width: 72ch; }
.ew__lead { font-size: var(--fs-md); color: var(--c-text); }
.ew__note b { color: var(--c-text); }
.ew a { color: var(--c-brand); text-decoration: underline; text-underline-offset: 2px; }
.ew__fig { margin: 0; min-width: 0; }
.ew__pic { aspect-ratio: 5 / 4; overflow: hidden; background: var(--c-scene-sky); }
.ew__pic[data-size="pc"] { width: 175px; height: 140px; }
.ew__pic[data-size="zoom"] { width: 350px; height: 280px; max-width: 100%; }
.ew__pic[data-size="mobile"] { width: 100px; height: 80px; }
.ew__pic svg { display: block; width: 100%; height: 100%; forced-color-adjust: none; }
.ew__cap { display: grid; gap: 2px; margin: 0 0 var(--sp-2); font-size: var(--fs-sm); line-height: var(--lh-normal, 1.5); color: var(--c-text); word-break: keep-all; }
.ew__year { font-weight: var(--fw-bold); font-variant-numeric: tabular-nums; }
.ew__name, .ew__kind { color: var(--c-text-2); }
.ew__heavy { color: var(--c-era); font-weight: var(--fw-bold); }
.ew__band { color: var(--c-brand); font-weight: var(--fw-bold); }
.ew__ft3 { color: var(--c-text-2); font-size: var(--fs-sm); line-height: 1.5; margin: 0 0 var(--sp-2); }
.ew__ft3::before { content: '유지선 · '; color: var(--c-text); font-weight: var(--fw-bold); }
/* 전 · 후 · 크게 · 글 — 한 줄(PC 1024~, 그림 세 칸 + 글 한 칸이 폭을 다 쓴다), 태블릿은 그림 두 칸, 휴대폰은 쌓기. 그림이 먼저, 설명은 그림 아래 — 전·후의 윗선이 맞는다 */
.fx__row { display: grid; grid-template-columns: 175px 175px 350px minmax(0, 1fr); gap: var(--sp-4) var(--sp-6); align-items: start; }
.ew__cap .fx__draws { font-weight: var(--fw-regular); color: var(--c-text-2); }
.fx__before .ew__cap, .fx__after .ew__cap { width: 175px; max-width: 100%; margin: var(--sp-2) 0 0; }
.fx__zoom .ew__cap { margin: var(--sp-2) 0 0; }
.fx__text { min-width: 0; font-size: var(--fs-sm); line-height: 1.6; }
.fx__text p { margin: 0 0 var(--sp-2); }
.fx__name { font-weight: var(--fw-bold); color: var(--c-text); }
.fx__text ul { margin: 0 0 var(--sp-3); padding-left: 1.2em; }
.fx__text li { margin: 0 0 2px; }
@media (max-width: 1023px) { .fx__row { grid-template-columns: 175px 175px minmax(0, 1fr); } .fx__text { grid-column: 1 / -1; } }
@media (max-width: 767px) { .fx__row { grid-template-columns: repeat(2, 175px); } .fx__zoom { grid-column: 1 / -1; } }
@media (max-width: 419px) { .fx__row { grid-template-columns: minmax(0, 1fr); } .fx__zoom { grid-column: auto; } }
.ew__strip { display: flex; flex-wrap: wrap; gap: var(--sp-2); }
.ew table { border-collapse: collapse; width: 100%; font-size: var(--fs-sm); }
.ew th, .ew td { text-align: left; padding: var(--sp-2) var(--sp-2) var(--sp-2) 0; border-bottom: 1px solid var(--c-border); vertical-align: top; }
.ew td.num, .ew th.num { text-align: right; font-variant-numeric: tabular-nums; padding-right: 0; white-space: nowrap; }
.ew__tablewrap { overflow-x: auto; }
@media (forced-colors: active) { .ew__pic { border: 1px solid CanvasText; } }
${toneCssA('.ew')}
${tokenCss()}
</style>
</head>
<body>
<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><defs>${DEFS}</defs></svg>
<main class="ew">
<h1>시대의 창 r4b — 세 곳 보강 전·후</h1>
<p class="ew__lead">형진 님 결정(2026-10-28 「세 곳 더 현실적으로 후 승인」)으로 4차 스물일곱 장 가운데 네 장만 고쳤습니다. 1961 새벽 거리에는 멀리서 바라보는 출근길 시민, 1958 보릿고개에는 마루의 빈 밥상과 나물 캐는 아이들, 1970년대 셋방과 1980년대 반지하에는 습기 자국·곰팡이 얼룩·쌓인 이불·창 밖 행인의 발 같은 그 집의 현실을 더했습니다. 조롱·낙인·불결 강조는 두지 않았고 사람은 모두 뒷모습·옆모습·먼 인물입니다. 나머지 스물세 장(승인된 1950 피란 포함 스물네 장)은 손대지 않았습니다.</p>
<nav class="cmp__links" aria-label="보기" style="display:flex;flex-wrap:wrap;gap:var(--sp-3);font-size:var(--fs-sm);margin:0 0 var(--sp-6)"><a href="era-window-r4b.html">라이트</a><a href="era-window-r4b.html?theme=dark">다크</a><a href="era-window-r4.html">4차 시트(27장 — 고친 조각이 들어간 상태)</a></nav>
${FIX.map(section).join('\n')}

<h2>휴대폰 띠 크기 100×80 — 고친 네 장</h2>
<p class="ew__note">휴대폰에서는 집 그림 아래 띠의 왼쪽에 이 크기로 놓입니다. 더한 것(시민·밥상·자국)이 이 크기에서도 그림을 어지럽히지 않는지 보는 줄입니다.</p>
<div class="ew__strip">${FIX.map((x) => `<figure class="ew__fig"><figcaption class="ew__cap"><span class="ew__year">${byId[x.id].band ? `${byId[x.id].years[0]}년대` : `${byId[x.id].year}년`}</span></figcaption>${pic(byId[x.id].draw(), byId[x.id], 'mobile')}</figure>`).join('')}</div>

<h2>실측</h2>
<div class="ew__tablewrap"><table><thead><tr><th scope="col">그림</th><th scope="col">한 줄</th><th scope="col" class="num">자</th><th scope="col" class="num">gzip 전</th><th scope="col" class="num">gzip 후</th><th scope="col" class="num">상한</th></tr></thead><tbody>${rows.map((r) => `<tr><td>${r.place}</td><td>${r.line}</td><td class="num">${r.lineChars}</td><td class="num">${r.gzBefore.toLocaleString('ko-KR')}B</td><td class="num">${r.gzAfter.toLocaleString('ko-KR')}B</td><td class="num">${r.limit.toLocaleString('ko-KR')}B${r.gzAfter > r.limit ? ' 초과' : ''}</td></tr>`).join('')}</tbody></table></div>
<p class="ew__note">네 장 모두 장당 상한 안입니다. 27장 전체 실측은 다시 돌린 <code>era-window-r4-budget.json</code>(10년 덩어리 1950년대 12,837B · 1960년대 13,927B · 1970년대 13,347B · 1980년대 17,505B — 모두 24KB 안).</p>
</main>
</body>
</html>
`;
write('era-window-r4b.html', html);
console.log('시대의 창 r4b:', rows.map((r) => `${r.id} ${r.gzBefore}→${r.gzAfter}B${r.gzAfter > r.limit ? ' !!상한' : ''}`).join(' · '));
