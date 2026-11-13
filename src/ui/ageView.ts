import { createContext, useContext } from 'react';
import type { AgeView } from '../core/types';

/**
 * 나이 보기 (SPEC-019): 화면 컴포넌트가 설정 `ageView`를 prop으로 줄줄이 받지 않고 이 맥락에서 읽는다. App이 설정값을 한 번 내려 주고,
 * 맥락이 없는 곳(시험에서 컴포넌트만 그릴 때)은 기본값 한국 나이다. 숫자·문장 만들기는 `core/format.ts`의 `ageText`·`ageHeadText`·`ageRangeText`만 거친다.
 */
export const AgeViewContext = createContext<AgeView>('korean');

export function useAgeView(): AgeView {
  return useContext(AgeViewContext);
}
