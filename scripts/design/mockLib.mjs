/**
 * 시안 HTML 생성 도우미 (SPEC-003 DS6, designer). 가짜 데이터로 정적 HTML을 만든다.
 * 실행은 buildMockups.mjs가 한다: node scripts/design/buildMockups.mjs
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { faceSvg } from '../../src/assets/faces/faceLayers.ts';
import { spoonPath } from './brandSymbols.mjs';

export const ROOT = fileURLToPath(new URL('../../', import.meta.url));
export const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** 시안 전체가 쓰는 기본 심볼 안. 형진 님이 고르면(C2) 이 값만 바꿔 다시 만든다. */
export const DEFAULT_KEY = 'a';

// ---------- 수저 5단계 아이콘 (심볼과 같은 숟가락 비례, 20×32 격자) ----------
/**
 * 규칙(SPEC-003 「확정 뒤 추가 결정」 수저 아이콘, REV-003-D-2 R-121 마스터 개입):
 *   - 숟가락 머리 안에 **선(stroke) 무늬를 두지 않는다 — 모든 크기.** 단계 구분은 ① 재질 색(면 채움) ② 이름 ③ 점 개수(1~5)가 맡는다.
 *   - **칩 변형 `sp-N`(≤ 24px: 칩·릴·프로필·서류)**: 무늬 없는 숟가락 **실루엣** 한 덩어리, `currentColor` 채움뿐. **강제 색상·단색에서도 외곽선으로
 *     바꾸지 않는다**(REV-003-D-3 R-190: 자루 폭이 선 굵기와 같아 외곽선은 ⚲·열쇠·돋보기로 읽힌다) — 칩은 CanvasText(currentColor)로 채운 실루엣이고,
 *     단계는 이름 + 점이 전한다. 그래서 stroke 속성·외곽선 변수가 아예 없다. **수저 아이콘은 이름·점 없이 단독으로 쓰지 않는다.**
 *   - **큰 변형 `sp-N-lg`(≥ 32px: 첫 화면 다섯 자루 띠·컴포넌트판·큰 결과)**: 실루엣 + **닫힌 채움 도형 표식**만. 원 안의 대각선·가로선·점 배열처럼
 *     기존 기호(⊘·⊜·⊖·⊙)로 읽힐 모양은 쓰지 않는다.
 *       1 흙: 테두리 머리(구멍) 안에 **담긴 흙 더미**(아래를 채운 봉긋한 면)   2 동: 꽉 찬 머리, 표식 없음(광택 없는 무광 금속)
 *       3 은: 꽉 찬 머리 + 왼쪽 위 테두리를 따라 **가는 초승달꼴 광택**(밝은 채움)   4 금: 꽉 찬 머리 + 작은 하이라이트 점(밝은 채움, 중심을 비킴)
 *       5 다이아몬드: 꽉 찬 머리 + 마름모 커팅(구멍)
 *     은·금의 광택은 구멍(evenodd)이 아니라 **흰빛 채움**(`fill="#fff" style="fill:var(--sp-mark,#fff)"`)이다 — 구멍이면 다크 테마에서 바탕이 비쳐 광택이
 *     「어두운 흠」으로 뒤집혀 보인다(REV-003-D-3 관찰). 흰빛은 두 테마 모두 몸체보다 밝다. 강제 색상에서는 tokens.css가 `--sp-mark: Canvas`로 두어
 *     검은 글자·흰 글자 두 극성 모두 CanvasText 몸체 위에 바탕색 표식이 남는다(REV-003-D-4 관찰 (a)). 변수를 style로만 두는 까닭은 아래 MARK_ATTR 주석.
 *     표식은 모두 닫힌(Z) 부경로이고 fill만 쓴다(tests/designAssets.test.ts가 단언).
 * 자루 길이는 머리 높이의 1.15배(작은 크기에서도 숟가락으로 읽힘). 목 보조점은 머리 폭 비율이라 viewBox(0~20) 안에 든다(R-120).
 * 실제 크기 확인: docs/design/screens/003/spoon-sizes-dpr1.png (scripts/design/shootSpoonSizes.mjs, DPR 1).
 */
export const SPOON_ICON = { cx: 10, top: 1.2, w: 11.6, h: 12.6, neck: 1.7, neckLen: 2.2, handleLen: 14.6, endW: 3.8 };
const SPOON_OUTER = spoonPath(SPOON_ICON);
const BOWL_CY = SPOON_ICON.top + SPOON_ICON.h * 0.47;
const r1 = (v) => Math.round(v * 100) / 100;
const rad = (deg) => (deg * Math.PI) / 180;
/** 타원 호를 3차 베지어(C)로 — 좌표가 모두 절대 M·C라 pathPoints()로 경계 점검이 된다 */
function ellipseArc(cx, cy, rx, ry, a0, a1) {
  const n = Math.max(1, Math.ceil(Math.abs(a1 - a0) / 90));
  const step = (a1 - a0) / n;
  const k = (4 / 3) * Math.tan(rad(step) / 4);
  let d = '';
  for (let i = 0; i < n; i++) {
    const t0 = rad(a0 + step * i);
    const t1 = rad(a0 + step * (i + 1));
    const p0 = [cx + rx * Math.cos(t0), cy + ry * Math.sin(t0)];
    const p3 = [cx + rx * Math.cos(t1), cy + ry * Math.sin(t1)];
    const p1 = [p0[0] - k * rx * Math.sin(t0), p0[1] + k * ry * Math.cos(t0)];
    const p2 = [p3[0] + k * rx * Math.sin(t1), p3[1] - k * ry * Math.cos(t1)];
    d += `C${r1(p1[0])} ${r1(p1[1])} ${r1(p2[0])} ${r1(p2[1])} ${r1(p3[0])} ${r1(p3[1])}`;
  }
  return d;
}
const ellipseClosed = (cx, cy, rx, ry) => `M${r1(cx + rx)} ${r1(cy)}${ellipseArc(cx, cy, rx, ry, 0, 360)}Z`;
const BOWL_HOLE = ellipseClosed(SPOON_ICON.cx, BOWL_CY, 4.0, 4.5);
const GOLD_SHINE = ellipseClosed(SPOON_ICON.cx - 2.0, BOWL_CY - 2.3, 1.2, 0.9);
const DIAMOND_CUT = `M10 ${r1(BOWL_CY - 3.0)}L${r1(10 + 2.5)} ${r1(BOWL_CY)}L10 ${r1(BOWL_CY + 3.0)}L${r1(10 - 2.5)} ${r1(BOWL_CY)}Z`;
/** 흙 더미: 머리 구멍(타원 rx 4, ry 4.5)의 아래쪽을 채우는 닫힌 면. 윗선은 왼쪽으로 치우친 봉우리 하나의 완만한 곡선, 아래는 구멍 테두리를 따른다 */
const SOIL_MOUND = (() => {
  const cx = SPOON_ICON.cx;
  const rx = 4.0;
  const ry = 4.5;
  const px = (deg) => r1(cx + rx * Math.cos(rad(deg)));
  const py = (deg) => r1(BOWL_CY + ry * Math.sin(rad(deg)));
  // 왼쪽 가장자리(θ=168°)에서 봉우리(왼쪽 위)로 올라갔다가 오른쪽 가장자리(θ=14°)까지 길게 내려온다 → 타원 아래 호(14°→168°)를 따라 돌아온다
  return `M${px(168)} ${py(168)}C${r1(cx - 3.2)} ${r1(BOWL_CY - 2.3)} ${r1(cx - 1.4)} ${r1(BOWL_CY - 2.9)} ${r1(cx - 0.4)} ${r1(BOWL_CY - 2.0)}C${r1(cx + 0.8)} ${r1(BOWL_CY - 1.0)} ${r1(cx + 2.6)} ${r1(BOWL_CY - 0.2)} ${px(14)} ${py(14)}${ellipseArc(cx, BOWL_CY, rx, ry, 14, 168)}Z`;
})();
/** 은 광택: 머리 테두리 안쪽(rx 4.6·ry 5.1)의 왼쪽 위 짧은 호(200°→262°, 약 60°)를 바깥선으로, 안쪽선은 중심 쪽으로 살짝 부푼 곡선 하나 — 양 끝이 뾰족한 가는 빛 조각.
 *  가장자리에 닿지 않고 곧은 선이 아니라 ⊘·⊖으로 읽히지 않고, 호를 짧게 해 단색에서 달(☾)로 보이지 않게 한다 */
const SILVER_SHEEN = (() => {
  const cx = SPOON_ICON.cx;
  const rx = 4.6;
  const ry = 5.1;
  const a0 = 200;
  const a1 = 262;
  const P = (deg) => [cx + rx * Math.cos(rad(deg)), BOWL_CY + ry * Math.sin(rad(deg))];
  const [x0, y0] = P(a0);
  const [x1, y1] = P(a1);
  // 안쪽선: 끝점에서 중심으로 0.4만큼 당긴 제어점 → 가운데 두께 약 1.5
  const pull = 0.4;
  const c1 = [x1 + (cx - x1) * pull, y1 + (BOWL_CY - y1) * pull];
  const c2 = [x0 + (cx - x0) * pull, y0 + (BOWL_CY - y0) * pull];
  return `M${r1(x0)} ${r1(y0)}${ellipseArc(cx, BOWL_CY, rx, ry, a0, a1)}C${r1(c1[0])} ${r1(c1[1])} ${r1(c2[0])} ${r1(c2[1])} ${r1(x0)} ${r1(y0)}Z`;
})();
/** 칩 변형: 실루엣 한 덩어리, currentColor 채움뿐(stroke 없음 — 강제 색상·단색에서도 채운 실루엣, R-190) */
const SILHOUETTE = `<path d="${SPOON_OUTER}" fill="currentColor"/>`;
const solidWithHole = (hole) => `<path d="${SPOON_OUTER}${hole}" fill="currentColor" fill-rule="evenodd"/>`;
/**
 * 밝은 표식(은 광택·금 하이라이트): 구멍 대신 몸체 위에 얹는 흰빛 채움. 필요하면 --sp-mark 로 바꾼다(강제 색상에서는 tokens.css가 Canvas로 둔다).
 * 속성에는 고정값 `fill="#fff"`, 변수는 `style="fill:var(--sp-mark,#fff)"`로만 — SVG 프레젠테이션 속성 안의 var()는 일부 엔진(iOS Safari 등)이 무시할 수 있어
 * 표식이 검게(currentColor 상속) 나올 위험이 있다(REV-003-D-4 「확인 못 한 것」). style은 속성보다 우선하므로 지원 엔진에서는 변수가, 아니면 흰빛이 쓰인다.
 * tests/designAssets.test.ts가 「SVG 속성 값에 var( 금지(style 안만 허용)」를 단언한다.
 */
const MARK_ATTR = 'fill="#fff" style="fill:var(--sp-mark,#fff)"';
const solidWithMark = (mark) => `<path d="${SPOON_OUTER}" fill="currentColor"/><path d="${mark}" ${MARK_ATTR}/>`;
export const SPOON_SYMBOLS = {
  1: SILHOUETTE,
  2: SILHOUETTE,
  3: SILHOUETTE,
  4: SILHOUETTE,
  5: SILHOUETTE,
};
/** 큰 변형(≥ 32px): 실루엣 + 닫힌 채움 도형 표식. 흙·다이아는 구멍(바탕이 비치는 것이 뜻: 빈 그릇·커팅), 은·금은 밝은 채움(광택) */
export const SPOON_SYMBOLS_LG = {
  1: `${solidWithHole(BOWL_HOLE)}<path d="${SOIL_MOUND}" fill="currentColor"/>`,
  2: `<path d="${SPOON_OUTER}" fill="currentColor"/>`,
  3: solidWithMark(SILVER_SHEEN),
  4: solidWithMark(GOLD_SHINE),
  5: solidWithHole(DIAMOND_CUT),
};

// ---------- 아이콘 스프라이트 (직접 그린 단순 도형, 24×24 격자) ----------
const ic = (id, body) => `<symbol id="i-${id}" viewBox="0 0 24 24">${body}</symbol>`;
export const SPRITE = `<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><defs>
${ic('pause', '<rect x="6" y="5" width="4" height="14" rx="1.2" fill="currentColor" stroke="none"/><rect x="14" y="5" width="4" height="14" rx="1.2" fill="currentColor" stroke="none"/>')}
${ic('play', '<path d="M8 5.5v13l10.5-6.5z" fill="currentColor" stroke="none"/>')}
${ic('next', '<path d="M4 6l8 6-8 6zM12 6l8 6-8 6z" fill="currentColor" stroke="none"/>')}
${ic('auto', '<path d="M20 11a8 8 0 0 0-14.5-4.2M4 13a8 8 0 0 0 14.5 4.2"/><path d="M18.5 3v4.5H14M5.5 21v-4.5H10"/>')}
${ic('music', '<path d="M9 18V5l11-2v13"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>')}
${ic('pencil', '<path d="M4 20l1-4.5L16.5 4a2 2 0 0 1 3 3L8 18.5z"/><path d="M14.5 6l3 3"/>')}
${ic('moon', '<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5z"/>')}
${ic('sun', '<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6L7 7M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4"/>')}
${ic('message', '<path d="M4 5h16v11H10l-5 4v-4H4z"/>')}
${ic('exit', '<path d="M10 4H5v16h5"/><path d="M14 8l4 4-4 4M18 12H9"/>')}
${ic('prev', '<path d="M15 5l-7 7 7 7"/>')}
${ic('forward', '<path d="M9 5l7 7-7 7"/>')}
${ic('check', '<path d="M5 12.5l4.5 4.5L19 7.5"/>')}
${ic('heart', '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>')}
${ic('smile', '<circle cx="12" cy="12" r="8.5"/><path d="M8.5 14c1 1.6 2.2 2.3 3.5 2.3s2.5-.7 3.5-2.3"/><path d="M9 9.8h.01M15 9.8h.01" stroke-width="3"/>')}
${ic('book', '<path d="M4.5 5.5H10a2 2 0 0 1 2 2V20a2 2 0 0 0-2-2H4.5zM19.5 5.5H14a2 2 0 0 0-2 2V20a2 2 0 0 1 2-2h5.5z"/>')}
${ic('people', '<circle cx="9" cy="8.5" r="3"/><path d="M3.5 19c.4-3.2 2.6-5 5.5-5s5.1 1.8 5.5 5"/><circle cx="17" cy="9.5" r="2.4"/><path d="M16.5 14c2.4 0 3.8 1.5 4.2 4"/>')}
${ic('info', '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 7.6h.01" stroke-width="2.6"/>')}
${[1, 2, 3, 4, 5].map((n) => `<symbol id="sp-${n}" viewBox="0 0 20 32">${SPOON_SYMBOLS[n]}</symbol>`).join('\n')}
${[1, 2, 3, 4, 5].map((n) => `<symbol id="sp-${n}-lg" viewBox="0 0 20 32">${SPOON_SYMBOLS_LG[n]}</symbol>`).join('\n')}
</defs></svg>`;

export const icon = (name, cls = '') => `<svg class="icon ${cls}" aria-hidden="true" focusable="false"><use href="#i-${name}"/></svg>`;
/** 수저 아이콘. lg = 큰 변형(sp-N-lg, 32px 이상에서만) — 칩·릴은 항상 칩 변형(sp-N) */
export const spoon = (n, cls = '', { lg = false } = {}) => `<svg class="spoon ${cls}" aria-hidden="true" focusable="false"><use href="#sp-${n}${lg ? '-lg' : ''}"/></svg>`;

// ---------- 수저 단계 ----------
export const GRADES = {
  1: { name: '흙수저', short: '흙' },
  2: { name: '동수저', short: '동' },
  3: { name: '은수저', short: '은' },
  4: { name: '금수저', short: '금' },
  5: { name: '다이아몬드수저', short: '다이아몬드' },
};
/**
 * 칩 안의 이름 마크업(구현 ui/Grade.tsx와 같다): 가장 긴 이름 「다이아몬드수저」(7글자)에만 낱말 사이 줄바꿈 지점 `<wbr>`을 둔다 — 좁은 칩·릴 칸(글자 150%+·폭 320)에서 「다이아몬드 / 수저」로만 끊기고
 * 칩이 칸 밖으로 넘치지 않는다(R-262 표본). `<wbr>`는 글자를 더하지 않으므로 읽는 이름·복사되는 글자는 「다이아몬드수저」 그대로이고, e2e/intendedBreaks.ts#INTENDED_BREAKS의 유일한 항목이다(QM3-1 (b)).
 * D-05(docs/design/diff-003.md): tests/designAssets.test.ts R-190 정규식이 `<wbr>`를 허용하게 된 뒤(dev-M3-r4) 시안 생성기도 같은 마크업을 쓴다 — 글로만 적는 자리(gradeText)에는 넣지 않는다.
 */
export const gradeNameHtml = (n) => (n === 5 ? '다이아몬드<wbr>수저' : GRADES[n].name);
/**
 * 수저 칩: 아이콘(실루엣) + 이름 + 점 5개 중 N개. range = 수저 구간 글자(`bandLabel(startBandOf(era, wealth))`의 출력, 예 「하위 25% 안쪽」) — 칩 바로 뒤에
 * 「(하위 25% 안쪽)」으로 붙어 글로 적으면 SPEC 형식 「흙수저(하위 25% 안쪽)」이 된다(R-170). 구간은 줄이 길어 칩 밖에 두고 줄바꿈을 허용한다.
 */
export function gradeChip(n, { range = '', lg = false, dots: showDots = true } = {}) {
  const dots = showDots ? [1, 2, 3, 4, 5].map((i) => `<i class="${i <= n ? 'on' : ''}"></i>`).join('') : '';
  return `<span class="grade grade--${n}${lg ? ' grade--lg' : ''}">${spoon(n)}<span>${gradeNameHtml(n)}</span>${showDots ? `<span class="grade__dots" role="img" aria-label="5단계 중 ${n}단계">${dots}</span>` : ''}</span>${range ? `<span class="grade-line__range">(${esc(range)})</span>` : ''}`;
}
/** 글로만 적을 때의 수저 구간 표기: 「흙수저(하위 25% 안쪽)」 — 이름과 괄호 사이를 띄지 않는다(`<wbr>` 없음) */
export const gradeText = (n, range) => `${GRADES[n].name}(${range})`;
/** 룰렛 릴 칸(구현 ui/Grade.tsx size="reel"): 아이콘 + 이름, 점 없음. 이름은 칩과 같은 마크업(「다이아몬드<wbr>수저」 — 폭 320의 릴 칸 79px에서 낱말 단위로만 끊긴다) */
export const reelSpoon = (n) => `<span class="grade grade--reel grade--${n}">${spoon(n)}<span>${gradeNameHtml(n)}</span></span>`;
export const gradeLine = (n, range, opt = {}) => `<span class="grade-line">${gradeChip(n, { range, ...opt })}</span>`;
/**
 * 짧은 쌍 「A · B」(구현 ui/FitPair.tsx, QM2-10 규칙 3): 한 줄에 들어가면 「A · B」, 안 들어가면 기호 없이 A와 B를 따로 줄로. 내용 길이가 판마다 다른 쌍(룰렛 결과 한 줄·출생신고 「29세 · 판매직」·문서 띠 표기)에 쓴다.
 * 보이지 않는 탐침(.fit-pair__probe, CSS content: attr(data-text))으로 한 줄 폭을 재서 칸 폭과 견준다 — 시안은 page()의 흉내 스크립트가 재고(data-a·data-b는 그 스크립트용), 구현은 ResizeObserver로 잰다.
 */
export const fitPair = (a, b) =>
  `<span class="fit-pair" data-split="false" data-a="${esc(a)}" data-b="${esc(b)}"><span class="fit-pair__probe" data-text="${esc(`${a} · ${b}`)}" aria-hidden="true"></span>${esc(a)} · ${esc(b)}</span>`;
/** 첫 화면의 수저 다섯 자루 줄: 큰 숟가락(큰 변형, 32×52) + 이름 (색·표식·이름을 함께) */
export const spoonLineup = () =>
  `<ul class="spoon-lineup" aria-label="수저 다섯 단계: 흙수저, 동수저, 은수저, 금수저, 다이아몬드수저">${[1, 2, 3, 4, 5]
    .map((n) => `<li class="spoon-fig grade--${n}">${spoon(n, 'spoon--lg', { lg: true })}<span class="spoon-fig__name">${n === 5 ? '다이아몬드<br>수저' : GRADES[n].name}</span></li>`)
    .join('')}</ul>`;

// ---------- 영향 표기 ----------
const STEP_WORD = ['', '조금', '크게', '아주 크게'];
export function impact(items) {
  const parts = items.map(([name, dir, n]) => {
    const arrows = (dir === 'up' ? '▲' : '▼').repeat(n);
    const sr = `${name}이(가) ${STEP_WORD[n]} ${dir === 'up' ? '늘어요' : '줄어요'}`;
    return `<span class="impact__item"><span>${name}</span><span class="${dir}" aria-hidden="true">${arrows}</span><span class="sr-only">${sr}</span></span>`;
  });
  return `<span class="impact">${parts.join('')}</span>`;
}

// ---------- 로고 (파일을 그대로 인라인 — 색은 --c-logo 토큰을 따른다) ----------
/**
 * kind: 'row' = 가로 로고(정식 심볼, 첫 화면 데스크톱 108px) / 'stacked' = 세로 로고(첫 화면 모바일) / 'header' = 헤더용(단순화 심볼, 40px)
 */
export function logo(key, kind = 'row', cls = '') {
  const file = kind === 'row' ? `${ROOT}src/assets/logo-${key}.svg` : kind === 'header' ? `${ROOT}src/assets/brand/${key}/logo-header.svg` : `${ROOT}src/assets/brand/${key}/logo-stacked.svg`;
  const raw = readFileSync(file, 'utf-8');
  return raw
    .replace(/<svg ([^>]*?)>/, (_m, attrs) => `<svg ${attrs.replace(/ role="img" aria-label="[^"]*"/, '')} class="logo logo--${kind} ${cls}" role="img" aria-label="수저 게임">`)
    .trim();
}
/** 첫 화면 외 모든 화면의 헤더 로고 (단순화 심볼 + 워드마크, --logo-h-header 40px) */
export const headerLogo = (key = DEFAULT_KEY) => logo(key, 'header');
export function symbolInline(key, cls = '') {
  const raw = readFileSync(`${ROOT}src/assets/symbol-${key}.svg`, 'utf-8');
  return raw.replace(/<svg ([^>]*?)>/, (_m, attrs) => `<svg ${attrs.replace(/ role="img" aria-label="[^"]*"/, '')} class="logo ${cls}" aria-hidden="true">`).trim();
}
export function wordmarkInline(cls = '') {
  const raw = readFileSync(`${ROOT}src/assets/brand/wordmark.svg`, 'utf-8');
  return raw.replace(/<svg ([^>]*?)>/, (_m, attrs) => `<svg ${attrs.replace(/ role="img" aria-label="[^"]*"/, '')} class="logo ${cls}" role="img" aria-label="수저 게임">`).trim();
}

// ---------- 얼굴 ----------
export function face(ageGroup, gender, tier, label, extra = '') {
  return `<div class="face ${extra}">${faceSvg({ ageGroup, gender, tier }, { label })}</div>`;
}

// ---------- 상태 바 ----------
const STAT_META = {
  health: { label: '건강', icon: 'heart' },
  happy: { label: '행복', icon: 'smile' },
  knowledge: { label: '지식', icon: 'book' },
  relation: { label: '관계', icon: 'people' },
};
export function meter(kind, value) {
  const m = STAT_META[kind];
  return `<div class="meter meter--${kind}"><span class="meter__label">${icon(m.icon)}${m.label}</span><div class="meter__track" role="meter" aria-label="${m.label}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${value}"><div class="meter__fill" style="width:${value}%"></div></div><span class="meter__value">${value}</span></div>`;
}

// ---------- 페이지 뼈대 ----------
/** motion: 'reduce'면 <html data-motion="reduce">로 고정한다(움직임 줄이기 전용 시안 — 미디어쿼리와 같은 신호) */
export function page({ title, body, bodyClass = '', lang = 'ko', head = '', motion = '' }) {
  return `<!doctype html>
<html lang="${lang}"${motion === 'reduce' ? ' data-motion="reduce"' : ''}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<!-- 시안(정적 HTML, 가짜 데이터): 디자인 시스템 토큰·컴포넌트 스타일을 그대로 불러 쓴다. 주소 끝에 ?theme=dark 를 붙이면 다크 테마, &motion=reduce 면 움직임 줄이기. -->
<link rel="stylesheet" href="../../../src/styles/tokens.css">
<link rel="stylesheet" href="ds.css">
<script>(function(){var q=new URLSearchParams(location.search);var t=q.get('theme');if(t==='dark'||t==='light')document.documentElement.setAttribute('data-theme',t);if(q.get('motion')==='reduce')document.documentElement.setAttribute('data-motion','reduce');
/* 시안 전용: 다크 테마면 도구 줄의 다크모드 버튼을 켜짐 상태(aria-pressed + 아이콘 달→해)로 보인다. 구현에서는 상태값이 정한다(R-136②). */
document.addEventListener('DOMContentLoaded',function(){var dark=document.documentElement.getAttribute('data-theme')==='dark'||(!document.documentElement.getAttribute('data-theme')&&matchMedia('(prefers-color-scheme: dark)').matches);if(!dark)return;document.querySelectorAll('[data-tool="dark"]').forEach(function(b){b.setAttribute('aria-pressed','true');var u=b.querySelector('use');if(u)u.setAttribute('href','#i-sun');var s=b.querySelector('.sr-only');if(s)s.textContent='켜짐';});});
/* 시안 전용 흉내(구현은 src/ui/barRelease.ts#watchBarRelease): 하단 고정 띠(.bottom-bar)의 실제 높이를 <html>의 --bar-h로 알려 본문 끝 여백·scroll-padding이 따르게 하고(CM10),
   띠가 작은 뷰포트 높이(100svh 탐침)의 절반을 넘으면 <html class="bar-released">로 고정을 푼다(QM2-12, R-240 — innerHeight로 재지 않는다). 디자인 시스템 11절. */
document.addEventListener('DOMContentLoaded',function(){var bar=document.querySelector('.bottom-bar');if(!bar)return;var root=document.documentElement;root.classList.add('has-bottom-bar');var probe=document.createElement('div');probe.setAttribute('aria-hidden','true');probe.style.cssText='position:fixed;top:0;left:0;width:0;height:100svh;visibility:hidden;pointer-events:none';document.body.appendChild(probe);function apply(){var h=bar.offsetHeight;var vh=probe.offsetHeight||root.clientHeight||window.innerHeight;root.style.setProperty('--bar-h',h+'px');root.classList.toggle('bar-released',h>vh*0.5);}apply();if(window.ResizeObserver)new ResizeObserver(apply).observe(bar);window.addEventListener('resize',apply);});
/* 시안 전용 흉내(구현은 src/ui/FitPair.tsx): 짧은 쌍 「A · B」(.fit-pair)가 한 줄에 들어가면 「A · B」, 안 들어가면 기호 없이 두 항목을 따로 줄로(QM2-10 규칙 3). 보이지 않는 탐침(.fit-pair__probe)의 폭을 칸 폭과 견준다 — 글자 크기·칸 폭이 바뀌면 다시 잰다 */
document.addEventListener('DOMContentLoaded',function(){var pairs=document.querySelectorAll('.fit-pair');if(!pairs.length)return;function render(p){var probe=p.querySelector('.fit-pair__probe');if(!probe)return;var split=probe.getBoundingClientRect().width>p.getBoundingClientRect().width+0.5;if(split===(p.getAttribute('data-split')==='true'))return;p.setAttribute('data-split',split?'true':'false');p.classList.toggle('is-split',split);var a=p.getAttribute('data-a')||'',b=p.getAttribute('data-b')||'';while(probe.nextSibling)p.removeChild(probe.nextSibling);if(split){var s1=document.createElement('span');s1.className='fit-pair__item';s1.textContent=a;var s2=document.createElement('span');s2.className='fit-pair__item';s2.textContent=b;p.appendChild(s1);p.appendChild(document.createTextNode(' '));p.appendChild(s2);}else{p.appendChild(document.createTextNode(a+' · '+b));}}function all(){pairs.forEach(render);}all();window.addEventListener('resize',all);if(window.ResizeObserver){var ro=new ResizeObserver(all);pairs.forEach(function(p){ro.observe(p);});}});})();</script>
${head}
</head>
<body class="${bodyClass}">
${SPRITE}
${body}
</body>
</html>
`;
}

export const MOCK_TAG = '<p class="mock-tag">시안 · 가짜 데이터</p>';
