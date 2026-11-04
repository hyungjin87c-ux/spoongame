import { ERA_BAND_RULES } from '../data/sceneTables';
import { FAMILY_TAG } from './familyModel';
import { famHash01 } from './familyRng';

/**
 * 「시대의 창」 — 그해를 대표하는 장면 그림 한 장과 인생 기록의 「시대의 창」 줄 (SPEC-009 FM5, FT1~FT6, `docs/data/family-model.md` 9절, `docs/design/family-scene.md` 5절, `docs/design/era-window.md` 3-1·8-2절).
 *
 *  - 창에는 **그림만** 있다(FM2d). 그해를 나타내는 문장 `line`은 접근 이름이자 인생 기록의 `data-tl="era"` 줄이다.
 *  - **승인한 것만 데이터에 들어온다**(FT3, RG11 방식): `EraWindow.approved`의 타입이 `true`뿐이라 `false`를 쓰면 `npm run typecheck`(= build의 첫 단계)가 막고, `tests/eraWindows.test.ts`가 데이터 파일을 한 번 더 점검한다.
 *    FM5b에서 형진 님이 승인한 43장(r3 15 + 1987년 12월 1 + r4 27)이, 시대의 창 r5 반영(2026-11-02)에서 나머지 51장(r5 40 + r5b 11 = 합 94장)이 들어왔다(`scripts/genEraWindows.ts`가 designer 조각에서 `data/eraWindows/d<10년대>.ts`를 만든다). 승인된 그림이 없는 해의 창은 빈 틀이다.
 *  - 순수 함수다(`Date`·`Math.random` 없음): 한 해에 후보가 둘이면 `famHash01(판 시드, ERA, 연도, salt)`로 하나 — 같은 판에서는 늘 같은 그림이다.
 *    사건이 둘이면 무거운 쪽, 사건이 없는 해는 그 10년 일상 중 수저 구간(`band`)·나이대(`ages`)에 맞는 것이고 같은 그림을 3해 연속 쓰지 않는다(그 10년의 첫 해부터 같은 규칙으로 걸어와 정한다).
 *    사건에도 수저 구간 분기가 있다(era-window.md 10-1절, 2009년 세 갈래): 같은 구간의 `band` 사건 → `band` 없는 사건(무거운 쪽 먼저) → 일상(구간 변주 먼저). 가운데 구간은 `band` 사건을 보지 않는다.
 *  - 인생 기록의 시대 줄은 **저장하지 않는 파생 줄**이다(A-12): 인생 기록을 그릴 때 해마다 `eraOf`로 만든다. 그래서 판 길이 모델·`yearLineCount`·저장 크기에 닿지 않는다.
 *
 * **SPEC-010 미래 연표 (코어)**: 표는 2026~2109년으로 이어진다(`ERA_LAST_YEAR` 2109). 2026년 이후도 1940~2025년과 같은 순서로 그해 표를 따른다 — 사건(수저 구간 `band` 사건 먼저) → 그 10년의 일상 → 기본 장면.
 *  - 2025 세트를 반복하지 않는다(옛 「전망 구간」 규칙은 SPEC-010이 대체했다). 2110년은 끝 줄 한 번, 2111년부터는 끝 장면(그림만)이다 — `eraOf`의 `endPick`.
 *  - **승인된 그림이 아직 없는 해**(데이터가 오지 않은 10년대, 받지 못한 덩어리)의 창은 **빈 틀**이고 인생 기록에는 그 해의 줄이 없다. 2025 세트로 돌아가지 않는다 — 돌아가면 받지 못한 덩어리가 「예측」 줄처럼 보이는 거짓이 된다.
 *    (옛 동작: 2026년 이후는 2025년의 일상 한 세트를 해마다 되풀이했고 QA-009-FM4b F01이 그 쌓임을 짚었다. 지금 실제 데이터는 2020년대 덩어리까지라 2030년 이후 창이 비는 것이 의도한 중간 상태다 — 2026~2029년은 사건이 오기 전까지 2020년대 일상을 본다.)
 *  - 나이 규칙(FU2): 일상은 기본이 `ages` 없음(사회 현상)이다. 고르기 4단계(나이를 풀어서 그 10년의 아무 일상)는 2026년 이후 해에 닿으면 안 된다 — 그 10년·구간에 `ages` 없는 일상 2장 이상이 있으면 닿지 않고, `tests/eraFuture.test.ts`가 해·나이·구간 전수로 지킨다.
 */

export type EraKind = 'event' | 'daily' | 'base';
/** 수저 구간: 아래 둘(흙·동수저) / 가운데 / 위 둘(은·금수저) — 계층 변주 그림이 어느 구간에게 보이는가 (era-window.md 8-2) */
export type EraBand = 'low' | 'mid' | 'high';
/** 2027년 이후 장면의 근거 종류 (SPEC-010 구현 규칙 4): 공식 전망 바탕 / 전문가 전망 바탕 / 가상 시나리오. 화면 글은 `data/sceneText.ts`(FU3) */
export type EraBasis = 'official' | 'expert' | 'scenario';

/**
 * 예측 근거 한 건 (SPEC-010 FU11 「예측 근거 보기」): 인생 기록 시대 줄의 근거 종류 글자를 펼치면 나오는 한 줄 — 「사람 · 직함 · 자료 · 연도: 자기 말 요약」.
 * 규칙(「예측 근거 규칙」): 실제로 한 말만 · 자기 말 요약만(직접 인용 0) · 기관 글은 기관 이름으로 · 게임의 해와 발언의 해가 다르면 `gap`에 그 차이를 적는다. 사람·회사 이름은 **이 칸에만** 쓰이고
 * 시대 줄·그림에는 없다. 출처 주소는 게임 안에 두지 않는다(`docs/data/future-foresight-quotes.md`). 글은 10년 덩어리에 함께 실려 초기 로드에 들어가지 않는다.
 */
export interface EraForesightNote {
  /** 사람 또는 기관 이름 (기관 글은 기관 이름) */
  who: string;
  /** 직함·소속 */
  role: string;
  /** 자료 이름(종류 포함) — 책·논문·기사 제목은 「」로 감싼다 */
  work: string;
  /** 자료가 나온 해 */
  year: number;
  /** 자기 말 요약(합쇼체, 인용부호 없음) */
  said: string;
  /** 다른 매체가 전한 내용을 바탕으로 한 요약이면 true — 칸에 「보도 기준」을 적는다 */
  reported?: true;
  /** 게임 줄과 어긋나는 점(해가 다르거나 범위가 다른 것). 합쇼체 한두 문장 */
  gap?: string;
  /** 줄과 반대 쪽을 가리키는 근거(노화·의식 이전에는 한 건 필수) — 칸에 「반대 근거」 표시 */
  counter?: true;
}

export interface EraForesight {
  /** 한두 건. 비면 이 객체를 두지 않는다(근거 종류 글자만 보인다) */
  notes: readonly EraForesightNote[];
  /** 부유한 쪽이 먼저 누린다는 장면(수저별 「먼저」 줄) — 칸 끝에 「수저별 차이는 게임의 설정입니다.」를 덧붙인다 */
  byBand?: true;
}

export interface EraWindow {
  id: string;
  /** 사건은 [연도, 연도], 생활 장면은 같은 10년 안의 범위 */
  years: readonly [number, number];
  /** event 그해의 사건 · daily 그 시대의 생활 장면 · base 사건·시대 주장이 없는 기본 장면 */
  kind: EraKind;
  topic: string;
  /** SPEC-004 부록 A 연표 사건 코드 (kind가 event일 때) */
  hCode?: string;
  /** 지역 사건(부록 B)이면 시도 줄임 이름 */
  regionKey?: string;
  /** 인생 기록 줄의 문장 = 칸의 접근 이름 = 말풍선 글. ≤ `ERA_LINE_MAX`자, 평가어 없음 */
  line: string;
  /** 재난·정치에 가까운 무거운 장면 — 「무거운 장면 가리기」 대상 (경제·감염병은 대상 밖, 형진 님 결정) */
  heavy: boolean;
  /** 형진 님 사건별 승인 + reviewer 판독을 거친 것만 데이터에 들어온다 */
  approved: true;
  /** 그림 조각 id (40×32 좌표계) — 같은 10년대 파일의 `art`에 마크업이 있다 */
  draw: string;
  /**
   * 계층 변주: 이 수저 구간(low·high)의 플레이어에게만 보인다. 없으면 모든 구간 (`mid`는 변주를 보지 않는다).
   * 일상(`daily`)은 그 구간에게 먼저 보이는 변주이고, **사건(`event`)에도 쓴다**(2009년: 철거 현장 low · 첫 스마트폰 high, era-window.md 10-1절) — 그 구간의 플레이어는 같은 해의 `band` 없는 사건 대신 이것을 본다.
   */
  band?: 'low' | 'high';
  /** 나이대 [처음, 마지막] (일상 장면). 없으면 모두 */
  ages?: readonly [number, number];
  /**
   * 근거 종류 (SPEC-010). 2027~2109년 장면에는 **필수**(`tests/eraFuture.test.ts`가 잡는다), 2026년(사실)·끝 장면·2025년 이하에는 없다.
   * 근거가 약해 확실성이 「낮음」인 것 단독은 출처가 공식·전문가여도 `scenario`로 내려 적는다(SPEC-010 「표기 규칙」). 글꼴 조각 밖 글자는 소스에 쓰지 않는다(주석 포함) — `tests/fonts.test.tsx`가 센다.
   */
  basis?: EraBasis;
  /**
   * 예측 근거 보기 글 (SPEC-010 FU11). 2027년 이후 장면에만, 근거 후보가 있는 장면에만 있다(후보 없는 줄은 근거 종류 글자만). 생성 파일이 `scripts/eraForesightNotes.ts`에서 싣는다.
   */
  foresight?: EraForesight;
}

/** 시대 줄 문장의 글자 수 상한 (360px에서 2줄 안 — 본문 16px) */
export const ERA_LINE_MAX = 22;
/**
 * 시대의 창 표가 있는 해의 범위 (SPEC-010): 1940~2109. 2109년은 2100년대 10년 덩어리가 끝나는 해이고, **2110년은 끝 줄 한 번**, 2111년부터는 끝 장면(그림만)이다.
 * 승인된 묶음까지만 담는 부분 배포는 하지 않는다(마스터 M3) — 그래서 이 값을 낮추는 일은 없다.
 */
export const ERA_FIRST_YEAR = 1940;
export const ERA_LAST_YEAR = 2109;
export const ERA_FIRST_DECADE = 1940;
export const ERA_LAST_DECADE = 2100;
/**
 * 실제로 일어난 마지막 해 (SPEC-010): 2026년까지는 사실이라 「예측」 칩이 없고, 2027년부터 2109년까지의 줄이 「예측」이다(`EraRow.forecast`).
 * 시대의 창 한정 값이다 — SPEC-004의 경제 `LAST_ACTUAL_YEAR`(2025)와는 별개다(마스터 M4). 해가 바뀌어 사실이 늘면 이 값만 올린다.
 */
export const ERA_ACTUAL_LAST_YEAR = 2026;

/** 「예측」으로 표시하는 해 (SPEC-010 구현 규칙 4): `ERA_ACTUAL_LAST_YEAR`보다 뒤이고 표 안(`ERA_LAST_YEAR` 이하)이다. 2110년의 끝 줄과 끝 장면은 예측이 아니라 안내다. 칩·창 표·미래 톤은 **그림이 아니라 해**로 정한다 */
export const isForecastYear = (year: number): boolean => year > ERA_ACTUAL_LAST_YEAR && year <= ERA_LAST_YEAR;

export interface EraContext {
  /** 출생 시도 줄임 이름 — 지역 사건 후보를 가린다 */
  regionKey: string;
  /** 「무거운 장면 가리기」(설정 `gentle`) */
  gentle: boolean;
  /** 가족 시드 (`famSeedOf`) */
  seed: number;
  /** 지금까지 받은 시대의 창 데이터(10년 덩어리의 합) */
  windows: readonly EraWindow[];
  /** 출생 연도 — 있으면 해마다 나이를 알아 나이대(`ages`)에 맞는 일상을 고른다. 없으면 나이대를 보지 않는다 */
  birthYear?: number;
  /** 수저 구간(`bandOfWealth`) — 없으면 가운데 */
  band?: EraBand;
}

/** 부모 재력 5단계 → 수저 구간: 1·2 아래 · 3 가운데 · 4·5 위 (설계값, 경계는 `data/sceneTables.ts#ERA_BAND_RULES`) */
export function bandOfWealth(wealth: number): EraBand {
  return wealth <= ERA_BAND_RULES.lowMaxWealth ? 'low' : wealth >= ERA_BAND_RULES.highMinWealth ? 'high' : 'mid';
}

export interface EraPick {
  /** 칸에 띄울 그림. 없으면 빈 틀 */
  pic: EraWindow | null;
  /** 인생 기록 줄의 문장을 낳는 장면(가린 해에는 가려진 무거운 장면 자체). 없으면 줄이 없다 */
  line: EraWindow | null;
  /** `line`이 무거운 장면이고 가리기가 켜져 있다 — 칸은 그림 없이(또는 그해 일상으로), 줄은 가리기 부품이 문장을 가린다 */
  veiled: boolean;
  /** 후보를 찾은 해 (2110 뒤는 `ERA_LAST_YEAR` — 끝 장면) */
  sourceYear: number;
}

const inYears = (w: EraWindow, y: number): boolean => w.approved === true && y >= w.years[0] && y <= w.years[1];
const idOrder = (a: EraWindow, b: EraWindow): number => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/** 10년 덩어리 번호: 1940~2109 → 1940·…·2100 (그 앞·2110 뒤는 가장자리 10년대) */
export function eraDecadeOf(calYear: number): number {
  const d = Math.floor(Math.min(Math.max(calYear, ERA_FIRST_YEAR), ERA_LAST_YEAR) / 10) * 10;
  return Math.min(Math.max(d, ERA_FIRST_DECADE), ERA_LAST_DECADE);
}

/** 후보가 둘 이상이면 id 순으로 늘어놓고 해시로 하나 (같은 판 → 같은 그림) */
function pickOne(cands: readonly EraWindow[], seed: number, calYear: number, salt: number): EraWindow | null {
  if (cands.length === 0) return null;
  const sorted = [...cands].sort(idOrder);
  return sorted[Math.min(sorted.length - 1, Math.floor(famHash01(seed, FAMILY_TAG.ERA, calYear, salt) * sorted.length))];
}

/** 사건이 둘 이상이면 무거운 쪽만 남긴다 (era-window.md 3-1 ①: 1987 6월 > 12월 투표소) */
function heavyFirst(list: readonly EraWindow[]): readonly EraWindow[] {
  const heavy = list.filter((w) => w.heavy);
  return heavy.length > 0 ? heavy : list;
}

/** 직전 두 해에 같은 그림이 이어졌으면 그 그림은 이번에 쓰지 않는다(같은 그림 3해 연속 금지) */
const wouldRepeat = (w: EraWindow, recent: readonly string[]): boolean => recent.length === 2 && recent[0] === w.id && recent[1] === w.id;

/**
 * 사건이 없는 해(또는 가리기로 무거운 사건을 바꾸는 해)의 일상 그림. 그 10년의 일상 후보를 차례로 본다(era-window.md 8-2):
 *  ① 수저 구간 변주(`band`가 플레이어 구간과 같은 것) → ② 그해를 덮는 일상 → ③ 그 10년의 다른 일상 → ④ 나이대를 풀어서 그 10년의 일상. 각 단계에서 나이대(`ages`)에 맞고 3해 연속이 되지 않는 것만 쓴다.
 * 단계 안에서 후보가 둘 이상이면 시드로 하나. `calm`이면 무거운 일상은 쓰지 않는다. 일상이 없으면 기본 장면(`base`), 그것도 없으면 null.
 * SPEC-010 FU2: 2026년 이후 해는 ④(나이를 풀어서 고름)에 닿으면 안 된다 — 어린이에게 어른의 개인 행동 줄이 나오기 때문이다. 코드가 막지 않고 **데이터가 막는다**: 그 10년에 `band`도 `ages`도 없는 일상이 2장 이상이면
 * ③에서 늘 새 그림이 나온다(`tests/eraFuture.test.ts`가 해·나이·구간 전수로 닿음 0을 확인). 2025년 이하 해의 동작은 그대로다.
 */
function dailyPick(y: number, ctx: EraContext, recent: readonly string[], calm: boolean, age: number | null): EraWindow | null {
  const decade = Math.floor(y / 10) * 10;
  const ok = (w: EraWindow): boolean => w.approved === true && (!calm || !w.heavy);
  const inDecade = ctx.windows.filter((w) => w.kind === 'daily' && ok(w) && w.years[0] <= decade + 9 && w.years[1] >= decade);
  const ageOk = (w: EraWindow): boolean => w.ages === undefined || age === null || (age >= w.ages[0] && age <= w.ages[1]);
  const band = ctx.band ?? 'mid';
  const plain = inDecade.filter((w) => w.band === undefined);
  const tiers: Array<readonly EraWindow[]> = [
    band === 'mid' ? [] : inDecade.filter((w) => w.band === band && ageOk(w)),
    plain.filter((w) => inYears(w, y) && ageOk(w)),
    plain.filter(ageOk),
    plain,
  ];
  let repeated: readonly EraWindow[] | null = null;
  for (const tier of tiers) {
    if (tier.length === 0) continue;
    const fresh = tier.filter((w) => !wouldRepeat(w, recent));
    if (fresh.length > 0) return pickOne(fresh, ctx.seed, y, 2);
    repeated ??= tier;
  }
  if (repeated !== null) return pickOne(repeated, ctx.seed, y, 2);
  return pickOne(
    ctx.windows.filter((w) => w.kind === 'base' && ok(w) && inYears(w, y)),
    ctx.seed,
    y,
    3,
  );
}

/** 사건 후보에서 하나: 출생 시도의 지역 사건 먼저, 없으면 전국 사건. 각각 무거운 쪽 먼저, 둘 다 무겁지 않으면 시드로 하나 */
function pickEvent(pool: readonly EraWindow[], regionKey: string, seed: number, y: number): EraWindow | null {
  const regional = pool.filter((w) => w.regionKey !== undefined && w.regionKey === regionKey);
  const national = pool.filter((w) => w.regionKey === undefined);
  return pickOne(heavyFirst(regional), seed, y, 1) ?? pickOne(heavyFirst(national), seed, y, 1);
}

/** 한 해의 고르기. `recent`는 걸어오며 정해진 직전 두 해의 그림 id. 2026년 이후도 같은 순서다(SPEC-010 — 「2026년 이후는 사건을 쓰지 않는다」 분기를 없앴다) */
function stepPick(y: number, ctx: EraContext, recent: readonly string[]): EraPick {
  const age = ctx.birthYear === undefined ? null : y - ctx.birthYear;
  const live = ctx.windows.filter((w) => inYears(w, y));
  const events = live.filter((w) => w.kind === 'event');
  // 사건의 수저 구간 분기(era-window.md 10-1절): `band` 없는 사건은 모두가 보고, `band`가 있는 사건은 그 구간만 본다(가운데 구간은 `band` 사건을 보지 않는다)
  const band = ctx.band ?? 'mid';
  const seen = events.filter((w) => w.band === undefined || w.band === band);
  const sameBand = seen.filter((w) => w.band !== undefined);
  const plainEvents = seen.filter((w) => w.band === undefined);
  // ① 같은 구간의 `band` 사건 → ② `band` 없는 사건(무거운 쪽 먼저)
  const chosenEvent = pickEvent(sameBand, ctx.regionKey, ctx.seed, y) ?? pickEvent(plainEvents, ctx.regionKey, ctx.seed, y);
  if (chosenEvent !== null) {
    if (ctx.gentle && chosenEvent.heavy) {
      // 같은 해에 무겁지 않은 사건 그림이 따로 있으면(1987년: 6월 시위 ↔ 12월 투표소) 가린 해의 대체 그림으로 쓴다(FM5b 마스터 결정 2026-10-28). 줄은 가려진 무거운 사건 그대로다. 없으면 그 10년의 (무겁지 않은) 일상
      const calmEvents = seen.filter((w) => !w.heavy);
      const alt = pickOne(calmEvents.filter((w) => w.regionKey !== undefined && w.regionKey === ctx.regionKey), ctx.seed, y, 4) ?? pickOne(calmEvents.filter((w) => w.regionKey === undefined), ctx.seed, y, 4);
      return { pic: alt ?? dailyPick(y, ctx, recent, true, age), line: chosenEvent, veiled: true, sourceYear: y };
    }
    return { pic: chosenEvent, line: chosenEvent, veiled: false, sourceYear: y };
  }
  const chosen = dailyPick(y, ctx, recent, false, age);
  if (chosen === null) return { pic: null, line: null, veiled: false, sourceYear: y };
  if (ctx.gentle && chosen.heavy) return { pic: dailyPick(y, ctx, recent, true, age), line: chosen, veiled: true, sourceYear: y };
  return { pic: chosen, line: chosen, veiled: false, sourceYear: y };
}

/**
 * 그해의 창. 고르는 순서(era-window.md 3-1·8-2·10-1): ① 내 수저 구간의 `band` 사건(2009년 철거 현장·첫 스마트폰) ② `band` 없는 사건 — 출생 시도의 지역 사건 먼저, 전국 연표 사건(둘이면 무거운 쪽) ③ 그 10년의 일상(수저 구간 변주 먼저, 나이대, 같은 그림 3해 연속 금지) ④ 기본 장면 — 승인된 후보만.
 * 가운데 구간은 ①을 보지 않는다(`band` 사건은 아래·위 구간에게만). 2026~2109년도 이 순서 그대로다(SPEC-010) — 승인된 후보가 없는 해(데이터가 안 온 10년대)는 빈 틀이다.
 * 가리기(`gentle`)가 켜져 있고 고른 장면이 `heavy`이면 `veiled`: 칸에는 그해의 (무겁지 않은) 일상을 띄우고 — 없으면 빈 틀 — 인생 기록 줄은 `.veil` 부품이 문장을 가린다.
 * 「3해 연속 금지」는 상태 없이 정한다: 그 10년의 첫 해부터 해마다 같은 규칙으로 걸어와 직전 두 해의 그림을 안다(같은 입력 → 같은 출력).
 * 표 끝 뒤(2110~)는 걸어오지 않고 `endPick`이 정한다.
 */
export function eraOf(calYear: number, ctx: EraContext): EraPick {
  if (calYear > ERA_LAST_YEAR) return endPick(calYear, ctx);
  let start = Math.max(ERA_FIRST_YEAR, Math.floor(calYear / 10) * 10);
  if (calYear < start) start = calYear;
  let recent: string[] = [];
  let pick: EraPick = { pic: null, line: null, veiled: false, sourceYear: calYear };
  for (let y = start; y <= calYear; y++) {
    pick = stepPick(y, ctx, recent);
    recent = [...recent, pick.pic?.id ?? ''].slice(-2);
  }
  return { ...pick, sourceYear: calYear };
}

/**
 * 표 끝 뒤의 해(`calYear > ERA_LAST_YEAR`, SPEC-010 구현 규칙 3): 창은 끝 장면(`kind: 'base'`, 승인된 것 중 그해를 덮는 것) 한 장, 줄은 **`ERA_LAST_YEAR + 1`년에만** 그 장면의 문장 한 줄 — 2111년부터는 줄이 없다
 * (`eraRowsOf`는 `line`이 null인 해를 건너뛴다). 끝 줄·끝 장면에는 칩이 없다. 끝 장면이 아직 오지 않았거나 못 받았으면 빈 틀이다(다른 빈 틀과 같은 동작). 무겁지 않아 가리기와 무관하다.
 */
function endPick(calYear: number, ctx: EraContext): EraPick {
  const end = pickOne(
    ctx.windows.filter((w) => w.kind === 'base' && inYears(w, calYear)),
    ctx.seed,
    calYear,
    3,
  );
  return { pic: end, line: end !== null && calYear === ERA_LAST_YEAR + 1 ? end : null, veiled: false, sourceYear: ERA_LAST_YEAR };
}

export interface EraRow {
  /** 줄 id의 뒤쪽: `log-y<year>` */
  year: number;
  age: number;
  line: string;
  heavy: boolean;
  veiled: boolean;
  /** 「예측」 칩이 붙는 줄 (SPEC-010): `year > ERA_ACTUAL_LAST_YEAR`이고 끝 줄이 아니다. 칩은 **해**로 정하지 그림으로 정하지 않는다 */
  forecast: boolean;
  /** 그 줄을 낳은 장면의 근거 종류 — 예측 줄(`forecast`)에만, 장면에 `basis`가 있을 때만 */
  basis?: EraBasis;
  /** 그 줄을 낳은 장면의 예측 근거 보기 글 — 예측 줄(`forecast`)에만, 장면에 있을 때만 (SPEC-010 FU11) */
  foresight?: EraForesight;
}

/**
 * 인생 기록의 시대 줄들 (저장하지 않는 파생 줄, A-12). 출생부터 지금 나이까지 해마다 `eraOf`가 줄을 낳는 해만 담는다 — 승인된 그림이 없으면 빈 목록.
 * 가린 해(`veiled`)의 문장은 줄 자체에는 들어 있지만 화면이 `.veil` 부품으로 가린다(가림은 화면이 지금의 설정값으로 정한다 — 줄마다 가렸는지는 어디에도 저장하지 않는다).
 */
export function eraRowsOf(birthYear: number, ageNow: number, ctx: EraContext): EraRow[] {
  const rows: EraRow[] = [];
  if (ctx.windows.length === 0) return rows;
  const withBirth: EraContext = { ...ctx, birthYear };
  for (let age = 0; age <= ageNow; age++) {
    const year = birthYear + age;
    const pick = eraOf(year, withBirth);
    if (pick.line === null) continue;
    const forecast = isForecastYear(year); // 2110 끝 줄은 예측이 아니라 안내다
    rows.push({
      year,
      age,
      line: pick.line.line,
      heavy: pick.line.heavy,
      veiled: pick.veiled,
      forecast,
      ...(forecast && pick.line.basis !== undefined ? { basis: pick.line.basis } : {}),
      ...(forecast && pick.line.foresight !== undefined ? { foresight: pick.line.foresight } : {}),
    });
  }
  return rows;
}
