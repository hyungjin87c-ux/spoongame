import tablesJson from './family/tables.json';
import type { FamilyTables } from '../core/gameData';

/**
 * 가족 모델의 표 덩어리 `familyData` (SPEC-009 FM4a, 설계 문서 D-4·A-10): 「태어나기」 뒤 게임 데이터(이벤트 풀·출생 연도 표·인용·이름 풀)와 **함께** 지연 로드된다.
 * 첫 화면은 이 파일을 정적으로 import하지 않는다(`tests/lazyBoundary.test.ts`가 잠근다) — `data/gameData.ts`가 동적 `import()`로만 부르고, 시험·스크립트는 `data/installAll.ts`가 정적으로 놓는다.
 *
 * 값은 `docs/data/fd-a-family.json`·`src/data/koreaStats.json`에서 `scripts/genFamilyTables.ts`(`npm run gen:family`)가 뽑은 `family/tables.json`이다 — 직접 고치지 않는다. 묶음 B(집 종류·방 수)·C(이사·실직·병환)·D(반려동물·가진 것)의 표는
 * 자료가 올 때 이 파일에 칸을 더한다 — 그 전에는 칸이 없고 코어가 「자료가 오기 전 동작」(설계 문서 11절)으로 돈다.
 */
export const FAMILY_TABLES: FamilyTables = tablesJson as unknown as FamilyTables;

/**
 * 표의 근거 표시 (FA0-4 `basis`): `official` 확인 · `calc` 확인(환산) · `estimated` 추정 · `design` 설계값. 화면의 접이식 「이 칸은 어떻게 정했나요」(FM6)가 읽는 목록이다.
 */
export const FAMILY_BASIS: ReadonlyArray<{ id: string; basis: 'official' | 'calc' | 'estimated' | 'design'; note: string }> = [
  { id: 'mortality-1970-2024', basis: 'official', note: '간이생명표 5세 구간 사망확률(KOSIS DT_1B41, 1970~2024). 2024 뒤는 2024 값을 유지한다(미래 개선 없음)' },
  { id: 'mortality-before-1970', basis: 'estimated', note: '1970 앞 생명표는 없어 1970 사망확률에 배율을 곱한다 — 기대수명이 1970~1985 추세선을 거꾸로 이은 값이 되게 풀었다(하한 30세)' },
  { id: 'mother-age-1981+', basis: 'official', note: '인구동향조사 모의 연령별 출생아 구성비(1981~2025)' },
  { id: 'mother-age-1956-1980', basis: 'calc', note: '센서스 모의 연령별 적생아 역산(±0.5세)' },
  { id: 'mother-age-before-1956', basis: 'estimated', note: '1956~60 칸에서 출산 연령을 이른 쪽으로 옮긴 값(1936~55 −1세, 1916~35 −2세, 그 앞 −3세 — 크기는 설계값)' },
  { id: 'grand-cohabit-2000-2005', basis: 'calc', note: '인구총조사 아동 가구 세대 구성 환산' },
  { id: 'grand-cohabit-other', basis: 'estimated', note: '3세대 이상 가구 비율 × 1.85(2000·2005 실측 1.73·1.99의 가운데)' },
  { id: 'grand-side', basis: 'design', note: '함께 사는 조부모는 친가 0.7, 외가 0.3 — 통계가 없는 설계값' },
  { id: 'parent-divorce-1993+', basis: 'calc', note: '이혼 건수 × 미성년 자녀 하한 ÷ 미성년 인구 근사(1993~2025)' },
  { id: 'parent-divorce-before-1993', basis: 'estimated', note: '1993 값에 조이혼율 비를 곱해 줄인 값' },
  { id: 'siblings', basis: 'design', note: '아래 동생 수는 공표 출산 순위 비중에서 유도한 근사, 터울 2~5년·독립 나이 20~30·성별 균등은 설계값' },
];
