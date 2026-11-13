import type { ReactElement } from 'react';
import type { AgeView } from '../../src/core/types';
import { AgeViewContext } from '../../src/ui/ageView';

/**
 * 시험 전용 (SPEC-019): 나이 보기가 주제가 아닌 화면 시험이 저장된 게임 나이(태어난 해 0)를 그대로 읽도록 만 나이 맥락으로 감싼다.
 * 맥락이 없으면 화면은 한국 나이(+1)가 기본이다 — 그 기본은 tests/ageView*.test.ts(x)가 따로 잠근다.
 */
export const inAgeView = (node: ReactElement, view: AgeView = 'man'): ReactElement => <AgeViewContext.Provider value={view}>{node}</AgeViewContext.Provider>;
