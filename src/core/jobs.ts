import { PERSONA_TABLE as T } from '../data/personaTable';
import { educationMultiplier } from './economy';
import type { Condition, YearRange } from './events';
import { inYearRange } from './events';
import type { AptKey } from './personaKinds';
import { wageLookMult } from './looks';
import type { Occupation } from './types';

/**
 * 세부 직업 표와 순수 계산 (SPEC-018 PL4, 설계 `docs/data/persona-model.md` 4·4B·4C·5절). 본 표(`data/jobs.json`)는 지연 로딩이고(`GameData.jobs`), 이 파일의 함수는 표를 인자로 받는다.
 *  - 소득 배수 `jobMul`: `clamp((occMult(직업, 연도) × sizeMul ÷ 대표 학력 배수)^0.8, 0.5, 2.5)` — 학력은 `incomeOf`의 `EDU`가 이미 담으므로 대표 학력으로 나눠 이중 상승을 덜어 낸다(5절).
 *  - 연도별 취업 문턱 `HIREYEAR`: 청년 실업률 식의 표(`PERSONA_TABLE.HIREYEAR`, `youth-employment-stats.md` 4-2절 그대로), 범위 밖은 1.0 (4C-3 ③).
 *  - 직업 추첨 점수의 시기 배율 `eraW` (4C-3 ④, 근거 전에는 1.0).
 */

export type JobHire = 'open' | 'normal' | 'selective';
/** `general` 일반 · `face` 대면 서비스(승무원·판매·영업·접객) — 3b에서 외모 영향의 k를 가르는 표지다(이번 단계는 값 적용 없음) */
export type LookSens = 'general' | 'face';

export interface EraWeight {
  from?: number;
  to?: number;
  /** 후보 추첨 점수의 시기 배율 (하한 0.5) */
  mul: number;
}

export interface JobDef {
  /** One-way: 삭제·재사용 금지 */
  id: string;
  field: Occupation;
  /** 화면 라벨 — 한글과 공백만 (라벨 lint와 같은 규칙) */
  name: string;
  yearRange?: YearRange;
  /** 소프트 조건(학력·플래그·수저·적성) — 맞지 않으면 「무리한 도전」 후보로만 보인다. `looks`·`gender` 금지, `open` 직업에는 없다 */
  when?: Condition;
  /** 조건 없이 후보가 되는 입문 직업 (`hire: 'open'`과 같다) */
  open?: true;
  /** 적성 축 — 있으면 점수·지원 확률이 그 단계를 읽는다. 대면 직무는 필수 */
  fitApt?: AptKey;
  /** 후보 추첨 기본 가중 */
  weight: number;
  hire: JobHire;
  lookSens: LookSens;
  /** 대표 학력(지식 스탯) — `jobMul`의 분모 */
  eduRef: number;
  /** 소득 근거의 직종 이름 (`docs/data/occupation-wages.md` 2절 행) */
  wageRef: string;
  /** 직종 월임금총액 ÷ 전직종 배수의 앵커: [2009, 2019, 2022, 2025] — 6차(2009·2019)·7차(2022·2025) 표의 계산 값 */
  wage: readonly [number, number, number, number];
  /** 승무원 등 해마다 크게 흔들리는 직종의 특별 규칙 (`flight` = 상한 + 3년 이동평균) */
  wageKind?: 'flight';
  /** 규모 보정 `1 + 0.5 × (규모 배수 − 1)` (대기업 1.33 · 중소 0.94 — 추정) */
  sizeMul?: number;
  /** `est` = 통계가 없어 가까운 직종 값을 빌린 **추정** */
  wageSrc?: 'est';
  eraW?: EraWeight[];
  /** 합격하면 켜는 플래그 (`has_career`·`job_picked`에 더해) — 옛 첫 일 카드의 `family_business` 대응 */
  setFlags?: string[];
}

export interface JobTable {
  jobs: readonly JobDef[];
  byId: ReadonlyMap<string, JobDef>;
}

export function createJobTable(jobs: readonly JobDef[]): JobTable {
  return { jobs, byId: new Map(jobs.map((j) => [j.id, j])) };
}

/** 분야 이름 (화면 라벨 — 한글과 공백만) */
export const FIELD_NAMES: Readonly<Record<Occupation, string>> = {
  manager: '관리직',
  professional: '전문직',
  clerk: '사무직',
  service: '서비스직',
  sales: '판매와 영업',
  agri: '농림어업',
  craft: '기능직',
  machine: '생산과 기계',
  labor: '단순 노무',
};

const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));

// ---------- 소득: occMult · jobMul ----------

const ANCHOR_YEARS = [2009, 2019, 2022, 2025] as const;

/** 앵커 4개를 이은 선형 보간: 2009 앞은 2009 값, 2025 뒤는 2025 값(carried), 2020~2021은 2019·2022 직선 보간 */
function interpolate(a: readonly [number, number, number, number], year: number): number {
  if (year <= ANCHOR_YEARS[0]) return a[0];
  if (year >= ANCHOR_YEARS[3]) return a[3];
  for (let i = 0; i < 3; i++) {
    const y0 = ANCHOR_YEARS[i];
    const y1 = ANCHOR_YEARS[i + 1];
    if (year <= y1) return a[i] + ((a[i + 1] - a[i]) * (year - y0)) / (y1 - y0);
  }
  return a[3];
}

/**
 * 승무원(운송 서비스 431) 배수 (설계 5절 `[CX-002-010]`): 2009~2019는 6차 중분류 43 배수(0.86 → 0.92 직선), **2020·2021은 2019 값 0.92를 이어 쓰고**(직선 보간 아님),
 * 2022부터 각 해 값에 `min(·, 1.2)` 상한을 먼저 적용한 `(y−2, y−1, y)` 3년 이동평균. 7차 값: 2022 0.85 · 2023~2025는 캡 1.2(2023 원값 5,297 ÷ 전직종은 캡을 넘는다). 2026 이후는 2025 값을 이어 쓴다.
 */
export const FLIGHT_CAP = T.MODEL.flightAttendantCap[0];
/** 7차 431 ÷ 전직종(S1): 2022 0.85, 2025 1.52는 문서 값. 2023·2024의 전직종은 문서에 없어 2022·2025 선형 추정(4,221·4,352천원)으로 나눈 1.25·1.44 — 어느 쪽이든 캡 1.2에 닿는다 */
const FLIGHT_S1: Readonly<Record<number, number>> = { 2022: 0.85, 2023: 1.25, 2024: 1.44, 2025: 1.52 };
function flightBase(year: number): number {
  if (year <= 2009) return 0.86;
  if (year <= 2019) return 0.86 + ((0.92 - 0.86) * (year - 2009)) / 10;
  if (year <= 2021) return 0.92;
  return Math.min(FLIGHT_S1[Math.min(year, 2025)], FLIGHT_CAP);
}
export function flightMult(year: number): number {
  const y = Math.min(year, 2025);
  if (y < 2022) return flightBase(y);
  return (flightBase(y - 2) + flightBase(y - 1) + flightBase(y)) / 3;
}

/** 이 직업의 그 해 「직종 ÷ 전직종」 배수 (규모 보정 포함) — 소득 조회 연도에 읽는다. 승무원은 특별 규칙 */
export function occMultOf(job: Pick<JobDef, 'wage' | 'wageKind' | 'sizeMul'>, year: number): number {
  const base = job.wageKind === 'flight' ? flightMult(year) : interpolate(job.wage, year);
  return base * (job.sizeMul ?? 1);
}

/**
 * 소득 배수 `jobMul` (5절): `clamp((occMult ÷ 대표 학력 배수)^k × 외모 항, lo, hi)`, 지수 k = 0.8 · 범위 0.5~2.5.
 * **외모 항(④, PL16)**: `looks`를 주면 입사 뒤 임금에 `× (1 + 0.03·z)` 한 항을 곱하고 상하한 안에서 자른다(없으면 1 — 자동 선택의 소득 호감처럼 사람과 무관한 비교).
 */
export function jobMulOf(job: Pick<JobDef, 'wage' | 'wageKind' | 'sizeMul' | 'eduRef'>, year: number, looks?: number): number {
  const [lo, hi] = T.MODEL.jobMulRange;
  const raw = Math.pow(occMultOf(job, year) / educationMultiplier(job.eduRef), T.MODEL.jobMulExp[0]);
  return clamp(looks === undefined ? raw : raw * wageLookMult(looks), lo, hi);
}

// ---------- 연도별 취업 문턱 ----------

const HIREYEAR_FIRST = 1980;
const HIREYEAR_LIST: readonly number[] = Object.values(T.HIREYEAR).flatMap((row) => [...row]);

/** `HIREYEAR[y]` — 청년 취업이 어려운 해에 첫 지원 합격률이 낮아지고 쉬운 해에 조금 높다. 1980 앞·2025 뒤는 1.0. 지원 판정 연도(지원 나이의 달력 연도)에만 쓴다 */
export function hireYearOf(year: number): number {
  const i = year - HIREYEAR_FIRST;
  return i >= 0 && i < HIREYEAR_LIST.length ? HIREYEAR_LIST[i] : 1;
}

// ---------- 직업 추첨의 시기 배율 ----------

export const ERA_W_MIN = 0.5;

/** `eraW` 배율: 그 해에 걸리는 항목들의 곱, 하한 0.5, 기본 1.0 */
export function eraWOf(job: Pick<JobDef, 'eraW'>, year: number): number {
  let mul = 1;
  for (const e of job.eraW ?? []) if (inYearRange(year, e)) mul *= e.mul;
  return Math.max(ERA_W_MIN, mul);
}

export const jobInYear = (job: Pick<JobDef, 'yearRange'>, year: number): boolean => inYearRange(year, job.yearRange);
