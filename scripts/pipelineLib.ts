import namesJson from '../src/data/names.json';
import forbiddenJson from '../src/data/forbiddenNames.json';
import scourtJson from '../src/data/sources/scourt-birth-names.json';
import statsJson from '../src/data/koreaStats.json';
import {
  DEFAULT_SETTINGS,
  ERAS,
  STAT_KEYS,
  birthSentence,
  buildRoulette,
  createInitialState,
  createRng,
  createSession,
  estimatePlaySeconds,
  familyOf,
  maxAgeOf,
  parseGame,
  peersOf,
  playToEnd,
  reviewEnding,
  serializeGame,
  sessionReducer,
  type EndingGame,
  type EndingReview,
  type FamilySummary,
  type Era,
  type Gender,
  type GameState,
  type LifeLength,
  type Session,
  type SessionAction,
  type Settings,
  type Stats,
} from '../src/core';
import { EVENT_POOL } from '../src/data/events';
import { FINAL_DISTRIBUTION } from '../src/data/finalDistribution';
import { HISTORY_LIMITS, STATE_LIMITS } from '../src/data/lifeTable';
import { JOURNEY_NOTE, MOVEMENT_TEXT, choiceCountText, deathLineText, journeyText, stageHeadingText, startedAtText } from '../src/data/endingText';
import { READ_SEC } from '../src/data/timingTable';
import { expectedMovement, numbersIn, readBand, readEnd } from './endingReadback';
import { chooserFor, distOf, startLife, type Dist } from './simulateLib';

/**
 * 1000판 전체 파이프라인 (SPEC-001 M6 "1000판 자동 시뮬레이션에서 에러 0건").  테스트(tests/pipeline.test.ts)와 `npm run sim:1000`(scripts/simulate1000.ts)이 함께 쓴다.
 *
 * 한 판 = 화면(UI)이 쓰는 **세션 reducer**(core/session.ts#sessionReducer)로 사람이 누르는 순서 그대로 끝까지 간다:
 *   첫 화면(타이틀) → 세상·인생 길이 고르기 → 태어나기(출생 결과 확정·룰렛) → 출생신고 보기(건너뛰기 포함) → 살아가기(인생 시작) → [한 해씩 진행 / 다음 결정으로 / 선택 / 자동 선택] → 사망(엔딩) → 엔딩 회고(reviewEnding) → 다시 태어나기 → 새 판 출생·첫 결정까지
 * 선택 전략 두 가지: auto = 자동 모드(한 해씩 진행 + 성향 자동 선택), manual = 수동 흉내(무작위 선택, 한 해씩 진행과 "다음 결정으로"를 섞어 쓴다).
 * 난수는 시드 RNG뿐이다(Math.random·Date 없음) — 같은 인자면 같은 판이 나온다.
 *
 * 불변식 위반과 예외는 throw하지 않고 **모아서** 돌려준다(problems). 한 판이 깨져도 나머지 판을 계속 돌려 몇 건이 어디서 깨졌는지 보고하기 위해서다.
 * 점검의 기준은 구현을 거치지 않는 독립 계산이다: 이름은 원자료 JSON을 직접 읽고, 엔딩 문장은 화면에 적힌 숫자만 다시 읽는다(scripts/endingReadback.ts).
 */

export type PipelineStrategy = 'auto' | 'manual';
export const PIPELINE_STRATEGIES: readonly PipelineStrategy[] = ['auto', 'manual'];

// ---------- 독립 기준: 이름 ----------

/** SPEC '시대 선택': 시대별 출생 연도 (구현이 읽는 ERA_CONFIG 표가 아니라 SPEC의 리터럴) */
export const EXPECTED_BIRTH_YEARS: Record<Era, { min: number; max: number }> = {
  past: { min: 1950, max: 1989 },
  present: { min: 2026, max: 2026 }, // 올해(2026) 출생 고정 (SPEC-003 Q1)
  future: { min: 2030, max: 2060 },
};

interface PastPool {
  verified: string[];
  estimated: string[];
}
const names = namesJson as unknown as { surnames: { items: { name: string }[] }; decades: Record<string, Record<Gender, PastPool>> };
const scourt = scourtJson as unknown as { years: Record<string, { M: { name: string }[]; F: { name: string }[] }> };
const forbidden = forbiddenJson as unknown as { names: { name: string }[] };

const SURNAMES: ReadonlySet<string> = new Set(names.surnames.items.map((s) => s.name));
const FORBIDDEN: ReadonlySet<string> = new Set(forbidden.names.map((n) => n.name));
const officialNames = (year: number, gender: Gender): string[] => scourt.years[String(year)][gender === 'male' ? 'M' : 'F'].map((r) => r.name);
const FUTURE_SOURCE_YEARS = [2021, 2022, 2023, 2024, 2025];

/** 출생 연도·성별에 허용되는 이름(성 제외) — 구현의 풀 함수를 거치지 않고 원자료/names.json에서 직접 계산한다. 어느 시대에도 속하지 않는 연도는 null. */
export function allowedGiven(birthYear: number, gender: Gender): string[] | null {
  if (birthYear >= 1950 && birthYear <= 1989) {
    const d = names.decades[String(Math.floor(birthYear / 10) * 10)][gender];
    return [...d.verified, ...d.estimated];
  }
  if (birthYear === 2026) return officialNames(2025, gender); // 지금 세상: 가장 최근 연도(2025) 풀 하나 (EV7 R1)
  if (birthYear >= 2030 && birthYear <= 2060) return [...new Set(FUTURE_SOURCE_YEARS.flatMap((y) => officialNames(y, gender)))];
  return null;
}

// ---------- 독립 기준: 출생신고 상세·룰렛·또래 (koreaStats.json 원자료를 직접 읽는다) ----------

interface RawRegion {
  name: string;
  from: string[];
  sharePct: number;
}
interface RawInd {
  id: string;
  rows?: Array<Record<string, unknown>>;
  eraRegions?: Array<{ kind: 'past' | 'present'; birthYears: [number, number]; regions: RawRegion[] }>;
  regionChanges2026?: { retired: string[]; rows: Array<{ sido: string; name: string; parent?: string }> };
}
const RAW_STATS = (statsJson as unknown as { indicators: RawInd[] }).indicators;
const rawInd = (id: string): RawInd => RAW_STATS.find((i) => i.id === id)!;

/** 출생 연도의 룰렛 지역 목록(원자료 eraRegions에서 직접). 지난 세상은 해당 연대 목록, 지금(2026)·다가올(2030~2060) 세상은 16개 시·도. 시대 밖 연도는 null. */
export function rawRegions(birthYear: number): RawRegion[] | null {
  const eras = rawInd('birth-by-sido').eraRegions!;
  const era = eras.find((e) => birthYear >= e.birthYears[0] && birthYear <= e.birthYears[1] && (e.kind === 'past' || birthYear === 2026 || (birthYear >= 2030 && birthYear <= 2060)));
  return era === undefined ? null : era.regions;
}

/** 이 출생 연도·지역에서 허용되는 시군구 키 「시도|이름」 (원자료에서 직접: 지금·다가올 세상은 2026 개편 반영, 지난 세상은 2025 행정구역을 그 시기 시·도 구분에 맞춰) */
export function rawSigungu(birthYear: number, region: string): Set<string> {
  const regions = rawRegions(birthYear);
  const def = regions?.find((r) => r.name === region);
  const out = new Set<string>();
  if (def === undefined) return out;
  const rows = rawInd('birth-by-sigungu').rows as Array<{ sido: string; name: string }>;
  const changes = rawInd('birth-by-sigungu').regionChanges2026!;
  if (birthYear >= 2026) {
    const retired = new Set(changes.retired);
    const sido2026 = (s: string) => (s === '광주' || s === '전남' ? '전남광주' : s);
    for (const r of rows) if (!retired.has(r.sido + ' ' + r.name) && sido2026(r.sido) === region) out.add(r.sido + '|' + r.name);
    for (const r of changes.rows) if (sido2026(r.sido) === region) out.add(r.sido + '|' + (r.parent === undefined ? r.name : r.parent + ' ' + r.name));
  } else {
    for (const r of rows) if (def.from.includes(r.sido)) out.add(r.sido + '|' + r.name);
  }
  return out;
}

const RAW_JOBS = ['manager', 'professional', 'clerk', 'service', 'sales', 'agri', 'craft', 'machine', 'labor'];
const RAW_HOUSINGS = ['own', 'rent', 'free'];
const SENTENCE_FORMAT = /^\d{4}년 \d{1,2}월, .+의 .+ 가정에서 \d\.\dkg (남자아이|여자아이)로 태어났습니다\. (첫째|둘째|셋째|넷째|다섯째 이상)입니다\. \(\d\.\dkg은 (상위 약 \d+%|하위 약 \d+%|상위 1% 안쪽|하위 1% 안쪽|가운데쯤)\)$/;

// ---------- 독립 기준: 엔딩 ----------

/** 세 시대 × 재력 5단계의 출발선 구간 [low, high] (아래에서부터 센 백분위). 재력 가중치 표(40·32·20·7·1 / 25·30·28·14·3 / 30·28·24·13·5)의 누적을 손으로 계산한 리터럴 — tests/ending.test.ts BANDS와 같다. */
export const EXPECTED_START_BANDS: Record<Era, ReadonlyArray<readonly [low: number, high: number]>> = {
  past: [[0, 40], [40, 72], [72, 92], [92, 99], [99, 100]],
  present: [[0, 25], [25, 55], [55, 83], [83, 97], [97, 100]],
  future: [[0, 30], [30, 58], [58, 82], [82, 95], [95, 100]],
};
/** 구간 밖 여유(점수): tests/ending.test.ts가 BAND_GRACE === 2를 따로 확인한다 */
export const EXPECTED_GRACE = 2;

/** 스무 살(청년 단계 진입, SPEC 생애 단계) 전에 끝난 인생은 도착 자리를 말하지 않는다 */
const INDEPENDENCE_AGE = 20;

const EMOJI = /\p{Extended_Pictographic}/u;
const GRADE_NAMES = /(흙|동|은|금|다이아)\s*수저|다이아/;

/**
 * 분포표(FINAL_DISTRIBUTION)에서 직접 센 도착 점수 (core의 shareAtLeast/standingOf를 부르지 않는다): 이 값 이상 비율 ≤ 50이면 상위(점수 100 - N), 아니면 이 값 **미만** 비율 ≤ 50이면 하위(점수 N, M7e-3 동률 불리),
 * 둘 다 50 초과면 가운데쯤(50). N은 반올림하되 1% 미만은 1 (약 0%를 말하지 않는다).
 */
/** 최종 순자산(만 원)의 도착 점수. 분위수표 101칸에서 직접 센다 — 이 값 이상인 칸 수 ÷ 101 = 이 값 이상 비율. */
export function expectedEndScore(era: Era, wealth: number): number {
  const quantiles = FINAL_DISTRIBUTION[era].quantiles;
  let atLeast = 0;
  let below = 0;
  for (const q of quantiles) {
    if (q >= wealth) atLeast++;
    if (q < wealth) below++;
  }
  const top = (atLeast * 100) / quantiles.length;
  const bottom = (below * 100) / quantiles.length;
  const n = (share: number) => (share < 1 ? 1 : Math.round(share));
  if (top <= 50) return 100 - n(top);
  if (bottom <= 50) return n(bottom);
  return 50;
}

// ---------- 점검 도우미 (위반 목록을 돌려준다) ----------

/** 값이 같은가 (객체·배열 깊게, 키 순서 무관) */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((x, i) => deepEqual(x, b[i]));
  const ka = Object.keys(a as object);
  const kb = Object.keys(b as object);
  if (ka.length !== kb.length) return false;
  return ka.every((k) => Object.prototype.hasOwnProperty.call(b, k) && deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
}

/** 스탯 5개가 모두 0~100 정수 */
export function checkStats(stats: Stats | null, label: string): string[] {
  if (stats === null) return [`${label}: 스탯이 없다`];
  const out: string[] = [];
  for (const k of STAT_KEYS) {
    const v = stats[k];
    if (!Number.isInteger(v) || v < 0 || v > 100) out.push(`${label}: 스탯 ${k}=${v}가 0~100 정수가 아니다`);
  }
  return out;
}

/**
 * 돈 상태 불변식 (SPEC-003 M5 EC1): 20세 미만에는 자산이 없고(집안 살림만 있다), 20세 이상에는 자산이 있고 집안 살림은 0이다.
 * 자산은 모두 정수이고 부채는 0 이상이며 부채가 −순자산보다 작을 수 없다(총자산 net + debt ≥ 0).
 */
export function checkMoney(game: GameState, label: string): string[] {
  const out: string[] = [];
  const young = game.age < 20;
  if (!Number.isInteger(game.familyFund) || Math.abs(game.familyFund) > 3000) out.push(`${label}: 집안 살림 ${game.familyFund}가 ±3000 정수가 아니다`);
  if (young && game.assets !== null) out.push(`${label}: 20세 미만(${game.age}세)인데 자산이 있다`);
  if (!young && game.phase !== 'title' && game.phase !== 'roulette' && game.phase !== 'birth') {
    if (game.assets === null) out.push(`${label}: 20세 이상(${game.age}세)인데 자산이 없다`);
    if (game.familyFund !== 0) out.push(`${label}: 20세 이상인데 집안 살림이 ${game.familyFund}다 (독립 때 자산에 합쳐져 0이어야 한다)`);
  }
  const a = game.assets;
  if (a !== null) {
    for (const k of ['net', 'income', 'debt', 'incomeAdj'] as const) if (!Number.isInteger(a[k])) out.push(`${label}: 자산 ${k}=${a[k]}가 정수가 아니다`);
    if (a.debt < 0) out.push(`${label}: 부채 ${a.debt}가 음수다`);
    if (a.debt < -a.net) out.push(`${label}: 부채 ${a.debt}가 -순자산 ${-a.net}보다 작다 (총자산 < 0)`);
    if (a.income < 0) out.push(`${label}: 연 소득 ${a.income}가 음수다`);
  }
  return out;
}

/** 이름(성+이름)·출생 연도·성별이 시대의 풀과 100% 맞고 금지 이름이 아니다 */
export function checkCharacterName(era: Era, name: string, birthYear: number, gender: Gender): string[] {
  const out: string[] = [];
  const range = EXPECTED_BIRTH_YEARS[era];
  if (!Number.isInteger(birthYear) || birthYear < range.min || birthYear > range.max) out.push(`출생 연도 ${birthYear}가 ${era} 범위(${range.min}~${range.max}) 밖이다`);
  if (!/^[가-힣]{3,4}$/.test(name)) out.push(`이름 "${name}"이 한글 3~4자가 아니다`);
  const surname = name.slice(0, 1);
  const given = name.slice(1);
  if (!SURNAMES.has(surname)) out.push(`성 "${surname}"이 성씨 표에 없다 (${name})`);
  const allowed = allowedGiven(birthYear, gender);
  if (allowed === null) out.push(`${birthYear}년생은 어느 시대에도 속하지 않는다 (${name})`);
  else if (!allowed.includes(given)) out.push(`이름 "${given}"이 ${birthYear}년 ${gender} 풀에 없다 (${name})`);
  if (FORBIDDEN.has(name)) out.push(`금지 이름 ${name}이 나왔다`);
  if (given.length > 0 && given[0] === surname) out.push(`성과 이름 첫 글자가 같은 조합 ${name}`);
  return out;
}

/**
 * 출생 결과(룰렛 단계)의 출생신고 상세·룰렛·또래를 원자료 기준으로 독립 점검한다(SPEC-003 BR2~BR4·RL2·VP3). 구현의 접근자·표를 거치지 않는다.
 *  - 월 1~12, 지역은 원자료 eraRegions 목록 안, 시군구는 원자료에서 만든 후보 안, 부모 나이·직업·주거·체중 격자·형제 순서가 범위 안
 *  - 룰렛: 멈출 자리 = 저장된 결과(RL2), 확률표 합 = 정확히 100(수저 정수 %, 지역 소수 1자리), 지역 확률은 원자료 sharePct
 *  - 서술문: 형식(BR3)이 맞고 수저 이름·구간이 없다. 또래 4명: 이름이 시대 풀과 100% 일치·서로 겹치지 않음·주인공과도 다름, 지역·시군구·수저가 유효
 */
export function checkBirthReport(game: GameState, where: string): string[] {
  const out: string[] = [];
  const bad = (msg: string) => out.push(`${where}: ${msg}`);
  const c = game.character;
  const r = game.birthReport;
  if (c === null || r === null || game.era === null) return [`${where}: 출생 결과가 비어 있다`];
  if (game.peerSeed === null || !Number.isInteger(game.peerSeed)) bad('또래 시드가 없다');
  if (!Number.isInteger(r.month) || r.month < 1 || r.month > 12) bad(`출생 월 ${r.month}`);
  const regions = rawRegions(c.birthYear);
  if (regions === null) return [...out, `${where}: ${c.birthYear}년생의 룰렛 지역 목록이 원자료에 없다`];
  if (!regions.some((x) => x.name === r.region)) bad(`지역 ${r.region}이 룰렛 목록에 없다`);
  if (!rawSigungu(c.birthYear, r.region).has(`${r.sigunguSido}|${r.sigungu}`)) bad(`시군구 ${r.sigunguSido} ${r.sigungu}이 ${r.region}의 후보가 아니다`);
  for (const [who, p] of [['어머니', r.mother], ['아버지', r.father]] as const) {
    if (!Number.isInteger(p.age) || p.age < 16 || p.age > 56) bad(`${who} 나이 ${p.age}`);
    if (!RAW_JOBS.includes(p.job)) bad(`${who} 직업 ${p.job}`);
  }
  if (!RAW_HOUSINGS.includes(r.housing)) bad(`주거 ${r.housing}`);
  const tenth = Math.round(r.birthWeightKg * 10);
  if (tenth < 10 || tenth > 49 || Math.abs(r.birthWeightKg * 10 - tenth) > 1e-9) bad(`체중 ${r.birthWeightKg}kg이 0.1kg 격자(1.0~4.9) 밖이다`);
  if (!Number.isInteger(r.birthOrder) || r.birthOrder < 1 || r.birthOrder > 5) bad(`형제 순서 ${r.birthOrder}`);

  // 점검 하나가 예외로 끊기지 않게(지역이 목록에 없어 룰렛을 못 만드는 등) 예외도 위반으로 모아서 알린다
  const guard = (label: string, f: () => void): void => {
    try {
      f();
    } catch (e) {
      bad(`${label}: 예외 ${(e as Error).message}`);
    }
  };
  const era = game.era;

  // 룰렛(RL2·RL3)
  guard('룰렛', () => {
    const view = buildRoulette(era, c, r);
    if (view.wealthIndex !== c.parentWealth - 1) bad(`룰렛 수저 멈출 자리 ${view.wealthIndex} ≠ 출생 결과 ${c.parentWealth - 1}`);
    if (view.regionOdds[view.regionIndex]?.name !== r.region) bad(`룰렛 지역 멈출 자리가 출생 결과 ${r.region}와 다르다`);
    if (view.wealthOdds.reduce((a2, o) => a2 + o.percent, 0) !== 100) bad('수저 확률표 합이 100이 아니다');
    if (view.regionOdds.reduce((a2, o) => a2 + Math.round(o.percent * 10), 0) !== 1000) bad('지역 확률표 합이 100.0이 아니다');
    if (view.regionOdds.length !== regions.length) bad(`지역 확률표 칸 수 ${view.regionOdds.length} ≠ 원자료 ${regions.length}`);
    for (const o of view.regionOdds) if (Math.abs(o.percent - regions.find((x) => x.name === o.name)!.sharePct) > 1e-9) bad(`지역 확률 ${o.name} ${o.percent}이 원자료 비율과 다르다`);
    if (view.basis !== (era === 'present' ? 'statistic-derived' : 'design')) bad(`지역 확률의 성격(basis) ${view.basis}`);
  });

  // 서술문(BR3)
  guard('서술문', () => {
    const sentence = birthSentence(c, r, era);
    if (!SENTENCE_FORMAT.test(sentence)) bad(`서술문 형식이 다르다: ${sentence}`);
    if (/수저|다이아|분위/.test(sentence) || /[!！]/.test(sentence)) bad(`서술문에 등급명·소득 분위·느낌표가 있다: ${sentence}`);
  });

  // 또래(VP3)
  const peerSeed = game.peerSeed;
  if (peerSeed !== null) {
    guard('또래', () => {
      const peers = peersOf(peerSeed, c.birthYear, r.month, c.name);
      if (!deepEqual(peers, peersOf(peerSeed, c.birthYear, r.month, c.name))) bad('같은 시드인데 또래가 다르다');
      if (peers.length !== 4) bad(`또래 수 ${peers.length}`);
      const names = new Set<string>([c.name]);
      for (const p of peers) {
        if (names.has(p.name)) bad(`또래 이름 ${p.name}이 겹친다`);
        names.add(p.name);
        for (const msg of checkCharacterName(era, p.name, c.birthYear, p.gender)) bad(`또래: ${msg}`);
        if (!regions.some((x) => x.name === p.region)) bad(`또래 지역 ${p.region}`);
        if (!rawSigungu(c.birthYear, p.region).has(`${p.sigunguSido}|${p.sigungu}`)) bad(`또래 시군구 ${p.sigungu}`);
        if (![1, 2, 3, 4, 5].includes(p.wealth)) bad(`또래 수저 ${p.wealth}`);
      }
    });
  }
  return out;
}

/**
 * 가족 정합 규칙 (SPEC-003 BR6·CM9, REV-003-M3-1 R-272)의 판 끝 점검. **이벤트 데이터의 조건 값을 읽지 않고** 여기에 규칙을 따로 적어 독립으로 대조한다 —
 * 데이터의 조건이 빠지거나 틀리면 이 점검이 잡는다. 규칙(출생신고 상세 `birthReport`와 연표 `history`로 본다):
 *  - 부모 병환(middle-parents-care): 일어난 나이에 두 부모 중 나이 많은 쪽이 60~100세 / 임종(middle-parents-farewell): 65~100세
 *  - 동생이 생겼다(infant-new-sibling): 형제 순서가 첫째이고, 그때 어머니(출생 때 나이 + 아이 나이)가 45세 이하
 *  - 사별 플래그(parents_gone)가 있으면 임종 사건이 연표에 있다
 *  - 연표 0세 첫 줄(출생신고 서술문)이 말하는 형제 순서 = 저장된 형제 순서
 *  - 식구 카드의 위 형제: 가장 위 형제와의 누적 나이 차는 「어머니의 출생 때 나이 − 최소 첫 출산 나이(16)」 이하이고 형제마다 나이 차가 2살 이상이며 (R-330),
 *    **위 형제 수는 형제 순서 − 1(최대 4)과 같다** — 출생 생성기가 어머니 나이를 형제 순서에 맞게(위 형제 수 ≤ ⌊(어머니 나이 − 16) / 2⌋, 즉 둘째 18세·셋째 20세·넷째 22세·다섯째 이상 24세 이상) 만들기 때문이다 (R-330 r3)
 * applied = 실제로 대조한 규칙 수(공허 통과 방지 — 이벤트가 하나도 안 나온 판만 보면 0이다).
 */
const ORDER_WORDS = ['첫째', '둘째', '셋째', '넷째', '다섯째 이상'] as const; // 형제 순서 1~5의 서술문 낱말 (구현의 표를 읽지 않고 따로 적었다)
export const FAMILY_RULES = {
  olderParentAtEvent: { 'middle-parents-care': [60, 100], 'middle-parents-farewell': [65, 100] } as Readonly<Record<string, readonly [number, number]>>,
  siblingMotherMax: 45,
  /** 어머니가 첫 아이를 낳을 수 있는 가장 어린 나이(구현의 상수를 읽지 않고 따로 적었다) */
  motherMinFirstBirth: 16,
  /** 위 형제 사이의 가장 작은 나이 차(살) */
  minSiblingGap: 2,
  /** 위 형제 수의 상한(형제 순서 5 = 「다섯째 이상」은 4명) */
  maxOlderSiblings: 4,
} as const;

export function checkFamilyRules(game: GameState, where: string, family?: FamilySummary): { problems: string[]; applied: number } {
  const problems: string[] = [];
  let applied = 0;
  const bad = (msg: string) => problems.push(`${where}: ${msg}`);
  const r = game.birthReport;
  if (r === null) return { problems: [`${where}: 출생신고 상세가 없어 가족 규칙을 점검할 수 없다`], applied };
  const older = (age: number) => Math.max(r.mother.age, r.father.age) + age;
  for (const h of game.history) {
    if (h.eventId === undefined) continue;
    const range = FAMILY_RULES.olderParentAtEvent[h.eventId];
    if (range !== undefined) {
      applied++;
      const o = older(h.age);
      if (o < range[0] || o > range[1]) bad(`${h.eventId}가 ${h.age}세에 일어났는데 나이 많은 부모는 ${o}세다(허용 ${range[0]}~${range[1]}세, 출생 때 어머니 ${r.mother.age}·아버지 ${r.father.age})`);
    }
    if (h.eventId === 'infant-new-sibling') {
      applied++;
      if (r.birthOrder !== 1) bad(`동생이 생겼다 사건인데 형제 순서가 ${r.birthOrder}번째다`);
      const mother = r.mother.age + h.age;
      if (mother > FAMILY_RULES.siblingMotherMax) bad(`동생이 생겼다가 ${h.age}세에 일어났는데 어머니는 ${mother}세다(${FAMILY_RULES.siblingMotherMax}세 이하여야 한다)`);
    }
  }
  if (game.flags.includes('parents_gone')) {
    applied++;
    if (!game.history.some((h) => h.eventId === 'middle-parents-farewell')) bad('사별(parents_gone)인데 임종 사건이 연표에 없다');
  }
  // 식구 카드의 위 형제 (R-330): 누적 나이 차가 어머니의 첫 출산 한도 안이다. 첫째는 위 형제가 없어 대조할 것이 없다(applied에 세지 않는다)
  const olderSiblings = (family ?? familyOf(game)).siblings.filter((s) => s.older);
  // 위 형제 수 = 형제 순서 − 1(최대 4) — 같아야 한다(R-330 r3). 어머니가 그 순서를 낳기엔 어렸다면(둘째 18세·셋째 20세·넷째 22세·다섯째 이상 24세 미만) 생성기가 모순을 만든 것이다
  const wantedOlder = Math.min(FAMILY_RULES.maxOlderSiblings, r.birthOrder - 1);
  const minMother = FAMILY_RULES.motherMinFirstBirth + FAMILY_RULES.minSiblingGap * wantedOlder;
  if (olderSiblings.length !== wantedOlder) bad(`위 형제가 ${olderSiblings.length}명인데 형제 순서는 ${r.birthOrder}번째다(위 형제 ${wantedOlder}명이어야 한다, 출생 때 어머니 ${r.mother.age}세)`);
  if (r.mother.age < minMother) bad(`형제 순서가 ${r.birthOrder}번째(위 형제 ${wantedOlder}명)인데 어머니는 출생 때 ${r.mother.age}세다(${minMother}세 이상이어야 한다: 첫 출산 ${FAMILY_RULES.motherMinFirstBirth}세 + 터울 ${FAMILY_RULES.minSiblingGap}살 × ${wantedOlder})`);
  if (olderSiblings.length > 0 || wantedOlder > 0) {
    applied++;
    let prevGap = 0;
    for (const s of olderSiblings) {
      if (s.gap - prevGap < FAMILY_RULES.minSiblingGap) bad(`위 형제 사이 나이 차 ${s.gap - prevGap}살 < ${FAMILY_RULES.minSiblingGap}살`);
      prevGap = s.gap;
    }
    if (olderSiblings.length > 0) {
      const farthest = olderSiblings[olderSiblings.length - 1].gap;
      if (farthest > r.mother.age - FAMILY_RULES.motherMinFirstBirth) bad(`가장 위 형제와 나이 차 ${farthest}살인데 어머니는 출생 때 ${r.mother.age}세다(첫 출산 ${r.mother.age - farthest}세 < ${FAMILY_RULES.motherMinFirstBirth}세)`);
    }
  }
  const first = game.history[0]?.text ?? '';
  applied++;
  if (!first.includes(`${ORDER_WORDS[r.birthOrder - 1]}입니다.`)) bad(`연표 첫 줄의 형제 순서가 저장된 형제 순서(${ORDER_WORDS[r.birthOrder - 1]})와 다르다: ${first}`);
  return { problems, applied };
}

/** 한 걸음 전후의 불변식. kind: 한 해씩(advance/choose/autoChoose)이면 'single', 다음 결정으로(skip)면 'skip' */
export function checkTransition(prev: GameState, next: GameState, kind: 'single' | 'skip', where: string): string[] {
  const out: string[] = [];
  const bad = (msg: string) => out.push(`${where}: ${msg}`);
  out.push(...checkStats(next.stats, where));
  out.push(...checkMoney(next, where));
  if (next.era !== prev.era) bad(`시대가 바뀌었다 ${prev.era} → ${next.era}`);
  if (next.seed !== prev.seed) bad('시드가 바뀌었다');
  const pc = prev.character;
  const nc = next.character;
  if (pc === null || nc === null) bad('캐릭터가 없다');
  else if (nc.name !== pc.name || nc.gender !== pc.gender || nc.birthYear !== pc.birthYear || nc.parentWealth !== pc.parentWealth || nc.parenting !== pc.parenting || nc.looks !== pc.looks) bad('캐릭터가 바뀌었다');
  if (!deepEqual(next.birthStats, prev.birthStats)) bad('출생 스냅샷이 바뀌었다');
  if (!deepEqual(next.birthReport, prev.birthReport) || next.peerSeed !== prev.peerSeed) bad('출생신고 상세·또래 시드가 바뀌었다');
  // 나이: 줄지 않고, 한 해씩이면 최대 +1
  if (next.age < prev.age) bad(`나이가 줄었다 ${prev.age} → ${next.age}`);
  if (kind === 'single' && next.age - prev.age > 1) bad(`한 걸음에 나이가 ${next.age - prev.age}살 올랐다`);
  // 연표: 상한 이하, 줄지 않음(상한에서는 같다), 나이가 거꾸로 가지 않음, 나이가 현재 나이 이하
  if (next.history.length > HISTORY_LIMITS.maxEntries) bad(`연표 ${next.history.length}줄이 상한 ${HISTORY_LIMITS.maxEntries}을 넘었다`);
  if (next.history.length < prev.history.length) bad('연표가 줄었다');
  for (let i = 0; i < next.history.length; i++) {
    const h = next.history[i];
    if (i > 0 && h.age < next.history[i - 1].age) bad('연표 나이가 거꾸로 간다');
    if (h.age > next.age) bad(`연표 항목의 나이 ${h.age}가 현재 나이 ${next.age}보다 크다`);
    if (h.text.length === 0) bad('연표 항목의 본문이 비어 있다');
  }
  if (next.history.length > 0 && (next.history[0].kind !== 'stage' || next.history[0].age !== 0)) bad('연표 첫 줄이 출생 기록이 아니다');
  // 플래그·본 이벤트
  if (next.flags.length > STATE_LIMITS.maxFlags || new Set(next.flags).size !== next.flags.length) bad('플래그 개수·중복 이상');
  const seenIds = Object.keys(next.seen);
  if (seenIds.length > STATE_LIMITS.maxSeen) bad('본 이벤트 수가 상한을 넘었다');
  for (const id of seenIds) if (next.seen[id] > next.age) bad(`본 이벤트 ${id}의 나이가 현재 나이보다 크다`);
  // 단계별 정합: life는 사망 정보가 없고 대기가 맞다, ending은 사망 정보가 맞고 대기가 없다
  if (next.phase === 'life') {
    if (next.death !== null) bad('인생 중인데 사망 정보가 있다');
    if (next.pending !== null) {
      const p = next.pending;
      const ev = EVENT_POOL.byId.get(p.eventId);
      if (p.age !== next.age) bad(`대기 나이 ${p.age} ≠ 현재 나이 ${next.age}`);
      if (p.key !== `${p.eventId}@${p.age}`) bad(`대기 키 불일치 ${p.key}`);
      if (ev === undefined || ev.choices === undefined) bad(`대기 중인 이벤트 ${p.eventId}가 풀의 선택지 이벤트가 아니다`);
      else {
        const known = new Set(ev.choices.map((c) => c.id));
        if (!p.choiceIds.every((id) => known.has(id))) bad('대기 선택지가 이벤트의 것이 아니다');
      }
      if (p.choiceIds.length < 2 || p.choiceIds.length > 3 || new Set(p.choiceIds).size !== p.choiceIds.length) bad(`선택지 수 ${p.choiceIds.length}`);
      if (next.seen[p.eventId] !== p.age) bad('대기 이벤트가 본 이벤트에 기록되지 않았다');
      if (next.lastChoiceAge !== p.age) bad('마지막 선택지 나이가 대기 나이와 다르다');
    }
  } else if (next.phase === 'ending') {
    if (next.pending !== null) bad('엔딩인데 대기 중인 선택지가 있다');
    if (next.death === null) bad('엔딩인데 사망 정보가 없다');
    else {
      if (next.death.age !== next.age) bad(`사망 나이 ${next.death.age} ≠ 나이 ${next.age}`);
      if (next.era !== null && next.death.age > maxAgeOf(next.era)) bad(`사망 나이 ${next.death.age}가 시대 상한 ${maxAgeOf(next.era)}을 넘었다`);
      if (next.death.cause.length === 0) bad('사망 원인이 비어 있다');
    }
    const last = next.history[next.history.length - 1];
    if (last === undefined || last.kind !== 'death') bad('연표 마지막이 사망 기록이 아니다');
    if (next.history.filter((h) => h.kind === 'death').length !== 1) bad('사망 기록이 하나가 아니다');
  } else {
    bad(`인생 중 단계가 ${next.phase}로 바뀌었다`);
  }
  return out;
}

/** 저장 검증: 직렬화 → 복원이 같은 상태를 돌려준다. 복원한 상태(같은 값)를 함께 돌려준다. */
export function roundTrip(state: GameState, where: string): { restored: GameState; problems: string[] } {
  const restored = parseGame(serializeGame(state));
  if (restored === null) return { restored: state, problems: [`${where}: 저장 검증(parseGame)을 통과하지 못했다 (phase ${state.phase})`] };
  if (!deepEqual(restored, state)) return { restored: state, problems: [`${where}: 저장→복원한 상태가 원래 상태와 다르다 (phase ${state.phase})`] };
  return { restored, problems: [] };
}

/** 엔딩 문구 한 줄이 지켜야 할 규칙 (느낌표·이모지·등급명). 숫자 규칙은 출발선 대비 문장에만 따로 건다. */
function checkPlainText(text: string, where: string): string[] {
  const out: string[] = [];
  if (/[!！]/.test(text)) out.push(`${where}: 느낌표가 있다 "${text}"`);
  if (EMOJI.test(text)) out.push(`${where}: 이모지가 있다 "${text}"`);
  if (GRADE_NAMES.test(text)) out.push(`${where}: 등급명이 있다 "${text}"`);
  return out;
}

/**
 * 엔딩 한 벌의 점검(review는 점검 대상 회고 — 기본은 reviewEnding(game), 테스트가 일부러 틀린 회고를 넣어 점검이 잡는지 본다): 회고가 사실과 맞고, 화면에 나가는 문장이 규칙을 지키며, 출발선 대비 문장의 숫자와 판정이 서로 맞는다.
 *  - 출발선 구간: 문장에서 읽은 구간 = 판정에 쓰는 band = 가중치 표에서 손으로 계산한 구간
 *  - 도착 점수: 문장에서 읽은 점수 = 분포표를 직접 세어 구한 점수
 *  - 방향: 문장에서 읽은 숫자로 다시 정한 방향 = reviewEnding의 방향 (구간 안이면 비슷함, 밖은 여유 2점 이내까지 비슷함 — 천장·바닥 쪽은 여유 0)
 *  - 문장 규칙: 느낌표·이모지·등급명 없음, 출발선 대비 문장의 모든 숫자는 1~50, 약 0%·약 100%·0~·~100 없음
 */
export function checkEnding(game: EndingGame, where: string, review: EndingReview = reviewEnding(game)): string[] {
  const out: string[] = [];
  const bad = (msg: string) => out.push(`${where}: ${msg}`);
  const era = game.era;
  const j = review.journey;
  const expectedBand = EXPECTED_START_BANDS[era][game.character.parentWealth - 1];

  if (j.kind !== (game.death.age < INDEPENDENCE_AGE ? 'early' : 'compared')) bad(`사망 나이 ${game.death.age}인데 회고가 ${j.kind}이다`);
  const text = journeyText(j);
  out.push(...checkPlainText(text, `${where} 출발선 대비`));
  for (const p of numbersIn(text)) if (p < 1 || p > 50) bad(`출발선 대비 문장에 1~50 밖의 숫자 ${p}: ${text}`);
  if (/약 (0|100)%|(^|[^\d])0~|~100|100%/.test(text)) bad(`출발선 대비 문장에 0·100 끝값: ${text}`);

  let label: string;
  let endLabel: string | null = null;
  if (j.kind === 'early') {
    const m = /^(.+)의 집에서 태어났습니다\.$/.exec(text);
    if (m === null) {
      bad(`20세 전 사망 문장의 모양이 다르다: ${text}`);
      return out;
    }
    label = m[1];
  } else {
    const m = /^(.+)의 집에서 태어나, (.+)의 형편으로 생을 마쳤습니다\.$/.exec(text);
    if (m === null) {
      bad(`출발선 대비 문장의 모양이 다르다: ${text}`);
      return out;
    }
    label = m[1];
    endLabel = m[2];
  }
  let read: [number, number];
  try {
    read = readBand(label);
  } catch (e) {
    bad((e as Error).message);
    return out;
  }
  if (read[0] !== j.start.low || read[1] !== j.start.high) bad(`문구에서 읽은 구간 [${read}]이 판정에 쓰는 band [${j.start.low}, ${j.start.high}]와 다르다: ${text}`);
  if (read[0] !== expectedBand[0] || read[1] !== expectedBand[1]) bad(`문구에서 읽은 구간 [${read}]이 ${era} ${game.character.parentWealth}단계의 구간 [${expectedBand}]과 다르다: ${text}`);

  if (j.kind === 'compared' && endLabel !== null) {
    let end: number;
    try {
      end = readEnd(endLabel);
    } catch (e) {
      bad((e as Error).message);
      return out;
    }
    const want = expectedEndScore(era, game.assets?.net ?? 0);
    if (end !== want) bad(`문구에서 읽은 도착 점수 ${end}가 분포표에서 직접 센 ${want}와 다르다 (최종 순자산 ${game.assets?.net ?? 0}만 원): ${text}`);
    const movement = expectedMovement(read[0], read[1], end, EXPECTED_GRACE);
    if (movement !== j.movement) bad(`숫자와 판정이 어긋난다: ${text} → ${MOVEMENT_TEXT[j.movement]} (문장의 숫자로는 ${MOVEMENT_TEXT[movement]})`);
    out.push(...checkPlainText(MOVEMENT_TEXT[j.movement], `${where} 방향 문장`));
  }

  // 나머지 회고: 처음 → 마지막 원값, 선택 수, 연표
  if (review.changes.length !== 3) bad(`처음 → 마지막 항목이 ${review.changes.length}개다`);
  for (const c of review.changes) {
    if (c.from !== game.birthStats[c.stat] || c.to !== game.stats[c.stat]) bad(`${c.stat}: 처음·마지막 값이 상태와 다르다`);
    out.push(...checkPlainText(startedAtText(c.from), `${where} ${c.stat}`));
  }
  if (review.choiceCount !== game.history.filter((h) => h.kind === 'choice').length) bad('선택 수가 연표의 선택 기록 수와 다르다');
  if (!deepEqual(review.timeline.flatMap((g) => g.entries), game.history)) bad('연표를 단계별로 묶으면 항목이 빠지거나 순서가 바뀐다');
  out.push(...checkPlainText(deathLineText(game.death), `${where} 사망 줄`));
  out.push(...checkPlainText(choiceCountText(review.choiceCount), `${where} 선택 수 줄`));
  out.push(...checkPlainText(JOURNEY_NOTE, `${where} 안내`));
  for (const g of review.timeline) out.push(...checkPlainText(stageHeadingText(g.stage), `${where} 단계 제목`));
  for (const h of game.history) {
    const line = `${h.title ?? ''} ${h.text} ${h.choice ?? ''}`;
    if (/[!！]/.test(line) || EMOJI.test(line)) bad(`연표에 느낌표·이모지가 있다: ${line}`);
  }
  // 같은 이벤트가 두 번 나오지 않는다 (한 판에 한 번만)
  const ids = game.history.filter((h) => h.eventId !== undefined).map((h) => h.eventId!);
  if (new Set(ids).size !== ids.length) bad('연표에 같은 이벤트가 두 번 나온다');
  return out;
}

// ---------- 한 판 ----------

export interface PipelineOptions {
  seed: number;
  era: Era;
  strategy: PipelineStrategy;
  /** true면 매 걸음 저장→복원을 하고 복원한 상태로 이어간다(새로고침을 매 걸음 한 것과 같다). false면 단계가 바뀌는 지점·선택지·엔딩에서만 저장 검증한다. */
  stepSerialize: boolean;
}

export interface PipelineLife {
  seed: number;
  era: Era;
  strategy: PipelineStrategy;
  /** 이 판의 불변식 위반·예외 (비어 있으면 통과) */
  problems: string[];
  /** 예외로 끊겼는가 */
  threw: boolean;
  name: string;
  deathAge: number;
  choices: number;
  steps: number;
  minutes1x: number;
  minutesFast: number;
  journey: 'early' | 'up' | 'same' | 'down' | 'none';
  /** 점검 횟수 (보고용) */
  checks: { names: number; roundTrips: number; transitions: number; duplicateInputs: number; rebirths: number; endingTexts: number; familyRules: number };
}

/** 시드 → 파이프라인 시드: 시대·전략마다 서로 다른 시드 줄을 쓴다(uint32) */
export function pipelineSeed(i: number, era: Era, strategy: PipelineStrategy): number {
  const salt = (ERAS.indexOf(era) * 2 + PIPELINE_STRATEGIES.indexOf(strategy)) * 1000003;
  return (i * 2654435761 + 12345 + salt) >>> 0;
}

const SETTINGS: Settings = { ...DEFAULT_SETTINGS, speed: 8, autoMode: false };

/**
 * 한 판을 처음(타이틀)부터 끝(다시 태어나기 뒤 새 판의 첫 결정)까지 세션 reducer로 돌리며 점검한다.
 * 안전장치: 진행이 MAX_STEPS 걸음을 넘으면 끊는다.
 */
export function runPipelineLife(opts: PipelineOptions): PipelineLife {
  const { seed, era, strategy, stepSerialize } = opts;
  const auto = strategy === 'auto';
  const problems: string[] = [];
  const checks = { names: 0, roundTrips: 0, transitions: 0, duplicateInputs: 0, rebirths: 0, endingTexts: 0, familyRules: 0 };
  const tag = `${era}/${strategy} 시드 ${seed}`;
  const result: PipelineLife = { seed, era, strategy, problems, threw: false, name: '', deathAge: -1, choices: 0, steps: 0, minutes1x: 0, minutesFast: 0, journey: 'none', checks };
  const MAX_STEPS = 1500;

  try {
    // 인생 길이는 시드 짝홀로 두 값을 모두 돈다(LM1: 판을 시작할 때 정해져 판에 고정된다).
    // 「약 1시간」(long60)은 지금 고를 수 없어 reducer의 setLifeLength가 무시한다(REV-003-M2-2) — 그래서 두 값 모두 **설정에 이미 들어 있는 값**으로 시작해
    // core의 출생·인생·엔딩·저장이 두 값 모두에서 에러 없이 도는지(M8이 long60을 열 때를 대비) 계속 본다. 고르는 입력 자체는 short30일 때만 따로 확인한다(아래 2번).
    const lifeLength: LifeLength = seed % 2 === 0 ? 'short30' : 'long60';
    let session: Session = createSession(createInitialState(seed), { ...SETTINGS, autoMode: auto, lifeLength });
    let settings0 = session.settings;
    const send = (action: SessionAction, label: string): Session => {
      const next = sessionReducer(session, action);
      if (next === session) problems.push(`${tag} ${label}: 입력이 적용되지 않았다`);
      return next;
    };
    const keep = (state: GameState, label: string): GameState => {
      const r = roundTrip(state, `${tag} ${label}`);
      checks.roundTrips++;
      problems.push(...r.problems);
      return stepSerialize ? r.restored : state; // 매 걸음 모드에서는 복원한 상태로 이어간다
    };

    // 1. 첫 화면(타이틀): 출생 전에는 인생을 진행하거나 첫 화면 이동·이어하기를 하는 입력이 모두 무시된다
    if (session.game.phase !== 'title') problems.push(`${tag}: 새 게임이 타이틀이 아니다 (${session.game.phase})`);
    if (session.game.era !== null || session.game.lifeLength !== null) problems.push(`${tag}: 새 게임에 세상·인생 길이가 이미 정해져 있다`);
    for (const a of [{ type: 'enterLife' }, { type: 'enterBirth' }, { type: 'finishSpin' }, { type: 'advance', fromAge: 0 }, { type: 'skip' }, { type: 'resume' }, { type: 'openTitle' }, { type: 'beginNew', seed: 1 }] as const) {
      if (sessionReducer(session, a) !== session) problems.push(`${tag}: 타이틀에서 ${a.type} 입력이 무시되지 않았다`);
    }
    session = { ...session, game: keep(session.game, '첫 화면') };
    // 2. 세상·인생 길이 고르기 (지금 세상·약 30분은 기본 선택 그대로 확정하는 판도 있다 — 기본값이면 입력이 바뀌는 것이 없다)
    if (era !== session.settings.era) {
      session = send({ type: 'setEra', era }, '세상 고르기');
      if (session.settings.era !== era) problems.push(`${tag}: 고른 세상이 설정에 반영되지 않았다`);
    }
    if (lifeLength !== session.settings.lifeLength) {
      session = send({ type: 'setLifeLength', lifeLength }, '인생 길이 고르기');
      if (session.settings.lifeLength !== lifeLength) problems.push(`${tag}: 고른 인생 길이가 설정에 반영되지 않았다`);
    }
    // 고를 수 없는 값(약 1시간)을 눌러도 설정이 바뀌지 않는다 — 이미 long60이 들어 있던 설정에서도 같은 객체다(REV-003-M2-2 reducer 규칙)
    if (lifeLength === 'long60' && sessionReducer(session, { type: 'setLifeLength', lifeLength: 'long60' }) !== session) problems.push(`${tag}: 고를 수 없는 인생 길이 입력이 무시되지 않았다`);
    if (lifeLength === 'short30') {
      const rejected = sessionReducer(session, { type: 'setLifeLength', lifeLength: 'long60' });
      if (rejected !== session) problems.push(`${tag}: 고를 수 없는 인생 길이(long60)가 설정에 들어갔다`);
    }
    settings0 = session.settings;
    // 3. 태어나기(출생): 연타해도 한 번만 일어난다. 이 순간 출생 결과가 정해져 저장되고 룰렛 화면(roulette)이 연출 중(spin)으로 시작한다(RL5)
    session = send({ type: 'begin' }, '태어나기');
    if (sessionReducer(session, { type: 'begin' }) !== session) problems.push(`${tag}: 태어나기 연타가 같은 객체를 돌려주지 않았다`);
    const rolled = session.game;
    if (rolled.phase !== 'roulette' || !session.spin || rolled.era !== era || rolled.lifeLength !== lifeLength || rolled.character === null) {
      problems.push(`${tag}: 룰렛 상태가 이상하다 (phase ${rolled.phase}, spin ${session.spin}, era ${rolled.era}, 인생 길이 ${rolled.lifeLength})`);
      return finish();
    }
    // 룰렛: 출생신고 상세·룰렛 결과·또래를 원자료 기준으로 점검(RL2·BR2~BR4·VP3)하고, 룰렛 도중 새로고침해도 결과가 같고 연출 중이 아니다(RL5)
    problems.push(...checkBirthReport(rolled, `${tag} 룰렛`));
    const reloaded = parseGame(serializeGame(rolled));
    const resumed = reloaded === null ? null : createSession(reloaded, session.settings);
    if (resumed === null || resumed.spin || !deepEqual(resumed.game, rolled)) problems.push(`${tag}: 룰렛 도중 새로고침한 상태가 연출 중이거나 결과가 다르다`);
    // 연출 중에는 「출생신고 보기」가 무시되고, 건너뛰기(연타 포함)는 한 번만 동작하며, 다시 굴리기는 없다
    if (sessionReducer(session, { type: 'enterBirth' }) !== session) problems.push(`${tag}: 연출 중 「출생신고 보기」가 무시되지 않았다`);
    if (sessionReducer(session, { type: 'enterLife' }) !== session) problems.push(`${tag}: 룰렛에서 「살아가기」가 무시되지 않았다`);
    session = { ...session, game: keep(session.game, '룰렛') };
    session = send({ type: 'finishSpin' }, '건너뛰기');
    if (session.game !== rolled && !deepEqual(session.game, rolled)) problems.push(`${tag}: 건너뛰기가 출생 결과를 바꿨다`);
    if (sessionReducer(session, { type: 'finishSpin' }) !== session) problems.push(`${tag}: 건너뛰기 연타가 같은 객체를 돌려주지 않았다`);
    if (sessionReducer(session, { type: 'begin' }) !== session) problems.push(`${tag}: 룰렛 중 「태어나기」(다시 굴리기)가 무시되지 않았다`);
    session = send({ type: 'enterBirth' }, '출생신고 보기');
    if (sessionReducer(session, { type: 'enterBirth' }) !== session) problems.push(`${tag}: 「출생신고 보기」 연타가 같은 객체를 돌려주지 않았다`);
    const birth = session.game;
    if (birth.phase !== 'birth' || !deepEqual(birth.character, rolled.character) || !deepEqual(birth.birthReport, rolled.birthReport) || birth.peerSeed !== rolled.peerSeed) {
      problems.push(`${tag}: 출생신고 상태가 이상하다 (phase ${birth.phase}) — 출생 결과가 룰렛과 같아야 한다`);
      return finish();
    }
    if (birth.character === null) return finish();
    const nameProblems = checkCharacterName(era, birth.character.name, birth.character.birthYear, birth.character.gender);
    checks.names++;
    problems.push(...nameProblems.map((p) => `${tag}: ${p}`));
    problems.push(...checkStats(birth.stats, `${tag} 출생 스탯`));
    if (!deepEqual(birth.stats, birth.birthStats)) problems.push(`${tag}: 출생 스냅샷이 출생 스탯과 다르다`);
    if (birth.character.looks < 0 || birth.character.looks > 100) problems.push(`${tag}: 외모 ${birth.character.looks}`);
    result.name = birth.character.name;
    session = { ...session, game: keep(session.game, '출생 화면') };
    // 4. 인생 시작
    session = send({ type: 'enterLife' }, '인생 시작');
    if (session.game.phase !== 'life' || session.game.history.length !== 1) problems.push(`${tag}: 인생 시작 상태가 이상하다`);
    else if (session.game.birthReport !== null && session.game.character !== null && session.game.history[0].text !== birthSentence(session.game.character, session.game.birthReport, era)) {
      problems.push(`${tag}: 인생 기록 0세 첫 줄이 출생신고의 한 줄 서술문과 다르다`);
    }
    session = { ...session, game: keep(session.game, '인생 시작') };

    // 5. 인생: 한 걸음씩
    const chooser = chooserFor('random', seed)!; // 수동 흉내의 선택 (playToEnd 기준 실행과 같은 수열)
    const pace = createRng(seed ^ 0x51ed270b); // 한 해씩 / 다음 결정으로를 섞는 입력 (선택과 별개)
    let step = 0;
    for (; session.game.phase === 'life'; step++) {
      if (step >= MAX_STEPS) {
        problems.push(`${tag}: 진행이 ${MAX_STEPS}걸음을 넘도록 끝나지 않는다`);
        return finish();
      }
      const g = session.game;
      let action: SessionAction;
      let kind: 'single' | 'skip' = 'single';
      if (g.pending !== null) {
        action = auto ? { type: 'autoChoose', key: g.pending.key } : { type: 'choose', key: g.pending.key, choiceId: chooser(g)! };
      } else if (auto || pace.next() < 0.25) {
        action = { type: 'advance', fromAge: g.age };
      } else {
        action = { type: 'skip' };
        kind = 'skip';
      }
      const before = session;
      session = send(action, `걸음 ${step}(${action.type})`);
      checks.transitions++;
      problems.push(...checkTransition(g, session.game, kind, `${tag} 나이 ${g.age} 걸음 ${step}(${action.type})`));
      // 연타·이중 실행: 같은 입력을 한 번 더 보내도 아무 일이 없다 (같은 세션 객체)
      checks.duplicateInputs++;
      if (sessionReducer(session, action) !== session) problems.push(`${tag} 나이 ${g.age}: 같은 ${action.type} 입력을 한 번 더 보내자 상태가 바뀌었다`);
      if (session === before) break; // 적용되지 않았다 — 무한 루프 방지
      if (stepSerialize || session.game.pending !== null || session.game.phase !== 'life') session = { ...session, game: keep(session.game, `걸음 ${step}`) };
    }
    result.steps = step;
    const ended = session.game;
    if (ended.phase !== 'ending' || ended.death === null || ended.character === null || ended.era === null || ended.birthStats === null) {
      problems.push(`${tag}: 사망(엔딩)에 도달하지 못했다 (phase ${ended.phase})`);
      return finish();
    }
    result.deathAge = ended.death.age;
    // 가족 정합(BR6·R-272): 부모 병환·임종 시점의 부모 나이, 동생 사건 ⇒ 첫째·어머니 나이, 사별 ⇒ 임종 사건, 연표 첫 줄의 형제 순서
    const family = checkFamilyRules(ended, `${tag} 가족 규칙`);
    checks.familyRules += family.applied;
    problems.push(...family.problems);

    // 6. 기준 실행과 같은 결과: 세션 reducer 경로 = playToEnd 경로 (같은 시드·같은 선택)
    const reference = playToEnd(startLife(seed, era, { lifeLength }), auto ? null : chooserFor('random', seed));
    if (!deepEqual(reference.state, ended)) problems.push(`${tag}: 세션 reducer로 간 인생이 playToEnd로 간 인생과 다르다`);
    result.choices = reference.counts.choice;
    result.minutes1x = estimatePlaySeconds(reference.counts, { speed: 1, skipToDecision: false }, READ_SEC.median) / 60;
    result.minutesFast = estimatePlaySeconds(reference.counts, { speed: 8, skipToDecision: true }, READ_SEC.median) / 60;
    problems.push(...checkStats(ended.stats, `${tag} 최종 스탯`));

    // 7. 엔딩 회고 + 엔딩 저장 복원
    const endingGame = ended as EndingGame;
    checks.endingTexts++;
    problems.push(...checkEnding(endingGame, `${tag} 엔딩`));
    const restored = roundTrip(ended, `${tag} 엔딩 저장`);
    checks.roundTrips++;
    problems.push(...restored.problems);
    if (restored.problems.length === 0 && !deepEqual(reviewEnding(restored.restored as EndingGame), reviewEnding(endingGame))) problems.push(`${tag}: 복원한 엔딩의 회고가 다르다`);
    const review = reviewEnding(endingGame);
    result.journey = review.journey.kind === 'early' ? 'early' : review.journey.movement;
    // 엔딩에서는 진행·선택 입력이 모두 무시된다
    for (const a of [{ type: 'advance', fromAge: ended.age }, { type: 'skip' }, { type: 'autoChoose', key: 'x@1' }, { type: 'enterLife' }, { type: 'begin' }, { type: 'resume' }, { type: 'openTitle' }] as const) {
      if (sessionReducer(session, a) !== session) problems.push(`${tag}: 엔딩에서 ${a.type} 입력이 무시되지 않았다`);
    }

    // 8. 다시 태어나기: 새 시드, 첫 화면에서 시작, 설정(세상·인생 길이 포함)은 그대로, 연타는 같은 객체
    const newSeed = (seed * 48271 + 11) >>> 0;
    const reborn = sessionReducer(session, { type: 'rebirth', seed: newSeed });
    checks.rebirths++;
    if (reborn === session) problems.push(`${tag}: 다시 태어나기가 적용되지 않았다`);
    else {
      if (!deepEqual(reborn.game, createInitialState(newSeed))) problems.push(`${tag}: 다시 태어난 상태가 새 시드의 첫 화면이 아니다`);
      if (reborn.settings !== settings0 && !deepEqual(reborn.settings, settings0)) problems.push(`${tag}: 다시 태어나도 설정이 그대로여야 한다`);
      if (reborn.tick !== null) problems.push(`${tag}: 다시 태어난 뒤 tick이 남아 있다`);
      if (sessionReducer(reborn, { type: 'rebirth', seed: newSeed + 1 }) !== reborn) problems.push(`${tag}: 다시 태어나기 연타가 같은 객체를 돌려주지 않았다`);
      for (const a of [{ type: 'enterLife' }, { type: 'skip' }, { type: 'advance', fromAge: 0 }, { type: 'resume' }] as const) {
        if (sessionReducer(reborn, a) !== reborn) problems.push(`${tag}: 첫 화면에서 ${a.type} 입력이 첫 화면을 건너뛰었다`);
      }
      checks.roundTrips++;
      problems.push(...roundTrip(reborn.game, `${tag} 다시 태어난 직후`).problems);
      // 새 판: 같은 시대로 태어나 첫 결정(또는 사망)까지 간다
      let next: Session = reborn;
      const go = (a: SessionAction, label: string) => {
        const n = sessionReducer(next, a);
        if (n === next) problems.push(`${tag} 새 판 ${label}: 입력이 적용되지 않았다`);
        next = n;
      };
      go({ type: 'begin' }, '태어나기');
      const born = next.game;
      if (born.phase !== 'roulette' || !next.spin || born.era !== era || born.lifeLength !== lifeLength || born.character === null) problems.push(`${tag}: 새 판 출생 상태가 이상하다(고른 세상·인생 길이가 그대로 이어져야 하고 룰렛이 다시 돈다)`);
      else {
        checks.names++;
        problems.push(...checkBirthReport(born, `${tag} 새 판 룰렛`));
        problems.push(...checkCharacterName(era, born.character.name, born.character.birthYear, born.character.gender).map((p) => `${tag} 새 판: ${p}`));
        problems.push(...checkStats(born.stats, `${tag} 새 판 출생 스탯`));
        if (born.seed !== newSeed) problems.push(`${tag}: 새 판의 시드가 넘긴 시드가 아니다`);
      }
      go({ type: 'finishSpin' }, '건너뛰기');
      go({ type: 'enterBirth' }, '출생신고 보기');
      go({ type: 'enterLife' }, '인생 시작');
      for (let k = 0; k < MAX_STEPS && next.game.phase === 'life' && next.game.pending === null; k++) {
        const prev = next.game;
        const n = sessionReducer(next, { type: 'advance', fromAge: prev.age });
        if (n === next) {
          problems.push(`${tag} 새 판: 진행이 적용되지 않았다`);
          break;
        }
        next = n;
        checks.transitions++;
        problems.push(...checkTransition(prev, next.game, 'single', `${tag} 새 판 나이 ${prev.age}`));
      }
    }
  } catch (e) {
    result.threw = true;
    problems.push(`${tag}: 예외 ${(e as Error).message}`);
  }
  return finish();

  function finish(): PipelineLife {
    return result;
  }
}

// ---------- 여러 판 ----------

export interface CellReport {
  era: Era;
  strategy: PipelineStrategy;
  lives: number;
  /** 불변식 위반이 하나라도 있는 판 수 */
  failedLives: number;
  /** 예외로 끊긴 판 수 */
  exceptions: number;
  /** 위반·예외 메시지 (앞 20개) */
  problems: string[];
  /** 위반·예외 메시지 총 개수 */
  problemCount: number;
  deathAge: Dist;
  choices: Dist;
  minutes1x: Dist;
  minutesFast: Dist;
  checks: PipelineLife['checks'];
  /** 판 단위 결과: 20세 전 사망 / 앞섬 / 비슷함 / 뒤쪽 판 수 */
  journeys: Record<'early' | 'up' | 'same' | 'down' | 'none', number>;
  distinctNames: number;
  /** 매 걸음 저장→복원을 한 판 수 */
  stepSerializedLives: number;
}

export interface PipelineParams {
  /** 시대·전략마다 판 수 */
  lives: number;
  eras?: readonly Era[];
  strategies?: readonly PipelineStrategy[];
  /** 이 간격의 판(i % every === 0)은 매 걸음 저장→복원 (0이면 없음) */
  stepSerializeEvery?: number;
  /** 판마다 호출 (진행 표시용) */
  onLife?: (life: PipelineLife) => void;
}

export function runPipelineCell(era: Era, strategy: PipelineStrategy, params: PipelineParams): CellReport {
  const every = params.stepSerializeEvery ?? 0;
  const lives: PipelineLife[] = [];
  for (let i = 1; i <= params.lives; i++) {
    const life = runPipelineLife({ seed: pipelineSeed(i, era, strategy), era, strategy, stepSerialize: every > 0 && i % every === 0 });
    lives.push(life);
    params.onLife?.(life);
  }
  const checks = { names: 0, roundTrips: 0, transitions: 0, duplicateInputs: 0, rebirths: 0, endingTexts: 0, familyRules: 0 };
  const journeys = { early: 0, up: 0, same: 0, down: 0, none: 0 };
  const problems: string[] = [];
  let problemCount = 0;
  for (const l of lives) {
    for (const k of Object.keys(checks) as Array<keyof typeof checks>) checks[k] += l.checks[k];
    journeys[l.journey]++;
    problemCount += l.problems.length;
    for (const p of l.problems) if (problems.length < 20) problems.push(p);
  }
  const done = lives.filter((l) => l.deathAge >= 0);
  const dist = (f: (l: PipelineLife) => number): Dist => distOf(done.length > 0 ? done.map(f) : [0]);
  return {
    era,
    strategy,
    lives: lives.length,
    failedLives: lives.filter((l) => l.problems.length > 0).length,
    exceptions: lives.filter((l) => l.threw).length,
    problems,
    problemCount,
    deathAge: dist((l) => l.deathAge),
    choices: dist((l) => l.choices),
    minutes1x: dist((l) => l.minutes1x),
    minutesFast: dist((l) => l.minutesFast),
    checks,
    journeys,
    distinctNames: new Set(lives.map((l) => l.name)).size,
    stepSerializedLives: every > 0 ? Math.floor(params.lives / every) : 0,
  };
}

export function runPipeline(params: PipelineParams): CellReport[] {
  const out: CellReport[] = [];
  for (const era of params.eras ?? ERAS) for (const strategy of params.strategies ?? PIPELINE_STRATEGIES) out.push(runPipelineCell(era, strategy, params));
  return out;
}
