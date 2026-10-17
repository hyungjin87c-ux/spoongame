import type { Era } from '../core/types';

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

/** 지금 세상·다가올 세상(2026년 행정구역)의 정식 이름 */
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

/**
 * 지난 세상(1950~1989년생)의 정식 이름 — 그 시기의 이름이다(직할시·강원도·제주도). 직할시가 독립한 연도는 일반 연혁 지식이며 공식 연혁 원문과 대조하지 않았다
 * (docs/data/korea-stats-sources.md 3.8절 한계). 시대별 시·도 목록에 있는 이름만 쓰이므로(예: 1963년 전에는 「부산」이 따로 없다) 연도에 따라 달리 고르지 않는다.
 */
export const FORMAL_SIDO_PAST: Readonly<Record<string, string>> = {
  서울: '서울특별시',
  부산: '부산직할시',
  대구: '대구직할시',
  인천: '인천직할시',
  광주: '광주직할시',
  대전: '대전직할시',
  경기: '경기도',
  강원: '강원도',
  충북: '충청북도',
  충남: '충청남도',
  전북: '전라북도',
  전남: '전라남도',
  경북: '경상북도',
  경남: '경상남도',
  제주: '제주도',
};

/** 시·도 줄임 이름 → 정식 이름 (시대에 맞춰). 모르는 이름이면 throw — 데이터와 표가 어긋난 것을 조용히 넘기지 않는다. */
export function formalSido(region: string, era: Era): string {
  const table = era === 'past' ? FORMAL_SIDO_PAST : FORMAL_SIDO_NOW;
  const name = table[region];
  if (name === undefined) throw new RangeError(`formalSido: ${era} 세상에 「${region}」의 정식 이름이 없다`);
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
 * 서류에 적는 「태어난 곳」: 정식 시·도 이름 + 시군구. 세종은 시군구 이름이 시·도 이름과 같아 한 번만 적는다(「세종특별자치시」).
 * 지난 세상에서 합쳐진 시·도(경기 = 경기+인천 등) 안의 구는 어느 시·도의 구인지를 줄임 이름으로 밝힌다(「경기도 인천 중구」) — 같은 이름의 구가 서로 다른 시·도에 있기 때문이다.
 * 지난 세상의 「세종」 칸은 시군구 이름(세종특별자치시)이 그 시기에 없던 행정구역이라 「세종 지역」으로 적는다.
 */
export function placeLabel(place: Place, era: Era): string {
  const formal = formalSido(place.region, era);
  if (era !== 'past') return place.sigungu === formal ? formal : `${formal} ${place.sigungu}`;
  if (place.sigunguSido === '세종') return `${formal} 세종 지역`;
  const prefix = place.sigunguSido === place.region ? '' : `${place.sigunguSido} `;
  return `${formal} ${prefix}${place.sigungu}`;
}
