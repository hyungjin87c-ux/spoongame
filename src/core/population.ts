import { getUsableIndicator } from '../data/koreaStatsAccess';

/**
 * 가상 인구 (SPEC-003 VP1·FS2). 첫 화면의 「N명이 이 시뮬레이션 속에서 각자의 삶을 살고 있어요」의 N.
 *
 * **실제 접속자 수가 아니다.** 서버도 집계도 없고, 이 기기 안에서 시각(분)만으로 계산하는 순수 함수다(같은 입력이면 같은 값 — `Date`·`Math.random`은 쓰지 않는다.
 * 현재 시각은 UI가 분 단위로 읽어 넘긴다, CM2).
 *
 * 모델 (규모·변동 기본값은 마스터 결정 C11):
 *  - 규모: 한국 주민등록 인구(행정안전부, 2026년 9월 51,082,431명, koreaStats `region-population-registered`)를 1/1,000로 줄인 51,082명 — 약 5만 명대.
 *  - 완만한 추세: 2025년 출생아 수 254,341명과 사망자 수 362,968명(국가데이터처, koreaStats `births`·`cdr`)의 차이를 같은 비율로 줄인 연 −108.6명을
 *    기준 시각(2026-10-01 00:00 UTC)부터 직선으로 더한다. 5만 명대를 벗어나지 않도록 추세의 누적은 ±900명으로 막는다(설계값).
 *  - 분 단위의 작은 흔들림: 출생·사망이 시간대마다 고르지 않다는 느낌만 주는 값 잡음(value noise) 네 겹(하루·6시간·1시간·10분 주기, 진폭 합 ±126명 = 규모의 ±0.25%).
 *    난수 대신 정수 해시를 쓰므로 같은 분이면 항상 같은 값이다. 1분 변화량은 최대 1명 남짓(0.002%)이고 하루 사이 변동폭은 규모의 0.5% 이하다.
 *    이 흔들림의 진폭은 실제 출생·사망 건수를 흉내 낸 것이 아니라 「조금씩 변한다」는 표시를 위한 설계값이다(통계가 아니다).
 */

/** 한 해의 분 수 (365일) */
const MINUTES_PER_YEAR = 365 * 24 * 60;

/** 추세의 기준 시각: 2026-10-01T00:00:00Z 의 에포크 분. 상수로 적어 `Date`를 쓰지 않는다. */
export const POPULATION_EPOCH_MINUTE = 29_846_880;

/** 추세 누적의 절대 상한(명). 5만 명대(50,000~59,999)를 지키기 위한 설계값. */
export const POPULATION_DRIFT_CAP = 900;

/** 잡음 한 겹의 설계: 주기(분)와 진폭(명) */
export const POPULATION_NOISE_LAYERS = [
  { periodMinutes: 24 * 60, amplitude: 80, salt: 0x9e3779b1 },
  { periodMinutes: 6 * 60, amplitude: 30, salt: 0x85ebca6b },
  { periodMinutes: 60, amplitude: 12, salt: 0xc2b2ae35 },
  { periodMinutes: 10, amplitude: 4, salt: 0x27d4eb2f },
] as const;

/** 잡음 진폭의 합 = 값이 기준선에서 벗어날 수 있는 최대 폭(명) */
export const POPULATION_NOISE_MAX = POPULATION_NOISE_LAYERS.reduce((sum, l) => sum + l.amplitude, 0);

export interface PopulationModel {
  /** 가상 인구 규모(명): 주민등록 인구 ÷ 1,000 */
  base: number;
  /** 연간 자연 증감(명, 출생 − 사망, 1/1,000 규모) */
  driftPerYear: number;
}

/**
 * 가상 인구 모델의 근거 값 (VP1): 주민등록 인구(명), 연간 출생아 수, 연간 사망자 수 — koreaStats의 확인된 지표(접근자)에서 읽는다.
 * 근거 지표가 없거나 어긋나면 throw — 조용히 다른 값을 쓰지 않는다.
 */
export function populationModelInputs(): { registeredPopulation: number; annualBirths: number; annualDeaths: number } {
  const pop = getUsableIndicator('region-population-registered');
  const births = getUsableIndicator('births');
  const cdr = getUsableIndicator('cdr');
  const deaths = cdr?.deaths2025;
  if (pop === undefined || births === undefined || typeof deaths !== 'number') {
    throw new Error('populationModelInputs: 가상 인구의 근거 통계(주민등록 인구·출생아 수·사망자 수)를 koreaStats에서 읽을 수 없다');
  }
  return { registeredPopulation: pop.latest.value, annualBirths: births.latest.value, annualDeaths: deaths };
}

/** 근거 통계(koreaStats)에서 모델 상수를 계산한다. 숫자를 코드에 손으로 적지 않아 근거와 어긋나지 않는다(테스트가 대조). */
export function buildPopulationModel(input: { registeredPopulation: number; annualBirths: number; annualDeaths: number }): PopulationModel {
  return {
    base: Math.round(input.registeredPopulation / 1000),
    driftPerYear: (input.annualBirths - input.annualDeaths) / 1000,
  };
}

let cachedModel: PopulationModel | null = null;

/**
 * 가상 인구 모델. **처음 부를 때 계산한다**(REV-003-M2-1 R-211): 모듈을 불러오는 시점에 계산하면 근거 통계가 깨졌을 때 import가 던져서
 * ErrorBoundary가 못 잡는 흰 화면이 된다. 호출 시점의 오류는 호출한 쪽(렌더)에서 다뤄진다. 실패한 계산은 저장하지 않는다.
 */
export function getPopulationModel(): PopulationModel {
  if (cachedModel === null) cachedModel = buildPopulationModel(populationModelInputs());
  return cachedModel;
}

/** 32비트 정수 해시(murmur3 finalizer 변형) → 0 이상 1 미만 */
function hash01(n: number, salt: number): number {
  let h = (Math.imul(n | 0, 0x9e3779b1) ^ salt) >>> 0;
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35) >>> 0;
  h ^= h >>> 16;
  return (h >>> 0) / 0x100000000;
}

/** 값 잡음 하나: 격자점마다 −1~1의 값을 해시로 정하고 그 사이를 부드럽게(smoothstep) 잇는다 → 연속이고 기울기가 작다. */
function valueNoise(x: number, salt: number): number {
  const i = Math.floor(x);
  const f = x - i;
  const t = f * f * (3 - 2 * f);
  const a = hash01(i, salt) * 2 - 1;
  const b = hash01(i + 1, salt) * 2 - 1;
  return a + (b - a) * t;
}

/** 에포크 분 → 가상 인구(정수). 유한하지 않은 입력은 기준 시각으로 본다. */
export function virtualPopulation(epochMinute: number, model: PopulationModel = getPopulationModel()): number {
  const minute = Number.isFinite(epochMinute) ? Math.floor(epochMinute) : POPULATION_EPOCH_MINUTE;
  const drift = Math.max(-POPULATION_DRIFT_CAP, Math.min(POPULATION_DRIFT_CAP, (model.driftPerYear * (minute - POPULATION_EPOCH_MINUTE)) / MINUTES_PER_YEAR));
  let noise = 0;
  for (const layer of POPULATION_NOISE_LAYERS) noise += layer.amplitude * valueNoise(minute / layer.periodMinutes, layer.salt);
  return Math.round(model.base + drift + noise);
}

/**
 * 화면용: 근거 통계를 읽을 수 없어 모델을 만들 수 없으면 null(던지지 않는다). 첫 화면은 가상 인구 줄만 빼고 그대로 뜬다 —
 * 틀린 값을 대신 보이지 않고, 장식에 가까운 한 줄 때문에 화면 전체가 무너지지도 않게 한다(R-211).
 */
export function tryVirtualPopulation(epochMinute: number): number | null {
  try {
    return virtualPopulation(epochMinute);
  } catch {
    return null;
  }
}
