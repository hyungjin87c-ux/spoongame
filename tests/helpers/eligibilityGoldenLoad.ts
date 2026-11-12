import gridRaw from '../fixtures/eligibility-golden.json?raw';
import progressRaw from '../fixtures/eligibility-golden-progress.json?raw';
import type { GridGolden, ProgressGolden } from './eligibilityGolden';

/**
 * 기존 사건 자격 골든 읽기(시험 전용 — 생성 스크립트는 이 파일을 import하지 않는다: 골든이 아직 없을 때도 돌아야 한다).
 * tests/ 설정에는 Node 타입이 없어서 vite의 `?raw` 가져오기로 읽는다.
 */
export const loadGrid = (): GridGolden => JSON.parse(gridRaw) as GridGolden;
export const loadProgress = (): ProgressGolden => JSON.parse(progressRaw) as ProgressGolden;
