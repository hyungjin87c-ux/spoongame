import { REGION_KEYS, type RegionKey } from './regionKeys';

/**
 * 지역 이름 (SPEC-003 RL1·BR2, docs/design/copy.md 3-2절). 룰렛(릴·확률표)은 **줄임 이름**(서울·부산·…·전남광주·제주)으로 통일하고,
 * 서류(출생신고)·또래 목록은 **정식 이름 + 시군구**(「전남광주통합특별시 순천시」)로 적는다. 통계 데이터(koreaStats.json)의 시·도 이름은 줄임 이름이다.
 */

/**
 * 룰렛 릴·확률표의 지역 순서. 회전·결과·움직임 줄이기가 모두 같은 순서다(REV-003-D-2 R-171, copy.md 「룰렛 · 릴 순서」).
 * 지금 세상은 16개(서울·부산·대구·인천·대전·울산·세종·경기·강원·충북·충남·전북·전남광주·경북·경남·제주) — 광주·전남이 합쳐진 「전남광주」는 옛 전남 자리에 온다.
 * 지난 세상의 시대별 목록(광주·전남이 따로 있고 울산·세종이 없는 등)도 이 순서의 부분 목록이다.
 */
export const REGION_ORDER: readonly string[] = ['서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종', '경기', '강원', '충북', '충남', '전북', '전남', '전남광주', '경북', '경남', '제주'];

/** 지역 목록을 REGION_ORDER 순서로 정렬한 새 배열(목록에 없는 이름은 뒤로). 안정 정렬이라 같은 입력 → 같은 출력. */
export function sortRegions<T extends { name: string }>(regions: readonly T[]): T[] {
  const rank = (name: string) => {
    const k = REGION_ORDER.indexOf(name);
    return k < 0 ? REGION_ORDER.length : k;
  };
  return regions
    .map((region, index) => ({ region, index }))
    .sort((a, b) => rank(a.region.name) - rank(b.region.name) || a.index - b.index)
    .map((x) => x.region);
}

/** 지금의 정식 이름 (2026년 행정구역 — 시험 전용 R1 프로필의 표기와 「지금의 시도」 병기가 쓴다) */
export const FORMAL_SIDO_NOW: Readonly<Record<string, string>> = {
  서울: '서울특별시',
  부산: '부산광역시',
  대구: '대구광역시',
  인천: '인천광역시',
  광주: '광주광역시',
  대전: '대전광역시',
  울산: '울산광역시',
  세종: '세종특별자치시',
  경기: '경기도',
  강원: '강원특별자치도',
  충북: '충청북도',
  충남: '충청남도',
  전북: '전북특별자치도',
  전남: '전라남도',
  전남광주: '전남광주통합특별시',
  경북: '경상북도',
  경남: '경상남도',
  제주: '제주특별자치도',
};

/** 시·도 줄임 이름 → 지금의 정식 이름 (시험 전용 R1 프로필의 2026년 행정구역 표기). 모르는 이름이면 throw — 데이터와 표가 어긋난 것을 조용히 넘기지 않는다. */
export function formalSido(region: string): string {
  const name = FORMAL_SIDO_NOW[region];
  if (name === undefined) throw new RangeError(`formalSido: 「${region}」의 정식 이름이 없다`);
  return name;
}

export interface Place {
  /** 룰렛이 정한 시·도(줄임 이름) */
  region: string;
  /** 시군구가 통계에서 속한 시·도(줄임 이름) */
  sigunguSido: string;
  /** 시군구 이름(일반구는 「수원시 장안구」) */
  sigungu: string;
}

/**
 * 서류에 적는 「태어난 곳」(시험 전용 R1 프로필, 2026년 행정구역): 정식 시·도 이름 + 시군구. 세종은 시군구 이름이 시·도 이름과 같아 한 번만 적는다(「세종특별자치시」).
 * 세대 판(1940~2020년생)은 시군구가 없고 `regionLabelAt`이 그 해의 행정구역 이름을 쓴다(NR3).
 */
export function placeLabel(place: Place & { sigunguSido: string; sigungu: string }): string {
  const formal = formalSido(place.region);
  return place.sigungu === formal ? formal : `${formal} ${place.sigungu}`;
}

// ---------- 그 해의 행정구역 이름 (SPEC-004 NR3·RG2 (c)) ----------

/**
 * 시·도별 이름의 연혁: 출생 연도 이후 가장 가까운 시작 연도의 이름을 쓴다(`docs/data/dc2-dc7-regions-history.json` `keys[].nameThen`을 연 단위로 옮긴 것 — 해 중간에 바뀐 이름은 그 해부터).
 * 시 승격 연도를 확인하지 못한 곳(부산 1963년 앞)은 일반 이름만 적는다. 강원·전북 특별자치도 개칭(2023·2024)과 광주·전남 통합(2026)은 출생 연도 상한(2020) 뒤라 출생 연도의 이름에는 나오지 않는다.
 */
const NAME_HISTORY: Readonly<Record<RegionKey, ReadonlyArray<readonly [from: number, label: string]>>> = {
  seoul: [[1940, '경기도 경성부'], [1946, '서울시'], [1949, '서울특별시']],
  busan: [[1940, '경상남도 부산시'], [1963, '부산직할시'], [1995, '부산광역시']],
  daegu: [[1940, '경상북도 대구부'], [1949, '경상북도 대구시'], [1981, '대구직할시'], [1995, '대구광역시']],
  incheon: [[1940, '경기도 인천부'], [1949, '경기도 인천시'], [1981, '인천직할시'], [1995, '인천광역시']],
  gwangju: [[1940, '전라남도 광주부'], [1949, '전라남도 광주시'], [1986, '광주직할시'], [1995, '광주광역시']],
  daejeon: [[1940, '충청남도 대전부'], [1949, '충청남도 대전시'], [1989, '대전직할시'], [1995, '대전광역시']],
  ulsan: [[1940, '경상남도 울산군'], [1962, '경상남도 울산시'], [1997, '울산광역시']],
  sejong: [[2012, '세종특별자치시']],
  gyeonggi: [[1940, '경기도']],
  gangwon: [[1940, '강원도']],
  chungbuk: [[1940, '충청북도']],
  chungnam: [[1940, '충청남도']],
  jeonbuk: [[1940, '전라북도']],
  jeonnam: [[1940, '전라남도']],
  gyeongbuk: [[1940, '경상북도']],
  gyeongnam: [[1940, '경상남도']],
  jeju: [[1940, '전라남도 제주도'], [1946, '제주도'], [2006, '제주특별자치도']],
};

/** 지금의 시도 (2026-07-01 광주·전남 통합 반영 — 현행 시·도 16개) */
const NOW_NAME: Readonly<Record<RegionKey, string>> = {
  seoul: '서울특별시',
  busan: '부산광역시',
  daegu: '대구광역시',
  incheon: '인천광역시',
  gwangju: '전남광주통합특별시',
  daejeon: '대전광역시',
  ulsan: '울산광역시',
  sejong: '세종특별자치시',
  gyeonggi: '경기도',
  gangwon: '강원특별자치도',
  chungbuk: '충청북도',
  chungnam: '충청남도',
  jeonbuk: '전북특별자치도',
  jeonnam: '전남광주통합특별시',
  gyeongbuk: '경상북도',
  gyeongnam: '경상남도',
  jeju: '제주특별자치도',
};

function keyOfShort(short: string): RegionKey {
  const hit = REGION_KEYS.find((r) => r.short === short);
  if (hit === undefined) throw new RangeError(`regionLabelAt: 알 수 없는 시·도 「${short}」`);
  return hit.key;
}

/** 그 출생 연도의 행정구역 이름 (예: 1960년 대구 → 「경상북도 대구시」). 그 해에 없던 시·도(세종 2012년 전)는 throw */
export function regionNameAt(short: string, year: number): string {
  const key = keyOfShort(short);
  const hist = NAME_HISTORY[key];
  if (year < hist[0][0]) throw new RangeError(`regionNameAt: ${year}년에는 ${short}이(가) 없었다`);
  let label = hist[0][1];
  for (const [from, l] of hist) if (year >= from) label = l;
  return label;
}

/** 지금의 시도 이름 (예: 「대구광역시」) */
export function regionNowName(short: string): string {
  return NOW_NAME[keyOfShort(short)];
}

/**
 * 출생신고·프로필의 출생지 글자 (RG2 (c)): **그 해의 행정구역 이름**에 지금의 시도를 괄호로 병기한다 — 이름이 지금과 같으면 괄호는 없다.
 * 예) 1960년 대구 → 「경상북도 대구시(지금의 대구광역시)」 · 1990년 경기 → 「경기도」 · 1990년 광주 → 「광주직할시(지금의 전남광주통합특별시)」.
 */
export function regionLabelAt(short: string, year: number): string {
  const then = regionNameAt(short, year);
  const now = regionNowName(short);
  return then === now ? then : `${then}(지금의 ${now})`;
}
