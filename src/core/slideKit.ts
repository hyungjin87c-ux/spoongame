import { commaList } from './glue';
import type { Point } from '../data/koreaStatsAccess';

/**
 * 슬라이드 모델이 함께 쓰는 작은 계산·글자 도구 (순수 함수). 원래 `carousel.ts`에 있던 것을 그대로 옮겼다 — SPEC-005 QI4 2단계에서 슬라이드 형식별 모델(`slideForms.ts`)이 같은 도구를 쓰는데
 * `carousel.ts` ⇄ `slideForms.ts`가 서로 가져오면 모듈 평가 순서에 기대게 되므로, 둘 다 이 잎 모듈만 가져온다. `carousel.ts`가 이름을 그대로 다시 내보내므로 바깥 사용처(`core/index.ts`)는 달라지지 않는다.
 */

/**
 * 큰 값 글자의 폭을 글자 크기(em) 단위로 어림한다 — 숫자는 같은 폭(tabular-nums)이라 0.62em, 쉼표·소수점은 0.32em, 그 밖은 1em.
 * 화면은 이 값으로 큰 글자 크기를 칸 폭에 맞춰 줄여(CSS `min(var(--fs-3xl), 칸 폭 / 이 값)`), 글자 크기를 200%로 키워도 숫자가 중간에서 줄바꿈되거나 칸을 넘치지 않게 한다(CM11, QM2-5).
 */
export function valueWidthEm(valueText: string): number {
  let em = 0;
  for (const ch of valueText) em += ch >= '0' && ch <= '9' ? 0.62 : ch === ',' || ch === '.' ? 0.32 : 1;
  return Math.round(em * 100) / 100;
}

/** 이름에서 끝의 괄호 풀이를 뺀다: 「조혼인율(인구 1천 명당 건)」 → 「조혼인율」, 「혼인 건수(건, 혼인신고 기준)」 → 「혼인 건수」 (QM2-11 규칙 3) */
export function bareName(label: string): string {
  return label.replace(/\s*\([^)]*\)\s*$/, '').trim();
}

export const PAD = { left: 8, right: 66, top: 24, bottom: 30 };
export const LABEL_GAP = 13;

/** 값 글자(CSS .chart text, 13px) 한 줄이 차지하는 칸: 글자 위쪽(ascent)·아래쪽(descent) */
const LABEL_ASCENT = 11;
const LABEL_DESCENT = 3;
/** 값 글자 폭 추정(13px 한글 시스템 글꼴의 숫자·점 폭을 넉넉하게). 그래프 안 글자는 숫자·소수점·쉼표뿐이다. */
export function estimateLabelWidth(text: string, bold: boolean): number {
  let w = 0;
  for (const ch of text) w += ch >= '0' && ch <= '9' ? (bold ? 8.2 : 7.8) : ch === '.' || ch === ',' ? 4.2 : 13;
  return Math.ceil(w) + 1;
}

export interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** 시작점 기준(anchor start) 값 글자가 baseline y에 놓일 때 차지하는 사각형 */
export function labelRect(x: number, baselineY: number, text: string, bold = false): Rect {
  return { left: x, top: baselineY - LABEL_ASCENT, right: x + estimateLabelWidth(text, bold), bottom: baselineY + LABEL_DESCENT };
}

export const rectsOverlap = (a: Rect, b: Rect): boolean => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

/** 선분 (x1,y1)-(x2,y2)이 사각형(경계 포함)과 만나는가 — 끝점이 안에 있거나 네 변 중 하나와 교차 */
export function segmentHitsRect(x1: number, y1: number, x2: number, y2: number, r: Rect): boolean {
  const inside = (x: number, y: number) => x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  if (inside(x1, y1) || inside(x2, y2)) return true;
  if (Math.max(x1, x2) < r.left || Math.min(x1, x2) > r.right || Math.max(y1, y2) < r.top || Math.min(y1, y2) > r.bottom) return false;
  const cross = (ax: number, ay: number, bx: number, by: number, cx: number, cy: number) => (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
  const crosses = (cx: number, cy: number, dx: number, dy: number) => {
    const d1 = cross(x1, y1, x2, y2, cx, cy);
    const d2 = cross(x1, y1, x2, y2, dx, dy);
    const d3 = cross(cx, cy, dx, dy, x1, y1);
    const d4 = cross(cx, cy, dx, dy, x2, y2);
    return d1 * d2 <= 0 && d3 * d4 <= 0;
  };
  return crosses(r.left, r.top, r.right, r.top) || crosses(r.right, r.top, r.right, r.bottom) || crosses(r.right, r.bottom, r.left, r.bottom) || crosses(r.left, r.bottom, r.left, r.top);
}

export const round1 = (n: number): number => Math.round(n * 10) / 10;

/** 세로로 겹치는 라벨을 위아래로 벌린다(입력 순서대로 돌려준다). 최소 간격 gap, 범위 [lo, hi]. */
export function spreadY(ys: readonly number[], gap: number, lo: number, hi: number): number[] {
  const order = ys.map((y, i) => ({ y, i })).sort((a, b) => a.y - b.y || a.i - b.i);
  const out = order.map((o) => Math.min(hi, Math.max(lo, o.y)));
  for (let k = 1; k < out.length; k++) if (out[k] - out[k - 1] < gap) out[k] = out[k - 1] + gap;
  if (out.length > 0 && out[out.length - 1] > hi) {
    out[out.length - 1] = hi;
    for (let k = out.length - 2; k >= 0; k--) out[k] = Math.min(out[k], out[k + 1] - gap);
  }
  const result = new Array<number>(ys.length);
  order.forEach((o, k) => {
    result[o.i] = out[k];
  });
  return result;
}

export function yearPoints(series: readonly Point[]): Array<{ year: number; value: number }> {
  const out: Array<{ year: number; value: number }> = [];
  for (const p of series) if ('year' in p && Number.isInteger(p.year) && Number.isFinite(p.value)) out.push({ year: p.year, value: p.value });
  return out.sort((a, b) => a.year - b.year);
}

/** 기관 이름 목록 (「국가데이터처·교육부」처럼 가운뎃점으로 묶인 것을 나눈다) */
export function sourceOrgsOf(org: string): string[] {
  return org
    .split(/[·,/]/)
    .map((x) => x.trim())
    .filter((x) => x !== '');
}

/** 마지막 글자가 받침 있는 한글 음절인가 (한글이 아니면 받침 없음으로 본다) */
export function hasBatchim(word: string): boolean {
  const code = word.trimEnd().charCodeAt(word.trimEnd().length - 1);
  return code >= 0xac00 && code <= 0xd7a3 && (code - 0xac00) % 28 !== 0;
}

/**
 * 글 속에서 데이터로 채운 낱말 뒤의 조사: 「인구」+「는」 / 「18~65세」+「와」 / 「66세 이상」+「과」. 틀에 낱말 칸이 있는 문장(`data/slideText.ts`)에서만 쓴다 —
 * 칸을 채우는 구간 이름이 데이터 갱신으로 바뀌어도 받침에 맞는 조사가 붙는다.
 */
export const josa = {
  topic: (word: string): string => `${word}${hasBatchim(word) ? '은' : '는'}`,
  and: (word: string): string => `${word}${hasBatchim(word) ? '과' : '와'}`,
};

/** 범례 목록의 읽기 이름 — 선 그래프. 막대 범례(폭염·아기)는 `data/slideText.ts`의 `barLegendLabel` */
export const LEGEND_LABEL_LINE = '그래프 범례와 최근 값';

/**
 * 출처 줄 글자 (copy.md 14-6, D5-66, 마스터 결정): **「{기관 나열}의 {표 이름} ({열람일} 조회)」** — 20장 모두 같은 꼴이다.
 * 기관은 쉼표 나열이고(「국가데이터처·교육부」도 「국가데이터처, 교육부」) 기관 묶음과 표 이름을 조사 「의」로 가른다 — 쉼표만 쓰면 「…금융감독원, KOSIS 가계금융복지조사」에서 KOSIS가 넷째 기관처럼 읽힌다.
 * 화면은 앞에 「출처: 」를 붙인다.
 */
export function sourceTextOf(ind: { source: { org: string; table: string; accessedOn: string } }): string {
  return `${commaList(sourceOrgsOf(ind.source.org))}의 ${ind.source.table} (${ind.source.accessedOn} 조회)`;
}
