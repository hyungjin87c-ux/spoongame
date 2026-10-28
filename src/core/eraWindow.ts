import { FAMILY_TAG } from './familyModel';
import { famHash01 } from './familyRng';

/**
 * 「시대의 창」 — 그해를 대표하는 장면 그림 한 장과 인생 기록의 「시대의 창」 줄 (SPEC-009 FM5, FT1~FT6, `docs/data/family-model.md` 9절, `docs/design/family-scene.md` 5절).
 *
 *  - 창에는 **그림만** 있다(FM2d). 그해를 나타내는 문장 `line`은 접근 이름이자 인생 기록의 `data-tl="era"` 줄이다.
 *  - **승인한 것만 데이터에 들어온다**(FT3, RG11 방식): `EraWindow.approved`의 타입이 `true`뿐이라 `false`를 쓰면 `npm run typecheck`(= build의 첫 단계)가 막고, `tests/eraWindows.test.ts`가 데이터 파일을 한 번 더 점검한다.
 *    지금(FM5)은 승인된 그림이 0장이라 창은 빈 틀이다. 승인된 그림이 오면 `data/eraWindows/d<10년대>.ts`에 데이터 한 줄과 조각 마크업 한 줄만 더한다.
 *  - 순수 함수다(`Date`·`Math.random` 없음): 한 해에 후보가 둘이면 `famHash01(판 시드, ERA, 연도, 1)`로 하나 — 같은 판에서는 늘 같은 그림이다.
 *  - 인생 기록의 시대 줄은 **저장하지 않는 파생 줄**이다(A-12): 인생 기록을 그릴 때 해마다 `eraOf`로 만든다. 그래서 판 길이 모델·`yearLineCount`·저장 크기에 닿지 않는다.
 */

export type EraKind = 'event' | 'daily' | 'base';

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
  /** 재난·참상에 가까움 — 「무거운 장면 가리기」 대상 */
  heavy: boolean;
  /** 형진 님 사건별 승인 + reviewer 판독을 거친 것만 데이터에 들어온다 */
  approved: true;
  /** 그림 조각 id (40×32 좌표계) — 같은 10년대 파일의 `art`에 마크업이 있다 */
  draw: string;
}

/** 시대 줄 문장의 글자 수 상한 (360px에서 2줄 안 — 본문 16px) */
export const ERA_LINE_MAX = 22;
/** 시대의 창 그림이 있는 해의 범위. 2025 뒤는 2025의 생활 장면을 유지한다(전망 구간 — 출처 없는 미래 사건 금지) */
export const ERA_FIRST_YEAR = 1940;
export const ERA_LAST_YEAR = 2025;
export const ERA_FIRST_DECADE = 1940;
export const ERA_LAST_DECADE = 2020;

export interface EraContext {
  /** 출생 시도 줄임 이름 — 지역 사건 후보를 가린다 */
  regionKey: string;
  /** 「무거운 장면 가리기」(설정 `gentle`) */
  gentle: boolean;
  /** 가족 시드 (`famSeedOf`) */
  seed: number;
  /** 지금까지 받은 시대의 창 데이터(10년 덩어리의 합) */
  windows: readonly EraWindow[];
}

export interface EraPick {
  /** 칸에 띄울 그림. 없으면 빈 틀 */
  pic: EraWindow | null;
  /** 인생 기록 줄의 문장을 낳는 장면(가린 해에는 가려진 무거운 장면 자체). 없으면 줄이 없다 */
  line: EraWindow | null;
  /** `line`이 무거운 장면이고 가리기가 켜져 있다 — 칸은 그림 없이(또는 그해 일상으로), 줄은 가리기 부품이 문장을 가린다 */
  veiled: boolean;
  /** 후보를 찾은 해 (2026 뒤는 2025) */
  sourceYear: number;
}

const inYears = (w: EraWindow, y: number): boolean => w.approved === true && y >= w.years[0] && y <= w.years[1];

/** 10년 덩어리 번호: 1940~2029 → 1940·…·2020 (2030 뒤도 2020년대 덩어리) */
export function eraDecadeOf(calYear: number): number {
  const d = Math.floor(Math.min(Math.max(calYear, ERA_FIRST_YEAR), ERA_LAST_YEAR) / 10) * 10;
  return Math.min(Math.max(d, ERA_FIRST_DECADE), ERA_LAST_DECADE);
}

/** 후보가 둘 이상이면 id 순으로 늘어놓고 해시로 하나 (같은 판 → 같은 그림) */
function pickOne(cands: readonly EraWindow[], seed: number, calYear: number, salt: number): EraWindow | null {
  if (cands.length === 0) return null;
  const sorted = [...cands].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return sorted[Math.min(sorted.length - 1, Math.floor(famHash01(seed, FAMILY_TAG.ERA, calYear, salt) * sorted.length))];
}

/**
 * 그해의 창. 고르는 순서(9-2절): ① 출생 시도의 지역 사건 ② 전국 연표 사건 ③ 생활 장면 ④ 기본 장면 — 승인된 후보만. 2026년 이후는 사건을 쓰지 않고 2025년의 생활·기본 장면을 유지한다.
 * 가리기(`gentle`)가 켜져 있고 고른 장면이 `heavy`이면 `veiled`: 칸에는 그해의 (무겁지 않은) 생활·기본 장면을 띄우고 — 없으면 빈 틀 — 인생 기록 줄은 `.veil` 부품이 문장을 가린다.
 */
export function eraOf(calYear: number, ctx: EraContext): EraPick {
  const src = Math.min(calYear, ERA_LAST_YEAR);
  const future = calYear > ERA_LAST_YEAR;
  const live = ctx.windows.filter((w) => inYears(w, src));
  const events = future ? [] : live.filter((w) => w.kind === 'event');
  const regional = events.filter((w) => w.regionKey !== undefined && w.regionKey === ctx.regionKey);
  const national = events.filter((w) => w.regionKey === undefined);
  const daily = live.filter((w) => w.kind === 'daily');
  const base = live.filter((w) => w.kind === 'base');
  const chosen =
    pickOne(regional, ctx.seed, calYear, 1) ?? pickOne(national, ctx.seed, calYear, 1) ?? pickOne(daily, ctx.seed, calYear, 2) ?? pickOne(base, ctx.seed, calYear, 3);
  if (chosen === null) return { pic: null, line: null, veiled: false, sourceYear: src };
  if (ctx.gentle && chosen.heavy) {
    const calm = (list: readonly EraWindow[]): readonly EraWindow[] => list.filter((w) => !w.heavy);
    const replacement = pickOne(calm(daily), ctx.seed, calYear, 2) ?? pickOne(calm(base), ctx.seed, calYear, 3);
    return { pic: replacement, line: chosen, veiled: true, sourceYear: src };
  }
  return { pic: chosen, line: chosen, veiled: false, sourceYear: src };
}

export interface EraRow {
  /** 줄 id의 뒤쪽: `log-y<year>` */
  year: number;
  age: number;
  line: string;
  heavy: boolean;
  veiled: boolean;
}

/**
 * 인생 기록의 시대 줄들 (저장하지 않는 파생 줄, A-12). 출생부터 지금 나이까지 해마다 `eraOf`가 줄을 낳는 해만 담는다 — 승인된 그림이 없으면 빈 목록.
 * 가린 해(`veiled`)의 문장은 줄 자체에는 들어 있지만 화면이 `.veil` 부품으로 가린다(가림은 화면이 지금의 설정값으로 정한다 — 줄마다 가렸는지는 어디에도 저장하지 않는다).
 */
export function eraRowsOf(birthYear: number, ageNow: number, ctx: EraContext): EraRow[] {
  const rows: EraRow[] = [];
  if (ctx.windows.length === 0) return rows;
  for (let age = 0; age <= ageNow; age++) {
    const year = birthYear + age;
    const pick = eraOf(year, ctx);
    if (pick.line !== null) rows.push({ year, age, line: pick.line.line, heavy: pick.line.heavy, veiled: pick.veiled });
  }
  return rows;
}
