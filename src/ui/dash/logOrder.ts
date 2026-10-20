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
 * 지난번 그렸을 때 맨 위였던 줄(`prevNewestKey`) 위에 새로 쌓인 줄 수. 상한에서 오래된 줄이 지워져 전체 길이가 그대로여도 센다.
 * 지난 맨 위 줄이 이번 목록에 없으면(다른 판으로 바뀜) `null` — 호출한 쪽이 맨 위로 되돌린다.
 */
export function addedAbove(rows: readonly LogRow[], prevNewestKey: string | null): number | null {
  if (prevNewestKey === null) return 0;
  const at = rows.findIndex((r) => r.key === prevNewestKey);
  return at === -1 ? null : at;
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
