import type { EraRow } from '../../core/eraWindow';
import type { HistoryEntry } from '../../core/types';

/**
 * 인생 기록 최신순 (SPEC-005 LR1·LR2·LR7)의 순수 부분 — `LogCard`가 쓰고 `tests/logOrder.test.tsx`가 확인한다.
 *
 * 저장 순서(`game.history`)는 시간순 그대로이고 **화면만** 뒤집는다: 화면의 첫 줄이 가장 최근 줄이다.
 * CSS로 겉만 뒤집지 않는다(DOM 순서 = 화면 순서 = 읽기 순서, LR4 a) — 이 함수가 DOM에 그릴 순서를 직접 만든다.
 */

/** 맨 위(가장 최근)를 보고 있다고 보는 범위(px): 스크롤 위치가 이 안이면 맨 위에 머문다 (LR2 a) */
export const LOG_TOP_SLACK = 24;

export interface LogRow {
  /** 저장 순서(시간순) 인덱스 — 0 = 출생 */
  index: number;
  entry: HistoryEntry;
  /** 줄을 가리키는 안정된 키: 새 줄이 쌓여도, 상한으로 오래된 줄이 지워져도 남은 줄의 키는 그대로다 */
  key: string;
  /** 가장 최근 줄 — 화면의 첫 줄이고 굵게 보인다 (LR3) */
  latest: boolean;
}

/**
 * 인생 기록의 「시대의 창」 줄 (SPEC-009 FM5, A-12): 저장하지 않는 **파생 줄**이다 — 저장 순서(`history`)에는 없고 화면이 그릴 때만 끼워 넣는다.
 * 키는 `era-y<연도>`라 해마다 하나이고 안정적이다(`history`가 상한에서 오래된 줄을 지워도 이 줄의 키는 그대로다).
 */
export interface EraLogRow {
  era: EraRow;
  key: string;
  latest: false;
  /** 저장 순서 인덱스가 없다 */
  index: -1;
}
export type AnyLogRow = LogRow | EraLogRow;
export const isEraRow = (r: AnyLogRow): r is EraLogRow => 'era' in r;

/**
 * 줄마다 안정된 키를 만든다 (저장 순서). `나이-종류-이벤트 id-같은 꼴의 몇 번째` — 같은 나이·종류·이벤트가 겹치는 경우는 「나의 기록」 여러 줄뿐이고 그때는 먼저 쌓인 순서로 가른다.
 * 키가 저장 순서 인덱스가 아닌 까닭(LR1 「뒤집어도 줄이 다시 만들어지지 않는다」, LR7): 인덱스 키는 상한(300줄)에서 오래된 줄이 하나 지워질 때 그 뒤 모든 줄의 키를 한 칸씩 바꿔
 * 줄이 통째로 다시 만들어지고(live region이 전부 새 줄로 읽는다) 보던 위치가 흔들린다. 이 키는 지워진 줄 하나만 사라진다.
 */
export function logRowKeys(history: readonly HistoryEntry[]): string[] {
  const seen = new Map<string, number>();
  return history.map((h) => {
    const base = `${h.age}-${h.kind}-${h.eventId ?? ''}`;
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    return `${base}-${n}`;
  });
}

/** 화면에 그릴 줄: 가장 최근 줄이 첫째. 같은 나이 안에서도 나중에 쌓인 줄이 위다 (LR1) */
export function logRows(history: readonly HistoryEntry[]): LogRow[] {
  const keys = logRowKeys(history);
  const rows: LogRow[] = [];
  for (let i = history.length - 1; i >= 0; i--) rows.push({ index: i, entry: history[i], key: keys[i], latest: i === history.length - 1 });
  return rows;
}

/**
 * 화면에 그릴 줄: `logRows(history)`에 시대의 창 줄을 끼운다. 시대 줄은 그해의 **첫 기록 앞**(시간순)에 선다 — 화면에서는 그해 줄들 **아래**, 앞 해 줄들 위다. 그래야 해 중간에 새 줄이 쌓여도
 * 시대 줄이 움직이지 않는다(새 줄은 늘 맨 위). 0세는 출생 줄 바로 뒤. 시대 줄이 없으면(승인된 그림이 없다) `logRows(history)`를 **그대로** 돌려준다(같은 배열 — 기존 화면과 달라지는 것이 없다).
 * 남은 기록의 첫 나이보다 앞선 해(`history` 상한에서 지워진 해)의 시대 줄은 빼서 목록 끝에 홀로 남지 않게 한다.
 */
export function mergeLogRows(history: readonly HistoryEntry[], era: readonly EraRow[]): AnyLogRow[] {
  const base = logRows(history);
  if (era.length === 0 || history.length === 0) return base;
  const firstAge = history[0].age;
  const rows = era.filter((r) => r.age >= firstAge);
  if (rows.length === 0) return base;
  // 시간순으로 합친다(base는 최신순이므로 뒤집어 쓴다)
  const chrono: AnyLogRow[] = [];
  const hist = [...base].reverse();
  let e = 0;
  const eraAsRow = (r: EraRow): EraLogRow => ({ era: r, key: `era-y${r.year}`, latest: false, index: -1 });
  hist.forEach((h, i) => {
    // 이 줄 앞에 와야 하는 시대 줄: 나이가 이 줄의 나이 이하인 것 (0세는 출생 줄 뒤)
    while (e < rows.length && rows[e].age <= h.entry.age && !(rows[e].age === 0 && i === 0)) chrono.push(eraAsRow(rows[e++]));
    chrono.push(h);
    if (i === 0) while (e < rows.length && rows[e].age === 0) chrono.push(eraAsRow(rows[e++]));
  });
  while (e < rows.length) chrono.push(eraAsRow(rows[e++]));
  return chrono.reverse();
}

/**
 * 지난번 그렸을 때 맨 위였던 줄(`prevNewestKey`) 위에 새로 쌓인 **기록** 줄 수. 상한에서 오래된 줄이 지워져 전체 길이가 그대로여도 센다.
 * 시대의 창 줄(파생 줄)은 세지 않는다 — 늦게 도착한 10년 덩어리가 과거 해의 시대 줄을 한꺼번에 끼워도 「새 기록 N개」는 늘지 않는다 (FM5b R-547).
 * 지난 맨 위 줄이 이번 목록에 없으면(다른 판으로 바뀜) `null` — 호출한 쪽이 맨 위로 되돌린다.
 */
export function addedAbove(rows: readonly { key: string; era?: unknown }[], prevNewestKey: string | null): number | null {
  if (prevNewestKey === null) return 0;
  const at = rows.findIndex((r) => r.key === prevNewestKey);
  if (at === -1) return null;
  return rows.slice(0, at).filter((r) => r.era === undefined).length;
}

/**
 * 시대 줄의 구성이 달라졌는가 (FM5b R-547): 늦게 온 10년 덩어리·가리기 설정 변화가 아니라 **줄이 끼거나 빠진** 경우만 참이다. 기록 줄은 보지 않는다.
 * 맨 위 줄이 그대로여도 시대 줄이 보던 줄 위에 끼면 보던 줄이 밀리므로, `LogList`가 이때도 보던 자리를 지킨다(새 기록 수는 늘리지 않는다).
 */
export function eraKeysChanged(prev: readonly { key: string; era?: unknown }[], next: readonly { key: string; era?: unknown }[]): boolean {
  const keys = (rows: readonly { key: string; era?: unknown }[]): string => rows.filter((r) => r.era !== undefined).map((r) => r.key).join('|');
  return keys(prev) !== keys(next);
}

/**
 * 맨 위 줄은 그대로인데 시대 줄만 끼거나 빠졌을 때의 스크롤 계획 (FM5b R-547). 맨 위를 보고 있었거나 「맨 위로」가 올라가는 중이면 건드리지 않고(`null`),
 * 읽는 중이면 보던 줄이 밀린 만큼 옮겨 그 줄의 화면 위치를 지킨다. 「새 기록」 수는 늘지 않는다.
 */
export function eraInsertPlan(input: { scrollTop: number; shift: number; follow: boolean }): number | null {
  if (input.follow || isAtLogTop(input.scrollTop)) return null;
  if (Math.abs(input.shift) < RESIZE_EPSILON) return null;
  return Math.max(0, input.scrollTop + input.shift);
}

/** 스크롤 위치 `scrollTop`이 맨 위(가장 최근)를 보는 범위인가 */
export function isAtLogTop(scrollTop: number): boolean {
  return scrollTop <= LOG_TOP_SLACK;
}

export interface ScrollPlan {
  /** 줄이 쌓인 뒤 맞출 스크롤 위치(px) */
  top: number;
  /** 「새 기록 N개」에 더할 수 (맨 위에 머문다면 0 — 새 줄이 바로 보인다) */
  unread: number;
}

/**
 * 위에 줄이 쌓였을 때의 스크롤 계획 (LR2).
 *  - 맨 위를 보고 있었으면(또는 「맨 위로」를 누른 직후면) 맨 위(0)에 머문다 = 새 줄이 바로 보인다. 개수는 세지 않는다.
 *  - 아래로 내려 지난 기록을 읽는 중이면 **보던 줄이 밀린 만큼 스크롤 위치를 내려** 보던 줄이 화면에서 움직이지 않게 하고 개수만 센다.
 *    (브라우저의 `overflow-anchor`는 WebKit이 구현하지 않고, 켜 두면 이 보정과 겹쳐 두 번 움직이므로 CSS에서 끄고 직접 한다.)
 * `shift`는 보던 줄이 쌓인 줄들에 밀려 내려간 거리(px)다 — 쌓인 줄의 높이뿐 아니라 가장 최근이던 줄이 굵은 글씨를 잃으며 줄바꿈이 바뀌는 것 같은 변화까지 담은, 보던 줄의 실제 이동량이다(`LogList`가 잰다).
 */
export function scrollPlan(input: { scrollTop: number; shift: number; added: number; follow: boolean }): ScrollPlan {
  if (input.follow || isAtLogTop(input.scrollTop)) return { top: 0, unread: 0 };
  return { top: input.scrollTop + input.shift, unread: input.added };
}

/** 줄이 다시 흐를 때(창 크기·글자 크기·화면 회전) 보던 줄이 이만큼(px) 밀렸으면 되맞춘다 — 이보다 작은 어긋남은 화면 픽셀 반올림이라 건드리지 않는다 */
export const RESIZE_EPSILON = 0.5;

/**
 * 창 크기·글자 크기·화면 회전으로 줄이 다시 흐를 때의 스크롤 계획 (R-439). 브라우저의 스크롤 고정(`overflow-anchor`)은 새 줄 보정과 겹쳐 두 번 움직이므로 끄고(CSS `none`) 직접 한다.
 *  - `rememberedScrollTop`: 스크롤할 때 기억해 둔 위치(줄이 다시 흐르기 전). 맨 위(≤ 24px)였으면 되맞추지 않는다 — 맨 위는 어떻게 흘러도 맨 위다.
 *  - `scrollTop`: 지금 위치. `shift`: 기억해 둔 줄이 영역 윗변에서 떨어진 거리가 기억했을 때보다 얼마나 늘었는가(px, 아래로 밀렸으면 양수).
 *  - `follow`: 「맨 위로」가 부드럽게 올라가는 중이면 건드리지 않는다.
 * 돌려주는 값은 맞출 스크롤 위치, 움직일 필요가 없으면 `null`.
 */
export function resizePlan(input: { rememberedScrollTop: number; scrollTop: number; shift: number; follow: boolean }): number | null {
  if (input.follow || isAtLogTop(input.rememberedScrollTop)) return null;
  if (Math.abs(input.shift) < RESIZE_EPSILON) return null;
  return Math.max(0, input.scrollTop + input.shift);
}
