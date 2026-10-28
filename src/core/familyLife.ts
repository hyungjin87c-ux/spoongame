import { FAMILY_AGE_CAP, NO_DEATH_PLAN } from './familyModel';
import { familyTables } from './gameData';
import type { Gender } from './types';

/**
 * 코호트 생존 곡선과 별세 나이 (설계 문서 4-4절, FD10 합성): 그 사람이 지나온 해(출생 연도 + 나이)의 **간이생명표 5세 구간 사망확률**을 1세 위험률로 쪼개 이어 곱한다.
 *  - 2024 뒤의 해는 2024 값을 유지한다(미래 개선 없음 — 출처 없는 미래 수치 금지, SPEC-004 S6).
 *  - 1970 앞의 해는 1970 값에 배율 m(t) ≥ 1을 곱한다(A 마스터 결정 7 (나)): 기간 기대수명이 `e0(t) = e0(1970) − 기울기 × (1970 − t)`(하한 30세)가 되도록 이분법으로 푼 값이다. 추정.
 * 순수 함수 — 난수를 쓰지 않는다. 표는 `core/gameData.ts#familyTables()`(지연 덩어리)에서 읽는다.
 */

/** 구간 번호: 0세 · 1~4세 · 5~9세 … 95~99세 · 100세 이상 (22개) */
export function mortalityClassOf(age: number): number {
  if (age <= 0) return 0;
  if (age <= 4) return 1;
  return Math.min(21, 2 + Math.floor((age - 5) / 5));
}

/** 구간 너비(년): 0세 1 · 1~4세 4 · 그 밖 5 */
const classWidth = (cls: number): number => (cls === 0 ? 1 : cls === 1 ? 4 : 5);

const sexIndex = (sex: Gender): 0 | 1 => (sex === 'male' ? 0 : 1);

const Q_CAP = 0.999;
/** 100세 이상 구간에서 남은 기대 햇수(기대수명 계산의 마무리 근사) */
const E_TAIL = 2;
/** 1970 앞 바깥으로 늘린 값의 기대수명 하한 */
const E0_FLOOR = 30;

/** 사망확률 한 칸(배율 적용 전): 1970~2024 안은 표 값, 2024 뒤는 2024 값, 1970 앞은 1970 값 */
function rawQ(si: 0 | 1, cls: number, year: number): number {
  const m = familyTables().mortality;
  const col = Math.min(m.lastYear, Math.max(m.firstYear, year)) - m.firstYear;
  return m.qx[si][cls][col];
}

/** 구간 사망확률로 만든 기간 생명표의 출생 시 기대수명 (구간 안 균등 사망 근사). 배율 탐색용이라 절대값의 오차는 중요하지 않고, 같은 함수를 목표와 탐색에 함께 쓴다 */
function periodE0(qs: readonly number[]): number {
  let l = 1;
  let e = 0;
  for (let cls = 0; cls < qs.length; cls++) {
    const q = Math.min(1, qs[cls]);
    const next = l * (1 - q);
    e += cls === qs.length - 1 ? l * E_TAIL : classWidth(cls) * ((l + next) / 2);
    l = next;
  }
  return e;
}

const scaleCache = new Map<string, number>();

/** 1970 앞 해 t의 사망확률 배율 m(t) ≥ 1 (표의 이 성별 1970 줄 기준) */
export function mortalityScalePre1970(sex: Gender, year: number): number {
  const m = familyTables().mortality;
  if (year >= m.firstYear) return 1;
  const key = `${sex}${year}`;
  const hit = scaleCache.get(key);
  if (hit !== undefined) return hit;
  const si = sexIndex(sex);
  const base = Array.from({ length: m.classes }, (_, c) => rawQ(si, c, m.firstYear));
  const e0Base = periodE0(base);
  const target = Math.max(E0_FLOOR, e0Base - m.e0Slope[si] * (m.firstYear - year));
  const at = (mult: number): number => periodE0(base.map((q, c) => (c === m.classes - 1 ? 1 : Math.min(Q_CAP, q * mult))));
  // 배율이 클수록 기대수명이 짧다: 이분법 (로그 축, 1 ~ 400)
  let lo = 0;
  let hi = Math.log(400);
  if (at(1) <= target) {
    scaleCache.set(key, 1);
    return 1;
  }
  for (let i = 0; i < 48; i++) {
    const mid = (lo + hi) / 2;
    if (at(Math.exp(mid)) > target) lo = mid;
    else hi = mid;
  }
  const out = Math.exp((lo + hi) / 2);
  scaleCache.set(key, out);
  return out;
}

/** 이 사람(성별·출생 연도)이 나이 x(0~100)에서 달력 연도 `by + x`의 사망확률을 겪을 때의 1년 사망확률 */
function yearQ(sex: Gender, by: number, x: number): { q: number; width: number } {
  const si = sexIndex(sex);
  const cls = mortalityClassOf(x);
  const year = by + x;
  let q = rawQ(si, cls, year);
  if (cls < familyTables().mortality.classes - 1 && year < familyTables().mortality.firstYear) q = Math.min(Q_CAP, q * mortalityScalePre1970(sex, year));
  return { q, width: classWidth(cls) };
}

const curveCache = new Map<string, readonly number[]>();

/**
 * 코호트 생존 곡선 `S[0..101]` (`S[0] = 1`): `S[x+1] = S[x] · (1 − h)`, 1세 위험률 `h = 1 − (1 − Q)^(1/구간 너비)`. 100세 이상 구간의 Q는 1이라 `S[101] = 0`이다.
 * 같은 (성별, 출생 연도)는 한 번만 계산한다.
 */
export function survivalCurve(sex: Gender, birthYear: number): readonly number[] {
  const key = `${sex}${birthYear}`;
  const hit = curveCache.get(key);
  if (hit !== undefined) return hit;
  const s: number[] = [1];
  for (let x = 0; x <= FAMILY_AGE_CAP; x++) {
    const { q, width } = yearQ(sex, birthYear, x);
    const h = q >= 1 ? 1 : 1 - Math.pow(1 - q, 1 / width);
    s.push(s[x] * (1 - h));
  }
  const out = Object.freeze(s);
  curveCache.set(key, out);
  return out;
}

/**
 * 나이 `aliveAtAge`에 살아 있던 사람의 별세 나이: 목표 `T = S[x0] × (1 − u)`일 때 `S[x+1] ≤ T`인 첫 `x ≥ x0`. `u`는 [0,1) 한 번의 추첨.
 * 100을 넘기면 `NO_DEATH_PLAN`(101) — 100세 이상 구간의 Q가 1이라 실제로는 거의 나오지 않는다.
 */
export function deathAgeGiven(sex: Gender, birthYear: number, aliveAtAge: number, u: number): number {
  const s = survivalCurve(sex, birthYear);
  const x0 = Math.max(0, Math.min(FAMILY_AGE_CAP, Math.floor(aliveAtAge)));
  const target = s[x0] * (1 - u);
  for (let x = x0; x <= FAMILY_AGE_CAP; x++) if (s[x + 1] <= target) return x;
  return NO_DEATH_PLAN;
}

/** 시험 전용: 계산해 둔 곡선·배율을 비운다 (표를 바꿔 끼운 시험 뒤) */
export function resetFamilyLifeCaches(): void {
  curveCache.clear();
  scaleCache.clear();
}
