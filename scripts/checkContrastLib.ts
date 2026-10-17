/**
 * 색 토큰 대비 점검 — 계산 부분 (SPEC-003 DS3, designer). 새 의존성 없이 WCAG 2.x 상대 휘도 식으로 계산한다.
 * 입출력(파일 읽기·보고서 쓰기·종료 코드)은 scripts/checkContrast.ts 가 한다. 이 파일은 순수 함수라 tests에서 바로 부를 수 있다.
 *
 * 점검 대상: src/styles/tokens.css 의 색 토큰 쌍(글자↔바탕, 컨트롤 경계·아이콘·바↔바탕, 얼굴 선·머리↔피부).
 * 기준: 본문 글자 4.5:1, 큰 글자·UI 구성요소·의미 있는 그래픽 3:1 (WCAG 1.4.3, 1.4.11). 두 테마(라이트·다크) 모두.
 * 강제 색상(고대비) 모드는 시스템 색을 쓰므로 계산 대상이 아니다 — 모양(테두리 굵기·무늬·글자)으로 구분하는지는 시안으로 본다.
 */

export type Rgb = readonly [number, number, number];

export function parseHex(hex: string): Rgb {
  const h = hex.trim().replace(/^#/, '');
  if (!/^[0-9a-fA-F]{3}$|^[0-9a-fA-F]{6}$/.test(h)) throw new Error(`hex 색이 아니다: ${hex}`);
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  return [parseInt(full.slice(0, 2), 16), parseInt(full.slice(2, 4), 16), parseInt(full.slice(4, 6), 16)];
}

const lin = (v: number): number => {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
};

/** 상대 휘도 (0~1) */
export function luminance(rgb: Rgb): number {
  return 0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2]);
}

/** 두 색의 대비율 (1~21) */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** fg를 alpha(0~1)로 bg 위에 얹은 색 */
export function blend(fg: Rgb, bg: Rgb, alpha: number): Rgb {
  return [0, 1, 2].map((i) => Math.round(fg[i] * alpha + bg[i] * (1 - alpha))) as unknown as Rgb;
}

// ---------- 색차 (뜻이 다른 토큰이 같은 색으로 보이지 않는지 — REV-003-D-3 R-192) ----------

export type Lab = readonly [number, number, number];

/** sRGB → CIE L*a*b* (D65 백색점). 대비 계산과 같은 선형화 식을 쓴다 */
export function rgbToLab(rgb: Rgb): Lab {
  const [r, g, b] = [lin(rgb[0]), lin(rgb[1]), lin(rgb[2])];
  const X = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047;
  const Y = r * 0.2126 + g * 0.7152 + b * 0.0722;
  const Z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
  const f = (t: number): number => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const [fx, fy, fz] = [f(X), f(Y), f(Z)];
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

/**
 * CIEDE2000 색차(Sharma·Wu·Dalal 2005의 식, 가중치 kL = kC = kH = 1).
 * 눈금: 1 이하 거의 구별 못 함, 2~10 나란히 두면 다름, 10 넘으면 따로 봐도 다른 색. 지적 당시(REV-003-D-3 R-192) 행복↔동수저는 3.5, 다크 건강↔▼는 2.9였다.
 */
export function deltaE2000Lab(lab1: Lab, lab2: Lab): number {
  const [L1, a1, b1] = lab1;
  const [L2, a2, b2] = lab2;
  const d2r = Math.PI / 180;
  const r2d = 180 / Math.PI;
  const C1 = Math.hypot(a1, b1);
  const C2 = Math.hypot(a2, b2);
  const Cbar = (C1 + C2) / 2;
  const G = 0.5 * (1 - Math.sqrt(Cbar ** 7 / (Cbar ** 7 + 25 ** 7)));
  const a1p = (1 + G) * a1;
  const a2p = (1 + G) * a2;
  const C1p = Math.hypot(a1p, b1);
  const C2p = Math.hypot(a2p, b2);
  const hue = (a: number, b: number): number => {
    if (a === 0 && b === 0) return 0;
    const h = Math.atan2(b, a) * r2d;
    return h < 0 ? h + 360 : h;
  };
  const h1p = hue(a1p, b1);
  const h2p = hue(a2p, b2);
  const dL = L2 - L1;
  const dC = C2p - C1p;
  let dh: number;
  if (C1p * C2p === 0) dh = 0;
  else if (Math.abs(h2p - h1p) <= 180) dh = h2p - h1p;
  else dh = h2p - h1p > 180 ? h2p - h1p - 360 : h2p - h1p + 360;
  const dH = 2 * Math.sqrt(C1p * C2p) * Math.sin((dh / 2) * d2r);
  const Lbar = (L1 + L2) / 2;
  const Cbarp = (C1p + C2p) / 2;
  let hbar: number;
  if (C1p * C2p === 0) hbar = h1p + h2p;
  else if (Math.abs(h1p - h2p) <= 180) hbar = (h1p + h2p) / 2;
  else hbar = h1p + h2p < 360 ? (h1p + h2p + 360) / 2 : (h1p + h2p - 360) / 2;
  const T = 1 - 0.17 * Math.cos((hbar - 30) * d2r) + 0.24 * Math.cos(2 * hbar * d2r) + 0.32 * Math.cos((3 * hbar + 6) * d2r) - 0.2 * Math.cos((4 * hbar - 63) * d2r);
  const dTheta = 30 * Math.exp(-(((hbar - 275) / 25) ** 2));
  const RC = 2 * Math.sqrt(Cbarp ** 7 / (Cbarp ** 7 + 25 ** 7));
  const SL = 1 + (0.015 * (Lbar - 50) ** 2) / Math.sqrt(20 + (Lbar - 50) ** 2);
  const SC = 1 + 0.045 * Cbarp;
  const SH = 1 + 0.015 * Cbarp * T;
  const RT = -Math.sin(2 * dTheta * d2r) * RC;
  return Math.sqrt((dL / SL) ** 2 + (dC / SC) ** 2 + (dH / SH) ** 2 + RT * (dC / SC) * (dH / SH));
}

/** 두 sRGB 색의 CIEDE2000 색차 */
export function deltaE2000(a: Rgb, b: Rgb): number {
  return deltaE2000Lab(rgbToLab(a), rgbToLab(b));
}

/** CIE 명도 L* (0 검정 ~ 100 흰색). 상태 4색의 이웃 쌍 명도 차(REV-003-D-4 R-195: ΔL* ≥ 12)를 잴 때 쓴다 */
export function lightness(rgb: Rgb): number {
  return rgbToLab(rgb)[0];
}

/** HSL 색상 각도(0~360). 채도가 0이면 -1 */
export function hueOf(rgb: Rgb): number {
  const [R, G, B] = [rgb[0] / 255, rgb[1] / 255, rgb[2] / 255];
  const max = Math.max(R, G, B);
  const min = Math.min(R, G, B);
  if (max === min) return -1;
  const d = max - min;
  const h = max === R ? (G - B) / d + (G < B ? 6 : 0) : max === G ? (B - R) / d + 2 : (R - G) / d + 4;
  return h * 60;
}

/** 두 색상 각도의 원형 거리(0~180) */
export function hueDistance(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

// ---------- 색각 이상 시뮬레이션 (REV-003-D-4 R-195) ----------

export type Cvd = 'protan' | 'deutan' | 'tritan';

/**
 * Machado, Oliveira, Fernandes (2009) "A Physiologically-based Model for Simulation of Color Vision Deficiency",
 * IEEE Transactions on Visualization and Computer Graphics 15(6) 1291–1298 — 저자 공개 표의 **심각도 1.0**(이색형: 제1·제2·제3색맹) 3×3 행렬.
 * 선형 sRGB(감마를 푼 값)에 곱한다. 각 행의 합이 1이라 흰색·회색은 그대로 남는다(테스트가 자기 점검).
 * 상태 4색이 적록 색각 이상(protan·deutan)에서도 서로 ΔE2000 8 이상 떨어져 있는지 재는 데 쓴다. tritan은 참고용(시트 네 줄 중 하나).
 */
const CVD_MATRIX: Record<Cvd, readonly number[]> = {
  protan: [0.152286, 1.052583, -0.204868, 0.114503, 0.786281, 0.099216, -0.003882, -0.048116, 1.051998],
  deutan: [0.367322, 0.860646, -0.227968, 0.280085, 0.672501, 0.047413, -0.01182, 0.04294, 0.968881],
  tritan: [1.255528, -0.076749, -0.178779, -0.078411, 0.930809, 0.147602, 0.004733, 0.691367, 0.3039],
};

/** 선형 → sRGB 감마 (lin의 역함수) */
const delin = (v: number): number => {
  const c = Math.min(1, Math.max(0, v));
  return c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
};

/** 색각 이상(심각도 1.0)에서 보이는 색으로 바꾼 sRGB */
export function simulateCvd(rgb: Rgb, kind: Cvd): Rgb {
  const m = CVD_MATRIX[kind];
  const l = [lin(rgb[0]), lin(rgb[1]), lin(rgb[2])];
  const out = [0, 1, 2].map((i) => m[i * 3] * l[0] + m[i * 3 + 1] * l[1] + m[i * 3 + 2] * l[2]);
  return out.map((v) => Math.round(delin(v) * 255)) as unknown as Rgb;
}

/** 색각 이상 시뮬레이션 행렬 각 행의 합(자기 점검용: 모두 1에 가까워야 흰색이 흰색으로 남는다) */
export function cvdRowSums(kind: Cvd): number[] {
  const m = CVD_MATRIX[kind];
  return [0, 1, 2].map((i) => m[i * 3] + m[i * 3 + 1] + m[i * 3 + 2]);
}

export const toHex = (rgb: Rgb): string => '#' + rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');

// ---------- tokens.css 읽기 ----------

export type TokenMap = Record<string, string>;

function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

/** marker가 나온 뒤 첫 `{ ... }`(중첩 포함)의 안쪽 문자열 */
function blockAfter(css: string, marker: string, from = 0): string | null {
  const at = css.indexOf(marker, from);
  if (at < 0) return null;
  const open = css.indexOf('{', at);
  if (open < 0) return null;
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}') {
      depth--;
      if (depth === 0) return css.slice(open + 1, i);
    }
  }
  return null;
}

function declarations(block: string): TokenMap {
  const out: TokenMap = {};
  for (const m of block.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) out[m[1]] = m[2].trim();
  return out;
}

export interface ThemeBlocks {
  light: TokenMap;
  /** @media (prefers-color-scheme: dark) 안의 :root:not([data-theme='light']) */
  darkMedia: TokenMap;
  /** :root[data-theme='dark'] */
  darkAttr: TokenMap;
}

export function readThemeBlocks(cssText: string): ThemeBlocks {
  const css = stripComments(cssText);
  const light = blockAfter(css, ':root {');
  const media = blockAfter(css, '@media (prefers-color-scheme: dark)');
  const darkMedia = media === null ? null : blockAfter(media, ":root:not([data-theme='light'])");
  const darkAttr = blockAfter(css, ":root[data-theme='dark']");
  if (light === null || darkMedia === null || darkAttr === null) throw new Error('tokens.css에서 라이트/다크 블록을 찾지 못했다');
  return { light: declarations(light), darkMedia: declarations(darkMedia), darkAttr: declarations(darkAttr) };
}

/** 다크 토큰 두 블록이 같은지: 어긋난 토큰 이름 목록 */
export function darkMismatch(b: ThemeBlocks): string[] {
  const keys = new Set([...Object.keys(b.darkMedia), ...Object.keys(b.darkAttr)]);
  return [...keys].filter((k) => b.darkMedia[k] !== b.darkAttr[k]).sort();
}

export type Theme = 'light' | 'dark';

/** 테마의 토큰 값: 라이트 + (다크면 다크 덮어쓰기) */
export function themeTokens(b: ThemeBlocks, theme: Theme): TokenMap {
  return theme === 'light' ? { ...b.light } : { ...b.light, ...b.darkAttr };
}

// ---------- 점검 쌍 ----------

export type PairKind = 'text' | 'ui' | 'graphic';
export interface Pair {
  fg: string;
  bg: string;
  /** 기준 대비율 */
  min: number;
  kind: PairKind;
  /** fg를 이 불투명도로 bg 위에 얹어 계산(얼굴 선처럼 투명도가 있는 그리기) */
  alpha?: number;
  /** 어디에 쓰는 쌍인지 */
  use: string;
}

const T = (fg: string, bgs: string[], use: string): Pair[] => bgs.map((bg) => ({ fg, bg, min: 4.5, kind: 'text', use }));
const U = (fg: string, bgs: string[], use: string, kind: PairKind = 'ui'): Pair[] => bgs.map((bg) => ({ fg, bg, min: 3, kind, use }));

const SURFACES = ['--c-bg', '--c-surface', '--c-surface-2'];
const GRADES = [1, 2, 3, 4, 5];

export const PAIRS: Pair[] = [
  // 글자 (4.5:1)
  ...T('--c-text', [...SURFACES, '--c-brand-soft', '--c-accent-soft'], '본문·제목'),
  ...T('--c-text-2', [...SURFACES, '--c-brand-soft', '--c-accent-soft'], '보조 설명'),
  ...T('--c-text-3', SURFACES, '출처·작은 주석'),
  ...T('--c-on-brand', ['--c-brand'], '주요 버튼·눌린 버튼 글자'),
  ...T('--c-on-brand-soft', ['--c-brand-soft'], '선택된 카드·인용 박스 글자'),
  ...T('--c-on-accent-soft', ['--c-accent-soft'], '나의 기록 줄 글자'),
  ...T('--c-brand', ['--c-bg', '--c-surface'], '브랜드색 글자(선택지 번호·로고 글자)'),
  ...T('--c-accent', ['--c-bg', '--c-surface'], '놋쇠색 글자(작은 태그)'),
  ...T('--c-link', ['--c-bg', '--c-surface'], '링크'),
  ...T('--c-up', SURFACES, '▲ 영향 표기'),
  ...T('--c-down', SURFACES, '▼ 영향 표기'),
  ...T('--c-on-notice', ['--c-notice-bg'], '안내 띠 글자'),
  ...GRADES.flatMap((n) => T(`--c-grade-${n}-ink`, [`--c-grade-${n}-soft`], `수저 ${n}단계 칩 글자`)),
  // 컨트롤 경계·그래픽 (3:1)
  ...U('--c-border-strong', SURFACES, '입력란·라디오 카드·바 트랙 테두리'),
  ...U('--c-brand', ['--c-bg', '--c-surface', '--c-brand-soft', '--c-meter-track'], '선택 테두리·체크·진행률 바 면'),
  ...U('--c-focus', [...SURFACES, '--c-brand-soft'], '포커스 링(3px)'),
  ...U('--c-logo', ['--c-bg', '--c-surface'], '로고·심볼', 'graphic'),
  ...['--c-stat-health', '--c-stat-happy', '--c-stat-knowledge', '--c-stat-relation'].flatMap((s) => U(s, ['--c-surface', '--c-meter-track'], '상태 바 면·아이콘')),
  ...GRADES.flatMap((n) => U(`--c-grade-${n}`, ['--c-surface', '--c-bg', `--c-grade-${n}-soft`], `수저 ${n}단계 아이콘·테두리·점`, 'graphic')),
  ...U('--c-accent', ['--c-accent-soft'], '나의 기록 줄 왼쪽 막대'),
  // 얼굴 (그림: 이목구비·머리가 피부·바탕에서 구분되는지, 3:1)
  { fg: '--c-face-line', bg: '--c-face-skin', min: 3, kind: 'graphic', alpha: 0.62, use: '이목구비 선(외모 1단계, 가장 흐린 값)' },
  { fg: '--c-face-line', bg: '--c-face-skin', min: 3, kind: 'graphic', alpha: 1, use: '이목구비 선(외모 5단계)' },
  { fg: '--c-face-hair', bg: '--c-face-skin', min: 3, kind: 'graphic', use: '머리(검정)·가닥 선 ↔ 피부' },
  { fg: '--c-face-hair', bg: '--c-face-bg', min: 3, kind: 'graphic', use: '머리(검정) 윤곽 ↔ 얼굴 타일 바탕' },
  { fg: '--c-face-hair-edge', bg: '--c-face-skin', min: 3, kind: 'graphic', alpha: 0.7, use: '밝은 머리(회·흰) 윤곽선 ↔ 피부' },
  { fg: '--c-face-hair-edge', bg: '--c-face-bg', min: 3, kind: 'graphic', alpha: 0.7, use: '밝은 머리(회·흰) 윤곽선 ↔ 타일 바탕' },
];

// ---------- 화면 CSS가 불투명도로 합성하는 글자·도형 (SPEC-003 QM3-5, QA-003-M3 M3-O02) ----------

/**
 * 토큰만 견주면 못 잡는 것: 화면 CSS가 `opacity`를 걸어 합성되는 색. 장식(`aria-hidden`)이라도 눈에 보이는 글자·도형은 DS3 대비 기준에서 면제되지 않는다(면제 목록 없음) —
 * 도장 「접수」는 `--c-accent` 토큰만으로는 4.5:1을 넘지만 `opacity: 0.85`를 걸면 라이트에서 3.72:1이었다.
 * 그래서 `src/styles/doc.css`에서 불투명도를 **직접 읽어** 합성 뒤의 색으로 쌍을 만든다(CSS가 바뀌면 쌍도 따라 바뀐다).
 */
export interface OpacityRule {
  /** 선택자(앞뒤 공백 제거) */
  selector: string;
  /** 규칙의 `opacity` 값(0~1) */
  opacity: number;
  /** 같은 규칙의 `color` 토큰 이름(`var(--c-accent)` → `--c-accent`), 없으면 null */
  colorToken: string | null;
}

/** CSS 글에서 `opacity`를 선언한 규칙들(주석·미디어 블록 안 포함, 중첩 없는 단순 규칙) */
export function readOpacityRules(cssText: string): OpacityRule[] {
  const css = stripComments(cssText);
  const out: OpacityRule[] = [];
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const body = m[2];
    const op = /(?:^|[;\s])opacity\s*:\s*([0-9.]+)\s*(?:;|$)/.exec(body);
    if (op === null) continue;
    const color = /(?:^|[;\s])color\s*:\s*var\((--[a-z0-9-]+)\)/.exec(body);
    out.push({ selector: m[1].trim(), opacity: Number(op[1]), colorToken: color === null ? null : color[1] });
  }
  return out;
}

/**
 * 장식 도장 `.stamp`(출생신고 「접수」): `.doc`(--c-surface) 위에 `color: --c-accent`(테두리는 currentColor)로 놓이고 규칙의 불투명도로 합성된다.
 * 글자(14px 굵게 — 큰 글자 기준 미만이라 4.5:1)와 테두리 둘(바깥 2.5px·안쪽 1px — UI 도형 3:1) 모두 전수 쌍에 든다.
 */
export function stampPairs(opacity: number): Pair[] {
  const a = opacity === 1 ? undefined : opacity;
  return [
    { fg: '--c-accent', bg: '--c-surface', min: 4.5, kind: 'text', alpha: a, use: '장식 도장 「접수」 글자(aria-hidden이지만 눈에 보인다 — 면제 없음, 불투명도 합성)' },
    { fg: '--c-accent', bg: '--c-surface', min: 3, kind: 'ui', alpha: a, use: '장식 도장 바깥 테두리(2.5px, 불투명도 합성)' },
    { fg: '--c-accent', bg: '--c-surface', min: 3, kind: 'ui', alpha: a, use: '장식 도장 안쪽 테두리(1px, 불투명도 합성)' },
  ];
}

/** 출생신고 띠 오른쪽 표기 `.doc__tag`: `--c-on-brand` 글자가 `--c-brand` 띠 위에서 불투명도로 합성된다 */
export function docTagPair(opacity: number): Pair {
  return { fg: '--c-on-brand', bg: '--c-brand', min: 4.5, kind: 'text', alpha: opacity === 1 ? undefined : opacity, use: '출생신고 띠 표기(`.doc__tag`, 불투명도 합성)' };
}

/** `src/styles/doc.css`의 불투명도 규칙에서 만든 화면 쌍. `.stamp`·`.doc__tag`가 없으면 던진다(선택자가 바뀌어 쌍이 조용히 사라지는 것을 막는다) */
export function docCssPairs(docCss: string): Pair[] {
  const rules = readOpacityRules(docCss);
  const stamp = rules.find((r) => r.selector === '.stamp');
  const tag = rules.find((r) => r.selector === '.doc__tag');
  // `.stamp`는 불투명도가 없으면(1) 규칙이 없을 수 있다 — 색이 --c-accent인지는 별도 단언
  const stampOpacity = stamp?.opacity ?? 1;
  if (tag === undefined) throw new Error('doc.css에서 `.doc__tag`의 opacity 규칙을 찾지 못했다 — 선택자가 바뀌었으면 docCssPairs를 고친다');
  return [...stampPairs(stampOpacity), docTagPair(tag.opacity)];
}

export interface PairResult {
  theme: Theme;
  pair: Pair;
  fgValue: string;
  bgValue: string;
  ratio: number;
  pass: boolean;
}

/** 한 테마의 전 쌍 계산 */
export function checkTheme(tokens: TokenMap, theme: Theme, pairs: readonly Pair[] = PAIRS): PairResult[] {
  return pairs.map((pair) => {
    const fgValue = tokens[pair.fg];
    const bgValue = tokens[pair.bg];
    if (fgValue === undefined || bgValue === undefined) throw new Error(`토큰이 없다: ${pair.fg} 또는 ${pair.bg} (${theme})`);
    const bg = parseHex(bgValue);
    const fg0 = parseHex(fgValue);
    const fg = pair.alpha === undefined ? fg0 : blend(fg0, bg, pair.alpha);
    const ratio = contrastRatio(fg, bg);
    return { theme, pair, fgValue, bgValue, ratio, pass: ratio + 1e-9 >= pair.min };
  });
}

/** 보고서(마크다운) */
export function formatReport(results: readonly PairResult[], extra: { mismatch: string[] }): string {
  const rows = (theme: Theme): string =>
    results
      .filter((r) => r.theme === theme)
      .map((r) => `| ${r.pair.use} | \`${r.pair.fg}\`${r.pair.alpha !== undefined ? ` ×${r.pair.alpha}` : ''} ${r.fgValue} | \`${r.pair.bg}\` ${r.bgValue} | ${r.pair.min}:1 | ${r.ratio.toFixed(2)}:1 | ${r.pass ? '통과' : '**실패**'} |`)
      .join('\n');
  const fails = results.filter((r) => !r.pass).length;
  const head = '| 쓰임 | 앞(글자·그림) | 뒤(바탕) | 기준 | 값 | 결과 |\n|---|---|---|---|---|---|';
  return [
    '# 대비 점검 결과 (자동 생성)',
    '',
    '`npx vite-node scripts/checkContrast.ts --write` 가 `src/styles/tokens.css`의 색 토큰 쌍과 `src/styles/doc.css`의 불투명도(도장 「접수」·띠 표기처럼 바탕 위에 불투명도로 쌓이는 글자)가 만드는 쌍을 전수 계산해 이 파일을 만든다. 손으로 고치지 않는다.',
    `- 점검 쌍: 라이트 ${results.filter((r) => r.theme === 'light').length}개 + 다크 ${results.filter((r) => r.theme === 'dark').length}개, **실패 ${fails}개**`,
    `- 다크 토큰 두 블록(미디어쿼리 / data-theme) 불일치: ${extra.mismatch.length === 0 ? '없음' : extra.mismatch.join(', ')}`,
    '- 기준: 글자 4.5:1, 컨트롤 경계·아이콘·바·그림 3:1 (WCAG 2.x 상대 휘도). 투명도가 있는 선은 바탕 위에 얹은 색으로 계산.',
    '- 강제 색상 모드는 시스템 색이라 계산하지 않는다(모양으로 구분하는 규칙은 design-system.md).',
    '',
    '## 라이트',
    head,
    rows('light'),
    '',
    '## 다크',
    head,
    rows('dark'),
    '',
  ].join('\n');
}
