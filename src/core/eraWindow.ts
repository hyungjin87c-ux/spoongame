import { ERA_BAND_RULES } from '../data/sceneTables';
import { FAMILY_TAG } from './familyModel';
import { famHash01 } from './familyRng';

/**
 * 「시대의 창」 — 굵직한 사건이 있던 해의 그림 한 장 + 캡션 + 인생 기록의 「시대의 창」 줄 (SPEC-013 T1 「시대의 창 대개편」 — 이전 SPEC-009 FM5 · SPEC-010 · SPEC-012 QF2·QF3의 고르기 규칙을 대체한다. 설계 기록 `docs/design/era-window.md`).
 *
 *  - **사건만**: `eraOf`는 `kind: 'event'` 장면(과 2110~ 끝 장면)만 고른다. 사건은 **한 해짜리**(`years: [y, y]`)이고 사건이 없는 해는 `pic`·`line` 모두 `null`(빈 해 — 화면은 창 칸 안에 빈 종이틀)이다.
 *    일상 장면·`dailyPick`·같은 그림 3해 연속 금지·「한 판에 한 번」(`used`)·사건 `ages`·수저 구간 `band` 변주는 없다(같은 `id`가 한 판에 두 번 나오지 않는 것은 사건이 한 해뿐이라 규칙이 아니라 데이터 단언이다 — `tests/eraEvents.test.ts`).
 *  - 창에는 그림 + **캡션**(`caption` — 사건 이름 명사구)이 있고, 인생 기록의 시대 줄은 **첫 문장**(`line`, 사회 사실 한 줄) + **둘째 문장**(`second` — ★ 사건만, 같은 사건이 그 집에 닿은 모습)이다.
 *    둘째 문장은 부모 재력 구간(`bandOfWealth`)으로 아래·가운데·위 셋 중 하나를 고르고, 아이 행동이 들어간 문장은 `secondAges`가 나이 밖일 때 **둘째 문장만 빠진다**(첫 문장은 모든 나이에 읽힌다 — 0세 포함). 코어는 부모 정보를 읽지 않는다(둘째 문장의 주어는 집·식구, INV-5).
 *  - **승인한 것만 데이터에 들어온다**(FT3, RG11 방식): `EraWindow.approved`의 타입이 `true`뿐이라 `false`를 쓰면 `npm run typecheck`(= build의 첫 단계)가 막고, `tests/eraWindows.test.ts`가 데이터 파일을 한 번 더 점검한다.
 *    데이터 파일은 `scripts/genEraWindows.ts`가 사건 표(`scripts/eraEvents.ts` — 승인된 문장·캡션)와 designer 조각에서 만든다. 승인된 그림이 아직 없는 사건은 임시 그림을 쓰고(`tests/helpers/eraEventsTable.ts#PENDING_ART`), 배포 전에 그 목록이 비어야 한다(`npm run check:era-art`).
 *  - 순수 함수다(`Date`·`Math.random` 없음). 해마다 독립이라 이전 해를 걸어오지 않는다. 같은 해에 사건이 둘이면 출생 시도의 지역 사건이 먼저이고 없으면 전국 사건, 각각 무거운 쪽(1987 6월 시위 > 12월 투표소), 둘 다 무겁지 않으면 `famHash01(판 시드, ERA, 연도, salt)`로 하나(지금 데이터에는 없다 — 방어 코드).
 *  - **가리기**(`gentle`): 고른 사건이 `heavy`이면 `veiled` — 같은 해에 무겁지 않은 사건 그림이 있으면(1987 12월 투표) 그 그림과 그 캡션을 창에 띄우고, 없으면 그림 없이 빈 해와 같은 틀 + 캡션 「가려 둔 장면」(화면이 정한다)이다. 인생 기록 줄은 가려진 무거운 사건 그대로다(`.veil` 부품이 가린다).
 *  - 인생 기록의 시대 줄은 **저장하지 않는 파생 줄**이다(A-12): 인생 기록을 그릴 때 해마다 `eraOf`로 만든다. 그래서 판 길이 모델·`yearLineCount`·저장 크기에 닿지 않는다.
 *  - 표는 1940~2109년이고(`ERA_LAST_YEAR`) 2110년은 끝 줄 한 번, 2111년부터는 끝 장면(그림만)이다 — `endPick`. 승인된 그림이 없는 해(데이터가 안 온 10년대)의 창은 빈 해이고 줄이 없다(2025 세트로 돌아가지 않는다).
 *  - 2027년 이후 사건은 「예측」 칩(`isForecastYear`)과 근거(`basis`·`foresight`, SPEC-010)가 따른다.
 */

/** 장면 종류: 사건 하나뿐이고 `base`는 2110~ 끝 장면 한 장이다(일상 장면은 SPEC-013이 없앴다) */
export type EraKind = 'event' | 'base';
/** 수저 구간: 아래 둘(흙·동수저) / 가운데 / 위 둘(은·금수저) — 둘째 문장이 어느 구간의 것인가 (SPEC-013 T1 4) */
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
  /**
   * 한두 건. 근거 후보가 없는 줄은 이 객체를 두지 않는다(근거 종류 글자만 보인다) — 단, **근거가 없는 수저별 「먼저」 줄**(U12·U20, 마스터 2026-11-04)은 `notes`가 빈 목록이고 `byBand: true`인 칸으로
   * 「수저별 차이는 게임의 설정입니다.」 한 줄만 보인다(소개 문장 없이). SPEC-013 이후 그런 줄은 데이터에 없다(수저 변주 그림 폐지) — 타입만 남아 있다.
   */
  notes: readonly EraForesightNote[];
  /** 부유한 쪽이 먼저 누린다는 장면(수저별 「먼저」 줄) — 칸 끝에 「수저별 차이는 게임의 설정입니다.」를 덧붙인다. `notes`가 비면 이 켜짐이 필수다 */
  byBand?: true;
}

/** 수저 둘째 문장 셋 (★ 사건만 — 아래·가운데·위 셋 모두 필수) */
export interface EraSecond {
  low: string;
  mid: string;
  high: string;
}

export interface EraWindow {
  id: string;
  /** 사건은 [연도, 연도] 한 해, 예외는 2110~2130을 덮는 끝 장면(`base`) 하나 */
  years: readonly [number, number];
  /** event 그해의 사건 · base 사건·시대 주장이 없는 끝 장면 */
  kind: EraKind;
  topic: string;
  /** SPEC-004 부록 A 연표 사건 코드 (kind가 event일 때) */
  hCode?: string;
  /** 지역 사건(부록 B)이면 시도 줄임 이름 */
  regionKey?: string;
  /** 인생 기록 줄의 첫 문장 = 사회 사실 한 줄(≤ `ERA_FIRST_MAX`자, 평가어 없음). 칸의 접근 이름에도 들어간다 */
  line: string;
  /** 재난·정치에 가까운 무거운 장면 — 「무거운 장면 가리기」 대상 (경제·감염병은 대상 밖, 형진 님 결정) */
  heavy: boolean;
  /** 형진 님 사건별 승인 + reviewer 판독을 거친 것만 데이터에 들어온다 */
  approved: true;
  /** 그림 조각 id (40×32 좌표계) — 같은 10년대 파일의 `art`에 마크업이 있다 */
  draw: string;
  /** 창 옆·아래에 항상 보이는 사건 이름 명사구(≤ `ERA_CAPTION_MAX`자, 서술어·마침표 없음). 끝 장면은 빈 글자 */
  caption: string;
  /** 수저 둘째 문장(★ 사건만) — 같은 사건이 그 집에 닿은 모습. 주어는 집·식구, 부모를 가리키는 말 0 */
  second?: EraSecond;
  /** 둘째 문장에 아이·어른 행동이 있으면 그 나이대 [처음, 마지막] — 나이 밖에서는 둘째 문장만 빠진다. 없으면 모든 나이 */
  secondAges?: readonly [number, number];
  /**
   * 근거 종류 (SPEC-010). 2027~2109년 장면에는 **필수**(`tests/eraFuture.test.ts`가 잡는다), 2026년(사실)·끝 장면·2025년 이하에는 없다.
   * 근거가 약해 확실성이 「낮음」인 것 단독은 출처가 공식·전문가여도 `scenario`로 내려 적는다(SPEC-010 「표기 규칙」). 글꼴 조각 밖 글자는 소스에 쓰지 않는다(주석 포함) — `tests/fonts.test.tsx`가 센다.
   */
  basis?: EraBasis;
  /**
   * 예측 근거 보기 글 (SPEC-010 FU11). 2027년 이후 장면에만, 근거 후보가 있는 장면에만 있다(그 밖의 후보 없는 줄은 근거 종류 글자만). 생성 파일이 `scripts/eraForesightNotes.ts`에서 싣는다.
   */
  foresight?: EraForesight;
}

/**
 * 문장 글자 수 상한(공백·쉼표·마침표 포함, SPEC-013 T1 6 — 옛 `ERA_LINE_MAX` 22를 대체): 첫 문장 32 · 둘째 문장 28 · 캡션 14. 근거: 형진 님 문체 예 「우리나라가 월드컵 4강에 올라 온 나라가 떠들썩했습니다.」가 31자.
 * 캡션 14자는 PC 칸(175px, 12px 글자)에서 13자까지 한 줄이고 14자는 두 줄이다(`docs/design/era-empty-frame.md` 1절). 360px·글자 200% 점검은 e2e `era-caption`이 한다.
 */
export const ERA_FIRST_MAX = 32;
export const ERA_SECOND_MAX = 28;
export const ERA_CAPTION_MAX = 14;
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
  /** 출생 연도 — 있으면 해마다 나이를 알아 둘째 문장의 나이대(`secondAges`)를 본다. 없으면 나이를 보지 않는다 */
  birthYear?: number;
  /** 수저 구간(`bandOfWealth`) — 둘째 문장을 고른다. 없으면 가운데 */
  band?: EraBand;
}

/** 부모 재력 5단계 → 수저 구간: 1·2 아래 · 3 가운데 · 4·5 위 (설계값, 경계는 `data/sceneTables.ts#ERA_BAND_RULES`) */
export function bandOfWealth(wealth: number): EraBand {
  return wealth <= ERA_BAND_RULES.lowMaxWealth ? 'low' : wealth >= ERA_BAND_RULES.highMinWealth ? 'high' : 'mid';
}

export interface EraPick {
  /** 칸에 띄울 그림. 없으면 빈 틀(빈 해, 또는 가린 해의 대체 그림이 없을 때) */
  pic: EraWindow | null;
  /** 인생 기록 줄의 첫 문장을 낳는 사건(가린 해에는 가려진 무거운 사건 자체). 없으면 줄이 없다 */
  line: EraWindow | null;
  /** `line`이 무거운 사건이고 가리기가 켜져 있다 — 칸은 대체 그림(없으면 빈 틀 + 「가려 둔 장면」), 줄은 가리기 부품이 첫 문장을 가린다 */
  veiled: boolean;
  /** 후보를 찾은 해 (2110 뒤는 `ERA_LAST_YEAR` — 끝 장면) */
  sourceYear: number;
  /** 고른 구간의 둘째 문장 — ★ 사건이고 나이가 `secondAges` 안일 때만(가린 해에는 없다) */
  second: string | null;
  /** 칸에 띄운 그림의 캡션(가린 해의 대체 그림이면 그 그림의 캡션). 그림이 없으면 null — 가린 해의 「가려 둔 장면」은 화면이 정한다 */
  caption: string | null;
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

/** 사건이 둘 이상이면 무거운 쪽만 남긴다 (1987 6월 > 12월 투표소) */
function heavyFirst(list: readonly EraWindow[]): readonly EraWindow[] {
  const heavy = list.filter((w) => w.heavy);
  return heavy.length > 0 ? heavy : list;
}

/** 사건 후보에서 하나: 출생 시도의 지역 사건 먼저, 없으면 전국 사건. 각각 무거운 쪽 먼저, 둘 다 무겁지 않으면 시드로 하나 */
function pickEvent(pool: readonly EraWindow[], regionKey: string, seed: number, y: number, salt: number): EraWindow | null {
  const regional = pool.filter((w) => w.regionKey !== undefined && w.regionKey === regionKey);
  const national = pool.filter((w) => w.regionKey === undefined);
  return pickOne(heavyFirst(regional), seed, y, salt) ?? pickOne(heavyFirst(national), seed, y, salt);
}

/** 고른 구간의 둘째 문장: ★ 사건만, `secondAges`가 있고 나이가 밖이면 없다. 나이를 모르는(출생 연도 없는) 호출은 나이를 보지 않는다 */
function secondOf(w: EraWindow, band: EraBand, age: number | null): string | null {
  if (w.second === undefined) return null;
  if (w.secondAges !== undefined && age !== null && (age < w.secondAges[0] || age > w.secondAges[1])) return null;
  return w.second[band];
}

/**
 * 그해의 창. 고르는 순서: 그해 사건 — 출생 시도의 지역 사건 먼저, 전국 사건(둘이면 무거운 쪽). 사건이 없는 해는 빈 해(`pic`·`line` null).
 * 가리기(`gentle`)가 켜져 있고 고른 사건이 `heavy`이면 `veiled`: 같은 해에 무겁지 않은 사건 그림이 있으면 그것이 대체 그림이고(`pic`) 없으면 빈 틀이다. 인생 기록 줄은 `.veil` 부품이 첫 문장을 가린다.
 * 해마다 독립이다 — 이전 해를 걸어오지 않는다(같은 입력 → 같은 출력). 표 끝 뒤(2110~)는 `endPick`이 정한다.
 */
export function eraOf(calYear: number, ctx: EraContext): EraPick {
  if (calYear > ERA_LAST_YEAR) return endPick(calYear, ctx);
  const events = ctx.windows.filter((w) => w.kind === 'event' && inYears(w, calYear));
  const chosen = pickEvent(events, ctx.regionKey, ctx.seed, calYear, 1);
  if (chosen === null) return { pic: null, line: null, veiled: false, sourceYear: calYear, second: null, caption: null };
  if (ctx.gentle && chosen.heavy) {
    // 같은 해에 무겁지 않은 사건 그림이 따로 있으면(1987년: 6월 시위 ↔ 12월 투표소) 가린 해의 대체 그림이다(FM5b 마스터 결정 2026-10-28). 줄은 가려진 무거운 사건 그대로다
    const alt = pickEvent(events.filter((w) => !w.heavy), ctx.regionKey, ctx.seed, calYear, 4);
    return { pic: alt, line: chosen, veiled: true, sourceYear: calYear, second: null, caption: alt === null ? null : alt.caption };
  }
  const age = ctx.birthYear === undefined ? null : calYear - ctx.birthYear;
  return { pic: chosen, line: chosen, veiled: false, sourceYear: calYear, second: secondOf(chosen, ctx.band ?? 'mid', age), caption: chosen.caption };
}

/**
 * 표 끝 뒤의 해(`calYear > ERA_LAST_YEAR`, SPEC-010 구현 규칙 3): 창은 끝 장면(`kind: 'base'`, 승인된 것 중 그해를 덮는 것) 한 장, 줄은 **`ERA_LAST_YEAR + 1`년에만** 그 장면의 문장 한 줄 — 2111년부터는 줄이 없다
 * (`eraRowsOf`는 `line`이 null인 해를 건너뛴다). 끝 줄·끝 장면에는 칩·캡션·둘째 문장이 없다. 끝 장면이 아직 오지 않았거나 못 받았으면 빈 틀이다(다른 빈 해와 같은 동작). 무겁지 않아 가리기와 무관하다.
 */
function endPick(calYear: number, ctx: EraContext): EraPick {
  const end = pickOne(
    ctx.windows.filter((w) => w.kind === 'base' && inYears(w, calYear)),
    ctx.seed,
    calYear,
    3,
  );
  return { pic: end, line: end !== null && calYear === ERA_LAST_YEAR + 1 ? end : null, veiled: false, sourceYear: ERA_LAST_YEAR, second: null, caption: null };
}

export interface EraRow {
  /** 줄 id의 뒤쪽: `log-y<year>` */
  year: number;
  age: number;
  /** 첫 문장 (사회 사실 한 줄). 가린 해에는 줄 자체에 들어 있고 화면이 `.veil` 부품으로 가린다 */
  line: string;
  /** 둘째 문장(★ 사건만, 고른 구간의 것·나이 밖이면 없음) — 첫 문장 뒤에 같은 줄로 이어진다 */
  second?: string;
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
 * 인생 기록의 시대 줄들 (저장하지 않는 파생 줄, A-12). 출생부터 지금 나이까지 해마다 `eraOf`가 줄을 낳는 해(사건이 있던 해)만 담는다 — 승인된 그림이 없으면 빈 목록.
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
      ...(pick.second !== null ? { second: pick.second } : {}),
      heavy: pick.line.heavy,
      veiled: pick.veiled,
      forecast,
      ...(forecast && pick.line.basis !== undefined ? { basis: pick.line.basis } : {}),
      ...(forecast && pick.line.foresight !== undefined ? { foresight: pick.line.foresight } : {}),
    });
  }
  return rows;
}
