import type { BirthReport, GameState, GenerationId, ParentWealth } from '../src/core/types';
import { KNOWN_SEED, PEER_SEED, birthState } from './saves';

/**
 * 출생신고 화면의 e2e 표본 (SPEC-003 CM10·CM11·QM2-10·대비, REV-003-M3-1 R-262 → SPEC-004 GM4에서 세대 판으로). 출생신고는 내용이 판마다 달라(수저 단계·세대·장소·직업·형제 순서) 한 가지 표본(알파 세대·은수저·서울)만으로는
 * 가장 긴 내용이 폭 320·글자 200%에서 어떻게 보이는지 알 수 없다. 그래서 **가장 긴 내용을 일부러 모은 표본**을 둔다 — 값은 아래와 같고, 왜 이 조합인지는 `why`에 적었다
 *  - 가장 긴 직업 이름(기계 조작직), 가장 긴 주거(임차(전세, 월세)), 가장 긴 형제 순서(다섯째 이상), 극단 체중(1.0kg/4.9kg)
 *  - 가장 긴 장소: 세대 판의 출생지는 시·도까지만 적고 그 해의 행정구역 이름에 지금의 시도를 병기한다(NR3·RG2 (c)). 한 낱말이 가장 긴 「전남광주통합특별시)」(10글자, 광주·전남)와 전체가 가장 긴 라벨
 *    (산업화 세대 「전라남도(지금의 전남광주통합특별시)」 19글자 · 알파·Z 세대 「광주광역시(지금의 전남광주통합특별시)」 20글자)
 *  - 또래 4명: 장소 낱말이 가장 긴 조합(광주·전남 둘 이상)과 다이아몬드수저(가장 긴 수저 이름)가 함께 있는 또래 시드를 세대마다 골랐다
 *  - 비교 표는 세대 판에서 숨긴다(BR5 — 모든 표본 0행)
 * 이 표가 정말 가장 긴 조합인지는 tests/m3Variants.test.tsx가 core로 다시 계산해 대조한다(공허 통과 방지). 화면에서 의도한 내용이 실제로 보이는지는 `openM3Screen`이 매번 확인한다.
 */
/** 세대 판 출생신고의 하단 표기 줄 수 (tests/m3Variants.test.tsx가 화면 마크업으로 대조한다) */
const FOOT_NOTES = 6;

export type BirthVariantId = 'birth' | 'birth-dirt' | 'birth-diamond' | 'birth-industrial' | 'birth-genz';

export interface BirthVariant {
  generation: GenerationId;
  wealth: ParentWealth;
  looks: number;
  /** 출생신고 상세 덮어쓰기 (나머지는 e2e/saves.ts#report의 기본값) */
  report: Partial<BirthReport>;
  peerSeed: number;
  /** 화면에서 실제로 보여야 하는 것 — 비교 표 행 수(세대 판은 표가 없어 0), 하단 표기 줄 수 */
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
    generation: 'alpha',
    wealth: 3,
    looks: 50,
    report: {},
    peerSeed: PEER_SEED,
    compareRows: 0,
    footNotes: FOOT_NOTES,
    placeWord: '서울특별시',
    peerDiamond: false,
    why: '기존 표본: 알파 세대·은수저·서울 (가장 짧은 쪽의 기준선)',
  },
  'birth-dirt': {
    generation: 'alpha',
    wealth: 1,
    looks: 100,
    report: { region: '광주', housing: 'rent', birthOrder: 5, birthWeightKg: 1.0, ...LONGEST_PARENTS },
    peerSeed: 39,
    compareRows: 0,
    footNotes: FOOT_NOTES,
    placeWord: '전남광주통합특별시',
    peerDiamond: true,
    why: '흙수저: 가장 긴 낱말 「전남광주통합특별시)」(광주광역시 병기) + 가장 긴 직업·주거·형제 순서, 또래에 다이아몬드수저와 같은 긴 장소',
  },
  'birth-diamond': {
    generation: 'alpha',
    wealth: 5,
    looks: 0,
    report: { region: '광주', housing: 'rent', birthOrder: 5, birthWeightKg: 4.9, ...LONGEST_PARENTS },
    peerSeed: 39,
    compareRows: 0,
    footNotes: FOOT_NOTES,
    placeWord: '전남광주통합특별시',
    peerDiamond: true,
    why: '다이아몬드수저: 가장 긴 수저 이름 + 전체가 가장 긴 장소 「광주광역시(지금의 전남광주통합특별시)」(20글자)',
  },
  'birth-industrial': {
    generation: 'industrial',
    wealth: 1,
    looks: 50,
    report: { region: '전남', housing: 'rent', birthOrder: 5, birthWeightKg: 1.0, ...LONGEST_PARENTS },
    peerSeed: 243,
    compareRows: 0,
    footNotes: FOOT_NOTES,
    placeWord: '전남광주통합특별시',
    peerDiamond: true,
    why: '산업화 세대: 그 해 행정구역 이름 「전라남도」 + 지금의 시도 병기(19글자), 1947년생 — 가장 이른 출생 연도대의 서술',
  },
  'birth-genz': {
    generation: 'genz',
    wealth: 5,
    looks: 50,
    report: { region: '광주', housing: 'rent', birthOrder: 5, birthWeightKg: 4.9, ...LONGEST_PARENTS },
    peerSeed: 5,
    compareRows: 0,
    footNotes: FOOT_NOTES,
    placeWord: '전남광주통합특별시',
    peerDiamond: true,
    why: 'Z 세대: 2004년생·「전남광주통합특별시)」가 또래 4명 가운데 둘 이상의 장소 + 다이아몬드수저',
  },
};

export const BIRTH_VARIANT_IDS = Object.keys(BIRTH_VARIANTS) as BirthVariantId[];

/** 표본의 저장 상태 (출생신고 화면) */
export function birthVariantState(id: BirthVariantId, seed = KNOWN_SEED): GameState {
  const v = BIRTH_VARIANTS[id];
  return { ...birthState(seed, v.generation, v.wealth, v.looks, v.report), peerSeed: v.peerSeed };
}
