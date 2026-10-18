/**
 * 순위 표현 규칙(R-018) — 「우리나라 출생아 중 어디쯤인가」를 상위/하위/중간으로 말하는 순수 규칙. 재력(core/birth.ts)·외모(core/birth.ts)·출생 체중(core/birthReport.ts)이 같은 규칙을 쓴다.
 * 원래 core/birth.ts에 있었는데 birthReport.ts(출생 체중)가 birth.ts를 거치지 않고 쓰도록(순환 import 방지) 옮겼다. birth.ts가 그대로 다시 내보내므로 `from './birth'`·`from '../core'`도 같은 이름이다.
 */

/**
 * "우리나라 출생아 중 어디쯤인가"의 표현 결정. 화면은 이 결과만 그린다(문구는 data/birthText.ts).
 *  - top: 상위 약 N%   - bottom: 하위 약 N%   - middle: 퍼센트 없이 "중간쯤"
 * percent는 1~50의 정수. within이 true면 실제 비율이 1% 미만이라 "N% 안쪽"으로 말해야 한다(약 0% 방지).
 */
export type Standing = { kind: 'top' | 'bottom'; percent: number; within: boolean } | { kind: 'middle' };

function rankedStanding(kind: 'top' | 'bottom', share: number): Standing {
  return share < 1 ? { kind, percent: 1, within: true } : { kind, percent: Math.round(share), within: false };
}

/**
 * 표현 규칙(R-018). topPct = 이 값 이상인 비율(%), bottomPct = 아래쪽 비율(%) — 출생 화면(외모·체중)은 「이하」 비율을, 엔딩의 도착 자리(`ending.ts#finalWealthStanding`)는 **「미만」** 비율을
 * 넘긴다(M7e-3 동률 불리, 같은 금액으로 마친 사람을 내 아래로 세지 않는다). 이 함수는 어느 쪽 비율이든 같은 규칙으로 말한다.
 *  - topPct <= 50 이면 top, 아니면 bottomPct <= 50 이면 bottom,
 *  - 둘 다 50%를 넘는(중앙에 걸친) 경우는 middle: 퍼센트를 말하지 않는다.
 * 그래서 화면에 나오는 퍼센트는 항상 50 이하이고, "약 100%"는 나올 수 없다.
 */
export function standingOf(topPct: number, bottomPct: number): Standing {
  for (const v of [topPct, bottomPct]) {
    if (!Number.isFinite(v) || v < 0 || v > 100) throw new RangeError(`standingOf: 비율이 0~100이 아니다 (${v})`);
  }
  if (topPct <= 50) return rankedStanding('top', topPct);
  if (bottomPct <= 50) return rankedStanding('bottom', bottomPct);
  return { kind: 'middle' };
}
