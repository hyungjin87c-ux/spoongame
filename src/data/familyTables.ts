import tablesJson from './family/tables.json';
import type { FamilyDesign, FamilyTables } from '../core/gameData';

/**
 * 가족 모델의 표 덩어리 `familyData` (SPEC-009 FM4a, 설계 문서 D-4·A-10): 「태어나기」 뒤 게임 데이터(이벤트 풀·출생 연도 표·인용·이름 풀)와 **함께** 지연 로드된다.
 * 첫 화면은 이 파일을 정적으로 import하지 않는다(`tests/lazyBoundary.test.ts`가 잠근다) — `data/gameData.ts`가 동적 `import()`로만 부르고, 시험·스크립트는 `data/installAll.ts`가 정적으로 놓는다.
 *
 * 값은 `docs/data/fd-a-family.json`·`src/data/koreaStats.json`에서 `scripts/genFamilyTables.ts`(`npm run gen:family`)가 뽑은 `family/tables.json`이다 — 직접 고치지 않는다. 묶음 B(집 종류·방 수)·C(이사·실직·병환)·D(반려동물·가진 것)의 표는
 * 자료가 올 때 이 파일에 칸을 더한다 — 그 전에는 칸이 없고 코어가 「자료가 오기 전 동작」(설계 문서 11절)으로 돈다.
 */
/**
 * 코어가 쓰는 설계값 (R-534, CR-DATA): 확률·밸런스 값은 코어에 박지 않고 근거와 함께 여기 둔다 — 코어는 `familyTables().design`으로 읽는다. 값을 바꾸면 알려진 시드의 가족이 달라진다(배포 뒤에는 바꾸지 않는다).
 */
export const FAMILY_DESIGN: FamilyDesign = {
  paternalSideShare: { value: 0.7, basis: 'design', note: '함께 사는 조부모가 두 쪽 모두 후보일 때 친가를 고를 확률 — 통계가 없는 설계값(자료가 있으면 교체, 4-4절)' },
  divorceFatherLeaves: { value: 0.8, basis: 'design', note: '부모 이혼 때 따로 사는 쪽이 아버지일 확률 — 통계가 없는 설계값(4-7절 (2))' },
  maleShare: { value: 0.5, basis: 'design', note: '아래 동생의 성별은 균등(남 0.5) — 설계값(위 형제는 옛 계산의 성별을 따른다)' },
  leaveAge: { value: { min: 20, max: 30 }, basis: 'design', note: '형제 독립 나이는 20~30 균등 — 설계값(SPEC FA3)' },
  continueCap: { value: 0.9, basis: 'design', note: '아래 동생 이어짐 확률 a_1·a_2는 이 판의 출산 순위 비중 비로 구하고 0.9에서 자른다 — 설계값' },
  home: {
    value: {
      before1970AptPct: 0.1,
      shackYears: [1940, 1999],
      rentRoomPoints: [[1969, 0.85], [1990, 0.85], [2005, 0.6], [2020, 0.5]],
      roomFloorPermille: 50,
      regionClassOf: {
        seoul: 'capital', incheon: 'capital', gyeonggi: 'capital',
        busan: 'metro', daegu: 'metro', gwangju: 'metro', daejeon: 'metro', ulsan: 'metro', sejong: 'metro',
        gangwon: 'province', chungbuk: 'province', chungnam: 'province', jeonbuk: 'province', jeonnam: 'province', gyeongbuk: 'province', gyeongnam: 'province', jeju: 'province',
      },
      parentOf: { daegu: 'gyeongbuk', incheon: 'gyeonggi', gwangju: 'jeonnam', daejeon: 'chungnam', ulsan: 'gyeongnam', sejong: 'chungnam' },
      stepSegments: [[1975, 1980], [2000, 2005], [2010, 2015]],
    },
    basis: 'design',
    note: '집 종류 분포의 빈 구간을 메우는 규칙(fd-b-house.md 10절 마스터 결정): 센서스 해 사이는 선형 보간(추정), 분류가 바뀌는 구간(1975→80, 2000→05, 2010→15)은 가까운 해, 1969 이하는 1970 구성비(설계값, 아파트 칸 0.1%), 승격 전 광역시는 부모 도 줄. 점유 형태·소득계층·방 수는 센서스·주거실태조사 칸에서 독립 가정의 곱으로 얻고, 셋방 비율·방 수 문턱·지역 3분류·주택 이외의 거처 연도는 통계가 없는 설계값(전체 가구 기준이라 갓난아이 가구의 선택 효과는 보정하지 않았다)',
  },
  highOrderContinue: {
    // 어머니 출생 코호트(5년) → 3명 이상을 낳은 어머니가 한 명 더 낳을 확률. scripts/calibrateHighOrder.ts가 FD6 코호트 평균 출생아 수(fd6_mean_children_by_age_calc)에 맞춘 값 — 아래 표를 다시 만들 때는 그 스크립트를 쓴다
    value: [
      { upTo: 1900, cap: 0.98, q: 0.97, gapMax: 3 },
      { upTo: 1905, cap: 0.98, q: 0.97, gapMax: 3 },
      { upTo: 1910, cap: 0.98, q: 0.97, gapMax: 3 },
      { upTo: 1915, cap: 0.98, q: 0.954, gapMax: 3 },
      { upTo: 1920, cap: 0.98, q: 0.97, gapMax: 3 },
      { upTo: 1925, cap: 0.98, q: 0.97, gapMax: 3 },
      { upTo: 1930, cap: 0.98, q: 0.964, gapMax: 4 },
      { upTo: 1935, cap: 0.98, q: 0.909, gapMax: 5 },
      { upTo: 1940, cap: 0.98, q: 0.754, gapMax: 5 },
    ],
    basis: 'design',
    note: '1940년 이전 출생 어머니의 3째 이후 이어짐 확률 — 공표 출산 순위 비중에서 유도한 값은 출산이 많던 코호트의 총 자녀 수를 낮게 만들어(모형 3.2명 vs FD6 4.1~5.6), 코호트별로 FD6 센서스 평균 출생아 수에 맞춘 설계값',
  },
  earlyLoss: {
    value: {
      enabled: true,
      maxAge: 19,
      stats: { happiness: -8, relationships: -2, health: -1 },
      family: { father: -500, mother: -300, motherHomemaker: -150 },
      wealthMultiplier: [0.8, 1.0, 1.2, 1.6, 2.0],
    },
    basis: 'design',
    note: '주인공 19세 이하에 부모 한 분이 떠나는 해에만 한 번 — 행복 −8·관계 −2·건강 −1, 집안 살림은 아버지 −500·어머니 −300(집안일이면 −150)만 원에 재력 단계 배율 0.8~2.0. A-6 초안(통계 없는 설계값)이고 FM4b 재측정(docs/data/family-remeasure.md)으로 확인했다. 20세 이상은 기록 전용',
  },
};

export const FAMILY_TABLES: FamilyTables = { ...(tablesJson as unknown as Omit<FamilyTables, 'design'>), design: FAMILY_DESIGN };

/**
 * 표의 근거 표시 (FA0-4 `basis`): `official` 확인, `calc` 확인(환산), `estimated` 추정, `design` 설계값. 화면의 접이식 「이 칸은 어떻게 정했나요」(FM6)가 읽는 목록이다.
 */
export const FAMILY_BASIS: ReadonlyArray<{ id: string; basis: 'official' | 'calc' | 'estimated' | 'design'; note: string }> = [
  { id: 'mortality-1970-2024', basis: 'official', note: '간이생명표 5세 구간 사망확률(KOSIS DT_1B41, 1970~2024). 2024 뒤는 2024 값을 유지한다(미래 개선 없음)' },
  { id: 'mortality-before-1970', basis: 'estimated', note: '1970 앞 생명표는 없어 1970 사망확률에 배율을 곱한다 — 기대수명이 1970~1985 추세선을 거꾸로 이은 값이 되게 풀었다(하한 30세)' },
  { id: 'mother-age-1981+', basis: 'official', note: '인구동향조사 모의 연령별 출생아 구성비(1981~2025)' },
  { id: 'mother-age-1956-1980', basis: 'calc', note: '센서스 모의 연령별 적생아 역산(±0.5세)' },
  { id: 'mother-age-before-1956', basis: 'estimated', note: '1956~60 칸에서 출산 연령을 이른 쪽으로 옮긴 값(1936~55 −1세, 1916~35 −2세, 그 앞 −3세 — 크기는 설계값)' },
  { id: 'grand-cohabit-2000-2005', basis: 'calc', note: '인구총조사 아동 가구 세대 구성 환산' },
  { id: 'grand-cohabit-other', basis: 'estimated', note: '3세대 이상 가구 비율 × 1.85(2000·2005 실측 1.73·1.99의 가운데)' },
  { id: 'grand-side', basis: 'design', note: `함께 사는 조부모는 친가 ${FAMILY_DESIGN.paternalSideShare.value}, 외가 ${+(1 - FAMILY_DESIGN.paternalSideShare.value).toFixed(2)} — 통계가 없는 설계값` },
  { id: 'parent-divorce-1993+', basis: 'calc', note: '이혼 건수 × 미성년 자녀 하한 ÷ 미성년 인구 근사(1993~2025)' },
  { id: 'parent-divorce-before-1993', basis: 'estimated', note: '1993 값에 조이혼율 비를 곱해 줄인 값' },
  { id: 'parent-divorce-grandparents', basis: 'design', note: '이혼으로 떠난 부모와 같은 쪽 조부모는 다음 해부터 따로 산다(이혼 뒤 그 집안 조부모와 함께 사는 경우는 드물다고 본 설계값)' },
  { id: 'home-kind-census', basis: 'calc', note: '인구총조사 거처의 종류별 가구(1970·75·80~2010 5년, 2015~2025 매년, 시도별)에서 여섯 칸 구성비를 계산했다 — 전체 가구 기준이라 갓난아이 가구의 선택 효과는 보정하지 않았다' },
  { id: 'home-kind-between-census', basis: 'estimated', note: '센서스 사이 연도는 두 해 사이 선형 보간, 분류가 바뀌는 구간(1975→80, 2000→05, 2010→15)은 가까운 해의 값, 시도 줄이 없던 승격 전 광역시는 부모 도 줄' },
  { id: 'home-kind-before-1970', basis: 'design', note: '1969 이하 출생은 1970 구성비를 거슬러 쓴다(건물 종류 표가 없다) — 아파트 칸은 0.1%, 다세대는 0, 주택 이외의 거처는 1940~1999년 출생에서만' },
  { id: 'home-tenure-income', basis: 'design', note: '점유 형태(자가·임차·무상)와 소득계층(수저 단계)은 센서스 점유 × 거처 종류(2010·15·20)와 주거실태조사 소득계층 × 주택유형(2006~2024)에서 독립 가정의 곱으로 얻었다. 수저 단계 → 소득계층 섞음은 출생신고와 같고, 시도 → 지역 3분류(수도권·광역시 등·도지역)는 게임이 정했다' },
  { id: 'home-rent-room', basis: 'design', note: '단독주택에 임차로 사는 가구가 셋방인 비율(1990 앞 85% → 2005 60% → 2020 50%)은 통계가 없는 설계값' },
  { id: 'home-rooms', basis: 'calc', note: '사용 방 수는 센서스(1980~2010) 거처 종류 × 가구원 수 표에서 뽑고, 1980 앞은 1980, 2010 뒤는 2010 값을 쓴다(1990→95 방 수 정의 변화 의심). 그 연도 분포에서 하위 5%에 못 미치는 드문 방 수는 쓰지 않는다(문턱은 연도 함수)' },
  { id: 'siblings-old-cohort', basis: 'design', note: '1940년 이전 출생 어머니는 출산이 많던 코호트라 이어짐 상한·고차 이어짐·터울 상한을 코호트별로 센서스 평균 출생아 수(FD6)에 맞춘 설계값을 쓴다(모형이 3.2명으로 낮게 나오던 것을 ±0.45 안으로)' },
  { id: 'early-loss', basis: 'design', note: '19세 이하에 부모 한 분이 떠난 해에 한 번만 행복 −8, 관계 −2, 건강 −1과 집안 살림(아버지 −500, 어머니 −300만 원 × 재력 배율 0.8~2.0)이 더해진다 — 통계가 없는 설계값(재측정은 docs/data/family-remeasure.md)'},
  {
    id: 'siblings',
    basis: 'design',
    note: `아래 동생 수는 공표 출산 순위 비중에서 유도한 근사(이어짐 상한 ${FAMILY_DESIGN.continueCap.value}), 터울 2~5년·독립 나이 ${FAMILY_DESIGN.leaveAge.value.min}~${FAMILY_DESIGN.leaveAge.value.max}·성별 균등(남 ${FAMILY_DESIGN.maleShare.value})은 설계값`,
  },
];
