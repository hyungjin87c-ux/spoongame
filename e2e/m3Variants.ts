import type { BirthReport, Era, GameState, ParentWealth } from '../src/core/types';
import { KNOWN_SEED, PEER_SEED, birthState } from './saves';

/**
 * 출생신고 화면의 e2e 표본 (SPEC-003 CM10·CM11·QM2-10·대비, REV-003-M3-1 R-262). 출생신고는 내용이 판마다 달라(수저 단계·시대·장소·직업·형제 순서) 한 가지 표본(지금 세상·은수저·서울 종로구)만 재면
 * 가장 긴 내용이 폭 320·글자 200%에서 어떻게 보이는지 알 수 없다. 그래서 **가장 긴 내용을 일부러 모은 표본**을 둔다 — 값은 아래와 같고, 왜 이 조합인지는 `why`에 적었다:
 *  - 가장 긴 직업 이름(기계 조작직), 가장 긴 주거(임차(전세, 월세)), 가장 긴 형제 순서(다섯째 이상), 극단 체중(1.0kg/4.9kg)
 *  - 가장 긴 장소: 한 낱말이 가장 긴 「전남광주통합특별시」(9글자, 지금·다가올 세상) / 전체가 가장 긴 「전북특별자치도 전주시 완산구」(15글자) / 지난 세상 「경상남도 창원시 마산합포구」(14글자)
 *  - 또래 4명: 장소가 가장 긴 조합(전남광주통합특별시 둘 이상)과 다이아몬드수저(가장 긴 수저 이름)가 함께 있는 또래 시드를 시대마다 골랐다
 *  - 비교 표(지금 세상만, 행 3개가 최대)·하단 표기(지난·다가올 세상은 시대 보정 한 줄이 더해져 5줄이 최대)
 * 이 표가 정말 가장 긴 조합인지는 tests/m3Variants.test.tsx가 core로 다시 계산해 대조한다(공허 통과 방지). 화면에서 의도한 내용이 실제로 보이는지는 `openM3Screen`이 매번 확인한다.
 */
export type BirthVariantId = 'birth' | 'birth-dirt' | 'birth-diamond' | 'birth-past' | 'birth-future';

export interface BirthVariant {
  era: Era;
  wealth: ParentWealth;
  looks: number;
  /** 출생신고 상세 덮어쓰기 (나머지는 e2e/saves.ts#report의 기본값) */
  report: Partial<BirthReport>;
  peerSeed: number;
  /** 화면에서 실제로 보여야 하는 것 — 비교 표 행 수(지금 세상만 3, 지난·다가올 세상은 표가 없어 0), 하단 표기 줄 수(지금 4, 지난·다가올 5) */
  compareRows: number;
  footNotes: number;
  /** 「태어난 곳」 칸에 보여야 할 가장 긴 낱말 */
  placeWord: string;
  /** 또래 4명 중에 다이아몬드수저(가장 긴 수저 이름)가 있는가 */
  peerDiamond: boolean;
  why: string;
}

/** 가장 긴 직업 이름 「기계 조작직」을 두 부모에게 */
const LONGEST_PARENTS: Pick<BirthReport, 'mother' | 'father'> = { mother: { age: 44, job: 'machine' }, father: { age: 50, job: 'machine' } };

export const BIRTH_VARIANTS: Readonly<Record<BirthVariantId, BirthVariant>> = {
  birth: {
    era: 'present',
    wealth: 3,
    looks: 50,
    report: {},
    peerSeed: PEER_SEED,
    compareRows: 3,
    footNotes: 4,
    placeWord: '종로구',
    peerDiamond: false,
    why: '기존 표본: 지금 세상·은수저·서울 종로구 (가장 짧은 쪽의 기준선)',
  },
  'birth-dirt': {
    era: 'present',
    wealth: 1,
    looks: 100,
    report: { region: '전남광주', sigunguSido: '광주', sigungu: '광산구', housing: 'rent', birthOrder: 5, birthWeightKg: 1.0, ...LONGEST_PARENTS },
    peerSeed: 29585,
    compareRows: 3,
    footNotes: 4,
    placeWord: '전남광주통합특별시',
    peerDiamond: true,
    why: '흙수저: 지금 세상 비교 표 3행(최대) + 가장 긴 낱말 「전남광주통합특별시」 + 가장 긴 직업·주거·형제 순서, 또래에 다이아몬드수저와 같은 긴 장소',
  },
  'birth-diamond': {
    era: 'present',
    wealth: 5,
    looks: 0,
    report: { region: '전북', sigunguSido: '전북', sigungu: '전주시 완산구', housing: 'rent', birthOrder: 5, birthWeightKg: 4.9, ...LONGEST_PARENTS },
    peerSeed: 29585,
    compareRows: 3,
    footNotes: 4,
    placeWord: '전북특별자치도',
    peerDiamond: true,
    why: '다이아몬드수저: 가장 긴 수저 이름 + 지금 세상 전체가 가장 긴 장소 「전북특별자치도 전주시 완산구」 + 비교 표 3행',
  },
  'birth-past': {
    era: 'past',
    wealth: 1,
    looks: 50,
    report: { region: '경남', sigunguSido: '경남', sigungu: '창원시 마산합포구', housing: 'rent', birthOrder: 5, birthWeightKg: 1.0, ...LONGEST_PARENTS },
    peerSeed: 17327,
    compareRows: 0,
    footNotes: 5,
    placeWord: '마산합포구',
    peerDiamond: true,
    why: '지난 세상: 하단 표기 5줄(최다: 지역·통계·주거·설계 보정 + 시대 보정) + 가장 긴 장소 「경상남도 창원시 마산합포구」, 비교 표 없음',
  },
  'birth-future': {
    era: 'future',
    wealth: 5,
    looks: 50,
    report: { region: '전남광주', sigunguSido: '광주', sigungu: '광산구', housing: 'rent', birthOrder: 5, birthWeightKg: 4.9, ...LONGEST_PARENTS },
    peerSeed: 109733,
    compareRows: 0,
    footNotes: 5,
    placeWord: '전남광주통합특별시',
    peerDiamond: true,
    why: '다가올 세상: 하단 표기 5줄 + 「전남광주통합특별시」가 또래 4명 모두의 장소 + 다이아몬드수저, 비교 표 없음',
  },
};

export const BIRTH_VARIANT_IDS = Object.keys(BIRTH_VARIANTS) as BirthVariantId[];

/** 표본의 저장 상태 (출생신고 화면) */
export function birthVariantState(id: BirthVariantId, seed = KNOWN_SEED): GameState {
  const v = BIRTH_VARIANTS[id];
  return { ...birthState(seed, v.era, v.wealth, v.looks, v.report), peerSeed: v.peerSeed };
}
