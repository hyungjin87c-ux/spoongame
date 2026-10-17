import type { Standing } from '../core/standing';
import type { ParentingStyle } from '../core/types';

/**
 * 출생 관련 문구의 공통 부분. 룰렛·출생신고 화면의 문구는 data/birthReportText.ts(SPEC-003 M3)에 있고, 여기에는 **순위 표현**(재력·외모·출생 체중·엔딩 도착 자리가 함께 쓰는 R-018 문구)과
 * 교육방식 이름만 남겼다. 옛 출생 화면의 집안 형편·교육방식·외모 묘사(「외모 N점」 포함)는 새 출생신고 화면으로 대체되어 없어졌다(외모는 점수를 어디에도 적지 않는다, R-135).
 */

export const PARENTING_LABEL: Record<ParentingStyle, string> = {
  neglect: '방임',
  free: '자유',
  helicopter: '헬리콥터',
  strict: '엄격',
};

// ---------- 순위 표현 문구 (R-018) ----------

/** 상위·하위 어느 쪽도 50% 안쪽이 아닌(중앙에 걸친) 경우의 전용 표현. 퍼센트를 말하지 않는다. */
export const MIDDLE_LABEL = '딱 중간쯤';

/**
 * Standing(core/standing.ts#standingOf의 결정) → 짧은 표현.
 * "상위 약 N%" / "하위 약 N%" / "상위·하위 1% 안쪽" / "딱 중간쯤". 문구는 이 함수가 유일한 출처다.
 * 쓰는 곳: 외모(출생신고·프로필)·출생 체중·엔딩 도착 자리. 수저 구간(「흙수저(하위 25% 안쪽)」)에는 쓰지 않는다 — 그것은 `bandLabel(startBandOf())`(R-170).
 */
export function standingLabel(s: Standing): string {
  if (s.kind === 'middle') return MIDDLE_LABEL;
  const side = s.kind === 'top' ? '상위' : '하위';
  return s.within ? `${side} ${s.percent}% 안쪽` : `${side} 약 ${s.percent}%`;
}
