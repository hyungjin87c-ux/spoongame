import type { BirthYearTables } from '../core/generationMixture';
import raw from './birthYearData.json';

/**
 * 출생 연도 표 (SPEC-004 GS7·RG2·NR3): 연도별 전국 출생아 수(1970~2020)와 시·도 비율(1940~2020). 파일 `birthYearData.json`은 `scripts/genBirthYearData.ts`가 DC2·DC7 자료에서 만든다
 * (`tests/birthYearData.test.ts`가 생성 결과와 같은지 대조한다). 이 모듈은 「태어나기」 뒤에 불러오는 덩어리(`data/gameData.ts`)에 들어간다 — 첫 화면은 읽지 않는다(MG8).
 */
export const BIRTH_YEAR_TABLES: BirthYearTables = raw as BirthYearTables;
