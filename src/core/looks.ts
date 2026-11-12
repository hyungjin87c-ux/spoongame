import { looksTierOf } from '../assets/faces/faceLayers';
import { PERSONA_TABLE as T } from '../data/personaTable';

/**
 * 외모 영향 (SPEC-018 PL16, 설계 `docs/data/persona-model.md` 4B·4B-2·4C-1·5절 ④) — 순수 함수 모음. 값은 모두 코드 표 한 곳(`data/personaTable.ts` = 9절 블록)에서 읽는다.
 *
 * - **채널 곱** `LOOKW[채널][단계]`: 교우(`friend`)·연애(`romance`). 사건 데이터의 `looksChannel`이 채널을 고르고 `eventWeight`가 곱한다. 시대 배율 `LOOKERA[채널:시기]`는 **맞춤 인생이 있는 판**(스위치 켬 + `persona`)에서만 곱한다
 *   — 시대 배율을 끄는 것이 롤백 스위치가 되돌리는 것의 하나다(6-3). 표준 표 자체(`LOOKW`)는 `persona`가 없는 판·스위치를 끈 판에도 적용하는 밸런스 변경이다(F11).
 * - **취업 외모 항** `kJob = LOOKK[lookSens:시기] × LOOKERA`, `z = (looks − 50)/50`을 단계별로 환산한 값(`LOOKZ`). `p_first`에만 곱한다(`careerTrack.ts#applyProbOf`).
 * - **입사 뒤 임금** `1 + 0.03·z` 한 항 — `jobMul`에 곱한다(`jobs.ts#jobMulOf`).
 * - **길을 막지 않는다**: 이 파일은 확률의 곱수만 만든다. `looks`를 조건(`conditions`·`requires`·직업 `when`)에 쓰는 것은 `eventLint`가 막는다.
 */

export const LOOKS_CHANNELS = ['friend', 'romance'] as const;
export type LooksChannel = (typeof LOOKS_CHANNELS)[number];
/** 취업 지원 k를 가르는 표지 (`jobs.ts`의 `LookSens`와 같은 값) */
export type JobLookSens = 'general' | 'face';

const Z = T.LOOKZ['1 2 3 4 5'] as readonly number[];

/** 외모 점수 → 단계별 z (−1 / −0.5 / 0 / 0.5 / 1) */
export const looksZ = (looks: number): number => Z[looksTierOf(looks) - 1];

// ---------- 시기 구간 표 (`-2016` · `2017-2018` · `2019-` · `all`) ----------

interface Span {
  from: number;
  to: number;
  v: number;
}

function parseSpan(span: string, v: number): Span {
  if (span === 'all') return { from: -Infinity, to: Infinity, v };
  const m = /^(\d*)-(\d*)$/.exec(span);
  if (m === null) throw new Error(`외모 표의 시기 구간 모양이 이상하다: ${span}`);
  return { from: m[1] === '' ? -Infinity : Number(m[1]), to: m[2] === '' ? Infinity : Number(m[2]), v };
}

function spansOf(table: Readonly<Record<string, readonly (number | string)[]>>, prefix: string): Span[] {
  const out: Span[] = [];
  for (const [key, row] of Object.entries(table)) {
    if (key.startsWith(`${prefix}:`)) out.push(parseSpan(key.slice(prefix.length + 1), row[0] as number));
  }
  return out;
}

const valueIn = (spans: readonly Span[], year: number): number => spans.find((s) => year >= s.from && year <= s.to)?.v ?? 1;

const ERA_KINDS = ['romance', 'friend', 'general', 'face', 'wage'] as const;
type EraKind = (typeof ERA_KINDS)[number];
const ERA_SPANS: Readonly<Record<EraKind, readonly Span[]>> = {
  romance: spansOf(T.LOOKERA, 'romance'),
  friend: spansOf(T.LOOKERA, 'friend'),
  general: spansOf(T.LOOKERA, 'general'),
  face: spansOf(T.LOOKERA, 'face'),
  wage: spansOf(T.LOOKERA, 'wage'),
};
const FACE_K_SPANS = spansOf(T.LOOKK, 'face');

/** 시대 배율 `LOOKERA[종류:그 해]` (설계 4C-1). 모든 값이 (0, 1] — 확정 k를 키우지 않는다 */
export const looksEraOf = (kind: EraKind, year: number): number => valueIn(ERA_SPANS[kind], year);

/** 시대 배율의 모든 칸 값 (시험·lint가 범위를 본다) */
export const looksEraValues = (kind: EraKind): number[] => ERA_SPANS[kind].map((s) => s.v);

// ---------- 채널 곱 (교우·연애) ----------

/**
 * 외모 채널 곱: `1 + k·era·z`를 단계 표 `LOOKW`로 읽는다. `eraOn`이 거짓이거나 연도를 모르면 시대 배율은 1(표 값 그대로).
 * 시대 배율 1이면 표 값을 그대로 돌려준다(부동소수 오차 없음).
 */
export function looksChannelMult(channel: LooksChannel, looks: number, year: number | undefined, eraOn: boolean): number {
  const base = T.LOOKW[channel][looksTierOf(looks) - 1];
  const era = eraOn && year !== undefined ? looksEraOf(channel, year) : 1;
  return era === 1 ? base : 1 + (base - 1) * era;
}

/** 이 채널 곱이 가질 수 있는 `[최소, 최대]` — 모든 외모 단계 × 시대 배율 칸 (합성 가중 범위 검사가 읽는다) */
export function looksChannelBounds(channel: LooksChannel): readonly [number, number] {
  let min = Infinity;
  let max = -Infinity;
  for (const base of T.LOOKW[channel]) {
    for (const era of [1, ...looksEraValues(channel)]) {
      const m = era === 1 ? base : 1 + (base - 1) * era;
      min = Math.min(min, m);
      max = Math.max(max, m);
    }
  }
  return [min, max];
}

// ---------- 취업·임금 ----------

/**
 * 취업 지원의 외모 k (`kJob`, 설계 4B): 일반 직종 `LOOKK.general` × 시대 배율(2020~ 0.8), 대면 서비스 `LOOKK.face`의 연도 구간(~2016 0.20 · 2017~2018 0.12 · 2019~ 0.08, 시대 배율 1).
 * `eraOn`이 거짓(맞춤 인생이 없는 판)이면 일반 직종의 시대 배율을 곱하지 않는다 — 대면 서비스의 연도 구간은 `LOOKK` 안에 내장이라 그대로다.
 */
export function jobLookK(sens: JobLookSens, year: number, eraOn: boolean): number {
  if (sens === 'face') return valueIn(FACE_K_SPANS, year) * (eraOn ? looksEraOf('face', year) : 1);
  return T.LOOKK.general[0] * (eraOn ? looksEraOf('general', year) : 1);
}

/** 취업 외모 항 `kJob × z` — `p_first`에만 곱한다: `p = clamp(p_first × (1 + 이 값) + 만회, …)` */
export const jobLookTerm = (sens: JobLookSens, looks: number, year: number, eraOn: boolean): number => jobLookK(sens, year, eraOn) * looksZ(looks);

/** 입사 뒤 임금의 외모 항 `1 + 0.03·z` (설계 4B·5절 ④, 시대 배율 1) — `jobMul`에 곱한다 */
export const wageLookMult = (looks: number): number => 1 + T.LOOKK.wage[0] * looksZ(looks);
